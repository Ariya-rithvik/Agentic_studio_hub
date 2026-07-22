// tankchart — a DATA-DRIVEN 3D "size comparison" primitive (the water-footprint /
// "how much X for 1 unit" explainer style). Each item becomes a water tank whose
// size ∝ its value; tanks reveal left→right while the camera pulls back, and big
// bold count-up numbers + labels sit above each. NOT hardcoded: reads any data
// from /data/tankchart/<name>.json { title, unit, items:[{label,value}], ref, frames }.
import { countUp } from './lib/overlay.mjs';

const cache = new Map();
const nameOf = () => new URLSearchParams(location.search).get('tankchart') || 'demo';
async function load(name) {
  if (!cache.has(name)) { const r = await fetch(`/data/tankchart/${name}.json?t=` + Date.now()); cache.set(name, r.ok ? await r.json() : {}); }
  return cache.get(name);
}
export async function getMeta() {
  const d = await load(nameOf());
  return { id: 'tankchart:' + nameOf(), frames: d.frames || 200, fps: 30, width: d.width || 1280, height: d.height || 720, bg: '#f0e6cf' };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const easeOutBack = (x) => { const c = 1.70158; const t = clamp01(x); return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const lerp = (a, b, t) => a + (b - a) * t;

function creamBg(THREE) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#efe0bf'); grd.addColorStop(1, '#f6eed9');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Build a realistic Indian Sintex-style water tank as a surface of revolution:
// flared base -> corrugated (ribbed) cylindrical body -> domed shoulder -> neck +
// screw cap. Translucent shell so the blue water inside shows. base at y=0.
function buildSintexTank(THREE, R, H, waterHex) {
  const grp = new THREE.Group();
  const V = (r, y) => new THREE.Vector2(Math.max(0.0002, r), y);
  const lerp = (a, b, t) => a + (b - a) * t;
  // straight-sided ribbed body most of the way up, then a SHALLOW rounded top
  // edge to a nearly-flat top with a small centre cap (a real Sintex tank).
  const bBot = 0.05 * H, bTop = 0.86 * H, rimTop = 0.93 * H, ribs = 7;

  const pts = [V(0, 0), V(R * 0.78, 0), V(R * 1.0, bBot * 0.55), V(R * 1.03, bBot)];
  const seg = 72;                                   // ribbed straight body (moulded rings)
  for (let i = 0; i <= seg; i++) { const t = i / seg; const y = lerp(bBot, bTop, t); const r = R * (0.985 + 0.032 * (0.5 + 0.5 * Math.cos(t * ribs * Math.PI * 2))); pts.push(V(r, y)); }
  const cseg = 7;                                   // short rounded top corner
  for (let i = 1; i <= cseg; i++) { const t = i / cseg; const y = lerp(bTop, rimTop, t); const r = lerp(R, R * 0.85, Math.sin(t * Math.PI / 2)); pts.push(V(r, y)); }
  pts.push(V(R * 0.34, rimTop), V(R * 0.32, rimTop + 0.006 * H), V(0, rimTop + 0.006 * H)); // flat top to centre

  const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 72),
    new THREE.MeshPhysicalMaterial({ color: 0xdceffb, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.36, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.5, side: THREE.DoubleSide }));
  shell.castShadow = true; grp.add(shell);

  // small raised centre cap (the moulded manhole lid)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.33, R * 0.36, 0.04 * H, 36), new THREE.MeshStandardMaterial({ color: 0xe7ddc7, roughness: 0.6 }));
  neck.position.y = rimTop + 0.03 * H; grp.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.29, R * 0.33, 0.07 * H, 36), new THREE.MeshStandardMaterial({ color: 0xdacfb6, roughness: 0.55 }));
  cap.position.y = rimTop + 0.075 * H; cap.castShadow = true; grp.add(cap);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.06, R * 1.16, 0.06 * H, 56), new THREE.MeshStandardMaterial({ color: 0xbcae90, roughness: 0.9 }));
  base.position.y = 0.03 * H; base.receiveShadow = true; grp.add(base);

  const WR = R * 0.9, WH = bTop - bBot - 0.03 * H, waterBaseY = bBot + 0.015 * H;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(WR, WR, WH, 48),
    new THREE.MeshPhysicalMaterial({ color: waterHex, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 }));
  grp.add(water);
  return { grp, water, WH, waterBaseY };
}

