// Entry point: wires UI buttons, modal, sound toggle, and game state.

import { SoundController } from "./audio";
import { WEDGES } from "./config";
import {
  advanceAfterReelSpin,
  createInitialState,
  isTripleWheel,
  pickWedge,
  spinsUntilGuaranteed,
} from "./game";
import { ReelsView } from "./reels";
import { WheelView } from "./wheel";

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
  const spinsLeftEl = byId<HTMLElement>("spins-left");
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

  const refreshUi = (): void => {
    spinsLeftEl.textContent = String(spinsUntilGuaranteed(state));
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
    const target = pickWedge(WEDGES, Math.random);
    try {
      await wheelView.spinTo(target, Math.random);
    } finally {
      // Bonus is consumed regardless of animation outcome.
      state.bonusAvailable = false;
      state.lastPrize = target.label;
      setBusy(false);
    }
    sound.prizeChime();
    modalLabel.textContent = target.label;
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
