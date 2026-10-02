import { afterEach, describe, expect, it, vi } from "vitest";
import { FIRMWARE, releaseBody } from "./firmware";
import { FRESH_MS, persistSession, restoreSession, resolvePublishedRelease, reusable, throttledUntil } from "./release";
const sha = "abcdef012345" + "0".repeat(28);
const tag = `${FIRMWARE.releaseVersion}+${sha.slice(0, 12)}`;
const release = (name = tag, published = "2026-10-01T12:00:00Z", id = 1) => ({
  tag_name: name, published_at: published, id, draft: false, prerelease: false, body: releaseBody(name),
});
const response = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));
function server(releases: unknown[] = [release()], contract: unknown = FIRMWARE, commit = sha) {
  return vi.fn((url: string) => {
    if (url.includes("/releases?")) return response(releases);
    if (url.includes("raw.githubusercontent.com")) return response(contract);
    if (url.includes("git/ref/tags")) return response({ object: { type: "commit", sha: commit } });
    throw new Error(`Unexpected request ${url}`);
  });
}
afterEach(() => vi.unstubAllEnvs());

describe("newest published immutable firmware", () => {
  it("sorts by publication, not version, creation/list order or GitHub latest markers", async () => {
    const fetcher = server([release("9.9.9", "2026-01-01T00:00:00Z", 99), release()]);
    const resolved = await resolvePublishedRelease(fetcher);
    expect(resolved).toMatchObject({ tag, ready: true, checking: false });
    expect(fetcher.mock.calls[1][0]).toContain(encodeURIComponent(tag));
  });
  it("filters drafts, prereleases, branches and unsafe refs", async () => {
    const fetcher = server([{ ...release("9.9.9"), draft: true }, { ...release("9.9.8"), prerelease: true }, release("main"), release("../main"), release()]);
    expect((await resolvePublishedRelease(fetcher)).tag).toBe(tag);
  });
  it("checks raw tagged metadata, source hash, version, release notes and commit provenance", async () => {
    expect((await resolvePublishedRelease(server())).ready).toBe(true);
    for (const changed of [{ ...FIRMWARE, sourceHash: "bad" }, { ...FIRMWARE, releaseVersion: "0.0.1" }, { ...FIRMWARE, schemaVersion: 99 }]) {
      expect(await resolvePublishedRelease(server([release()], changed))).toMatchObject({ tag, ready: false });
    }
    expect((await resolvePublishedRelease(server([{ ...release(), body: "Different notes" }]))).ready).toBe(false);
    expect((await resolvePublishedRelease(server([release()], FIRMWARE, "b".repeat(40)))).ready).toBe(false);
  });
  it("rejects stale deployed source commits and accepts the matching build", async () => {
    vi.stubEnv("VITE_RELEASE_COMMIT", "b".repeat(40));
    expect((await resolvePublishedRelease(server())).ready).toBe(false);
    vi.stubEnv("VITE_RELEASE_COMMIT", sha);
    expect((await resolvePublishedRelease(server())).ready).toBe(true);
  });
  it("supports immutable annotated tags with a bounded commit dereference", async () => {
    const fetcher = server();
    fetcher.mockImplementation((url) => url.includes("git/ref/tags") ? response({ object: { type: "tag", sha: "a".repeat(40) } }) :
      url.includes("git/tags/") ? response({ object: { type: "commit", sha } }) : url.includes("/releases?") ? response([release()]) : response(FIRMWARE));
    expect((await resolvePublishedRelease(fetcher)).ready).toBe(true);
  });
  it("uses anonymous bounded requests and never sends user preferences or credentials", async () => {
    const requests: [string, RequestInit | undefined][] = [];
    const base = server();
    await resolvePublishedRelease((url, init) => { requests.push([url, init]); return base(url); });
    for (const [url, init] of requests) {
      expect(url).toMatch(/^https:\/\/(api.github.com|raw.githubusercontent.com)\//);
      expect(init?.credentials).toBe("omit");
      expect(init?.body).toBeUndefined();
      expect(JSON.stringify(init?.headers)).not.toMatch(/token|authorization/i);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });
  it("does not fall back to main, an old tag, or a bundled candidate when unavailable", async () => {
    for (const fetcher of [() => response([], 403), () => response([]), () => Promise.reject(new Error("offline")), () => response({})])
      expect((await resolvePublishedRelease(fetcher)).ready).toBe(false);
    const unpublished = server();
    unpublished.mockImplementation((url) => url.includes("/releases?") ? response([release()]) : response({}, 404));
    expect((await resolvePublishedRelease(unpublished)).ready).toBe(false);
  });
  it("honours publication order across pagination and fails on truncated history", async () => {
    const first = Array.from({ length: 100 }, (_, id) => release("1.0.0", "2025-01-01T00:00:00Z", id));
    const base = server();
    const fetcher = vi.fn((url: string) => url.includes("&page=1") ? response(first) : url.includes("&page=2") ? response([release()]) : base(url));
    expect((await resolvePublishedRelease(fetcher)).tag).toBe(tag);
    expect((await resolvePublishedRelease(() => response(first))).ready).toBe(false);
  });
  it("times out instead of leaving downloads enabled or a hanging verification", async () => {
    const fetcher = (_url: string, init?: RequestInit): Promise<Response> => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("timeout")));
    });
    expect((await resolvePublishedRelease(fetcher, 10)).ready).toBe(false);
  });
});

