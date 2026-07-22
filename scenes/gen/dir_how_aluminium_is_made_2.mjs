export const meta = { 
  id: "dir_how_aluminium_is_made_2", 
  frames: 90, 
  fps: 30, 
  width: 960, 
  height: 600, 
  bg: "#ffffff" 
};

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  camera.position.z = 5;

  const calendar = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.5 })
  );
  scene.add(calendar);

  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 2, 32),
    new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0, roughness: 0.5 })
  );
  bottle.position.z = -2;
  bottle.position.y = -1.5;
  scene.add(bottle);

  const leaves = [];
  for (let i = 0; i < 100; i++) {
    const leaf = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xff9900, metalness: 0, roughness: 0.5 })
    );
    leaf.position.x = Math.sin(i * 0.1) * 2;
    leaf.position.y = Math.cos(i * 0.1) * 2;
    leaf.position.z = -2;
    leaves.push(leaf);
    scene.add(leaf);
  }

  const light1 = new THREE.PointLight(0xffffff, 1, 10);
  light1.position.set(2, 2, 2);
  scene.add(light1);

  const light2 = new THREE.PointLight(0xffffff, 1, 10);
  light2.position.set(-2, -2, -2);
  scene.add(light2);

  return {
    update(frame) {
      const t = frame / meta.frames;

      calendar.position.y = Math.sin(t * Math.PI * 2) * 0.5;
      calendar.rotation.y = t * Math.PI * 2;

      bottle.scale.y = 1 - t * 0.5;
      bottle.position.y = -1.5 + t * 0.5;

      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i];
        leaf.position.y = Math.cos(t * Math.PI * 2 + i * 0.1) * 2;
        leaf.position.x = Math.sin(t * Math.PI * 2 + i * 0.1) * 2;
        leaf.rotation.y = t * Math.PI * 2;
      }

      camera.position.x = Math.sin(t * Math.PI * 2) * 1;
      camera.position.y = Math.cos(t * Math.PI * 2) * 1;
      camera.lookAt(calendar.position);
    }
  };
}
