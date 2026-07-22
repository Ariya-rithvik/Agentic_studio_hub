// Standard easing + timing vocabulary for VERA.
// PACING STANDARD: ~90-120 frames per "beat" at 30fps (3-4s), and EASE all
// motion (ease-in-out) — never linear snaps. Shared by scenes + AI-authored shots
// so everything feels like a motion designer made it.
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
export const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeInOutSine = (x) => -(Math.cos(Math.PI * clamp01(x)) - 1) / 2;
export const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
