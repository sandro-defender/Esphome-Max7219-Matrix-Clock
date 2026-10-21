#!/usr/bin/env python3
"""Install a Pixeel MAX7219 export as the single custom-face build.

Implements the shared contract §C.3–C.5: creates `custom/` with font, licence,
`font-info.json` and `custom_font.yaml`, patches `packages/display.yaml` with a
`MAX7219_CUSTOM_FACE` block, generates `dev-custom.yaml` and regenerates the
firmware contract. Idempotent — re-running replaces artefacts without
duplicating the display block.

See docs/PIXEEL_FONTS.md for the end-to-end workflow.
"""
from __future__ import annotations

import argparse
import base64
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

DEFAULT_GLYPHS = "0123456789:.-/%!?+ აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ"
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
ROOT_MARKERS = ("packages/display.yaml", "dev.yaml")
CUSTOM_FONT_ID = "font_custom_face"
CUSTOM_MACRO = "MAX7219_CUSTOM_FACE"
CUSTOM_VAR = "custom_face_font"
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
        # Refuse absolute or Windows absolute or .. traversal (either separator).
        parts = name.replace("\\", "/").split("/")
        if name.startswith(("/", "\\")) or ".." in parts:
            raise SystemExit(f"Refusing unsafe ZIP path: {name!r}")
        # Also check for drive letter on Windows
        if re.match(r"^[a-zA-Z]:", name):
            raise SystemExit(f"Refusing unsafe ZIP path: {name!r}")


def slug_from_ttf_path(ttf_name: str) -> tuple[str, str]:
    # ttf_name like fonts/<slug>/file.ttf
    parts = Path(ttf_name).parts
    if len(parts) < 3 or parts[0] != "fonts":
        raise SystemExit(f"Unexpected TTF path in ZIP: {ttf_name!r}")
    slug = parts[1]
    if not SLUG_RE.fullmatch(slug):
        raise SystemExit(f"Invalid slug {slug!r} — must match ^[a-z0-9]+(-[a-z0-9]+)*$")
    return slug, parts[-1]


def read_manifest_data(zf: zipfile.ZipFile) -> dict | None:
    try:
        data = zf.read("font-manifest.json")
        return json.loads(data.decode("utf-8"))
    except KeyError:
        return None
    except Exception as e:
        print(f"WARNING: could not parse font-manifest.json: {e}", file=sys.stderr)
        return None


def read_yaml_glyphs_and_label(yaml_bytes: bytes) -> tuple[str | None, str | None]:
    """Try to parse face YAML for label/glyphs without requiring PyYAML."""
    text = yaml_bytes.decode("utf-8", errors="replace")
    label = None
    glyphs = None
    # Try yaml if available
    try:
        import yaml

        data = yaml.safe_load(text)
        if isinstance(data, dict):
            sel = data.get("select", [{}])[0] if isinstance(data.get("select"), list) else {}
            opts = sel.get("options", [])
            if opts:
                label = opts[0]
            font = data.get("font", [{}])[0] if isinstance(data.get("font"), list) else {}
            glyphs_value = font.get("glyphs", [])
            if isinstance(glyphs_value, list) and glyphs_value:
                glyphs = "".join(str(g) for g in glyphs_value)
            elif isinstance(glyphs_value, str) and glyphs_value:
                glyphs = glyphs_value
            if label is not None or glyphs is not None:
                return label, glyphs
    except Exception:
        pass
    # Regex fallback
    m = re.search(r"options:\s*\n\s*-\s*['\"]?(.*?)['\"]?\s*\n", text)
    if m:
        label = m.group(1)
        # Unescape '' -> '
        # yaml single quote escaping is '' -> '
        # But we just take raw
    # glyphs: look for glyphs: block
    # glyphs:\n      - '...'\n or - "..."
    m2 = re.search(r"glyphs:\s*\n\s*-\s*(['\"])(.*?)\1", text, re.S)
    if m2:
        glyphs = m2.group(2).replace("''", "'")
        # fallback also handle without quotes
    if glyphs is None:
        m3 = re.search(r"glyphs:\s*\n\s*-\s*([^\n]+)", text)
        if m3:
            raw = m3.group(1).strip().strip("'\"")
            glyphs = raw.replace("''", "'")
    return label, glyphs


def parse_export_status(text: str) -> str:
    # Look for **Status:** PASS / FAIL
    for line in text.splitlines():
        m = re.search(r"\*\*Status:\*\*\s*(PASS|FAIL)", line)
        if m:
            return m.group(1)
    # Also try generic
    if "FAIL" in text:
        # but we need explicit
        pass
    return "UNKNOWN"


