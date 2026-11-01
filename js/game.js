/*
 * The map: a tiny pixel-art town you can ride around on a grey Hornet 750.
 * Everything is drawn in code on a low-resolution canvas that CSS scales up
 * with `image-rendering: pixelated`, so it stays crisp and retro.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- world
  const W = 1200, H = 900;
  const ROAD = 36, HALF = ROAD / 2;
  const X0 = 150, X1 = 1050, Y0 = 220, Y1 = 740;
  const HL = [Y0, 480, Y1];            // horizontal roads (y)
  const VL = [X0, 600, X1];            // vertical roads (x)
  const RB = { x: 600, y: 480, r: 60, island: 28, lane: 44 }; // roundabout
  const LAKE = { x: 375, y: 350, r: 40 };

  // Building centre, size, pad on the road where the bike "parks", style
  const ZONES = [
    { id: 'about',      x: 600,  y: 835, w: 150, h: 90,  pad: [600, Y1],  style: 'home' },
    { id: 'experience', x: 330,  y: 840, w: 170, h: 100, pad: [330, Y1],  style: 'office' },
    { id: 'cases',      x: 870,  y: 840, w: 170, h: 100, pad: [870, Y1],  style: 'blueprint' },
    { id: 'skills',     x: 360,  y: 112, w: 170, h: 96,  pad: [360, Y0],  style: 'toolbox' },
    { id: 'ailab',      x: 840,  y: 112, w: 170, h: 96,  pad: [840, Y0],  style: 'lab' },
    { id: 'garage',     x: 66,   y: 480, w: 110, h: 100, pad: [X0, 480],  style: 'garage' },
    { id: 'contact',    x: 1134, y: 480, w: 110, h: 100, pad: [X1, 480],  style: 'post' }
  ];
  // the order a visitor is guided through with "Next stop"
  const TOUR = ['about', 'experience', 'cases', 'ailab', 'skills', 'garage', 'contact'];

  const bRect = (z) => ({ x: Math.round(z.x - z.w / 2), y: Math.round(z.y - z.h / 2), w: z.w, h: z.h });
  ZONES.forEach((z) => { z.rect = bRect(z); z.drive = driveway(z); });

  const ROADS = [];
  HL.forEach((y) => ROADS.push({ x: X0 - HALF, y: y - HALF, w: X1 - X0 + ROAD, h: ROAD, dir: 'h', c: y }));
  VL.forEach((x) => ROADS.push({ x: x - HALF, y: Y0 - HALF, w: ROAD, h: Y1 - Y0 + ROAD, dir: 'v', c: x }));

  function driveway(z) {
    const b = bRect(z), [px, py] = z.pad, dw = 20;
    if (py <= b.y) return { x: px - dw / 2, y: py, w: dw, h: b.y - py };
    if (py >= b.y + b.h) return { x: px - dw / 2, y: b.y + b.h, w: dw, h: py - (b.y + b.h) };
    if (px <= b.x) return { x: px, y: py - dw / 2, w: b.x - px, h: dw };
    return { x: b.x + b.w, y: py - dw / 2, w: px - (b.x + b.w), h: dw };
  }

  // ---------------------------------------------------------------- helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const normA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const inRect = (px, py, r, m = 0) => px >= r.x - m && px <= r.x + r.w + m && py >= r.y - m && py <= r.y + r.h + m;

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => clamp(Math.round(v * f), 0, 255);
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }
  function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function fillCircle(c, cx, cy, r, col) {
    c.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy));
      c.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
    }
  }
  function makeCanvas(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }

  const FONT = '"Press Start 2P", monospace';
  // Text without anti-aliasing: draw it, then snap every pixel to fully on or off.
  function crispText(text, color, size = 8) {
    const probe = makeCanvas(1, 1).getContext('2d');
    probe.font = `${size}px ${FONT}`;
    const w = Math.ceil(probe.measureText(text).width) + 2, h = size + 4;
    const cv = makeCanvas(w, h), c = cv.getContext('2d');
    c.font = probe.font; c.textBaseline = 'top'; c.fillStyle = color; c.fillText(text, 1, 2);
    const img = c.getImageData(0, 0, w, h), d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
    c.putImageData(img, 0, 0);
    return cv;
  }

  // ---------------------------------------------------------------- collisions
  function blocked(x, y) {
    if (x < 6 || y < 6 || x > W - 6 || y > H - 6) return true;
    if (dist(x, y, LAKE.x, LAKE.y) < LAKE.r + 3) return true;
    if (dist(x, y, RB.x, RB.y) < RB.island + 3) return true;
    for (const z of ZONES) if (inRect(x, y, z.rect, 3)) return true;
    return false;
  }
  function onRoad(x, y) {
    for (const r of ROADS) if (inRect(x, y, r, 2)) return true;
    for (const z of ZONES) if (inRect(x, y, z.drive, 2)) return true;
    return dist(x, y, RB.x, RB.y) < RB.r + 2;
  }

  // ---------------------------------------------------------------- route planning on the road grid
  function projectOnRoads(p) {
    let best = null;
    HL.forEach((y, i) => {
      const q = { x: clamp(p.x, X0, X1), y, line: 'h' + i };
      const d = dist(p.x, p.y, q.x, q.y); if (!best || d < best.d) best = { ...q, d };
    });
    VL.forEach((x, i) => {
      const q = { x, y: clamp(p.y, Y0, Y1), line: 'v' + i };
      const d = dist(p.x, p.y, q.x, q.y); if (!best || d < best.d) best = { ...q, d };
    });
    return best;
  }
  function planRoute(from, to) {
    const S = projectOnRoads(from), E = projectOnRoads(to);
    const nodes = [];
    HL.forEach((y, i) => VL.forEach((x, j) => nodes.push({ x, y, lines: ['h' + i, 'v' + j] })));
    const si = nodes.push({ x: S.x, y: S.y, lines: [S.line] }) - 1;
    const ei = nodes.push({ x: E.x, y: E.y, lines: [E.line] }) - 1;
    // connect consecutive nodes along each line
    const adj = nodes.map(() => []);
    const lines = ['h0', 'h1', 'h2', 'v0', 'v1', 'v2'];
    lines.forEach((ln) => {
      const on = nodes.map((n, i) => i).filter((i) => nodes[i].lines.includes(ln));
      const key = ln[0] === 'h' ? 'x' : 'y';
      on.sort((a, b) => nodes[a][key] - nodes[b][key]);
      for (let k = 1; k < on.length; k++) {
        const a = on[k - 1], b = on[k], w = Math.abs(nodes[a][key] - nodes[b][key]);
        adj[a].push([b, w]); adj[b].push([a, w]);
      }
    });
    // Dijkstra (11 nodes, a simple O(n^2) version is plenty)
    const D = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = nodes.map(() => false);
    D[si] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && D[i] < Infinity && (u < 0 || D[i] < D[u])) u = i;
      if (u < 0 || u === ei) break;
      done[u] = true;
      for (const [v, w] of adj[u]) if (D[u] + w < D[v]) { D[v] = D[u] + w; prev[v] = u; }
    }
    const idx = [];
    for (let u = ei; u >= 0; u = prev[u]) { idx.unshift(u); if (u === si) break; }
    let pts = idx.map((i) => ({ x: nodes[i].x, y: nodes[i].y }));
    pts = pts.filter((p, i) => i === 0 || dist(p.x, p.y, pts[i - 1].x, pts[i - 1].y) > 1);
    pts = aroundRoundabout(pts);
    if (dist(from.x, from.y, S.x, S.y) < 12) pts.shift();
    if (dist(to.x, to.y, E.x, E.y) > 6) pts.push({ x: to.x, y: to.y });
    if (!pts.length) pts.push({ x: to.x, y: to.y });
    return pts;
  }
  // Replace the roundabout centre with points on its ring, driving anticlockwise like in Europe.
  function aroundRoundabout(pts) {
    const out = [];
    pts.forEach((p, i) => {
      const isC = p.x === RB.x && p.y === RB.y;
      if (!isC) { out.push(p); return; }
      const prev = pts[i - 1], next = pts[i + 1];
      const aIn = prev ? Math.atan2(prev.y - RB.y, prev.x - RB.x) : null;
      const aOut = next ? Math.atan2(next.y - RB.y, next.x - RB.x) : null;
      const ring = (a) => ({ x: RB.x + Math.cos(a) * RB.lane, y: RB.y + Math.sin(a) * RB.lane });
      if (aIn === null || aOut === null) { out.push(ring(aIn ?? aOut)); return; }
      let d = aIn - aOut; while (d <= 0.01) d += 2 * Math.PI;   // screen-anticlockwise = decreasing angle
      const steps = Math.max(1, Math.round(d / 0.55));
      for (let k = 0; k <= steps; k++) out.push(ring(aIn - (d * k) / steps));
    });
    return out;
  }

  // ---------------------------------------------------------------- the bike sprite (Hornet 750, grey)
  const SPRITE_N = 64;
  function buildBikeSprites() {
    const base = makeCanvas(24, 24), c = base.getContext('2d');
    const r = (x, y, w, h, col) => rect(c, x, y, w, h, col);
    r(1, 10, 8, 4, '#141414'); r(2, 10, 6, 1, '#3a3a3a');           // rear tyre
    r(16, 11, 7, 3, '#141414'); r(17, 11, 5, 1, '#3a3a3a');         // front tyre
    r(4, 14, 6, 2, '#6b6f75');                                       // exhaust
    r(7, 9, 10, 6, '#24262a');                                       // frame / engine
    r(3, 10, 4, 4, '#8e949c'); r(2, 11, 1, 2, '#e03b3b');            // tail + light
    r(6, 9, 6, 6, '#1b1b1e');                                        // seat
    r(11, 8, 6, 8, '#8e949c'); r(12, 9, 4, 2, '#c3c8cf');            // grey tank
    r(17, 5, 2, 14, '#1f2023'); r(17, 4, 2, 1, '#9aa0a6'); r(17, 19, 2, 1, '#9aa0a6'); // bars, mirrors
    r(22, 11, 2, 2, '#fff0b3');                                      // headlight
    r(7, 8, 6, 8, '#26314f');                                        // rider jacket (navy)
    r(12, 6, 5, 2, '#26314f'); r(12, 16, 5, 2, '#26314f');           // arms
    r(16, 6, 2, 2, '#111'); r(16, 16, 2, 2, '#111');                 // gloves
    r(9, 9, 6, 6, '#e9e9ec'); r(10, 8, 4, 8, '#e9e9ec');             // helmet
    r(9, 11, 6, 2, '#ffb000');                                       // helmet stripe
    r(14, 10, 1, 4, '#22252b');                                      // visor
    const src = c.getImageData(0, 0, 24, 24).data;
    const sprites = [], shadows = [];
    for (let k = 0; k < SPRITE_N; k++) {
      const a = (k / SPRITE_N) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const cv = makeCanvas(32, 32), cc = cv.getContext('2d'), img = cc.createImageData(32, 32);
      const sh = makeCanvas(32, 32), sc = sh.getContext('2d'), simg = sc.createImageData(32, 32);
      for (let dy = 0; dy < 32; dy++) for (let dx = 0; dx < 32; dx++) {
        const rx = dx - 16 + 0.5, ry = dy - 16 + 0.5;
        const sx = Math.floor(ca * rx + sa * ry + 12), sy = Math.floor(-sa * rx + ca * ry + 12);
        if (sx < 0 || sy < 0 || sx >= 24 || sy >= 24) continue;
        const si = (sy * 24 + sx) * 4, di = (dy * 32 + dx) * 4;
        if (src[si + 3] < 128) continue;
        img.data[di] = src[si]; img.data[di + 1] = src[si + 1]; img.data[di + 2] = src[si + 2]; img.data[di + 3] = 255;
        simg.data[di + 3] = 80;
      }
      cc.putImageData(img, 0, 0); sc.putImageData(simg, 0, 0);
      sprites.push(cv); shadows.push(sh);
    }
    return { sprites, shadows };
  }

  // ---------------------------------------------------------------- static world rendering
  const STYLES = {
    home:     { wall: '#efe0bf', roof: '#b5523b', win: '#8fd3ff' },
    office:   { wall: '#5d6b82', roof: '#3b4558', win: '#9fe0ff', roofRatio: 0.32 },
    lab:      { wall: '#2b3245', roof: '#1d2233', win: '#4fd1c5' },
    workshop: { wall: '#9b4a32', roof: '#5a5f66', win: '#ffd78a' },
    arcade:   { wall: '#5b2a86', roof: '#2e1846', win: '#ffd23f' },
    uni:      { wall: '#e6dcc0', roof: '#8f3b2f', win: '#5a6b8a', noWindows: true },
    airport:  { wall: '#e9eef2', roof: '#9aa5b1', win: '#7fc3e8', noWindows: true },
    toolbox:  { wall: '#c0392b', roof: '#333842', win: '#ffd78a' },
    garage:   { wall: '#8b9096', roof: '#4a4f57', win: '#c9d6df', bigDoor: true },
    library:  { wall: '#7a5232', roof: '#4b2e1b', win: '#f4d58d', noWindows: true },
    post:     { wall: '#f2c53d', roof: '#2c3e94', win: '#cfe8ff' },
    blueprint:{ wall: '#2c5d8f', roof: '#1e3f63', win: '#cfe8ff' }
  };
  STYLES.workshop.bigDoor = true;

  function renderWorld(labels) {
    const cv = makeCanvas(W, H), c = cv.getContext('2d');
    const rnd = mulberry32(7);

    // grass with texture and flowers
    rect(c, 0, 0, W, H, '#5b9b4b');
    for (let i = 0; i < 9000; i++) rect(c, rnd() * W, rnd() * H, 1 + (rnd() * 2 | 0), 1, rnd() < 0.5 ? '#518f42' : '#67a856');
    const flowers = ['#f2e85c', '#ff8fa3', '#ffffff', '#b9a3ff'];
    for (let i = 0; i < 420; i++) {
      const x = rnd() * W, y = rnd() * H;
      if (!onRoad(x, y)) rect(c, x, y, 1, 1, flowers[i % 4]);
    }

    // lake
    fillCircle(c, LAKE.x, LAKE.y, LAKE.r + 4, '#d8c58f');
    fillCircle(c, LAKE.x, LAKE.y, LAKE.r, '#3e7fbf');
    fillCircle(c, LAKE.x - 4, LAKE.y - 5, LAKE.r - 9, '#4f95d4');
    for (let i = 0; i < 14; i++) rect(c, LAKE.x - 25 + rnd() * 45, LAKE.y - 25 + rnd() * 45, 4, 1, '#8cc7f0');

    // roads: curb, asphalt, grain
    const curb = '#8d8a80', asph = '#43454f';
    ROADS.forEach((r) => rect(c, r.x - 3, r.y - 3, r.w + 6, r.h + 6, curb));
    ZONES.forEach((z) => rect(c, z.drive.x - 2, z.drive.y - 2, z.drive.w + 4, z.drive.h + 4, curb));
    fillCircle(c, RB.x, RB.y, RB.r + 3, curb);
    ROADS.forEach((r) => rect(c, r.x, r.y, r.w, r.h, asph));
    ZONES.forEach((z) => rect(c, z.drive.x, z.drive.y, z.drive.w, z.drive.h, '#4d505b'));
    fillCircle(c, RB.x, RB.y, RB.r, asph);
    for (let i = 0; i < 5000; i++) {
      const x = rnd() * W, y = rnd() * H;
      if (onRoad(x, y)) rect(c, x, y, 1, 1, rnd() < 0.5 ? '#3b3d46' : '#4c4f5a');
    }
    // dashed centre lines, skipping junctions
    const nearJunction = (x, y, self) => dist(x, y, RB.x, RB.y) < RB.r + 8 ||
      ROADS.some((o) => o !== self && inRect(x, y, o, 6));
    ROADS.forEach((r) => {
      if (r.dir === 'h') for (let x = r.x; x < r.x + r.w; x += 16) { if (!nearJunction(x + 4, r.c, r)) rect(c, x, r.c - 1, 8, 2, '#e8c547'); }
      else for (let y = r.y; y < r.y + r.h; y += 16) { if (!nearJunction(r.c, y + 4, r)) rect(c, r.c - 1, y, 2, 8, '#e8c547'); }
    });
    // pad markings (parking box in front of every building)
    ZONES.forEach((z) => {
      const [px, py] = z.pad;
      rect(c, px - 11, py - 11, 22, 1, '#d9d4c5'); rect(c, px - 11, py + 10, 22, 1, '#d9d4c5');
      rect(c, px - 11, py - 11, 1, 22, '#d9d4c5'); rect(c, px + 10, py - 11, 1, 22, '#d9d4c5');
    });

    // roundabout island with a fountain
    fillCircle(c, RB.x, RB.y, RB.island + 3, curb);
    fillCircle(c, RB.x, RB.y, RB.island, '#5b9b4b');
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; rect(c, RB.x + Math.cos(a) * 23, RB.y + Math.sin(a) * 23, 2, 2, flowers[i % 4]); }
    fillCircle(c, RB.x, RB.y, 17, '#b9b4a6');
    fillCircle(c, RB.x, RB.y, 14, '#4aa3df');
    fillCircle(c, RB.x, RB.y, 6, '#8fd0f5');
    fillCircle(c, RB.x, RB.y, 2, '#ffffff');

    // trees (seeded, so the town is always the same)
    const trees = [];
    for (let i = 0; i < 1400 && trees.length < 240; i++) {
      const x = 10 + rnd() * (W - 20), y = 10 + rnd() * (H - 20), r = 5 + (rnd() * 4 | 0);
      if (ROADS.some((o) => inRect(x, y, o, 12 + r))) continue;
      if (ZONES.some((z) => inRect(x, y, z.rect, 26 + r) || inRect(x, y, z.drive, 10 + r))) continue;
      if (dist(x, y, LAKE.x, LAKE.y) < LAKE.r + 12 + r) continue;
      if (dist(x, y, RB.x, RB.y) < RB.r + 12) continue;
      if (trees.some((t) => dist(x, y, t.x, t.y) < t.r + r + 2)) continue;
      trees.push({ x: Math.round(x), y: Math.round(y), r });
    }
    trees.sort((a, b) => a.y - b.y).forEach((t) => {
      fillCircle(c, t.x + 3, t.y + 4, t.r, 'rgba(0,0,0,0.22)');
      rect(c, t.x - 1, t.y + t.r - 2, 3, 4, '#6b4a2b');
      fillCircle(c, t.x, t.y, t.r, '#2f6b35');
      fillCircle(c, t.x - 1, t.y - 1, t.r - 2, '#3f8a45');
      fillCircle(c, t.x - 2, t.y - 2, Math.max(1, t.r - 5), '#5fae5a');
    });

    // buildings + signs
    ZONES.forEach((z) => drawBuilding(c, z));
    ZONES.forEach((z) => drawSign(c, labels[z.id] || z.id.toUpperCase(), z.x, z.rect.y - 18));
    return cv;
  }

  function drawBuilding(c, z) {
    const b = z.rect, st = STYLES[z.style];
    const roofH = Math.round(b.h * (st.roofRatio || 0.5)), wallY = b.y + roofH, wallH = b.h - roofH;
    rect(c, b.x + 5, b.y + 6, b.w, b.h, 'rgba(0,0,0,0.28)');
    // roof
    rect(c, b.x - 3, b.y, b.w + 6, roofH, st.roof);
    for (let y = b.y + 4; y < b.y + roofH - 2; y += 4) rect(c, b.x - 3, y, b.w + 6, 1, shade(st.roof, 0.82));
    rect(c, b.x - 3, b.y, b.w + 6, 2, shade(st.roof, 1.3));
    rect(c, b.x - 3, b.y + roofH - 2, b.w + 6, 2, shade(st.roof, 0.6));
    // wall
    rect(c, b.x, wallY, b.w, wallH, st.wall);
    rect(c, b.x, wallY, b.w, 2, shade(st.wall, 0.7));
    rect(c, b.x, b.y + b.h - 3, b.w, 3, shade(st.wall, 0.72));
    // door
    const dw = st.bigDoor ? 44 : 14, dh = Math.min(st.bigDoor ? 24 : 20, wallH - 6);
    const dx = Math.round(z.x - dw / 2), dy = b.y + b.h - dh;
    // windows
    if (!st.noWindows) {
      const ww = 10, wh = 9;
      for (let wy = wallY + 6; wy + wh <= b.y + b.h - 6; wy += wh + 6) {
        for (let x = b.x + 8; x + ww <= b.x + b.w - 7; x += 17) {
          if (x + ww > dx - 4 && x < dx + dw + 4 && wy + wh > dy - 3) continue;
          rect(c, x - 1, wy - 1, ww + 2, wh + 2, shade(st.wall, 0.6));
          rect(c, x, wy, ww, wh, st.win);
          rect(c, x, wy, ww, 2, shade(st.win, 1.2));
          rect(c, x + 5, wy, 1, wh, shade(st.wall, 0.6));
        }
      }
    }
    rect(c, dx - 1, dy - 1, dw + 2, dh + 1, shade(st.wall, 0.55));
    if (st.bigDoor) {
      rect(c, dx, dy, dw, dh, '#9aa0a6');
      for (let y = dy + 2; y < dy + dh; y += 3) rect(c, dx, y, dw, 1, '#6f757c');
    } else {
      rect(c, dx, dy, dw, dh, '#3a2a20');
      rect(c, dx + dw - 4, dy + (dh >> 1), 2, 2, '#e6c35c');
    }
    EXTRAS[z.style] && EXTRAS[z.style](c, z, b, roofH, wallY, wallH, st);
  }

  const EXTRAS = {
    home(c, z, b) { rect(c, b.x + b.w - 34, b.y - 10, 10, 18, '#8a3d2c'); rect(c, b.x + b.w - 35, b.y - 11, 12, 3, '#6d2f22'); },
    office(c, z, b) {
      rect(c, b.x + 14, b.y + 6, 16, 10, '#9aa0a6'); rect(c, b.x + 16, b.y + 8, 12, 2, '#6f757c');
      rect(c, b.x + b.w - 26, b.y + 4, 2, 14, '#c9ccd1'); rect(c, b.x + b.w - 27, b.y + 3, 4, 2, '#ff5d73');
    },
    lab(c, z, b) {
      fillCircle(c, b.x + 30, b.y + 22, 11, '#c9ccd1'); fillCircle(c, b.x + 30, b.y + 22, 8, '#9aa0a6');
      rect(c, b.x + 29, b.y + 12, 2, 10, '#5a5f66');
      rect(c, b.x, b.y + b.h * 0.5 - 1, b.w, 2, '#4fd1c5');
    },
    workshop(c, z, b) { for (let y = b.y + b.h * 0.5 + 3; y < b.y + b.h - 3; y += 4) for (let x = b.x + ((y >> 2) % 2) * 4; x < b.x + b.w; x += 8) rect(c, x, y, 1, 3, '#7e3a27'); },
    arcade(c, z, b, roofH, wallY) {
      rect(c, b.x, wallY + 2, b.w, 2, '#ff4fd8');
      for (let i = 0; i < 6; i++) rect(c, b.x + 10 + i * 18, b.y + 10 + (i % 2) * 8, 2, 2, '#ffd23f');
    },
    uni(c, z, b, roofH, wallY, wallH) {
      for (let x = b.x + 8; x < b.x + b.w - 8; x += 16) { if (Math.abs(x - z.x) < 14) continue; rect(c, x, wallY + 4, 6, wallH - 7, '#fbf6e9'); rect(c, x + 4, wallY + 4, 2, wallH - 7, '#d8ceb3'); }
      for (let i = 0; i < 12; i++) rect(c, z.x - 40 + i * 3.4, b.y + 18 - i * 1.2, 80 - i * 6.8, 1, '#a24a3c');
    },
    airport(c, z, b, roofH, wallY, wallH) {
      rect(c, b.x + 6, wallY + 6, b.w - 12, wallH - 16, '#7fc3e8'); rect(c, b.x + 6, wallY + 6, b.w - 12, 2, '#b8e2f7');
      for (let x = b.x + 18; x < b.x + b.w - 10; x += 16) rect(c, x, wallY + 6, 1, wallH - 16, '#5d8fb0');
      rect(c, b.x + b.w - 30, b.y - 26, 16, 40, '#d7dde3'); rect(c, b.x + b.w - 34, b.y - 32, 24, 10, '#7fc3e8'); rect(c, b.x + b.w - 34, b.y - 34, 24, 2, '#5a6470');
    },
    toolbox(c, z, b) { rect(c, z.x - 24, b.y - 8, 48, 4, '#22252b'); rect(c, z.x - 24, b.y - 8, 4, 12, '#22252b'); rect(c, z.x + 20, b.y - 8, 4, 12, '#22252b'); rect(c, b.x, b.y + b.h * 0.5 + 2, b.w, 2, '#9aa0a6'); },
    garage(c, z, b) {
      [[b.x + 14, b.y + b.h + 12], [b.x + 23, b.y + b.h + 12], [b.x + 18, b.y + b.h + 5]].forEach(([x, y]) => { fillCircle(c, x, y, 4, '#151515'); fillCircle(c, x, y, 1, '#5a5f66'); });
      rect(c, b.x + b.w - 20, b.y + b.h + 6, 6, 8, '#c0392b'); rect(c, b.x + b.w - 19, b.y + b.h + 4, 3, 2, '#22252b');
    },
    library(c, z, b, roofH, wallY, wallH) {
      const spines = ['#c0392b', '#2c7be5', '#f4d58d', '#27ae60', '#8e44ad', '#e67e22'];
      for (let x = b.x + 8, i = 0; x < b.x + b.w - 8; x += 5, i++) { if (Math.abs(x - z.x) < 12) continue; rect(c, x, wallY + 8, 4, wallH - 14, spines[i % spines.length]); }
    },
    blueprint(c, z, b, roofH) {
      for (let x = b.x + 6; x < b.x + b.w - 2; x += 10) rect(c, x, b.y + 3, 1, roofH - 6, '#4f86bd');
      for (let y = b.y + 8; y < b.y + roofH - 3; y += 10) rect(c, b.x, y, b.w, 1, '#4f86bd');
      rect(c, b.x + 20, b.y + 10, 40, 22, '#e9f2fb'); rect(c, b.x + 24, b.y + 14, 14, 6, '#2c5d8f'); rect(c, b.x + 42, b.y + 14, 14, 14, '#2c5d8f');
      rect(c, b.x + 30, b.y + 20, 12, 1, '#2c5d8f');
    },
    post(c, z, b, roofH, wallY) {
      rect(c, b.x, wallY + 3, b.w, 3, '#2c3e94');
      rect(c, z.x + 14, b.y + b.h - 13, 7, 11, '#d8343f'); rect(c, z.x + 15, b.y + b.h - 10, 5, 1, '#22252b');
    }
  };

  function drawSign(c, text, cx, y) {
    const t = crispText(text, '#ffd23f');
    const pw = t.width + 8, ph = 14, x = Math.round(cx - pw / 2);
    rect(c, x + 2, y + 2, pw, ph, 'rgba(0,0,0,0.35)');
    rect(c, x - 1, y - 1, pw + 2, ph + 2, '#f4efe1');
    rect(c, x, y, pw, ph, '#1d1f33');
    c.drawImage(t, x + 4, y + 1);
  }

  // ---------------------------------------------------------------- game state
  const G = {};
  let canvas, ctx, mini, mctx, miniBase, world, sprites;
  let vw = 0, vh = 0, scale = 1;
  let labels = {}, visited = new Set();
  const cache = {};
  const bike = { x: VL[1], y: Y1, a: -Math.PI / 2, v: 0 };
  const cam = { x: 0, y: 0 };
  const keys = { up: false, down: false, left: false, right: false };
  let auto = null, near = null, paused = true, running = false, last = 0, t = 0, stuckFor = 0;
  let particles = [], puffTimer = 0, cb = {};
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  G.zones = ZONES.map((z) => z.id);
  G.tour = TOUR;

  G.init = function (opts) {
    canvas = opts.canvas; ctx = canvas.getContext('2d');
    mini = opts.minimap; mctx = mini.getContext('2d');
    cb = opts;
    sprites = buildBikeSprites();
    resize();
    window.addEventListener('resize', resize);
    bindInput();
  };

  G.setLabels = function (map, lang) {
    labels = map;
    world = cache[lang] || (cache[lang] = renderWorld(map));
    miniBase = makeCanvas(mini.width, mini.height);
    const mc = miniBase.getContext('2d');
    mc.imageSmoothingEnabled = true;
    mc.drawImage(world, 0, 0, mini.width, mini.height);
    if (!running) draw();
  };
  G.setVisited = function (set) { visited = set; };
  G.pause = function (p) { paused = p; if (p) { Object.keys(keys).forEach((k) => (keys[k] = false)); } };
  let active = false;
  G.start = function () {
    paused = false; active = true;
    resize();
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  };
  G.stop = function () { G.pause(true); active = false; };
  G.driveTo = function (id, open) {
    const z = ZONES.find((q) => q.id === id); if (!z) return;
    if (near === z && Math.abs(bike.v) < 30) { if (open) cb.onArrive && cb.onArrive(z.id); return; }
    setAuto({ x: z.pad[0], y: z.pad[1] }, z, open);
  };

  function setAuto(target, zone, open) {
    auto = { path: planRoute(bike, target), i: 0, zone, open, target };
    stuckFor = 0;
  }

  function resize() {
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetW = box.width < 700 ? 330 : 620;
    scale = Math.max(1, Math.round((box.width * dpr) / targetW));
    canvas.width = Math.max(1, Math.ceil((box.width * dpr) / scale));
    canvas.height = Math.max(1, Math.ceil((box.height * dpr) / scale));
    vw = canvas.width; vh = canvas.height;
    ctx.imageSmoothingEnabled = false;
    snapCamera();
    if (world) draw();
  }

  function camTarget() {
    const look = reduceMotion ? 0 : 0.35;
    let x = bike.x + Math.cos(bike.a) * bike.v * look - vw / 2;
    let y = bike.y + Math.sin(bike.a) * bike.v * look - vh / 2;
    x = vw >= W ? (W - vw) / 2 : clamp(x, 0, W - vw);
    y = vh >= H ? (H - vh) / 2 : clamp(y, 0, H - vh);
    return { x, y };
  }
  function snapCamera() { const c = camTarget(); cam.x = c.x; cam.y = c.y; }

  // ---------------------------------------------------------------- input
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  function bindInput() {
    window.addEventListener('keydown', (e) => {
      if (paused || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target.closest && e.target.closest('input, textarea')) return;
      const k = KEYMAP[e.code];
      if (k) { keys[k] = true; auto = null; e.preventDefault(); return; }
      if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && near) {
        e.preventDefault(); cb.onArrive && cb.onArrive(near.id);
      }
    });
    window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
    window.addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

    canvas.addEventListener('pointerdown', (e) => {
      if (paused) return;
      const box = canvas.getBoundingClientRect();
      const wx = cam.x + ((e.clientX - box.left) / box.width) * vw;
      const wy = cam.y + ((e.clientY - box.top) / box.height) * vh;
      clickWorld(wx, wy);
    });
    mini.addEventListener('pointerdown', (e) => {
      if (paused) return;
      const box = mini.getBoundingClientRect();
      clickWorld(((e.clientX - box.left) / box.width) * W, ((e.clientY - box.top) / box.height) * H, 70);
    });
  }
  function clickWorld(wx, wy, slack = 10) {
    let best = null, bd = Infinity;
    for (const z of ZONES) {
      const signHit = Math.abs(wx - z.x) < 50 && wy > z.rect.y - 22 && wy < z.rect.y;
      const d = inRect(wx, wy, z.rect, slack) || signHit ? 0 : dist(wx, wy, z.pad[0], z.pad[1]);
      if (d < Math.max(24, slack) && d < bd) { bd = d; best = z; }
    }
    if (best) { G.driveTo(best.id, true); return; }
    let target = { x: clamp(wx, 8, W - 8), y: clamp(wy, 8, H - 8) };
    if (blocked(target.x, target.y)) { const p = projectOnRoads(target); target = { x: p.x, y: p.y }; }
    setAuto(target, null, false);
  }

  // ---------------------------------------------------------------- simulation
  function update(dt) {
    let thr = 0, steer = 0, cap = Infinity;
    if (auto) {
      const r = autopilot(); thr = r.thr; steer = r.steer; cap = r.cap;
    } else {
      thr = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
      steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    }
    const road = onRoad(bike.x, bike.y);
    const vmax = Math.min(road ? 175 : 95, cap);
    if (thr > 0) bike.v += 260 * dt;
    else if (thr < 0) bike.v = bike.v > 0 ? bike.v - 420 * dt : Math.max(-50, bike.v - 140 * dt);
    else { bike.v -= bike.v * Math.min(1, 1.8 * dt); if (Math.abs(bike.v) < 3) bike.v = 0; }
    if (bike.v > vmax) bike.v = Math.max(vmax, bike.v - 380 * dt);

    const turn = (auto ? 3.8 : 3.0) * clamp(Math.abs(bike.v) / 45, 0, 1) * Math.sign(bike.v);
    bike.a = normA(bike.a + steer * turn * dt);

    const nx = bike.x + Math.cos(bike.a) * bike.v * dt, ny = bike.y + Math.sin(bike.a) * bike.v * dt;
    if (!blocked(nx, ny)) { bike.x = nx; bike.y = ny; }
    else if (!blocked(nx, bike.y)) { bike.x = nx; bike.v *= 0.92; }
    else if (!blocked(bike.x, ny)) { bike.y = ny; bike.v *= 0.92; }
    else bike.v *= -0.25;

    // exhaust and dust
    puffTimer -= dt;
    if (puffTimer <= 0 && (thr > 0 || Math.abs(bike.v) > 30)) {
      puffTimer = 0.05;
      const bx = bike.x - Math.cos(bike.a) * 11, by = bike.y - Math.sin(bike.a) * 11;
      const dust = !road && Math.abs(bike.v) > 30;
      particles.push({ x: bx, y: by, vx: -Math.cos(bike.a) * 12 + (Math.random() - 0.5) * 10, vy: -Math.sin(bike.a) * 12 + (Math.random() - 0.5) * 10,
        life: 0, max: dust ? 0.7 : 0.45, col: dust ? '#b89a62' : '#c9ccd1', s: dust ? 3 : 2 });
    }
    particles.forEach((p) => { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    particles = particles.filter((p) => p.life < p.max);
    if (particles.length > 120) particles.splice(0, particles.length - 120);

    // camera
    const ct = camTarget(), k = Math.min(1, dt * 5);
    cam.x += (ct.x - cam.x) * k; cam.y += (ct.y - cam.y) * k;

    // which building is the bike parked at?
    const n = ZONES.find((z) => dist(bike.x, bike.y, z.pad[0], z.pad[1]) < 30 || inRect(bike.x, bike.y, z.drive, 10)) || null;
    if (n !== near) { near = n; cb.onNear && cb.onNear(n ? n.id : null); }
  }

  function autopilot() {
    const p = auto.path[auto.i];
    if (!p) { auto = null; return { thr: 0, steer: 0, cap: Infinity }; }
    const isLast = auto.i === auto.path.length - 1;
    const d = dist(bike.x, bike.y, p.x, p.y);
    const desired = Math.atan2(p.y - bike.y, p.x - bike.x);
    const diff = normA(desired - bike.a);

    if (isLast && d < 7) {
      const z = auto.zone, open = auto.open; auto = null; bike.v *= 0.3;
      if (z && open) cb.onArrive && cb.onArrive(z.id);
      return { thr: -1, steer: 0, cap: 0 };
    }
    if (!isLast && (d < 14 || (Math.abs(diff) > 1.6 && d < 26))) { auto.i++; return autopilot(); }

    let cap = 175;
    if (Math.abs(diff) > 0.5) cap = 55;
    if (!isLast && d < 55) {
      const q = auto.path[auto.i + 1];
      const turnAt = Math.abs(normA(Math.atan2(q.y - p.y, q.x - p.x) - Math.atan2(p.y - bike.y, p.x - bike.x)));
      if (turnAt > 0.7) cap = Math.min(cap, 70);
    }
    if (isLast) cap = Math.min(cap, 25 + d * 1.6);

    // give up if the bike is stuck against something
    stuckFor = Math.abs(bike.v) < 6 ? stuckFor + 1 / 60 : 0;
    if (stuckFor > 2.5) { auto = null; return { thr: 0, steer: 0, cap: Infinity }; }

    return { thr: bike.v < cap ? 1 : bike.v > cap + 20 ? -1 : 0, steer: clamp(diff * 2.4, -1, 1), cap };
  }

  // ---------------------------------------------------------------- drawing
  function draw() {
    if (!world) return;
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    ctx.fillStyle = '#2f6b35'; ctx.fillRect(0, 0, vw, vh);
    const sx = Math.max(0, cx), sy = Math.max(0, cy);
    const sw = Math.min(W - sx, vw), sh = Math.min(H - sy, vh);
    ctx.drawImage(world, sx, sy, sw, sh, sx - cx, sy - cy, sw, sh);

    const pulse = reduceMotion ? 0 : Math.sin(t * 4);
    // pads and markers
    ZONES.forEach((z) => {
      const [px, py] = z.pad;
      if (px - cx < -40 || px - cx > vw + 40 || py - cy < -140 || py - cy > vh + 40) return;
      const s = Math.round(12 + pulse * 1.5), col = near === z ? '#ffffff' : '#ffb000';
      ctx.fillStyle = col;
      ctx.fillRect(px - cx - s, py - cy - s, s * 2, 2); ctx.fillRect(px - cx - s, py - cy + s - 2, s * 2, 2);
      ctx.fillRect(px - cx - s, py - cy - s, 2, s * 2); ctx.fillRect(px - cx + s - 2, py - cy - s, 2, s * 2);
      const mx = z.x - cx, my = z.rect.y - 34 - cy + (visited.has(z.id) ? 0 : Math.round(pulse * 2));
      if (visited.has(z.id)) {
        rect(ctx, mx - 1, my, 2, 14, '#e9e9ec'); rect(ctx, mx + 1, my, 8, 6, '#3ddc84'); rect(ctx, mx + 1, my + 5, 8, 1, '#24a865');
      } else {
        rect(ctx, mx - 5, my, 11, 14, '#1d1f33'); rect(ctx, mx - 4, my + 1, 9, 12, '#ffb000');
        rect(ctx, mx - 1, my + 3, 2, 5, '#1d1f33'); rect(ctx, mx - 1, my + 9, 2, 2, '#1d1f33');
      }
    });
    // fountain sparkle
    if (!reduceMotion) for (let i = 0; i < 3; i++) {
      const a = t * 2 + i * 2.1; rect(ctx, RB.x - cx + Math.cos(a) * 8, RB.y - cy + Math.sin(a) * 8, 1, 1, '#ffffff');
    }
    // route target
    if (auto && auto.target && !auto.zone && Math.floor(t * 4) % 2 === 0) {
      const x = Math.round(auto.target.x - cx), y = Math.round(auto.target.y - cy);
      for (let i = -3; i <= 3; i++) { rect(ctx, x + i, y + i, 1, 1, '#ffb000'); rect(ctx, x + i, y - i, 1, 1, '#ffb000'); }
    }
    // particles
    particles.forEach((p) => {
      const f = 1 - p.life / p.max;
      ctx.globalAlpha = f * 0.8; rect(ctx, p.x - cx, p.y - cy, p.s, p.s, p.col);
    });
    ctx.globalAlpha = 1;
    // bike
    const idx = ((Math.round((bike.a / (Math.PI * 2)) * SPRITE_N) % SPRITE_N) + SPRITE_N) % SPRITE_N;
    const bx = Math.round(bike.x - cx - 16), by = Math.round(bike.y - cy - 16);
    ctx.drawImage(sprites.shadows[idx], bx + 2, by + 3);
    ctx.drawImage(sprites.sprites[idx], bx, by);

    drawMinimap();
  }

  function drawMinimap() {
    if (!miniBase) return;
    const mw = mini.width, mh = mini.height, fx = mw / W, fy = mh / H;
    mctx.drawImage(miniBase, 0, 0);
    mctx.strokeStyle = 'rgba(255,255,255,0.8)'; mctx.lineWidth = 1;
    mctx.strokeRect(Math.round(cam.x * fx) + 0.5, Math.round(cam.y * fy) + 0.5, Math.round(vw * fx), Math.round(vh * fy));
    ZONES.forEach((z) => {
      mctx.fillStyle = visited.has(z.id) ? '#3ddc84' : '#ffb000';
      mctx.fillRect(Math.round(z.x * fx) - 3, Math.round(z.y * fy) - 3, 6, 6);
    });
    if (Math.floor(t * 3) % 2 === 0 || reduceMotion) {
      mctx.fillStyle = '#ffffff'; mctx.fillRect(Math.round(bike.x * fx) - 2, Math.round(bike.y * fy) - 2, 5, 5);
      mctx.fillStyle = '#ff4fd8'; mctx.fillRect(Math.round(bike.x * fx) - 1, Math.round(bike.y * fy) - 1, 3, 3);
    }
  }

  function loop(now) {
    if (!active) { running = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!paused) { t += dt; update(dt); }
    draw();
    requestAnimationFrame(loop);
  }

  window.Game = G;
})();
