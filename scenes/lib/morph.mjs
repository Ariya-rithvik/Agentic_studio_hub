// Reusable 3D builder: rough copper ore that morphs into a copper wire spool,
// on a white studio floor with a technical grid. Used by ore_to_wire (pure 3D)
// and scene1_copper (3D + overlays). Deterministic; driven by frame index.
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function makeRock(THREE) {
  const geo = new THREE.IcosahedronGeometry(1.15, 3);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const colors = [];
  const grey = new THREE.Color(0x6b6f72);
  const green = new THREE.Color(0x4a7c59);
  const copper = new THREE.Color(0xb87333);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 3.1) * Math.cos(v.y * 2.7) + Math.sin(v.z * 3.7) * 0.6;
    v.multiplyScalar(1 + n * 0.11);
    pos.setXYZ(i, v.x, v.y, v.z);
    const p = Math.sin(v.x * 5.0) * Math.sin(v.y * 4.3) * Math.sin(v.z * 4.7);
    const c = p > 0.45 ? copper : (p < -0.5 ? green : grey);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, metalness: 0.08, flatShading: true, transparent: true
  });
  return new THREE.Mesh(geo, mat);
}

export function buildMorph(THREE, ctx, opts = {}) {
  const { scene, camera } = ctx;
  const N = ctx.frames || 60;
  const rockOut  = opts.rockOut  || [0.35, 0.62];
  const spoolIn  = opts.spoolIn  || [0.45, 0.84];

  scene.background = new THREE.Color('#ffffff');
  camera.position.set(0, 1.5, 5.0);
  camera.lookAt(0, 0.1, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe6c0, 0.6); rim.position.set(-5, 2, -3); scene.add(rim);

  const grid = new THREE.GridHelper(24, 48, 0xcdd2d6, 0xe9ecee);
  grid.position.y = -1.25;
  scene.add(grid);

  const rock = makeRock(THREE);
  scene.add(rock);

  class Helix extends THREE.Curve {
    constructor(turns, r, h) { super(); this.turns = turns; this.r = r; this.h = h; }
    getPoint(t, target = new THREE.Vector3()) {
      const a = this.turns * Math.PI * 2 * t;
      return target.set(this.r * Math.cos(a), this.h * (t - 0.5), this.r * Math.sin(a));
    }
  }
  const wireGeo = new THREE.TubeGeometry(new Helix(9, 0.9, 1.5), 500, 0.12, 14, false);
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xc8743a, roughness: 0.22, metalness: 0.95, transparent: true });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.78, 1.5, 40),
    new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.55, metalness: 0.2, transparent: true })
  );
  const spool = new THREE.Group();
  spool.add(wire); spool.add(core);
  spool.scale.setScalar(0.001);
  scene.add(spool);

  return {
    rock, spool,
    update(frame) {
      const t = frame / N;
      const out = smooth(rockOut[0], rockOut[1], t);
      rock.material.opacity = 1 - out;
      rock.scale.setScalar(1 - out * 0.55);
      rock.rotation.y = t * Math.PI * 1.3;
      rock.visible = rock.material.opacity > 0.02;

      const grow = smooth(spoolIn[0], spoolIn[1], t);
      spool.scale.setScalar(0.001 + grow);
      wire.material.opacity = grow;
      core.material.opacity = grow;
      spool.rotation.y = t * Math.PI * 2.2;
      spool.visible = grow > 0.01;
    }
  };
}
