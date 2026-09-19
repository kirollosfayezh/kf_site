import { Routes, Route } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import { I18nProvider, type Lang } from "./lib/i18n";
import { ThemeProvider } from "./lib/theme";
import { Layout } from "./components/Layout";
import { getSettings } from "./services/content";
import { AnalyticsProvider } from "./lib/analytics-provider";
import type { SiteSettings } from "./services/api-types";

/**
 * Route-level code splitting. Every page is its own chunk, so a first visit to
 * `/` no longer downloads the contact form, the campaign landing page and the
 * article template alongside it.
 */
const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const About = lazy(() => import("./pages/About").then((m) => ({ default: m.About })));
const Services = lazy(() => import("./pages/Services").then((m) => ({ default: m.Services })));
const Solutions = lazy(() => import("./pages/Solutions").then((m) => ({ default: m.Solutions })));
const Projects = lazy(() => import("./pages/Projects").then((m) => ({ default: m.Projects })));
const Blog = lazy(() => import("./pages/Blog").then((m) => ({ default: m.Blog })));
const Article = lazy(() => import("./pages/Article").then((m) => ({ default: m.Article })));
const Contact = lazy(() => import("./pages/Contact").then((m) => ({ default: m.Contact })));
const Campaign = lazy(() => import("./pages/Campaign").then((m) => ({ default: m.Campaign })));

/**
 * Held while a page chunk loads. It reserves a full viewport of the page
 * background with a quiet progress bar rather than collapsing to nothing, so
 * navigation never flashes an empty dark screen or jumps the footer up.
 */
function PageFallback() {
  return (
    <div className="kf-page-fallback" role="status" aria-live="polite">
      <span className="kf-page-fallback-bar" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function useSiteSettings(): { lang: Lang; settings: SiteSettings | null } {
  const [lang, setLang] = useState<Lang>("en");
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((value) => {
        if (cancelled) return;
        setSettings(value);
        if (value.defaultLanguage === "en" || value.defaultLanguage === "ar") {
          setLang(value.defaultLanguage);
        }
      })
      .catch(() => {
        /* keep English default, and load no pixels, if settings can't be fetched */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { lang, settings };
}

export default function App() {
  const { lang: defaultLang, settings } = useSiteSettings();

  return (
    <ThemeProvider>
      <I18nProvider defaultLang={defaultLang}>
        <AnalyticsProvider settings={settings} />
        <Routes>
          <Route element={<Layout />}>
            <Route
              path="/"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Home />
                </Suspense>
              }
            />
            <Route
              path="/about"
              element={
                <Suspense fallback={<PageFallback />}>
                  <About />
                </Suspense>
              }
            />
            <Route
              path="/services"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Services />
                </Suspense>
              }
            />
            <Route
              path="/solutions"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Solutions />
                </Suspense>
              }
            />
            <Route
              path="/projects"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Projects />
                </Suspense>
              }
            />
            <Route
              path="/blog"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Blog />
                </Suspense>
              }
            />
            <Route
              path="/blog/:id"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Article />
                </Suspense>
              }
            />
            <Route
              path="/contact"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Contact />
                </Suspense>
              }
            />
            <Route
              path="/campaign"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Campaign />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </I18nProvider>
    </ThemeProvider>
  );
}
