import { withFonts } from "./fontSelection";
import { fontSpec } from "./fontCatalog";
import { deviceSlug, nodeId } from "./device";
import { FIRMWARE, PROJECT, firmwareOption, limitsFor, type FirmwareSetting } from "./firmware";
import { boardsFor, packageFilesFor, pinMapFor, settingOptions } from "./hardware";
import { sanitizeConfig } from "./storage";
import { clampNumber, type Config } from "./types";

/** No separate release tag, package list, entity names or defaults live here. */
const TAG = /^\d+\.\d+\.\d+$/;
export function validReleaseTag(tag: string): boolean { return TAG.test(tag); }

export function sanitizeFriendly(name: string): string {
  return name.replace(/[\r\n]/g, " ").trim() || String(FIRMWARE.defaults.friendlyName);
}

export function sanitizeTimezone(tz: string): string {
  const clean = tz.trim();
  if (!/^[A-Za-z0-9_+\/-]+$/.test(clean)) throw new Error("Enter a valid IANA timezone");
  try { new Intl.DateTimeFormat("en", { timeZone: clean }).format(); }
  catch { throw new Error("Enter a valid IANA timezone"); }
  return clean;
}

export function sanitizeEntity(id: string): string { return id.trim().toLowerCase(); }
export function selectedFontOption(font: Config["clockFont"]): string { return fontSpec(font).option; }

export function entityId(cfg: Config, domain: string, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `${domain === "text_sensor" ? "sensor" : domain}.${nodeId(cfg.deviceName)}_${slug}`;
}

export function entityMap(cfg: Config) {
  const node = nodeId(cfg.deviceName);
  const byTarget = (target: string) => {
    const entity = FIRMWARE.entities.find((item) => item.id === target);
    if (!entity) throw new Error(`No firmware entity ${target}`);
    return entityId(cfg, entity.domain, entity.name);
  };
  const action = (name: string) => {
    if (!FIRMWARE.actions.some((item) => item.action === name)) throw new Error(`No firmware action ${name}`);
    return `esphome.${node}_${name}`;
  };
  return {
    node, slug: deviceSlug(cfg.deviceName), screen: byTarget("screen_mode"), alignment: byTarget("clock_alignment"),
    font: byTarget("clock_font"), seconds: byTarget("seconds_display"), dateFormat: byTarget("date_format"),
    scroll: byTarget("message_scroll_behavior"), brightness: byTarget("matrix_brightness"),
    duration: byTarget("default_message_duration"), scrollSpeed: byTarget("message_scroll_speed"),
    mode: byTarget("display_mode"), ota: byTarget("ota_state"), showAction: action("show_message"),
    clearAction: action("clear_message"), countdownAction: action("start_countdown"),
  };
}

export function sampleAction(cfg: Config, message: string, hold = cfg.messageHold): string {
  const range = limitsFor("messageHold");
  return `action: ${entityMap(cfg).showAction}\ndata:\n  message: ${JSON.stringify(message)}\n  duration: ${clampNumber(hold, range.min, range.max)}`;
}

export function installCommand(cfg: Config): string { return `esphome run ${deviceSlug(cfg.deviceName)}.yaml`; }

function valueFor(item: FirmwareSetting, cfg: Config): string | number | boolean {
  let value = cfg[item.key] as string | number | boolean;
  if (item.key === "deviceName") value = deviceSlug(String(value));
  if (item.key === "friendlyName") value = sanitizeFriendly(String(value));
  if (item.key === "timezone") value = sanitizeTimezone(String(value));
  if (typeof value === "number") {
    const range = limitsFor(item.key);
    value = clampNumber(value, range.min, range.max);
  }
  if (typeof value === "string" && value.includes("$")) throw new Error("Substitution references are not allowed in setting text");
  if (item.key === "clockFont") return selectedFontOption(String(value));
  if (item.kind === "select") {
    // The board is target-specific; only the target's own ids are emitted.
    const choice = String(value);
    const options = settingOptions(item, cfg.target)?.map(String);
    if (options && !options.includes(choice)) throw new Error(`Select a valid ${item.label.toLowerCase()} for this hardware target`);
    return firmwareOption(item.key, choice);
  }
  return value;
}

export function buildYaml(input: Config, releaseTag: string): string {
  if (!validReleaseTag(releaseTag)) throw new Error("Installers require an immutable release tag, never main");
  const cfg = withFonts(sanitizeConfig(input), input.fonts);
  if (cfg.chips < cfg.rows || cfg.chips % cfg.rows !== 0) throw new Error("Module count must divide evenly into rows");
  if (!boardsFor(cfg.target).includes(cfg.board)) throw new Error("Select a valid board for this hardware target");
  // Pins resolve through the selected target's own aliases, so an ESP8266
  // alias such as D8 can never be written into an ESP32 installer.
  const mapping = pinMapFor(cfg.target, cfg.board);
  const pins = [cfg.clkPin, cfg.mosiPin, cfg.csPin].map((pin) => mapping[pin]);
  if (pins.some((pin) => pin === undefined)) throw new Error("Select valid output pins for this board");
  if (new Set(pins).size !== 3) throw new Error("CLK, DIN and CS need different GPIO pins");
  const files = [...packageFilesFor(cfg.target), ...cfg.fonts.map((id) => {
    const file = FIRMWARE.fonts.find((font) => font.id === id)?.package;
    if (!file) throw new Error(`No firmware font package ${id}`);
    return file;
  })];
  const substitutions = [
    ...Object.entries(FIRMWARE.secrets).map(([key, secret]) => `  ${key}: !secret ${secret}`),
    `  project_ref: ${JSON.stringify(releaseTag)}`,
  ];
  const sections: Record<string, string[]> = { select: [], number: [], switch: [] };
  for (const item of FIRMWARE.settings) {
    const value = valueFor(item, cfg);
    if (item.kind === "substitution") {
      substitutions.push(`  ${item.target}: ${JSON.stringify(String(value) + (item.timeSuffix ?? ""))}`);
    } else {
      const property = item.kind === "select" ? "initial_option" : item.kind === "number" ? "initial_value" : "restore_mode";
      const settingValue = item.kind === "switch" ? (value ? "RESTORE_DEFAULT_ON" : "RESTORE_DEFAULT_OFF") : value;
      sections[item.kind].push(`  - id: !extend ${item.target}\n    ${property}: ${JSON.stringify(settingValue)}`);
      if (item.substitution) substitutions.push(`  ${item.substitution}: ${JSON.stringify(String(value))}`);
    }
  }
  return `# MAX7219 Matrix Clock — one-file installer\n# Firmware ${releaseTag}; ESPHome ${FIRMWARE.esphomeVersion}\n# Keep beside your local secrets.yaml. Packages and fonts share one immutable tag.\n\nsubstitutions:\n${substitutions.join("\n")}\n\npackages:\n  clock:\n    url: ${PROJECT.repo}\n    ref: ${JSON.stringify(releaseTag)}\n    refresh: 1d\n    files:\n${files.map((file) => `      - ${file}`).join("\n")}\n\n# First-boot preferences only; existing restored values take priority.\n${Object.entries(sections).map(([domain, values]) => `${domain}:\n${values.join("\n")}`).join("\n\n")}\n`;
}
