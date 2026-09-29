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

    let dot = modulesX >= 12 ? 6 : modulesX >= 8 ? 8 : modulesX <= 4 ? 13 : 11;
    let gapDot = 2;
    let pitch = dot + gapDot;
    let face = 8 * pitch - gapDot;
    let inset = 8;
    let mod = face + inset * 2;
    // REMOVED: visual gap between modules (was 8px). Modules now join seamlessly.
    // Module boundary guidance is drawn as overlay without shifting pixel positions.
    let gap = 0;
    const target = Math.max(220, box - 8);
    while (dot > 3) {
      gapDot = Math.max(1, Math.round(dot * 0.18));
      pitch = dot + gapDot;
      face = 8 * pitch - gapDot;
      inset = Math.max(4, Math.round(dot * 0.62));
      mod = face + inset * 2;
      // gap stays 0 for seamless joining
      const total = modulesX * mod + (modulesX - 1) * gap;
      if (total <= target) break;
      dot -= 1;
    }

    const labelH = dot < 5 ? 0 : Math.max(14, Math.round(dot * 1.5));
    const cssW = modulesX * mod + (modulesX - 1) * gap;
    const cssH = modulesY * mod + (modulesY - 1) * gap + labelH;
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
        const x = mx * (mod + gap);
        const y = my * (mod + gap);
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
            const cx = fx + col * pitch + dot / 2;
            const cy = fy + row * pitch + dot / 2;
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
    if (showModuleBoundaries && (modulesX > 1 || modulesY > 1)) {
      ctx.strokeStyle = "rgba(255, 214, 160, 0.35)";
      ctx.lineWidth = 1 / dpr;
      ctx.setLineDash([4 / dpr, 4 / dpr]);
      
      // Vertical boundaries between modules
      for (let mx = 1; mx < modulesX; mx++) {
        const bx = mx * mod + mx * gap; // gap is 0, so just mx * mod
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, modulesY * mod + (modulesY - 1) * gap);
        ctx.stroke();
      }
      
      // Horizontal boundaries between modules
      for (let my = 1; my < modulesY; my++) {
        const by = my * mod + my * gap; // gap is 0, so just my * mod
        ctx.beginPath();
        ctx.moveTo(0, by);
        ctx.lineTo(modulesX * mod + (modulesX - 1) * gap, by);
        ctx.stroke();
      }
      
      ctx.setLineDash([]);
    }
  }, [box, brightness, height, inverted, led, modulesX, modulesY, pixels, powered, width, wiring, showModuleBoundaries]);

  return (
    <div className="matrix-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  );
}
