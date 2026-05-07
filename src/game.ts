// Pure game logic: reel outcome selection and bonus-wheel selection.
// Kept free of DOM / Canvas concerns so it can be unit-tested.

import {
  GUARANTEED_TRIPLE_WHEEL_AT,
  REEL_SYMBOLS,
  SESSION_START_KEY,
  SWITCH_LABEL,
  SWITCH_WINDOW_MAX_MS,
  SWITCH_WINDOW_MIN_MS,
  SWITCH_WINDOW_OFFSET_KEY,
  SWITCH_WON_KEY,
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
 * Minimal Storage-like interface so the session-window logic can be tested
 * without a real `sessionStorage`. Only the methods we use are required.
 */
export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SwitchWindowOptions {
  /** Returns the current epoch ms. Defaults to `Date.now`. */
  now?: () => number;
  /** Storage backend. Defaults to `window.sessionStorage` when available. */
  storage?: SessionStorageLike | null;
}

function defaultStorage(): SessionStorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readNumber(
  storage: SessionStorageLike | null,
  key: string,
): number | null {
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readTimestamp(
  storage: SessionStorageLike | null,
  key: string,
): number | null {
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/**
 * Initialize the per-session Switch eligibility window on the first reels
 * spin of the session. Persists `sessionStartAt` and a random offset T (in
 * `[3h, 6h)` ms) to sessionStorage. Idempotent: subsequent calls are no-ops
 * once both keys are present.
 *
 * Called from the SPIN REELS click handler so the timer starts when the
 * player actually starts playing — not at pageload.
 */
export function ensureSessionStarted(
  now: number,
  storage: SessionStorageLike | null,
  rng: () => number,
): void {
  if (!storage) return;
  if (
    storage.getItem(SESSION_START_KEY) != null &&
    storage.getItem(SWITCH_WINDOW_OFFSET_KEY) != null
  ) {
    return;
  }
  const span = SWITCH_WINDOW_MAX_MS - SWITCH_WINDOW_MIN_MS;
  const offset = SWITCH_WINDOW_MIN_MS + Math.floor(rng() * span);
  storage.setItem(SESSION_START_KEY, new Date(now).toISOString());
  storage.setItem(SWITCH_WINDOW_OFFSET_KEY, String(offset));
}

/**
 * True iff the Switch wedge is eligible to be drawn right now, given the
 * session-start timestamp and the random offset persisted at session start.
 * Switch is ineligible when:
 *   - the session hasn't started (no SPIN REELS press yet), or
 *   - we're still inside the eligibility window (`now < start + T`), or
 *   - Switch has already been won this session.
 * Boundary `now == start + T` is eligible (half-open window is *exclusion*).
 */
export function isSwitchEligible(
  now: number,
  storage: SessionStorageLike | null,
): boolean {
  if (!storage) return false;
  if (storage.getItem(SWITCH_WON_KEY) != null) return false;
  const start = readTimestamp(storage, SESSION_START_KEY);
  const offset = readNumber(storage, SWITCH_WINDOW_OFFSET_KEY);
  if (start == null || offset == null) return false;
  return now >= start + offset;
}

/**
 * Wrapper around `pickWedge` that enforces the per-session eligibility
 * window for the Nintendo Switch wedge. When Switch is ineligible it is
 * filtered out and selection runs over the remaining wedges with their
 * normal weights (effectively re-normalized over the smaller set). When
 * Switch is picked, the won-at timestamp is persisted so it can't win
 * again in the same session.
 *
 * `pickWedge` is left untouched so its behavior remains pure and predictable.
 */
export function pickWedgeWithSwitchWindow(
  wedges: readonly Wedge[],
  rng: () => number,
  opts: SwitchWindowOptions = {},
): Wedge {
  const now = (opts.now ?? Date.now)();
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const eligible = isSwitchEligible(now, storage)
    ? wedges
    : wedges.filter((w) => w.label !== SWITCH_LABEL);
  const picked = pickWedge(eligible, rng);
  if (picked.label === SWITCH_LABEL && storage) {
    storage.setItem(SWITCH_WON_KEY, new Date(now).toISOString());
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
