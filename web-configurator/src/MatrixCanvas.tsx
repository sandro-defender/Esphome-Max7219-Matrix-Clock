import { useEffect, useRef, useState } from "react";
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

/**
 * Chooses the largest dot size that still fits the available width.
 *
 * Modules are joined as one continuous LED grid (`gap === 0`, `inset === 0`),
 * so a 6x1 panel reads visually as an uninterrupted 48x8 display.
 */
export function moduleGeometry(box: number, modulesX: number, modulesY: number): ModuleGeometry {
  const cols = Math.max(1, Math.floor(modulesX));
  const rows = Math.max(1, Math.floor(modulesY));

  let dot = cols >= 12 ? 6 : cols >= 8 ? 8 : cols <= 4 ? 13 : 11;
  let gapDot = 2;
  let pitch = dot + gapDot;
  let face = 8 * pitch;
  let inset = 0;
  let mod = face + inset * 2;
  // Adjacent boards touch. The bezel is part of a module, so two bezels meet
  // at a seam instead of an extra gap between the boards.
  const gap = 0;
  const target = Math.max(220, box - 8);
  while (dot > 3) {
    gapDot = Math.max(1, Math.round(dot * 0.18));
    pitch = dot + gapDot;
    face = 8 * pitch;
    inset = 0;
    mod = face + inset * 2;
    const total = cols * mod + (cols - 1) * gap;
    if (total <= target) break;
    dot -= 1;
  }

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

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setBox(el.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || modulesX < 1 || modulesY < 1) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const geometry = moduleGeometry(box, modulesX, modulesY);
    const { dot, pitch, face, inset, mod, labelH, cssW, cssH } = geometry;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const level = 0.2 + (Math.max(0, Math.min(15, brightness)) / 15) * 0.8;

    for (let my = 0; my < modulesY; my++) {
      for (let mx = 0; mx < modulesX; mx++) {
        const { x, y } = moduleOrigin(geometry, mx, my);
        const shell = ctx.createLinearGradient(x, y, x, y + mod);
        shell.addColorStop(0, "#322b23");
        shell.addColorStop(0.18, "#1b1713");
        shell.addColorStop(1, "#0d0c0a");
        ctx.fillStyle = shell;
        roundRect(ctx, x, y, mod, mod, Math.max(4, dot * 0.45));
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 214, 160, 0.14)";
        ctx.lineWidth = 1;
        ctx.stroke();

        const fx = x + inset;
        const fy = y + inset;
        ctx.fillStyle = "#070605";
        roundRect(ctx, fx - 1, fy - 1, face + 2, face + 2, 3);
        ctx.fill();

        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const px = mx * 8 + col;
            const py = my * 8 + row;
            const value = px < width && py < height ? pixels[py * width + px] : 0;
            const { x: cx, y: cy } = ledCenter(geometry, mx, my, col, row);
            const on = isLedVisuallyOn(value, powered, inverted);
            const head = value === 2;

            if (!on) {
              ctx.beginPath();
              ctx.arc(cx, cy, dot / 2, 0, Math.PI * 2);
              ctx.fillStyle = "#16110d";
              ctx.fill();
              ctx.beginPath();
              ctx.arc(cx - dot * 0.12, cy - dot * 0.16, dot * 0.18, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(255, 226, 186, 0.05)";
              ctx.fill();
              continue;
            }

            const radius = ledGlowRadius(dot, pitch);
            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            glow.addColorStop(0, led.core);
            glow.addColorStop(0.46, led.mid);
            glow.addColorStop(1, "rgba(0,0,0,0)");
            ctx.globalAlpha = head ? Math.min(1, level + 0.2) : 0.55 + level * 0.35;
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, dot * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = led.mid;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx - dot * 0.08, cy - dot * 0.1, dot * 0.22, 0, Math.PI * 2);
            ctx.fillStyle = head ? "#fffaf0" : led.core;
            ctx.fill();
          }
        }

        if (labelH > 0) {
          ctx.fillStyle = "#8d8072";
          ctx.font = `500 ${Math.max(9, Math.round(dot * 0.95))}px "IBM Plex Mono", ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(chainIndex(mx, my, modulesX, wiring)), x + mod / 2, y + mod + labelH * 0.55);
        }
      }
    }

    // Optional module boundary overlay - drawn on top without shifting pixels
    drawModuleBoundaries(ctx, geometry, modulesX, modulesY, dpr, showModuleBoundaries);
  }, [box, brightness, height, inverted, led, modulesX, modulesY, pixels, powered, width, wiring, showModuleBoundaries]);

  return (
    <div className="matrix-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  );
}
