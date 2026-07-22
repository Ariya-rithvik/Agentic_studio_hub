// Particle Logo Reveal ------------------------------------------------------
// A deterministic VFX recipe for a wordmark assembled from a single Three.js
// point cloud.  It is deliberately a browser-preview primitive rather than an
// HTML animation: the logo shape is sampled once from an offscreen canvas and
// all particle positions are a pure function of the requested frame.
//
// Select a recipe with:
//   ?scene=vfx_particle_logo&vfx=particle_logo_demo
//
// The config is intentionally small and data-only.  Missing or malformed
// values fall back to a polished default so a malformed preview URL does not
// break the render harness.

const DEFAULT = {
  version: 1,
  type: 'ParticleLogoReveal',
  render: { frames: 150, fps: 30, width: 1280, height: 720, bg: '#060716' },
  logo: {
    word: 'MOMENTUM',
    tagline: 'IDEAS INTO IMPACT',
    color: '#F8FAFC',
    accent: '#A78BFA',
    tracking: 0.075
  },
  particles: { count: 5200, size: 0.067, spread: 9.8, depth: 2.8, seed: 417 },
  reveal: { startFrame: 14, formFrame: 82, settleFrames: 16, holdFrame: 132 },
  camera: { position: [0, 0, 10.2], lookAt: [0, 0, 0] },
  effects: { glow: 1.25, scan: 1.0, pulse: 1.0 }
};

