import { BLOOD_BOLD_5X7, BLOOD_DRIP_5X7, DIGITS_5X7, FONT_3X5, glyphIndex, normalizeMessage, textWidth3 } from "./fonts";
import type { Config } from "./types";

export type Page = "clock" | "date" | "message" | "status" | "temp" | "grid" | "checker" | "off";

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

export type ClockStyleLabel =
  | "1 num/seg (Tiny5 preview)"
  | "1 num/seg (Press Start 2P preview)"
  | "1 num/seg (Compact 5x7)"
  | "5×7"
  | "3×5"
  | "3×5 tight";

export interface Scene {
  frame: Frame;
  geometry: Geometry;
  page: Page;
  bottom: Page;
  split: boolean;
  withSeconds: boolean;
  clockStyle: ClockStyleLabel;
  summary: string;
  detail: string;
  messageActive: boolean;
  effectiveBrightness: number;
  nightNow: boolean;
  fontNote: string;
}

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

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

export function deviceSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 31);
  return slug || "max7219-clock";
}

export function nodeId(name: string): string {
  return deviceSlug(name).replace(/-/g, "_");
}

export function clockMetrics(width: number, bandH: number, withSeconds: boolean) {
  if (withSeconds) {
    if (width >= 39 && bandH >= 7) return { style: 0 as const, clockW: 39, adv: 6 };
    if (width >= 27) return { style: 1 as const, clockW: 27, adv: 4 };
    return { style: 2 as const, clockW: 22, adv: 3 };
  }
  if (width >= 25 && bandH >= 7) return { style: 0 as const, clockW: 25, adv: 6 };
  if (width >= 17) return { style: 1 as const, clockW: 17, adv: 4 };
  return { style: 2 as const, clockW: 14, adv: 3 };
}

function styleName(style: 0 | 1 | 2, cfg: Config, isSegment: boolean): ClockStyleLabel {
  if (isSegment) {
    if (cfg.clockFont === "blood-drip") return "1 num/seg (Tiny5 preview)";
    if (cfg.clockFont === "blood-bold") return "1 num/seg (Press Start 2P preview)";
    return "1 num/seg (Compact 5x7)";
  }
  if (style === 0) return "5×7";
  if (style === 1) return "3×5";
  return "3×5 tight";
}

function setPixel(frame: Frame, x: number, y: number, value = 1) {
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return;
  frame.pixels[y * frame.width + x] = value;
}

function drawDigitStyled(frame: Frame, digit: number, x: number, y: number, font: Config["clockFont"]) {
  const rows =
    font === "blood-drip"
      ? BLOOD_DRIP_5X7[digit]
      : font === "blood-bold"
        ? BLOOD_BOLD_5X7[digit]
        : DIGITS_5X7[digit];
  if (!rows) return;
  for (let row = 0; row < 7; row++) {
    const bits = rows[row];
    for (let col = 0; col < 5; col++) {
      if (bits & (1 << (4 - col))) setPixel(frame, x + col, y + row);
    }
  }
}

function drawGlyph3(frame: Frame, ch: string, x: number, y: number) {
  const rows = FONT_3X5[ch.toUpperCase()];
  if (!rows) return;
  for (let row = 0; row < 5; row++) {
    const bits = rows[row];
    for (let col = 0; col < 3; col++) {
      if (bits & (1 << (2 - col))) setPixel(frame, x + col, y + row);
    }
  }
}

function drawText3(frame: Frame, text: string, x: number, y: number, advance = 4) {
  let cursor = x;
  for (const ch of text) {
    if (glyphIndex(ch) < 0) continue;
    drawGlyph3(frame, ch, cursor, y);
    cursor += advance;
  }
}

function drawDash(frame: Frame, x: number, y: number, style: 0 | 1 | 2) {
  const len = style === 0 ? 4 : 3;
  const yy = y + (style === 0 ? 3 : 2);
  for (let col = 0; col < len; col++) setPixel(frame, x + col, yy);
}

