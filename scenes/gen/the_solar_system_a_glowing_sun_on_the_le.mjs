export const meta = { 
  id: "the_solar_system_a_glowing_sun_on_the_le", 
  frames: 90, 
  fps: 30, 
  width: 960, 
  height: 600, 
  bg: "#0e0f14" 
};

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9900 })
  );
  sun.position.x = -200;
  scene.add(sun);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0x2233ff, metalness: 0.5, roughness: 0.5 })
  );
  earth.position.x = 100;
  scene.add(earth);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(5, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.5, roughness: 0.5 })
  );
  moon.position.x = 120;
  scene.add(moon);

  const hash = (i) => {
    const x = Math.sin(i * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };

  const starfield = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, color: 0xffffff })
  );
  const positions = new Float32Array(2000 * 3);
  for (let i = 0; i < 2000; i++) {
    const radius = 500 + hash(i * 11) * 1000;
    const angle = hash(i * 13) * 6.283;
    const z = hash(i * 17) * 1000 - 500;
    positions[i * 3] = radius * Math.cos(angle);
    positions[i * 3 + 1] = radius * Math.sin(angle);
    positions[i * 3 + 2] = z;
  }
  starfield.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  scene.add(starfield);

  camera.far = 1e7;
  camera.updateProjectionMatrix();
  camera.position.z = 300;

  return {
    update(frame) {
      const t = frame / meta.frames;     // 0..1 over the loop
      earth.rotation.y = t * 6.283;
      moon.position.x = 100 + 30 * Math.cos(t * 6.283 * 2);
      moon.position.z = 30 * Math.sin(t * 6.283 * 2);
      camera.position.x = -100 + 200 * t;
      camera.position.z = 300 + 100 * t;
    }
  };
}