const cache = new Map();
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const clamp01 = (value) => clamp(value, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (from, to, value) => {
  const t = clamp01((value - from) / Math.max(0.0001, to - from));
  return t * t * (3 - 2 * t);
};
const outCubic = (value) => 1 - Math.pow(1 - clamp01(value), 3);
const fract = (value) => value - Math.floor(value);
const hash = (index, seed = 0) => fract(Math.sin(index * 127.1 + seed * 311.7 + 74.7) * 43758.5453123);

function merge(base, value) {
  const out = { ...base };
  if (!isObject(value)) return out;
  for (const [key, next] of Object.entries(value)) {
    out[key] = isObject(base[key]) && isObject(next) ? merge(base[key], next) : next;
  }
  return out;
}

function sceneName() {
  const raw = new URLSearchParams(location.search).get('vfx') || 'particle_logo_demo';
  // The parameter becomes part of a fetch path, so keep it filesystem-safe.
  return /^[a-z0-9_-]{1,80}$/i.test(raw) ? raw : 'particle_logo_demo';
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

function integer(value, fallback, min, max) {
  return Math.round(number(value, fallback, min, max));
}

function color(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value)
    ? value : fallback;
}

function text(value, fallback, maxLength) {
  const normalized = String(value ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, maxLength);
  return normalized || fallback;
}

function vector(value, fallback) {
  if (!Array.isArray(value) || value.length < 3) return fallback.slice();
  return [
    number(value[0], fallback[0], -100, 100),
    number(value[1], fallback[1], -100, 100),
    number(value[2], fallback[2], -100, 100)
  ];
}

function normalize(raw) {
  const d = merge(DEFAULT, raw);
  const render = d.render || {};
  const logo = d.logo || {};
  const particles = d.particles || {};
  const reveal = d.reveal || {};
  const camera = d.camera || {};
  const effects = d.effects || {};
  const normalizedRender = {
    frames: integer(render.frames, DEFAULT.render.frames, 24, 900),
    fps: integer(render.fps, DEFAULT.render.fps, 12, 60),
    width: integer(render.width, DEFAULT.render.width, 320, 3840),
    height: integer(render.height, DEFAULT.render.height, 180, 2160),
    bg: color(render.bg, DEFAULT.render.bg)
  };
  const startFrame = integer(reveal.startFrame, DEFAULT.reveal.startFrame, 0, normalizedRender.frames - 10);
  const formFrame = integer(reveal.formFrame, DEFAULT.reveal.formFrame, startFrame + 6, normalizedRender.frames - 3);
  return {
    version: integer(d.version, DEFAULT.version, 1, 1),
    type: d.type === 'ParticleLogoReveal' ? d.type : DEFAULT.type,
    render: normalizedRender,
    logo: {
      word: text(logo.word, DEFAULT.logo.word, 24),
      tagline: text(logo.tagline, DEFAULT.logo.tagline, 72),
      color: color(logo.color, DEFAULT.logo.color),
      accent: color(logo.accent, DEFAULT.logo.accent),
      tracking: number(logo.tracking, DEFAULT.logo.tracking, 0, 0.30)
    },
    particles: {
      count: integer(particles.count, DEFAULT.particles.count, 600, 12000),
      size: number(particles.size, DEFAULT.particles.size, 0.015, 0.22),
      spread: number(particles.spread, DEFAULT.particles.spread, 3, 24),
      depth: number(particles.depth, DEFAULT.particles.depth, 0.1, 8),
      seed: integer(particles.seed, DEFAULT.particles.seed, 0, 2147483647)
    },
    reveal: {
      startFrame,
      formFrame,
      settleFrames: integer(reveal.settleFrames, DEFAULT.reveal.settleFrames, 4, 80),
      holdFrame: integer(reveal.holdFrame, DEFAULT.reveal.holdFrame, formFrame, normalizedRender.frames - 1)
    },
    camera: {
      position: vector(camera.position, DEFAULT.camera.position),
      lookAt: vector(camera.lookAt, DEFAULT.camera.lookAt)
    },
    effects: {
      glow: number(effects.glow, DEFAULT.effects.glow, 0, 4),
      scan: number(effects.scan, DEFAULT.effects.scan, 0, 3),
      pulse: number(effects.pulse, DEFAULT.effects.pulse, 0, 3)
    }
  };
}

async function loadConfig(name) {
  if (!cache.has(name)) {
    const pending = (async () => {
      try {
        const response = await fetch(`/data/vfx/${name}.json?t=${Date.now()}`);
        return normalize(response.ok ? await response.json() : {});
      } catch {
        return normalize({});
      }
    })();
    cache.set(name, pending);
  }
  const pending = cache.get(name);
  const value = await pending;
  // `create()` is synchronous in the common harness contract.  `getMeta()` is
  // always awaited first, so keep resolved configs in the cache for it.
  if (value !== pending) cache.set(name, value);
  return value;
}

export async function getMeta() {
  const d = await loadConfig(sceneName());
  return {
    id: `vfx_particle_logo:${sceneName()}`,
    frames: d.render.frames,
    fps: d.render.fps,
    width: d.render.width,
    height: d.render.height,
    bg: d.render.bg
  };
}

function makeSoftTexture(THREE, kind = 'dot') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  if (kind === 'streak') {
    const gradient = g.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.32, 'rgba(210,190,255,0.04)');
    gradient.addColorStop(0.50, 'rgba(255,255,255,0.98)');
    gradient.addColorStop(0.68, 'rgba(210,190,255,0.04)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 128, 128);
  } else {
    const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.16, 'rgba(255,255,255,0.98)');
    gradient.addColorStop(0.48, 'rgba(215,200,255,0.32)');
    gradient.addColorStop(1, 'rgba(145,104,255,0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

function makeWordTargets(word, count, tracking, seed) {
  // This uses one offscreen canvas during scene construction, not one canvas
  // per particle.  The canvas merely produces fixed sampling points; the word
  // that viewers see is the Three.js point cloud itself.
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const family = 'Arial Black, Arial, Helvetica, sans-serif';
  const chars = Array.from(word);
  let fontSize = 430;
  const widthFor = (size) => {
    g.font = `900 ${size}px ${family}`;
    return chars.reduce((sum, char) => sum + g.measureText(char).width, 0)
      + Math.max(0, chars.length - 1) * size * tracking;
  };
  while (fontSize > 62 && widthFor(fontSize) > canvas.width * 0.87) fontSize -= 8;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.font = `900 ${fontSize}px ${family}`;
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  const advance = fontSize * tracking;
  const total = widthFor(fontSize);
  let x = (canvas.width - total) * 0.5;
  const baseline = canvas.height * 0.525;
  for (const char of chars) {
    g.fillText(char, x, baseline);
    x += g.measureText(char).width + advance;
  }

  const image = g.getImageData(0, 0, canvas.width, canvas.height).data;
  const samples = [];
  // A 2px grid gives more possible locations than the largest supported cloud,
  // while preserving legible internal counters in letters such as O and A.
  for (let y = 6; y < canvas.height - 6; y += 2) {
    for (let xPos = 6; xPos < canvas.width - 6; xPos += 2) {
      if (image[(y * canvas.width + xPos) * 4 + 3] > 150) samples.push([xPos, y]);
    }
  }
  // A generic fallback keeps a typo, missing browser font, or empty glyph from
  // producing a broken scene.  It is intentionally a compact wordmark bar.
  if (!samples.length) {
    for (let i = 0; i < 1200; i++) samples.push([280 + (i % 800) * 2, 220 + Math.floor(i / 800) * 2]);
  }

  const target = new Float32Array(count * 3);
  const targetPhase = new Float32Array(count);
  const wordWidth = 12.0;
  const wordHeight = 3.55;
  for (let i = 0; i < count; i++) {
    // The irrational stride evenly visits the pixel candidates.  The tiny
    // hash jitter makes point density organic without changing the glyph.
    const position = fract(i * 0.6180339887498949 + hash(i + 41, seed) * 0.0019);
    const sample = samples[Math.floor(position * samples.length) % samples.length];
    const jx = (hash(i + 211, seed) - 0.5) * 1.15;
    const jy = (hash(i + 379, seed) - 0.5) * 1.15;
    target[i * 3] = ((sample[0] + jx) / canvas.width - 0.5) * wordWidth;
    target[i * 3 + 1] = (0.5 - (sample[1] + jy) / canvas.height) * wordHeight;
    target[i * 3 + 2] = (hash(i + 563, seed) - 0.5) * 0.045;
    targetPhase[i] = hash(i + 719, seed) * Math.PI * 2;
  }
  return { target, targetPhase, width: wordWidth, height: wordHeight, candidateCount: samples.length };
}

function makeOrbitRing(THREE, radius, color, opacity) {
  const positions = [];
  const segments = 160;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.42, -0.9);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  return new THREE.Line(geometry, material);
}

export function create(THREE, ctx) {
  const name = sceneName();
  const d = cache.get(name) && typeof cache.get(name).then !== 'function'
    ? cache.get(name) : normalize({});
  const { scene, camera, overlayRoot: overlay, width: W, height: H } = ctx;
  const { logo, particles, reveal, effects } = d;
  const count = particles.count;
  const seed = particles.seed;
  const targets = makeWordTargets(logo.word, count, logo.tracking, seed);
  const target = targets.target;

  scene.background = new THREE.Color(d.render.bg);
  scene.fog = new THREE.Fog(d.render.bg, 9, 24);
  camera.position.fromArray(d.camera.position);
  camera.lookAt(...d.camera.lookAt);
  const cameraStart = new THREE.Vector3(...d.camera.position);
  const lookAtStart = new THREE.Vector3(...d.camera.lookAt);

  const softTexture = makeSoftTexture(THREE);
  const streakTexture = makeSoftTexture(THREE, 'streak');
  const accent = new THREE.Color(logo.accent);
  const white = new THREE.Color(logo.color);
  const deepAccent = new THREE.Color(logo.accent).multiplyScalar(0.32);

  // A very small amount of static stage dressing makes the cloud feel like a
  // VFX shot rather than an isolated chart, without hiding the wordmark.
  const backdrop = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softTexture, color: accent, transparent: true, opacity: 0.22 * effects.glow,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  backdrop.position.set(0, 0, -2.2);
  backdrop.scale.set(13.5, 8.4, 1);
  scene.add(backdrop);
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softTexture, color: white, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  coreGlow.position.set(0, 0, 0.3);
  coreGlow.scale.set(1, 1, 1);
  scene.add(coreGlow);

  const rings = new THREE.Group();
  const ringA = makeOrbitRing(THREE, 4.15, logo.accent, 0.30 * effects.glow);
  const ringB = makeOrbitRing(THREE, 5.55, '#6EE7FF', 0.14 * effects.glow);
  ringB.rotation.z = 0.68;
  rings.add(ringA, ringB);
  scene.add(rings);

  // Background particles are one additional draw call and remain subdued. The
  // logo itself stays in its own cloud so its color and energy can be tuned
  // without sacrificing its readable silhouette.
  const backgroundCount = Math.max(240, Math.round(count * 0.13));
  const backgroundSeed = new Float32Array(backgroundCount * 5);
  const backgroundPosition = new Float32Array(backgroundCount * 3);
  for (let i = 0; i < backgroundCount; i++) {
    const theta = hash(i + 1, seed + 91) * Math.PI * 2;
    const radius = 5.5 + hash(i + 7, seed + 91) * 8.5;
    backgroundSeed[i * 5] = theta;
    backgroundSeed[i * 5 + 1] = radius;
    backgroundSeed[i * 5 + 2] = (hash(i + 13, seed + 91) - 0.5) * 5.5;
    backgroundSeed[i * 5 + 3] = 0.13 + hash(i + 17, seed + 91) * 0.44;
    backgroundSeed[i * 5 + 4] = hash(i + 23, seed + 91) * Math.PI * 2;
  }
  const backgroundGeometry = new THREE.BufferGeometry();
  backgroundGeometry.setAttribute('position', new THREE.BufferAttribute(backgroundPosition, 3));
  const backgroundMaterial = new THREE.PointsMaterial({
    map: softTexture, color: logo.accent, size: particles.size * 0.56, sizeAttenuation: true,
    transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false
  });
  scene.add(new THREE.Points(backgroundGeometry, backgroundMaterial));

  // Main logo: one BufferGeometry + one Points object. There is no DOM node per
  // particle and no state accumulated between frames, which keeps it fast and
  // seek-safe for the deterministic renderer.
  const position = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const start = new Float32Array(count * 3);
  const arc = new Float32Array(count * 3);
  const phases = targets.targetPhase;
  const colorMix = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = hash(i + 29, seed) * Math.PI * 2;
    const shell = particles.spread * (0.34 + hash(i + 47, seed) * 0.80);
    const tilt = (hash(i + 61, seed) - 0.5) * 0.46;
    start[i * 3] = Math.cos(theta) * shell;
    start[i * 3 + 1] = Math.sin(theta) * shell * (0.42 + tilt * 0.20);
    start[i * 3 + 2] = (hash(i + 79, seed) - 0.5) * particles.depth;
    arc[i * 3] = (hash(i + 101, seed) - 0.5) * 4.6;
    arc[i * 3 + 1] = (hash(i + 131, seed) - 0.5) * 3.2;
    arc[i * 3 + 2] = (hash(i + 149, seed) - 0.5) * particles.depth * 1.4;
    colorMix[i] = hash(i + 173, seed);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: softTexture, size: particles.size, sizeAttenuation: true, vertexColors: true,
    transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const logoCloud = new THREE.Points(geometry, material);
  logoCloud.frustumCulled = false;
  scene.add(logoCloud);

  const sweep = new THREE.Sprite(new THREE.SpriteMaterial({
    map: streakTexture, color: white, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sweep.position.set(-7, 0, 0.6);
  sweep.scale.set(0.34, 5.1, 1);
  scene.add(sweep);

  // These two elements are scene labels only. The wordmark is never drawn as
  // overlay text; it remains a particle formation at all points in the reveal.
  overlay.innerHTML = '';
  overlay.style.cssText += ';overflow:hidden;font-family:Inter,"Segoe UI",Arial,sans-serif;';
  const eyebrow = document.createElement('div');
  eyebrow.textContent = 'PARTICLE IDENTITY';
  eyebrow.style.cssText = `position:absolute;top:${Math.round(H * 0.18)}px;left:50%;transform:translate(-50%,-8px);color:${logo.accent};font-size:${Math.max(10, Math.round(H * 0.018))}px;font-weight:800;letter-spacing:.30em;white-space:nowrap;opacity:0;`;
  overlay.appendChild(eyebrow);
  const tagline = document.createElement('div');
  tagline.textContent = logo.tagline;
  tagline.style.cssText = `position:absolute;top:${Math.round(H * 0.68)}px;left:50%;transform:translate(-50%,10px);color:${logo.color};font-size:${Math.max(11, Math.round(H * 0.023))}px;font-weight:700;letter-spacing:.22em;white-space:nowrap;opacity:0;text-shadow:0 0 18px ${logo.accent};`;
  overlay.appendChild(tagline);
  const rule = document.createElement('div');
  rule.style.cssText = `position:absolute;top:${Math.round(H * 0.645)}px;left:50%;width:0;height:1px;transform:translateX(-50%);background:${logo.accent};box-shadow:0 0 12px ${logo.accent};opacity:0;`;
  overlay.appendChild(rule);

  let lastFrame = 0;
  let lastFormation = 0;
  const finalFrame = Math.min(reveal.formFrame + reveal.settleFrames, d.render.frames - 1);

  return {
    update(frame) {
      const f = clamp(Math.round(frame), 0, d.render.frames - 1);
      const time = f / d.render.fps;
      const formation = outCubic(smooth(reveal.startFrame, reveal.formFrame, f));
      const settle = smooth(reveal.formFrame, finalFrame, f);
      const entrance = smooth(0, reveal.startFrame + 12, f);
      const arcAmount = Math.sin(Math.PI * formation) * (1 - formation * 0.38);
      const scanProgress = smooth(reveal.formFrame - 15, reveal.formFrame + 18, f);
      const scanX = lerp(-6.7, 6.7, scanProgress);
      const pulse = (0.55 + 0.45 * Math.sin(time * 3.2)) * effects.pulse;
      const cameraPulse = (1 - settle) * 0.06 * effects.pulse;

      for (let i = 0; i < count; i++) {
        const offset = i * 3;
        const phase = phases[i];
        const orbit = time * (0.84 + hash(i + 809, seed) * 0.45) + phase;
        const sourceX = start[offset] + Math.cos(orbit) * (0.22 + hash(i + 821, seed) * 0.34);
        const sourceY = start[offset + 1] + Math.sin(orbit * 1.21) * (0.14 + hash(i + 839, seed) * 0.25);
        const sourceZ = start[offset + 2] + Math.sin(orbit * 0.71) * 0.35;
        const letterBreath = settle * Math.sin(time * 2.7 + phase) * 0.010;
        position[offset] = lerp(sourceX, target[offset], formation) + arc[offset] * arcAmount;
        position[offset + 1] = lerp(sourceY, target[offset + 1], formation) + arc[offset + 1] * arcAmount + letterBreath;
        position[offset + 2] = lerp(sourceZ, target[offset + 2], formation) + arc[offset + 2] * arcAmount;

        const targetTone = colorMix[i] > 0.80 ? white : accent;
        const sourceTone = colorMix[i] > 0.67 ? white : deepAccent;
        const scan = Math.exp(-Math.pow((target[offset] - scanX) / 0.52, 2)) * scanProgress * effects.scan;
        const flicker = 0.78 + 0.22 * Math.sin(time * (4.3 + colorMix[i] * 2.6) + phase);
        const brightness = (0.26 + 0.74 * entrance) * flicker + scan * 0.65 + settle * 0.14;
        const r = lerp(sourceTone.r, targetTone.r, formation);
        const g = lerp(sourceTone.g, targetTone.g, formation);
        const b = lerp(sourceTone.b, targetTone.b, formation);
        colors[offset] = clamp(r * brightness + scan * 0.65, 0, 1);
        colors[offset + 1] = clamp(g * brightness + scan * 0.65, 0, 1);
        colors[offset + 2] = clamp(b * brightness + scan * 0.72, 0, 1);
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      material.opacity = clamp(0.18 + entrance * 0.80 + settle * 0.05, 0, 1);
      material.size = particles.size * (1.32 - formation * 0.23 + Math.max(0, 1 - settle) * 0.12);

      for (let i = 0; i < backgroundCount; i++) {
        const offset = i * 3;
        const seedOffset = i * 5;
        const theta = backgroundSeed[seedOffset] + time * (0.08 + backgroundSeed[seedOffset + 3] * 0.16);
        const radius = backgroundSeed[seedOffset + 1] + Math.sin(time * 0.54 + backgroundSeed[seedOffset + 4]) * 0.42;
        backgroundPosition[offset] = Math.cos(theta) * radius;
        backgroundPosition[offset + 1] = Math.sin(theta) * radius * 0.48;
        backgroundPosition[offset + 2] = backgroundSeed[seedOffset + 2];
      }
      backgroundGeometry.attributes.position.needsUpdate = true;
      backgroundMaterial.opacity = 0.12 + (1 - formation) * 0.23 + settle * 0.05;

      const ringFade = (1 - smooth(reveal.formFrame - 8, reveal.formFrame + 18, f));
      rings.rotation.z = time * 0.34;
      rings.rotation.x = 0.12 + Math.sin(time * 0.42) * 0.06;
      ringA.material.opacity = ringFade * 0.30 * effects.glow;
      ringB.material.opacity = ringFade * 0.14 * effects.glow;
      backdrop.material.opacity = (0.16 + 0.10 * Math.sin(time * 0.7)) * effects.glow;
      backdrop.scale.set(12.4 + (1 - formation) * 2.1, 7.7 + (1 - formation) * 1.2, 1);
      coreGlow.material.opacity = (1 - formation) * entrance * 0.58 * effects.glow + scanProgress * (1 - settle) * 0.20;
      coreGlow.scale.setScalar(0.9 + (1 - formation) * 4.4 + pulse * 0.18);

      const sweepStrength = Math.sin(Math.PI * scanProgress) * effects.scan;
      sweep.visible = sweepStrength > 0.003;
      sweep.position.x = scanX;
      sweep.material.opacity = sweepStrength * 0.88;
      sweep.scale.set(0.20 + sweepStrength * 0.38, 4.5 + sweepStrength * 1.2, 1);

      camera.position.set(
        cameraStart.x + Math.sin(time * 1.7) * cameraPulse,
        cameraStart.y + Math.cos(time * 1.27) * cameraPulse * 0.45,
        cameraStart.z - (1 - formation) * 0.32
      );
      camera.lookAt(lookAtStart.x, lookAtStart.y, lookAtStart.z);

      const labelAmount = smooth(reveal.formFrame - 7, reveal.formFrame + 11, f);
      eyebrow.style.opacity = String(labelAmount * 0.84);
      eyebrow.style.transform = `translate(-50%,${Math.round(lerp(-8, 0, outCubic(labelAmount)))}px)`;
      tagline.style.opacity = String(smooth(reveal.formFrame + 5, reveal.formFrame + 22, f));
      tagline.style.transform = `translate(-50%,${Math.round(lerp(10, 0, outCubic(smooth(reveal.formFrame + 5, reveal.formFrame + 22, f))))}px)`;
      rule.style.opacity = String(smooth(reveal.formFrame, reveal.formFrame + 13, f));
      rule.style.width = `${Math.round(W * 0.22 * outCubic(smooth(reveal.formFrame, reveal.formFrame + 15, f)))}px`;

      lastFrame = f;
      lastFormation = formation;
    },
    probe() {
      return {
        type: 'particle_logo_reveal',
        id: name,
        word: logo.word,
        tagline: logo.tagline,
        particleCount: count,
        candidateCount: targets.candidateCount,
        formFrame: reveal.formFrame,
        frame: lastFrame,
        formation: Number(lastFormation.toFixed(4)),
        formed: lastFrame >= finalFrame
      };
    }
  };
}
