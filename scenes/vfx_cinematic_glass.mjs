// Cinematic Glass Growth ----------------------------------------------------
//
// A deterministic, browser-native "hero shot" preview for the final DCC
// pipeline.  It is intentionally a real shot rather than an abstract effect:
// a thick blue pane falls through a concrete studio, fractures, throws sharp
// prisms and dust, then clears for a title.  Every transform is derived from
// the requested frame, so render farms and an AI director can seek safely.
//
// This scene uses only Three primitives and procedural canvas textures.  It
// does not pretend to be a replacement for Cycles/Nuke: the forthcoming DCC
// worker is where true refraction, rigid-body shard collisions and optical
// compositing belong.  Its job is to make the browser preview feel like a
// designed cinematic shot instead of a generic transition.

const DEFAULT = {
  render: { frames: 144, fps: 24, width: 1920, height: 1080, bg: '#03070D' },
  studio: {
    floorY: -2.32, wallZ: -7.2, haze: 1.08, concrete: '#101722', rim: '#168BFF'
  },
  glass: {
    width: 3.72, height: 4.76, thickness: 0.13, dropHeight: 4.35,
    color: '#118CFF', opacity: 0.53, roughness: 0.055, metalness: 0.16,
    shardCols: 12, shardRows: 10
  },
  impact: {
    frame: 52, crackFrames: 10, burst: 4.55, gravity: 8.8,
    restitution: 0.37, slowMotion: 0.56
  },
  reveal: {
    word: 'GROWTH', color: '#F4FBFF', subline: 'MAKE THE IMPACT',
    frame: 98, duration: 18
  },
  camera: { position: [0.16, -0.78, 10.85], lookAt: [0, -0.12, 0], push: 3.45 },
  effects: { glow: 1.35, shake: 0.32, dust: 720, sparks: 680, grain: 0.17 }
};

const cache = new Map();
const TAU = Math.PI * 2;
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);
const lerp = (from, to, amount) => from + (to - from) * amount;
const fract = (value) => value - Math.floor(value);
const hash = (seed) => fract(Math.sin(seed * 127.1 + 311.7) * 43758.5453123);
const outCubic = (value) => 1 - Math.pow(1 - clamp01(value), 3);
const outQuart = (value) => 1 - Math.pow(1 - clamp01(value), 4);
const inQuad = (value) => {
  const t = clamp01(value);
  return t * t;
};

function smooth(from, to, value) {
  const t = clamp01((value - from) / Math.max(0.00001, to - from));
  return t * t * (3 - 2 * t);
}

function merge(base, value) {
  const output = { ...base };
  if (!isObject(value)) return output;
  for (const [key, next] of Object.entries(value)) {
    output[key] = isObject(base[key]) && isObject(next) ? merge(base[key], next) : next;
  }
  return output;
}

function configName() {
  const raw = new URLSearchParams(location.search).get('vfx') || 'cinematic_glass_growth';
  // The config name is only ever used below this fixed directory.  A hand-edited
  // URL cannot turn it into a path or module name.
  return /^[a-z0-9_-]{1,80}$/i.test(raw) ? raw : 'cinematic_glass_growth';
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
    number(value[0], fallback[0], -30, 30),
    number(value[1], fallback[1], -30, 30),
    number(value[2], fallback[2], -30, 30)
  ];
}

