import { describe, expect, it } from "vitest";

import {
  MODULE_BOUNDARY_COLOR,
  MODULE_BOUNDARY_DASH,
  drawModuleBoundaries,
  isLedVisuallyOn,
  ledCenter,
  ledGlowRadius,
  moduleBoundaries,
  moduleGeometry,
  moduleOrigin,
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
      expect(geo.face, `${box}px`).toBeCloseTo(8 * geo.pitch - geo.gapDot, 6);
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

  it("only leaves the two module bezels at a seam, never extra slack", () => {
    const geo = moduleGeometry(640, 6, 1);
    const inside = ledCenter(geo, 0, 0, 1, 0).x - ledCenter(geo, 0, 0, 0, 0).x;
    const seam = ledCenter(geo, 1, 0, 0, 0).x - ledCenter(geo, 0, 0, 7, 0).x;

    // Two boards meet edge to edge, so the dark room between the facing LED
    // columns is the two bezels that belong to the modules themselves.
    expect(seam).toBeCloseTo(geo.dot + 2 * geo.inset, 6);
    // Regression guard for the removed 8 px board gap: the seam may never add
    // more than those two bezels on top of the normal intra-module pitch.
    expect(seam - inside).toBeLessThanOrEqual(2 * geo.inset);
    expect(seam - inside).toBeCloseTo(2 * geo.inset - geo.gapDot, 6);
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
