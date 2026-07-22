// mograph — the premium 2D motion-graphics scene family (the Cognee-explainer
// grammar): a sequence of BEATS, each one of several vetted mechanics —
//   statPop   : massive kinetic stat with overshoot        { text, label }
//   bubbles   : dark outline-bubble field + word discs     { words[], caption }
//   docGrid   : wall of document icons, staggered pop      { rows, cols, caption }
//   cardFlow  : white cards + pill labels + a path that    { cards[], caption }
//               DRAWS ON connecting them
//   particles : flowing particle swarm + glowing capsule   { caption, logoText }
//   dotGrid   : accent dot grid scale-in                   { rows, cols, caption }
//   reveal    : masked text slide-up (track-matte style)   { text, caption }
// Beats hand off with eased whip-pan slides. Everything eased, nothing linear,
// all randomness seeded => deterministic. NOT hardcoded: /data/mograph/<name>.json
// carries beats, texts, palette; any topic renders through the same code.
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { SplitText } from 'gsap/SplitText';
gsap.registerPlugin(MorphSVGPlugin, SplitText);

const cache = new Map();
const nameOf = () => new URLSearchParams(location.search).get('mograph_full') || 'demo';
async function load(name) {
  if (!cache.has(name)) { const r = await fetch(`/data/mograph/${name}.json?t=` + Date.now()); cache.set(name, r.ok ? await r.json() : {}); }
  return cache.get(name);
}
export async function getMeta() {
  const d = await load(nameOf());
  return { id: 'mograph:' + nameOf(), frames: d.frames || 600, fps: d.fps || 30, width: d.width || 1280, height: d.height || 720, bg: (d.palette && d.palette.bg) || '#ffffff' };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp01((x - a) / Math.max(1e-6, b - a)); return t * t * (3 - 2 * t); };
