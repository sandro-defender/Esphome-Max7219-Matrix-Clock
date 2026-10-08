#!/usr/bin/env python3
"""Generate configurator data and local/example YAML from real firmware packages.

Run with the exact ESPHome in requirements-validation.txt. UI bindings contain
no copied defaults/options/ranges. Missing bindings, unresolved defaults,
missing font/license assets and a missing versioned changelog section fail.
--check is deliberately non-mutating: CI must detect drift, not hide it.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import inspect
import json
import logging
import re
from importlib.metadata import version
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "web-configurator/src/firmware.generated.json"


class Tag(str):
    def __new__(cls, text, tag):
        value = str.__new__(cls, text)
        value.tag = tag
        return value

    def __reduce__(self):
        return Tag, (str(self), self.tag)


class Loader(yaml.SafeLoader):
    pass


Loader.add_multi_constructor("!", lambda loader, tag, node: Tag(loader.construct_scalar(node), "!" + tag))


class Dumper(yaml.SafeDumper):
    pass


Dumper.add_representer(Tag, lambda dumper, value: dumper.represent_scalar(value.tag, str(value)))


def load(path: Path):
    return yaml.load(path.read_text(encoding="utf8"), Loader=Loader)


def dump(value) -> str:
    return yaml.dump(value, Dumper=Dumper, sort_keys=False, allow_unicode=True, width=1000)


def source_hash_bytes(path: Path) -> bytes:
    """Make Git's CRLF working-tree conversion irrelevant to the contract."""
    return path.read_bytes().replace(b"\r\n", b"\n")


def resolve(value, substitutions):
    if not isinstance(value, str):
        return value
    for _ in range(10):
        new = re.sub(r"\$\{(\w+)\}", lambda m: str(substitutions[m[1]]), value)
        if new == value:
            if "${" in new:
                raise ValueError("Unresolved firmware default: " + value)
            return new
        value = new
    raise ValueError("Cyclic substitution: " + value)


def range_of(validator):
    for child in getattr(validator, "validators", [validator]):
        if hasattr(child, "min") and hasattr(child, "max"):
            return {"min": child.min, "max": child.max, "step": 1}
    raise ValueError("ESPHome numeric schema has no inspectable range")


