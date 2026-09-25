import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { isLang, type Lang } from "./lib/langs";
import { applyAutoLanguage } from "./lib/auto-language";
import { loadDict, setOverrides } from "./lib/dict";
import { primeContent } from "./services/content-cache";
import "./index.css";
import App from "./App.tsx";

/**
 * Non-English pages live under a language prefix — `/de/services`, `/ar/blog`.
 *
 * Handing that prefix to the router as a `basename` means every route and every
 * `<Link to="/services">` keeps working untouched and simply resolves within the
 * current language. The alternative — threading an optional `:lang` segment
 * through every route — would have to be repeated in each `Link` and is easy to
 * forget on one of them.
 */
function detectBasename(): string | undefined {
  const first = window.location.pathname.split("/").filter(Boolean)[0];
  return isLang(first) && first !== "en" ? `/${first}` : undefined;
}

/** The URL decides the language of the first render — the same rule the
 *  build followed when it wrote the HTML being hydrated. */
function urlLang(): Lang {
  const first = window.location.pathname.split("/").filter(Boolean)[0];
  return isLang(first) ? first : "en";
}

/**
 * What the build embedded in the page: the CMS content the server render
 * read (so the client's first render reads the same), and the dashboard's
 * wording overrides for this language.
 */
interface Snapshot {
  v: 1;
  lang: Lang;
  content: Record<string, unknown>;
  i18n: Partial<Record<Lang, Record<string, string>>>;
}

function readSnapshot(): Snapshot | null {
  const el = document.getElementById("kf-content");
  if (!el?.textContent) return null;
  try {
    const parsed = JSON.parse(el.textContent) as Snapshot;
    return parsed?.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

// Before anything renders: a first-time visitor who reads Arabic, German or
// French is sent to their own language. Never for a prefixed URL, never for
// someone who has used the switcher, never for a crawler. See auto-language.ts.
// (The prerendered pages carry the same logic inline, so it runs before paint.)
applyAutoLanguage();

const root = document.getElementById("root")!;

/*
 * Prerendered pages arrive with their body and a snapshot, and are hydrated:
 * the HTML a crawler saw is the HTML the visitor sees, with React attaching
 * to it. The client-only shells — 404.html, article-shell.html for items
 * published after the last build, private quote links — arrive empty and are
 * rendered from scratch. A body without a snapshot is treated as a shell too,
 * rather than hydrated against content the cache does not hold.
 */
const snapshot = root.firstElementChild ? readSnapshot() : null;
const hydrating = snapshot !== null;
if (!hydrating && root.firstElementChild) root.replaceChildren();

const lang = urlLang();
if (snapshot) {
  primeContent(snapshot.content);
  for (const [l, map] of Object.entries(snapshot.i18n ?? {})) {
    if (isLang(l) && map) setOverrides(l, map);
  }
}
// The dictionary must be in place before the first render: hydrating Arabic
// markup with English strings would throw the whole page away.
await loadDict(lang);

const app = (
  <StrictMode>
    <BrowserRouter basename={detectBasename()}>
      <App initialLang={lang} />
    </BrowserRouter>
  </StrictMode>
);

if (hydrating) {
  hydrateRoot(root, app, {
    // A greppable prefix, so the prerender's verification script can fail on
    // any mismatch rather than on React's varying wording.
    onRecoverableError: (error, info) => {
      console.error("[kf-hydration]", error, info?.componentStack ?? "");
    },
  });
} else {
  createRoot(root).render(app);
}
