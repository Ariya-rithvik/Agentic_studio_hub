export const meta = { 
  id: "dir_how_copper_is_made_4", 
  frames: 90, 
  fps: 30, 
  width: 960, 
  height: 600, 
  bg: "#ffffff" 
};

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  camera.position.z = 200;

  const copperColor = new THREE.Color(0xff9900);
  const copperMaterial = new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.2, color: copperColor });

  const copperMolten = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 32), copperMaterial);
  copperMolten.position.y = -50;
  scene.add(copperMolten);

  const copperWire = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 200, 32), copperMaterial);
  copperWire.position.y = 50;
  scene.add(copperWire);

  const electrolyticRefining = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 32), new THREE.MeshStandardMaterial({ metalness: 0.8, roughness: 0.1, color: 0xffffff }));
  electrolyticRefining.position.x = -100;
  scene.add(electrolyticRefining);

  const light1 = new THREE.DirectionalLight(0xffffff, 1);
  light1.position.set(100, 100, 100);
  scene.add(light1);

  const light2 = new THREE.DirectionalLight(0xffffff, 1);
  light2.position.set(-100, -100, -100);
  scene.add(light2);

  return {
    update(frame) {
      const t = frame / meta.frames;

      copperMolten.scale.y = 1 - t * 2;
      copperMolten.position.y = -50 + t * 100;

      copperWire.scale.x = t;
      copperWire.scale.z = t;
      copperWire.position.y = 50 + t * 50;

      electrolyticRefining.position.x = -100 + t * 200;
      electrolyticRefining.scale.x = 1 - t;

      camera.position.z = 200 + t * 100;
      camera.position.x = t * 50;
    }
  };
}
