// Glass Break Reveal ---------------------------------------------------------
// A deterministic browser-preview VFX primitive.  It deliberately uses only
// Three.js + the harness overlay: the same frame always produces the same
// falling pane, fracture, shard motion, and type reveal.  That makes it useful
// both as a fast creative preview and as a stable render target for agents.
//
// Optional data contract: /data/vfx/<vfx>.json, selected with ?vfx=<slug>.
//   { render, glass, impact, reveal, camera, effects }
// Missing fields safely fall back to the polished demo below, so this scene is
// directly playable at ?scene=vfx_glass_break as well.

const DEFAULT = {
  render: { frames: 210, fps: 30, width: 1280, height: 720, bg: '#06101b' },
  glass: {
    width: 3.25, height: 3.95, thickness: 0.055, color: '#9fe8ff',
    opacity: 0.58, roughness: 0.13, metalness: 0.10,
    shardCols: 7, shardRows: 9, dropHeight: 3.6
  },
  impact: {
    frame: 72, floorY: -2.18, burst: 3.2, gravity: 12.2,
    restitution: 0.42, slowMotion: 0.72
  },
  reveal: {
    word: 'BREAKTHROUGH', color: '#f4fbff',
    subline: 'MAKE THE IMPACT', delayFrames: 4
  },
  camera: { position: [0, 0.18, 8.15], lookAt: [0, -0.20, 0] },
  effects: { shake: 0.14, glow: 1.0 }
};

const cache = new Map();
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const clamp01 = (n) => clamp(n, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / Math.max(0.00001, b - a));
  return t * t * (3 - 2 * t);
};
const outCubic = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const hash = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

function merge(base, value) {
  const out = { ...base };
  if (!isObject(value)) return out;
  for (const [key, next] of Object.entries(value)) {
    out[key] = isObject(base[key]) && isObject(next) ? merge(base[key], next) : next;
  }
  return out;
}

