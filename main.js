import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { preloadTextures } from "./textures.js";
import { createBackground } from "./background.js";
import { createParticleSystem } from "./particles.js";
import { createSpriteSystem, classifyKey, loadFont } from "./sprites.js";
import { createMouseTrail } from "./mouse-trail.js";
import { createBurstSystem } from "./burst.js";

// ── State ──────────────────────────────────────────────────────────────

const state = {
  started: false,
  isFullscreen: false,
  hasTyped: false,
  clockMs: 0,
  lastFrameTime: 0,
};

// ── DOM ────────────────────────────────────────────────────────────────

const canvas = document.getElementById("canvas");
const app = document.getElementById("app");
const startOverlay = document.getElementById("start-overlay");
const startFullscreenBtn = document.getElementById("start-fullscreen");
const startWindowedBtn = document.getElementById("start-windowed");
const fullscreenToggle = document.getElementById("fullscreen-toggle");
const stageHint = document.getElementById("stage-hint");

// ── Three.js setup ─────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x08111f);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.z = 8;

// ── Post-processing (bloom) ────────────────────────────────────────────

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.45,  // strength
  0.7,   // radius
  0.55   // threshold — particles are bright enough to bloom, sprites are dimmer
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ── Lighting (for 3D text meshes) ──────────────────────────────────────

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(3, 5, 8);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x88bbff, 0.4);
fillLight.position.set(-4, -2, 6);
scene.add(fillLight);

// ── Systems ────────────────────────────────────────────────────────────

const background = createBackground(scene);
const particles = createParticleSystem(scene);
const sprites = createSpriteSystem(scene, camera);
const trail = createMouseTrail(scene, camera);
const bursts = createBurstSystem(scene);

// Load font for 3D text + pre-render emoji textures
loadFont();
preloadTextures();

// ── Fullscreen ─────────────────────────────────────────────────────────

function syncFullscreenState() {
  state.isFullscreen = Boolean(
    document.fullscreenElement || document.webkitFullscreenElement
  );
  fullscreenToggle.textContent = state.isFullscreen ? "\u00d7" : "Go Full Screen";
  fullscreenToggle.classList.toggle("is-close", state.isFullscreen);
}

async function enterFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    syncFullscreenState();
    return true;
  }
  try {
    if (app.requestFullscreen) {
      await app.requestFullscreen();
    } else if (app.webkitRequestFullscreen) {
      app.webkitRequestFullscreen();
    } else {
      return false;
    }
    syncFullscreenState();
    return true;
  } catch (_) {
    syncFullscreenState();
    return false;
  }
}

async function exitFullscreen() {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  } catch (_) {}
  syncFullscreenState();
}

async function toggleFullscreen() {
  if (state.isFullscreen) {
    await exitFullscreen();
  } else {
    await enterFullscreen();
  }
}

// ── Resize ─────────────────────────────────────────────────────────────

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
  background.resize(w, h);
}

// ── App lifecycle ──────────────────────────────────────────────────────

function startApp(preferFullscreen) {
  if (state.started) return;
  state.started = true;
  startOverlay.classList.add("is-hidden");
  fullscreenToggle.hidden = false;
  syncFullscreenState();
  if (preferFullscreen) enterFullscreen();
}

function hideStageHint() {
  if (!state.hasTyped) {
    state.hasTyped = true;
    stageHint.classList.add("is-hidden");
    setTimeout(() => { stageHint.hidden = true; }, 260);
  }
}

// ── Input ──────────────────────────────────────────────────────────────

