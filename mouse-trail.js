import * as THREE from "three";

const POOL_SIZE = 150;
const LIFETIME = 1.2; // seconds
const SPAWN_INTERVAL = 10; // ms

// Vivid rainbow colors — punchy and saturated
const TRAIL_COLORS = [
  new THREE.Color(0xff3377), // hot pink
  new THREE.Color(0xff6622), // orange
  new THREE.Color(0xffdd00), // yellow
  new THREE.Color(0x33ff66), // green
  new THREE.Color(0x22ccff), // cyan
  new THREE.Color(0x6644ff), // purple
  new THREE.Color(0xff44cc), // magenta
  new THREE.Color(0x44ffaa), // aqua
  new THREE.Color(0xff8844), // tangerine
  new THREE.Color(0xaabb00), // lime
];
const WHITE = new THREE.Color(0xffffff);

// ── Shape helpers (same as particles.js) ──────────────────────────────

function createCircleGeometry(radius) {
  return new THREE.CircleGeometry(radius, 16);
}

function createTriangleGeometry(size) {
  const shape = new THREE.Shape();
  const h = size * 0.866;
  shape.moveTo(0, h * 0.66);
  shape.lineTo(-size / 2, -h * 0.33);
  shape.lineTo(size / 2, -h * 0.33);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function createStarGeometry(outerR, innerR, points) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function createDiamondGeometry(size) {
  const shape = new THREE.Shape();
  shape.moveTo(0, size * 0.6);
  shape.lineTo(-size * 0.4, 0);
  shape.lineTo(0, -size * 0.6);
  shape.lineTo(size * 0.4, 0);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

const SHAPE_CONFIGS = [
  { create: () => createCircleGeometry(0.25), weight: 0.25 },
  { create: () => new THREE.PlaneGeometry(0.4, 0.4), weight: 0.20 },
  { create: () => createStarGeometry(0.35, 0.14, 5), weight: 0.20 },
  { create: () => createDiamondGeometry(0.35), weight: 0.15 },
  { create: () => createTriangleGeometry(0.4), weight: 0.20 },
];

// ── Trail system ──────────────────────────────────────────────────────

export function createMouseTrail(scene, camera) {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // Build instanced meshes per shape, distributed by weight
  const groups = [];
  let remaining = POOL_SIZE;
  for (let s = 0; s < SHAPE_CONFIGS.length; s++) {
    const cfg = SHAPE_CONFIGS[s];
    const count = s === SHAPE_CONFIGS.length - 1
      ? remaining
      : Math.round(POOL_SIZE * cfg.weight);
    remaining -= count;

    const geo = cfg.create();
    const mesh = new THREE.InstancedMesh(geo, material, count);
    mesh.renderOrder = 100; // above background particles
    groups.push({ mesh, count });
    scene.add(mesh);
  }

  const dummy = new THREE.Object3D();

  // Per-particle state
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    pool.push({
      alive: false,
      birthTime: 0,
      x: 0, y: 0, z: 0,
      scale: 0,
      driftX: 0, driftY: 0,
      rotSpeed: 0,
      rot: 0,
      groupIdx: 0,
      localIdx: 0,
    });
  }

  // Map flat index → (groupIdx, localIdx)
  let gi = 0, li = 0;
  for (let i = 0; i < POOL_SIZE; i++) {
    while (gi < groups.length && li >= groups[gi].count) {
      li = 0;
      gi++;
    }
    pool[i].groupIdx = gi;
    pool[i].localIdx = li;

    // Start all particles at scale 0 (hidden)
    dummy.scale.setScalar(0);
    dummy.position.set(0, 0, -50);
    dummy.updateMatrix();
    groups[gi].mesh.setMatrixAt(li, dummy.matrix);
    groups[gi].mesh.setColorAt(li, WHITE);
    li++;
  }
  for (const g of groups) {
    g.mesh.instanceMatrix.needsUpdate = true;
    if (g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true;
  }

  let nextIdx = 0; // ring buffer pointer
  let colorIdx = 0; // rainbow cycle
  let lastSpawnTime = 0;

  // Convert screen (px) → world position at z=0
  function screenToWorld(screenX, screenY) {
    const ndcX = (screenX / window.innerWidth) * 2 - 1;
    const ndcY = -(screenY / window.innerHeight) * 2 + 1;

    // Project from NDC to world at z=0 plane
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfW = halfH * camera.aspect;

    return {
      x: ndcX * halfW,
      y: ndcY * halfH,
    };
  }

  function spawn(screenX, screenY, timeSeconds, reducedMotion) {
    const pos = screenToWorld(screenX, screenY);
    const scatter = reducedMotion ? 0.1 : 0.5;

    const p = pool[nextIdx];
    p.alive = true;
    p.birthTime = timeSeconds;
    p.x = pos.x + (Math.random() - 0.5) * scatter * 2;
    p.y = pos.y + (Math.random() - 0.5) * scatter * 2;
    p.z = (Math.random() - 0.5) * 0.5;
    p.scale = 0.8 + Math.random() * 1.2;
    p.driftX = (Math.random() - 0.5) * 1.5;
    p.driftY = (Math.random() - 0.5) * 1.5;
    p.rotSpeed = (Math.random() - 0.5) * 5;
    p.rot = Math.random() * Math.PI * 2;

    // Color: rainbow cycle with occasional white sparkle
    const color = Math.random() < 0.05
      ? WHITE
      : TRAIL_COLORS[colorIdx % TRAIL_COLORS.length];
    groups[p.groupIdx].mesh.setColorAt(p.localIdx, color);
    groups[p.groupIdx].mesh.instanceColor.needsUpdate = true;

    colorIdx++;
    nextIdx = (nextIdx + 1) % POOL_SIZE;
  }

  return {
    handleMove(screenX, screenY, timeMs, reducedMotion) {
      if (timeMs - lastSpawnTime < SPAWN_INTERVAL) return;
      lastSpawnTime = timeMs;
      spawn(screenX, screenY, timeMs / 1000, reducedMotion);
    },

    update(timeSeconds) {
      for (let i = 0; i < POOL_SIZE; i++) {
        const p = pool[i];
        if (!p.alive) {
          dummy.scale.setScalar(0);
          dummy.position.set(0, 0, -50);
          dummy.updateMatrix();
          groups[p.groupIdx].mesh.setMatrixAt(p.localIdx, dummy.matrix);
          continue;
        }

        const age = timeSeconds - p.birthTime;
        if (age > LIFETIME) {
          p.alive = false;
          dummy.scale.setScalar(0);
          dummy.position.set(0, 0, -50);
          dummy.updateMatrix();
          groups[p.groupIdx].mesh.setMatrixAt(p.localIdx, dummy.matrix);
          continue;
        }

        const progress = age / LIFETIME;
        // Pop in quickly, then fade out smoothly
        const popIn = Math.min(age / 0.08, 1); // fast 80ms pop
        const fadeOut = 1 - Math.pow(progress, 0.4);
        const scaleFactor = popIn * fadeOut;

        dummy.position.set(
          p.x + p.driftX * age,
          p.y + p.driftY * age,
          p.z
        );
        dummy.scale.setScalar(p.scale * scaleFactor);
        p.rot += p.rotSpeed * 0.016;
        dummy.rotation.z = p.rot;
        dummy.updateMatrix();
        groups[p.groupIdx].mesh.setMatrixAt(p.localIdx, dummy.matrix);
      }

      for (const g of groups) {
        g.mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
