// Sun–Earth–Moon with REAL texture images (the way a motion designer does it).
// The Earth is textured and lit by the Sun as a point light, so the day side shows
// continents and the night side goes dark — a real terminator that sweeps as it
// spins. Moon orbits; deterministic starfield. Assets load via `ready` (awaited).
export const meta = { id: 'sun_earth_moon', frames: 120, fps: 30, width: 960, height: 600, bg: '#05060a' };

const hash = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  scene.background = new THREE.Color('#05060a');
  camera.position.set(0, 1.0, 10);
  camera.lookAt(0.6, 0, 0);

  scene.add(new THREE.AmbientLight(0x223247, 0.22));   // faint fill so night side isn't pure black

  // Sun (left): self-lit textured sphere + additive glow halo + the light source
  const sunPos = new THREE.Vector3(-6.2, 0.6, -1.5);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.7, 48, 48), new THREE.MeshBasicMaterial({ color: 0xffcc66 }));
  sun.position.copy(sunPos); scene.add(sun);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.copy(sunPos); scene.add(halo);
  const sunLight = new THREE.PointLight(0xfff2e0, 3.2, 0, 0); sunLight.position.copy(sunPos); scene.add(sunLight);

  // Earth: textured, tilted, lit by the sun -> day/night terminator
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1.35, 64, 64),
    new THREE.MeshStandardMaterial({ color: 0x335577, roughness: 1.0, metalness: 0.0 }));
  earth.position.set(1.6, 0, 0); earth.rotation.z = 0.41; scene.add(earth);

  // Moon: textured, orbiting Earth
  const moonPivot = new THREE.Group(); moonPivot.position.copy(earth.position); scene.add(moonPivot);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.37, 48, 48),
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 1.0 }));
  moon.position.set(2.7, 0, 0); moonPivot.add(moon);

  // deterministic starfield
  const cnt = 1600, p = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) {
    const r = 70, th = hash(i) * Math.PI * 2, ph = Math.acos(2 * hash(i + 7) - 1);
    p[i*3] = r*Math.sin(ph)*Math.cos(th); p[i*3+1] = r*Math.cos(ph); p[i*3+2] = r*Math.sin(ph)*Math.sin(th);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.1, sizeAttenuation: false, color: 0xffffff })));

  // textures (awaited by the harness before the first frame)
  const loader = new THREE.TextureLoader();
  const load = (u) => new Promise((res) => loader.load(u, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null)));
  const ready = (async () => {
    const [e, m, s] = await Promise.all([load('/assets/earth.jpg'), load('/assets/moon.jpg'), load('/assets/sun.jpg')]);
    if (e) { earth.material.map = e; earth.material.color.set(0xffffff); earth.material.needsUpdate = true; }
    if (m) { moon.material.map = m; moon.material.color.set(0xffffff); moon.material.needsUpdate = true; }
    if (s) { sun.material.map = s; sun.material.color.set(0xffffff); sun.material.needsUpdate = true; }
  })();

  const N = meta.frames;
  return {
    ready,
    update(frame) {
      const t = frame / N;
      earth.rotation.y = t * Math.PI * 4;      // spins -> day/night sweeps across continents
      moonPivot.rotation.y = t * Math.PI * 2;  // moon orbits earth
      moon.rotation.y = t * Math.PI * 2;
    }
  };
}
