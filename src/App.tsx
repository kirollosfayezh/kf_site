import { Routes, Route, matchPath } from "react-router-dom";
import { Suspense, useMemo } from "react";
import { I18nProvider, isLang, type Lang } from "./lib/i18n";
import { ThemeProvider } from "./lib/theme";
import { SettingsProvider } from "./lib/settings";
import { Layout } from "./components/Layout";
import { useSiteSettings } from "./hooks/useContent";
import { AnalyticsProvider } from "./lib/analytics-provider";
import { ConsentBanner } from "./components/ConsentBanner";
import { PromoDialog } from "./components/PromoDialog";
import { SeoProvider } from "./components/Seo";
import { MARKETS, marketPath } from "./lib/seo";
import { lazyWithReload } from "./lib/chunk-reload";

/**
 * Route-level code splitting. Every page is its own chunk, so a first visit to
 * `/` no longer downloads the contact form, the campaign landing page and the
 * article template alongside it.
 */
const Home = lazyWithReload(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const About = lazyWithReload(() => import("./pages/About").then((m) => ({ default: m.About })));
const Services = lazyWithReload(() => import("./pages/Services").then((m) => ({ default: m.Services })));
const Solutions = lazyWithReload(() => import("./pages/Solutions").then((m) => ({ default: m.Solutions })));
const Projects = lazyWithReload(() => import("./pages/Projects").then((m) => ({ default: m.Projects })));
const ProjectCaseStudy = lazyWithReload(() =>
  import("./pages/ProjectCaseStudy").then((m) => ({ default: m.ProjectCaseStudy })),
);
const ServiceDetail = lazyWithReload(() =>
  import("./pages/ServiceDetail").then((m) => ({ default: m.ServiceDetail })),
);
const MarketDetail = lazyWithReload(() => import("./pages/MarketDetail").then((m) => ({ default: m.MarketDetail })));
const Legal = lazyWithReload(() => import("./pages/Legal").then((m) => ({ default: m.Legal })));
const Blog = lazyWithReload(() => import("./pages/Blog").then((m) => ({ default: m.Blog })));
const Article = lazyWithReload(() => import("./pages/Article").then((m) => ({ default: m.Article })));
const Contact = lazyWithReload(() => import("./pages/Contact").then((m) => ({ default: m.Contact })));
const Campaign = lazyWithReload(() => import("./pages/Campaign").then((m) => ({ default: m.Campaign })));
const Book = lazyWithReload(() => import("./pages/Book").then((m) => ({ default: m.Book })));
const Quote = lazyWithReload(() => import("./pages/Quote").then((m) => ({ default: m.Quote })));
const NotFound = lazyWithReload(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));

/** The page each route renders, in the same order as `<Routes>` below. */
const ROUTE_PAGES: ReadonlyArray<readonly [string, { preload: () => Promise<void> }]> = [
  ["/", Home],
  ["/about", About],
  ["/services", Services],
  ["/solutions", Solutions],
  ["/projects", Projects],
  ["/services/:slug", ServiceDetail],
  ...MARKETS.map((m) => [marketPath(m.slug), MarketDetail] as const),
  ["/projects/:slug", ProjectCaseStudy],
  ["/blog", Blog],
  ["/blog/:id", Article],
  ["/legal/:slug", Legal],
  ["/contact", Contact],
  ["/campaign", Campaign],
  ["/book", Book],
  ["/q/:token", Quote],
];

/**
 * Loads the page code for a path (without its language prefix) ahead of the
 * first render, so a prerendered page hydrates in one pass instead of
 * suspending — see `lazyWithReload`. Unknown paths load the 404 page.
 */
export function preloadRoute(pathname: string): Promise<void> {
  const hit = ROUTE_PAGES.find(([path]) => matchPath({ path, end: true }, pathname));
  return (hit ? hit[1] : NotFound).preload();
}

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
            {/* The country pages, each at the root (/saudi-arabia). Fixed paths
                rather than a /:slug catch, which would shadow the 404. */}
            {MARKETS.map((m) => (
              <Route
                key={m.slug}
                path={marketPath(m.slug)}
                element={
                  <Suspense fallback={<PageFallback />}>
                    <MarketDetail slug={m.slug} />
                  </Suspense>
                }
              />
            ))}
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
