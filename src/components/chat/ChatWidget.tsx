import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { Link } from "react-router-dom";
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
import { trackConversion } from "../../lib/conversions";
import { useI18n } from "../../lib/i18n";
import { afterIntroReveal } from "../../lib/intro";
import { guessCountry, readPhone, rememberCountry, switchCountry } from "../../lib/phone";
import { ChatAvatar } from "./ChatAvatar";
import { PhoneField } from "../PhoneField";
import { ChatComposer } from "./ChatComposer";
import { ChatHeader } from "./ChatHeader";
import { ChatLog } from "./ChatLog";
import { mergeMessage } from "./messages";
import { AUTO_OPEN_DELAY, GREETED_KEY, SEEN_KEY, readNum, readPhoneKey, writeNum, writePhoneKey } from "./storage";
import styles from "./ChatWidget.module.css";

const QUICK = ["I need a POS system", "Website or web app", "AI automation", "How much does it cost?"];

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
    let id = 0;
    // The greeting is timed from when the visitor can see the page: on a
    // homepage that opens with the samurai intro, that is after the cut.
    const cancelWait = afterIntroReveal(() => {
      id = window.setTimeout(() => {
        writeNum(GREETED_KEY, 1);
        setOpen((already) => {
          if (already) return already;
          setUnread(0);
          return true;
        });
      }, AUTO_OPEN_DELAY);
    });
    return () => {
      cancelWait();
      window.clearTimeout(id);
    };
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
      // A new conversation is a conversion; picking an old one back up is not.
      if (!session.resumed) trackConversion("chat_start");

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
          <ChatHeader agentJoined={agentJoined} onMinimise={() => setOpen(false)} />

          <ChatLog
            logRef={logRef}
            messages={messages}
            resumed={resumed}
            agentJoined={agentJoined}
            agentTyping={agentTyping}
          />

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
                <p className={styles.note}>
                  {t("We reply here directly. Your details are only used to follow up.")}{" "}
                  <Link to="/book" className={styles.noteLink} onClick={() => setOpen(false)}>
                    {t("Prefer a call? Book one")}
                  </Link>
                </p>
              </form>
            </>
          ) : (
            <>
              {error && <p className={styles.errorNote}>{t(error)}</p>}
              <div className={styles.form}>
                <ChatComposer draft={draft} onDraftChange={handleDraftChange} onSend={handleSend} />
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