function normalize(raw) {
  const source = merge(DEFAULT, raw);
  const render = source.render || {};
  const studio = source.studio || {};
  const glass = source.glass || {};
  const impact = source.impact || {};
  const reveal = source.reveal || {};
  const camera = source.camera || {};
  const effects = source.effects || {};
  const normalizedRender = {
    frames: integer(render.frames, DEFAULT.render.frames, 48, 900),
    fps: integer(render.fps, DEFAULT.render.fps, 12, 60),
    width: integer(render.width, DEFAULT.render.width, 320, 3840),
    height: integer(render.height, DEFAULT.render.height, 180, 2160),
    bg: color(render.bg, DEFAULT.render.bg)
  };
  const impactFrame = integer(impact.frame, DEFAULT.impact.frame, 16, normalizedRender.frames - 28);
  return {
    render: normalizedRender,
    studio: {
      floorY: number(studio.floorY, DEFAULT.studio.floorY, -5, 2),
      wallZ: number(studio.wallZ, DEFAULT.studio.wallZ, -16, -2),
      haze: number(studio.haze, DEFAULT.studio.haze, 0, 3),
      concrete: color(studio.concrete, DEFAULT.studio.concrete),
      rim: color(studio.rim, DEFAULT.studio.rim)
    },
    glass: {
      width: number(glass.width, DEFAULT.glass.width, 0.7, 8),
      height: number(glass.height, DEFAULT.glass.height, 0.7, 8),
      thickness: number(glass.thickness, DEFAULT.glass.thickness, 0.025, 0.45),
      dropHeight: number(glass.dropHeight, DEFAULT.glass.dropHeight, 0.4, 10),
      color: color(glass.color, DEFAULT.glass.color),
      opacity: number(glass.opacity, DEFAULT.glass.opacity, 0.1, 0.94),
      roughness: number(glass.roughness, DEFAULT.glass.roughness, 0.01, 0.9),
      metalness: number(glass.metalness, DEFAULT.glass.metalness, 0, 1),
      shardCols: integer(glass.shardCols, DEFAULT.glass.shardCols, 4, 20),
      shardRows: integer(glass.shardRows, DEFAULT.glass.shardRows, 4, 18)
    },
    impact: {
      frame: impactFrame,
      crackFrames: integer(impact.crackFrames, DEFAULT.impact.crackFrames, 4, 28),
      burst: number(impact.burst, DEFAULT.impact.burst, 0.4, 9),
      gravity: number(impact.gravity, DEFAULT.impact.gravity, 1, 24),
      restitution: number(impact.restitution, DEFAULT.impact.restitution, 0.05, 0.85),
      slowMotion: number(impact.slowMotion, DEFAULT.impact.slowMotion, 0.15, 1)
    },
    reveal: {
      word: text(reveal.word, DEFAULT.reveal.word, 32),
      color: color(reveal.color, DEFAULT.reveal.color),
      subline: text(reveal.subline, DEFAULT.reveal.subline, 72),
      frame: integer(reveal.frame, DEFAULT.reveal.frame, impactFrame + 14, normalizedRender.frames - 8),
      duration: integer(reveal.duration, DEFAULT.reveal.duration, 7, 60)
    },
    camera: {
      position: vector(camera.position, DEFAULT.camera.position),
      lookAt: vector(camera.lookAt, DEFAULT.camera.lookAt),
      push: number(camera.push, DEFAULT.camera.push, 0.2, 6)
    },
    effects: {
      glow: number(effects.glow, DEFAULT.effects.glow, 0, 3),
      shake: number(effects.shake, DEFAULT.effects.shake, 0, 1.5),
      dust: integer(effects.dust, DEFAULT.effects.dust, 160, 1200),
      sparks: integer(effects.sparks, DEFAULT.effects.sparks, 160, 1400),
      grain: number(effects.grain, DEFAULT.effects.grain, 0, 0.4)
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
  const data = await loadConfig(configName());
  return {
    id: `vfx_cinematic_glass:${configName()}`,
    frames: data.render.frames,
    fps: data.render.fps,
    width: data.render.width,
    height: data.render.height,
    bg: data.render.bg
  };
}

function makeSoftTexture(THREE, inner, middle, edge = 'rgba(0,0,0,0)') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(96, 96, 0, 96, 96, 96);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.23, middle);
  gradient.addColorStop(0.68, 'rgba(18,95,255,0.055)');
  gradient.addColorStop(1, edge);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 192, 192);
  return new THREE.CanvasTexture(canvas);
}

function makeConcreteTexture(THREE, dark = false) {
  const size = 768;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = dark ? '#091019' : '#131B26';
  context.fillRect(0, 0, size, size);
  // Fine, deterministic concrete grain.  It is a texture, not live randomness,
  // so every render receives the same studio surface.
  for (let i = 0; i < 8800; i++) {
    const x = Math.floor(hash(i + 11) * size);
    const y = Math.floor(hash(i + 41) * size);
    const lum = Math.floor(18 + hash(i + 71) * 34);
    const alpha = 0.018 + hash(i + 91) * 0.075;
    context.fillStyle = `rgba(${lum},${lum + 5},${lum + 12},${alpha})`;
    const s = 1 + Math.floor(hash(i + 121) * 3);
    context.fillRect(x, y, s, s);
  }
  context.globalAlpha = 0.22;
  context.strokeStyle = '#667386';
  context.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const y = Math.floor((i + 0.4) * size / 7 + (hash(i + 200) - 0.5) * 14);
    context.beginPath();
    context.moveTo(0, y);
    for (let x = 0; x < size; x += 80) {
      context.lineTo(x, y + (hash(i * 80 + x) - 0.5) * 12);
    }
    context.stroke();
  }
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(dark ? 2.5 : 3.5, dark ? 1.7 : 3.5);
  return texture;
}

function makeStreakTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 192;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 512, 0);
  gradient.addColorStop(0, 'rgba(0,126,255,0)');
  gradient.addColorStop(0.34, 'rgba(34,151,255,0.04)');
  gradient.addColorStop(0.5, 'rgba(178,239,255,0.72)');
  gradient.addColorStop(0.66, 'rgba(34,151,255,0.04)');
  gradient.addColorStop(1, 'rgba(0,126,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 192);
  return new THREE.CanvasTexture(canvas);
}

function makeShardPrism(THREE, a, b, c, center, thickness) {
  const top = thickness * 0.5;
  const bottom = -top;
  const local = (point, z) => [point.x - center.x, point.y - center.y, z];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    ...local(a, top), ...local(b, top), ...local(c, top),
    ...local(a, bottom), ...local(b, bottom), ...local(c, bottom)
  ], 3));
  geometry.setIndex([
    0, 1, 2, 5, 4, 3,
    0, 3, 4, 0, 4, 1,
    1, 4, 5, 1, 5, 2,
    2, 5, 3, 2, 3, 0
  ]);
  geometry.computeVertexNormals();
  const edge = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(...local(a, top + 0.006)),
    new THREE.Vector3(...local(b, top + 0.006)),
    new THREE.Vector3(...local(c, top + 0.006)),
    new THREE.Vector3(...local(a, top + 0.006))
  ]);
  return { geometry, edge };
}

