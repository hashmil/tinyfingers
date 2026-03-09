import * as THREE from "three";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { createCharTexture, EMOJI_POOL } from "./textures.js";

const COLORS = [
  new THREE.Color(0xff8fb3), // coral
  new THREE.Color(0x66b5ff), // sky
  new THREE.Color(0xffd15c), // sun
  new THREE.Color(0x63de9d), // mint
  new THREE.Color(0xb28cff), // grape
  new THREE.Color(0x76f2ea), // bubble
];

const COLOR_NAMES = ["coral", "sky", "sun", "mint", "grape", "bubble"];

const CONFIG = {
  maxSprites: 18,
  spriteLifetimeMs: 2200,
  introDurationMs: 280,
  exitStartRatio: 0.42,
  minSize: 1.0,
  maxSize: 2.4,
  maxSpin: 32,
  repelRadius: 2.2,
  repelStrength: 0.04,
  textDepth: 0.25,
  emojiMinSize: 1.4,
  emojiMaxSize: 3.0,
};

let loadedFont = null;
const geometryCache = new Map();

// Load the font
export function loadFont() {
  return new Promise((resolve) => {
    const loader = new FontLoader();
    loader.load(
      "https://unpkg.com/three@0.170.0/examples/fonts/helvetiker_bold.typeface.json",
      (font) => {
        loadedFont = font;
        resolve(font);
      },
      undefined,
      () => {
        console.warn("Font load failed, falling back to sprites");
        resolve(null);
      }
    );
  });
}

