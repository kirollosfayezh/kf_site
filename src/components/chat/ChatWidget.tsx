import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { CountryCode } from "libphonenumber-js/max";
import {
  connectChatSocket,
  getMessages,
  getThread,
  getVisitorId,
  sendMessage,
  setTyping,
  setVisitorId,
  startSession,
  type ChatMessage,
} from "../../services/chat";
import { ApiError } from "../../services/http";
import { useI18n } from "../../lib/i18n";
import { guessCountry, readPhone, rememberCountry, switchCountry } from "../../lib/phone";
import { ChatAvatar } from "./ChatAvatar";
import { PhoneField } from "./PhoneField";
import styles from "./ChatWidget.module.css";

const QUICK = ["I need a POS system", "Website or web app", "AI automation", "How much does it cost?"];

const GREETING = "Hi! You're through to KF Tech Solutions. What are you trying to build?";

/** Auto-open once per visitor, after the page has settled. */
const GREETED_KEY = "kf-chat-greeted";
/** How many agent messages this visitor has already read. */
const SEEN_KEY = "kf-chat-seen";
const AUTO_OPEN_DELAY = 4200;
/** The E.164 number this browser last chatted with — prefills the field, and
 *  lets a returning visitor skip the phone step before the server confirms it. */
const PHONE_KEY = "kf-chat-phone";

function readPhoneKey(): string {
  try {
    return localStorage.getItem(PHONE_KEY) ?? "";
  } catch {
    return "";
  }
}
function writePhoneKey(value: string) {
  try {
    if (value) localStorage.setItem(PHONE_KEY, value);
    else localStorage.removeItem(PHONE_KEY);
  } catch {
    /* private mode */
  }
}

