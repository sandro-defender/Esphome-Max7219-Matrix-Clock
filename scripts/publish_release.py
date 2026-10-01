#!/usr/bin/env python3
"""Idempotent main-push publishing. Never move or replace an existing tag.

The canonical semantic version is from base.yaml's generated contract. Its
first main commit receives that tag; subsequent main commits receive
VERSION+12hexSHA, keeping every push versioned even without a manual bump.
A draft receives the credential-free installer before publication (compatible
with GitHub immutable-release locking). Reruns verify the same commit/assets.
Only Actions' built-in repository permissions are needed, never a user PAT.
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
TAG_PATTERN = re.compile(r"\d+\.\d+\.\d+(?:\+[a-f0-9]{12})?\Z")
SHA_PATTERN = re.compile(r"[a-f0-9]{40}\Z")


def choose_tag(base, sha, refs):
    if not re.fullmatch(r"\d+\.\d+\.\d+", base) or not SHA_PATTERN.fullmatch(sha):
        raise ValueError("Invalid canonical version/commit")
    candidate = base if base not in refs or refs[base] == sha else base + "+" + sha[:12]
    if candidate in refs and refs[candidate] != sha:
        raise ValueError("Immutable tag collision: refusing to move " + candidate)
    return candidate


def newest_published(releases):
    eligible = []
    for release in releases:
        if release.get("draft") or release.get("prerelease") or not TAG_PATTERN.fullmatch(release.get("tag_name", "")):
            continue
        try:
            published = dt.datetime.fromisoformat(release["published_at"].replace("Z", "+00:00"))
        except (ValueError, TypeError, KeyError):
            continue
        eligible.append((published, release.get("id", 0), release))
    if not eligible:
        raise ValueError("No published immutable versioned release")
    return max(eligible, key=lambda item: item[:2])[2]


def execute(args, allow_missing=False):
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        if allow_missing and ("HTTP 404" in result.stderr or "release not found" in result.stderr.lower()):
            return None
        raise RuntimeError("Command failed: " + " ".join(args) + "\n" + result.stderr)
    return result.stdout


def api(repo, endpoint, *args, allow_missing=False):
    value = execute(["gh", "api", "repos/" + repo + "/" + endpoint, *args], allow_missing=allow_missing)
    return json.loads(value) if value is not None else None


def tag_commit(repo, tag):
    ref = api(repo, "git/ref/tags/" + quote(tag, safe=""), allow_missing=True)
    if ref is None:
        return None
    obj = ref["object"]
    for _ in range(4):
        if obj["type"] != "tag":
            break
        obj = api(repo, "git/tags/" + obj["sha"])["object"]
    if obj["type"] != "commit" or not SHA_PATTERN.fullmatch(obj["sha"]):
        raise ValueError("Tag must resolve to a commit")
    return obj["sha"]


def reserve_tag(repo, base, sha):
    # Concurrent main builds cannot steal or move the semantic tag. An atomic
    # create-ref conflict is re-read and gets a commit suffix if appropriate.
    for _ in range(3):
        current = tag_commit(repo, base)
        refs = {} if current is None else {base: current}
        candidate = choose_tag(base, sha, refs)
        target = tag_commit(repo, candidate)
        if target:
            if target != sha:
                raise ValueError("Refusing to move existing immutable tag")
            return candidate
        result = subprocess.run(["gh", "api", "repos/" + repo + "/git/refs", "--method", "POST",
                                 "-f", "ref=refs/tags/" + candidate, "-f", "sha=" + sha], cwd=ROOT, text=True, capture_output=True)
        if result.returncode == 0:
            if tag_commit(repo, candidate) != sha:
                raise ValueError("Created tag commit mismatch")
            return candidate
        if "HTTP 422" not in result.stderr:
            raise RuntimeError("Tag publication failed: " + result.stderr)
    raise RuntimeError("Could not reserve an immutable tag after concurrent updates")


def latest(repo):
    rows = []
    for page in range(1, 11):
        entries = api(repo, f"releases?per_page=100&page={page}")
        rows.extend(entries)
        if len(entries) < 100:
            return newest_published(rows)
    raise ValueError("Release history exceeds the verification limit")


def asset_matches(repo, tag, asset, path, temp):
    if asset.get("digest"):
        return asset["digest"] == "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()
    download = temp / "download"
    download.mkdir()
    execute(["gh", "release", "download", tag, "--repo", repo, "--pattern", path.name, "--dir", str(download)])
    return (download / path.name).read_bytes() == path.read_bytes()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--latest", action="store_true", help="Resolve newest published tag/commit for Pages")
    args = parser.parse_args()
    contract = json.loads((ROOT / "web-configurator/src/firmware.generated.json").read_text())
    repo = contract["repository"]
    if args.latest:
        release = latest(repo)
        tag = release["tag_name"]
        sha = tag_commit(repo, tag)
        if not sha:
            raise ValueError("Published release has no immutable tag")
    else:
        if os.environ.get("GITHUB_REF") != "refs/heads/main" or os.environ.get("GITHUB_REPOSITORY") != repo:
            raise SystemExit("Publishing is allowed only for this repository's main workflow")
        sha = os.environ.get("GITHUB_SHA", "")
        if execute(["git", "rev-parse", "HEAD"]).strip() != sha:
            raise ValueError("Publishing checkout is not the triggering main commit")
        tag = reserve_tag(repo, contract["releaseVersion"], sha)
        body = f"## {tag}\n\n{contract['releaseNotes']}\n"
        with tempfile.TemporaryDirectory(prefix="clock-release-") as directory:
            temp = Path(directory)
            installer = temp / (contract["defaults"]["deviceName"] + ".yaml")
            execute(["npm", "--prefix", "web-configurator", "run", "installer", "--", tag, str(installer)])
            notes = temp / "notes.md"
            notes.write_text(body)
            release = api(repo, "releases/tags/" + quote(tag, safe=""), allow_missing=True)
            if release is None:
                execute(["gh", "release", "create", tag, str(installer), "--repo", repo, "--verify-tag", "--draft", "--title", tag, "--notes-file", str(notes)])
                release = api(repo, "releases/tags/" + quote(tag, safe=""))
            else:
                if release["body"].strip() != body.strip():
                    execute(["gh", "release", "edit", tag, "--repo", repo, "--title", tag, "--notes-file", str(notes)])
                asset = next((asset for asset in release["assets"] if asset["name"] == installer.name), None)
                if not asset or not asset_matches(repo, tag, asset, installer, temp):
                    if release.get("immutable") and not release["draft"]:
                        raise ValueError("Immutable release has an incorrect installer asset; refusing to replace it")
                    execute(["gh", "release", "upload", tag, str(installer), "--repo", repo, "--clobber"])
            if release["draft"]:
                execute(["gh", "release", "edit", tag, "--repo", repo, "--draft=false", "--latest"])
            # Rerunning an old main commit must not change the 'latest' marker.
            published = api(repo, "releases/tags/" + quote(tag, safe=""))
            if published["draft"] or published["prerelease"] or published["body"].strip() != body.strip() or tag_commit(repo, tag) != sha:
                raise ValueError("Published release verification failed")
    print(f"Firmware release: {tag}; immutable commit: {sha}")
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a") as file:
            file.write(f"tag={tag}\ncommit={sha}\n")


if __name__ == "__main__":
    main()
