#!/usr/bin/env python3
"""Release safety tests. All git/gh/npm calls are mocked; no firmware build."""
from __future__ import annotations

import copy
import hashlib
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import publish_release as publisher

REPO = "owner/clock"
SHA = "a" * 40
OTHER = "b" * 40
TAG = "0.7.0"
CONTENT = b"substitutions:\n  wifi_ssid: !secret wifi_ssid\n"
CONTRACT = {"repository": REPO, "releaseVersion": TAG, "releaseNotes": "Candidate notes.",
            "defaults": {"deviceName": "max7219-clock"}}
BODY = f"## {TAG}\n\nCandidate notes.\n"


def release(tag=TAG, published="2026-10-02T00:00:00Z", **extra):
    value = {"id": 1, "tag_name": tag, "draft": False, "prerelease": False,
             "published_at": published, "body": BODY, "assets": []}
    value.update(extra)
    return value


def asset(content=CONTENT, **extra):
    value = {"name": "max7219-clock.yaml", "size": len(content),
             "digest": "sha256:" + hashlib.sha256(content).hexdigest()}
    value.update(extra)
    return value


def command_error(status):
    return publisher.CommandError(["gh", "api"], SimpleNamespace(returncode=1, stderr=f"HTTP {status}"))


class OfflineTest(unittest.TestCase):
    def setUp(self):
        # Accidental real subprocess/network/publication calls fail the tests.
        blocker = patch.object(publisher.subprocess, "run", side_effect=AssertionError("Unexpected external command"))
        blocker.start()
        self.addCleanup(blocker.stop)


