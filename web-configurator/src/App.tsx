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
import { INSTALL_FRESH_MS, usePublishedRelease, type ReleaseState } from "./release";
import { deviceSlug } from "./device";

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
}: {
  cfg: Config;
  patch: Patch;
  setCfg: Dispatch<SetStateAction<Config>>;
  geo: Geometry;
}) {
  return (
    <>
      <TuneSection cfg={cfg} patch={patch} geo={geo} />
      <FontLab cfg={cfg} setCfg={setCfg} panelWidth={geo.width} panelHeight={Math.min(8, geo.height)} />
    </>
  );
});

const InfoColumn = memo(function InfoColumn({ cfg, yaml, geo, release, getInstaller }: { cfg: Config; yaml: string; geo: Geometry; release: ReleaseState; getInstaller: () => Promise<string | null> }) {
  return (
    <>
      <h1>Info &amp; help</h1>
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
  const initial = useRef(loadConfig()).current;
  const [cfg, setCfg] = useState<Config>(initial.config);
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
    setCfg((current) => ({ ...current, [key]: value }));
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
    window.history.replaceState(null, "", `#${url.split("#")[1]}`);
    if (await copyText(url)) {
      setNotice("Share link copied — it encodes these display settings only.");
      window.setTimeout(() => setNotice((current) => (current?.startsWith("Share link") ? null : current)), 4000);
    }
  }, [cfg]);

  const reset = () => {
    clearSavedConfig();
    setCfg(sanitizeConfig(null));
    setNotice("Settings reset to the factory preview.");
  };

  return (
    <div className="app">
      <a className="skip-link" href={page === "configure" ? "#tune" : "#release-notes"}>
        Skip to the controls
      </a>
      <header className="topbar" ref={topbarRef}>
        <div className="brand">
          <LiveMark />
          <div>
            <div className="brand-name">
              Clock<span>lab</span>
            </div>
            <small>MAX7219 · ESPHome {PROJECT.esphome}</small>
          </div>
        </div>
        <div className="top-actions">
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
          <button type="button" className="btn ghost" onClick={download} disabled={!installerReady}>Download YAML</button>
          <CopyButton text={yaml} id="top-yaml" label="Copy install YAML" copiedLabel="Copied" className="primary" disabled={!installerReady} getText={getInstaller} />
        </div>
      </header>

      {notice ? (
        <div className="notice-bar">
          <p role="status">{notice}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification">
            ×
          </button>
        </div>
      ) : null}

      <nav className="site-nav" aria-label="Configurator pages" ref={navRef}>
        <ul>
          <li><button type="button" className={page === "configure" ? "on" : ""} aria-pressed={page === "configure"} onClick={() => setPage("configure")}>Configure</button></li>
          <li><button type="button" className={page === "info" ? "on" : ""} aria-pressed={page === "info"} onClick={() => setPage("info")}>Info &amp; help</button></li>
        </ul>
      <div className="release-status" role="status"><span>Newest published release: <strong>{release.tag ?? (release.checking ? "checking…" : "not verified")}</strong> · {release.message}</span>
        {!release.ready ? <button type="button" className="btn ghost" onClick={release.retry} disabled={release.checking}>Retry</button> : null}
        {install.error ? <strong className="warn-text">{install.error}</strong> : null}
      </div>
      </nav>

      <main id="main" className="shell">
        {page === "configure" ? <>
          <div className="stage-col"><LiveStage cfg={cfg} scene={scene} now={now} onPreviousFont={() => cycleFont(-1)} onNextFont={() => cycleFont(1)} /></div>
          <div className="content-col">
            <PreviewControls cfg={cfg} scene={scene} sliding={sliding} reducedMotion={reducedMotion} onMessage={(value) => patch("message", value)} onPreviewTime={(value) => patch("previewTime", value)} onReplay={replay} />
            <ConfigureColumn cfg={cfg} patch={patch} setCfg={setCfg} geo={geo} />
          </div>
        </> : null}
        {page === "info" ? <div className="content-col info-page"><InfoColumn cfg={cfg} yaml={yaml} geo={geo} release={release} getInstaller={getInstaller} /></div> : null}
      </main>

      <footer className="site-footer"><p className="release-version">Firmware contract {PROJECT.ref} · ESPHome {PROJECT.esphome}</p></footer>
    </div>
  );
}
