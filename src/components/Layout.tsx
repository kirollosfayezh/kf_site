import { Suspense, lazy, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { useSmoothScroll } from "../lib/smooth-scroll";
import { RouteSeo } from "./Seo";
import { useI18n } from "../lib/i18n";

/**
 * The chat widget pulls in socket.io-client, which is the single largest
 * dependency on the site and is needed by nobody in the first seconds of a
 * visit. It is split out and only mounted once the browser is idle (or the
 * visitor interacts), so it never competes with the hero for bandwidth.
 */
const ChatWidget = lazy(() => import("./chat/ChatWidget").then((m) => ({ default: m.ChatWidget })));

function useDeferredMount(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      setReady(true);
    };

    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    const idle = ric ? ric(go, { timeout: 3000 }) : window.setTimeout(go, 2000);

    // Any real interaction brings it forward — a visitor reaching for the
    // launcher should not wait on an idle callback that never fires.
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "scroll"];
    events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));

    return () => {
      done = true;
      const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (ric && cic) cic(idle);
      else clearTimeout(idle);
      events.forEach((e) => window.removeEventListener(e, go));
    };
  }, [ready]);

  return ready;
}

export function Layout() {
  useSmoothScroll();
  const chatReady = useDeferredMount();
  const { t } = useI18n();

  return (
    <div style={{ position: "relative", width: "100%", minHeight: "100vh", background: "var(--bg)" }}>
      <RouteSeo />
      {/* First tab stop: past the nine nav controls straight to the page.
          Focus moves into <main> itself, so the next Tab lands on the page's
          first link; the hash stays out of the URL. */}
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        {t("Skip to content")}
      </a>
      <Nav />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      {chatReady && (
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
      )}
    </div>
  );
}
