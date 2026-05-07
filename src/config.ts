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

// Label of the cooldown-restricted wedge (must match a label in WEDGES).
export const SWITCH_LABEL = "Nintendo Switch";

// localStorage key used to persist the timestamp of the last Switch win.
export const SWITCH_LAST_WIN_KEY = "wof:lastSwitchWinAt";

// Cooldown window for the Nintendo Switch wedge: 24 hours in ms.
export const SWITCH_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Reel animation tunables.
export const REEL_SPIN_BASE_MS = 1400; // first reel
export const REEL_SPIN_STAGGER_MS = 500; // each additional reel adds this
export const REEL_TICK_MS = 70; // glyph cycle interval during spin

// Wheel animation tunables.
export const WHEEL_SPIN_MIN_MS = 3500;
export const WHEEL_SPIN_MAX_MS = 5000;
export const WHEEL_MIN_FULL_TURNS = 4;
