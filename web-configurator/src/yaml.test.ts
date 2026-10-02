import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addExtraFontAndSelect, DEFAULT_FONTS, EXTRA_FONTS, toggleExtraFont, withFonts } from "./fontSelection";
import { DEFAULT_CONFIG, PREVIEW_DEFAULTS } from "./types";
import { FIRMWARE, firmwareOption, releaseBody } from "./firmware";
import { sanitizeConfig } from "./storage";
import { buildYaml } from "./yaml";

const releaseExample = readFileSync(new URL("../../examples/release.yaml", import.meta.url), "utf8");
const changelog = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8");
function packageFiles(text: string): string[] {
  const block = /files:\n((?:[ \t]+- [^\n]+\n)+)/.exec(text);
  return block ? block[1].trim().split("\n").map((line) => line.trim().replace(/^- /, "")) : [];
}
const yaml = buildYaml(DEFAULT_CONFIG, FIRMWARE.releaseVersion);

describe("single-source firmware / UI / installer parity", () => {
  it("uses every firmware default with preview-only preferences explicitly separated", () => {
    for (const item of FIRMWARE.settings) expect(DEFAULT_CONFIG[item.key], item.key).toEqual(item.default);
    expect(Object.keys(DEFAULT_CONFIG).sort()).toEqual([...Object.keys(FIRMWARE.defaults), ...Object.keys(PREVIEW_DEFAULTS), "fonts"].sort());
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
    expect(pkg.version).toBe(FIRMWARE.releaseVersion);
    expect(lock.version).toBe(FIRMWARE.releaseVersion);
    expect(lock.packages[""].version).toBe(FIRMWARE.releaseVersion);
  });

  it("shares the canonical version and notes, with no second release-note table", () => {
    const body = changelog.split(`## ${FIRMWARE.releaseVersion} - `)[1].split("\n").slice(1).join("\n").split("\n## ")[0].trim();
    expect(FIRMWARE.releaseNotes).toBe(body);
    expect(releaseBody(FIRMWARE.releaseVersion)).toBe(`## ${FIRMWARE.releaseVersion}\n\n${body}\n`);
    expect(FIRMWARE.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("pins one plain immutable version tag, never main and never a commit suffix", () => {
    expect(releaseExample).toContain(`ref: ${FIRMWARE.releaseVersion}`);
    expect(yaml).toContain(`ref: "${FIRMWARE.releaseVersion}"`);
    const next = `${FIRMWARE.releaseVersion.split(".").slice(0, 2).join(".")}.${Number(FIRMWARE.releaseVersion.split(".")[2]) + 1}`;
    expect(buildYaml(DEFAULT_CONFIG, next)).toContain(`project_ref: "${next}"`);
    // A commit-suffixed tag is not a version: releases always bump the patch.
    expect(() => buildYaml(DEFAULT_CONFIG, `${FIRMWARE.releaseVersion}+abcdef012345`)).toThrow(/immutable/);
    for (const ref of ["main", "master", "HEAD", "0.7.0/../../main", "0.7.0-beta", "0.7.0\nref: main"])
      expect(() => buildYaml(DEFAULT_CONFIG, ref)).toThrow(/immutable/);
  });

  it("ships exactly Pixel Clock + Matrix 2px by default in dev, examples and the UI", () => {
    expect(DEFAULT_FONTS).toEqual(["pixel-clock-6x8", "matrix-2px"]);
    const files = [...FIRMWARE.packageFiles, ...DEFAULT_FONTS.map((key) => FIRMWARE.fonts.find((font) => font.id === key)!.package!)];
    expect(packageFiles(yaml)).toEqual(files);
    expect(packageFiles(releaseExample)).toEqual(files);
    expect(files.some((file) => file.includes("boot_ui"))).toBe(true);
    expect(files.some((file) => file.includes("restore_defaults"))).toBe(true);
  });

  it("allows all compatible extras together without a cap or duplicate packages", () => {
    let cfg = withFonts(DEFAULT_CONFIG, []);
    for (const extra of EXTRA_FONTS) cfg = addExtraFontAndSelect(cfg, extra);
    expect(cfg.fonts).toHaveLength(FIRMWARE.fonts.length - 1);
    expect(packageFiles(buildYaml(cfg, FIRMWARE.releaseVersion))).toEqual([
      ...FIRMWARE.packageFiles, ...cfg.fonts.map((key) => FIRMWARE.fonts.find((font) => font.id === key)!.package!),
    ]);
    for (const key of DEFAULT_FONTS) expect(toggleExtraFont(cfg, key)).toBe(cfg);
    expect(toggleExtraFont(cfg, "compact")).toBe(cfg);
    const selected = cfg.clockFont;
    expect(toggleExtraFont(cfg, selected).clockFont).toBe(FIRMWARE.defaults.clockFont);
  });

  it("writes each and every adjustable entity, option and substitution from firmware bindings", () => {
    for (const item of FIRMWARE.settings) {
      if (item.kind === "substitution") expect(yaml, item.key).toContain(`  ${item.target}:`);
      else {
        expect(yaml, item.key).toContain(`  - id: !extend ${item.target}`);
        const expected = item.kind === "select" ? firmwareOption(item.key, String(item.default)) : item.kind === "switch" ? item.default ? "RESTORE_DEFAULT_ON" : "RESTORE_DEFAULT_OFF" : item.default;
        expect(yaml, item.key).toContain(JSON.stringify(expected));
      }
    }
    for (const key of Object.keys(PREVIEW_DEFAULTS)) expect(yaml).not.toMatch(new RegExp(`^\\s*${key}:`, "m"));
  });

  it("uses !secret names only, and never accepts substitution injection into public text", () => {
    for (const [key, secret] of Object.entries(FIRMWARE.secrets)) expect(yaml).toContain(`${key}: !secret ${secret}`);
    for (const key of ["friendlyName", "deviceComment", "fallbackSsid"])
      expect(() => buildYaml({ ...DEFAULT_CONFIG, [key]: "${api_encryption_key}" }, FIRMWARE.releaseVersion)).toThrow(/Substitution/);
    const cfg = sanitizeConfig({ ...DEFAULT_CONFIG, wifi_password: "NEVER_COPY_ME", api_encryption_key: "NEVER_COPY_ME", token: "NEVER_COPY_ME" });
    expect(JSON.stringify(cfg)).not.toContain("NEVER_COPY_ME");
    expect(buildYaml(cfg, FIRMWARE.releaseVersion)).not.toContain("NEVER_COPY_ME");
  });

  it("rejects invalid geometry, unknown timezones and GPIO aliases on the same pin", () => {
    expect(() => buildYaml({ ...DEFAULT_CONFIG, chips: 7, rows: 2 }, FIRMWARE.releaseVersion)).toThrow(/divide/);
    expect(() => buildYaml({ ...DEFAULT_CONFIG, mosiPin: "GPIO15" }, FIRMWARE.releaseVersion)).toThrow(/different GPIO/);
    expect(() => buildYaml({ ...DEFAULT_CONFIG, clkPin: "GPIO6" }, FIRMWARE.releaseVersion)).toThrow(/valid output/);
    expect(() => buildYaml({ ...DEFAULT_CONFIG, timezone: "Not/AZone" }, FIRMWARE.releaseVersion)).toThrow(/timezone/);
  });
});