def yaml_escape_single(s: str) -> str:
    return s.replace("'", "''")


def cpp_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def ensure_secrets(repo: Path) -> None:
    secrets = repo / "secrets.yaml"
    if secrets.is_file():
        return
    example = repo / "secrets.yaml.example"
    if not example.is_file():
        print("WARNING: secrets.yaml.example missing, cannot create secrets.yaml", file=sys.stderr)
        return
    text = example.read_text(encoding="utf-8")
    key = base64.b64encode(os.urandom(32)).decode()
    # Replace placeholder line — robust regex
    new_text = re.sub(r'api_encryption_key:\s*"[^"]*"', f'api_encryption_key: "{key}"', text)
    # If replacement didn't happen (different formatting), try broader
    if new_text == text:
        new_text = text.replace("REPLACE_WITH_A_BASE64_32_BYTE_KEY=", key)
        if "api_encryption_key" not in new_text:
            print("WARNING: could not inject api_encryption_key into secrets.yaml", file=sys.stderr)
    secrets.write_text(new_text, encoding="utf-8")
    print(f"WARNING: created {secrets} from example with generated api_encryption_key", file=sys.stderr)


def run_esphome(repo: Path, args: list[str]) -> int:
    esphome = shutil.which("esphome")
    if esphome:
        cmd = [esphome, *args]
    else:
        cmd = [sys.executable, "-m", "esphome", *args]
    print(f"Running: {' '.join(cmd)}", file=sys.stderr)
    result = subprocess.run(cmd, cwd=repo)
    return result.returncode


