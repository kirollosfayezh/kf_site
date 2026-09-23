import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { isLang } from "./lib/langs";
import { applyAutoLanguage } from "./lib/auto-language";
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

// Before anything renders: a first-time visitor who reads Arabic, German or
// French is sent to their own language. Never for a prefixed URL, never for
// someone who has used the switcher, never for a crawler. See auto-language.ts.
applyAutoLanguage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={detectBasename()}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
