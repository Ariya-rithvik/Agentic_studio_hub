// A data-accurate animated bar chart — the thing generative video can't do.
// Bars grow to EXACT heights; value labels count up and lock on the EXACT input
// numbers, legibly, every frame. Deterministic. Edit a number -> exact re-render.
export const meta = { id: 'barchart', frames: 100, fps: 30, width: 960, height: 600, bg: '#ffffff' };

const DATA = {
  title: 'Global EV Sales (million cars)',
  cats: ['2020', '2021', '2022', '2023', '2024'],
  vals: [2.2, 4.6, 7.3, 10.5, 14.2],
  unit: 'M',
  color: 0xff7a18
};

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function create(THREE, ctx) {
  const { scene, camera, width, height } = ctx;
  scene.background = new THREE.Color('#ffffff');
  camera.position.set(0, 3.0, 8.2);
  camera.lookAt(0, 1.3, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(4, 7, 6); scene.add(key);

  const grid = new THREE.GridHelper(16, 16, 0xdfe3e6, 0xeef1f3);
  grid.position.y = 0; scene.add(grid);

  const n = DATA.vals.length;
  const maxV = Math.max(...DATA.vals);
  const barW = 0.8, gap = 0.7, maxH = 3.4;
  const totalW = n * barW + (n - 1) * gap;
  const x0 = -totalW / 2 + barW / 2;

  const bars = DATA.vals.map((v, i) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(barW, 1, barW),
      new THREE.MeshStandardMaterial({ color: DATA.color, metalness: 0.2, roughness: 0.5 })
    );
    const x = x0 + i * (barW + gap);
    mesh.position.set(x, 0, 0);
    scene.add(mesh);
    return { mesh, x, targetH: (v / maxV) * maxH, v };
  });

  // crisp HTML labels in the overlay layer
  const root = ctx.overlayRoot; root.innerHTML = '';
  root.style.fontFamily = 'Inter, "Segoe UI", Arial, sans-serif';

  const title = document.createElement('div');
  title.style.cssText = 'position:absolute;left:50%;top:26px;transform:translateX(-50%);font-size:22px;font-weight:800;color:#23262b;';
  title.textContent = DATA.title;
  root.appendChild(title);

  const mk = (cls) => { const d = document.createElement('div'); d.style.cssText = cls; root.appendChild(d); return d; };
  const valLabels = bars.map(() => mk('position:absolute;transform:translate(-50%,-100%);font-size:18px;font-weight:800;color:#23262b;'));
  const catLabels = bars.map((b, i) => { const d = mk('position:absolute;transform:translate(-50%,0);font-size:14px;font-weight:600;color:#6b7178;'); d.textContent = DATA.cats[i]; return d; });

  const project = (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
  };

  const N = meta.frames;
  return {
    update(frame) {
      const t = frame / N;
      bars.forEach((b, i) => {
        const g = smooth(0.10 + i * 0.07, 0.50 + i * 0.07, t);   // staggered grow
        const h = Math.max(0.0001, b.targetH * g);
        b.mesh.scale.y = h;
        b.mesh.position.y = h / 2;

        const pv = project(b.x, h + 0.22, 0);
        valLabels[i].style.left = pv.x + 'px'; valLabels[i].style.top = pv.y + 'px';
        valLabels[i].textContent = (b.v * g).toFixed(1) + DATA.unit;   // counts up, locks EXACT

        const pc = project(b.x, -0.18, 0.45);
        catLabels[i].style.left = pc.x + 'px'; catLabels[i].style.top = pc.y + 'px';
      });
    },
    probe() { return { values: valLabels.map((l) => l.textContent) }; }
  };
}
