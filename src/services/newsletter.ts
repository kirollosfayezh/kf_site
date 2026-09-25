import { apiFetch } from "./http";
import { currentVisitorId } from "./analytics";

export type NewsletterSource = "footer" | "article" | "popup";

export interface SubscribeResult {
  id: string;
  /** False when the address was already on the list. */
  created: boolean;
}

/** `POST /api/newsletter` — see kf_backend `routes/public/newsletter.routes.ts`. */
export function subscribe(input: { email: string; source: NewsletterSource; website?: string }): Promise<SubscribeResult> {
  return apiFetch<SubscribeResult>("/newsletter", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      lang: document.documentElement.lang || undefined,
      visitorId: currentVisitorId(),
    }),
  });
}
