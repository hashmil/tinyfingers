import * as THREE from "three";

// ── Config ────────────────────────────────────────────────────────────

const PARTICLES_PER_BURST = 14;
const MAX_BURSTS = 20; // max simultaneous bursts
const POOL_SIZE = PARTICLES_PER_BURST * MAX_BURSTS;
const BURST_LIFETIME = 0.5; // seconds

const BURST_COLORS = [
  new THREE.Color(0xff3377), // hot pink
  new THREE.Color(0xffdd00), // yellow
  new THREE.Color(0x33ff66), // green
  new THREE.Color(0x22ccff), // cyan
  new THREE.Color(0xff6622), // orange
  new THREE.Color(0xc8a8ff), // lavender
  new THREE.Color(0xffffff), // white sparkle
];

// ── Shapes ────────────────────────────────────────────────────────────

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

// ── Burst system ──────────────────────────────────────────────────────

export function createBurstSystem(scene) {
  // Mix of circles and tiny stars
  const circleGeo = new THREE.CircleGeometry(0.12, 8);
  const starGeo = createStarGeometry(0.15, 0.06, 5);

  const circleMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const starMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const circleCount = Math.floor(POOL_SIZE * 0.6);
  const starCount = POOL_SIZE - circleCount;

  const circleMesh = new THREE.InstancedMesh(circleGeo, circleMat, circleCount);
  const starMesh = new THREE.InstancedMesh(starGeo, starMat, starCount);
  circleMesh.renderOrder = 200;
  starMesh.renderOrder = 200;
  scene.add(circleMesh);
  scene.add(starMesh);

  const dummy = new THREE.Object3D();

  // Particle pool
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const isStar = i >= circleCount;
    pool.push({
      alive: false,
      birthTime: 0,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      scale: 0,
      rot: 0,
      rotSpeed: 0,
      mesh: isStar ? starMesh : circleMesh,
      localIdx: isStar ? i - circleCount : i,
      gravity: 0,
    });
  }

  // Hide all initially
  for (const p of pool) {
    dummy.scale.setScalar(0);
    dummy.position.set(0, 0, -50);
    dummy.updateMatrix();
    p.mesh.setMatrixAt(p.localIdx, dummy.matrix);
    p.mesh.setColorAt(p.localIdx, new THREE.Color(0xffffff));
  }
  circleMesh.instanceMatrix.needsUpdate = true;
  starMesh.instanceMatrix.needsUpdate = true;
  if (circleMesh.instanceColor) circleMesh.instanceColor.needsUpdate = true;
  if (starMesh.instanceColor) starMesh.instanceColor.needsUpdate = true;

  let nextIdx = 0;

  function burst(worldX, worldY, worldZ, color) {
    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      const p = pool[nextIdx];
      nextIdx = (nextIdx + 1) % POOL_SIZE;

      p.alive = true;
      p.birthTime = -1; // set on first update
      p.x = worldX;
      p.y = worldY;
      p.z = worldZ || 0;

      // Radial burst with some randomness
      const angle = (i / PARTICLES_PER_BURST) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const speed = 2.5 + Math.random() * 3.5;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.vz = (Math.random() - 0.5) * 1.5;

      p.scale = 0.3 + Math.random() * 0.5;
      p.rot = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 8;
      p.gravity = 2 + Math.random() * 2;

      // Pick a burst color, sometimes use the sprite's own color
      const burstColor = Math.random() < 0.4
        ? (color || BURST_COLORS[0])
        : BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];
      p.mesh.setColorAt(p.localIdx, burstColor);
    }

    circleMesh.instanceColor.needsUpdate = true;
    starMesh.instanceColor.needsUpdate = true;
  }

  function update(timeSeconds) {
    let anyUpdated = false;

    for (const p of pool) {
      if (!p.alive) continue;

      if (p.birthTime < 0) p.birthTime = timeSeconds;

      const age = timeSeconds - p.birthTime;
      if (age > BURST_LIFETIME) {
        p.alive = false;
        dummy.scale.setScalar(0);
        dummy.position.set(0, 0, -50);
        dummy.updateMatrix();
        p.mesh.setMatrixAt(p.localIdx, dummy.matrix);
        anyUpdated = true;
        continue;
      }

      const progress = age / BURST_LIFETIME;

      // Decelerate + gravity
      const drag = 1 - progress * 0.6;
      const posX = p.x + p.vx * age * drag;
      const posY = p.y + p.vy * age * drag - p.gravity * age * age * 0.5;
      const posZ = p.z + p.vz * age * drag;

      // Scale: pop in then shrink
      const popIn = Math.min(age / 0.04, 1);
      const fadeOut = 1 - Math.pow(progress, 0.6);
      const scale = p.scale * popIn * fadeOut;

      dummy.position.set(posX, posY, posZ);
      dummy.scale.setScalar(Math.max(0, scale));
      dummy.rotation.z = p.rot + p.rotSpeed * age;
      dummy.updateMatrix();
      p.mesh.setMatrixAt(p.localIdx, dummy.matrix);
      anyUpdated = true;
    }

    if (anyUpdated) {
      circleMesh.instanceMatrix.needsUpdate = true;
      starMesh.instanceMatrix.needsUpdate = true;
    }
  }

  return { burst, update };
}
