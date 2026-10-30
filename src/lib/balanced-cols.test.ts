import { describe, expect, it } from "vitest";
import { pickCols } from "./balanced-cols";

describe("pickCols", () => {
  it("puts everything on one row when it fits, but never fewer than two across", () => {
    expect(pickCols(3, 4)).toBe(3);
    expect(pickCols(1, 4)).toBe(2);
    expect(pickCols(1, 1)).toBe(1);
  });

  it("balances the last row instead of stranding a card", () => {
    expect(pickCols(6, 4, 3)).toBe(3); // 3+3, not 4+2
    expect(pickCols(5, 4, 3)).toBe(3); // 3+2, not 4+1
  });

  it("never adds a row to tidy the last one", () => {
    expect(pickCols(8, 3, 2)).toBe(3); // 3+3+2, not four rows of two
  });

  it("keeps the maximum when the count divides evenly", () => {
    expect(pickCols(8, 4, 2)).toBe(4);
    expect(pickCols(12, 4, 3)).toBe(4);
  });
});
