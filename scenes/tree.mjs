// tree — animated flowchart/tree explainer primitive (the "Family of 10 members"
// reference style): a root icon+label pops in, connector lines DRAW downward,
// each branch reveals a boxed count, a drop line and an icon node (DFS order),
// then optional UPDATES highlight a box and count its number up/down to a new
// value. Crisp DOM/SVG text+lines over the canvas (the part video-gen can't do).
// Config-driven: /data/tree/<name>.json — NOT hardcoded to any topic.
const cache = new Map();
const nameOf = () => new URLSearchParams(location.search).get('tree') || 'demo';
async function load(name) {
  if (!cache.has(name)) { const r = await fetch(`/data/tree/${name}.json?t=` + Date.now()); cache.set(name, r.ok ? await r.json() : {}); }
  return cache.get(name);
}
export async function getMeta() {
  const d = await load(nameOf());
  return { id: 'tree:' + nameOf(), frames: d.frames || 260, fps: 30, width: d.width || 1280, height: d.height || 720, bg: d.bg || '#e9e4cf' };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sm = (a, b, x) => { const t = clamp01((x - a) / Math.max(1e-6, b - a)); return t * t * (3 - 2 * t); };
const pop = (p) => { const c = 1.6; const t = clamp01(p); return t === 0 ? 0 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// tiny flat pictograms (white on the colored disc), drawn once on a canvas
function iconURL(type, size = 96) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  const person = (x, y, s) => {
    g.beginPath(); g.arc(x, y - 0.62 * s, 0.22 * s, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x - 0.34 * s, y + 0.55 * s); g.quadraticCurveTo(x - 0.38 * s, y - 0.3 * s, x, y - 0.3 * s);
    g.quadraticCurveTo(x + 0.38 * s, y - 0.3 * s, x + 0.34 * s, y + 0.55 * s); g.closePath(); g.fill();
  };
  const u = size / 96;
  if (type === 'family') { person(30 * u, 44 * u, 30 * u); person(66 * u, 44 * u, 30 * u); person(48 * u, 56 * u, 22 * u); }
  else if (type === 'working') {
    person(36 * u, 40 * u, 26 * u);
    g.fillRect(20 * u, 62 * u, 56 * u, 6 * u);                       // desk
    g.fillRect(56 * u, 46 * u, 20 * u, 13 * u);                      // laptop
  } else if (type === 'elderly') {
    person(34 * u, 46 * u, 28 * u); person(62 * u, 46 * u, 28 * u);
    g.lineWidth = 4 * u; g.beginPath(); g.moveTo(78 * u, 44 * u); g.lineTo(78 * u, 72 * u); g.stroke();  // cane
  } else if (type === 'child') {
    person(34 * u, 52 * u, 22 * u); person(62 * u, 52 * u, 22 * u);
    g.lineWidth = 4 * u;                                             // arms up
    g.beginPath(); g.moveTo(24 * u, 40 * u); g.lineTo(16 * u, 30 * u); g.stroke();
    g.beginPath(); g.moveTo(72 * u, 40 * u); g.lineTo(80 * u, 30 * u); g.stroke();
  } else { person(48 * u, 48 * u, 34 * u); }
  return c.toDataURL();
}

export function create(THREE, ctx) {
  const { scene, width: W, height: H } = ctx;
  const d = cache.get(nameOf()) || {};
  scene.background = new THREE.Color(d.bg || '#e9e4cf');

  const root = d.root || { label: 'Root', icon: 'family', color: '#c89a4a' };
  const kids = (Array.isArray(d.children) ? d.children : []).slice(0, 4);
  const n = Math.max(1, kids.length);
  const updates = (Array.isArray(d.updates) ? d.updates : []).filter((u) => kids[u.child]);
  const ink = d.ink || '#1c1c1c';

  // ---- layout ----
  const RY = 96, RR = 46, rootLabelY = RY + RR + 34;
  const trunkTop = rootLabelY + 22, hbarY = trunkTop + 78;
  const m = Math.max(140, W * 0.12), span = W - 2 * m;
  const xs = kids.map((_, i) => (n === 1 ? W / 2 : m + (span * i) / (n - 1)));
  const tickB = hbarY + 36, boxY = tickB + 30, dropB = boxY + 24 + 92, iconY = dropB + 48, labelY = iconY + 78;

  const o = ctx.overlayRoot; o.innerHTML = '';
  o.style.cssText += ';font-family:"Segoe UI",-apple-system,Arial,sans-serif;';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.style.cssText = 'position:absolute;inset:0;overflow:visible;';
  o.appendChild(svg);
  const mkLine = () => { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('stroke', ink); l.setAttribute('stroke-width', '3'); svg.appendChild(l); return l; };
  const setLine = (l, x1, y1, x2, y2, op = 1) => { l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); l.style.opacity = op; };

  const div = (css, html) => { const el = document.createElement('div'); el.style.cssText = css; if (html != null) el.innerHTML = html; o.appendChild(el); return el; };
  // root node
  // Generated icon PNGs come with white corners around the disc. Keying them to
  // transparent (flood from the corners) lets the disc render at 100% with its own
  // anti-aliased edge — crisp and native, not "pasted". Runs in the ready promise.
  const keyIcon = (url) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const dd = g.getImageData(0, 0, c.width, c.height), px = dd.data, w = c.width, h = c.height;
        const near = (i) => px[i] > 228 && px[i + 1] > 228 && px[i + 2] > 228;
        const seen = new Uint8Array(w * h), st = [];
        for (let x = 0; x < w; x++) { st.push(x, 0, x, h - 1); }
        for (let y = 0; y < h; y++) { st.push(0, y, w - 1, y); }
        while (st.length) {
          const y = st.pop(), x = st.pop();
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const idx = y * w + x; if (seen[idx]) continue; seen[idx] = 1;
          const i = idx * 4; if (!near(i)) continue; px[i + 3] = 0;
          st.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
        }
        g.putImageData(dd, 0, 0); res(c.toDataURL());
      } catch { res(url); }
    };
    img.onerror = () => res(url);
    img.src = url;
  });
  const iconCSS = (node, fallbackColor) => node.iconImage
    ? `background:transparent;`                                // keyed image applied via ready
    : `background:${node.color || fallbackColor};background-image:url(${iconURL(node.icon)});background-size:78% 78%;background-position:center;background-repeat:no-repeat;`;
  const rootIcon = div(`position:absolute;left:${W / 2}px;top:${RY}px;width:${RR * 2}px;height:${RR * 2}px;margin:-${RR}px 0 0 -${RR}px;border-radius:50%;${iconCSS(root, '#c89a4a')}opacity:0;`);
  const rootLbl = div(`position:absolute;left:${W / 2}px;top:${rootLabelY}px;transform:translate(-50%,-50%);font-size:31px;color:${ink};font-weight:600;white-space:nowrap;opacity:0;`, String(root.label || ''));

  const trunk = mkLine(), hbarL = mkLine(), hbarR = mkLine();
  const branches = kids.map((k, i) => {
    const tick = mkLine(), drop = mkLine();
    const hl = div(`position:absolute;left:${xs[i]}px;top:${boxY}px;transform:translate(-50%,-50%);width:180px;height:64px;background:#9a937d;opacity:0;`);
    const box = div(`position:absolute;left:${xs[i]}px;top:${boxY}px;transform:translate(-50%,-50%);border:2.5px solid ${ink};padding:7px 16px;font-size:26px;color:${ink};font-weight:600;background:transparent;white-space:nowrap;opacity:0;`);
    const icon = div(`position:absolute;left:${xs[i]}px;top:${iconY}px;width:100px;height:100px;margin:-50px 0 0 -50px;border-radius:50%;${iconCSS(k, '#7ab3d9')}opacity:0;`);
    const lbl = div(`position:absolute;left:${xs[i]}px;top:${labelY}px;transform:translate(-50%,-50%);font-size:29px;color:${ink};font-weight:600;white-space:nowrap;opacity:0;`, String(k.label || ''));
    return { k, tick, drop, hl, box, icon, lbl };
  });

  // ---- timeline (fractions of the whole clip) ----
  const T = {
    rootIn: [0.02, 0.07], rootLbl: [0.06, 0.11], trunk: [0.11, 0.17], hbar: [0.17, 0.25],
    branch0: 0.25, branchSpan: Math.min(0.5, 0.17 * n)            // DFS: one branch after another
  };
  const per = T.branchSpan / n;
  const N = (d.frames || 260);

  // apply the keyed (white-corner-free) icon images before the first frame
  const ready = (async () => {
    const jobs = [];
    if (root.iconImage) jobs.push(keyIcon(root.iconImage).then((u) => {
      rootIcon.style.backgroundImage = `url(${u})`; rootIcon.style.backgroundSize = '100% 100%';
    }));
    branches.forEach((b) => {
      if (b.k.iconImage) jobs.push(keyIcon(b.k.iconImage).then((u) => {
        b.icon.style.backgroundImage = `url(${u})`; b.icon.style.backgroundSize = '100% 100%';
      }));
    });
    await Promise.all(jobs);
  })();

  return {
    ready,
    update(frame) {
      const t = frame / N;
      // root
      const ri = pop(sm(T.rootIn[0], T.rootIn[1], t));
      rootIcon.style.opacity = clamp01(ri); rootIcon.style.transform = `scale(${Math.max(0.001, ri)})`;
      rootLbl.style.opacity = sm(T.rootLbl[0], T.rootLbl[1], t);
      // trunk + horizontal bar (draw from center outward)
      const tr = sm(T.trunk[0], T.trunk[1], t);
      setLine(trunk, W / 2, trunkTop, W / 2, trunkTop + (hbarY - trunkTop) * tr, tr > 0 ? 1 : 0);
      const hb = sm(T.hbar[0], T.hbar[1], t);
      setLine(hbarL, W / 2, hbarY, W / 2 - (W / 2 - xs[0]) * hb, hbarY, hb > 0 ? 1 : 0);
      setLine(hbarR, W / 2, hbarY, W / 2 + (xs[n - 1] - W / 2) * hb, hbarY, hb > 0 ? 1 : 0);

      branches.forEach((b, i) => {
        const a = T.branch0 + i * per;                     // this branch's window
        const w = (f0, f1) => sm(a + f0 * per, a + f1 * per, t);
        const tick = w(0, 0.22);
        setLine(b.tick, xs[i], hbarY, xs[i], hbarY + (tickB - hbarY) * tick, tick > 0 ? 1 : 0);
        const bx = w(0.2, 0.45);
        b.box.style.opacity = bx; b.box.style.transform = `translate(-50%,-50%) scale(${0.85 + 0.15 * pop(bx)})`;
        const dr = w(0.45, 0.7);
        const dropTop = boxY + 26;
        setLine(b.drop, xs[i], dropTop, xs[i], dropTop + (iconY - 50 - dropTop) * dr, dr > 0 ? 1 : 0);
        const ic = pop(w(0.68, 0.95));
        b.icon.style.opacity = clamp01(ic); b.icon.style.transform = `scale(${Math.max(0.001, ic)})`;
        b.lbl.style.opacity = w(0.8, 1);

        // boxed count text (updates can re-count it later)
        let val = Number(b.k.count);
        let hl = 0;
        updates.forEach((u) => {
          if (u.child !== i) return;
          const s = Number(u.start) || 0.75, e = Number(u.end) || 0.92;
          const p = sm(s, e, t);
          if (p > 0) val = Math.round(val + (Number(u.to) - val) * p);
          // clamp the fade-out INSIDE the clip — an update near the end previously
          // left a ~30%-opacity highlight remnant in the final frames
          // attention choreography: the WHOLE box highlights clearly BEFORE the
          // number starts changing, so the change never feels sudden
          hl = Math.max(hl, sm(s - 0.09, s - 0.045, t) * (1 - sm(Math.min(e + 0.04, 0.95), Math.min(e + 0.1, 0.985), t)));
        });
        b.box.textContent = isFinite(val) ? `${val} ${b.k.unit || ''}`.trim() : String(b.k.unit || '');
        // size the highlight to cover the FULL box + margin (measured, not guessed)
        if (!b.hlSized) {
          const r = b.box.getBoundingClientRect();
          if (r.width > 0) { b.hl.style.width = Math.round(r.width + 40) + 'px'; b.hl.style.height = Math.round(r.height + 30) + 'px'; b.hlSized = true; }
        }
        b.hl.style.opacity = 0.55 * hl;
      });
    }
  };
}