function sceneName() {
  const raw = new URLSearchParams(location.search).get('vfx') || 'glass_break_demo';
  // Keep the fetch path and scene id filesystem-safe even when a preview URL is
  // hand-edited.  Unknown names simply receive the fallback demo.
  return /^[a-z0-9_-]{1,80}$/i.test(raw) ? raw : 'glass_break_demo';
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

function integer(value, fallback, min, max) {
  return Math.round(number(value, fallback, min, max));
}

function color(value, fallback) {
  // Restrict input to CSS hex values; invalid agent/user input never reaches a
  // Three material or style property.
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
  const glass = d.glass || {};
  const impact = d.impact || {};
  const reveal = d.reveal || {};
  const camera = d.camera || {};
  const effects = d.effects || {};
  // Keep these limits in lockstep with vfx.mjs. A valid VFX specification must
  // render identically in the browser instead of being silently clamped to a
  // different timeline or size here.
  const normalizedRender = {
    frames: integer(render.frames, DEFAULT.render.frames, 12, 900),
    fps: integer(render.fps, DEFAULT.render.fps, 12, 60),
    width: integer(render.width, DEFAULT.render.width, 320, 3840),
    height: integer(render.height, DEFAULT.render.height, 180, 2160),
    bg: color(render.bg, DEFAULT.render.bg)
  };
  return {
    render: normalizedRender,
    glass: {
      width: number(glass.width, DEFAULT.glass.width, 0.1, 8),
      height: number(glass.height, DEFAULT.glass.height, 0.1, 8),
      thickness: number(glass.thickness, DEFAULT.glass.thickness, 0.01, 0.5),
      color: color(glass.color, DEFAULT.glass.color),
      opacity: number(glass.opacity, DEFAULT.glass.opacity, 0.05, 1),
      roughness: number(glass.roughness, DEFAULT.glass.roughness, 0, 1),
      metalness: number(glass.metalness, DEFAULT.glass.metalness, 0, 1),
      shardCols: integer(glass.shardCols, DEFAULT.glass.shardCols, 2, 24),
      shardRows: integer(glass.shardRows, DEFAULT.glass.shardRows, 2, 24),
      dropHeight: number(glass.dropHeight, DEFAULT.glass.dropHeight, 0.1, 12)
    },
    impact: {
      frame: integer(impact.frame, DEFAULT.impact.frame, 2, normalizedRender.frames - 3),
      floorY: number(impact.floorY, DEFAULT.impact.floorY, -5, 3),
      burst: number(impact.burst, DEFAULT.impact.burst, 0, 10),
      gravity: number(impact.gravity, DEFAULT.impact.gravity, 0.1, 30),
      restitution: number(impact.restitution, DEFAULT.impact.restitution, 0, 1),
      slowMotion: number(impact.slowMotion, DEFAULT.impact.slowMotion, 0.1, 1)
    },
    reveal: {
      word: String(reveal.word || DEFAULT.reveal.word).trim().slice(0, 36) || DEFAULT.reveal.word,
      color: color(reveal.color, DEFAULT.reveal.color),
      subline: String(reveal.subline || '').trim().slice(0, 72),
      delayFrames: integer(reveal.delayFrames, DEFAULT.reveal.delayFrames, 0, normalizedRender.frames - 1)
    },
    camera: {
      position: vector(camera.position, DEFAULT.camera.position),
      lookAt: vector(camera.lookAt, DEFAULT.camera.lookAt)
    },
    effects: {
      shake: number(effects.shake, DEFAULT.effects.shake, 0, 2),
      glow: number(effects.glow, DEFAULT.effects.glow, 0, 5)
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
  // Replace the promise with plain data so create() is synchronous as required
  // by the harness after getMeta() has awaited this load.
  if (value !== pending) cache.set(name, value);
  return value;
}

export async function getMeta() {
  const d = await loadConfig(sceneName());
  return {
    id: `vfx_glass_break:${sceneName()}`,
    frames: d.render.frames,
    fps: d.render.fps,
    width: d.render.width,
    height: d.render.height,
    bg: d.render.bg
  };
}

function makeGlowTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  const radial = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  radial.addColorStop(0, 'rgba(214,250,255,0.95)');
  radial.addColorStop(0.22, 'rgba(100,224,255,0.34)');
  radial.addColorStop(1, 'rgba(42,152,255,0)');
  g.fillStyle = radial;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function makeTriangle(THREE, a, b, c, center) {
  const geometry = new THREE.BufferGeometry();
  const zA = (hash(a.x * 23 + a.y * 47) - 0.5) * 0.026;
  const zB = (hash(b.x * 29 + b.y * 41) - 0.5) * 0.026;
  const zC = (hash(c.x * 31 + c.y * 37) - 0.5) * 0.026;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    a.x - center.x, a.y - center.y, zA,
    b.x - center.x, b.y - center.y, zB,
    c.x - center.x, c.y - center.y, zC
  ], 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();

  const edge = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(a.x - center.x, a.y - center.y, zA + 0.004),
    new THREE.Vector3(b.x - center.x, b.y - center.y, zB + 0.004),
    new THREE.Vector3(c.x - center.x, c.y - center.y, zC + 0.004),
    new THREE.Vector3(a.x - center.x, a.y - center.y, zA + 0.004)
  ]);
  return { geometry, edge };
}

// Solve vertical movement analytically and reflect it off the floor.  This is
// not a live physics simulation: it is intentionally a pure function of time
// so seeking a rendered frame never changes the result.
function bounceY(yStart, velocity, seconds, floor, gravity, restitution) {
  let y = yStart;
  let vy = velocity;
  let remaining = Math.max(0, seconds);
  for (let bounce = 0; bounce < 5 && remaining > 0.0001; bounce++) {
    const discriminant = Math.max(0, vy * vy + 2 * gravity * Math.max(0, y - floor));
    const hit = (vy + Math.sqrt(discriminant)) / gravity;
    if (remaining <= hit) return y + vy * remaining - 0.5 * gravity * remaining * remaining;
    y = floor;
    remaining -= hit;
    vy = -Math.abs(vy - gravity * hit) * restitution;
    if (Math.abs(vy) < 0.22) return floor;
  }
  return Math.max(floor, y + vy * remaining - 0.5 * gravity * remaining * remaining);
}