class TagTests(OfflineTest):
    def test_first_commit_uses_base_and_retry_uses_same_tag(self):
        self.assertEqual(publisher.choose_tag(TAG, SHA, {}), TAG)
        self.assertEqual(publisher.choose_tag(TAG, SHA, {TAG: SHA}), TAG)

    def test_same_version_from_another_commit_is_refused_not_renamed(self):
        # One version, one tag, one commit: the fix is a project_ref bump, never
        # a longer tag name and never moving the existing tag.
        for refs in ({TAG: OTHER}, {TAG: OTHER, TAG + "+" + SHA[:12]: SHA}):
            with self.subTest(refs=refs), self.assertRaisesRegex(ValueError, "another commit"):
                publisher.choose_tag(TAG, SHA, refs)

    def test_invalid_versions_and_shas_fail(self):
        for version in (None, "main", "v0.7.0", "0.7.0-rc1", "00.7.0", "0.7.0+abcd", "0.7.0+abcdef012345", "0.7.0\n"):
            with self.subTest(version=version), self.assertRaises(ValueError):
                publisher.choose_tag(version, SHA, {})
        for sha in (None, "", "a" * 39, "A" * 40, SHA + "\n"):
            with self.subTest(sha=sha), self.assertRaises(ValueError):
                publisher.choose_tag(TAG, sha, {})

    def test_lightweight_and_missing_tag(self):
        with patch.object(publisher, "api", return_value={"object": {"type": "commit", "sha": SHA}}):
            self.assertEqual(publisher.tag_commit(REPO, TAG), SHA)
        with patch.object(publisher, "api", return_value=None):
            self.assertIsNone(publisher.tag_commit(REPO, TAG))

    def test_annotated_tags_are_dereferenced_and_encoded(self):
        with patch.object(publisher, "api", side_effect=[{"object": {"type": "tag", "sha": OTHER}},
                                                      {"object": {"type": "commit", "sha": SHA}}]) as api:
            self.assertEqual(publisher.tag_commit(REPO, TAG), SHA)
            self.assertEqual(api.call_args_list[0].args[1], "git/ref/tags/" + TAG)
            self.assertEqual(api.call_args_list[1].args[1], "git/tags/" + OTHER)

    def test_malformed_noncommit_and_cyclic_tags_fail(self):
        for obj in (None, {}, {"type": "tree", "sha": SHA}, {"type": "tag", "sha": "../bad"}):
            with self.subTest(obj=obj), patch.object(publisher, "api", return_value={"object": obj}), self.assertRaises(ValueError):
                publisher.tag_commit(REPO, TAG)
        with patch.object(publisher, "api", return_value={"object": {"type": "tag", "sha": SHA}}), self.assertRaisesRegex(ValueError, "limit"):
            publisher.tag_commit(REPO, TAG)

    def test_tag_depth_is_bounded(self):
        objects = [{"object": {"type": "tag", "sha": str(index) * 40}} for index in range(1, 6)]
        with patch.object(publisher, "api", side_effect=objects) as api, self.assertRaises(ValueError):
            publisher.tag_commit(REPO, TAG)
        self.assertEqual(api.call_count, 5)

    def test_atomic_reservation_is_verified(self):
        with patch.object(publisher, "tag_commit", side_effect=[None, SHA]), patch.object(publisher, "api") as api:
            self.assertEqual(publisher.reserve_tag(REPO, TAG, SHA), TAG)
        self.assertEqual(api.call_args.args[1], "git/refs")
        self.assertIn("POST", api.call_args.args)
        self.assertIn("ref=refs/tags/" + TAG, api.call_args.args)

    def test_reservation_race_re_reads_the_winner(self):
        with patch.object(publisher, "tag_commit", side_effect=[None, SHA]), patch.object(publisher, "api", side_effect=command_error(422)) as api:
            self.assertEqual(publisher.reserve_tag(REPO, TAG, SHA), TAG)
        self.assertEqual(api.call_count, 1)
        self.assertTrue(all("POST" in call.args for call in api.call_args_list))

    def test_reservation_race_with_a_different_commit_is_refused(self):
        # A concurrent publisher that used the version for another commit must
        # not be overwritten, and must not silently become this commit's release.
        with patch.object(publisher, "tag_commit", side_effect=[None, OTHER]), patch.object(publisher, "api", side_effect=command_error(422)), self.assertRaisesRegex(ValueError, "another commit"):
            publisher.reserve_tag(REPO, TAG, SHA)

    def test_existing_tag_is_verified_not_recreated(self):
        with patch.object(publisher, "tag_commit", return_value=SHA), patch.object(publisher, "api") as api:
            self.assertEqual(publisher.reserve_tag(REPO, TAG, SHA), TAG)
        api.assert_not_called()

    def test_permission_failure_is_not_a_tag_race(self):
        with patch.object(publisher, "tag_commit", return_value=None), patch.object(publisher, "api", side_effect=command_error(403)) as api, self.assertRaises(publisher.CommandError):
            publisher.reserve_tag(REPO, TAG, SHA)
        self.assertEqual(api.call_count, 1)

    def test_reservation_retry_limit_and_wrong_created_commit_fail(self):
        with patch.object(publisher, "tag_commit", return_value=None), patch.object(publisher, "api", side_effect=command_error(422)) as api, self.assertRaises(RuntimeError):
            publisher.reserve_tag(REPO, TAG, SHA)
        self.assertEqual(api.call_count, 3)
        with patch.object(publisher, "tag_commit", side_effect=[None, OTHER]), patch.object(publisher, "api"), self.assertRaisesRegex(ValueError, "mismatch"):
            publisher.reserve_tag(REPO, TAG, SHA)


class ReleaseSelectionTests(OfflineTest):
    def test_publication_order_not_semver_creation_or_latest_marker(self):
        older = release("9.0.0", "2026-10-01T00:00:00Z", id=9, created_at="2026-10-02T00:00:00Z")
        newer = release("0.7.0", "2026-10-02T00:00:00Z", id=2, created_at="2026-09-29T00:00:00Z")
        self.assertEqual(publisher.newest_published([older, newer]), newer)

    def test_bad_release_records_and_naive_dates_are_ignored(self):
        good = release()
        invalid = [None, "bad", {}, release(draft=True), release(prerelease=True), release(tag="main"),
                   release(published=None), release(published="bad"), release(published="2026-10-02T00:00:00"),
                   release(draft="false"), release(id="1")]
        self.assertEqual(publisher.newest_published(invalid + [good]), good)
        with self.assertRaises(ValueError):
            publisher.newest_published(invalid)

    def test_timezone_normalization_and_id_tie_break(self):
        a = release(published="2026-10-02T04:00:00+04:00", id=1)
        b = release(published="2026-10-02T00:00:00Z", id=2)
        self.assertEqual(publisher.newest_published([a, b]), b)

    def test_pagination_includes_later_pages(self):
        older = release(published="2026-10-01T00:00:00Z")
        newer = release(id=2)
        with patch.object(publisher, "api", side_effect=[[older] * 100, [newer]]) as api:
            self.assertEqual(publisher.latest(REPO), newer)
        self.assertEqual(api.call_args.args[1], "releases?per_page=100&page=2")

    def test_truncated_history_and_malformed_pages_fail_closed(self):
        with patch.object(publisher, "api", return_value=[release()] * 100) as api, self.assertRaisesRegex(ValueError, "limit"):
            publisher.latest(REPO)
        self.assertEqual(api.call_count, 10)
        for data in ({}, None, [release()] * 101):
            with self.subTest(data=type(data)), patch.object(publisher, "api", return_value=data), self.assertRaises(ValueError):
                publisher.latest(REPO)


