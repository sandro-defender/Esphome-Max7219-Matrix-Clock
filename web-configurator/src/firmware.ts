import generated from "./firmware.generated.json";

/** Data generated from packages/ by scripts/generate_firmware_contract.py. */
export interface FirmwareSetting {
  key: string;
  kind: "substitution" | "select" | "number" | "switch" | "package";
  target: string;
  group: string;
  label: string;
  input: string;
  default: string | number | boolean;
  options?: (string | number)[];
  firmwareOptions?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  substitution?: string;
  timeSuffix?: string;
  requires?: string;
  exclusiveSecrets?: string[];
}

export interface FirmwareFont {
  id: string;
  option: string;
  label: string;
  family: string;
  firmwareId?: string;
  size?: number;
  license: string;
  source: string;
  file?: string;
  package?: string;
}

/**
 * Pin data in ESPHome's own shape: per-board aliases (a string means "the
 * alias table of that board"), the shared alias base and the output-capable
 * GPIO numbers per board variant. `hardware.ts` expands one board on demand.
 */
export interface FirmwarePinCatalog {
  variants: Record<string, number[]>;
  boardVariants: Record<string, string>;
  boardAliases: Record<string, Record<string, number> | string>;
  baseAliases: Record<string, number>;
}

export interface FirmwareHardwareTarget {
  id: string;
  label: string;
  platform: string;
  /** The real ESPHome package whose values this target installs. */
  basePackage: string;
  /** The substitution key that selects the board for this target. */
  boardKey: string;
  /** Only the settings whose default differs from the default target. */
  defaults: Record<string, string | number | boolean>;
  /** Complete module list for an installer of this target. */
  packageFiles: string[];
  pins: FirmwarePinCatalog;
}

export interface FirmwareEntity {
  id: string;
  group: string;
  visibilitySubstitution: string;
  visibleByDefault: boolean;
  recommended: boolean;
  name: string;
  domain: string;
  package: string;
  options?: string[];
  min_value?: number;
  max_value?: number;
  step?: number;
  unit_of_measurement?: string;
  entity_category?: string;
  disabled_by_default?: boolean;
}

export const FIRMWARE = generated as unknown as {
  schemaVersion: number;
  sourceHash: string;
  repository: string;
  releaseVersion: string;
  esphomeVersion: string;
  releaseNotes: string;
  packageFiles: string[];
  /** The target whose values the top-level settings/defaults/packageFiles carry. */
  defaultTarget: string;
  hardwareTargets: FirmwareHardwareTarget[];
  secrets: Record<string, string>;
  defaultFonts: string[];
  fonts: FirmwareFont[];
  settings: FirmwareSetting[];
  groups: { id: string; description: string }[];
  defaults: Record<string, string | number | boolean>;
  entities: FirmwareEntity[];
  renderer: { messageMaxBytes: number; alertMaxBytes: number; otaStates: Record<string, number>;
    otaTemplates: Record<string, string[]>; otaBarStates: string[]; progressMax: number; bootPrefix: string; bootScrollMs: number; alarmPeriodMs: number };
  actions: { action: string; description: string; variables: Record<string, string> }[];
};

export function setting(key: string): FirmwareSetting {
  const found = FIRMWARE.settings.find((item) => item.key === key);
  if (!found) throw new Error(`No firmware binding for ${key}`);
  return found;
}

export function optionsFor(key: string): string[] {
  return (setting(key).options ?? []).map(String);
}

export function limitsFor(key: string): { min: number; max: number; step: number } {
  const item = setting(key);
  return { min: item.min ?? 0, max: item.max ?? Number.MAX_SAFE_INTEGER, step: item.step ?? 1 };
}

export function firmwareOption(key: string, value: string): string {
  const item = setting(key);
  const index = item.options?.indexOf(value) ?? -1;
  return item.firmwareOptions?.[index] ?? value;
}

export function releaseBody(tag: string): string {
  return `## ${tag}\n\n${FIRMWARE.releaseNotes}\n`;
}

const builtRef = import.meta.env.VITE_PACKAGE_REF;
const reference = builtRef && /^\d+\.\d+\.\d+$/.test(builtRef) ? builtRef : FIRMWARE.releaseVersion;
export const PROJECT = {
  repo: `https://github.com/${FIRMWARE.repository}`,
  readme: `https://github.com/${FIRMWARE.repository}/blob/${reference}/README.md`,
  validation: `https://github.com/${FIRMWARE.repository}/blob/${reference}/VALIDATION.md`,
  roadmap: `https://github.com/${FIRMWARE.repository}/blob/${reference}/ROADMAP.md`,
  issues: `https://github.com/${FIRMWARE.repository}/issues`,
  live: `https://${FIRMWARE.repository.split("/")[0]}.github.io/${FIRMWARE.repository.split("/")[1]}/`,
  ref: reference,
  esphome: FIRMWARE.esphomeVersion,
};
