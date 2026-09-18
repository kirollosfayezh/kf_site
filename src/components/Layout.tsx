import { Suspense, lazy, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { useSmoothScroll } from "../lib/smooth-scroll";

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

  return (
    <div style={{ position: "relative", width: "100%", minHeight: "100vh", background: "var(--bg)" }}>
      <Nav />
      <main>
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
