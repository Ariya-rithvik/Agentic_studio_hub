export const meta = { 
  id: "a_cinematic_continuous_zoom_out_start_cl", 
  frames: 90, 
  fps: 30, 
  width: 960, 
  height: 600, 
  bg: "#0e0f14" 
};

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(100, 60, 60),
    new THREE.MeshStandardMaterial({ color: 0xff9900, metalness: 0.5, roughness: 0.5 })
  );
  sun.position.set(0, 0, 0);
  scene.add(sun);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(10, 60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0000ff, metalness: 0.5, roughness: 0.5 })
  );
  earth.position.set(200, 0, 0);
  scene.add(earth);

  const mercury = new THREE.Mesh(
    new THREE.SphereGeometry(2, 60, 60),
    new THREE.MeshStandardMaterial({ color: 0x808080, metalness: 0.5, roughness: 0.5 })
  );
  mercury.position.set(150, 0, 0);
  scene.add(mercury);

  const venus = new THREE.Mesh(
    new THREE.SphereGeometry(6, 60, 60),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.5 })
  );
  venus.position.set(250, 0, 0);
  scene.add(venus);

  const mars = new THREE.Mesh(
    new THREE.SphereGeometry(4, 60, 60),
    new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.5, roughness: 0.5 })
  );
  mars.position.set(300, 0, 0);
  scene.add(mars);

  const jupiter = new THREE.Mesh(
    new THREE.SphereGeometry(20, 60, 60),
    new THREE.MeshStandardMaterial({ color: 0xffff00, metalness: 0.5, roughness: 0.5 })
  );
  jupiter.position.set(500, 0, 0);
  scene.add(jupiter);

  const saturn = new THREE.Mesh(
    new THREE.SphereGeometry(18, 60, 60),
    new THREE.MeshStandardMaterial({ color: 0xffff00, metalness: 0.5, roughness: 0.5 })
  );
  saturn.position.set(700, 0, 0);
  scene.add(saturn);

  const uranus = new THREE.Mesh(
    new THREE.SphereGeometry(12, 60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0000ff, metalness: 0.5, roughness: 0.5 })
  );
  uranus.position.set(900, 0, 0);
  scene.add(uranus);

  const neptune = new THREE.Mesh(
    new THREE.SphereGeometry(10, 60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0000ff, metalness: 0.5, roughness: 0.5 })
  );
  neptune.position.set(1100, 0, 0);
  scene.add(neptune);

  const starfield = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, color: 0xffffff })
  );
  const positions = new Float32Array(2000 * 3);
  for (let i = 0; i < 2000; i++) {
    const h = (i) => {
      const x = Math.sin(i * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };
    positions[i * 3] = h(i) * 1000;
    positions[i * 3 + 1] = h(i + 1000) * 1000;
    positions[i * 3 + 2] = h(i + 2000) * 1000;
  }
  starfield.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  scene.add(starfield);

  const face = new THREE.Mesh(
    new THREE.SphereGeometry(500, 60, 60),
    new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.5, roughness: 0.5 })
  );
  face.position.set(0, 0, -2000);
  scene.add(face);

  camera.far = 1e7;
  camera.updateProjectionMatrix();

  return {
    update(frame) {
      const t = frame / meta.frames;
      const ease = t * t * (3 - 2 * t);
      camera.position.x = THREE.MathUtils.lerp(-200, 0, ease);
      camera.position.y = THREE.MathUtils.lerp(100, 0, ease);
      camera.position.z = THREE.MathUtils.lerp(500, -2000, ease);
      camera.lookAt(0, 0, 0);
    }
  };
}
