import { normalizeMessage } from "./fonts";
import type { Scene } from "./render";
import { FIRMWARE, limitsFor } from "./firmware";
import type { Config } from "./types";

interface PreviewControlsProps {
  cfg: Config;
  scene: Scene;
  sliding: boolean;
  reducedMotion: boolean;
  onMessage: (value: string) => void;
  onPreviewTime: (value: string) => void;
  onReplay: () => void;
}

/** Only interactive controls and live readouts belong on Configure. */
export function PreviewControls({ cfg, scene, sliding, reducedMotion, onMessage, onPreviewTime, onReplay }: PreviewControlsProps) {
  const slideState = reducedMotion ? "reduced motion" : !cfg.digitAnimation || cfg.animationMs === 0 ? "off" :
    `${cfg.animationMs} ms${sliding ? " · sliding" : ""}`;
  return <div className="preview-controls">
    <h1 id="preview-title">Your matrix clock.</h1>
    <div className="panel preview-clock"><label htmlFor="preview-time">Preview time
      <input id="preview-time" placeholder="live" inputMode="numeric" value={cfg.previewTime} spellCheck={false} onChange={(event) => onPreviewTime(event.target.value)} />
    </label><div className="chips"><button type="button" className="chip" onClick={() => onPreviewTime("")}>Live</button>
      {["00:00:00", "9:05:07", "23:59:59", "12:34:56"].map((value) => <button key={value} type="button" className="chip" onClick={() => onPreviewTime(value)}>{value}</button>)}
    </div></div>
    <div className="panel slide-panel"><div className="slider-head"><strong>Digit slide-up</strong><b>{slideState}</b></div>
      <button type="button" className="btn ghost" onClick={onReplay} disabled={!scene.content || reducedMotion || !cfg.digitAnimation || cfg.animationMs === 0}>Replay last change</button>
    </div>
    <div className="panel composer"><label htmlFor="ha-message">Message preview</label>
      <input id="ha-message" maxLength={FIRMWARE.renderer.messageMaxBytes} value={cfg.message} spellCheck={false} onChange={(event) => onMessage(event.target.value)} />
      <div className="chips">{["DOOR OPEN", "TEA READY", "GOOD NIGHT", "WARNING"].map((message) => <button key={message} type="button" className="chip" onClick={() => onMessage(cfg.message === message ? "" : message)}>{message}</button>)}</div>
      <output className="matrix-reads">{normalizeMessage(cfg.message) || "—"}{scene.messageActive && scene.messageHoldLeft !== null ? ` · ${scene.messageHoldLeft}s left` : ""}</output>
    </div>
    <div className="facts"><span><b>{cfg.chips}</b> modules · {scene.geometry.width}×{scene.geometry.height} px</span>
      <span>Screen <b>{cfg.screen}</b></span><span>Brightness <b>{scene.effectiveBrightness}/{limitsFor("brightness").max}</b></span>
      <span>Fonts <b>{cfg.fonts.length + 1}</b></span></div>
  </div>;
}
