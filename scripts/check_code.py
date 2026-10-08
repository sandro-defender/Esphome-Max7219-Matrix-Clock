#!/usr/bin/env python3
"""Code-only regression gate. Never invoke the ESPHome or PlatformIO CLI.

With the pinned Python dependencies installed, check source contract/glyph
freshness using SDK imports, host tests, installer/YAML source tests and web
checks. --skip-sdk-checks is explicit local-only reduced coverage; it does not
claim SDK freshness, firmware config, code generation, or a firmware build.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLOCKED_TOOLS = {"esphome", "esphome.exe", "platformio", "platformio.exe", "pio", "pio.exe"}


def ensure_code_only(command):
    if not command:
        raise ValueError("Empty check command")
    executable = str(command[0]).replace("\\", "/").rsplit("/", 1)[-1].lower()
    if executable in BLOCKED_TOOLS:
        raise ValueError("Firmware CLI is forbidden in code-only checks")
    if "-m" in command:
        module = command[command.index("-m") + 1] if command.index("-m") + 1 < len(command) else ""
        if module.split(".")[0].lower() in {"esphome", "platformio"}:
            raise ValueError("Firmware Python CLI is forbidden in code-only checks")


def pinned_dependencies(root=ROOT):
    pairs = re.findall(r"^([\w-]+)==([^\s#]+)$", (root / "requirements-validation.txt").read_text(), re.M)
    pins = dict(pairs)
    contract = json.loads((root / "web-configurator/src/firmware.generated.json").read_text())
    if pins.get("esphome") != contract["esphomeVersion"]:
        raise ValueError("SDK dependency pin differs from the firmware contract")
    for dependency, expected in pairs:
        try:
            installed = version(dependency)
        except PackageNotFoundError as error:
            raise ValueError(f"Missing code-check dependency {dependency}=={expected}") from error
        if installed != expected:
            raise ValueError(f"Code checks need {dependency}=={expected}, installed {installed}")


def check_plan(python, npm, skip_sdk_checks=False):
    checks = []
    if not skip_sdk_checks:
        checks.extend([
            ("Firmware contract freshness (SDK imports only)", [python, "scripts/generate_firmware_contract.py", "--check"]),
            ("Browser/host glyph freshness (SDK imports only)", [python, "web-configurator/scripts/generate_glyphs.py", "--check"]),
        ])
    checks.extend([
        # Browser parity tests execute this native fixture after the host suite.
        # Build it explicitly because `test` only creates `test_renderer`.
        ("Host renderer regression and browser fixture", ["make", "-C", "tests", "test", "fixture"]),
        ("Python source, publisher and workflow regressions", [python, "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v"]),
        ("Browser/source pixel oracle", [npm, "--prefix", "web-configurator", "test"]),
        ("TypeScript", [npm, "--prefix", "web-configurator", "run", "typecheck"]),
        ("Production web bundle (not firmware)", [npm, "--prefix", "web-configurator", "run", "build"]),
        ("Diff whitespace", ["git", "diff", "--check"]),
    ])
    for _, command in checks:
        ensure_code_only(command)
    return checks


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-sdk-checks", action="store_true", help="Local reduced coverage: skip exact SDK dependency/freshness checks")
    args = parser.parse_args(argv)
    print("Code-only checks: no ESPHome/PlatformIO CLI or firmware compilation.", flush=True)
    if args.skip_sdk_checks:
        print("REDUCED COVERAGE: exact SDK dependencies and generated freshness NOT checked.", flush=True)
    else:
        pinned_dependencies()
    npm = "npm.cmd" if os.name == "nt" else "npm"
    plan = check_plan(sys.executable, npm, args.skip_sdk_checks)
    for label, command in plan:
        print("\n=== " + label + " ===", flush=True)
        result = subprocess.run(command, cwd=ROOT, check=False)
        if result.returncode:
            raise SystemExit(f"FAIL: {label} (exit {result.returncode})")
    print(f"\nPASS: {len(plan)} code-only gates; firmware config/build/hardware NOT verified.", flush=True)


if __name__ == "__main__":
    main()
