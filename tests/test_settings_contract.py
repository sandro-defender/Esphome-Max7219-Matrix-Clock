"""Configurator coverage and real installer/package merge regressions.

Only SDK imports/merge/substitution helpers are used here, never the ESPHome CLI,
configuration validation, codegen or a firmware build. Full YAML validation is
an explicit, separate command in scripts/validate.py.
"""
from __future__ import annotations

import copy
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from generate_firmware_contract import Tag, load  # noqa: E402

CONTRACT = json.loads((ROOT / "web-configurator/src/firmware.generated.json").read_text())
BINDINGS = json.loads((ROOT / "packages/configurator.json").read_text())
DOMAINS = ("select", "number", "switch", "button", "sensor", "text_sensor", "binary_sensor")
ESBUILD = ROOT / "web-configurator/node_modules/esbuild/bin/esbuild"


def named_entities(config):
    for domain in DOMAINS:
        for item in config.get(domain, []):
            if "name" in item:
                yield domain, item
            else:
                for child in item.values():
                    if isinstance(child, dict) and "name" in child:
                        yield domain, child


class SettingsCoverageTests(unittest.TestCase):
    def test_every_substitution_is_a_setting_exposure_flag_or_internal_metadata(self):
        subs = {}
        for path in CONTRACT["packageFiles"]:
            subs.update(load(ROOT / path).get("substitutions", {}))
        covered = set(BINDINGS["internalSubstitutions"])
        for setting in CONTRACT["settings"]:
            if setting["kind"] == "substitution":
                covered.add(setting["target"])
            if "substitution" in setting:
                covered.add(setting["substitution"])
        covered.update(e["visibilitySubstitution"] for e in CONTRACT["entities"])
        self.assertEqual(set(subs), covered)
        self.assertFalse(covered & set(CONTRACT["secrets"]))
        self.assertEqual({item["group"] for item in CONTRACT["settings"]}, {g["id"] for g in CONTRACT["groups"]})

    def test_install_time_weather_sources_keep_legacy_temperature_and_import_weather_attributes(self):
        expected_substitutions = {
            "home_temperature_entity": "sensor.living_room_temperature",
            "outdoor_temperature_entity": "sensor.openweathermap_temperature",
            "weather_entity": "weather.openweathermap",
        }
        for base_path in ("packages/base.yaml", "packages/base-esp32.yaml"):
            substitutions = load(ROOT / base_path)["substitutions"]
            for name, example in expected_substitutions.items():
                self.assertEqual(substitutions[name], example)
            self.assertEqual(substitutions["temperature_entity"], "sensor.outdoor_temperature")
        bindings = BINDINGS["substitutions"]
        self.assertEqual({bindings[key]["target"] for key in (
            "homeTemperatureEntity", "outdoorTemperatureEntity", "weatherEntity"
        )}, set(expected_substitutions))

        network = load(ROOT / "packages/network.yaml")
        self.assertEqual(network["sensor"][0]["id"], "temperature_sensor")
        imported = {item["id"]: item for item in network["text_sensor"]}
        self.assertEqual(imported["home_temperature_text"]["entity_id"], "${home_temperature_entity}")
        self.assertEqual(imported["outdoor_temperature_text"]["entity_id"], "${outdoor_temperature_entity}")
        self.assertEqual(imported["weather_condition_text"]["entity_id"], "${weather_entity}")
        self.assertEqual(imported["weather_temperature_text"]["entity_id"], "${weather_entity}")
        self.assertEqual(imported["weather_temperature_text"]["attribute"], "temperature")
        self.assertTrue(all(item["internal"] for item in imported.values()))

    def test_clock_layout_and_date_weather_controls_restore_and_redraw(self):
        controls = load(ROOT / "packages/controls.yaml")
        clock_layout = next(item for item in controls["select"] if item.get("id") == "clock_layout")
        self.assertEqual(clock_layout["name"], "Clock layout")
        self.assertTrue(clock_layout["restore_value"])
        self.assertEqual(clock_layout["initial_option"], "Clock only")
        self.assertEqual(clock_layout["options"], [
            "Clock only", "Clock + weather icon", "Clock + home and outdoor weather"
        ])
        self.assertEqual(clock_layout["set_action"], [{"component.update": "matrix"}])

        date_controls = load(ROOT / "packages/date_controls.yaml")
        switches = {item["id"]: item for item in date_controls["switch"]}
        self.assertEqual(set(switches), {"date_show_weather_icon", "date_show_outdoor_temperature"})
        for entity in switches.values():
            self.assertTrue(entity["optimistic"])
            self.assertEqual(entity["restore_mode"], "RESTORE_DEFAULT_OFF")
            self.assertEqual(entity["turn_on_action"], [{"script.execute": "request_matrix_refresh"}])
            self.assertEqual(entity["turn_off_action"], [{"script.execute": "request_matrix_refresh"}])
        self.assertEqual({
            BINDINGS["entities"][key]["target"]
            for key in ("clockLayout", "dateShowWeatherIcon", "dateShowOutdoorTemperature")
        }, {"clock_layout", *switches})

    def test_every_named_entity_has_a_unique_internal_flag_including_nested_diagnostics(self):
        actual = {}
        for path in CONTRACT["packageFiles"]:
            for domain, entity in named_entities(load(ROOT / path)):
                self.assertNotIn(entity["id"], actual)
                actual[entity["id"]] = (domain, entity)
        self.assertEqual(set(actual), {entity["id"] for entity in CONTRACT["entities"]})
        flags = load(ROOT / "packages/entity_visibility.yaml")["substitutions"]
        self.assertEqual(set(flags), {e["visibilitySubstitution"] for e in CONTRACT["entities"]})
        for entity in CONTRACT["entities"]:
            domain, source = actual[entity["id"]]
            self.assertEqual(entity["domain"], domain)
            self.assertEqual(source["internal"], "${" + entity["visibilitySubstitution"] + "}")
            self.assertEqual(flags[entity["visibilitySubstitution"]], "false")
            self.assertTrue(entity["visibleByDefault"])
        temperature = load(ROOT / "packages/network.yaml")["sensor"][0]
        self.assertTrue(temperature["internal"])
        self.assertNotIn(temperature["id"], actual)

    def test_entity_ids_do_not_shadow_included_esphome_integrations(self):
        names = set()
        for path in CONTRACT["packageFiles"]:
            module = load(ROOT / path)
            names.update(module)
            for entries in module.values():
                if isinstance(entries, list):
                    names.update(item["platform"] for item in entries if isinstance(item, dict) and "platform" in item)
        self.assertFalse(names & {entity["id"] for entity in CONTRACT["entities"]})

    def test_security_invariants_and_optional_package_secrets_are_not_ui_preferences(self):
        web = load(ROOT / "packages/web_server.yaml")["web_server"]
        self.assertFalse(web["ota"])
        self.assertFalse(web["include_internal"])
        self.assertEqual(web["auth"]["password"], "${web_server_password}")
        ota = load(ROOT / "packages/ota_ui.yaml")["ota"][0]
        self.assertEqual(ota["encryption"]["key"], "${api_encryption_key}")
        optional = next(item for item in CONTRACT["settings"] if item["key"] == "webServer")
        self.assertEqual(optional["kind"], "package")
        self.assertEqual(optional["exclusiveSecrets"], ["web_server_password", "web_server_username"])
        self.assertNotIn("project_ref", {b["target"] for b in BINDINGS["substitutions"].values()})


