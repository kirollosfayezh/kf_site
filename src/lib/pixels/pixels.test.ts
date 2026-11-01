import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classify } from "./catalog.ts";
import { CONSENT_CHANGED_EVENT, needsConsent, readConsent } from "./consent.ts";

describe("classify", () => {
  it("files reaching out as a contact and every other click as a CTA", () => {
    for (const label of ["footer.whatsapp", "contact.email", "nav.phone", "whatsapp", "chat.launcher"]) {
      expect(classify(label)).toBe("contact");
    }
    for (const label of ["hero.start-project", "whatsapp.banner", "chat.launcher.extra", "contact.submit"]) {
      expect(classify(label)).toBe("cta");
    }
  });
});

/** A minimal browser: storage, Do Not Track, and the event target the tags use. */
function fakeBrowser({ stored, dnt }: { stored?: string; dnt?: string } = {}) {
  const store = new Map<string, string>(stored ? [["kf-consent", stored]] : []);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  vi.stubGlobal("navigator", { doNotTrack: dnt, userAgent: "test" });
  vi.stubGlobal("window", new EventTarget());
  return store;
}

describe("needsConsent", () => {
  const tagged = { consentMode: true, metaPixelId: " 123 " };

  beforeEach(() => fakeBrowser());
  afterEach(() => vi.unstubAllGlobals());

  it("asks only when consent mode is on and a tag is actually configured", () => {
    expect(needsConsent(tagged)).toBe(true);
    expect(needsConsent({ ...tagged, consentMode: false })).toBe(false);
    expect(needsConsent({ consentMode: true, metaPixelId: "   " })).toBe(false);
    expect(needsConsent(undefined)).toBe(false);
  });

  it("does not ask again once the visitor has decided either way", () => {
    fakeBrowser({ stored: "denied" });
    expect(needsConsent(tagged)).toBe(false);
    fakeBrowser({ stored: "granted" });
    expect(needsConsent(tagged)).toBe(false);
  });

  it("does not ask under Do Not Track, unless the site opted out of honouring it", () => {
    fakeBrowser({ dnt: "1" });
    expect(needsConsent(tagged)).toBe(false);
    expect(needsConsent({ ...tagged, respectDnt: false })).toBe(true);
  });

  it("treats unreadable storage as no decision rather than throwing", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(readConsent()).toBeNull();
    expect(needsConsent(tagged)).toBe(true);
  });
});

describe("setConsent", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stores the decision and announces it on window", async () => {
    const store = fakeBrowser();
    const { setConsent } = await import("./index.ts");
    const seen: unknown[] = [];
    (window as unknown as EventTarget).addEventListener(CONSENT_CHANGED_EVENT, (e) => seen.push((e as CustomEvent).detail));
    setConsent("denied");
    expect(store.get("kf-consent")).toBe("denied");
    expect(seen).toEqual(["denied"]);
  });
});

describe("the data layer", () => {
  /** A fresh module per test: `initPixels` keeps its settings in module state. */
  async function boot(settings: Parameters<typeof import("./index.ts").initPixels>[0], dnt?: string) {
    fakeBrowser({ dnt });
    const win = window as unknown as EventTarget & { location?: { pathname: string }; dataLayer?: unknown[] };
    win.location = { pathname: "/contact" };
    vi.resetModules();
    const pixels = await import("./index.ts");
    pixels.initPixels(settings);
    return { pixels, layer: () => win.dataLayer ?? [] };
  }

  afterEach(() => vi.unstubAllGlobals());

  it("publishes clicks with their semantic event and raw label, loading no tag when none is configured", async () => {
    // No `document` exists here, so a loader injecting a script would throw.
    const { pixels, layer } = await boot({});
    pixels.pixelEvent("footer.whatsapp");
    pixels.pixelPageview("/contact");
    expect(layer()).toEqual([
      { event: "kf_contact", kf_label: "footer.whatsapp", page_path: "/contact" },
      { event: "kf_pageview", page_path: "/contact" },
    ]);
  });

  it("reports a conversion with its value and id, unless its dashboard switch is off", async () => {
    const { pixels, layer } = await boot({ events: { lead: false } });
    pixels.pixelConversion("lead");
    pixels.pixelConversion("booking", { value: 500, currency: "EGP", id: "B-1" });
    expect(layer()).toEqual([
      { event: "kf_conversion", kf_kind: "booking", page_path: "/contact", value: 500, currency: "EGP", transaction_id: "B-1" },
    ]);
  });

  it("publishes nothing at all under Do Not Track", async () => {
    const { pixels, layer } = await boot({}, "1");
    pixels.pixelEvent("hero.start-project");
    pixels.pixelConversion("lead");
    expect(layer()).toEqual([]);
  });

  it("declares Google's consent as denied before anything else when consent mode is on", async () => {
    const { layer } = await boot({ consentMode: true, gtmId: "GTM-TEST" });
    const calls = layer().map((entry) => Array.from(entry as ArrayLike<unknown>));
    expect(calls[0][0]).toBe("js");
    expect(calls[1]).toEqual(["consent", "default", expect.objectContaining({ ad_storage: "denied", analytics_storage: "denied" })]);
    // Held: the container is not requested until the visitor accepts.
    expect(calls).toHaveLength(2);
  });
});