export function create(THREE, ctx) {
  const name = sceneName();
  const d = cache.get(name) && typeof cache.get(name).then !== 'function'
    ? cache.get(name) : normalize({});
  const { scene, camera, overlayRoot: overlay, width: W, height: H } = ctx;
  const { glass, impact, reveal, effects } = d;
  const impactFrame = Math.min(Math.max(2, impact.frame), d.render.frames - 3);
  const paneImpactY = impact.floorY + glass.height * 0.5 + glass.thickness * 0.5;
  const impactLocal = { x: 0, y: -glass.height * 0.5 + 0.12 };
  const paneRotation = { x: -0.035, y: -0.13, z: 0.042 };

  scene.background = new THREE.Color(d.render.bg);
  scene.fog = new THREE.Fog(d.render.bg, 8, 21);
  camera.position.fromArray(d.camera.position);
  camera.lookAt(...d.camera.lookAt);

  // Lighting stays deliberately legible on a dark stage: cyan rim highlights
  // tell the viewer that the object is glass before it becomes shards.
  scene.add(new THREE.HemisphereLight(0xa9efff, 0x07111d, 1.65));
  const key = new THREE.DirectionalLight(0xeaffff, 2.7);
  key.position.set(-3.5, 5.5, 5.2); scene.add(key);
  const cyanRim = new THREE.PointLight(0x55dfff, 12 * effects.glow, 10);
  cyanRim.position.set(3.6, 1.8, 3.2); scene.add(cyanRim);
  const warmRim = new THREE.PointLight(0x648bff, 5.5 * effects.glow, 8);
  warmRim.position.set(-3, -0.7, 1.2); scene.add(warmRim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 32),
    new THREE.MeshStandardMaterial({ color: 0x07121d, roughness: 0.33, metalness: 0.62 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = impact.floorY;
  scene.add(floor);

  // Soft pools of light make the browser preview feel more like a VFX plate
  // without relying on image assets or a post-processing pipeline.
  const glowTexture = makeGlowTexture(THREE);
  const backdropGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0x2a94ff, transparent: true, opacity: 0.20 * effects.glow,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  backdropGlow.scale.set(10, 10, 1); backdropGlow.position.set(0, 0.4, -2.2); scene.add(backdropGlow);
  const impactGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xd8fbff, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  impactGlow.scale.set(0.1, 0.1, 1); impactGlow.position.set(0, impact.floorY + 0.06, 0.1); scene.add(impactGlow);

  // The intact pane: physical material plus a separate outline give it readable
  // thickness even in a fast preview.  It fades exactly as fracture starts.
  const paneGroup = new THREE.Group();
  // Standard materials intentionally win over transmission here.  A physical
  // transmission pass for every shard is prohibitively expensive in a browser
  // render farm; the outline, sheen, and lighting below preserve the glass read.
  const paneMaterial = new THREE.MeshStandardMaterial({
    color: glass.color, metalness: glass.metalness, roughness: glass.roughness,
    transparent: true, opacity: glass.opacity, side: THREE.DoubleSide, depthWrite: false
  });
  const paneGeometry = new THREE.BoxGeometry(glass.width, glass.height, glass.thickness);
  const pane = new THREE.Mesh(paneGeometry, paneMaterial);
  paneGroup.add(pane);
  const paneEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(paneGeometry),
    new THREE.LineBasicMaterial({ color: 0xd6fbff, transparent: true, opacity: 0.82 })
  );
  paneGroup.add(paneEdges);
  const sheen = new THREE.Mesh(
    new THREE.PlaneGeometry(glass.width * 0.18, glass.height * 0.98),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
  );
  sheen.position.set(-glass.width * 0.18, 0, glass.thickness * 0.64);
  sheen.rotation.z = -0.17;
  paneGroup.add(sheen);
  scene.add(paneGroup);

  // Radial crack strokes sell the instant between impact and the pane's switch
  // to independent geometry.  They are authored procedurally but stay fixed.
  const crackGroup = new THREE.Group();
  const crackMaterials = [];
  for (let i = 0; i < 13; i++) {
    const angle = lerp(0.08, Math.PI - 0.08, i / 12) + (hash(i + 70) - 0.5) * 0.17;
    const length = lerp(glass.height * 0.34, glass.height * 0.95, hash(i + 91));
    const end = new THREE.Vector3(
      clamp(impactLocal.x + Math.cos(angle) * length, -glass.width * 0.49, glass.width * 0.49),
      clamp(impactLocal.y + Math.sin(angle) * length, -glass.height * 0.49, glass.height * 0.49),
      glass.thickness * 0.8
    );
    const material = new THREE.LineBasicMaterial({ color: 0xe8fdff, transparent: true, opacity: 0 });
    crackMaterials.push(material);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(impactLocal.x, impactLocal.y, glass.thickness * 0.8), end
    ]), material);
    crackGroup.add(line);
  }
  scene.add(crackGroup);

  // Pre-build all shards.  A shared, jittered grid creates matching edges while
  // each triangle is an independently transformed object after the impact.
  const shardGroup = new THREE.Group();
  const shards = [];
  const cols = glass.shardCols, rows = glass.shardRows;
  const vertices = [];
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const outer = row === 0 || row === rows || col === 0 || col === cols;
      const cellW = glass.width / cols, cellH = glass.height / rows;
      vertices.push({
        x: -glass.width * 0.5 + col * cellW + (outer ? 0 : (hash(row * 53 + col * 17) - 0.5) * cellW * 0.46),
        y: -glass.height * 0.5 + row * cellH + (outer ? 0 : (hash(row * 71 + col * 31) - 0.5) * cellH * 0.46)
      });
    }
  }
  const at = (col, row) => vertices[row * (cols + 1) + col];
  const addShard = (a, b, c, index) => {
    const center = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    const built = makeTriangle(THREE, a, b, c, center);
    const group = new THREE.Group();
    const tint = new THREE.Color(glass.color);
    tint.offsetHSL((hash(index + 207) - 0.5) * 0.055, 0, (hash(index + 311) - 0.5) * 0.12);
    const material = new THREE.MeshStandardMaterial({
      color: tint, metalness: clamp(glass.metalness + 0.06, 0, 1),
      roughness: clamp(glass.roughness + 0.04, 0.02, 0.95), transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false, flatShading: true
    });
    const mesh = new THREE.Mesh(built.geometry, material);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xe4fcff, transparent: true, opacity: 0 });
    group.add(mesh, new THREE.LineLoop(built.edge, edgeMaterial));
    group.position.set(center.x, paneImpactY + center.y, 0);
    group.rotation.set(paneRotation.x, paneRotation.y, paneRotation.z);
    shardGroup.add(group);

    const dx = center.x - impactLocal.x;
    const dy = center.y - impactLocal.y;
    const distance = Math.max(0.18, Math.hypot(dx, dy));
    const spreadX = dx / distance;
    const spreadY = dy / distance;
    shards.push({
      group, material, edgeMaterial, x0: center.x, y0: paneImpactY + center.y,
      z0: 0, vx: spreadX * impact.burst * (0.62 + hash(index + 13) * 0.66) + (hash(index + 19) - 0.5) * 0.8,
      vy: 0.38 + spreadY * impact.burst * 0.56 + hash(index + 23) * 1.35,
      vz: 0.50 + hash(index + 29) * 1.2,
      spinX: (hash(index + 37) - 0.5) * 6.4,
      spinY: (hash(index + 43) - 0.5) * 7.2,
      spinZ: (hash(index + 47) - 0.5) * 7.8,
      phase: hash(index + 59) * Math.PI * 2
    });
  };
  let shardIndex = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const a = at(col, row), b = at(col + 1, row), c = at(col + 1, row + 1), e = at(col, row + 1);
      if ((row + col) % 2) {
        addShard(a, b, e, shardIndex++); addShard(b, c, e, shardIndex++);
      } else {
        addShard(a, b, c, shardIndex++); addShard(a, c, e, shardIndex++);
      }
    }
  }
  shardGroup.visible = false;
  scene.add(shardGroup);

  // Debris uses a single Points draw call.  Its positions are recalculated from
  // the seed at every frame, rather than accumulated, for render determinism.
  const dustCount = 96;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    color: 0xd8fbff, size: 0.052, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  scene.add(new THREE.Points(dustGeometry, dustMaterial));

  const shock = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.62, 96),
    new THREE.MeshBasicMaterial({ color: 0xb9f7ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  shock.rotation.x = -Math.PI / 2; shock.position.y = impact.floorY + 0.012; scene.add(shock);

  // Overlay type is intentionally HTML rather than a 3D font: it stays crisp
  // at every output size and is easy for a future conversational editor to
  // replace.  textContent keeps prompt-supplied words safe.
  overlay.innerHTML = '';
  overlay.style.cssText += ';overflow:hidden;font-family:Inter,"Segoe UI",Arial,sans-serif;';
  const wordMask = document.createElement('div');
  wordMask.style.cssText = 'position:absolute;left:5%;right:5%;top:43%;height:28%;display:flex;align-items:center;justify-content:center;overflow:hidden;clip-path:inset(100% 0 0 0);';
  const word = document.createElement('div');
  const typeSize = Math.round(Math.min(H * 0.18, W / Math.max(5.2, reveal.word.length * 0.62)));
  word.style.cssText = `color:${reveal.color};font-size:${typeSize}px;font-weight:900;letter-spacing:0.09em;line-height:.9;white-space:nowrap;transform:translateY(38px) scale(.93);opacity:0;text-shadow:0 0 10px rgba(164,239,255,.9),0 0 30px rgba(77,183,255,.48);`;
  word.textContent = reveal.word;
  wordMask.appendChild(word); overlay.appendChild(wordMask);
  const rule = document.createElement('div');
  rule.style.cssText = `position:absolute;left:50%;top:61%;height:2px;width:0;background:${reveal.color};box-shadow:0 0 14px ${reveal.color};transform:translateX(-50%);opacity:0;`;
  overlay.appendChild(rule);
  const subline = document.createElement('div');
  subline.style.cssText = `position:absolute;left:50%;top:64%;transform:translate(-50%,12px);color:${reveal.color};font-size:${Math.round(H * 0.022)}px;font-weight:700;letter-spacing:.28em;white-space:nowrap;opacity:0;`;
  subline.textContent = reveal.subline;
  overlay.appendChild(subline);

  const originalCamera = new THREE.Vector3().fromArray(d.camera.position);
  const originalLookAt = new THREE.Vector3().fromArray(d.camera.lookAt);
  const N = d.render.frames;
  return {
    update(frame) {
      const f = clamp(Math.round(frame), 0, N - 1);
      const fracture = smooth(impactFrame - 2, impactFrame + 4, f);
      const preImpact = clamp01(f / impactFrame);
      const paneY = lerp(paneImpactY + glass.dropHeight, paneImpactY, preImpact * preImpact);
      const fallSpin = preImpact * preImpact;
      paneGroup.position.set(Math.sin(preImpact * Math.PI) * 0.055, paneY, 0);
      paneGroup.rotation.set(
        paneRotation.x + fallSpin * 0.19,
        paneRotation.y + fallSpin * 0.26,
        paneRotation.z - fallSpin * 0.085
      );
      paneMaterial.opacity = glass.opacity * (1 - fracture);
      paneEdges.material.opacity = 0.82 * (1 - fracture);
      sheen.material.opacity = 0.14 * (1 - fracture);
      paneGroup.visible = fracture < 0.995;

      crackGroup.position.set(paneGroup.position.x, paneY, glass.thickness * 0.75);
      crackGroup.rotation.copy(paneGroup.rotation);
      const crackAmount = smooth(impactFrame - 7, impactFrame + 1, f) * (1 - smooth(impactFrame + 2, impactFrame + 9, f));
      crackMaterials.forEach((material, i) => { material.opacity = crackAmount * (0.30 + (i % 3) * 0.08); });

      const postFrames = Math.max(0, f - impactFrame);
      const seconds = (postFrames / d.render.fps) * impact.slowMotion;
      shardGroup.visible = fracture > 0.01;
      const shardAlpha = glass.opacity * smooth(impactFrame - 1, impactFrame + 5, f);
      for (const shard of shards) {
        const drift = seconds * (0.54 + 0.46 * Math.exp(-seconds * 0.76));
        shard.group.position.set(
          shard.x0 + shard.vx * drift,
          bounceY(shard.y0, shard.vy, seconds, impact.floorY + 0.025, impact.gravity, impact.restitution),
          shard.z0 + shard.vz * drift
        );
        const spin = seconds * Math.exp(-seconds * 0.19);
        shard.group.rotation.set(
          paneRotation.x + shard.spinX * spin,
          paneRotation.y + shard.spinY * spin,
          paneRotation.z + shard.spinZ * spin
        );
        shard.material.opacity = shardAlpha * (0.74 + 0.20 * Math.sin(seconds * 3.1 + shard.phase));
        shard.edgeMaterial.opacity = smooth(impactFrame, impactFrame + 4, f) * 0.48;
      }

      const debris = smooth(impactFrame - 1, impactFrame + 2, f) * (1 - smooth(impactFrame + 28, impactFrame + 70, f));
      for (let i = 0; i < dustCount; i++) {
        const theta = hash(i + 701) * Math.PI * 2;
        const speed = 0.8 + hash(i + 719) * impact.burst * 1.3;
        dustPositions[i * 3] = Math.cos(theta) * speed * seconds;
        dustPositions[i * 3 + 1] = impact.floorY + 0.07 + (0.45 + hash(i + 733) * 2.2) * seconds - 0.5 * impact.gravity * 0.32 * seconds * seconds;
        dustPositions[i * 3 + 2] = (hash(i + 751) - 0.5) * 1.5 + hash(i + 761) * seconds;
      }
      dustGeometry.attributes.position.needsUpdate = true;
      dustMaterial.opacity = debris * 0.72;

      const blast = smooth(impactFrame - 1, impactFrame + 2, f) * (1 - smooth(impactFrame + 8, impactFrame + 24, f));
      shock.scale.setScalar(lerp(0.12, 4.5, outCubic(clamp01((f - impactFrame) / 20))));
      shock.material.opacity = blast * 0.72;
      impactGlow.scale.setScalar(lerp(0.3, 6.5, outCubic(clamp01((f - impactFrame) / 22))));
      impactGlow.material.opacity = blast * 0.84 * effects.glow;

      // Camera shake is likewise derived from frame rather than added over time.
      const shake = blast * effects.shake;
      camera.position.set(
        originalCamera.x + Math.sin(postFrames * 2.71) * shake,
        originalCamera.y + Math.sin(postFrames * 4.09 + 1.7) * shake * 0.58,
        originalCamera.z - blast * 0.12
      );
      camera.lookAt(originalLookAt.x, originalLookAt.y - blast * 0.05, originalLookAt.z);

      const revealStart = impactFrame + reveal.delayFrames;
      const revealAmount = smooth(revealStart, revealStart + 16, f);
      wordMask.style.clipPath = `inset(${Math.round((1 - revealAmount) * 100)}% 0 0 0)`;
      word.style.opacity = String(revealAmount);
      word.style.transform = `translateY(${Math.round(lerp(38, 0, outCubic(revealAmount)))}px) scale(${lerp(0.93, 1, outCubic(revealAmount)).toFixed(3)})`;
      rule.style.opacity = String(smooth(revealStart + 7, revealStart + 17, f));
      rule.style.width = `${Math.round(W * 0.28 * outCubic(smooth(revealStart + 6, revealStart + 19, f)))}px`;
      subline.style.opacity = String(smooth(revealStart + 13, revealStart + 25, f));
      subline.style.transform = `translate(-50%,${Math.round(lerp(12, 0, smooth(revealStart + 13, revealStart + 25, f)))}px)`;
    },
    probe() {
      return { type: 'glass_break_reveal', word: reveal.word, impactFrame, shardCount: shards.length };
    }
  };
}
