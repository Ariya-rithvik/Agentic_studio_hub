export const meta = { 
  id: "dir_how_copper_is_made_2", 
  frames: 90, 
  fps: 30, 
  width: 960, 
  height: 600, 
  bg: "#ffffff" 
};

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  camera.position.z = 500;

  const tankGeometry = new THREE.BoxGeometry(500, 500, 500);
  const tankMaterial = new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.5, color: 0x444444 });
  const tank = new THREE.Mesh(tankGeometry, tankMaterial);
  tank.position.y = -250;
  scene.add(tank);

  const copperGeometry = new THREE.SphereGeometry(20, 20, 20);
  const copperMaterial = new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.2, color: 0xff9900 });
  const coppers = [];
  for (let i = 0; i < 50; i++) {
    const copper = new THREE.Mesh(copperGeometry, copperMaterial);
    copper.position.x = Math.sin(i * 0.1) * 200;
    copper.position.y = Math.cos(i * 0.1) * 200 - 200;
    copper.position.z = Math.sin(i * 0.2) * 200;
    coppers.push(copper);
    scene.add(copper);
  }

  const bubbleGeometry = new THREE.SphereGeometry(10, 10, 10);
  const bubbleMaterial = new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.5, color: 0xffffff, transparent: true, opacity: 0.5 });
  const bubbles = [];
  for (let i = 0; i < 20; i++) {
    const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
    bubble.position.x = Math.sin(i * 0.1) * 200;
    bubble.position.y = -250;
    bubble.position.z = Math.sin(i * 0.2) * 200;
    bubbles.push(bubble);
    scene.add(bubble);
  }

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(0, 0, 500);
  scene.add(light);

  return {
    update(frame) {
      const t = frame / meta.frames;
      for (let i = 0; i < coppers.length; i++) {
        const copper = coppers[i];
        copper.position.y = Math.cos(i * 0.1 + t * 6.283) * 200 - 200;
        copper.position.z = Math.sin(i * 0.2 + t * 6.283) * 200;
      }
      for (let i = 0; i < bubbles.length; i++) {
        const bubble = bubbles[i];
        bubble.position.y = Math.sin(i * 0.1 + t * 6.283) * 200 - 200 + t * 500;
        bubble.position.z = Math.cos(i * 0.2 + t * 6.283) * 200;
        if (t > 0.5) {
          const copper = coppers[i % coppers.length];
          copper.position.x = bubble.position.x;
          copper.position.y = bubble.position.y;
          copper.position.z = bubble.position.z;
        }
      }
      camera.position.x = Math.sin(t * 6.283) * 200;
      camera.position.z = 500 + Math.cos(t * 6.283) * 200;
      camera.lookAt(0, 0, 0);
    }
  };
}