function paintClock(
  frame: Frame,
  cfg: Config,
  now: Date,
  bandY: number,
  bandH: number,
  withSeconds: boolean,
  timeOk: boolean,
) {
  const hour24 = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();
  let hour = hour24;
  if (cfg.hourFormat === "12-hour") {
    hour = hour24 % 12;
    if (hour === 0) hour = 12;
  }
  const blinkOff = cfg.blinkColon && second % 2 === 1;
  const invalidBlink = !timeOk && Math.floor(now.getTime() / 400) % 2 === 1;

  const isSegmentMode =
    cfg.clockLayout === "segment" &&
    ((withSeconds && frame.width >= 48) || (!withSeconds && frame.width >= 32));

  // --- 1 NUMBER PER SEGMENT MODE (6 numbers on 6 segments: 00:00:00) ---
  if (isSegmentMode) {
    const digitH = 7;
    const bar = cfg.secondBar && bandH >= 8;
    const originY = bar ? bandY : bandY + Math.max(0, Math.floor((bandH - digitH) / 2));

    const dH1 = Math.floor(hour / 10);
    const dH2 = hour % 10;
    const dM1 = Math.floor(minute / 10);
    const dM2 = minute % 10;
    const dS1 = Math.floor(second / 10);
    const dS2 = second % 10;
    const blankTens = timeOk && !cfg.leadingZero && hour < 10;

    const drawSegDigit = (segIdx: number, value: number, blank: boolean) => {
      const x = segIdx * 8 + 1;
      if (blank) return;
      if (!timeOk) {
        drawDash(frame, x, originY, 0);
        return;
      }
      drawDigitStyled(frame, value, x, originY, cfg.clockFont);
    };

    // Segment 0: Hours tens
    drawSegDigit(0, dH1, blankTens);
    // Segment 1: Hours units
    drawSegDigit(1, dH2, false);

    // Separator colon 1 at the right edge of Segment 1 (x = 15)
    if (!blinkOff && !invalidBlink) {
      setPixel(frame, 15, originY + 2);
      setPixel(frame, 15, originY + 5);
      if (cfg.bloodDrips && cfg.clockFont === "blood-drip") {
        setPixel(frame, 15, originY + 6, 2);
      }
    }

    // Segment 2: Minutes tens
    drawSegDigit(2, dM1, false);
    // Segment 3: Minutes units
    drawSegDigit(3, dM2, false);

    if (withSeconds && frame.width >= 48) {
      // Separator colon 2 at the right edge of Segment 3 (x = 31)
      if (!blinkOff && !invalidBlink) {
        setPixel(frame, 31, originY + 2);
        setPixel(frame, 31, originY + 5);
        if (cfg.bloodDrips && cfg.clockFont === "blood-drip") {
          setPixel(frame, 31, originY + 6, 2);
        }
      }

      // Segment 4: Seconds tens
      drawSegDigit(4, dS1, false);
      // Segment 5: Seconds units
      drawSegDigit(5, dS2, false);

      // Blood drip droplets animation on the seconds unit segment
      if (cfg.bloodDrips && cfg.clockFont === "blood-drip" && timeOk) {
        if (second % 2 === 0) {
          setPixel(frame, 45, originY + 6, 2);
        }
      }
    }

    if (timeOk && cfg.hourFormat === "12-hour" && hour24 >= 12) {
      const pmX = withSeconds && frame.width >= 48 ? 47 : 31;
      setPixel(frame, pmX, originY, 1);
    }

    if (bar && timeOk) {
      const barY = bandY + 7;
      if (barY < bandY + bandH) {
        const lit = Math.max(1, Math.floor(((second + 1) * frame.width) / 60));
        let head = 0;
        for (let x = 0; x < lit && x < frame.width; x++) {
          // Leave gap at every 8-pixel segment boundary for clear segment separation
          if (x > 0 && x % 8 === 7 && x < frame.width - 1) continue;
          setPixel(frame, x, barY, 1);
          head = x;
        }
        setPixel(frame, head, barY, 2);
      }
    }

    return {
      style: 0 as const,
      clockW: withSeconds && frame.width >= 48 ? 48 : 32,
      adv: 8,
      isSegment: true,
    };
  }

  // --- COMPACT PROPORTIONAL CLOCK MODE ---
  const metrics = clockMetrics(frame.width, bandH, withSeconds);
  const { style, clockW, adv } = metrics;
  const digitH = style === 0 ? 7 : 5;
  const bar = cfg.secondBar && bandH >= 8 && digitH < bandH;
  let originY = bandY + Math.max(0, Math.floor((bandH - digitH) / 2));
  if (bar) originY = style === 0 ? bandY : bandY + 1;

  let startX = Math.floor((frame.width - clockW) / 2);
  if (cfg.alignment === "Left") startX = 0;
  if (cfg.alignment === "Right") startX = frame.width - clockW;
  startX = Math.max(0, startX);

  const drawDigit = (x: number, value: number, blank: boolean) => {
    if (blank) return;
    if (!timeOk) {
      drawDash(frame, x, originY, style);
      return;
    }
    if (style === 0) drawDigitStyled(frame, value, x, originY, cfg.clockFont);
    else drawGlyph3(frame, String(value), x, originY);
  };
  const colon = (x: number) => {
    if (blinkOff || invalidBlink) return;
    if (style === 0) {
      setPixel(frame, x, originY + 2);
      setPixel(frame, x, originY + 5);
      if (cfg.bloodDrips && cfg.clockFont === "blood-drip") {
        setPixel(frame, x, originY + 6, 2);
      }
    } else {
      setPixel(frame, x, originY + 1);
      setPixel(frame, x, originY + 3);
    }
  };

  let cursor = startX;
  const blankTens = timeOk && !cfg.leadingZero && hour < 10;
  drawDigit(cursor, Math.floor(hour / 10), blankTens);
  cursor += adv;
  drawDigit(cursor, hour % 10, false);
  cursor += adv;
  colon(cursor);
  cursor += 2;
  drawDigit(cursor, Math.floor(minute / 10), false);
  cursor += adv;
  drawDigit(cursor, minute % 10, false);
  if (withSeconds) {
    cursor += adv;
    colon(cursor);
    cursor += 2;
    drawDigit(cursor, Math.floor(second / 10), false);
    cursor += adv;
    drawDigit(cursor, second % 10, false);
  }

  if (timeOk && cfg.hourFormat === "12-hour" && hour24 >= 12) {
    let pmX = startX + clockW + 1;
    if (pmX >= frame.width) pmX = startX - 2;
    if (pmX >= 0 && pmX < frame.width) setPixel(frame, pmX, originY);
  }

  if (bar && timeOk) {
    const barY = bandY + 7;
    if (barY < bandY + bandH) {
      const lit = Math.max(1, Math.floor(((second + 1) * frame.width) / 60));
      let head = 0;
      for (let x = 0; x < lit && x < frame.width; x++) {
        const bucket = Math.floor((x * 60) / frame.width);
        const prev = x === 0 ? -1 : Math.floor(((x - 1) * 60) / frame.width);
        if (x > 0 && bucket !== prev && bucket % 10 === 0) continue;
        setPixel(frame, x, barY, 1);
        head = x;
      }
      setPixel(frame, head, barY, 2);
    }
  }
  return { ...metrics, isSegment: false };
}

