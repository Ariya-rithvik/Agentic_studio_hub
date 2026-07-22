export const meta = { 
  id: "a_single_large_red_ball_resting_bouncing", 
  frames: 90, 
  fps: 30, 
  width: 960, 
  height: 600, 
  bg: "#ffffff" 
};

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x808080, metalness: 0.5, roughness: 0.5 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(2, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.5, roughness: 0.5 })
  );
  ball.position.set(0, 2, 0);
  scene.add(ball);

  const light1 = new THREE.DirectionalLight(0xffffff, 1);
  light1.position.set(5, 10, 5);
  scene.add(light1);

  const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
  light2.position.set(-5, -10, -5);
  scene.add(light2);

  return {
    update(frame) {
      const t = frame / meta.frames;     // 0..1 over the loop
      const easedT = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      ball.position.y = 2 + Math.sin(easedT * Math.PI * 2) * 1.5;
    }
  };
}
