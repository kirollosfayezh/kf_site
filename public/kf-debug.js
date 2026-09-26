/*
 * On-screen diagnostics for a real phone, where there is no console.
 * Loaded by the boot script only when the URL carries `?kf-debug`; never part
 * of the bundle. Shows the intro's state changes, the body scroll lock, the
 * scroll position, whether the page's storage works, and — the reason it
 * exists — every touch: what it landed on, and whether anything cancelled it.
 */
(function () {
  var box = document.createElement("pre");
  box.id = "kf-debug";
  box.style.cssText =
    "position:fixed;top:0;left:0;z-index:2147483647;max-width:100vw;max-height:46vh;overflow:hidden;margin:0;padding:6px 8px;" +
    "font:10px/1.35 Menlo,monospace;color:#9f9;background:rgba(0,0,0,.72);direction:ltr;text-align:left;white-space:pre-wrap;pointer-events:none";
  var lines = [];
  var t0 = performance.now();
  function log(s) {
    lines.push(((performance.now() - t0) / 1000).toFixed(2) + "s " + s);
    if (lines.length > 22) lines.shift();
    box.textContent = lines.join("\n");
  }
  function mount() {
    if (!document.body) return requestAnimationFrame(mount);
    document.body.appendChild(box);
    log("ua " + navigator.userAgent.replace(/^Mozilla\/5\.0 /, "").slice(0, 60));
    log("vw " + innerWidth + "x" + innerHeight + " dpr " + devicePixelRatio);
    try {
      localStorage.setItem("kf-debug-probe", "1");
      log("storage ok, intro-seen=" + (localStorage.getItem("kf-intro-seen") || "none"));
    } catch (e) {
      log("STORAGE FAILS: " + e);
    }
    var gl = (function () {
      try {
        var c = document.createElement("canvas");
        return !!(c.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) || c.getContext("webgl", { failIfMajorPerformanceCaveat: true }));
      } catch (e) {
        return "err";
      }
    })();
    log("fast webgl " + gl);
  }
  mount();

  // intro state + scroll lock
  new MutationObserver(function () {
    log("intro=" + (document.documentElement.getAttribute("data-intro") || "none") + " body.overflow=\"" + document.body.style.overflow + "\"");
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-intro"] });
  var lastOverflow = "";
  setInterval(function () {
    if (!document.body) return;
    var o = document.body.style.overflow;
    if (o !== lastOverflow) {
      lastOverflow = o;
      log("body.overflow -> \"" + o + "\"");
    }
  }, 200);

  // touches: target, computed touch-action, and whether the move was cancelled
  function describe(el) {
    if (!el || !el.tagName) return "?";
    var s = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0].slice(0, 18) : "");
    return s + " ta=" + getComputedStyle(el).touchAction;
  }
  var moves = 0;
  var startY = 0;
  window.addEventListener("touchstart", function (e) {
    moves = 0;
    startY = scrollY;
    var t = e.touches[0];
    var el = document.elementFromPoint(t.clientX, t.clientY);
    log("touchstart @" + Math.round(t.clientX) + "," + Math.round(t.clientY) + " on " + describe(el) + " scrollY=" + Math.round(scrollY));
  }, { passive: true, capture: true });
  window.addEventListener("touchmove", function (e) {
    moves++;
    if (moves === 1 || moves === 4) {
      setTimeout(function () {
        log("touchmove#" + moves + " cancelable=" + e.cancelable + " prevented=" + e.defaultPrevented + " scrollY=" + Math.round(scrollY));
      }, 0);
    }
  }, { passive: true, capture: true });
  window.addEventListener("touchend", function () {
    setTimeout(function () {
      log("touchend moves=" + moves + " scrollY " + Math.round(startY) + "->" + Math.round(scrollY) + " max=" + Math.round(document.documentElement.scrollHeight - innerHeight));
    }, 300);
  }, { passive: true, capture: true });
  window.addEventListener("error", function (e) {
    log("ERROR " + String(e.message).slice(0, 80));
  });
})();
