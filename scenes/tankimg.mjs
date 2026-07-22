// tankimg — the IMAGE-based tank comparison. Instead of modelling the tank in 3D
// (which never quite looked like a real Sintex), it uses a generated Sintex tank
// PNG (assets/sintex_tank.png), auto-keys out its background, and scales it per
// value as a billboard. Same data + camera + big count-up numbers as tankchart.
// Reads the SAME /data/tankchart/<name>.json so make-tankchart drives it too.
import { countUp } from './lib/overlay.mjs';

const cache = new Map();
const nameOf = () => new URLSearchParams(location.search).get('tankimg') || 'demo';
async function load(name) {
  if (!cache.has(name)) { const r = await fetch(`/data/tankchart/${name}.json?t=` + Date.now()); cache.set(name, r.ok ? await r.json() : {}); }
  return cache.get(name);
}
export async function getMeta() {
  const d = await load(nameOf());
  return { id: 'tankimg:' + nameOf(), frames: d.frames || 210, fps: 30, width: d.width || 1280, height: d.height || 720, bg: '#f0e6cf' };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function creamBg(THREE) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#efe0bf'); grd.addColorStop(1, '#f6eed9');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function shadowTex(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(40,35,25,0.38)'); grd.addColorStop(0.6, 'rgba(40,35,25,0.16)'); grd.addColorStop(1, 'rgba(40,35,25,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); return t;
}

// Clean cutout of the tank: flood-fill the background from the edges, drop the
// soft shadow / low-saturation leftovers, keep only the largest blob (the tank),
// erode 1px to kill the bg-coloured fringe, then crop to the tank. { canvas, aspect }.
function keyAndCrop(img) {
  const w = img.naturalWidth, h = img.naturalHeight, np = w * h;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
  const dat = cx.getImageData(0, 0, w, h), px = dat.data;
  const bg = [px[0], px[1], px[2]];
  const dist = (i, c) => Math.max(Math.abs(px[i] - c[0]), Math.abs(px[i + 1] - c[1]), Math.abs(px[i + 2] - c[2]));
  // 1) GRADIENT-TRACKING flood fill from the edges. A pixel is background if it's
  // very close to the corner colour, OR it continues a smooth gradient from an
  // already-background neighbour AND stays warm/beige-like (r > b). This follows
  // the bg vignette *and the warm contact shadow*, but STOPS at the tank: the
  // frosted shoulder is cool grey (b >= r) and the tank edge is a sharp jump.
  const seen = new Uint8Array(np), st = [];
  const pushEdge = (x, y) => { st.push(x, y, -1); };
  for (let x = 0; x < w; x++) { pushEdge(x, 0); pushEdge(x, h - 1); }
  for (let y = 0; y < h; y++) { pushEdge(0, y); pushEdge(w - 1, y); }
  while (st.length) {
    const fromI = st.pop(), y = st.pop(), x = st.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const idx = y * w + x; if (seen[idx]) continue; seen[idx] = 1;
    const i = idx * 4;
    const warm = px[i] > px[i + 2] + 8;                       // beige/shadow, never frosted grey
    // gradient-tracking creep, EVERYWHERE but tight (<=4/px): follows the bg
    // wall/floor vignette + contact shadow (smooth, warm), yet stops at the tank
    // because its edges jump >4/px even through soft anti-aliasing.
    const smooth = fromI >= 0 && Math.max(Math.abs(px[i] - px[fromI]), Math.abs(px[i + 1] - px[fromI + 1]), Math.abs(px[i + 2] - px[fromI + 2])) <= 4;
    const isBg = dist(i, bg) <= 18 || (smooth && warm && dist(i, bg) <= 90);
    if (!isBg) continue;
    px[i + 3] = 0;
    st.push(x + 1, y, i, x - 1, y, i, x, y + 1, i, x, y - 1, i);
  }
  // 3) keep only the largest connected opaque blob (removes sparkle/specks)
  const lab = new Int32Array(np); let best = 0, bestSize = 0, cur = 0;
  for (let p = 0; p < np; p++) {
    if (!px[p * 4 + 3] || lab[p]) continue; cur++; let size = 0; const q = [p]; lab[p] = cur;
    while (q.length) { const c = q.pop(); size++; const x = c % w, y = (c / w) | 0;
      if (x > 0 && px[(c - 1) * 4 + 3] && !lab[c - 1]) { lab[c - 1] = cur; q.push(c - 1); }
      if (x < w - 1 && px[(c + 1) * 4 + 3] && !lab[c + 1]) { lab[c + 1] = cur; q.push(c + 1); }
      if (y > 0 && px[(c - w) * 4 + 3] && !lab[c - w]) { lab[c - w] = cur; q.push(c - w); }
      if (y < h - 1 && px[(c + w) * 4 + 3] && !lab[c + w]) { lab[c + w] = cur; q.push(c + w); } }
    if (size > bestSize) { bestSize = size; best = cur; }
  }
  for (let p = 0; p < np; p++) if (lab[p] !== best) px[p * 4 + 3] = 0;
  // 4) erode 1px to remove the bg-coloured halo
  const al = new Uint8Array(np); for (let p = 0; p < np; p++) al[p] = px[p * 4 + 3];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = y * w + x; if (!al[p]) continue; if ((x > 0 && !al[p - 1]) || (x < w - 1 && !al[p + 1]) || (y > 0 && !al[p - w]) || (y < h - 1 && !al[p + w])) px[p * 4 + 3] = 0; }
  cx.putImageData(dat, 0, 0);
  let minx = w, miny = h, maxx = 0, maxy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (px[(y * w + x) * 4 + 3] > 12) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; } }
  const cw = Math.max(1, maxx - minx + 1), ch = Math.max(1, maxy - miny + 1);
  const crop = document.createElement('canvas'); crop.width = cw; crop.height = ch;
  crop.getContext('2d').drawImage(cv, minx, miny, cw, ch, 0, 0, cw, ch);
  return { canvas: crop, aspect: cw / ch };
}

