import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { pick } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import { BalancedGrid } from "../components/BalancedGrid";
import { Img } from "../components/Img";
import { WA_LINK } from "../components/Footer";
import { submitLead } from "../services/leads";
import { ApiError } from "../services/http";
import s from "../styles/sections.module.css";
import c from "./Contact.module.css";

const PROJECT_TYPES = ["Custom software", "Website / web app", "Mobile application", "Business system / POS", "Automation / AI", "Other"];

const U = "?w=900&q=80&auto=format&fit=crop";

const OFFERS = [
  { title: "POS & retail systems", desc: "Orders, stock, staff and reporting in one connected system built for your floor.", from: "FROM 3 WEEKS", img: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d" + U, alt: "Payment terminal on a counter" },
  { title: "Websites & web apps", desc: "Fast, responsive platforms that turn traffic into enquiries.", from: "FROM 2 WEEKS", img: "https://images.unsplash.com/photo-1542744094-3a31f272c490" + U, alt: "Developer building web interface components" },
  { title: "Business dashboards", desc: "One screen that shows what is actually happening across the business.", from: "FROM 3 WEEKS", img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71" + U, alt: "Analytics dashboard on a monitor" },
  { title: "Automation & integrations", desc: "Connect the tools you already use and remove the manual steps between them.", from: "FROM 1 WEEK", img: "https://images.unsplash.com/photo-1647427060118-4911c9821b82" + U, alt: "Robotic arms on an automated production line" },
];

const STEPS = [
  { n: "01", title: "Tell us what you need", desc: "A short form or a WhatsApp message is enough to start." },
  { n: "02", title: "Get a fixed quote", desc: "Clear scope and price before anything is built." },
  { n: "03", title: "See a working demo", desc: "You review a real, working version before committing." },
  { n: "04", title: "Launch & support", desc: "We deploy it and stay on for support after launch." },
];

const FAQS = [
  { q: "How fast do you reply?", a: "Within one business day, usually much sooner." },
  { q: "Is the quote really fixed?", a: "Yes — once we agree scope, the price does not move unless the scope does." },
  { q: "Do I need to know exactly what I want?", a: "No. A rough idea of the problem is enough to start the conversation." },
];

const QUOTES = [
  { q: "Our POS finally matches how we actually work.", n: "Mina Adel", r: "Owner, Café Delight", i: "MA" },
  { q: "Reporting that used to take a day now takes a minute.", n: "Ahmed Farouk", r: "Director, Farouk Retail", i: "AF" },
  { q: "Delivered on time and communicated clearly throughout.", n: "Sarah Hoffmann", r: "PM, Bauwerk GmbH", i: "SH" },
];

interface FormState {
  name: string;
  email: string;
  phone: string;
  type: string;
  message: string;
}
const EMPTY: FormState = { name: "", email: "", phone: "", type: "", message: "" };

export function Campaign() {
  const { t, lang } = useI18n();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const offers = useContentList("services");

  function onField<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || !form.message.trim()) {
      setErr("Please add your name, a valid email and a short message.");
      return;
    }
    setErr(null);
    setSending(true);
    try {
      await submitLead({
        source: "campaign",
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        projectType: form.type || undefined,
        message: form.message,
      });
      setSent(true);
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : "Something went wrong sending your request.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <section className={s.pageHero} id="quote">
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={`${s.pageHeroInner} ${c.grid}`}>
          <Reveal>
            <span className={s.eyebrow}>{t("ACCEPTING NEW PROJECTS")}</span>
            <h1 className={`${s.pageTitle} ${s.pageTitleCampaign}`}>{t("Custom software, built to fit how your business actually works.")}</h1>
            <p className={s.pageLede}>
              {t("POS systems, dashboards, web platforms and automation. Fixed scope, clear pricing, and a working demo before you commit.")}
            </p>
          </Reveal>

          <Reveal as="form" onSubmit={onSubmit} className={c.formCard}>
            {sent ? (
              <div role="status" className={c.successState}>
                <span className={c.successIcon}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                <h2 className={c.successTitle}>{t("Request received")}</h2>
                <p className={c.successDesc}>{t("Thanks — we will reply within one business day. For anything urgent, message us on WhatsApp.")}</p>
                <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ marginTop: 20 }}>
                  {t("Open WhatsApp")}
                </a>
              </div>
            ) : (
              <>
                <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-section)" }}>{t("Get a free quote")}</h2>
                <p style={{ marginTop: 8, color: "var(--text2)", fontSize: "var(--fs-ui)" }}>{t("Tell us what you need. We reply within one business day — no obligation.")}</p>
                <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
                  <label className={c.field}>
                    <span className={c.fieldLabel}>{t("Your name")}</span>
                    <input className={c.input} value={form.name} onChange={(e) => onField("name", e.target.value)} placeholder={t("Full name")} />
                  </label>
                  <label className={c.field}>
                    <span className={c.fieldLabel}>{t("Email")}</span>
                    <input className={c.input} type="email" value={form.email} onChange={(e) => onField("email", e.target.value)} placeholder="you@company.com" />
                  </label>
                  <label className={c.field}>
                    <span className={c.fieldLabel}>{t("Phone / WhatsApp")}</span>
                    <input className={c.input} value={form.phone} onChange={(e) => onField("phone", e.target.value)} placeholder="+20 ..." />
                  </label>
                  <label className={c.field}>
                    <span className={c.fieldLabel}>{t("What do you need?")}</span>
                    <select className={c.input} value={form.type} onChange={(e) => onField("type", e.target.value)}>
                      <option value="">{t("Select...")}</option>
                      {PROJECT_TYPES.map((p) => (
                        <option key={p} value={p}>{t(p)}</option>
                      ))}
                    </select>
                  </label>
                  <label className={c.field}>
                    <span className={c.fieldLabel}>{t("Project details")}</span>
                    <textarea
                      className={`${c.input} ${c.textarea}`}
                      rows={3}
                      value={form.message}
                      onChange={(e) => onField("message", e.target.value)}
                      placeholder={t("A sentence or two about the problem you want to solve.")}
                    />
                  </label>
                </div>
                {err && <div className={c.formError}>{t(err)}</div>}
                <button type="submit" disabled={sending} data-track="campaign.submit" className={`btn btn-primary ${c.submitBtn}`}>
                  {sending ? t("Sending…") : t("Send my request")}
                </button>
                <div className={c.formNote}>{t("No spam. Your details are only used to reply to this enquiry.")}</div>
              </>
            )}
          </Reveal>
        </div>
      </section>

      <section className={s.section}>
        <Reveal className={s.headCenter}>
          <h2 className={s.h2sm}>{t("What we build most")}</h2>
        </Reveal>
        <BalancedGrid preset="cards">
          {(offers.data && offers.data.length > 0
            ? offers.data.slice(0, 4).map((o, i) => ({
                key: o.id,
                title: pick(o.title, lang),
                desc: pick(o.summary, lang),
                img: o.media?.[0] ?? OFFERS[i % OFFERS.length].img,
                alt: pick(o.title, lang),
                from: OFFERS[i % OFFERS.length].from,
              }))
            : OFFERS.map((o) => ({ key: o.title, title: t(o.title), desc: t(o.desc), img: o.img, alt: t(o.alt), from: o.from }))
          ).map((o) => (
            <Reveal key={o.key} className={s.card}>
              <div className={s.cardMedia}>
                <Img src={o.img} alt={o.alt} width={420} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px" />
                <div className={s.cardMediaScrim} aria-hidden="true" />
              </div>
              <div className={s.cardBody}>
                <h3 className={s.cardTitle} style={{ fontSize: "var(--fs-lead)" }}>{o.title}</h3>
                <p className={s.cardDesc}>{o.desc}</p>
                <div className={s.cardFrom}>{t(o.from)}</div>
              </div>
            </Reveal>
          ))}
        </BalancedGrid>
      </section>

      <section className={s.sectionAlt}>
        <div className={s.section}>
          <Reveal className={s.headCenter}>
            <h2 className={s.h2sm}>{t("How it works")}</h2>
          </Reveal>
          <BalancedGrid preset="steps">
            {STEPS.map((st) => (
              <Reveal key={st.n}>
                <div className={s.stepBar} />
                <div className={s.stepNum}>{st.n}</div>
                <h3 className={s.stepTitle}>{t(st.title)}</h3>
                <p className={s.stepDesc}>{t(st.desc)}</p>
              </Reveal>
            ))}
          </BalancedGrid>
        </div>
      </section>

      {/* Short client quotes — static in the original export. */}
      <section className={s.section} style={{ paddingTop: 0 }}>
        <div className={s.quoteGrid} style={{ marginTop: 0 }}>
          {QUOTES.map((q) => (
            <Reveal key={q.n} className={s.quoteCard}>
              <p className={s.quoteText}>&ldquo;{t(q.q)}&rdquo;</p>
              <div className={s.quoteWho}>
                <span className={s.quoteAvatar} aria-hidden="true">{q.i}</span>
                <span>
                  <span className={s.quoteName} style={{ display: "block" }}>{q.n}</span>
                  <span className={s.quoteRole}>{t(q.r)}</span>
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={s.sectionNarrow}>
        <Reveal className={s.headCenter}>
          <h2 className={s.h2sm}>{t("Common questions")}</h2>
        </Reveal>
        <div className={s.faqList}>
          {FAQS.map((f) => (
            <div key={f.q} className={s.faqItem}>
              <div className={s.faqQ} style={{ cursor: "default" }}>{t(f.q)}</div>
              <p className={s.faqA}>{t(f.a)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA band from the original export. */}
      <section className={s.ctaPanelWrap}>
        <Reveal className={s.ctaPanel}>
          <div className={s.ctaPanelGlow} aria-hidden="true" />
          <div className={s.ctaPanelInner}>
            <h2 className={s.ctaPanelTitle}>{t("Tell us what you need built.")}</h2>
            <p className={s.ctaPanelLede}>
              {t("A free scoping call, a fixed quote, and a working demo before you commit to the full build.")}
            </p>
            <div className={s.ctaPanelActions}>
              <a href="#quote" className="btn btn-primary">
                {t("Get a free quote")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
              </a>
              <Link to="/book" data-track="campaign.book-call" className="btn btn-outline">
                {t("Book a call")}
              </Link>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                {t("WhatsApp us")}
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
