import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { SeoFetchError, runSeoBuild } from './build/seo-build.ts'

/**
 * The site is a client-rendered SPA, so without this every route shipped the
 * same `index.html`: one title, no canonical, no Open Graph, no structured
 * data. Social scrapers run no JavaScript at all, so a shared link showed the
 * homepage title whatever it pointed at.
 *
 * This writes a real HTML file per route with the head tags baked in
 * (`/services` -> `dist/services/index.html`), plus `sitemap.xml` and
 * `robots.txt`. Vercel serves a matching static file ahead of the SPA rewrite,
 * so crawlers get correct metadata with zero JavaScript while the body still
 * hydrates into the same single-page app for visitors.
 */
function seoPrerender(origin: string, apiBase: string | undefined): Plugin {
  return {
    name: 'kf-seo-prerender',
    apply: 'build',
    // `closeBundle` runs after Vite has written index.html to disk.
    async closeBundle() {
      const dist = 'dist'
      if (!origin) {
        this.warn(
          'VITE_SITE_URL is not set. Routes are still prerendered with their own ' +
            'titles, descriptions and share cards, but canonical URLs, hreflang and ' +
            'sitemap.xml are omitted — they need an absolute origin, and a wrong one ' +
            'is worse than none. Set VITE_SITE_URL (e.g. https://kftechsolutions.com) ' +
            'and redeploy to enable them.',
        )
      }

      // Everything is fetched once and shared, so the sitemap, the feeds and
      // the prerendered pages can never list different sets of content.
      try {
        const { summary, warnings } = await runSeoBuild({ dist, origin, apiBase })
        warnings.forEach((w) => this.warn(w))
        this.info(summary)
      } catch (err) {
        // A cold backend once made the build ship a sitemap with no articles,
        // no case studies and no legal pages — silently. Never again: if the
        // CMS cannot be read after every retry, the deploy goes red.
        if (err instanceof SeoFetchError) {
          this.error(
            `SEO build data could not be fetched from ${apiBase}: ${err.message}. ` +
              'Refusing to ship a prerender and sitemap without the CMS content.',
          )
        }
        throw err
      }
    },
  }
}

/**
 * Publishes the shipped dictionary as `/i18n/catalog.json`.
 *
 * The dashboard's Translations screen reads it to list every piece of
 * interface copy with its current Arabic, German and French, so an editor can
 * correct any of them — the edits are stored as overrides in the backend and
 * laid over this file on the site. Built from the same JSON the site bundles,
 * so the two can never disagree.
 */
function i18nCatalog(): Plugin {
  return {
    name: 'kf-i18n-catalog',
    apply: 'build',
    async generateBundle() {
      const { readFile } = await import('node:fs/promises')
      const langs = ['ar', 'de', 'fr'] as const
      const dicts = await Promise.all(
        langs.map(async (l) => JSON.parse(await readFile(`src/lib/dict/${l}.json`, 'utf8')) as Record<string, string>),
      )
      const keys = [...new Set(dicts.flatMap((d) => Object.keys(d)))].sort((a, b) => a.localeCompare(b))
      const entries = keys.map((key) => ({
        key,
        ar: dicts[0][key] ?? '',
        de: dicts[1][key] ?? '',
        fr: dicts[2][key] ?? '',
      }))
      this.emitFile({
        type: 'asset',
        fileName: 'i18n/catalog.json',
        source: JSON.stringify({ generatedAt: new Date().toISOString(), entries }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Vite inlines env vars at build time. Without VITE_API_BASE_URL the client
  // falls back to a relative "/api", so the deployed site calls its own static
  // host: content silently falls back to the built-in copy and every form POST
  // comes back 405. Fail the build rather than ship that.
  if (command === 'build') {
    if (!env.VITE_API_BASE_URL?.trim()) {
      throw new Error(
        'VITE_API_BASE_URL is not set.\n' +
          'The site needs the kf_backend origin baked in at build time, e.g.\n' +
          '  VITE_API_BASE_URL=https://kf-backend.onrender.com\n' +
          'On Vercel: Settings -> Environment Variables, then redeploy (changing it\n' +
          'without a redeploy has no effect, because the value is compiled in).',
      )
    }
  }

  return {
    plugins: [
      react(),
      i18nCatalog(),
      seoPrerender(env.VITE_SITE_URL?.trim().replace(/\/+$/, '') ?? '', env.VITE_API_BASE_URL?.trim()),
    ],
    // Pinned so the site and dashboard never fight over a port, and so the
    // backend's CORS_ORIGINS can name both with certainty.
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      // Every browser this site supports has had these for years; targeting them
      // directly means no async/await or spread down-levelling, which is both
      // less code to ship and less work to run.
      target: 'es2022',
      // The default 500 kB warning existed to flag the three.js chunk, which is
      // gone; nothing here should approach it now, so keep the alarm tight.
      chunkSizeWarningLimit: 400,
    },
  }
})
