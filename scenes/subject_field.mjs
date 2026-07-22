// Motion-graphics primitive: the "subject field" — a scatter of dots (the crowd),
// one glowing GREEN subject, and a focus ring that draws around it while the rest
// dim to grey. Matches the viral-reels reference. Hand-built + deterministic.
export const meta = { id: 'subject_field', frames: 140, fps: 30, width: 960, height: 600, bg: '#000000' };

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  scene.background = new THREE.Color('#000000');
  camera.position.set(0, 0, 7); camera.lookAt(0, 0, 0);
  const aspect = ctx.width / ctx.height;

  // scattered crowd dots (avoid the centre where the subject sits)
  const N_DOTS = 16, dots = [];
  for (let i = 0; i < N_DOTS; i++) {
    const ang = hash(i) * Math.PI * 2;
    const rad = 1.7 + hash(i + 7) * 2.3;
    const x = Math.cos(ang) * rad * aspect * 0.62;
    const y = Math.sin(ang) * rad * 0.92;
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.22 + hash(i + 3) * 0.06, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    m.position.set(x, y, 0); scene.add(m);
    dots.push({ m, x, y, ph: hash(i + 11) * Math.PI * 2, app0: hash(i) * 0.12 });
  }

  // subject: glow + green dot + focus ring
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 48), new THREE.MeshBasicMaterial({ color: 0xccff33, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.z = -0.1; scene.add(glow);
  const subject = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshBasicMaterial({ color: 0xcdff3a, transparent: true })); scene.add(subject);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.34, 1.40, 80), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide })); scene.add(ring);

  const N = meta.frames;
  return {
    update(frame) {
      const t = frame / N;
      const dim = smooth(0.28, 0.55, t);              // crowd de-emphasis white->grey

      dots.forEach((d, i) => {
        const app = smooth(d.app0, 0.22 + d.app0, t);
        const c = 1 - dim * 0.6;                       // 1 (white) -> 0.4 (grey)
        d.m.material.color.setRGB(c, c, c);
        d.m.material.opacity = app;
        d.m.position.x = d.x + Math.sin(t * Math.PI * 2 + d.ph) * 0.07;
        d.m.position.y = d.y + Math.cos(t * Math.PI * 2 + d.ph) * 0.07;
        d.m.scale.setScalar(0.3 + app * 0.7);
      });

      const sIn = smooth(0.06, 0.22, t);
      subject.material.opacity = sIn; subject.scale.setScalar(0.3 + sIn * 0.7);
      glow.material.opacity = sIn * (0.30 + 0.10 * Math.sin(t * Math.PI * 5));
      glow.scale.setScalar(0.9 + 0.1 * Math.sin(t * Math.PI * 3));

      const rIn = smooth(0.32, 0.58, t);
      ring.material.opacity = rIn * 0.9;
      ring.scale.setScalar(0.55 + rIn * 0.45);
    }
  };
}
