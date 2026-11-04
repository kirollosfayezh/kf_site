import type { Lang } from "../src/lib/langs.ts";

/**
 * The inline `<script>` at the top of every prerendered page.
 *
 * Two jobs, both of which must happen before the first paint now that pages
 * arrive with a real body:
 *
 * 1. Theme — light is the default, so `<html>` gets `data-kf-theme="light"`
 *    before the first paint unless the visitor picked dark.
 * 2. Language — the same decision `applyAutoLanguage()` makes (only a
 *    language chosen with the switcher; English otherwise), taken before
 *    the English page is visible rather than after React has mounted it.
 *
 * Only languages switched on in the dashboard are redirect targets: the
 * build passes them in, so a stored preference for a language that has since
 * been turned off lands on English rather than on a 404.
 */
export function bootScript(enabled: readonly Lang[]): string {
  const langs = JSON.stringify(enabled.filter((l) => l !== "en"));
  // `?kf-debug` loads an on-screen diagnostics overlay (public/kf-debug.js)
  // for phones, where there is no console; not part of the bundle.
  const debug = `if(/[?&]kf-debug(=|&|$)/.test(location.search)){var g=document.createElement("script");g.src="/kf-debug.js";document.head.appendChild(g)}`;
  // The opening `(function(){try{var d=document.documentElement` is what
  // verify:prerender recognises the script by; keep it first.
  const js = `(function(){try{var d=document.documentElement,ls=localStorage;${debug}if(ls.getItem("kf-theme")!=="dark")d.setAttribute("data-kf-theme","light");var L=${langs},p=location.pathname,f=p.split("/").filter(Boolean)[0];if(f==="en"||f==="ar"||f==="de"||f==="fr")return;var s=ls.getItem("kf-lang");if(s&&L.indexOf(s)>=0)location.replace("/"+s+(p==="/"?"":p)+location.search+location.hash)}catch(e){}})();`;
  return `<script>${js}</script>`;
}
