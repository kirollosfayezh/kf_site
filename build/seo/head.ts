/** Head-level HTML surgery for prerendered pages: the shell's placeholder tags, font preloads, and the drift checks that keep them in step with the stylesheets. */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Strip the placeholder title/description shipped in index.html so a
 *  generated page doesn't end up declaring each of them twice. */
export function stripStaticHead(html: string): string {
  return html
    .replace(/\s*<title>[\s\S]*?<\/title>/i, "")
    .replace(/\s*<meta\s[^>]*name="description"[\s\S]*?>/i, "");
}

/**
 * The Arabic webfont, preloaded on Arabic pages only. It is declared in
 * src/index.css; without the preload it was discovered after the text had
 * painted and the swap shifted the page (CLS 0.25 at 375px). Must match the
 * `src:` of the Alexandria @font-face there — checkArabicFont() warns if not.
 */
export const ARABIC_FONT_URL = "https://fonts.gstatic.com/s/alexandria/v6/UMBXrPdDqW66y0Y2usFeaijdA5E64BdCIg.woff2";
export const ARABIC_FONT_PRELOAD = `<link rel="preload" href="${ARABIC_FONT_URL}" as="font" type="font/woff2" crossorigin />`;

/**
 * The display face the hero headline is set in (Space Grotesk 700, Latin
 * subset), preloaded on every page.
 *
 * Google's stylesheet is loaded non-blocking, so the font used to arrive a
 * second or two after the prerendered headline had painted in the fallback
 * face; the swap made the headline bigger, which Chrome records as a *new*
 * largest paint — mobile LCP read 4.4 s for text that had been on screen
 * since 1.1 s. Preloaded, the first paint is in the real face and LCP is the
 * first paint. Google serves this exact file to Chrome and Safari; Firefox
 * gets a different one and ignores the preload. `checkDisplayFont()` warns
 * at build time if Google's stylesheet stops naming it.
 */
export const DISPLAY_FONT_URL = "https://fonts.gstatic.com/s/spacegrotesk/v22/V8mDoQDjQSkFtoMM3T6r8E7mPbF4C_k3HqU.woff2";
export const DISPLAY_FONT_PRELOAD = `<link rel="preload" href="${DISPLAY_FONT_URL}" as="font" type="font/woff2" crossorigin />`;
export const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";

/** Asks Google for the stylesheet as Chrome would and checks the preloaded
 *  file is still what it serves. Network trouble is not a build failure. */
export async function checkDisplayFont(): Promise<string | null> {
  try {
    const res = await fetch(GOOGLE_FONTS_CSS, {
      headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const css = await res.text();
    if (css.includes(DISPLAY_FONT_URL)) return null;
    const served = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/s\/spacegrotesk\/[^)]+/g) ?? [])];
    // No Space Grotesk files at all means Google answered something other
    // than the stylesheet (a rate-limit page, say) — nothing to compare.
    if (!served.length) return null;
    return (
      `the display font preload (${DISPLAY_FONT_URL}) is no longer in Google's stylesheet — update DISPLAY_FONT_URL ` +
      `in build/seo-build.ts to the Space Grotesk latin file it serves now (served: ${served.join(", ") || "none"})`
    );
  } catch {
    return null;
  }
}

/** Warn when the preload and the stylesheet name different files: the preload
 *  would then fetch a font nothing uses, and Arabic would swap late again. */
export async function checkArabicFont(distDir: string): Promise<string | null> {
  const dir = join(distDir, "assets");
  for (const name of await readdir(dir)) {
    if (name.endsWith(".css") && (await readFile(join(dir, name), "utf8")).includes(ARABIC_FONT_URL)) return null;
  }
  return `the Arabic font preload (${ARABIC_FONT_URL}) matches no @font-face in the built CSS — update ARABIC_FONT_URL in build/seo-build.ts to the src in src/index.css`;
}

/**
 * A function replacer, because in a string replacement `$$` means a literal `$`
 * and `$&` means the match — `priceRange: "$$"` silently shipped as `"$"`, and
 * any `$&`/`$1` in a title or description would be corrupted the same way.
 */
export function injectHead(shell: string, head: string): string {
  return shell.replace("</head>", () => `  ${head}\n  </head>`);
}
