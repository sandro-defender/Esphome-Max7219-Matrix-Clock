import { describe, expect, it } from "vitest";

import {
  frameSignature,
  MODULE_BOUNDARY_COLOR,
  MODULE_BOUNDARY_DASH,
  drawModuleBoundaries,
  isLedVisuallyOn,
  ledCenter,
  ledGlowRadius,
  ledLevel,
  moduleBoundaries,
  moduleGeometry,
  moduleOrigin,
  panelBounds,
  pixelCenter,
  type ModuleBoundaryCtx,
} from "./MatrixCanvas";
import { geometry } from "./render";
import { DEFAULT_CONFIG } from "./types";

/**
 * Records the canvas calls a guide line makes. The overlay is pure geometry, so
 * it can be asserted exactly without a DOM or a real 2D context.
 */
function recorder() {
  const calls: string[] = [];
  const dashes: number[][] = [];
  const strokes: { x1: number; y1: number; x2: number; y2: number }[] = [];
  let path = { x1: 0, y1: 0, x2: 0, y2: 0 };
  const ctx: ModuleBoundaryCtx = {
    lineWidth: 0,
    strokeStyle: "" as ModuleBoundaryCtx["strokeStyle"],
    setLineDash(segments) {
      dashes.push([...segments]);
      calls.push("setLineDash");
    },
    beginPath() {
      calls.push("beginPath");
    },
    moveTo(x, y) {
      path = { x1: x, y1: y, x2: x, y2: y };
      calls.push("moveTo");
    },
    lineTo(x, y) {
      path = { ...path, x2: x, y2: y };
      calls.push("lineTo");
    },
    stroke() {
      strokes.push({ ...path });
      calls.push("stroke");
    },
  };
  return { ctx, calls, dashes, strokes };
}

/** Layouts the configurator can produce, including the 16x4 extreme. */
const LAYOUTS: [number, number][] = [
  [1, 1],
  [4, 1],
  [6, 1],
  [8, 2],
  [16, 4],
];

describe("MatrixCanvas LED optics", () => {
  it("inverts individual LED dots instead of illuminating the whole module face", () => {
    expect(isLedVisuallyOn(0, true, false)).toBe(false);
    expect(isLedVisuallyOn(1, true, false)).toBe(true);
    expect(isLedVisuallyOn(0, true, true)).toBe(true);
    expect(isLedVisuallyOn(1, true, true)).toBe(false);
    expect(isLedVisuallyOn(1, false, true)).toBe(false);
  });

  it("keeps each LED glow inside its own pixel pitch", () => {
    expect(ledGlowRadius(11, 13)).toBeLessThanOrEqual(6.5);
    expect(ledGlowRadius(4, 5)).toBeLessThanOrEqual(2.5);
  });
});

