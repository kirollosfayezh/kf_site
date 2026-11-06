/** Types for `audit.mjs`, so `audit.test.ts` compiles under `module: nodenext`. */

export const BRAND: string;
export const BRAND_RE: RegExp;
export const FOUNDER: string;
export const FOUNDED: string;
export const NOT_AFFILIATED_HOST: string;
export const OFFICIAL_HOST: string;
export const ARABIC_ALIAS: string;
export const OG_LOCALE: Record<"en" | "ar" | "de" | "fr", string>;
export const ENTITY_PAGES: string[];

export interface Finding {
  check: string;
  /** The page path (`/ar/about`, `/404.html`) or the file (`/robots.txt`). */
  path: string;
  detail: string;
}

export interface AuditStats {
  pages: number;
  files: number;
  /** Every check that ran, failing or not, in run order. */
  checks: string[];
  ms: number;
}

export interface AuditResult {
  failures: Finding[];
  warnings: Finding[];
  stats: AuditStats;
}

/** The parts of `vercel.json` the link check reads. */
export interface VercelConfig {
  rewrites?: { source: string; destination: string }[];
  redirects?: {
    source: string;
    destination: string;
    has?: { type: string; key?: string; value?: string }[];
  }[];
}

export interface AuditOptions {
  /** `https://kftechsolutions.dev`; without it the host-dependent checks are skipped with one warning. */
  origin?: string | null;
  vercelConfig?: VercelConfig | null;
  /** `YYYY-MM-DD`, for the sitemap's "not every lastmod is today" check; defaults to the UTC date. */
  today?: string;
}

export function auditDist(distDir: string, options?: AuditOptions): Promise<AuditResult>;
