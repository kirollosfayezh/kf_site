import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useFaqSchema } from "../components/Seo";
import { pick } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import { useContactInfo } from "../lib/settings";
import { useWhatsAppLink } from "../hooks/useWhatsAppLink";
import { trackConversion } from "../lib/conversions";
import { submitLead } from "../services/leads";
import { ApiError } from "../services/http";
import s from "../styles/sections.module.css";
import c from "./Contact.module.css";

const PROJECT_TYPES = ["Custom software", "Website / web app", "Mobile application", "Business system / POS", "Automation / AI", "Other"];
const BUDGETS = ["Under $2k", "$2k – $5k", "$5k – $15k", "$15k+", "Not sure yet"];

const FALLBACK_FAQS = [
  { q: "How much does custom software development cost?", a: "It depends on scope and complexity. After a short discovery call we give you a clear, itemized estimate — no vague packages. Small projects start low; larger systems are quoted per feature set." },
  { q: "How long does it take to build a website?", a: "A focused marketing website typically takes 2–4 weeks. Web applications and custom systems run longer depending on features. We share a realistic timeline before we start." },
  { q: "Do you build software for businesses in Egypt?", a: "Yes. We are based in Cairo and work with businesses across Egypt and internationally, both remotely and on-site where needed." },
  { q: "Can you build a custom POS system?", a: "Absolutely. POS, inventory, kitchen displays and management dashboards are a core specialty — built around how your business actually operates." },
  { q: "Do you develop mobile applications?", a: "Yes — modern cross-platform apps for iOS and Android, connected to secure backends and real-time data." },
  { q: "Can you maintain an existing website or software?", a: "Yes. We can audit, fix, extend and maintain existing projects, or take over a codebase from a previous team." },
  { q: "Can you integrate APIs and payment gateways?", a: "Yes. We integrate payment gateways, third-party APIs, messaging, maps and analytics as part of most projects." },
  { q: "Do you provide hosting and deployment?", a: "Yes. We handle deployment, hosting setup and monitoring, and can manage everything for you after launch." },
];

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  ptype: string;
  budget: string;
  message: string;
}

const EMPTY: FormState = { name: "", company: "", email: "", phone: "", ptype: "", budget: "", message: "" };

