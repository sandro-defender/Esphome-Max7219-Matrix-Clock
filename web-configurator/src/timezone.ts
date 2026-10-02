import type { Config } from "./types";
import { sanitizeTimezone } from "./settingsModel";

/** Local Intl detection only: no geolocation, IP lookup or permission prompt. */
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
 * Automatic is the default, even for old saved/shared profiles. Only an
 * explicit automaticTimezone:false keeps a manual zone. Failed detection
 * retains the last usable value (the firmware default on a first visit).
 */
export function withDetectedTimezone(config: Config, detected: string | null = detectTimezone()): Config {
  if (!config.automaticTimezone || detected === null || detected === config.timezone) return config;
  return { ...config, timezone: detected };
}
