#!/usr/bin/env python3
"""Offline contract tests for the MAX7219 clock packages.

These tests do not need ESPHome or a network connection. They check the
invariants that the roadmap requires and that are easy to break while editing
YAML:

  * ESPHome target version and module layout
  * modern `api.actions` usage (no legacy `api.services`)
  * encrypted native OTA that reuses the API key
  * the complete Home Assistant entity set
  * ESP8266 action-string budget (384 bytes per action)
  * credentials only behind !secret, secrets.yaml untracked
  * release example pinning (tag, not @main) and font pinning consistency
  * every font is selectable in Home Assistant and wired into the display
  * every font still fits worst-case "88:88:88" on the default 48x8 matrix
  * the pure C++ renderer unit tests, when a compiler is available

Run it directly:

    python3 tests/test_config.py

Exit code is non-zero when any test fails.
"""

from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - PyYAML ships with ESPHome
    print("PyYAML is required: pip install -r requirements-validation.txt")
    raise SystemExit(2)

REPO = Path(__file__).resolve().parent.parent
PACKAGES = REPO / "packages"
FIRMWARE = json.loads((REPO / "web-configurator/src/firmware.generated.json").read_text())
TARGET_VERSION = "2026.9.1"
DEFAULT_MATRIX_WIDTH = 48  # six 8x8 modules in one row

REQUIRED_MODULES = [
    "base.yaml",
    "network.yaml",
    "renderer.yaml",
    "display.yaml",
    "controls.yaml",
    "buttons.yaml",
    "entity_visibility.yaml",
    "actions.yaml",
    "diagnostics.yaml",
    "ota_ui.yaml",
    "web_server.yaml",
    "fonts_web.yaml",
    "fonts_local.yaml",
    "max7219_clock_renderer.h",
    "max7219_clock_esphome.h",
    "georgian_bitmap_font.generated.h",
]

REQUIRED_ENTITIES = {
    "select": [
        "Screen",
        "Clock alignment",
        "Time format",
        "Seconds display",
        "Date format",
        "Clock font",
        "Message scroll",
    ],
    "number": [
        "Matrix brightness",
        "Night brightness",
        "Animation duration",
        "Animation row gap",
        "Message scroll speed",
        "Default message duration",
        "Countdown duration",
        "Screen cycle interval",
        "Night start hour",
        "Night end hour",
    ],
    "switch": [
        "Matrix display",
        "Blinking colon",
        "Digit animation",
        "Automatic screen cycling",
        "Night mode",
        "Night schedule",
        "Display inversion",
    ],
    "button": [
        "Restart device",
        "Return to clock",
        "Clear message",
        "Start countdown",
        "Cancel countdown",
        "Run module grid test",
        "Run pixel test",
        "Restore display defaults",
    ],
    "sensor": ["Wi-Fi signal", "Uptime", "Free heap", "Countdown remaining", "OTA percent"],
    "text_sensor": [
        "ESPHome version",
        "Display mode",
        "OTA state",
        "IP address",
        "Connected SSID",
        "Reset reason",
    ],
    "binary_sensor": ["Status"],
}

REQUIRED_ACTIONS = {
    "show_message": {"message": "string", "duration": "int"},
    "clear_message": {},
    "start_countdown": {"seconds": "int"},
    "cancel_countdown": {},
    "show_status": {"note": "string", "duration": "int"},
    "get_status": {},
}

# Clock font select option for every compiled font. Adding a font without
# teaching the select, the display lambda and the web configurator about it is
# the most likely way to ship a font nobody can choose.
FONT_OPTION_BY_ID = {
    "font_pixel_clock_6x8_source": "Pixel Clock 6x8",
    "font_md_parola_numeric_7seg_source": "MD Parola Numeric 7-Segment",
    "font_md_max72xx_system_source": "MD MAX72XX System",
    "font_matrix_2px_source": "Matrix 2px",
    "font_dot_matrix_source": "Dot Matrix",
    "font_mg_minecraft_georgian_source": "MG Minecraft Georgian",
    "font_georgian_mkhedruli_8x8_source": "Georgian Mkhedruli 8x8",
    "font_matrix_sans_screen_source": "Matrix Sans Screen",
    "font_sevenish_mono_8_source": "Sevenish Mono 8",
}

# Clock-first faces compile the status set; the project Georgian face also
# includes every Mkhedruli code point. The compact built-in remains the Latin
# message fallback; the release default still includes only its two core faces.
FONT_REQUIRED_GLYPHS = "0123456789:.-/%!?+ "

GEORGIAN_MKHEDRULI = "აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ"
GEORGIAN_MTAVRULI = "ᲐᲑᲒᲓᲔᲕᲖᲗᲘᲙᲚᲛᲜᲝᲞᲟᲠᲡᲢᲣᲤᲥᲦᲧᲨᲩᲪᲫᲬᲭᲮᲯᲰ"

# Height of one 8x8 module row; digits must never be taller than the panel.
MATRIX_ROW_HEIGHT = 8

# Values that are allowed to appear as literal credentials in tracked files.
PLACEHOLDER_PATTERNS = [
    re.compile(r"^\$\{"),
    re.compile(r"^!secret"),
    re.compile(r"Your", re.IGNORECASE),
    re.compile(r"REPLACE", re.IGNORECASE),
    re.compile(r"ChangeThis", re.IGNORECASE),
    re.compile(r"^Padding", re.IGNORECASE),
    re.compile(r"FallbackHotspot", re.IGNORECASE),
    re.compile(r"^Validation", re.IGNORECASE),
    re.compile(r"^MAX7219 Clock Fallback$"),
]


class TaggedValue:
    """Placeholder for ESPHome specific YAML tags (!secret, !lambda, ...)."""

    def __init__(self, tag: str, value):
        self.tag = tag
        self.value = value

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<{self.tag}:{self.value!r}>"


class EsphomeLoader(yaml.SafeLoader):
    """YAML loader that understands ESPHome tags used in this repository."""

    def __init__(self, stream, base_dir: Path | None = None):
        super().__init__(stream)
        self._base_dir = base_dir

    def construct_include(self, node):
        # Keep the referenced path; tests that need the contents load the file
        # explicitly so a broken include is reported instead of hidden.
        return TaggedValue("!include", self.construct_scalar(node))