def source_notes(tag: str) -> str:
    text = (ROOT / "CHANGELOG.md").read_text(encoding="utf8")
    match = re.search(r"^## " + re.escape(tag) + r"(?: - [^\n]+)?\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    if not match or not match[1].strip():
        raise ValueError(f"CHANGELOG.md needs nonempty notes for firmware {tag}")
    return match[1].strip()


def build():
    base = load(ROOT / "packages/base.yaml")
    target = base["esphome"]["min_version"]
    if version("esphome") != target:
        raise ValueError(f"Use exactly ESPHome {target}, installed {version('esphome')}")
    requirements = (ROOT / "requirements-validation.txt").read_text(encoding="utf8").splitlines()
    if f"esphome=={target}" not in requirements:
        raise ValueError("requirements-validation.txt and firmware target disagree")
    from esphome.components.max7219digit import display as driver
    from esphome.components import logger, web_server, wifi
    from esphome.components.esp8266 import boards, gpio
    from esphome import config_validation as cv

    bindings = json.loads((ROOT / "packages/configurator.json").read_text(encoding="utf8"))
    dev = load(ROOT / "dev.yaml")
    default_wrapper = load(ROOT / "packages/fonts_web.yaml")
    default_fonts = [Path(str(p)).stem for p in default_wrapper["packages"].values()]
    core_files = [str(p) for p in dev["packages"].values() if not str(p).endswith("fonts_default_local.yaml")]
    reset_path = "packages/restore_defaults.generated.yaml"
    modules = [load(ROOT / path) if path != reset_path else {} for path in core_files]
    subs = {key: value for module in modules for key, value in module.get("substitutions", {}).items()}
    tag = str(subs["project_ref"])
    if not re.fullmatch(r"\d+\.\d+\.\d+", tag):
        raise ValueError("base.yaml project_ref must be a semantic release version")
    if resolve(base["esphome"]["project"]["version"], subs) != tag:
        raise ValueError("Project metadata and firmware release version disagree")

    faces = {p.stem: load(p) for p in sorted((ROOT / "packages/fonts").glob("*.yaml"))}
    if set(faces) != set(bindings["fontMetadata"]):
        raise ValueError("Font metadata must describe exactly the real per-face packages")
    if not set(default_fonts) <= set(faces):
        raise ValueError("Default font wrapper names an unavailable face")
    # Default faces first, then the display bridge's guarded order.
    display_text = (ROOT / "packages/display.yaml").read_text()
    font_ids = re.findall(r"SourceFont \w+\((font_\w+_source),", display_text)
    by_font_id = {face["font"][0]["id"]: key for key, face in faces.items()}
    order = list(dict.fromkeys(default_fonts + [by_font_id[fid] for fid in font_ids]))
    if set(order) != set(faces):
        raise ValueError("Every optional font must have a display bridge")
    font_specs = []
    outputs = {}
    local_catalog = {"font": [], "esphome": {"build_flags": []}, "select": []}
    initial_font = "compact"
    fallback = next(e for e in load(ROOT / "packages/controls.yaml")["select"] if e["id"] == "clock_font")
    if len(fallback["options"]) != 1:
        raise ValueError("The built-in fallback needs one option")
    font_options = {"compact": fallback["options"][0]}
    for face_id in order:
        face = faces[face_id]
        font = face["font"][0]
        asset = "fonts/" + font["file"]["url"].removeprefix("${fonts_base_url}/")
        if not (ROOT / asset).is_file():
            raise ValueError("Missing font " + asset)
        if font["bpp"] != 1:
            raise ValueError("The monochrome renderer requires bpp: 1")
        meta = bindings["fontMetadata"][face_id]
        if not (ROOT / meta["source"]).is_file():
            raise ValueError("Missing font source/license notice")
        option = face["select"][0]["options"][0]
        font_options[face_id] = option
        if face_id in default_fonts and face["select"][0].get("initial_option"):
            initial_font = face_id
        import freetype
        family = freetype.Face(str(ROOT / asset)).family_name.decode("utf8")
        font_specs.append({"id": face_id, "option": option, "label": meta["label"], "family": family,
                           "firmwareId": font["id"], "size": font["size"], "license": meta["license"],
                           "source": meta["source"], "file": asset, "package": f"packages/fonts/{face_id}.yaml"})
        local = copy.deepcopy(face)
        local["font"][0]["file"] = {"type": "local", "path": "../../" + asset}
        outputs[ROOT / f"packages/local_fonts/{face_id}.yaml"] = "# GENERATED from the corresponding fonts/ release package; do not edit.\n" + dump(local)
        entry = copy.deepcopy(local["font"][0])
        entry["file"]["path"] = "../" + asset
        local_catalog["font"].append(entry)
        local_catalog["esphome"]["build_flags"] += face["esphome"]["build_flags"]
    font_specs.insert(0, {"id": "compact", "option": fallback["options"][0], "label": re.sub(r"(?<=\d)x(?=\d)", "×", fallback["options"][0]),
                          "family": "built-in bitmap", "license": "Project source", "source": "packages/max7219_clock_renderer.h"})
    local_catalog["select"] = [{"id": Tag("clock_font", "!extend"), "initial_option": font_options[initial_font],
                                 "options": [font_options[key] for key in order]}]
    outputs[ROOT / "packages/fonts_local.yaml"] = "# GENERATED measurement catalogue; not the default firmware entry point.\n" + dump(local_catalog)
    outputs[ROOT / "packages/fonts_default_local.yaml"] = "# GENERATED default pair from fonts_web.yaml, using local assets for validation.\n" + dump({"packages": {key.replace("-", "_"): Tag(f"local_fonts/{key}.yaml", "!include") for key in default_fonts}})

    entities = []
    for path, module in zip(core_files, modules):
        for domain in ("select", "number", "switch", "button", "sensor", "text_sensor", "binary_sensor"):
            for item in module.get(domain, []):
                if not isinstance(item, dict):
                    continue
                candidates = [item] if "name" in item else [v for v in item.values() if isinstance(v, dict) and "name" in v]
                for entity in candidates:
                    record = {key: entity[key] for key in ("id", "name", "entity_category", "disabled_by_default", "unit_of_measurement", "min_value", "max_value", "step", "options", "initial_option", "initial_value", "restore_mode") if key in entity}
                    visibility = re.fullmatch(r"\$\{(ha_hide_\w+)\}", str(entity.get("internal", "")))
                    if not entity.get("id") or visibility is None:
                        raise ValueError("Every named entity needs a stable ID and an internal exposure substitution: " + entity["name"])
                    record.update({"domain": domain, "package": path,
                                   "visibilitySubstitution": visibility[1],
                                   "visibleByDefault": not cv.boolean(resolve(subs[visibility[1]], subs)),
                                   "recommended": entity["id"] in bindings["recommendedEntities"]})
                    if record.get("id") == "clock_font":
                        record["options"] = [font_options["compact"]] + [font_options[key] for key in default_fonts]
                        record["initial_option"] = font_options[initial_font]
                    if "initial_value" in record:
                        record["initial_value"] = float(resolve(record["initial_value"], subs))
                    entities.append(record)
    entity_by_id = {e["id"]: e for e in entities if "id" in e}
    if len(entity_by_id) != sum("id" in e for e in entities):
        raise ValueError("Duplicate firmware entity ID")
    integration_names = {key for module in modules for key in module if key not in ("substitutions", "packages")}
    integration_names |= {item["platform"] for module in modules for entries in module.values() if isinstance(entries, list)
                          for item in entries if isinstance(item, dict) and "platform" in item}
    for entity_id in entity_by_id:
        cv.validate_id_name(entity_id)
        if entity_id in integration_names:
            raise ValueError("Entity ID conflicts with an included ESPHome integration: " + entity_id)
    settings = []
    consumed_subs = set(bindings["internalSubstitutions"]) | {e["visibilitySubstitution"] for e in entities}
    if len({e["visibilitySubstitution"] for e in entities}) != len(entities):
        raise ValueError("Entity exposure substitutions must be unique")
    if not set(bindings["recommendedEntities"]) <= set(entity_by_id):
        raise ValueError("Recommended recovery/diagnostic entities must exist")
    for key, binding in bindings["entities"].items():
        entity = entity_by_id[binding["target"]]
        domain = entity["domain"]
        record = {"key": key, "kind": domain, "target": entity["id"], "group": binding["group"], "label": entity["name"]}
        if domain == "select":
            record.update({"options": entity["options"], "default": entity["initial_option"], "input": "select"})
            if binding.get("transform") == "hour-format":
                record["firmwareOptions"] = record["options"][:]
                record["options"] = [s.replace(" hour", "-hour") for s in record["options"]]
                record["default"] = record["default"].replace(" hour", "-hour")
            if binding.get("input") == "font":
                record.update({"options": [f["id"] for f in font_specs], "firmwareOptions": [f["option"] for f in font_specs], "default": initial_font, "input": "font"})
        elif domain == "number":
            record.update({"default": entity["initial_value"], "min": entity["min_value"], "max": entity["max_value"], "step": entity["step"], "unit": entity.get("unit_of_measurement", ""), "input": binding.get("input", "number")})
            source_entity = next(e for module in modules for e in module.get("number", []) if e.get("id") == entity["id"])
            match = re.fullmatch(r"\$\{(\w+)\}", str(source_entity["initial_value"]))
            if match:
                record["substitution"] = match[1]
                consumed_subs.add(match[1])
        elif domain == "switch":
            record.update({"default": entity["restore_mode"].endswith("_ON"), "input": "boolean"})
        else:
            raise ValueError("Unsupported configurable entity " + domain)
        settings.append(record)
    required = {e["id"] for e in entities if e["domain"] in ("select", "number", "switch")}
    if required != {b["target"] for b in bindings["entities"].values()}:
        raise ValueError("Every adjustable firmware entity needs a configurator binding")

    driver_schema = {str(k): v for k, v in driver.CONFIG_SCHEMA.schema.items()}
    limits = {"matrix_chips": range_of(driver_schema["num_chips"]), "matrix_rows": range_of(driver_schema["num_chip_lines"]),
              "ota_display_intensity": range_of(driver_schema["intensity"]), "ota_port": range_of(cv.port),
              "web_server_port": range_of(cv.port)}
    renderer = (ROOT / "packages/max7219_clock_renderer.h").read_text()
    # Pin catalogues keep ESPHome's own board tables instead of one expanded
    # map per board: per-board aliases (including the SDK's string references),
    # the shared alias base and the output-capable GPIO numbers per variant.
    # The web app expands exactly one board on demand; see web-configurator/src/hardware.ts.
    esp8266_catalog = {
        "variants": {"esp8266": [number for number in range(17) if number not in gpio._ESP_SDIO_PINS]},
        "boardVariants": {board: "esp8266" for board in boards.BOARDS},
        "boardAliases": dict(boards.ESP8266_BOARD_PINS),
        "baseAliases": dict(boards.ESP8266_BASE_PINS),
    }
    boot_max = int(re.search(r"boot_duration_ms = std::min<uint32_t>\(duration_ms, (\d+)UL\)", renderer)[1])
    limits["boot_version_duration"] = {"min": 0, "max": boot_max, "step": 1}
    board_binding_key = next(key for key, binding in bindings["substitutions"].items() if binding["target"] == "board")

    def substitution_records(subs_map, board_options):
        """One UI record per substitution binding, resolved from a base package."""
        records = []
        for key, binding in bindings["substitutions"].items():
            sub = binding["target"]
            value = resolve(subs_map[sub], subs_map)
            record = {"key": key, "kind": "substitution", **binding, "default": value}
            input_type = binding["input"]
            if input_type == "integer":
                record["default"] = int(value)
                record.update(limits[sub])
                record["input"] = "integer"
            elif input_type in ("milliseconds", "seconds"):
                milliseconds = cv.positive_time_period_milliseconds(value).total_milliseconds
                divisor = 1000 if input_type == "seconds" else 1
                if milliseconds % divisor:
                    raise ValueError("UI time units lose precision for " + sub)
                record["default"] = milliseconds // divisor
                record["input"] = "integer"
                record["timeSuffix"] = "s" if input_type == "seconds" else "ms"
                # Firmware timers are uint32 milliseconds. Browser redraw timers
                # are signed int32, so keep display sampling safe there as well.
                maximum = range_of(cv.uint32_t)["max"]
                if input_type == "milliseconds":
                    maximum //= 2
                record.update({"min": 0 if sub.endswith("_timeout") else 1,
                               "max": maximum // divisor, "step": 1})
            elif input_type == "boolean":
                record["default"] = bool(cv.boolean(value))
            elif input_type == "driver-option":
                options = list(driver.CHIP_LINES_STYLE) if binding["driverKey"] == "chip_lines_style" else list(driver.CHIP_MODES)
                record["options"] = [s.lower() for s in options] if binding["driverKey"] == "chip_lines_style" else [int(s) for s in options]
                record["default"] = str(value).lower() if binding["driverKey"] == "chip_lines_style" else int(value)
                record["input"] = "select"
            elif sub == "board":
                record["options"] = list(board_options)
                record["input"] = "select"
            elif input_type == "logger-option":
                record["options"] = list(logger.LOG_LEVELS)
                record["input"] = "select"
            elif input_type == "wifi-power-save-option":
                record.update({"options": list(wifi.WIFI_POWER_SAVE_MODES), "default": str(value).upper(), "input": "select"})
            elif input_type == "web-auth-option":
                record.update({"options": [web_server.AUTH_TYPE_BASIC, web_server.AUTH_TYPE_DIGEST], "input": "select"})
            elif input_type == "web-server-version-option":
                schema = web_server.CONFIG_SCHEMA.validators[0].schema
                validator = next(v for k, v in schema.items() if str(k) == "version")
                record.update({"options": list(inspect.getclosurevars(validator).nonlocals["values"]),
                               "default": int(value), "input": "select"})
            records.append(record)
        return records

    def esp32_pin_catalog(board_ids):
        """Ask the ESPHome variant validators instead of copying a pin list.

        A pin is offered when the variant's own validation accepts it as an
        output, which keeps flash/PSRAM pins, unusable numbers and input-only
        pins out of the configurator.
        """
        from esphome.components.esp32 import boards as esp32_boards
        from esphome.components.esp32 import gpio as esp32_gpio
        from esphome.components.esp32.const import KEY_BOARD, KEY_ESP32, KEY_VARIANT
        from esphome.const import CONF_INPUT, CONF_MODE, CONF_NUMBER, CONF_OPEN_DRAIN, CONF_OUTPUT, CONF_PULLDOWN, CONF_PULLUP
        from esphome.core import CORE

        variants = {}
        board_variants = {}
        # Strapping-pin warnings are expected here and would flood the log.
        logging.disable(logging.CRITICAL)
        try:
            for board in board_ids:
                variant = esp32_boards.BOARDS[board]["variant"]
                board_variants[board] = variant
                if variant in variants:
                    continue
                CORE.data[KEY_ESP32] = {KEY_BOARD: board, KEY_VARIANT: variant}
                validation = esp32_gpio._esp32_validations[variant]
                mode = {CONF_INPUT: False, CONF_OUTPUT: True, CONF_PULLUP: False, CONF_PULLDOWN: False, CONF_OPEN_DRAIN: False}
                numbers = []
                for number in range(55):
                    try:
                        validation.pin_validation(number)
                        validation.usage_validation({CONF_NUMBER: number, CONF_MODE: mode})
                    except cv.Invalid:
                        continue
                    numbers.append(number)
                variants[variant] = numbers
        finally:
            logging.disable(logging.NOTSET)
        return {"variants": variants, "boardVariants": board_variants,
                "boardAliases": {board: esp32_boards.ESP32_BOARD_PINS[board] for board in board_ids if board in esp32_boards.ESP32_BOARD_PINS},
                "baseAliases": dict(esp32_boards.ESP32_BASE_PINS)}

    def flat_pins(catalog, board):
        """The expansion the web app performs for one board (name -> number)."""
        aliases = catalog["boardAliases"].get(board, {})
        while isinstance(aliases, str):
            aliases = catalog["boardAliases"].get(aliases, {})
        numbers = catalog["variants"].get(catalog["boardVariants"].get(board), [])
        mapping = {key: value for key, value in {**catalog["baseAliases"], **aliases}.items() if value in numbers}
        mapping.update({f"GPIO{number}": number for number in numbers})
        return mapping

    settings += substitution_records(subs, list(boards.BOARDS))
    secret_keys = {key for key, value in dev["substitutions"].items() if isinstance(value, Tag) and value.tag == "!secret"}
    for key, binding in bindings["packages"].items():
        path = binding["target"]
        if path not in core_files:
            raise ValueError("Optional package must be a real dev.yaml module: " + path)
        references = set(re.findall(r"\$\{(\w+)\}", (ROOT / path).read_text()))
        other_references = set(re.findall(r"\$\{(\w+)\}", "\n".join((ROOT / f).read_text() for f in core_files if f not in (path, reset_path))))
        settings.append({"key": key, "kind": "package", **binding, "default": True,
                         "exclusiveSecrets": sorted((references & secret_keys) - other_references)})
    groups = bindings["groups"]
    if len({g["id"] for g in groups}) != len(groups) or {s["group"] for s in settings} != {g["id"] for g in groups}:
        raise ValueError("Every setting needs exactly one declared UI group")
    if len({s["key"] for s in settings}) != len(settings):
        raise ValueError("Duplicate setting key")
    for item in settings:
        if "requires" in item and item["requires"] not in bindings["packages"]:
            raise ValueError("Conditional setting must name an optional package")
    entity_groups = {s["target"]: s["group"] for s in settings if s["kind"] in ("select", "number", "switch")}
    for entity in entities:
        entity["group"] = entity_groups.get(entity["id"], "Buttons" if entity["domain"] == "button" else "Diagnostics")
    consumed_subs |= {record["target"] for record in settings if record["kind"] == "substitution"}
    if consumed_subs != set(subs):
        raise ValueError("Substitution bindings drifted: " + str(set(subs) ^ consumed_subs))

    # ----- Hardware targets -------------------------------------------------
    # Each target keeps the data that differs from the default target: option
    # lists, defaults, module files and pins. `pinMappings`/`packageFiles` stay
    # null when they equal the top-level (default target) data, so no fact is
    # stored twice.
    target_specs = bindings["hardwareTargets"]
    default_id = bindings["defaultTarget"]
    default_spec = next((spec for spec in target_specs if spec["id"] == default_id), None)
    if default_spec is None or len({spec["id"] for spec in target_specs}) != len(target_specs):
        raise ValueError("Hardware targets need unique ids and a known defaultTarget")
    if default_spec["platform"] != "esp8266":
        raise ValueError("The default hardware target must be the dev.yaml (ESP8266) platform")
    if default_spec["base"] not in core_files:
        raise ValueError("The default hardware target must use a dev.yaml base package")
    base_records = {record["key"]: record for record in settings if record["kind"] == "substitution"}
    hardware_targets = []
    target_files = {}
    for spec in target_specs:
        if spec["platform"] not in ("esp8266", "esp32"):
            raise ValueError("Unknown hardware platform " + spec["platform"])
        base_path = ROOT / spec["base"]
        if not base_path.is_file():
            raise ValueError("Missing hardware target package " + spec["base"])
        target_subs = {**subs, **load(base_path).get("substitutions", {})}
        if resolve(target_subs["project_ref"], target_subs) != tag:
            raise ValueError("Hardware target " + spec["id"] + " pins a different project_ref")
        if spec["platform"] == "esp8266":
            board_options = list(boards.BOARDS)
            catalog = esp8266_catalog
        else:
            from esphome.components.esp32 import boards as esp32_boards
            board_options = list(esp32_boards.BOARDS)
            catalog = esp32_pin_catalog(board_options)
        files = [spec["base"], *(file for file in core_files if file != default_spec["base"])]
        target_files[spec["id"]] = files
        records = substitution_records(target_subs, board_options)
        if {record["key"] for record in records} != set(base_records):
            raise ValueError("Every hardware target package must expose the same substitutions")
        defaults = {record["key"]: record["default"] for record in records if record["default"] != base_records[record["key"]]["default"]}
        board = defaults.get(board_binding_key, base_records[board_binding_key]["default"])
        if board not in board_options:
            raise ValueError(f"Hardware target {spec['id']} default board {board} is not in its board list")
        pins = flat_pins(catalog, board)
        for key, record in base_records.items():
            if record["input"] == "pin" and defaults.get(key, record["default"]) not in pins:
                raise ValueError(f"Hardware target {spec['id']} default {key} is not a valid pin for {board}")
        hardware_targets.append({
            "id": spec["id"], "label": spec["label"], "platform": spec["platform"], "basePackage": spec["base"],
            "boardKey": board_binding_key, "defaults": defaults, "packageFiles": files, "pins": catalog,
        })
    esp32_target = next((target for target in hardware_targets if target["platform"] == "esp32"), None)
    if esp32_target is None:
        raise ValueError("The ESP-WROOM-32 example and installer need an ESP32 hardware target")

    # Check all compiled source fonts, not just the default pair.
    all_paths = [ROOT / "dev.yaml", ROOT / "CHANGELOG.md", ROOT / "packages/configurator.json", ROOT / "requirements-validation.txt", Path(__file__), ROOT / "web-configurator/scripts/generate_glyphs.py"]
    all_paths += [ROOT / file for file in core_files if file != reset_path]
    all_paths += [ROOT / spec["base"] for spec in target_specs]
    all_paths += list((ROOT / "packages").glob("*.h")) + list((ROOT / "packages/fonts").glob("*.yaml")) + [ROOT / "packages/fonts_web.yaml"]
    all_paths += [ROOT / f["file"] for f in font_specs if "file" in f]
    all_paths += [ROOT / f["source"] for f in font_specs]
    digest = hashlib.sha256()
    for path in sorted(set(all_paths)):
        digest.update(path.relative_to(ROOT).as_posix().encode() + b"\0" + source_hash_bytes(path) + b"\0")
    secrets = {key: str(value) for key, value in dev["substitutions"].items() if isinstance(value, Tag) and value.tag == "!secret"}
    actions = [{key: action.get(key, {}) for key in ("action", "description", "variables")} for module in modules for action in module.get("api", {}).get("actions", [])]
    ota_enum = re.search(r"enum OtaState[^\{]+\{(.*?)\};", renderer, re.S)[1]
    ota_ids = {name: index for index, name in enumerate(re.findall(r"(OTA_\w+)(?:\s*=\s*0)?\s*,", ota_enum))}
    ota_function = renderer.split("inline void draw_ota(", 1)[1].split("// Determine the effective mode", 1)[0]
    ota_templates = {name: re.findall(r'snprintf\(content, sizeof\(content\), "([^"]+)"', block) for name, block in re.findall(r"case (OTA_\w+):(.*?)(?=case |default:)", ota_function, re.S)}
    bar_states = re.findall(r"ota_state == (OTA_\w+)", re.search(r"const bool show_bar = ([^;]+)", ota_function)[1])
    contract = {"schemaVersion": bindings["schemaVersion"], "sourceHash": digest.hexdigest(), "repository": subs["project_repo"], "releaseVersion": tag,
                "esphomeVersion": target, "releaseNotes": source_notes(tag), "packageFiles": core_files,
                "defaultTarget": default_id, "hardwareTargets": hardware_targets,
                "secrets": secrets, "defaultFonts": default_fonts, "fonts": font_specs, "settings": settings, "groups": groups,
                "defaults": {**{s["key"]: s["default"] for s in settings}, "target": default_id}, "entities": entities, "actions": actions,
                "renderer": {"messageMaxBytes": int(re.search(r"char message_text\[(\d+)\]", renderer)[1]) - 1,
                             "alertMaxBytes": int(re.search(r"char alert_text\[(\d+)\]", renderer)[1]) - 1,
                             "otaStates": ota_ids, "otaTemplates": ota_templates, "otaBarStates": bar_states,
                             "progressMax": int(re.search(r"if \(percentage >= (\d+)\.0f\)", renderer)[1]),
                             "bootPrefix": re.search(r'snprintf\(this->boot_version,\s*sizeof\(this->boot_version\),\s*"([^"%]+)%', renderer)[1],
                             "bootScrollMs": int(re.search(r"true, (\d+), fallback.centered_box_top", renderer)[1]),
                             "alarmPeriodMs": int(re.search(r"f.now_ms / (\d+)UL", renderer)[1])}}
    digest.update(json.dumps({k: v for k, v in contract.items() if k != "sourceHash"}, sort_keys=True).encode())
    contract["sourceHash"] = digest.hexdigest()
    outputs[OUTPUT] = json.dumps(contract, ensure_ascii=False, indent=2) + "\n"
    resets = []
    for item in settings:
        if item["kind"] == "select":
            value = item["default"]
            if item["key"] == "clockFont":
                desired = font_options[value]
                fallback_option = font_options["compact"]
                resets.append({"lambda": f'auto call = id(clock_font).make_call();\ncall.set_option(id(clock_font).has_option({json.dumps(desired)}) ? {json.dumps(desired)} : {json.dumps(fallback_option)});\ncall.perform();'})
            else:
                if "firmwareOptions" in item:
                    value = item["firmwareOptions"][item["options"].index(value)]
                resets.append({"select.set": {"id": item["target"], "option": value}})
        elif item["kind"] == "number":
            resets.append({"number.set": {"id": item["target"], "value": item["default"]}})
        elif item["kind"] == "switch":
            resets.append({"switch.turn_on" if item["default"] else "switch.turn_off": item["target"]})
    resets += [{"lambda": "max7219_clock::state.clear_message();\nmax7219_clock::state.clear_alert();\nmax7219_clock::state.cancel_countdown();"}, {"component.update": "matrix"}]
    outputs[ROOT / reset_path] = "# GENERATED from the real entity defaults; do not copy defaults by hand.\n" + dump({"script": [{"id": "restore_display_defaults", "mode": "restart", "then": resets}]})
    example = {"substitutions": {key: Tag(value, "!secret") for key, value in secrets.items()}, "packages": {"clock": {"url": "https://github.com/" + subs["project_repo"], "ref": tag, "refresh": "1d", "files": core_files + [f"packages/fonts/{key}.yaml" for key in default_fonts]}}}
    example["substitutions"]["project_ref"] = tag
    outputs[ROOT / "examples/release.yaml"] = "# GENERATED pinned release example. Copy beside your local secrets.yaml.\n# ESPHome downloads all modules and the two default external fonts.\n" + dump(example)
    esp32_example = copy.deepcopy(example)
    esp32_defaults = {**{s["key"]: s["default"] for s in settings}, **esp32_target["defaults"]}
    esp32_example["packages"]["clock"]["files"] = [
        *target_files[esp32_target["id"]], *(f"packages/fonts/{key}.yaml" for key in default_fonts),
    ]
    outputs[ROOT / "examples/esp-wroom-32.yaml"] = (
        "# GENERATED ESP-WROOM-32 DevKit installer. Copy beside your local secrets.yaml.\n"
        f"# Defaults: {esp32_defaults['board']}; MAX7219 CLK {esp32_defaults['clkPin']}, "
        f"DIN {esp32_defaults['mosiPin']}, CS {esp32_defaults['csPin']}.\n" + dump(esp32_example)
    )
    development = copy.deepcopy(example)
    development["substitutions"]["project_ref"] = "main"
    development["packages"]["clock"]["ref"] = "main"
    outputs[ROOT / "examples/development.yaml"] = "# GENERATED DEVELOPMENT example only; never used by the public installer.\n" + dump(development)
    for path in (ROOT / "web-configurator/package.json", ROOT / "web-configurator/package-lock.json"):
        data = json.loads(path.read_text(encoding="utf8"))
        data["version"] = tag
        if "packages" in data:
            data["packages"][""]["version"] = tag
        outputs[path] = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    return contract, outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    _, outputs = build()
    stale = []
    for path, text in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text(encoding="utf8") != text:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            # Generated YAML and JSON are consumed by the web parity tests;
            # keep their bytes stable across Windows and POSIX hosts.
            path.write_text(text, encoding="utf8", newline="\n")
    if stale:
        raise SystemExit("Firmware/configurator drift. Regenerate in the SAME commit:\n" + "\n".join(stale))
    print(f"Firmware contract {'checked' if args.check else 'generated'}: {len(outputs)} files")


if __name__ == "__main__":
    main()
