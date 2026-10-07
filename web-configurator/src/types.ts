import { FIRMWARE, limitsFor, optionsFor } from "./firmware";

export type Wiring = "snake" | "zigzag";
export type Alignment = "Left" | "Center" | "Right";
export type HourFormat = "24-hour" | "12-hour";
export type DateFormat = "DD.MM" | "MM/DD" | "DD/MM" | "DD.MM.YY" | "Weekday DD.MM.YY" | "Weekday DD. MMM YY" | "Weekday MMM.DD";
export type DateLanguage = "English" | "Georgian";
export type SecondsMode = "Off" | "Digits" | "Bar";
export type MessageScroll = "Scroll" | "Static";

/** Home Assistant "Clock font" options compiled by the firmware. */
export const CLOCK_FONTS = FIRMWARE.fonts.map((font) => font.id);
export type ClockFont = string;

/** Legacy share links are migrated to the real firmware layout. */
export type LayoutPreview = "firmware";

export type ScreenMode = "Clock" | "Date" | "Temperature" | "Message" | "Module grid test" | "Pixel checkerboard";
export type LedName = "Blood" | "Amber" | "Red" | "Green" | "Ice" | "White";
export const WEATHER_PREVIEW_OPTIONS = [
  { value: "clear", label: "Clear / sunny" },
  { value: "clear-night", label: "Clear night" },
  { value: "partlycloudy", label: "Partly cloudy" },
  { value: "cloudy", label: "Cloudy" },
  { value: "fog", label: "Fog / mist" },
  { value: "rain", label: "Rain / drizzle" },
  { value: "snow", label: "Snow / sleet" },
  { value: "thunderstorm", label: "Thunderstorm" },
  { value: "windy", label: "Windy" },
  { value: "unknown", label: "Unknown / unavailable" },
] as const;
export type PreviewWeatherCondition = typeof WEATHER_PREVIEW_OPTIONS[number]["value"];
export type PreviewTemperatureKey = "previewHomeTemperature" | "previewOutdoorTemperature" | "previewWeatherTemperature";

export type ConfigValue = string | number | boolean | string[];
export interface Config {
  [key: string]: ConfigValue | undefined;
  /** Selected hardware target (see src/hardware.ts); the generated contract supplies the ids. */
  target: string;
  // Identity
  deviceName: string;
  friendlyName: string;
  timezone: string;
  automaticTimezone: boolean;
  /** Firmware entity IDs to make internal at compile time (never removed). */
  hiddenEntities: string[];
  temperatureEntity: string;
  board: string;
  deviceComment: string;
  logLevel: string;
  otaPort: number;
  fallbackSsid: string;
  fallbackApTimeout: number;
  wifiRebootTimeout: number;
  wifiPowerSave: string;
  apiRebootTimeout: number;
  sntpServer1: string;
  sntpServer2: string;
  sntpUpdateInterval: number;
  webServer: boolean;
  webServerPort: number;
  webServerVersion: number;
  webServerAuthType: string;
  webServerLog: boolean;
  displayUpdateMs: number;
  bootVersionMs: number;
  otaBrightness: number;

  // Hardware (compile-time substitutions)
  clkPin: string;
  mosiPin: string;
  csPin: string;
  chips: number;
  rows: number;
  wiring: Wiring;
  rotateChip: 0 | 90 | 180 | 270;
  reverseEnable: boolean;
  flipX: boolean;

  // Display (restored Home Assistant preferences)
  screen: ScreenMode;
  autoCycle: boolean;
  cycleInterval: number;
  dateScreenDuration: number;
  countdownDuration: number;
  alignment: Alignment;
  hourFormat: HourFormat;
  dateFormat: DateFormat;
  dateLanguage: DateLanguage;
  clockLayout: string;
  dateShowWeatherIcon: boolean;
  dateShowOutdoorTemperature: boolean;
  showTemperatureDegree: boolean;
  secondsMode: SecondsMode;
  blinkColon: boolean;
  digitAnimation: boolean;
  animationMs: number;
  animationRowGap: number;
  clockFont: ClockFont;
  /** Included external faces: Pixel Clock 6x8 ships by default; other faces are optional. */
  fonts: ClockFont[];
  layoutPreview: LayoutPreview;

  // Messages
  message: string;
  messageHold: number;
  scrollMode: MessageScroll;
  scrollSpeed: number;
  dateScrollSpeed: number;

  // Light
  brightness: number;
  nightDim: boolean;
  nightManual: boolean;
  alarmMode: boolean;
  nightBrightness: number;
  nightStart: number;
  nightEnd: number;
  displayPower: boolean;
  invert: boolean;
  led: LedName;

  // Preview only
  /** "HH:MM[:SS]" to freeze the preview clock; empty means live. */
  previewTime: string;
  /** Raw demo values; blank or invalid text previews an unavailable sensor reading. */
  previewHomeTemperature: string;
  previewOutdoorTemperature: string;
  previewWeatherTemperature: string;
  previewWeatherCondition: PreviewWeatherCondition;
  /** Dashed guides where the 8x8 boards meet. Preview only; never drawn on the panel. */
  showModuleBoundaries: boolean;
}

/** Only these visual/demo preferences do not install a firmware setting. */
export const PREVIEW_DEFAULTS = {
  layoutPreview: "firmware" as const,
  message: "",
  led: "Blood" as const,
  previewTime: "",
  previewHomeTemperature: "21.5",
  previewOutdoorTemperature: "13.2",
  previewWeatherTemperature: "12.8",
  previewWeatherCondition: "clear" as const,
  showModuleBoundaries: false,
};

/** Browser policy and entity selection; these are not renderer preferences. */
export const CONFIGURATOR_DEFAULTS = {
  automaticTimezone: true,
  hiddenEntities: FIRMWARE.entities.filter((entity) => !entity.visibleByDefault).map((entity) => entity.id),
};

export const DEFAULT_CONFIG: Config = {
  ...FIRMWARE.defaults,
  ...PREVIEW_DEFAULTS,
  ...CONFIGURATOR_DEFAULTS,
  fonts: [...FIRMWARE.defaultFonts],
} as Config;

/** Bounds are extracted from the actual number entities / ESPHome schema. */
export const LIMITS = Object.fromEntries(
  FIRMWARE.settings.filter((item) => typeof item.default === "number").map((item) => [item.key, limitsFor(item.key)]),
) as Record<string, { min: number; max: number; step: number }>;

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function isConfigKey(key: string): key is keyof Config & string {
  return Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG, key);
}

export const SCREENS = optionsFor("screen") as ScreenMode[];
