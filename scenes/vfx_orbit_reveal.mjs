// Orbit Reveal ---------------------------------------------------------------
// A frame-addressable 360-degree revolve transition.  It intentionally uses a
// constrained JSON recipe so an agent can turn a prompt such as “revolve into
// MOMENTUM” into a repeatable browser VFX preview without generating runtime
// code.  Every transform, particle position, camera move, and overlay style is
// recalculated from the requested frame; seeking frame 60 produces the same
// image regardless of the frames that preceded it.
//
// Optional config: /data/vfx/<vfx>.json selected by ?vfx=<id>.
// The demo is available directly at ?scene=vfx_orbit_reveal.

const DEFAULT = {
  render: { frames: 144, fps: 30, width: 1280, height: 720, bg: '#050811' },
  subject: {
    label: 'MOTION / 360', width: 4.75, height: 2.55, depth: 0.16,
    color: '#0D1830', accent: '#63E7FF', accent2: '#9C74FF', opacity: 0.94
  },
  orbit: {
    startFrame: 18, durationFrames: 60, turns: 1, direction: 1,
    ringCount: 3, energy: 1.2
  },
  reveal: {
    word: 'MOMENTUM', color: '#F7FCFF', subline: 'MOVE WITH INTENT', delayFrames: 1
  },
  camera: { position: [0, 0.12, 8.35], lookAt: [0, -0.06, 0] },
  effects: { glow: 1.2, shake: 0.08, particles: 112 }
};

const cache = new Map();
const TAU = Math.PI * 2;
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);
const lerp = (from, to, amount) => from + (to - from) * amount;
const hash = (seed) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

function smooth(from, to, value) {
  const t = clamp01((value - from) / Math.max(0.00001, to - from));
  return t * t * (3 - 2 * t);
}