function readNum(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}
function writeNum(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* private mode — the widget still works, it just forgets */
  }
}

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
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  /**
   * Whether this thread has a phone on file — the gate for sending. Seeded from
   * this browser's memory so a returning visitor goes straight to the
   * conversation, then confirmed by the server.
   */
  const [hasPhone, setHasPhone] = useState<boolean>(() => !!readPhoneKey());
  /** Adopts the thread the server finds for the visitor's phone number. */
  const [visitorId, setVisitorIdState] = useState<string>(() => getVisitorId());
  const [phone, setPhone] = useState(() => readPhoneKey());
  const [country, setCountry] = useState<CountryCode>(() => guessCountry(lang));
  /** Left the field with something in it — only then may a complete-but-wrong number be flagged. */
  const [phoneTouched, setPhoneTouched] = useState(false);
  /** Tried to start: from here any invalid number, or none, is flagged. */
  const [attempted, setAttempted] = useState(false);
  const [resumed, setResumed] = useState(false);
  /** A quick reply tapped before the phone step, sent once the chat starts. */
  const pending = useRef<string | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const phoneState = useMemo(() => readPhone(phone, country), [phone, country]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentTyping, setAgentTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  /**
   * Which face the widget wears. It starts as the bot — nobody is at a desk at
   * 2am — and switches to the agent avatar for good once a real reply lands,
   * because pretending a human is present before one has spoken is the kind of
   * thing visitors remember badly.
   */
  const [agentJoined, setAgentJoined] = useState(false);
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
    // Whether the server has a phone for this thread. A thread from before
    // phones were required keeps its history, but asks for one before the
    // next message.
    getThread(visitorId)
      .then((thread) => {
        if (cancelled) return;
        setHasPhone(!!thread?.phone);
        if (thread?.phone) writePhoneKey(thread.phone);
      })
      .catch(() => {
        /* Backend unreachable — keep what this browser remembers. */
      });
    getMessages(visitorId)
      .then((history) => {
        if (cancelled || !Array.isArray(history)) return;
        if (history.length > 0) {
          setMessages(history);
          const agentCount = history.filter((m) => m.from === "agent").length;
          if (agentCount > 0) setAgentJoined(true);
          // Unread survives the visit: an answer that arrived while the visitor
          // was away is exactly the thing they came back for.
          const unseen = agentCount - readNum(SEEN_KEY);
          if (unseen > 0) setUnread(unseen);
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
          setAgentJoined(true);
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

  /**
   * Greets a first-time visitor on its own, once, a few seconds in.
   *
   * Once only, and remembered across visits: a panel that reopens on every page
   * view is the single most disliked thing a chat widget does, and someone who
   * has already been greeted has made their choice. It also waits for the page
   * to settle rather than fighting the hero for the first paint, and never
   * interrupts a visitor who has already opened it or is being typed to.
   */
  useEffect(() => {
    if (readNum(GREETED_KEY)) return;
    const id = window.setTimeout(() => {
      writeNum(GREETED_KEY, 1);
      setOpen((already) => {
        if (already) return already;
        setUnread(0);
        return true;
      });
    }, AUTO_OPEN_DELAY);
    return () => window.clearTimeout(id);
  }, []);

  /**
   * Reading the panel clears the badge *and* records it, so the count is right
   * the next time the visitor lands rather than re-announcing old replies.
   */
  useEffect(() => {
    if (!open) return;
    const agentCount = messages.filter((m) => m.from === "agent").length;
    writeNum(SEEN_KEY, agentCount);
    setUnread(0);
  }, [open, messages]);

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
    async (text: string, id: string = visitorId) => {
      const message = await sendMessage(id, text);
      setMessages((cur) => mergeMessage(cur, message));
    },
    [visitorId],
  );

  /** The server says this thread has no phone yet: back to the phone step. */
  function needsPhone(err: unknown): boolean {
    if (err instanceof ApiError && err.code === "PHONE_REQUIRED") {
      writePhoneKey("");
      setHasPhone(false);
      window.setTimeout(() => phoneRef.current?.focus(), 0);
      return true;
    }
    return false;
  }

  /**
   * The phone step. A valid number starts the chat — or, if that number has
   * chatted before, reopens its last conversation, even from another device.
   */
  async function begin(firstText?: string) {
    if (firstText) pending.current = firstText;
    setAttempted(true);
    setError(null);
    if (!phoneState.valid || !phoneState.e164) {
      phoneRef.current?.focus();
      return;
    }

    setStarting(true);
    try {
      const session = await startSession({
        visitorId,
        phone: phoneState.e164,
        country: phoneState.country,
        name: name.trim() || undefined,
      });
      const id = session.thread.visitorId;
      if (id !== visitorId) {
        setVisitorId(id);
        setVisitorIdState(id);
      }
      if (phoneState.country) rememberCountry(phoneState.country);
      writePhoneKey(session.phone.e164);
      setPhone(session.phone.international);
      setMessages(session.messages);
      setResumed(session.resumed && session.messages.length > 0);
      if (session.messages.some((m) => m.from === "agent")) setAgentJoined(true);
      setHasPhone(true);

      const text = pending.current;
      pending.current = null;
      if (text) await push(text, id);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "INVALID_PHONE"
          ? "Please enter a valid phone number, including the country code."
          : "Couldn't connect to chat right now. Try WhatsApp instead, or refresh and try again.",
      );
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
    if (hasPhone) {
      try {
        await push(text);
      } catch (err) {
        if (needsPhone(err)) pending.current = text;
        else setError("That message didn't send. Check your connection and try again.");
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
    } catch (err) {
      setDraft(text);
      if (!needsPhone(err)) setError("That message didn't send. Check your connection and try again.");
    }
  }

  function handlePhoneChange(value: string) {
    setPhone(value);
    // A number typed with its country code picks its own country.
    const next = readPhone(value, country);
    if (next.country && next.country !== country && (value.trim().startsWith("+") || value.trim().startsWith("00") || next.valid)) {
      setCountry(next.country);
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
        aria-label={open ? t("Close chat") : t("Chat with us")}
        aria-expanded={open}
        onClick={toggle}
      >
        <ChatAvatar kind={agentJoined ? "agent" : "bot"} size={38} className={styles.fabAvatar} />
        {unread > 0 && !open && <span className={styles.dot}>{unread}</span>}
      </button>

      {open && (
        <section className={styles.panel} role="dialog" aria-label={t("Chat with KF Tech Solutions")}>
          <header className={styles.hd}>
            <ChatAvatar kind={agentJoined ? "agent" : "bot"} size={40} className={styles.hdAvatar} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2>{agentJoined ? "KF Tech Solutions" : t("KF Assistant")}</h2>
              <div className={styles.st}>
                <span className={styles.live} />{" "}
                {agentJoined ? t("A person is with you now") : t("Usually replies within minutes")}
              </div>
            </div>
            {/* Minimise, not close: the conversation stays exactly where it was
                and the launcher keeps the unread badge. */}
            <button className={styles.x} aria-label={t("Minimise chat")} onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 14l6 6 6-6" />
              </svg>
            </button>
          </header>

          <div className={styles.log} ref={logRef}>
            {/* The greeting is presentational only — it is never written to the thread. */}
            <div className={`${styles.row} ${styles.rowThem}`}>
              <ChatAvatar kind="bot" size={26} className={styles.rowAvatar} />
              <div className={styles.bub}>{t(GREETING)}</div>
            </div>
            {resumed && <div className={styles.resumed}>{t("Welcome back — here's your previous conversation.")}</div>}
            {messages.map((m) => (
              <div key={m.id} className={`${styles.row} ${m.from === "visitor" ? styles.rowMe : styles.rowThem}`}>
                {m.from !== "visitor" && (
                  <ChatAvatar kind={agentJoined ? "agent" : "bot"} size={26} className={styles.rowAvatar} />
                )}
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

          {!hasPhone ? (
            <>
              {messages.length === 0 && (
                <div className={styles.quick}>
                  {QUICK.map((q) => (
                    <button key={q} type="button" onClick={() => handleQuick(t(q))} disabled={starting}>
                      {t(q)}
                    </button>
                  ))}
                </div>
              )}
              {error && <p className={styles.errorNote}>{t(error)}</p>}
              <form
                className={styles.form}
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  begin();
                }}
              >
                <PhoneField
                  id="kf-chat-phone"
                  value={phone}
                  country={country}
                  state={phoneState}
                  showError={attempted || (phoneTouched && phoneState.complete)}
                  lang={lang}
                  t={t}
                  inputRef={phoneRef}
                  onChange={handlePhoneChange}
                  onCountryChange={(c) => {
                    setCountry(c);
                    setPhone((cur) => switchCountry(cur, c));
                    phoneRef.current?.focus();
                  }}
                  onBlur={() => {
                    if (phone.trim()) setPhoneTouched(true);
                    // Tidy the number into its country's format once it is complete.
                    if (phoneState.valid) setPhone(phoneState.display);
                  }}
                  onEnter={() => begin()}
                />
                <label className={styles.fld}>
                  <span>{t("Your name")}</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Optional")} autoComplete="name" />
                </label>
                <button className={styles.go} type="submit" disabled={starting}>
                  {starting ? t("Connecting…") : messages.length ? t("Continue chat") : t("Start chat")}
                </button>
                <p className={styles.note}>{t("We reply here directly. Your details are only used to follow up.")}</p>
              </form>
            </>
          ) : (
            <>
              {error && <p className={styles.errorNote}>{t(error)}</p>}
              <div className={styles.form}>
                <div className={styles.comp}>
                  <textarea
                    rows={1}
                    value={draft}
                    placeholder={t("Type a message…")}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <button className={styles.send} type="button" disabled={!draft.trim()} onClick={handleSend} aria-label={t("Send message")}>
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
