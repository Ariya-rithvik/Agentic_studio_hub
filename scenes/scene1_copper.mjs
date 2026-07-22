// M2 — Scene 1 fully composited: the ore->wire morph (3D) + the overlay layer
// (radial step hub, a callout line tracking the rock, and a count-up counter
// that locks at EXACTLY "0.5%"). Demonstrates 3D + data-accurate overlays
// composed from a small declarative spec — the pattern M3 will auto-generate.
import { buildMorph } from './lib/morph.mjs';
import { createOverlay, countUp } from './lib/overlay.mjs';

export const meta = { id: 'scene1_copper', frames: 96, fps: 30, width: 960, height: 600, bg: '#ffffff' };

export function create(THREE, ctx) {
  ctx.frames = meta.frames;

  // 3D: dissolve the rock a little later so the counter can lock while it's visible.
  const morph = buildMorph(THREE, ctx, { rockOut: [0.50, 0.72], spoolIn: [0.58, 0.90] });

  // Overlays
  const ov = createOverlay(THREE, ctx);

  ov.hub({
    cx: meta.width - 96, cy: 96, r: 56,
    steps: ['MINING', 'CRUSH', 'FLOAT', 'SMELT', 'CONVERT', 'REFINE'],
    active: () => 0   // Scene 1 = step 1
  });

  const co = ov.callout({
    anchor3D: () => new THREE.Vector3(0.95, 0.65, 0),
    dx: 168, dy: -46,
    drawStart: 14, drawEnd: 30,
    fadeStart: 64, fadeEnd: 80,
    render: (f) =>
      '<div style="font-size:11px;color:#9aa0a6;font-weight:700;letter-spacing:1.5px;">COPPER GRADE</div>' +
      `<div style="font-size:28px;font-weight:800;color:#23262b;line-height:1.05;">${countUp(f, { start: 30, lock: 52, value: 0.5, decimals: 1 })}%</div>`
  });

  return {
    update(frame) { morph.update(frame); ov.update(frame); },
    // Probe used by test_scene.mjs to assert the counter locks at exactly "0.5%".
    probe() { return { counter: co.box.textContent.replace(/\s+/g, ' ').trim() }; }
  };
}