function inOutCubic(value) {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function outCubic(value) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function merge(base, value) {
  const result = { ...base };
  if (!isObject(value)) return result;
  for (const [key, next] of Object.entries(value)) {
    result[key] = isObject(base[key]) && isObject(next) ? merge(base[key], next) : next;
  }
  return result;
}

function configName() {
  const raw = new URLSearchParams(location.search).get('vfx') || 'orbit_reveal_demo';
  return /^[a-z0-9_-]{1,80}$/i.test(raw) ? raw : 'orbit_reveal_demo';
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

function text(value, fallback, limit) {
  const candidate = typeof value === 'string' ? value.trim().replace(/[\r\n]/g, ' ') : '';
  return candidate.slice(0, limit) || fallback;
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
  const source = merge(DEFAULT, raw);
  const render = source.render || {};
  const subject = source.subject || {};
  const orbit = source.orbit || {};
  const reveal = source.reveal || {};
  const camera = source.camera || {};
  const effects = source.effects || {};
  const normalizedRender = {
    frames: integer(render.frames, DEFAULT.render.frames, 24, 900),
    fps: integer(render.fps, DEFAULT.render.fps, 12, 60),
    width: integer(render.width, DEFAULT.render.width, 320, 3840),
    height: integer(render.height, DEFAULT.render.height, 180, 2160),
    bg: color(render.bg, DEFAULT.render.bg)
  };
  const orbitStart = integer(orbit.startFrame, DEFAULT.orbit.startFrame, 0, normalizedRender.frames - 10);
  const orbitDuration = integer(
    orbit.durationFrames,
    DEFAULT.orbit.durationFrames,
    8,
    Math.max(8, normalizedRender.frames - orbitStart - 3)
  );
  return {
    render: normalizedRender,
    subject: {
      label: text(subject.label, DEFAULT.subject.label, 40),
      width: number(subject.width, DEFAULT.subject.width, 0.5, 9),
      height: number(subject.height, DEFAULT.subject.height, 0.35, 7),
      depth: number(subject.depth, DEFAULT.subject.depth, 0.02, 0.7),
      color: color(subject.color, DEFAULT.subject.color),
      accent: color(subject.accent, DEFAULT.subject.accent),
      accent2: color(subject.accent2, DEFAULT.subject.accent2),
      opacity: number(subject.opacity, DEFAULT.subject.opacity, 0.1, 1)
    },
    orbit: {
      startFrame: orbitStart,
      durationFrames: orbitDuration,
      turns: number(orbit.turns, DEFAULT.orbit.turns, 0.5, 3),
      direction: Number(orbit.direction) < 0 ? -1 : 1,
      ringCount: integer(orbit.ringCount, DEFAULT.orbit.ringCount, 1, 5),
      energy: number(orbit.energy, DEFAULT.orbit.energy, 0.1, 3)
    },
    reveal: {
      word: text(reveal.word, DEFAULT.reveal.word, 36),
      color: color(reveal.color, DEFAULT.reveal.color),
      subline: text(reveal.subline, '', 72),
      delayFrames: integer(reveal.delayFrames, DEFAULT.reveal.delayFrames, 0, normalizedRender.frames - 1)
    },
    camera: {
      position: vector(camera.position, DEFAULT.camera.position),
      lookAt: vector(camera.lookAt, DEFAULT.camera.lookAt)
    },
    effects: {
      glow: number(effects.glow, DEFAULT.effects.glow, 0, 5),
      shake: number(effects.shake, DEFAULT.effects.shake, 0, 1),
      particles: integer(effects.particles, DEFAULT.effects.particles, 24, 240)
    }
  };
}

async function loadConfig(name) {
  const current = cache.get(name);
  if (current) return await current;
  const pending = (async () => {
    try {
      const response = await fetch(`/data/vfx/${name}.json`);
      return normalize(response.ok ? await response.json() : {});
    } catch {
      return normalize({});
    }
  })();
  cache.set(name, pending);
  const value = await pending;
  cache.set(name, value);
  return value;
}

export async function getMeta() {
  const d = await loadConfig(configName());
  return {
    id: `vfx_orbit_reveal:${configName()}`,
    frames: d.render.frames,
    fps: d.render.fps,
    width: d.render.width,
    height: d.render.height,
    bg: d.render.bg
  };
}

function glowTexture(THREE, inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(96, 96, 0, 96, 96, 96);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.18, outer);
  gradient.addColorStop(0.55, 'rgba(38,123,255,0.12)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 192, 192);
  return new THREE.CanvasTexture(canvas);
}

function panelTexture(THREE, subject) {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext('2d');
  const background = context.createLinearGradient(0, 0, 1280, 720);
  background.addColorStop(0, '#101f3f');
  background.addColorStop(0.42, subject.color);
  background.addColorStop(1, '#060b18');
  context.fillStyle = background;
  context.fillRect(0, 0, 1280, 720);

  const halo = context.createRadialGradient(887, 212, 0, 887, 212, 590);
  halo.addColorStop(0, 'rgba(99,231,255,0.25)');
  halo.addColorStop(0.44, 'rgba(118,125,255,0.07)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = halo;
  context.fillRect(0, 0, 1280, 720);

  context.globalAlpha = 0.28;
  context.strokeStyle = subject.accent;
  context.lineWidth = 1;
  for (let x = -220; x < 1500; x += 48) {
    context.beginPath();
    context.moveTo(x, 0); context.lineTo(x + 380, 720); context.stroke();
  }
  context.globalAlpha = 1;
  context.strokeStyle = subject.accent;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(106, 166); context.lineTo(360, 166); context.stroke();
  context.strokeStyle = subject.accent2;
  context.beginPath();
  context.moveTo(106, 188); context.lineTo(246, 188); context.stroke();

  context.fillStyle = '#e8fbff';
  context.font = '700 52px Arial, sans-serif';
  context.letterSpacing = '8px';
  context.fillText(subject.label, 105, 294);
  context.fillStyle = 'rgba(232,251,255,0.65)';
  context.font = '600 21px Arial, sans-serif';
  context.letterSpacing = '5px';
  context.fillText('REVOLVE / TRANSITION', 108, 344);

  context.globalAlpha = 0.7;
  context.strokeStyle = subject.accent;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(1001, 367, 142, -Math.PI * 0.88, Math.PI * 0.68);
  context.stroke();
  context.strokeStyle = subject.accent2;
  context.beginPath();
  context.arc(1001, 367, 106, -Math.PI * 0.55, Math.PI * 1.08);
  context.stroke();
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeTickRing(THREE, radius, accent, count) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: accent, transparent: true, opacity: 0.22, depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU;
    const major = i % 8 === 0;
    const length = major ? 0.19 : 0.075;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.014, length, 0.012), material);
    mark.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, -0.05);
    mark.rotation.z = angle + Math.PI / 2;
    group.add(mark);
  }
  return { group, material };
}

