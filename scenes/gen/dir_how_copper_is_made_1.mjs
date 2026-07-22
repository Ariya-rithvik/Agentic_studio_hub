export const meta = { 
  id: "dir_how_copper_is_made_1", 
  frames: 90, 
  fps: 30, 
  width: 960, 
  height: 600, 
  bg: "#0e0f14" 
};

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  camera.position.z = 5;
  camera.far = 1e7;
  camera.updateProjectionMatrix();

  const tankGeometry = new THREE.BoxGeometry(4, 4, 4);
  const tankMaterial = new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.5, color: 0x444444 });
  const tank = new THREE.Mesh(tankGeometry, tankMaterial);
  scene.add(tank);

  const copperOreGeometry = new THREE.SphereGeometry(0.1, 32, 32);
  const copperOreMaterial = new THREE.MeshStandardMaterial({ metalness: 0.8, roughness: 0.2, color: 0xff9900 });
  const copperOres = [];
  for (let i = 0; i < 50; i++) {
    const copperOre = new THREE.Mesh(copperOreGeometry, copperOreMaterial);
    copperOre.position.x = Math.sin(i * 0.1) * 2;
    copperOre.position.y = Math.cos(i * 0.1) * 2;
    copperOre.position.z = Math.sin(i * 0.2) * 2;
    scene.add(copperOre);
    copperOres.push(copperOre);
  }

  const bubbleGeometry = new THREE.SphereGeometry(0.05, 32, 32);
  const bubbleMaterial = new THREE.MeshStandardMaterial({ metalness: 0.2, roughness: 0.8, color: 0xffffff, transparent: true, opacity: 0.5 });
  const bubbles = [];
  for (let i = 0; i < 20; i++) {
    const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
    bubble.position.x = Math.sin(i * 0.2) * 2;
    bubble.position.y = -2;
    bubble.position.z = Math.cos(i * 0.2) * 2;
    scene.add(bubble);
    bubbles.push(bubble);
  }

  const copperMineralGeometry = new THREE.SphereGeometry(0.01, 32, 32);
  const copperMineralMaterial = new THREE.MeshStandardMaterial({ metalness: 0.8, roughness: 0.2, color: 0xff9900 });
  const copperMinerals = [];
  for (let i = 0; i < 10; i++) {
    const copperMineral = new THREE.Mesh(copperMineralGeometry, copperMineralMaterial);
    copperMineral.position.x = Math.sin(i * 0.1) * 2;
    copperMineral.position.y = -2;
    copperMineral.position.z = Math.cos(i * 0.1) * 2;
    scene.add(copperMineral);
    copperMinerals.push(copperMineral);
  }

  return {
    update(frame) {
      const t = frame / meta.frames;
      camera.position.x = Math.sin(t * 0.1) * 2;
      camera.position.z = 5 + Math.cos(t * 0.1) * 2;
      for (let i = 0; i < copperOres.length; i++) {
        copperOres[i].position.y = Math.cos(t * 0.1 + i * 0.1) * 2;
      }
      for (let i = 0; i < bubbles.length; i++) {
        bubbles[i].position.y = -2 + Math.sin(t * 0.1 + i * 0.1) * 2;
      }
      for (let i = 0; i < copperMinerals.length; i++) {
        copperMinerals[i].position.y = -2 + Math.cos(t * 0.1 + i * 0.1) * 2;
        copperMinerals[i].position.x = Math.sin(t * 0.1 + i * 0.1) * 0.1 + bubbles[i % bubbles.length].position.x;
      }
    }
  };
}
