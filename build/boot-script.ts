import { ZONE_LANG } from "../src/lib/auto-language.ts";
import type { Lang } from "../src/lib/langs.ts";

/**
 * The inline `<script>` at the top of every prerendered page.
 *
 * Two jobs, both of which must happen before the first paint now that pages
 * arrive with a real body:
 *
 * 1. Theme — a light-mode visitor gets `data-kf-theme="light"` on `<html>`
 *    before any of the dark page shows.
 * 2. Language — the same decision `applyAutoLanguage()` makes (a stored
 *    choice, then the browser language, then the time zone), taken before
 *    the English page is visible rather than after React has mounted it.
 *
 * Only languages switched on in the dashboard are redirect targets: the
 * build passes them in, so a stored preference for a language that has since
 * been turned off lands on English rather than on a 404.
 */
export function bootScript(enabled: readonly Lang[], introChunks: readonly string[] = []): string {
  const langs = JSON.stringify(enabled.filter((l) => l !== "en"));
  const zones = JSON.stringify(ZONE_LANG);
  // When the intro will play, its chunk (three.js + GSAP) starts downloading
  // here, before the first paint, instead of after hydration — the show is the
  // first thing that visitor sees, so its bytes are the critical ones.
  const preload = introChunks.length
    ? `var C=${JSON.stringify(introChunks)};for(var k=0;k<C.length;k++){var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href=C[k];document.head.appendChild(l)}`
    : "";
  // The intro decision mirrors `shouldPlayIntro` in src/lib/intro.ts: homepage
  // only, not seen in the last day, motion allowed, not an automated browser
  // or a lab tool (Lighthouse/PageSpeed, GTmetrix, WebPageTest), not a
  // data-saving or 2G connection, a viewport big enough to read it; `?kf-intro`
  // replays it regardless of the memory and of the lab-tool rules.
  const intro =
    `var P=p.replace(/\\/+$/,"")||"/";` +
    `if(P==="/"||P==="/ar"||P==="/de"||P==="/fr"){var seen=Number(ls.getItem("kf-intro-seen")||0),c=navigator.connection||{};` +
    `var R=/[?&]kf-intro(=|&|$)/.test(location.search);if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&(R||!navigator.webdriver&&!/Lighthouse|HeadlessChrome|GTmetrix|PTST/.test(navigator.userAgent)&&Date.now()-seen>864e5)&&!c.saveData&&!/2g/.test(c.effectiveType||"")&&Math.min(innerWidth,innerHeight)>=320){d.setAttribute("data-intro","pending");${preload}}}`;
  // `?kf-debug` loads an on-screen diagnostics overlay (public/kf-debug.js)
  // for phones, where there is no console; not part of the bundle.
  const debug = `if(/[?&]kf-debug(=|&|$)/.test(location.search)){var g=document.createElement("script");g.src="/kf-debug.js";document.head.appendChild(g)}`;
  // The opening `(function(){try{var d=document.documentElement` is what
  // verify:prerender recognises the script by; keep it first.
  const js = `(function(){try{var d=document.documentElement,ls=localStorage;${debug}if(ls.getItem("kf-theme")==="light")d.setAttribute("data-kf-theme","light");var L=${langs},Z=${zones},p=location.pathname,f=p.split("/").filter(Boolean)[0];${intro}if(f==="en"||f==="ar"||f==="de"||f==="fr")return;var go=function(l){location.replace("/"+l+(p==="/"?"":p)+location.search+location.hash)};var s=ls.getItem("kf-lang");if(s){if(L.indexOf(s)>=0)go(s);return}if(ls.getItem("kf-lang-auto"))return;var b=null,tags=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];for(var i=0;i<tags.length;i++){var t=(tags[i]||"").toLowerCase().split("-")[0];if(t==="en"||L.indexOf(t)>=0){b=t;break}}var z=null;try{z=Z[Intl.DateTimeFormat().resolvedOptions().timeZone]||null}catch(e){}if(z&&L.indexOf(z)<0)z=null;var det=b&&b!=="en"?b:(z||b);ls.setItem("kf-lang-auto",det||"en");if(det&&det!=="en")go(det)}catch(e){}})();`;
  return `<script>${js}</script>`;
}
