/**
 * IndexNow: tells Bing (and through it ChatGPT search and Copilot), Yandex,
 * Seznam, Naver and Yep the moment a page is added or changed, instead of
 * waiting for their crawlers to come back on their own schedule. A new domain
 * with few inbound links can otherwise wait weeks for a recrawl.
 *
 * Google does not take IndexNow; it reads the sitemap (submit it once in
 * Search Console).
 *
 * The key is not a secret: the protocol proves ownership by serving it from
 * the site itself, at `/<key>.txt`. Changing it is harmless — the next deploy
 * publishes the new file.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const INDEXNOW_KEY = "ab1519998153c394478b153c17b64133";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS = 10_000; // the protocol's per-request limit

/** Publishes the key file the search engines fetch to verify a submission. */
export async function writeIndexNowKey(distDir: string): Promise<void> {
  await writeFile(join(distDir, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY, "utf8");
}

/** `loc` → `lastmod` for every `<url>` in a sitemap. */
function parseSitemap(xml: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    if (!loc) continue;
    out.set(loc.replace(/&amp;/g, "&"), block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? "");
  }
  return out;
}

/**
 * Submits the URLs that are new or whose `lastmod` moved since the sitemap
 * that is live right now — the deploy being built has not replaced it yet. If
 * the live sitemap cannot be read (first deploy, outage), every URL goes.
 *
 * Never throws: a search engine being slow or down must not fail a deploy.
 * Returns a one-line summary for the build log.
 */
export async function submitIndexNow(distDir: string, origin: string): Promise<string> {
  try {
    const next = parseSitemap(await readFile(join(distDir, "sitemap.xml"), "utf8"));
    let live: Map<string, string> | null = null;
    try {
      const res = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) live = parseSitemap(await res.text());
    } catch {
      /* first deploy or the site is down: submit everything */
    }

    const changed = [...next].filter(([loc, lastmod]) => !live || live.get(loc) !== lastmod).map(([loc]) => loc);
    if (!changed.length) return "IndexNow: no new or changed URLs";

    const urlList = changed.slice(0, MAX_URLS);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(origin).host,
        key: INDEXNOW_KEY,
        keyLocation: `${origin}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    // 200 = accepted, 202 = accepted while the key is still being verified
    // (normal on the first deploy, before the key file is live).
    if (res.status === 200 || res.status === 202) {
      return `IndexNow: submitted ${urlList.length} URL(s)${live ? " (new or changed since the live sitemap)" : " (no live sitemap to compare, sent all)"}`;
    }
    return `IndexNow: ${ENDPOINT} answered HTTP ${res.status} — nothing submitted this deploy`;
  } catch (err) {
    return `IndexNow: skipped (${err instanceof Error ? err.message : String(err)})`;
  }
}
