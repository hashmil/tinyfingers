import * as THREE from "three";

const PARTICLE_COUNT = 450;
const SPREAD_X = 16;
const SPREAD_Y = 10;
const SPREAD_Z = 14;

// Bright colors that catch bloom for sparkle effect
const COLORS = [
  new THREE.Color(0xffb0cc), // coral (brighter)
  new THREE.Color(0x88ccff), // sky (brighter)
  new THREE.Color(0xffe080), // sun (brighter)
  new THREE.Color(0x80f0b0), // mint (brighter)
  new THREE.Color(0xc8a8ff), // grape (brighter)
  new THREE.Color(0x90fff6), // bubble (brighter)
  new THREE.Color(0xffffff), // white sparkle
  new THREE.Color(0xfff4cc), // warm white
];

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
  { name: "circle", create: () => createCircleGeometry(0.05), weight: 0.30 },
  { name: "square", create: () => new THREE.PlaneGeometry(0.08, 0.08), weight: 0.25 },
  { name: "star", create: () => createStarGeometry(0.06, 0.025, 4), weight: 0.15 },
  { name: "diamond", create: () => createDiamondGeometry(0.08), weight: 0.15 },
  { name: "triangle", create: () => createTriangleGeometry(0.09), weight: 0.15 },
];

export function createParticleSystem(scene) {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // Distribute particles across shapes by weight
  const groups = [];
  let remaining = PARTICLE_COUNT;
  for (let s = 0; s < SHAPE_CONFIGS.length; s++) {
    const cfg = SHAPE_CONFIGS[s];
    const count = s === SHAPE_CONFIGS.length - 1
      ? remaining
      : Math.round(PARTICLE_COUNT * cfg.weight);
    remaining -= count;

    const geo = cfg.create();
    const mesh = new THREE.InstancedMesh(geo, material, count);
    mesh.renderOrder = -500;
    groups.push({ mesh, count, offset: PARTICLE_COUNT - remaining - count });
    scene.add(mesh);
  }

  const dummy = new THREE.Object3D();
  const particleData = [];

  let groupIdx = 0;
  let withinGroup = 0;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Advance to next group if needed
    while (groupIdx < groups.length && withinGroup >= groups[groupIdx].count) {
      withinGroup = 0;
      groupIdx++;
    }

    const x = (Math.random() - 0.5) * SPREAD_X;
    const y = (Math.random() - 0.5) * SPREAD_Y;
    const z = (Math.random() - 0.5) * SPREAD_Z - 3;
    const size = 0.3 + Math.random() * 1.2;

    // ~15% of particles are "sparklers" that twinkle
    const isSparkle = Math.random() < 0.15;
    // Lifecycle: each particle lives 6-18s, then respawns
    const lifetime = 6 + Math.random() * 12;
    // Stagger births so they don't all appear at once
    const birthTime = -Math.random() * lifetime;

    particleData.push({
      x, y, z,
      baseX: x,
      baseY: y,
      baseZ: z,
      size,
      groupIdx,
      localIdx: withinGroup,
      driftSpeedX: (Math.random() - 0.5) * 0.06,
      driftSpeedY: 0.01 + Math.random() * 0.04,
      driftSpeedZ: (Math.random() - 0.5) * 0.02,
      wobbleSpeed: 0.3 + Math.random() * 1.2,
      wobbleAmount: 0.05 + Math.random() * 0.2,
      rotSpeed: (Math.random() - 0.5) * 1.5,
      phase: Math.random() * Math.PI * 2,
      isSparkle,
      sparkleSpeed: 1.5 + Math.random() * 4.0,
      sparklePhase: Math.random() * Math.PI * 2,
      lifetime,
      birthTime,
      currentRot: Math.random() * Math.PI * 2,
    });

    dummy.position.set(x, y, z);
    dummy.scale.setScalar(size);
    dummy.rotation.z = Math.random() * Math.PI * 2;
    dummy.updateMatrix();
    groups[groupIdx].mesh.setMatrixAt(withinGroup, dummy.matrix);

    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    groups[groupIdx].mesh.setColorAt(withinGroup, color);

    withinGroup++;
  }

  for (const g of groups) {
    g.mesh.instanceMatrix.needsUpdate = true;
    if (g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true;
  }

  return {
    meshes: groups.map((g) => g.mesh),
    update(timeSeconds, reducedMotion) {
      const speed = reducedMotion ? 0.15 : 1.0;
      const FADE_DUR = 0.8; // seconds for fade in/out

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particleData[i];
        const t = timeSeconds * speed;

        // Lifecycle: age since birth
        const age = t - p.birthTime;
        if (age < 0) {
          // Not yet born — hide
          dummy.scale.setScalar(0);
          dummy.position.set(p.baseX, p.baseY, p.baseZ);
          dummy.updateMatrix();
          groups[p.groupIdx].mesh.setMatrixAt(p.localIdx, dummy.matrix);
          continue;
        }

        if (age > p.lifetime) {
          // Respawn at new position
          p.baseX = (Math.random() - 0.5) * SPREAD_X;
          p.baseY = (Math.random() - 0.5) * SPREAD_Y;
          p.baseZ = (Math.random() - 0.5) * SPREAD_Z - 3;
          p.birthTime = t;
          p.lifetime = 6 + Math.random() * 12;
          p.phase = Math.random() * Math.PI * 2;
          p.size = 0.3 + Math.random() * 1.2;
          // New random color on respawn
          const color = COLORS[Math.floor(Math.random() * COLORS.length)];
          groups[p.groupIdx].mesh.setColorAt(p.localIdx, color);
          groups[p.groupIdx].mesh.instanceColor.needsUpdate = true;
          continue;
        }

        // Fade envelope: smooth in and out
        const fadeIn = Math.min(age / FADE_DUR, 1);
        const fadeOut = Math.min((p.lifetime - age) / FADE_DUR, 1);
        const lifeFade = fadeIn * fadeOut;

        const wobbleX = Math.sin(t * p.wobbleSpeed + p.phase) * p.wobbleAmount;
        const wobbleY = Math.cos(t * p.wobbleSpeed * 0.7 + p.phase) * p.wobbleAmount * 0.6;

        p.y = p.baseY + ((t * p.driftSpeedY + p.phase * 10) % (SPREAD_Y * 1.5));
        if (p.y > SPREAD_Y / 2) p.y -= SPREAD_Y * 1.5;

        dummy.position.set(
          p.baseX + wobbleX + Math.sin(t * p.driftSpeedX * 2 + p.phase) * 0.5,
          p.y + wobbleY,
          p.baseZ + Math.sin(t * p.driftSpeedZ * 2 + p.phase) * 0.3
        );

        // Depth fade: particles further back are smaller and softer
        const zPos = dummy.position.z;
        const depthFade = Math.max(0.15, Math.min(1.0, (zPos + 10) / 12));

        // Sparkle: pulse size up briefly to create twinkle
        let s = p.size * lifeFade * depthFade;
        if (p.isSparkle) {
          const sparkle = Math.pow(Math.max(0, Math.sin(t * p.sparkleSpeed + p.sparklePhase)), 8);
          s *= 1.0 + sparkle * 1.4;
        }
        dummy.scale.setScalar(s);
        p.currentRot += p.rotSpeed * 0.005 * speed;
        dummy.rotation.z = p.currentRot;
        dummy.updateMatrix();
        groups[p.groupIdx].mesh.setMatrixAt(p.localIdx, dummy.matrix);
      }

      for (const g of groups) {
        g.mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
