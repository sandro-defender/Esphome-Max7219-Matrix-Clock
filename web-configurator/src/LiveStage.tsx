import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MatrixCanvas } from "./MatrixCanvas";
import { LEDS } from "./leds";
import { normalizeMessage } from "./fonts";
import { fitForPanel, fontSpec } from "./fontCatalog";
import { widthWarning } from "./fontCatalog";
import { renderScene } from "./render";
import { SCREENS, type Config } from "./types";
import { cn } from "./utils/cn";

const SAMPLES = ["DOOR OPEN", "TEA READY", "GOOD NIGHT", "BLOOD", "WARNING"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "HH:MM[:SS]" freezes the preview; an empty value follows the real clock. */
function previewDate(value: string, fallback: Date): Date {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return fallback;
  const date = new Date(fallback);
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  const seconds = Math.min(59, Math.max(0, Number(match[3] ?? 0)));
  date.setHours(hours, minutes, seconds, 0);
  return date;
}

export function LiveMark() {
  const [dot, setDot] = useState(() => new Date().getSeconds() % 8);
  useEffect(() => {
    const id = window.setInterval(() => setDot(new Date().getSeconds() % 8), 250);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="mark" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} className={i === dot ? "on" : ""} />
      ))}
    </span>
  );
}

interface LiveStageProps {
  cfg: Config;
  onMessage: (value: string) => void;
  onPreviewTime: (value: string) => void;
}

/**
 * The live preview stage.
 *
 * On narrow viewports the chassis leaves the flow (`position: fixed`, see
 * index.css) so the matrix stays pinned under the nav while every section
 * scrolls past. A `.chassis-slot` spacer keeps the document height honest by
 * mirroring the chassis height from a ResizeObserver.
 */