export function Contact() {
  const { t, lang } = useI18n();
  const { phone, email } = useContactInfo();
  const waLink = useWhatsAppLink();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState(-1);

  const faqs = useContentList("faqs");
  const faqItems = useMemo(
    () =>
      faqs.data && faqs.data.length > 0
        ? faqs.data.map((f) => ({ q: pick(f.title, lang), a: pick(f.body ?? f.summary, lang) }))
        : FALLBACK_FAQS.map((f) => ({ q: t(f.q), a: t(f.a) })),
    [faqs.data, lang, t],
  );
  useFaqSchema(faqItems);

  function onField<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: false }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors: Partial<Record<keyof FormState, boolean>> = {};
    if (!form.name.trim()) nextErrors.name = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = true;
    if (!form.message.trim()) nextErrors.message = true;
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitLead({
        source: "contact",
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        company: form.company || undefined,
        projectType: form.ptype || undefined,
        budget: form.budget || undefined,
        message: form.message,
      });
      setSubmitted(true);
      // Reported here, after the API accepted it — not on the button.
      trackConversion("lead");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong sending your request.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={`${s.pageHeroInner} ${c.grid}`}>
          <Reveal>
            <nav aria-label={t("Breadcrumb")} className={s.breadcrumb}>
              <Link to="/" style={{ color: "var(--text3)" }}>{t("Home")}</Link> / <span style={{ color: "var(--brand-orange)" }}>{t("Contact")}</span>
            </nav>
            <h1 className={s.pageTitle}>{t("Tell us about your project.")}</h1>
            <p className={s.pageLede}>{t("Share a few details and we'll get back to you with next steps — usually within one business day. Prefer to talk now? Reach us directly.")}</p>

            <div className={c.contactCards}>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className={c.contactCard} data-track="contact.whatsapp">
                <span className={c.contactIcon} style={{ background: "rgba(37,211,102,.14)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
                    <path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4.1.2.1.9-.1 1.5z" />
                  </svg>
                </span>
                <span>
                  <span className={c.contactLabel}>{t("WhatsApp")}</span>
                  <span className={c.contactValue} dir="ltr">{phone}</span>
                </span>
              </a>
              <Link to="/book" data-track="contact.book-call" className={c.contactCard}>
                <span className={c.contactIcon} style={{ background: "rgba(155,93,229,.14)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9B5DE5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
                  </svg>
                </span>
                <span>
                  <span className={c.contactLabel}>{t("Book a call")}</span>
                  <span className={c.contactValue}>{t("Pick a time — we call you on WhatsApp")}</span>
                </span>
              </Link>
              <a href={`mailto:${email}`} className={c.contactCard} data-track="contact.email">
                <span className={c.contactIcon} style={{ background: "rgba(255,106,0,.1)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                </span>
                <span>
                  <span className={c.contactLabel}>{t("Email")}</span>
                  <span className={c.contactValue} dir="ltr">{email}</span>
                </span>
              </a>
              <div className={c.contactCard}>
                <span className={c.contactIcon} style={{ background: "rgba(255,0,128,.1)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <span>
                  <span className={c.contactLabel}>{t("Based in")}</span>
                  <span className={c.contactValue}>{t("Cairo, Egypt · working worldwide")}</span>
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal as="form" onSubmit={onSubmit} noValidate className={c.formCard}>
            {submitted ? (
              <div role="status" className={c.successState}>
                <span className={c.successIcon}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                <h2 className={c.successTitle}>{t("Request sent")}</h2>
                <p className={c.successDesc}>{t("Thanks for reaching out. We'll review your project and get back to you shortly.")}</p>
              </div>
            ) : (
              <>
                <div className={c.fieldsGrid}>
                  <label className={c.field}>
                    <span className={c.fieldLabel}>{t("Name *")}</span>
                    <input
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={(e) => onField("name", e.target.value)}
                      aria-invalid={!!errors.name}
                      placeholder={t("Your name")}
                      className={`${c.input} ${errors.name ? c.inputInvalid : ""}`}
                    />
                    {errors.name && <span className={c.errorText}>{t("Please enter your name.")}</span>}
                  </label>
                  <label className={c.field}>
                    <span className={c.fieldLabel}>{t("Company")}</span>
                    <input
                      name="company"
                      type="text"
                      value={form.company}
                      onChange={(e) => onField("company", e.target.value)}
                      placeholder={t("Optional")}
                      className={c.input}
                    />
                  </label>
                  <label className={c.field}>
                    <span className={c.fieldLabel}>{t("Email *")}</span>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => onField("email", e.target.value)}
                      aria-invalid={!!errors.email}
                      placeholder="you@company.com"
                      className={`${c.input} ${errors.email ? c.inputInvalid : ""}`}
                    />
                    {errors.email && <span className={c.errorText}>{t("Enter a valid email.")}</span>}
                  </label>
                  <label className={c.field}>
                    <span className={c.fieldLabel}>{t("Phone / WhatsApp")}</span>
                    <input
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => onField("phone", e.target.value)}
                      placeholder="+20 ..."
                      className={c.input}
                    />
                  </label>
                  <label className={c.field}>
                    <span className={c.fieldLabel}>{t("Project type")}</span>
                    <select name="ptype" value={form.ptype} onChange={(e) => onField("ptype", e.target.value)} className={c.input}>
                      <option value="">{t("Select...")}</option>
                      {PROJECT_TYPES.map((p) => (
                        <option key={p} value={p}>{t(p)}</option>
                      ))}
                    </select>
                  </label>
                  <label className={c.field}>
                    <span className={c.fieldLabel}>{t("Budget range")}</span>
                    <select name="budget" value={form.budget} onChange={(e) => onField("budget", e.target.value)} className={c.input}>
                      <option value="">{t("Select...")}</option>
                      {BUDGETS.map((b) => (
                        <option key={b} value={b}>{t(b)}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className={c.field} style={{ marginTop: 16 }}>
                  <span className={c.fieldLabel}>{t("Project description *")}</span>
                  <textarea
                    name="message"
                    rows={4}
                    value={form.message}
                    onChange={(e) => onField("message", e.target.value)}
                    aria-invalid={!!errors.message}
                    placeholder={t("What are you trying to build?")}
                    className={`${c.input} ${c.textarea} ${errors.message ? c.inputInvalid : ""}`}
                  />
                  {errors.message && <span className={c.errorText}>{t("Tell us a little about your project.")}</span>}
                </label>

                <button type="submit" disabled={submitting} className={`btn btn-primary ${c.submitBtn}`}>
                  {submitting ? t("Sending…") : t("Send Project Request")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
                </button>
                {submitError && <p className={c.formError}>{t(submitError)}</p>}
                <p className={c.formNote}>{t("We'll never share your details. Typical reply within one business day.")}</p>
              </>
            )}
          </Reveal>
        </div>
      </section>

      <section className={s.sectionNarrow}>
        <Reveal className={s.headCenter}>
          <span className={s.eyebrow}>{t("// FAQ")}</span>
          <h2 className={s.h2sm}>{t("Common questions.")}</h2>
        </Reveal>
        <div className={s.faqList}>
          {faqItems.map((f, i) => (
            <Reveal key={f.q} className={s.faqItem}>
              {/* Answers stay in the DOM (hidden) so a crawler reads them;
                  the schema is built from the same list — see Home.tsx. */}
              <button
                type="button"
                className={s.faqQ}
                aria-expanded={openFaq === i}
                aria-controls={`faq-${i}`}
                onClick={() => setOpenFaq((cur) => (cur === i ? -1 : i))}
              >
                <span>{f.q}</span>
                <span className={`${s.faqChevron} ${openFaq === i ? s.faqChevronOpen : ""}`} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              <p id={`faq-${i}`} className={s.faqA} hidden={openFaq !== i}>{f.a}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