describe("MatrixCanvas module joining", () => {
  it("joins adjacent modules without an inter-module gap", () => {
    for (const box of [220, 320, 640, 1200]) {
      for (const [cols, rows] of LAYOUTS) {
        const label = `${box}px ${cols}x${rows}`;
        const geo = moduleGeometry(box, cols, rows);

        expect(geo.gap, label).toBe(0);
        // The canvas is exactly the sum of the boards: no gap is reserved.
        expect(geo.cssW, label).toBe(cols * geo.mod);
        expect(geo.cssH, label).toBe(rows * geo.mod + geo.labelH);
        expect(geo.mod, label).toBe(geo.face + 2 * geo.inset);
      }
    }
  });

  it("starts every board exactly where the previous one ends", () => {
    const geo = moduleGeometry(640, 6, 1);
    for (let mx = 0; mx < 5; mx++) {
      expect(moduleOrigin(geo, mx, 0).x + geo.mod).toBe(moduleOrigin(geo, mx + 1, 0).x);
    }
    // The last board ends flush with the canvas edge - no trailing slack.
    expect(moduleOrigin(geo, 5, 0).x + geo.mod).toBe(geo.cssW);

    const stacked = moduleGeometry(640, 2, 4);
    for (let my = 0; my < 3; my++) {
      expect(moduleOrigin(stacked, 0, my).y + stacked.mod).toBe(moduleOrigin(stacked, 0, my + 1).y);
    }
    expect(moduleOrigin(stacked, 0, 3).y + stacked.mod + stacked.labelH).toBe(stacked.cssH);
  });

  it("keeps the LED grid inside a module evenly pitched", () => {
    for (const box of [220, 320, 640, 1200]) {
      const geo = moduleGeometry(box, 6, 1);
      const origin = moduleOrigin(geo, 0, 0);

      // Every one of the 64 dots fits in the lit face and is spaced evenly.
      // On a very narrow canvas the sizing loop stops at the smallest dot size
      // with the pitch of the previous step, which widens the dot gap by 1 px
      // instead of moving pixels; the grid still has to fit.
      expect(geo.pitch, `${box}px`).toBeGreaterThanOrEqual(geo.dot + geo.gapDot);
      expect(geo.face, `${box}px`).toBeCloseTo(8 * geo.pitch, 6);
      for (let col = 1; col < 8; col++) {
        const step = ledCenter(geo, 0, 0, col, 0).x - ledCenter(geo, 0, 0, col - 1, 0).x;
        expect(step, `${box}px column ${col}`).toBeCloseTo(geo.pitch, 6);
      }
      for (let col = 0; col < 8; col++) {
        const center = ledCenter(geo, 0, 0, col, 0);
        expect(center.x - geo.dot / 2 - origin.x - geo.inset, `${box}px column ${col}`).toBeGreaterThanOrEqual(0);
        expect(center.x + geo.dot / 2 - origin.x - geo.inset, `${box}px column ${col}`).toBeLessThanOrEqual(geo.face);
      }
      for (let row = 0; row < 8; row++) {
        const center = ledCenter(geo, 0, 0, 0, row);
        expect(center.y - geo.dot / 2 - origin.y - geo.inset, `${box}px row ${row}`).toBeGreaterThanOrEqual(0);
        expect(center.y + geo.dot / 2 - origin.y - geo.inset, `${box}px row ${row}`).toBeLessThanOrEqual(geo.face);
      }
      const rowStep = ledCenter(geo, 0, 0, 0, 1).y - ledCenter(geo, 0, 0, 0, 0).y;
      expect(rowStep, `${box}px`).toBeCloseTo(geo.pitch, 6);
    }
  });

  it("uses one continuous LED grid without visual module gaps", () => {
    const geo = moduleGeometry(640, 6, 1);
    const inside = ledCenter(geo, 0, 0, 1, 0).x - ledCenter(geo, 0, 0, 0, 0).x;
    const seam = ledCenter(geo, 1, 0, 0, 0).x - ledCenter(geo, 0, 0, 7, 0).x;

    expect(geo.inset).toBe(0);
    expect(seam).toBeCloseTo(inside, 6);
  });

  it("joins the default 6x1 panel into five evenly sized boards", () => {
    const scene = geometry(DEFAULT_CONFIG.chips, DEFAULT_CONFIG.rows);
    expect([scene.modulesX, scene.modulesY]).toEqual([6, 1]);

    const geo = moduleGeometry(640, scene.modulesX, scene.modulesY);
    const boards = Array.from({ length: scene.modulesX }, (_, mx) => moduleOrigin(geo, mx, 0));
    for (const board of boards) {
      expect(board.x + geo.mod).toBeLessThanOrEqual(geo.cssW + 1e-9);
      expect(geo.cssW / scene.modulesX).toBeCloseTo(geo.mod, 6);
    }
    // Every board edge, except the outer two, is a seam between two modules.
    const edges = boards.slice(1).map((board) => board.x);
    expect(edges).toHaveLength(5);
    expect(moduleBoundaries(geo, scene.modulesX, scene.modulesY).map((line) => line.x1)).toEqual(edges);
  });
});

