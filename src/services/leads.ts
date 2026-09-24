import { apiFetch } from "./http";
import { currentVisitorId } from "./analytics";
import type { Lead, LeadPayload } from "./api-types";

export function submitLead(payload: LeadPayload): Promise<Lead> {
  return apiFetch<Lead>("/leads", {
    method: "POST",
    body: JSON.stringify({ ...payload, visitorId: payload.visitorId ?? currentVisitorId() }),
  });
}
