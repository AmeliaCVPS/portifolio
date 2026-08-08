import * as THREE from 'https://unpkg.com/three@0.185.1/build/three.module.js';

const MAX_COLORS = 8;

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
#define MAX_COLORS ${MAX_COLORS}
uniform vec2 uCanvas;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRot;
uniform int uColorCount;
uniform vec3 uColors[MAX_COLORS];
uniform float uScale;
uniform float uFrequency;
uniform float uWarpStrength;
uniform vec2 uPointer;
uniform float uMouseInfluence;
uniform float uParallax;
uniform float uNoise;
uniform int uIterations;
uniform float uIntensity;
uniform float uBandWidth;
varying vec2 vUv;

void main() {
  float t = uTime * uSpeed;
  vec2 p = vUv * 2.0 - 1.0;
  p += uPointer * uParallax * 0.1;
  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
  q /= max(uScale, 0.0001);
  q /= 0.5 + 0.2 * dot(q, q);
  q += 0.2 * cos(t) - 7.56;
  q += (uPointer - rp) * uMouseInfluence * 0.2;

  for (int j = 0; j < 5; j++) {
    if (j >= uIterations - 1) break;
    vec2 rr = sin(1.5 * (q.yx * uFrequency) + 2.0 * cos(q * uFrequency));
    q += (rr - q) * 0.15;
  }

  vec2 s = q;
  vec3 sumCol = vec3(0.0);
  float cover = 0.0;

  for (int i = 0; i < MAX_COLORS; ++i) {
    if (i >= uColorCount) break;
    s -= 0.01;
    vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
    float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
    float kBelow = clamp(uWarpStrength, 0.0, 1.0);
    float kMix = pow(kBelow, 0.3);
    float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
    vec2 warped = s + (r - s) * kBelow * gain;
    float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
    float m = mix(m0, m1, kMix);
    float w = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));
    sumCol += uColors[i] * w;
    cover = max(cover, w);
  }

  vec3 col = clamp(sumCol, 0.0, 1.0) * uIntensity;

  if (uNoise > 0.0001) {
    float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
    col = clamp(col + (n - 0.5) * uNoise, 0.0, 1.0);
  }

  gl_FragColor = vec4(col * cover, cover);
}
`;

function hexToVec3(hex) {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.replace(/./g, c => c + c) : h;
  return new THREE.Vector3(
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255
  );
}

export function initColorBends(container, options = {}) {
  const {
    colors = ['#6E1F2A', '#A63D40', '#C97B5A'],
    rotation = 115,
    speed = 0.4,
    scale = 1,
    frequency = 1.8,
    warpStrength = 1,
    mouseInfluence = 1,
    parallax = 0.5,
    noise = 0.18,
    iterations = 1,
    intensity = 1.4,
    bandWidth = 6,
    maxPixelRatio = 2
  } = options;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);

  const colorVecs = Array.from({ length: MAX_COLORS }, () => new THREE.Vector3());
  colors.slice(0, MAX_COLORS).forEach((hex, i) => colorVecs[i].copy(hexToVec3(hex)));

  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uCanvas: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uRot: { value: new THREE.Vector2(1, 0) },
      uColorCount: { value: Math.min(colors.length, MAX_COLORS) },
      uColors: { value: colorVecs },
      uScale: { value: scale },
      uFrequency: { value: frequency },
      uWarpStrength: { value: warpStrength },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uMouseInfluence: { value: mouseInfluence },
      uParallax: { value: parallax },
      uNoise: { value: noise },
      uIterations: { value: iterations },
      uIntensity: { value: intensity },
      uBandWidth: { value: bandWidth }
    },
    premultipliedAlpha: true,
    transparent: true
  });

  scene.add(new THREE.Mesh(geometry, material));

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
  renderer.setClearColor(0x000000, 0);
  Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' });
  container.appendChild(renderer.domElement);

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    material.uniforms.uCanvas.value.set(w, h);
  };
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const pointerTarget = new THREE.Vector2();
  const pointerCurrent = new THREE.Vector2();
  const onPointerMove = e => {
    const rect = container.getBoundingClientRect();
    pointerTarget.set(
      ((e.clientX - rect.left) / (rect.width || 1)) * 2 - 1,
      -(((e.clientY - rect.top) / (rect.height || 1)) * 2 - 1)
    );
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  const rad = (rotation * Math.PI) / 180;
  material.uniforms.uRot.value.set(Math.cos(rad), Math.sin(rad));

  let rafId = null;
  let running = false;
  let elapsed = 0;
  let last = 0;

  const loop = now => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    material.uniforms.uTime.value = elapsed;
    pointerCurrent.lerp(pointerTarget, Math.min(1, dt * 8));
    material.uniforms.uPointer.value.copy(pointerCurrent);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
  };

  const start = () => {
    if (running) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(loop);
  };

  const stop = () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
  };

  // A single frame so the hero is never an empty rectangle while paused.
  renderer.render(scene, camera);

  return {
    start,
    stop,
    destroy() {
      stop();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
  };
}
