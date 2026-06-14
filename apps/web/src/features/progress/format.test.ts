import { describe, it, expect } from "vitest";
import { roundKg } from "./format";

describe("roundKg", () => {
  it("rounds lb→kg float noise to one decimal", () => {
    // 26 lb * 0.45359237 = 11.79340162 → the bug the user reported
    expect(roundKg(11.793401620000001)).toBe(11.8);
  });

  it("leaves clean whole numbers unchanged", () => {
    expect(roundKg(80)).toBe(80);
  });

  it("keeps a meaningful half-kg decimal", () => {
    expect(roundKg(82.5)).toBe(82.5);
  });

  it("rounds zero to zero", () => {
    expect(roundKg(0)).toBe(0);
  });
});
