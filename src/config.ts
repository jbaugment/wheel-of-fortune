// Game configuration: symbols, wedges, and tunables.

export type ReelSymbol = "Cherry" | "Bell" | "Bar" | "Seven" | "Wheel";

export const REEL_SYMBOLS: readonly ReelSymbol[] = [
  "Cherry",
  "Bell",
  "Bar",
  "Seven",
  "Wheel",
] as const;

export const SYMBOL_GLYPHS: Record<ReelSymbol, string> = {
  Cherry: "🍒",
  Bell: "🔔",
  Bar: "📊",
  Seven: "7️⃣",
  Wheel: "🎡",
};

// Number of reel spins until a triple-Wheel is guaranteed (counted from the
// last triple-Wheel). The 10th spin since the last triple-Wheel is forced.
export const GUARANTEED_TRIPLE_WHEEL_AT = 10;

export interface Wedge {
  label: string;
  color: string;
  weight?: number; // defaults to 1
}

// Booth-prize wedge set, clockwise from 12 o'clock. Equal weight by default;
// the Nintendo Switch wedge has an additional 24h cooldown enforced by
// pickWedgeWithCooldown (see game.ts).
export const WEDGES: readonly Wedge[] = [
  { label: "Hat", color: "#e63946" },
  { label: "Bag", color: "#f59e0b" },
  { label: "Socks", color: "#06a77d" },
  { label: "Shirt", color: "#118ab2" },
  { label: "Swag Bag", color: "#9b5de5" },
  { label: "Winner's Choice", color: "#ef476f" },
  { label: "Nintendo Switch", color: "#ff7849" },
  { label: "Free Spin", color: "#22d3ee" },
] as const;

// Label of the session-restricted wedge (must match a label in WEDGES). The
// Switch wedge is gated by a per-session eligibility window — see
// `pickWedgeWithSwitchWindow` in game.ts.
export const SWITCH_LABEL = "Nintendo Switch";

// Label of the free-spin wedge: when the wheel lands here the bonus is not
// consumed and the prize modal is suppressed (must match a label in WEDGES).
export const FREE_SPIN_LABEL = "Free Spin";

// sessionStorage keys used by the Switch eligibility-window logic. A "session"
// is a single browser tab/pageload — values survive same-tab refresh but reset
// on tab close (the desired behavior).
export const SESSION_START_KEY = "wof:sessionStartAt";
export const SWITCH_WINDOW_OFFSET_KEY = "wof:switchWindowOffsetMs";
export const SWITCH_WON_KEY = "wof:switchWonAt";

// Bounds (ms) for the random eligibility offset T picked at session start:
// the Switch wedge becomes eligible at `sessionStartAt + T`, where T is drawn
// uniformly from [3h, 6h).
export const SWITCH_WINDOW_MIN_MS = 3 * 60 * 60 * 1000;
export const SWITCH_WINDOW_MAX_MS = 6 * 60 * 60 * 1000;

// Reel animation tunables.
export const REEL_SPIN_BASE_MS = 1400; // first reel
export const REEL_SPIN_STAGGER_MS = 500; // each additional reel adds this
export const REEL_TICK_MS = 70; // glyph cycle interval during spin

// Wheel animation tunables.
export const WHEEL_SPIN_MIN_MS = 3500;
export const WHEEL_SPIN_MAX_MS = 5000;
export const WHEEL_MIN_FULL_TURNS = 4;
