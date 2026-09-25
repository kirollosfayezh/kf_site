import { useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import { SocialIcon } from "./SocialIcon";
import css from "./ShareBar.module.css";

/**
 * Share buttons for an article: the system share sheet where there is one
 * (phones), the four networks readers here actually use, and copy-link.
 *
 * Plain links to each network's share URL — no SDKs, no third-party scripts,
 * nothing that loads before a click. Each carries a `data-track` label so the
 * dashboard shows which network an article travels on.
 */
export function ShareBar({ url, title }: { url: string; title: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // `navigator.share` is decided after mount so server and client agree on
  // the first render.
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const enc = encodeURIComponent;
  const networks = [
    { key: "linkedin", label: t("Share on LinkedIn"), icon: "LinkedIn" as const, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { key: "x", label: t("Share on X"), icon: "X" as const, href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
    { key: "facebook", label: t("Share on Facebook"), icon: "Facebook" as const, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { key: "whatsapp", label: t("Share on WhatsApp"), icon: "WhatsApp" as const, href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
  ];

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch {
      /* the visitor closed the sheet — not an error */
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* clipboard blocked: the URL is in the address bar anyway */
    }
  }

  return (
    <div className={css.bar}>
      <span className={css.label}>{t("Share this article")}</span>
      <div className={css.buttons}>
        {canShare && (
          <button type="button" className={css.btn} onClick={share} data-track="article.share.native" aria-label={t("Share")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
            </svg>
            <span>{t("Share")}</span>
          </button>
        )}
        {networks.map((n) => (
          <a
            key={n.key}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            className={css.btn}
            aria-label={n.label}
            title={n.label}
            data-track={`article.share.${n.key}`}
          >
            <SocialIcon name={n.icon} size={16} />
          </a>
        ))}
        <button type="button" className={css.btn} onClick={copy} data-track="article.share.copy" aria-live="polite">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
          </svg>
          <span>{copied ? t("Link copied") : t("Copy link")}</span>
        </button>
      </div>
    </div>
  );
}
