// Entry point: wires UI buttons, modal, sound toggle, and game state.

import { SoundController } from "./audio";
import { FREE_SPIN_LABEL, WEDGES } from "./config";
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

// How long the transient "Free Spin!" banner stays visible.
const FREE_SPIN_STATUS_MS = 2500;

// Approximate gap (ms) after the spoken "Fortune" before the bell melody
// starts on a triple-Wheel — long enough that the bells don't talk over the
// final word but short enough to feel like a payoff.
const BELLS_AFTER_FORTUNE_MS = 700;

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
  const wheelStatusEl = byId<HTMLElement>("wheel-status");
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
  wheelView.setOnTick(() => sound.tick());

  let wheelStatusTimer: number | null = null;
  const flashWheelStatus = (text: string): void => {
    wheelStatusEl.textContent = text;
    if (wheelStatusTimer != null) {
      window.clearTimeout(wheelStatusTimer);
    }
    wheelStatusTimer = window.setTimeout(() => {
      wheelStatusEl.textContent = "";
      wheelStatusTimer = null;
    }, FREE_SPIN_STATUS_MS);
  };

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
      // Play the bell flourish shortly after the spoken "Fortune" so the
      // melody lands as a payoff rather than talking over the final word.
      window.setTimeout(() => sound.bells(), BELLS_AFTER_FORTUNE_MS);
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
    // target if the animation rejects). `landed` is null when the animation
    // rejects — in that case we fall back to the picked target's label and
    // skip the Free-Spin special case (treat it as a normal prize).
    let landedLabel = target.label;
    let isFreeSpin = false;
    try {
      const landed = await wheelView.spinTo(target, Math.random);
      landedLabel = landed.label;
      isFreeSpin = landed.label === FREE_SPIN_LABEL;
    } finally {
      if (!isFreeSpin) {
        // Bonus is consumed and the prize recorded only on a non-free-spin
        // landing — Free Spin keeps the bonus and is announced transiently.
        state.bonusAvailable = false;
        state.lastPrize = landedLabel;
      }
      setBusy(false);
    }
    sound.prizeChime();
    if (isFreeSpin) {
      flashWheelStatus("🎡 Free Spin! Spin again.");
    } else {
      modalLabel.textContent = landedLabel;
      modal.classList.remove("hidden");
    }
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
