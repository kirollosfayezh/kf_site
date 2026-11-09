import { describe, expect, it } from "vitest";
import { fitTitle } from "./text.ts";

describe("fitTitle", () => {
  it("leaves a title that fits alone", () => {
    expect(fitTitle("IoT Solutions & Development in Egypt | KF Tech Solutions")).toBe("IoT Solutions & Development in Egypt | KF Tech Solutions");
  });
  it("drops the brand first", () => {
    expect(fitTitle("Fleet tracking and management systems in Egypt | KF Tech Solutions")).toBe("Fleet tracking and management systems in Egypt");
  });
  it("drops a case study's trailing label", () => {
    expect(fitTitle("Lumina Dental: Praxiswebsite mit Online-Terminbuchung — Website für Zahnarztpraxis")).toBe("Lumina Dental: Praxiswebsite mit Online-Terminbuchung");
  });
  it("keeps the part before the colon", () => {
    expect(fitTitle("Nearshoring software development to Egypt: what European buyers should check first")).toBe("Nearshoring software development to Egypt");
    // Too little before the colon ("Lumina Dental") to stand alone: left whole.
    expect(fitTitle("Lumina Dental : site de cabinet dentaire avec prise de rendez-vous en ligne — Site de cabinet dentaire")).toBe("Lumina Dental : site de cabinet dentaire avec prise de rendez-vous en ligne");
  });
  it("never cuts a headline with no break in it", () => {
    const long = "A very long headline without any separator that goes on and on past the limit";
    expect(fitTitle(long)).toBe(long);
  });
});
