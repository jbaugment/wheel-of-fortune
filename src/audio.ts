// Tiny synthesized SFX using Web Audio API. No external assets.

export class SoundController {
  private ctx: AudioContext | null = null;
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null;
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }

  /** A short blip used as a reel tick. */
  tick(): void {
    this.beep({ freq: 880, duration: 0.04, type: "square", gain: 0.05 });
  }

  /** A 3-note ascending chime for a triple-Wheel win. */
  winChime(): void {
    this.melody([
      { freq: 523.25, duration: 0.12 },
      { freq: 659.25, duration: 0.12 },
      { freq: 783.99, duration: 0.2 },
    ]);
  }

  /** A 4-note flourish when the bonus wheel lands. */
  prizeChime(): void {
    this.melody([
      { freq: 659.25, duration: 0.1 },
      { freq: 783.99, duration: 0.1 },
      { freq: 987.77, duration: 0.1 },
      { freq: 1318.51, duration: 0.25 },
    ]);
  }

  private beep(opts: {
    freq: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
    when?: number;
  }): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const start = opts.when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(opts.freq, start);
    const peak = opts.gain ?? 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + opts.duration + 0.02);
  }

  private melody(notes: Array<{ freq: number; duration: number }>): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    let when = ctx.currentTime;
    for (const note of notes) {
      this.beep({
        freq: note.freq,
        duration: note.duration,
        type: "triangle",
        gain: 0.18,
        when,
      });
      when += note.duration;
    }
  }
}