describe("MatrixCanvas module boundary overlay", () => {
  it("draws one dashed guide per seam on a 6x1 panel", () => {
    const geo = moduleGeometry(640, 6, 1);
    const { ctx, dashes, strokes } = recorder();

    expect(drawModuleBoundaries(ctx, geo, 6, 1, 1, true)).toBe(5);
    expect(strokes.map((line) => line.x1)).toEqual([1, 2, 3, 4, 5].map((n) => n * geo.mod));
    for (const line of strokes) {
      expect(line.x1).toBeCloseTo(line.x2, 6); // vertical guide
      expect(line.y1).toBe(0);
      expect(line.y2).toBe(geo.mod); // panel height without the label strip
    }

    expect(ctx.strokeStyle).toBe(MODULE_BOUNDARY_COLOR);
    expect(ctx.lineWidth).toBe(1);
    expect(dashes[0]).toEqual([MODULE_BOUNDARY_DASH, MODULE_BOUNDARY_DASH]);
    // Dashed while drawing, solid again afterwards so later drawing is unaffected.
    expect(dashes.at(-1)).toEqual([]);
  });

  it("skips the overlay when showModuleBoundaries is false", () => {
    const geo = moduleGeometry(640, 6, 1);
    const { ctx, calls, dashes, strokes } = recorder();

    expect(drawModuleBoundaries(ctx, geo, 6, 1, 1, false)).toBe(0);
    expect(calls).toEqual([]);
    expect(dashes).toEqual([]);
    expect(strokes).toEqual([]);
  });

  it("draws nothing at all for a single module", () => {
    const geo = moduleGeometry(320, 1, 1);
    expect(moduleBoundaries(geo, 1, 1)).toEqual([]);

    const { ctx, calls } = recorder();
    expect(drawModuleBoundaries(ctx, geo, 1, 1, 2, true)).toBe(0);
    // Not even setLineDash: a one-module canvas is untouched.
    expect(calls).toEqual([]);
  });

  it("draws vertical and horizontal guides on a 2x2 panel", () => {
    const geo = moduleGeometry(520, 2, 2);
    const bounds = moduleBoundaries(geo, 2, 2);

    const vertical = bounds.filter((line) => line.x1 === line.x2);
    const horizontal = bounds.filter((line) => line.y1 === line.y2);
    expect(vertical).toHaveLength(1);
    expect(horizontal).toHaveLength(1);

    expect(vertical[0]).toEqual({ x1: geo.mod, y1: 0, x2: geo.mod, y2: 2 * geo.mod });
    expect(horizontal[0]).toEqual({ x1: 0, y1: geo.mod, x2: 2 * geo.mod, y2: geo.mod });

    const { ctx, strokes } = recorder();
    expect(drawModuleBoundaries(ctx, geo, 2, 2, 1, true)).toBe(2);
    expect(strokes).toHaveLength(2);
  });

  it("keeps every guide inside the shared bezel, clear of the LED dots", () => {
    for (const [cols, rows] of LAYOUTS) {
      const geo = moduleGeometry(640, cols, rows);
      const label = `${cols}x${rows}`;

      for (const line of moduleBoundaries(geo, cols, rows)) {
        // Guides stay on the canvas.
        expect(line.x1, label).toBeGreaterThanOrEqual(0);
        expect(line.y1, label).toBeGreaterThanOrEqual(0);
        expect(line.x2, label).toBeLessThanOrEqual(geo.cssW);
        expect(line.y2, label).toBeLessThanOrEqual(geo.cssH);

        const vertical = line.x1 === line.x2;
        const boards = vertical
          ? Array.from({ length: cols }, (_, mx) => mx)
          : Array.from({ length: rows }, (_, my) => my);
        const index = vertical ? Math.round(line.x1 / geo.mod) : Math.round(line.y1 / geo.mod);

        // The guide sits in the dead band between the two facing module faces:
        // one bezel on each side, measured from the nearest dot centres.
        for (const board of [index - 1, index]) {
          expect(boards, label).toContain(board);
          for (let pixel = 0; pixel < 8; pixel++) {
            const center = vertical
              ? ledCenter(geo, board, 0, pixel, 0).x
              : ledCenter(geo, 0, board, 0, pixel).y;
            const guide = vertical ? line.x1 : line.y1;
            expect(Math.abs(center - guide), `${label} board ${board} pixel ${pixel}`).toBeGreaterThanOrEqual(
              geo.dot / 2 + geo.inset - 1e-9,
            );
          }
        }

        // Exactly in the middle of the two bezels that meet at the seam.
        const faceEdge = vertical
          ? moduleOrigin(geo, index - 1, 0).x + geo.inset + geo.face
          : moduleOrigin(geo, 0, index - 1).y + geo.inset + geo.face;
        expect((vertical ? line.x1 : line.y1) - faceEdge, label).toBeCloseTo(geo.inset, 6);
      }
    }
  });

  it("moves no pixel when the guides are drawn", () => {
    const geo = moduleGeometry(640, 6, 1);
    const before = { ...geo };
    const centersBefore = [0, 7].map((col) => ledCenter(geo, 0, 0, col, 0));

    const { ctx } = recorder();
    expect(drawModuleBoundaries(ctx, geo, 6, 1, 2, true)).toBe(5);

    // The overlay is read-only: geometry and every LED centre are unchanged.
    expect(geo).toEqual(before);
    expect([0, 7].map((col) => ledCenter(geo, 0, 0, col, 0))).toEqual(centersBefore);
  });

  it("scales hairlines and dashes with the device pixel ratio", () => {
    const geo = moduleGeometry(640, 6, 1);

    const retina = recorder();
    expect(drawModuleBoundaries(retina.ctx, geo, 6, 1, 2, true)).toBe(5);
    expect(retina.ctx.lineWidth).toBe(0.5);
    expect(retina.dashes[0]).toEqual([MODULE_BOUNDARY_DASH / 2, MODULE_BOUNDARY_DASH / 2]);

    const fallback = recorder();
    expect(drawModuleBoundaries(fallback.ctx, geo, 6, 1, 0, true)).toBe(5);
    expect(fallback.ctx.lineWidth).toBe(1);
    expect(fallback.dashes[0]).toEqual([MODULE_BOUNDARY_DASH, MODULE_BOUNDARY_DASH]);
  });

  it("ignores unusable module counts instead of drawing stray lines", () => {
    const geo = moduleGeometry(640, 6, 1);
    expect(moduleBoundaries(geo, 0, 0)).toEqual([]);
    expect(moduleBoundaries(geo, -3, 1)).toEqual([]);

    const { ctx, calls } = recorder();
    expect(drawModuleBoundaries(ctx, geo, 0, 0, 2, true)).toBe(0);
    expect(calls).toEqual([]);
  });
});

