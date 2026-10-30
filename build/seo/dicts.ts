/** All three non-English dictionaries, loaded at once and primed into the shared translator. */
import type { Lang } from "../../src/lib/seo/index.ts";
import { primeDict } from "../../src/lib/dict/index.ts";
import ar from "../../src/lib/dict/ar.json" with { type: "json" };
import de from "../../src/lib/dict/de.json" with { type: "json" };
import fr from "../../src/lib/dict/fr.json" with { type: "json" };

export const DICTS: Record<Exclude<Lang, "en">, Record<string, string>> = { ar, de, fr };

/**
 * The browser loads one language on demand; the prerender needs all of them at
 * once, because it writes every page in every language in a single pass.
 * Priming the shared cache keeps both halves using one translator, so a page's
 * static HTML and its client-side re-render can never disagree.
 */
primeDict("ar", ar);
primeDict("de", de);
primeDict("fr", fr);
