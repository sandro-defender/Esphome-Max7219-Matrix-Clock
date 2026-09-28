export type Wiring = "snake" | "zigzag";
export type Alignment = "Left" | "Center" | "Right";
export type HourFormat = "24-hour" | "12-hour";
export type ClockLayout = "segment" | "compact";
export type ClockFont = "blood-drip" | "blood-bold" | "classic";
export type ScreenMode =
  | "Auto"
  | "Clock"
  | "Clock with seconds"
  | "Date"
  | "Message"
  | "Status"
  | "Temperature"
  | "Module grid test"
  | "Pixel checkerboard";
export type SecondRow = "Off" | "Date" | "Message" | "Status" | "Temperature";
export type LedName = "Blood" | "Amber" | "Red" | "Green" | "Ice" | "White";

export interface Config {
  deviceName: string;
  friendlyName: string;
  timezone: string;
  clkPin: string;
  mosiPin: string;
  csPin: string;
  chips: number;
  rows: number;
  wiring: Wiring;
  rotateChip: 0 | 90 | 180 | 270;
  flipX: boolean;
  reverseEnable: boolean;
  screen: ScreenMode;
  alignment: Alignment;
  hourFormat: HourFormat;
  clockLayout: ClockLayout;
  clockFont: ClockFont;
  bloodDrips: boolean;
  showSeconds: boolean;
  secondBar: boolean;
  blinkColon: boolean;
  leadingZero: boolean;
  brightness: number;
  nightDim: boolean;
  nightBrightness: number;
  nightStart: number;
  nightEnd: number;
  displayPower: boolean;
  invert: boolean;
  messagesEnabled: boolean;
  message: string;
  messageHold: number;
  scrollSpeed: number;
  interruptOnMessage: boolean;
  pageDwell: number;
  secondRow: SecondRow;
  useHaTextSensor: boolean;
  haMessageEntity: string;
  includeTemperature: boolean;
  temperatureEntity: string;
  includeAlert: boolean;
  alertEntity: string;
  led: LedName;
  previewTemp: number;
  previewAlert: boolean;
  previewRssi: number;
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
  reverseEnable: false,
  screen: "Clock",
  alignment: "Center",
  hourFormat: "24-hour",
  clockLayout: "segment",
  clockFont: "blood-drip",
  bloodDrips: true,
  showSeconds: true,
  secondBar: true,
  blinkColon: true,
  leadingZero: true,
  brightness: 4,
  nightDim: false,
  nightBrightness: 1,
  nightStart: 23,
  nightEnd: 6,
  displayPower: true,
  invert: false,
  messagesEnabled: true,
  message: "",
  messageHold: 20,
  scrollSpeed: 80,
  interruptOnMessage: true,
  pageDwell: 8,
  secondRow: "Date",
  useHaTextSensor: false,
  haMessageEntity: "input_text.max7219_message",
  includeTemperature: false,
  temperatureEntity: "sensor.living_room_temperature",
  includeAlert: false,
  alertEntity: "input_boolean.max7219_alert",
  led: "Blood",
  previewTemp: 21,
  previewAlert: false,
  previewRssi: -58,
};
