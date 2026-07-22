// Smoke Title ---------------------------------------------------------------
// A deterministic, no-asset browser VFX recipe.  It is intentionally made of
// procedural point clouds, line wisps, and an HTML type layer, so a creator can
// preview a stylized smoke/energy title without a simulation cache or a DCC.
//
// Choose a JSON configuration with:
//   ?scene=vfx_smoke_title&vfx=smoke_title_demo
// The same frame index always produces the same plume, pulse, and title state.

const DEFAULT = {
  render: { frames: 150, fps: 30, width: 1280, height: 720, bg: '#06020D' },
  plume: {
    color: '#A855F7', accent: '#22D3EE', particleCount: 360, emberCount: 84,
    sourceY: -2.05, height: 5.1, width: 1.38, turbulence: 0.82, drift: 0.36
  },
  reveal: {
    word: 'ASCEND', color: '#FAF5FF', subline: 'TURN PRESSURE INTO POWER',
    frame: 62, duration: 20
  },
  camera: { position: [0, 0.15, 8.2], lookAt: [0, 0.18, 0] },
  effects: { glow: 1.2, shake: 0.13, vortex: 1.05 }
};

const cache = new Map();
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const clamp01 = (n) => clamp(n, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (n) => n - Math.floor(n);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);
const smooth = (a, b, value) => {
  const t = clamp01((value - a) / Math.max(0.0001, b - a));
  return t * t * (3 - 2 * t);
};
const outCubic = (value) => 1 - Math.pow(1 - clamp01(value), 3);

function merge(base, value) {
  const out = { ...base };
  if (!isObject(value)) return out;
  for (const [key, next] of Object.entries(value)) {
    out[key] = isObject(base[key]) && isObject(next) ? merge(base[key], next) : next;
  }
  return out;
}

function vfxName() {
  const raw = new URLSearchParams(location.search).get('vfx') || 'smoke_title_demo';
  // Avoid letting a hand-edited preview URL become a filesystem path.
  return /^[a-z0-9_-]{1,80}$/i.test(raw) ? raw : 'smoke_title_demo';
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
  const plume = d.plume || {};
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
  return {
    render: normalizedRender,
    plume: {
      color: color(plume.color, DEFAULT.plume.color),
      accent: color(plume.accent, DEFAULT.plume.accent),
      // The cap keeps a multi-effect render page smooth on integrated GPUs.
      particleCount: integer(plume.particleCount, DEFAULT.plume.particleCount, 80, 600),
      emberCount: integer(plume.emberCount, DEFAULT.plume.emberCount, 12, 180),
      sourceY: number(plume.sourceY, DEFAULT.plume.sourceY, -5, 2),
      height: number(plume.height, DEFAULT.plume.height, 1, 10),
      width: number(plume.width, DEFAULT.plume.width, 0.2, 4),
      turbulence: number(plume.turbulence, DEFAULT.plume.turbulence, 0, 2),
      drift: number(plume.drift, DEFAULT.plume.drift, 0, 2)
    },
    reveal: {
      word: String(reveal.word || DEFAULT.reveal.word).trim().slice(0, 36) || DEFAULT.reveal.word,
      color: color(reveal.color, DEFAULT.reveal.color),
      subline: String(reveal.subline || '').trim().slice(0, 72),
      frame: integer(reveal.frame, DEFAULT.reveal.frame, 3, normalizedRender.frames - 4),
      duration: integer(reveal.duration, DEFAULT.reveal.duration, 6, 72)
    },
    camera: {
      position: vector(camera.position, DEFAULT.camera.position),
      lookAt: vector(camera.lookAt, DEFAULT.camera.lookAt)
    },
    effects: {
      glow: number(effects.glow, DEFAULT.effects.glow, 0, 5),
      shake: number(effects.shake, DEFAULT.effects.shake, 0, 2),
      vortex: number(effects.vortex, DEFAULT.effects.vortex, 0, 3)
    }
  };
}

async function loadConfig(name) {
  if (!cache.has(name)) {
    cache.set(name, (async () => {
      try {
        const response = await fetch(`/data/vfx/${name}.json?t=${Date.now()}`);
        return normalize(response.ok ? await response.json() : {});
      } catch {
        return normalize({});
      }
    })());
  }
  const pending = cache.get(name);
  const value = await pending;
  if (value !== pending) cache.set(name, value);
  return value;
}

