import { io, type Socket } from "socket.io-client";
import { apiFetch, API_ORIGIN } from "./http";

/**
 * Visitor-side chat against kf_backend.
 *
 * There is no visitor login. The browser mints a random id once, keeps it in
 * localStorage, and that id *is* the thread id (`/api/chat/threads/:visitorId`).
 * All writes go over REST; Socket.io is a push-only channel used to receive
 * agent replies live — see kf_backend/src/realtime/io.ts.
 */

export type ChatSender = "visitor" | "agent";

export interface ChatMessage {
  id: string;
  threadId: string;
  from: ChatSender;
  text: string;
  /** epoch milliseconds (server-assigned) */
  ts: number;
}

export interface ChatThread {
  id: string;
  visitorId: string;
  visitorMeta?: { name?: string; contact?: string };
  /** E.164, once the visitor has given it. Required before they can send. */
  phone?: string;
  phoneCountry?: string;
  userTyping?: boolean;
  lastMessageAt?: string;
  createdAt?: string;
}

export interface ChatThreadMeta {
  name?: string;
  contact?: string;
}

const VISITOR_KEY = "kf-visitor-id";

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * The stable id for this browser. Generated on first use and reused forever, so
 * a returning visitor lands back in the same thread with their history intact.
 * Falls back to an in-memory id if localStorage is unavailable (private mode).
 */
let memoryVisitorId: string | null = null;

export function getVisitorId(): string {
  if (memoryVisitorId) return memoryVisitorId;
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = randomId();
    localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    if (!memoryVisitorId) memoryVisitorId = randomId();
    return memoryVisitorId;
  }
}

/**
 * Switches this browser to another thread — the one the server found for the
 * visitor's phone number — so a reload keeps them in it.
 */
export function setVisitorId(id: string): void {
  memoryVisitorId = id;
  try {
    localStorage.setItem(VISITOR_KEY, id);
  } catch {
    /* private mode — kept in memory for this visit */
  }
}

/** This browser's thread, or null if it has none yet. */
export function getThread(visitorId: string): Promise<ChatThread | null> {
  return apiFetch<ChatThread | null>(`/chat/threads/${encodeURIComponent(visitorId)}`);
}

export interface ChatSession {
  thread: ChatThread;
  messages: ChatMessage[];
  /** An earlier conversation was found under this number and reopened. */
  resumed: boolean;
  phone: { e164: string; country?: string; international: string };
}

/**
 * The widget's phone step. The server validates the number, then either resumes
 * the latest thread for it (possibly a different `visitorId` — adopt it) or
 * starts one.
 */
export function startSession(input: {
  visitorId: string;
  phone: string;
  country?: string;
  name?: string;
}): Promise<ChatSession> {
  return apiFetch<ChatSession>("/chat/session", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Creates the thread if needed, and attaches the visitor's name/contact when given. */
export function openThread(visitorId: string, meta: ChatThreadMeta = {}): Promise<ChatThread> {
  const body: ChatThreadMeta = {};
  if (meta.name?.trim()) body.name = meta.name.trim();
  if (meta.contact?.trim()) body.contact = meta.contact.trim();
  return apiFetch<ChatThread>(`/chat/threads/${encodeURIComponent(visitorId)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getMessages(visitorId: string): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/chat/threads/${encodeURIComponent(visitorId)}/messages`);
}

/** The server always stamps `from: "visitor"` — a visitor cannot post as the agent. */
export function sendMessage(visitorId: string, text: string): Promise<ChatMessage> {
  return apiFetch<ChatMessage>(`/chat/threads/${encodeURIComponent(visitorId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function setTyping(visitorId: string, typing: boolean): Promise<unknown> {
  return apiFetch(`/chat/threads/${encodeURIComponent(visitorId)}/typing`, {
    method: "PATCH",
    body: JSON.stringify({ typing }),
  });
}

export interface ChatSocketHandlers {
  onMessage: (message: ChatMessage) => void;
  onTyping?: (payload: { visitorId: string; typing: boolean }) => void;
  onStatus?: (connected: boolean) => void;
}

/**
 * Opens the push channel. The handshake carries only `{ visitorId }` — the
 * server joins us to `thread:<visitorId>` and refuses any attempt to watch
 * another thread, so there is nothing else to authorize here.
 *
 * Connection errors are swallowed deliberately: with no backend reachable the
 * widget still works as far as it can and never throws into the page.
 */
export function connectChatSocket(visitorId: string, handlers: ChatSocketHandlers): Socket {
  const socket = io(API_ORIGIN || undefined, {
    auth: { visitorId },
    transports: ["websocket", "polling"],
    reconnectionDelayMax: 10000,
  });

  socket.on("connect", () => handlers.onStatus?.(true));
  socket.on("disconnect", () => handlers.onStatus?.(false));
  socket.on("connect_error", () => handlers.onStatus?.(false));
  socket.on("chat:message", (message: ChatMessage) => {
    if (message && typeof message.text === "string") handlers.onMessage(message);
  });
  // Only the agent's typing state is relevant to the visitor; the server sends
  // the visitor's own flag to the dashboard, not back here.
  socket.on("chat:agent-typing", (payload: { visitorId: string; typing: boolean }) => {
    if (payload) handlers.onTyping?.(payload);
  });

  return socket;
}
