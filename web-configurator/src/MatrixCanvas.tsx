import { useEffect, useMemo, useRef, useState } from "react";
import type { LedPreset } from "./leds";
import type { Wiring } from "./types";

interface MatrixCanvasProps {
  width: number;
  height: number;
  modulesX: number;
  modulesY: number;
  pixels: Uint8Array;
  wiring: Wiring;
  brightness: number;
  led: LedPreset;
  powered: boolean;
  inverted: boolean;
  label: string;
  showModuleBoundaries?: boolean; // Optional module-boundary guidance overlay
}

function chainIndex(col: number, row: number, cols: number, wiring: Wiring): number {
  if (wiring === "snake" && row % 2 === 1) return row * cols + (cols - 1 - col) + 1;
  return row * cols + col + 1;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * The pixel layout of a joined panel: where every 8x8 module sits, how the LED
 * dots are pitched inside it and how big the canvas has to be. Pure arithmetic
 * so the seam behaviour can be asserted without a canvas.
 */
export interface ModuleGeometry {
  /** Diameter of one LED dot in CSS px. */
  dot: number;
  /** Dark space between two LED dots inside a module face, in CSS px. */
  gapDot: number;
  /** Centre-to-centre LED distance inside a module face, in CSS px. */
  pitch: number;
  /** Width of one 8x8 region, including the final regular pixel pitch. */
  face: number;
  /** Extra space around a module face. Zero keeps the panel pixel-continuous. */
  inset: number;
  /** Width and height of one 8x8 module region, in CSS px. */
  mod: number;
  /** Space between two boards. Always 0: adjacent modules join seamlessly. */
  gap: number;
  /** Height of the chain-order label strip below the panel; 0 when dots shrink. */
  labelH: number;
  /** Canvas width in CSS px. */
  cssW: number;
  /** Canvas height in CSS px, label strip included. */
  cssH: number;
}

/** Smallest dot the sizer tries before it starts shrinking the pitch itself. */
const MIN_DOT = 3;

interface LedStep {
  dot: number;
  gapDot: number;
  pitch: number;
}

/** Dot size plus the dark gap that goes with it, at any dot diameter. */
function ledStep(dot: number): LedStep {
  const gapDot = Math.max(1, Math.round(dot * 0.18));
  return { dot, gapDot, pitch: dot + gapDot };
}

/**
 * Chooses the largest dot size that still fits the available width.
 *
 * Modules are joined as one continuous LED grid (`gap === 0`, `inset === 0`),
 * so a 6x1 panel reads visually as an uninterrupted 48x8 display. The pitch is
 * always recomputed for the dot that is finally used, and the pitch is capped by
 * the box, so the panel is never wider than its container: a narrow phone keeps
 * the whole lattice on screen instead of widening the page.
 */
export function moduleGeometry(box: number, modulesX: number, modulesY: number): ModuleGeometry {
  const cols = Math.max(1, Math.floor(modulesX));
  const rows = Math.max(1, Math.floor(modulesY));
  const available = Math.max(0, Math.floor(box) - 8);
  const lattice = cols * 8;

  let step = ledStep(cols >= 12 ? 6 : cols >= 8 ? 8 : cols <= 4 ? 13 : 11);
  for (let dot = step.dot; dot >= MIN_DOT; dot--) {
    step = ledStep(dot);
    if (lattice * step.pitch <= available) break;
  }

  // Too many modules for the box: shrink the pitch (dots may touch) rather than
  // overflow the page. The lattice stays continuous either way.
  const maxPitch = Math.max(1, Math.floor(available / lattice));
  if (step.pitch > maxPitch) {
    const dot = Math.max(1, maxPitch - 1);
    step = { dot, gapDot: maxPitch - dot, pitch: maxPitch };
  }

  const { dot, gapDot, pitch } = step;
  const face = 8 * pitch;
  const inset = 0;
  const mod = face + inset * 2;
  // Adjacent boards touch. The bezel belongs to the panel as a whole, so two
  // boards meet at a shared hairline instead of an extra gap between them.
  const gap = 0;
  const labelH = dot < 5 ? 0 : Math.max(14, Math.round(dot * 1.5));
  return {
    dot,
    gapDot,
    pitch,
    face,
    inset,
    mod,
    gap,
    labelH,
    cssW: cols * mod + (cols - 1) * gap,
    cssH: rows * mod + (rows - 1) * gap + labelH,
  };
}

/** Top-left corner of one module in canvas CSS px. */
export function moduleOrigin(geometry: ModuleGeometry, mx: number, my: number): { x: number; y: number } {
  const step = geometry.mod + geometry.gap;
  return { x: mx * step, y: my * step };
}

/** Centre of one LED dot in canvas CSS px. */
export function ledCenter(
  geometry: ModuleGeometry,
  mx: number,
  my: number,
  col: number,
  row: number,
): { x: number; y: number } {
  const origin = moduleOrigin(geometry, mx, my);
  return {
    x: origin.x + geometry.inset + col * geometry.pitch + geometry.dot / 2,
    y: origin.y + geometry.inset + row * geometry.pitch + geometry.dot / 2,
  };
}

/** Centre of one LED of the joined panel, addressed by panel pixel. */
export function pixelCenter(geometry: ModuleGeometry, px: number, py: number): { x: number; y: number } {
  return ledCenter(geometry, Math.floor(px / 8), Math.floor(py / 8), ((px % 8) + 8) % 8, ((py % 8) + 8) % 8);
}

/**
 * The rectangle of the whole joined lattice: one panel, not one rect per board.
 * Painting a single shell (and a single dark face inside it) is what keeps the
 * seams invisible — no per-module border can cut the dot grid.
 */
export function panelBounds(
  geometry: ModuleGeometry,
  modulesX: number,
  modulesY: number,
): { x: number; y: number; w: number; h: number } {
  const cols = Math.max(1, Math.floor(modulesX));
  const rows = Math.max(1, Math.floor(modulesY));
  return {
    x: 0,
    y: 0,
    w: cols * geometry.mod + (cols - 1) * geometry.gap,
    h: rows * geometry.mod + (rows - 1) * geometry.gap,
  };
}

/** One dashed guide line in canvas CSS px. */
export interface ModuleBoundary {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Colour, dash length and hairline width of the module guidance overlay. */
export const MODULE_BOUNDARY_COLOR = "rgba(255, 214, 160, 0.35)";
export const MODULE_BOUNDARY_DASH = 4;

/**
 * Dashed guide lines marking where two boards meet. A vertical guide sits in
 * the shared bezel of `mx - 1` and `mx`, a horizontal one in the shared bezel
 * of `my - 1` and `my`, so no guide ever crosses an LED dot.
 */
export function moduleBoundaries(geometry: ModuleGeometry, modulesX: number, modulesY: number): ModuleBoundary[] {
  const cols = Math.max(1, Math.floor(modulesX));
  const rows = Math.max(1, Math.floor(modulesY));
  const step = geometry.mod + geometry.gap;
  const panelW = cols * step - geometry.gap;
  const panelH = rows * step - geometry.gap;
  const bounds: ModuleBoundary[] = [];
  for (let mx = 1; mx < cols; mx++) {
    bounds.push({ x1: mx * step, y1: 0, x2: mx * step, y2: panelH });
  }
  for (let my = 1; my < rows; my++) {
    bounds.push({ x1: 0, y1: my * step, x2: panelW, y2: my * step });
  }
  return bounds;
}

/** Canvas subset the overlay needs, so it can be exercised without a canvas. */
export interface ModuleBoundaryCtx {
  lineWidth: number;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  setLineDash(segments: number[]): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
}

/**
 * Draws the optional module-boundary guidance on top of the panel.
 *
 * `show` mirrors the `showModuleBoundaries` prop. Single-module panels and
 * `show === false` are a complete no-op, so the canvas state is untouched and
 * the overlay can never move a pixel. The dash pattern is reset before
 * returning, keeping any later drawing solid.
 *
 * @returns the number of guide lines drawn.
 */
export function drawModuleBoundaries(
  ctx: ModuleBoundaryCtx,
  geometry: ModuleGeometry,
  modulesX: number,
  modulesY: number,
  dpr = 1,
  show = true,
): number {
  if (!show) return 0;
  const bounds = moduleBoundaries(geometry, modulesX, modulesY);
  if (bounds.length === 0) return 0;

  const ratio = dpr > 0 ? dpr : 1;
  ctx.strokeStyle = MODULE_BOUNDARY_COLOR;
  ctx.lineWidth = 1 / ratio; // one device pixel wide, whatever the zoom
  ctx.setLineDash([MODULE_BOUNDARY_DASH / ratio, MODULE_BOUNDARY_DASH / ratio]);
  for (const line of bounds) {
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  return bounds.length;
}

/** Maps firmware pixels to the physical LED state, including inversion. */
export function isLedVisuallyOn(value: number, powered: boolean, inverted: boolean): boolean {
  if (!powered) return false;
  const sourceOn = value > 0;
  return inverted ? !sourceOn : sourceOn;
}

/** Keeps the halo inside one dot pitch so adjacent LEDs remain distinguishable. */
export function ledGlowRadius(dot: number, pitch: number): number {
  return Math.min(pitch / 2, dot * 0.58);
}

/**
 * Cheap 32-bit fingerprint of a frame, so the canvas only repaints when the
 * pixels really changed. The preview re-renders 20x/s to follow the clock, but
 * the panel itself only changes when a digit, the colon or the bar moves.
 */
export function frameSignature(pixels: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < pixels.length; i++) {
    hash ^= pixels[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Brightness 0…15 mapped onto the LED alpha the panel is painted with. */
export function ledLevel(brightness: number): number {
  return 0.2 + (Math.max(0, Math.min(15, brightness)) / 15) * 0.8;
}

/* ------------------------------------------------------------------ *
 * LED sprites
 *
 * One pre-rendered bitmap per LED state instead of three canvas paths and a
 * fresh radial gradient per dot per frame. A 48x8 panel repaints in a few
 * blits, which is what keeps the per-digit slide animation smooth.
 * ------------------------------------------------------------------ */

export interface LedSprite {
  canvas: HTMLCanvasElement;
  /** Edge length in CSS px; the bitmap is `size * dpr` pixels square. */
  size: number;
}

const sprites = new Map<string, LedSprite>();

function sprite(
  key: string,
  size: number,
  dpr: number,
  paint: (ctx: CanvasRenderingContext2D, centre: number) => void,
): LedSprite | null {
  const cached = sprites.get(key);
  if (cached) return cached;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(size * dpr));
  canvas.height = Math.max(1, Math.round(size * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paint(ctx, size / 2);
  if (sprites.size > 48) sprites.clear();
  const made = { canvas, size };
  sprites.set(key, made);
  return made;
}

/** Dark, unpowered LED dot. */
export function offSprite(dot: number, dpr: number): LedSprite | null {
  const size = dot + 2;
  return sprite(`off|${dot}|${dpr}`, size, dpr, (ctx, centre) => {
    ctx.fillStyle = "#16110d";
    ctx.beginPath();
    ctx.arc(centre, centre, dot / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 226, 186, 0.05)";
    ctx.beginPath();
    ctx.arc(centre - dot * 0.12, centre - dot * 0.16, dot * 0.18, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Lit LED dot: glow, body and specular highlight. */
export function onSprite(dot: number, pitch: number, led: LedPreset, level: number, head: boolean, dpr: number): LedSprite | null {
  const radius = ledGlowRadius(dot, pitch);
  const size = Math.max(dot, radius * 2) + 2;
  const alpha = head ? Math.min(1, level + 0.2) : 0.55 + level * 0.35;
  const key = `on|${dot}|${pitch}|${led.core}|${led.mid}|${alpha.toFixed(3)}|${head ? 1 : 0}|${dpr}`;
  return sprite(key, size, dpr, (ctx, centre) => {
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(centre, centre, 0, centre, centre, radius);
    glow.addColorStop(0, led.core);
    glow.addColorStop(0.46, led.mid);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centre, centre, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = led.mid;
    ctx.beginPath();
    ctx.arc(centre, centre, dot * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = head ? "#fffaf0" : led.core;
    ctx.beginPath();
    ctx.arc(centre - dot * 0.08, centre - dot * 0.1, dot * 0.22, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function MatrixCanvas({
  width,
  height,
  modulesX,
  modulesY,
  pixels,
  wiring,
  brightness,
  led,
  powered,
  inverted,
  label,
  showModuleBoundaries = false,
}: MatrixCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState(640);
  // The paint reads the pixels through a ref and is keyed on their signature,
  // so an identical frame costs nothing.
  const pixelsRef = useRef(pixels);
  pixelsRef.current = pixels;
  const signature = useMemo(() => frameSignature(pixels), [pixels]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setBox(el.clientWidth);
    // Without a ResizeObserver (old browsers, test DOMs) the first measurement
    // still sizes the panel; it just does not follow a later resize.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    measure();
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || modulesX < 1 || modulesY < 1) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const frame = pixelsRef.current;

    const geometry = moduleGeometry(box, modulesX, modulesY);
    const { dot, pitch, mod, labelH, cssW, cssH } = geometry;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const level = ledLevel(brightness);
    const panel = panelBounds(geometry, modulesX, modulesY);

    // One board for the whole chain: a single shell and a single dark face, so
    // nothing is drawn between two modules and the dot pitch reads continuous.
    const shell = ctx.createLinearGradient(0, panel.y, 0, panel.y + panel.h);
    shell.addColorStop(0, "#322b23");
    shell.addColorStop(0.18, "#1b1713");
    shell.addColorStop(1, "#0d0c0a");
    ctx.fillStyle = shell;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, Math.max(4, dot * 0.45));
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 214, 160, 0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#070605";
    roundRect(ctx, panel.x + 1, panel.y + 1, Math.max(0, panel.w - 2), Math.max(0, panel.h - 2), 3);
    ctx.fill();

    const dark = offSprite(dot, dpr);
    const lit = onSprite(dot, pitch, led, level, false, dpr);
    const head = onSprite(dot, pitch, led, level, true, dpr);
    const blit = (image: LedSprite | null, cx: number, cy: number) => {
      if (!image) return;
      ctx.drawImage(image.canvas, cx - image.size / 2, cy - image.size / 2, image.size, image.size);
    };

    for (let py = 0; py < modulesY * 8; py++) {
      for (let px = 0; px < modulesX * 8; px++) {
        const value = px < width && py < height ? (frame[py * width + px] ?? 0) : 0;
        const { x: cx, y: cy } = pixelCenter(geometry, px, py);
        if (!isLedVisuallyOn(value, powered, inverted)) {
          blit(dark, cx, cy);
          continue;
        }
        blit(value === 2 ? head : lit, cx, cy);
      }
    }

    if (labelH > 0) {
      ctx.fillStyle = "#8d8072";
      ctx.font = `500 ${Math.max(9, Math.round(dot * 0.95))}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let my = 0; my < modulesY; my++) {
        for (let mx = 0; mx < modulesX; mx++) {
          const { x, y } = moduleOrigin(geometry, mx, my);
          ctx.fillText(String(chainIndex(mx, my, modulesX, wiring)), x + mod / 2, y + mod + labelH * 0.55);
        }
      }
    }

    // Optional module boundary overlay - drawn on top without shifting pixels
    drawModuleBoundaries(ctx, geometry, modulesX, modulesY, dpr, showModuleBoundaries);
    // `signature` stands in for the pixel array: a new array with the same
    // content must not trigger a repaint.
  }, [box, brightness, height, inverted, led, modulesX, modulesY, signature, powered, width, wiring, showModuleBoundaries]);

  return (
    <div className="matrix-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  );
}
