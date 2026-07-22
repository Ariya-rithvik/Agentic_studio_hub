// Generic storyboard runner — the "ask for anything" core.
// Reads /stories/<name>.json (?story=<name>), builds the 3D shot from the shot
// registry, and instantiates overlays from declarative specs. No hand-written
// scene code: the same runner renders any storyboard.
import { SHOTS } from './lib/shots.mjs';
import { createOverlay, countUp } from './lib/overlay.mjs';

const cache = new Map();
const storyName = () => new URLSearchParams(location.search).get('story') || 'copper';

async function load(name) {
  if (!cache.has(name)) {
    const res = await fetch(`/stories/${name}.story.json`);
    if (!res.ok) throw new Error(`storyboard not found: ${name}`);
    cache.set(name, await res.json());
  }
  return cache.get(name);
}

// Harness awaits this to size the render before create().
export async function getMeta() {
  const m = (await load(storyName())).meta || {};
  return {
    id: 'story:' + storyName(),
    frames: m.frames || 90, fps: m.fps || 30,
    width: m.width || 960, height: m.height || 600, bg: m.bg || '#ffffff'
  };
}

function counterMarkup(spec, f) {
  const num = countUp(f, { start: spec.countStart, lock: spec.countLock, value: spec.value, decimals: spec.decimals ?? 0 });
  return `<div style="font-size:11px;color:#9aa0a6;font-weight:700;letter-spacing:1.5px;">${spec.label || ''}</div>` +
         `<div style="font-size:28px;font-weight:800;color:#23262b;line-height:1.05;">${num}${spec.unit || ''}</div>`;
}

export function create(THREE, ctx) {
  const sb = cache.get(storyName());

  const shotDef = sb.shot || {};
  const build = SHOTS[shotDef.type];
  if (!build) throw new Error('unknown shot type: ' + shotDef.type);
  const shot = build(THREE, ctx, shotDef.params || {});

  const ov = createOverlay(THREE, ctx);
  const counters = [];
  for (const s of (sb.overlays || [])) {
    if (s.type === 'hub') {
      ov.hub({ cx: s.cx, cy: s.cy, r: s.r, steps: s.steps, active: () => s.active || 0 });
    } else if (s.type === 'counter_callout') {
      const ref = ov.callout({
        anchor3D: () => new THREE.Vector3(s.anchor[0], s.anchor[1], s.anchor[2]),
        dx: s.dx, dy: s.dy, color: s.color,
        drawStart: s.drawStart, drawEnd: s.drawEnd, fadeStart: s.fadeStart, fadeEnd: s.fadeEnd,
        render: (f) => counterMarkup(s, f)
      });
      counters.push(ref);
    }
  }

  return {
    update(frame) { shot.update(frame); ov.update(frame); },
    probe() { return { counter: counters.length ? counters[0].box.textContent.replace(/\s+/g, ' ').trim() : null }; }
  };
}
