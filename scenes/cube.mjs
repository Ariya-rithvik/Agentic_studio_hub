// M0 proof scene: a calmly spinning cube.
// Scene contract: export `meta` (render config) and `create(THREE, ctx)`,
// which returns an object with `update(frame, fps)` — a pure function of frame.
// Pacing: one smooth rotation over ~3s (the standard beat), not a fast spin.
import { easeInOutSine } from './lib/ease.mjs';

export const meta = { id: 'cube', frames: 90, fps: 30, width: 640, height: 480, bg: '#0e0e14' };

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  camera.position.set(0, 0, 4);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 4, 5);
  scene.add(key);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.5, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xff7a18, metalness: 0.35, roughness: 0.4 })
  );
  scene.add(mesh);

  const N = meta.frames;
  return {
    update(frame) {
      const t = frame / N;                       // 0..1 over the loop
      const e = easeInOutSine(t);                // smooth start/stop
      mesh.rotation.y = e * Math.PI * 2;         // one calm, eased rotation
      mesh.rotation.x = Math.sin(t * Math.PI) * 0.35;  // gentle bob, returns home
    }
  };
}
