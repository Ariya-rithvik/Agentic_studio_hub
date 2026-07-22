// Parametric liquid-transfer scene — CONTINUOUS physics flow + cinematic look.
// Config-driven (/data/tanks/<name>.json): { count|tanks[], liquid, dir, labels, frames }.
// Flow is a real fluid model: each tank outflows forward proportional to its level,
// so a middle tank starts feeding the NEXT tank the instant it has water (overlapping
// cascade), not "wait until full". Levels are pre-simulated once => deterministic.
const cache = new Map();
const nameOf = () => new URLSearchParams(location.search).get('tanks') || 'demo';
async function load(name) {
  if (!cache.has(name)) { const r = await fetch(`/data/tanks/${name}.json?t=` + Date.now()); cache.set(name, r.ok ? await r.json() : {}); }
  return cache.get(name);
}
export async function getMeta() {
  const d = await load(nameOf());
  return { id: 'tanks:' + nameOf(), frames: d.frames || 160, fps: 30, width: d.width || 1280, height: d.height || 720, bg: '#dfe7f0' };
}

const LIQUID = {
  water: '#2196f3', oil: '#c8862a', crude: '#3a2810', petrol: '#e0b030', fuel: '#e0b030',
  diesel: '#b98a3a', milk: '#eae3d0', acid: '#7ed94a', chemical: '#7ed94a', wine: '#7e1330',
  juice: '#ff8a1a', lava: '#ff5a1f', mercury: '#9aa4ad', coolant: '#19c3b4', blood: '#9a1010', honey: '#d99a1a'
};
const ease = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;

function labelTex(THREE, txt) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#0d2030'; g.font = 'bold 82px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(txt).slice(0, 14), 256, 84);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function gradientBg(THREE) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#aebccd'); grd.addColorStop(0.55, '#cdd8e5'); grd.addColorStop(1, '#e9eff5');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Pre-simulate the cascade once => a levels timeline (deterministic, physical).
function simulate(count, N, dirOrder) {
  const dt = 0.01, MAX = 6000;
  // per-position outflow rate: the SOURCE drains fast, downstream tanks drain
  // slower so a middle tank visibly ACCUMULATES while still overflowing onward
  // (real cascade feel) — yet everything still ends up in the destination.
  const kArr = dirOrder.map((_, p) => (p === 0 ? 2.6 : 1.15));
  let L = dirOrder.map((_, p) => (p === 0 ? 1 : 0));   // order-space: source full
  const hist = [L.slice()];
  let endStep = MAX;
  for (let s = 1; s <= MAX; s++) {
    const out = L.map((v, p) => (p < count - 1 ? kArr[p] * Math.max(0, v) * dt : 0));
    const nx = L.slice();
    for (let p = 0; p < count; p++) { nx[p] -= out[p]; if (p > 0) nx[p] += out[p - 1]; }
    L = nx.map((v) => Math.max(0, v));
    hist.push(L.slice());
    if (L[count - 1] >= 0.94) { endStep = s; break; }
  }
  // sample N+1 frames across 0..endStep, map order-space -> physical tank index
  const byFrame = [];
  for (let f = 0; f <= N; f++) {
    const s = Math.min(hist.length - 1, Math.round((f / N) * endStep));
    const inOrder = hist[s];
    const phys = new Array(count);
    dirOrder.forEach((tankIdx, p) => { phys[tankIdx] = inOrder[p]; });
    byFrame.push(phys);
  }
  return byFrame;
}

