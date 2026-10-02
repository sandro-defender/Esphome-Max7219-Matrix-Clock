import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MatrixCanvas } from "./MatrixCanvas";
import { LEDS } from "./leds";
import { fitForPanel, fontSpec } from "./fontCatalog";
import type { Scene } from "./render";
import type { Config } from "./types";
import { cn } from "./utils/cn";

function pad(n: number): string {
  return String(n).padStart(2, "0");
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
  scene: Scene;
  now: Date;
  onPreviousFont?: () => void;
  onNextFont?: () => void;
}

/**
 * The live device preview: the seam-free 48×8 panel, the time it shows and the
 * face/fit readout — nothing else, so the whole block fits above the fold and
 * can stay pinned while the settings scroll past.
 *
 * On narrow viewports the chassis leaves the flow (`position: fixed`, see
 * index.css) and sits exactly under the pinned chrome: its `top` comes from the
 * measured `--pin-top`, so the section nav can never cover the matrix and the
 * matrix can never cover the header controls. A `.chassis-slot` spacer keeps
 * the document height honest by mirroring the chassis height.
 */
export function LiveStage({ cfg, scene, now, onPreviousFont, onNextFont }: LiveStageProps) {
  const chassisRef = useRef<HTMLDivElement>(null);
  const [chassisH, setChassisH] = useState(0);

  useLayoutEffect(() => {
    const el = chassisRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const height = el.offsetHeight;
      setChassisH(height);
      // Anchor jumps on phones have to clear the pinned matrix as well.
      document.documentElement.style.setProperty("--chassis-h", `${Math.round(height)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);

  const spec = fontSpec(cfg.clockFont);
  const fit = fitForPanel(scene.font, scene.geometry.width, Math.min(8, scene.geometry.height));
  const led = LEDS[cfg.led];
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
      <div className="chassis-slot" style={chassisH ? { height: chassisH } : undefined} aria-hidden="true" />
      <div className="chassis" ref={chassisRef}>
        <i className="screw tl" />
        <i className="screw tr" />
        <i className="screw bl" />
        <i className="screw br" />
        <div
          className="halo"
          style={{ background: led.glow, opacity: cfg.displayPower ? 0.22 + scene.effectiveBrightness / 40 : 0 }}
        />
        <div className="chassis-top">
          <span>
            MAX7219 · {scene.geometry.width}×{scene.geometry.height}
          </span>
          <span
            className={cn("power-led", cfg.displayPower && "on")}
            title={cfg.displayPower ? "Display on" : "Display off"}
          />
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
        </div>
      </div>

      <ul className="status-strip" aria-label="Preview status">
        <li>
          <span>Face</span>
          <b className="face-stepper">
            <button type="button" aria-label="Previous included clock font" onClick={onPreviousFont}>‹</button>
            <span className="face-label">{spec.label}</span>
            <button type="button" aria-label="Next included clock font" onClick={onNextFont}>›</button>
          </b>
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

    </section>
  );
}
