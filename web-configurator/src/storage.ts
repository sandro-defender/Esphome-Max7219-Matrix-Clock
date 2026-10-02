import { FIRMWARE } from "./firmware";
import { LEDS as LED_PALETTE } from "./leds";
import { withFonts } from "./fontSelection";
import { CLOCK_FONTS, DEFAULT_CONFIG, LIMITS, clampNumber, isConfigKey, type Config } from "./types";

/**
 * Settings persistence.
 *
 * The configurator never asks for credentials, so everything it stores is a
 * display preference. Settings are kept in localStorage for the next visit and
 * can be shared as a URL fragment, which is why every value is validated on
 * the way in: a hand-edited link must never be able to break the preview.
 */

const STORAGE_KEY = "max7219-clock.config.v1";
export const HASH_KEY = "cfg";

const ENUMS: Partial<Record<keyof Config, readonly unknown[]>> = Object.fromEntries(
  FIRMWARE.settings.filter((item) => item.options).map((item) => [item.key, item.options!]),
);
ENUMS.clockFont = CLOCK_FONTS;
ENUMS.led = Object.keys(LED_PALETTE);
// Retired illustration links must not change the actual firmware preview.
ENUMS.layoutPreview = ["firmware"];
const RANGES = LIMITS;

/** Merge arbitrary input over the defaults, dropping anything unusable. */
export function sanitizeConfig(input: unknown): Config {
  const config: Config = { ...DEFAULT_CONFIG, fonts: [...DEFAULT_CONFIG.fonts] };
  if (!input || typeof input !== "object") return config;
  const source = input as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (!isConfigKey(key)) continue;
    const value = source[key];
    const fallback = DEFAULT_CONFIG[key];
    if (key === "fonts") {
      config.fonts = withFonts(config, value).fonts;
      continue;
    }
    if (typeof fallback === "boolean") {
      if (typeof value === "boolean") config[key] = value as never;
      continue;
    }
    if (typeof fallback === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const range = RANGES[key];
      config[key] = (range ? clampNumber(value, range.min, range.max) : Math.round(value)) as never;
      continue;
    }
    if (typeof value !== "string") continue;
    const allowed = ENUMS[key];
    if (allowed && !allowed.includes(value)) continue;
    config[key] = (typeof fallback === "string" ? value.slice(0, 64) : value) as never;
  }
  // Old links have no inclusion list: retain their selected face as one extra.
  return withFonts(config, Object.prototype.hasOwnProperty.call(source, "fonts") ? config.fonts : [config.clockFont]);
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeConfig(cfg: Config): string {
  return toBase64Url(JSON.stringify(cfg));
}

export function decodeConfig(encoded: string): Config | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(encoded));
    if (!parsed || typeof parsed !== "object") return null;
    return sanitizeConfig(parsed);
  } catch {
    return null;
  }
}

/** Absolute URL that reopens the configurator with these settings. */
export function shareUrl(cfg: Config, base = ""): string {
  return `${base}#${HASH_KEY}=${encodeConfig(cfg)}`;
}

function readHash(hash: string): string | null {
  const value = hash.replace(/^#/, "").split("&").find((part) => part.startsWith(`${HASH_KEY}=`));
  return value ? value.slice(HASH_KEY.length + 1) : null;
}

export function loadConfig(): { config: Config; from: "link" | "saved" | "default" } {
  if (typeof window !== "undefined") {
    const encoded = readHash(window.location.hash);
    if (encoded) {
      const shared = decodeConfig(encoded);
      if (shared) return { config: shared, from: "link" };
    }
  }
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { config: sanitizeConfig(JSON.parse(raw)), from: "saved" };
    } catch {
      // Private mode or a corrupted entry: fall through to the defaults.
    }
  }
  return { config: sanitizeConfig(null), from: "default" };
}

export function saveConfig(cfg: Config): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Storage is optional; the configurator still works without it.
  }
}

export function clearSavedConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}
