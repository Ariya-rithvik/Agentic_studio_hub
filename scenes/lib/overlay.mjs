// VERA overlay toolkit — the data-accuracy layer.
// Crisp HTML/SVG widgets composited over the 3D canvas: callout lines that track
// projected 3D anchors, count-up counters that lock at an EXACT value, and a
// radial step hub. This is precisely what generative video (Sora/Veo) cannot do.
const SVGNS = 'http://www.w3.org/2000/svg';
const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Animated count-up that LOCKS exactly on `value` from frame `lock` onward.
export function countUp(frame, { start, lock, value, decimals = 0 }) {
  if (frame <= start) return (0).toFixed(decimals);
  if (frame >= lock) return value.toFixed(decimals);
  const t = easeOutCubic((frame - start) / (lock - start));
  return (value * t).toFixed(decimals);
}

export function createOverlay(THREE, ctx) {
  const { camera, width, height } = ctx;
  const root = ctx.overlayRoot || document.getElementById('overlay');
  root.innerHTML = '';
  root.style.fontFamily = 'Inter, "Segoe UI", Arial, sans-serif';

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('width', width); svg.setAttribute('height', height);
  svg.style.cssText = 'position:absolute;inset:0;overflow:visible;';
  root.appendChild(svg);

  const project = (v3) => {
    const v = v3.clone().project(camera);
    return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
  };

  const items = [];

  function callout(opts) {
    // opts: { anchor3D(), dx, dy, drawStart, drawEnd, fadeStart, fadeEnd, color, render(frame) }
    const color = opts.color || '#ff7a18';
    const line = document.createElementNS(SVGNS, 'line');
    line.setAttribute('stroke', color); line.setAttribute('stroke-width', '2');
    svg.appendChild(line);
    const dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('r', '4'); dot.setAttribute('fill', color);
    svg.appendChild(dot);
    const box = document.createElement('div');
    box.setAttribute('data-callout', '1');
    box.style.cssText = 'position:absolute;transform:translate(-50%,-50%);background:#fff;border:1px solid #e2e6e9;' +
      'border-radius:10px;padding:8px 13px;box-shadow:0 6px 18px rgba(0,0,0,.10);white-space:nowrap;';
    root.appendChild(box);
    const it = { type: 'callout', opts, line, dot, box, color };
    items.push(it);
    return it;
  }

  function hub(opts) {
    // opts: { cx, cy, r, steps:[label], active(frame)->index }
    const ring = document.createElementNS(SVGNS, 'circle');
    ring.setAttribute('cx', opts.cx); ring.setAttribute('cy', opts.cy); ring.setAttribute('r', opts.r);
    ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#edeff1'); ring.setAttribute('stroke-width', '2');
    svg.appendChild(ring);

    const nodes = opts.steps.map((label, i) => {
      const ang = (-90 + i * (360 / opts.steps.length)) * Math.PI / 180;
      const x = opts.cx + opts.r * Math.cos(ang);
      const y = opts.cy + opts.r * Math.sin(ang);
      const n = document.createElement('div');
      n.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);` +
        'width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
        'font-weight:700;font-size:12px;border:2px solid #d7dbdf;background:#fff;color:#9aa0a6;';
      n.textContent = i + 1;
      root.appendChild(n);
      return { n, label };
    });

    const title = document.createElement('div');
    title.style.cssText = `position:absolute;left:${opts.cx}px;top:${opts.cy}px;transform:translate(-50%,-50%);text-align:center;`;
    root.appendChild(title);

    const it = { type: 'hub', opts, nodes, title };
    items.push(it);
    return it;
  }

  function update(frame) {
    for (const it of items) {
      if (it.type === 'callout') {
        const a = project(it.opts.anchor3D());
        const bx = a.x + (it.opts.dx || 0), by = a.y + (it.opts.dy || 0);
        const ds = it.opts.drawStart ?? 0, de = it.opts.drawEnd ?? ds;
        const draw = de > ds ? easeOutCubic(clamp01((frame - ds) / (de - ds))) : 1;
        let alpha = draw;
        if (it.opts.fadeStart != null) alpha *= 1 - smooth(it.opts.fadeStart, it.opts.fadeEnd ?? it.opts.fadeStart + 1, frame);

        const ex = a.x + (bx - a.x) * draw, ey = a.y + (by - a.y) * draw;
        it.line.setAttribute('x1', a.x); it.line.setAttribute('y1', a.y);
        it.line.setAttribute('x2', ex); it.line.setAttribute('y2', ey);
        it.line.style.opacity = alpha; it.dot.style.opacity = alpha;
        it.dot.setAttribute('cx', a.x); it.dot.setAttribute('cy', a.y);
        it.box.style.left = bx + 'px'; it.box.style.top = by + 'px';
        it.box.style.opacity = draw > 0.55 ? alpha : 0;
        it.box.innerHTML = it.opts.render(frame);
      } else if (it.type === 'hub') {
        const act = it.opts.active ? it.opts.active(frame) : 0;
        it.nodes.forEach((nd, i) => {
          const on = i === act;
          nd.n.style.background = on ? '#ff7a18' : '#fff';
          nd.n.style.color = on ? '#fff' : '#9aa0a6';
          nd.n.style.borderColor = on ? '#ff7a18' : '#d7dbdf';
        });
        it.title.innerHTML =
          `<div style="font-size:10px;color:#9aa0a6;letter-spacing:1.5px;font-weight:700;">STEP ${act + 1}</div>` +
          `<div style="font-size:13px;color:#23262b;font-weight:800;">${it.opts.steps[act]}</div>`;
      }
    }
  }

  return { callout, hub, update, project };
}
