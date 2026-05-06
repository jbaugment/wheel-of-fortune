// Pure game logic: reel outcome selection and bonus-wheel selection.
// Kept free of DOM / Canvas concerns so it can be unit-tested.

import {
  GUARANTEED_TRIPLE_WHEEL_AT,
  REEL_SYMBOLS,
  SWITCH_COOLDOWN_MS,
  SWITCH_LABEL,
  SWITCH_LAST_WIN_KEY,
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

/**
 * Minimal Storage-like interface so the cooldown logic can be tested without
 * a real `localStorage`. Only the methods we use are required.
 */
export interface CooldownStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CooldownOptions {
  /** Returns the current epoch ms. Defaults to `Date.now`. */
  now?: () => number;
  /** Storage backend. Defaults to `window.localStorage` when available. */
  storage?: CooldownStorage | null;
}

function defaultStorage(): CooldownStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Read the timestamp of the last Switch win, or null if not present/invalid. */
export function readLastSwitchWinAt(
  storage: CooldownStorage | null,
): number | null {
  if (!storage) return null;
  const raw = storage.getItem(SWITCH_LAST_WIN_KEY);
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/** True if the Nintendo Switch wedge is currently on cooldown. */
export function isSwitchOnCooldown(
  now: number,
  storage: CooldownStorage | null,
): boolean {
  const last = readLastSwitchWinAt(storage);
  if (last == null) return false;
  return now - last < SWITCH_COOLDOWN_MS;
}

/**
 * Wrapper around `pickWedge` that enforces the 24h cooldown on the Nintendo
 * Switch wedge. When the Switch is on cooldown it is excluded from the random
 * draw and a wedge is picked from the remaining wedges using their weights.
 * When the picked wedge is the Switch, the current timestamp is persisted.
 *
 * `pickWedge` is left untouched so its behavior remains pure and predictable.
 */
export function pickWedgeWithCooldown(
  wedges: readonly Wedge[],
  rng: () => number,
  opts: CooldownOptions = {},
): Wedge {
  const now = (opts.now ?? Date.now)();
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const eligible = isSwitchOnCooldown(now, storage)
    ? wedges.filter((w) => w.label !== SWITCH_LABEL)
    : wedges;
  const picked = pickWedge(eligible, rng);
  if (picked.label === SWITCH_LABEL && storage) {
    storage.setItem(SWITCH_LAST_WIN_KEY, new Date(now).toISOString());
  }
  return picked;
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
