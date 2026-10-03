import { FIRMWARE, limitsFor } from "./firmware";
import { fitForPanel, fontSpec, previewFont, type FontFit } from "./fontCatalog";
import {
  alignStart,
  BUILTIN_FONT,
  drawTextLine,
  normalizeMessage,
  setPixel,
  type PixelTarget,
  type PreviewFont,
} from "./fonts";
import type { Config, PreviewWeatherCondition } from "./types";
import type { TimelineFrame } from "./previewTimeline";

export { deviceSlug, nodeId } from "./device";

/**
 * Live preview of what packages/max7219_clock_renderer.h draws.
 *
 * The rules below follow the firmware one by one: the same text formats, the
 * same font fallback chain, the same centring, the same marquee and the same
 * seconds bar. That is what makes the preview trustworthy.
 */

export type Page = "clock" | "date" | "temperature" | "message" | "grid" | "checkerboard" | "blank";

export interface Geometry {
  modulesX: number;
  modulesY: number;
  width: number;
  height: number;
  valid: boolean;
}

export interface Frame extends PixelTarget {}

export interface Notice {
  level: "info" | "warn";
  text: string;
}

/**
 * The slide-up state of one render, produced by src/digitAnimation.ts.
 * `from` is the previous content and `progress` runs 0 → 1 over the configured
 * animation duration; `{ from: null, progress: 1 }` draws the settled frame.
 */
export interface SlideFrame {
  from: string | null;
  progress: number;
}

/** One drawn character of a fixed-width text screen. */
export interface ClockCell {
  /** The character as drawn. A blinking ":" keeps its advance and loses ink. */
  char: string;
  /** Pixel column of the glyph origin. */
  x: number;
  /** Horizontal advance in pixels. */
  advance: number;
  /** Text box top of this cell; the line's `boxTop` unless it is centred alone. */
  top: number;
  /** True for digits, the only characters the firmware slides. */
  digit: boolean;
}

/** Everything needed to draw (and to animate) one fixed-width text line. */
export interface ClockLayout {
  /** The content string the cells were built from. */
  content: string;
  cells: ClockCell[];
  /** Text box top, mirroring `centered_box_top()`. */
  boxTop: number;
  /** Slide distance in pixel rows: the active font's ink height. */
  slide: number;
  /** Draw no ink for ":" — the blinking colon, without re-centring the line. */
  blankColons: boolean;
}

export interface Scene {
  frame: Frame;
  geometry: Geometry;
  /** Clock-area width after fixed side panels have been reserved. */
  clockViewportWidth: number;
  page: Page;
  font: PreviewFont;
  /** The built-in 5x7 fallback took over because the font does not fit. */
  usedFallback: boolean;
  /** Full "HH:MM:SS" is shown. */
  withSeconds: boolean;
  /** Seconds were dropped because the panel is too narrow for this font. */
  droppedSeconds: boolean;
  fit: FontFit;
  summary: string;
  detail: string;
  messageActive: boolean;
  messageHoldLeft: number | null;
  effectiveBrightness: number;
  nightNow: boolean;
  notices: Notice[];
  /** Content of the fixed-width text screens; empty for messages and patterns. */
  content: string;
  /** Per-character layout of that content, or null when nothing is drawn. */
  layout: ClockLayout | null;
  /** Slide distance in rows for the active face (its ink height). */
  slide: number;
}

export interface WeatherPanelGeometry {
  available: boolean;
  groupX: number;
  leftX: number;
  clockX: number;
  rightX: number;
  dateSafeWidth: number;
}

/** Mirrors weather_panel_geometry() in the firmware renderer. */
export function weatherPanelGeometry(width: number, height: number): WeatherPanelGeometry {
  if (width < 96 || height < 8) return { available: false, groupX: 0, leftX: 0, clockX: 0, rightX: 0, dateSafeWidth: width };
  const groupX = Math.floor((width - 96) / 2);
  return { available: true, groupX, leftX: groupX, clockX: groupX + 24, rightX: groupX + 72, dateSafeWidth: groupX + 72 };
}

