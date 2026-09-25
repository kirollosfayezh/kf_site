# KF Tech Solutions — Site

Public marketing site for KF Tech Solutions. Vite + React + TypeScript, talking to the
`kf_backend` Express + MongoDB server (deployed on Render) for content, leads and live
chat. Content and leads go over REST under `/api`; the chat widget uses REST plus a
Socket.io push channel against the same origin.

## Setup

```bash
npm install
cp .env.example .env
# set VITE_API_BASE_URL — see below
npm run dev
```

The dev server is pinned to `http://localhost:5173` (the dashboard uses 5174), so both
can run at once and the backend's `CORS_ORIGINS` can name both.

### Running against the backend

Start `kf_backend` locally (it needs a MongoDB it can reach — a local `mongod` or an
Atlas URI in its own `.env`):

```bash
cd ../kf_backend && npm install && npm run dev   # listens on :4000 by default
```

Then point this app at that origin:

```
VITE_API_BASE_URL=http://localhost:4000
```

In production that is the Render service URL, e.g. `https://kf-api.onrender.com`. Add the
site's own origin to the backend's `CORS_ORIGINS` so both fetch and the Socket.io
handshake are allowed.

If the backend is unreachable the site still renders: every page falls back to its static
copy, and the chat widget shows a "couldn't connect" note instead of failing hard.

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Origin of the `kf_backend` server — no trailing slash, no `/api` suffix. REST calls append `/api`; Socket.io connects to the bare origin. |
| `VITE_SITE_URL` | Absolute origin of the deployed site, e.g. `https://kftechsolutions.com`. Optional locally, **required for full SEO in production** — see below. |

`VITE_API_BASE_URL` is the only variable the site needs to *function*; without it
the build fails rather than shipping a site that calls its own static host.

## SEO

`src/lib/seo.ts` is the React port of `kf-seo.js` from the design export, and is
the single source of truth: one `PAGES` table drives titles, meta descriptions,
canonicals, hreflang, Open Graph, Twitter cards and JSON-LD.

It has two consumers, both deriving from the same `seoTags()` descriptors so a
crawler that runs no JavaScript and a browser that does can never disagree:

- **Runtime** — `components/Seo.tsx`. `RouteSeo` (mounted in the Layout) applies
  the entry for the current route; `Article.tsx` calls `useSeo()` with the
  fetched post, because CMS content isn't known until it arrives.
- **Build** — `build/seo-build.ts` (`runSeoBuild`), run by the `kf-seo-prerender`
  Vite plugin. It writes a real HTML file per route with the head tags baked in
  (`/services` → `dist/services/index.html`), one per published article, case
  study and legal page fetched from the API, plus `404.html`, `sitemap.xml`
  (with image entries), `feed.xml` per language, `robots.txt` and `llms.txt`.

The build reads the CMS with retries and **fails if the API cannot be read**:
a cold backend once made a deploy ship a sitemap with no articles, and a red
deploy is cheaper than that. Only the languages switched on in the dashboard
are prerendered and advertised (hreflang, sitemap, feeds). Content edits reach
crawlers on the next deploy — set `VERCEL_DEPLOY_HOOK_URL` on the backend and
the dashboard triggers one automatically.

Because those static files exist, `vercel.json` narrows its SPA rewrites to
`/blog/*`, `/projects/*`, `/legal/*` and `/q/*` (for items published after the
build). Everything else resolves from the filesystem, and an unknown URL falls
through to `404.html` with a genuine 404 status instead of being answered by
the homepage. `npm run serve:dist` serves `dist/` with the same rules for
checking a build locally.

The share card (`public/og-default.png`) is rendered from `build/og-default.html`
by `npm run og:image`; commit the PNG after changing it.

### Adding a page

Add an entry to `PAGES` **and** a route in `App.tsx`. The prerender iterates
`PAGES`, so a route without an entry has no prerendered HTML and will 404 on
Vercel — deliberately loud rather than silently unindexed.

### Without `VITE_SITE_URL`

Routes are still prerendered with their titles, descriptions and share cards,
but canonical, hreflang, `og:url`, JSON-LD and `sitemap.xml` are omitted: they
need an absolute origin, and a canonical pointing at the wrong host is worse
than none. The build warns and carries on. At runtime the client re-applies the
full set using the origin actually serving the page, so a preview deployment
canonicalises to itself rather than claiming to be production.

