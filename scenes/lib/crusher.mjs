// Step 2 — Crusher. Stylized cross-section: two counter-rotating spiked rollers,
// grey rocks fall in and get crushed, orange powder streams down into a growing
// mound. Deterministic (pure function of frame), eased to the pacing standard.
import { easeInOutSine, smoothstep, lerp } from './ease.mjs';

const hash = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

function chunk(THREE, r, color) {
  const g = new THREE.IcosahedronGeometry(r, 0);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + Math.sin(v.x * 9) * Math.cos(v.y * 8) * 0.14);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.05, flatShading: true, transparent: true }));
}

export function buildCrusher(THREE, ctx) {
  const { scene, camera } = ctx;
  const N = ctx.frames || 120;
  scene.background = new THREE.Color('#ffffff');
  camera.position.set(2.4, 1.7, 8.2);
  camera.lookAt(0, 0.0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(4, 7, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe6c0, 0.5); rim.position.set(-5, 2, -3); scene.add(rim);
  const grid = new THREE.GridHelper(20, 40, 0xcdd2d6, 0xe9ecee); grid.position.y = -2.6; scene.add(grid);

  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.45, metalness: 0.65 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xc2c8ce, roughness: 0.7, metalness: 0.25, side: THREE.DoubleSide });

  // hopper funnel walls (guide rocks toward the gap) + side walls (cross-section)
  const fw1 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 1.6), wallMat); fw1.position.set(-1.0, 1.75, 0); fw1.rotation.z = -0.62; scene.add(fw1);
  const fw2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 1.6), wallMat); fw2.position.set(1.0, 1.75, 0); fw2.rotation.z = 0.62; scene.add(fw2);
  [-1.55, 1.55].forEach((x) => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.0, 1.6), wallMat); w.position.set(x, -0.5, 0); scene.add(w); });

  // two counter-rotating spiked rollers
  const rollers = [-0.62, 0.62].map((x, idx) => {
    const spinner = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 28), steel);
    cyl.rotation.x = Math.PI / 2; spinner.add(cyl);
    const teeth = 10;
    for (let k = 0; k < teeth; k++) {
      const a = (k / teeth) * Math.PI * 2;
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 1.4), steel);
      t.position.set(Math.cos(a) * 0.56, Math.sin(a) * 0.56, 0); t.rotation.z = a; spinner.add(t);
    }
    spinner.position.set(x, 0.2, 0);
    scene.add(spinner);
    return { spinner, dir: idx === 0 ? 1 : -1 };
  });

  // falling grey rocks (looping pool)
  const ROCKS = 6, rockPeriod = 46;
  const rocks = Array.from({ length: ROCKS }, (_, i) => { const m = chunk(THREE, 0.2 + (i % 3) * 0.05, 0x6b6f72); scene.add(m); return m; });

  // orange powder stream (looping pool)
  const POW = 26, powPeriod = 30;
  const powMat = new THREE.MeshStandardMaterial({ color: 0xe07b2a, roughness: 0.9, metalness: 0.05 });
  const powder = Array.from({ length: POW }, () => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), powMat); scene.add(s); return s; });

  // growing powder mound (base pinned to the grid via a group)
  const moundG = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.0, 30), new THREE.MeshStandardMaterial({ color: 0xd9742a, roughness: 0.95, metalness: 0.03 }));
  cone.position.y = 0.5; moundG.add(cone); moundG.position.set(0, -2.55, 0); scene.add(moundG);

  return {
    update(frame) {
      const t = frame / N;
      const spin = frame * 0.16;
      rollers.forEach((r) => { r.spinner.rotation.z = r.dir * spin; });

      rocks.forEach((m, i) => {
        const local = ((frame + i * (rockPeriod / ROCKS)) % rockPeriod) / rockPeriod;
        const x = (hash(i) - 0.5) * 0.5, z = (hash(i + 9) - 0.5) * 0.6;
        if (local < 0.72) {
          m.position.set(x, lerp(2.5, 0.55, easeInOutSine(local / 0.72)), z);
          m.rotation.set(frame * 0.05 + i, frame * 0.04 + i, 0);
          m.scale.setScalar(1); m.material.opacity = 1; m.visible = true;
        } else {
          const f = (local - 0.72) / 0.28;
          m.position.set(x, 0.45, z);
          m.scale.setScalar(Math.max(0.001, 1 - f)); m.material.opacity = 1 - f; m.visible = f < 1;
        }
      });

      powder.forEach((s, i) => {
        const local = ((frame + i * (powPeriod / POW)) % powPeriod) / powPeriod;
        s.position.set((hash(i + 3) - 0.5) * 0.9, lerp(0.1, -2.0, local), (hash(i + 5) - 0.5) * 0.7);
        s.visible = t > 0.12 && local > 0.05;
      });

      const grow = smoothstep(0.12, 0.95, t);
      moundG.scale.set(0.25 + grow * 0.9, 0.05 + grow * 1.15, 0.25 + grow * 0.9);
    }
  };
}