function getTextGeometry(char) {
  if (geometryCache.has(char)) {
    return geometryCache.get(char);
  }

  if (!loadedFont) return null;

  const geo = new TextGeometry(char, {
    font: loadedFont,
    size: 1,
    depth: CONFIG.textDepth,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 3,
  });

  // Center the geometry
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const cx = (bb.max.x - bb.min.x) / 2 + bb.min.x;
  const cy = (bb.max.y - bb.min.y) / 2 + bb.min.y;
  const cz = (bb.max.z - bb.min.z) / 2 + bb.min.z;
  geo.translate(-cx, -cy, -cz);

  geometryCache.set(char, geo);
  return geo;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function easeOutBack(value) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function classifyKey(key) {
  if (/^[a-z]$/i.test(key)) {
    // Randomly uppercase or lowercase
    const char = Math.random() < 0.5 ? key.toUpperCase() : key.toLowerCase();
    return { content: char, kind: "literal" };
  }
  if (/^[0-9]$/.test(key)) {
    return { content: key, kind: "literal" };
  }
  // Everything else (space, symbols, F-keys, arrows, Tab, Enter, etc.) → emoji
  return { content: pickRandom(EMOJI_POOL), kind: "emoji" };
}

export function createSpriteSystem(scene, camera) {
  const activeSprites = [];
  let nextId = 1;
  let clockMs = 0;

  function getViewSpread() {
    const dist = camera.position.z;
    const vFov = (camera.fov * Math.PI) / 180;
    const h = 2 * Math.tan(vFov / 2) * dist;
    const w = h * camera.aspect;
    return { halfW: w * 0.42, halfH: h * 0.42 };
  }

  function spawnSprite(content, kind) {
    const colorIndex = Math.floor(Math.random() * COLORS.length);
    const color = COLORS[colorIndex];
    const colorName = COLOR_NAMES[colorIndex];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const { halfW, halfH } = getViewSpread();
    const x = randomBetween(-halfW, halfW);
    const y = randomBetween(-halfH, halfH);
    const z = randomBetween(-2, 1);

    let object3d;
    let material;
    let is3D = false;
    let size;

    // Try 3D text for letters/numbers, fall back to sprite
    const textGeo = kind === "literal" ? getTextGeometry(content) : null;

    if (textGeo) {
      // 3D extruded text mesh
      is3D = true;
      size = randomBetween(CONFIG.minSize, CONFIG.maxSize);

      material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.15,
        metalness: 0.1,
        roughness: 0.4,
        transparent: true,
        opacity: 1,
      });

      object3d = new THREE.Mesh(textGeo, material);
      object3d.scale.setScalar(size);
      object3d.position.set(x, y, z);
    } else {
      // Flat sprite for emoji (or fallback)
      size = randomBetween(CONFIG.emojiMinSize, CONFIG.emojiMaxSize);
      const texture = createCharTexture(content);

      material = new THREE.SpriteMaterial({
        map: texture,
        color: kind === "emoji" ? 0xffffff : color,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        sizeAttenuation: true,
      });

      object3d = new THREE.Sprite(material);
      object3d.scale.set(size, size, 1);
      object3d.position.set(x, y, z);
    }

    scene.add(object3d);

    const spriteData = {
      id: nextId++,
      content,
      kind,
      colorName,
      object3d,
      material,
      is3D,
      size,
      x, y, z,
      createdAt: clockMs,
      lifetimeMs: CONFIG.spriteLifetimeMs,
      // Motion parameters
      rotX: randomBetween(-0.3, 0.3),
      rotY: randomBetween(-0.3, 0.3),
      rotZ: randomBetween(-14, 14) * (Math.PI / 180),
      spinZ: randomBetween(-CONFIG.maxSpin, CONFIG.maxSpin) * (Math.PI / 180),
      tumbleX: reducedMotion ? 0 : randomBetween(-2.5, 2.5),
      tumbleY: reducedMotion ? 0 : randomBetween(-2.5, 2.5),
      driftX: reducedMotion ? randomBetween(-0.1, 0.1) : randomBetween(-0.6, 0.6),
      driftY: reducedMotion ? randomBetween(-0.2, -0.05) : randomBetween(-1.2, -0.3),
      driftZ: reducedMotion ? randomBetween(-0.05, 0.05) : randomBetween(-0.4, 0.4),
      wobbleX: reducedMotion ? randomBetween(0.01, 0.05) : randomBetween(0.05, 0.18),
      wobbleY: reducedMotion ? randomBetween(0.01, 0.08) : randomBetween(0.1, 0.26),
      wobbleSpeed: randomBetween(2.2, 4.8),
      floatSpeed: randomBetween(1.4, 3.1),
      pulseSpeed: randomBetween(2.6, 5.2),
      pulseAmount: reducedMotion ? randomBetween(0.006, 0.012) : randomBetween(0.015, 0.045),
      phase: randomBetween(0, Math.PI * 2),
      // Soft repulsion offset (accumulated each frame)
      repelX: 0,
      repelY: 0,
      repelZ: 0,
    };

    activeSprites.push(spriteData);

    while (activeSprites.length > CONFIG.maxSprites) {
      removeSprite(activeSprites[0]);
    }

    return spriteData;
  }

  function removeSprite(spriteData) {
    const index = activeSprites.findIndex((s) => s.id === spriteData.id);
    if (index >= 0) {
      activeSprites.splice(index, 1);
    }
    scene.remove(spriteData.object3d);
    spriteData.material.dispose();
  }

  function updateSprites(totalClockMs) {
    clockMs = totalClockMs;
    const expired = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Soft repulsion pass — gently push overlapping sprites apart
    const rRadius = CONFIG.repelRadius;
    const rStrength = CONFIG.repelStrength;
    for (let i = 0; i < activeSprites.length; i++) {
      const a = activeSprites[i];
      for (let j = i + 1; j < activeSprites.length; j++) {
        const b = activeSprites[j];
        const dx = a.object3d.position.x - b.object3d.position.x;
        const dy = a.object3d.position.y - b.object3d.position.y;
        const dz = a.object3d.position.z - b.object3d.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minDist = rRadius * (a.size + b.size) * 0.5;
        if (dist < minDist && dist > 0.01) {
          const overlap = 1 - dist / minDist;
          const force = overlap * rStrength;
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;
          a.repelX += nx * force;
          a.repelY += ny * force;
          a.repelZ += nz * force * 0.3;
          b.repelX -= nx * force;
          b.repelY -= ny * force;
          b.repelZ -= nz * force * 0.3;
        }
      }
    }

    for (const s of activeSprites) {
      const age = clockMs - s.createdAt;

      // ── Pop/burst animation ────────────────────────────────────────
      if (s.popping) {
        const popAge = clockMs - s.popStartMs;

        // Still waiting for stagger delay — fall through to normal render
        if (popAge >= 0) {
          // Fire burst particles once at the moment the pop starts
          if (!s.popBurstFired) {
            s.popBurstFired = true;
            if (s.onBurst) {
              const pos = s.object3d.position;
              s.onBurst(pos.x, pos.y, pos.z, s.material.color);
            }
          }

          if (popAge >= s.popDurationMs) {
            expired.push(s);
            continue;
          }

          const p = popAge / s.popDurationMs;
          // Quick scale-up in first 25%, then shrink to 0
          const popScale = p < 0.25
            ? s.size * (1 + easeOutBack(p / 0.25) * 0.6)
            : s.size * 1.6 * (1 - Math.pow((p - 0.25) / 0.75, 1.5));

          if (s.is3D) {
            s.object3d.scale.setScalar(Math.max(0, popScale));
          } else {
            s.object3d.scale.set(Math.max(0, popScale), Math.max(0, popScale), 1);
          }

          // Burst outward + spin
          s.object3d.position.set(
            s.object3d.position.x + s.burstX * 0.06,
            s.object3d.position.y + s.burstY * 0.06,
            s.object3d.position.z
          );
          if (s.is3D) {
            s.object3d.rotation.z += s.burstSpin * 0.02;
          } else {
            s.material.rotation += s.burstSpin * 0.02;
          }

          // Fade out
          s.material.opacity = 1 - Math.pow(p, 0.8);
          continue;
        }
      }

      // ── Normal lifecycle ───────────────────────────────────────────
      if (age >= s.lifetimeMs) {
        expired.push(s);
        continue;
      }

      const ageRatio = clamp(age / s.lifetimeMs, 0, 1);
      const introRatio = clamp(age / CONFIG.introDurationMs, 0, 1);
      const exitRatio = clamp(
        (ageRatio - CONFIG.exitStartRatio) / (1 - CONFIG.exitStartRatio),
        0,
        1
      );
      const loopRatio = age / 1000;

      // Scale: intro bounce + pulse + exit shrink
      const pulse = 1 + Math.sin(loopRatio * s.pulseSpeed) * s.pulseAmount * (1 - exitRatio * 0.55);
      const scaleMultiplier =
        (age < CONFIG.introDurationMs ? easeOutBack(introRatio) : 1 - exitRatio * 0.12) * pulse;
      const currentSize = s.size * scaleMultiplier;

      if (s.is3D) {
        s.object3d.scale.setScalar(currentSize);
      } else {
        s.object3d.scale.set(currentSize, currentSize, 1);
      }

      // Opacity: fade out during exit
      const opacity = 1 - Math.pow(exitRatio, reducedMotion ? 1.3 : 1.8);
      s.material.opacity = opacity;

      // Position: wobble + drift on exit + repulsion
      const bobX = Math.sin(loopRatio * s.wobbleSpeed + s.phase) * s.wobbleX;
      const bobY = Math.cos(loopRatio * s.floatSpeed + s.phase) * s.wobbleY;
      const xOffset = bobX + s.driftX * exitRatio + s.repelX;
      const yOffset = bobY + s.driftY * exitRatio + s.repelY;
      const zOffset = s.driftZ * exitRatio + s.repelZ;

      s.object3d.position.set(s.x + xOffset, s.y + yOffset, s.z + zOffset);

      // Decay repulsion smoothly
      s.repelX *= 0.92;
      s.repelY *= 0.92;
      s.repelZ *= 0.92;

      // Rotation
      if (s.is3D) {
        // Full 3D tumble for text meshes
        s.object3d.rotation.x = s.rotX + s.tumbleX * exitRatio +
          Math.sin(loopRatio * s.wobbleSpeed * 0.5 + s.phase) * 0.15;
        s.object3d.rotation.y = s.rotY + s.tumbleY * exitRatio +
          Math.cos(loopRatio * s.wobbleSpeed * 0.4 + s.phase) * 0.15;
        s.object3d.rotation.z = s.rotZ + s.spinZ * exitRatio +
          Math.sin(loopRatio * s.wobbleSpeed + s.phase) * 0.08;
      } else {
        // 2D rotation for flat sprites
        s.material.rotation =
          s.rotZ + s.spinZ * exitRatio +
          Math.sin(loopRatio * s.wobbleSpeed + s.phase) * 0.08;
      }
    }

    for (const s of expired) {
      removeSprite(s);
    }
  }

  function getState() {
    return activeSprites.map((s) => ({
      id: s.id,
      content: s.content,
      kind: s.kind,
      is3D: s.is3D,
      x: Number(s.object3d.position.x.toFixed(2)),
      y: Number(s.object3d.position.y.toFixed(2)),
      z: Number(s.object3d.position.z.toFixed(2)),
      size: Number(s.size.toFixed(2)),
      color: s.colorName,
      remainingMs: Math.max(0, Math.round(s.lifetimeMs - (clockMs - s.createdAt))),
    }));
  }

  // ── Spacebar pop/burst effect ──────────────────────────────────────
  // Each sprite gets a staggered "pop" — quick scale up then rapid shrink + fade

  function popAll(onBurst) {
    const count = activeSprites.length;
    if (count === 0) return;

    // Stagger: 40ms between each sprite, random order
    const shuffled = [...activeSprites].sort(() => Math.random() - 0.5);
    const staggerMs = 40;

    shuffled.forEach((s, i) => {
      const delay = i * staggerMs;
      s.popStartMs = clockMs + delay;
      s.popDurationMs = 320;
      s.popping = true;
      s.popBurstFired = false;
      s.onBurst = onBurst || null;
      // Give each a random burst direction
      s.burstX = (Math.random() - 0.5) * 3;
      s.burstY = (Math.random() - 0.5) * 3;
      s.burstSpin = (Math.random() - 0.5) * 12;
    });
  }

  return {
    spawnSprite,
    updateSprites,
    popAll,
    getState,
    get count() { return activeSprites.length; },
    get clockMs() { return clockMs; },
  };
}
