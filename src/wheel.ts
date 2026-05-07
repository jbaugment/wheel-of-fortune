// Bonus wheel rendering + animation on a 2D canvas.

import {
  WEDGES,
  WHEEL_MIN_FULL_TURNS,
  WHEEL_SPIN_MAX_MS,
  WHEEL_SPIN_MIN_MS,
  type Wedge,
} from "./config";

const TAU = Math.PI * 2;

/** Easing: cubic ease-out for a satisfying decel. */
function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function normalize(angle: number): number {
  let a = angle % TAU;
  if (a < 0) a += TAU;
  return a;
}

/**
 * Given a wheel rotation (radians), the number of wedges, and the pointer's
 * screen angle (default -π/2 / 12 o'clock), return the index of the wedge
 * currently under the pointer.
 *
 * Wedges are drawn starting at canvas-angle 0 (3 o'clock) going clockwise
 * (canvas y-down convention), wedge i covering [i*wedgeAngle, (i+1)*wedgeAngle).
 * After applying `ctx.rotate(rotation)`, wedge i is on screen at
 * [i*w + rotation, (i+1)*w + rotation], so the drawing-angle at a screen
 * angle p is (p - rotation) mod TAU.
 */
export function wedgeIndexAtPointer(
  rotation: number,
  wedgeCount: number,
  pointerAngle: number = -Math.PI / 2,
): number {
  if (wedgeCount <= 0) {
    throw new Error("wedgeIndexAtPointer: wedgeCount must be positive");
  }
  const wedgeAngle = TAU / wedgeCount;
  const drawingAngle = normalize(pointerAngle - rotation);
  return Math.floor(drawingAngle / wedgeAngle) % wedgeCount;
}

/**
 * Compute the final canvas rotation for spinning to a target wedge. The
 * returned rotation, when interpreted by `wedgeIndexAtPointer`, places
 * `targetIdx` under the pointer.
 *
 * `jitterRng` introduces intra-wedge offset (so the pointer doesn't always
 * land dead-center). `fullTurnsRng` chooses an integer number of additional
 * full turns — never a fractional turn, since fractional turns would shift
 * the landed wedge.
 */
export function computeFinalRotation(
  targetIdx: number,
  wedgeCount: number,
  currentRotation: number,
  jitterRng: () => number = Math.random,
  fullTurnsRng: () => number = Math.random,
  pointerAngle: number = -Math.PI / 2,
): number {
  const wedgeAngle = TAU / wedgeCount;
  const centerAngle = targetIdx * wedgeAngle + wedgeAngle / 2;
  const baseTarget = pointerAngle - centerAngle;
  const jitter = (jitterRng() - 0.5) * wedgeAngle * 0.6;
  const finalRotation = normalize(baseTarget + jitter);
  let delta = normalize(finalRotation - currentRotation);
  if (delta <= 0) delta += TAU;
  const extraTurns = Math.floor(fullTurnsRng() * 2);
  return currentRotation + (WHEEL_MIN_FULL_TURNS + extraTurns) * TAU + delta;
}

export class WheelView {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly wedges: readonly Wedge[];
  private currentRotation = 0; // radians

  constructor(canvas: HTMLCanvasElement, wedges: readonly Wedge[] = WEDGES) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("WheelView: 2D context unavailable");
    this.ctx = ctx;
    this.wedges = wedges;
    this.draw();
  }

  /**
   * Spin the wheel so it lands with the given wedge under the top pointer.
   * Resolves with the wedge actually under the pointer when the animation
   * settles — this is the source of truth for the displayed prize, so the
   * modal can never disagree with what the player sees.
   */
  spinTo(target: Wedge, rng: () => number = Math.random): Promise<Wedge> {
    const idx = this.wedges.indexOf(target);
    if (idx < 0) {
      return Promise.reject(
        new Error("WheelView.spinTo: target not in wedges"),
      );
    }
    const startRotation = this.currentRotation;
    const totalRotation = computeFinalRotation(
      idx,
      this.wedges.length,
      startRotation,
      rng,
      rng,
    );
    const duration =
      WHEEL_SPIN_MIN_MS + (WHEEL_SPIN_MAX_MS - WHEEL_SPIN_MIN_MS) * rng();
    const startTime = performance.now();

    return new Promise((resolve) => {
      const step = (now: number): void => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = easeOutCubic(t);
        this.currentRotation =
          startRotation + (totalRotation - startRotation) * eased;
        this.draw();
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          this.currentRotation = normalize(totalRotation);
          this.draw();
          const landedIdx = wedgeIndexAtPointer(
            this.currentRotation,
            this.wedges.length,
          );
          resolve(this.wedges[landedIdx]!);
        }
      };
      requestAnimationFrame(step);
    });
  }

  private draw(): void {
    const { ctx, canvas, wedges, currentRotation } = this;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 16;
    ctx.clearRect(0, 0, w, h);

    // Outer ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(currentRotation);
    const wedgeAngle = TAU / wedges.length;
    for (let i = 0; i < wedges.length; i++) {
      const wedge = wedges[i]!;
      const start = i * wedgeAngle;
      const end = start + wedgeAngle;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = wedge.color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Label: orient outward and flip on the left half of the wheel so it
      // never reads upside-down to the player.
      const labelLocalAngle = start + wedgeAngle / 2;
      const screenLabelAngle = normalize(labelLocalAngle + currentRotation);
      const upsideDown =
        screenLabelAngle > Math.PI / 2 && screenLabelAngle < (3 * Math.PI) / 2;
      ctx.save();
      ctx.rotate(labelLocalAngle);
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      if (upsideDown) {
        ctx.rotate(Math.PI);
        ctx.textAlign = "left";
        ctx.fillText(wedge.label, -(radius - 16), 0);
      } else {
        ctx.textAlign = "right";
        ctx.fillText(wedge.label, radius - 16, 0);
      }
      ctx.restore();
    }
    ctx.restore();

    // Hub
    ctx.beginPath();
    ctx.fillStyle = "#222";
    ctx.arc(cx, cy, 28, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#ffcf33";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Top pointer
    ctx.beginPath();
    ctx.moveTo(cx - 18, 6);
    ctx.lineTo(cx + 18, 6);
    ctx.lineTo(cx, 44);
    ctx.closePath();
    ctx.fillStyle = "#ffcf33";
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}
