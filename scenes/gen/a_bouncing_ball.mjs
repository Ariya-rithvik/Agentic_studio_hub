export const meta = { id: "a_bouncing_ball", frames: 90, fps: 30, width: 960, height: 600, bg: "#0e0f14" };

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  camera.position.z = 5;

  const geometry = new THREE.SphereGeometry(1, 32, 32);
  const material = new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.5, color: 0xffffff });
  const ball = new THREE.Mesh(geometry, material);
  scene.add(ball);

  const light1 = new THREE.DirectionalLight(0xffffff, 1);
  light1.position.set(1, 1, 1);
  scene.add(light1);

  const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
  light2.position.set(-1, -1, -1);
  scene.add(light2);

  return {
    update(frame) {
      const t = frame / meta.frames;
      const bounce = Math.sin(t * Math.PI * 2) * 2 - 1;
      ball.position.y = bounce;
    }
  };
}