function paintMessage(frame: Frame, text: string, bandY: number, bandH: number, scrollPx: number, tick: boolean, second: number) {
  const shown = text.length > 0 ? text : "NO MESSAGE";
  const tw = textWidth3(shown, 4);
  const y = bandY + Math.max(0, Math.floor((Math.min(bandH, 8) - 5) / 2));
  if (tw <= frame.width) {
    drawText3(frame, shown, Math.floor((frame.width - tw) / 2), y);
  } else {
    const cycle = tw + frame.width + 4;
    const pos = ((scrollPx % cycle) + cycle) % cycle;
    drawText3(frame, shown, frame.width - pos, y);
  }
  if (tick && bandH >= 8) {
    const pos = Math.floor((second * frame.width) / 60);
    setPixel(frame, Math.min(frame.width - 1, pos), bandY + Math.min(bandH, 8) - 1, 2);
  }
}

function paintDate(frame: Frame, now: Date, bandY: number, bandH: number, timeOk: boolean) {
  let text = "NO TIME";
  if (timeOk) {
    const day = DAYS[now.getDay()];
    const date = String(now.getDate()).padStart(2, "0");
    text = frame.width >= 44 ? `${day} ${date} ${MONTHS[now.getMonth()]}` : `${day} ${date}`;
  }
  const tw = textWidth3(text);
  const y = bandY + Math.max(0, Math.floor((Math.min(bandH, 8) - 5) / 2));
  drawText3(frame, text, Math.max(0, Math.floor((frame.width - tw) / 2)), y);
}

