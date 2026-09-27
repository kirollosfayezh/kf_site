import { Routes, Route } from "react-router-dom";
import { Suspense, lazy, useMemo } from "react";
import { I18nProvider, isLang, type Lang } from "./lib/i18n";
import { ThemeProvider } from "./lib/theme";
import { SettingsProvider } from "./lib/settings";
import { Layout } from "./components/Layout";
import { useSiteSettings } from "./hooks/useContent";
import { AnalyticsProvider } from "./lib/analytics-provider";
import { ConsentBanner } from "./components/ConsentBanner";
import { PromoDialog } from "./components/PromoDialog";
import { SamuraiIntro } from "./components/SamuraiIntro";
import { SeoProvider } from "./components/Seo";

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
const ProjectCaseStudy = lazy(() =>
  import("./pages/ProjectCaseStudy").then((m) => ({ default: m.ProjectCaseStudy })),
);
const ServiceDetail = lazy(() =>
  import("./pages/ServiceDetail").then((m) => ({ default: m.ServiceDetail })),
);
const Legal = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Legal })));
const Blog = lazy(() => import("./pages/Blog").then((m) => ({ default: m.Blog })));
const Article = lazy(() => import("./pages/Article").then((m) => ({ default: m.Article })));
const Contact = lazy(() => import("./pages/Contact").then((m) => ({ default: m.Contact })));
const Campaign = lazy(() => import("./pages/Campaign").then((m) => ({ default: m.Campaign })));
const Book = lazy(() => import("./pages/Book").then((m) => ({ default: m.Book })));
const Quote = lazy(() => import("./pages/Quote").then((m) => ({ default: m.Quote })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));

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

export default function App({ initialLang }: { initialLang?: Lang } = {}) {
  // One fetch, through the content cache; a failed fetch keeps the English
  // default, loads no pixels and leaves the footer on its compiled-in details.
  const { data: settings } = useSiteSettings();
  const defaultLang: Lang = isLang(settings?.defaultLanguage) ? settings.defaultLanguage : "en";
  // Which languages the switcher offers is an editor decision, made in the
  // dashboard's Site settings screen.
  const enabled = useMemo<Lang[] | undefined>(() => {
    const codes = (settings?.languages ?? [])
      .filter((l) => l.enabled)
      .map((l) => l.code)
      .filter(isLang);
    return codes.length ? codes : undefined;
  }, [settings]);

  return (
    <ThemeProvider>
      <SettingsProvider value={settings}>
      <I18nProvider defaultLang={defaultLang} enabled={enabled} initialLang={initialLang}>
        <AnalyticsProvider settings={settings} />
        <ConsentBanner settings={settings} />
        <PromoDialog />
        <SamuraiIntro />
        <SeoProvider settings={settings}>
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
              path="/services/:slug"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ServiceDetail />
                </Suspense>
              }
            />
            {/* Before /projects/:slug existed, every project card's "View" was
                a dead span. */}
            <Route
              path="/projects/:slug"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ProjectCaseStudy />
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
            {/* Privacy policy and terms. These were `href="#"` in the footer
                since launch — a business site with dead legal links. */}
            <Route
              path="/legal/:slug"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Legal />
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
            <Route
              path="/book"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Book />
                </Suspense>
              }
            />
            {/* A client's quote, by its private link. */}
            <Route
              path="/q/:token"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Quote />
                </Suspense>
              }
            />
            {/* Catch-all. Without this, an unknown URL rendered an empty
                Outlet: a black screen with no nav, footer or way back. */}
            <Route
              path="*"
              element={
                <Suspense fallback={<PageFallback />}>
                  <NotFound />
                </Suspense>
              }
            />
          </Route>
        </Routes>
        </SeoProvider>
      </I18nProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
