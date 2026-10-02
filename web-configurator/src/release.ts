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

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Bound even a fetch/body promise that ignores the supplied AbortSignal. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => {});
    return Promise.reject(new Error("Release lookup timed out"));
  }
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Release lookup timed out"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then((value) => {
      signal.removeEventListener("abort", abort);
      resolve(value);
    }, (error: unknown) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}

/** Anonymous GETs only. Enforce UTF-8 byte limits while reading, not afterwards. */
async function getJson(fetcher: Fetcher, url: string, signal: AbortSignal): Promise<unknown> {
  const response = await abortable(fetcher(url, { signal, cache: "no-store", credentials: "omit", headers: { Accept: "application/json" } }), signal);
  if (!response.ok) throw new Error(`Release lookup failed (${response.status})`);
  const length = response.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > MAX_RESPONSE_BYTES) {
    void response.body?.cancel().catch(() => {});
    throw new Error("Release response is too large");
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await abortable(response.text(), signal);
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw new Error("Release response is too large");
    return JSON.parse(text) as unknown;
  }
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const chunk = await abortable(reader.read(), signal);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error("Release response is too large");
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    try { reader.releaseLock(); } catch { /* A timed-out reader is cancelled above. */ }
  }
}

function publishedRelease(item: unknown): PublishedRelease | null {
  if (!record(item) || typeof item.draft !== "boolean" || typeof item.prerelease !== "boolean") {
    throw new Error("Invalid release record");
  }
  if (item.draft || item.prerelease) return null;
  if (typeof item.tag_name !== "string") throw new Error("Invalid published release tag");
  if (!validReleaseTag(item.tag_name)) return null;
  // Do not silently fall back to an older release when a published candidate
  // cannot be ranked/verified. GitHub publication timestamps include a timezone.
  if (typeof item.published_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(item.published_at) ||
      !Number.isFinite(Date.parse(item.published_at)) || !Number.isSafeInteger(item.id) || Number(item.id) < 0 ||
      typeof item.body !== "string") throw new Error("Malformed published release metadata");
  return item as unknown as PublishedRelease;
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
      if (!Array.isArray(entries) || entries.length > 100) throw new Error("Invalid release response");
      data.push(...entries);
      if (entries.length < 100) break;
      if (page === 10) throw new Error("Release history exceeds the verification limit");
    }
    const releases = data.map(publishedRelease).filter((item): item is PublishedRelease => item !== null)
      .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || b.id - a.id);
    if (!releases.length) throw new Error("No published versioned release is available");
    const newest = releases[0];
    tag = newest.tag_name;
    if (tag.split("+")[0] !== FIRMWARE.releaseVersion) throw new Error("Newest release version differs from this configurator");
    // The tagged source contract proves the UI was built from this firmware,
    // not a current main branch or an unrelated older package catalogue.
    const contract = await getJson(fetcher,
      `https://raw.githubusercontent.com/${FIRMWARE.repository}/${encodeURIComponent(tag)}/web-configurator/src/firmware.generated.json`, controller.signal);
    if (!record(contract)) throw new Error("Invalid tagged firmware contract");
    if (contract.repository !== FIRMWARE.repository || contract.esphomeVersion !== FIRMWARE.esphomeVersion ||
        contract.schemaVersion !== FIRMWARE.schemaVersion || contract.sourceHash !== FIRMWARE.sourceHash ||
        contract.releaseVersion !== FIRMWARE.releaseVersion) {
      return { tag, ready: false, checking: false, message: "Published firmware and this configurator differ. Refresh after matching deployment." };
    }
    if (newest.body?.trim() !== releaseBody(tag).trim()) throw new Error("Published release notes differ from the firmware contract");
    const ref = await getJson(fetcher,
      `https://api.github.com/repos/${FIRMWARE.repository}/git/ref/tags/${encodeURIComponent(tag)}`, controller.signal);
    let object: unknown = record(ref) ? ref.object : null;
    const seen = new Set<string>();
    for (let depth = 0; record(object) && object.type === "tag" && depth < 4; depth++) {
      if (typeof object.sha !== "string" || !/^[a-f0-9]{40}$/.test(object.sha) || seen.has(object.sha)) throw new Error("Invalid or cyclic annotated tag");
      seen.add(object.sha);
      const annotated = await getJson(fetcher, `https://api.github.com/repos/${FIRMWARE.repository}/git/tags/${object.sha}`, controller.signal);
      object = record(annotated) ? annotated.object : null;
    }
    if (!record(object) || object.type !== "commit" || typeof object.sha !== "string" || !/^[a-f0-9]{40}$/.test(object.sha)) {
      throw new Error("Release is not an immutable commit tag");
    }
    const commitSuffix = tag.split("+")[1];
    if (commitSuffix && !object.sha.startsWith(commitSuffix)) throw new Error("Versioned tag does not match its commit");
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
