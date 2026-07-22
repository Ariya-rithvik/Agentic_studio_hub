export const meta = { id: "s_enh_1_1", frames: 120, fps: 30, width: 960, height: 600, bg: "#ffffff" };export function create(THREE, ctx) {
const { scene, camera } = ctx;
camera.position.set(0, 0, 8);
camera.lookAt(0, 0, 0);const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);const group = new THREE.Group();
scene.add(group);const waveGeom = new THREE.BufferGeometry();
const count = 100;
const positions = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
positions[i * 3] = (i / count) * 6 - 3;
positions[i * 3 + 1] = 0;
positions[i * 3 + 2] = 0;
}
waveGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const waveMat = new THREE.LineBasicMaterial({ color: 0x4488ff, linewidth: 2 });
const waveform = new THREE.Line(waveGeom, waveMat);
group.add(waveform);const nodes = [];
const nodeMat = new THREE.MeshStandardMaterial({ color: 0xff4444, metalness: 0.5, roughness: 0.2 });
const nodeGeo = new THREE.SphereGeometry(0.2, 16, 16);
for (let i = 0; i < 14; i++) {
const mesh = new THREE.Mesh(nodeGeo, nodeMat);
const angle = (i / 14) * Math.PI * 2;
mesh.position.set(Math.cos(angle) * 2, Math.sin(angle) * 2, 0);
group.add(mesh);
nodes.push(mesh);
}const lineMat = new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.3 });
const lines = [];
for (let i = 0; i < 14; i++) {
const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), nodes[i].position]);
const line = new THREE.Line(geom, lineMat);
group.add(line);
lines.push(line);
}return {
update(frame) {
const t = frame / meta.frames;
const easedT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;  const pos = waveform.geometry.attributes.position;
  for (let i = 0; i < count; i++) {
    const x = (i / count) * 6 - 3;
    pos.setY(i, Math.sin(x * 3 + t * 6.28) * Math.sin(easedT * 3.14) * 0.5);
  }
  pos.needsUpdate = true;

  group.rotation.y = easedT * Math.PI * 0.5;
  group.scale.setScalar(0.5 + easedT * 0.5);

  nodes.forEach((node, i) => {
    const scale = 0.5 + Math.sin(t * 10 + i) * 0.2;
    node.scale.set(scale, scale, scale);
    node.material.color.setHSL(0.6 + easedT * 0.3, 0.8, 0.5);
  });
}
};
}
