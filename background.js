import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;

  // Simplex-style noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.08;

    // Base dark blue gradient
    vec3 bgTop = vec3(0.031, 0.067, 0.122);    // #08111f
    vec3 bgBottom = vec3(0.067, 0.122, 0.22);   // #111f38
    vec3 bgDeep = vec3(0.016, 0.035, 0.078);    // #040914
    vec3 bg = mix(bgTop, bgBottom, uv.y * 0.6);
    bg = mix(bg, bgDeep, smoothstep(0.5, 1.0, uv.y));

    // Organic noise blobs
    float n1 = snoise(uv * 1.8 + vec2(t * 0.7, t * 0.5)) * 0.5 + 0.5;
    float n2 = snoise(uv * 2.4 + vec2(-t * 0.6, t * 0.8) + 5.0) * 0.5 + 0.5;
    float n3 = snoise(uv * 1.5 + vec2(t * 0.4, -t * 0.6) + 10.0) * 0.5 + 0.5;

    // Color accents matching the original palette
    vec3 coral = vec3(1.0, 0.384, 0.573);    // #ff6292 (warm pink)
    vec3 cyan = vec3(0.259, 0.839, 1.0);     // #42d6ff (bright cyan)
    vec3 gold = vec3(1.0, 0.808, 0.329);     // #ffce54 (warm gold)
    vec3 purple = vec3(0.545, 0.408, 1.0);   // #8b68ff (soft purple)

    // Position-based blob masks with noise
    float blob1 = smoothstep(0.6, 0.2, length(uv - vec2(0.15 + sin(t) * 0.08, 0.25 + cos(t * 0.7) * 0.1)));
    float blob2 = smoothstep(0.55, 0.15, length(uv - vec2(0.85 + cos(t * 0.8) * 0.06, 0.35 + sin(t * 0.9) * 0.08)));
    float blob3 = smoothstep(0.65, 0.2, length(uv - vec2(0.45 + sin(t * 0.6) * 0.1, 0.85 + cos(t * 1.1) * 0.06)));

    // Blend colored blobs into background
    vec3 color = bg;
    color += coral * blob1 * n1 * 0.10;
    color += cyan * blob2 * n2 * 0.09;
    color += gold * blob3 * n3 * 0.07;

    // Subtle flowing ribbons via elongated noise
    float ribbon1 = snoise(vec2(uv.x * 3.0 + t * 0.3, uv.y * 0.8 - t * 0.2));
    float ribbon2 = snoise(vec2(uv.x * 0.7 - t * 0.25, uv.y * 3.5 + t * 0.35));
    color += purple * smoothstep(0.3, 0.7, ribbon1) * 0.03;
    color += cyan * smoothstep(0.35, 0.75, ribbon2) * 0.025;

    // Subtle top radial highlight
    float topGlow = smoothstep(0.7, 0.0, length(uv - vec2(0.5, 0.0)));
    color += vec3(1.0) * topGlow * 0.015;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createBackground(scene) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    },
    depthWrite: false,
    depthTest: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  scene.add(mesh);

  return {
    mesh,
    update(timeSeconds) {
      material.uniforms.uTime.value = timeSeconds;
    },
    resize(width, height) {
      material.uniforms.uResolution.value.set(width, height);
    },
  };
}
