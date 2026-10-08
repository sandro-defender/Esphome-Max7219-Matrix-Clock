#!/usr/bin/env python3
"""Generate browser glyphs from the exact firmware fonts AND built-in C++ font.

Use FreeType's monochrome load flags, advances, bearings and ascender math,
exactly like ESPHome bpp: 1. No Pillow/OS-dependent surrogate rasterisation.
--check never rewrites stale data, so firmware and preview drift fails CI.
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

import freetype
from esphome.components.font import glyph_to_glyphinfo
from esphome.components import font as esphome_font

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "web-configurator/src/glyphs.generated.ts"
CPP_OUTPUT = ROOT / "tests/fonts.generated.h"
sys.path.insert(0, str(ROOT / "scripts"))
from generate_firmware_contract import load


def font_records(entry):
    source = (ROOT / "packages" / entry["file"]["path"]).resolve()
    face = freetype.Face(str(source))
    face.set_pixel_sizes(entry["size"], 0)
    glyphs = {}
    for char in "".join(entry["glyphs"]):
        if face.get_char_index(ord(char)) == 0:
            raise ValueError(f"{source}: missing compiled glyph {char!r}")
        face.load_char(ord(char), freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
        glyph, bitmap = face.glyph, face.glyph.bitmap
        rows = []
        for y in range(bitmap.rows):
            row = 0
            for x in range(bitmap.width):
                if bitmap.buffer[y * bitmap.pitch + x // 8] & (0x80 >> (x % 8)):
                    row |= 1 << (bitmap.width - 1 - x)
            rows.append(row)
        glyphs[char if char != " " else "space"] = {
            "w": bitmap.width, "h": bitmap.rows, "left": glyph.bitmap_left,
            "top": (face.size.ascender + 63) // 64 - glyph.bitmap_top,
            "advance": (glyph.metrics.horiAdvance + 63) // 64, "rows": rows,
        }
    zero = glyphs["0"]
    return {"file": source.relative_to(ROOT).as_posix(), "size": entry["size"], "inkHeight": zero["h"],
            "inkTop": zero["top"], "clockWidth": sum(glyphs[c]["advance"] for c in "88:88:88"),
            "maxDigitHeight": max(glyphs[c]["h"] for c in "0123456789"), "glyphs": glyphs}


def builtin_records():
    text = (ROOT / "packages/max7219_clock_renderer.h").read_text(encoding="utf8")
    section = text.split("namespace builtin {", 1)[1].split("}  // namespace builtin", 1)[0]
    clean = re.sub(r"//[^\n]*", "", section)
    def values(rows):
        return [int(v.strip(), 0) for v in rows.split(",") if v.strip()]
    tables = {}
    for name in ("DIGITS", "LETTERS"):
        body = re.search(r"static const uint8_t " + name + r"\[[^=]+?= \{(.*?)\n  \};", clean, re.S)[1]
        tables[name] = [values(m) for m in re.findall(r"\{([^{}]+)\}", body)]
    glyphs = {str(i): rows for i, rows in enumerate(tables["DIGITS"])}
    glyphs.update({chr(65+i): rows for i, rows in enumerate(tables["LETTERS"])})
    punctuation = {name: values(rows) for name, rows in re.findall(r"static const uint8_t (\w+)\[\d+\] = \{([^}]+)\};", clean)}
    switch = clean.split("switch (c)", 1)[1].split("inline int advance", 1)[0]
    for block, name in re.findall(r"((?:\s*case '.':\s*)+)return (\w+);", switch):
        for char in re.findall(r"case '(.)':", block):
            glyphs[char] = punctuation[name]
    advance_source = section.split("inline int advance(char c)", 1)[1]
    short = re.findall(r"case '(.)':", advance_source.split("return 3", 1)[0])
    default_advance = int(re.search(r"default:\s*return (\d+)", advance_source)[1])
    advances = {char: 3 if char in short else default_advance for char in glyphs}
    font_class = text.split("class BuiltinFont", 1)[1].split("struct Frame", 1)[0]
    ink_height = int(re.search(r"ink_height\(\) const override \{ return (\d+);", font_class)[1])
    ink_top = int(re.search(r"ink_top\(\) const override \{ return (\d+);", font_class)[1])
    return glyphs, advances, {"inkHeight": ink_height, "inkTop": ink_top,
                              "maxDigitHeight": ink_height, "clockWidth": sum(advances[c] for c in "88:88:88"),
                              "defaultAdvance": default_advance}


def cpp_fixture(entries):
    official_header = Path(esphome_font.__file__).with_name("font.h").read_text(encoding="utf8")
    glyph_class = re.search(r"class Glyph final \{.*?\n\};", official_header, re.S)[0]
    lines = ["// GENERATED test data: official ESPHome glyph API and packed bpp: 1 data.",
             "// Regenerate with web-configurator/scripts/generate_glyphs.py.", "#pragma once",
             "#include <stdint.h>", "namespace esphome { namespace font {", glyph_class]
    records = []
    for entry in entries:
        name = entry["id"]
        source = (ROOT / "packages" / entry["file"]["path"]).resolve()
        face = freetype.Face(str(source))
        glyphs = []
        for char in sorted("".join(entry["glyphs"])):
            glyph = glyph_to_glyphinfo(char, face, entry["size"], entry["bpp"])
            data_name = f"{name}_{ord(char)}_data"
            lines.append("static const uint8_t " + data_name + "[] = {" + ",".join(map(str, glyph.bitmap_data or [0])) + "};")
            glyphs.append(f"  Glyph({ord(char)}, {data_name}, {glyph.advance}, {glyph.offset_x}, {glyph.offset_y}, {glyph.width}, {glyph.height})")
        lines += [f"static const Glyph {name}_glyphs[] = {{", ",\n".join(glyphs), "};"]
        records.append(f'  {{"{name}", {name}_glyphs, {len(glyphs)}, {entry["size"]}}}')
    lines += ["struct FixtureFont { const char *id; const Glyph *glyphs; int count; int height; };",
              "static const FixtureFont FIXTURE_FONTS[] = {", ",\n".join(records), "};", "}}  // namespace esphome::font", ""]
    return "\n".join(lines)


def frame_fixture():
    from generate_firmware_contract import build as contract_build
    contract, _ = contract_build()
    bindings = {item["target"]: item["key"] for item in contract["settings"]}
    display = load(ROOT / "packages/display.yaml")["display"][0]["lambda"]
    prefs = display.split("// ----- Frame: durable preferences", 1)[1].split("// ----- Draw", 1)[0].split("\n", 1)[1]
    prefs = re.sub(r"id\((\w+)\)\.current_option\(\)", lambda m: 'S(values.at("' + bindings[m[1]] + '"))', prefs)
    prefs = re.sub(r"id\((\w+)\)\.state", lambda m: 'N(values.at("' + bindings[m[1]] + '"))', prefs)
    prefs = re.sub(r"\$\{(\w+)\}", lambda m: 'N(values.at("' + bindings[m[1]] + '"))', prefs)
    return "// GENERATED from the actual display writer; tests must not duplicate its bindings/clamps.\n#pragma once\n" +         "inline void fixture_preferences(max7219_clock::Frame &frame, const std::map<std::string, std::string> &values) {\n" + prefs + "}\n"


def build():
    entries = load(ROOT / "packages/fonts_local.yaml")["font"]
    fonts = {entry["id"]: font_records(entry) for entry in entries}
    glyphs, advances, metrics = builtin_records()
    interface = '''// GENERATED from real firmware font packages, TTFs and C++ built-in glyphs.
// Regenerate with scripts/generate_glyphs.py; do not edit by hand.
export interface GeneratedGlyph {
  w: number; h: number; left: number; top: number; advance: number; rows: number[];
}
export interface GeneratedFont {
  file: string; size: number; inkHeight: number; inkTop: number;
  clockWidth: number; maxDigitHeight: number; glyphs: Record<string, GeneratedGlyph>;
}
'''
    text = interface + "export const GENERATED_FONTS: Record<string, GeneratedFont> = " + json.dumps(fonts, indent=2) + ";\n" + \
        "export const BUILTIN_GLYPHS: Record<string, number[]> = " + json.dumps(glyphs, indent=2) + ";\n" + \
        "export const BUILTIN_ADVANCES: Record<string, number> = " + json.dumps(advances, indent=2) + ";\n" + \
        "export const BUILTIN_METRICS = " + json.dumps(metrics) + ";\n"
    esphome_root = Path(esphome_font.__file__).parent.parent.parent
    string_ref = (esphome_root / "core/string_ref.h").read_text(encoding="utf8").replace('#include "esphome/core/defines.h"', "")
    driver_cpp = (esphome_root / "components/max7219digit/max7219digit.cpp").read_text(encoding="utf8")
    driver_method = re.search(r"void MAX7219Component::send64pixels.*?\n}[^\n]*", driver_cpp, re.S)[0].replace("MAX7219Component::", "StockDriver::")
    return {OUTPUT: text, CPP_OUTPUT: cpp_fixture(entries), ROOT / "tests/frame.generated.h": frame_fixture(),
            ROOT / "tests/string_ref.generated.h": "// GENERATED exact ESPHome StringRef API (host, without platform defines).\n" + string_ref,
            ROOT / "tests/driver.generated.h": "// GENERATED exact ESPHome MAX7219 transmission; do not duplicate transforms in tests.\n" + driver_method + "\n"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    from generate_firmware_contract import build as contract_build
    contract_build()  # exact installed ESPHome and bpp/assets/versions checks
    outputs = build()
    for path, content in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text(encoding="utf8") != content:
                raise SystemExit(f"Firmware/preview glyph drift: regenerate {path.relative_to(ROOT)} in the same commit")
        else:
            path.write_text(content)
    print(f"Firmware glyphs {'checked' if args.check else 'generated'} (browser rows and official ESPHome packed C++ fixtures)")



if __name__ == "__main__":
    main()
