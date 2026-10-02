#!/usr/bin/env python3
"""Read-only deployment and main-only release/Pages contracts; no real release."""
from __future__ import annotations

import copy
import hashlib
import io
import json
import os
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import publish_release as releases
import verify_deployment as deployment

SHA = "a" * 40
OTHER = "b" * 40
TAG = "0.7.0"
CONTENT = b"substitutions:\n  wifi_ssid: !secret wifi_ssid\n"
CONTRACT = {"repository": "owner/clock", "releaseVersion": TAG, "releaseNotes": "Candidate notes.",
            "defaults": {"deviceName": "max7219-clock"}}
RELEASE = {"tag_name": TAG, "draft": False, "prerelease": False, "body": f"## {TAG}\n\nCandidate notes.\n",
           "assets": [{"name": "max7219-clock.yaml", "size": len(CONTENT),
                       "digest": "sha256:" + hashlib.sha256(CONTENT).hexdigest()}]}


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        blocker = patch.object(releases.subprocess, "run", side_effect=AssertionError("Unexpected external process"))
        blocker.start()
        self.addCleanup(blocker.stop)

    def ready(self, latest=None, release=None, content=CONTENT, tag=TAG, sha=SHA, contract=CONTRACT):
        commands = []
        def generate(command):
            commands.append(command)
            self.assertEqual(command[:5], ["npm", "--prefix", "web-configurator", "run", "installer"])
            if content is not None:
                Path(command[-1]).write_bytes(content)
        newest = latest or [copy.deepcopy(RELEASE)] * 2
        with patch.object(releases, "latest", side_effect=newest), patch.object(releases, "release_state", return_value=copy.deepcopy(release or RELEASE)), patch.object(releases, "execute", side_effect=generate), patch.object(releases, "publish") as publish, patch.object(releases, "reserve_tag") as reserve:
            result = deployment.deployment_ready(contract, tag, sha)
        publish.assert_not_called()
        reserve.assert_not_called()
        return result, commands

    def test_matching_publication_and_asset_are_ready_without_remote_mutations(self):
        ready, commands = self.ready()
        self.assertTrue(ready)
        self.assertEqual(len(commands), 1)
        self.assertEqual(commands[0][-2], TAG)

    def test_superseded_commit_skips_without_generating_or_downloading(self):
        ready, commands = self.ready(latest=[{**RELEASE, "tag_name": "0.7.1"}])
        self.assertFalse(ready)
        self.assertEqual(commands, [])

    def test_publication_change_during_verification_skips(self):
        ready, _ = self.ready(latest=[RELEASE, {**RELEASE, "tag_name": "0.7.1"}])
        self.assertFalse(ready)

    def test_draft_bad_notes_and_missing_asset_fail_closed(self):
        for change in ({"draft": True}, {"body": "wrong"}, {"assets": []}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.ready(release={**RELEASE, **change})

    def test_wrong_asset_or_empty_generator_output_fails_closed(self):
        for content in (b"wrong", b"", None):
            with self.subTest(content=content), self.assertRaises(ValueError):
                self.ready(content=content)

    def test_invalid_tags_versions_shas_and_suffixes_fail_before_api(self):
        for tag, sha in (("main", SHA), ("0.8.0", SHA), (TAG, "bad"), (TAG + "+" + OTHER[:12], SHA), ("0.7.0-rc1", SHA)):
            with self.subTest(tag=tag, sha=sha), patch.object(releases, "latest") as latest, self.assertRaises(ValueError):
                deployment.deployment_ready(CONTRACT, tag, sha)
            latest.assert_not_called()

    def test_version_tag_is_used_in_installer_and_notes(self):
        # One plain version tag per release: no commit suffix anywhere.
        ready, commands = self.ready(tag=TAG, latest=[RELEASE, RELEASE], release=RELEASE)
        self.assertTrue(ready)
        self.assertEqual(commands[0][-2], TAG)

    def test_unsafe_name_or_missing_notes_fail_before_api(self):
        for changed in ({"defaults": {"deviceName": "../../secrets"}}, {"releaseNotes": ""}):
            with self.subTest(changed=changed), patch.object(releases, "latest") as latest, self.assertRaises(ValueError):
                deployment.deployment_ready({**CONTRACT, **changed}, TAG, SHA)
            latest.assert_not_called()

    def test_offline_lookup_fails_not_ready_true(self):
        with patch.object(releases, "latest", side_effect=RuntimeError("Offline")), self.assertRaises(RuntimeError):
            deployment.deployment_ready(CONTRACT, TAG, SHA)

    def cli(self, ready, requested=SHA, checkout=SHA):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            contract_file = root / "web-configurator/src/firmware.generated.json"
            contract_file.parent.mkdir(parents=True)
            contract_file.write_text(json.dumps(CONTRACT))
            output = root / "output.txt"
            with patch.object(deployment, "ROOT", root), patch.dict(os.environ, {"GITHUB_OUTPUT": str(output)}, clear=True), patch.object(releases, "publishing_sha", return_value=checkout), patch.object(deployment, "deployment_ready", return_value=ready) as gate, redirect_stdout(io.StringIO()):
                deployment.main(["--tag", TAG, "--commit", requested])
            return output.read_text(), gate.call_count

    def test_cli_writes_only_a_boolean_output(self):
        for ready in (True, False):
            output, count = self.cli(ready)
            self.assertEqual(output, f"ready={'true' if ready else 'false'}\n")
            self.assertEqual(count, 1)

    def test_cli_rejects_different_checkout_before_readiness_lookup(self):
        with self.assertRaises(ValueError):
            self.cli(True, checkout=OTHER)


class ReleaseWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = yaml.safe_load((ROOT / ".github/workflows/validate-code.yml").read_text())
        cls.jobs = cls.workflow["jobs"]
        cls.contract = json.loads((ROOT / "web-configurator/src/firmware.generated.json").read_text())

    def test_only_one_workflow_can_publish_or_deploy(self):
        self.assertFalse((ROOT / ".github/workflows/create-release.yml").exists())
        self.assertFalse((ROOT / ".github/workflows/deploy-configurator.yml").exists())
        self.assertEqual(set(self.jobs), {"checks", "publish", "site", "deploy"})

    def test_all_privileged_jobs_require_the_canonical_main_push(self):
        for name in ("publish", "site", "deploy"):
            guard = self.jobs[name]["if"]
            with self.subTest(job=name):
                self.assertIn("github.event_name == 'push'", guard)
                self.assertIn("github.ref == 'refs/heads/main'", guard)
                self.assertIn("github.repository == '" + self.contract["repository"] + "'", guard)
                self.assertNotIn("always()", guard)
                self.assertNotIn("failure()", guard)

    def test_dependency_chain_cannot_deploy_before_publishing_and_validation(self):
        self.assertEqual(self.jobs["publish"]["needs"], "checks")
        self.assertEqual(self.jobs["site"]["needs"], ["checks", "publish"])
        self.assertEqual(self.jobs["deploy"]["needs"], ["publish", "site"])
        for name in ("site", "deploy"):
            self.assertIn("needs.publish.outputs.commit == github.sha", self.jobs[name]["if"])

    def test_permissions_are_scoped_to_each_job(self):
        self.assertEqual(self.workflow["permissions"], {"contents": "read"})
        self.assertNotIn("permissions", self.jobs["checks"])
        self.assertEqual(self.jobs["publish"]["permissions"], {"contents": "write"})
        self.assertEqual(self.jobs["site"]["permissions"], {"contents": "read", "pages": "read"})
        self.assertEqual(self.jobs["deploy"]["permissions"], {"contents": "read", "pages": "write", "id-token": "write"})
        self.assertNotIn("environment", self.jobs["publish"])
        self.assertEqual(self.jobs["deploy"]["environment"]["name"], "github-pages")

    def test_all_actions_and_checkouts_are_immutable_without_persisted_tokens(self):
        for name, job in self.jobs.items():
            for step in job["steps"]:
                if "uses" in step:
                    self.assertRegex(step["uses"], r"^actions/[\w-]+@[a-f0-9]{40}$")
                if step.get("uses", "").startswith("actions/checkout@"):
                    self.assertIs(step["with"]["persist-credentials"], False)
                    if name != "checks":
                        expected = "${{ github.sha }}" if name == "publish" else "${{ needs.publish.outputs.commit }}"
                        self.assertEqual(step["with"]["ref"], expected)

    def test_built_in_token_is_step_scoped_and_pr_checks_get_none(self):
        for name, job in self.jobs.items():
            self.assertNotIn("env", job)
            for step in job["steps"]:
                if "GH_TOKEN" in step.get("env", {}):
                    self.assertNotEqual(name, "checks")
                    self.assertEqual(step["env"]["GH_TOKEN"], "${{ github.token }}")
        text = (ROOT / ".github/workflows/validate-code.yml").read_text()
        self.assertNotIn("secrets.", text)

    def test_no_job_invokes_firmware_cli_or_silently_regenerates(self):
        for job in self.jobs.values():
            for step in job["steps"]:
                command = step.get("run", "")
                self.assertNotRegex(command, r"\b(?:esphome|platformio|pio)\s+(?:config|compile|run)")
                self.assertNotIn("scripts/validate.py", command)
                self.assertNotIn("generate_firmware_contract.py", command)
                self.assertNotIn("generate_glyphs.py", command)

    def test_site_embeds_the_verified_publishing_sha(self):
        build = next(step for step in self.jobs["site"]["steps"] if step.get("run") == "npm --prefix web-configurator run build")
        self.assertEqual(build["env"], {"VITE_RELEASE_COMMIT": "${{ needs.publish.outputs.commit }}"})
        self.assertEqual(build["if"], "steps.verify.outputs.ready == 'true'")

    def test_superseded_publication_cannot_upload_or_deploy(self):
        for name in ("site", "deploy"):
            steps = self.jobs[name]["steps"]
            verify = next(step for step in steps if step.get("id") == "verify")
            self.assertIn("scripts/verify_deployment.py", verify["run"])
            self.assertEqual(verify["env"]["RELEASE_TAG"], "${{ needs.publish.outputs.tag }}")
            self.assertEqual(verify["env"]["RELEASE_COMMIT"], "${{ needs.publish.outputs.commit }}")
            for step in steps:
                if "pages@" in step.get("uses", "") or "pages-artifact@" in step.get("uses", ""):
                    self.assertEqual(step["if"], "steps.verify.outputs.ready == 'true'")
        self.assertIn("needs.site.outputs.ready == 'true'", self.jobs["deploy"]["if"])

    def test_unique_artifact_and_pages_lock_protect_retries(self):
        deploy = self.jobs["deploy"]
        self.assertEqual(deploy["concurrency"], {"group": "pages", "cancel-in-progress": False})
        upload = next(step for step in self.jobs["site"]["steps"] if step.get("uses", "").startswith("actions/upload-pages-artifact@"))
        action = next(step for step in deploy["steps"] if step.get("uses", "").startswith("actions/deploy-pages@"))
        self.assertEqual(upload["with"]["name"], action["with"]["artifact_name"])
        self.assertIn("github.run_id", upload["with"]["name"])
        self.assertIn("github.run_attempt", upload["with"]["name"])
        configure = next(step for step in self.jobs["site"]["steps"] if step.get("uses", "").startswith("actions/configure-pages@"))
        self.assertIs(configure["with"]["enablement"], False)

    def test_publisher_outputs_are_propagated_instead_of_copying_a_version_tag(self):
        outputs = self.jobs["publish"]["outputs"]
        self.assertEqual(outputs, {"tag": "${{ steps.release.outputs.tag }}", "commit": "${{ steps.release.outputs.commit }}"})
        runs = [step.get("run", "") for step in self.jobs["publish"]["steps"]]
        self.assertIn("python scripts/publish_release.py", runs)
        self.assertTrue(all("gh release create" not in run and "git tag" not in run for run in runs))


if __name__ == "__main__":
    unittest.main(verbosity=2)
