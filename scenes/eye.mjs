// Motion-graphics primitive: a glowing green EYE that opens, looks 1 -> 2
// (tracking two things), tilts, and blinks. Hand-built + deterministic = a
// ROCK-SOLID building block the Director can compose (vs gambling on raw LLM code).
export const meta = { id: 'eye', frames: 130, fps: 30, width: 960, height: 600, bg: '#000000' };

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function lens(THREE, w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w, 0);
  s.quadraticCurveTo(0, h, w, 0);
  s.quadraticCurveTo(0, -h, -w, 0);
  return new THREE.ShapeGeometry(s, 48);
}
function numTex(THREE, txt) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#0c0c0c'; g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#1e1e1e'; g.font = 'bold 320px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, 128, 205);
  return new THREE.CanvasTexture(c);
}

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  scene.background = new THREE.Color('#000000');
  camera.position.set(0, 0, 6); camera.lookAt(0, 0, 0);

  // the two things it tracks (faint 1 / 2 panels, like the reference)
  [['1', -3.9], ['2', 3.9]].forEach(([n, x]) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.6), new THREE.MeshBasicMaterial({ map: numTex(THREE, n) }));
    p.position.set(x, 0, -0.6); scene.add(p);
  });

  const eye = new THREE.Group(); scene.add(eye);
  const glow = new THREE.Mesh(lens(THREE, 2.7, 1.55), new THREE.MeshBasicMaterial({ color: 0x6bff8a, transparent: true, opacity: 0.20, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  glow.position.z = -0.2; eye.add(glow);
  const sclera = new THREE.Mesh(lens(THREE, 2.3, 1.25), new THREE.MeshBasicMaterial({ color: 0xe6ffe9, side: THREE.DoubleSide }));
  eye.add(sclera);

  const look = new THREE.Group(); eye.add(look);
  look.add(new THREE.Mesh(new THREE.CircleGeometry(0.64, 48), new THREE.MeshBasicMaterial({ color: 0x2bbf45 })));
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), new THREE.MeshBasicMaterial({ color: 0x7bed8a })); inner.position.z = 0.01; look.add(inner);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.27, 48), new THREE.MeshBasicMaterial({ color: 0x05140a })); pupil.position.z = 0.02; look.add(pupil);
  const glint = new THREE.Mesh(new THREE.CircleGeometry(0.08, 24), new THREE.MeshBasicMaterial({ color: 0xffffff })); glint.position.set(0.11, 0.12, 0.03); look.add(glint);

  // black lids that meet on blink (cover top + bottom)
  const lidH = 1.6;
  const lidTop = new THREE.Mesh(new THREE.PlaneGeometry(6, lidH), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const lidBot = lidTop.clone();
  eye.add(lidTop); eye.add(lidBot);

  const N = meta.frames;
  return {
    update(frame) {
      const t = frame / N;
      const open = smooth(0.0, 0.12, t);

      // look: center -> left(1) -> right(2) -> center
      const lx = -1 * smooth(0.20, 0.34, t) + 2 * smooth(0.46, 0.62, t) - 1 * smooth(0.80, 0.92, t);
      look.position.x = lx * 0.95;
      look.position.y = -Math.abs(lx) * 0.05;
      eye.rotation.z = lx * 0.06;                      // slight tilt toward the look

      // blink spike around t=0.72
      const b = smooth(0.70, 0.725, t) * (1 - smooth(0.73, 0.755, t));
      const lidGap = (1 - b) * open;                   // 1 = open, ~0 = closed
      lidTop.position.y = lidH / 2 + lidGap * 1.35;
      lidBot.position.y = -lidH / 2 - lidGap * 1.35;
      eye.scale.set(1, open, 1);
    }
  };
}
