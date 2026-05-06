// Reel rendering + animation on a 2D canvas.

import {
  REEL_SPIN_BASE_MS,
  REEL_SPIN_STAGGER_MS,
  REEL_SYMBOLS,
  REEL_TICK_MS,
  SYMBOL_GLYPHS,
  type ReelSymbol,
} from "./config";
import type { ReelOutcome } from "./game";

interface ReelVisual {
  /** Currently displayed symbol (changes during spin). */
  current: ReelSymbol;
  /** True while spinning. */
  spinning: boolean;
  /** Timestamp (ms) at which this reel should stop. */
  stopAt: number;
  /** Final symbol to land on. */
  target: ReelSymbol;
  /** Last tick timestamp. */
  lastTick: number;
  /** Flash intensity 0..1 used for the win flash. */
  flash: number;
}

export interface ReelTickHandler {
  (): void;
}

export class ReelsView {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly reels: ReelVisual[] = [];
  private rafHandle: number | null = null;
  private onTick: ReelTickHandler | null = null;
  private resolveCurrent: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("ReelsView: 2D context unavailable");
    this.ctx = ctx;
    for (let i = 0; i < 3; i++) {
      this.reels.push({
        current: "Cherry",
        spinning: false,
        stopAt: 0,
        target: "Cherry",
        lastTick: 0,
        flash: 0,
      });
    }
    this.draw();
  }

  setOnTick(handler: ReelTickHandler | null): void {
    this.onTick = handler;
  }

  /** Animate the reels and resolve when all have stopped. */
  spin(outcome: ReelOutcome): Promise<void> {
    if (this.resolveCurrent) {
      // Already spinning — refuse to start another concurrent spin.
      return Promise.reject(new Error("Reels already spinning"));
    }
    const now = performance.now();
    for (let i = 0; i < 3; i++) {
      const r = this.reels[i]!;
      r.spinning = true;
      r.target = outcome[i]!;
      r.stopAt = now + REEL_SPIN_BASE_MS + i * REEL_SPIN_STAGGER_MS;
      r.lastTick = now;
      r.flash = 0;
    }
    return new Promise((resolve) => {
      this.resolveCurrent = resolve;
      if (this.rafHandle == null) {
        this.rafHandle = requestAnimationFrame((t) => this.frame(t));
      }
    });
  }

  /** Trigger a brief flash effect (e.g. on triple-Wheel). */
  flashWin(): void {
    for (const r of this.reels) r.flash = 1;
    if (this.rafHandle == null) {
      this.rafHandle = requestAnimationFrame((t) => this.frame(t));
    }
  }

  private frame(now: number): void {
    let anyActive = false;
    for (const r of this.reels) {
      if (r.spinning) {
        anyActive = true;
        if (now >= r.stopAt) {
          r.spinning = false;
          r.current = r.target;
        } else if (now - r.lastTick >= REEL_TICK_MS) {
          r.lastTick = now;
          const idx = Math.floor(Math.random() * REEL_SYMBOLS.length);
          r.current = REEL_SYMBOLS[idx]!;
          this.onTick?.();
        }
      }
      if (r.flash > 0) {
        r.flash = Math.max(0, r.flash - 0.02);
        if (r.flash > 0) anyActive = true;
      }
    }
    this.draw();
    if (anyActive) {
      this.rafHandle = requestAnimationFrame((t) => this.frame(t));
    } else {
      this.rafHandle = null;
      const resolve = this.resolveCurrent;
      this.resolveCurrent = null;
      if (resolve) resolve();
    }
  }

  private draw(): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#1d1f2b";
    ctx.fillRect(0, 0, w, h);
    const reelW = w / 3;
    const padding = 12;
    for (let i = 0; i < 3; i++) {
      const r = this.reels[i]!;
      const x = i * reelW + padding;
      const y = padding;
      const rw = reelW - padding * 2;
      const rh = h - padding * 2;
      const flash = r.flash;
      ctx.fillStyle =
        flash > 0 ? `rgba(255,235,59,${0.3 + flash * 0.6})` : "#fff8e7";
      ctx.fillRect(x, y, rw, rh);
      ctx.strokeStyle = "#ffcf33";
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, rw, rh);
      ctx.fillStyle = "#222";
      ctx.font = "bold 96px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(SYMBOL_GLYPHS[r.current], x + rw / 2, y + rh / 2);
    }
  }
}