// Closed-form gravity with five energy-losing bounces.  It is deliberately
// frame-addressable: unlike a mutable physics world it gives identical results
// when rendering frame 92 in isolation or after frames 0–91.
function bounceY(startY, startVelocity, seconds, floor, gravity, restitution) {
  let y = startY;
  let velocity = startVelocity;
  let remaining = Math.max(0, seconds);
  for (let bounce = 0; bounce < 5 && remaining > 0.0001; bounce++) {
    const discriminant = Math.max(0, velocity * velocity + 2 * gravity * Math.max(0, y - floor));
    const hit = (velocity + Math.sqrt(discriminant)) / gravity;
    if (remaining <= hit) return Math.max(floor, y + velocity * remaining - 0.5 * gravity * remaining * remaining);
    y = floor;
    remaining -= hit;
    velocity = -Math.abs(velocity - gravity * hit) * restitution;
    if (Math.abs(velocity) < 0.16) return floor;
  }
  return Math.max(floor, y + velocity * remaining - 0.5 * gravity * remaining * remaining);
}

function makeSeeds(count, offset = 0) {
  return Array.from({ length: count }, (_, index) => {
    const n = index + offset;
    return {
      theta: hash(n + 1) * TAU, radial: 0.16 + hash(n + 3) * 1.05,
      speed: 0.5 + hash(n + 5) * 2.0, phase: hash(n + 7),
      rise: hash(n + 11), depth: hash(n + 13) - 0.5,
      wobble: 1.3 + hash(n + 17) * 4.8, brightness: 0.45 + hash(n + 19) * 0.55
    };
  });
}

