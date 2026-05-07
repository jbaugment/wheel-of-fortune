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
import {
  computeFinalRotation,
  wedgeBoundaryCrossings,
  wedgeIndexAtPointer,
} from "../wheel";
import { SoundController } from "../audio";

const TAU = Math.PI * 2;

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

describe("wedgeIndexAtPointer", () => {
  // Wedges are drawn starting at canvas-angle 0 (3 o'clock) clockwise. With
  // 8 wedges and rotation 0, wedge i covers [i*π/4, (i+1)*π/4]. The pointer
  // sits at canvas-angle -π/2 ≡ 3π/2, which is the start of wedge 6 — the
  // wedge centered at 12 o'clock when no rotation is applied (one half-wedge
  // CW of straight up). This is the source-of-truth lookup used by spinTo.
  it("with 8 wedges and rotation 0, the pointer at -π/2 sits on wedge 6", () => {
    expect(wedgeIndexAtPointer(0, 8)).toBe(6);
  });

  it("rotating CW by exactly one wedge angle shifts the result by -1 (and CCW by +1)", () => {
    const w = TAU / 8;
    // Positive rotation = clockwise on screen. The wheel moves CW under the
    // stationary pointer, so the wedge under the pointer shifts the other way
    // (its index decreases by 1).
    expect(wedgeIndexAtPointer(w, 8)).toBe(5);
    expect(wedgeIndexAtPointer(2 * w, 8)).toBe(4);
    // CCW rotation of one wedge increases the index by 1.
    expect(wedgeIndexAtPointer(-w, 8)).toBe(7);
  });

  it("rotating by TAU returns the same wedge as rotation 0", () => {
    expect(wedgeIndexAtPointer(TAU, 8)).toBe(wedgeIndexAtPointer(0, 8));
    expect(wedgeIndexAtPointer(-TAU, 8)).toBe(wedgeIndexAtPointer(0, 8));
  });

  it("a tiny rotation past a wedge boundary picks the next wedge (and just before, the previous)", () => {
    const w = TAU / 8;
    const eps = 1e-9;
    // At rotation 0 we're at wedge 6 — exactly the boundary 5/6, which floor
    // resolves to 6. Nudging rotation by +eps puts the pointer just before
    // that boundary in drawing space, landing on wedge 5; nudging by -eps
    // puts it just past, landing on wedge 6.
    expect(wedgeIndexAtPointer(eps, 8)).toBe(5);
    expect(wedgeIndexAtPointer(-eps, 8)).toBe(6);
    // Same idea around the next boundary one wedge later.
    expect(wedgeIndexAtPointer(w + eps, 8)).toBe(4);
    expect(wedgeIndexAtPointer(w - eps, 8)).toBe(5);
  });

  it("throws when wedgeCount is non-positive", () => {
    expect(() => wedgeIndexAtPointer(0, 0)).toThrow();
    expect(() => wedgeIndexAtPointer(0, -1)).toThrow();
  });
});

describe("computeFinalRotation round-trip", () => {
  // For every wedge in WEDGES, regardless of jitter / extra-turn RNG draws
  // and starting rotation, the final rotation must place that wedge under
  // the pointer. This is the contract that protects spinTo from the kind of
  // sign / fractional-turn drift that originally caused the modal-vs-pointer
  // mismatch reported in the bug.
  it("lands the picked wedge under the pointer for every wedge across many RNG draws", () => {
    const rng = mulberry32(0xc0ffee);
    for (let idx = 0; idx < WEDGES.length; idx++) {
      for (let trial = 0; trial < 64; trial++) {
        const startRotation = rng() * TAU;
        const finalRotation = computeFinalRotation(
          idx,
          WEDGES.length,
          startRotation,
          rng,
          rng,
        );
        expect(wedgeIndexAtPointer(finalRotation, WEDGES.length)).toBe(idx);
      }
    }
  });

  it("always spins forward by at least WHEEL_MIN_FULL_TURNS turns", () => {
    const rng = mulberry32(7);
    const minTurns = 4; // matches WHEEL_MIN_FULL_TURNS in config
    for (let idx = 0; idx < WEDGES.length; idx++) {
      const start = rng() * TAU;
      const final = computeFinalRotation(idx, WEDGES.length, start, rng, rng);
      expect(final - start).toBeGreaterThan(minTurns * TAU);
    }
  });

  it("does not add fractional extra turns (so fullTurnsRng never shifts the landed wedge)", () => {
    // With the same jitter draw but two different fullTurnsRng draws, the
    // landed wedge must be identical — i.e. the extra-turn term is always
    // a multiple of TAU.
    for (let idx = 0; idx < WEDGES.length; idx++) {
      const jitterValue = 0.42;
      const jitter = (): number => jitterValue;
      const a = computeFinalRotation(idx, WEDGES.length, 0, jitter, () => 0.1);
      const b = computeFinalRotation(idx, WEDGES.length, 0, jitter, () => 0.9);
      expect(wedgeIndexAtPointer(a, WEDGES.length)).toBe(
        wedgeIndexAtPointer(b, WEDGES.length),
      );
      // And both still land on the picked wedge.
      expect(wedgeIndexAtPointer(a, WEDGES.length)).toBe(idx);
    }
  });
});

