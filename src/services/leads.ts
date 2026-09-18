import { apiFetch } from "./http";
import type { Lead, LeadPayload } from "./api-types";

export function submitLead(payload: LeadPayload): Promise<Lead> {
  return apiFetch<Lead>("/leads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