function makeParticleField(THREE, count, color) {
  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color, size: 0.035, transparent: true, opacity: 0.6, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  return { positions, geometry, material, points: new THREE.Points(geometry, material) };
}

export function create(THREE, ctx) {
  const name = configName();
  const d = cache.get(name) && typeof cache.get(name).then !== 'function'
    ? cache.get(name) : normalize({});
  const { scene, camera, overlayRoot: overlay, width: W, height: H } = ctx;
  const { subject, orbit, reveal, effects } = d;
  const orbitStart = orbit.startFrame;
  const orbitEnd = orbitStart + orbit.durationFrames;
  // The type starts just before the final face of the full 360-degree turn so
  // it feels pulled through the orbit rather than pasted on after it.
  const revealStart = Math.min(d.render.frames - 1, orbitEnd - 4 + reveal.delayFrames);

  scene.background = new THREE.Color(d.render.bg);
  scene.fog = new THREE.Fog(d.render.bg, 8.8, 24);
  camera.position.fromArray(d.camera.position);
  camera.lookAt(...d.camera.lookAt);

  scene.add(new THREE.HemisphereLight(0xa8efff, 0x070a15, 1.7));
  const key = new THREE.DirectionalLight(0xe7faff, 2.35);
  key.position.set(-3.8, 5.2, 6.0); scene.add(key);
  const cyanRim = new THREE.PointLight(new THREE.Color(subject.accent), 12 * effects.glow, 10);
  cyanRim.position.set(4.1, 1.2, 3.4); scene.add(cyanRim);
  const violetRim = new THREE.PointLight(new THREE.Color(subject.accent2), 9 * effects.glow, 9);
  violetRim.position.set(-3.6, -1.5, 2.1); scene.add(violetRim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 28),
    new THREE.MeshStandardMaterial({ color: 0x060b17, metalness: 0.72, roughness: 0.33 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.52;
  scene.add(floor);
  const grid = new THREE.GridHelper(24, 32, new THREE.Color(subject.accent), 0x10203d);
  grid.position.y = -2.5;
  grid.material.transparent = true;
  grid.material.opacity = 0.16;
  scene.add(grid);

  const backgroundGlowTexture = glowTexture(THREE, 'rgba(212,250,255,0.82)', 'rgba(81,220,255,0.25)');
  const backgroundGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: backgroundGlowTexture, color: new THREE.Color(subject.accent), transparent: true,
    opacity: 0.26 * effects.glow, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  backgroundGlow.position.set(0, 0.02, -3.2);
  backgroundGlow.scale.set(10.2, 10.2, 1);
  scene.add(backgroundGlow);
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: backgroundGlowTexture, color: new THREE.Color(subject.accent2), transparent: true,
    opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  coreGlow.position.set(0, 0, -0.65);
  coreGlow.scale.set(0.6, 0.6, 1);
  scene.add(coreGlow);

  // The panel gives the transition a surface that clearly rotates from its
  // front, through two edge-on moments, around its back, and back to the front.
  const panelRig = new THREE.Group();
  const bodyGeometry = new THREE.BoxGeometry(subject.width, subject.height, subject.depth);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: subject.color, metalness: 0.78, roughness: 0.23, transparent: true,
    opacity: subject.opacity, side: THREE.DoubleSide
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  panelRig.add(body);
  const frameMaterial = new THREE.LineBasicMaterial({
    color: subject.accent, transparent: true, opacity: 0.95, depthWrite: false
  });
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeometry), frameMaterial);
  panelRig.add(frame);
  const faceTexture = panelTexture(THREE, subject);
  const faceMaterial = new THREE.MeshBasicMaterial({
    map: faceTexture, transparent: true, opacity: subject.opacity, depthWrite: false
  });
  const backMaterial = new THREE.MeshBasicMaterial({
    map: faceTexture, transparent: true, opacity: subject.opacity * 0.72, depthWrite: false
  });
  const faceGeometry = new THREE.PlaneGeometry(subject.width * 0.973, subject.height * 0.948);
  const frontFace = new THREE.Mesh(faceGeometry, faceMaterial);
  frontFace.position.z = subject.depth * 0.51;
  panelRig.add(frontFace);
  const backFace = new THREE.Mesh(faceGeometry, backMaterial);
  backFace.rotation.y = Math.PI;
  backFace.position.z = -subject.depth * 0.51;
  panelRig.add(backFace);
  const gleamMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const gleam = new THREE.Mesh(new THREE.PlaneGeometry(subject.width * 0.13, subject.height * 0.94), gleamMaterial);
  gleam.position.set(-subject.width * 0.22, 0, subject.depth * 0.54);
  gleam.rotation.z = -0.22;
  panelRig.add(gleam);
  scene.add(panelRig);

  const orbitRig = new THREE.Group();
  const ringMaterials = [];
  const rings = [];
  for (let i = 0; i < orbit.ringCount; i++) {
    const radius = 2.05 + i * 0.27;
    const material = new THREE.MeshBasicMaterial({
      color: i % 2 ? subject.accent2 : subject.accent,
      transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.011 + i * 0.003, 8, 144), material);
    ring.rotation.set((i - 1) * 0.42 + 0.18, i * 0.31, (i - 1) * 0.18);
    orbitRig.add(ring);
    ringMaterials.push(material);
    rings.push(ring);
  }
  const accentArcMaterial = new THREE.MeshBasicMaterial({
    color: subject.accent, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const accentArc = new THREE.Mesh(new THREE.TorusGeometry(2.79, 0.031, 10, 120, Math.PI * 0.58), accentArcMaterial);
  accentArc.rotation.set(0.16, -0.12, -0.76);
  orbitRig.add(accentArc);
  const violetArcMaterial = new THREE.MeshBasicMaterial({
    color: subject.accent2, transparent: true, opacity: 0.48, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const violetArc = new THREE.Mesh(new THREE.TorusGeometry(2.47, 0.018, 8, 96, Math.PI * 0.44), violetArcMaterial);
  violetArc.rotation.set(-0.52, 0.28, 1.28);
  orbitRig.add(violetArc);
  scene.add(orbitRig);

  const tick = makeTickRing(THREE, 3.04, subject.accent, 64);
  tick.group.position.z = -0.48;
  scene.add(tick.group);

  const particleA = makeParticleField(THREE, effects.particles, subject.accent);
  const particleB = makeParticleField(THREE, Math.max(24, Math.round(effects.particles * 0.58)), subject.accent2);
  scene.add(particleA.points, particleB.points);

  // The overlay is deliberately DOM type: it remains pixel-crisp at all output
  // sizes and gives a conversational editor one obvious textual edit target.
  overlay.innerHTML = '';
  overlay.style.cssText += ';overflow:hidden;font-family:Inter,"Segoe UI",Arial,sans-serif;';
  const metadata = document.createElement('div');
  metadata.style.cssText = `position:absolute;left:${Math.round(W * 0.055)}px;top:${Math.round(H * 0.075)}px;color:${subject.accent};font-size:${Math.max(10, Math.round(H * 0.021))}px;font-weight:800;letter-spacing:.23em;opacity:0;white-space:nowrap;`;
  metadata.textContent = 'ORBIT / 360° / REVEAL';
  overlay.appendChild(metadata);
  const metadataRule = document.createElement('div');
  metadataRule.style.cssText = `position:absolute;left:${Math.round(W * 0.055)}px;top:${Math.round(H * 0.115)}px;height:1px;width:0;background:${subject.accent};box-shadow:0 0 12px ${subject.accent};`;
  overlay.appendChild(metadataRule);
  const wordMask = document.createElement('div');
  wordMask.style.cssText = 'position:absolute;left:4%;right:4%;top:39%;height:25%;display:flex;align-items:center;justify-content:center;overflow:hidden;clip-path:inset(0 100% 0 0);';
  const word = document.createElement('div');
  const typeSize = Math.round(Math.min(H * 0.18, W / Math.max(5.0, reveal.word.length * 0.62)));
  word.style.cssText = `color:${reveal.color};font-size:${typeSize}px;font-weight:900;letter-spacing:.105em;line-height:.9;white-space:nowrap;opacity:0;text-shadow:0 0 9px rgba(225,250,255,.94),0 0 35px ${subject.accent};transform:translateY(30px) scale(.94);`;
  word.textContent = reveal.word;
  wordMask.appendChild(word);
  overlay.appendChild(wordMask);
  const wordRule = document.createElement('div');
  wordRule.style.cssText = `position:absolute;left:50%;top:65%;height:2px;width:0;transform:translateX(-50%);background:${reveal.color};box-shadow:0 0 14px ${subject.accent};opacity:0;`;
  overlay.appendChild(wordRule);
  const subline = document.createElement('div');
  subline.style.cssText = `position:absolute;left:50%;top:68.7%;transform:translate(-50%,10px);color:${reveal.color};font-size:${Math.max(9, Math.round(H * 0.022))}px;font-weight:750;letter-spacing:.29em;white-space:nowrap;opacity:0;`;
  subline.textContent = reveal.subline;
  overlay.appendChild(subline);

  const originalCamera = new THREE.Vector3().fromArray(d.camera.position);
  const originalLookAt = new THREE.Vector3().fromArray(d.camera.lookAt);
  const N = d.render.frames;
  const setParticles = (field, multiplier, frame, energy) => {
    const { positions } = field;
    const count = positions.length / 3;
    const time = frame / d.render.fps;
    for (let i = 0; i < count; i++) {
      const seed = i * multiplier;
      const radius = 2.7 + hash(seed + 8) * 5.7;
      const angle = hash(seed + 17) * TAU + time * (0.055 + hash(seed + 23) * 0.09) * energy;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (hash(seed + 31) - 0.5) * 5.7 + Math.sin(time * 0.5 + seed) * 0.08;
      positions[i * 3 + 2] = -3.4 - hash(seed + 47) * 4.8;
    }
    field.geometry.attributes.position.needsUpdate = true;
  };

  return {
    update(frame) {
      const f = clamp(Math.round(frame), 0, N - 1);
      const rawOrbit = clamp01((f - orbitStart) / Math.max(1, orbit.durationFrames));
      const orbitProgress = inOutCubic(rawOrbit);
      const turn = orbit.direction * orbit.turns * TAU * orbitProgress;
      const edgeOn = Math.pow(Math.abs(Math.sin(turn)), 0.72);
      const crest = Math.pow(Math.sin(Math.PI * rawOrbit), 2);
      const typeAmount = smooth(revealStart, revealStart + 15, f);
      const retirePanel = smooth(revealStart - 3, revealStart + 13, f);
      const coreOpacity = subject.opacity * (1 - retirePanel * 0.93);
      const ringOpacity = (0.30 + crest * 0.46) * (1 - retirePanel * 0.72);

      panelRig.rotation.set(
        0.035 + Math.sin(rawOrbit * Math.PI) * 0.18,
        turn,
        -0.035 + Math.sin(rawOrbit * Math.PI) * orbit.direction * 0.13
      );
      panelRig.position.set(0, Math.sin(rawOrbit * Math.PI) * 0.06, 0.05 + crest * 0.32);
      const panelScale = 1 + crest * 0.075 - retirePanel * 0.035;
      panelRig.scale.setScalar(panelScale);
      bodyMaterial.opacity = coreOpacity;
      faceMaterial.opacity = coreOpacity;
      backMaterial.opacity = coreOpacity * 0.72;
      frameMaterial.opacity = (0.54 + edgeOn * 0.42) * (1 - retirePanel * 0.84);
      gleamMaterial.opacity = (0.055 + edgeOn * 0.30) * (1 - retirePanel);

      orbitRig.rotation.set(
        Math.sin(turn * 0.32) * 0.14,
        turn * 0.22,
        -turn * 0.36
      );
      rings.forEach((ring, index) => {
        ring.rotation.x = (index - 1) * 0.42 + 0.18 + turn * (0.09 + index * 0.026);
        ring.rotation.y = index * 0.31 + turn * (0.12 + index * 0.032);
      });
      ringMaterials.forEach((material, index) => {
        material.opacity = ringOpacity * (0.92 - index * 0.11) * effects.glow;
      });
      accentArc.rotation.z = -0.76 - turn * 0.82;
      accentArcMaterial.opacity = (0.32 + crest * 0.52) * (1 - retirePanel * 0.74) * effects.glow;
      violetArc.rotation.z = 1.28 + turn * 0.58;
      violetArcMaterial.opacity = (0.21 + crest * 0.44) * (1 - retirePanel * 0.72) * effects.glow;
      tick.group.rotation.z = -turn * 0.20;
      tick.material.opacity = (0.10 + crest * 0.28) * (1 - retirePanel * 0.67) * effects.glow;

      const haloScale = lerp(3.2, 8.8, outCubic(crest));
      coreGlow.scale.set(haloScale, haloScale, 1);
      coreGlow.material.opacity = (0.05 + crest * 0.43) * (1 - retirePanel * 0.7) * effects.glow;
      backgroundGlow.material.opacity = (0.20 + crest * 0.16) * effects.glow;
      grid.material.opacity = 0.11 + crest * 0.14;

      setParticles(particleA, 17, f, orbit.energy);
      setParticles(particleB, 47, f, orbit.energy * 0.72);
      particleA.material.opacity = (0.24 + crest * 0.48) * effects.glow;
      particleB.material.opacity = (0.16 + crest * 0.34) * effects.glow;

      const shakeAmount = crest * effects.shake;
      camera.position.set(
        originalCamera.x + Math.sin(f * 1.73) * shakeAmount,
        originalCamera.y + Math.cos(f * 2.31 + 0.5) * shakeAmount * 0.46,
        originalCamera.z - crest * 0.32 + retirePanel * 0.20
      );
      camera.lookAt(originalLookAt.x, originalLookAt.y - crest * 0.025, originalLookAt.z);

      const metaAmount = smooth(1, 11, f) * (1 - smooth(revealStart - 4, revealStart + 9, f));
      metadata.style.opacity = String(metaAmount);
      metadataRule.style.width = `${Math.round(W * 0.19 * smooth(3, 14, f) * (1 - retirePanel))}px`;
      const typeEase = outCubic(typeAmount);
      wordMask.style.clipPath = `inset(0 ${Math.round((1 - typeAmount) * 100)}% 0 0)`;
      word.style.opacity = String(typeAmount);
      word.style.transform = `translateY(${Math.round(lerp(30, 0, typeEase))}px) scale(${lerp(0.94, 1, typeEase).toFixed(3)})`;
      wordRule.style.opacity = String(smooth(revealStart + 6, revealStart + 15, f));
      wordRule.style.width = `${Math.round(W * 0.30 * outCubic(smooth(revealStart + 5, revealStart + 18, f)))}px`;
      subline.style.opacity = String(smooth(revealStart + 11, revealStart + 22, f));
      subline.style.transform = `translate(-50%,${Math.round(lerp(10, 0, smooth(revealStart + 11, revealStart + 22, f)))}px)`;
    },
    probe() {
      return {
        type: 'orbit_reveal',
        config: name,
        word: reveal.word,
        orbitStartFrame: orbitStart,
        orbitEndFrame: orbitEnd,
        orbitDegrees: orbit.direction * orbit.turns * 360,
        revealFrame: revealStart,
        deterministic: true
      };
    }
  };
}