export function LiveStage({ cfg, onMessage, onPreviewTime }: LiveStageProps) {
  const [tick, setTick] = useState(() => new Date());
  const messageAt = useRef(Date.now());
  const prevMessage = useRef(cfg.message);
  const chassisRef = useRef<HTMLDivElement>(null);
  const [chassisH, setChassisH] = useState(0);

  useEffect(() => {
    if (cfg.previewTime) return;
    const id = window.setInterval(() => setTick(new Date()), 50);
    return () => window.clearInterval(id);
  }, [cfg.previewTime]);

  useLayoutEffect(() => {
    const el = chassisRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setChassisH(el.offsetHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);

  if (prevMessage.current !== cfg.message) {
    prevMessage.current = cfg.message;
    messageAt.current = Date.now();
  }

  const now = useMemo(() => previewDate(cfg.previewTime, tick), [cfg.previewTime, tick]);
  const scene = renderScene(cfg, now, messageAt.current);
  const shown = normalizeMessage(cfg.message);
  const spec = fontSpec(cfg.clockFont);
  const fit = fitForPanel(scene.font, scene.geometry.width, Math.min(8, scene.geometry.height));
  const led = LEDS[cfg.led];
  const warning = widthWarning(spec.label, fit, scene.geometry.width);
  const seconds = now.getSeconds();
  let hour = now.getHours();
  const suffix = cfg.hourFormat === "12-hour" ? (hour >= 12 ? "PM" : "AM") : "";
  if (cfg.hourFormat === "12-hour") {
    hour = hour % 12;
    if (hour === 0) hour = 12;
  }
  const hourText = pad(hour);
  const fitLabel = scene.usedFallback
    ? "built-in 5×7 fallback"
    : scene.droppedSeconds
      ? "seconds dropped"
      : fit.width <= scene.geometry.width
        ? "fits"
        : "fallback";

  return (
    <section id="preview" className="stage" aria-labelledby="preview-title">
      <div className="kicker">
        <div>
          <h1 id="preview-title">
            Your matrix clock, <em>pixel by pixel</em>.
          </h1>
          <p>
            A Wemos D1 Mini, six MAX7219 modules, one seamless 48×8 panel. The preview below is painted with the same
            glyph bitmaps, centring and fallback rules as the firmware — tune it, then install one small YAML.
          </p>
        </div>
      </div>

      <div className="chassis-slot" style={chassisH ? { height: chassisH } : undefined} aria-hidden="true" />
      <div className="chassis" ref={chassisRef}>
        <i className="screw tl" />
        <i className="screw tr" />
        <i className="screw bl" />
        <i className="screw br" />
        <div className="halo" style={{ background: led.glow, opacity: cfg.displayPower ? 0.22 + scene.effectiveBrightness / 40 : 0 }} />
        <div className="chassis-top">
          <span>
            MAX7219 · {scene.geometry.width}×{scene.geometry.height}
          </span>
          <span className={cn("power-led", cfg.displayPower && "on")} title={cfg.displayPower ? "Display on" : "Display off"} />
        </div>
        <MatrixCanvas
          width={scene.frame.width}
          height={scene.frame.height}
          modulesX={scene.geometry.modulesX}
          modulesY={scene.geometry.modulesY}
          pixels={scene.frame.pixels}
          wiring={cfg.wiring}
          brightness={scene.effectiveBrightness}
          led={led}
          powered={cfg.displayPower}
          inverted={cfg.invert}
          label={`${scene.summary} ${hourText}:${pad(now.getMinutes())}:${pad(seconds)}`}
          showModuleBoundaries={cfg.showModuleBoundaries}
        />
        <div className="chassis-bottom">
          <span>Chain order under each module</span>
          <span>
            {cfg.clkPin} CLK · {cfg.mosiPin} DIN · {cfg.csPin} CS
          </span>
        </div>
      </div>

      <div className="readout">
        <div className="big-time" aria-hidden="true">
          {hourText}
          <span className={cn("colon", cfg.blinkColon && seconds % 2 === 1 && "dim")}>:</span>
          {pad(now.getMinutes())}
          {cfg.secondsMode === "Digits" ? <span className="secs">:{pad(seconds)}</span> : null}
          {suffix ? <span className="secs"> {suffix}</span> : null}
        </div>
        <div className="summary">
          <p className="summary-title">{scene.summary}</p>
          <p>{scene.detail}</p>
        </div>
      </div>

      <ul className="status-strip" aria-label="Preview status">
        <li>
          <span>Face</span>
          <b>{spec.label}</b>
        </li>
        <li>
          <span>Panel</span>
          <b>
            {scene.geometry.width}×{scene.geometry.height} px
          </b>
        </li>
        <li>
          <span>HH:MM:SS</span>
          <b>
            {fit.width} px of {scene.geometry.width}
          </b>
        </li>
        <li>
          <span>Fallback</span>
          <b className={cn(scene.usedFallback || scene.droppedSeconds ? "warn-text" : "ok-text")}>{fitLabel}</b>
        </li>
        {scene.nightNow ? (
          <li>
            <span>Night</span>
            <b>
              {cfg.nightBrightness}/15
            </b>
          </li>
        ) : null}
      </ul>

      {warning ? (
        <p className="warn stage-warn" role="status">
          <strong>Too wide:</strong> {warning}
        </p>
      ) : null}

      {scene.notices.length > 0 ? (
        <ul className="notices">
          {scene.notices.map((notice) => (
            <li key={notice.text} className={notice.level === "warn" ? "warn" : "info"}>
              {notice.text}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="preview-clock">
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
        <p className="hint">A frozen clock helps to check 12-hour mode, the leading digit and midnight in 12-hour format.</p>
      </div>

      <div className="composer">
        <label htmlFor="ha-message">Message from Home Assistant</label>
        <input
          id="ha-message"
          type="text"
          maxLength={120}
          spellCheck={false}
          placeholder="Type what an automation would send"
          value={cfg.message}
          onChange={(e) => onMessage(e.target.value)}
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
          {scene.messageActive ? ` · ${scene.messageHoldLeft}s left` : ""}
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
    </section>
  );
}
