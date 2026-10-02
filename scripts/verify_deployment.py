#!/usr/bin/env python3
"""Read-only Pages gate: verify the newest published tag, commit, notes and asset.

Generate only installer YAML (not firmware) and compare it with the published
asset. A superseded commit returns ready=false; malformed/offline/mismatched
responses fail closed. Run again inside the Pages concurrency lock immediately
before deploying. Never publishes, uploads or invokes ESPHome/PlatformIO.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from pathlib import Path

import publish_release as releases

ROOT = Path(__file__).resolve().parent.parent


def deployment_ready(contract, tag, sha):
    base = contract["releaseVersion"]
    if not isinstance(tag, str) or not releases.TAG_PATTERN.fullmatch(tag):
        raise ValueError("Invalid deployment tag")
    releases.choose_tag(base, sha, {})
    if tag != base:
        raise ValueError("Deployment tag and firmware version differ")
    name = contract["defaults"]["deviceName"]
    if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,30}", name):
        raise ValueError("Unsafe installer asset name")
    notes = contract["releaseNotes"]
    if not isinstance(notes, str) or not notes.strip():
        raise ValueError("Missing release notes")
    repo = contract["repository"]
    newest = releases.latest(repo)
    if newest["tag_name"] != tag:
        return False
    release = releases.release_state(repo, tag, sha)
    if release["draft"]:
        raise ValueError("Cannot deploy a draft release")
    body = f"## {tag}\n\n{notes.strip()}\n"
    with tempfile.TemporaryDirectory(prefix="clock-pages-verify-") as directory:
        temp = Path(directory)
        installer = temp / (name + ".yaml")
        releases.execute(["npm", "--prefix", "web-configurator", "run", "installer", "--", tag, str(installer)])
        if not installer.is_file() or not installer.stat().st_size:
            raise ValueError("Installer generation produced no verification asset")
        releases.verify_content(repo, tag, release, body, installer, temp)
    # Do not deploy if publication changed while generation/download ran.
    return releases.latest(repo)["tag_name"] == tag


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args(argv)
    contract = json.loads((ROOT / "web-configurator/src/firmware.generated.json").read_text(encoding="utf8"))
    # Reuse main-push/clean-checkout provenance checks, but all remote operations
    # below are GET/download only and use the job's read-only contents token.
    sha = releases.publishing_sha(contract["repository"], os.environ)
    if args.commit != sha:
        raise ValueError("Pages checkout is not the validated publishing commit")
    ready = deployment_ready(contract, args.tag, sha)
    print("Verified matching published release" if ready else "Skip: publication superseded this Pages build")
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf8") as file:
            file.write(f"ready={'true' if ready else 'false'}\n")


if __name__ == "__main__":
    main()
