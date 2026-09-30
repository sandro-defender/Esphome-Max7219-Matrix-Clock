import { normalizeMessage } from "./fonts";
import type { Scene } from "./render";
import { SCREENS, type Config } from "./types";
import { cn } from "./utils/cn";

const SAMPLES = ["DOOR OPEN", "TEA READY", "GOOD NIGHT", "BLOOD", "WARNING"];

interface PreviewControlsProps {
  cfg: Config;
  scene: Scene;
  /** True while a per-digit slide is in flight. */
  sliding: boolean;
  /** `prefers-reduced-motion: reduce` — the preview never slides. */
  reducedMotion: boolean;
  onMessage: (value: string) => void;
  onPreviewTime: (value: string) => void;
  onReplay: () => void;
}

/**
 * The controls that belong to the live preview: the page title, the frozen
 * preview time, the Home Assistant message composer, the digit-slide readout and
 * the fact strip. They sit at the top of the settings column so the first
 * desktop screen shows the matrix *and* the controls that drive it.
 */
export function PreviewControls({
  cfg,
  scene,
  sliding,
  reducedMotion,
  onMessage,
  onPreviewTime,
  onReplay,
}: PreviewControlsProps) {
  const shown = normalizeMessage(cfg.message);
  const slideState = reducedMotion
    ? "reduced motion"
    : !cfg.digitAnimation || cfg.animationMs === 0
      ? "off"
      : sliding
        ? `${cfg.animationMs} ms · sliding`
        : `${cfg.animationMs} ms`;

  return (
    <div className="preview-controls">
      <div className="preview-intro">
        <h1 id="preview-title">
          Your matrix clock, <em>pixel by pixel</em>.
        </h1>
        <p className="section-lead">
          A Wemos D1 Mini, six MAX7219 modules, one seamless 48×8 panel. The preview is painted with the same glyph
          bitmaps, centring and fallback rules as the firmware — tune it, then install one small YAML.
        </p>
      </div>

      <div className="panel preview-clock">
        <label htmlFor="preview-time">
          Preview time
          <input
            id="preview-time"
            type="text"
            inputMode="numeric"
            placeholder="live"
            value={cfg.previewTime}
            spellCheck={false}
            onChange={(event) => onPreviewTime(event.target.value)}
          />
        </label>
        <div className="chips">
          <button type="button" className={cn("chip", cfg.previewTime === "" && "on")} onClick={() => onPreviewTime("")}>
            Live
          </button>
          {["00:00:00", "9:05:07", "23:59:59", "12:34:56"].map((value) => (
            <button
              key={value}
              type="button"
              className={cn("chip", cfg.previewTime === value && "on")}
              onClick={() => onPreviewTime(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="hint">
          Freeze the clock to check 12-hour mode, a leading zero, midnight, or a font change without waiting for the
          minute to turn over.
        </p>
      </div>

      <div className="panel slide-panel">
        <div className="slider-head">
          <strong>Digit slide-up</strong>
          <b>{slideState}</b>
        </div>
        <p className="hint">
          Only the digits whose value changes move: the old digit slides up and out, the new one arrives from below,
          over {cfg.animationMs} ms. Unchanged digits and the colons stay still. That is the firmware rule, driven by
          the <em>Digit slide-up animation</em> switch and the <em>Animation duration</em> slider in{" "}
          <a href="#tune">Tune → Screen</a>.
        </p>
        <div className="btn-row">
          <button type="button" className="btn ghost" onClick={onReplay} disabled={scene.content.length === 0}>
            Replay last change
          </button>
        </div>
        {reducedMotion ? (
          <p className="hint">Your system asks for reduced motion, so the preview updates digits without sliding.</p>
        ) : null}
      </div>

      <div className="panel composer">
        <label htmlFor="ha-message">Message from Home Assistant</label>
        <input
          id="ha-message"
          type="text"
          maxLength={120}
          spellCheck={false}
          placeholder="Type what an automation would send"
          value={cfg.message}
          onChange={(event) => onMessage(event.target.value)}
        />
        <div className="chips">
          {SAMPLES.map((sample) => (
            <button
              key={sample}
              type="button"
              className={cn("chip", cfg.message === sample && "on")}
              onClick={() => onMessage(cfg.message === sample ? "" : sample)}
            >
              {sample}
            </button>
          ))}
        </div>
        <p className="matrix-reads">
          Matrix reads: {shown || "—"} · {cfg.message.length}/120
          {scene.messageActive && scene.messageHoldLeft !== null ? ` · ${scene.messageHoldLeft}s left` : ""}
        </p>
      </div>

      <div className="facts">
        <span>
          <b>{cfg.chips}</b> modules · {scene.geometry.width}×{scene.geometry.height} px
        </span>
        <span>
          Screen <b>{cfg.autoCycle ? `Auto ${cfg.cycleInterval}s` : cfg.screen}</b>
        </span>
        <span>
          Brightness <b>{scene.effectiveBrightness}/15</b>
        </span>
        <span>
          Faces compiled <b>{cfg.fonts.length + 1}</b>
        </span>
        <span>
          Screens <b>{SCREENS.length}</b> · {cfg.scrollMode.toLowerCase()} messages
        </span>
      </div>
    </div>
  );
}
