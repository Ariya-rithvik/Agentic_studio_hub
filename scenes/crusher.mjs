// Step 2 — Crusher (standalone scene).
import { buildCrusher } from './lib/crusher.mjs';

export const meta = { id: 'crusher', frames: 120, fps: 30, width: 960, height: 600, bg: '#ffffff' };

export function create(THREE, ctx) {
  ctx.frames = meta.frames;
  const c = buildCrusher(THREE, ctx);
  return { update: (f) => c.update(f) };
}