describe("wedgeBoundaryCrossings", () => {
  // The tick-sound hook fires once per wedge boundary the pointer crosses
  // during a spin; this helper returns that count for a single animation
  // step. Spins are monotonic but the helper accepts negative direction too
  // (e.g. for tests).
  it("returns 0 when both rotations are inside the same wedge slice", () => {
    const w = TAU / 8;
    expect(wedgeBoundaryCrossings(0, w * 0.4, 8)).toBe(0);
    expect(wedgeBoundaryCrossings(w * 0.1, w * 0.9, 8)).toBe(0);
  });

  it("returns 1 when the rotation crosses exactly one boundary", () => {
    const w = TAU / 8;
    expect(wedgeBoundaryCrossings(w * 0.5, w * 1.5, 8)).toBe(1);
    expect(wedgeBoundaryCrossings(0, w + 1e-9, 8)).toBe(1);
  });

  it("counts every boundary across multiple wedges and full turns", () => {
    const w = TAU / 8;
    // Cross 3 wedge boundaries within a single turn.
    expect(wedgeBoundaryCrossings(0, w * 3.5, 8)).toBe(3);
    // Two full turns plus a half wedge = 16 boundaries.
    expect(wedgeBoundaryCrossings(0, 2 * TAU + w * 0.5, 8)).toBe(16);
  });

  it("matches the per-step count summed across a full spin", () => {
    // Driving the helper with a sequence of monotonically-increasing
    // rotations sums to the total boundaries crossed end-to-end.
    const wedgeCount = 8;
    const w = TAU / wedgeCount;
    const samples = [0, w * 0.3, w * 0.7, w * 1.5, w * 4.2, w * 9.9];
    let perStep = 0;
    for (let i = 1; i < samples.length; i++) {
      perStep += wedgeBoundaryCrossings(
        samples[i - 1]!,
        samples[i]!,
        wedgeCount,
      );
    }
    const endToEnd = wedgeBoundaryCrossings(
      samples[0]!,
      samples[samples.length - 1]!,
      wedgeCount,
    );
    expect(perStep).toBe(endToEnd);
    expect(endToEnd).toBe(9); // floor(9.9) - floor(0) = 9 boundaries
  });

  it("throws when wedgeCount is non-positive", () => {
    expect(() => wedgeBoundaryCrossings(0, 1, 0)).toThrow();
    expect(() => wedgeBoundaryCrossings(0, 1, -1)).toThrow();
  });
});

describe("SoundController.bells", () => {
  // The bells flourish must be a no-op when sound is disabled — exactly the
  // same contract `melody`/`getCtx` already enforce for the other chimes
  // (winChime, prizeChime). The vitest environment is "node", so the only
  // safely-exercisable path here is the disabled one (the enabled path
  // touches `window.AudioContext`).
  it("does not throw when sound is disabled", () => {
    const sound = new SoundController();
    sound.setEnabled(false);
    expect(() => sound.bells()).not.toThrow();
  });

  it("is exposed on the SoundController public API", () => {
    const sound = new SoundController();
    expect(typeof sound.bells).toBe("function");
  });
});
