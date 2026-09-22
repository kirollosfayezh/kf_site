/** Mirrors kf_backend/functions/src/shared/http/api-response.ts and shared/types.ts */

export interface ApiErrorItem {
  code: string;
  message: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  errors: ApiErrorItem[];
  message: string | null;
}

export type LeadSource = "contact" | "campaign";
export type LeadStatus = "new" | "contacted" | "won" | "lost";

export interface LeadPayload {
  source: LeadSource;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  projectType?: string;
  budget?: string;
  message: string;
}

export interface Lead extends LeadPayload {
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LocalizedText {
  en: string;
  ar: string;
  /** Optional so existing documents, which predate these two, still type. */
  de?: string;
  fr?: string;
}

export interface ContentItem {
  id: string;
  slug: string;
  published: boolean;
  order: number;
  title: LocalizedText;
  summary?: LocalizedText;
  body?: LocalizedText;
  media?: string[];
  meta?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ContentCollection =
  | "projects"
  | "services"
  | "solutions"
  | "testimonials"
  | "faqs"
  | "blogPosts"
  | "aboutSections";

export interface SiteSettings {
  siteName: string;
  tagline: LocalizedText;
  logoUrl?: string;
  brandColors: string[];
  languages: { code: string; label: string; enabled: boolean }[];
  defaultLanguage: string;
  seo: { defaultTitle: string; defaultDescription: string };
  pixels: { googleAnalyticsId?: string; metaPixelId?: string };
  contact: { email?: string; phone?: string; whatsapp?: string };
  updatedAt: string;
}
