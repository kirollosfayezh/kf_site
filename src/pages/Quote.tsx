import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { WA_LINK } from "../components/Footer";
import { ApiError } from "../services/http";
import { acceptQuote, declineQuote, getQuote, type PublicQuote } from "../services/sales";
import q from "./Quote.module.css";

const locale = (lang: string) => (lang === "ar" ? "ar-EG" : lang);

/**
 * The client's copy of a quote, reached by its private link (`/q/<token>`).
 *
 * Opening it tells the team it was seen; the client can accept it by typing
 * their name, decline it with a reason, or print / save it as a PDF — the
 * print stylesheet leaves just the document. Not indexed, not prerendered.
 */
export function Quote() {
  const { token = "" } = useParams();
  const { t, lang } = useI18n();
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [error, setError] = useState<"notfound" | "network" | null>(null);
  const [mode, setMode] = useState<"idle" | "accept" | "decline">("idle");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    getQuote(token)
      .then(setQuote)
      .catch((err) => setError(err instanceof ApiError && err.status === 404 ? "notfound" : "network"));
  }, [token]);

  if (error) {
    return (
      <section className={q.page}>
        <div className={q.message}>
          <h1>{error === "notfound" ? t("This quote link is not valid.") : t("We couldn't load this quote right now.")}</h1>
          <p>{t("Message us on WhatsApp and we'll send it again.")}</p>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-primary">{t("WhatsApp us")}</a>
        </div>
      </section>
    );
  }
  if (!quote) {
    return (
      <section className={q.page}>
        <div className={q.doc} aria-busy="true">
          <div className={q.skeleton} />
        </div>
      </section>
    );
  }

  const money = new Intl.NumberFormat(locale(lang), { style: "currency", currency: quote.currency, maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat(locale(lang), { day: "numeric", month: "long", year: "numeric" });
  const open = quote.status === "sent" || quote.status === "viewed" || quote.status === "draft";
  const co = quote.company ?? {};

  async function submitAccept(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (name.trim().length < 2 || !agree) {
      setFormError("Type your full name and tick the box to accept.");
      return;
    }
    setBusy(true);
    try {
      setQuote(await acceptQuote(token, name.trim()));
      setMode("idle");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong sending your request.");
    } finally {
      setBusy(false);
    }
  }

  async function submitDecline(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      setQuote(await declineQuote(token, reason.trim()));
      setMode("idle");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong sending your request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={q.page}>
      <article className={q.doc}>
        <header className={q.head}>
          <div className={q.brand}>
            <img src="/logo-icon.png" alt="" width={44} height={44} />
            <div>
              <div className={q.company}>{co.companyName || "KF Tech Solutions"}</div>
              {co.address && <div className={q.muted} dir="auto">{co.address}</div>}
              <div className={q.muted} dir="ltr">{[co.email, co.phone].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          <div className={q.meta}>
            <div className={q.kind}>{t("Quote")}</div>
            <div className={q.number} dir="ltr">{quote.number}</div>
            <div className={q.muted}>{t("Issued")}: {date.format(new Date(quote.sentAt ?? quote.createdAt))}</div>
            {quote.validUntil && <div className={q.muted}>{t("Valid until")}: {date.format(new Date(quote.validUntil))}</div>}
          </div>
        </header>

        {quote.status === "accepted" && (
          <div className={`${q.banner} ${q.bannerOk}`} role="status">
            ✓ {t("Accepted by")} <b>{quote.acceptedBy}</b> — {quote.acceptedAt ? date.format(new Date(quote.acceptedAt)) : ""}. {t("Thank you! We'll be in touch to get started.")}
          </div>
        )}
        {quote.status === "declined" && (
          <div className={`${q.banner} ${q.bannerMuted}`} role="status">
            {t("You declined this quote.")} {t("If anything changes, we'd be glad to revise it.")}
          </div>
        )}
        {quote.status === "expired" && (
          <div className={`${q.banner} ${q.bannerWarn}`} role="status">
            {t("This quote has expired. Ask us for an updated one.")}{" "}
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer">{t("WhatsApp us")}</a>
          </div>
        )}

        <h1 className={q.title} dir="auto">{quote.title}</h1>

        <table className={q.table}>
          <thead>
            <tr>
              <th>{t("Description")}</th>
              <th className={q.num}>{t("Qty")}</th>
              <th className={q.num}>{t("Unit price")}</th>
              <th className={q.num}>{t("Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {quote.lineItems.map((l, i) => (
              <tr key={i}>
                <td dir="auto">{l.description}</td>
                <td className={q.num}>{l.qty.toLocaleString(locale(lang))}</td>
                <td className={q.num}>{money.format(l.unitPrice)}</td>
                <td className={q.num}>{money.format(quote.totals.lines[i] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className={q.totals}>
          <div><dt>{t("Subtotal")}</dt><dd>{money.format(quote.totals.subtotal)}</dd></div>
          {quote.totals.discount > 0 && (
            <div>
              <dt>{t("Discount")}{quote.discountType === "percent" ? ` (${quote.discountValue}%)` : ""}</dt>
              <dd>− {money.format(quote.totals.discount)}</dd>
            </div>
          )}
          {quote.taxRate > 0 && (
            <div><dt>{t("Tax")} ({quote.taxRate}%)</dt><dd>{money.format(quote.totals.tax)}</dd></div>
          )}
          <div className={q.grand}><dt>{t("Total")}</dt><dd>{money.format(quote.totals.total)}</dd></div>
        </dl>

        {quote.notes && (
          <section className={q.notes}>
            <h2>{t("Notes")}</h2>
            <p dir="auto">{quote.notes}</p>
          </section>
        )}

        {(co.footer || co.taxId) && (
          <footer className={q.foot}>
            {co.footer && <p dir="auto">{co.footer}</p>}
            {co.taxId && <p dir="ltr">{t("Tax ID")}: {co.taxId}</p>}
          </footer>
        )}
      </article>

      {/* Everything below is left out of the printed / PDF copy. */}
      <div className={q.actions}>
        {open && mode === "idle" && (
          <>
            <button type="button" className="btn btn-primary" data-track="quote.accept-open" onClick={() => setMode("accept")}>
              {t("Accept quote")}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMode("decline")}>
              {t("Decline")}
            </button>
          </>
        )}
        <button type="button" className="btn btn-outline" onClick={() => window.print()}>
          {t("Print / Save as PDF")}
        </button>
      </div>

      {open && mode === "accept" && (
        <form className={q.answer} onSubmit={submitAccept} noValidate>
          <h2>{t("Accept this quote")}</h2>
          <label>
            <span>{t("Your full name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
          </label>
          <label className={q.check}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              {t("I accept this quote for")} <b>{money.format(quote.totals.total)}</b>.
            </span>
          </label>
          {formError && <p className={q.error}>{t(formError)}</p>}
          <div className={q.row}>
            <button type="submit" className="btn btn-primary" disabled={busy} data-track="quote.accept">
              {busy ? t("Sending…") : t("Accept quote")}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMode("idle")}>{t("Cancel")}</button>
          </div>
        </form>
      )}

      {open && mode === "decline" && (
        <form className={q.answer} onSubmit={submitDecline} noValidate>
          <h2>{t("Decline this quote")}</h2>
          <label>
            <span>{t("What would need to change? (optional)")}</span>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {formError && <p className={q.error}>{t(formError)}</p>}
          <div className={q.row}>
            <button type="submit" className="btn btn-outline" disabled={busy}>
              {busy ? t("Sending…") : t("Decline quote")}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMode("idle")}>{t("Cancel")}</button>
          </div>
        </form>
      )}
    </section>
  );
}