function handleKeyDown(event) {
  if (!state.started) return;

  // Let Escape through so browser can exit fullscreen
  if (event.key === "Escape") return;

  // Block ALL default browser shortcuts when app is running (toddler-proof)
  event.preventDefault();
  event.stopPropagation();

  // Ignore modifier-only keys — but don't let them through to the browser
  if (
    event.key === "Shift" ||
    event.key === "Control" ||
    event.key === "Alt" ||
    event.key === "Meta" ||
    event.key === "CapsLock" ||
    event.key === "Dead"
  ) {
    return;
  }

  // Spacebar: pop all existing sprites in a staggered burst with fireworks
  if (event.key === " ") {
    sprites.popAll((x, y, z, color) => {
      bursts.burst(x, y, z, color);
    });
    hideStageHint();
    return;
  }

  const keyInfo = classifyKey(event.key);
  if (!keyInfo) return;

  sprites.spawnSprite(keyInfo.content, keyInfo.kind);
  hideStageHint();
}

// ── Animation loop ─────────────────────────────────────────────────────

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function animationFrame(now) {
  requestAnimationFrame(animationFrame);

  if (!state.lastFrameTime) state.lastFrameTime = now;
  const delta = Math.min(now - state.lastFrameTime, 64);
  state.lastFrameTime = now;
  state.clockMs += delta;

  const timeSeconds = state.clockMs / 1000;
  const reduced = prefersReducedMotion();

  background.update(timeSeconds);
  particles.update(timeSeconds, reduced);
  sprites.updateSprites(state.clockMs);
  trail.update(timeSeconds);
  bursts.update(timeSeconds);

  composer.render();
}

// ── Debug hooks ────────────────────────────────────────────────────────

function buildTextState() {
  return JSON.stringify({
    started: state.started,
    isFullscreen: state.isFullscreen,
    spriteCount: sprites.count,
    clockMs: Math.round(state.clockMs),
    stage: {
      width: window.innerWidth,
      height: window.innerHeight,
      renderer: "Three.js WebGL",
    },
    sprites: sprites.getState(),
  });
}

function advanceTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  state.clockMs += ms;
  const timeSeconds = state.clockMs / 1000;
  const reduced = prefersReducedMotion();
  background.update(timeSeconds);
  particles.update(timeSeconds, reduced);
  sprites.updateSprites(state.clockMs);
  trail.update(timeSeconds);
  bursts.update(timeSeconds);
  composer.render();
  state.lastFrameTime = performance.now();
}

window.render_game_to_text = buildTextState;
window.advanceTime = advanceTime;

// ── Event binding ──────────────────────────────────────────────────────

startFullscreenBtn.addEventListener("click", () => startApp(true));
startWindowedBtn.addEventListener("click", () => startApp(false));
fullscreenToggle.addEventListener("click", toggleFullscreen);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("fullscreenchange", syncFullscreenState);
window.addEventListener("webkitfullscreenchange", syncFullscreenState);
window.addEventListener("resize", onResize);

// ── Toddler-proofing ─────────────────────────────────────────────────
// Block context menu, drag/drop, and accidental navigation when app is running

window.addEventListener("contextmenu", (e) => {
  if (state.started) e.preventDefault();
});

window.addEventListener("dragstart", (e) => {
  if (state.started) e.preventDefault();
});

window.addEventListener("drop", (e) => {
  if (state.started) e.preventDefault();
});

// Catch keyup too to prevent stray browser behavior
window.addEventListener("keyup", (e) => {
  if (state.started && e.key !== "Escape") e.preventDefault();
});

// Warn before accidental tab close (browsers may show a confirmation dialog)
window.addEventListener("beforeunload", (e) => {
  if (state.started && state.isFullscreen) {
    e.preventDefault();
  }
});

// ── Mouse / touch trail ───────────────────────────────────────────────

canvas.addEventListener("mousemove", (e) => {
  if (!state.started) return;
  trail.handleMove(e.clientX, e.clientY, state.clockMs, prefersReducedMotion());
});

canvas.addEventListener("touchmove", (e) => {
  if (!state.started) return;
  const t = e.touches[0];
  if (t) trail.handleMove(t.clientX, t.clientY, state.clockMs, prefersReducedMotion());
}, { passive: true });

// ── Boot ───────────────────────────────────────────────────────────────

syncFullscreenState();
requestAnimationFrame(animationFrame);
