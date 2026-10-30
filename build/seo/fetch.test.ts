import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeoFetchError, enabledLangs, fetchCollection, fetchJson } from "./fetch.ts";
import type { SiteSettings } from "../../src/services/api-types.ts";

const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
const status = (code: number) => new Response("{}", { status: code });

describe("fetchJson (build-time CMS reads)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Runs a request to completion, fast-forwarding the retry backoff. */
  async function settle<T>(promise: Promise<T>): Promise<T> {
    const result = promise.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await vi.runAllTimersAsync();
    const r = await result;
    if ("error" in r) throw r.error;
    return r.value;
  }

  it("skips the network entirely when no API base is configured", async () => {
    expect(await fetchJson(undefined, "/api/content/settings")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unwraps the API envelope and tolerates a trailing slash on the base", async () => {
    fetchMock.mockResolvedValueOnce(ok([{ id: "1" }]));
    expect(await settle(fetchJson("https://api.test/", "/api/content/blogPosts"))).toEqual([{ id: "1" }]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/content/blogPosts");
  });

  it("waits out a sleeping backend: retries server errors and timeouts", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("The operation was aborted due to timeout"))
      .mockResolvedValueOnce(status(503))
      .mockResolvedValueOnce(ok({ siteName: "KF" }));
    expect(await settle(fetchJson("https://api.test", "/api/content/settings"))).toEqual({ siteName: "KF" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 4xx — waiting will not fix a wrong URL", async () => {
    fetchMock.mockResolvedValue(status(404));
    await expect(settle(fetchJson("https://api.test", "/api/nope"))).rejects.toThrow(new SeoFetchError("/api/nope: HTTP 404"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails the build once every attempt is spent", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(settle(fetchJson("https://api.test", "/api/seo", [10, 10, 10]))).rejects.toBeInstanceOf(SeoFetchError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("lists only published items that have an address", async () => {
    fetchMock.mockResolvedValueOnce(
      ok([{ slug: "a" }, { id: "b", published: true }, { slug: "c", published: false }, { title: { en: "no address" } }]),
    );
    const items = await settle(fetchCollection("https://api.test", "projects"));
    expect(items.map((i) => i.slug ?? i.id)).toEqual(["a", "b"]);
  });
});

describe("enabledLangs", () => {
  const settings = (languages: SiteSettings["languages"]) => ({ languages }) as SiteSettings;

  it("always serves English and keeps the site's language order", () => {
    expect(
      enabledLangs(
        settings([
          { code: "fr", label: "Français", enabled: true },
          { code: "ar", label: "العربية", enabled: true },
          { code: "de", label: "Deutsch", enabled: false },
          { code: "es", label: "Español", enabled: true },
        ]),
      ),
    ).toEqual(["en", "ar", "fr"]);
  });

  it("falls back to English alone without settings", () => {
    expect(enabledLangs(null)).toEqual(["en"]);
  });
});
