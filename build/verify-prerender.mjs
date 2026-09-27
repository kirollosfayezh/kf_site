#!/usr/bin/env node
/**
 * Checks a built `dist/` the way a crawler and then a browser would.
 *
 * 1. Without JavaScript: every prerendered HTML file declares the right
 *    language, has a real body with an `<h1>`, carries its content snapshot,
 *    and no item page shipped a "Loading…" fallback. One page per language is
 *    also opened in Chrome with JavaScript off, to prove the text is visible.
 * 2. With JavaScript: a sample of pages is opened in a cold Chrome context and
 *    must hydrate without a single React mismatch (the client logs them with
 *    the `[kf-hydration]` prefix), without page errors, and without the boot
 *    script redirecting.
 * 3. Layout stability: cumulative layout shift on the homepage, the Arabic
 *    homepage, the blog index and one article, desktop and phone.
 *
 * Not part of `npm run build` — Vercel has no Chrome. Run it locally after a
 * build: `npm run verify:prerender`. Exits 1 on any failure.
 */
import { spawn } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const PORT = 4175;
const ORIGIN = `http://localhost:${PORT}`;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CLS_LIMIT = 0.05;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    if ((await stat(full)).isDirectory()) yield* htmlFiles(full);
    else if (entry === "index.html") yield full;
  }
}

const pages = [];
for await (const file of htmlFiles(root)) {
  const rel = relative(root, file).replace(/\/?index\.html$/, "");
  pages.push({ file, path: `/${rel}`.replace(/\/$/, "") || "/" });
}

// ---- 1. static checks, no browser
for (const { file, path } of pages) {
  const html = await readFile(file, "utf8");
  const lang = /^\/(ar|de|fr)(\/|$)/.exec(path)?.[1] ?? "en";
  const declared = /<html lang="([^"]+)"/.exec(html)?.[1];
  const problems = [];
  if (declared !== lang) problems.push(`lang="${declared}"`);
  if (/<div id="root"><\/div>/.test(html)) problems.push("empty body");
  if (!/<div id="root">[\s\S]*<h1/.test(html)) problems.push("no <h1>");
  const snap = /<script id="kf-content" type="application\/json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!snap) problems.push("no snapshot");
  else {
    try {
      JSON.parse(snap);
    } catch {
      problems.push("snapshot is not JSON");
    }
  }
  if (/\/(blog|projects|legal|services)\/./.test(path) && /Loading…|جارٍ التحميل/.test(html.split('<div id="root">')[1] ?? "")) problems.push("item page shows Loading…");
  if (!/<script>\(function\(\)\{try\{var d=document\.documentElement/.test(html)) problems.push("no boot script");
  check(`static ${path}`, problems.length === 0, problems.join(", "));
}

// ---- serve dist like Vercel
const server = spawn(process.execPath, [fileURLToPath(new URL("./vercel-like.mjs", import.meta.url)), String(PORT)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });

async function open(opts = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setCacheEnabled(false);
  if (opts.mobile) {
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  } else {
    await page.setViewport({ width: 1280, height: 900 });
  }
  const logs = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") logs.push(m.text());
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e}`));
  await page.setRequestInterception(true);
  page.on("request", (req) => (/fonts\.g|googletagmanager|facebook|clarity|unsplash/.test(req.url()) ? req.abort() : req.continue()));
  await page.evaluateOnNewDocument(() => {
    // A crawler-like cold context: no stored choices, no redirect.
    localStorage.setItem("kf-lang-auto", "en");
    localStorage.setItem("kf-chat-greeted", "1");
    localStorage.setItem("kf-consent", "denied");
    window.__kfCls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__kfCls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  return { ctx, page, logs };
}

// ---- 2a. no JavaScript: text is visible
for (const lang of ["", "/ar", "/de", "/fr"]) {
  const path = lang || "/";
  if (!pages.some((p) => p.path === path)) continue;
  const { ctx, page } = await open();
  await page.setJavaScriptEnabled(false);
  await page.goto(ORIGIN + path, { waitUntil: "load" });
  const r = await page.evaluate(() => {
    const el = document.querySelector("main .kf-reveal");
    return { children: document.querySelector("#root")?.children.length ?? 0, opacity: el ? getComputedStyle(el).opacity : "none", h1: document.querySelector("h1")?.textContent?.trim().slice(0, 40) };
  });
  check(`no-JS ${path}: body visible`, r.children > 0 && r.opacity === "1" && !!r.h1, JSON.stringify(r));
  await ctx.close();
}

// ---- 2b. hydration
const sample = pages.filter((p) => !/\/(blog|projects|legal|services)\/./.test(p.path)).map((p) => p.path);
for (const kind of ["blog", "projects", "legal", "services"]) {
  const items = pages.filter((p) => new RegExp(`^/(ar/|de/|fr/)?${kind}/.`).test(p.path)).slice(0, 3);
  sample.push(...items.map((p) => p.path));
}
const MISMATCH = /\[kf-hydration\]|Hydration failed|did not match|Text content does not match|Expected server HTML|pageerror/i;
for (const path of sample) {
  const { ctx, page, logs } = await open();
  await page.goto(ORIGIN + path, { waitUntil: "networkidle0" });
  const hydrated = await page.waitForFunction(() => document.documentElement.getAttribute("data-kf-hydrated") === "1", { timeout: 15000 }).then(() => true).catch(() => false);
  await page.waitForFunction(() => document.querySelector("main .kf-reveal.kf-in"), { timeout: 5000 }).catch(() => {});
  const url = await page.evaluate(() => location.pathname);
  const bad = logs.filter((l) => MISMATCH.test(l));
  check(`hydrate ${path}`, hydrated && bad.length === 0 && url === path, [!hydrated && "not hydrated", url !== path && `redirected to ${url}`, ...bad.map((b) => b.slice(0, 160))].filter(Boolean).join(" | "));
  await ctx.close();
}

// ---- 3. CLS
const article = pages.find((p) => /^\/blog\/./.test(p.path))?.path;
const service = pages.find((p) => /^\/ar\/services\/./.test(p.path))?.path;
for (const path of ["/", "/ar", "/blog", article, service].filter(Boolean)) {
  for (const mobile of [false, true]) {
    const { ctx, page } = await open({ mobile });
    await page.goto(ORIGIN + path, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.documentElement.getAttribute("data-kf-hydrated") === "1", { timeout: 15000 }).catch(() => {});
    for (let y = 0; y < 6; y++) {
      await page.evaluate((step) => window.scrollTo(0, step * 700), y);
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 500));
    const cls = await page.evaluate(() => window.__kfCls);
    check(`CLS ${path} ${mobile ? "phone" : "desktop"}`, cls <= CLS_LIMIT, cls.toFixed(3));
    // Sideways scroll is a layout bug (an RTL page once gained 10,000px of it
    // from an off-screen honeypot), and one no visual check spots.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`no horizontal overflow ${path} ${mobile ? "phone" : "desktop"}`, overflow <= 0, `${overflow}px`);
    await ctx.close();
  }
}

await browser.close();
server.kill();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
