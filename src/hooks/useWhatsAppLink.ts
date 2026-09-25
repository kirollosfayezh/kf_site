import { useI18n } from "../lib/i18n";
import { useContactInfo } from "../lib/settings";

/**
 * A `wa.me` link to the studio, with an opening message in the visitor's
 * language that names what they were looking at.
 *
 * The number comes from Site settings. The message used to be one English
 * sentence hardcoded next to the number, whatever the page and whatever the
 * language — an Arabic reader tapping "WhatsApp us" under a case study opened
 * a chat that began in English and mentioned nothing about the case study.
 *
 * `topic` is already translated by the caller (it is usually a page title or
 * a `t()` result); the template around it is translated here.
 */
export function useWhatsAppLink(topic?: string): string {
  const { t } = useI18n();
  const { whatsapp } = useContactInfo();
  const message = topic
    ? t("Hi KF Tech Solutions, I'm interested in {topic}.").replace("{topic}", topic)
    : t("Hi KF Tech Solutions, I'd like to discuss a software project.");
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}
