import { describe, expect, it } from "vitest";
import { getMoveDistance } from "./movement";

describe("operational movement scale", () => {
  it("slows fast units in difficult terrain without blocking slow units", () => {
    expect(getMoveDistance(1, 1)).toBe(1);
    expect(getMoveDistance(1, 2)).toBe(1);
    expect(getMoveDistance(2, 1)).toBe(2);
    expect(getMoveDistance(2, 2)).toBe(1);
  });
});