def install_custom(repo: Path, ttf_bytes: bytes, license_bytes: bytes | str, label: str, glyphs: str,
                   slug: str | None, source_ttf_name: str, export_status: str,
                   manifest_extra: dict | None, ttf_sha: str) -> None:
    custom = repo / "custom"
    custom.mkdir(parents=True, exist_ok=True)
    # font.ttf
    (custom / "font.ttf").write_bytes(ttf_bytes)
    # LICENSE.txt
    if isinstance(license_bytes, bytes):
        (custom / "LICENSE.txt").write_bytes(license_bytes)
    else:
        (custom / "LICENSE.txt").write_text(license_bytes, encoding="utf-8")
    # font-info.json
    installed_at = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    info: dict = {
        "label": label,
        "glyphs": glyphs,
        "contractVersion": 1,
        "slug": slug or "",
        "sourceTtfName": source_ttf_name,
        "ttfSha256": ttf_sha,
        "installedAt": installed_at,
        "fontId": CUSTOM_FONT_ID,
        "macro": CUSTOM_MACRO,
        "exportReportStatus": export_status,
    }
    # Passthrough manifest fields without overriding the canonical keys above
    # (label/glyphs/slug/ttfSha256/fontId/macro stay the installed values).
    if manifest_extra:
        for key, value in manifest_extra.items():
            if key not in info:
                info[key] = value
    if not slug:
        info.pop("slug", None)
    if not source_ttf_name:
        info.pop("sourceTtfName", None)
    info_path = custom / "font-info.json"
    info_path.write_text(json.dumps(info, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    # custom_font.yaml
    yaml_label = yaml_escape_single(label)
    yaml_glyphs = yaml_escape_single(glyphs)
    custom_yaml = f"""# GENERATED by scripts/use_pixeel_font.py — do not edit. See docs/PIXEEL_FONTS.md
font:
  - id: {CUSTOM_FONT_ID}
    file:
      type: local
      path: font.ttf
    size: 8
    bpp: 1
    glyphs:
      - '{yaml_glyphs}'
esphome:
  build_flags:
    - -D{CUSTOM_MACRO}
select:
  - id: !extend clock_font
    options:
      - '{yaml_label}'
    initial_option: '{yaml_label}'
"""
    (custom / "custom_font.yaml").write_text(custom_yaml, encoding="utf-8")
    # Print info
    print(f"Installed custom font '{label}' ({len(glyphs)} glyphs, sha256 {ttf_sha[:8]}…) into {custom}")


def patch_display(repo: Path, label: str) -> bool:
    path = repo / "packages/display.yaml"
    original = path.read_text(encoding="utf-8")
    # Remove existing custom block(s) — match with optional indent
    # Use regex that captures leading indent
    custom_pattern = re.compile(r"^[ \t]*#ifdef MAX7219_CUSTOM_FACE\n.*?^[ \t]*#endif\n", re.M | re.S)
    without = custom_pattern.sub("", original)
    had_old = without != original
    # Find anchor indent
    anchor = ANCHOR
    indent = "      "  # default 6 spaces
    found = False
    for line in without.splitlines():
        if anchor in line:
            # leading whitespace
            indent = line[: len(line) - len(line.lstrip(" \t"))]
            found = True
            break
    if not found:
        print(f"WARNING: anchor {anchor!r} not found in {path}", file=sys.stderr)
        return False
    cpp_label = cpp_escape(label)
    block = f"{indent}#ifdef MAX7219_CUSTOM_FACE\n{indent}max7219_clock::SourceFont {CUSTOM_VAR}({CUSTOM_FONT_ID}, &it);\n{indent}if (font_option == \"{cpp_label}\") selected = &{CUSTOM_VAR};\n{indent}#endif\n"
    # Insert the block line-wise immediately before the anchor line.
    if anchor in without:
        lines = without.splitlines(keepends=True)
        out_lines: list[str] = []
        inserted = False
        for ln in lines:
            if anchor in ln and not inserted:
                out_lines.append(block)
                inserted = True
            out_lines.append(ln)
        new_text = "".join(out_lines)
    else:
        new_text = without

    if new_text == original:
        print("packages/display.yaml already up to date")
        return False
    # If we had old block and label changed, we want to say replaced
    path.write_text(new_text, encoding="utf-8")
    if had_old:
        # Check if label was different?
        if label in original:
            print("packages/display.yaml already up to date (label unchanged) — patched for consistency")
        else:
            print(f"Updated packages/display.yaml custom face block to label {label!r}")
    else:
        print(f"Patched packages/display.yaml with custom face '{label}'")
    return True


def generate_dev_custom(repo: Path) -> bool:
    dev = repo / "dev.yaml"
    out = repo / "dev-custom.yaml"
    text = dev.read_text(encoding="utf-8")
    swap_from = "fonts: !include packages/fonts_default_local.yaml"
    swap_to = "fonts: !include custom/custom_font.yaml"
    if swap_from not in text:
        print(f"WARNING: swap anchor {swap_from!r} not found in {dev}", file=sys.stderr)
        # Try to handle variants?
        # Fallback: replace any fonts: !include packages/fonts_default_local.yaml with custom
        # But we already warned
        return False
    new_body = text.replace(swap_from, swap_to, 1)
    header = "# GENERATED by scripts/use_pixeel_font.py — do not edit. See docs/PIXEEL_FONTS.md\n"
    new_text = header + new_body
    if out.is_file() and out.read_text(encoding="utf-8") == new_text:
        print("dev-custom.yaml already up to date")
        return False
    out.write_text(new_text, encoding="utf-8")
    print(f"Wrote {out}")
    return True


def regenerate_contract(repo: Path) -> None:
    script = repo / "scripts/generate_firmware_contract.py"
    if not script.is_file():
        print(f"WARNING: {script} not found, skipping contract regeneration", file=sys.stderr)
        return
    print("Regenerating firmware contract...", file=sys.stderr)
    result = subprocess.run([sys.executable, str(script)], cwd=repo)
    if result.returncode != 0:
        print(f"WARNING: {script} failed with exit {result.returncode} — is esphome==2026.9.1 installed? (pip install -r requirements-validation.txt)", file=sys.stderr)
    else:
        print("Firmware contract regenerated")


def process_zip_mode(zip_path: Path, label_override: str | None, glyphs_override: str | None) -> tuple[bytes, bytes, str, str, str, str, str, dict | None, str]:
    if glyphs_override is not None:
        raise SystemExit("--glyphs can only be used with --ttf")
    zf = zipfile.ZipFile(zip_path)
    validate_zip_paths(zf)
    names = zf.namelist()
    # Find TTF under fonts/*/
    ttf_candidates = [n for n in names if n.startswith("fonts/") and n.lower().endswith(".ttf") and n.count("/") >= 2]
    if len(ttf_candidates) != 1:
        # Also accept exactly one .ttf under fonts/*/ — spec says exactly one
        # Filter stricter: under fonts/<slug>/  and not deeper?
        # Try to be lenient: pick first if multiple?
        if not ttf_candidates:
            raise SystemExit(f"ZIP must contain exactly one .ttf under fonts/*/, found none in {names}")
        if len(ttf_candidates) > 1:
            raise SystemExit(f"ZIP must contain exactly one .ttf under fonts/*/, found {ttf_candidates}")
    ttf_name = ttf_candidates[0]
    slug, ttf_file = slug_from_ttf_path(ttf_name)
    ttf_bytes = zf.read(ttf_name)
    # LICENSE
    license_name = f"fonts/{slug}/LICENSE.txt"
    try:
        license_bytes = zf.read(license_name)
    except KeyError:
        print(f"WARNING: {license_name} missing in ZIP, using placeholder", file=sys.stderr)
        license_bytes = b"Custom font - see original source for licence.\n"
    # manifest
    manifest = read_manifest_data(zf)
    # face yaml for fallback
    yaml_label = None
    yaml_glyphs = None
    face_yaml_name = f"packages/fonts/{slug}.yaml"
    try:
        yaml_bytes = zf.read(face_yaml_name)
        yaml_label, yaml_glyphs = read_yaml_glyphs_and_label(yaml_bytes)
    except KeyError:
        pass
    # export report
    export_status = "UNKNOWN"
    report_text = ""
    try:
        report_text = zf.read("EXPORT-REPORT.md").decode("utf-8", errors="replace")
        export_status = parse_export_status(report_text)
        if export_status == "FAIL":
            print("WARNING: Pixeel EXPORT-REPORT.md reports **Status:** FAIL — font may clip or overflow on 48x8. See fonts/README.md Measurements.", file=sys.stderr)
            print(report_text, file=sys.stderr)
        elif export_status == "PASS":
            print(f"EXPORT-REPORT.md: PASS for {slug}")
        else:
            print(f"EXPORT-REPORT.md status unknown ({export_status})", file=sys.stderr)
    except KeyError:
        print("WARNING: EXPORT-REPORT.md missing, assuming UNKNOWN", file=sys.stderr)
    # Determine label/glyphs hierarchy: manifest first, then yaml, then defaults
    label = label_override or (manifest.get("label") if manifest else None) or yaml_label or slug or "Custom"
    glyphs = None
    if manifest and manifest.get("glyphs"):
        glyphs = manifest.get("glyphs")
        # manifest glyphs may be list or string? Spec says string; but check
        if isinstance(glyphs, list):
            glyphs = "".join(glyphs)
    glyphs = glyphs or yaml_glyphs or DEFAULT_GLYPHS
    # manifest may have glyphs as list of strings? Handle
    # Source TTF name
    source_ttf = ttf_file
    if manifest and manifest.get("file"):
        source_ttf = Path(str(manifest.get("file"))).name or ttf_file
    sha = hashlib.sha256(ttf_bytes).hexdigest()
    return ttf_bytes, license_bytes, label, glyphs, slug, source_ttf, export_status, manifest, sha


def process_ttf_mode(ttf_path: Path, label_override: str | None, glyphs_override: str | None) -> tuple[bytes, bytes, str, str, str, str, str, dict | None, str]:
    ttf_bytes = ttf_path.read_bytes()
    sha = hashlib.sha256(ttf_bytes).hexdigest()
    # License placeholder
    license_bytes = b"Custom font - see original source for licence.\n"
    # Label
    label = label_override or ttf_path.stem or "Custom"
    # Glyphs
    glyphs = glyphs_override or DEFAULT_GLYPHS
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    if not SLUG_RE.fullmatch(slug or ""):
        slug = "custom"
    source_ttf = ttf_path.name
    export_status = "UNKNOWN"
    manifest = None
    return ttf_bytes, license_bytes, label, glyphs, slug, source_ttf, export_status, manifest, sha


def process_folder_mode(folder_path: Path, label_override: str | None, glyphs_override: str | None) -> tuple[bytes, bytes, str, str, str, str, str, dict | None, str]:
    if glyphs_override is not None:
        raise SystemExit("--glyphs can only be used with --ttf")
    if not folder_path.is_dir():
        raise SystemExit(f"--folder {folder_path} is not a directory")
    ttf_file = folder_path / "font.ttf"
    if not ttf_file.is_file():
        # Also try to find any ttf in folder
        ttf_candidates = list(folder_path.glob("*.ttf"))
        if len(ttf_candidates) == 1:
            ttf_file = ttf_candidates[0]
        elif not ttf_candidates:
            raise SystemExit(f"{folder_path} must contain font.ttf")
        else:
            raise SystemExit(f"{folder_path} contains multiple .ttf, expected exactly font.ttf")
    ttf_bytes = ttf_file.read_bytes()
    sha = hashlib.sha256(ttf_bytes).hexdigest()
    # License: try folder LICENSE.txt, else placeholder
    lic_path = folder_path / "LICENSE.txt"
    if lic_path.is_file():
        license_bytes = lic_path.read_bytes()
    else:
        license_bytes = b"Custom font - see original source for licence.\n"
    # font-info.json
    info_path = folder_path / "font-info.json"
    info = None
    info_label = None
    info_glyphs = None
    info_slug = None
    export_status = "UNKNOWN"
    manifest_extra: dict | None = None
    if info_path.is_file():
        try:
            info = json.loads(info_path.read_text(encoding="utf-8"))
            info_label = info.get("label")
            info_glyphs = info.get("glyphs")
            info_slug = info.get("slug")
            export_status = info.get("exportReportStatus", "UNKNOWN")
            manifest_extra = info
        except Exception as e:
            print(f"WARNING: could not parse {info_path}: {e}", file=sys.stderr)
    label = label_override or info_label or "Custom"
    glyphs = info_glyphs or DEFAULT_GLYPHS
    # glyphs may be list
    if isinstance(glyphs, list):
        glyphs = "".join(glyphs)
    slug = info_slug or re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    if not slug or not SLUG_RE.fullmatch(slug):
        slug = "custom"
    source_ttf = info.get("sourceTtfName") if info and info.get("sourceTtfName") else ttf_file.name
    # If manifest_extra is info, we keep it as extra
    return ttf_bytes, license_bytes, label, glyphs, slug, source_ttf, export_status, manifest_extra, sha


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--zip", dest="zip_path", type=Path, help="Pixeel export ZIP")
    group.add_argument("--ttf", dest="ttf_path", type=Path, help="Direct TTF file")
    group.add_argument("--folder", dest="folder_path", type=Path, help="Folder containing font.ttf + font-info.json (Pixeel folder export)")
    parser.add_argument("--repo", type=str, default=None, help="Repo root (auto-detected)")
    parser.add_argument("--label", type=str, default=None, help="Override font label")
    parser.add_argument("--glyphs", type=str, default=None, help="Override glyph string (only with --ttf)")
    parser.add_argument("--no-generate", action="store_true", help="Skip firmware contract regeneration")
    parser.add_argument("--config", action="store_true", help="Run `esphome config dev-custom.yaml` after install")
    parser.add_argument("--flash", action="store_true", help="Run `esphome run dev-custom.yaml` after install")
    args = parser.parse_args()

    # Validate --glyphs only with --ttf
    if args.glyphs is not None and args.ttf_path is None:
        parser.error("--glyphs can only be used with --ttf")

    repo = repo_root_from_args(args.repo)

    if args.zip_path:
        if not args.zip_path.is_file():
            raise SystemExit(f"ZIP not found: {args.zip_path}")
        ttf_bytes, license_bytes, label, glyphs, slug, source_ttf, export_status, manifest, sha = process_zip_mode(
            args.zip_path, args.label, args.glyphs
        )
    elif args.ttf_path:
        if not args.ttf_path.is_file():
            raise SystemExit(f"TTF not found: {args.ttf_path}")
        ttf_bytes, license_bytes, label, glyphs, slug, source_ttf, export_status, manifest, sha = process_ttf_mode(
            args.ttf_path, args.label, args.glyphs
        )
    else:
        # folder
        assert args.folder_path is not None
        ttf_bytes, license_bytes, label, glyphs, slug, source_ttf, export_status, manifest, sha = process_folder_mode(
            args.folder_path, args.label, args.glyphs
        )

    # Install
    install_custom(repo, ttf_bytes, license_bytes, label, glyphs, slug, source_ttf, export_status, manifest, sha)
    patched = patch_display(repo, label)
    generate_dev_custom(repo)

    if not args.no_generate:
        regenerate_contract(repo)
    else:
        print("Skipping firmware contract regeneration (--no-generate)")

    if args.config or args.flash:
        ensure_secrets(repo)

    if args.config:
        rc = run_esphome(repo, ["config", "dev-custom.yaml"])
        if rc != 0:
            raise SystemExit(f"esphome config failed ({rc})")
    if args.flash:
        rc = run_esphome(repo, ["run", "dev-custom.yaml"])
        if rc != 0:
            raise SystemExit(f"esphome run failed ({rc})")


if __name__ == "__main__":
    main()
