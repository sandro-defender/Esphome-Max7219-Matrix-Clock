import { useEffect, useRef, useState } from "react";
import { MatrixCanvas } from "./MatrixCanvas";
import { LEDS } from "./leds";
import { normalizeMessage } from "./fonts";
import { renderScene } from "./render";
import type { Config } from "./types";
import { cn } from "./utils/cn";

const SAMPLES = ["00:00:00", "BLOOD", "WARNING", "DOOR OPEN", "TEA READY", "GOOD NIGHT"];

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

export function LiveStage({ cfg, onMessage }: { cfg: Config; onMessage: (value: string) => void }) {
  const [now, setNow] = useState(() => new Date());
  const messageAt = useRef(Date.now());
  const prevMessage = useRef(cfg.message);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 50);
    return () => window.clearInterval(id);
  }, []);

  if (prevMessage.current !== cfg.message) {
    prevMessage.current = cfg.message;
    messageAt.current = Date.now();
  }

  const scene = renderScene(cfg, now, messageAt.current);
  const shown = normalizeMessage(cfg.message);
  const second = now.getSeconds();
  let hour = now.getHours();
  const suffix = cfg.hourFormat === "12-hour" ? (hour >= 12 ? "PM" : "AM") : "";
  if (cfg.hourFormat === "12-hour") {
    hour = hour % 12;
    if (hour === 0) hour = 12;
  }
  const hourText = cfg.leadingZero || hour >= 10 ? pad(hour) : String(hour);
  const alertFlash = cfg.includeAlert && cfg.previewAlert && Math.floor(now.getTime() / 250) % 2 === 0;
  const inverted = cfg.displayPower && cfg.invert !== alertFlash;
  const led = LEDS[cfg.led];
  const holdLeft =
    cfg.messageHold <= 0
      ? "until cleared"
      : `${Math.max(0, Math.ceil((cfg.messageHold * 1000 - (now.getTime() - messageAt.current)) / 1000))}s`;

  return (
    <section className="stage">
      <div className="kicker">
        <div>
          <h1>
            Full-size hours, minutes, and seconds. <em>One digit per 8×8 module.</em>
          </h1>
          <p>
            Preview the 48×8 clock layout, bundled font choices, separators, seconds modes, messages, and matrix wiring before
            downloading the one-file ESPHome installer.
          </p>
        </div>
      </div>

      <div className="chassis">
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
          inverted={inverted}
          label={`${scene.summary} ${hourText}:${pad(now.getMinutes())}:${pad(second)}`}
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
          <span className={cn("colon", cfg.blinkColon && second % 2 === 1 && "dim")}>:</span>
          {pad(now.getMinutes())}
          <span className="secs">:{pad(second)}</span>
          {suffix ? <span className="secs"> {suffix}</span> : null}
        </div>
        <div className="summary">
          <h2>{scene.summary}</h2>
          <p>{scene.detail}</p>
          {cfg.clockLayout === "segment" && cfg.chips >= 6 ? (
            <div className="segment-badge-row" title="6 segments: exactly 1 number in each 8x8 module">
              <span className="seg-tag">
                Mod 0: <b>{hourText[0] ?? "0"}</b>
              </span>
              <span className="seg-tag">
                Mod 1: <b>{hourText[1] ?? "0"}</b> <small style={{ color: "#ff2244" }}>:</small>
              </span>
              <span className="seg-tag">
                Mod 2: <b>{pad(now.getMinutes())[0]}</b>
              </span>
              <span className="seg-tag">
                Mod 3: <b>{pad(now.getMinutes())[1]}</b> <small style={{ color: "#ff2244" }}>:</small>
              </span>
              <span className="seg-tag">
                Mod 4: <b>{pad(second)[0]}</b>
              </span>
              <span className="seg-tag">
                Mod 5: <b>{pad(second)[1]}</b>
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="ruler" aria-hidden="true">
        {Array.from({ length: 60 }, (_, s) => (
          <span key={s} className={cn(s <= second && "lit", s % 10 === 0 && "mark")} />
        ))}
      </div>
      <div className="ruler-caption">
        <span>Second counter · 0</span>
        <span>{pad(second)} · gap every 10s</span>
        <span>60</span>
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
          {scene.messageActive ? ` · ${holdLeft}` : ""}
        </p>
        {!scene.geometry.valid ? (
          <p className="warn">Module count must divide evenly into rows. The preview is holding a single row until it does.</p>
        ) : null}
      </div>

      <figure className="polaroid">
        <img src="./images/module-macro.jpg" alt="Macro of an 8 by 8 LED matrix with dots lit" />
        <figcaption>8×8 MAX7219 modules. Six modules provide the default 48×8 full-clock layout.</figcaption>
      </figure>
    </section>
  );
}
