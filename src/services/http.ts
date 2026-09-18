import type { ApiEnvelope, ApiErrorItem } from "./api-types";

/**
 * `VITE_API_BASE_URL` is the *origin* of the kf_backend Express server on Render
 * (e.g. https://kf-api.onrender.com). Everything REST lives under `/api`; the
 * bare origin is also what Socket.io connects to, so the two are kept separate:
 *
 *   API_ORIGIN -> https://kf-api.onrender.com          (socket.io)
 *   API_BASE   -> https://kf-api.onrender.com/api      (fetch)
 */
export const API_ORIGIN =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, "") || "";

export const API_BASE = `${API_ORIGIN}/api`;

export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: ApiErrorItem[];

  constructor(message: string, status: number, code?: string, errors?: ApiErrorItem[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      "We couldn't reach the server. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

  const text = await res.text();
  let body: unknown = null;
  let parsed = false;
  if (text) {
    try {
      body = JSON.parse(text);
      parsed = true;
    } catch {
      body = null;
    }
  }

  const envelope = body as ApiEnvelope<T> | null;
  const isEnvelope = !!envelope && typeof envelope === "object" && "success" in envelope;

  if (!res.ok || (isEnvelope && envelope!.success === false)) {
    const errors = isEnvelope ? envelope!.errors : undefined;
    const message = isEnvelope && envelope!.message ? envelope!.message : `Request failed (${res.status})`;
    const code = errors?.[0]?.code;
    throw new ApiError(message, res.status, code, errors);
  }

  // A 2xx that isn't JSON means we're pointed at something that isn't the API
  // (a dev server index.html, a proxy error page, a Render cold-start splash).
  // Treat it as a failure so callers fall back instead of rendering `null`.
  if (!parsed) {
    throw new ApiError("The server returned an unexpected response.", res.status, "BAD_RESPONSE");
  }

  return (isEnvelope ? envelope!.data : (body as T)) as T;
}