function streamed(bytes: Uint8Array[], cancel = () => {}) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) { for (const chunk of bytes) controller.enqueue(chunk); controller.close(); },
    cancel,
  }));
}

describe("fail-closed release input and response bounds", () => {
  it("rejects malformed public metadata instead of silently choosing an older release", async () => {
    for (const change of [{ id: "2" }, { id: -1 }, { id: 1.5 }, { body: null },
      { published_at: "2026-10-02T00:00:00" }, { published_at: "invalid" }, { draft: "false" }, { tag_name: null }]) {
      const result = await resolvePublishedRelease(server([release(), { ...release(tag, "2026-10-02T00:00:00Z", 2), ...change }]));
      expect(result.ready).toBe(false);
    }
  });
  it("fails on null/array/primitive release records", async () => {
    for (const invalid of [null, [], 1, "bad", {}]) {
      expect((await resolvePublishedRelease(server([release(), invalid]))).ready).toBe(false);
    }
  });
  it("does not install an older supported tag when the newest version differs", async () => {
    const fetcher = server([release(), release("9.9.9", "2026-10-02T00:00:00Z", 2)]);
    expect(await resolvePublishedRelease(fetcher)).toMatchObject({ tag: "9.9.9", ready: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("uses timezone-normalized publication time and a numeric ID tie break", async () => {
    const newer = release(tag, "2026-10-02T04:00:00+04:00", 2);
    const older = { ...release(tag, "2026-10-02T00:00:00Z", 1), body: "Wrong tie winner" };
    expect((await resolvePublishedRelease(server([older, newer]))).ready).toBe(true);
  });
  it("checks tagged repository/SDK identity and rejects malformed contract roots", async () => {
    for (const changed of [null, [], "bad", { ...FIRMWARE, repository: "other/repo" }, { ...FIRMWARE, esphomeVersion: "2026.9.0" }]) {
      expect((await resolvePublishedRelease(server([release()], changed))).ready).toBe(false);
    }
  });
  it("rejects more than one API page worth of entries", async () => {
    const fetcher = server(Array.from({ length: 101 }, () => release()));
    expect((await resolvePublishedRelease(fetcher)).ready).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects oversized declared bodies before looking up contracts", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const fetcher = vi.fn(() => Promise.resolve(new Response(body, { headers: { "Content-Length": String(1024 * 1024 + 1) } })));
    expect((await resolvePublishedRelease(fetcher)).message).toContain("too large");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("counts UTF-8 bytes instead of JavaScript characters", async () => {
    const data = JSON.stringify([{ ...release(), body: "😀".repeat(270_000) }]);
    expect(data.length).toBeLessThan(1024 * 1024);
    expect(new TextEncoder().encode(data).byteLength).toBeGreaterThan(1024 * 1024);
    const fetcher = vi.fn(() => Promise.resolve(new Response(data)));
    expect((await resolvePublishedRelease(fetcher)).message).toContain("too large");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("cancels an over-limit chunked response while reading", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); }, cancel,
    });
    expect((await resolvePublishedRelease(() => Promise.resolve(new Response(body)))).message).toContain("too large");
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("decodes valid UTF-8 split across chunks and rejects invalid byte sequences", async () => {
    const data = new TextEncoder().encode(JSON.stringify([release()]));
    const base = server();
    const fetcher = vi.fn((url: string) => url.includes("/releases?") ? Promise.resolve(streamed(Array.from(data, (byte) => Uint8Array.of(byte)))) : base(url));
    expect((await resolvePublishedRelease(fetcher)).ready).toBe(true);
    expect((await resolvePublishedRelease(() => Promise.resolve(streamed([Uint8Array.of(0xc3, 0x28)])))).ready).toBe(false);
  });
  it("times out a fetcher even if it ignores the AbortSignal", async () => {
    const result = await resolvePublishedRelease(() => new Promise<Response>(() => {}), 10);
    expect(result).toMatchObject({ ready: false, checking: false });
    expect(result.message).toContain("timed out");
  });
  it("times out and cancels an unfinished response body", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const result = await resolvePublishedRelease(() => Promise.resolve(new Response(body)), 10);
    expect(result.ready).toBe(false);
    expect(result.message).toContain("timed out");
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("rejects cyclic or malformed tag objects with bounded requests", async () => {
    const base = server();
    const cyclic = vi.fn((url: string) => url.includes("git/ref/tags") || url.includes("git/tags/") ?
      response({ object: { type: "tag", sha: "a".repeat(40) } }) : base(url));
    expect((await resolvePublishedRelease(cyclic)).ready).toBe(false);
    expect(cyclic.mock.calls.filter(([url]) => url.includes("git/tags/")).length).toBe(1);
    for (const data of [null, [], { object: null }, { object: { type: "commit", sha: 123 } }]) {
      const malformed = vi.fn((url: string) => url.includes("git/ref/tags") ? response(data) : base(url));
      expect((await resolvePublishedRelease(malformed)).ready).toBe(false);
    }
  });
});

describe("anonymous GitHub quota (60 requests/hour per IP, shared by a whole network)", () => {
  const limited = (status: number, headers: Record<string, string>) =>
    Promise.resolve(new Response(JSON.stringify({ message: "API rate limit exceeded" }), { status, headers }));
  it("reports a 403 quota exhaustion as a timed pause instead of an opaque failure", async () => {
    const reset = Math.floor(Date.now() / 1000) + 600;
    const result = await resolvePublishedRelease(() => limited(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) }));
    expect(result).toMatchObject({ tag: null, ready: false, checking: false });
    expect(result.message).toMatch(/rate limit/i);
    expect(result.message).not.toContain("failed (403)");
    expect(result.retryAt).toBeGreaterThan(reset * 1000);
    expect(result.retryAt).toBeLessThan(reset * 1000 + 10_000);
  });
  it("honours retry-after on 429 and bounds pauses without usable headers", () => {
    const now = 1_700_000_000_000;
    const api = "https://api.github.com/repos/x/y/releases?per_page=100&page=1";
    expect(throttledUntil(429, new Headers({ "retry-after": "30" }), api, now)).toBe(now + 35_000);
    expect(throttledUntil(403, new Headers(), api, now)).toBe(now + 5 * 60 * 1000 + 5000);
    expect(throttledUntil(403, new Headers({ "x-ratelimit-reset": String(now / 1000 + 86_400) }), api, now)).toBe(now + 65 * 60 * 1000 + 5000);
    expect(throttledUntil(403, new Headers({ "x-ratelimit-reset": "garbage" }), api, now)).toBe(now + 5 * 60 * 1000 + 5000);
    // Clock skew: a reset already in the past still pauses briefly rather than hammering.
    expect(throttledUntil(403, new Headers({ "x-ratelimit-reset": String(now / 1000 - 10) }), api, now)).toBe(now + 5 * 60 * 1000 + 5000);
  });
  it("keeps non-quota failures and other hosts as plain errors", async () => {
    const raw = "https://raw.githubusercontent.com/x/y/1.0.0/web-configurator/src/firmware.generated.json";
    expect(throttledUntil(403, new Headers(), raw, 0)).toBeNull();
    expect(throttledUntil(404, new Headers({ "x-ratelimit-remaining": "0" }), raw, 0)).toBeNull();
    expect(throttledUntil(500, new Headers(), "https://api.github.com/x", 0)).toBeNull();
    const result = await resolvePublishedRelease(() => response({}, 404));
    expect(result.message).toBe("Release lookup failed (404)");
    expect(result.retryAt).toBeUndefined();
  });
  it("still fails closed while paused", async () => {
    const result = await resolvePublishedRelease(() => limited(429, { "retry-after": "60" }));
    expect(result.ready).toBe(false);
  });
  it("reuses a pause unconditionally and fresh results only within the window", () => {
    const now = 1_700_000_000_000;
    const ok = { at: now - 1000, result: { tag, ready: true, checking: false, message: "ok" } };
    expect(reusable(null, now, FRESH_MS)).toBe(false);
    expect(reusable(ok, now, 0)).toBe(false);
    expect(reusable(ok, now, FRESH_MS)).toBe(true);
    expect(reusable({ ...ok, at: now - FRESH_MS }, now, FRESH_MS)).toBe(false);
    expect(reusable({ ...ok, at: now + 60_000 }, now, FRESH_MS)).toBe(false);
    const paused = { at: now - 60_000, result: { tag: null, ready: false, checking: false, message: "paused", retryAt: now + 1 } };
    expect(reusable(paused, now, 0)).toBe(true);
    expect(reusable({ ...paused, result: { ...paused.result, retryAt: now } }, now, 0)).toBe(false);
  });
  it("restores only a verified result or an active pause for the identical bundle", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const now = 1_700_000_000_000;
    const verified = { at: now - 1000, result: { tag, ready: true, checking: false, message: "Newest published firmware release verified" } };
    persistSession(storage, verified, "build-a");
    expect(restoreSession(storage, "build-a", now)).toEqual(verified);
    expect(restoreSession(storage, "build-b", now)).toBeNull();
    expect(restoreSession(storage, "build-a", now + FRESH_MS)).toBeNull();
    const paused = { at: now, result: { tag: null, ready: false, checking: false, message: "paused", retryAt: now + 60_000 } };
    persistSession(storage, paused, "build-a");
    expect(restoreSession(storage, "build-a", now + 59_000)).toEqual(paused);
    expect(restoreSession(storage, "build-a", now + 61_000)).toBeNull();
    persistSession(storage, { at: now, result: { tag, ready: false, checking: false, message: "differs" } }, "build-a");
    expect(store.size).toBe(0);
    store.set("max7219-clock.release.v1", JSON.stringify({ build: "build-a", at: now, result: { tag: "main", ready: true, checking: false, message: "x" } }));
    expect(restoreSession(storage, "build-a", now)).toBeNull();
    store.set("max7219-clock.release.v1", "{not json");
    expect(restoreSession(storage, "build-a", now)).toBeNull();
    expect(restoreSession(null, "build-a", now)).toBeNull();
  });
});