/** A local-width drawing view sharing its parent pixel buffer. */
function viewport(frame: Frame, x: number, width: number): Frame {
  return {
    width,
    height: frame.height,
    pixels: frame.pixels,
    stride: frame.stride ?? frame.width,
    offsetX: (frame.offsetX ?? 0) + x,
    offsetY: frame.offsetY ?? 0,
  };
}

/** Strict decimal parser: blanks, unavailable, partial text and infinities are missing. */
export function parsePreviewTemperature(text: string): number | null {
  const clean = text.trim();
  if (!/^[+-]?(?:[0-9]+(?:[.][0-9]*)?|[.][0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

/** The dedicated outdoor sensor wins; weather.temperature is the fallback. */
export function choosePreviewOutdoorTemperature(preferred: string, weatherAttribute: string): number | null {
  const dedicated = parsePreviewTemperature(preferred);
  if (dedicated !== null) return dedicated;
  return parsePreviewTemperature(weatherAttribute);
}

/** Maps Home Assistant enums and common OpenWeatherMap condition descriptions. */
export function weatherFromCondition(raw: string): PreviewWeatherCondition {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const has = (part: string) => normalized.includes(part);
  if (!normalized || has("unknown") || has("unavailable") || normalized === "none" || has("exceptional")) return "unknown";
  if (has("thunder") || has("lightning") || has("hail")) return "thunderstorm";
  if (has("snow") || has("sleet")) return "snow";
  if (has("wind") || has("squall") || has("tornado")) return "windy";
  if (has("fog") || has("mist") || has("haze") || has("smoke") || has("dust") || has("sand") || has("ash")) return "fog";
  if (has("rain") || has("drizzle") || has("shower") || has("pour")) return "rain";
  if (has("partly cloudy") || normalized === "partlycloudy" || has("few clouds") || has("scattered clouds")) return "partlycloudy";
  if (has("cloud") || has("overcast") || has("broken clouds")) return "cloudy";
  if (has("clear night") || has("night clear")) return "clear-night";
  if (has("sunny") || has("clear")) return "clear";
  return "unknown";
}

const WEATHER_ICON_ROWS: Record<PreviewWeatherCondition, readonly number[]> = {
  clear: [0x18, 0x5a, 0x3c, 0xff, 0x3c, 0x5a, 0x18, 0x00],
  "clear-night": [0x1c, 0x38, 0x70, 0xe0, 0xe0, 0x70, 0x38, 0x1c],
  partlycloudy: [0x24, 0x18, 0x3c, 0x18, 0x00, 0x3c, 0x7e, 0x3c],
  cloudy: [0x00, 0x18, 0x3c, 0x7e, 0x42, 0x7e, 0x00, 0x00],
  fog: [0x18, 0x3c, 0x7e, 0x42, 0x7e, 0x55, 0x2a, 0x55],
  rain: [0x18, 0x3c, 0x7e, 0x42, 0x7e, 0x24, 0x12, 0x09],
  snow: [0x18, 0x3c, 0x7e, 0x42, 0x7e, 0x00, 0x2a, 0x1c],
  thunderstorm: [0x18, 0x3c, 0x7e, 0x42, 0x7e, 0x18, 0x30, 0x18],
  windy: [0x7e, 0x01, 0x00, 0x3e, 0x40, 0x00, 0x7e, 0x01],
  unknown: [0x3c, 0x42, 0x02, 0x0c, 0x10, 0x00, 0x10, 0x00],
};

export function weatherIconRows(condition: PreviewWeatherCondition, night = false): readonly number[] {
  return WEATHER_ICON_ROWS[condition === "clear" && night ? "clear-night" : condition] ?? WEATHER_ICON_ROWS.unknown;
}

function drawWeatherIcon(frame: Frame, condition: PreviewWeatherCondition, night: boolean, yOffset = 0): void {
  const rows = weatherIconRows(condition, night);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
    if (rows[y] & (0x80 >> x)) setPixel(frame, x, yOffset + y);
}

function roundedTenths(value: number): number {
  return Math.trunc(value * 10 + (value >= 0 ? 0.5 : -0.5));
}

export function formatPreviewTemperature(value: number | null, width: number): string {
  if (value === null || !Number.isFinite(value) || value < -999.9 || value > 999.9) return "--.-";
  const tenths = roundedTenths(value);
  const magnitude = Math.abs(tenths);
  const candidate = `${tenths < 0 ? "-" : ""}${Math.floor(magnitude / 10)}.${magnitude % 10}`;
  if ((BUILTIN_FONT.measure(candidate) ?? Number.POSITIVE_INFINITY) <= width) return candidate;
  const whole = Math.trunc(value + (value >= 0 ? 0.5 : -0.5)).toString();
  return (BUILTIN_FONT.measure(whole) ?? Number.POSITIVE_INFINITY) <= width ? whole : "--.-";
}

const MICRO_GLYPH_ROWS: Record<string, readonly number[]> = {
  "0": [0b111, 0b101, 0b101, 0b101, 0b111], "1": [0b010, 0b110, 0b010, 0b010, 0b111],
  "2": [0b111, 0b001, 0b111, 0b100, 0b111], "3": [0b111, 0b001, 0b111, 0b001, 0b111],
  "4": [0b101, 0b101, 0b111, 0b001, 0b001], "5": [0b111, 0b100, 0b111, 0b001, 0b111],
  "6": [0b111, 0b100, 0b111, 0b101, 0b111], "7": [0b111, 0b001, 0b010, 0b010, 0b010],
  "8": [0b111, 0b101, 0b111, 0b101, 0b111], "9": [0b111, 0b101, 0b111, 0b001, 0b111],
  "-": [0, 0, 0b111, 0, 0], ".": [0, 0, 0, 0b010, 0b010],
};

function microTextWidth(text: string): number { return [...text].reduce((sum, char) => sum + (char === "." ? 2 : 4), 0); }

export function formatMicroTemperature(value: number | null, width: number): string {
  if (value === null || !Number.isFinite(value) || value < -999.9 || value > 999.9) return "--.-";
  const candidate = Math.trunc(value + (value >= 0 ? 0.5 : -0.5)).toString();
  if (microTextWidth(candidate) <= width) return candidate;
  const whole = Math.trunc(value + (value >= 0 ? 0.5 : -0.5)).toString();
  return microTextWidth(whole) <= width ? whole : "----";
}

function drawMicroTemperature(frame: Frame, value: number | null): void {
  const text = formatMicroTemperature(value, frame.width);
  let cursor = Math.max(0, Math.trunc((frame.width - microTextWidth(text)) / 2));
  const top = Math.max(0, Math.trunc((frame.height - 5) / 2));
  for (const char of text) {
    const rows = MICRO_GLYPH_ROWS[char] ?? [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++)
      if (rows[y] & (1 << (2 - x))) setPixel(frame, cursor + x, top + y);
    cursor += char === "." ? 2 : 4;
  }
}

function drawHomeTemperaturePanel(frame: Frame, x: number, value: number | null): void {
  drawMicroTemperature(viewport(frame, x, 24), value);
}

export function drawWeatherPanel(frame: Frame, x: number, condition: PreviewWeatherCondition, night: boolean,
                                 temperature: number | null, showIcon: boolean, showTemperature: boolean): void {
  if (!showIcon && !showTemperature) return;
  const panel = viewport(frame, x, 24);
  const top = Math.max(0, Math.trunc((panel.height - 8) / 2));
  if (showIcon && showTemperature) {
    drawWeatherIcon(viewport(panel, 0, 8), condition, night, top);
    drawMicroTemperature(viewport(panel, 8, 16), temperature);
  } else if (showIcon) {
    const icon = viewport(panel, 8, 8);
    drawWeatherIcon(icon, condition, night, top);
  } else {
    drawMicroTemperature(panel, temperature);
  }
}

export function geometry(chips: number, rows: number): Geometry {
  const safeChips = Math.max(1, Math.min(16, Math.round(chips)));
  const safeRows = Math.max(1, Math.min(4, Math.round(rows)));
  const valid = safeChips % safeRows === 0 && safeChips >= safeRows;
  const modulesY = valid ? safeRows : 1;
  const modulesX = Math.max(1, Math.floor(safeChips / modulesY));
  return {
    modulesX,
    modulesY,
    width: modulesX * 8,
    height: modulesY * 8,
    valid,
  };
}

export function isNight(hour: number, start: number, end: number): boolean {
  // The firmware treats equal start/end hours as an all-day night window
  // (housekeeping(): night_start_hour == night_end_hour -> in_window = true).
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** The firmware's build_content() for the clock screen. */
export function clockContent(now: Date, cfg: Config, withSeconds: boolean): string {
  const hour24 = now.getHours();
  let hour = hour24;
  let blankLeading = false;
  if (cfg.hourFormat === "12-hour") {
    hour = hour24 % 12;
    if (hour === 0) hour = 12;
    blankLeading = hour < 10;
  }
  const head = blankLeading ? ` ${hour}` : pad(hour);
  const tail = withSeconds ? `:${pad(now.getMinutes())}:${pad(now.getSeconds())}` : `:${pad(now.getMinutes())}`;
  return `${head}${tail}`;
}

/** The firmware's build_content() for the date screen. */
export function dateContent(now: Date, cfg: Config): string {
  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = pad(now.getFullYear() % 100);
  const weekday = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][now.getDay()];
  const monthName = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][now.getMonth()];
  if (cfg.dateFormat === "MM/DD") return `${month}/${day}`;
  if (cfg.dateFormat === "DD/MM") return `${day}/${month}`;
  if (cfg.dateFormat === "DD.MM.YY") return `${day}.${month}.${year}`;
  if (cfg.dateFormat === "Weekday DD.MM.YY") return `${weekday} ${day}.${month}.${year}`;
  if (cfg.dateFormat === "Weekday DD. MMM YY") return `${weekday} ${day}. ${monthName} ${year}`;
  if (cfg.dateFormat === "Weekday MMM.DD") return `${weekday} ${monthName}.${day}`;
  return `${day}.${month}`;
}

/** Mirrors draw_line(): alignment, centring and out-of-bounds clipping. */
function drawLine(frame: Frame, font: PreviewFont, text: string, x: number, boxTop: number): void {
  drawTextLine(frame, font, text, x, boxTop);
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

/**
 * Walks a content string exactly like the firmware's draw_line(): one cell per
 * character, positioned by the font's own advances and centred as a whole.
 * The cells are what makes the per-digit slide possible — each digit knows its
 * own columns, so a changing digit can move while its neighbours stay put.
 */
export function clockLayout(
  content: string,
  font: PreviewFont,
  frame: Frame,
  alignment: Config["alignment"],
  blankColons: boolean,
): ClockLayout {
  const width = font.measure(content) ?? 0;
  // draw_line() clamps a negative start to 0, so a right-aligned line that is
  // wider than the panel starts at the left edge instead of running off it.
  const startX = Math.max(0, alignStart(alignment, width, frame.width));
  const boxTop = font.boxTop(frame.height);
  const cells: ClockCell[] = [];
  let cursor = startX;
  for (const char of content) {
    const advance = font.advance(char);
    cells.push({ char, x: cursor, advance, top: boxTop, digit: isDigit(char) });
    cursor += advance;
  }
  return { content, cells, boxTop, slide: font.inkHeight, blankColons };
}

/**
 * Draws the cells, sliding only the digits that changed — the browser twin of
 * draw_line(): the outgoing digit travels up, the incoming digit arrives from
 * below, every other character (including the colons) is drawn in place.
 */
export function drawCells(
  frame: Frame,
  font: PreviewFont,
  layout: ClockLayout,
  slide: SlideFrame = { from: null, progress: 1 },
  animationRowGap = 0,
): void {
  const animate =
    slide.from !== null &&
    slide.progress < 1 &&
    slide.from.length === layout.content.length &&
    layout.cells.length === layout.content.length;
  const from = slide.from ?? "";
  layout.cells.forEach((cell, index) => {
    const previous = from[index];
    const changed = animate && cell.digit && isDigit(previous) && cell.char !== previous;
    if (changed) {
      const travel = layout.slide + animationRowGap;
      // Match C++ float rounding at integer-row boundaries and ClipCanvas.
      const offset = Math.trunc(Math.fround(Math.fround(Math.min(1, Math.max(0, slide.progress))) * travel));
      const clipped = { ...frame, clip: { x: cell.x, y: cell.top + font.inkTop, width: cell.advance, height: font.inkHeight } };
      font.drawGlyph(clipped, previous, cell.x, cell.top - offset);
      font.drawGlyph(clipped, cell.char, cell.x, cell.top + travel - offset);
      return;
    }
    if (layout.blankColons && cell.char === ":") return;
    font.drawGlyph(frame, cell.char, cell.x, cell.top);
  });
}

function drawSecondsBar(frame: Frame, second: number): void {
  const lit = Math.floor((frame.width * second) / 60);
  if (lit <= 0) return;
  for (let x = 0; x < Math.min(lit, frame.width); x++) setPixel(frame, x, frame.height - 1);
}

/** Mirrors draw_free_text(): centred, clipped, or marquee. */
function drawFreeText(
  frame: Frame,
  font: PreviewFont,
  text: string,
  cfg: Config,
  elapsedMs: number,
): void {
  const textWidth = font.measure(text) ?? frame.width;
  const boxTop = font.boxTop(frame.height);
  if (textWidth <= frame.width) {
    drawLine(frame, font, text, alignStart("Center", textWidth, frame.width), boxTop);
    return;
  }
  if (cfg.scrollMode === "Static") {
    drawLine(frame, font, text, 0, boxTop);
    return;
  }
  const perPixel = Math.max(1, cfg.scrollSpeed);
  const loopWidth = textWidth + frame.width;
  const offset = Math.floor(elapsedMs / perPixel) % loopWidth;
  const originX = offset < textWidth ? -offset : frame.width - (offset - textWidth);
  drawLine(frame, font, text, originX, boxTop);
}

function paintGrid(frame: Frame, geo: Geometry): void {
  for (let my = 0; my < geo.modulesY; my++) {
    for (let mx = 0; mx < geo.modulesX; mx++) {
      const x = mx * 8;
      const y = my * 8;
      for (let i = 0; i < 8; i++) {
        setPixel(frame, x + i, y);
        setPixel(frame, x + i, y + 7);
        setPixel(frame, x, y + i);
        setPixel(frame, x + 7, y + i);
      }
      setPixel(frame, x + 2, y + 2);
    }
  }
}

function paintChecker(frame: Frame): void {
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      if ((x + y) % 2 === 0) setPixel(frame, x, y);
    }
  }
}

function choosePage(screen: Config["screen"], messageActive: boolean): Page {
  if (messageActive) return "message";
  switch (screen) {
    case "Date":
      return "date";
    case "Temperature":
      return "temperature";
    case "Message":
      return "clock";
    case "Module grid test":
      return "grid";
    case "Pixel checkerboard":
      return "checkerboard";
    default:
      return "clock";
  }
}

function pageLabel(page: Page): string {
  switch (page) {
    case "clock":
      return "the clock";
    case "date":
      return "the date";
    case "temperature":
      return "the temperature";
    case "message":
      return "the message";
    case "grid":
      return "the module grid test";
    case "checkerboard":
      return "the pixel checkerboard";
    default:
      return "a blank screen";
  }
}

/**
 * Renders one preview frame.
 *
 * `slide` is optional: pass the frame produced by src/digitAnimation.ts to draw
 * the per-digit slide-up, or leave it out for the settled frame.
 */
export function renderScene(
  cfg: Config,
  now: Date,
  messageAt: number,
  slide: SlideFrame = { from: null, progress: 1 },
  runtimeNowMs = now.getTime(),
  timeline?: TimelineFrame,
): Scene {
  const geo = geometry(cfg.chips, cfg.rows);
  const frame: Frame = { width: geo.width, height: geo.height, pixels: new Uint8Array(geo.width * geo.height) };
  const notices: Notice[] = [];
  const text = timeline?.message ?? normalizeMessage(cfg.message);
  const age = timeline?.messageAgeMs ?? Math.max(0, runtimeNowMs - messageAt);
  const messageActive = timeline?.messageActive ??
    (text.length > 0 && (cfg.messageHold <= 0 || age < cfg.messageHold * 1000));
  const messageHoldLeft = timeline
    ? timeline.messageHoldLeft
    : cfg.messageHold <= 0 ? null : Math.max(0, Math.ceil((cfg.messageHold * 1000 - age) / 1000));
  const selectedScreen = timeline?.screen ?? cfg.screen;

  const selected = previewFont(cfg.clockFont);
  const spec = fontSpec(cfg.clockFont);
  const panels = weatherPanelGeometry(frame.width, frame.height);
  const clockViewportWidth = panels.available ? 48 : frame.width;
  const fit = fitForPanel(selected, clockViewportWidth, Math.min(8, frame.height));
  const page = choosePage(selectedScreen, messageActive);

  if (!geo.valid) {
    notices.push({
      level: "warn",
      text: `Module count ${cfg.chips} does not divide into ${cfg.rows} row(s). The preview falls back to a single row.`,
    });
  }
  if (fit.dropsSeconds) {
    notices.push({
      level: "warn",
      text: `${spec.label} needs ${fit.width} px for HH:MM:SS but the clock area is ${clockViewportWidth} px. The firmware drops the seconds, exactly like this preview.`,
    });
  }
  if (fit.tooNarrow) {
    notices.push({
      level: "warn",
      text: `Only ${clockViewportWidth} px in the clock area: not even the built-in 5×7 font can show HH:MM. Add modules or pick a narrower font.`,
    });
  }
  if (fit.usesBottomRow && cfg.secondsMode === "Bar") {
    notices.push({
      level: "info",
      text: `${spec.label} fills all 8 rows, so the seconds bar is drawn under the digits. Choose the Digits seconds mode for a cleaner look.`,
    });
  }
  if (page === "message" && text.length === 0 && cfg.screen === "Message") {
    notices.push({ level: "info", text: "The Message screen shows whatever the last show_message action sent. Nothing is queued here." });
  }

  let usedFallback = false;
  let withSeconds = cfg.secondsMode === "Digits" && page === "clock";
  let droppedSeconds = false;
  let layout: ClockLayout | null = null;
  let content = "";

  if (cfg.displayPower) {
    let font = selected;
    if (page === "grid") paintGrid(frame, geo);
    else if (page === "checkerboard") paintChecker(frame);
    else if (page === "message") {
      const shown = text.length > 0 ? text : "";
      if (shown) {
        if (font.measure(shown) === null) {
          font = BUILTIN_FONT;
          usedFallback = true;
        }
        drawFreeText(frame, font, shown, cfg, age);
      }
    } else {
      let contentFrame = frame;
      const condition = weatherFromCondition(cfg.previewWeatherCondition);
      const weatherNight = condition === "clear-night" ||
        (condition === "clear" && (now.getHours() < 6 || now.getHours() >= 19));
      const homeTemperature = parsePreviewTemperature(cfg.previewHomeTemperature);
      const outdoorTemperature = choosePreviewOutdoorTemperature(cfg.previewOutdoorTemperature, cfg.previewWeatherTemperature);
      if (page === "clock" && panels.available) {
        contentFrame = viewport(frame, panels.clockX, 48);
        if (cfg.clockLayout === "Clock + home and outdoor weather")
          drawHomeTemperaturePanel(frame, panels.leftX, homeTemperature);
        if (cfg.clockLayout === "Clock + weather icon")
          drawWeatherPanel(frame, panels.rightX, condition, weatherNight, outdoorTemperature, true, false);
        else if (cfg.clockLayout === "Clock + home and outdoor weather")
          drawWeatherPanel(frame, panels.rightX, condition, weatherNight, outdoorTemperature, true, true);
      } else if (page === "date" && panels.available && (cfg.dateShowWeatherIcon || cfg.dateShowOutdoorTemperature)) {
        contentFrame = viewport(frame, 0, panels.dateSafeWidth);
        drawWeatherPanel(frame, panels.rightX, condition, weatherNight, outdoorTemperature,
          cfg.dateShowWeatherIcon, cfg.dateShowOutdoorTemperature);
      }

      // 1. drop the seconds, 2. fall back to the built-in font (firmware order).
      const build = (): string => page === "date" ? dateContent(now, cfg) : page === "temperature" ? "--.-" : clockContent(now, cfg, withSeconds);
      content = build();
      if ((font.measure(content) ?? Number.POSITIVE_INFINITY) > contentFrame.width && withSeconds) {
        withSeconds = false;
        droppedSeconds = true;
        content = build();
      }
      if ((font.measure(content) ?? Number.POSITIVE_INFINITY) > contentFrame.width) {
        font = BUILTIN_FONT;
        usedFallback = true;
      }
      if (page === "date" && (font.measure(content) ?? Number.POSITIVE_INFINITY) > contentFrame.width) {
        drawFreeText(contentFrame, font, content, { ...cfg, scrollMode: "Scroll", scrollSpeed: cfg.dateScrollSpeed }, age);
      } else {
        const blankColons = page === "clock" && cfg.blinkColon && now.getSeconds() % 2 === 1;
        layout = clockLayout(content, font, contentFrame, cfg.alignment, blankColons);
        const activeSlide = cfg.digitAnimation && cfg.animationMs > 0 ? slide : { from: null, progress: 1 };
        drawCells(contentFrame, font, layout, activeSlide, cfg.animationRowGap);
        if (page === "clock" && cfg.secondsMode === "Bar") drawSecondsBar(contentFrame, now.getSeconds());
      }
    }
    driverTransform(frame, cfg.rotateChip, cfg.flipX, cfg.reverseEnable);
  }
  if (layout !== null) content = layout.content;

  const nightNow = cfg.nightManual || (cfg.nightDim && isNight(now.getHours(), cfg.nightStart, cfg.nightEnd));
  const brightnessClock = timeline?.nowMs ?? (runtimeNowMs >>> 0);
  const effectiveBrightness = cfg.alarmMode ? (Math.floor(brightnessClock / FIRMWARE.renderer.alarmPeriodMs) % 2 === 1 ? limitsFor("brightness").max : limitsFor("brightness").min) : nightNow ? cfg.nightBrightness : cfg.brightness;

  let summary = "Display power is off.";
  let detail = "The MAX7219 is held in shutdown, so no pixels are driven.";
  if (cfg.displayPower) {
    if (page === "grid" || page === "checkerboard") {
      summary = `Test pattern: ${pageLabel(page)}.`;
      detail = "Both patterns come straight from the firmware, so they prove wiring, rotation, and row order.";
    } else if (page === "message") {
      summary = text ? `Message: “${text}”.` : "Message screen, nothing queued.";
      detail = messageActive
        ? `Active for ${messageHoldLeft}s, then the previous screen returns.`
        : "The last message expired. Send one again, or set the hold to 0 to keep it until it is cleared.";
    } else if (page === "clock") {
      const seconds = droppedSeconds ? "seconds dropped, the panel is too narrow for this font" : withSeconds ? "full-size HH:MM:SS" : "HH:MM";
      summary = usedFallback
        ? `Clock with the built-in 5×7 fallback (${seconds}).`
        : `Clock in ${spec.label} (${seconds}).`;
      detail = `${cfg.hourFormat} format, ${cfg.alignment.toLowerCase()} aligned, ${
        cfg.secondsMode === "Bar" ? "seconds as a bottom-row bar" : withSeconds ? "seconds as digits" : "seconds off"
      }.`;
    } else {
      summary = `Showing ${pageLabel(page)} in ${spec.label}.`;
      detail = `${cfg.dateFormat} date format, ${cfg.alignment.toLowerCase()} aligned.`;
    }
  }

  return {
    frame,
    geometry: geo,
    clockViewportWidth,
    page,
    font: selected,
    usedFallback,
    withSeconds,
    droppedSeconds,
    fit,
    summary,
    detail,
    messageActive,
    messageHoldLeft,
    effectiveBrightness,
    nightNow,
    notices,
    content,
    layout,
    slide: layout?.slide ?? 0,
  };
}

/** MAX7219 2026.9.1 send64pixels(): flip local X before per-chip rotation. */
export function driverTransform(frame: Frame, rotation: number, flipX: boolean, reverseChain = false): void {
  if (rotation === 0 && !flipX && !reverseChain) return;
  const source = frame.pixels.slice();
  frame.pixels.fill(0);
  for (let my = 0; my < frame.height; my += 8) for (let mx = 0; mx < frame.width; mx += 8) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const sourceX = reverseChain ? frame.width - mx - 8 + x : mx + x;
      if (!source[(my + y) * frame.width + sourceX]) continue;
      const xx = flipX ? 7 - x : x;
      const [dx, dy] = rotation === 90 ? [7-y, xx] : rotation === 180 ? [7-xx, 7-y] : rotation === 270 ? [y, 7-xx] : [xx, y];
      setPixel(frame, mx + dx, my + dy);
    }
  }
}

