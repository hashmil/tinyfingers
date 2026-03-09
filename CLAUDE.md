# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tiny Fingers is a typing toy for toddlers — a Three.js WebGL app where keypresses spawn animated 3D character sprites on screen. No npm, no bundler — Three.js is loaded via ES module import maps from CDN.

## Running Locally

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

No install or build step needed. Just serve the static files.

## Architecture

Six JS modules + HTML + CSS:

- **`index.html`** — Import map for Three.js CDN, canvas element, start overlay, fullscreen toggle
- **`style.css`** — Overlay/UI styles only (all visuals are GPU-rendered)
- **`main.js`** — Scene setup, camera, WebGLRenderer, EffectComposer (bloom), animation loop, input handling, fullscreen management, debug hooks
- **`sprites.js`** — Character sprite creation (Three.js `Sprite` with `CanvasTexture`), key classification, 3D motion system (wobble, drift, pulse, spin, tumble, z-drift), lifetime management
- **`textures.js`** — Offscreen canvas rendering of characters/emoji to `CanvasTexture` with Fredoka font, pre-render cache
- **`background.js`** — Fullscreen quad with GLSL fragment shader for animated organic color fields (simplex noise blobs, flowing gradients)
- **`particles.js`** — GPU-driven particle system using `InstancedMesh` (800 particles drifting in 3D space)

### Key flow

1. User clicks "Start Full Screen" or "Start Here" on the overlay
2. Keypress → `classifyKey()` maps it to a letter, digit, or random emoji → `spawnSprite()` creates a Three.js Sprite with random 3D position, size, color tint, and motion parameters
3. `animationFrame()` loop updates background shader, particles, and sprites each frame
4. Post-processing bloom pass adds glow to all bright elements
5. Sprites auto-remove after 2200ms; max 18 on screen at once

### Debug hooks (exposed on `window`)

- `render_game_to_text()` — Returns JSON snapshot of app state and active sprites
- `advanceTime(ms)` — Manually advances the animation clock and re-renders

## Key conventions

- Respects `prefers-reduced-motion` — reduced wobble/drift/spin when enabled
- CONFIG object in `sprites.js` controls tunable sprite parameters
- Modifier keys (Shift, Ctrl, Alt, Meta, Tab, arrows) are intentionally ignored
- Space and symbols trigger a random emoji from the emoji pool rather than rendering literally
- Three.js loaded via import map from unpkg CDN (no npm install needed)
