// Entry point: wires UI buttons, modal, sound toggle, and game state.

import { SoundController } from "./audio";
import { WEDGES } from "./config";
import {
  advanceAfterReelSpin,
  createInitialState,
  isTripleWheel,
  pickWedgeWithCooldown,
} from "./game";
import { ReelsView } from "./reels";
import { WheelView } from "./wheel";

// Words spoken (per reel) when that reel lands on the Wheel symbol.
const REEL_WHEEL_WORDS = ["Wheel", "Of", "Fortune"] as const;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
}

function init(): void {
  const reelsCanvas = byId<HTMLCanvasElement>("reels-canvas");
  const wheelCanvas = byId<HTMLCanvasElement>("wheel-canvas");
  const spinReelsBtn = byId<HTMLButtonElement>("spin-reels-btn");
  const spinWheelBtn = byId<HTMLButtonElement>("spin-wheel-btn");
  const soundToggle = byId<HTMLButtonElement>("sound-toggle");
  const reelsStatusEl = byId<HTMLElement>("reels-status");
  const lastPrizeEl = byId<HTMLElement>("last-prize");
  const modal = byId<HTMLElement>("prize-modal");
  const modalLabel = byId<HTMLElement>("prize-modal-label");
  const modalClose = byId<HTMLButtonElement>("prize-modal-close");

  const state = createInitialState();
  const sound = new SoundController();
  const reelsView = new ReelsView(reelsCanvas);
  const wheelView = new WheelView(wheelCanvas, WEDGES);

  reelsView.setOnTick(() => sound.tick());
  reelsView.setOnReelStop((reelIndex, symbol) => {
    if (symbol !== "Wheel") return;
    const word = REEL_WHEEL_WORDS[reelIndex];
    if (word) sound.speak(word);
  });

  const refreshUi = (): void => {
    spinWheelBtn.disabled = !state.bonusAvailable;
    lastPrizeEl.textContent = state.lastPrize ?? "—";
  };

  const setBusy = (busy: boolean): void => {
    spinReelsBtn.disabled = busy;
    if (!busy) {
      spinWheelBtn.disabled = !state.bonusAvailable;
    } else {
      spinWheelBtn.disabled = true;
    }
  };

  spinReelsBtn.addEventListener("click", async () => {
    setBusy(true);
    reelsStatusEl.textContent = "Spinning…";
    const outcome = advanceAfterReelSpin(state, Math.random);
    try {
      await reelsView.spin(outcome);
    } finally {
      setBusy(false);
    }
    if (isTripleWheel(outcome)) {
      reelsStatusEl.textContent = "🎉 Triple Wheel! Bonus unlocked.";
      reelsView.flashWin();
      sound.winChime();
    } else {
      reelsStatusEl.textContent = `Result: ${outcome.join(" • ")}`;
    }
    refreshUi();
  });

  spinWheelBtn.addEventListener("click", async () => {
    if (!state.bonusAvailable) return;
    setBusy(true);
    const target = pickWedgeWithCooldown(WEDGES, Math.random);
    // Use the wedge the wheel actually stopped on as the source of truth so
    // the modal can never disagree with the pointer (falls back to the picked
    // target if the animation rejects).
    let landedLabel = target.label;
    try {
      const landed = await wheelView.spinTo(target, Math.random);
      landedLabel = landed.label;
    } finally {
      // Bonus is consumed regardless of animation outcome.
      state.bonusAvailable = false;
      state.lastPrize = landedLabel;
      setBusy(false);
    }
    sound.prizeChime();
    modalLabel.textContent = landedLabel;
    modal.classList.remove("hidden");
    refreshUi();
  });

  modalClose.addEventListener("click", () => {
    modal.classList.add("hidden");
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  soundToggle.addEventListener("click", () => {
    const next = !sound.isEnabled();
    sound.setEnabled(next);
    soundToggle.textContent = next ? "🔊 Sound: ON" : "🔇 Sound: OFF";
  });

  refreshUi();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
