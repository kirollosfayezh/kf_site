import type { Lang } from "../lib/langs";

/**
 * Flags for the language switcher, drawn as inline SVG.
 *
 * Not emoji: `🇬🇧` and friends are regional-indicator pairs that Windows has no
 * glyphs for, so on the single most common desktop platform they render as two
 * grey letter boxes — worse than the text they replaced. These are a few paths
 * each, scale cleanly, and look identical everywhere.
 *
 * Deliberately simplified (Egypt without its eagle, a reduced Union Jack): at
 * 20×14 the detail is sub-pixel noise, and the shapes stay recognisable.
 *
 * The black bands are #2A2A2A rather than true black: against the dropdown's
 * #111116 panel a pure-black band vanishes, and Egypt's flag read as two stripes
 * instead of three. It still reads unmistakably as the black band in context.
 *
 * Arabic is represented by Egypt rather than a pan-Arab flag because the studio
 * is in Cairo and that is the audience the Arabic copy is written for.
 */
const FLAGS: Record<Lang, { title: string; paths: React.ReactNode }> = {
  en: {
    title: "English",
    paths: (
      <>
        <rect width="20" height="14" fill="#012169" />
        <path d="M0 0 20 14M20 0 0 14" stroke="#fff" strokeWidth="2.8" />
        <path d="M0 0 20 14M20 0 0 14" stroke="#C8102E" strokeWidth="1.4" />
        <path d="M10 0V14M0 7H20" stroke="#fff" strokeWidth="4.4" />
        <path d="M10 0V14M0 7H20" stroke="#C8102E" strokeWidth="2.6" />
      </>
    ),
  },
  ar: {
    title: "العربية",
    paths: (
      <>
        <rect width="20" height="14" fill="#fff" />
        <rect width="20" height="4.667" fill="#CE1126" />
        <rect y="9.333" width="20" height="4.667" fill="#2A2A2A" />
      </>
    ),
  },
  de: {
    title: "Deutsch",
    paths: (
      <>
        <rect width="20" height="14" fill="#DD0000" />
        <rect width="20" height="4.667" fill="#2A2A2A" />
        <rect y="9.333" width="20" height="4.667" fill="#FFCE00" />
      </>
    ),
  },
  fr: {
    title: "Français",
    paths: (
      <>
        <rect width="20" height="14" fill="#fff" />
        <rect width="6.667" height="14" fill="#0055A4" />
        <rect x="13.333" width="6.667" height="14" fill="#EF4135" />
      </>
    ),
  },
};

/**
 * `aria-hidden` by default: the flag is decoration beside a real language name,
 * and a flag is a country, not a language — a screen reader announcing "United
 * Kingdom" for "English" is worse than silence. Pass `labelled` where the flag
 * stands alone and needs to carry the meaning itself.
 */
export function FlagIcon({
  lang,
  size = 20,
  labelled = false,
  className,
}: {
  lang: Lang;
  size?: number;
  labelled?: boolean;
  className?: string;
}) {
  const flag = FLAGS[lang];
  const id = `flag-clip-${lang}`;
  return (
    <svg
      width={size}
      height={(size * 14) / 20}
      viewBox="0 0 20 14"
      className={className}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? flag.title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <clipPath id={id}>
          <rect width="20" height="14" rx="2.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>{flag.paths}</g>
      {/* A hairline keeps the white in the French and Egyptian flags from
          bleeding into a light surface, and softens the edge on a dark one. */}
      <rect
        width="20"
        height="14"
        rx="2.5"
        fill="none"
        stroke="rgba(255,255,255,.28)"
        strokeWidth="1"
      />
    </svg>
  );
}
