# Tiny Fingers

[![Live Site](https://img.shields.io/badge/Live%20Site-tinyfingers.pages.dev-ff7aa8?style=for-the-badge)](https://tinyfingers.pages.dev/)
[![Cloudflare Pages](https://img.shields.io/badge/Hosted%20on-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![No Build](https://img.shields.io/badge/Build%20Step-None-brightgreen?style=for-the-badge)]()

A typing toy for toddlers — press any key and watch colorful 3D letters tumble across a sparkling, animated world.

<div align="center">
  <img src="demo.gif" alt="Tiny Fingers demo" width="600">
</div>

Built with [Three.js](https://threejs.org/) for real-time WebGL rendering. No build tools, no npm — just static files served from a folder. Hosted on [Cloudflare Pages](https://pages.cloudflare.com/).

> Inspired by the original [tinyfingers.net](https://tinyfingers.net/) — a lovely typing toy I wanted to give a visual glow-up.

## How it works

1. Open the app and tap **Start Full Screen** or **Start Here**
2. Press any letter or number — a colorful character spawns with random size, color, and motion
3. Press space or symbols — a random emoji appears instead
4. Characters wobble, drift, pulse, and tumble before fading out
5. Move the mouse — a trail of colorful shapes bursts behind the cursor

## Run locally

The app uses ES modules via import maps (Three.js loaded from CDN), so it needs a local server:

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in a modern browser.

> **Note:** Opening `index.html` directly as a `file://` URL won't work due to browser CORS restrictions on ES modules.

## Architecture

Seven JS modules + HTML + CSS, zero build step:

| File | What it does |
|------|-------------|
| `index.html` | Import map for Three.js CDN, canvas, start overlay with staggered entrance animations |
| `style.css` | Overlay/UI styles and entrance animations |
| `main.js` | Scene, camera, renderer, bloom post-processing, animation loop, input handling, fullscreen |
| `sprites.js` | Character sprite creation (Three.js `Sprite` with `CanvasTexture`), key classification, 3D motion system |
| `textures.js` | Offscreen canvas rendering of characters/emoji to `CanvasTexture` with Fredoka font |
| `background.js` | Fullscreen GLSL fragment shader with animated simplex noise color fields |
| `particles.js` | 450 GPU-driven background particles (InstancedMesh) — circles, stars, diamonds, triangles |
| `mouse-trail.js` | Mouse trail particle system — colorful shapes that burst and fade behind the cursor |

### Key handling

- Letters `a-z` spawn in random upper or lowercase
- Digits `0-9` render as-is
- Space and symbols show a random emoji from a pool of 70+
- Modifier keys (Shift, Ctrl, Alt, Meta, Tab, arrows) are ignored

## Accessibility

- Respects `prefers-reduced-motion` — wobble, drift, spin, particle speed, and entrance animations are all reduced
- Fullscreen is optional and gracefully falls back

## Debug hooks

```js
window.render_game_to_text() // JSON snapshot of app state and active sprites
window.advanceTime(ms)       // Advance the animation clock manually
```

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

[MIT](LICENSE)