function rssiBars(rssi: number): number {
  if (Number.isNaN(rssi)) return 0;
  if (rssi > -55) return 4;
  if (rssi > -67) return 3;
  if (rssi > -75) return 2;
  if (rssi > -85) return 1;
  return 0;
}

function paintStatus(frame: Frame, bandY: number, bandH: number, rssi: number, timeOk: boolean) {
  const bars = rssiBars(rssi);
  const base = bandY + Math.min(bandH, 8) - 2;
  for (let b = 0; b < 4; b++) {
    const bh = b + 2;
    for (let yy = 0; yy < bh; yy++) {
      if (b < bars) setPixel(frame, b * 2, base - yy);
    }
  }
  const text = Number.isNaN(rssi) ? "WIFI" : String(Math.round(rssi));
  const y = bandY + Math.max(0, Math.floor((Math.min(bandH, 8) - 5) / 2));
  drawText3(frame, text, 10, y);
  if (timeOk) setPixel(frame, frame.width - 2, bandY + 1);
}

function paintTemp(frame: Frame, bandY: number, bandH: number, temp: number | null) {
  const text = temp === null || Number.isNaN(temp) ? "NO TEMP" : `${Math.round(temp)}C`;
  const tw = textWidth3(text);
  const y = bandY + Math.max(0, Math.floor((Math.min(bandH, 8) - 5) / 2));
  drawText3(frame, text, Math.max(0, Math.floor((frame.width - tw) / 2)), y);
}

