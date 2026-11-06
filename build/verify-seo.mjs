#!/usr/bin/env node
/**
 * Audits the built site's SEO: titles, descriptions, canonicals, hreflang,
 * JSON-LD, robots.txt, the sitemap and llms.txt — the surfaces that decide
 * whether "KF Tech Solutions" resolves to this site and not a namesake.
 *
 * Runs after `vite build`, in plain Node, no browser. Exits 1 on any FAIL so
 * a template change that drops the brand from a title turns the deploy red
 * instead of quietly reaching Google. WARNs (editor-typed CMS text) print but
 * never fail the build. The checks themselves live in `seo/audit.mjs`.
 *
 * Usage: `npm run verify:seo [-- --dist dist --origin https://kftechsolutions.dev]`.
 * The origin defaults to VITE_SITE_URL, then to the canonical host in
 * `dist/index.html`.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditDist } from "./seo/audit.mjs";

function flag(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) {
    console.error(`verify-seo: --${name} needs a value`);
    process.exit(2);
  }
  return value;
}

const distDir = resolve(flag("dist") ?? fileURLToPath(new URL("../dist/", import.meta.url)));
const vercelConfig = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

async function canonicalOrigin() {
  try {
    const html = await readFile(resolve(distDir, "index.html"), "utf8");
    const href = /<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/.exec(html)?.[1];
    return href ? new URL(href).origin : null;
  } catch {
    return null;
  }
}

const origin = flag("origin") ?? process.env.VITE_SITE_URL ?? (await canonicalOrigin());
const { failures, warnings, stats } = await auditDist(distDir, { origin, vercelConfig });

function line(tier, check, list) {
  const paths = [...new Set(list.map((f) => f.path))];
  const shown = paths.slice(0, 5).join(", ") + (paths.length > 5 ? ", …" : "");
  return `${tier.padEnd(4)}  ${check}  ${paths.length} page(s)${paths.length ? `: ${shown}` : ""}`;
}

const by = (list, check) => list.filter((f) => f.check === check);
const out = { FAIL: [], WARN: [], PASS: [] };
for (const check of stats.checks) {
  const failed = by(failures, check);
  const warned = by(warnings, check);
  if (failed.length) {
    out.FAIL.push(line("FAIL", check, failed));
    // The first few details, so the log says what to fix without a rerun.
    for (const f of failed.slice(0, 5)) out.FAIL.push(`        ${f.path}  ${f.detail}`);
  } else if (warned.length) out.WARN.push(line("WARN", check, warned));
  else out.PASS.push(line("PASS", check, []));
}
for (const w of by(warnings, "origin")) out.WARN.unshift(`WARN  origin  ${w.detail}`);

console.log([...out.FAIL, ...out.WARN, ...out.PASS].join("\n"));
console.log(
  `\nverify-seo: ${stats.pages} pages, ${stats.checks.length} checks, ${failures.length} failure(s), ${warnings.length} warning(s) in ${(stats.ms / 1000).toFixed(2)}s${origin ? ` (origin ${origin})` : ""}`,
);
process.exit(failures.length ? 1 : 0);