export function create(THREE, ctx) {
  const { scene, camera, renderer, width, height } = ctx;
  const d = cache.get(nameOf()) || {};
  scene.background = creamBg(THREE);
  if (renderer) renderer.toneMappingExposure = 1.06;

  const items = (Array.isArray(d.items) && d.items.length ? d.items : [{ label: 'A', value: 100 }, { label: 'B', value: 200 }]).slice(0, 6);
  const unit = d.unit != null ? String(d.unit) : '';
  const numColor = d.numberColor || '#5b2be0';
  const maxV = Math.max(...items.map((it) => Number(it.value) || 0)) || 1;
  const n = items.length;

  // overlay scaffold
  const root = ctx.overlayRoot; root.innerHTML = '';
  root.style.fontFamily = 'Inter, "Segoe UI", Arial, sans-serif';
  const project = (x, y, z = 0) => { const v = new THREE.Vector3(x, y, z).project(camera); return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, z: v.z }; };
  const labels = items.map(() => {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;transform:translate(-50%,-100%);text-align:center;white-space:nowrap;opacity:0;';
    el.innerHTML = `<div class="num" style="font-weight:900;color:${numColor};line-height:.9;letter-spacing:1px;text-shadow:0 2px 6px rgba(0,0,0,.12)"></div><div class="cap" style="font-weight:800;color:${numColor};opacity:.92;letter-spacing:1px;margin-top:2px"></div>`;
    root.appendChild(el); return { el, num: el.querySelector('.num'), cap: el.querySelector('.cap') };
  });
  if (d.ref) { const r = document.createElement('div'); r.style.cssText = 'position:absolute;left:3.2%;bottom:6%;color:' + numColor + ';font-weight:900'; r.innerHTML = `<div style="font-size:34px;line-height:1">${d.ref.value != null ? d.ref.value : '1'}${d.ref.unit || unit}</div><div style="font-size:13px;font-weight:800;letter-spacing:1px">${(d.ref.label || '').toUpperCase()}</div>`; root.appendChild(r); }
  if (d.title) { const tt = document.createElement('div'); tt.style.cssText = 'position:absolute;left:50%;top:5%;transform:translateX(-50%);font-weight:900;color:' + numColor + ';font-size:26px'; tt.textContent = d.title; root.appendChild(tt); }

  const state = { tanks: [], kf: [], win: [], maxH: 1, numPx: Math.round(height * 0.072) };

  const ready = (async () => {
    const img = new Image(); img.src = d.tankImage || '/assets/sintex_tank2.png';
    await img.decode();
    const { canvas, aspect } = keyAndCrop(img);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

    const shTex = shadowTex(THREE);
    const BH = 3.4, GAP = 1.1; let cursor = 0;
    items.forEach((it) => {
      const sc = lerp(0.5, 1.18, Math.pow((Number(it.value) || 0) / maxV, 0.9));
      const H = BH * sc, W = H * aspect;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.12, depthWrite: false }));
      // extreme value ratios make tiny tanks — enforce a minimum centre spacing so
      // their big number labels can never overlap
      const x = cursor + W / 2; cursor += Math.max(W + GAP, 3.0);
      mesh.position.set(x, H / 2, 0); scene.add(mesh);
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.15, W * 0.5), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: 0, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.set(x, 0.015, 0.04); scene.add(shadow);
      state.tanks.push({ mesh, shadow, x, H, W, value: Number(it.value) || 0, label: String(it.label || '') });
    });
    const extent = cursor - GAP, cxc = extent / 2;
    state.tanks.forEach((t) => { t.mesh.position.x -= cxc; t.x -= cxc; });
    state.maxH = Math.max(...state.tanks.map((t) => t.H));

    // reveal windows + camera keyframes (focus each, then wide)
    const holdFrac = 0.16, span = 1 - holdFrac;
    state.span = span;
    state.win = state.tanks.map((_, i) => { const a0 = (i / n) * span * 0.98; return { a0, a1: a0 + span * 0.34 }; });
    const vHalf = (50 * Math.PI / 180) / 2, tanV = Math.tan(vHalf), tanH = tanV * (width / height);
    const fitDist = (w, h, m) => Math.max((h / 2) / tanV, (w / 2) / tanH) * (m || 1.06);
    const fitOne = (t) => fitDist(t.W * 2.2, t.H + 2.7, 1.05) + 1.0;
    const fitAll = () => fitDist(extent + state.tanks[n - 1].W + 1.0, state.maxH + 3.0, 1.1) + 1.8;
    state.kf = state.tanks.map((t, i) => ({ t: state.win[i].a0 + (state.win[i].a1 - state.win[i].a0) * 0.72, x: t.x, y: t.H * 0.5, dist: fitOne(t) }));
    state.kf.push({ t: Math.min(0.999, span + 0.015), x: 0, y: state.maxH * 0.5, dist: fitAll() });
  })();

  const N = d.frames || 210;
  const camAt = (raw) => {
    const kf = state.kf; if (!kf.length) return { x: 0, y: 1.5, dist: 12 };
    let j = 0; while (j < kf.length - 1 && raw >= kf[j + 1].t) j++;
    const A = kf[j], B = kf[Math.min(kf.length - 1, j + 1)];
    const u = B.t > A.t ? ease((raw - A.t) / (B.t - A.t)) : 1;
    return { x: lerp(A.x, B.x, u), y: lerp(A.y, B.y, u), dist: lerp(A.dist, B.dist, u) };
  };

  return {
    ready,
    update(frame) {
      if (!state.tanks.length) return;
      const raw = frame / N;
      state.tanks.forEach((t, i) => {
        const { a0, a1 } = state.win[i];
        const app = ease(clamp01((raw - a0) / Math.max(0.001, a1 - a0)));
        t.mesh.material.opacity = app;
        t.mesh.scale.setScalar(0.92 + 0.08 * app);
        t.mesh.position.y = t.H / 2 + (1 - app) * -0.5;
        if (t.shadow) t.shadow.material.opacity = app * 0.85;
      });
      const cam = camAt(raw);
      camera.position.set(cam.x, cam.y + cam.dist * 0.12, cam.dist);
      camera.lookAt(cam.x, cam.y, 0);
      camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      state.tanks.forEach((t, i) => {
        const { a0, a1 } = state.win[i];
        const vis = clamp01((raw - a0) / 0.05);
        const pr = project(t.x, t.H + 0.35, 0);
        const L = labels[i]; const on = pr.z < 1 && pr.x > -160 && pr.x < width + 160;
        L.el.style.opacity = on ? vis : 0; L.el.style.left = pr.x + 'px'; L.el.style.top = (pr.y - 4) + 'px';
        // keep fractional values EXACT (1.5 must never display as 2)
        const shown = countUp(frame, { start: a0 * N, lock: a1 * N, value: t.value, decimals: t.value % 1 ? 1 : 0 });
        L.num.style.fontSize = state.numPx + 'px'; L.num.textContent = `${Number(shown).toLocaleString()}${unit}`;
        L.cap.style.fontSize = Math.round(state.numPx * 0.32) + 'px'; L.cap.textContent = t.label.toUpperCase();
      });
    }
  };
}
