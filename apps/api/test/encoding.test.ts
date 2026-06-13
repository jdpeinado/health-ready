import { describe, it, expect } from "vitest";
import { toHex, fromHex, timingSafeEqual } from "../src/lib/encoding.js";

describe("encoding", () => {
  it("round-trips bytes through hex", () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(toHex(bytes)).toBe("00010f10ff");
    expect(Array.from(fromHex("00010f10ff"))).toEqual([0, 1, 15, 16, 255]);
  });

  it("compares equal strings as true and different as false", () => {
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
