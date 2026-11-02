import { LANGS, type Lang } from "./langs.ts";

/**
 * Reading time in minutes, from the body rather than a field an editor has to
 * keep in step with their own edits.
 *
 * 200 wpm is the usual English figure. Arabic is counted the same way: word
 * counts run lower for the same content, which offsets the slower per-word
 * rate closely enough for a rounded "N min read".
 */
export function readingMinutes(source: string): number {
  const words = (source || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

interface Cardable {
  body?: Partial<Record<Lang, string>>;
  meta?: Record<string, unknown>;
}

/**
 * An item as a list card needs it: no body, the reading time per language in
 * `meta.readingMinutes` instead. Mirrors `cardView` in kf_backend's content
 * service (`GET /content/:collection?view=card`), so the prerendered snapshot
 * and the client's revalidation agree. Each language counts the body `pick()`
 * would show it: its own when written, else English, else Arabic.
 */
export function cardView<T extends Cardable>(item: T): T {
  const { body, ...rest } = item;
  if (!body) return item;
  const fallback = body.en?.trim() ? body.en : (body.ar ?? "");
  const minutes = Object.fromEntries(LANGS.map((l) => [l, readingMinutes(body[l]?.trim() ? (body[l] as string) : fallback)]));
  return { ...rest, meta: { ...(item.meta ?? {}), readingMinutes: minutes } } as unknown as T;
}

/** A card's "N min read": from the card view, or counted from the body when the item still has one. */
export function cardMinutes<T extends Cardable>(item: T, lang: Lang, pickBody: (body: T["body"]) => string): number {
  const stored = (item.meta?.readingMinutes as Partial<Record<Lang, number>> | undefined)?.[lang];
  return typeof stored === "number" && stored > 0 ? stored : readingMinutes(pickBody(item.body));
}
