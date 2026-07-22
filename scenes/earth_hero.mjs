// Cinematic Earth — the "use high-quality real images" approach, layered like a
// motion designer would: real day map + rotating clouds + atmosphere rim glow +
// night-side city lights + a warm sun flare + a real Milky Way background.
// Deterministic; assets awaited via `ready`.
export const meta = { id: 'earth_hero', frames: 180, fps: 30, width: 1280, height: 720, bg: '#000006' };

function glowTexture(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,244,224,1)');
  grad.addColorStop(0.3, 'rgba(255,205,130,0.55)');
  grad.addColorStop(1, 'rgba(255,180,80,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function create(THREE, ctx) {
  const { scene, camera } = ctx;
  scene.background = new THREE.Color('#000006');
  camera.position.set(0, 0.25, 3.3);
  camera.lookAt(0, 0, 0);
  camera.far = 3000; camera.updateProjectionMatrix();   // so the distant Milky Way sphere isn't clipped

  scene.add(new THREE.AmbientLight(0x335577, 0.30));
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.0); sun.position.set(5, 1.5, 2.5); scene.add(sun);

  // Milky Way background (inverted sphere)
  const bg = new THREE.Mesh(new THREE.SphereGeometry(400, 60, 40), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0x1a2433 }));
  scene.add(bg);

  // Earth (day + night-lights emissive)
  const earthMat = new THREE.MeshStandardMaterial({ color: 0x223a5a, roughness: 1.0, metalness: 0.0 });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1.3, 96, 96), earthMat);
  earth.rotation.z = 0.41; scene.add(earth);

  // Clouds layer (slightly larger, transparent, rotates a touch faster)
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, roughness: 1.0 });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.315, 96, 96), cloudMat);
  clouds.rotation.z = 0.41; scene.add(clouds);

  // Atmosphere rim glow (additive back-side shell)
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.46, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x3a86ff, transparent: true, opacity: 0.28, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(atmo);

  // Warm sun flare (upper-right, off the globe)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  glow.scale.set(9, 9, 1); glow.position.set(3.4, 1.5, -1); scene.add(glow);

  // textures (awaited before first frame)
  const loader = new THREE.TextureLoader();
  const load = (u, srgb = true) => new Promise((res) => loader.load(u, (t) => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; res(t); }, undefined, () => res(null)));
  const ready = (async () => {
    const [day, night, cloud, mw] = await Promise.all([
      load('/assets/earth.jpg'), load('/assets/earth_night.png'), load('/assets/earth_clouds.png', false), load('/assets/milkyway.jpg')
    ]);
    if (day) { earthMat.map = day; earthMat.color.set(0xffffff); }
    if (night) { earthMat.emissiveMap = night; earthMat.emissive.set(0xffffff); earthMat.emissiveIntensity = 0.55; }
    earthMat.needsUpdate = true;
    if (cloud) { cloudMat.alphaMap = cloud; cloudMat.needsUpdate = true; }
    if (mw) { bg.material.map = mw; bg.material.color.set(0xffffff); bg.material.needsUpdate = true; }
  })();

  const N = meta.frames;
  return {
    ready,
    update(frame) {
      const t = frame / N;
      earth.rotation.y = t * Math.PI * 0.55;
      clouds.rotation.y = t * Math.PI * 0.55 + t * 0.12;   // clouds drift slightly faster
    }
  };
}
