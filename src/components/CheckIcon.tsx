/**
 * The gradient tick used throughout the original export. The static pages
 * stroke it with `url(#kfg)`, a page-level gradient def; here each icon carries
 * its own def with a unique id so it works wherever it is mounted.
 */
export function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="kfCheckGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--brand-orange)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-pink)" }} />
        </linearGradient>
      </defs>
      <path d="M20 6L9 17l-5-5" stroke="url(#kfCheckGrad)" />
    </svg>
  );
}