/** Status-frame oracle mirrors the firmware; text templates are extracted from C++. */
export function renderStatusFrame(width: number, height: number, status: { type: "boot"; version: string; elapsedMs: number } | { type: "ota"; state: number; percent: number; error: number }): Frame {
  const frame = { width, height, pixels: new Uint8Array(width * height) };
  if (status.type === "boot") {
    const text = FIRMWARE.renderer.bootPrefix + status.version;
    drawFreeText(frame, BUILTIN_FONT, text, { scrollMode: "Scroll", scrollSpeed: FIRMWARE.renderer.bootScrollMs } as Config, status.elapsedMs);
    return frame;
  }
  const key = Object.keys(FIRMWARE.renderer.otaStates).find((name) => FIRMWARE.renderer.otaStates[name] === status.state);
  if (!key) return frame;
  const templates = FIRMWARE.renderer.otaTemplates[key] ?? [];
  const percent = Number.isFinite(status.percent) ? Math.trunc(Math.max(0, Math.min(FIRMWARE.renderer.progressMax, status.percent))) : 0;
  const value = key === "OTA_UPLOADING" ? percent : status.error;
  let content = "";
  for (const template of templates) {
    content = template.replace(/%u/g, String(value)).replace(/%%/g, "%");
    if ((BUILTIN_FONT.measure(content) ?? 0) <= width) break;
  }
  const bar = FIRMWARE.renderer.otaBarStates.includes(key);
  const top = bar ? Math.max(0, Math.trunc((height - 1 - BUILTIN_FONT.inkHeight) / 2)) - BUILTIN_FONT.inkTop : BUILTIN_FONT.boxTop(height);
  drawLine(frame, BUILTIN_FONT, content, Math.max(0, alignStart("Center", BUILTIN_FONT.measure(content) ?? 0, width)), top);
  if (bar) for (let x = 0; x < Math.floor(width * percent / FIRMWARE.renderer.progressMax); x++) setPixel(frame, x, height - 1);
  return frame;
}
