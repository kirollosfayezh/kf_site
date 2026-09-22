import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { mergeSeoOverrides } from './src/lib/seo.ts'
import {
  fetchArticles,
  fetchSeoOverrides,
  prerenderPages,
  writeLlmsTxt,
  writeRobots,
  writeSitemap,
} from './build/seo-build.ts'

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

      // Fetched once and shared, so the sitemap and the prerendered article
      // pages can never list a different set of posts.
      const [articles, overrides] = await Promise.all([
        fetchArticles(apiBase),
        fetchSeoOverrides(apiBase),
      ])
      // Dashboard edits win over the compiled-in PAGES table, so the static
      // HTML matches what the editor sees on the site.
      const pages = mergeSeoOverrides(overrides)
      if (apiBase && !articles.length) {
        this.warn(
          `No blog posts came back from ${apiBase}. Static routes still ship, but ` +
            'articles will not be prerendered or listed in sitemap.xml. Check the ' +
            'API is reachable from the build environment.',
        )
      }

      // Always prerender: the per-route HTML files are what let vercel.json
      // narrow its rewrite to /blog/*, so that unknown paths reach 404.html
      // instead of the homepage. Skipping this would 404 every real route.
      const { routes, articles: count } = await prerenderPages(dist, origin, articles, pages)

      if (!origin) {
        this.info(`SEO: prerendered ${routes} routes + ${count} articles (no origin set)`)
        return
      }

      const urls = await writeSitemap(dist, origin, articles, pages)
      await writeRobots(dist, origin)
      await writeLlmsTxt(dist, origin, articles)

      this.info(
        `SEO: prerendered ${routes} routes + ${count} articles, sitemap.xml with ` +
          `${urls} URLs, robots.txt + llms.txt` +
          `${overrides.length ? `, ${overrides.length} dashboard override(s)` : ""} (origin ${origin})`,
      )
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
