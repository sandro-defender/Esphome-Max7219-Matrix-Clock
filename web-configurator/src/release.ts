import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FIRMWARE, releaseBody } from "./firmware";
import { validReleaseTag } from "./yaml";

export interface ReleaseState {
  tag: string | null;
  ready: boolean;
  checking: boolean;
  message: string;
  /** Set when GitHub throttled the anonymous lookup: epoch ms of the next automatic attempt. */
  retryAt?: number;
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
/** Fallback pause when GitHub throttles without a usable reset header. */
const DEFAULT_THROTTLE_MS = 5 * 60 * 1000;
/** Longest pause honoured from response headers (a clock skew guard). */
const MAX_THROTTLE_MS = 65 * 60 * 1000;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * GitHub's anonymous REST quota is 60 requests per hour **per IP address**,
 * shared by everyone behind the same NAT/VPN. Exhausting it yields HTTP 403
 * (or 429) with `x-ratelimit-remaining: 0`; `x-ratelimit-reset` says when the
 * window reopens. Report that as a pause, not an opaque "failed (403)".
 */
export class RateLimitError extends Error {
  constructor(readonly retryAt: number) {
    super(`GitHub API rate limit reached for this network (shared anonymous quota). Automatic retry at ${clockTime(retryAt)}.`);
    this.name = "RateLimitError";
  }
}

export function clockTime(epochMs: number): string {
  try { return new Date(epochMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return new Date(epochMs).toISOString().slice(11, 16) + " UTC"; }
}

/** Translate a throttled GitHub response into a bounded retry time, or null. */
export function throttledUntil(status: number, headers: Headers, url: string, now = Date.now()): number | null {
  const api = /^https:\/\/api\.github\.com\//.test(url);
  const remaining = headers.get("x-ratelimit-remaining");
  if (status !== 429 && !(status === 403 && (remaining === "0" || api))) return null;
  const retryAfter = Number(headers.get("retry-after"));
  const reset = Number(headers.get("x-ratelimit-reset"));
  let wait = DEFAULT_THROTTLE_MS;
  if (Number.isFinite(retryAfter) && retryAfter > 0) wait = retryAfter * 1000;
  else if (Number.isFinite(reset) && reset * 1000 > now) wait = reset * 1000 - now;
  // Add a few seconds so the first retry lands after GitHub's window reopens.
  return now + Math.min(Math.max(wait, 1000), MAX_THROTTLE_MS) + 5000;
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
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    const retryAt = throttledUntil(response.status, response.headers, url);
    throw retryAt === null ? new Error(`Release lookup failed (${response.status})`) : new RateLimitError(retryAt);
  }
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
    if (tag !== FIRMWARE.releaseVersion) throw new Error("Newest release version differs from this configurator");
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
    // Main builds embed the exact publishing commit. A stale open page cannot
    // silently install a release using a different source tree.
    const builtSha = import.meta.env.VITE_RELEASE_COMMIT;
    if (builtSha && builtSha !== object.sha) return { tag, ready: false, checking: false, message: "A newer configurator has been published. Refresh this page." };
    return { tag, ready: true, checking: false, message: "Newest published firmware release verified" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Release verification failed";
    if (error instanceof RateLimitError) return { tag, ready: false, checking: false, message, retryAt: error.retryAt };
    return { tag, ready: false, checking: false, message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Request budget. Every verification costs two anonymous GitHub API requests
 * (release list, tag object) out of a 60/hour allowance shared by the whole
 * IP address, so re-checks are deliberately sparse and results are reused.
 */
export const RECHECK_MS = 15 * 60 * 1000;
/** Tab focus and page reloads reuse a verification this recent. */
export const FRESH_MS = 5 * 60 * 1000;
/** Consecutive copy/download clicks share one pre-export verification. */
export const INSTALL_FRESH_MS = 30 * 1000;

export interface CachedRelease {
  at: number;
  result: ReleaseState;
}

/**
 * Decide whether a finished check can answer instead of a new network round
 * trip. A throttle pause always answers (another request cannot succeed and
 * only prolongs GitHub's block); otherwise only a result newer than `maxAgeMs`.
 */
export function reusable(cached: CachedRelease | null, now: number, maxAgeMs: number): boolean {
  if (!cached) return false;
  if (cached.result.retryAt !== undefined && now < cached.result.retryAt) return true;
  return maxAgeMs > 0 && now - cached.at >= 0 && now - cached.at < maxAgeMs;
}

const SESSION_KEY = "max7219-clock.release.v1";
/** A cached verification only applies to the exact bundle that produced it. */
const BUILD_ID = `${FIRMWARE.schemaVersion}:${FIRMWARE.sourceHash}:${FIRMWARE.releaseVersion}:${import.meta.env.VITE_RELEASE_COMMIT ?? ""}`;

/**
 * Restore a verified result or throttle pause from this tab's session, so a
 * reload storm does not spend the shared quota. Failures are never restored:
 * after a fix on GitHub a reload must look again. Nothing user-specific is
 * stored and nothing is sent anywhere.
 */
export function restoreSession(storage: Pick<Storage, "getItem"> | null, build = BUILD_ID, now = Date.now()): CachedRelease | null {
  try {
    const raw = storage?.getItem(SESSION_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!record(data) || data.build !== build || typeof data.at !== "number" || !record(data.result)) return null;
    const result = data.result;
    if (typeof result.message !== "string" || typeof result.ready !== "boolean" ||
        (result.tag !== null && (typeof result.tag !== "string" || !validReleaseTag(result.tag)))) return null;
    const retryAt = typeof result.retryAt === "number" && Number.isFinite(result.retryAt) ? result.retryAt : undefined;
    const cached: CachedRelease = { at: data.at, result: { tag: result.tag, ready: result.ready, checking: false, message: result.message, retryAt } };
    if (retryAt !== undefined && now < retryAt) return cached;
    if (result.ready && reusable(cached, now, FRESH_MS)) return cached;
    return null;
  } catch {
    return null;
  }
}

export function persistSession(storage: Pick<Storage, "setItem" | "removeItem"> | null, cached: CachedRelease, build = BUILD_ID): void {
  try {
    const { result } = cached;
    if (result.ready || result.retryAt !== undefined) storage?.setItem(SESSION_KEY, JSON.stringify({ build, at: cached.at, result }));
    else storage?.removeItem(SESSION_KEY);
  } catch { /* Private mode or a full quota only loses the optimisation. */ }
}

function sessionStore(): Storage | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}

export interface VerifyOptions {
  /** Reuse a finished check newer than this instead of a new round trip. */
  maxAgeMs?: number;
  /** User-initiated: ignore an active throttle pause and ask GitHub again. */
  force?: boolean;
}

export function usePublishedRelease(): ReleaseState & { retry: () => void; verify: (options?: VerifyOptions) => Promise<ReleaseState> } {
  const restored = useRef<CachedRelease | null | undefined>(undefined);
  if (restored.current === undefined) restored.current = restoreSession(sessionStore());
  const [state, setState] = useState<ReleaseState>(restored.current?.result ??
    { tag: null, ready: false, checking: true, message: "Checking newest published release…" });
  const mounted = useRef(false);
  const requestId = useRef(0);
  const last = useRef<CachedRelease | null>(restored.current);
  const inflight = useRef<Promise<ReleaseState> | null>(null);
  const verify = useCallback(async ({ maxAgeMs = 0, force = false }: VerifyOptions = {}) => {
    const cached = last.current;
    if (!force && reusable(cached, Date.now(), maxAgeMs)) return cached!.result;
    if (inflight.current) return inflight.current;
    const id = ++requestId.current;
    setState((current) => ({ ...current, ready: false, checking: true, retryAt: undefined, message: "Checking newest published release…" }));
    const run = (async () => {
      try {
        const result = await resolvePublishedRelease();
        if (id === requestId.current) {
          last.current = { at: Date.now(), result };
          persistSession(sessionStore(), last.current);
          if (mounted.current) setState(result);
          return result;
        }
        return { ...result, ready: false, message: "Release check superseded; retry" };
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (!restored.current) void verify();
    const interval = window.setInterval(() => void verify(), RECHECK_MS);
    const refresh = () => { if (document.visibilityState === "visible") void verify({ maxAgeMs: FRESH_MS }); };
    document.addEventListener("visibilitychange", refresh);
    return () => { mounted.current = false; clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [verify]);
  // Try again automatically once GitHub's quota window reopens.
  useEffect(() => {
    if (state.retryAt === undefined) return;
    const timer = window.setTimeout(() => void verify({ force: true }), Math.max(0, state.retryAt - Date.now()));
    return () => clearTimeout(timer);
  }, [state.retryAt, verify]);
  const retry = useCallback(() => { void verify({ force: true }); }, [verify]);
  return useMemo(() => ({ ...state, retry, verify }), [state, retry, verify]);
}
