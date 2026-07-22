// The Solar System — config-driven (data/solar.json), with real planet textures,
// a slow cinematic orbiting camera, accurate data callouts (AU / diameter / year)
// that cycle planet-by-planet, and accurate name labels. Deterministic.
// Edit data/solar.json (pick planets, swap textures, change labels/data) -> the
// scene follows. Driven live by solar-editor.html.
import { easeInOutSine, smoothstep } from './lib/ease.mjs';

export const meta = { id: 'solar_system', frames: 240, fps: 30, width: 1280, height: 720, bg: '#03040a' };

const hash = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

const DEFAULT = {
  title: 'THE SOLAR SYSTEM',
  camera: { radius: 21, height: 9.5, sweep: 0.6 },
  planets: [
    { name: 'MERCURY', tex: 'mercury', size: 0.20, orbit: 2.8, speed: 1.60, tilt: 0.02, au: 0.39, diameter: '4,879 km', period: '88 days', show: true },
    { name: 'VENUS', tex: 'venus', size: 0.32, orbit: 3.7, speed: 1.18, tilt: 0.05, au: 0.72, diameter: '12,104 km', period: '225 days', show: true },
    { name: 'EARTH', tex: 'earth', size: 0.34, orbit: 4.7, speed: 1.0, tilt: 0.41, au: 1.0, diameter: '12,742 km', period: '365 days', show: true },
    { name: 'MARS', tex: 'mars', size: 0.26, orbit: 5.7, speed: 0.81, tilt: 0.44, au: 1.52, diameter: '6,779 km', period: '687 days', show: true },
    { name: 'JUPITER', tex: 'jupiter', size: 0.85, orbit: 7.6, speed: 0.44, tilt: 0.05, au: 5.2, diameter: '139,820 km', period: '11.9 years', show: true },
    { name: 'SATURN', tex: 'saturn', size: 0.72, orbit: 9.6, speed: 0.32, tilt: 0.47, ring: true, au: 9.58, diameter: '116,460 km', period: '29.5 years', show: true },
    { name: 'URANUS', tex: 'uranus', size: 0.52, orbit: 11.3, speed: 0.23, tilt: 1.7, au: 19.2, diameter: '50,724 km', period: '84 years', show: true },
    { name: 'NEPTUNE', tex: 'neptune', size: 0.5, orbit: 12.7, speed: 0.18, tilt: 0.49, au: 30.1, diameter: '49,244 km', period: '165 years', show: true }
  ]
};

const cardHTML = (pl) =>
  `<div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:5px;letter-spacing:.5px;">${pl.name}</div>` +
  `<div style="font-size:12px;color:#aeb8c4;line-height:1.7;">` +
  `Distance &nbsp; <b style="color:#fff;">${pl.au} AU</b><br>` +
  `Diameter &nbsp; <b style="color:#fff;">${pl.diameter}</b><br>` +
  `1 year = <b style="color:#fff;">${pl.period}</b></div>`;