export function create(THREE, ctx) {
  const { scene, camera, renderer, width, height } = ctx;
  const d = cache.get(nameOf()) || {};
  scene.background = creamBg(THREE);
  if (renderer) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMappingExposure = 1.08; }

  const items = (Array.isArray(d.items) && d.items.length ? d.items : [{ label: 'A', value: 100 }, { label: 'B', value: 200 }]).slice(0, 6);
  const unit = d.unit != null ? String(d.unit) : '';
  const numColor = d.numberColor || '#5b2be0';
  const waterCol = new THREE.Color(d.waterColor || '#5bc0ea');
  const maxV = Math.max(...items.map((it) => Number(it.value) || 0)) || 1;

  // lighting
  scene.add(new THREE.AmbientLight(0xfff6e8, 0.6));
  const key = new THREE.DirectionalLight(0xfff1d8, 1.9); key.position.set(5, 12, 8);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  const s = key.shadow.camera; s.left = -18; s.right = 18; s.top = 16; s.bottom = -4; s.near = 1; s.far = 60; key.shadow.bias = -0.0004;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfeaff, 0.5); fill.position.set(-8, 5, 6); scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe9dcc0, 0.35));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), new THREE.MeshStandardMaterial({ color: 0xe7d9ba, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // size each tank ∝ value (uniform scale so it reads like the reference), min 0.5
  const BR = 0.95, BH = 3.0, GAP = 1.3;
  const tanks = []; let cursor = 0;
  items.forEach((it, i) => {
    const sc = lerp(0.5, 1.18, Math.pow((Number(it.value) || 0) / maxV, 0.9));
    const R = BR * sc, H = BH * sc;
    const { grp, water, WH, waterBaseY } = buildSintexTank(THREE, R, H, waterCol.getHex());
    const x = cursor + R; cursor += 2 * R + GAP;
    grp.position.x = x;
    scene.add(grp);
    tanks.push({ grp, water, x, R, H, WH, waterBaseY, sc, value: Number(it.value) || 0, label: String(it.label || '') });
  });
  const spanL = 0, spanR = cursor - GAP;
  const cx = (spanL + spanR) / 2, extent = spanR - spanL;
  tanks.forEach((t) => { t.grp.position.x -= cx; t.x -= cx; });

  // ---- camera fit helpers (front view) ----
  const vHalf = (50 * Math.PI / 180) / 2, tanV = Math.tan(vHalf), tanH = tanV * (width / height);
  const maxH = Math.max(...tanks.map((t) => t.H));
  const fitDist = (w, h, m) => Math.max((h / 2) / tanV, (w / 2) / tanH) * (m || 1.06);
  const fitOne = (t) => fitDist(t.R * 2 * 2.3, t.H + 1.9, 1.05) + 1.1;
  const fitAll = () => fitDist(extent + tanks[tanks.length - 1].R * 2 + 1.2, maxH + 2.6, 1.1) + 2.2;

  // ---- HTML overlay: big count-up numbers + labels above each tank ----
  const root = ctx.overlayRoot; root.innerHTML = '';
  root.style.fontFamily = 'Inter, "Segoe UI", Arial, sans-serif';
  const project = (x, y, z = 0) => { const v = new THREE.Vector3(x, y, z).project(camera); return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, z: v.z }; };
  const labels = tanks.map((t) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;transform:translate(-50%,-100%);text-align:center;white-space:nowrap;opacity:0;';
    el.innerHTML = `<div class="num" style="font-weight:900;color:${numColor};line-height:.9;letter-spacing:1px;text-shadow:0 2px 6px rgba(0,0,0,.12)"></div>` +
      `<div class="cap" style="font-weight:800;color:${numColor};opacity:.92;letter-spacing:1px;margin-top:2px"></div>`;
    root.appendChild(el);
    return { el, num: el.querySelector('.num'), cap: el.querySelector('.cap') };
  });
  // fixed "1 unit reference" marker (like the "1L ETHANOL" tag)
  let refEl = null;
  if (d.ref) {
    refEl = document.createElement('div');
    refEl.style.cssText = 'position:absolute;left:3.2%;bottom:6%;color:' + numColor + ';font-weight:900;';
    refEl.innerHTML = `<div style="font-size:34px;line-height:1">${d.ref.value != null ? d.ref.value : '1'}${d.ref.unit || unit}</div>` +
      `<div style="font-size:13px;font-weight:800;letter-spacing:1px">${(d.ref.label || '').toUpperCase()}</div>`;
    root.appendChild(refEl);
  }
  if (d.title) { const tt = document.createElement('div'); tt.style.cssText = 'position:absolute;left:50%;top:5%;transform:translateX(-50%);font-weight:900;color:' + numColor + ';font-size:26px;text-align:center'; tt.textContent = d.title; root.appendChild(tt); }

  const N = d.frames || 200;
  const n = tanks.length;
  const holdFrac = 0.16, span = 1 - holdFrac;
  // per-tank reveal windows (sequential, minimal overlap so each reads on its own)
  const win = tanks.map((_, i) => { const a0 = (i / n) * span * 0.98; return { a0, a1: a0 + span * 0.34 }; });
  // camera keyframes: focus each tank in turn, then a final wide "all in frame"
  const kf = tanks.map((t, i) => ({ t: win[i].a0 + (win[i].a1 - win[i].a0) * 0.72, x: t.x, y: t.H * 0.55, dist: fitOne(t) }));
  kf.push({ t: Math.min(0.999, span + 0.015), x: 0, y: maxH * 0.5, dist: fitAll() });
  const camAt = (raw) => {
    let j = 0; while (j < kf.length - 1 && raw >= kf[j + 1].t) j++;
    const A = kf[j], B = kf[Math.min(kf.length - 1, j + 1)];
    const u = B.t > A.t ? ease((raw - A.t) / (B.t - A.t)) : 1;
    return { x: lerp(A.x, B.x, u), y: lerp(A.y, B.y, u), dist: lerp(A.dist, B.dist, u) };
  };
  const numPx = Math.round(height * 0.072);
  return {
    update(frame) {
      const raw = frame / N;
      tanks.forEach((t, i) => {
        const { a0, a1 } = win[i];
        const p = clamp01((raw - a0) / Math.max(0.001, a1 - a0));
        // gentle grow-in from the base (no sudden pop/overshoot) + rise
        const app = ease(p);
        t.grp.scale.setScalar(Math.max(0.0001, 0.6 + 0.4 * app));
        t.grp.position.y = (1 - app) * -0.6;
        const fillL = ease(clamp01((raw - a0) / Math.max(0.001, (a1 - a0) * 0.85)));
        t.water.scale.y = Math.max(0.001, fillL);
        t.water.position.y = t.waterBaseY + (t.WH * fillL) / 2;
      });
      // sequential travel tank->tank, then pull back to fit all
      const cam = camAt(raw);
      camera.position.set(cam.x, cam.y + cam.dist * 0.13, cam.dist);
      camera.lookAt(cam.x, cam.y, 0);
      camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      // numbers above each tank (hidden when its tank is off-frame/behind)
      tanks.forEach((t, i) => {
        const { a0, a1 } = win[i];
        const vis = clamp01((raw - a0) / 0.05);
        const pr = project(t.x, t.H + 0.5, 0);
        const L = labels[i];
        const on = pr.z < 1 && pr.x > -140 && pr.x < width + 140;
        L.el.style.opacity = on ? vis : 0;
        L.el.style.left = pr.x + 'px'; L.el.style.top = (pr.y - 6) + 'px';
        const shown = countUp(frame, { start: a0 * N, lock: a1 * N, value: t.value, decimals: 0 });
        L.num.style.fontSize = numPx + 'px';
        L.num.textContent = `${Number(shown).toLocaleString()}${unit}`;
        L.cap.style.fontSize = Math.round(numPx * 0.32) + 'px';
        L.cap.textContent = t.label.toUpperCase();
      });
    }
  };
}
