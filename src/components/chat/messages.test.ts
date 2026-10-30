import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../../services/chat";
import { clock, mergeMessage } from "./messages";

const msg = (id: string, ts: number, from: ChatMessage["from"] = "visitor"): ChatMessage => ({
  id,
  threadId: "t1",
  from,
  text: id,
  ts,
});

describe("mergeMessage", () => {
  it("ignores the socket echo of a message already sent over REST", () => {
    const list = [msg("a", 1)];
    expect(mergeMessage(list, msg("a", 1))).toBe(list);
  });

  it("keeps the thread in server-time order when messages arrive out of order", () => {
    const merged = mergeMessage([msg("a", 10), msg("c", 30)], msg("b", 20, "agent"));
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the list it was given", () => {
    const list = [msg("a", 10)];
    mergeMessage(list, msg("b", 5));
    expect(list.map((m) => m.id)).toEqual(["a"]);
  });
});

describe("clock", () => {
  it("formats epoch milliseconds as a zero-padded local HH:MM", () => {
    const ts = new Date(2026, 0, 5, 7, 4).getTime();
    expect(clock(ts)).toBe("07:04");
  });

  it("is empty when the server sent no timestamp", () => {
    expect(clock(undefined)).toBe("");
    expect(clock(0)).toBe("");
  });
});
