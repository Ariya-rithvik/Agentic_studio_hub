// Chart scene — renders an animated bar chart from /data/charts/<name>.json.
// Used standalone (chart:<name>) so its own labels aren't cleared by the story
// runner's overlay. Config: { frames, title, cats, vals, unit, color }.
import { buildChart } from './lib/chartlib.mjs';

const cache = new Map();
const chartName = () => new URLSearchParams(location.search).get('chart') || 'demo';

async function load(name) {
  if (!cache.has(name)) {
    const r = await fetch(`/data/charts/${name}.json?t=` + Date.now());
    cache.set(name, r.ok ? await r.json() : {});
  }
  return cache.get(name);
}

export async function getMeta() {
  const d = await load(chartName());
  return { id: 'chart:' + chartName(), frames: d.frames || 100, fps: 30, width: d.width || 960, height: d.height || 600, bg: d.bg || '#ffffff' };
}

export function create(THREE, ctx) {
  const d = cache.get(chartName()) || {};
  ctx.frames = ctx.frames || d.frames || 100;
  return buildChart(THREE, ctx, d);
}
