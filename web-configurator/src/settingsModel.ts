import { FIRMWARE, type FirmwareSetting } from "./firmware";
import type { Config } from "./types";

/** A single ordered view of the generated bindings, shared by the compact UI. */
export const SETTINGS_GROUPS = FIRMWARE.groups.map((group) => ({
  ...group,
  // Package switches precede their dependent fields, regardless of source order.
  settings: FIRMWARE.settings.filter((item) => item.group === group.id)
    .sort((a, b) => Number(b.kind === "package") - Number(a.kind === "package")),
}));

export function enabledSetting(item: FirmwareSetting, cfg: Config): boolean {
  return !item.requires || cfg[item.requires] === true;
}

/** Unknown IDs (including arbitrary YAML/substitution names) never survive. */
export function sanitizeHiddenEntities(input: unknown): string[] {
  const requested = new Set(Array.isArray(input) ? input.filter((id) => typeof id === "string") : []);
  return FIRMWARE.entities.filter((entity) => requested.has(entity.id)).map((entity) => entity.id);
}

export function installerSecrets(cfg: Config): Record<string, string> {
  const omitted = new Set(FIRMWARE.settings.filter((item) => item.kind === "package" && !cfg[item.key])
    .flatMap((item) => item.exclusiveSecrets ?? []));
  return Object.fromEntries(Object.entries(FIRMWARE.secrets).filter(([key]) => !omitted.has(key)));
}

/** Same text lengths on input, restore and export: no hidden 64-character cut. */
export function textLimit(key: string): number {
  if (key === "message") return FIRMWARE.renderer.messageMaxBytes;
  if (key === "fallbackSsid") return 32; // Export also checks the UTF-8 byte length.
  if (ENTITY_ID_FIELDS[key]) return 255;
  return 240;
}

/** Installer-time IDs: the static page cannot browse a Home Assistant registry. */
export const ENTITY_ID_FIELDS: Record<string, { domain: "sensor" | "weather"; example: string; hint: string }> = {
  temperatureEntity: {
    domain: "sensor",
    example: "sensor.outdoor_temperature",
    hint: "Legacy Temperature screen source. Enter an existing numeric Home Assistant sensor ID; the static configurator cannot query your entity list.",
  },
  homeTemperatureEntity: {
    domain: "sensor",
    example: "sensor.living_room_temperature",
    hint: "Indoor reading shown on the left in the three-panel Clock layout. Enter an existing sensor ID; this static configurator cannot browse Home Assistant entities.",
  },
  outdoorTemperatureEntity: {
    domain: "sensor",
    example: "sensor.openweathermap_temperature",
    hint: "Preferred outdoor source. If its current state is missing or invalid, the weather entity's temperature attribute is used instead.",
  },
  weatherEntity: {
    domain: "weather",
    example: "weather.openweathermap",
    hint: "The weather state supplies the condition/icon; its temperature attribute is the outdoor fallback. Enter the ID from Home Assistant—there is no live entity lookup.",
  },
};

export function entityIdPattern(key: string): string | undefined {
  const field = ENTITY_ID_FIELDS[key];
  return field ? `${field.domain}\\.[a-z0-9_]+` : undefined;
}

export function sanitizeTimezone(tz: string): string {
  const clean = tz.trim();
  if (!/^[A-Za-z0-9_+\/-]+$/.test(clean)) throw new Error("Enter a valid IANA timezone");
  try { new Intl.DateTimeFormat("en", { timeZone: clean }).format(); }
  catch { throw new Error("Enter a valid IANA timezone"); }
  return clean;
}

/** Fail closed on invalid setting text; JSON quoting alone is not validation. */
export function validateSettingText(item: FirmwareSetting, value: string): string {
  if (value.includes("$")) throw new Error("Substitution references are not allowed in setting text");
  if (/[\ud800-\udfff]/u.test(value)) throw new Error(`${item.label} must contain valid Unicode text`);
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${item.label} cannot contain control characters`);
  if (item.key === "timezone") return sanitizeTimezone(value);
  if (item.key === "fallbackSsid") {
    const bytes = new TextEncoder().encode(value).length;
    if (bytes < 1 || bytes > 32) throw new Error("Fallback hotspot name must be 1–32 UTF-8 bytes");
  }
  const entityField = ENTITY_ID_FIELDS[item.key];
  if (entityField) {
    const id = value.trim();
    const pattern = new RegExp(`^${entityField.domain}\\.[a-z0-9_]+$`);
    if (id.length > 255 || !pattern.test(id)) {
      throw new Error(`${item.label} must be a valid Home Assistant ${entityField.domain} entity ID, for example ${entityField.example}`);
    }
    return id;
  }
  if (item.input === "hostname") {
    const labels = value.replace(/\.$/, "").split(".");
    if (value.length > 253 || !labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
      throw new Error(`${item.label} must be a hostname or IPv4 address, not a URL`);
    }
    if (/^[\d.]+$/.test(value) && (labels.length !== 4 || labels.some((label) => Number(label) > 255))) {
      throw new Error(`${item.label} must be a valid IPv4 address`);
    }
  }
  return value;
}