export async function getMeta() {
  const d = await loadConfig(vfxName());
  return {
    id: `vfx_smoke_title:${vfxName()}`,
    frames: d.render.frames,
    fps: d.render.fps,
    width: d.render.width,
    height: d.render.height,
    bg: d.render.bg
  };
}

function glowTexture(THREE, center, edge) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  const fill = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  fill.addColorStop(0, center);
  fill.addColorStop(0.18, edge);
  fill.addColorStop(0.56, 'rgba(30,12,64,0.10)');
  fill.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fill;
  g.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSeededParticles(count, offset) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + offset;
    return {
      phase: hash(n + 3), speed: 0.72 + hash(n + 7) * 0.82,
      lane: hash(n + 11) * Math.PI * 2, radius: 0.16 + hash(n + 17) * 0.94,
      wobble: 2.1 + hash(n + 23) * 3.6, seed: hash(n + 29) * Math.PI * 2
    };
  });
}

function makeWisp(THREE, segments, color, opacity) {
  const positions = new Float32Array(segments * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  return { line: new THREE.Line(geometry, material), positions, geometry, material };
}

export function create(THREE, ctx) {
  const name = vfxName();
  const d = cache.get(name) && typeof cache.get(name).then !== 'function'
    ? cache.get(name) : normalize({});
  const { scene, camera, overlayRoot: overlay, width: W, height: H } = ctx;
  const { plume, reveal, effects } = d;
  const smokeColor = new THREE.Color(plume.color);
  const accentColor = new THREE.Color(plume.accent);
  const titleColor = new THREE.Color(reveal.color);
  const transparentTexture = glowTexture(THREE, 'rgba(255,255,255,0.94)', 'rgba(255,255,255,0.40)');
  const energyTexture = glowTexture(THREE, 'rgba(255,255,255,0.98)', 'rgba(77,235,255,0.52)');

  scene.background = new THREE.Color(d.render.bg);
  scene.fog = new THREE.Fog(d.render.bg, 7, 17);
  camera.position.fromArray(d.camera.position);
  camera.lookAt(...d.camera.lookAt);

  // Dark stage + a few low-cost lights create a premium plate without a HDRI
  // or a post-processing pass.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 28),
    new THREE.MeshStandardMaterial({ color: 0x090311, roughness: 0.84, metalness: 0.18 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = plume.sourceY - 0.15;
  scene.add(floor);
  scene.add(new THREE.HemisphereLight(0x9e77ff, 0x05020a, 1.15));
  const violetLight = new THREE.PointLight(smokeColor, 9 * effects.glow, 8);
  violetLight.position.set(-1.8, 0.6, 2.3); scene.add(violetLight);
  const cyanLight = new THREE.PointLight(accentColor, 6.2 * effects.glow, 7);
  cyanLight.position.set(2.0, 1.5, 1.1); scene.add(cyanLight);

  const backdrop = new THREE.Sprite(new THREE.SpriteMaterial({
    map: energyTexture, color: smokeColor, transparent: true, opacity: 0.18 * effects.glow,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  backdrop.position.set(0, 0.52, -2.3); backdrop.scale.set(9.6, 9.6, 1); scene.add(backdrop);
  const titleBloom = new THREE.Sprite(new THREE.SpriteMaterial({
    map: energyTexture, color: accentColor, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  titleBloom.position.set(0, 0.55, -0.8); titleBloom.scale.set(0.2, 0.2, 1); scene.add(titleBloom);

  // A handful of large, low-opacity puffs stop the point cloud reading as
  // confetti. They are still procedural sprites (not image assets), so they
  // retain the seekable deterministic contract of the rest of the plume.
  const puffSeeds = makeSeededParticles(14, 2600);
  const puffs = puffSeeds.map((particle, index) => {
    const material = new THREE.SpriteMaterial({
      map: transparentTexture, color: index % 3 === 0 ? accentColor : smokeColor,
      transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.z = -0.58;
    scene.add(sprite);
    return { particle, sprite, material };
  });

  // A broad, soft smoke cloud and a tighter glowing core share the same
  // mathematical flow but read as two different volumetric layers.
  const smokeSeeds = makeSeededParticles(plume.particleCount, 100);
  const smokePositions = new Float32Array(smokeSeeds.length * 3);
  const smokeColors = new Float32Array(smokeSeeds.length * 3);
  const smokeGeometry = new THREE.BufferGeometry();
  smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
  smokeGeometry.setAttribute('color', new THREE.BufferAttribute(smokeColors, 3));
  const smokeMaterial = new THREE.PointsMaterial({
    map: transparentTexture, size: Math.max(0.18, plume.width * 0.43), vertexColors: true,
    transparent: true, opacity: 0.48, depthWrite: false, blending: THREE.NormalBlending
  });
  scene.add(new THREE.Points(smokeGeometry, smokeMaterial));

  const coreSeeds = makeSeededParticles(Math.max(48, Math.round(plume.particleCount * 0.43)), 1700);
  const corePositions = new Float32Array(coreSeeds.length * 3);
  const coreColors = new Float32Array(coreSeeds.length * 3);
  const coreGeometry = new THREE.BufferGeometry();
  coreGeometry.setAttribute('position', new THREE.BufferAttribute(corePositions, 3));
  coreGeometry.setAttribute('color', new THREE.BufferAttribute(coreColors, 3));
  const coreMaterial = new THREE.PointsMaterial({
    map: energyTexture, size: Math.max(0.055, plume.width * 0.12), vertexColors: true,
    transparent: true, opacity: 0.80, depthWrite: false, blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(coreGeometry, coreMaterial));

  // Three animated lines cost much less than a smoke simulation, yet make the
  // plume feel directional and energetic at the moment the title appears.
  const wisps = [
    makeWisp(THREE, 42, plume.color, 0.34),
    makeWisp(THREE, 42, plume.accent, 0.27),
    makeWisp(THREE, 42, reveal.color, 0.18)
  ];
  wisps.forEach(({ line }) => { line.position.z = -0.24; scene.add(line); });

  const emberSeeds = makeSeededParticles(plume.emberCount, 3100);
  const emberPositions = new Float32Array(emberSeeds.length * 3);
  const emberColors = new Float32Array(emberSeeds.length * 3);
  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  emberGeometry.setAttribute('color', new THREE.BufferAttribute(emberColors, 3));
  const emberMaterial = new THREE.PointsMaterial({
    map: energyTexture, size: 0.075, vertexColors: true, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(emberGeometry, emberMaterial));

  const sourceGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: energyTexture, color: smokeColor, transparent: true, opacity: 0.52 * effects.glow,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sourceGlow.position.set(0, plume.sourceY + 0.02, 0.15); sourceGlow.scale.set(2.6, 0.75, 1); scene.add(sourceGlow);
  const impactRing = new THREE.Mesh(
    new THREE.RingGeometry(0.37, 0.42, 96),
    new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  impactRing.rotation.x = -Math.PI / 2; impactRing.position.y = plume.sourceY - 0.13; scene.add(impactRing);

  // Crisp browser typography makes the message readable in a way smoke and
  // geometry alone cannot. User-provided strings use textContent, never HTML.
  overlay.innerHTML = '';
  overlay.style.cssText += ';overflow:hidden;font-family:Inter,"Segoe UI",Arial,sans-serif;';
  const typeMask = document.createElement('div');
  typeMask.style.cssText = 'position:absolute;left:4%;right:4%;top:34%;height:31%;display:flex;align-items:center;justify-content:center;overflow:hidden;clip-path:inset(0 100% 0 0);';
  const type = document.createElement('div');
  const size = Math.round(Math.min(H * 0.205, W / Math.max(4.6, reveal.word.length * 0.56)));
  type.style.cssText = `font-size:${size}px;font-weight:900;letter-spacing:.105em;line-height:.84;white-space:nowrap;color:${reveal.color};opacity:0;transform:translateY(30px) scale(.935);text-shadow:0 0 8px ${reveal.color},0 0 28px ${plume.accent},0 0 56px ${plume.color};`;
  type.textContent = reveal.word;
  typeMask.appendChild(type); overlay.appendChild(typeMask);
  const rule = document.createElement('div');
  rule.style.cssText = `position:absolute;left:50%;top:62%;height:2px;width:0;transform:translateX(-50%);opacity:0;background:${reveal.color};box-shadow:0 0 12px ${plume.accent},0 0 28px ${plume.color};`;
  overlay.appendChild(rule);
  const subline = document.createElement('div');
  subline.style.cssText = `position:absolute;left:50%;top:65%;transform:translate(-50%,10px);font-size:${Math.round(H * 0.022)}px;font-weight:700;letter-spacing:.27em;white-space:nowrap;color:${reveal.color};opacity:0;text-shadow:0 0 14px ${plume.accent};`;
  subline.textContent = reveal.subline;
  overlay.appendChild(subline);

  const originalCamera = new THREE.Vector3().fromArray(d.camera.position);
  const lookAt = new THREE.Vector3().fromArray(d.camera.lookAt);
  const smokeMix = new THREE.Color();
  const coreMix = new THREE.Color();
  const emberMix = new THREE.Color();
  const N = d.render.frames;

  function setPlume(seeds, positions, colors, time, core) {
    for (let i = 0; i < seeds.length; i++) {
      const particle = seeds[i];
      const age = fract(time * particle.speed * 0.22 + particle.phase);
      const climb = age * age * (3 - 2 * age);
      const spread = plume.width * (0.17 + climb * (core ? 0.42 : 0.92));
      const spin = particle.lane + time * (0.62 + plume.turbulence * 0.34) + climb * (5.2 + particle.wobble);
      const turbulence = Math.sin(time * particle.wobble + particle.seed + climb * 10) * plume.width * plume.turbulence * (core ? 0.13 : 0.26);
      positions[i * 3] = Math.cos(spin) * spread * particle.radius + turbulence + (climb - 0.4) * plume.drift;
      positions[i * 3 + 1] = plume.sourceY + climb * plume.height + Math.sin(particle.seed + time * 1.1) * 0.08;
      positions[i * 3 + 2] = -0.25 + Math.sin(spin * 1.37 + particle.seed) * spread * 0.46;
      const brightness = core
        ? 0.42 + 0.58 * Math.sin(age * Math.PI)
        : 0.34 + 0.56 * (1 - climb) + 0.10 * Math.sin(time + particle.seed);
      (core ? coreMix : smokeMix).copy(smokeColor).lerp(accentColor, core ? 0.64 : 0.24 + age * 0.2).multiplyScalar(brightness);
      const mixed = core ? coreMix : smokeMix;
      colors[i * 3] = mixed.r; colors[i * 3 + 1] = mixed.g; colors[i * 3 + 2] = mixed.b;
    }
  }

  return {
    update(frame) {
      const f = clamp(Math.round(frame), 0, N - 1);
      const time = f / d.render.fps;
      const revealAmount = smooth(reveal.frame, reveal.frame + reveal.duration, f);
      const activation = smooth(reveal.frame - 13, reveal.frame + 5, f);
      const flash = smooth(reveal.frame - 1, reveal.frame + 3, f) * (1 - smooth(reveal.frame + 6, reveal.frame + 23, f));

      setPlume(smokeSeeds, smokePositions, smokeColors, time, false);
      setPlume(coreSeeds, corePositions, coreColors, time * (1.08 + effects.vortex * 0.06), true);
      smokeGeometry.attributes.position.needsUpdate = true;
      smokeGeometry.attributes.color.needsUpdate = true;
      coreGeometry.attributes.position.needsUpdate = true;
      coreGeometry.attributes.color.needsUpdate = true;
      smokeMaterial.opacity = (0.40 + activation * 0.16) * (0.72 + 0.28 * Math.sin(time * 0.7));
      coreMaterial.opacity = (0.48 + activation * 0.39) * effects.glow;

      for (const puff of puffs) {
        const { particle, sprite, material } = puff;
        const age = fract(time * (0.13 + particle.speed * 0.08) + particle.phase);
        const rise = age * age * (3 - 2 * age);
        const radius = plume.width * (0.14 + rise * 0.42) * particle.radius;
        const angle = particle.lane + time * 0.44 + rise * 4.8;
        const puffSize = plume.width * (0.68 + rise * 1.48 + particle.radius * 0.48);
        sprite.position.set(
          Math.cos(angle) * radius + Math.sin(time * 1.3 + particle.seed) * 0.16 + (rise - 0.5) * plume.drift,
          plume.sourceY + rise * plume.height * 0.92,
          -0.58 + Math.sin(angle * 1.6) * 0.24
        );
        sprite.scale.set(puffSize, puffSize * (0.72 + particle.radius * 0.26), 1);
        material.opacity = (0.038 + 0.070 * Math.sin(age * Math.PI)) * (0.64 + activation * 0.36);
      }

      wisps.forEach((wisp, wispIndex) => {
        const points = wisp.positions.length / 3;
        for (let j = 0; j < points; j++) {
          const u = j / (points - 1);
          const spin = u * (8.5 + wispIndex * 1.7) + time * (1.1 + wispIndex * 0.23) + wispIndex * 2.16;
          const radius = plume.width * (0.17 + u * 0.48) * (0.78 + activation * 0.45);
          wisp.positions[j * 3] = Math.cos(spin) * radius + Math.sin(time * 2.4 + u * 13 + wispIndex) * 0.16 + (u - 0.5) * plume.drift;
          wisp.positions[j * 3 + 1] = plume.sourceY + u * plume.height;
          wisp.positions[j * 3 + 2] = -0.34 + Math.sin(spin * 0.72) * radius * 0.42;
        }
        wisp.geometry.attributes.position.needsUpdate = true;
        wisp.material.opacity = (0.12 + activation * 0.22) * (0.82 + 0.18 * Math.sin(time * 2 + wispIndex));
      });

      // The title pulse throws a deterministic burst upward and outward; until
      // then the points sit below the stage so screenshots do not catch a pop.
      const burstAge = Math.max(0, (f - reveal.frame) / d.render.fps);
      for (let i = 0; i < emberSeeds.length; i++) {
        const ember = emberSeeds[i];
        const life = fract(burstAge * (0.36 + ember.speed * 0.14) + ember.phase);
        const distance = burstAge > 0 ? (0.26 + life * 1.9) * (0.40 + ember.radius) : 0;
        const angle = ember.lane + burstAge * (1.3 + ember.wobble * 0.14);
        emberPositions[i * 3] = burstAge > 0 ? Math.cos(angle) * distance : 0;
        emberPositions[i * 3 + 1] = burstAge > 0 ? plume.sourceY + 0.35 + life * plume.height * 0.82 + Math.sin(angle * 2) * 0.35 : -20;
        emberPositions[i * 3 + 2] = burstAge > 0 ? Math.sin(angle) * distance * 0.38 : 0;
        emberMix.copy(accentColor).lerp(titleColor, hash(i + 800) * 0.48).multiplyScalar(0.55 + 0.45 * Math.sin(life * Math.PI));
        emberColors[i * 3] = emberMix.r; emberColors[i * 3 + 1] = emberMix.g; emberColors[i * 3 + 2] = emberMix.b;
      }
      emberGeometry.attributes.position.needsUpdate = true;
      emberGeometry.attributes.color.needsUpdate = true;
      emberMaterial.opacity = burstAge > 0 ? Math.max(0, 0.77 * (1 - burstAge / 3.2)) : 0;

      sourceGlow.material.opacity = (0.38 + activation * 0.50 + flash * 0.30) * effects.glow;
      sourceGlow.scale.set(2.2 + activation * 1.0, 0.62 + activation * 0.28, 1);
      impactRing.scale.setScalar(lerp(0.18, 5.6, outCubic(clamp01((f - reveal.frame) / 22))));
      impactRing.material.opacity = flash * 0.77 * effects.glow;
      titleBloom.scale.setScalar(lerp(0.2, 5.3, outCubic(revealAmount)));
      titleBloom.material.opacity = (flash * 0.82 + revealAmount * 0.13) * effects.glow;

      const shake = flash * effects.shake;
      camera.position.set(
        originalCamera.x + Math.sin(f * 2.37) * shake,
        originalCamera.y + Math.cos(f * 3.71) * shake * 0.58,
        originalCamera.z - flash * 0.15
      );
      camera.lookAt(lookAt.x, lookAt.y + flash * 0.035, lookAt.z);

      typeMask.style.clipPath = `inset(0 ${Math.round((1 - revealAmount) * 100)}% 0 0)`;
      type.style.opacity = String(revealAmount);
      type.style.transform = `translateY(${Math.round(lerp(30, 0, outCubic(revealAmount)))}px) scale(${lerp(0.935, 1, outCubic(revealAmount)).toFixed(3)})`;
      rule.style.opacity = String(smooth(reveal.frame + reveal.duration * 0.42, reveal.frame + reveal.duration + 5, f));
      rule.style.width = `${Math.round(W * 0.28 * outCubic(smooth(reveal.frame + reveal.duration * 0.28, reveal.frame + reveal.duration + 5, f)))}px`;
      const subAmount = smooth(reveal.frame + reveal.duration * 0.7, reveal.frame + reveal.duration + 10, f);
      subline.style.opacity = String(subAmount);
      subline.style.transform = `translate(-50%,${Math.round(lerp(10, 0, subAmount))}px)`;
    },
    probe() {
      return {
        type: 'smoke_title', id: name, word: reveal.word, titleFrame: reveal.frame,
        particleCount: smokeSeeds.length + coreSeeds.length, emberCount: emberSeeds.length,
        deterministic: true
      };
    }
  };
}
