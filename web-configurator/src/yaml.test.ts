import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { addExtraFontAndSelect, DEFAULT_FONTS, EXTRA_FONTS, MAX_EXTRA_FONTS, toggleExtraFont, withFonts } from "./fontSelection";
import { DEFAULT_CONFIG } from "./types";
import { buildYaml } from "./yaml";

/**
 * Catalogue sync guard: the generated installer must stay in lockstep with
 * examples/release.yaml (tag, non-font package files) and must only ever
 * reference credentials through the user's local secrets.yaml.
 *
 * The font defaults intentionally differ: the configurator ships only
 * Pixel Clock 6×8, while examples/release.yaml bundles the Matrix 2px +
 * Dot Matrix pair.
 */

const releaseExample = readFileSync(new URL("../../examples/release.yaml", import.meta.url), "utf8");

/** The `files:` entries of a `packages:` block, in order. */
function packageFiles(text: string): string[] {
  const block = /files:\n((?:[ \t]+- [^\n]+\n)+)/.exec(text);
  if (!block) return [];
  return block[1].trim().split("\n").map((line) => line.trim().replace(/^- /, ""));
}

/** Package files of the release example, minus the font packages. */
function releaseFrameworkFiles(): string[] {
  return packageFiles(releaseExample).filter((file) => !file.startsWith("packages/fonts/"));
}

describe("generated installer YAML", () => {
  const yaml = buildYaml(DEFAULT_CONFIG);

  it("pins the same released tag as examples/release.yaml", () => {
    const releaseRef = /ref:\s*"([^"]+)"/.exec(releaseExample)![1];
    const installerRef = /ref:\s*"([^"]+)"/.exec(yaml)![1];
    expect(installerRef).toBe(releaseRef);
    expect(releaseRef).toMatch(/^\d+\.\d+\.\d+$/); // a version tag, never main
    expect(yaml).toContain(`project_ref: "${releaseRef}"`);
  });

  it("shares the release example's framework packages and ships only Pixel Clock by default", () => {
    expect(packageFiles(yaml)).toEqual([...releaseFrameworkFiles(), "packages/fonts/pixel-clock-6x8.yaml"]);
  });

  it("adds one package per ticked extra face", () => {
    expect(DEFAULT_CONFIG.fonts).toEqual([...DEFAULT_FONTS]);
    let cfg = withFonts(DEFAULT_CONFIG, DEFAULT_CONFIG.fonts);
    for (const extra of EXTRA_FONTS) cfg = addExtraFontAndSelect(cfg, extra);
    expect(packageFiles(buildYaml(cfg))).toEqual([
      ...releaseFrameworkFiles(),
      "packages/fonts/pixel-clock-6x8.yaml",
      ...EXTRA_FONTS.map((id) => `packages/fonts/${id}.yaml`),
    ]);
    // Every face the release example bundles is an optional extra here.
    const releaseFonts = packageFiles(releaseExample).filter((file) => file.startsWith("packages/fonts/"));
    expect(releaseFonts).toEqual(["packages/fonts/matrix-2px.yaml", "packages/fonts/dot-matrix.yaml"]);
    for (const file of releaseFonts) {
      expect(EXTRA_FONTS).toContain(file.replace("packages/fonts/", "").replace(".yaml", ""));
    }
    expect(EXTRA_FONTS.length).toBeLessThanOrEqual(MAX_EXTRA_FONTS);
    // The default face cannot be unchecked and the built-in face is not a package.
    expect(toggleExtraFont(cfg, "pixel-clock-6x8")).toBe(cfg);
    expect(toggleExtraFont(cfg, "compact")).toBe(cfg);
  });

  it("references every credential only through !secret", () => {
    for (const key of [
      "wifi_ssid",
      "wifi_password",
      "api_encryption_key",
      "fallback_ap_password",
      "web_server_username",
      "web_server_password",
    ]) {
      expect(yaml).toContain(`${key}: !secret ${key}`);
    }
  });
});
