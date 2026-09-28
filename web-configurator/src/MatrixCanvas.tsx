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
    let gap = 8;
    const target = Math.max(220, box - 8);
    while (dot > 3) {
      gapDot = Math.max(1, Math.round(dot * 0.18));
      pitch = dot + gapDot;
      face = 8 * pitch - gapDot;
      inset = Math.max(4, Math.round(dot * 0.62));
      mod = face + inset * 2;
      gap = Math.max(4, Math.round(dot * 0.72));
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

        if (powered && inverted) {
          ctx.save();
          ctx.shadowColor = led.glow;
          ctx.shadowBlur = 12 + level * 16;
          ctx.globalAlpha = 0.28 + level * 0.62;
          ctx.fillStyle = led.mid;
          roundRect(ctx, fx, fy, face, face, 2);
          ctx.fill();
          ctx.restore();
        }

        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const px = mx * 8 + col;
            const py = my * 8 + row;
            const value = px < width && py < height ? pixels[py * width + px] : 0;
            const cx = fx + col * pitch + dot / 2;
            const cy = fy + row * pitch + dot / 2;
            const on = value > 0;
            const head = value === 2;

            if (powered && inverted) {
              if (!on) continue;
              ctx.beginPath();
              ctx.arc(cx, cy, dot / 2, 0, Math.PI * 2);
              ctx.fillStyle = "#070605";
              ctx.fill();
              continue;
            }

            if (!powered || !on) {
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

            const radius = dot * (head ? 1.85 : 1.28);
            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            glow.addColorStop(0, led.core);
            glow.addColorStop(0.42, led.mid);
            glow.addColorStop(1, "rgba(0,0,0,0)");
            ctx.globalAlpha = head ? Math.min(1, level + 0.25) : level;
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, dot * 0.34, 0, Math.PI * 2);
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
  }, [box, brightness, height, inverted, led, modulesX, modulesY, pixels, powered, width, wiring]);

  return (
    <div className="matrix-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  );
}