def _construct_unknown(loader: EsphomeLoader, tag_suffix: str, node):
    tag = f"!{tag_suffix}"
    if tag == "!include":
        return loader.construct_include(node)
    if isinstance(node, yaml.ScalarNode):
        return TaggedValue(tag, loader.construct_scalar(node))
    if isinstance(node, yaml.SequenceNode):
        return TaggedValue(tag, loader.construct_sequence(node))
    return TaggedValue(tag, loader.construct_mapping(node))


EsphomeLoader.add_multi_constructor("!", _construct_unknown)


def load_yaml(path: Path, base_dir: Path | None = None):
    with path.open(encoding="utf-8") as handle:
        loader = EsphomeLoader(handle, base_dir=base_dir or path.parent)
        try:
            return loader.get_single_data()
        finally:
            loader.dispose()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


SKIP_DIRS = {".git", ".venv", "venv", ".esphome", "build", "__pycache__", "node_modules"}


def tracked_files() -> list[Path]:
    """Tracked files from git, or a sensible file walk in copied checkouts."""
    try:
        output = subprocess.check_output(
            ["git", "-C", str(REPO), "ls-files"], text=True, stderr=subprocess.DEVNULL
        )
        return [REPO / line for line in output.splitlines() if line]
    except (subprocess.CalledProcessError, FileNotFoundError):  # pragma: no cover
        files = []
        for path in REPO.rglob("*"):
            if not path.is_file():
                continue
            if SKIP_DIRS & set(path.parts):
                continue
            if path.name == "secrets.yaml":  # never tracked, may hold real values
                continue
            files.append(path)
        return files


