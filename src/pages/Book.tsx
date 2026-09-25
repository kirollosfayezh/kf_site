import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { CountryCode } from "libphonenumber-js/max";
import { useI18n } from "../lib/i18n";
import { defaultCountry, guessCountry, readPhone, rememberCountry } from "../lib/phone";
import { PhoneField } from "../components/PhoneField";
import { Reveal } from "../components/Reveal";
import { useWhatsAppLink } from "../hooks/useWhatsAppLink";
import { trackConversion } from "../lib/conversions";
import { ApiError } from "../services/http";
import { createBooking, getSlots, type BookingResult, type Slot, type SlotList } from "../services/sales";
import s from "../styles/sections.module.css";
import c from "./Contact.module.css";
import b from "./Book.module.css";

/** Intl locale for dates: Egyptian Arabic for Arabic, so month names read naturally. */
const locale = (lang: string) => (lang === "ar" ? "ar-EG" : lang);

function visitorTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** "2026-01-11" in the visitor's own zone — slots are grouped by the day *they* see. */
function localDay(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** An .ics file, so the call lands in the visitor's own calendar. */
function icsFile(booking: BookingResult, title: string, description: string): string {
  const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KF Tech Solutions//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@kftechsolutions`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(booking.start)}`,
    `DTEND:${stamp(booking.end)}`,
    `SUMMARY:${title.replace(/[,;]/g, " ")}`,
    `DESCRIPTION:${description.replace(/[,;]/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Book a call. Visitors pick a free slot — shown in their own time zone,
 * whatever the business's is — and leave the WhatsApp number we will call.
 * The same phone rules as the chat apply, and the booking lands in the
 * dashboard as a contact, a calendar entry and an alert.
 */
export function Book() {
  const { t, lang } = useI18n();
  const waLink = useWhatsAppLink(t("booking a call"));
  // Both start from what the build could know (UTC, the language's country)
  // and become the visitor's own after mount — the page is prerendered, and
  // the build machine's time zone is not the visitor's.
  const [tz, setTz] = useState("UTC");
  useEffect(() => setTz(visitorTimeZone()), []);
  const [data, setData] = useState<SlotList | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<CountryCode>(() => defaultCountry(lang));
  useEffect(() => setCountry(guessCountry(lang)), [lang]);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingResult | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const phoneState = useMemo(() => readPhone(phone, country), [phone, country]);

  const load = () => {
    setLoadError(false);
    getSlots()
      .then((d) => {
        setData(d);
        setSlot((cur) => (cur && d.slots.some((x) => x.start === cur.start) ? cur : null));
      })
      .catch(() => setLoadError(true));
  };
  useEffect(load, []);

  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const sl of data?.slots ?? []) {
      const key = localDay(sl.start, tz);
      map.set(key, [...(map.get(key) ?? []), sl]);
    }
    return [...map.entries()];
  }, [data, tz]);

  useEffect(() => {
    if (days.length && (!day || !days.some(([d]) => d === day))) setDay(days[0][0]);
  }, [days, day]);

  const dayFmt = new Intl.DateTimeFormat(locale(lang), { weekday: "short", day: "numeric", month: "short", timeZone: tz });
  const timeFmt = new Intl.DateTimeFormat(locale(lang), { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const longFmt = new Intl.DateTimeFormat(locale(lang), { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: tz });
  const daySlots = days.find(([d]) => d === day)?.[1] ?? [];

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setAttempted(true);
    setError(null);
    if (!slot) {
      setError("Pick a time first.");
      return;
    }
    if (!phoneState.valid || !phoneState.e164) {
      phoneRef.current?.focus();
      return;
    }
    setSending(true);
    try {
      const res = await createBooking({
        start: slot.start,
        phone: phoneState.e164,
        phoneCountry: phoneState.country,
        name: name.trim() || undefined,
        topic: topic.trim() || undefined,
        lang,
      });
      if (phoneState.country) rememberCountry(phoneState.country);
      setDone(res);
      // The booking exists on the server — that is the conversion.
      trackConversion("booking", { id: res.id });
    } catch (err) {
      if (err instanceof ApiError && err.code === "SLOT_TAKEN") {
        setError("That time was just taken — please pick another.");
        setSlot(null);
        load();
      } else if (err instanceof ApiError && err.code === "INVALID_PHONE") {
        setError("Please enter a valid phone number, including the country code.");
      } else {
        setError("Something went wrong sending your request.");
      }
    } finally {
      setSending(false);
    }
  }

  function downloadIcs() {
    if (!done) return;
    const text = icsFile(done, t("Call with KF Tech Solutions"), `${t("We'll call you on WhatsApp at")} ${done.phone}`);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
    a.download = "kf-tech-call.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner}>
          <Reveal>
            <nav aria-label={t("Breadcrumb")} className={s.breadcrumb}>
              <Link to="/" style={{ color: "var(--text3)" }}>{t("Home")}</Link> /{" "}
              <span style={{ color: "var(--brand-orange)" }}>{t("Book a call")}</span>
            </nav>
            <h1 className={s.pageTitle}>{t("Book a free call.")}</h1>
            <p className={s.pageLede}>
              {t("Pick a time that suits you. We'll call you on WhatsApp — 30 minutes, no obligation, and you'll leave with a clear next step.")}
            </p>
          </Reveal>

          <div className={b.grid}>
            {/* ── Time picker ─────────────────────────────────────────── */}
            <Reveal className={b.picker}>
              <div className={b.pickerHead}>
                <h2 className={b.stepTitle}>
                  <span className={b.stepNum}>1</span> {t("Choose a time")}
                </h2>
                <span className={b.tzNote}>
                  {t("Times in your time zone")}: <b dir="ltr">{tz.replace(/_/g, " ")}</b>
                </span>
              </div>

              {loadError ? (
                <div className={b.empty}>
                  <p>{t("We couldn't load the calendar right now.")}</p>
                  <button type="button" className="btn btn-outline" onClick={load}>{t("Try again")}</button>
                </div>
              ) : !data ? (
                <div className={b.skeleton} aria-busy="true" aria-label={t("Loading…")}>
                  {Array.from({ length: 8 }).map((_, i) => <span key={i} />)}
                </div>
              ) : !data.enabled || days.length === 0 ? (
                <div className={b.empty}>
                  <p>{t("No times are open right now. Message us on WhatsApp and we'll find one together.")}</p>
                  <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary" data-track="book.empty.whatsapp">{t("WhatsApp us")}</a>
                </div>
              ) : (
                <>
                  <div className={b.days} role="tablist" aria-label={t("Day")}>
                    {days.map(([d, list]) => (
                      <button
                        key={d}
                        type="button"
                        role="tab"
                        aria-selected={d === day}
                        className={`${b.day} ${d === day ? b.dayOn : ""}`}
                        onClick={() => setDay(d)}
                      >
                        <span className={b.dayName}>{dayFmt.format(new Date(list[0].start))}</span>
                        <span className={b.dayCount}>{list.length} {t("times")}</span>
                      </button>
                    ))}
                  </div>
                  <div className={b.times} role="listbox" aria-label={t("Time")}>
                    {daySlots.map((sl) => (
                      <button
                        key={sl.start}
                        type="button"
                        role="option"
                        aria-selected={slot?.start === sl.start}
                        className={`${b.time} ${slot?.start === sl.start ? b.timeOn : ""}`}
                        onClick={() => {
                          setSlot(sl);
                          setError(null);
                          // On a phone the form is below: bring it into view.
                          if (window.matchMedia("(max-width: 900px)").matches) {
                            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        }}
                      >
                        {timeFmt.format(new Date(sl.start))}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Reveal>

            {/* ── Details ─────────────────────────────────────────────── */}
            <Reveal className={c.formCard}>
              <div ref={formRef} style={{ scrollMarginTop: 96 }} />
              {done ? (
                <div role="status" className={c.successState}>
                  <span className={c.successIcon}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <h2 className={c.successTitle}>{t("You're booked!")}</h2>
                  <p className={c.successDesc}>
                    {t("We'll call you on WhatsApp at")} <b dir="ltr">{done.phone}</b>
                    <br />
                    {longFmt.format(new Date(done.start))}
                  </p>
                  <div className={b.doneActions}>
                    <button type="button" className="btn btn-outline" onClick={downloadIcs}>
                      {t("Add to calendar")}
                    </button>
                    <Link to="/" className="btn btn-primary">
                      {t("Back to home")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={submit} noValidate>
                  <h2 className={b.stepTitle}>
                    <span className={b.stepNum}>2</span> {t("Your details")}
                  </h2>
                  <div className={b.chosen} aria-live="polite">
                    {slot ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        <b>{longFmt.format(new Date(slot.start))}</b>
                      </>
                    ) : (
                      <span className={b.chosenEmpty}>{t("No time chosen yet — pick one from the calendar.")}</span>
                    )}
                  </div>

                  <div className={b.fields}>
                    <PhoneField
                      id="kf-book-phone"
                      size="lg"
                      value={phone}
                      country={country}
                      state={phoneState}
                      showError={attempted || (touched && phoneState.complete)}
                      lang={lang}
                      t={t}
                      inputRef={phoneRef}
                      onChange={(v) => {
                        setPhone(v);
                        const next = readPhone(v, country);
                        if (next.country && next.country !== country && (v.trim().startsWith("+") || v.trim().startsWith("00") || next.valid)) {
                          setCountry(next.country);
                        }
                      }}
                      onCountryChange={(cc) => {
                        setCountry(cc);
                        phoneRef.current?.focus();
                      }}
                      onBlur={() => {
                        if (phone.trim()) setTouched(true);
                        if (phoneState.valid) setPhone(phoneState.display);
                      }}
                    />
                    <label className={c.field}>
                      <span className={c.fieldLabel}>{t("Your name")}</span>
                      <input className={c.input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={t("Optional")} />
                    </label>
                    <label className={c.field}>
                      <span className={c.fieldLabel}>{t("What would you like to talk about?")}</span>
                      <textarea
                        className={`${c.input} ${c.textarea}`}
                        rows={3}
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder={t("A sentence or two about the problem you want to solve.")}
                      />
                    </label>
                  </div>

                  {error && <p className={c.formError}>{t(error)}</p>}
                  <button type="submit" disabled={sending} className={`btn btn-primary ${c.submitBtn}`}>
                    {sending ? t("Sending…") : t("Confirm booking")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
                  </button>
                  <p className={c.formNote}>{t("Free, 30 minutes, no obligation. Your number is only used to call you.")}</p>
                </form>
              )}
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
