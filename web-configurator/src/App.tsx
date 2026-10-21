import { memo, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { LiveMark, LiveStage } from "./LiveStage";
import { PreviewControls } from "./PreviewControls";
import { FontLab } from "./FontLab";
import {
  AssistantSection,
  DocsSection,
  GallerySection,
  FontReferenceSection,
  ReleaseNotesSection,
  HardwareSection,
  InstallSection,
  PROJECT,
  TroubleshootingSection,
  TuneSection,
} from "./sections";
import { geometry, type Geometry } from "./render";
import type { Config } from "./types";
import { clearSavedConfig, loadConfig, sanitizeConfig, saveConfig, shareUrl } from "./storage";
import { CopyButton, copyText, type Patch } from "./ui";
import { usePinnedChrome } from "./usePinnedChrome";
import { usePreview } from "./usePreview";
import { buildYaml } from "./yaml";
import { switchTarget } from "./hardware";
import { INSTALL_FRESH_MS, usePublishedRelease, type ReleaseState } from "./release";
import { deviceSlug } from "./device";
import { withDetectedTimezone } from "./timezone";
import { useAutomaticTimezone } from "./useAutomaticTimezone";
import { EntityVisibilitySection } from "./EntityVisibility";

type Page = "configure" | "info";

/**
 * Everything below the preview controls, memoised as one block. The preview
 * ticks 20 times a second, so this keeps the settings — including Font Lab's
 * glyph strips and the generated YAML — out of that work; they only re-render
 * when the configuration, the geometry or the YAML actually changes.
 */
const ConfigureColumn = memo(function ConfigureColumn({
  cfg,
  patch,
  setCfg,
  geo,
  detected,
}: {
  cfg: Config;
  patch: Patch;
  setCfg: Dispatch<SetStateAction<Config>>;
  geo: Geometry;
  detected: string | null;
}) {
  // The target decides the board, pin and OTA defaults; switching rewrites them.
  const onTarget = useCallback((id: string) => {
    setCfg((current) => switchTarget(current, id));
  }, [setCfg]);
  return (
    <>
      <TuneSection cfg={cfg} patch={patch} geo={geo} detected={detected} onTarget={onTarget} />
      <EntityVisibilitySection cfg={cfg} patch={patch} />
      <FontLab cfg={cfg} setCfg={setCfg} panelWidth={geo.width} panelHeight={Math.min(8, geo.height)} />
    </>
  );
});

const InfoColumn = memo(function InfoColumn({ cfg, yaml, geo, release, getInstaller }: { cfg: Config; yaml: string; geo: Geometry; release: ReleaseState; getInstaller: () => Promise<string | null> }) {
  return (
    <>
      <header className="info-intro">
        <p className="eyebrow"><span className="eyebrow-mark" aria-hidden="true" /> Project guide <span className="eyebrow-divider">/</span> Reference</p>
        <h1>Info &amp; help</h1>
        <p>Release details, wiring, installer notes and practical fixes for bringing your matrix clock online.</p>
      </header>
      <ReleaseNotesSection releaseTag={release.tag} />
      <InstallSection cfg={cfg} yaml={yaml} ready={release.ready && Boolean(yaml)} releaseTag={release.tag} getInstaller={getInstaller} />
      <HardwareSection cfg={cfg} geo={geo} />
      <FontReferenceSection />
      <AssistantSection cfg={cfg} />
      <TroubleshootingSection />
      <GallerySection />
      <DocsSection />
    </>
  );
});

export default function App({ initialPage = "configure" }: { initialPage?: Page } = {}) {
  const release = usePublishedRelease();
  const [initial] = useState(loadConfig);
  const [cfg, setCfg] = useState<Config>(() => withDetectedTimezone(initial.config));
  const detected = useAutomaticTimezone(setCfg);
  const [notice, setNotice] = useState<string | null>(initial.from === "link" ? "Settings loaded from the shared link." : null);
  const [page, setPage] = useState<Page>(initialPage);
  const topbarRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Where the pinned chrome ends, so the pinned matrix can sit exactly under it.
  usePinnedChrome(topbarRef, navRef);

  const { now, scene, sliding, reducedMotion, replay } = usePreview(cfg);

  useEffect(() => {
    saveConfig(cfg);
  }, [cfg]);

  // A shared link is adopted once: the settings are stored locally and the
  // fragment is dropped, so later edits are not overwritten on reload.
  useEffect(() => {
    if (initial.from !== "link" || typeof window === "undefined") return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [initial.from]);

  const patch = useCallback(<K extends keyof Config>(key: K, value: Config[K]) => {
    setCfg((current) => {
      const next = { ...current, [key]: value };
      return key === "automaticTimezone" && value === true ? withDetectedTimezone(next) : next;
    });
  }, []);

  const install = useMemo(() => {
    try { return { yaml: buildYaml(cfg, release.ready && release.tag ? release.tag : PROJECT.ref), error: "" }; }
    catch (error) { return { yaml: "", error: error instanceof Error ? error.message : "Invalid settings" }; }
  }, [cfg, release.ready, release.tag]);
  const currentConfig = useRef(cfg);
  currentConfig.current = cfg;
  const getInstaller = useCallback(async () => {
    const atClick = currentConfig.current;
    const result = await release.verify({ maxAgeMs: INSTALL_FRESH_MS });
    if (!result.ready || !result.tag) { setNotice("Installer disabled: published release could not be verified."); return null; }
    if (currentConfig.current !== atClick) { setNotice("Settings changed during verification. Review them and try again."); return null; }
    try { return buildYaml(atClick, result.tag); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Invalid settings"); return null; }
  }, [release.verify]);
  const yaml = install.yaml;
  const installerReady = release.ready && Boolean(yaml);
  const download = async () => {
    if (!installerReady) return;
    const content = await getInstaller();
    if (content === null) return;
    const url = URL.createObjectURL(new Blob([content], { type: "text/yaml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${deviceSlug(cfg.deviceName)}.yaml`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const geo = useMemo(() => geometry(cfg.chips, cfg.rows), [cfg.chips, cfg.rows]);
  const cycleFont = useCallback((direction: -1 | 1) => {
    setCfg((current) => {
      const choices = ["compact", ...current.fonts];
      const at = Math.max(0, choices.indexOf(current.clockFont));
      return { ...current, clockFont: choices[(at + direction + choices.length) % choices.length] as Config["clockFont"] };
    });
  }, []);

  const share = useCallback(async () => {
    const url = shareUrl(cfg, window.location.href.split("#")[0]);
    // Copy without leaving a stale profile in this tab's URL: later edits and
    // Reset must reload the saved configuration, not revive an old override.
    if (await copyText(url)) {
      setNotice("Share link copied — it contains non-secret settings only.");
      window.setTimeout(() => setNotice((current) => (current?.startsWith("Share link") ? null : current)), 4000);
    }
  }, [cfg]);

  const reset = () => {
    clearSavedConfig();
    setCfg(withDetectedTimezone(sanitizeConfig(null)));
    setNotice("Settings reset; automatic timezone is on.");
  };

  return (
    <div className="app">
      <a className="skip-link" href={page === "configure" ? "#tune" : "#release-notes"}>
        Skip to the controls
      </a>
      <header className="topbar" ref={topbarRef}>
        <div className="brand">
          <LiveMark />
          <div className="brand-copy">
            <div className="brand-name">
              Clock<span>lab</span>
            </div>
            <small>
              MAX7219 MATRIX CLOCK <span className="brand-separator">·</span> ESPHome {PROJECT.esphome} <span className="brand-separator">·</span>{" "}
              <a href={PROJECT.repo} target="_blank" rel="noreferrer">
                GitHub
              </a>
            </small>
          </div>
        </div>
        <div className="top-actions">
          <div className="utility-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={share}
              title="Copy a link that reopens the configurator with these settings"
            >
              Share
            </button>
            <button type="button" className="btn ghost" onClick={reset} title="Forget the saved settings">
              Reset
            </button>
          </div>
          <div className="export-actions">
            <button type="button" className="btn ghost" onClick={download} disabled={!installerReady}>Download YAML</button>
            <CopyButton text={yaml} id="top-yaml" label="Copy install YAML" copiedLabel="Copied" className="primary" disabled={!installerReady} getText={getInstaller} />
          </div>
        </div>
      </header>

      {notice ? (
        <div className="notice-bar">
          <p role="status">{notice}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification">
            Dismiss
          </button>
        </div>
      ) : null}

      <nav className="site-nav" aria-label="Configurator pages" ref={navRef}>
        <div className="nav-inner">
          <ul>
            <li>
              <button
                type="button"
                className={page === "configure" ? "on" : ""}
                aria-current={page === "configure" ? "page" : undefined}
                onClick={() => setPage("configure")}
              >
                <span className="nav-index" aria-hidden="true">01</span> Configure
              </button>
            </li>
            <li>
              <button
                type="button"
                className={page === "info" ? "on" : ""}
                aria-current={page === "info" ? "page" : undefined}
                onClick={() => setPage("info")}
              >
                <span className="nav-index" aria-hidden="true">02</span> Info &amp; help
              </button>
            </li>
          </ul>
          <div className={`release-status ${release.ready ? "verified" : release.checking ? "checking" : "unverified"}`} role="status">
            <span className="release-indicator" aria-hidden="true" />
            <span className="release-copy">
              <span className="release-label">Newest published release:</span>
              <strong>{release.tag ?? (release.checking ? "checking…" : "not verified")}</strong>
              <span className="release-message">{release.message}</span>
            </span>
            {!release.ready ? <button type="button" className="btn ghost" onClick={release.retry} disabled={release.checking}>Retry</button> : null}
            {install.error ? <strong className="warn-text">{install.error}</strong> : null}
          </div>
        </div>
      </nav>

      <main id="main" className="shell">
        {page === "configure" ? <>
          <div className="stage-col"><LiveStage cfg={cfg} scene={scene} now={now} onPreviousFont={() => cycleFont(-1)} onNextFont={() => cycleFont(1)} /></div>
          <div className="content-col">
            <PreviewControls cfg={cfg} scene={scene} sliding={sliding} reducedMotion={reducedMotion}
              onMessage={(value) => patch("message", value)} onPreviewTime={(value) => patch("previewTime", value)}
              onWeatherTemperature={(key, value) => patch(key, value)}
              onWeatherCondition={(value) => patch("previewWeatherCondition", value)} onReplay={replay} />
            <ConfigureColumn cfg={cfg} patch={patch} setCfg={setCfg} geo={geo} detected={detected} />
          </div>
        </> : null}
        {page === "info" ? <div className="content-col info-page"><InfoColumn cfg={cfg} yaml={yaml} geo={geo} release={release} getInstaller={getInstaller} /></div> : null}
      </main>

      <footer className="site-footer"><p className="release-version">Firmware contract {PROJECT.ref} · ESPHome {PROJECT.esphome}</p></footer>
    </div>
  );
}
