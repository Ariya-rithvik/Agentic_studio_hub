// Ken-Burns scene — gives a still image cinematic life with a slow eased zoom +
// pan. Used to animate omni (Gemini)-generated cinematic stills the code engine
// can't make (people, animals, real scenes). Config: /data/kenburns/<name>.json
// { image, frames, width, height }. Deterministic.
const cache = new Map();
const kbName = () => new URLSearchParams(location.search).get('kb') || 'demo';

async function load(name) {
  if (!cache.has(name)) {
    const r = await fetch(`/data/kenburns/${name}.json?t=` + Date.now());
    cache.set(name, r.ok ? await r.json() : {});
  }
  return cache.get(name);
}

export async function getMeta() {
  const d = await load(kbName());
  return { id: 'kb:' + kbName(), frames: d.frames || 120, fps: 30, width: d.width || 1280, height: d.height || 720, bg: '#000000' };
}

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  const d = cache.get(kbName()) || {};
  scene.background = new THREE.Color('#000000');
  camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0);

  // plane sized to fill the frame at z=0
  const dist = 5, vFov = (50 * Math.PI) / 180;
  const h = 2 * dist * Math.tan(vFov / 2), w = h * (ctx.width / ctx.height);
  const mat = new THREE.MeshBasicMaterial({ color: 0x0b0b0b });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  scene.add(plane);

  const loader = new THREE.TextureLoader();
  const ready = (async () => {
    const tex = await new Promise((res) => loader.load(d.image || '/assets/milkyway.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null)));
    if (tex) { mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; }
  })();

  const N = ctx.frames || 120;
  const ease = (x) => x * x * (3 - 2 * x);
  const dir = d.pan || [1, -0.6];   // pan direction
  return {
    ready,
    update(frame) {
      const t = ease(frame / N);
      const s = 1.06 + t * 0.14;                 // slow zoom-in
      plane.scale.set(s, s, 1);
      plane.position.x = (t - 0.5) * 0.30 * dir[0];
      plane.position.y = (t - 0.5) * 0.30 * dir[1];
    }
  };
}
