#!/usr/bin/env python3
"""Code-only CI contracts; no ESPHome/PlatformIO command is executed."""
from __future__ import annotations

import io
import json
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from importlib.metadata import PackageNotFoundError
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import check_code

WORKFLOW = ROOT / ".github/workflows/validate-code.yml"


class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = yaml.safe_load(WORKFLOW.read_text())
        cls.steps = cls.workflow["jobs"]["checks"]["steps"]

    def test_every_main_push_and_pr_are_validated_without_path_filters(self):
        events = self.workflow["on"]
        self.assertEqual(events["push"]["branches"], ["main"])
        self.assertEqual(events["pull_request"]["branches"], ["main"])
        for event in ("push", "pull_request"):
            self.assertNotIn("paths", events[event])
            self.assertNotIn("paths-ignore", events[event])
        self.assertNotIn("pull_request_target", events)
        self.assertNotIn("tags", events["push"])

    def test_read_only_permissions_and_no_secret_or_publisher_access(self):
        self.assertEqual(self.workflow["permissions"], {"contents": "read"})
        checks = self.workflow["jobs"]["checks"]
        self.assertNotIn("environment", checks)
        self.assertNotIn("permissions", checks)
        runs = "\n".join(step.get("run", "") for step in self.steps)
        self.assertNotIn("secrets.", WORKFLOW.read_text())
        for forbidden in ("gh ", "publish_release", "validate.py", "esphome ", "platformio ", "pio "):
            self.assertNotIn(forbidden, runs)

    def test_actions_are_pinned_and_checkout_does_not_persist_credentials(self):
        actions = [step for step in self.steps if "uses" in step]
        for step in actions:
            self.assertRegex(step["uses"], r"^actions/[\w-]+@[a-f0-9]{40}$")
        checkout = next(step for step in actions if step["uses"].startswith("actions/checkout@"))
        self.assertIs(checkout["with"]["persist-credentials"], False)
        self.assertNotIn("ref", checkout["with"], "do not checkout a privileged main ref for PR code")

    def test_runtimes_and_dependency_sources_are_explicit(self):
        python = next(step for step in self.steps if step.get("uses", "").startswith("actions/setup-python@"))
        node = next(step for step in self.steps if step.get("uses", "").startswith("actions/setup-node@"))
        self.assertEqual(python["with"]["python-version"], "3.12")
        self.assertEqual(node["with"]["node-version"], "22")
        self.assertEqual(node["with"]["cache-dependency-path"], "web-configurator/package-lock.json")
        runs = [step.get("run") for step in self.steps]
        self.assertIn("python -m pip install --requirement requirements-validation.txt", runs)
        self.assertIn("npm --prefix web-configurator ci --ignore-scripts", runs)

    def test_ci_uses_full_code_gate_not_reduced_local_mode(self):
        runs = [step.get("run", "") for step in self.steps]
        self.assertIn("python scripts/check_code.py", runs)
        self.assertTrue(all("--skip-sdk-checks" not in run for run in runs))
        self.assertLessEqual(self.workflow["jobs"]["checks"]["timeout-minutes"], 20)

    def test_main_validation_is_not_cancelled_by_a_later_commit(self):
        concurrency = self.workflow["concurrency"]
        self.assertIs(concurrency["cancel-in-progress"], False)
        self.assertIn("github.sha", concurrency["group"])

    def test_installer_bundler_is_an_explicit_locked_dependency(self):
        package = json.loads((ROOT / "web-configurator/package.json").read_text())
        lock = json.loads((ROOT / "web-configurator/package-lock.json").read_text())
        version = package["devDependencies"]["esbuild"]
        self.assertRegex(version, r"^\d+\.\d+\.\d+$")
        self.assertEqual(lock["packages"][""]["devDependencies"]["esbuild"], version)
        self.assertEqual(lock["packages"]["node_modules/esbuild"]["version"], version)


