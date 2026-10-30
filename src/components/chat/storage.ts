/** What the chat widget remembers in this browser. Every access is wrapped: `localStorage` throws in some privacy modes. */

/** Auto-open once per visitor, after the page has settled. */
export const GREETED_KEY = "kf-chat-greeted";
/** How many agent messages this visitor has already read. */
export const SEEN_KEY = "kf-chat-seen";
export const AUTO_OPEN_DELAY = 4200;
/** The E.164 number this browser last chatted with — prefills the field, and
 *  lets a returning visitor skip the phone step before the server confirms it. */
export const PHONE_KEY = "kf-chat-phone";

export function readPhoneKey(): string {
  try {
    return localStorage.getItem(PHONE_KEY) ?? "";
  } catch {
    return "";
  }
}
export function writePhoneKey(value: string) {
  try {
    if (value) localStorage.setItem(PHONE_KEY, value);
    else localStorage.removeItem(PHONE_KEY);
  } catch {
    /* private mode */
  }
}

export function readNum(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}
export function writeNum(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* private mode — the widget still works, it just forgets */
  }
}
