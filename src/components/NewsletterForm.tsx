import { useId, useState, type FormEvent } from "react";
import { useI18n } from "../lib/i18n";
import { trackConversion } from "../lib/conversions";
import { subscribe, type NewsletterSource } from "../services/newsletter";
import { ApiError } from "../services/http";
import css from "./NewsletterForm.module.css";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One email field. Subscribers are stored in the dashboard's Newsletter
 * screen; nothing is sent automatically yet, so the copy promises notes, not
 * a schedule.
 *
 * The `website` field is a honeypot: off-screen (not `display: none`, which
 * bots skip), never filled by a person, and the API discards a submission
 * that has it. Cheaper than a captcha and invisible to everyone it should be.
 */
export function NewsletterForm({ source, compact = false }: { source: NewsletterSource; compact?: boolean }) {
  const { t } = useI18n();
  const id = useId();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "again" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setState("error");
      setMessage(t("Enter a valid email."));
      return;
    }
    setState("sending");
    setMessage(null);
    try {
      const res = await subscribe({ email: email.trim(), source, website });
      setState(res.created ? "done" : "again");
      setMessage(res.created ? t("You're subscribed. Thanks!") : t("You're already subscribed."));
      // Only a new address is a conversion; a repeat is not a new reader.
      if (res.created) trackConversion("newsletter");
    } catch (err) {
      setState("error");
      setMessage(
        err instanceof ApiError && (err.status === 400 || err.status === 429)
          ? err.message
          : t("Couldn't subscribe right now. Please try again."),
      );
    }
  }

  if (state === "done" || state === "again") {
    return (
      <p className={css.status} role="status">
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={`${css.form} ${compact ? css.compact : ""}`}>
      <label htmlFor={id} className="sr-only">
        {t("Your email")}
      </label>
      <div className={css.row}>
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("Your email")}
          aria-invalid={state === "error"}
          className={css.input}
        />
        <button type="submit" className="btn btn-primary" disabled={state === "sending"}>
          {state === "sending" ? t("Subscribing…") : t("Subscribe")}
        </button>
      </div>
      {/* Honeypot — see the component note. */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className={css.hp}
      />
      <p className={`${css.note} ${state === "error" ? css.error : ""}`} role={state === "error" ? "alert" : undefined}>
        {state === "error" && message ? message : t("Unsubscribe any time by emailing us.")}
      </p>
    </form>
  );
}
