import { describe, expect, it } from "vitest";
import {
  pickWedge,
  pickWedgeWithCooldown,
  type CooldownStorage,
} from "../game";
import {
  SWITCH_COOLDOWN_MS,
  SWITCH_LABEL,
  SWITCH_LAST_WIN_KEY,
  WEDGES,
  type Wedge,
} from "../config";

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

/** In-memory storage stand-in for tests. */
function memoryStorage(initial: Record<string, string> = {}): CooldownStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

/** Mulberry32 — small seeded PRNG for the statistical test below. */
function mulberry32b(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("WEDGES (v2 prize list)", () => {
  it("contains the eight v2 prizes in the documented clockwise order", () => {
    expect(WEDGES.map((w) => w.label)).toEqual([
      "Hat",
      "Bag",
      "Socks",
      "Shirt",
      "Swag Bag",
      "Winner's Choice",
      "Nintendo Switch",
      "Free Spin",
    ]);
  });

  it("uses distinct colors for every adjacent pair (including wrap-around)", () => {
    for (let i = 0; i < WEDGES.length; i++) {
      const a = WEDGES[i]!;
      const b = WEDGES[(i + 1) % WEDGES.length]!;
      expect(a.color.toLowerCase()).not.toBe(b.color.toLowerCase());
    }
  });
});

describe("pickWedgeWithCooldown — Nintendo Switch 24h cooldown", () => {
  const NOW = Date.parse("2026-05-06T12:00:00Z");

  it("includes the Switch wedge when there is no recorded last win", () => {
    const storage = memoryStorage();
    // RNG that always returns the slice covering the Switch wedge (index 6 of 8).
    // With 8 equal-weight wedges, each slice is 0.125 wide; 0.8125 lands mid-slot 6.
    const w = pickWedgeWithCooldown(WEDGES, () => 0.8125, {
      now: () => NOW,
      storage,
    });
    expect(w.label).toBe(SWITCH_LABEL);
  });

  it("excludes the Switch wedge when last win was 1 hour ago", () => {
    const oneHourAgo = new Date(NOW - 60 * 60 * 1000).toISOString();
    const storage = memoryStorage({ [SWITCH_LAST_WIN_KEY]: oneHourAgo });
    // Same RNG draw — but with 7 eligible wedges the same uniform draw lands
    // on a non-Switch wedge.
    const w = pickWedgeWithCooldown(WEDGES, () => 0.8125, {
      now: () => NOW,
      storage,
    });
    expect(w.label).not.toBe(SWITCH_LABEL);
    // And it must still be one of the other seven.
    expect(WEDGES.map((x) => x.label)).toContain(w.label);
  });

  it("re-includes the Switch wedge after 25 hours", () => {
    const twentyFiveHoursAgo = new Date(
      NOW - 25 * 60 * 60 * 1000,
    ).toISOString();
    const storage = memoryStorage({
      [SWITCH_LAST_WIN_KEY]: twentyFiveHoursAgo,
    });
    const w = pickWedgeWithCooldown(WEDGES, () => 0.8125, {
      now: () => NOW,
      storage,
    });
    expect(w.label).toBe(SWITCH_LABEL);
  });

  it("excludes Switch right at the boundary (just under 24h)", () => {
    const justUnder = new Date(NOW - (SWITCH_COOLDOWN_MS - 1)).toISOString();
    const storage = memoryStorage({ [SWITCH_LAST_WIN_KEY]: justUnder });
    const w = pickWedgeWithCooldown(WEDGES, () => 0.8125, {
      now: () => NOW,
      storage,
    });
    expect(w.label).not.toBe(SWITCH_LABEL);
  });

  it("distributes ~equally across the remaining 7 when Switch is excluded", () => {
    const oneHourAgo = new Date(NOW - 60 * 60 * 1000).toISOString();
    const storage = memoryStorage({ [SWITCH_LAST_WIN_KEY]: oneHourAgo });
    const rng = mulberry32b(42);
    const counts = new Map<string, number>();
    const trials = 14000;
    for (let i = 0; i < trials; i++) {
      const w = pickWedgeWithCooldown(WEDGES, rng, {
        now: () => NOW,
        storage,
      });
      counts.set(w.label, (counts.get(w.label) ?? 0) + 1);
    }
    expect(counts.get(SWITCH_LABEL) ?? 0).toBe(0);
    // Expected ~ trials / 7 ≈ 2000 each. Allow ±25%.
    const expected = trials / 7;
    for (const wedge of WEDGES) {
      if (wedge.label === SWITCH_LABEL) continue;
      const c = counts.get(wedge.label) ?? 0;
      expect(c).toBeGreaterThan(expected * 0.75);
      expect(c).toBeLessThan(expected * 1.25);
    }
  });

  it("writes the timestamp to storage when the Switch wedge is picked", () => {
    const storage = memoryStorage();
    const before = storage.getItem(SWITCH_LAST_WIN_KEY);
    expect(before).toBeNull();
    const picked = pickWedgeWithCooldown(WEDGES, () => 0.8125, {
      now: () => NOW,
      storage,
    });
    expect(picked.label).toBe(SWITCH_LABEL);
    expect(storage.getItem(SWITCH_LAST_WIN_KEY)).toBe(
      new Date(NOW).toISOString(),
    );
  });

  it("does NOT write the timestamp when a non-Switch wedge is picked", () => {
    const storage = memoryStorage();
    // 0.0 lands on the first wedge ("Hat").
    const picked = pickWedgeWithCooldown(WEDGES, () => 0.0, {
      now: () => NOW,
      storage,
    });
    expect(picked.label).not.toBe(SWITCH_LABEL);
    expect(storage.getItem(SWITCH_LAST_WIN_KEY)).toBeNull();
  });
});
