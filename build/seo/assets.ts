/** Mapping routes to their emitted chunks and CSS through Vite's client manifest. */
import type { Lang } from "../../src/lib/seo/index.ts";

/** What `src/entry-server.tsx` exports, once built into `dist-ssr/`. */
export interface SsrModule {
  render(path: string, lang: Lang): Promise<{ html: string; hits: Record<string, unknown>; misses: string[]; errors: unknown[] }>;
  primeDict(lang: Lang, data: Record<string, string>): void;
  setOverrides(lang: Lang, data: Record<string, string>): void;
  primeContent(entries: Record<string, unknown>): void;
}

/** Vite's client build manifest: source module → emitted file, its CSS, its imports. */
export type Manifest = Record<string, { file: string; css?: string[]; imports?: string[] }>;

/**
 * Which page module renders each route, so its CSS and JavaScript can be
 * linked from the page's head. Every route is `React.lazy`, so its CSS
 * travels with its chunk — a server-rendered body would otherwise paint
 * unstyled until the chunk arrived.
 */
export const ROUTE_MODULES: Record<string, string> = {
  "/": "src/pages/Home.tsx",
  "/about": "src/pages/About.tsx",
  "/services": "src/pages/Services.tsx",
  "/solutions": "src/pages/Solutions.tsx",
  "/projects": "src/pages/Projects.tsx",
  "/blog": "src/pages/Blog.tsx",
  "/contact": "src/pages/Contact.tsx",
  "/campaign": "src/pages/Campaign.tsx",
  "/book": "src/pages/Book.tsx",
};

export const ITEM_MODULES = {
  article: "src/pages/Article.tsx",
  project: "src/pages/ProjectCaseStudy.tsx",
  legal: "src/pages/Legal.tsx",
  service: "src/pages/ServiceDetail.tsx",
} as const;

/** The homepage intro's engine: a lazy chunk the boot script preloads when the show will play. */
export const INTRO_ENGINE_MODULE = "src/intro/engine/engine.ts";

/** The emitted files a module pulls in through static imports, itself included. */
export function closure(manifest: Manifest, key: string, js = new Set<string>(), css = new Set<string>()) {
  const entry = manifest[key];
  if (!entry || js.has(entry.file)) return { js, css };
  js.add(entry.file);
  entry.css?.forEach((c) => css.add(c));
  entry.imports?.forEach((k) => closure(manifest, k, js, css));
  return { js, css };
}

/**
 * The `<link>`s a prerendered page needs beyond the shell's.
 *
 * With `cssCodeSplit` off the shell's stylesheet already covers the route,
 * so this is only the route's own CSS should that ever change, plus the
 * dictionary chunk on non-English pages — `main.tsx` awaits it before
 * hydrating, and preloaded it travels with the entry instead of after it.
 *
 * Deliberately no `modulepreload` for the route chunk and its dependencies:
 * on a slow connection those ~150 kB competed with the stylesheet for the
 * bandwidth the first paint was waiting on. The page is readable before
 * hydration, so hydration can start a round trip later.
 */
export function assetsFor(manifest: Manifest, moduleKey: string, lang: Lang): string {
  if (!manifest[moduleKey]) throw new Error(`the build manifest has no entry for ${moduleKey}`);
  const base = closure(manifest, "index.html");
  const route = closure(manifest, moduleKey);
  const dict = lang !== "en" ? manifest[`src/lib/dict/${lang}.json`]?.file : undefined;
  return [
    ...[...route.css].filter((c) => !base.css.has(c)).map((c) => `<link rel="stylesheet" crossorigin href="/${c}" />`),
    ...(dict ? [`<link rel="modulepreload" crossorigin href="/${dict}" />`] : []),
  ].join("\n  ");
}
