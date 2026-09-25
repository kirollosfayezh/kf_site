import { trackConversionEvent } from "../services/analytics";
import { pixelConversion, type ConversionDetails, type ConversionKind } from "./pixels";

export type { ConversionKind };

/**
 * One call for "this actually happened": the first-party record (so the
 * dashboard's analytics and the visitor's journey show it) and the marketing
 * tags (so the ad platforms can count and optimise on it).
 *
 * Call it from the success branch of the request — after the API said yes —
 * and nowhere else. A conversion reported on a click is a conversion that
 * counts empty forms.
 */
export function trackConversion(kind: ConversionKind, details: ConversionDetails = {}): void {
  trackConversionEvent(kind);
  pixelConversion(kind, details);
}