class ConfigContractTests(unittest.TestCase):
    maxDiff = None

    # ------------------------------------------------------------------ #
    # Layout and target version
    # ------------------------------------------------------------------ #
    def test_modules_are_split_into_focused_files(self):
        for module in REQUIRED_MODULES:
            self.assertTrue((PACKAGES / module).is_file(), f"missing package {module}")
        legacy = list(REPO.rglob("esphome_Max7219-Matrix-Clock/max7219-clock.yaml"))
        self.assertEqual([], legacy, "the single-file firmware must not come back")
        biggest = max(
            (p for p in PACKAGES.glob("*.yaml")), key=lambda p: len(read(p).splitlines())
        )
        self.assertLess(
            len(read(biggest).splitlines()),
            450,
            f"{biggest.name} grows back into a monolith",
        )

    def test_min_version_is_the_target_release(self):
        base = load_yaml(PACKAGES / "base.yaml")
        self.assertEqual(TARGET_VERSION, base["esphome"]["min_version"])
        self.assertEqual(
            TARGET_VERSION,
            re.search(r"^esphome==([^\s]+)$", read(REPO / "requirements-validation.txt"), re.M).group(1),
        )

    def test_device_identity_and_board_are_substitutions(self):
        base_text = read(PACKAGES / "base.yaml")
        self.assertIn("board: ${board}", base_text)
        self.assertIn("board: d1_mini", base_text)
        self.assertNotIn("board: nodemcuv2", base_text)
        self.assertEqual(
            DEFAULT_MATRIX_WIDTH,
            8 * int(re.search(r'matrix_chips: "(\d+)"', base_text).group(1)),
            "the default layout must stay 48 pixels wide",
        )

    def test_default_animation_duration_has_multiple_visible_refresh_frames(self):
        """The stock slide must have enough frames to be recognisably animated."""
        base_text = read(PACKAGES / "base.yaml")
        refresh_ms = int(
            re.search(r"display_update_interval:\s*(\d+)ms", base_text).group(1)
        )
        animation_ms = int(
            re.search(r'animation_ms:\s*"(\d+)"', base_text).group(1)
        )
        # With the display's 150 ms cadence, four elapsed refresh intervals
        # yield five visible positions (initial frame plus four updates).
        self.assertLessEqual(refresh_ms * 4, animation_ms)

    # ------------------------------------------------------------------ #
    # 2026.9 API / OTA requirements
    # ------------------------------------------------------------------ #
    def test_api_uses_actions_not_legacy_services(self):
        for path in PACKAGES.glob("*.yaml"):
            text = read(path)
            self.assertNotRegex(
                text,
                r"^\s*services:\s*$",
                f"{path.name} still uses the legacy api.services syntax",
            )
        api = load_yaml(PACKAGES / "actions.yaml")["api"]
        self.assertIn("actions", api)
        self.assertNotIn("services", api)

    def test_actions_match_the_documented_api(self):
        api = load_yaml(PACKAGES / "actions.yaml")["api"]
        actions = {entry["action"]: entry for entry in api["actions"]}
        self.assertEqual(set(REQUIRED_ACTIONS), set(actions))
        for name, variables in REQUIRED_ACTIONS.items():
            declared = actions[name].get("variables", {}) or {}
            self.assertEqual(variables, declared, f"variables of {name} changed")
        self.assertIn(
            "api.respond",
            read(PACKAGES / "actions.yaml"),
            "the status action must use api.respond per the 2026.9 documentation",
        )

    def test_esp8266_action_string_budget(self):
        api = load_yaml(PACKAGES / "actions.yaml")["api"]
        for entry in api["actions"]:
            strings = [entry["action"], entry.get("description", "")]
            for variable in (entry.get("variables") or {}).values():
                if isinstance(variable, dict):
                    strings.extend(
                        [variable.get("description", ""), variable.get("example", "")]
                    )
            strings.extend((entry.get("variables") or {}).keys())
            size = sum(len(s.encode("utf-8")) + 1 for s in strings if s)
            self.assertLessEqual(
                size, 384, f"action '{entry['action']}' needs {size} bytes of metadata"
            )

    def test_native_ota_is_encrypted_with_the_api_key(self):
        ota = load_yaml(PACKAGES / "ota_ui.yaml")["ota"][0]
        self.assertEqual("esphome", ota["platform"])
        self.assertEqual("${api_encryption_key}", ota["encryption"]["key"])
        self.assertNotIn("password", ota, "password + encryption is rejected by ESPHome")
        for trigger in ("on_begin", "on_progress", "on_end", "on_error", "on_abort"):
            self.assertIn(trigger, ota, f"OTA trigger {trigger} is required")
        network = read(PACKAGES / "network.yaml")
        self.assertIn("key: ${api_encryption_key}", network)

    def test_web_server_upload_endpoint_is_disabled(self):
        web = load_yaml(PACKAGES / "web_server.yaml")["web_server"]
        self.assertFalse(web.get("ota", True))
        self.assertIn("auth", web)
        self.assertEqual("${web_server_auth_type}", web["auth"]["type"], "set auth type explicitly")
        self.assertEqual("basic", load_yaml(PACKAGES / "web_server.yaml")["substitutions"]["web_server_auth_type"])
        self.assertFalse(web["include_internal"], "hidden entities must not leak through the device web UI")

    # ------------------------------------------------------------------ #
    # Home Assistant surface
    # ------------------------------------------------------------------ #
    def test_required_entities_exist(self):
        found: dict[str, set[str]] = {}
        for name in ("controls.yaml", "buttons.yaml", "date_controls.yaml", "diagnostics.yaml"):
            config = load_yaml(PACKAGES / name)
            for platform, entries in config.items():
                if not isinstance(entries, list):
                    continue
                names = found.setdefault(platform, set())
                for entry in entries:
                    if not isinstance(entry, dict):
                        continue
                    if "name" in entry:
                        names.add(entry["name"])
                    # Some platforms nest their entities (e.g. `debug: free:`).
                    for value in entry.values():
                        if isinstance(value, dict) and "name" in value:
                            names.add(value["name"])
        for platform, required in REQUIRED_ENTITIES.items():
            for entity in required:
                self.assertIn(
                    entity,
                    found.get(platform, set()),
                    f"missing {platform} entity '{entity}'",
                )

    def test_controls_are_entity_category_config(self):
        controls = {**load_yaml(PACKAGES / "controls.yaml"), **load_yaml(PACKAGES / "buttons.yaml")}
        for platform in ("select", "number", "switch", "button"):
            for entry in controls[platform]:
                self.assertEqual(
                    "config",
                    entry.get("entity_category"),
                    f"{platform} '{entry['name']}' needs entity_category: config",
                )

    def test_diagnostics_are_bounded_and_slow(self):
        diagnostics = load_yaml(PACKAGES / "diagnostics.yaml")
        for entry in diagnostics["text_sensor"]:
            if entry.get("platform") == "template":
                self.assertEqual("never", entry.get("update_interval"))
        for entry in diagnostics["sensor"]:
            if entry.get("platform") == "template":
                self.assertEqual("never", entry.get("update_interval"))
        ota_percent = next(
            e for e in diagnostics["sensor"] if e.get("name") == "OTA percent"
        )
        self.assertTrue(ota_percent.get("disabled_by_default"))
        debug = load_yaml(PACKAGES / "diagnostics.yaml")["debug"]
        self.assertIn("update_interval", debug)

    def test_bounded_inputs(self):
        controls = load_yaml(PACKAGES / "controls.yaml")
        bounds = {}
        for entry in controls["number"]:
            bounds[entry["name"]] = (entry["min_value"], entry["max_value"])
        self.assertEqual((0, 15), bounds["Matrix brightness"])
        self.assertEqual((0, 15), bounds["Night brightness"])
        self.assertEqual((10, 3599), bounds["Countdown duration"])
        self.assertEqual((0, 23), bounds["Night start hour"])
        self.assertEqual((0, 23), bounds["Night end hour"])
        for name, (low, high) in bounds.items():
            self.assertLess(low, high, f"{name} has an empty range")

    def test_restored_switches_do_not_refresh_matrix_during_setup(self):
        """Template switches restore before the MAX7219 display is set up."""
        controls = load_yaml(PACKAGES / "controls.yaml")
        for switch in controls["switch"]:
            for action_name in ("turn_on_action", "turn_off_action"):
                action = switch[action_name][0]
                self.assertNotIn("component.update", action)
                self.assertEqual(action, {"script.execute": "request_matrix_refresh"})
        renderer = read(PACKAGES / "renderer.yaml")
        self.assertIn("App.is_setup_complete()", renderer)
        self.assertIn("id(matrix).update()", renderer)

    def test_remote_renderer_package_includes_its_generated_georgian_header(self):
        """ESPHome resolves the renderer's relative include beside the package YAML."""
        renderer = load_yaml(PACKAGES / "renderer.yaml")
        includes = renderer["esphome"]["includes"]
        self.assertIn("georgian_bitmap_font.generated.h", includes)
        expected = (PACKAGES / "georgian_bitmap_font.generated.h").resolve()
        self.assertTrue(expected.is_file())

        # Use ESPHome's real include validator with a top-level config outside
        # packages/. Remote package YAML carries the same declaring-document
        # path after it is fetched, so this catches missing sibling assets.
        from esphome import yaml_util
        from esphome.core import CORE
        from esphome.core.config import valid_include

        previous_config_path = CORE.config_path
        CORE.config_path = REPO / "dev.yaml"
        try:
            package_yaml = yaml_util.load_yaml(PACKAGES / "renderer.yaml")
            resolved = Path(valid_include(package_yaml["esphome"]["includes"][-1])).resolve()
        finally:
            CORE.config_path = previous_config_path
        self.assertEqual(expected, resolved)

    # ------------------------------------------------------------------ #
    # Entry points and pinning
    # ------------------------------------------------------------------ #
    def test_dev_entry_point_loads_every_module_locally(self):
        dev = load_yaml(REPO / "dev.yaml", base_dir=REPO)
        packages = dev["packages"]
        loaded = {Path(entry.value).name for entry in packages.values()}
        expected = {
            "base.yaml",
            "network.yaml",
            "renderer.yaml",
            "display.yaml",
            "fonts_default_local.yaml",
            "boot_ui.yaml",
            "restore_defaults.generated.yaml",
            "controls.yaml",
            "buttons.yaml",
            "entity_visibility.yaml",
            "date_controls.yaml",
            "actions.yaml",
            "diagnostics.yaml",
            "ota_ui.yaml",
            "web_server.yaml",
        }
        self.assertEqual(expected, loaded)
        for name, entry in packages.items():
            self.assertTrue(
                (REPO / entry.value).is_file(), f"dev.yaml package {name} does not exist"
            )

    def test_validation_workspace_keeps_configurator_metadata(self):
        validation = read(REPO / "scripts" / "validate.ps1")
        self.assertIn('"web-configurator"', validation)

    def test_release_example_pins_tag_and_fonts(self):
        release = load_yaml(REPO / "examples/release.yaml", base_dir=REPO)
        remote = release["packages"]["clock"]
        ref = remote["ref"]
        self.assertNotIn(ref, ("main", "master", "HEAD"))
        self.assertRegex(ref, r"^v?\d+\.\d+\.\d+$", "release refs must be version tags")
        self.assertEqual(
            ref,
            release["substitutions"]["project_ref"],
            "font URLs must be pinned to the same tag as the package files",
        )
        dev = load_yaml(REPO / "examples/development.yaml", base_dir=REPO)
        self.assertEqual(
            "main",
            dev["packages"]["clock"]["ref"],
            "the development example is the only place that may follow main",
        )
        self.assertIn("DEVELOPMENT", read(REPO / "examples/development.yaml"))

        # Only base.yaml owns the canonical version/ref and font URL. Generated
        # examples and npm metadata follow it; installers take an explicit,
        # independently verified immutable tag instead of a copied constant.
        substitutions = load_yaml(PACKAGES / "base.yaml")["substitutions"]
        self.assertEqual(ref, substitutions["project_ref"])
        self.assertEqual("${project_ref}", substitutions["project_version"])
        self.assertIn("${project_ref}", substitutions["fonts_base_url"])
        self.assertNotIn("substitutions", load_yaml(PACKAGES / "fonts_web.yaml"))
        self.assertEqual(ref, FIRMWARE["releaseVersion"])
        self.assertEqual(ref, json.loads(read(REPO / "web-configurator/package.json"))["version"])
        yaml_ts = read(REPO / "web-configurator/src/yaml.ts")
        self.assertIn("buildYaml(input: Config, releaseTag: string)", yaml_ts)
        self.assertIn("validReleaseTag(releaseTag)", yaml_ts)
        self.assertNotIn("const PROJECT_REF", yaml_ts)
        self.assertNotIn("INSTALLER_READY", yaml_ts)
        # Export re-verifies the published release; consecutive clicks may share
        # one check that is seconds old, never one from a previous visit.
        app_tsx = read(REPO / "web-configurator/src/App.tsx")
        self.assertIn("await release.verify({ maxAgeMs: INSTALL_FRESH_MS })", app_tsx)
        release_ts = read(REPO / "web-configurator/src/release.ts")
        self.assertIn("export const INSTALL_FRESH_MS = 30 * 1000;", release_ts)
        self.assertIn("if (result.ready || result.retryAt !== undefined) storage?.setItem", release_ts)

    def test_esp_wroom_32_example_uses_safe_devkit_defaults(self):
        esp32 = load_yaml(REPO / "examples/esp-wroom-32.yaml", base_dir=REPO)
        remote = esp32["packages"]["clock"]
        self.assertEqual("packages/base-esp32.yaml", remote["files"][0])
        self.assertEqual(load_yaml(PACKAGES / "base.yaml")["substitutions"]["project_ref"], remote["ref"])
        base = load_yaml(PACKAGES / "base-esp32.yaml")
        self.assertEqual(remote["ref"], base["substitutions"]["project_ref"])
        self.assertEqual("esp32dev", base["substitutions"]["board"])
        self.assertEqual("GPIO18", base["substitutions"]["matrix_clk_pin"])
        self.assertEqual("GPIO23", base["substitutions"]["matrix_mosi_pin"])
        self.assertEqual("GPIO5", base["substitutions"]["matrix_cs_pin"])
        self.assertEqual("3232", base["substitutions"]["ota_port"])

    def test_remote_file_list_matches_local_modules(self):
        release = load_yaml(REPO / "examples/release.yaml", base_dir=REPO)
        files = release["packages"]["clock"]["files"]
        local_names = {
            Path(entry.value).name
            for entry in load_yaml(REPO / "dev.yaml", base_dir=REPO)["packages"].values()
        }
        # The release replaces the generated local default wrapper with the
        # corresponding per-face remote packages; non-font modules are identical.
        default_fonts = [f for f in FIRMWARE["fonts"] if f["id"] in FIRMWARE["defaultFonts"]]
        expected = {
            f"packages/{name}" for name in local_names
        } - {"packages/fonts_default_local.yaml"} | {f["package"] for f in default_fonts}
        self.assertEqual(sorted(expected), sorted(files))
        self.assertEqual(
            FIRMWARE["packageFiles"],
            [f for f in files if not f.startswith("packages/fonts/")],
            "the configurator must install the same modules as examples/release.yaml",
        )
        # The installer's module list follows the selected hardware target; the
        # contract lists each target's own base package in its real order.
        self.assertIn("...packageFilesFor(cfg.target)", read(REPO / "web-configurator/src/yaml.ts"))
        targets = {target["id"]: target for target in FIRMWARE["hardwareTargets"]}
        self.assertEqual("esp8266", FIRMWARE["defaultTarget"])
        self.assertEqual(FIRMWARE["packageFiles"], targets["esp8266"]["packageFiles"])
        self.assertEqual("packages/base-esp32.yaml", targets["esp32"]["packageFiles"][0])
        self.assertEqual(targets["esp32"]["packageFiles"][1:], targets["esp8266"]["packageFiles"][1:])
        release_fonts = [f for f in files if f.startswith("packages/fonts/")]
        offline_script = read(REPO / "scripts/validate-release-offline.sh")
        expected_offline_fonts = int(re.search(r'\[\[\s*"\$FONTS"\s*-eq\s*(\d+)\s*\]\]', offline_script).group(1))
        self.assertEqual(len(release_fonts), expected_offline_fonts, "offline validator font count must match release.yaml")

    def test_font_packages_are_equivalent(self):
        web = [load_yaml(PACKAGES / "fonts" / (fid[5:-7].replace("_", "-") + ".yaml"))["font"][0] for fid in FONT_OPTION_BY_ID]
        local = sorted(load_yaml(PACKAGES / "fonts_local.yaml")["font"], key=lambda entry: entry["id"])
        web.sort(key=lambda entry: entry["id"])

        def shape(entries):
            return [
                (e["id"], e["size"], e["bpp"], tuple(e["glyphs"])) for e in entries
            ]

        self.assertEqual(shape(web), shape(local))
        web_base = load_yaml(PACKAGES / "base.yaml")["substitutions"]["fonts_base_url"]
        self.assertTrue(web_base.startswith("https://raw.githubusercontent.com"))
        self.assertIn("${project_ref}", web_base)
        for entry in web:
            self.assertEqual("web", entry["file"]["type"])
            self.assertIn("${fonts_base_url}", entry["file"]["url"])
        for external, entry in zip(web, local):
            self.assertEqual(external["file"]["url"].replace("${fonts_base_url}/", ""),
                             entry["file"]["path"].removeprefix("../fonts/"))
            if entry["id"] not in ("font_pixel_clock_6x8_source", "font_matrix_2px_source", "font_dot_matrix_source", "font_georgian_mkhedruli_8x8_source"):
                font_dir = (PACKAGES / entry["file"]["path"]).resolve().parent
                shared_lgpl = (
                    entry["id"] == "font_md_parola_numeric_7seg_source"
                    and (REPO / "fonts" / "md-max72xx-system" / "LICENSE.txt").is_file()
                )
                self.assertTrue(
                    shared_lgpl or any((font_dir / name).is_file() for name in ("OFL.txt", "LICENSE.txt", "mg-minecraft-georgian-LICENSE.txt")),
                    f"{entry['id']} must retain its source license",
                )
            self.assertEqual("local", entry["file"]["type"])
            path = (PACKAGES / entry["file"]["path"]).resolve()
            self.assertTrue(path.is_file(), f"missing font file {path}")

    def test_compiled_fonts_fit_hh_mm_ss(self):
        """Measure the real font files with ESPHome's own pt_to_px() math."""
        try:
            import freetype
        except ImportError:  # pragma: no cover - freetype-py ships with ESPHome
            self.skipTest("freetype-py not installed")

        clock_text = "88:88:88"
        for module in ("fonts_local.yaml",):
            for entry in load_yaml(PACKAGES / module)["font"]:
                face = freetype.Face(str((PACKAGES / entry["file"]["path"]).resolve()))
                face.set_pixel_sizes(entry["size"], 0)
                width = 0
                for char in clock_text:
                    face.load_char(ord(char), freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
                    width += (face.glyph.metrics.horiAdvance + 63) // 64
                self.assertLessEqual(
                    width,
                    DEFAULT_MATRIX_WIDTH,
                    f"{entry['id']} renders '{clock_text}' {width}px wide",
                )

    def test_font_glyphs_cover_every_compiled_character(self):
        """The compiled glyph set must contain every character we can print."""
        try:
            import freetype
        except ImportError:  # pragma: no cover - freetype-py ships with ESPHome
            self.skipTest("freetype-py not installed")

        for entry in load_yaml(PACKAGES / "fonts_local.yaml")["font"]:
            declared = "".join(entry["glyphs"])
            face = freetype.Face(str((PACKAGES / entry["file"]["path"]).resolve()))
            for char in FONT_REQUIRED_GLYPHS:
                self.assertIn(
                    char,
                    declared,
                    f"{entry['id']} does not compile '{char}'",
                )
                self.assertNotEqual(
                    face.get_char_index(ord(char)),
                    0,
                    f"{entry['id']} has no '{char}' glyph in its source file",
                )
            if entry["id"] in ("font_georgian_mkhedruli_8x8_source", "font_matrix_sans_screen_source", "font_sevenish_mono_8_source"):
                for char in GEORGIAN_MKHEDRULI:
                    self.assertIn(char, declared, f"{entry['id']} does not compile '{char}'")
                    self.assertNotEqual(face.get_char_index(ord(char)), 0, f"{entry['id']} has no '{char}' glyph")

    def test_repository_georgian_fonts_keep_both_modern_alphabets(self):
        """Optional Georgian sources remain available for a later shortlist."""
        try:
            import freetype
        except ImportError:  # pragma: no cover - freetype-py ships with ESPHome
            self.skipTest("freetype-py not installed")

        paths = {
            "noto-sans-georgian": REPO / "fonts/noto-sans-georgian/NotoSansGeorgian-Variable.ttf",
            "noto-serif-georgian": REPO / "fonts/noto-serif-georgian/NotoSerifGeorgian-Variable.ttf",
        }
        for font_id, path in paths.items():
            face = freetype.Face(str(path))
            for char in GEORGIAN_MKHEDRULI + GEORGIAN_MTAVRULI:
                self.assertNotEqual(
                    face.get_char_index(ord(char)),
                    0,
                    f"{font_id} has no '{char}' glyph in its source file",
                )

    def test_font_ink_is_not_taller_than_the_matrix(self):
        """Digits taller than the panel would be clipped on the real display.

        FreeType hinting can move an edge by a pixel, so this is a coarse
        guard: a font that needs a 9th row is rejected, a borderline 8 px face
        is still allowed.
        """
        try:
            import freetype
        except ImportError:  # pragma: no cover - freetype-py ships with ESPHome
            self.skipTest("freetype-py not installed")

        for entry in load_yaml(PACKAGES / "fonts_local.yaml")["font"]:
            face = freetype.Face(str((PACKAGES / entry["file"]["path"]).resolve()))
            face.set_pixel_sizes(entry["size"], 0)
            digit_heights = []
            measured_chars = "0123456789:-" + (GEORGIAN_MKHEDRULI if entry["id"] in ("font_georgian_mkhedruli_8x8_source", "font_matrix_sans_screen_source", "font_sevenish_mono_8_source") else "")
            for char in measured_chars:
                face.load_char(ord(char), freetype.FT_LOAD_RENDER)
                if char.isdigit():
                    digit_heights.append(face.glyph.bitmap.rows)
                self.assertLessEqual(
                    face.glyph.bitmap.rows,
                    MATRIX_ROW_HEIGHT,
                    f"{entry['id']} draws '{char}' {face.glyph.bitmap.rows}px tall",
                )
            expected_height = (
                6 if entry["id"] == "font_matrix_sans_screen_source"
                else 5 if entry["id"] == "font_sevenish_mono_8_source"
                else MATRIX_ROW_HEIGHT - 1
                if entry["id"] in ("font_md_max72xx_system_source", "font_md_parola_numeric_7seg_source", "font_mg_minecraft_georgian_source", "font_georgian_mkhedruli_8x8_source")
                else MATRIX_ROW_HEIGHT
            )
            self.assertEqual(
                expected_height,
                max(digit_heights),
                f"{entry['id']} has an unexpected largest digit height",
            )

    def test_georgian_generated_ttf_matches_column_bitmap_source_exactly(self):
        """The project-owned TTF must preserve each source byte as one column."""
        try:
            import freetype
        except ImportError:  # pragma: no cover - freetype-py ships with ESPHome
            self.skipTest("freetype-py not installed")

        sys.path.insert(0, str(REPO / "scripts"))
        try:
            import generate_georgian_mkhedruli_font as design_source
        finally:
            sys.path.pop(0)

        design_source.validate_design()
        face = freetype.Face(str(design_source.OUTPUT))
        face.set_pixel_sizes(8, 0)
        for char, (width, columns) in design_source.BITMAPS.items():
            face.load_char(ord(char), freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
            glyph = face.glyph
            bitmap = glyph.bitmap
            advance = (glyph.metrics.horiAdvance + 63) // 64
            self.assertEqual(design_source.advance_for(char), advance, f"'{char}' has the wrong advance")
            if char == " ":
                self.assertFalse(any(bitmap.buffer), "space must remain an empty bitmap glyph")
                continue

            self.assertLessEqual(bitmap.rows, 8, f"'{char}' exceeds the eight-row matrix")
            offset_y = (face.size.ascender + 63) // 64 - glyph.bitmap_top
            actual = [[0] * width for _ in range(8)]
            for y in range(bitmap.rows):
                for x in range(bitmap.width):
                    byte = bitmap.buffer[y * bitmap.pitch + (x // 8)]
                    if byte & (1 << (7 - x % 8)):
                        row, column = offset_y + y, glyph.bitmap_left + x
                        self.assertTrue(
                            0 <= row < 8 and 0 <= column < width,
                            f"'{char}' ink lands outside the 8x{width} source canvas",
                        )
                        actual[row][column] = 1
            expected = [[int(columns[x] & (1 << row) != 0) for x in range(width)] for row in range(8)]
            self.assertEqual(expected, actual, f"'{char}' no longer matches its vertical-column bitmap")

    def test_matrix_2px_font_is_pixel_exact_with_two_pixel_lines(self):
        """Rasterise the generated Matrix 2px face exactly like ESPHome does.

        The user-facing promise of fonts/matrix-2px is twofold: digits fill
        all eight rows of the matrix, and every line of every number is
        exactly two pixels thick. Both properties live in the design table of
        scripts/generate_matrix_font.py; this test proves that FreeType (the
        firmware path) reproduces that design pixel for pixel at the compiled
        size, so no hinting round can thicken or thin a stroke.
        """
        try:
            import freetype
        except ImportError:  # pragma: no cover - freetype-py ships with ESPHome
            self.skipTest("freetype-py not installed")

        sys.path.insert(0, str(REPO / "scripts"))
        try:
            import generate_matrix_font as design_source
        finally:
            sys.path.pop(0)

        # The invariants that make "2 pixels" true, re-checked independently.
        design_source.validate_design()

        entry = next(
            e for e in load_yaml(PACKAGES / "fonts_local.yaml")["font"]
            if e["id"] == "font_matrix_2px_source"
        )
        face = freetype.Face(str((PACKAGES / entry["file"]["path"]).resolve()))
        face.set_pixel_sizes(entry["size"], 0)

        expected = {
            char: [list(row) for row in rows] for char, rows in design_source.DIGITS.items()
        }
        expected_advance = {char: 7 for char in design_source.DIGITS}
        for char, (rows, advance) in design_source.PUNCTUATION.items():
            expected[char] = [list(row) for row in rows]
            expected_advance[char] = advance

        for char, design in expected.items():
            if char == " ":
                continue
            # Same load flags as esphome/components/font for bpp: 1.
            face.load_char(ord(char), freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
            glyph = face.glyph
            bitmap = glyph.bitmap
            advance = (glyph.metrics.horiAdvance + 63) // 64
            self.assertEqual(
                expected_advance[char],
                advance,
                f"Matrix 2px '{char}' advances {advance}px, expected {expected_advance[char]}",
            )
            if char.isdigit():
                self.assertEqual(
                    MATRIX_ROW_HEIGHT,
                    bitmap.rows,
                    f"Matrix 2px digit '{char}' is {bitmap.rows}px tall, not a full matrix row",
                )
            # Re-ink the design canvas with what FreeType actually produced.
            offset_y = (face.size.ascender + 63) // 64 - glyph.bitmap_top
            canvas = [[0] * len(design[0]) for _ in range(MATRIX_ROW_HEIGHT)]
            for y in range(bitmap.rows):
                for x in range(bitmap.width):
                    byte = bitmap.buffer[y * bitmap.pitch + (x // 8)]
                    if byte & (1 << (7 - x % 8)):
                        row, col = offset_y + y, glyph.bitmap_left + x
                        self.assertTrue(
                            0 <= row < MATRIX_ROW_HEIGHT and 0 <= col < len(design[0]),
                            f"Matrix 2px '{char}' ink lands outside the matrix at ({row},{col})",
                        )
                        canvas[row][col] = 1
            wanted = [[1 if cell == "#" else 0 for cell in row] for row in design]
            self.assertEqual(
                wanted,
                canvas,
                f"Matrix 2px '{char}' does not rasterise to its pixel design",
            )

    def test_dot_matrix_font_uses_6x8_cells_and_fits_a_32x8_clock(self):
        """The single-LED-dot clock face fits HH:MM on a four-module panel."""
        try:
            import freetype
        except ImportError:  # pragma: no cover - freetype-py ships with ESPHome
            self.skipTest("freetype-py not installed")

        sys.path.insert(0, str(REPO / "scripts"))
        try:
            import generate_dot_matrix_font as design_source
        finally:
            sys.path.pop(0)

        design_source.validate_design()
        entry = next(
            e for e in load_yaml(PACKAGES / "fonts_local.yaml")["font"]
            if e["id"] == "font_dot_matrix_source"
        )
        face = freetype.Face(str((PACKAGES / entry["file"]["path"]).resolve()))
        face.set_pixel_sizes(entry["size"], 0)

        self.assertLessEqual(
            sum(design_source.advance_for(char) for char in "88:88"),
            32,
            "Dot Matrix HH:MM must fit a 32x8 display",
        )
        for char, rows in design_source.GLYPHS.items():
            face.load_char(ord(char), freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
            glyph = face.glyph
            self.assertEqual(
                design_source.advance_for(char),
                (glyph.metrics.horiAdvance + 63) // 64,
                f"Dot Matrix '{char}' has the wrong advance",
            )
            if char.isdigit():
                self.assertEqual(MATRIX_ROW_HEIGHT, glyph.bitmap.rows)

    def test_exact_esphome_font_option_merge(self):
        """Exercise the real resolver when the exact target is installed."""
        try:
            from importlib.metadata import version
            installed = version("esphome")
        except Exception:
            self.skipTest("ESPHome 2026.9.1 not installed; offline contracts still run")
        if installed != TARGET_VERSION:
            self.skipTest("Requires exactly ESPHome " + TARGET_VERSION)
        from esphome.config import resolve_extend_remove
        from esphome.config_helpers import Extend, merge_config
        import copy

        def convert(value):
            if isinstance(value, TaggedValue):
                return Extend(value.value) if value.tag == "!extend" else value.value
            if isinstance(value, dict):
                return {k: convert(v) for k, v in value.items()}
            if isinstance(value, list):
                return [convert(v) for v in value]
            return value

        base = merge_config(convert(load_yaml(PACKAGES / "controls.yaml")), convert(load_yaml(PACKAGES / "date_controls.yaml")))
        faces = [convert(load_yaml(p)) for p in sorted((PACKAGES / "fonts").glob("*.yaml"))]
        for mask in range(1 << len(faces)):
            merged = copy.deepcopy(base)
            expected = ["Compact 5x7"]
            expected_dates = ["Compact 5x7"]
            for i, face in enumerate(faces):
                if mask & (1 << i):
                    merged = merge_config(merged, copy.deepcopy(face))
                    expected += face["select"][0]["options"]
                    expected_dates += face["select"][1]["options"]
            resolve_extend_remove(merged)
            select = next(e for e in merged["select"] if e["id"] == "clock_font")
            self.assertEqual(select["options"], expected)
            self.assertIn(select["initial_option"], expected)
            date_select = next(e for e in merged["select"] if e["id"] == "date_font")
            self.assertEqual(date_select["options"], expected_dates)
            self.assertIn(date_select["initial_option"], expected_dates)
        # Enforce the requested default pair independently of the generated
        # contract, then exercise that exact order with the real tagged resolver.
        self.assertEqual(FIRMWARE["defaultFonts"], ["pixel-clock-6x8", "matrix-2px"])
        default_merged = copy.deepcopy(base)
        for rel_name in ("pixel-clock-6x8.yaml", "matrix-2px.yaml"):
            default_merged = merge_config(default_merged, convert(load_yaml(PACKAGES / "fonts" / rel_name)))
        resolve_extend_remove(default_merged)
        default_select = next(e for e in default_merged["select"] if e["id"] == "clock_font")
        self.assertEqual(default_select["options"], ["Compact 5x7", "Pixel Clock 6x8", "Matrix 2px"])
        self.assertEqual(default_select["initial_option"], "Pixel Clock 6x8")
        default_date_select = next(e for e in default_merged["select"] if e["id"] == "date_font")
        self.assertEqual(default_date_select["options"], ["Compact 5x7", "Pixel Clock 6x8", "Matrix 2px"])
        self.assertEqual(default_date_select["initial_option"], "Compact 5x7")
        self.assertEqual(
            default_merged["esphome"]["build_flags"],
            ["-DMAX7219_FONT_PIXEL_CLOCK_6X8", "-DMAX7219_FONT_MATRIX_2PX"],
        )
        self.assertEqual(
            [f["id"] for f in default_merged["font"]],
            ["font_pixel_clock_6x8_source", "font_matrix_2px_source"],
        )
        self.assertEqual(merge_config({"lambda": "first"}, {"lambda": "second"}), {"lambda": "second"})

    @unittest.skipUnless(shutil.which("g++"), "g++ unavailable")
    def test_optional_font_cpp_syntax(self):
        """Actual selection block parses without omitted font IDs (host stubs only)."""
        display = read(PACKAGES / "display.yaml")
        start = display.index("      max7219_clock::BuiltinFont builtin_font;")
        end = display.index("      max7219_clock::render(", start)
        block = display[start:end].replace("id(clock_font)", "clock_font").replace("id(date_font)", "date_font")
        faces = [load_yaml(p) for p in sorted((PACKAGES / "fonts").glob("*.yaml"))]
        # Zero, every single face, the public default pair, and the full catalogue.
        cases = [[], *[[f] for f in faces],
                 [f for f in faces if f["font"][0]["id"] in
                  ("font_matrix_2px_source", "font_dot_matrix_source")], faces]
        with tempfile.TemporaryDirectory(prefix="clock-font-syntax-") as temp:
            path = Path(temp) / "selection.cpp"
            for chosen in cases:
                declarations = "".join("int " + f["font"][0]["id"] + ";\n" for f in chosen)
                flags = [f["esphome"]["build_flags"][0] for f in chosen]
                source = """#include <string>
using StringRef = std::string;
struct Select { StringRef current_option() { return "Compact 5x7"; } } clock_font;
namespace max7219_clock {
struct GlyphFont {};
struct BuiltinFont : GlyphFont {};
#ifdef USE_FONT
struct SourceFont : GlyphFont { SourceFont(int, int*) {} };
#endif
}
""" + declarations + "void draw(int &it) {\n" + block + "\n(void)selected; }\n"
                path.write_text(source)
                result = subprocess.run(["g++", "-std=c++17", "-fsyntax-only", *flags,
                    *(["-DUSE_FONT"] if chosen else []), str(path)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_every_compiled_font_is_selectable_and_wired(self):
        """Every subset (2^N, including zero/one/all): options, flags and C++ agree."""
        faces = [load_yaml(p) for p in sorted((PACKAGES / "fonts").glob("*.yaml"))]
        self.assertEqual(len(faces), 9)
        display = read(PACKAGES / "display.yaml")
        blocks = re.findall(r"#ifdef (MAX7219_FONT_\w+)\n(.*?)#endif", display, re.S)
        self.assertEqual(len(blocks), len(faces))
        by_macro = dict(blocks)
        base = next(e for e in load_yaml(PACKAGES / "controls.yaml")["select"] if e["id"] == "clock_font")
        self.assertEqual(base["options"], ["Compact 5x7"])
        self.assertEqual(base["initial_option"], "Compact 5x7")
        reset = read(PACKAGES / "restore_defaults.generated.yaml")
        self.assertIn('"Compact 5x7"', reset)
        self.assertIn('"Pixel Clock 6x8"', reset)
        self.assertIn('has_option("Pixel Clock 6x8")', reset)
        self.assertIn("#ifdef USE_FONT", read(PACKAGES / "max7219_clock_esphome.h"))
        local = load_yaml(PACKAGES / "fonts_local.yaml")
        self.assertEqual(set(local["select"][0]["options"]), set(FONT_OPTION_BY_ID.values()))
        self.assertEqual(set(local["esphome"]["build_flags"]), {f["esphome"]["build_flags"][0] for f in faces})
        for mask in range(1 << len(faces)):
            chosen = [f for i, f in enumerate(faces) if mask & (1 << i)]
            options = base["options"] + [f["select"][0]["options"][0] for f in chosen]
            ids = [f["font"][0]["id"] for f in chosen]
            self.assertEqual(set(options), {"Compact 5x7", *(FONT_OPTION_BY_ID[i] for i in ids)})
            self.assertEqual(len(options), len(set(options)))
            for face in chosen:
                ext = face["select"][0]
                self.assertEqual(ext["id"].tag, "!extend")
                self.assertEqual(ext["id"].value, "clock_font")
                self.assertEqual(len(ext["options"]), 1)
                fid = face["font"][0]["id"]
                macro = face["esphome"]["build_flags"][0].removeprefix("-D")
                self.assertIn(fid, by_macro[macro])
                self.assertIn('font_option == "' + FONT_OPTION_BY_ID[fid] + '"', by_macro[macro])
                self.assertNotIn('id(' + fid, display)
                self.assertNotIn("substitutions", face, "only base.yaml owns the release/font ref")
        # A declaration anywhere outside a feature guard would break zero-font builds.
        unguarded = re.sub(r"#ifdef MAX7219_FONT_\w+\n.*?#endif", "", display, flags=re.S)
        self.assertNotRegex(unguarded, r"font_\w+_source")

    # ------------------------------------------------------------------ #
    # Credentials
    # ------------------------------------------------------------------ #
    def test_no_literal_credentials_in_tracked_files(self):
        suspicious = re.compile(
            r"^\s*(ssid|password|key|api_encryption_key|psk)\s*:\s*[\"']?([^\"'\n#]+)"
        )
        for path in tracked_files():
            if path.name == "secrets.yaml":
                continue
            if path.suffix not in (".yaml", ".yml", ".example", ".md", ".ps1", ".txt"):
                continue
            for lineno, line in enumerate(read(path).splitlines(), start=1):
                match = suspicious.match(line)
                if not match:
                    continue
                value = match.group(2).strip()
                if value in ("", "true", "false", "no", "yes"):
                    continue
                if any(pattern.search(value) for pattern in PLACEHOLDER_PATTERNS):
                    continue
                self.fail(f"{path.relative_to(REPO)}:{lineno} looks like a literal secret: {line}")

    def test_secrets_example_uses_placeholders_only(self):
        example = read(REPO / "secrets.yaml.example")
        self.assertIn("api_encryption_key", example)
        self.assertNotRegex(example, r"[A-Za-z0-9+/]{40,}=")
        for name in (
            "wifi_ssid",
            "wifi_password",
            "api_encryption_key",
            "fallback_ap_password",
            "web_server_username",
            "web_server_password",
        ):
            self.assertIn(name, example)

    def test_credentials_reach_packages_as_substitutions(self):
        dev = read(REPO / "dev.yaml")
        for name in ("wifi_ssid", "wifi_password", "api_encryption_key"):
            self.assertIn(f"{name}: !secret {name}", dev)
        # Remote packages must not *use* !secret (comments may mention it).
        for path in PACKAGES.glob("*.yaml"):
            code = "\n".join(
                line.split("#", 1)[0] for line in read(path).splitlines()
            )
            self.assertNotRegex(
                code,
                r":\s*!secret",
                f"{path.name} uses !secret; remote packages cannot resolve it",
            )

    def test_secrets_and_build_output_are_ignored(self):
        gitignore = read(REPO / ".gitignore")
        for pattern in ("secrets.yaml", ".esphome/", "build/"):
            self.assertIn(pattern, gitignore)
        tracked = {path.name for path in tracked_files()}
        self.assertNotIn("secrets.yaml", tracked)
        if (REPO / ".git").exists() and (REPO / "secrets.yaml").exists():
            # A local secrets.yaml is expected (README installation step 2);
            # what matters is that git really ignores it, so it can never be
            # committed by accident.
            check = subprocess.run(
                ["git", "-C", str(REPO), "check-ignore", "-q", "secrets.yaml"],
                capture_output=True,
            )
            self.assertEqual(
                check.returncode,
                0,
                "secrets.yaml exists but is not covered by .gitignore",
            )

    def test_encryption_key_format_is_documented(self):
        self.assertIn(
            "generate-encryption-key",
            read(REPO / "secrets.yaml.example"),
            "the example must explain how to create the key",
        )

    # ------------------------------------------------------------------ #
    # Renderer regression tests
    # ------------------------------------------------------------------ #
    def test_renderer_unit_tests_pass(self):
        compiler = shutil.which("g++") or shutil.which("clang++")
        if compiler is None:  # pragma: no cover - sandbox may lack a compiler
            self.skipTest("no C++ compiler available")
        with tempfile.TemporaryDirectory() as tmp:
            binary = Path(tmp) / "test_renderer"
            subprocess.run(
                [
                    compiler,
                    "-std=c++17",
                    "-Wall",
                    "-Wextra",
                    "-Wno-unused-parameter",
                    "-O1",
                    "-o",
                    str(binary),
                    str(REPO / "tests" / "test_renderer.cpp"),
                ],
                check=True,
                capture_output=True,
            )
            result = subprocess.run([str(binary)], capture_output=True, text=True)
            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
            self.assertIn("0 failures", result.stdout)

    def test_renderer_covers_documented_behaviour(self):
        source = read(REPO / "tests" / "test_renderer.cpp")
        for behaviour in (
            "test_only_changed_digits_animate",
            "test_ota_screen_draws_percentage_and_bar",
            "test_countdown_expires_into_alert",
            "test_millis_wrap_keeps_clock_stable",
            "test_falls_back_to_builtin_font",
            "test_message_scrolling_and_static",
            "test_night_brightness_schedule",
        ):
            self.assertIn(behaviour, source)


class SecretsExampleFormatTests(unittest.TestCase):
    def test_base64_key_placeholder_is_valid_length(self):
        """Keep the placeholder key obviously fake but the right shape."""
        value = re.search(
            r'api_encryption_key:\s*"([^"]+)"', read(REPO / "secrets.yaml.example")
        ).group(1)
        if value.startswith("REPLACE"):
            return
        decoded = base64.b64decode(value, validate=True)
        self.assertEqual(32, len(decoded))

    def test_validation_key_fixture_is_nonzero(self):
        """ESPHome 2026.9 rejects the formerly used all-zero dummy key."""
        script = read(REPO / "scripts" / "validate.ps1")
        match = re.search(r"\[byte\[\]\]\((\d+)\.\.(\d+)\)", script)
        self.assertIsNotNone(match, "validation script must use explicit dummy bytes")
        start, end = (int(value) for value in match.groups())
        dummy = bytes(range(start, end + 1))
        self.assertEqual(32, len(dummy))
        self.assertNotEqual(bytes(32), dummy)


if __name__ == "__main__":
    os.chdir(REPO)
    unittest.main(verbosity=2, argv=[sys.argv[0]])
