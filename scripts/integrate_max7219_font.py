#!/usr/bin/env python3
"""Integrate a Pixeel MAX7219 export into the firmware catalogue.

Automates the four-snippet manual process described in Pixeel's
INTEGRATION.md: copies the font asset and face package, adds fontMetadata,
the display bridge, the test mapping and the README row, then regenerates
contracts and glyphs.

See docs/PIXEEL_FONTS.md for workflow and contract details.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
ROOT_MARKERS = ("packages/display.yaml", "dev.yaml")
ANCHOR = "max7219_clock::render(canvas, *selected,"


def find_repo(start: Path) -> Path:
    cur = start.resolve()
    for _ in range(12):
        if all((cur / m).is_file() for m in ROOT_MARKERS):
            return cur
        if cur.parent == cur:
            break
        cur = cur.parent
    raise SystemExit(f"Could not locate repo root with {ROOT_MARKERS} from {start}")


def repo_root_from_args(args_repo: str | None) -> Path:
    if args_repo:
        p = Path(args_repo).resolve()
        if not all((p / m).is_file() for m in ROOT_MARKERS):
            raise SystemExit(f"--repo {p} does not contain {ROOT_MARKERS}")
        return p
    return find_repo(Path.cwd())


def validate_zip_paths(zf: zipfile.ZipFile) -> None:
    for info in zf.infolist():
        name = info.filename
        if not name:
            continue
        parts = name.replace("\\", "/").split("/")
        if name.startswith(("/", "\\")) or ".." in parts:
            raise SystemExit(f"Refusing unsafe ZIP path: {name!r}")
        if re.match(r"^[a-zA-Z]:", name):
            raise SystemExit(f"Refusing unsafe ZIP path: {name!r}")


def run_generators(repo: Path, no_generate: bool) -> None:
    if no_generate:
        print("Skipping generators (--no-generate)")
        return
    # Order: generate_firmware_contract.py, generate_glyphs.py, check_code.py
    scripts = [
        [sys.executable, "scripts/generate_firmware_contract.py"],
        [sys.executable, "web-configurator/scripts/generate_glyphs.py"],
        [sys.executable, "scripts/check_code.py"],
    ]
    for cmd in scripts:
        print(f"Running: {' '.join(cmd)}", file=sys.stderr)
        result = subprocess.run(cmd, cwd=repo)
        if result.returncode != 0:
            print(f"WARNING: {' '.join(cmd)} exited {result.returncode} — check output", file=sys.stderr)
            if "generate_firmware_contract" in cmd[1]:
                # This is important; but we continue to next
                pass


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--zip", dest="zip_path", type=Path, required=True, help="Pixeel export ZIP")
    parser.add_argument("--repo", type=str, default=None, help="Repo root (auto-detected)")
    parser.add_argument("--no-generate", action="store_true", help="Skip contract/glyph generation and code checks")
    args = parser.parse_args()

    repo = repo_root_from_args(args.repo)
    zip_path: Path = args.zip_path
    if not zip_path.is_file():
        raise SystemExit(f"ZIP not found: {zip_path}")

    zf = zipfile.ZipFile(zip_path)
    validate_zip_paths(zf)
    names = zf.namelist()

    # Determine slug from fonts/<slug>/...
    ttf_candidates = [n for n in names if n.startswith("fonts/") and n.lower().endswith(".ttf")]
    if len(ttf_candidates) != 1:
        raise SystemExit(f"ZIP must contain exactly one .ttf under fonts/*/, found {ttf_candidates}")
    # Extract slug from first TTF path
    ttf_name = ttf_candidates[0]
    parts = Path(ttf_name).parts
    if len(parts) < 3 or parts[0] != "fonts":
        raise SystemExit(f"Unexpected TTF path: {ttf_name!r}")
    slug = parts[1]
    if not SLUG_RE.fullmatch(slug):
        raise SystemExit(f"Invalid slug {slug!r}")
    print(f"Integrating Pixeel font '{slug}'")

    # 1. Copy fonts/<slug>/  (all files under that prefix)
    font_prefix = f"fonts/{slug}/"
    font_dest = repo / "fonts" / slug
    font_dest.mkdir(parents=True, exist_ok=True)
    copied_fonts = 0
    for name in names:
        if name.startswith(font_prefix) and not name.endswith("/"):
            rel = name[len(font_prefix):]
            # Ensure no subdirectories with .. already validated
            data = zf.read(name)
            dest = (font_dest / rel).resolve()
            if font_dest.resolve() not in dest.parents and dest != font_dest.resolve():
                raise SystemExit(f"Refusing unsafe ZIP path: {name!r}")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            copied_fonts += 1
            print(f"  copied {name} -> {dest.relative_to(repo)}")
    if copied_fonts == 0:
        print(f"WARNING: no files found under {font_prefix}", file=sys.stderr)

    # 2. Copy packages/fonts/<slug>.yaml
    face_src = f"packages/fonts/{slug}.yaml"
    face_dest = repo / "packages/fonts" / f"{slug}.yaml"
    try:
        face_data = zf.read(face_src)
        face_dest.parent.mkdir(parents=True, exist_ok=True)
        face_dest.write_bytes(face_data)
        print(f"  copied {face_src} -> {face_dest.relative_to(repo)}")
    except KeyError:
        raise SystemExit(f"ZIP missing {face_src}")

    # 3. configurator-fontMetadata.json -> packages/configurator.json
    try:
        meta_bytes = zf.read("integration/configurator-fontMetadata.json")
        meta = json.loads(meta_bytes.decode("utf-8"))
    except KeyError:
        raise SystemExit("ZIP missing integration/configurator-fontMetadata.json")
    # meta is {"slug": {"label","license","source"}}
    configurator_path = repo / "packages/configurator.json"
    cfg = json.loads(configurator_path.read_text(encoding="utf-8"))
    font_meta = cfg.get("fontMetadata", {})
    changed_cfg = False
    for k, v in meta.items():
        if k in font_meta:
            print(f"  fontMetadata[{k!r}] already present — skipping")
        else:
            font_meta[k] = v
            cfg["fontMetadata"] = font_meta
            changed_cfg = True
            print(f"  added fontMetadata[{k!r}]")
    if changed_cfg:
        # Preserve formatting exactly: json.dumps(indent=2, ensure_ascii=False)+"\n"
        configurator_path.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"  wrote {configurator_path.relative_to(repo)}")
    else:
        print("  configurator.json already up to date")

    # 4. display-snippet.txt -> packages/display.yaml
    try:
        display_snippet = zf.read("integration/display-snippet.txt").decode("utf-8")
    except KeyError:
        raise SystemExit("ZIP missing integration/display-snippet.txt")
    # Extract macro for idempotency check
    macro_match = re.search(r"#ifdef\s+(MAX7219_FONT_\w+)", display_snippet)
    macro = macro_match.group(1) if macro_match else None
    display_path = repo / "packages/display.yaml"
    display_text = display_path.read_text(encoding="utf-8")
    if macro and macro in display_text:
        print(f"  display.yaml already contains {macro} — skipping")
    else:
        # Find anchor indent
        anchor = ANCHOR
        indent = "      "
        for line in display_text.splitlines():
            if anchor in line:
                indent = line[: len(line) - len(line.lstrip(" \t"))]
                break
        # Build indented snippet: each non-empty line prefixed with indent, empty lines remain empty
        # Snippet from ZIP is unindented 4 lines
        snippet_lines = display_snippet.strip("\n").splitlines()
        indented = "\n".join((indent + ln if ln.strip() else ln) for ln in snippet_lines) + "\n"
        # Insert before anchor line
        if anchor not in display_text:
            print(f"WARNING: anchor {anchor!r} not found in display.yaml", file=sys.stderr)
        else:
            lines = display_text.splitlines(keepends=True)
            out: list[str] = []
            inserted = False
            for ln in lines:
                if anchor in ln and not inserted:
                    out.append(indented)
                    inserted = True
                out.append(ln)
            new_display = "".join(out)
            display_path.write_text(new_display, encoding="utf-8")
            print(f"  patched {display_path.relative_to(repo)} with {macro}")

    # 5. test-mapping.txt -> tests/test_config.py
    try:
        mapping_line = zf.read("integration/test-mapping.txt").decode("utf-8").strip()
    except KeyError:
        raise SystemExit("ZIP missing integration/test-mapping.txt")
    # mapping_line like '"font_x_source": "Label",'
    # Detect via firmwareId
    test_path = repo / "tests/test_config.py"
    test_text = test_path.read_text(encoding="utf-8")
    # Extract firmwareId from mapping line
    fw_match = re.search(r'"(font_\w+_source)"', mapping_line)
    fw_id = fw_match.group(1) if fw_match else mapping_line
    if fw_id and fw_id in test_text:
        print(f"  tests/test_config.py already contains {fw_id} — skipping")
    else:
        # Insert before closing } of FONT_OPTION_BY_ID
        # Find the block: FONT_OPTION_BY_ID = { ... }
        # We will search for the closing } that ends the dict (first occurrence after the declaration)
        # Approach: locate declaration line, then find corresponding closing }
        # Use regex to capture block
        pattern = re.compile(r"(FONT_OPTION_BY_ID\s*=\s*\{.*?)(^\})", re.M | re.S)
        m = pattern.search(test_text)
        if not m:
            print("WARNING: FONT_OPTION_BY_ID block not found", file=sys.stderr)
        else:
            # Insert mapping_line with proper indent (4 spaces) before closing }
            # Check if mapping_line ends with comma, ensure consistent
            # The block currently ends with newline + "}\n"
            # We need to insert line: '    ' + mapping_line + '\n'
            indent_test = "    "
            insertion = indent_test + mapping_line.rstrip() + "\n"
            # m.group(2) is the closing brace line.
            # Reconstruct: prefix up to before }, insert, then }
            # To keep formatting, insert before final }
            # Need to find last newline before }
            # Use replacement
            before = test_text[: m.start(2)]
            after = test_text[m.start(2):]
            # Ensure before ends with newline
            if not before.endswith("\n"):
                before += "\n"
            new_test = before + insertion + after
            test_path.write_text(new_test, encoding="utf-8")
            print(f"  patched {test_path.relative_to(repo)} with {fw_id}")

    # 6. fonts-readme-row.md -> fonts/README.md
    try:
        readme_row = zf.read("integration/fonts-readme-row.md").decode("utf-8").strip()
    except KeyError:
        raise SystemExit("ZIP missing integration/fonts-readme-row.md")
    readme_path = repo / "fonts/README.md"
    readme_text = readme_path.read_text(encoding="utf-8")
    # Idempotency: check if slug link already present
    # e.g., "max7219-georgian/" or slug string
    if readme_row in readme_text or f"{slug}/" in readme_text:
        print(f"  fonts/README.md already contains {slug!r} — skipping")
    else:
        # Find Family table: header "| Family | Source file | Licence |"
        # Append as last row of Family table
        lines = readme_text.splitlines()
        # Find table start
        table_start = None
        for i, ln in enumerate(lines):
            if ln.strip().startswith("| Family |"):
                table_start = i
                break
        if table_start is None:
            print("WARNING: Family table header not found in fonts/README.md", file=sys.stderr)
            # Append at end
            new_readme = readme_text.rstrip("\n") + "\n" + readme_row + "\n"
            readme_path.write_text(new_readme, encoding="utf-8")
        else:
            # Find end of Family table: contiguous lines starting with "|"
            # Table lines start at header, then separator, then rows, then blank or next heading
            # header + separator counted as table
            last_table_row_idx = table_start
            for j in range(table_start, len(lines)):
                if lines[j].startswith("|"):
                    last_table_row_idx = j
                elif lines[j].strip() == "":
                    # blank line after table — stop if we already past header
                    if j > table_start + 1 and lines[j-1].startswith("|"):
                        break
                elif lines[j].startswith("#"):
                    break
                else:
                    # Paragraph after table
                    if last_table_row_idx > table_start:
                        break
            # Insert after last_table_row_idx
            new_lines = lines[: last_table_row_idx + 1] + [readme_row] + lines[last_table_row_idx + 1 :]
            new_readme = "\n".join(new_lines) + ("\n" if readme_text.endswith("\n") else "")
            readme_path.write_text(new_readme, encoding="utf-8")
            print(f"  patched {readme_path.relative_to(repo)} with Family row")

    # 7. Run generators
    run_generators(repo, args.no_generate)

    faces = sorted((repo / "packages/fonts").glob("*.yaml"))
    count_match = re.search(r"assertEqual\(len\(faces\), (\d+)\)", test_path.read_text(encoding="utf-8"))
    if count_match and int(count_match.group(1)) != len(faces):
        print(
            f"WARNING: tests/test_config.py expects {count_match.group(1)} catalogue faces but "
            f"packages/fonts/ now has {len(faces)} — update that assertion (and any "
            "face-specific height exceptions) before expecting check_code to pass.",
            file=sys.stderr,
        )
    print(f"Done integrating {slug}")


if __name__ == "__main__":
    main()
