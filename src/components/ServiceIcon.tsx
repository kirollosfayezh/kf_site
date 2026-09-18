import type { ReactNode } from "react";

/**
 * The per-service glyphs the original Services page draws in the badge over
 * each card's photo. They are presentation, not content — the CMS carries the
 * copy, points and photo — so the paths live here, keyed by the item's slug.
 * An unknown slug falls back to a neutral code glyph rather than an empty box.
 */
const PATHS: Record<string, ReactNode> = {
  "custom-software": (
    <>
      <path d="M8 3H7a2 2 0 00-2 2v14a2 2 0 002 2h1" />
      <path d="M16 3h1a2 2 0 012 2v14a2 2 0 01-2 2h-1" />
      <path d="M9.5 9l-2 3 2 3" />
      <path d="M14.5 9l2 3-2 3" />
    </>
  ),
  "web-development": (
    <>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
      <path d="M7 6.5h.01" />
    </>
  ),
  "mobile-applications": (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  "business-systems": (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </>
  ),
  automation: (
    <>
      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
    </>
  ),
  "iot-solutions": (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M6.5 6.5l3.5 3.5M17.5 6.5l-3.5 3.5M6.5 17.5l3.5-3.5M17.5 17.5l-3.5-3.5" />
    </>
  ),
  "ai-solutions": (
    <>
      <rect x="5" y="7" width="14" height="12" rx="2" />
      <path d="M12 7V4M9 3h6M9 12h.01M15 12h.01M9 16h6" />
    </>
  ),
  "api-and-backend": (
    <>
      <path d="M8 3H7a4 4 0 00-4 4v1a4 4 0 010 8v1a4 4 0 004 4h1" />
      <path d="M16 3h1a4 4 0 014 4v1a4 4 0 000 8v1a4 4 0 01-4 4h-1" />
    </>
  ),
};

const FALLBACK = (
  <>
    <path d="M9.5 8l-3.5 4 3.5 4" />
    <path d="M14.5 8l3.5 4-3.5 4" />
  </>
);

export function ServiceIcon({ slug }: { slug: string }) {
  const gid = `kfSvcGrad-${slug || "fallback"}`;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF6A00" />
          <stop offset="1" stopColor="#FF0080" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${gid})`}>{PATHS[slug] ?? FALLBACK}</g>
    </svg>
  );
}