### Languages

Each language lives under its own path prefix — `/ar/services`, `/de/services`
— which is the URL shape the prerender, the canonical and the hreflang set all
use, so every advertised alternate really renders in that language. The old
`?lang=ar` form is redirected to the prefixed URL (by Vercel and, as a fallback,
by the client). Which languages exist is decided in the dashboard's Site
settings; English is always on.

## Scripts

```bash
npm run dev         # local dev server
npm run build       # type-check (tsc -b) + production build to dist/
npm run preview     # preview the production build locally (SPA fallback only)
npm run serve:dist  # serve dist/ with vercel.json's rewrites, redirects and headers
npm run og:image    # re-render public/og-default.png from build/og-default.html
npm run lint        # oxlint
```

## Backend contract

REST (all under `VITE_API_BASE_URL` + `/api`, all wrapped in the
`{ success, data, errors, message }` envelope):

| Method & path | Used by |
|---|---|
| `GET /content/settings` | default language, SEO, contact details |
| `GET /content/:collection` | `projects`, `services`, `solutions`, `testimonials`, `faqs`, `blogPosts`, `aboutSections` |
| `GET /content/:collection/:id` | article page |
| `POST /leads` | Contact + Campaign forms (`source: "contact" \| "campaign"`) |
| `POST /chat/threads/:visitorId` | open/annotate the visitor's thread (`{ name?, contact? }`) |
| `GET /chat/threads/:visitorId/messages` | chat history on revisit |
| `POST /chat/threads/:visitorId/messages` | send a message (`{ text }`; the server stamps `from: "visitor"`) |
| `PATCH /chat/threads/:visitorId/typing` | `{ typing }` |

### Chat model

There is no visitor login. The browser generates a random id once
(`crypto.randomUUID()`), stores it in `localStorage` under `kf-visitor-id`, and that id
**is** the thread id. Socket.io connects to `VITE_API_BASE_URL` with
`auth: { visitorId }` — no token. The handshake joins the visitor to their own thread
room and they cannot join another one.

Writes always go over REST; the socket is a push channel only. It emits:

- `chat:message` — a single message object (this is how agent replies arrive live)
- `chat:typing` — `{ visitorId, typing }`

Because the socket echoes back messages the visitor just posted over REST, incoming
messages are deduplicated by `id`.

## Structure

```
src/
  pages/        one component per route (Home, Contact, About, Services, Solutions,
                 Projects, Blog, Article, Campaign)
  components/   Nav, Footer, Layout, Reveal (scroll-reveal wrapper), chat/ChatWidget
  services/     http.ts (API_ORIGIN/API_BASE + fetch wrapper around the envelope),
                 content.ts, leads.ts, chat.ts (REST + Socket.io)
  hooks/        useContent.ts (list/item/settings fetch hooks), useReveal.ts
  lib/          i18n.tsx (EN/AR context + t()), i18n-dict.json, theme.tsx (dark/light),
                 fallback-content.ts (static copy used when the API is empty or down)
  styles/       sections.module.css — shared section/card/FAQ patterns reused by pages
```

Design tokens (colors, fonts, spacing) are defined once as CSS custom properties in
`src/index.css` — `--bg`, `--panel`, `--text`, `--border`, etc., swapped for a light
theme under `:root[data-kf-theme="light"]`.

## Responsive & RTL notes

The layout is checked at 375px, 768px and 1280px in both `dir="ltr"` and `dir="rtl"`
(the nav's EN/AR switcher sets `dir` on `<html>`).

- `body` deliberately has **no** `overflow-x: hidden`. The original static export used it
  to hide real overflow; if something scrolls sideways it is a bug to fix at the source.
- Auto-fit grids use `minmax(min(100%, Npx), 1fr)` so a track never exceeds the
  viewport on narrow phones.
- Directional styles use logical properties (`inset-inline-start`,
  `padding-inline-start`, `border-inline-start`) so RTL mirrors correctly.
- The chat widget is a sheet above the launcher on small screens — never full-screen —
  and is dismissible with the header close button or `Escape`.
