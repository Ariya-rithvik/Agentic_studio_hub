export const meta = { 
  id: "a_minimalist_glowing_green_eye_on_a_pure", 
  frames: 90, 
  fps: 30, 
  width: 960, 
  height: 600, 
  bg: "#ffffff" 
};

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  camera.position.z = 5;

  const eyeGeometry = new THREE.SphereGeometry(1, 64, 64);
  const irisGeometry = new THREE.SphereGeometry(0.4, 64, 64);
  const pupilGeometry = new THREE.SphereGeometry(0.1, 64, 64);
  const eyelidGeometry = new THREE.PlaneGeometry(2, 0.2);

  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.5 });
  const irisMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, metalness: 0.5, roughness: 0.5, emissive: 0x00ff00 });
  const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.5, roughness: 0.5 });
  const eyelidMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.5 });

  const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  const iris = new THREE.Mesh(irisGeometry, irisMaterial);
  const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  const eyelid1 = new THREE.Mesh(eyelidGeometry, eyelidMaterial);
  const eyelid2 = new THREE.Mesh(eyelidGeometry, eyelidMaterial);

  eye.position.y = 0.2;
  iris.position.y = 0.2;
  pupil.position.y = 0.2;
  eyelid1.position.y = 0.6;
  eyelid2.position.y = -0.4;

  scene.add(eye);
  scene.add(iris);
  scene.add(pupil);
  scene.add(eyelid1);
  scene.add(eyelid2);

  const pointLight = new THREE.PointLight(0xffffff, 1, 100);
  pointLight.position.set(2, 2, 2);
  scene.add(pointLight);

  return {
    update(frame) {
      const t = frame / meta.frames;
      const ease = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);

      iris.rotation.y = Math.sin(t * Math.PI * 2) * 0.5;
      eye.rotation.x = Math.sin(t * Math.PI * 2) * 0.1;

      if (t < 0.3) {
        eyelid1.position.y = 0.6;
        eyelid2.position.y = -0.4;
      } else if (t < 0.4) {
        eyelid1.position.y = 0.2;
        eyelid2.position.y = -0.4;
      } else if (t < 0.5) {
        eyelid1.position.y = 0.2;
        eyelid2.position.y = 0.2;
      } else if (t < 0.6) {
        eyelid1.position.y = 0.6;
        eyelid2.position.y = 0.2;
      } else {
        eyelid1.position.y = 0.6;
        eyelid2.position.y = -0.4;
      }

      camera.position.z = 5;
      camera.lookAt(0, 0, 0);
    }
  };
}
