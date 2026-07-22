export const meta = { 
  id: "a_person_riding_a_bicycle_from_the_side_", 
  frames: 90, 
  fps: 30, 
  width: 960, 
  height: 600, 
  bg: "#ffffff" 
};

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  const geometry = new THREE.BoxGeometry(0.5, 1.5, 0.5);
  const material = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.1, roughness: 0.1 });
  const person = new THREE.Mesh(geometry, material);
  scene.add(person);
  person.position.y = 0.5;

  const wheelGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 32);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.1, roughness: 0.1 });
  const wheel1 = new THREE.Mesh(wheelGeometry, wheelMaterial);
  const wheel2 = new THREE.Mesh(wheelGeometry, wheelMaterial);
  scene.add(wheel1);
  scene.add(wheel2);
  wheel1.position.set(-0.25, 0.1, 0);
  wheel2.position.set(0.25, 0.1, 0);

  const pedalGeometry = new THREE.BoxGeometry(0.05, 0.1, 0.05);
  const pedalMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.1, roughness: 0.1 });
  const pedal1 = new THREE.Mesh(pedalGeometry, pedalMaterial);
  const pedal2 = new THREE.Mesh(pedalGeometry, pedalMaterial);
  scene.add(pedal1);
  scene.add(pedal2);
  pedal1.position.set(-0.25, 0.2, 0);
  pedal2.position.set(0.25, 0.2, 0);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(light);
  light.position.set(1, 2, 1);

  camera.position.z = 5;

  return {
    update(frame) {
      const t = frame / meta.frames;     // 0..1 over the loop
      const easedT = t * t * (3 - 2 * t);
      person.position.x = -2 + 4 * easedT;
      wheel1.rotation.z = t * 6.283 * 2;
      wheel2.rotation.z = t * 6.283 * 2;
      pedal1.rotation.x = Math.sin(t * 6.283 * 2) * 0.1;
      pedal2.rotation.x = Math.sin(t * 6.283 * 2 + 3.14159) * 0.1;
      camera.position.x = -2 + 4 * easedT + (person.position.x - camera.position.x) * 0.1;
      camera.position.z = 5 + (0 - camera.position.z) * 0.1;
      camera.lookAt(person.position);
    }
  };
}
