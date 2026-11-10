/**
 * The owner's own phone and Mac, kept out of the numbers.
 *
 * Most early traffic was the owner checking the site, which made the
 * dashboard's visitors meaningless. Opening any page with `?kf_owner=on`
 * marks that browser as an owner device: from then on it sends no analytics
 * events and loads no ad pixels (so Google Ads / Meta / TikTok / Snapchat
 * audiences aren't trained on the owner either), and the footer says so.
 * `?kf_owner=off` undoes it. The dashboard's Analytics page links to both.
 *
 * Anyone could add the parameter, but all it does is stop counting that
 * visitor, so there is nothing to protect.
 */
const KEY = "kf-owner-device";
const PARAM = "kf_owner";

export function isOwnerDevice(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setOwnerDevice(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: nothing to remember */
  }
}

/**
 * Reads `?kf_owner=on|off` from the address, stores it, and takes the
 * parameter back out of the URL so it isn't bookmarked or shared. Runs before
 * the app renders, so the first page view of an owner visit is never sent.
 */
export function applyOwnerParam(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const value = url.searchParams.get(PARAM);
  if (value === null) return;
  setOwnerDevice(value === "on" || value === "1" || value === "true");
  url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}
