export const meta = { id: "a_single_red_ball_bouncing_up_and_down_o", frames: 90, fps: 30, width: 960, height: 600, bg: "#ffffff" };

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  const floorGeometry = new THREE.PlaneGeometry(10, 10);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.5 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ballGeometry = new THREE.SphereGeometry(1, 32, 32);
  const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0, roughness: 0.5 });
  const ball = new THREE.Mesh(ballGeometry, ballMaterial);
  ball.position.y = 2;
  scene.add(ball);

  const light1 = new THREE.DirectionalLight(0xffffff, 1);
  light1.position.set(5, 5, 5);
  scene.add(light1);

  const light2 = new THREE.DirectionalLight(0xffffff, 1);
  light2.position.set(-5, -5, -5);
  scene.add(light2);

  return {
    update(frame) {
      const t = frame / meta.frames;
      const bounce = Math.sin(t * Math.PI * 2) * 2;
      ball.position.y = 2 + bounce;
    }
  };
}
