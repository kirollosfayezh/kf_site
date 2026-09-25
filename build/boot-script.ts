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
export function bootScript(enabled: readonly Lang[]): string {
  const langs = JSON.stringify(enabled.filter((l) => l !== "en"));
  const zones = JSON.stringify(ZONE_LANG);
  // The intro decision mirrors `shouldPlayIntro` in src/lib/intro.ts: homepage
  // only, not seen in the last day, motion allowed, not an automated browser,
  // not a data-saving or 2G connection, a viewport big enough to read it.
  const intro =
    `var P=p.replace(/\\/+$/,"")||"/";` +
    `if(P==="/"||P==="/ar"||P==="/de"||P==="/fr"){var seen=Number(ls.getItem("kf-intro-seen")||0),c=navigator.connection||{};` +
    `if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&!navigator.webdriver&&!c.saveData&&!/2g/.test(c.effectiveType||"")&&Date.now()-seen>864e5&&Math.min(innerWidth,innerHeight)>=320)d.setAttribute("data-intro","pending")}`;
  const js = `(function(){try{var d=document.documentElement,ls=localStorage;if(ls.getItem("kf-theme")==="light")d.setAttribute("data-kf-theme","light");var L=${langs},Z=${zones},p=location.pathname,f=p.split("/").filter(Boolean)[0];${intro}if(f==="en"||f==="ar"||f==="de"||f==="fr")return;var go=function(l){location.replace("/"+l+(p==="/"?"":p)+location.search+location.hash)};var s=ls.getItem("kf-lang");if(s){if(L.indexOf(s)>=0)go(s);return}if(ls.getItem("kf-lang-auto"))return;var b=null,tags=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];for(var i=0;i<tags.length;i++){var t=(tags[i]||"").toLowerCase().split("-")[0];if(t==="en"||L.indexOf(t)>=0){b=t;break}}var z=null;try{z=Z[Intl.DateTimeFormat().resolvedOptions().timeZone]||null}catch(e){}if(z&&L.indexOf(z)<0)z=null;var det=b&&b!=="en"?b:(z||b);ls.setItem("kf-lang-auto",det||"en");if(det&&det!=="en")go(det)}catch(e){}})();`;
  return `<script>${js}</script>`;
}
