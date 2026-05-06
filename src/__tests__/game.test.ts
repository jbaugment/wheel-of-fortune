import { describe, expect, it } from "vitest";
import { GUARANTEED_TRIPLE_WHEEL_AT } from "../config";
import {
  advanceAfterReelSpin,
  chooseReelOutcome,
  createInitialState,
  isTripleWheel,
  spinsUntilGuaranteed,
} from "../game";

/** Deterministic RNG: yields the next value from a list. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe("chooseReelOutcome", () => {
  it("forces a triple-Wheel on the guaranteed spin", () => {
    // spinsSinceLast = GUARANTEED_TRIPLE_WHEEL_AT - 1 means this spin is #N.
    const rng = seq([0, 0, 0]); // would otherwise produce all Cherry
    const outcome = chooseReelOutcome(GUARANTEED_TRIPLE_WHEEL_AT - 1, rng);
    expect(isTripleWheel(outcome)).toBe(true);
  });

  it("does not force a triple-Wheel before the guaranteed spin", () => {
    const rng = seq([0, 0, 0]); // all Cherry
    const outcome = chooseReelOutcome(0, rng);
    expect(outcome).toEqual(["Cherry", "Cherry", "Cherry"]);
  });

  it("respects the rng for non-guaranteed spins", () => {
    // 5 symbols: index = floor(rng * 5). 0.85 -> 4 -> Wheel.
    const rng = seq([0.85, 0.0, 0.45]);
    const outcome = chooseReelOutcome(0, rng);
    expect(outcome).toEqual(["Wheel", "Cherry", "Bar"]);
  });
});

describe("advanceAfterReelSpin", () => {
  it("resets the counter and unlocks bonus when triple-Wheel hits", () => {
    const state = createInitialState();
    state.spinsSinceLastTripleWheel = GUARANTEED_TRIPLE_WHEEL_AT - 1;
    const outcome = advanceAfterReelSpin(state, () => 0);
    expect(isTripleWheel(outcome)).toBe(true);
    expect(state.spinsSinceLastTripleWheel).toBe(0);
    expect(state.bonusAvailable).toBe(true);
  });

  it("resets the counter when RNG happens to produce a triple-Wheel early", () => {
    const state = createInitialState();
    state.spinsSinceLastTripleWheel = 3;
    // 0.85 -> floor(0.85*5) = 4 -> Wheel for all three reels.
    const outcome = advanceAfterReelSpin(state, () => 0.85);
    expect(isTripleWheel(outcome)).toBe(true);
    expect(state.spinsSinceLastTripleWheel).toBe(0);
    expect(state.bonusAvailable).toBe(true);
  });

  it("guarantees a triple-Wheel within GUARANTEED_TRIPLE_WHEEL_AT spins", () => {
    const state = createInitialState();
    // RNG that never produces a Wheel (always 0 -> Cherry).
    const rng = (): number => 0;
    let sawTripleWheel = false;
    for (let i = 0; i < GUARANTEED_TRIPLE_WHEEL_AT; i++) {
      const outcome = advanceAfterReelSpin(state, rng);
      if (isTripleWheel(outcome)) {
        sawTripleWheel = true;
        // Should only fire on the GUARANTEED-th spin.
        expect(i).toBe(GUARANTEED_TRIPLE_WHEEL_AT - 1);
      }
    }
    expect(sawTripleWheel).toBe(true);
    expect(state.spinsSinceLastTripleWheel).toBe(0);
  });

  it("increments the counter on non-triple-Wheel spins", () => {
    const state = createInitialState();
    advanceAfterReelSpin(state, () => 0);
    advanceAfterReelSpin(state, () => 0);
    expect(state.spinsSinceLastTripleWheel).toBe(2);
    expect(state.bonusAvailable).toBe(false);
  });
});

describe("spinsUntilGuaranteed", () => {
  it("starts at GUARANTEED_TRIPLE_WHEEL_AT and decreases", () => {
    const state = createInitialState();
    expect(spinsUntilGuaranteed(state)).toBe(GUARANTEED_TRIPLE_WHEEL_AT);
    advanceAfterReelSpin(state, () => 0);
    expect(spinsUntilGuaranteed(state)).toBe(GUARANTEED_TRIPLE_WHEEL_AT - 1);
  });
});