export function create(THREE, ctx) {
  const name = configName();
  const data = cache.get(name) && typeof cache.get(name).then !== 'function'
    ? cache.get(name) : normalize({});
  const { scene, camera, renderer, overlayRoot: overlay, width: W, height: H } = ctx;
  const { studio, glass, impact, reveal, effects } = data;
  const impactFrame = impact.frame;
  const crackEnd = impactFrame + impact.crackFrames;
  const paneImpactY = studio.floorY + glass.height * 0.5 + glass.thickness * 0.5;
  const fracture = { x: 0.02, y: -glass.height * 0.42 };
  const originalCamera = new THREE.Vector3().fromArray(data.camera.position);
  const originalLookAt = new THREE.Vector3().fromArray(data.camera.lookAt);
  const blue = new THREE.Color(glass.color);
  const rimBlue = new THREE.Color(studio.rim);
  const titleBlue = new THREE.Color(reveal.color);

  // Keep the studio in the low end.  The glass should earn its highlights
  // from the practicals instead of turning the whole break into a bright UI.
  renderer.toneMappingExposure = 0.98;
  camera.fov = 39;
  camera.near = 0.1;
  camera.far = 80;
  camera.updateProjectionMatrix();
  scene.background = new THREE.Color(data.render.bg);
  scene.fog = new THREE.Fog(data.render.bg, 7.5, 24 - studio.haze * 3);
  camera.position.copy(originalCamera);
  camera.lookAt(originalLookAt);

  // ---------------------------------------------------------------- Studio --
  // Several different roughness levels and practical-looking lights make the
  // plate read as a luxury concrete room rather than an empty dark background.
  const floorTexture = makeConcreteTexture(THREE, false);
  const wallTexture = makeConcreteTexture(THREE, true);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshStandardMaterial({
      // Keep the floor genuinely dark; the blue reflection pool and practical
      // lights should create the highlights instead of a light-grey base coat.
      map: floorTexture, color: 0x0A131F, roughness: 0.53, metalness: 0.34
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = studio.floorY;
  floor.receiveShadow = true;
  scene.add(floor);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 13),
    new THREE.MeshStandardMaterial({
      map: wallTexture, color: new THREE.Color(studio.concrete), roughness: 0.74, metalness: 0.12
    })
  );
  wall.position.set(0, 3.8, studio.wallZ);
  scene.add(wall);

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(21, 0.20, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x060B12, roughness: 0.34, metalness: 0.68 })
  );
  plinth.position.set(0, studio.floorY + 0.1, studio.wallZ + 0.12);
  scene.add(plinth);

  for (const side of [-1, 1]) {
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 10.6, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x080E16, roughness: 0.41, metalness: 0.53 })
    );
    column.position.set(side * 7.55, 2.75, studio.wallZ + 0.32);
    scene.add(column);
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(0.047, 8.3, 0.025),
      new THREE.MeshBasicMaterial({ color: rimBlue, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending })
    );
    seam.position.set(side * 6.86, 2.45, studio.wallZ + 0.04);
    scene.add(seam);
  }

  const haloTexture = makeSoftTexture(THREE, 'rgba(228,248,255,0.92)', 'rgba(20,133,255,0.28)');
  const hazeTexture = makeSoftTexture(THREE, 'rgba(97,178,255,0.27)', 'rgba(8,50,118,0.11)');
  const streakTexture = makeStreakTexture(THREE);
  const backHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture, color: rimBlue, transparent: true, opacity: 0.245 * effects.glow,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  backHalo.position.set(0, 0.85, studio.wallZ + 0.18);
  backHalo.scale.set(12.2, 12.2, 1);
  scene.add(backHalo);
  const sideHaze = new THREE.Sprite(new THREE.SpriteMaterial({
    map: hazeTexture, color: 0x78B9FF, transparent: true, opacity: 0.12 * studio.haze,
    depthWrite: false, blending: THREE.NormalBlending
  }));
  sideHaze.position.set(-3.1, 0.25, studio.wallZ + 0.35);
  sideHaze.scale.set(13.5, 8.2, 1);
  scene.add(sideHaze);

  const lightBars = [];
  for (const x of [-4.65, 4.65]) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 5.4, 0.03),
      new THREE.MeshBasicMaterial({ color: rimBlue, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending })
    );
    bar.position.set(x, 1.0, studio.wallZ + 0.08);
    scene.add(bar); lightBars.push(bar);
  }

  scene.add(new THREE.HemisphereLight(0x89BFFF, 0x03060A, 1.30));
  const key = new THREE.DirectionalLight(0xDCF6FF, 2.65);
  key.position.set(-4.4, 6.4, 5.5); scene.add(key);
  const blueRim = new THREE.PointLight(rimBlue, 21 * effects.glow, 13, 1.8);
  blueRim.position.set(4.8, 2.2, 1.6); scene.add(blueRim);
  const rearRim = new THREE.PointLight(0x0A6FFF, 25 * effects.glow, 15, 1.45);
  rearRim.position.set(-2.8, 2.2, studio.wallZ + 1.15); scene.add(rearRim);
  const lowFill = new THREE.PointLight(0x1D77D4, 8.5 * effects.glow, 8, 2);
  lowFill.position.set(-1.7, studio.floorY + 0.35, 3.0); scene.add(lowFill);

  // A horizontal, textured pool gives the polished concrete a controllable
  // fake reflection.  It works in the browser renderer where real planar
  // reflections would be too costly for a 144-frame approval render.
  const reflectionPool = new THREE.Mesh(
    new THREE.PlaneGeometry(9.2, 4.2),
    new THREE.MeshBasicMaterial({
      map: streakTexture, color: rimBlue, transparent: true, opacity: 0.14,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  reflectionPool.rotation.x = -Math.PI / 2;
  reflectionPool.position.set(0, studio.floorY + 0.012, 0.72);
  scene.add(reflectionPool);

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 2.2),
    new THREE.MeshBasicMaterial({ map: makeSoftTexture(THREE, 'rgba(0,0,0,0.46)', 'rgba(0,0,0,0.15)'), transparent: true, opacity: 0.58, depthWrite: false })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, studio.floorY + 0.009, 0.28);
  scene.add(contactShadow);

  // -------------------------------------------------------------- Glass pane --
  const paneRig = new THREE.Group();
  const paneMaterial = new THREE.MeshPhysicalMaterial({
    color: blue, metalness: glass.metalness, roughness: glass.roughness,
    transmission: 0.09, thickness: glass.thickness, transparent: true,
    opacity: glass.opacity * 0.88, clearcoat: 0.92, clearcoatRoughness: 0.06,
    side: THREE.DoubleSide, depthWrite: false
  });
  const paneGeometry = new THREE.BoxGeometry(glass.width, glass.height, glass.thickness);
  const pane = new THREE.Mesh(paneGeometry, paneMaterial);
  paneRig.add(pane);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xB9E7FF, transparent: true, opacity: 0.76 });
  paneRig.add(new THREE.LineSegments(new THREE.EdgesGeometry(paneGeometry), edgeMaterial));
  // Internal transparent highlights make the thick sheet read as glass even
  // on systems where a full transmission/refraction pass is unavailable.
  const sheenMaterial = new THREE.MeshBasicMaterial({
    color: 0xD4F3FF, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const sheenA = new THREE.Mesh(new THREE.PlaneGeometry(glass.width * 0.12, glass.height * 0.91), sheenMaterial);
  sheenA.position.set(-glass.width * 0.18, 0.03, glass.thickness * 0.57); sheenA.rotation.z = -0.17; paneRig.add(sheenA);
  const sheenB = new THREE.Mesh(new THREE.PlaneGeometry(glass.width * 0.06, glass.height * 0.57), sheenMaterial.clone());
  sheenB.material.opacity = 0.10; sheenB.position.set(glass.width * 0.24, -0.46, glass.thickness * 0.58); sheenB.rotation.z = -0.17; paneRig.add(sheenB);
  scene.add(paneRig);

  // Radial crack paths exist for the small, tense beat before the pane turns
  // into individual prisms.  Their opacity is driven independently of shards.
  const crackMaterials = [];
  const crackGroup = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * TAU + (hash(i + 100) - 0.5) * 0.22;
    const reach = 0.46 + hash(i + 130) * Math.max(glass.width, glass.height) * 0.54;
    const points = [new THREE.Vector3(fracture.x, fracture.y, glass.thickness * 0.57)];
    for (let segment = 1; segment < 5; segment++) {
      const length = reach * segment / 4;
      const drift = (hash(i * 13 + segment * 17) - 0.5) * 0.18;
      points.push(new THREE.Vector3(
        clamp(fracture.x + Math.cos(angle + drift) * length, -glass.width * 0.49, glass.width * 0.49),
        clamp(fracture.y + Math.sin(angle + drift) * length, -glass.height * 0.49, glass.height * 0.49),
        glass.thickness * 0.57
      ));
    }
    const material = new THREE.LineBasicMaterial({ color: i % 4 === 0 ? 0xFFFFFF : 0x9DE3FF, transparent: true, opacity: 0 });
    crackMaterials.push(material);
    crackGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }
  paneRig.add(crackGroup);

  // ------------------------------------------------------------ Fracture rig --
  // A jittered, shared vertex lattice makes neighbouring shards meet perfectly
  // before impact but become irregular sharp prisms once the pane releases.
  const shardGroup = new THREE.Group();
  const shards = [];
  const vertices = [];
  for (let row = 0; row <= glass.shardRows; row++) {
    for (let col = 0; col <= glass.shardCols; col++) {
      const outer = row === 0 || col === 0 || row === glass.shardRows || col === glass.shardCols;
      const cw = glass.width / glass.shardCols;
      const ch = glass.height / glass.shardRows;
      vertices.push({
        x: -glass.width * 0.5 + col * cw + (outer ? 0 : (hash(row * 101 + col * 37) - 0.5) * cw * 0.52),
        y: -glass.height * 0.5 + row * ch + (outer ? 0 : (hash(row * 137 + col * 47) - 0.5) * ch * 0.52)
      });
    }
  }
  const at = (col, row) => vertices[row * (glass.shardCols + 1) + col];
  const addShard = (a, b, c, index) => {
    const center = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    const build = makeShardPrism(THREE, a, b, c, center, glass.thickness * (0.78 + hash(index + 12) * 0.45));
    const tint = blue.clone();
    tint.offsetHSL((hash(index + 31) - 0.5) * 0.045, 0.02, (hash(index + 47) - 0.5) * 0.16);
    tint.multiplyScalar(0.62 + hash(index + 53) * 0.18);
    const material = new THREE.MeshPhysicalMaterial({
      color: tint, metalness: clamp(glass.metalness + 0.04, 0, 1), roughness: clamp(glass.roughness + 0.11, 0.01, 0.8),
      transmission: 0.045, thickness: glass.thickness * 0.8, transparent: true, opacity: 0,
      clearcoat: 0.66, clearcoatRoughness: 0.12, flatShading: true, side: THREE.DoubleSide, depthWrite: false
    });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(build.geometry, material);
    group.add(mesh);
    let edge = null;
    let shardEdgeMaterial = null;
    // Not every shard needs a drawn outline; alternating them keeps the field
    // sharp without doubling the complete scene's draw-call count.
    if (index % 7 === 0) {
      shardEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x8DCAEE, transparent: true, opacity: 0 });
      edge = new THREE.Line(build.edge, shardEdgeMaterial); group.add(edge);
    }
    group.position.set(center.x, paneImpactY + center.y, 0);
    group.rotation.set(-0.042, -0.14, 0.034);
    shardGroup.add(group);
    const dx = center.x - fracture.x;
    const dy = center.y - fracture.y;
    const distance = Math.max(0.16, Math.hypot(dx, dy));
    const radialX = dx / distance;
    const radialY = dy / distance;
    const speed = impact.burst * (0.56 + hash(index + 71) * 0.72);
    shards.push({
      group, mesh, material, edge, edgeMaterial: shardEdgeMaterial,
      x0: center.x, y0: paneImpactY + center.y, z0: 0,
      vx: radialX * speed + (hash(index + 83) - 0.5) * 1.38,
      vy: 0.35 + radialY * speed * 0.48 + hash(index + 97) * 2.05,
      vz: 0.52 + hash(index + 107) * 2.45 + (distance < 0.8 ? 0.9 : 0),
      spinX: (hash(index + 113) - 0.5) * 8.4,
      spinY: (hash(index + 127) - 0.5) * 9.2,
      spinZ: (hash(index + 139) - 0.5) * 10.4,
      kickX: radialX * (0.16 + hash(index + 173) * 0.25) + (hash(index + 179) - 0.5) * 0.14,
      kickY: radialY * (0.12 + hash(index + 181) * 0.20) + (hash(index + 191) - 0.5) * 0.11,
      kickZ: (hash(index + 193) - 0.5) * 0.72 + 0.08,
      settle: 0.62 + hash(index + 151) * 0.92,
      phase: hash(index + 163) * TAU
    });
  };
  let shardIndex = 0;
  for (let row = 0; row < glass.shardRows; row++) {
    for (let col = 0; col < glass.shardCols; col++) {
      const a = at(col, row), b = at(col + 1, row), c = at(col + 1, row + 1), d = at(col, row + 1);
      if ((row + col) % 2 === 0) {
        addShard(a, b, c, shardIndex++); addShard(a, c, d, shardIndex++);
      } else {
        addShard(a, b, d, shardIndex++); addShard(b, c, d, shardIndex++);
      }
    }
  }
  shardGroup.visible = false;
  scene.add(shardGroup);

  // --------------------------------------------------------------- Impact VFX --
  const dustSeeds = makeSeeds(effects.dust, 2000);
  const dustPositions = new Float32Array(dustSeeds.length * 3);
  const dustColors = new Float32Array(dustSeeds.length * 3);
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));
  const dustMaterial = new THREE.PointsMaterial({
    map: makeSoftTexture(THREE, 'rgba(217,242,255,0.75)', 'rgba(82,167,255,0.19)'),
    size: 0.18, vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.NormalBlending
  });
  scene.add(new THREE.Points(dustGeometry, dustMaterial));

  const sparkSeeds = makeSeeds(effects.sparks, 4000);
  const sparkPositions = new Float32Array(sparkSeeds.length * 3);
  const sparkColors = new Float32Array(sparkSeeds.length * 3);
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
  const sparkMaterial = new THREE.PointsMaterial({
    map: makeSoftTexture(THREE, 'rgba(255,255,255,1)', 'rgba(110,220,255,0.60)'),
    size: 0.042, vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(sparkGeometry, sparkMaterial));

  const impactGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture, color: 0xBCEEFF, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  impactGlow.position.set(0, studio.floorY + 0.055, 0.18); impactGlow.scale.set(0.1, 0.1, 1); scene.add(impactGlow);
  // A soft, off-axis reflection reads as an impact on polished concrete.  It
  // deliberately replaces a geometric shock ring, which looked like a HUD.
  const impactWash = new THREE.Mesh(
    new THREE.PlaneGeometry(2.15, 0.78),
    new THREE.MeshBasicMaterial({
      map: makeSoftTexture(THREE, 'rgba(122,204,255,0.30)', 'rgba(20,108,232,0.07)'),
      color: rimBlue, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
    })
  );
  impactWash.rotation.x = -Math.PI / 2;
  impactWash.position.set(-0.12, studio.floorY + 0.018, 0.28);
  scene.add(impactWash);

  const floorCracks = [];
  for (let i = 0; i < 15; i++) {
    const angle = (i / 15) * TAU + (hash(i + 610) - 0.5) * 0.2;
    const points = [new THREE.Vector3(0, studio.floorY + 0.022, 0.08)];
    for (let p = 1; p < 5; p++) {
      const r = p * (0.42 + hash(i + p * 31) * 0.23);
      points.push(new THREE.Vector3(
        Math.cos(angle + (hash(i * 19 + p) - 0.5) * 0.18) * r,
        studio.floorY + 0.022,
        Math.sin(angle + (hash(i * 23 + p) - 0.5) * 0.18) * r
      ));
    }
    const material = new THREE.LineBasicMaterial({ color: 0x5FAEFF, transparent: true, opacity: 0 });
    floorCracks.push(material);
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }

  // --------------------------------------------------------- Typography pass --
  // HTML is intentionally used only for the message.  It makes type sharp at
  // 1080p and keeps prompt-supplied words safe because textContent is used.
  overlay.innerHTML = '';
  overlay.style.cssText += ';overflow:hidden;font-family:Inter,"Arial Narrow","Segoe UI",Arial,sans-serif;';
  const vignette = document.createElement('div');
  vignette.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 47%,rgba(0,0,0,0) 31%,rgba(0,0,0,.13) 64%,rgba(0,0,0,.73) 114%);';
  overlay.appendChild(vignette);
  const grain = document.createElement('div');
  grain.style.cssText = `position:absolute;inset:0;pointer-events:none;opacity:${effects.grain};mix-blend-mode:screen;background-image:repeating-radial-gradient(circle at 23% 47%,rgba(255,255,255,.22) 0 1px,transparent 1px 3px),repeating-radial-gradient(circle at 69% 31%,rgba(117,184,255,.18) 0 1px,transparent 1px 4px);background-size:7px 9px,11px 13px;`;
  overlay.appendChild(grain);
  const topBar = document.createElement('div');
  topBar.style.cssText = 'position:absolute;left:0;right:0;top:0;height:3.25%;background:#010204;'; overlay.appendChild(topBar);
  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:3.25%;background:#010204;'; overlay.appendChild(bottomBar);

  const titleMask = document.createElement('div');
  titleMask.style.cssText = 'position:absolute;left:7%;right:7%;top:37%;height:26%;display:flex;align-items:center;justify-content:center;overflow:hidden;clip-path:inset(0 50% 0 50%);';
  const titleGlow = document.createElement('div');
  const typeSize = Math.round(Math.min(H * 0.19, W / Math.max(4.0, reveal.word.length * 0.54)));
  titleGlow.style.cssText = `position:absolute;color:${studio.rim};font-size:${typeSize}px;font-weight:900;letter-spacing:.115em;line-height:.78;white-space:nowrap;filter:blur(20px);opacity:0;`;
  titleGlow.textContent = reveal.word;
  const title = document.createElement('div');
  title.style.cssText = `position:relative;color:${reveal.color};font-size:${typeSize}px;font-weight:900;letter-spacing:.115em;line-height:.78;white-space:nowrap;opacity:0;transform:translateY(36px) scale(.94);text-shadow:0 1px 0 rgba(255,255,255,.42),0 0 10px rgba(224,249,255,.78),0 0 36px rgba(35,151,255,.49);`;
  title.textContent = reveal.word;
  titleMask.append(titleGlow, title); overlay.appendChild(titleMask);
  const leftRule = document.createElement('div');
  const rightRule = document.createElement('div');
  for (const [rule, x, sign] of [[leftRule, 'calc(50% - 2px)', -1], [rightRule, 'calc(50% + 2px)', 1]]) {
    rule.style.cssText = `position:absolute;top:62.2%;left:${x};height:1px;width:0;background:${reveal.color};box-shadow:0 0 11px ${studio.rim},0 0 27px ${studio.rim};opacity:0;transform-origin:${sign < 0 ? 'right' : 'left'} center;`;
    overlay.appendChild(rule);
  }
  const subline = document.createElement('div');
  subline.style.cssText = `position:absolute;left:50%;top:65%;transform:translate(-50%,12px);font-size:${Math.round(H * 0.019)}px;font-weight:700;letter-spacing:.36em;white-space:nowrap;color:${reveal.color};opacity:0;text-shadow:0 0 12px ${studio.rim};`;
  subline.textContent = reveal.subline; overlay.appendChild(subline);
  const dustMix = new THREE.Color();
  const sparkMix = new THREE.Color();
  const N = data.render.frames;

  return {
    update(frame) {
      const f = clamp(Math.round(frame), 0, N - 1);
      const preImpact = clamp01(f / impactFrame);
      const release = smooth(impactFrame - 1, crackEnd + 1, f);
      const crackAmount = smooth(impactFrame - 2, impactFrame + 3, f) * (1 - smooth(crackEnd - 3, crackEnd + 1, f));
      const postSeconds = Math.max(0, (f - impactFrame) / data.render.fps) * impact.slowMotion;
      const blast = smooth(impactFrame - 1, impactFrame + 3, f) * (1 - smooth(impactFrame + 6, impactFrame + 25, f));
      const settle = smooth(impactFrame + 30, impactFrame + 78, f);

      // Falling is an accelerating curve.  It starts above the lens and lands
      // at the pane's exact half-height, making the lower edge meet the floor.
      const fall = inQuad(preImpact);
      paneRig.position.set(
        Math.sin(preImpact * 2.2) * 0.055,
        lerp(paneImpactY + glass.dropHeight, paneImpactY, fall),
        -0.04 + Math.sin(preImpact * 3.1) * 0.045
      );
      paneRig.rotation.set(
        -0.045 + preImpact * 0.017,
        -0.16 + Math.sin(preImpact * 2.4) * 0.035,
        0.038 - preImpact * 0.018
      );
      // The intact hero pane gives way before the fracture field fills frame.
      // Otherwise a translucent square survives behind the shards and makes
      // the break read like a layer toggle instead of a physical failure.
      const paneFade = 1 - smooth(impactFrame - 1, crackEnd + 0.5, f);
      paneRig.visible = paneFade > 0.008;
      paneMaterial.opacity = glass.opacity * 0.88 * paneFade;
      edgeMaterial.opacity = 0.76 * paneFade;
      sheenMaterial.opacity = 0.14 * paneFade;
      sheenB.material.opacity = 0.075 * paneFade;
      crackMaterials.forEach((material, index) => {
        material.opacity = crackAmount * (index % 3 === 0 ? 0.96 : 0.68);
      });

      shardGroup.visible = release > 0.003;
      for (let i = 0; i < shards.length; i++) {
        const shard = shards[i];
        const travel = Math.min(postSeconds, shard.settle + 1.05);
        const friction = 1 / (1 + travel * 0.31);
        const fractureKick = smooth(impactFrame - 0.5, impactFrame + 6, f);
        const x = shard.x0 + shard.kickX * fractureKick + shard.vx * travel * friction;
        const z = shard.z0 + shard.kickZ * fractureKick + shard.vz * travel * friction - travel * travel * 0.19;
        const y = bounceY(shard.y0 + shard.kickY * fractureKick, shard.vy, travel, studio.floorY + glass.thickness * 0.34, impact.gravity, impact.restitution);
        shard.group.position.set(x, y, z);
        const spin = Math.min(travel, 1.75) * (1 - travel * 0.08);
        shard.group.rotation.set(
          -0.042 + shard.spinX * spin,
          -0.14 + shard.spinY * spin,
          0.034 + shard.spinZ * spin
        );
        const fadeForTitle = 1 - smooth(reveal.frame - 10, reveal.frame + 24, f) * 0.34;
        shard.material.opacity = release * glass.opacity * 0.58 * fadeForTitle;
        if (shard.edgeMaterial) shard.edgeMaterial.opacity = release * 0.16 * fadeForTitle;
      }

      // Dust is deliberately softer and slower than the bright glass splinters.
      // Both point clouds disappear below the set before the impact so a static
      // frame cannot catch a pre-roll cloud.
      const dustAge = postSeconds;
      for (let i = 0; i < dustSeeds.length; i++) {
        const seed = dustSeeds[i];
        if (dustAge <= 0) {
          dustPositions[i * 3 + 1] = -50;
          dustColors[i * 3] = dustColors[i * 3 + 1] = dustColors[i * 3 + 2] = 0;
          continue;
        }
        const life = clamp01(dustAge / (1.8 + seed.phase * 1.2));
        const radius = seed.radial * (0.25 + dustAge * seed.speed * 1.52) * (1 - life * 0.25);
        const angle = seed.theta + dustAge * (0.30 + seed.wobble * 0.07);
        dustPositions[i * 3] = Math.cos(angle) * radius + Math.sin(dustAge * seed.wobble + seed.phase) * 0.17;
        dustPositions[i * 3 + 1] = studio.floorY + 0.04 + seed.rise * (0.32 + dustAge * 1.24) - dustAge * dustAge * 0.24;
        dustPositions[i * 3 + 2] = seed.depth * (0.8 + dustAge * 2.2) + Math.sin(angle * 2.1) * 0.22;
        dustMix.copy(blue).lerp(titleBlue, 0.38).multiplyScalar(seed.brightness * (1 - life * 0.64));
        dustColors[i * 3] = dustMix.r; dustColors[i * 3 + 1] = dustMix.g; dustColors[i * 3 + 2] = dustMix.b;
      }
      dustGeometry.attributes.position.needsUpdate = true;
      dustGeometry.attributes.color.needsUpdate = true;
      dustMaterial.opacity = dustAge > 0 ? (0.48 * (1 - clamp01(dustAge / 3.5))) : 0;

      for (let i = 0; i < sparkSeeds.length; i++) {
        const seed = sparkSeeds[i];
        if (dustAge <= 0) {
          sparkPositions[i * 3 + 1] = -50;
          sparkColors[i * 3] = sparkColors[i * 3 + 1] = sparkColors[i * 3 + 2] = 0;
          continue;
        }
        const life = clamp01(dustAge / (0.65 + seed.phase * 1.65));
        const speed = 1.5 + seed.speed * 2.15;
        const radial = dustAge * speed * (1 - life * 0.38);
        sparkPositions[i * 3] = Math.cos(seed.theta) * radial;
        sparkPositions[i * 3 + 1] = studio.floorY + 0.10 + seed.rise * 1.55 + dustAge * (1.45 + seed.rise * 1.9) - dustAge * dustAge * 1.65;
        sparkPositions[i * 3 + 2] = Math.sin(seed.theta) * radial * 0.58 + seed.depth * 0.8;
        sparkMix.copy(titleBlue).lerp(blue, seed.phase * 0.72).multiplyScalar((1 - life) * seed.brightness);
        sparkColors[i * 3] = sparkMix.r; sparkColors[i * 3 + 1] = sparkMix.g; sparkColors[i * 3 + 2] = sparkMix.b;
      }
      sparkGeometry.attributes.position.needsUpdate = true;
      sparkGeometry.attributes.color.needsUpdate = true;
      sparkMaterial.opacity = dustAge > 0 ? Math.max(0, 0.38 * (1 - dustAge / 2.25)) : 0;

      const shockProgress = outQuart(clamp01((f - impactFrame) / 27));
      impactWash.scale.set(lerp(0.52, 2.25, shockProgress), lerp(0.62, 1.18, shockProgress), 1);
      impactWash.material.opacity = blast * 0.15 * effects.glow;
      impactGlow.scale.setScalar(lerp(0.1, 5.4, outQuart(clamp01((f - impactFrame) / 22))));
      impactGlow.material.opacity = blast * 0.30 * effects.glow;
      floorCracks.forEach((material, index) => {
        material.opacity = smooth(impactFrame + 1 + index * 0.12, impactFrame + 8 + index * 0.12, f) * (1 - settle * 0.48) * 0.22;
      });
      reflectionPool.material.opacity = 0.075 + blast * 0.16 * effects.glow + release * 0.045;
      reflectionPool.scale.x = 0.9 + shockProgress * 0.22;
      lightBars.forEach((bar, index) => { bar.material.opacity = 0.31 + blast * (index ? 0.16 : 0.23); });

      // Low camera starts under the falling sheet.  The strong dolly during
      // impact gives the break a trailer-shot feeling even without a live rig.
      const push = smooth(impactFrame - 13, impactFrame + 19, f);
      const cameraShake = blast * effects.shake;
      camera.position.set(
        originalCamera.x + Math.sin(f * 2.31) * cameraShake,
        originalCamera.y + Math.cos(f * 3.73 + 0.5) * cameraShake * 0.46 + push * 0.15,
        originalCamera.z - data.camera.push * push
      );
      const followY = lerp(1.18, originalLookAt.y, outCubic(preImpact));
      camera.lookAt(
        originalLookAt.x,
        followY - push * 0.08 + Math.sin(f * 4.6) * cameraShake * 0.04,
        originalLookAt.z + 0.12
      );

      const titleAmount = smooth(reveal.frame, reveal.frame + reveal.duration, f);
      titleMask.style.clipPath = `inset(0 ${Math.round((1 - titleAmount) * 50)}% 0 ${Math.round((1 - titleAmount) * 50)}%)`;
      title.style.opacity = String(titleAmount);
      title.style.transform = `translateY(${Math.round(lerp(36, 0, outCubic(titleAmount)))}px) scale(${lerp(0.94, 1, outCubic(titleAmount)).toFixed(3)})`;
      titleGlow.style.opacity = String(titleAmount * 0.60);
      const ruleAmount = smooth(reveal.frame + reveal.duration * 0.36, reveal.frame + reveal.duration + 8, f);
      const ruleWidth = Math.round(W * 0.13 * outCubic(ruleAmount));
      leftRule.style.width = `${ruleWidth}px`; leftRule.style.transform = 'translateX(-100%)'; leftRule.style.opacity = String(ruleAmount);
      rightRule.style.width = `${ruleWidth}px`; rightRule.style.opacity = String(ruleAmount);
      const subAmount = smooth(reveal.frame + reveal.duration * 0.72, reveal.frame + reveal.duration + 10, f);
      subline.style.opacity = String(subAmount);
      subline.style.transform = `translate(-50%,${Math.round(lerp(12, 0, subAmount))}px)`;
    },
    probe() {
      return {
        type: 'cinematic_glass_reveal', id: name, word: reveal.word,
        impactFrame, revealFrame: reveal.frame, shardCount: shards.length,
        dustCount: dustSeeds.length, sparkCount: sparkSeeds.length,
        deterministic: true, previewLimitation: 'browser_preview_no_true_refraction_or_inter_shard_collision'
      };
    }
  };
}