function paintGrid(frame: Frame) {
  for (let y = 0; y < frame.height; y += 8) {
    for (let x = 0; x < frame.width; x += 8) {
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

function paintChecker(frame: Frame) {
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      if ((x + y) % 2 === 0) setPixel(frame, x, y);
    }
  }
}

function mirror(frame: Frame) {
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

interface Decision {
  page: Page;
  bottom: Page;
  split: boolean;
  withSeconds: boolean;
  messageActive: boolean;
}

function rowPage(row: Config["secondRow"]): Page {
  if (row === "Date") return "date";
  if (row === "Message") return "message";
  if (row === "Status") return "status";
  if (row === "Temperature") return "temp";
  return "off";
}

function decide(cfg: Config, now: Date, messageAt: number, geo: Geometry): Decision {
  const text = normalizeMessage(cfg.message);
  const age = now.getTime() - messageAt;
  const messageActive =
    cfg.messagesEnabled && text.length > 0 && (cfg.messageHold <= 0 || age < cfg.messageHold * 1000);
  const tall = geo.height >= 16;
  const dwell = Math.max(2, cfg.pageDwell);
  const cycle: Page[] = ["clock", "date", "status"];
  if (cfg.includeTemperature) cycle.push("temp");
  const slot = Math.floor(now.getTime() / 1000 / dwell) % cycle.length;
  const autoPage = cycle[slot];
  const screen = cfg.screen;

  const explicit: Page | null =
    screen === "Date"
      ? "date"
      : screen === "Message"
        ? "message"
        : screen === "Status"
          ? "status"
          : screen === "Temperature"
            ? "temp"
            : screen === "Module grid test"
              ? "grid"
              : screen === "Pixel checkerboard"
                ? "checker"
                : null;

  if (explicit) {
    return { page: explicit, bottom: "off", split: false, withSeconds: cfg.showSeconds, messageActive };
  }

  const withSeconds = screen === "Clock with seconds" || cfg.showSeconds;
  const clockLike = screen === "Auto" || screen === "Clock" || screen === "Clock with seconds";
  const interrupt = messageActive && cfg.interruptOnMessage && clockLike;

  if (!tall) {
    let page: Page = "clock";
    if (screen === "Auto") page = interrupt ? "message" : autoPage;
    else if (interrupt) page = "message";
    return { page, bottom: "off", split: false, withSeconds, messageActive };
  }

  let bottom = rowPage(cfg.secondRow);
  if (screen === "Auto") {
    const bottomSlots = cycle.filter((page) => page !== "clock");
    if (messageActive && !interrupt) bottomSlots.push("message");
    bottom = bottomSlots[slot % bottomSlots.length] ?? "date";
  }
  if (interrupt) bottom = "message";

  return { page: "clock", bottom, split: true, withSeconds, messageActive };
}

function pageLabel(page: Page): string {
  switch (page) {
    case "clock":
      return "clock";
    case "date":
      return "date";
    case "message":
      return "message";
    case "status":
      return "Wi-Fi status";
    case "temp":
      return "temperature";
    case "grid":
      return "module grid test";
    case "checker":
      return "checkerboard";
    default:
      return "blank";
  }
}

export function renderScene(cfg: Config, now: Date, messageAt: number): Scene {
  const geo = geometry(cfg.chips, cfg.rows);
  const frame: Frame = {
    width: geo.width,
    height: geo.height,
    pixels: new Uint8Array(geo.width * geo.height),
  };
  const decision = decide(cfg, now, messageAt, geo);
  const timeOk = true;
  const text = normalizeMessage(cfg.message);
  const scrollPx = Math.floor((now.getTime() - messageAt) / Math.max(20, cfg.scrollSpeed));
  const second = now.getSeconds();
  const temp = cfg.includeTemperature ? cfg.previewTemp : null;

  const isSegDefault =
    cfg.clockLayout === "segment" &&
    ((decision.withSeconds && geo.width >= 48) || (!decision.withSeconds && geo.width >= 32));
  let metrics = {
    ...clockMetrics(geo.width, Math.min(8, geo.height), decision.withSeconds),
    isSegment: isSegDefault,
  };

  if (cfg.displayPower) {
    if (!decision.split) {
      if (decision.page === "grid") paintGrid(frame);
      else if (decision.page === "checker") paintChecker(frame);
      else if (decision.page === "date") paintDate(frame, now, 0, geo.height, timeOk);
      else if (decision.page === "message") paintMessage(frame, text, 0, geo.height, scrollPx, cfg.secondBar, second);
      else if (decision.page === "status") paintStatus(frame, 0, geo.height, cfg.previewRssi, timeOk);
      else if (decision.page === "temp") paintTemp(frame, 0, geo.height, temp);
      else metrics = paintClock(frame, cfg, now, 0, Math.min(8, geo.height), decision.withSeconds, timeOk);
    } else {
      metrics = paintClock(frame, cfg, now, 0, 8, decision.withSeconds, timeOk);
      const bandY = 8;
      const bandH = geo.height - 8;
      if (decision.bottom === "date") paintDate(frame, now, bandY, bandH, timeOk);
      else if (decision.bottom === "message") paintMessage(frame, text, bandY, bandH, scrollPx, false, second);
      else if (decision.bottom === "status") paintStatus(frame, bandY, bandH, cfg.previewRssi, timeOk);
      else if (decision.bottom === "temp") paintTemp(frame, bandY, bandH, temp);
    }
    if (cfg.flipX) mirror(frame);
  }

  const nightNow = cfg.nightDim && isNight(now.getHours(), cfg.nightStart, cfg.nightEnd);
  const effectiveBrightness = nightNow ? cfg.nightBrightness : cfg.brightness;
  const fontNote =
    metrics.isSegment
      ? `1 number per 8×8 segment · 6 segments · 00:00:00 with ${
          cfg.clockFont === "blood-drip"
            ? "Tiny5 preview pattern"
            : cfg.clockFont === "blood-bold"
              ? "Press Start 2P preview pattern"
              : "Compact 5×7 pattern"
        }`
      : metrics.style === 0
        ? `5×7 digits (${
            cfg.clockFont === "blood-drip"
              ? "Tiny5"
              : cfg.clockFont === "blood-bold"
                ? "Press Start 2P"
                : "Compact 5×7"
          })`
        : metrics.style === 1
          ? "3×5 digits — this chain is too narrow for 5×7 seconds"
          : "Tight 3×5 — squeezed so seconds still fit";

  const holdLeft =
    cfg.messageHold <= 0
      ? "until you clear it"
      : `${Math.max(0, Math.ceil((cfg.messageHold * 1000 - (now.getTime() - messageAt)) / 1000))}s left`;

  let summary = "Display power is off.";
  let detail = "The MAX7219 is held in shutdown. Pixels are not driven.";
  if (cfg.displayPower) {
    if (!geo.valid) {
      summary = "Chip count does not divide into rows.";
      detail = "Set rows so it divides the module count. The preview is showing a single row until that is fixed.";
    } else if (decision.page === "grid" || decision.page === "checker") {
      summary = `Test pattern: ${pageLabel(decision.page)}.`;
      detail = "Same patterns as your original file, so you can still prove wiring, rotation, and row order.";
    } else if (decision.split) {
      summary = `Top row clock. Bottom row ${pageLabel(decision.bottom)}.`;
      detail = decision.messageActive
        ? `Message is active (${holdLeft}). On a two-row chain the clock stays up and the banner uses the lower row.`
        : `Seconds ${decision.withSeconds ? "on" : "off"}, counter bar ${cfg.secondBar ? "on" : "off"}. ${fontNote}.`;
    } else if (decision.page === "message") {
      summary = text ? `Scrolling “${text}”.` : "Message screen, nothing queued.";
      detail = decision.messageActive
        ? `Home Assistant interrupt is on. Hold ${holdLeft}, then the clock returns.`
        : "Open this screen, or turn on interrupt, to take the row away from the clock.";
    } else if (decision.page === "clock") {
      summary = metrics.isSegment
        ? "1 number per segment · 6 segments · full-size 00:00:00"
        : decision.withSeconds
          ? "Clock with a seconds counter."
          : "Clock, hours and minutes.";
      detail = `${cfg.hourFormat}, ${cfg.alignment.toLowerCase()}, ${fontNote}. ${
        cfg.secondBar ? "The bottom pixel row fills across the minute and leaves a gap every 8/10 seconds." : "Second counter bar is off."
      }`;
      if (text && cfg.messagesEnabled && !cfg.interruptOnMessage && !decision.split) {
        detail += " Interrupt is off, so this screen keeps the clock. Open Message, or turn interrupt on.";
      } else if (text && cfg.messagesEnabled && !decision.messageActive) {
        detail += " The hold has ended. The text is still stored — send it again, or set hold to 0.";
      }
    } else {
      summary = `Showing ${pageLabel(decision.page)}.`;
      detail =
        cfg.screen === "Auto"
          ? `Auto rotates every ${Math.max(2, cfg.pageDwell)}s. A new message can still take over if interrupt is on.`
          : "Pick Clock or Auto when you want the time back.";
    }
  }

  return {
    frame,
    geometry: geo,
    page: decision.page,
    bottom: decision.bottom,
    split: decision.split,
    withSeconds: decision.withSeconds,
    clockStyle: styleName(metrics.style, cfg, metrics.isSegment),
    summary,
    detail,
    messageActive: decision.messageActive,
    effectiveBrightness,
    nightNow,
    fontNote,
  };
}
