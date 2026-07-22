// Hand-built parametric scene: two water tanks (Sintex-style) connected by a pipe,
// water TRANSFERRING from TANK 1 (left) to TANK 2 (right). Deterministic + eased.
// The reliable "vetted primitive" path — the engine CAN make specific physical
// scenes when authored as a primitive (vs gambling on raw LLM code).
export const meta = { id: 'water_transfer', frames: 140, fps: 30, width: 1280, height: 720, bg: '#eef3f8' };

const ease = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function label(THREE, txt) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#123'; g.font = 'bold 96px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, 256, 84);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  scene.background = new THREE.Color('#eef3f8');
  camera.position.set(0, 1.9, 10.5); camera.lookAt(0, 1.4, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(4, 8, 6); scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0xbcd4ff, 0.35); dir2.position.set(-5, 3, 4); scene.add(dir2);

  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshStandardMaterial({ color: 0xd7dee6, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0; scene.add(ground);

  const TANK_R = 1.25, TANK_H = 3.0, X = 2.5, BASE = 0.06;
  const WATER = 0x1f8fff;

  // a tank = translucent shell (open top) + coloured rim/base so it reads as a Sintex tank
  function tank(x, tint) {
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 48, 1, true),
      new THREE.MeshStandardMaterial({ color: tint, roughness: 0.35, metalness: 0.0, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
    );
    shell.position.set(x, TANK_H / 2 + BASE, 0); scene.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(TANK_R, 0.07, 12, 48), new THREE.MeshStandardMaterial({ color: tint, roughness: 0.5 }));
    rim.rotation.x = Math.PI / 2; rim.position.set(x, TANK_H + BASE, 0); scene.add(rim);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R + 0.05, TANK_R + 0.12, 0.18, 48), new THREE.MeshStandardMaterial({ color: 0x9aa6b2, roughness: 0.9 }));
    base.position.set(x, 0.09, 0); scene.add(base);
    return shell;
  }
  tank(-X, 0x3aa0d8);  // Tank 1 (blue-ish)
  tank(X, 0x54c07a);   // Tank 2 (green-ish)

  // water columns inside each tank (radius slightly under the shell)
  const WMAT = () => new THREE.MeshStandardMaterial({ color: WATER, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
  const WH = TANK_H - 0.2;
  const waterL = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R - 0.08, TANK_R - 0.08, WH, 40), WMAT());
  const waterR = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R - 0.08, TANK_R - 0.08, WH, 40), WMAT());
  waterL.position.x = -X; waterR.position.x = X; scene.add(waterL); scene.add(waterR);

  // connecting pipe near the bottoms (+ water inside it) — axis along X
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 2 * X, 28), new THREE.MeshStandardMaterial({ color: 0x8b96a2, roughness: 0.5, metalness: 0.3 }));
  pipe.rotation.z = Math.PI / 2; pipe.position.set(0, 0.55, 0); scene.add(pipe);
  const pipeWater = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2 * X, 24), WMAT());
  pipeWater.rotation.z = Math.PI / 2; pipeWater.position.set(0, 0.55, 0); scene.add(pipeWater);
  // little risers where pipe meets each tank
  [-X, X].forEach((x) => { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.6, 20), WMAT()); j.position.set(x, 0.4, 0); scene.add(j); });

  // labels above each tank
  [['TANK 1', -X], ['TANK 2', X]].forEach(([txt, x]) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), new THREE.MeshBasicMaterial({ map: label(THREE, txt), transparent: true }));
    p.position.set(x, TANK_H + 0.9, 0); scene.add(p);
  });

  // flow-direction arrow above the pipe
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0x1f8fff }));
  arrow.rotation.z = -Math.PI / 2; arrow.position.set(0, 1.15, 0); scene.add(arrow);

  const setLevel = (mesh, level) => { const h = WH * level; mesh.scale.y = Math.max(0.001, level); mesh.position.y = BASE + 0.1 + h / 2; };
  const N = meta.frames;
  return {
    update(frame) {
      const t = ease(frame / N);
      setLevel(waterL, lerp(0.95, 0.1, t));   // Tank 1 drains
      setLevel(waterR, lerp(0.1, 0.95, t));   // Tank 2 fills
      const flowing = ease(Math.min(1, (frame / N) / 0.12)) * (1 - ease(Math.max(0, ((frame / N) - 0.9) / 0.1)));
      pipeWater.material.opacity = 0.35 + 0.55 * flowing;
      arrow.material.opacity = flowing;
      arrow.position.x = -0.6 + 1.2 * ((frame / N * 2) % 1);   // arrow drifts left->right
    }
  };
}
