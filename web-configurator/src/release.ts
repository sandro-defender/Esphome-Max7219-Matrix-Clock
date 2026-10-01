import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FIRMWARE, releaseBody } from "./firmware";
import { validReleaseTag } from "./yaml";

export interface ReleaseState {
  tag: string | null;
  ready: boolean;
  checking: boolean;
  message: string;
}
interface PublishedRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  body: string;
  id: number;
}
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
const MAX_RESPONSE_BYTES = 1024 * 1024;

/** Bounded anonymous GETs only; no credentials, preference data or tokens. */
async function getJson(fetcher: Fetcher, url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetcher(url, { signal, cache: "no-store", credentials: "omit", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Release lookup failed (${response.status})`);
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new Error("Release response is too large");
  return JSON.parse(text) as unknown;
}

/** Resolve newest *published*, non-prerelease, immutable tag, not a branch. */
export async function resolvePublishedRelease(fetcher: Fetcher = fetch, timeoutMs = 8000): Promise<ReleaseState> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let tag: string | null = null;
  try {
    const data: unknown[] = [];
    // GitHub orders by creation, not publication. Scan bounded pages, then
    // sort by publication time; never silently choose from a truncated list.
    for (let page = 1; page <= 10; page++) {
      const entries = await getJson(fetcher, `https://api.github.com/repos/${FIRMWARE.repository}/releases?per_page=100&page=${page}`, controller.signal);
      if (!Array.isArray(entries)) throw new Error("Invalid release response");
      data.push(...entries);
      if (entries.length < 100) break;
      if (page === 10) throw new Error("Release history exceeds the verification limit");
    }
    const releases = (data as PublishedRelease[]).filter((item) =>
      item && item.draft === false && item.prerelease === false && typeof item.published_at === "string" &&
      Number.isFinite(Date.parse(item.published_at)) && validReleaseTag(item.tag_name),
    ).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || b.id - a.id);
    if (!releases.length) throw new Error("No published versioned release is available");
    const newest = releases[0];
    tag = newest.tag_name;
    // The tagged source contract proves the UI was built from this firmware,
    // not a current main branch or an unrelated older package catalogue.
    const contract = await getJson(fetcher,
      `https://raw.githubusercontent.com/${FIRMWARE.repository}/${encodeURIComponent(tag)}/web-configurator/src/firmware.generated.json`, controller.signal) as Record<string, unknown>;
    if (contract.schemaVersion !== FIRMWARE.schemaVersion || contract.sourceHash !== FIRMWARE.sourceHash ||
        contract.releaseVersion !== FIRMWARE.releaseVersion) {
      return { tag, ready: false, checking: false, message: "Published firmware and this configurator differ. Refresh after matching deployment." };
    }
    if (newest.body?.trim() !== releaseBody(tag).trim()) throw new Error("Published release notes differ from the firmware contract");
    const ref = await getJson(fetcher,
      `https://api.github.com/repos/${FIRMWARE.repository}/git/ref/tags/${encodeURIComponent(tag)}`, controller.signal) as { object?: { sha?: string; type?: string } };
    let object = ref.object;
    for (let depth = 0; object?.type === "tag" && depth < 4; depth++) {
      if (!/^[a-f0-9]{40}$/.test(object.sha ?? "")) throw new Error("Invalid annotated tag");
      object = (await getJson(fetcher, `https://api.github.com/repos/${FIRMWARE.repository}/git/tags/${object.sha}`, controller.signal) as { object?: typeof object }).object;
    }
    if (object?.type !== "commit" || !/^[a-f0-9]{40}$/.test(object?.sha ?? "")) throw new Error("Release is not an immutable commit tag");
    const commitSuffix = tag.split("+")[1];
    if (commitSuffix && !object.sha!.startsWith(commitSuffix)) throw new Error("Versioned tag does not match its commit");
    // Main builds embed the exact publishing commit. A stale open page cannot
    // silently install a release using a different source tree.
    const builtSha = import.meta.env.VITE_RELEASE_COMMIT;
    if (builtSha && builtSha !== object.sha) return { tag, ready: false, checking: false, message: "A newer configurator has been published. Refresh this page." };
    return { tag, ready: true, checking: false, message: "Newest published firmware release verified" };
  } catch (error) {
    return { tag, ready: false, checking: false, message: error instanceof Error ? error.message : "Release verification failed" };
  } finally {
    clearTimeout(timer);
  }
}

export function usePublishedRelease(): ReleaseState & { retry: () => void; verify: () => Promise<ReleaseState> } {
  const [state, setState] = useState<ReleaseState>({ tag: null, ready: false, checking: true, message: "Checking newest published release…" });
  const mounted = useRef(false);
  const requestId = useRef(0);
  const verify = useCallback(async () => {
    const id = ++requestId.current;
    setState((current) => ({ ...current, ready: false, checking: true, message: "Checking newest published release…" }));
    const result = await resolvePublishedRelease();
    if (mounted.current && id === requestId.current) setState(result);
    if (id !== requestId.current) return { ...result, ready: false, message: "Release check superseded; retry" };
    return result;
  }, []);
  useEffect(() => {
    mounted.current = true;
    void verify();
    const interval = window.setInterval(() => void verify(), 5 * 60 * 1000);
    const refresh = () => { if (document.visibilityState === "visible") void verify(); };
    document.addEventListener("visibilitychange", refresh);
    return () => { mounted.current = false; clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [verify]);
  const retry = useCallback(() => { void verify(); }, [verify]);
  return useMemo(() => ({ ...state, retry, verify }), [state, retry, verify]);
}
