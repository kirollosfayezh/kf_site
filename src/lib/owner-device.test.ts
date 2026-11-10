import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyOwnerParam, isOwnerDevice, setOwnerDevice } from "./owner-device";

// Node test environment: a minimal localStorage, location and history.
function stubBrowser(href: string) {
  const store = new Map<string, string>();
  const replaced: string[] = [];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("window", {
    location: { href },
    history: { state: null, replaceState: (_s: unknown, _t: string, url: string) => replaced.push(url) },
  });
  return { replaced };
}

describe("owner device", () => {
  afterEach(() => vi.unstubAllGlobals());

  describe("with a browser", () => {
    let replaced: string[];
    beforeEach(() => {
      ({ replaced } = stubBrowser("https://kftechsolutions.dev/services?kf_owner=on&utm_source=x#top"));
    });

    it("?kf_owner=on marks the device and strips only that parameter", () => {
      expect(isOwnerDevice()).toBe(false);
      applyOwnerParam();
      expect(isOwnerDevice()).toBe(true);
      expect(replaced).toEqual(["/services?utm_source=x#top"]);
    });

    it("?kf_owner=off clears it", () => {
      setOwnerDevice(true);
      (window as unknown as { location: { href: string } }).location.href = "https://kftechsolutions.dev/?kf_owner=off";
      applyOwnerParam();
      expect(isOwnerDevice()).toBe(false);
      expect(replaced).toEqual(["/"]);
    });

    it("leaves the URL alone without the parameter", () => {
      (window as unknown as { location: { href: string } }).location.href = "https://kftechsolutions.dev/about";
      applyOwnerParam();
      expect(replaced).toEqual([]);
      expect(isOwnerDevice()).toBe(false);
    });
  });

  it("is never an owner device where storage is unavailable", () => {
    expect(isOwnerDevice()).toBe(false);
  });
});
