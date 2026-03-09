# Tiny Fingers

A typing toy for toddlers — press any key and watch colorful 3D letters tumble across a sparkling, animated world.

Built with [Three.js](https://threejs.org/) for real-time WebGL rendering. No build tools, no npm — just static files served from a folder.

## How it works

1. Open the app and tap **Start Full Screen** or **Start Here**
2. Press any letter or number — a 3D extruded character spawns with a random color, size, and position
3. Press space or symbols — a random emoji appears instead
4. Characters wobble, drift, pulse, and tumble in 3D before fading out
5. Nearby characters gently repel each other so they don't overlap

## Run locally

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in a modern browser.

## What's under the hood

| File | What it does |
|------|-------------|
| `index.html` | Import map for Three.js CDN, canvas, start overlay |
| `style.css` | Styles for the overlay and UI elements |
| `main.js` | Scene, camera, renderer, bloom post-processing, animation loop, input |
| `sprites.js` | 3D text geometry (Helvetiker Bold) for letters, flat sprites for emoji, motion system, soft repulsion |
| `textures.js` | Canvas-to-texture rendering for emoji with Fredoka font |
| `background.js` | GLSL fragment shader with animated simplex noise color fields |
| `particles.js` | 450 GPU-driven particles (InstancedMesh) — circles, stars, diamonds, triangles — with sparkle and lifecycle |

### Rendering pipeline

- **Background**: fullscreen shader quad with organic noise blobs in dark blue/purple/teal
- **Particles**: 5 shape types, depth-based fade, 15% sparkle with twinkle pulse, fade-in/fade-out lifecycle
- **Sprites**: extruded 3D text meshes lit by directional + ambient lights, emoji as billboard sprites
- **Post-processing**: UnrealBloomPass for particle glow without overblowing the text

### Motion system

Each character gets randomized parameters for:
- **Wobble** — sine/cosine oscillation on X and Y
- **Drift** — float direction that accelerates on exit
- **Pulse** — subtle scale breathing
- **Tumble** — 3D rotation around X, Y, and Z axes
- **Intro** — easeOutBack scale bounce on spawn
- **Exit** — opacity fade + scale shrink + drift acceleration

### Key handling

- Letters `a-z` spawn in random upper or lowercase
- Digits `0-9` render as-is
- Space and symbols show a random emoji from a pool of 70+
- Modifier keys (Shift, Ctrl, Alt, Meta, Tab, arrows) are ignored

## Accessibility

- Respects `prefers-reduced-motion` — wobble, drift, spin, and particle speed are all reduced
- Fullscreen is optional and gracefully falls back

## Debug hooks

```js
window.render_game_to_text() // JSON snapshot of app state and active sprites
window.advanceTime(ms)       // Advance the animation clock manually
```

## Branches

- `main` — Three.js WebGL version (current)
- `vanilla-backup` — Original vanilla HTML/CSS/JS version

## License

MIT
