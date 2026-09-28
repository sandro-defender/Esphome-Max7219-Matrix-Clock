export type Wiring = "snake" | "zigzag";
export type Alignment = "Left" | "Center" | "Right";
export type HourFormat = "24-hour" | "12-hour";
export type DateFormat = "DD.MM" | "MM/DD" | "DD/MM";
export type SecondsMode = "Off" | "Digits" | "Bar";
export type MessageScroll = "Scroll" | "Static";

/** Home Assistant "Clock font" options compiled by the firmware. */
export const CLOCK_FONTS = [
  "silkscreen-bold",
  "tiny5",
  "press-start-2p",
  "audiowide",
  "bitcount-grid-double",
  "bitcount-grid-single",
  "bitcount-prop-double",
  "bitcount-prop-single",
  "bitcount-single",
  "bytesized",
  "dotgothic16",
  "doto",
  "electrolize",
  "handjet",
  "iceland",
  "jersey-10",
  "jersey-15",
  "jersey-20",
  "jersey-25",
  "major-mono-display",
  "micro-5",
  "nova-mono",
  "orbitron",
  "oxanium",
  "pixelify-sans",
  "quantico-bold",
  "rubik-pixels",
  "share-tech-mono",
  "sixtyfour",
  "vt323",
  "wallpoet",
  "noto-sans-georgian",
  "noto-serif-georgian",
  "compact",
] as const;
export type ClockFont = (typeof CLOCK_FONTS)[number];

/**
 * "firmware" mirrors what packages/max7219_clock_renderer.h draws.
 * "modules" is the one-digit-per-8x8-module illustration.
 */
export type LayoutPreview = "firmware" | "modules";

export type ScreenMode = "Clock" | "Date" | "Message" | "Module grid test" | "Pixel checkerboard";
export type LedName = "Blood" | "Amber" | "Red" | "Green" | "Ice" | "White";

export interface Config {
  // Identity
  deviceName: string;
  friendlyName: string;
  timezone: string;

  // Hardware (compile-time substitutions)
  clkPin: string;
  mosiPin: string;
  csPin: string;
  chips: number;
  rows: number;
  wiring: Wiring;
  rotateChip: 0 | 90 | 180 | 270;
  flipX: boolean;

  // Display (restored Home Assistant preferences)
  screen: ScreenMode;
  autoCycle: boolean;
  cycleInterval: number;
  alignment: Alignment;
  hourFormat: HourFormat;
  dateFormat: DateFormat;
  secondsMode: SecondsMode;
  blinkColon: boolean;
  digitAnimation: boolean;
  animationMs: number;
  clockFont: ClockFont;
  layoutPreview: LayoutPreview;

  // Messages
  message: string;
  messageHold: number;
  scrollMode: MessageScroll;
  scrollSpeed: number;

  // Light
  brightness: number;
  nightDim: boolean;
  nightBrightness: number;
  nightStart: number;
  nightEnd: number;
  displayPower: boolean;
  invert: boolean;
  led: LedName;

  // Preview only
  /** "HH:MM[:SS]" to freeze the preview clock; empty means live. */
  previewTime: string;
}

export const PINS = ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"] as const;

export const DEFAULT_CONFIG: Config = {
  deviceName: "max7219-clock",
  friendlyName: "MAX7219 Clock",
  timezone: "UTC",

  clkPin: "D8",
  mosiPin: "D6",
  csPin: "D7",
  chips: 6,
  rows: 1,
  wiring: "snake",
  rotateChip: 0,
  flipX: false,

  screen: "Clock",
  autoCycle: false,
  cycleInterval: 10,
  alignment: "Center",
  hourFormat: "24-hour",
  dateFormat: "DD.MM",
  secondsMode: "Digits",
  blinkColon: true,
  digitAnimation: true,
  animationMs: 250,
  clockFont: "silkscreen-bold",
  layoutPreview: "firmware",

  message: "",
  messageHold: 20,
  scrollMode: "Scroll",
  scrollSpeed: 80,

  brightness: 4,
  nightDim: false,
  nightBrightness: 1,
  nightStart: 23,
  nightEnd: 6,
  displayPower: true,
  invert: false,
  led: "Blood",

  previewTime: "",
};

/** Bounded ranges, shared by the UI, the YAML generator and the tests. */
export const LIMITS = {
  chips: { min: 1, max: 16 },
  rows: { min: 1, max: 4 },
  brightness: { min: 0, max: 15 },
  animationMs: { min: 0, max: 2000 },
  scrollSpeed: { min: 20, max: 200 },
  cycleInterval: { min: 5, max: 300 },
  messageHold: { min: 0, max: 3600 },
} as const;

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function isConfigKey(key: string): key is keyof Config {
  return Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG, key);
}

export const SCREENS: ScreenMode[] = ["Clock", "Date", "Message", "Module grid test", "Pixel checkerboard"];