export function create(THREE, ctx) {
  const { scene, camera, renderer } = ctx;
  const d = cache.get(nameOf()) || {};
  scene.background = gradientBg(THREE);
  scene.fog = new THREE.Fog(0xdfe7f0, 17, 36);

  if (renderer) {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMappingExposure = 1.12;
  }

  const tanksCfg = Array.isArray(d.tanks) && d.tanks.length ? d.tanks.slice(0, 4)
    : Array.from({ length: Math.max(2, Math.min(4, d.count || 2)) }, (_, i) => ({ label: `TANK ${i + 1}` }));
  const count = tanksCfg.length;
  const liquidName = String(d.liquid || 'water').toLowerCase();
  const liqKey = LIQUID[liquidName] ? liquidName : Object.keys(LIQUID).find((k) => liquidName.includes(k));
  const LIQ = new THREE.Color(d.liquidColor || (liqKey ? LIQUID[liqKey] : '#2196f3'));
  const dir = String(d.dir || 'LR').toUpperCase() === 'RL' ? 'RL' : 'LR';

  // cinematic 3-point lighting (warm key w/ shadow, cool fill, bright rim)
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xfff2df, 2.1); key.position.set(6, 11, 7);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera; sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -6; sc.near = 1; sc.far = 40;
  key.shadow.bias = -0.0004; scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd4ff, 0.6); fill.position.set(-7, 4, 5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.1); rim.position.set(-3, 6, -8); scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: 0xc4ceda, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const TANK_R = 1.05, TANK_H = 3.0, BASE = 0.06, WH = TANK_H - 0.2, WR = TANK_R - 0.07;
  const spacing = count <= 2 ? 2.7 : count === 3 ? 2.75 : 2.55;
  const totalW = (count - 1) * spacing;
  const xs = tanksCfg.map((_, i) => -totalW / 2 + i * spacing);
  camera.position.set(1.6, 2.2, 9 + count * 1.45); camera.lookAt(0, 1.25, 0);

  const shellTints = [0xbcd6ea, 0xbfe6cc, 0xf0dfb0, 0xd9c1ee];
  const rimColor = LIQ.clone().lerp(new THREE.Color('#000000'), 0.4).getHex();
  const bodyMat = () => new THREE.MeshPhysicalMaterial({ color: LIQ.getHex(), roughness: 0.12, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.4 });
  const capMat = () => new THREE.MeshPhysicalMaterial({ color: LIQ.clone().lerp(new THREE.Color('#ffffff'), 0.22).getHex(), roughness: 0.06, clearcoat: 1.0, envMapIntensity: 1.8 });
  const waters = [];

  xs.forEach((x, i) => {
    const tint = shellTints[i % 4];
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 56, 1, true),
      new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.1, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.1, envMapIntensity: 1.6, side: THREE.DoubleSide }));
    shell.position.set(x, TANK_H / 2 + BASE, 0); shell.castShadow = true; scene.add(shell);
    const rimM = new THREE.Mesh(new THREE.TorusGeometry(TANK_R, 0.06, 14, 56), new THREE.MeshStandardMaterial({ color: 0xeef3f7, roughness: 0.3, metalness: 0.4, envMapIntensity: 1.5 }));
    rimM.rotation.x = Math.PI / 2; rimM.position.set(x, TANK_H + BASE, 0); scene.add(rimM);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R + 0.06, TANK_R + 0.16, 0.2, 56), new THREE.MeshStandardMaterial({ color: 0x8b97a4, roughness: 0.7, metalness: 0.3 }));
    base.position.set(x, 0.1, 0); base.castShadow = true; base.receiveShadow = true; scene.add(base);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(WR, WR, WH, 48), bodyMat());
    body.position.x = x; body.castShadow = true; scene.add(body);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(WR, 48), capMat());
    cap.rotation.x = -Math.PI / 2; cap.position.x = x; scene.add(cap);
    const line = new THREE.Mesh(new THREE.TorusGeometry(WR, 0.035, 12, 48), new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.35 }));
    line.rotation.x = Math.PI / 2; line.position.x = x; scene.add(line);
    // ripple rings on the surface (cinematic "living water")
    const rings = [0, 1].map((r) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 40), new THREE.MeshBasicMaterial({ color: LIQ.clone().lerp(new THREE.Color('#ffffff'), 0.5).getHex(), transparent: true, opacity: 0 }));
      m.rotation.x = Math.PI / 2; m.position.x = x; scene.add(m); return { m, ph: r * 0.5 };
    });

    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.62), new THREE.MeshBasicMaterial({ map: labelTex(THREE, tanksCfg[i].label || `TANK ${i + 1}`), transparent: true }));
    lbl.position.set(x, TANK_H + 0.9, 0); scene.add(lbl);
    waters.push({ body, cap, line, rings, x });
  });

  // pipes + flow arrows
  const WMAT = () => new THREE.MeshPhysicalMaterial({ color: LIQ.getHex(), roughness: 0.1, clearcoat: 1.0, transparent: true, opacity: 0.9, envMapIntensity: 1.4 });
  const pipes = [];
  for (let i = 0; i < count - 1; i++) {
    const xa = xs[i], xb = xs[i + 1], mid = (xa + xb) / 2, len = xb - xa;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, len + 0.42, 28), new THREE.MeshStandardMaterial({ color: 0x9aa6b2, roughness: 0.35, metalness: 0.6, envMapIntensity: 1.6 }));
    pipe.rotation.z = Math.PI / 2; pipe.position.set(mid, 0.55, 0); pipe.castShadow = true; scene.add(pipe);
    const pw = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, len + 0.42, 22), WMAT());
    pw.rotation.z = Math.PI / 2; pw.position.set(mid, 0.55, 0); scene.add(pw);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.46, 20), new THREE.MeshStandardMaterial({ color: LIQ.getHex(), emissive: LIQ.clone().multiplyScalar(0.25).getHex() }));
    arrow.rotation.z = dir === 'LR' ? -Math.PI / 2 : Math.PI / 2; arrow.position.set(mid, 1.18, 0);
    arrow.material.transparent = true; scene.add(arrow);
    pipes.push({ pw, arrow, mid, len, left: i });
  }

  const HI = 0.95, LO = 0.05;
  const setLevel = (w, lv) => {
    lv = LO + (HI - LO) * clamp01(lv); const h = WH * lv;
    w.body.scale.y = Math.max(0.001, lv); w.body.position.y = BASE + 0.1 + h / 2;
    const topY = BASE + 0.1 + h;
    w.cap.position.y = topY + 0.002; w.line.position.y = topY;
    w.rings.forEach((r) => { r.m.position.y = topY + 0.004; });
    return lv;
  };

  const order = dir === 'LR' ? xs.map((_, i) => i) : xs.map((_, i) => count - 1 - i);
  const N = d.frames || 160;
  const byFrame = simulate(count, N, order);
  const prev = byFrame[0].slice();

  return {
    update(frame) {
      const raw = frame / N;
      const cur = byFrame[Math.min(byFrame.length - 1, frame)];
      const before = byFrame[Math.max(0, Math.min(byFrame.length - 1, frame - 1))];
      waters.forEach((w, i) => {
        const disp = setLevel(w, cur[i]);
        const changing = Math.min(1, Math.abs(cur[i] - before[i]) * 90 + (cur[i] > 0.03 && cur[i] < 0.9 ? 0.25 : 0));
        w.rings.forEach((r, ri) => {
          const lt = (raw * 2.2 + r.ph + ri * 0.3) % 1;
          r.m.scale.setScalar(0.2 + lt * (WR * 1.7));
          r.m.material.opacity = (1 - lt) * 0.5 * changing;
        });
      });
      // pipe flow intensity = how much liquid the upstream tank is pushing forward
      pipes.forEach((pp) => {
        const upIdx = dir === 'LR' ? pp.left : pp.left + 1;      // upstream physical tank for this pipe
        const inten = clamp01(cur[upIdx] * 1.4);
        pp.pw.material.opacity = 0.18 + 0.72 * inten;
        pp.arrow.material.opacity = 0.15 + 0.85 * inten;
        const off = -0.45 + 0.9 * ((raw * 3.2) % 1);
        pp.arrow.position.x = pp.mid + (dir === 'LR' ? off : -off) * Math.min(1, pp.len * 0.35);
        pp.arrow.scale.setScalar(0.85 + 0.3 * inten);
      });
    }
  };
}
