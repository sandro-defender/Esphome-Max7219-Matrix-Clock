import { FIRMWARE, type FirmwareHardwareTarget, type FirmwarePinCatalog, type FirmwareSetting } from "./firmware";
import type { Config, ConfigValue } from "./types";

/**
 * Hardware targets.
 *
 * One entry per selectable board family, generated from
 * `packages/configurator.json`: ESP8266 (Wemos D1 mini) and the
 * ESP-WROOM-32 DevKit. The top-level contract values describe the default
 * target; a target carries only the board, pin, OTA port, comment and file
 * list that differ, so a change in either base package is regenerated rather
 * than copied. The board and pin choices follow the target: an ESP32
 * installer never sees an ESP8266 alias such as D8.
 */

export type HardwareTargetId = string;

export const HARDWARE_TARGETS: FirmwareHardwareTarget[] = FIRMWARE.hardwareTargets;
export const DEFAULT_TARGET: HardwareTargetId = FIRMWARE.defaultTarget;

export function isHardwareTarget(value: unknown): value is HardwareTargetId {
  return typeof value === "string" && HARDWARE_TARGETS.some((target) => target.id === value);
}

export function targetSpec(id: HardwareTargetId): FirmwareHardwareTarget {
  const found = HARDWARE_TARGETS.find((target) => target.id === id);
  if (!found) throw new Error(`Unknown hardware target ${id}`);
  return found;
}

export function targetIds(): string[] {
  return HARDWARE_TARGETS.map((target) => target.id);
}

/** Board choices of a target, in the installed ESPHome SDK's board order. */
export function boardsFor(id: HardwareTargetId): string[] {
  return Object.keys(targetSpec(id).pins.boardVariants);
}

export function pinNumbersFor(id: HardwareTargetId, board: string): number[] {
  const pins = targetSpec(id).pins;
  return pins.variants[pins.boardVariants[board]] ?? [];
}

/** ESPHome shares identical alias tables by naming another board (a string). */
function aliasTable(pins: FirmwarePinCatalog, board: string): Record<string, number> {
  let aliases = pins.boardAliases[board];
  for (let hops = 0; typeof aliases === "string" && hops < 8; hops += 1) aliases = pins.boardAliases[aliases];
  return typeof aliases === "string" ? {} : aliases ?? {};
}

const PIN_MAPS = new Map<string, Record<string, number>>();

/** Alias -> GPIO number for one board, expanded exactly like the generator. */
export function pinMapFor(id: HardwareTargetId, board: string): Record<string, number> {
  const cacheKey = `${id}:${board}`;
  const cached = PIN_MAPS.get(cacheKey);
  if (cached) return cached;
  const pins = targetSpec(id).pins;
  const aliases = aliasTable(pins, board);
  const numbers = pinNumbersFor(id, board);
  const allowed = new Set(numbers);
  const mapping: Record<string, number> = {};
  for (const [name, value] of Object.entries({ ...pins.baseAliases, ...aliases })) {
    if (allowed.has(value)) mapping[name] = value;
  }
  for (const number of numbers) mapping[`GPIO${number}`] = number;
  PIN_MAPS.set(cacheKey, mapping);
  return mapping;
}

/** Pin names offered for the selected board — the only valid choices. */
export function pinNamesFor(id: HardwareTargetId, board: string): string[] {
  return Object.keys(pinMapFor(id, board));
}

/** A select's options, with the board list replaced by the target's boards. */
export function settingOptions(item: FirmwareSetting, id: HardwareTargetId): (string | number)[] | undefined {
  return item.key === targetSpec(id).boardKey ? boardsFor(id) : item.options;
}

export function targetDefault(id: HardwareTargetId, key: string): ConfigValue {
  const value = targetSpec(id).defaults[key];
  return value === undefined ? (FIRMWARE.defaults[key] as ConfigValue) : value;
}

export function packageFilesFor(id: HardwareTargetId): string[] {
  return targetSpec(id).packageFiles;
}

/**
 * Every setting any target redefines (board, pins, OTA port, comment). All of
 * them fall back to the top-level default, so switching back to the default
 * target restores its real hardware values instead of keeping the other
 * platform's aliases.
 */
export const HARDWARE_KEYS: string[] = [...new Set(
  HARDWARE_TARGETS.flatMap((target) => Object.keys(target.defaults)),
)];

/** Apply a target: its hardware values replace whatever the other one set. */
export function switchTarget(cfg: Config, id: HardwareTargetId): Config {
  if (!isHardwareTarget(id) || id === cfg.target) return cfg;
  const next: Config = { ...cfg, target: id };
  for (const key of HARDWARE_KEYS) next[key] = targetDefault(id, key);
  return next;
}

/** Short, generated summary of a target's defaults, for the selector. */
export function targetSummary(id: HardwareTargetId): string {
  return [`board ${targetDefault(id, "board")}`, `CLK ${targetDefault(id, "clkPin")}`,
    `DIN ${targetDefault(id, "mosiPin")}`, `CS ${targetDefault(id, "csPin")}`,
    `OTA ${targetDefault(id, "otaPort")}`].join(" · ");
}
