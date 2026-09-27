#!/usr/bin/env node
/**
 * Serves `dist/` the way Vercel does, for checking a build locally.
 *
 * `vite preview` serves the SPA fallback for every path, which hides exactly
 * the things the SEO build exists to produce: the per-route HTML files, the
 * 404 page, the rewrites and the headers. This does what `vercel.json` says:
 *
 *   1. a static file first (`path`, `path/index.html`, `path.html`);
 *   2. then the redirects (with `has` query matching);
 *   3. then the rewrites;
 *   4. else `404.html` with a real 404 status.
 *
 * Headers: every matching entry applies, later entries winning for the same
 * header name. Responses are brotli/gzip compressed when the client accepts
 * it, because Vercel compresses too and an uncompressed run makes Lighthouse
 * lie about the JavaScript budget.
 *
 * Usage: `npm run serve:dist` (port 4174), or `node build/vercel-like.mjs 8080`.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";

// `fileURLToPath`, not `.pathname`: the repo lives under a directory with a
// space in its name, which a URL pathname percent-encodes.
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const port = Number(process.argv[2] || process.env.PORT || 4174);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** The index just past the `)` matching the `(` at `open`. */
function closeParen(source, open) {
  let depth = 0;
  for (let k = open; k < source.length; k++) {
    if (source[k] === "(") depth++;
    else if (source[k] === ")" && --depth === 0) return k + 1;
  }
  return source.length;
}

/**
 * Vercel's `source` syntax → RegExp. `/:path*` and `/:path(pattern)` become
 * named groups; a bare `(pattern)` is regex, copied through; everything else
 * is literal (so `.` in `/sitemap.xml` is a dot, not "any character").
 */
function toRegExp(source) {
  let re = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === "(") {
      const end = closeParen(source, i);
      re += source.slice(i, end);
      i = end;
      continue;
    }
    if (c === ":") {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j++;
      const name = source.slice(i + 1, j);
      let pattern = "[^/]+";
      if (source[j] === "(") {
        const end = closeParen(source, j);
        pattern = source.slice(j + 1, end - 1);
        j = end;
      }
      if (source[j] === "*") {
        pattern = ".*";
        j++;
      }
      re += `(?<${name}>${pattern})`;
      i = j;
      continue;
    }
    re += c === "/" || c === "." ? `\\${c}` : c;
    i++;
  }
  return new RegExp(`^${re}$`);
}

function expand(destination, groups) {
  return destination.replace(/:([A-Za-z0-9_]+)/g, (_, name) => groups[name] ?? "");
}

async function readStatic(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidates = [clean, join(clean, "index.html"), `${clean}.html`];
  for (const rel of candidates) {
    const file = join(root, rel);
    try {
      const s = await stat(file);
      if (s.isFile()) return { file, body: await readFile(file) };
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

function headersFor(pathname) {
  const out = {};
  for (const rule of config.headers ?? []) {
    if (!toRegExp(rule.source).test(pathname)) continue;
    for (const h of rule.headers) out[h.key.toLowerCase()] = h.value;
  }
  return out;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  let pathname = url.pathname;

  // trailingSlash: false — Vercel 308s `/services/` to `/services`.
  if (pathname.length > 1 && pathname.endsWith("/")) {
    res.writeHead(308, { location: pathname.slice(0, -1) + url.search });
    return res.end();
  }

  for (const r of config.redirects ?? []) {
    const m = toRegExp(r.source).exec(pathname);
    if (!m) continue;
    const groups = { ...(m.groups ?? {}) };
    let ok = true;
    for (const has of r.has ?? []) {
      // A host condition (the vercel.app → custom-domain redirect) never
      // matches here: this server is localhost. Skipping the condition instead
      // sent every request to the live domain, so the browser checks were
      // testing production rather than this build.
      if (has.type === "host") {
        const host = (req.headers.host ?? "").split(":")[0];
        if (!new RegExp(`^(?:${has.value})$`).test(host)) {
          ok = false;
          break;
        }
        continue;
      }
      if (has.type !== "query") continue;
      const v = url.searchParams.get(has.key);
      if (v === null) {
        ok = false;
        break;
      }
      if (has.value) {
        const hm = new RegExp(`^(?:${has.value})$`).exec(v);
        if (!hm) {
          ok = false;
          break;
        }
        Object.assign(groups, hm.groups ?? {});
      }
    }
    if (!ok) continue;
    res.writeHead(r.permanent ? 308 : 307, { location: expand(r.destination, groups) + url.search });
    return res.end();
  }

  let hit = await readStatic(pathname);
  if (!hit) {
    for (const rw of config.rewrites ?? []) {
      if (toRegExp(rw.source).test(pathname)) {
        hit = await readStatic(rw.destination);
        break;
      }
    }
  }
  let status = 200;
  if (!hit) {
    hit = await readStatic("/404.html");
    status = 404;
  }
  if (!hit) {
    res.writeHead(404);
    return res.end("not found");
  }

  const headers = { "content-type": MIME[extname(hit.file)] ?? "application/octet-stream", ...headersFor(pathname) };
  let body = hit.body;
  const accept = req.headers["accept-encoding"] ?? "";
  const text = /^(text\/|application\/(json|javascript|xml|manifest|rss))/.test(headers["content-type"]);
  if (text && /\bbr\b/.test(accept)) {
    body = brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } });
    headers["content-encoding"] = "br";
  } else if (text && /\bgzip\b/.test(accept)) {
    body = gzipSync(body);
    headers["content-encoding"] = "gzip";
  }
  headers["content-length"] = body.length;
  res.writeHead(status, headers);
  res.end(body);
}).listen(port, () => {
  console.log(`serving dist/ like Vercel at http://localhost:${port}`);
});
