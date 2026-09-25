import { prerender } from "react-dom/static";
import { StaticRouter } from "react-router-dom";
import App from "./App";
import { localePath } from "./lib/seo";
import type { Lang } from "./lib/langs";
import { startRecording, stopRecording } from "./services/content-cache";

/**
 * The build-time renderer. `build/seo-build.ts` loads this from `dist-ssr/`
 * after the client build and calls `render` once per page and language.
 *
 * This bundle has its own copies of the dictionary and the content cache —
 * separate from the ones the Vite config bundled for the `<head>` — so the
 * build primes both. Everything a page reads is primed before `render`, and
 * the cache records what was read, so the page can ship exactly that as its
 * snapshot for the client to hydrate against.
 */
export { primeDict, setOverrides } from "./lib/dict";
export { primeContent, resetContent } from "./services/content-cache";

export interface RenderResult {
  html: string;
  /** Cache keys the render read and found — the page's content snapshot. */
  hits: Record<string, unknown>;
  /** Cache keys the render asked for that nothing had primed. */
  misses: string[];
  errors: unknown[];
}

/** A boundary React left pending: its fallback in place, its content parked
 *  in a hidden segment for a swap script that a static render never gets. */
const PENDING = "<!--$?-->";

/** The tree for one page, also exported so the build can be debugged in Node. */
export function element(path: string, lang: Lang) {
  return (
    <StaticRouter location={localePath(lang, path)} basename={lang === "en" ? undefined : `/${lang}`}>
      <App initialLang={lang} />
    </StaticRouter>
  );
}

export async function render(path: string, lang: Lang): Promise<RenderResult> {
  const errors: unknown[] = [];
  const run = async () => {
    const { prelude } = await prerender(element(path, lang), {
      /*
       * Fizz "outlines" any Suspense boundary bigger than this: the fallback
       * goes in place and the content into a hidden segment after it, for a
       * script to swap in as it streams. Every page here is one boundary well
       * over the 12 kB default, and a static file has no swap script — so
       * the threshold is lifted and every completed boundary is inlined.
       */
      progressiveChunkSize: 1 << 30,
      onError: (error) => {
        errors.push(error);
      },
    });
    return new Response(prelude).text();
  };

  // Every page is `React.lazy`; `prerender` waits for the import and inlines
  // the boundary. Should one ever come out pending, a second pass renders it
  // from the now-cached module. The snapshot is whatever the final pass read.
  startRecording();
  let html = await run();
  let read = stopRecording();
  if (html.includes(PENDING)) {
    startRecording();
    html = await run();
    read = stopRecording();
  }
  if (html.includes(PENDING)) errors.push(new Error(`a Suspense boundary on ${path} never resolved during the prerender`));
  return { html, hits: read.hits, misses: read.misses, errors };
}
