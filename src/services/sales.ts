import { apiFetch } from "./http";
import { currentVisitorId } from "./analytics";

/** Public booking and quote endpoints — see kf_backend `routes/public/sales.routes.ts`. */

export interface Slot {
  start: string;
  end: string;
}

export interface SlotList {
  enabled: boolean;
  timezone: string;
  slotMinutes: number;
  /** How far ahead the business takes bookings; bounds the calendar. */
  daysAhead?: number;
  slots: Slot[];
}

export function getSlots(): Promise<SlotList> {
  return apiFetch<SlotList>("/bookings/slots");
}

export interface BookingResult {
  id: string;
  start: string;
  end: string;
  phone: string;
  timezone: string;
}

export function createBooking(input: { start: string; phone: string; phoneCountry?: string; name?: string; topic?: string; lang: string }) {
  return apiFetch<BookingResult>("/bookings", {
    method: "POST",
    body: JSON.stringify({ ...input, visitorId: currentVisitorId() }),
  });
}

export interface QuoteLine {
  description: string;
  qty: number;
  unitPrice: number;
}

export interface PublicQuote {
  id: string;
  number: string;
  title: string;
  language: string;
  currency: string;
  lineItems: QuoteLine[];
  discountType: "percent" | "amount";
  discountValue: number;
  taxRate: number;
  notes?: string;
  validUntil?: string;
  status: "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired";
  sentAt?: string;
  createdAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
  declinedAt?: string;
  declineReason?: string;
  totals: { lines: number[]; subtotal: number; discount: number; taxable: number; tax: number; total: number };
  company?: {
    companyName?: string;
    address?: string;
    email?: string;
    phone?: string;
    taxId?: string;
    footer?: string;
  };
}

export function getQuote(token: string) {
  return apiFetch<PublicQuote>(`/quotes/${encodeURIComponent(token)}`);
}

export function acceptQuote(token: string, name: string) {
  return apiFetch<PublicQuote>(`/quotes/${encodeURIComponent(token)}/accept`, { method: "POST", body: JSON.stringify({ name }) });
}

export function declineQuote(token: string, reason: string) {
  return apiFetch<PublicQuote>(`/quotes/${encodeURIComponent(token)}/decline`, { method: "POST", body: JSON.stringify({ reason }) });
}
