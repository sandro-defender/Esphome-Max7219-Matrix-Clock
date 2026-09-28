import { useEffect, useRef } from "react";
import type { PreviewFont } from "./fonts";

interface GlyphStripProps {
  font: PreviewFont;
  text: string;
  /** Pixels per matrix dot. */
  scale?: number;
  className?: string;
}

/**
 * Small matrix strip used by the font picker. It paints the real glyph
 * bitmaps, so the card shows the face the firmware draws, not a web font.
 */
export function GlyphStrip({ font, text, scale = 3, className }: GlyphStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const textWidth = font.measure(text) ?? 0;
    const cols = Math.max(1, textWidth);
    const rows = 8;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = `${cols * scale}px`;
    canvas.style.height = `${rows * scale}px`;
    canvas.width = Math.round(cols * scale * dpr);
    canvas.height = Math.round(rows * scale * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cols * scale, rows * scale);

    const boxTop = font.boxTop(rows);
    let cursor = 0;
    for (const ch of text) {
      const glyph = font.glyph(ch);
      if (glyph) {
        for (let row = 0; row < glyph.rows.length; row++) {
          for (let col = 0; col < glyph.w; col++) {
            if (!(glyph.rows[row] & (1 << (glyph.w - 1 - col)))) continue;
            const x = cursor + col;
            const y = boxTop + glyph.top + row;
            if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
            ctx.fillStyle = "#ffb347";
            ctx.fillRect(x * scale, y * scale, scale - 1, scale - 1);
          }
        }
      }
      cursor += font.advance(ch);
    }
  }, [font, scale, text]);

  return <canvas ref={canvasRef} className={className} role="img" aria-label={`${font.label} sample: ${text}`} />;
}
