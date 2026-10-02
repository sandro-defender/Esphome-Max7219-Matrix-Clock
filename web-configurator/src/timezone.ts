import type { Config } from "./types";
import { sanitizeTimezone } from "./yaml";

/** Where the initial configuration came from. */
export type ConfigSource = "link" | "saved" | "default";

/**
 * The browser's IANA zone, validated with the firmware's own rules.
 *
 * Purely client-side: `Intl` reads a zone the browser already knows. No
 * geolocation API, no IP lookup, no permission prompt and no network request.
 * Returns null when the browser cannot report a usable zone, so callers keep
 * the firmware default.
 */
export function detectTimezone(
  resolve: () => string | undefined = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
): string | null {
  try {
    const zone = resolve();
    return zone ? sanitizeTimezone(zone) : null;
  } catch {
    return null;
  }
}

/**
 * First visit only: pre-fill `timezone` with the detected browser zone.
 *
 * A saved configuration or a shared link always wins, so nothing detected can
 * overwrite an existing choice — including an explicitly kept firmware default.
 * An unusable detection also keeps the firmware default.
 */
export function withDetectedTimezone(
  config: Config,
  source: ConfigSource,
  detected: string | null = detectTimezone(),
): Config {
  if (source !== "default" || detected === null || detected === config.timezone) return config;
  return { ...config, timezone: detected };
}
