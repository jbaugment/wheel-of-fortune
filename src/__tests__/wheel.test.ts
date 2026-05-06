import { describe, expect, it } from "vitest";
import { pickWedge } from "../game";
import type { Wedge } from "../config";

/** Mulberry32 — small seeded PRNG, plenty good for statistical tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const equalWedges: Wedge[] = [
  { label: "A", color: "#000" },
  { label: "B", color: "#000" },
  { label: "C", color: "#000" },
  { label: "D", color: "#000" },
];

const weightedWedges: Wedge[] = [
  { label: "Common", color: "#000", weight: 8 },
  { label: "Rare", color: "#000", weight: 1 },
  { label: "Legendary", color: "#000", weight: 1 },
];

describe("pickWedge", () => {
  it("throws on empty wedge list", () => {
    expect(() => pickWedge([], Math.random)).toThrow();
  });

  it("throws when total weight is zero", () => {
    expect(() =>
      pickWedge([{ label: "x", color: "#000", weight: 0 }], () => 0.5),
    ).toThrow();
  });

  it("uses cumulative weight slicing for deterministic selection", () => {
    // 4 equal wedges: each slice is 0.25 wide.
    expect(pickWedge(equalWedges, () => 0.0).label).toBe("A");
    expect(pickWedge(equalWedges, () => 0.24).label).toBe("A");
    expect(pickWedge(equalWedges, () => 0.25).label).toBe("B");
    expect(pickWedge(equalWedges, () => 0.74).label).toBe("C");
    expect(pickWedge(equalWedges, () => 0.99).label).toBe("D");
  });

  it("respects weights statistically over many trials", () => {
    const rng = mulberry32(1234);
    const counts = new Map<string, number>();
    const trials = 20000;
    for (let i = 0; i < trials; i++) {
      const w = pickWedge(weightedWedges, rng);
      counts.set(w.label, (counts.get(w.label) ?? 0) + 1);
    }
    // Expected proportions: Common ~0.8, Rare ~0.1, Legendary ~0.1.
    const common = (counts.get("Common") ?? 0) / trials;
    const rare = (counts.get("Rare") ?? 0) / trials;
    const legendary = (counts.get("Legendary") ?? 0) / trials;
    expect(common).toBeGreaterThan(0.77);
    expect(common).toBeLessThan(0.83);
    expect(rare).toBeGreaterThan(0.07);
    expect(rare).toBeLessThan(0.13);
    expect(legendary).toBeGreaterThan(0.07);
    expect(legendary).toBeLessThan(0.13);
  });
});
