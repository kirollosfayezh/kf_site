import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { SeoFetchError, runSeoBuild, type SsrModule } from './build/seo-build.ts'

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
    // The server bundle has no public directory to publish into.
    applyToEnvironment: (env) => env.name === 'client',
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
  const origin = env.VITE_SITE_URL?.trim().replace(/\/+$/, '') ?? ''
  const apiBase = env.VITE_API_BASE_URL?.trim()

  // Vite inlines env vars at build time. Without VITE_API_BASE_URL the client
  // falls back to a relative "/api", so the deployed site calls its own static
  // host: content silently falls back to the built-in copy and every form POST
  // comes back 405. Fail the build rather than ship that.
  if (command === 'build') {
    if (!apiBase) {
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
    plugins: [react(), i18nCatalog()],
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
    /**
     * Two builds from one config: the browser bundle, and a Node bundle of the
     * same app that the prerender below renders each page with. Both come out
     * of the same process, so their CSS-module class names are identical and
     * the server HTML hydrates cleanly.
     */
    environments: {
      client: {
        build: {
          // The prerender reads it to link each route's own CSS into its
          // page, so a server-rendered body never paints unstyled.
          manifest: true,
        },
      },
      ssr: {
        build: {
          outDir: 'dist-ssr',
          emptyOutDir: true,
          copyPublicDir: false,
          rollupOptions: {
            input: { 'entry-server': 'src/entry-server.tsx' },
          },
        },
      },
    },
    /**
     * The site is a client-rendered SPA at heart, so without this every route
     * shipped the same `index.html`: one title, no canonical, no Open Graph, no
     * structured data — and an empty body, which is all a social scraper or an
     * assistant's crawler (none of which run JavaScript) ever saw.
     *
     * After both bundles are built, every route in every enabled language is
     * rendered to its own HTML file with its head tags, its body and the CMS
     * snapshot it was rendered from (`/services` -> `dist/services/index.html`),
     * plus sitemap.xml, feeds, robots.txt and llms.txt. Vercel serves a matching
     * static file ahead of the SPA rewrite, so crawlers get real pages while
     * visitors get the same markup, hydrated.
     */
    builder: {
      async buildApp(builder) {
        await builder.build(builder.environments.client)
        await builder.build(builder.environments.ssr)

        // The server bundle leaves react-dom external; it must load its
        // production build, which is decided by NODE_ENV at import time.
        process.env.NODE_ENV ??= 'production'
        const ssr = (await import(pathToFileURL(resolve('dist-ssr/entry-server.js')).href)) as SsrModule

        const logger = builder.config.logger
        try {
          const { summary, warnings } = await runSeoBuild({
            dist: 'dist',
            origin,
            apiBase,
            ssr,
            manifestPath: 'dist/.vite/manifest.json',
          })
          warnings.forEach((w) => logger.warn(`[kf-seo-prerender] ${w}`))
          if (!origin) {
            logger.warn(
              '[kf-seo-prerender] VITE_SITE_URL is not set. Routes are still prerendered with their own ' +
                'titles, descriptions and share cards, but canonical URLs, hreflang and ' +
                'sitemap.xml are omitted — they need an absolute origin, and a wrong one ' +
                'is worse than none. Set VITE_SITE_URL (e.g. https://kftechsolutions.com) ' +
                'and redeploy to enable them.',
            )
          }
          logger.info(`[kf-seo-prerender] ${summary}`)
        } catch (err) {
          // A cold backend once made the build ship a sitemap with no articles,
          // no case studies and no legal pages — silently. Never again: if the
          // CMS cannot be read after every retry, the deploy goes red.
          if (err instanceof SeoFetchError) {
            logger.error(
              `[kf-seo-prerender] SEO build data could not be fetched from ${apiBase}: ${err.message}. ` +
                'Refusing to ship a prerender and sitemap without the CMS content.',
            )
          }
          throw err
        }
      },
    },
  }
})
