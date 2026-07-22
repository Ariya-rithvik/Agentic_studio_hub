// lottie — plays ANY Lottie/Bodymovin animation (the format After Effects
// exports to) deterministically: our frame index maps to the animation's frame
// via goToAndStop, so AE-authored motion becomes a first-class VERA scene.
// Unlocks the LottieFiles library (Lottie Simple License — free commercial use)
// and anything a designer hands us. Config: /data/lottie/<name>.json
//   { file: "/assets/lottie/x.json", frames, width, height, bg, fit }
import lottie from 'lottie-web';

const cache = new Map();
const nameOf = () => new URLSearchParams(location.search).get('lottie') || 'demo';
async function load(name) {
  if (!cache.has(name)) { const r = await fetch(`/data/lottie/${name}.json?t=` + Date.now()); cache.set(name, r.ok ? await r.json() : {}); }
  return cache.get(name);
}
export async function getMeta() {
  const d = await load(nameOf());
  return { id: 'lottie:' + nameOf(), frames: d.frames || 150, fps: d.fps || 30, width: d.width || 1280, height: d.height || 720, bg: d.bg || '#ffffff' };
}

export function create(THREE, ctx) {
  const { scene, width: W, height: H } = ctx;
  const d = cache.get(nameOf()) || {};
  scene.background = new THREE.Color(d.bg || '#ffffff');

  const o = ctx.overlayRoot; o.innerHTML = '';
  const box = document.createElement('div');
  box.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;`;
  o.appendChild(box);
  const holder = document.createElement('div');
  holder.style.cssText = `width:${Math.round(H * (d.fit || 0.9))}px;height:${Math.round(H * (d.fit || 0.9))}px;`;
  box.appendChild(holder);

  let anim = null;
  const ready = new Promise((resolve) => {
    anim = lottie.loadAnimation({
      container: holder, renderer: 'svg', loop: false, autoplay: false,
      path: d.file || '/assets/lottie/demo.json'
    });
    anim.addEventListener('DOMLoaded', () => { anim.goToAndStop(0, true); resolve(); });
    anim.addEventListener('data_failed', () => resolve());
  });

  const N = d.frames || 150;
  return {
    ready,
    update(frame) {
      if (!anim || !anim.totalFrames) return;
      const lf = (frame / Math.max(1, N - 1)) * (anim.totalFrames - 1);
      anim.goToAndStop(lf, true);                          // exact-frame seek = deterministic
    }
  };
}
