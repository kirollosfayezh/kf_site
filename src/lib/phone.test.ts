import { describe, expect, it } from "vitest";
import { cleanPhoneInput, dialCode, readPhone, switchCountry } from "./phone";

describe("readPhone", () => {
  it("accepts an Egyptian mobile typed nationally and formats it as E.164", () => {
    const state = readPhone("01012345678", "EG");
    expect(state).toMatchObject({ valid: true, country: "EG", e164: "+201012345678", complete: true });
  });

  it("reads an international number typed without its plus sign", () => {
    const state = readPhone("201012345678", "DE");
    expect(state.valid).toBe(true);
    expect(state.e164).toBe("+201012345678");
    expect(state.country).toBe("EG");
  });

  it("does not flag a number that is still being typed", () => {
    expect(readPhone("0101", "EG")).toMatchObject({ valid: false, complete: false });
    expect(readPhone("", "EG")).toMatchObject({ valid: false, complete: false, display: "" });
  });
});

describe("switchCountry", () => {
  it("re-points an international number at the chosen country's code", () => {
    expect(switchCountry("+20 10 1234 5678", "SA")).toBe(`${dialCode("SA")} 1012345678`);
  });

  it("leaves a nationally typed number alone", () => {
    expect(switchCountry("010 1234 5678", "SA")).toBe("010 1234 5678");
  });
});

describe("cleanPhoneInput", () => {
  it("keeps digits and a leading plus, dropping formatting", () => {
    expect(cleanPhoneInput(" +20 (10) 1234-5678 ")).toBe("+201012345678");
  });

  it("reads a leading 00 as the international prefix", () => {
    expect(cleanPhoneInput("0020 10 1234 5678")).toBe("+201012345678");
  });

  it("normalises Arabic-Indic, Persian and full-width digits", () => {
    expect(cleanPhoneInput("٠١٠١٢٣٤٥٦٧٨")).toBe("01012345678");
    expect(cleanPhoneInput("۰۱۰")).toBe("010");
    expect(cleanPhoneInput("＋２０")).toBe("+20");
  });
});
