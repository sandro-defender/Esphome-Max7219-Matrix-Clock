import { afterEach, describe, expect, it, vi } from "vitest";
import { FIRMWARE, releaseBody } from "./firmware";
import { resolvePublishedRelease } from "./release";
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
