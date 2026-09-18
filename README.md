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

That is the only variable the site needs.

## Scripts

```bash
npm run dev       # local dev server
npm run build     # type-check (tsc -b) + production build to dist/
npm run preview   # preview the production build locally
npm run lint      # oxlint
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
