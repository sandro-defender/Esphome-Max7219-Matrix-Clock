#!/usr/bin/env python3
"""Isolated exact-target YAML/codegen/compile validation, with fake secrets only.

Never reads production secrets.yaml. No files are written into the firmware
source tree. Build artifacts stay under ignored validation-tmp/ (or a specified
workspace). --compile builds default and all-font variants; failures are fatal.
"""
from __future__ import annotations
import argparse
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
from importlib.metadata import version
from pathlib import Path

from generate_firmware_contract import ROOT, Tag, build, dump, load


def run(command, cwd, log):
    print("+", " ".join(map(str, command)), flush=True)
    with log.open("w") as output:
        result = subprocess.run(list(map(str, command)), cwd=cwd, stdout=output, stderr=subprocess.STDOUT, text=True)
    tail = log.read_text(errors="replace").splitlines()[-15:]
    print("\n".join(tail), flush=True)
    if result.returncode:
        raise RuntimeError(f"Validation failed ({result.returncode}); see {log}")


def copy_source(directory):
    def excluded(_path, names):
        return [name for name in names if name in ("secrets.yaml", ".esphome", "__pycache__", "build", ".cache", "node_modules")]
    for name in ("packages", "fonts"):
        shutil.copytree(ROOT / name, directory / name, ignore=excluded)
    shutil.copyfile(ROOT / "dev.yaml", directory / "dev.yaml")
    # Deterministic dummy bytes are not a real device key. Production secrets
    # are not copied, opened, logged, modified or uploaded by this validator.
    fake = {"wifi_ssid": "ValidationSSID", "wifi_password": "ValidationPassword123",
            "api_encryption_key": base64.b64encode(bytes(range(1, 33))).decode(),
            "fallback_ap_password": "ValidationFallback123", "web_server_username": "validation",
            "web_server_password": "ValidationWebPassword123"}
    (directory / "secrets.yaml").write_text(dump(fake))


