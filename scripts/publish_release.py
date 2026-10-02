#!/usr/bin/env python3
"""Publish a credential-free installer from this repository's main push only.

Reserve VERSION (or VERSION+12hexSHA) atomically. Never move a tag or edit any
published release, even if GitHub's optional immutable-release lock is off.
Draft assets/notes are verified before publication and again afterwards. Tests
mock all git/gh/npm calls; this module never invokes the ESPHome CLI.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
VERSION = r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)"
TAG_PATTERN = re.compile(VERSION + r"\Z")
SHA_PATTERN = re.compile(r"[a-f0-9]{40}\Z")
REPO_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*/[A-Za-z0-9_.-]+\Z")
MAX_RELEASE_PAGES = 10
MAX_TAG_DEPTH = 4


class CommandError(RuntimeError):
    """Report operation/status, not potentially credential-bearing stderr."""

    def __init__(self, args, result):
        match = re.search(r"HTTP (\d{3})", result.stderr or "")
        self.http_status = int(match[1]) if match else None
        operation = " ".join(args[:2])
        super().__init__(f"{operation} failed (exit {result.returncode}, HTTP {self.http_status})")


def execute(args, allow_missing=False):
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        if allow_missing and "HTTP 404" in (result.stderr or ""):
            return None
        raise CommandError(args, result)
    return result.stdout


def api(repo, endpoint, *args, allow_missing=False):
    if not isinstance(repo, str) or not REPO_PATTERN.fullmatch(repo) or repo.split("/")[-1] in (".", ".."):
        raise ValueError("Invalid repository name")
    value = execute(["gh", "api", "repos/" + repo + "/" + endpoint, *args], allow_missing=allow_missing)
    return json.loads(value) if value is not None else None


def choose_tag(base, sha, refs):
    """One version, one tag, one commit: an existing tag is never moved or reused.

    A version already published from a different commit is a release-time error,
    not a reason to invent a longer tag name: the fix is to bump `project_ref` in
    `packages/base.yaml` (with its CHANGELOG section) and merge again.
    """
    if not isinstance(base, str) or not re.fullmatch(VERSION, base) or not isinstance(sha, str) or not SHA_PATTERN.fullmatch(sha):
        raise ValueError("Invalid canonical version/commit")
    if base not in refs or refs[base] == sha:
        return base
    raise ValueError("Version " + base + " is already published from another commit; bump project_ref in packages/base.yaml and add its CHANGELOG section")


def tag_commit(repo, tag):
    if not isinstance(tag, str) or not TAG_PATTERN.fullmatch(tag):
        raise ValueError("Invalid immutable release tag")
    ref = api(repo, "git/ref/tags/" + quote(tag, safe=""), allow_missing=True)
    if ref is None:
        return None
    obj = ref.get("object") if isinstance(ref, dict) else None
    seen = set()
    for depth in range(MAX_TAG_DEPTH + 1):
        if not isinstance(obj, dict) or not isinstance(obj.get("sha"), str) or not SHA_PATTERN.fullmatch(obj["sha"]):
            raise ValueError("Malformed tag object")
        if obj.get("type") == "commit":
            return obj["sha"]
        if obj.get("type") != "tag" or obj["sha"] in seen or depth == MAX_TAG_DEPTH:
            raise ValueError("Tag must resolve to a commit within the verification limit")
        seen.add(obj["sha"])
        annotated = api(repo, "git/tags/" + obj["sha"])
        obj = annotated.get("object") if isinstance(annotated, dict) else None
    raise ValueError("Tag must resolve to a commit")


def reserve_tag(repo, base, sha):
    """Create the version tag once; an existing tag is verified, never moved."""
    for _ in range(3):
        current = tag_commit(repo, base)
        if current is not None:
            if current != sha:
                raise ValueError("Version " + base + " is already published from another commit; bump project_ref in packages/base.yaml and add its CHANGELOG section")
            return base
        try:
            api(repo, "git/refs", "--method", "POST", "-f", "ref=refs/tags/" + base, "-f", "sha=" + sha)
        except CommandError as error:
            if error.http_status != 422:
                raise
            # Another publisher may have reserved the ref. Re-read it; never
            # force-update and never mistake a permission/network failure for a race.
            continue
        if tag_commit(repo, base) != sha:
            raise ValueError("Created tag commit mismatch")
        return base
    raise RuntimeError("Could not reserve the version tag after concurrent updates")


def newest_published(releases):
    eligible = []
    for release in releases:
        if not isinstance(release, dict) or release.get("draft") is not False or release.get("prerelease") is not False:
            continue
        tag = release.get("tag_name")
        if not isinstance(tag, str) or not TAG_PATTERN.fullmatch(tag) or type(release.get("id")) is not int:
            continue
        try:
            published = dt.datetime.fromisoformat(release["published_at"].replace("Z", "+00:00"))
        except (ValueError, TypeError, KeyError, AttributeError):
            continue
        if published.tzinfo is None:
            continue
        eligible.append((published.astimezone(dt.timezone.utc), release["id"], release))
    if not eligible:
        raise ValueError("No published immutable versioned release")
    return max(eligible, key=lambda item: item[:2])[2]


def latest(repo):
    rows = []
    for page in range(1, MAX_RELEASE_PAGES + 1):
        entries = api(repo, f"releases?per_page=100&page={page}")
        if not isinstance(entries, list) or len(entries) > 100:
            raise ValueError("Invalid release history response")
        rows.extend(entries)
        if len(entries) < 100:
            return newest_published(rows)
    raise ValueError("Release history exceeds the verification limit")


def asset_matches(repo, tag, asset, path, temp):
    if asset.get("name") != path.name:
        return False
    content = path.read_bytes()
    if asset.get("size") is not None and asset["size"] != len(content):
        return False
    digest = asset.get("digest")
    if digest is not None:
        return digest == "sha256:" + hashlib.sha256(content).hexdigest()
    # Older GitHub assets have no digest. Each verification gets its own
    # directory, so the pre/post-publication checks cannot reuse stale downloads.
    with tempfile.TemporaryDirectory(prefix="verify-asset-", dir=temp) as directory:
        download = Path(directory)
        execute(["gh", "release", "download", tag, "--repo", repo, "--pattern", path.name, "--dir", str(download)])
        downloaded = download / path.name
        return downloaded.is_file() and downloaded.read_bytes() == content


def listed_release(repo, tag):
    """Find a release in the authenticated list when tag lookup hides a draft."""
    matches = []
    for page in range(1, MAX_RELEASE_PAGES + 1):
        entries = api(repo, f"releases?per_page=100&page={page}")
        if not isinstance(entries, list) or len(entries) > 100:
            raise ValueError("Invalid release history response")
        matches.extend(item for item in entries if isinstance(item, dict) and item.get("tag_name") == tag)
        if len(matches) > 1:
            raise ValueError("Duplicate release tag")
        if len(entries) < 100:
            return matches[0] if matches else None
    raise ValueError("Release history exceeds the verification limit")


def release_state(repo, tag, sha, allow_missing=False):
    if tag_commit(repo, tag) != sha:
        raise ValueError("Release tag commit mismatch")
    # GitHub can return 404 for a just-created draft through its tag endpoint.
    # The authenticated release list still exposes that draft, allowing us to
    # verify it before publication without accepting an expected absence.
    release = api(repo, "releases/tags/" + quote(tag, safe=""), allow_missing=True)
    # Some draft responses are not a usable representation of their tag (for
    # example, GitHub's temporary `untagged-*` draft identity). Treat that the
    # same as the hidden 404 and verify the matching list entry instead.
    if (not isinstance(release, dict) or release.get("tag_name") != tag or
            type(release.get("draft")) is not bool):
        release = listed_release(repo, tag)
    if release is None and allow_missing:
        return None
    if not isinstance(release, dict) or release.get("tag_name") != tag or type(release.get("draft")) is not bool:
        raise ValueError("Malformed release state")
    if release.get("prerelease") is not False or not isinstance(release.get("assets"), list):
        raise ValueError("Refusing prerelease or malformed release assets")
    return release


def matching_asset(release, path):
    assets = [asset for asset in release["assets"] if isinstance(asset, dict) and asset.get("name") == path.name]
    if len(assets) > 1:
        raise ValueError("Duplicate installer asset")
    return assets[0] if assets else None


def verify_content(repo, tag, release, body, installer, temp):
    if not isinstance(release.get("body"), str) or release["body"].strip() != body.strip():
        raise ValueError("Release notes differ from the firmware contract")
    asset = matching_asset(release, installer)
    if asset is None or not asset_matches(repo, tag, asset, installer, temp):
        raise ValueError("Installer asset differs from the verified generator output")


def publish(repo, contract, sha):
    base = contract["releaseVersion"]
    notes = contract["releaseNotes"]
    name = contract["defaults"]["deviceName"]
    # Validate source metadata before reserving any remote ref.
    choose_tag(base, sha, {})
    if not isinstance(notes, str) or not notes.strip():
        raise ValueError("Nonempty firmware release notes are required")
    if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,30}", name):
        raise ValueError("Unsafe installer filename")
    tag = reserve_tag(repo, base, sha)
    # Exact same body as web-configurator/src/firmware.ts::releaseBody.
    body = f"## {tag}\n\n{notes.strip()}\n"
    with tempfile.TemporaryDirectory(prefix="clock-release-") as directory:
        temp = Path(directory)
        installer = temp / (name + ".yaml")
        execute(["npm", "--prefix", "web-configurator", "run", "installer", "--", tag, str(installer)])
        if not installer.is_file() or not installer.stat().st_size:
            raise ValueError("Installer generation produced no asset")
        notes_file = temp / "notes.md"
        notes_file.write_text(body, encoding="utf8")
        release = release_state(repo, tag, sha, allow_missing=True)
        if release is None:
            try:
                execute(["gh", "release", "create", tag, str(installer), "--repo", repo, "--verify-tag", "--draft", "--latest=false", "--title", tag, "--notes-file", str(notes_file)])
            except CommandError as error:
                if error.http_status not in (409, 422):
                    raise
                # Same-commit overlapping retry; re-read and verify the winner.
            release = release_state(repo, tag, sha)
        if release["draft"]:
            if not isinstance(release.get("body"), str) or release["body"].strip() != body.strip():
                raise ValueError("Existing draft notes differ from the firmware contract")
            asset = matching_asset(release, installer)
            if asset is not None and not asset_matches(repo, tag, asset, installer, temp):
                raise ValueError("Existing draft installer differs; refusing destructive replacement")
            if asset is None:
                # Partial draft creation can be resumed. Never clobber an
                # existing name: a concurrent retry wins or fails verification.
                release = release_state(repo, tag, sha)
                if not release["draft"]:
                    verify_content(repo, tag, release, body, installer, temp)
                    return tag
                try:
                    execute(["gh", "release", "upload", tag, str(installer), "--repo", repo])
                except CommandError as error:
                    if error.http_status not in (409, 422):
                        raise
            release = release_state(repo, tag, sha)
            verify_content(repo, tag, release, body, installer, temp)
            if release["draft"]:
                # Publication order, not GitHub's mutable latest marker, is the
                # installer authority. Old retries never mark themselves latest.
                execute(["gh", "release", "edit", tag, "--repo", repo, "--draft=false", "--latest=false"])
        published = release_state(repo, tag, sha)
        if published["draft"]:
            raise ValueError("Release is still a draft after publication")
        verify_content(repo, tag, published, body, installer, temp)
    return tag


def publishing_sha(repo, env):
    if (env.get("GITHUB_ACTIONS") != "true" or env.get("GITHUB_EVENT_NAME") != "push" or
            env.get("GITHUB_REF") != "refs/heads/main" or env.get("GITHUB_REPOSITORY") != repo):
        raise ValueError("Publishing is allowed only for this repository's main push workflow")
    sha = env.get("GITHUB_SHA", "")
    if not SHA_PATTERN.fullmatch(sha):
        raise ValueError("Invalid triggering commit")
    if execute(["git", "rev-parse", "HEAD"]).strip() != sha:
        raise ValueError("Publishing checkout is not the triggering main commit")
    if execute(["git", "status", "--porcelain"]).strip():
        raise ValueError("Publishing checkout contains uncommitted source changes")
    return sha


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--latest", action="store_true", help="Read newest published tag/commit; never publish")
    args = parser.parse_args(argv)
    contract = json.loads((ROOT / "web-configurator/src/firmware.generated.json").read_text(encoding="utf8"))
    repo = contract["repository"]
    if not isinstance(repo, str) or not REPO_PATTERN.fullmatch(repo) or repo.split("/")[-1] in (".", ".."):
        raise ValueError("Invalid repository name")
    if args.latest:
        tag = latest(repo)["tag_name"]
        sha = tag_commit(repo, tag)
        if not sha:
            raise ValueError("Published release has no matching commit tag")
    else:
        sha = publishing_sha(repo, os.environ)
        tag = publish(repo, contract, sha)
    print(f"Firmware release: {tag}; immutable commit: {sha}")
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf8") as file:
            file.write(f"tag={tag}\ncommit={sha}\n")


if __name__ == "__main__":
    main()
