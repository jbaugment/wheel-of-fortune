# Wheel of Fortune Slot Machine

A web-based booth game: a 3-reel slot machine plus a Wheel of Fortune bonus wheel. Built with Vite + vanilla TypeScript, rendered on Canvas, no external assets.

## How it plays

- **Spin Reels** — spins three reels with `Cherry`, `Bell`, `Bar`, `Seven`, `Wheel` symbols.
- Land all three reels on **Wheel** to unlock the bonus.
- A triple-Wheel is **guaranteed on the 10th reel-spin** since the last one (the counter resets if RNG hits a triple-Wheel earlier).
- **Spin Wheel** — spin the bonus wheel for a prize. The button is disabled until the bonus is unlocked, and re-disabled after the spin completes.
- Sound on/off toggle in the top-right (synthesized SFX, no audio assets).

## Develop

```sh
pnpm install
pnpm dev      # local dev server
pnpm test     # unit tests (Vitest)
pnpm build    # production build to dist/
```

## Deploy

The `deploy.yml` workflow builds the site and publishes `dist/` to GitHub Pages on every push to `main`. Vite is configured with `base: "/wheel-of-fortune/"` for the project page URL.

> **Note:** GitHub Pages must be enabled in the repository settings (Settings → Pages → Source: GitHub Actions) once. The workflow ships ready to run.

## Layout

```
src/
  main.ts      entry — wires UI, state, animations
  game.ts      pure game logic (testable: chooseReelOutcome, pickWedge, …)
  reels.ts     reel rendering + animation (Canvas 2D)
  wheel.ts     bonus wheel rendering + animation (Canvas 2D)
  audio.ts     synthesized SFX (Web Audio API)
  config.ts    symbols, wedges, tunables
  styles.css
  __tests__/   Vitest unit tests
```
