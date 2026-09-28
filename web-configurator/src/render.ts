import { fitForPanel, fontSpec, previewFont, type FontFit } from "./fontCatalog";
import {
  alignStart,
  BUILTIN_FONT,
  drawTextLine,
  normalizeMessage,
  setPixel,
  type PreviewFont,
} from "./fonts";
import type { Config } from "./types";

export { deviceSlug, nodeId } from "./device";

/**
 * Live preview of what packages/max7219_clock_renderer.h draws.
 *
 * The rules below follow the firmware one by one: the same text formats, the
 * same font fallback chain, the same centring, the same marquee and the same
 * seconds bar. That is what makes the preview trustworthy.
 */

export type Page = "clock" | "date" | "message" | "grid" | "checkerboard" | "blank";

export interface Geometry {
  modulesX: number;
  modulesY: number;
  width: number;
  height: number;
  valid: boolean;
}

export interface Frame {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export interface Notice {
  level: "info" | "warn";
  text: string;
}

export interface Scene {
  frame: Frame;
  geometry: Geometry;
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
  if (start === end) return false;
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
  if (cfg.dateFormat === "MM/DD") return `${month}/${day}`;
  if (cfg.dateFormat === "DD/MM") return `${day}/${month}`;
  return `${day}.${month}`;
}

/** The firmware blanks the separators on odd seconds while blinking is on. */
function blinkSeconds(cfg: Config, now: Date, content: string): string {
  if (!cfg.blinkColon || now.getSeconds() % 2 === 0) return content;
  return content.replace(/:/g, " ");
}

/** Mirrors draw_line(): alignment, centring and out-of-bounds clipping. */
function drawLine(frame: Frame, font: PreviewFont, text: string, x: number, boxTop: number): void {
  drawTextLine(frame, font, text, x, boxTop);
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

/**
 * Illustration only: one digit per 8x8 module, the layout people picture when
 * they buy a six module strip. The firmware draws the clock proportionally.
 */
function paintModuleClock(frame: Frame, cfg: Config, font: PreviewFont, now: Date): void {
  const digits = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`.slice(0, 6);
  const bar = cfg.secondsMode === "Bar";
  for (let i = 0; i < 6 && i * 8 + 8 <= frame.width; i++) {
    const glyph = font.glyph(digits[i]);
    if (!glyph) continue;
    const offsetX = i * 8 + Math.max(0, Math.floor((8 - glyph.w) / 2));
    const offsetY = Math.max(0, Math.floor((8 - glyph.h) / 2));
    for (let row = 0; row < glyph.rows.length; row++) {
      for (let col = 0; col < glyph.w; col++) {
        if (glyph.rows[row] & (1 << (glyph.w - 1 - col))) setPixel(frame, offsetX + col, offsetY + row);
      }
    }
  }
  // Separators sit on the module boundary, like a real wiring diagram.
  if (!(cfg.blinkColon && now.getSeconds() % 2 === 1)) {
    const y = Math.max(1, Math.floor((8 - 4) / 2));
    for (const x of [15, 31, 47]) {
      if (x >= frame.width) continue;
      setPixel(frame, x, y);
      setPixel(frame, x, y + 3);
    }
  }
  if (bar) drawSecondsBar(frame, now.getSeconds());
}

function choosePage(cfg: Config, now: Date, messageActive: boolean): Page {
  if (messageActive) return "message";
  if (cfg.autoCycle) {
    const slot = Math.floor(now.getTime() / 1000 / Math.max(5, cfg.cycleInterval));
    return slot % 2 === 0 ? "clock" : "date";
  }
  switch (cfg.screen) {
    case "Date":
      return "date";
    case "Message":
      return "message";
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

export function renderScene(cfg: Config, now: Date, messageAt: number): Scene {
  const geo = geometry(cfg.chips, cfg.rows);
  const frame: Frame = { width: geo.width, height: geo.height, pixels: new Uint8Array(geo.width * geo.height) };
  const notices: Notice[] = [];
  const text = normalizeMessage(cfg.message);
  const age = now.getTime() - messageAt;
  const messageActive = text.length > 0 && (cfg.messageHold <= 0 || age < cfg.messageHold * 1000);
  const messageHoldLeft = cfg.messageHold <= 0 ? null : Math.max(0, Math.ceil((cfg.messageHold * 1000 - age) / 1000));

  const selected = previewFont(cfg.clockFont);
  const spec = fontSpec(cfg.clockFont);
  const fit = fitForPanel(selected, frame.width, Math.min(8, frame.height));
  const page = choosePage(cfg, now, messageActive);

  if (!geo.valid) {
    notices.push({
      level: "warn",
      text: `Module count ${cfg.chips} does not divide into ${cfg.rows} row(s). The preview falls back to a single row.`,
    });
  }
  if (fit.dropsSeconds) {
    notices.push({
      level: "warn",
      text: `${spec.label} needs ${fit.width} px for HH:MM:SS but the panel is ${frame.width} px. The firmware drops the seconds, exactly like this preview.`,
    });
  }
  if (fit.tooNarrow) {
    notices.push({
      level: "warn",
      text: `Only ${frame.width} px wide: not even the built-in 5×7 font can show HH:MM. Add modules or pick a narrower font.`,
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
        drawFreeText(frame, font, shown, cfg, Math.max(0, now.getTime() - messageAt));
      }
    } else {
      // 1. drop the seconds, 2. fall back to the built-in font (firmware order).
      const build = (): string => (page === "date" ? dateContent(now, cfg) : clockContent(now, cfg, withSeconds));
      let content = build();
      if ((font.measure(content) ?? Number.POSITIVE_INFINITY) > frame.width && withSeconds) {
        withSeconds = false;
        droppedSeconds = true;
        content = build();
      }
      if ((font.measure(content) ?? Number.POSITIVE_INFINITY) > frame.width) {
        font = BUILTIN_FONT;
        usedFallback = true;
      }
      if (cfg.layoutPreview === "modules" && page === "clock") {
        paintModuleClock(frame, cfg, font, now);
      } else {
        const shown = page === "clock" ? blinkSeconds(cfg, now, content) : content;
        const startX = alignStart(cfg.alignment, font.measure(shown) ?? 0, frame.width);
        drawLine(frame, font, shown, startX, font.boxTop(frame.height));
        if (page === "clock" && cfg.secondsMode === "Bar") drawSecondsBar(frame, now.getSeconds());
      }
    }
    if (cfg.flipX) mirror(frame);
  }

  const nightNow = cfg.nightDim && isNight(now.getHours(), cfg.nightStart, cfg.nightEnd);
  const effectiveBrightness = nightNow ? cfg.nightBrightness : cfg.brightness;

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
  };
}

function mirror(frame: Frame): void {
  for (let y = 0; y < frame.height; y++) {
    const row = y * frame.width;
    for (let x = 0; x < frame.width / 2; x++) {
      const a = row + x;
      const b = row + frame.width - 1 - x;
      const tmp = frame.pixels[a];
      frame.pixels[a] = frame.pixels[b];
      frame.pixels[b] = tmp;
    }
  }
}