class CodeGateTests(unittest.TestCase):
    def test_full_plan_checks_freshness_instead_of_regenerating(self):
        plan = check_code.check_plan("python", "npm")
        self.assertEqual(len(plan), 9)
        generated = [command for label, command in plan if "freshness" in label]
        self.assertEqual(len(generated), 3)
        self.assertEqual(generated[0], ["python", "scripts/generate_georgian_mkhedruli_font.py", "--check"])
        self.assertTrue(all(command[-1] == "--check" for command in generated))

    def test_reduced_mode_omits_only_sdk_freshness(self):
        full = check_code.check_plan("python", "npm")
        reduced = check_code.check_plan("python", "npm", skip_sdk_checks=True)
        self.assertEqual(reduced, full[:1] + full[3:])

    def test_plan_keeps_source_publisher_workflow_and_pixel_oracle_coverage(self):
        commands = [command for _, command in check_code.check_plan("python", "npm")]
        self.assertIn(["python", "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v"], commands)
        self.assertIn(["make", "-C", "tests", "test", "fixture"], commands)
        self.assertIn(["npm", "--prefix", "web-configurator", "test"], commands)
        self.assertIn(["npm", "--prefix", "web-configurator", "run", "typecheck"], commands)
        self.assertIn(["npm", "--prefix", "web-configurator", "run", "build"], commands)
        self.assertTrue(all("scripts/validate.py" not in command for command in commands))

    def test_firmware_cli_and_python_module_invocations_are_forbidden(self):
        commands = [["esphome", "compile"], ["/some/bin/esphome", "config"], [r"C:\tools\esphome.exe", "compile"],
                    ["platformio", "run"], ["pio", "run"], ["python", "-m", "esphome", "compile"],
                    ["python", "-m", "esphome.__main__", "compile"], ["python", "-m", "platformio", "run"], []]
        for command in commands:
            with self.subTest(command=command), self.assertRaises(ValueError):
                check_code.ensure_code_only(command)

    def test_host_and_web_commands_remain_allowed(self):
        for command in (["g++", "host.cpp"], ["make", "-C", "tests", "test"], ["npm.cmd", "run", "build"], ["python", "-m", "unittest"]):
            check_code.ensure_code_only(command)

    def test_first_failed_gate_aborts_later_commands(self):
        with patch.object(check_code, "pinned_dependencies"), patch.object(check_code.subprocess, "run", return_value=SimpleNamespace(returncode=2)) as run, redirect_stdout(io.StringIO()), self.assertRaises(SystemExit):
            check_code.main([])
        self.assertEqual(run.call_count, 1)

    def test_reduced_mode_is_explicit_in_output(self):
        output = io.StringIO()
        with patch.object(check_code, "pinned_dependencies") as pinned, patch.object(check_code.subprocess, "run", return_value=SimpleNamespace(returncode=0)) as run, redirect_stdout(output):
            check_code.main(["--skip-sdk-checks"])
        pinned.assert_not_called()
        self.assertEqual(run.call_count, 7)
        self.assertIn("REDUCED COVERAGE", output.getvalue())
        self.assertIn("Georgian bitmap font freshness", output.getvalue())
        self.assertIn("firmware config/build/hardware NOT verified", output.getvalue())

    def test_sdk_dependencies_must_be_exact_and_match_the_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "requirements-validation.txt").write_text("esphome==2026.9.1\nfreetype-py==2.5.1\n")
            manifest = root / "web-configurator/src/firmware.generated.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(json.dumps({"esphomeVersion": "2026.9.1"}))
            pins = {"esphome": "2026.9.1", "freetype-py": "2.5.1"}
            with patch.object(check_code, "version", side_effect=pins.__getitem__):
                check_code.pinned_dependencies(root)
            with patch.object(check_code, "version", return_value="2026.9.0"), self.assertRaisesRegex(ValueError, "installed"):
                check_code.pinned_dependencies(root)
            with patch.object(check_code, "version", side_effect=PackageNotFoundError("esphome")), self.assertRaisesRegex(ValueError, "Missing"):
                check_code.pinned_dependencies(root)
            manifest.write_text(json.dumps({"esphomeVersion": "2026.9.0"}))
            with patch.object(check_code, "version") as version, self.assertRaisesRegex(ValueError, "differs"):
                check_code.pinned_dependencies(root)
            version.assert_not_called()


if __name__ == "__main__":
    unittest.main(verbosity=2)
