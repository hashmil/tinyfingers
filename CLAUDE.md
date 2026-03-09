# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tiny Fingers is a typing toy for toddlers — a vanilla web app where keypresses spawn animated character sprites on screen. No frameworks, no build system, no dependencies.

## Running Locally

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

No install or build step needed. Just serve the three static files.

## Architecture

Three files make up the entire app:

- **`index.html`** — App shell with start overlay, background layers (blobs + fluid ribbons + confetti), stage for sprites, and fullscreen toggle button
- **`styles.css`** — Dark blue theme, 6 sprite color classes × 4 treatments (solid/glow/shadow/outline), CSS animations for background effects (`drift`, `floaty`, `fluidLoop`), responsive sizing via `clamp()`
- **`script.js`** — All logic: key classification, sprite spawning with randomized motion parameters (wobble, drift, pulse, spin), requestAnimationFrame render loop, fullscreen management, and app state

### Key flow

1. User clicks "Start Full Screen" or "Start Here" on the overlay
2. Keypress → `classifyKey()` maps it to a letter, digit, or random emoji → `spawnSprite()` creates a sprite with random position, size, color, and motion
3. `animationFrame()` loop updates all active sprites each frame (position, scale, rotation, opacity)
4. Sprites auto-remove after `CONFIG.spriteLifetimeMs` (2200ms); max 18 on screen at once

### Debug hooks (exposed on `window`)

- `render_game_to_text()` — Returns JSON snapshot of app state and active sprites
- `advanceTime(ms)` — Manually advances the animation clock

## Key conventions

- Respects `prefers-reduced-motion` — reduced wobble/drift when enabled
- CONFIG object at top of `script.js` controls all tunable parameters (max sprites, lifetime, font sizes, etc.)
- Modifier keys (Shift, Ctrl, Alt, Meta, Tab, arrows) are intentionally ignored
- Space and symbols trigger a random emoji from the emoji pool rather than rendering literally