export function create(THREE, ctx) {
  const { scene, camera, width, height } = ctx;
  scene.background = new THREE.Color('#03040a');
  scene.add(new THREE.AmbientLight(0x33415a, 0.18));

  // Sun + glow + light
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.5, 48, 48), new THREE.MeshBasicMaterial({ color: 0xffcc66 }));
  scene.add(sun);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(2.0, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })));
  scene.add(new THREE.PointLight(0xfff4e2, 3.0, 0, 0));

  // starfield
  const cnt = 2000, sp = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) { const r = 90, th = hash(i) * Math.PI * 2, ph = Math.acos(2 * hash(i + 7) - 1); sp[i*3] = r*Math.sin(ph)*Math.cos(th); sp[i*3+1] = r*Math.cos(ph); sp[i*3+2] = r*Math.sin(ph)*Math.sin(th); }
  const sgg = new THREE.BufferGeometry(); sgg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sgg, new THREE.PointsMaterial({ size: 1.0, sizeAttenuation: false, color: 0xffffff })));

  // overlay scaffolding
  const root = ctx.overlayRoot; root.innerHTML = ''; root.style.fontFamily = 'Inter, "Segoe UI", Arial, sans-serif';
  const title = document.createElement('div');
  title.style.cssText = 'position:absolute;left:50%;top:24px;transform:translateX(-50%);font-size:20px;font-weight:800;letter-spacing:2px;color:#eaf0f6;text-shadow:0 2px 6px #000;';
  root.appendChild(title);
  const sunLabel = document.createElement('div');
  sunLabel.style.cssText = 'position:absolute;transform:translate(-50%,-50%);font-size:13px;font-weight:700;letter-spacing:.6px;color:#ffe9b0;text-shadow:0 1px 3px #000;';
  sunLabel.textContent = 'SUN'; root.appendChild(sunLabel);
  const dataCard = document.createElement('div');
  dataCard.style.cssText = 'position:absolute;transform:translate(-50%,0);background:rgba(10,14,22,.82);border:1px solid #2a3340;border-radius:10px;padding:10px 14px;opacity:0;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.5);';
  root.appendChild(dataCard);

  const project = (v) => { const q = v.clone().project(camera); return { x: (q.x * 0.5 + 0.5) * width, y: (-q.y * 0.5 + 0.5) * height }; };
  const loader = new THREE.TextureLoader();
  const load = (u) => new Promise((res) => loader.load(u, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null)));

  let planets = [], cam = { radius: 21, height: 9.5, sweep: 0.6 };

  const ready = (async () => {
    let cfg;
    try { cfg = await (await fetch('/data/solar.json?t=' + Date.now())).json(); } catch { cfg = DEFAULT; }
    title.textContent = cfg.title || DEFAULT.title;
    if (cfg.camera) cam = { ...cam, ...cfg.camera };
    const list = (cfg.planets || DEFAULT.planets).filter((p) => p.show !== false);

    const sunT = await load('/assets/sun.jpg'); if (sunT) { sun.material.map = sunT; sun.material.color.set(0xffffff); sun.material.needsUpdate = true; }

    for (let idx = 0; idx < list.length; idx++) {
      const pl = list[idx];
      const seg = 96, rp = new Float32Array((seg + 1) * 3);
      for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; rp[i*3] = Math.cos(a) * pl.orbit; rp[i*3+2] = Math.sin(a) * pl.orbit; }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
      scene.add(new THREE.Line(rg, new THREE.LineBasicMaterial({ color: 0x2c3647, transparent: true, opacity: 0.7 })));

      const pivot = new THREE.Group(); scene.add(pivot);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(pl.size, 48, 48), new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 1.0, metalness: 0.0 }));
      mesh.position.set(pl.orbit, 0, 0); mesh.rotation.z = pl.tilt || 0; pivot.add(mesh);

      let ring = null;
      if (pl.ring) {
        const inner = pl.size * 1.35, outer = pl.size * 2.3, ringGeo = new THREE.RingGeometry(inner, outer, 72);
        const uv = ringGeo.attributes.uv, posn = ringGeo.attributes.position, v3 = new THREE.Vector3();
        for (let i = 0; i < posn.count; i++) { v3.fromBufferAttribute(posn, i); uv.setXY(i, (v3.length() - inner) / (outer - inner), 0.5); }
        ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; mesh.add(ring);
        const rt = await load('/assets/saturn_ring.png'); if (rt) { ring.material.map = rt; ring.material.alphaMap = rt; ring.material.needsUpdate = true; }
      }
      const t = await load(`/assets/${pl.tex}.jpg`); if (t) { mesh.material.map = t; mesh.material.color.set(0xffffff); mesh.material.needsUpdate = true; }

      const label = document.createElement('div');
      label.style.cssText = 'position:absolute;transform:translate(-50%,-50%);font-size:11px;font-weight:700;letter-spacing:.6px;color:#e6edf4;text-shadow:0 1px 3px #000;white-space:nowrap;';
      label.textContent = pl.name; root.appendChild(label);

      planets.push({ ...pl, pivot, mesh, label, phase: hash(idx * 3) * Math.PI * 2 });
    }
  })();

  const N = meta.frames, tmp = new THREE.Vector3();
  return {
    ready,
    update(frame) {
      const t = frame / N;

      // cinematic slow orbit; refresh camera matrices so label projection is exact
      const az = easeInOutSine(t) * cam.sweep * Math.PI * 2;
      camera.position.set(Math.sin(az) * cam.radius, cam.height, Math.cos(az) * cam.radius);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

      planets.forEach((pl) => {
        pl.pivot.rotation.y = pl.phase + t * pl.speed * Math.PI * 2;
        pl.mesh.rotation.y = t * Math.PI * 6;
        pl.mesh.getWorldPosition(tmp); const p = project(tmp);
        pl.label.style.left = p.x + 'px'; pl.label.style.top = (p.y - 14 - pl.size * 30) + 'px';
      });
      sun.getWorldPosition(tmp); const ps = project(tmp);
      sunLabel.style.left = ps.x + 'px'; sunLabel.style.top = (ps.y - 42) + 'px';

      // data callout cycles through planets, one at a time
      if (planets.length) {
        const slot = Math.min(planets.length - 0.0001, t * planets.length);
        const idx = Math.floor(slot), within = slot - idx;
        const fade = smoothstep(0, 0.14, within) * (1 - smoothstep(0.84, 1.0, within));
        const pl = planets[idx];
        pl.mesh.getWorldPosition(tmp); const p = project(tmp);
        dataCard.style.opacity = fade;
        dataCard.style.left = p.x + 'px'; dataCard.style.top = (p.y + 26 + pl.size * 30) + 'px';
        dataCard.innerHTML = cardHTML(pl);
      }
      title.style.opacity = 1 - smoothstep(0.10, 0.20, t) * 0.0;  // keep title
    }
  };
}
