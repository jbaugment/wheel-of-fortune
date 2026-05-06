// Pure game logic: reel outcome selection and bonus-wheel selection.
// Kept free of DOM / Canvas concerns so it can be unit-tested.

import {
  GUARANTEED_TRIPLE_WHEEL_AT,
  REEL_SYMBOLS,
  type ReelSymbol,
  type Wedge,
} from "./config";

export type ReelOutcome = readonly [ReelSymbol, ReelSymbol, ReelSymbol];

/**
 * Pick a reel outcome.
 *
 * @param spinsSinceLastTripleWheel Number of spins since the last triple-Wheel
 *   result (0 immediately after one). The Nth spin where
 *   (spinsSinceLastTripleWheel + 1) === GUARANTEED_TRIPLE_WHEEL_AT is forced
 *   to be a triple-Wheel.
 * @param rng Function returning a value in [0, 1). Inject for testability.
 */
export function chooseReelOutcome(
  spinsSinceLastTripleWheel: number,
  rng: () => number,
): ReelOutcome {
  const isGuaranteed =
    spinsSinceLastTripleWheel + 1 >= GUARANTEED_TRIPLE_WHEEL_AT;
  if (isGuaranteed) {
    return ["Wheel", "Wheel", "Wheel"] as const;
  }
  const pick = (): ReelSymbol => {
    const idx = Math.floor(rng() * REEL_SYMBOLS.length);
    // Clamp in case rng returns exactly 1 (it shouldn't, but be safe).
    return REEL_SYMBOLS[Math.min(idx, REEL_SYMBOLS.length - 1)]!;
  };
  return [pick(), pick(), pick()] as const;
}

export function isTripleWheel(outcome: ReelOutcome): boolean {
  return (
    outcome[0] === "Wheel" && outcome[1] === "Wheel" && outcome[2] === "Wheel"
  );
}

/**
 * Pick a wedge using weighted random selection.
 *
 * Wedges without an explicit weight default to 1. Implementation uses
 * cumulative weight slicing so it's deterministic given a seeded rng.
 */
export function pickWedge(wedges: readonly Wedge[], rng: () => number): Wedge {
  if (wedges.length === 0) {
    throw new Error("pickWedge: wedges must be non-empty");
  }
  const weights = wedges.map((w) => Math.max(0, w.weight ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    throw new Error("pickWedge: total weight must be > 0");
  }
  const target = rng() * total;
  let cumulative = 0;
  for (let i = 0; i < wedges.length; i++) {
    cumulative += weights[i]!;
    if (target < cumulative) {
      return wedges[i]!;
    }
  }
  // Floating-point fallback.
  return wedges[wedges.length - 1]!;
}

/** Mutable game state tracked by the controller. */
export interface GameState {
  spinsSinceLastTripleWheel: number;
  bonusAvailable: boolean;
  lastPrize: string | null;
}

export function createInitialState(): GameState {
  return {
    spinsSinceLastTripleWheel: 0,
    bonusAvailable: false,
    lastPrize: null,
  };
}

/** Advance state after a reel spin. Returns the chosen outcome. */
export function advanceAfterReelSpin(
  state: GameState,
  rng: () => number,
): ReelOutcome {
  const outcome = chooseReelOutcome(state.spinsSinceLastTripleWheel, rng);
  if (isTripleWheel(outcome)) {
    state.spinsSinceLastTripleWheel = 0;
    state.bonusAvailable = true;
  } else {
    state.spinsSinceLastTripleWheel += 1;
  }
  return outcome;
}

/** Spins remaining until the guaranteed triple-Wheel. */
export function spinsUntilGuaranteed(state: GameState): number {
  return Math.max(
    0,
    GUARANTEED_TRIPLE_WHEEL_AT - state.spinsSinceLastTripleWheel,
  );
}
