export const meta = { id: "two_tall_cylindrical_water_storage_tanks", frames: 120, fps: 30, width: 960, height: 600, bg: "#ffffff" };export function create(THREE, ctx) {
const { scene, camera } = ctx;
camera.position.set(0, 3, 10);
camera.lookAt(0, 3, 0);const ambient = new THREE.AmbientLight(0xffffff, 0.8);
const directional = new THREE.DirectionalLight(0xffffff, 1.2);
directional.position.set(5, 10, 7);
scene.add(ambient, directional);const tankMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.1, roughness: 0.2 });
const waterMat = new THREE.MeshBasicMaterial({ color: 0x3498db });
const pipeMat = new THREE.MeshStandardMaterial({ color: 0x999999 });const createTank = (x, label) => {
const group = new THREE.Group();
const tankGeo = new THREE.CylinderGeometry(1.2, 1.2, 6, 32);
const tank = new THREE.Mesh(tankGeo, tankMat);
tank.position.y = 3;
group.add(tank);const waterGeo = new THREE.CylinderGeometry(1.15, 1.15, 6, 32);
const water = new THREE.Mesh(waterGeo, waterMat);
water.position.y = 3;
group.add(water);
group.position.x = x;

const labelGeo = new THREE.PlaneGeometry(1.5, 0.5);
const labelMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
const labelMesh = new THREE.Mesh(labelGeo, labelMat);
labelMesh.position.set(x, 5.5, 1.25);
scene.add(labelMesh);

return { water };
};const tank1 = createTank(-3, "TANK 1");
const tank2 = createTank(3, "TANK 2");const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.8, 16), pipeMat);
pipe.rotation.z = Math.PI / 2;
pipe.position.set(0, 0.5, 0);
scene.add(pipe);const flow = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.8, 16), waterMat);
flow.rotation.z = Math.PI / 2;
flow.position.set(0, 0.5, 0);
scene.add(flow);return {
update(frame) {
const t = frame / meta.frames;
const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;  const level1 = 1 - eased;
  const level2 = eased;

  tank1.water.scale.set(1, level1, 1);
  tank1.water.position.y = 0.05 + (level1 * 6) / 2;
  
  tank2.water.scale.set(1, level2, 1);
  tank2.water.position.y = 0.05 + (level2 * 6) / 2;

  flow.visible = (eased > 0.02 && eased < 0.98);
  flow.material.opacity = 1 - Math.abs(eased - 0.5) * 2;
  flow.material.transparent = true;
}
};
}
