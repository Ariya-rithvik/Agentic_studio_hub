export const meta = { 
  id: "a_cinematic_continuous_zoom_out_start_at", 
  frames: 900, 
  fps: 30, 
  width: 1920, 
  height: 1080, 
  bg: "#0e0f14" 
};

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  const tinyHouse = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0xffffff })
  );
  scene.add(tinyHouse);

  const person = new THREE.Mesh(
    new THREE.SphereGeometry(0.01, 32, 32),
    new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0xffffff })
  );
  person.position.set(0, 0.05, 0);
  scene.add(person);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0x0000ff })
  );
  earth.position.set(0, -2, 0);
  scene.add(earth);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(3, 32, 32),
    new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0xffff00 })
  );
  sun.position.set(0, -10, 0);
  scene.add(sun);

  const mercury = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 32, 32),
    new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0x808080 })
  );
  mercury.position.set(4, -10, 0);
  scene.add(mercury);

  const venus = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 32, 32),
    new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0xffffff })
  );
  venus.position.set(6, -10, 0);
  scene.add(venus);

  const mars = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 32, 32),
    new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0xff0000 })
  );
  mars.position.set(8, -10, 0);
  scene.add(mars);

  const jupiter = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0xff8000 })
  );
  jupiter.position.set(12, -10, 0);
  scene.add(jupiter);

  const saturn = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 32, 32),
    new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0xffff00 })
  );
  saturn.position.set(16, -10, 0);
  scene.add(saturn);

  const uranus = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 32),
    new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0x00ffff })
  );
  uranus.position.set(20, -10, 0);
  scene.add(uranus);

  const neptune = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 32, 32),
    new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0x0000ff })
  );
  neptune.position.set(24, -10, 0);
  scene.add(neptune);

  const krishnaFace = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0x000000 })
  );
  krishnaFace.position.set(0, 0, -50);
  scene.add(krishnaFace);

  camera.position.set(0, 0, 0.5);

  return {
    update(frame) {
      const t = frame / meta.frames;
      if (t < 0.1) {
        camera.position.set(0, 0, 0.5);
        camera.lookAt(tinyHouse.position);
      } else if (t < 0.2) {
        camera.position.set(0, 0, 2);
        camera.lookAt(earth.position);
      } else if (t < 0.3) {
        camera.position.set(0, 0, 10);
        camera.lookAt(sun.position);
      } else if (t < 0.4) {
        camera.position.set(0, 0, 50);
        camera.lookAt(sun.position);
      } else if (t < 0.5) {
        camera.position.set(0, 0, 200);
        camera.lookAt(sun.position);
      } else if (t < 0.6) {
        camera.position.set(0, 0, 1000);
        camera.lookAt(sun.position);
      } else if (t < 0.7) {
        camera.position.set(0, 0, 5000);
        camera.lookAt(krishnaFace.position);
      } else if (t < 0.8) {
        camera.position.set(0, 0, 20000);
        camera.lookAt(krishnaFace.position);
      } else if (t < 0.9) {
        camera.position.set(0, 0, 100000);
        camera.lookAt(krishnaFace.position);
      } else {
        camera.position.set(0, 0, -20);
        camera.lookAt(krishnaFace.position);
      }
    }
  };
}
