import { useMemo, type RefObject } from "react";
import { countryOptions, dialCode, flagOf, type PhoneState } from "../lib/phone";
import type { CountryCode } from "libphonenumber-js/max";
import styles from "./PhoneField.module.css";

const TYPE_LABEL: Record<string, string> = {
  MOBILE: "Mobile number",
  FIXED_LINE: "Landline",
  FIXED_LINE_OR_MOBILE: "Mobile number",
  VOIP: "Internet number",
  TOLL_FREE: "Toll-free",
};

/**
 * Country picker + number, as one control.
 *
 * The country is picked for the visitor — from their time zone, and from the
 * number itself the moment it starts with a country code — so most people just
 * type. The native `<select>` sits invisibly over the flag button: every phone
 * then shows its own searchable picker, and screen readers get a real control.
 *
 * Shared by the chat widget and the booking page; `size="lg"` matches the
 * site's full-page forms.
 */
export function PhoneField({
  id,
  value,
  country,
  state,
  showError,
  lang,
  t,
  inputRef,
  onChange,
  onCountryChange,
  onBlur,
  onEnter,
  size = "sm",
}: {
  id: string;
  value: string;
  country: CountryCode;
  state: PhoneState;
  showError: boolean;
  lang: string;
  t: (key: string) => string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onCountryChange: (country: CountryCode) => void;
  onBlur?: () => void;
  onEnter?: () => void;
  size?: "sm" | "lg";
}) {
  const options = useMemo(() => countryOptions(lang), [lang]);
  const shown = state.country ?? country;
  const name = options.find((o) => o.code === shown)?.name ?? shown;
  const invalid = showError && !state.valid;

  let hint: React.ReactNode;
  if (state.valid) {
    hint = (
      <span className={styles.phoneOk}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {name}
        {state.type && TYPE_LABEL[state.type] ? ` · ${t(TYPE_LABEL[state.type])}` : ""}
      </span>
    );
  } else if (invalid) {
    hint = (
      <span className={styles.phoneBad}>
        {value.trim()
          ? t("That doesn't look like a valid number for {country}.").replace("{country}", name)
          : t("Please enter your phone number.")}
      </span>
    );
  } else {
    hint = t("So we can follow up — and find this chat for you next time.");
  }

  return (
    <div className={`${styles.fld} ${size === "lg" ? styles.lg : ""}`}>
      <label htmlFor={id}>
        <span>
          {t("Phone / WhatsApp")} <b className={styles.req} aria-hidden="true">*</b>
        </span>
      </label>
      <div className={`${styles.phoneRow} ${invalid ? styles.phoneRowBad : ""} ${state.valid ? styles.phoneRowOk : ""}`}>
        <div className={styles.countryPick}>
          <span className={styles.countryFlag} aria-hidden="true">
            {flagOf(shown)}
          </span>
          <span className={styles.countryDial} aria-hidden="true">
            {dialCode(shown)}
          </span>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
          <select
            aria-label={t("Country")}
            value={shown}
            onChange={(e) => onCountryChange(e.target.value as CountryCode)}
          >
            {options.map((o) => (
              <option key={o.code} value={o.code}>
                {flagOf(o.code)} {o.name} ({o.dial})
              </option>
            ))}
          </select>
        </div>
        <input
          id={id}
          ref={inputRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          required
          aria-required="true"
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-hint`}
          value={value}
          placeholder={dialCode(shown) + " …"}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter?.();
            }
          }}
        />
      </div>
      <div id={`${id}-hint`} className={styles.phoneHint} aria-live="polite">
        {hint}
      </div>
    </div>
  );
}