const outCubic = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const outBack = (x) => { const c = 1.7; const t = clamp01(x); return t === 0 ? 0 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function create(THREE, ctx) {
  const { scene, camera, width: W, height: H } = ctx;
  const d = cache.get(nameOf()) || {};
  const P = Object.assign({ bg: '#ffffff', ink: '#111111', accent: '#6b46ff', accent2: '#22c55e', dark: '#0a0a0a' }, d.palette || {});
  const beats = (Array.isArray(d.beats) && d.beats.length ? d.beats : [{ type: 'statPop', text: '100+', label: 'demo' }]).slice(0, 12);
  camera.position.set(0, 0, 8); camera.lookAt(0, 0, 0);

  // ---- timeline: each beat gets a window ∝ its dur ----
  const total = beats.reduce((s, b) => s + (Number(b.dur) || 3), 0);
  let acc = 0;
  const wins = beats.map((b) => { const a = acc / total; acc += (Number(b.dur) || 3); return { a, b: acc / total }; });

  const o = ctx.overlayRoot; o.innerHTML = '';
  o.style.cssText += `;font-family:Inter,"Segoe UI",system-ui,Arial,sans-serif;overflow:hidden;`;
  const mk = (parent, css, html) => { const el = document.createElement('div'); el.style.cssText = css; if (html != null) el.innerHTML = html; parent.appendChild(el); return el; };
  const svgNS = 'http://www.w3.org/2000/svg';

  const caption = (parent, text) => text ? mk(parent,
    `position:absolute;left:50%;bottom:6%;transform:translateX(-50%);font-size:${Math.round(H * 0.032)}px;color:inherit;font-weight:600;white-space:nowrap;opacity:0;`, text) : null;

  // ================= beat builders (each returns update(lt)) =================
  const builders = {
    statPop(el, b) {
      el.style.color = b.bg === P.dark ? '#fff' : P.ink;
      const big = mk(el, `position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-weight:900;font-size:${Math.round(Math.min(H * 0.42, W * 0.22))}px;letter-spacing:-0.02em;white-space:nowrap;`, String(b.text || '0'));
      const lbl = mk(el, `position:absolute;left:50%;top:70%;transform:translate(-50%,-50%);font-weight:600;font-size:${Math.round(H * 0.045)}px;opacity:0;`, String(b.label || ''));
      const cap = caption(el, b.caption);
      // per-character kinetic pop (SplitText) — driven by seek() so it stays a
      // pure function of the frame; falls back to whole-word pop if split fails
      let tl = null;
      try {
        const split = new SplitText(big, { type: 'chars' });
        tl = gsap.timeline({ paused: true });
        tl.from(split.chars, { scale: 0.001, y: 70, opacity: 0, duration: 0.55, stagger: 0.08, ease: 'back.out(1.7)' });
      } catch { /* fallback below */ }
      return (lt) => {
        if (tl) tl.progress(clamp01(lt / 0.45));
        else big.style.transform = `translate(-50%,-50%) scale(${Math.max(0.001, outBack(lt / 0.32))})`;
        lbl.style.opacity = sm(0.3, 0.5, lt);
        lbl.style.transform = `translate(-50%,${(1 - outCubic((lt - 0.3) / 0.25)) * 24 - 50}%)`;
        if (cap) cap.style.opacity = sm(0.35, 0.55, lt);
      };
    },

    // MAGNIFYING GLASS + BUBBLE BIRTH (the Cognee "searching" scene, two phases):
    // (1) a lens travels a DENSE field of outline circles; inside it circles are
    // crisp, outside blurred; the word glows inside a circle under the glass.
    // (2) as the lens moves on, a new white word-disc is BORN at that junction
    // (glowing ring pop -> filled disc, dark text) and PERSISTS — so it ends with
    // the field full of labelled bubbles (Public / Shallow / Generic), exactly
    // like the reference's "the answers you get are shallow / missing / generic".
    bubbles(el, b) {
      el.style.color = '#fff';
      const uid = 'bub' + Math.round(hash(beats.indexOf(b) + 1) * 1e6);
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.style.cssText = 'position:absolute;inset:0;'; el.appendChild(svg);
      const S = (tag) => document.createElementNS(svgNS, tag);
      const lensR = H * 0.4;

      const words = (b.words || []).slice(0, 4);
      const n = Math.max(1, words.length);
      const rDisc = H * 0.145, rGlow = H * 0.12;
      // word anchors spread like the reference (left-low, centre-high, right-low)
      const wp = words.map((_, i) => ({ x: W * (0.20 + 0.60 * (n > 1 ? i / (n - 1) : 0.5)), y: H * (0.50 + (i % 2 ? -0.10 : 0.07)) }));

      const defs = S('defs');
      const clip = S('clipPath'); clip.setAttribute('id', uid + 'c');
      const clipC = S('circle'); clipC.setAttribute('r', lensR); clip.appendChild(clipC); defs.appendChild(clip);
      const glow = S('radialGradient'); glow.setAttribute('id', uid + 'g');
      const gs1 = S('stop'); gs1.setAttribute('offset', '0'); gs1.setAttribute('stop-color', '#fff'); gs1.setAttribute('stop-opacity', '0.95');
      const gs2 = S('stop'); gs2.setAttribute('offset', '1'); gs2.setAttribute('stop-color', '#fff'); gs2.setAttribute('stop-opacity', '0');
      glow.appendChild(gs1); glow.appendChild(gs2); defs.appendChild(glow); svg.appendChild(defs);

      // CIRCLE PACKING (the reference is a clean bubble-pack — circles sit TANGENT,
      // never crossing). Dart-throw: each candidate grows to maxR then shrinks to
      // just touch its nearest neighbour; rejected if it can't reach minR. Large
      // circles land first in open space, small ones fill the gaps.
      const field = [];
      const minR = H * 0.014, maxR = H * 0.18, gap = 2.5;
      let s = 1000, att = 0;
      while (field.length < 170 && att < 7000) {
        att++;
        const x = (hash(s++) * 1.26 - 0.13) * W, y = (hash(s++) * 1.26 - 0.13) * H;
        let r = maxR;
        for (let k = 0; k < field.length; k++) {
          const c = field[k], dd = Math.hypot(x - c.x, y - c.y) - c.r;
          if (dd < r) r = dd;
          if (r < minR) break;
        }
        if (r >= minR) field.push({ x, y, r: r - gap });
      }
      const drawField = (parent, crisp) => field.map((f) => {
        const c = S('circle'); c.setAttribute('cx', f.x); c.setAttribute('cy', f.y); c.setAttribute('r', f.r);
        c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#fff'); c.setAttribute('stroke-width', crisp ? 2 : 2.5);
        c.setAttribute('opacity', crisp ? 0.92 : 0.32); parent.appendChild(c);
        return c;
      });
      const bg = S('g'); bg.style.filter = 'blur(4px)'; const bgEls = drawField(bg, false); svg.appendChild(bg);
      const crispG = S('g'); crispG.setAttribute('clip-path', `url(#${uid}c)`); const crispEls = drawField(crispG, true); svg.appendChild(crispG);
      // this beat's real duration in seconds (motion speeds are physical px/sec)
      const totalDur = beats.reduce((s, x) => s + (Number(x.dur) || 3), 0);
      const beatSec = ((Number(b.dur) || 3) / totalDur) * ((d.frames || 600) / (d.fps || 30));

      // PHASE 2 layer: persistent white word-discs (born with a ring pop, unclipped)
      const discEls = words.map((w, i) => {
        const g = S('g'); g.setAttribute('opacity', '0');
        const bring = S('circle'); bring.setAttribute('cx', wp[i].x); bring.setAttribute('cy', wp[i].y); bring.setAttribute('fill', 'none'); bring.setAttribute('stroke', '#fff'); bring.setAttribute('stroke-width', '3'); bring.setAttribute('stroke-dasharray', '6 9'); bring.setAttribute('opacity', '0'); bring.style.filter = 'drop-shadow(0 0 6px rgba(255,255,255,.9))';
        const disc = S('g'); disc.setAttribute('transform', `translate(${wp[i].x} ${wp[i].y}) scale(0.001)`);
        const bloom = S('circle'); bloom.setAttribute('cx', 0); bloom.setAttribute('cy', 0); bloom.setAttribute('r', rDisc * 1.18); bloom.setAttribute('fill', '#fff'); bloom.style.filter = 'blur(10px)'; bloom.setAttribute('opacity', '0.45');
        const fc = S('circle'); fc.setAttribute('cx', 0); fc.setAttribute('cy', 0); fc.setAttribute('r', rDisc); fc.setAttribute('fill', '#fff');
        const tilt = (hash(i + 71) - 0.5) * 34;             // reference discs have angled text
        const tx = S('text'); tx.setAttribute('x', 0); tx.setAttribute('y', 0); tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('dominant-baseline', 'central'); tx.setAttribute('fill', '#111'); tx.setAttribute('font-weight', '800'); tx.setAttribute('font-size', Math.round(H * 0.052)); tx.setAttribute('transform', `rotate(${tilt})`); tx.textContent = String(w);
        disc.appendChild(bloom); disc.appendChild(fc); disc.appendChild(tx); g.appendChild(bring); g.appendChild(disc); svg.appendChild(g);
        return { g, bring, disc, cx: wp[i].x, cy: wp[i].y };
      });

      // PHASE 1 layer: lens-reveal glow (white text on dark, clipped under lens)
      const wordG = S('g'); wordG.setAttribute('clip-path', `url(#${uid}c)`); svg.appendChild(wordG);
      const wordEls = words.map((w, i) => {
        const g = S('g'); g.setAttribute('opacity', '0');
        const rc = S('circle'); rc.setAttribute('cx', wp[i].x); rc.setAttribute('cy', wp[i].y); rc.setAttribute('r', rGlow); rc.setAttribute('fill', '#000'); rc.setAttribute('stroke', '#fff'); rc.setAttribute('stroke-width', '2');
        const gl = S('circle'); gl.setAttribute('cx', wp[i].x); gl.setAttribute('cy', wp[i].y); gl.setAttribute('r', rGlow * 1.15); gl.setAttribute('fill', `url(#${uid}g)`);
        const tx = S('text'); tx.setAttribute('x', wp[i].x); tx.setAttribute('y', wp[i].y); tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('dominant-baseline', 'central'); tx.setAttribute('fill', '#fff'); tx.setAttribute('font-weight', '700'); tx.setAttribute('font-size', Math.round(H * 0.045)); tx.textContent = String(w);
        g.appendChild(gl); g.appendChild(rc); g.appendChild(tx); wordG.appendChild(g);
        return g;
      });

      // the lens itself (ring + capsule handle) on top — with an optical BLOOM
      // (a thick, blurred white ring behind the crisp one = lens light scatter)
      const ringBloom = S('circle'); ringBloom.setAttribute('r', lensR); ringBloom.setAttribute('fill', 'none'); ringBloom.setAttribute('stroke', '#fff'); ringBloom.setAttribute('stroke-width', '16'); ringBloom.style.filter = 'blur(7px)'; ringBloom.setAttribute('opacity', '0'); svg.appendChild(ringBloom);
      const ring = S('circle'); ring.setAttribute('r', lensR); ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#fff'); ring.setAttribute('stroke-width', '6'); svg.appendChild(ring);
      const handle = S('rect'); handle.setAttribute('fill', 'none'); handle.setAttribute('stroke', '#fff'); handle.setAttribute('stroke-width', '6'); const hlen = H * 0.32, hthick = H * 0.045; handle.setAttribute('width', hlen); handle.setAttribute('height', hthick); handle.setAttribute('rx', hthick / 2); svg.appendChild(handle);

      // THREE PHASES (decoded from a dense frame-diff + confirmed by Gemini vision):
      //  P1 lt<0.40  — lens searches the blurred field, reveals a word inside it
      //  P2 0.40-0.54 — the lens circle GROWS (exponential-out) to fill the whole
      //                 screen while the blur fades to 0 -> the full crisp field
      //  P3 lt>0.54  — white word-discs are BORN (scale 0->1.1->1, overshoot) and
      //                 REPEL the surrounding outline circles outward (make room)
      const P1 = 0.40, P2 = 0.54;
      const seg = P1 / n;                                    // word segment during the search
      const R_BIG = Math.hypot(W, H) * 1.35;                 // lens radius when it covers the screen
      const birthT = words.map((_, i) => P2 + 0.02 + i * ((0.96 - P2) / n));
      const bp = new Array(n).fill(0);                       // per-disc birth progress (for repel)
      const cap = caption(el, b.caption);
      return (lt) => {
        const ts = lt * beatSec;                            // seconds into this beat
        // expansion progress (exponential-out): 0 during search, 1 when full-screen
        const eRaw = clamp01((lt - P1) / (P2 - P1));
        const e = eRaw <= 0 ? 0 : (1 - Math.pow(2, -9 * eRaw));
        // birth progress per disc (drives both the pop and the neighbour repel)
        discEls.forEach((d, i) => { bp[i] = lt < birthT[i] ? 0 : clamp01((lt - birthT[i]) / 0.11); });

        // PACKED FIELD stays packed: only a gentle WHOLE-field pan (moves every
        // circle together, so tangency is preserved) + a radial REPEL away from
        // each disc being born (nearby circles slide outward to make room).
        const panX = 2.5 * ts, panY = 1.2 * ts;
        field.forEach((f, i) => {
          let nx = f.x + panX, ny = f.y + panY;
          for (let j = 0; j < n; j++) {
            if (bp[j] <= 0) continue;
            const ddx = nx - discEls[j].cx, ddy = ny - discEls[j].cy, dist = Math.hypot(ddx, ddy);
            const pushR = rDisc * 2.6;
            if (dist < pushR && dist > 0.5) {
              const push = ((pushR - dist) / pushR) * rDisc * 0.55 * bp[j];
              nx += (ddx / dist) * push; ny += (ddy / dist) * push;
            }
          }
          bgEls[i].setAttribute('cx', nx); bgEls[i].setAttribute('cy', ny);
          crispEls[i].setAttribute('cx', nx); crispEls[i].setAttribute('cy', ny);
        });

        // LENS: travels the words in P1, then grows to R_BIG through P2
        const idx = Math.min(n - 1, Math.floor(lt / seg)), local = (lt - idx * seg) / seg;
        const cur = wp[idx] || { x: W * 0.5, y: H * 0.5 }, prev = wp[Math.max(0, idx - 1)] || cur;
        const travel = outBack(clamp01(local / 0.5));
        const lxSearch = idx === 0 ? cur.x : lerp(prev.x, cur.x, travel);
        const lySearch = idx === 0 ? cur.y : lerp(prev.y, cur.y, travel);
        const cx = lt < P1 ? lxSearch : lerp(wp[n - 1].x, W / 2, e);   // drift toward centre as it grows
        const cy = lt < P1 ? lySearch : lerp(wp[n - 1].y, H / 2, e);
        const curR = lerp(lensR, R_BIG, e);
        clipC.setAttribute('cx', cx); clipC.setAttribute('cy', cy); clipC.setAttribute('r', curR);
        ring.setAttribute('cx', cx); ring.setAttribute('cy', cy); ring.setAttribute('r', curR);
        ringBloom.setAttribute('cx', cx); ringBloom.setAttribute('cy', cy); ringBloom.setAttribute('r', curR);
        // blur bleaves as the lens takes over the whole frame
        bg.style.filter = `blur(${(4 * (1 - e)).toFixed(2)}px)`;
        bg.style.opacity = (1 - e).toFixed(3);
        // handle only makes sense while the lens is a hand-glass (P1); fades in P2
        const A = 0.6 + Math.sin(lt * 4 + 1) * 0.3;
        const hx = cx + (lensR + hlen / 2) * Math.cos(A), hy = cy + (lensR + hlen / 2) * Math.sin(A);
        handle.setAttribute('x', hx - hlen / 2); handle.setAttribute('y', hy - hthick / 2);
        handle.setAttribute('transform', `rotate(${A * 180 / Math.PI} ${hx} ${hy})`);
        const lensOn = sm(0, 0.06, lt);
        handle.setAttribute('opacity', lensOn * (1 - sm(P1, P1 + 0.05, lt)));
        ring.setAttribute('opacity', lensOn * (1 - sm(P2 - 0.03, P2 + 0.04, lt)));   // rim gone once full-screen
        ringBloom.setAttribute('opacity', lensOn * 0.4 * (1 - sm(P2 - 0.03, P2 + 0.04, lt)));

        // word reveal glows: only during the search, on the word under the lens
        wordEls.forEach((g, i) => {
          const on = (lt < P1 && i === idx) ? sm(0.32, 0.6, local) * (1 - sm(0.9, 1, local)) : 0;
          g.setAttribute('opacity', on);
        });
        // discs: born in P3 with an overshoot pop + glowing dashed birth ring
        discEls.forEach(({ g, bring, disc }, i) => {
          if (bp[i] <= 0) { g.setAttribute('opacity', '0'); return; }
          g.setAttribute('opacity', '1');
          const sc = 0.001 + (1 - 0.001) * outBack(bp[i]);
          disc.setAttribute('transform', `translate(${discEls[i].cx} ${discEls[i].cy}) scale(${sc})`);
          bring.setAttribute('r', rDisc * (0.7 + 0.85 * bp[i]));
          bring.setAttribute('opacity', (1 - bp[i]) * 0.95);
        });
        if (cap) cap.style.opacity = sm(0.3, 0.5, lt);
      };
    },

    // FLOATING DOCUMENT WALL (reference-measured): each cell is a two-layer
    // pair — dark outline square behind + grey folded-corner doc in front —
    // and the pair NEVER stops moving: the front doc swings like a pendulum
    // (±10–22° @ ~0.25–0.45Hz, pivot near its bottom-left) while the back
    // square counter-rocks and the whole cell bobs. Frame-diffing the AE
    // reference showed exactly this; a settled static grid reads as stickers.
    docGrid(el, b) {
      el.style.color = P.ink;
      const rows = Math.min(4, b.rows || 3), cols = Math.min(10, b.cols || 7);
      const cw = Math.round(W * 0.055), ch = Math.round(cw * 1.3);
      const gx = W / (cols + 1), gy = (H * 0.72) / (rows + 1);
      const grey = P.bg === P.dark ? 'rgba(255,255,255,.55)' : 'rgba(70,70,95,.5)';
      const pageBg = P.bg === P.dark ? '#111' : '#fff';
      const totalDur = beats.reduce((s, x) => s + (Number(x.dur) || 3), 0);
      const beatSec = ((Number(b.dur) || 3) / totalDur) * ((d.frames || 600) / (d.fps || 30));
      const docs = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const cell = mk(el, `position:absolute;left:${gx * (c + 1)}px;top:${H * 0.08 + gy * (r + 1)}px;width:${cw}px;height:${ch}px;margin:-${ch / 2}px 0 0 -${cw / 2}px;opacity:0;`);
        const back = mk(cell, `position:absolute;left:-6%;top:-5%;width:88%;height:88%;border:2.5px solid ${P.ink};border-radius:2px;background:${pageBg};`);
        const front = mk(cell, `position:absolute;left:12%;top:10%;width:92%;height:92%;border:2.5px solid ${grey};border-radius:2px;background:${pageBg};transform-origin:18% 88%;`);
        for (let l = 0; l < 3; l++) mk(front, `position:absolute;left:14%;top:${36 + l * 18}%;width:${62 - l * 14}%;height:2.5px;background:${grey};`);
        mk(front, `position:absolute;right:-2.5px;top:-2.5px;width:26%;height:20%;background:${P.bg};border-left:2.5px solid ${grey};border-bottom:2.5px solid ${grey};`);
        docs.push({ cell, back, front, i, tilt: (hash(i) - 0.5) * 14,
          A: 10 + hash(i + 41) * 12,                       // ±10–22° pendulum swing
          f: 0.25 + hash(i + 71) * 0.2,                    // 0.25–0.45 Hz (measured ~0.4)
          ph: hash(i + 101) * 6.283,
          bA: 2.5 + hash(i + 131) * 3.5,                   // 2.5–6 px vertical bob
          bf: 0.12 + hash(i + 161) * 0.1, bph: hash(i + 191) * 6.283 });
      }
      const cap = caption(el, b.caption);
      return (lt) => {
        const ts = lt * beatSec;
        docs.forEach((dd) => {
          const p = outCubic(clamp01((lt - (dd.i % 9) * 0.035 - Math.floor(dd.i / 9) * 0.05) / 0.24));
          const swing = dd.A * Math.sin(6.283 * dd.f * ts + dd.ph) * p;   // ramps in with entrance
          const bob = dd.bA * Math.sin(6.283 * dd.bf * ts + dd.bph) * p;
          dd.cell.style.opacity = p;
          dd.cell.style.transform = `translate(0px,${bob}px) scale(${0.6 + 0.4 * p})`;
          dd.front.style.transform = `rotate(${dd.tilt * (1 - p) + swing}deg)`;
          dd.back.style.transform = `rotate(${-swing * 0.28}deg)`;       // counter-rock
        });
        if (cap) cap.style.opacity = sm(0.35, 0.55, lt);
      };
    },

    // CARD-FLOW (rebuilt to the reference: user's HTML blueprint decoded).
    //  - data cards EXPAND from a small tile to a full card, profile + gradient
    //    text-lines revealing by width, green pill badge popping in
    //  - a solid-purple connector DRAWS ON between them (stroke-dashoffset)
    //  - the LAST node is the "LLM/engine": a white disc holding two WAVY rings
    //    (purple + green, drawn-on then slowly COUNTER-ROTATING) + a sparkle.
    // CARD BORN FROM A GRID CELL (reference t≈24–32 — the missing chapter):
    // a purple-gradient GRID covers the frame; one cell fills white with a
    // profile icon; the card EXPANDS out of that cell (gradient text bars
    // stagger in) while the grid fades to white; a green label pill pops;
    // then a RED tint washes the card and a hidden-eye icon draws on —
    // "here's the problem" — handing off (dark swallow) to the bubbles search.
    // CARD BORN FROM A GRID CELL — v2 with a real CAMERA (measured from the
    // reference: the grid grows ~3x WITH the card = the camera pushes into the
    // world; the card never resizes). Sequence: grid appears, one cell fills
    // white with the profile icon -> CAMERA pushes in (grid + card + everything
    // scale together) -> gradient bars + green pill -> red wash + hidden-eye ->
    // the card MULTIPLIES into the neighbouring cells (camera pulls back to
    // reveal the wall) -> the wall INVERTS to black cards, handing off dark.
    // THE CAMERA JOURNEY (reference t≈24–34 decoded from the user's frames):
    // one continuous world, one traveling camera. A narrow SLIVER at a grid
    // intersection fills white -> widens into the Customer card (camera close,
    // it fills the frame) -> a thick line leaves through a white PORT circle on
    // the card's edge -> the camera PANS with the line to the LLM node (rings)
    // -> line continues -> pans again to a DIFFERENT Company-Data dashboard
    // card (chart/dots/list placeholders) -> red wash + hidden-eye on IT ->
    // camera pulls back, the card MULTIPLIES into a wall -> INVERTS black.
    // Only ~one card is ever visible: that is the reference's zoom trick.
    gridCard(el, b) {
      el.style.color = P.ink;
      const WW = W * 3.2;                                   // world width
      // 4x4 lattice -> wide thin cells (320x180, 1.78:1) per the reference
      const cols = 4, rows = 4, cw = W / cols, chh = H / rows;
      const CELLC = 1, CELLR = 1;                            // birth cell (col,row)
      const cx0 = cw * (CELLC + 0.5), cy = chh * (CELLR + 0.5);
      const cx1 = cx0 + W * 1.15, cx2 = cx1 + W * 1.15;
      const world = mk(el, `position:absolute;left:0;top:0;width:${WW}px;height:${H}px;transform-origin:0 0;`);
      const S = (t) => document.createElementNS(svgNS, t);

      // region backgrounds: purple gradient grid around the birth, light grey after
      // ---- Background: Soft premium purple gradient (not harsh white/dark)
      const gradBg = mk(world, `position:absolute;left:0;top:0;width:${WW}px;height:${H}px;background:linear-gradient(135deg, #f5efff 0%, #dcd3ff 100%);opacity:0;`);
      const vLines = [], hLines = [];
      for (let k = -1; k <= 6; k++) {
        const gen = (k === CELLC || k === CELLC + 1);
        vLines.push({ gen, k, el: mk(world, `position:absolute;left:${k * cw}px;top:${-H * 0.3}px;width:2px;height:${H * 1.6}px;background:rgba(255,255,255,.88);transform-origin:50% 0;transform:scaleY(0);`) });
      }
      for (let k = -1; k <= 4; k++) {
        const gen = (k === CELLR || k === CELLR + 1);
        hLines.push({ gen, k, el: mk(world, `position:absolute;left:${-W * 0.3}px;top:${k * chh}px;width:${W * 1.65}px;height:2px;background:rgba(255,255,255,.88);transform-origin:0 50%;transform:scaleX(0);`) });
      }

      // ---- Customer card: IS the birth cell — white fill WIPES between the
      // generating lines, flush with the lattice (radius/shadow only when it
      // later detaches from the background as the journey starts)
      const cardW = cw, cardH = chh;
      const cardX = cw * CELLC, cardY = chh * CELLR;
      const card = mk(world, `position:absolute;left:${cardX}px;top:${cardY}px;width:${cardW}px;height:${cardH}px;background:#fff;border-radius:0;overflow:hidden;opacity:0;transform:scale(0.008, 1);transform-origin:50% 50%;`);
      const isvg = document.createElementNS(svgNS, 'svg');
      isvg.setAttribute('viewBox', '0 0 100 100');
      isvg.style.cssText = `position:absolute;left:${cardW * 0.045}px;top:${cardH * 0.1}px;width:${cardW * 0.13}px;height:${cardW * 0.13}px;opacity:0;`;
      { const ring = S('circle'); ring.setAttribute('cx', 50); ring.setAttribute('cy', 50); ring.setAttribute('r', 43);
        const head = S('circle'); head.setAttribute('cx', 50); head.setAttribute('cy', 37); head.setAttribute('r', 14);
        const sh = S('path'); sh.setAttribute('d', 'M 22 80 Q 50 52 78 80');
        [ring, head, sh].forEach((p) => { p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#8b5cf6'); p.setAttribute('stroke-width', 3); p.setAttribute('stroke-linecap', 'round'); isvg.appendChild(p); }); }
      card.appendChild(isvg);
      const BARS = [
        { l: 27, t: 12, w: 30 }, { l: 27, t: 24, w: 20 },
        { l: 6, t: 48, w: 82 }, { l: 6, t: 63, w: 78 }, { l: 6, t: 78, w: 84 },
      ];
      const bars = BARS.map((s) => mk(card, `position:absolute;left:${s.l}%;top:${s.t}%;width:${s.w}%;height:6.5%;border-radius:999px;background:linear-gradient(90deg,#e9d5ff,#c4b5fd);opacity:0;transform:translateY(6px);`));
      const pill = mk(world, `position:absolute;left:${cardX + cardW * 0.62}px;top:${cardY - H * 0.028}px;padding:${Math.round(H * 0.009)}px ${Math.round(H * 0.02)}px;border-radius:999px;background:#22c55e;color:#000;font-weight:800;font-size:${Math.round(H * 0.017)}px;white-space:nowrap;box-shadow: 0 4px 12px rgba(34,197,94,0.3);transform:scale(.001);`, String(b.label || 'Customer'));

      // ---- ports + traveling lines (thick, rounded — the reference's ink) ----
      const lsvg = document.createElementNS(svgNS, 'svg');
      lsvg.setAttribute('width', WW); lsvg.setAttribute('height', H);
      lsvg.style.cssText = 'position:absolute;left:0;top:0;';
      world.appendChild(lsvg);
      const mkPort = (x, y) => { const g = mk(world, `position:absolute;left:${x}px;top:${y}px;width:${H * 0.062}px;height:${H * 0.062}px;margin:-${H * 0.031}px;border-radius:50%;background:#fff;box-shadow:0 3px 10px rgba(20,20,60,.14);transform:scale(.001);`); return g; };
      const portA = mkPort(cardX + cardW, cy - cardH * 0.18);           // Customer right port
      const nodeR = H * 0.24;
      const portB = mkPort(cx1 - nodeR, cy), portC = mkPort(cx1 + nodeR, cy);
      const dashW = W * 0.62, dashH = H * 0.66;
      const portD = mkPort(cx2 - dashW / 2, cy + dashH * 0.1), portE = mkPort(cx2 + dashW / 2, cy - dashH * 0.2);
      const dotE = mk(world, `position:absolute;left:${cx2 + dashW / 2}px;top:${cy - dashH * 0.2}px;width:${H * 0.026}px;height:${H * 0.026}px;margin:-${H * 0.013}px;border-radius:50%;background:${P.accent};transform:scale(.001);`);
      const mkLine = (x1, y1, x2, y2, color) => {
        const p = S('path'); p.setAttribute('d', `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`);
        p.setAttribute('fill', 'none'); p.setAttribute('stroke', color); p.setAttribute('stroke-width', H * 0.026); p.setAttribute('stroke-linecap', 'round');
        lsvg.appendChild(p); const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; return { p, L };
      };
      const line1 = mkLine(cardX + cardW, cy - cardH * 0.18, cx1 - nodeR, cy, P.accent);
      const line2 = mkLine(cx1 + nodeR, cy, cx2 - dashW / 2, cy + dashH * 0.1, P.accent2);

      // ---- LLM node (disc + wavy rings + sparkles), lives at cx1 ------------
      const wavy = (R, amp, lobes, ph) => { let d = ''; const N = 72;
        for (let i = 0; i <= N; i++) { const th = (i / N) * 6.283, r = R + amp * Math.sin(lobes * th + ph); d += (i ? 'L ' : 'M ') + (cx1 + r * Math.cos(th)).toFixed(1) + ' ' + (cy + r * Math.sin(th)).toFixed(1) + ' '; } return d + 'Z'; };
      const nodeG = S('g'); nodeG.style.transformOrigin = `${cx1}px ${cy}px`; lsvg.appendChild(nodeG);
      const disc = S('circle'); disc.setAttribute('cx', cx1); disc.setAttribute('cy', cy); disc.setAttribute('r', nodeR); disc.setAttribute('fill', '#fcfcfe'); disc.style.filter = 'drop-shadow(0 12px 34px rgba(20,20,60,.10))'; nodeG.appendChild(disc);
      const ringGr = S('path'); ringGr.setAttribute('d', wavy(nodeR * 0.5, nodeR * 0.14, 5, 0.7)); ringGr.setAttribute('stroke', P.accent2);
      const ringPu = S('path'); ringPu.setAttribute('d', wavy(nodeR * 0.62, nodeR * 0.13, 5, 0)); ringPu.setAttribute('stroke', P.accent);
      [ringGr, ringPu].forEach((r, i) => { r.setAttribute('fill', 'none'); r.setAttribute('stroke-width', i ? 13 : 9); r.setAttribute('stroke-linecap', 'round'); r.style.transformOrigin = `${cx1}px ${cy}px`; const L = r.getTotalLength(); r.style.strokeDasharray = L; r.style.strokeDashoffset = L; r._L = L; nodeG.appendChild(r); });
      const sp = (x, y, s) => `M ${x} ${y - s} C ${x + s * 0.18} ${y - s * 0.18} ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} C ${x + s * 0.18} ${y + s * 0.18} ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} C ${x - s * 0.18} ${y + s * 0.18} ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} C ${x - s * 0.18} ${y - s * 0.18} ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`;
      const spP = S('path'); spP.setAttribute('d', sp(cx1, cy, nodeR * 0.22)); spP.setAttribute('fill', P.accent); nodeG.appendChild(spP);
      const spG = S('path'); spG.setAttribute('d', sp(cx1 - nodeR * 0.14, cy - nodeR * 0.2, nodeR * 0.07)); spG.setAttribute('fill', P.accent2); nodeG.appendChild(spG);
      const llmPill = mk(world, `position:absolute;left:${cx1 - nodeR * 0.4}px;top:${cy - nodeR - H * 0.05}px;padding:${Math.round(H * 0.009)}px ${Math.round(H * 0.022)}px;border-radius:999px;background:${P.accent2};color:#063;font-weight:800;font-size:${Math.round(H * 0.022)}px;transform:scale(.001);`, 'LLM');

      // ---- Company Data dashboard card (a DIFFERENT face: chart/dots/lists) --
      const dash = mk(world, `position:absolute;left:${cx2 - dashW / 2}px;top:${cy - dashH / 2}px;width:${dashW}px;height:${dashH}px;background:#fff;border-radius:18px;box-shadow:0 14px 44px rgba(20,20,60,.09);overflow:hidden;transform:scale(.001);`);
      const ph = (l, t, w, h, r = 8) => mk(dash, `position:absolute;left:${l}%;top:${t}%;width:${w}%;height:${h}%;border-radius:${r}px;background:linear-gradient(135deg,#ececf1,#f6f6f9);`);
      ph(6, 8, 24, 38); mk(dash, 'position:absolute;left:10%;top:14%;width:16%;aspect-ratio:1;border-radius:50%;background:#e6e6ec;');
      ph(34, 8, 26, 12); for (let i = 0; i < 3; i++) mk(dash, `position:absolute;left:${36 + i * 7}%;top:24%;width:5%;aspect-ratio:1;border-radius:50%;background:#e2e2ea;`);
      ph(34, 34, 26, 12);
      for (let i = 0; i < 6; i++) ph(66, 8 + i * 11, 26 - (i % 3) * 6, 7, 6);
      ph(6, 56, 18, 32); ph(28, 56, 32, 14, 8); ph(28, 74, 24, 8, 6);
      const dwash = mk(dash, 'position:absolute;inset:0;background:linear-gradient(135deg, rgba(248,113,113,.62), rgba(252,165,165,.30));opacity:0;');
      const esvg = document.createElementNS(svgNS, 'svg');
      esvg.setAttribute('viewBox', '0 0 100 100');
      esvg.style.cssText = 'position:absolute;left:32%;top:26%;width:36%;height:48%;opacity:0;';
      const eyeStrokes = [];
      { const eye = S('path'); eye.setAttribute('d', 'M 18 50 C 34 26 66 26 82 50 C 66 74 34 74 18 50 Z');
        const iris = S('circle'); iris.setAttribute('cx', 50); iris.setAttribute('cy', 50); iris.setAttribute('r', 11);
        const slash = S('path'); slash.setAttribute('d', 'M 24 78 L 76 22');
        [eye, iris, slash].forEach((p) => { p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#fff'); p.setAttribute('stroke-width', 5); p.setAttribute('stroke-linecap', 'round'); p.style.strokeDasharray = 300; p.style.strokeDashoffset = 300; esvg.appendChild(p); eyeStrokes.push(p); }); }
      dash.appendChild(esvg);
      const dpill = mk(world, `position:absolute;left:${cx2 + dashW * 0.22}px;top:${cy + dashH / 2 - H * 0.012}px;padding:${Math.round(H * 0.009)}px ${Math.round(H * 0.022)}px;border-radius:999px;background:${P.accent2};color:#063;font-weight:800;font-size:${Math.round(H * 0.021)}px;white-space:nowrap;transform:scale(.001);`, 'Company Data');

      // multiply clones (dashboard copies tiling around cx2) + black invert
      const clones = [];
      for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) {
        if (r === 0 && c === 0) continue;
        const cl = mk(world, `position:absolute;left:${cx2 - dashW / 2 + c * dashW * 1.08}px;top:${cy - dashH / 2 + r * dashH * 1.12}px;width:${dashW}px;height:${dashH}px;background:#fff;border-radius:18px;box-shadow:0 18px 44px rgba(20,20,60,.12);overflow:hidden;transform:scale(.001);`);
        mk(cl, 'position:absolute;inset:0;background:linear-gradient(135deg, rgba(248,113,113,.5), rgba(252,165,165,.24));');
        const ink = mk(cl, `position:absolute;inset:0;background:${P.dark};opacity:0;`);
        clones.push({ cl, ink, d: Math.hypot(c, r) });
      }
      clones.sort((a, z) => a.d - z.d);
      const heroInk = mk(dash, `position:absolute;inset:0;background:${P.dark};opacity:0;`);
      const cap = caption(el, b.caption);

      // camera keyframes: (t, zoom, worldX) — cy is constant
      const CAM = [
        [0.00, 1.00, cx0], [0.10, 1.00, cx0], [0.24, 2.10, cx0], [0.34, 2.10, cx0],
        [0.46, 1.35, (cx0 + cx1) / 2], [0.52, 1.35, cx1], [0.62, 1.35, cx1],
        [0.70, 1.10, cx2], [0.82, 1.10, cx2], [0.94, 0.52, cx2], [1.00, 0.52, cx2],
      ];
      const camAt = (t) => {
        let a = CAM[0], b2 = CAM[CAM.length - 1];
        for (let i = 0; i < CAM.length - 1; i++) if (t >= CAM[i][0] && t <= CAM[i + 1][0]) { a = CAM[i]; b2 = CAM[i + 1]; break; }
        const f = a === b2 ? 0 : sm(a[0], b2[0], t);
        return { z: lerp(a[1], b2[1], f), x: lerp(a[2], b2[2], f) };
      };

      return (lt) => {
        const cam = camAt(lt);
        world.style.transform = `translate(${W / 2 - cam.z * cam.x}px, ${H / 2 - cam.z * cy}px) scale(${cam.z})`;

        const gridBye = 1 - sm(0.46, 0.58, lt);
        gradBg.style.opacity = sm(0, 0.05, lt) * gridBye;
        vLines.forEach(({ el: ln }) => { ln.style.opacity = gridBye; });
        hLines.forEach(({ el: ln }) => { ln.style.opacity = gridBye; });
        // 1. Layout Stage: The Crosshair expands
        // The lines draw themselves in the center, then physically push outward!
        const genP = outCubic(clamp01((lt - 0.02) / 0.04)); // Lines scale in
        const pY = outCubic(clamp01((lt - 0.06) / 0.04)); // Horizontal lines push UP/DOWN
        const pX = outCubic(clamp01((lt - 0.10) / 0.05)); // Vertical lines push LEFT/RIGHT
        
        vLines.forEach(({ gen, k, el: ln }) => { 
          const dx = gen ? (cx0 - k * cw) * (1 - pX) : 0;
          ln.style.transform = `translateX(${dx}px) scaleY(${gen ? genP : sm(0.12, 0.18, lt)})`;
          ln.style.opacity = gen ? gridBye : gridBye * sm(0.12, 0.18, lt); 
        });
        hLines.forEach(({ gen, k, el: ln }) => { 
          const dy = gen ? (cy - k * chh) * (1 - pY) : 0;
          ln.style.transform = `translateY(${dy}px) scaleX(${gen ? genP : sm(0.12, 0.18, lt)})`;
          ln.style.opacity = gen ? gridBye : gridBye * sm(0.12, 0.18, lt); 
        });

        // 2. Container Stage: Card is born in the expanding space
        card.style.opacity = sm(0.04, 0.06, lt);
        // Card scales vertically with pY, and horizontally with pX
        card.style.transform = `scale(${0.008 + 0.992 * pX}, ${0.008 + 0.992 * pY})`;
        const detach = sm(0.34, 0.44, lt);
        card.style.borderRadius = (12 * detach) + 'px';
        card.style.boxShadow = detach > 0.02 ? `0 ${20 * detach}px ${60 * detach}px rgba(90,40,180,${0.15 * detach}), 0 ${8 * detach}px ${20 * detach}px rgba(90,40,180,${0.08 * detach})` : 'none';
        
        // 3. Data Stage: Populating the contents and labeling
        const kids = [isvg, ...bars];
        kids.forEach((el2, k) => {
          const p = outCubic(clamp01((lt - 0.16 - k * 0.006) / 0.033));
          el2.style.opacity = p;
          el2.style.transform = `translateY(${6 * (1 - p)}px)`;
        });
        pill.style.transform = `scale(${Math.max(0.001, outBack(clamp01((lt - 0.20) / 0.05)))})`;
        // content grey-out as the journey moves on (reference de-emphasis)
        const fade = sm(0.44, 0.52, lt);
        bars.forEach((bar) => { bar.style.opacity = Math.min(parseFloat(bar.style.opacity || 1), 1 - fade * 0.7); bar.style.filter = `grayscale(${fade})`; });

        portA.style.transform = `scale(${Math.max(0.001, outBack(clamp01((lt - 0.36) / 0.05)))})`;
        line1.p.style.strokeDashoffset = line1.L * (1 - outCubic(clamp01((lt - 0.40) / 0.12)));
        [portB, portC].forEach((p) => { p.style.transform = `scale(${Math.max(0.001, outBack(clamp01((lt - 0.50) / 0.05)))})`; });
        const np = outBack(clamp01((lt - 0.52) / 0.08));
        nodeG.setAttribute('transform', `translate(${cx1 * (1 - np)} ${cy * (1 - np)}) scale(${Math.max(0.001, np)})`);
        [ringGr, ringPu].forEach((r) => { r.style.strokeDashoffset = r._L * (1 - outCubic(clamp01((lt - 0.55) / 0.09))); });
        const rot = sm(0.58, 1, lt) * 40;
        ringPu.style.transform = `rotate(${rot}deg)`; ringGr.style.transform = `rotate(${-rot * 0.8}deg)`;
        llmPill.style.transform = `scale(${Math.max(0.001, outBack(clamp01((lt - 0.56) / 0.06)))})`;

        line2.p.style.strokeDashoffset = line2.L * (1 - outCubic(clamp01((lt - 0.62) / 0.1)));
        [portD, portE].forEach((p) => { p.style.transform = `scale(${Math.max(0.001, outBack(clamp01((lt - 0.68) / 0.05)))})`; });
        dotE.style.transform = `scale(${Math.max(0.001, outBack(clamp01((lt - 0.72) / 0.05)))})`;
        dash.style.transform = `scale(${Math.max(0.001, outBack(clamp01((lt - 0.68) / 0.09)))})`;
        dpill.style.transform = `scale(${Math.max(0.001, outBack(clamp01((lt - 0.74) / 0.06)))})`;

        dwash.style.opacity = sm(0.80, 0.86, lt);
        esvg.style.opacity = sm(0.81, 0.83, lt);
        const dp = sm(0.82, 0.90, lt);
        eyeStrokes.forEach((p) => { p.style.strokeDashoffset = 300 * (1 - dp); });

        clones.forEach((cl, k) => {
          cl.cl.style.transform = `scale(${Math.max(0.001, outBack(clamp01((lt - 0.90 - k * 0.008) / 0.06)))})`;
          cl.ink.style.opacity = sm(0.965, 1, lt);
        });
        heroInk.style.opacity = sm(0.965, 1, lt);
        if (cap) cap.style.opacity = sm(0.78, 0.86, lt) * (1 - sm(0.95, 1, lt));
      };
    },
    cardFlow(el, b) {
      el.style.color = P.ink;
      const names = (b.cards || ['A', 'B', 'C']).slice(0, 4);
      const n = names.length, last = n - 1;
      const pts = names.map((_, i) => ({
        x: W * (0.16 + (0.66 * i) / Math.max(1, n - 1)),
        y: H * (0.5 + (i % 2 ? -0.1 : 0.06))
      }));
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.style.cssText = 'position:absolute;inset:0;'; el.appendChild(svg);
      const S = (t) => document.createElementNS(svgNS, t);

      // Module 07: Harmonic Oscillation Flow (3 sine waves)
      const waves = [0, Math.PI * 0.66, Math.PI * 1.33].map(offset => {
        const p = S('path'); p.setAttribute('fill', 'none'); 
        p.setAttribute('stroke', P.accent); p.setAttribute('stroke-width', '4'); 
        p.setAttribute('stroke-linecap', 'round');
        svg.appendChild(p); return { p, offset };
      });
      
      // Module 06: Bézier Emission Emitter (Data dots)
      const dataDots = Array.from({length: 15}).map(() => {
        return mk(el, `position:absolute;width:6px;height:6px;background:${P.accent2};border-radius:50%;opacity:0;transform:translate(-50%,-50%);box-shadow:0 0 8px ${P.accent2};`);
      });

      // --- the LLM/engine node (white disc + wavy rings + sparkle) ---
      const node = pts[last]; const nodeR = H * 0.26;
      const wavy = (R, amp, lobes, ph) => {           // parametric flower-ring path
        let d = ''; const N = 84;
        for (let i = 0; i <= N; i++) { const th = (i / N) * 6.283, r = R + amp * Math.sin(lobes * th + ph); d += (i ? 'L ' : 'M ') + (node.x + r * Math.cos(th)).toFixed(1) + ' ' + (node.y + r * Math.sin(th)).toFixed(1) + ' '; }
        return d + 'Z';
      };
      const sparkle = (cx, cy, R) => `M ${cx} ${cy - R} Q ${cx} ${cy} ${cx + R} ${cy} Q ${cx} ${cy} ${cx} ${cy + R} Q ${cx} ${cy} ${cx - R} ${cy} Q ${cx} ${cy} ${cx} ${cy - R} Z`;
      const nodeG = S('g'); nodeG.style.transformOrigin = `${node.x}px ${node.y}px`; svg.appendChild(nodeG);
      const disc = S('circle'); disc.setAttribute('cx', node.x); disc.setAttribute('cy', node.y); disc.setAttribute('r', nodeR); disc.setAttribute('fill', '#fff'); disc.style.filter = 'drop-shadow(0 20px 45px rgba(20,20,60,.16))'; nodeG.appendChild(disc);
      // side connection dots (left/right of the disc), like the reference
      [-1, 1].forEach((sgn) => { const c = S('circle'); c.setAttribute('cx', node.x + sgn * nodeR); c.setAttribute('cy', node.y); c.setAttribute('r', H * 0.03); c.setAttribute('fill', '#fff'); c.style.filter = 'drop-shadow(0 6px 14px rgba(20,20,60,.14))'; nodeG.appendChild(c); });
      const dotR = S('circle'); dotR.setAttribute('cx', node.x + nodeR); dotR.setAttribute('cy', node.y); dotR.setAttribute('r', H * 0.012); dotR.setAttribute('fill', P.accent2); nodeG.appendChild(dotR);
      const ringG = S('path'); ringG.setAttribute('d', wavy(nodeR * 0.52, nodeR * 0.09, 5, 0.7)); ringG.setAttribute('fill', 'none'); ringG.setAttribute('stroke', P.accent2); ringG.setAttribute('stroke-width', '8'); ringG.setAttribute('stroke-linecap', 'round'); ringG.style.transformOrigin = `${node.x}px ${node.y}px`; nodeG.appendChild(ringG);
      const ringP = S('path'); ringP.setAttribute('d', wavy(nodeR * 0.62, nodeR * 0.08, 5, 0)); ringP.setAttribute('fill', 'none'); ringP.setAttribute('stroke', P.accent); ringP.setAttribute('stroke-width', '11'); ringP.setAttribute('stroke-linecap', 'round'); ringP.style.transformOrigin = `${node.x}px ${node.y}px`; nodeG.appendChild(ringP);
      const Lg = ringG.getTotalLength(), Lp = ringP.getTotalLength();
      ringG.style.strokeDasharray = Lg; ringP.style.strokeDasharray = Lp;
      const spP = S('path'); spP.setAttribute('d', sparkle(node.x, node.y, nodeR * 0.13)); spP.setAttribute('fill', P.accent); nodeG.appendChild(spP);
      const spG = S('path'); spG.setAttribute('d', sparkle(node.x - nodeR * 0.13, node.y - nodeR * 0.16, nodeR * 0.06)); spG.setAttribute('fill', P.accent2); nodeG.appendChild(spG);

      // --- data cards (expand from a tile) + the node's LLM pill ---
      const cards = pts.map((pt, i) => {
        const isNode = i === last;
        const badge = mk(el, `position:absolute;left:${pt.x}px;top:${pt.y - (isNode ? nodeR + H * 0.02 : H * 0.11)}px;transform:translate(-50%,-50%) scale(.001);padding:5px 16px;border-radius:999px;background:${P.accent2};color:#08300f;font-weight:800;font-size:${Math.round(H * 0.026)}px;white-space:nowrap;box-shadow:0 6px 16px rgba(30,160,80,.4);`, names[i]);
        if (isNode) return { isNode, badge };
        const card = mk(el, `position:absolute;left:${pt.x}px;top:${pt.y}px;transform:translate(-50%,-50%);width:${Math.round(H * 0.09)}px;height:${Math.round(H * 0.09)}px;background:#fff;border-radius:14px;box-shadow:0 18px 50px rgba(20,20,60,.16), 0 4px 12px rgba(20,20,60,.07);overflow:hidden;`);
        const prof = mk(card, `position:absolute;left:${Math.round(H * 0.03)}px;top:${Math.round(H * 0.03)}px;width:${Math.round(H * 0.05)}px;height:${Math.round(H * 0.05)}px;border:3px solid ${P.accent};border-radius:50%;`);
        const linesWrap = mk(card, `position:absolute;left:${Math.round(H * 0.03)}px;top:${Math.round(H * 0.11)}px;right:${Math.round(H * 0.03)}px;display:flex;flex-direction:column;gap:${Math.round(H * 0.016)}px;`);
        const tw = [0.4, 1, 0.85, 0.95];
        const lines = tw.map((w) => mk(linesWrap, `height:${Math.round(H * 0.016)}px;border-radius:6px;background:linear-gradient(90deg,#e9d5ff,${P.accent});width:0%;`));
        return { isNode, badge, card, prof, lines, tw, cx: pt.x, cy: pt.y };
      });

      const fullW = Math.round(H * 0.32), fullH = Math.round(H * 0.19);
      const cap = caption(el, b.caption);
      // THE LINE BIRTHS THE CARDS (reference mechanic): only card 0 pre-exists;
      // each next card pops exactly when the drawing tip REACHES its path
      // fraction — invert the outCubic draw easing to get the arrival time.
      const birth = pts.map((_, i) => i === 0 ? 0.06
        : 0.28 + 0.4 * (1 - Math.cbrt(1 - Math.min(0.999, i / last))));
      return (lt) => {
        // cards expand as the line arrives at each
        cards.forEach((cd, i) => {
          if (cd.isNode) return;
          const ep = outCubic(clamp01((lt - birth[i]) / 0.2));
          cd.card.style.width = lerp(H * 0.09, fullW, ep) + 'px';
          cd.card.style.height = lerp(H * 0.09, fullH, ep) + 'px';
          const lp = clamp01((lt - birth[i] - 0.06) / 0.2);
          cd.lines.forEach((ln, k) => { ln.style.width = (cd.tw[k] * 100 * clamp01((lp - k * 0.12) / 0.4)) + '%'; });
          const bs = outBack(clamp01((lt - birth[i] - 0.1) / 0.18));
          cd.badge.style.transform = `translate(-50%,-50%) scale(${Math.max(0.001, bs)})`;
        });
        // connector draws on (Module 07: Braided sine waves)
        const drawP = outCubic(clamp01((lt - 0.28) / 0.4));
        const currentXLimit = pts[0].x + (pts[last].x - pts[0].x) * drawP;
        const ts = lt * 15.0; // omega t
        
        waves.forEach((w) => {
          let d = '';
          for (let i = 0; i < n - 1; i++) {
             const p0 = pts[i], p1 = pts[i+1];
             const mx = (p0.x + p1.x) / 2;
             if (p0.x > currentXLimit) continue; // Not drawn yet
             
             for (let j = 0; j <= 20; j++) {
                const u = j / 20;
                // Cubic bezier tracking the path: C mx p0.y, mx p1.y, p1.x p1.y
                const bx3 = Math.pow(1-u, 3)*p0.x + 3*Math.pow(1-u, 2)*u*mx + 3*(1-u)*u*u*mx + Math.pow(u, 3)*p1.x;
                const by3 = Math.pow(1-u, 3)*p0.y + 3*Math.pow(1-u, 2)*u*p0.y + 3*(1-u)*u*u*p1.y + Math.pow(u, 3)*p1.y;
                if (bx3 > currentXLimit) break;
                
                const waveY = 16 * Math.sin(bx3 * 0.015 - ts + w.offset);
                d += (j === 0 && i === 0 ? 'M ' : 'L ') + bx3.toFixed(1) + ' ' + (by3 + waveY).toFixed(1) + ' ';
             }
          }
          w.p.setAttribute('d', d);
          w.p.style.opacity = sm(0.28, 0.35, lt) * (1 - sm(0.85, 0.95, lt));
        });

        // Module 06: Data particles flowing (Quadratic Bezier)
        dataDots.forEach((dot, idx) => {
          const spawnT = 0.4 + idx * 0.035; // spawn every 0.035s (relative to beat time)
          const life = (lt - spawnT) / 0.25; // traversal duration
          if (life > 0 && life < 1 && lt < 0.9) {
             dot.style.opacity = Math.sin(life * Math.PI); // fade in/out
             const u = life;
             const p0 = pts[0], p2 = pts[last];
             const p1 = { x: (p0.x + p2.x)/2, y: p0.y - H * 0.25 }; // Arc control point
             const px = Math.pow(1-u, 2)*p0.x + 2*(1-u)*u*p1.x + u*u*p2.x;
             const py = Math.pow(1-u, 2)*p0.y + 2*(1-u)*u*p1.y + u*u*p2.y;
             dot.style.left = px + 'px';
             dot.style.top = py + 'px';
          } else {
             dot.style.opacity = 0;
          }
        });
        const np = outBack(clamp01((lt - 0.58) / 0.22));
        nodeG.setAttribute('transform', `translate(${node.x * (1 - np)} ${node.y * (1 - np)}) scale(${Math.max(0.001, np)})`);
        const rp = outCubic(clamp01((lt - 0.56) / 0.3));
        ringP.style.strokeDashoffset = Lp * (1 - rp); ringG.style.strokeDashoffset = Lg * (1 - rp);
        const spin = sm(0.6, 1, lt) * 26;
        ringP.style.transform = `rotate(${spin}deg)`; ringG.style.transform = `rotate(${-spin * 1.3}deg)`;
        const tw = sm(0.62, 0.72, lt) * (0.85 + 0.15 * Math.sin(lt * 30));
        spP.style.transform = `scale(${tw})`; spP.style.transformOrigin = `${node.x}px ${node.y}px`;
        spG.style.transform = `scale(${sm(0.68, 0.78, lt)})`; spG.style.transformOrigin = `${node.x - nodeR * 0.13}px ${node.y - nodeR * 0.16}px`;
        const nb = cards[last].badge; nb.style.transform = `translate(-50%,-50%) scale(${Math.max(0.001, outBack(clamp01((lt - 0.62) / 0.2)))})`;
        if (cap) cap.style.opacity = sm(0.35, 0.55, lt);
      };
    },

    dotGrid(el, b) {
      el.style.color = P.ink;
      const rows = b.rows || 5, cols = b.cols || 9;
      const dots = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const dot = mk(el, `position:absolute;left:${(W / (cols + 1)) * (c + 1)}px;top:${H * 0.06 + ((H * 0.7) / (rows + 1)) * (r + 1)}px;width:${Math.round(H * 0.05)}px;height:${Math.round(H * 0.05)}px;margin:-${Math.round(H * 0.025)}px;border-radius:50%;background:${P.accent};transform:scale(.001);`);
        dots.push({ dot, k: r + c });
      }
      const cap = caption(el, b.caption);
      return (lt) => {
        dots.forEach((dd) => { dd.dot.style.transform = `scale(${Math.max(0.001, outBack(clamp01((lt - dd.k * 0.035) / 0.22)))})`; });
        if (cap) cap.style.opacity = sm(0.35, 0.55, lt);
      };
    },

    magnifyingGlass(el, b) {
      el.style.backgroundColor = '#000000';
      el.style.overflow = 'hidden';

      const world = mk(el, `position:absolute;inset:0;`);
      for (let i = 0; i < 40; i++) {
        const r = 20 + Math.random() * 150;
        mk(world, `position:absolute;left:${Math.random()*100}%;top:${Math.random()*100}%;width:${r}px;height:${r}px;border:2px solid rgba(255,255,255,0.4);border-radius:50%;transform:translate(-50%,-50%);`);
      }

      const words = ["Never", "The Models", "Trained", "Shallow", "Missing", "Generic"];
      const lensR = H * 0.25;
      const glassWrap = mk(el, `position:absolute;left:0;top:0;width:${lensR*2}px;height:${lensR*2}px;border:8px solid #fff;border-radius:50%;overflow:hidden;box-shadow:inset 0 0 40px rgba(255,255,255,0.2);transform:translate(-50%,-50%);`);
      const glassHandle = mk(el, `position:absolute;left:0;top:0;width:${lensR*1.2}px;height:16px;background:#fff;border-radius:8px;transform-origin:0 50%;border:4px solid #000;`);
      
      const worldInner = mk(glassWrap, `position:absolute;left:0;top:0;width:${W}px;height:${H}px;`);
      
      words.forEach((w, i) => {
        const x = W * (0.2 + (i % 3) * 0.25 + Math.random()*0.1);
        const y = H * (0.2 + Math.floor(i / 3) * 0.4 + Math.random()*0.1);
        mk(worldInner, `position:absolute;left:${x}px;top:${y}px;color:#fff;font-size:54px;font-weight:700;transform:translate(-50%,-50%);`, w);
      });

      return (lt) => {
        const p = clamp01(lt);
        const s = outBack(clamp01(lt / 0.15));
        const gx = W * 0.2 + (W * 0.6) * p + Math.sin(p * Math.PI * 4) * 100;
        const gy = H * 0.3 + (H * 0.4) * p + Math.cos(p * Math.PI * 2) * 50;
        
        glassWrap.style.left = `${gx}px`;
        glassWrap.style.top = `${gy}px`;
        glassWrap.style.transform = `translate(-50%,-50%) scale(${s})`;
        
        glassHandle.style.left = `${gx + lensR * 0.7 * s}px`;
        glassHandle.style.top = `${gy + lensR * 0.7 * s}px`;
        glassHandle.style.transform = `scale(${s}) rotate(45deg)`;
        
        worldInner.style.transform = `translate(${-gx + lensR}px, ${-gy + lensR}px)`;
      };
    },

    sineWave(el, b) {
      el.style.backgroundColor = P.bg;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.style.cssText = `position:absolute;inset:0;width:100%;height:100%;`;
      el.appendChild(svg);
      
      const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path1.setAttribute('stroke', P.accent);
      path1.setAttribute('stroke-width', '12');
      path1.setAttribute('fill', 'none');
      svg.appendChild(path1);

      const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path2.setAttribute('stroke', P.green || '#00ff00');
      path2.setAttribute('stroke-width', '12');
      path2.setAttribute('fill', 'none');
      svg.appendChild(path2);

      const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path3.setAttribute('stroke', '#000');
      path3.setAttribute('stroke-width', '8');
      path3.setAttribute('stroke-dasharray', '20, 20');
      path3.setAttribute('fill', 'none');
      svg.appendChild(path3);

      return (lt) => {
        const t = lt * 5;
        let d1 = `M 0 ${H/2}`, d2 = `M 0 ${H/2}`, d3 = `M 0 ${H/2}`;
        for(let i=0; i<=W; i+=20) {
          const x = i;
          const a1 = (x / 200) + t;
          const a2 = (x / 200) + t + Math.PI * (2/3);
          const a3 = (x / 200) + t + Math.PI * (4/3);
          d1 += ` L ${x} ${H/2 + Math.sin(a1)*100}`;
          d2 += ` L ${x} ${H/2 + Math.sin(a2)*100}`;
          d3 += ` L ${x} ${H/2 + Math.sin(a3)*100}`;
        }
        path1.setAttribute('d', d1);
        path2.setAttribute('d', d2);
        path3.setAttribute('d', d3);
      };
    },
    
    deepGraph(el, b) {
      el.style.backgroundColor = P.dark;
      const wrap = mk(el, `position:absolute;inset:0;transform-origin:50% 50%;`);
      const nodes = [];
      for(let i=0; i<60; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const n = mk(wrap, `position:absolute;left:${x}px;top:${y}px;width:12px;height:12px;background:#fff;border-radius:50%;transform:translate(-50%,-50%);`);
        if(Math.random() > 0.6) {
          mk(n, `position:absolute;left:20px;top:-10px;color:rgba(255,255,255,0.6);font-size:12px;font-family:monospace;white-space:nowrap;`, `x: ${Math.round(x)} y: ${Math.round(y)}`);
        }
        nodes.push({el: n, x, y, z: Math.random()*2});
      }
      return (lt) => {
        const s = 1 + lt * 2;
        wrap.style.transform = `scale(${s})`;
      };
    },

    countUp(el, b) {
      el.style.backgroundColor = P.bg;
      el.style.color = P.ink;
      const numWrap = mk(el, `position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);font-weight:900;font-size:${Math.round(H * 0.25)}px;color:#000;display:flex;align-items:baseline;justify-content:center;`);
      
      const valEl = document.createElement('span');
      numWrap.appendChild(valEl);
      const suffixEl = document.createElement('span');
      suffixEl.style.cssText = `font-size:${Math.round(H * 0.1)}px; margin-left:20px;`;
      suffixEl.textContent = b.suffix || '';
      numWrap.appendChild(suffixEl);
      
      const label = mk(el, `position:absolute;left:50%;top:65%;transform:translate(-50%,-50%);font-size:48px;color:${P.ink};opacity:0.6;font-weight:500;`, b.label || '');

      return (lt) => {
        const p = outCubic(clamp01(lt / 0.8));
        const val = Math.floor(lerp(b.start || 0, b.end || 1000000, p));
        valEl.textContent = b.format === 'commas' ? val.toLocaleString() : val;
        label.style.opacity = sm(0.1, 0.3, lt) * 0.6;
        numWrap.style.transform = `translate(-50%,-50%) scale(${0.8 + 0.2*outBack(p)})`;
      };
    },

    reveal(el, b) {
      el.style.color = P.ink;
      const line = mk(el, `position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);overflow:hidden;padding:4px 8px;`);
      const txt = mk(line, `font-weight:800;font-size:${Math.round(Math.min(H * 0.09, W * 0.05))}px;white-space:nowrap;transform:translateY(120%);`, String(b.text || ''));
      const cap = caption(el, b.caption);
      return (lt) => {
        txt.style.transform = `translateY(${(1 - outCubic(clamp01(lt / 0.3))) * 120}%)`;
        if (cap) cap.style.opacity = sm(0.3, 0.5, lt);
      };
    },

    particles(el, b) {
      el.style.color = '#fff';
      // big soft glow halo behind the logo (the reference's lens-flare bloom)
      const halo = mk(el, `position:absolute;left:50%;top:46%;width:${Math.round(H * 0.62)}px;height:${Math.round(H * 0.62)}px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle, rgba(180,160,255,0.28) 0%, rgba(120,90,255,0.12) 40%, rgba(0,0,0,0) 70%);pointer-events:none;`);
      // logo = white disc holding the equalizer/soundwave bars (Cognee mark)
      const wrap = mk(el, `position:absolute;left:50%;top:46%;width:${Math.round(H * 0.17)}px;height:${Math.round(H * 0.17)}px;transform:translate(-50%,-50%) scale(.001);border-radius:50%;background:rgba(255,255,255,0.95);box-shadow:0 0 40px rgba(180,150,255,.9), inset 0 0 0 1px rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;gap:${Math.round(H * 0.011)}px;`);
      const barHs = [0.4, 0.72, 0.52, 0.9, 0.6];             // soundwave silhouette
      barHs.forEach((h) => mk(wrap, `width:${Math.round(H * 0.014)}px;height:${Math.round(H * 0.09 * h)}px;border-radius:999px;background:${P.accent};`));
      const cap = caption(el, b.caption);
      return (lt) => {
        const s = Math.max(0.001, outBack(clamp01((lt - 0.15) / 0.3)));
        wrap.style.transform = `translate(-50%,-50%) scale(${s})`;
        halo.style.opacity = sm(0.1, 0.35, lt) * (1 - sm(0.9, 1, lt)) * (0.8 + 0.2 * Math.sin(lt * 20));
        if (cap) cap.style.opacity = sm(0.3, 0.5, lt);
      };
    }
  };

  // ---- THREE particle field (shared; visible only during 'particles' beats) ----
  // dense flow field: dots seeded uniformly then advected along a COHERENT vector
  // field (neighbouring dots see a similar field -> they form visible streamlines,
  // like the reference's topographic dot-flow, not random jitter).
  const NP = 4800, startPos = new Float32Array(NP * 3), pos = new Float32Array(NP * 3);
  const targetBrain = new Float32Array(NP * 3), targetLogo = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) {
    // Random spawn outside r > 15
    const ang = hash(i * 13) * Math.PI * 2;
    const rr = 18 + hash(i * 17) * 15;
    startPos[i * 3] = Math.cos(ang) * rr;
    startPos[i * 3 + 1] = Math.sin(ang) * rr;
    startPos[i * 3 + 2] = 0;
    
    pos[i * 3] = startPos[i * 3]; pos[i * 3 + 1] = startPos[i * 3 + 1]; pos[i * 3 + 2] = 0;

    // Target Brain (two lobes)
    const isLeft = hash(i) < 0.5;
    const cx = isLeft ? -2.2 : 2.2;
    const tAng = hash(i * 19) * Math.PI * 2;
    const tRad = Math.sqrt(hash(i * 23)) * 4.0;
    targetBrain[i * 3] = cx + Math.cos(tAng) * tRad;
    targetBrain[i * 3 + 1] = Math.sin(tAng) * tRad * 0.85 + 0.5;
    targetBrain[i * 3 + 2] = 0;

    // Target Logo (5 bars matching the UI logo)
    const barHs = [0.4, 0.72, 0.52, 0.9, 0.6];
    const bIdx = Math.floor(hash(i * 29) * 5);
    const bh = barHs[bIdx] * 4.5;
    targetLogo[i * 3] = (bIdx - 2) * 1.5 + (hash(i * 31) - 0.5) * 0.8;
    targetLogo[i * 3 + 1] = (hash(i * 37) - 0.5) * bh;
    targetLogo[i * 3 + 2] = 0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
  // three colour layers (purple dominant, green accents, white sparkle) — one geo
  // updated per frame; the layers are rotated copies so colours interleave.
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(P.accent), size: 3.0, sizeAttenuation: false, transparent: true, opacity: 0.95 }));
  pts.visible = false; scene.add(pts);
  const pts2 = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(P.accent2), size: 3.2, sizeAttenuation: false, transparent: true, opacity: 0.92 }));
  pts2.visible = false; pts2.rotation.z = 0.22; scene.add(pts2);
  const pts3 = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color('#ffffff'), size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.6 }));
  pts3.visible = false; pts3.rotation.z = -0.32; scene.add(pts3);

  // ---- CONTINUITY ENGINE (no slides — one continuous world) ----
  // Decoded from the reference frame-by-frame: (1) incoming elements GROW FROM a
  // focal point, (2) a traveler line DRAWS from the old scene's focal to the new
  // one's (draw-on birth), (3) background changes arrive as a circle that
  // SWALLOWS the screen from the focal point, (4) outgoing content shrinks/fades
  // in place instead of flying off.
  const focalOf = (type) => {
    if (type === 'cardFlow') return { x: W * 0.18, y: H * 0.42 };
    if (type === 'gridCard') return { x: W * 0.5, y: H * 0.46 };
    if (type === 'bubbles') return { x: W * 0.3, y: H * 0.38 };
    if (type === 'docGrid' || type === 'dotGrid') return { x: W * 0.5, y: H * 0.42 };
    return { x: W / 2, y: H * 0.44 };
  };
  const R = Math.hypot(W, H);                             // swallow radius covering any corner
  const swallow = mk(o, `position:absolute;left:0;top:0;width:${2 * R}px;height:${2 * R}px;border-radius:50%;transform:scale(0.001);will-change:transform;display:none;`);

  const els = beats.map(() => mk(o, `position:absolute;inset:0;will-change:transform,opacity;display:none;`));
  const ups = beats.map((b, i) => (builders[b.type] || builders.statPop)(els[i], b));
  const focals = beats.map((b) => focalOf(b.type));
  const bgs = beats.map((b) => b.bg || (b.type === 'bubbles' || b.type === 'particles' ? P.dark : P.bg));
  const isDark = (x) => x && x !== P.bg;                   // anything that isn't the light bg
  els.forEach((el, i) => { el.style.transformOrigin = `${focals[i].x}px ${focals[i].y}px`; });
  // premium dressing (critic fixes): faint layout grid on light beats, radial
  // vignette on dark beats — the reference's background treatment
  els.forEach((el, i) => {
    const dress = document.createElement('div');
    dress.style.cssText = isDark(bgs[i])
      ? 'position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%);pointer-events:none;'
      : `position:absolute;inset:0;background-image:linear-gradient(rgba(20,20,60,0.045) 1px, transparent 1px),linear-gradient(90deg, rgba(20,20,60,0.045) 1px, transparent 1px);background-size:${Math.round(W / 16)}px ${Math.round(W / 16)}px;pointer-events:none;`;
    el.insertBefore(dress, el.firstChild);
  });

  // traveler: the connective ink that draws the eye from beat to beat
  const tsvg = document.createElementNS(svgNS, 'svg');
  tsvg.setAttribute('width', W); tsvg.setAttribute('height', H);
  tsvg.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
  o.appendChild(tsvg);
  // SHAPE-SHIFTER (MorphSVG): during a bridge, a proxy of the outgoing beat's
  // hero silhouette MORPHS into the incoming beat's silhouette while traveling
  // between focals — "the element becomes the next element" (reference mechanic).
  const PROXY = {
    bar: 'M -120 -34 L 120 -34 Q 132 -34 132 -22 L 132 22 Q 132 34 120 34 L -120 34 Q -132 34 -132 22 L -132 -22 Q -132 -34 -120 -34 Z',
    card: 'M -95 -62 L 95 -62 Q 105 -62 105 -52 L 105 52 Q 105 62 95 62 L -95 62 Q -105 62 -105 52 L -105 -52 Q -105 -62 -95 -62 Z',
    circle: 'M 0 -78 C 43 -78 78 -43 78 0 C 78 43 43 78 0 78 C -43 78 -78 43 -78 0 C -78 -43 -43 -78 0 -78 Z',
    doc: 'M -55 -75 L 18 -75 L 55 -38 L 55 75 L -55 75 Z',
    capsule: 'M -46 -52 L 46 -52 C 78 -52 78 52 46 52 L -46 52 C -78 52 -78 -52 -46 -52 Z'
  };
  const proxyOf = (type) =>
    (type === 'cardFlow' || type === 'gridCard') ? 'card' : type === 'docGrid' ? 'doc'
      : (type === 'bubbles' || type === 'dotGrid') ? 'circle'
        : type === 'particles' ? 'capsule' : 'bar';
  const shifter = document.createElementNS(svgNS, 'path');
  shifter.setAttribute('opacity', '0'); tsvg.appendChild(shifter);
  const mtl = {};
  const morphTl = (k) => {
    if (mtl[k]) return mtl[k];
    const a = focals[k - 1], b2 = focals[k];
    const tl = gsap.timeline({ paused: true });
    tl.set(shifter, { attr: { d: PROXY[proxyOf(beats[k - 1].type)] }, x: a.x, y: a.y, scale: 0.55 }, 0);
    tl.to(shifter, { duration: 1, morphSVG: PROXY[proxyOf(beats[k].type)], ease: 'power2.inOut' }, 0);
    tl.to(shifter, { duration: 1, x: b2.x, y: b2.y, scale: 0.8, ease: 'power2.inOut' }, 0);
    mtl[k] = tl; return tl;
  };

  const tpath = document.createElementNS(svgNS, 'path');
  tpath.setAttribute('fill', 'none'); tpath.setAttribute('stroke-width', '4'); tpath.setAttribute('stroke-linecap', 'round');
  tsvg.appendChild(tpath);
  const tdot = document.createElementNS(svgNS, 'circle');
  tdot.setAttribute('r', '7'); tsvg.appendChild(tdot);

  const E = 0.14;                                          // bridge window (fraction of a beat)
  const N = d.frames || 600;

  return {
    update(frame) {
      const t = frame / N;
      let k = wins.findIndex((w) => t >= w.a && t < w.b); if (k < 0) k = beats.length - 1;
      const w = wins[k], lt = clamp01((t - w.a) / (w.b - w.a));
      const bridging = k > 0 && lt < E;
      const p = k === 0 ? 1 : outCubic(lt / E);            // bridge progress

      // background: held until the swallow covers the screen, then switched
      const bgChanges = k > 0 && bgs[k] !== bgs[k - 1];
      scene.background = new THREE.Color(bridging && bgChanges ? bgs[k - 1] : bgs[k]);
      if (bridging && bgChanges) {
        swallow.style.display = 'block';
        swallow.style.background = bgs[k];
        swallow.style.left = (focals[k].x - R) + 'px'; swallow.style.top = (focals[k].y - R) + 'px';
        swallow.style.transform = `scale(${Math.max(0.001, p)})`;
      } else swallow.style.display = 'none';

      els.forEach((el, i) => {
        if (i !== k && i !== (bridging ? k - 1 : -1)) { el.style.display = 'none'; return; }
        el.style.display = 'block';
        if (i === k) {                                     // grow in FROM the focal point
          el.style.opacity = p;
          el.style.transform = `scale(${0.82 + 0.18 * p})`;
        } else {                                           // outgoing shrinks/fades in place
          el.style.opacity = 1 - p;
          el.style.transform = `scale(${1 - 0.06 * p})`;
        }
      });

      // traveler line + morphing shape-shifter: the ink draws the path while a
      // silhouette of the old beat's hero MORPHS into the new beat's hero along it
      if (bridging) {
        const a = focals[k - 1], b2 = focals[k];
        const mx = (a.x + b2.x) / 2 + (b2.y - a.y) * 0.25, my = (a.y + b2.y) / 2 - (b2.x - a.x) * 0.25;
        tpath.setAttribute('d', `M ${a.x} ${a.y} Q ${mx} ${my} ${b2.x} ${b2.y}`);
        const ink = (isDark(bgs[k]) || isDark(bgs[k - 1])) ? '#ffffff' : P.accent;
        tpath.setAttribute('stroke', ink); tdot.setAttribute('fill', ink);
        const L = tpath.getTotalLength();
        tpath.style.strokeDasharray = L;
        tpath.style.strokeDashoffset = L * (1 - p);
        const pt = tpath.getPointAtLength(L * p);
        tdot.setAttribute('cx', pt.x); tdot.setAttribute('cy', pt.y);
        const fade = 1 - sm(0.75, 1, lt / E);
        tpath.style.opacity = 0.9 * fade; tdot.style.opacity = fade;
        shifter.setAttribute('fill', ink);
        shifter.setAttribute('opacity', 0.85 * sm(0.05, 0.3, p) * (1 - sm(0.78, 1, p)));
        morphTl(k).progress(p);
      } else { tpath.style.opacity = 0; tdot.style.opacity = 0; shifter.setAttribute('opacity', 0); }

      ups[k](lt);

      // particle field: flowing swarm while a particles beat is active
      const isPart = beats[k].type === 'particles';
      pts.visible = pts2.visible = pts3.visible = isPart;
        if (isPart) {
          const arr = pts.geometry.attributes.position.array;
          const isOutro = k > beats.length / 2; // if late in timeline, morph to logo, else brain
          // Expo.easeInOut mapped to outCubic for the attractor
          const flowT = outCubic(clamp01((lt - 0.1) / 0.6));
          const tf = t * 2.0;

          for (let i = 0; i < NP; i++) {
            const tgtX = isOutro ? targetLogo[i * 3] : targetBrain[i * 3];
            const tgtY = isOutro ? targetLogo[i * 3 + 1] : targetBrain[i * 3 + 1];
            
            // x_i(t) = x_start * (1-t) + x_target * t
            let px = lerp(startPos[i * 3], tgtX, flowT);
            let py = lerp(startPos[i * 3 + 1], tgtY, flowT);

            // Add coherent noise when fully locked for breathing effect
            if (flowT > 0.9) {
               const noiseAmt = (flowT - 0.9) * 10.0; // 0 to 1
               px += Math.sin(py * 0.55 + tf) * 0.1 * noiseAmt;
               py += Math.cos(px * 0.55 - tf) * 0.1 * noiseAmt;
            }
            arr[i * 3] = px;
            arr[i * 3 + 1] = py;
          }
          pts.geometry.attributes.position.needsUpdate = true;
          
          // Fix: Ease rotation back to 0 so the target shapes don't duplicate/spin!
          const rotEase = 1 - flowT; 
          pts2.rotation.z = (0.22 + t * 0.3) * rotEase; 
          pts3.rotation.z = (-0.32 - t * 0.22) * rotEase;
          
          const fadeIn = sm(0, 0.15, lt) * (1 - sm(0.9, 1, lt));
          pts.material.opacity = 0.95 * fadeIn; pts2.material.opacity = 0.92 * fadeIn; pts3.material.opacity = 0.6 * fadeIn;
        }
    }
  };
}
