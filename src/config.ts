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

// Default booth-prize wedge set. Equal weight unless overridden.
export const WEDGES: readonly Wedge[] = [
  { label: "$100", color: "#e63946" },
  { label: "$50", color: "#f1a208" },
  { label: "Try Again", color: "#6c757d" },
  { label: "Free Spin", color: "#06a77d" },
  { label: "$500", color: "#9b5de5" },
  { label: "$25", color: "#118ab2" },
  { label: "Mystery Box", color: "#ef476f" },
  { label: "$10", color: "#073b4c" },
] as const;

// Reel animation tunables.
export const REEL_SPIN_BASE_MS = 1400; // first reel
export const REEL_SPIN_STAGGER_MS = 500; // each additional reel adds this
export const REEL_TICK_MS = 70; // glyph cycle interval during spin

// Wheel animation tunables.
export const WHEEL_SPIN_MIN_MS = 3500;
export const WHEEL_SPIN_MAX_MS = 5000;
export const WHEEL_MIN_FULL_TURNS = 4;
