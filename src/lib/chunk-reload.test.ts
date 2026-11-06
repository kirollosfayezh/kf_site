import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isChunkLoadError, reloadForNewDeploy, resetChunkReload } from "./chunk-reload.ts";

describe("chunk reload after a deploy", () => {
  const reload = vi.fn();
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    vi.stubGlobal("window", { location: { reload } });
    reload.mockClear();
    resetChunkReload();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("recognises each browser's failed-module message, and nothing else", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/Legal-1ol2EnMy.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("reloads once, and not again moments later (a real outage is not looped)", () => {
    expect(reloadForNewDeploy(1_000_000)).toBe(true);
    resetChunkReload(); // the reloaded page starts fresh in memory
    expect(reloadForNewDeploy(1_005_000)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads again after the quiet window, e.g. at the next deploy", () => {
    expect(reloadForNewDeploy(1_000_000)).toBe(true);
    resetChunkReload();
    expect(reloadForNewDeploy(1_020_000)).toBe(true);
  });

  it("still reloads only once when storage is blocked", () => {
    vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(reloadForNewDeploy()).toBe(true);
    expect(reloadForNewDeploy()).toBe(false);
  });
});
