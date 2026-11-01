import type { ChatMessage } from "../../services/chat";

/** Server timestamps are epoch milliseconds (see kf_backend chat.repo.ts). */
export function clock(ts: number | undefined) {
  if (!ts) return "";
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

export function mergeMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  // The socket echoes back messages we just sent over REST, so dedupe by id.
  if (list.some((m) => m.id === incoming.id)) return list;
  const next = [...list, incoming];
  next.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  return next;
}
