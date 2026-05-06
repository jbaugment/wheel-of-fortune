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

  /** Spin the wheel so it lands with the given wedge under the top pointer. */
  spinTo(target: Wedge, rng: () => number = Math.random): Promise<void> {
    const idx = this.wedges.indexOf(target);
    if (idx < 0) {
      return Promise.reject(
        new Error("WheelView.spinTo: target not in wedges"),
      );
    }
    const wedgeAngle = TAU / this.wedges.length;
    // Angle from rotation = 0 at which the wedge's center sits under the
    // top pointer (which points downward at -PI/2 / 12 o'clock).
    // We draw wedge i centered at angle `i*wedgeAngle + wedgeAngle/2` from
    // the +X axis (before rotation). To put that under the top pointer, the
    // canvas rotation needs to be: -PI/2 - centerAngle (mod TAU).
    const centerAngle = idx * wedgeAngle + wedgeAngle / 2;
    const baseTarget = -Math.PI / 2 - centerAngle;
    // Add some intra-wedge jitter so the pointer doesn't always land dead-center.
    const jitter = (rng() - 0.5) * wedgeAngle * 0.6;
    const finalRotation = this.normalize(baseTarget + jitter);

    // Choose total spin distance: at least N full turns plus delta to target.
    const startRotation = this.currentRotation;
    let delta = this.normalize(finalRotation - startRotation);
    if (delta <= 0) delta += TAU;
    const totalRotation =
      startRotation + WHEEL_MIN_FULL_TURNS * TAU + delta + rng() * TAU;
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
          this.currentRotation = this.normalize(totalRotation);
          this.draw();
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  private normalize(angle: number): number {
    let a = angle % TAU;
    if (a < 0) a += TAU;
    return a;
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
      // Label
      ctx.save();
      ctx.rotate(start + wedgeAngle / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      ctx.fillText(wedge.label, radius - 16, 0);
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