/**
 * The panel must read as ONE continuous LED display. Whatever the viewport
 * size, adjacent 8x8 modules share the same dot pitch across the seam: no
 * inter-module gap, no per-module inset, lattice distances preserved.
 */
describe("seamless panel", () => {
  const SEAM_LAYOUTS = [
    [1, 1],
    [4, 1],
    [6, 1],
    [8, 1],
    [12, 1],
    [16, 1],
    [2, 2],
    [8, 2],
    [12, 4],
  ] as const;

  it("joins modules with zero gap and zero inset at every size", () => {
    for (const [cols, rows] of SEAM_LAYOUTS) {
      for (const box of [240, 320, 640, 1280]) {
        const geo = moduleGeometry(box, cols, rows);
        expect(geo.gap, `${cols}x${rows} @${box}`).toBe(0);
        expect(geo.inset, `${cols}x${rows} @${box}`).toBe(0);
      }
    }
  });

  it("paints the panel exactly as wide as the continuous LED lattice", () => {
    for (const [cols, rows] of SEAM_LAYOUTS) {
      const geo = moduleGeometry(640, cols, rows);
      const label = `${cols}x${rows}`;
      // No seam allowance: width = columns * 8 * pitch, height = rows * 8 * pitch.
      expect(geo.cssW, `width ${label}`).toBe(cols * 8 * geo.pitch);
      expect(geo.cssH, `height ${label}`).toBe(rows * 8 * geo.pitch + geo.labelH);
      expect(geo.mod, `module size ${label}`).toBe(geo.face);
    }
  });

  it("keeps the dot pitch identical across every module seam", () => {
    for (const [cols, rows] of SEAM_LAYOUTS) {
      if (cols < 2 && rows < 2) continue;
      const geo = moduleGeometry(640, cols, rows);
      const label = `${cols}x${rows}`;

      for (let mx = 1; mx < cols; mx++) {
        // Last dot of the left module to the first dot of the right module.
        const seam = ledCenter(geo, mx, 0, 0, 0).x - ledCenter(geo, mx - 1, 0, 7, 0).x;
        expect(seam, `vertical seam before module ${mx} of ${label}`).toBeCloseTo(geo.pitch, 6);
      }
      for (let my = 1; my < rows; my++) {
        const seam = ledCenter(geo, 0, my, 0, 0).y - ledCenter(geo, 0, my - 1, 0, 7).y;
        expect(seam, `horizontal seam before row ${my} of ${label}`).toBeCloseTo(geo.pitch, 6);
      }
    }
  });

  it("maps the default 6x1 build onto one uninterrupted 48x8 grid", () => {
    const scene = geometry(DEFAULT_CONFIG.chips, DEFAULT_CONFIG.rows);
    expect(scene).toMatchObject({ modulesX: 6, modulesY: 1, width: 48, height: 8 });

    const geo = moduleGeometry(640, scene.modulesX, scene.modulesY);
    for (let px = 0; px < 48; px++) {
      const moduleIndex = Math.floor(px / 8);
      const col = px % 8;
      const x = ledCenter(geo, moduleIndex, 0, col, 0).x;
      expect(x, `pixel ${px}`).toBeCloseTo(px * geo.pitch + geo.dot / 2, 6);
    }
  });
});