@unittest.skipUnless(ESBUILD.is_file() and shutil.which("node"), "Installer merge tests need npm ci and Node")
class InstallerMergeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from importlib.metadata import version, PackageNotFoundError
        try:
            if version("esphome") != CONTRACT["esphomeVersion"]:
                raise unittest.SkipTest("Requires the exact pinned ESPHome SDK")
        except PackageNotFoundError:
            raise unittest.SkipTest("Requires the exact pinned ESPHome SDK")
        cls.temp = tempfile.TemporaryDirectory(prefix="clock-settings-")
        cls.addClassCleanup(cls.temp.cleanup)
        cls.work = Path(cls.temp.name)
        cls.bundle = cls.work / "installer.cjs"
        subprocess.run(["node", str(ESBUILD), "web-configurator/scripts/installer.ts", "--bundle", "--platform=node",
                        "--format=cjs", "--define:import.meta.env={}", "--outfile=" + str(cls.bundle)],
                       cwd=ROOT, check=True, capture_output=True, text=True)

    def installer(self, profile):
        source = self.work / "profile.json"
        source.write_text(json.dumps(profile))
        destination = self.work / "installer.yaml"
        subprocess.run(["node", str(self.bundle), CONTRACT["releaseVersion"], str(destination), "--config", str(source)],
                       cwd=ROOT, check=True, capture_output=True, text=True)
        return load(destination)

    def merged(self, installer):
        from esphome.config import resolve_extend_remove
        from esphome.config_helpers import Extend, merge_config
        from esphome.components.substitutions import do_substitution_pass

        def convert(value):
            if isinstance(value, Tag):
                return Extend(str(value)) if value.tag == "!extend" else str(value)
            if isinstance(value, dict):
                return {key: convert(child) for key, child in value.items()}
            if isinstance(value, list):
                return [convert(child) for child in value]
            return value

        config = {}
        for path in installer["packages"]["clock"]["files"]:
            config = merge_config(config, convert(load(ROOT / path)))
        own = copy.deepcopy(installer)
        del own["packages"]
        config = merge_config(config, convert(own))
        resolve_extend_remove(config)
        return do_substitution_pass(config, {})

    def test_real_generated_yaml_merges_for_both_targets_with_hidden_entities_and_optional_web_server(self):
        from esphome import config_validation as cv
        ids = [entity["id"] for entity in CONTRACT["entities"]]
        for target in CONTRACT["hardwareTargets"]:
            for hidden in ([], ["clock_font", "screen_mode", "free_heap", "ip_address", "restart_device"], ids):
                for web in (True, False):
                    with self.subTest(target=target["id"], hidden=len(hidden), web=web):
                        installer = self.installer({"target": target["id"], "hiddenEntities": hidden, "webServer": web,
                                                    "brightness": 7, "dateScreenDuration": 25, "clockFont": "matrix-2px"})
                        merged = self.merged(installer)
                        self.assertIn(target["platform"], merged)
                        self.assertNotIn("esp32" if target["platform"] == "esp8266" else "esp8266", merged)
                        self.assertEqual("web_server" in merged, web)
                        for secret in ("web_server_username", "web_server_password"):
                            self.assertEqual(secret in installer["substitutions"], web)
                        actual = {entity["id"]: entity for _, entity in named_entities(merged)}
                        self.assertEqual(set(actual), set(ids))
                        for id_, entity in actual.items():
                            self.assertEqual(cv.boolean(entity["internal"]), id_ in hidden)
                        self.assertEqual(actual["matrix_brightness"]["initial_value"], 7)
                        self.assertEqual(actual["date_screen_duration"]["initial_value"], 25)
                        self.assertEqual(actual["clock_font"]["initial_option"], "Matrix 2px")
                        self.assertIn("Matrix 2px", actual["clock_font"]["options"])
                        self.assertEqual({item["action"] for item in merged["api"]["actions"]}, {a["action"] for a in CONTRACT["actions"]})
                        self.assertTrue(any(script["id"] == "restore_display_defaults" for script in merged["script"]))
                        self.assertTrue(any(entity.get("id") == "temperature_sensor" and entity["internal"] for entity in merged["sensor"]))

    def test_network_and_web_settings_resolve_from_the_installer_not_second_defaults(self):
        installer = self.installer({"wifiPowerSave": "LIGHT", "wifiRebootTimeout": 0, "apiRebootTimeout": 60,
                                    "fallbackApTimeout": 120, "sntpUpdateInterval": 7200, "sntpServer1": "time.example.org",
                                    "sntpServer2": "192.0.2.1", "webServerPort": 8080, "webServerVersion": 3,
                                    "webServerAuthType": "digest", "webServerLog": True})
        config = self.merged(installer)
        self.assertEqual(config["wifi"]["power_save_mode"], "LIGHT")
        self.assertEqual(config["wifi"]["reboot_timeout"], "0s")
        self.assertEqual(config["wifi"]["ap"]["ap_timeout"], "120s")
        self.assertEqual(config["api"]["reboot_timeout"], "60s")
        self.assertEqual(config["time"][1]["servers"], ["time.example.org", "192.0.2.1"])
        self.assertEqual(config["time"][1]["update_interval"], "7200s")
        self.assertEqual(config["web_server"]["port"], "8080")
        self.assertEqual(config["web_server"]["version"], "3")
        self.assertEqual(config["web_server"]["auth"]["type"], "digest")
        self.assertEqual(config["web_server"]["log"], "true")
        self.assertFalse(re.search(r"\$\{ha_hide_", json.dumps(config)))


if __name__ == "__main__":
    unittest.main()