class AssetTests(OfflineTest):
    def setUp(self):
        super().setUp()
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.path = self.directory / "max7219-clock.yaml"
        self.path.write_bytes(CONTENT)

    def test_digest_size_name_and_content_checks(self):
        self.assertTrue(publisher.asset_matches(REPO, TAG, asset(), self.path, self.directory))
        for bad in (asset(name="../other.yaml"), asset(size=999), asset(digest="sha256:wrong"), asset(b"wrong")):
            with self.subTest(bad=bad):
                self.assertFalse(publisher.asset_matches(REPO, TAG, bad, self.path, self.directory))

    def test_no_digest_download_can_be_verified_repeatedly(self):
        downloads = []
        def download(args):
            directory = Path(args[args.index("--dir") + 1])
            downloads.append(directory)
            (directory / self.path.name).write_bytes(CONTENT)
        with patch.object(publisher, "execute", side_effect=download):
            for _ in range(2):
                self.assertTrue(publisher.asset_matches(REPO, TAG, asset(digest=None), self.path, self.directory))
        self.assertNotEqual(downloads[0], downloads[1])
        self.assertTrue(all(not directory.exists() for directory in downloads))

    def test_missing_or_wrong_download_is_not_accepted(self):
        with patch.object(publisher, "execute"):
            self.assertFalse(publisher.asset_matches(REPO, TAG, asset(digest=None), self.path, self.directory))
        def wrong(args):
            (Path(args[-1]) / self.path.name).write_bytes(b"wrong")
        with patch.object(publisher, "execute", side_effect=wrong):
            self.assertFalse(publisher.asset_matches(REPO, TAG, asset(digest=None), self.path, self.directory))

    def test_duplicate_named_assets_fail(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            publisher.matching_asset(release(assets=[asset(), asset()]), self.path)


class FakeGitHub:
    """In-memory release transport; no real GitHub or Node process."""

    def __init__(self, existing=None):
        self.value = copy.deepcopy(existing)
        self.commands = []
        self.post_publish_corruption = False
        self.empty_installer = False
        self.create_conflict = False
        self.upload_conflict = False

    def api(self, repo, endpoint, *args, **kwargs):
        if endpoint.startswith("releases/tags/"):
            return copy.deepcopy(self.value)
        if endpoint.startswith("releases?"):
            return [] if self.value is None else [copy.deepcopy(self.value)]
        raise AssertionError("Unexpected API operation: " + endpoint)

    def execute(self, args, **kwargs):
        self.commands.append(args)
        if args[0] == "npm":
            if not self.empty_installer:
                Path(args[-1]).write_bytes(CONTENT)
            return ""
        self.assert_gh(args)
        operation = args[2]
        if operation == "create":
            body = Path(args[args.index("--notes-file") + 1]).read_text()
            self.value = release(draft=True, body=body, assets=[asset()])
            if self.create_conflict:
                raise command_error(422)
        elif operation == "upload":
            if "--clobber" in args:
                raise AssertionError("Destructive installer replacement")
            self.value["assets"] = [asset()]
            if self.upload_conflict:
                raise command_error(422)
        elif operation == "edit":
            if "--draft=false" not in args or "--latest=false" not in args:
                raise AssertionError("Unexpected metadata/latest mutation")
            self.value["draft"] = False
            if self.post_publish_corruption:
                self.value["assets"] = [asset(b"wrong")]
        else:
            raise AssertionError("Unexpected GitHub mutation")
        return ""

    @staticmethod
    def assert_gh(args):
        if args[:2] != ["gh", "release"]:
            raise AssertionError("Unexpected external command")


class PublicationTests(OfflineTest):
    def run_publish(self, service, contract=CONTRACT):
        with patch.object(publisher, "reserve_tag", return_value=TAG), patch.object(publisher, "tag_commit", return_value=SHA), patch.object(publisher, "api", side_effect=service.api), patch.object(publisher, "execute", side_effect=service.execute):
            return publisher.publish(REPO, contract, SHA)

    def test_new_release_uploads_as_draft_then_verifies_publication(self):
        service = FakeGitHub()
        self.assertEqual(self.run_publish(service), TAG)
        self.assertFalse(service.value["draft"])
        operations = [args[2] for args in service.commands if args[0] == "gh"]
        self.assertEqual(operations, ["create", "edit"])
        create = next(args for args in service.commands if args[:3] == ["gh", "release", "create"])
        self.assertIn("--draft", create)
        self.assertIn("--verify-tag", create)
        self.assertEqual(service.value["body"], BODY)

    def test_same_commit_published_retry_is_read_only(self):
        for locked in (True, False):
            service = FakeGitHub(release(assets=[asset()], immutable=locked))
            self.assertEqual(self.run_publish(service), TAG)
            self.assertEqual([args[0] for args in service.commands], ["npm"])

    def test_published_notes_or_asset_mismatch_never_mutates_even_without_lock(self):
        for bad in (release(body="wrong", assets=[asset()]), release(assets=[]), release(assets=[asset(b"wrong")])):
            service = FakeGitHub(bad)
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                self.run_publish(service)
            self.assertEqual([args[0] for args in service.commands], ["npm"])

    def test_partial_draft_resumes_upload_without_clobber(self):
        for conflict in (False, True):
            service = FakeGitHub(release(draft=True))
            service.upload_conflict = conflict
            self.assertEqual(self.run_publish(service), TAG)
            self.assertFalse(service.value["draft"])
            upload = next(args for args in service.commands if args[:3] == ["gh", "release", "upload"])
            self.assertNotIn("--clobber", upload)

    def test_existing_wrong_draft_is_not_destructively_repaired(self):
        for bad in (release(draft=True, body="wrong"), release(draft=True, assets=[asset(b"wrong")])):
            service = FakeGitHub(bad)
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                self.run_publish(service)
            self.assertEqual([args[0] for args in service.commands], ["npm"])

    def test_concurrent_create_is_re_read_and_verified(self):
        service = FakeGitHub()
        service.create_conflict = True
        self.assertEqual(self.run_publish(service), TAG)

    def test_post_publication_assets_are_verified(self):
        service = FakeGitHub()
        service.post_publish_corruption = True
        with self.assertRaisesRegex(ValueError, "asset"):
            self.run_publish(service)

    def test_missing_generated_asset_aborts_before_release_creation(self):
        service = FakeGitHub()
        service.empty_installer = True
        with self.assertRaisesRegex(ValueError, "no asset"):
            self.run_publish(service)
        self.assertEqual([args[0] for args in service.commands], ["npm"])

    def test_unsafe_metadata_fails_before_tag_reservation(self):
        for changes in ({"releaseNotes": ""}, {"defaults": {"deviceName": "../secret"}}, {"releaseVersion": "main"}):
            contract = {**CONTRACT, **changes}
            with self.subTest(changes=changes), patch.object(publisher, "reserve_tag") as reserve, self.assertRaises(ValueError):
                publisher.publish(REPO, contract, SHA)
            reserve.assert_not_called()

    def test_wrong_tag_and_prerelease_fail_before_mutation(self):
        with patch.object(publisher, "tag_commit", return_value=OTHER), patch.object(publisher, "api") as api, self.assertRaises(ValueError):
            publisher.release_state(REPO, TAG, SHA)
        api.assert_not_called()
        for bad in (release(tag="0.8.0"), release(prerelease=True), release(draft="false"), release(assets=None)):
            with self.subTest(bad=bad), patch.object(publisher, "tag_commit", return_value=SHA), patch.object(publisher, "api", return_value=bad), self.assertRaises(ValueError):
                publisher.release_state(REPO, TAG, SHA)

    def test_draft_hidden_by_tag_lookup_is_found_in_authenticated_list(self):
        draft = release(draft=True)
        with patch.object(publisher, "tag_commit", return_value=SHA), patch.object(publisher, "api", side_effect=[None, [draft]]):
            self.assertEqual(publisher.release_state(REPO, TAG, SHA), draft)

    def test_unusable_draft_tag_lookup_falls_back_to_authenticated_list(self):
        draft = release(draft=True)
        hidden = {"tag_name": "untagged-draft", "draft": True, "prerelease": False, "assets": []}
        with patch.object(publisher, "tag_commit", return_value=SHA), patch.object(publisher, "api", side_effect=[hidden, [draft]]):
            self.assertEqual(publisher.release_state(REPO, TAG, SHA), draft)


class ProvenanceTests(OfflineTest):
    def setUp(self):
        super().setUp()
        self.env = {"GITHUB_ACTIONS": "true", "GITHUB_EVENT_NAME": "push", "GITHUB_REF": "refs/heads/main",
                    "GITHUB_REPOSITORY": REPO, "GITHUB_SHA": SHA}

    def test_main_push_clean_checkout_is_required(self):
        with patch.object(publisher, "execute", side_effect=[SHA + "\n", ""]):
            self.assertEqual(publisher.publishing_sha(REPO, self.env), SHA)

    def test_pull_request_fork_other_branch_and_local_invocation_are_rejected(self):
        for changes in ({"GITHUB_EVENT_NAME": "pull_request"}, {"GITHUB_EVENT_NAME": "pull_request_target"},
                        {"GITHUB_REF": "refs/heads/feature"}, {"GITHUB_REPOSITORY": "fork/clock"},
                        {"GITHUB_ACTIONS": "false"}, {"GITHUB_SHA": "bad"}):
            with self.subTest(changes=changes), patch.object(publisher, "execute") as execute, self.assertRaises(ValueError):
                publisher.publishing_sha(REPO, {**self.env, **changes})
            execute.assert_not_called()

    def test_wrong_or_dirty_checkout_is_rejected(self):
        for responses in ([OTHER], [SHA, " M packages/base.yaml"]):
            with self.subTest(responses=responses), patch.object(publisher, "execute", side_effect=responses), self.assertRaises(ValueError):
                publisher.publishing_sha(REPO, self.env)

    def test_command_errors_do_not_echo_sensitive_stderr(self):
        result = SimpleNamespace(returncode=1, stderr="HTTP 403: sensitive stderr omitted", stdout="")
        with patch.object(publisher.subprocess, "run", return_value=result), self.assertRaises(publisher.CommandError) as caught:
            publisher.execute(["gh", "api", "repos/owner/clock"])
        self.assertEqual(caught.exception.http_status, 403)
        self.assertNotIn("sensitive", str(caught.exception))

    def test_only_404_is_treated_as_missing(self):
        for status in (404, 403, 500):
            result = SimpleNamespace(returncode=1, stderr=f"HTTP {status}", stdout="")
            with self.subTest(status=status), patch.object(publisher.subprocess, "run", return_value=result):
                if status == 404:
                    self.assertIsNone(publisher.execute(["gh", "api"], allow_missing=True))
                else:
                    with self.assertRaises(publisher.CommandError):
                        publisher.execute(["gh", "api"], allow_missing=True)

    def test_invalid_repository_fails_before_command(self):
        for repo in ("../wrong", "owner/..", "owner/repo/extra", "/owner/repo", "bad owner/repo"):
            with self.subTest(repo=repo), patch.object(publisher, "execute") as execute, self.assertRaises(ValueError):
                publisher.api(repo, "releases")
            execute.assert_not_called()

    def test_latest_cli_is_read_only_and_outputs_verified_commit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / "web-configurator/src/firmware.generated.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(json.dumps(CONTRACT))
            output = root / "output.txt"
            with patch.object(publisher, "ROOT", root), patch.dict(publisher.os.environ, {"GITHUB_OUTPUT": str(output)}, clear=True), patch.object(publisher, "latest", return_value=release()), patch.object(publisher, "tag_commit", return_value=SHA), patch.object(publisher, "publish") as publish, redirect_stdout(io.StringIO()):
                publisher.main(["--latest"])
            publish.assert_not_called()
            self.assertEqual(output.read_text(), f"tag={TAG}\ncommit={SHA}\n")

    def test_latest_cli_rejects_a_tag_without_a_commit(self):
        with patch.object(publisher, "latest", return_value=release()), patch.object(publisher, "tag_commit", return_value=None), self.assertRaises(ValueError):
            publisher.main(["--latest"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