/**
 * The panel is one board: a single shell, one dot lattice, and a width that
 * never exceeds the space it is given — at any viewport, for any module count.
 */
describe("panel as one board", () => {
  const LAYOUTS: [number, number][] = [
    [1, 1],
    [4, 1],
    [6, 1],
    [8, 1],
    [12, 1],
    [16, 1],
    [8, 2],
    [12, 4],
  ];

  it("never paints the lattice wider than its box", () => {
    for (const [cols, rows] of LAYOUTS) {
      for (let box = cols * 8 + 8; box <= 1400; box += 37) {
        const geo = moduleGeometry(box, cols, rows);
        const label = `${cols}x${rows} @${box}`;
        expect(geo.cssW, label).toBeLessThanOrEqual(box - 8);
        expect(geo.cssW, label).toBe(cols * 8 * geo.pitch);
        expect(geo.pitch, label).toBeGreaterThanOrEqual(geo.dot + geo.gapDot);
        expect(geo.dot, label).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("keeps one pitch across every seam at any width", () => {
    for (const cols of [4, 6, 8, 12, 16]) {
      for (const box of [200, 240, 320, 375, 480, 768, 1024, 1280]) {
        const geo = moduleGeometry(box, cols, 1);
        const inside = ledCenter(geo, 0, 0, 1, 0).x - ledCenter(geo, 0, 0, 0, 0).x;
        for (let mx = 1; mx < cols; mx++) {
          const seam = ledCenter(geo, mx, 0, 0, 0).x - ledCenter(geo, mx - 1, 0, 7, 0).x;
          const label = `${cols} modules @${box}px seam ${mx}`;
          expect(seam, label).toBeCloseTo(inside, 6);
          expect(seam, label).toBeCloseTo(geo.pitch, 6);
        }
      }
    }
  });

  it("spans the whole chain with a single panel rectangle", () => {
    const wide = moduleGeometry(640, 6, 1);
    expect(panelBounds(wide, 6, 1)).toEqual({ x: 0, y: 0, w: wide.cssW, h: wide.mod });
    expect(panelBounds(wide, 6, 1).w).toBe(48 * wide.pitch);

    const stacked = moduleGeometry(640, 2, 2);
    expect(panelBounds(stacked, 2, 2)).toEqual({ x: 0, y: 0, w: stacked.cssW, h: 2 * stacked.mod });

    const single = moduleGeometry(320, 1, 1);
    expect(panelBounds(single, 1, 1)).toEqual({ x: 0, y: 0, w: single.mod, h: single.mod });
  });

  it("addresses every panel pixel on the same continuous lattice", () => {
    const geo = moduleGeometry(640, 6, 1);
    for (let px = 0; px < 48; px++) {
      const centre = pixelCenter(geo, px, 0);
      expect(centre.x, `pixel ${px}`).toBeCloseTo(ledCenter(geo, Math.floor(px / 8), 0, px % 8, 0).x, 6);
      expect(centre.x, `pixel ${px}`).toBeCloseTo(px * geo.pitch + geo.dot / 2, 6);
    }
    for (let py = 0; py < 8; py++) {
      expect(pixelCenter(geo, 0, py).y).toBeCloseTo(py * geo.pitch + geo.dot / 2, 6);
    }
  });

  it("maps brightness onto the LED level inside its bounds", () => {
    expect(ledLevel(0)).toBeCloseTo(0.2, 6);
    expect(ledLevel(15)).toBeCloseTo(1, 6);
    expect(ledLevel(-5)).toBeCloseTo(0.2, 6);
    expect(ledLevel(99)).toBeCloseTo(1, 6);
  });
});

describe("frame signature", () => {
  it("ignores a new array holding the same frame", () => {
    const a = new Uint8Array([0, 1, 0, 255, 7, 0]);
    expect(frameSignature(new Uint8Array(a))).toBe(frameSignature(a));
  });

  it("changes when a single LED changes", () => {
    const a = new Uint8Array(384).fill(0);
    const b = new Uint8Array(a);
    b[383] = 1;
    expect(frameSignature(a)).not.toBe(frameSignature(b));
  });
});
