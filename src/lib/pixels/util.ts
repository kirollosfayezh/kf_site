/** Small DOM helpers shared by the tag loaders. */

export const clean = (v: string | undefined) => v?.trim() || "";

export function injectScript(src: string): void {
  const s = document.createElement("script");
  s.src = src;
  s.async = true;
  document.head.appendChild(s);
}

/** The data layer exists from the first call, so nothing races the container. */
export function push(payload: Record<string, unknown>): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}
