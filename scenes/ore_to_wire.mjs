// M1 — pure-3D morph (no overlays). Thin wrapper over the reusable morph builder.
import { buildMorph } from './lib/morph.mjs';

export const meta = { id: 'ore_to_wire', frames: 60, fps: 30, width: 960, height: 600, bg: '#ffffff' };

export function create(THREE, ctx) {
  ctx.frames = meta.frames;
  const morph = buildMorph(THREE, ctx);
  return { update: (f) => morph.update(f) };
}
