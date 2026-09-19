import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  connectChatSocket,
  getMessages,
  getVisitorId,
  openThread,
  sendMessage,
  setTyping,
  type ChatMessage,
} from "../../services/chat";
import styles from "./ChatWidget.module.css";

const QUICK = ["I need a POS system", "Website or web app", "AI automation", "How much does it cost?"];

const GREETING = "Hi! You're through to KF Tech Solutions. What are you trying to build?";

/** Server timestamps are epoch milliseconds (see kf_backend chat.repo.ts). */
function clock(ts: number | undefined) {
  if (!ts) return "";
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function mergeMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  // The socket echoes back messages we just sent over REST, so dedupe by id.
  if (list.some((m) => m.id === incoming.id)) return list;
  const next = [...list, incoming];
  next.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  return next;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [visitorId] = useState<string>(() => getVisitorId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentTyping, setAgentTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeout = useRef<number | undefined>(undefined);
  /** Whether the server already knows we're typing, so we send it once per burst. */
  const typingSent = useRef(false);

  // Mirrored into a ref so the long-lived socket listener can read the current
  // open state without being torn down and re-created on every toggle.
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Reload history on every visit: the thread id is stable in localStorage, so a
  // returning visitor sees the whole conversation again.
  useEffect(() => {
    let cancelled = false;
    getMessages(visitorId)
      .then((history) => {
        if (cancelled || !Array.isArray(history)) return;
        if (history.length > 0) {
          setMessages(history);
          setStarted(true);
        }
      })
      .catch(() => {
        /* No history (or no backend) — fall back to the intro form. */
      });
    return () => {
      cancelled = true;
    };
  }, [visitorId]);

  // Push channel. Connected regardless of whether the panel is open so an agent
  // reply bumps the unread badge while the widget is closed.
  useEffect(() => {
    const socket = connectChatSocket(visitorId, {
      onMessage: (message) => {
        setMessages((cur) => mergeMessage(cur, message));
        if (message.from === "agent") {
          setAgentTyping(false);
          setStarted(true);
          if (!openRef.current) setUnread((u) => u + 1);
        }
      },
      onTyping: ({ typing }) => setAgentTyping(typing),
    });
    socketRef.current = socket;
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [visitorId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, agentTyping, open]);

  useEffect(() => {
    return () => window.clearTimeout(typingTimeout.current);
  }, []);

  // Escape closes the panel — the widget must always be dismissible.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const push = useCallback(
    async (text: string) => {
      const message = await sendMessage(visitorId, text);
      setMessages((cur) => mergeMessage(cur, message));
    },
    [visitorId],
  );

  async function begin(firstText?: string) {
    setStarting(true);
    setError(null);
    try {
      await openThread(visitorId, { name, contact });
      setStarted(true);
      if (firstText) await push(firstText);
    } catch {
      setError("Couldn't connect to chat right now. Try WhatsApp instead, or refresh and try again.");
    } finally {
      setStarting(false);
    }
  }

  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (next) setUnread(0);
      return next;
    });
  }

  async function handleQuick(text: string) {
    if (started) {
      try {
        await push(text);
      } catch {
        setError("That message didn't send. Check your connection and try again.");
      }
    } else {
      await begin(text);
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setError(null);
    try {
      await push(text);
      window.clearTimeout(typingTimeout.current);
      typingSent.current = false;
      await setTyping(visitorId, false);
    } catch {
      setDraft(text);
      setError("That message didn't send. Check your connection and try again.");
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    // One request per typing burst, not per keystroke.
    if (!typingSent.current) {
      typingSent.current = true;
      setTyping(visitorId, true).catch(() => {});
    }
    window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => {
      typingSent.current = false;
      setTyping(visitorId, false).catch(() => {});
    }, 1800);
  }

  return (
    <>
      <button
        className={styles.fab}
        data-track="chat.launcher"
        aria-label={open ? "Close chat" : "Chat with us"}
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24">
          <path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        </svg>
        {unread > 0 && !open && <span className={styles.dot}>{unread}</span>}
      </button>

      {open && (
        <section className={styles.panel} role="dialog" aria-label="Chat with KF Tech Solutions">
          <header className={styles.hd}>
            <span className={styles.av}>KF</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2>KF Tech Solutions</h2>
              <div className={styles.st}>
                <span className={styles.live} /> Usually replies within minutes
              </div>
            </div>
            <button className={styles.x} aria-label="Close chat" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          {!started ? (
            <>
              <div className={styles.log} ref={logRef}>
                <div className={`${styles.row} ${styles.rowThem}`}>
                  <div className={styles.bub}>{GREETING}</div>
                </div>
              </div>
              <div className={styles.quick}>
                {QUICK.map((q) => (
                  <button key={q} type="button" onClick={() => handleQuick(q)} disabled={starting}>
                    {q}
                  </button>
                ))}
              </div>
              {error && <p className={styles.errorNote}>{error}</p>}
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  begin();
                }}
              >
                <label className={styles.fld}>
                  <span>Your name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
                </label>
                <label className={styles.fld}>
                  <span>Email or WhatsApp</span>
                  <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Optional" />
                </label>
                <button className={styles.go} type="submit" disabled={starting}>
                  {starting ? "Connecting…" : "Start chat"}
                </button>
                <p className={styles.note}>We reply here directly. Your details are only used to follow up.</p>
              </form>
            </>
          ) : (
            <>
              <div className={styles.log} ref={logRef}>
                {/* The greeting is presentational only — it is never written to the thread. */}
                <div className={`${styles.row} ${styles.rowThem}`}>
                  <div className={styles.bub}>{GREETING}</div>
                </div>
                {messages.map((m) => (
                  <div key={m.id} className={`${styles.row} ${m.from === "visitor" ? styles.rowMe : styles.rowThem}`}>
                    <div className={styles.bub}>{m.text}</div>
                    <span className={styles.ts}>{clock(m.ts)}</span>
                  </div>
                ))}
                {agentTyping && (
                  <div className={styles.typing}>
                    <i />
                    <i />
                    <i />
                  </div>
                )}
              </div>
              {error && <p className={styles.errorNote}>{error}</p>}
              <div className={styles.form}>
                <div className={styles.comp}>
                  <textarea
                    rows={1}
                    value={draft}
                    placeholder="Type a message…"
                    onChange={(e) => handleDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <button className={styles.send} type="button" disabled={!draft.trim()} onClick={handleSend} aria-label="Send message">
                    <svg viewBox="0 0 24 24">
                      <path d="M22 2L11 13" />
                      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