def local_installer(path, contract):
    config = load(path)
    remote = config["packages"]["clock"]
    if remote["url"] != "https://github.com/" + contract["repository"]:
        raise ValueError("Installer repository drift")
    if remote["ref"] != config["substitutions"]["project_ref"]:
        raise ValueError("Installer package/font/version refs differ")
    files = remote["files"]
    framework = [file for file in files if not file.startswith("packages/fonts/")]
    target = next((target for target in contract["hardwareTargets"] if target["basePackage"] in framework), None)
    optional = {item["target"] for item in contract["settings"] if item["kind"] == "package"}
    if target is None or framework != [file for file in target["packageFiles"] if file not in optional or file in framework]:
        raise ValueError("Installer modules differ from the selected firmware target")
    allowed = set(target["packageFiles"]) | {font["package"] for font in contract["fonts"] if "package" in font}
    if len(files) != len(set(files)) or not set(files) <= allowed:
        raise ValueError("Installer contains unknown or duplicate packages")
    config["packages"] = {"module_" + str(index): Tag(file.replace("packages/fonts/", "packages/local_fonts/"), "!include") for index, file in enumerate(files)}
    path.write_text(dump(config))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config-only", action="store_true", help="Validate YAML only, without code generation or compilation")
    parser.add_argument("--compile", action="store_true", help="Full default and all-font ESP8266 builds, no skipped failures")
    parser.add_argument("--workspace", type=Path, help="Retain an empty validation directory for inspection")
    parser.add_argument("--skip-installers", action="store_true", help="Local YAML/codegen only (npm dependencies unavailable)")
    args = parser.parse_args()
    if args.config_only and args.compile:
        parser.error("--config-only cannot be combined with --compile")
    contract, _ = build()
    if version("esphome") != contract["esphomeVersion"]:
        raise SystemExit("The exact firmware ESPHome target is required")
    executable = Path(sys.executable).with_name("esphome" + (".exe" if os.name == "nt" else ""))
    if not executable.is_file():
        raise SystemExit("Use Python from the virtual environment containing exact-target ESPHome")
    root = ROOT / "validation-tmp"
    root.mkdir(exist_ok=True)
    work = args.workspace.resolve() if args.workspace else Path(tempfile.mkdtemp(prefix="validation-", dir=root))
    if args.workspace:
        if work.exists() and any(work.iterdir()):
            raise SystemExit("--workspace must be an empty directory; existing files are never removed")
        work.mkdir(parents=True, exist_ok=True)
    print("Exact ESPHome:", contract["esphomeVersion"], "Workspace:", work, flush=True)
    try:
        copy_source(work)
        default = load(work / "dev.yaml")
        all_fonts = load(work / "dev.yaml")
        all_fonts["packages"]["fonts"] = Tag("packages/fonts_local.yaml", "!include")
        builtin = load(work / "dev.yaml")
        del builtin["packages"]["fonts"]
        variants = {"default": default, "all": all_fonts, "builtin": builtin}
        for name, config in variants.items():
            # Distinct build paths prevent stale glyphs leaking between subsets.
            config["esphome"] = {"build_path": ".esphome/build/" + name}
            (work / f"{name}.yaml").write_text(dump(config))
        if not args.skip_installers:
            npm = "npm.cmd" if os.name == "nt" else "npm"
            generate = [npm, "run", "installer", "--", contract["releaseVersion"]]
            first = work / "installer.yaml"
            run(generate + [first], ROOT / "web-configurator", work / "installer-generation.log")
            local_installer(first, contract)
            second = work / "installer-all.yaml"
            overrides = {item["key"]: (not item["default"] if isinstance(item["default"], bool) else item["options"][-1] if item.get("options") and item["kind"] == "select" else item["default"]) for item in contract["settings"]}
            overrides.update({"chips": 8, "rows": 2, "animationMs": 400, "animationRowGap": 2, "brightness": 7, "nightBrightness": 2,
                              "friendlyName": "Validation alternate profile", "timezone": "UTC", "rotateChip": 90, "flipX": True})
            profile = work / "profile.json"
            profile.write_text(json.dumps(overrides))
            run(generate + [second, "--all-fonts", "--config", profile], ROOT / "web-configurator", work / "installer-all-generation.log")
            local_installer(second, contract)
            variants["installer"] = None
            variants["installer-all"] = None
            for target in contract["hardwareTargets"]:
                for hidden in (False, True):
                    name = f"installer-{target['id']}-{'internal' if hidden else 'exposed'}"
                    # No copied board/pin defaults: the CLI and browser use the
                    # same target-aware sanitization. Exercise web v3/digest too.
                    profile.write_text(json.dumps({"target": target["id"], "webServer": not hidden,
                                                   "webServerVersion": 3, "webServerAuthType": "digest", "webServerLog": True,
                                                   "hiddenEntities": [e["id"] for e in contract["entities"]] if hidden else []}))
                    destination = work / f"{name}.yaml"
                    run(generate + [destination, "--config", profile], ROOT / "web-configurator", work / f"{name}-generation.log")
                    local_installer(destination, contract)
                    variants[name] = None
        for name in variants:
            path = work / f"{name}.yaml"
            run([executable, "config", path], work, work / f"{name}-config.log")
            if not args.config_only:
                run([executable, "compile", path, "--only-generate"], work, work / f"{name}-codegen.log")
        if args.compile:
            for name in ("default", "all"):
                run([executable, "compile", work / f"{name}.yaml"], work, work / f"{name}-compile.log")
        checked = "YAML" if args.config_only else "YAML/codegen"
        print(f"PASS: {len(variants)} {checked} variants; " + ("2 full firmware builds" if args.compile else "full compile not requested"), flush=True)
    finally:
        # Never remove a caller-provided path, and never clean the repository.
        if not args.workspace:
            shutil.rmtree(work)


if __name__ == "__main__":
    main()
