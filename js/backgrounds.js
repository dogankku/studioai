// Arka planlar: hazır temalar, renk/gradyan, görsel ve video + üst katmanlar

export const THEMES = {
  gece:      { name: 'Gece',       text: '#f6f1e4', accent: '#e8c46a', sub: '#b8c2d8', dark: true,  particles: 'stars', swatch: 'linear-gradient(160deg,#070b1d,#22355e)' },
  altin:     { name: 'Altın',      text: '#f7ecd2', accent: '#e2b85c', sub: '#c9b591', dark: true,  particles: 'dust',  swatch: 'radial-gradient(circle at 50% 40%,#3d2c10,#0d0a06)' },
  zumrut:    { name: 'Zümrüt',     text: '#effaf4', accent: '#e9cf7d', sub: '#a9d3c3', dark: true,  particles: 'dust',  swatch: 'linear-gradient(160deg,#021712,#0d4a3d)' },
  gunbatimi: { name: 'Gün batımı', text: '#fff7ef', accent: '#ffd59a', sub: '#ffe1d0', dark: true,  particles: 'bokeh', swatch: 'linear-gradient(170deg,#1f0b45,#b8406a,#f4a261)' },
  aurora:    { name: 'Aurora',     text: '#f2fbff', accent: '#9ff5d0', sub: '#bcd6e6', dark: true,  particles: 'stars', swatch: 'linear-gradient(160deg,#050a18,#0e3b4a,#1d6b5a)' },
  okyanus:   { name: 'Okyanus',    text: '#f0f8ff', accent: '#ffe3a3', sub: '#b6d4ea', dark: true,  particles: 'bokeh', swatch: 'linear-gradient(180deg,#0a4f7a,#06223f)' },
  bordo:     { name: 'Bordo',      text: '#fbefe9', accent: '#e9c27a', sub: '#dcb9b0', dark: true,  particles: 'dust',  swatch: 'radial-gradient(circle at 50% 40%,#5a1426,#1c050b)' },
  sade:      { name: 'Sade',       text: '#2a2118', accent: '#a5792a', sub: '#6d5e4c', dark: false, particles: 'none',  swatch: '#f4eee2' }
};

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export function hex2rgb(h) { h = (h || '#000000').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
export function rgba(h, a) { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }
export function mix(a, b, k) { const A = hex2rgb(a), B = hex2rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; }
export function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

const particleCache = new Map();
function particles(W, H) {
  const key = W + 'x' + H;
  if (particleCache.has(key)) return particleCache.get(key);
  const r = rng(7);
  const p = {
    stars: Array.from({ length: 170 }, () => ({ x: r() * W, y: r() * H * 0.9, s: 0.6 + r() * 2.2, ph: r() * 6.28, sp: 0.6 + r() * 2 })),
    dust: Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * H, s: 1 + r() * 3.5, sp: 0.012 + r() * 0.03, ph: r() * 6.28, dr: (r() - .5) * 30 })),
    bokeh: Array.from({ length: 22 }, () => ({ x: r() * W, y: r() * H, s: 18 + r() * 60, sp: 0.004 + r() * 0.012, ph: r() * 6.28, dr: (r() - .5) * 60 }))
  };
  particleCache.set(key, p);
  return p;
}

function starPoly(ctx, cx, cy, R, rot, pts = 8, skip = 3) {
  ctx.beginPath();
  for (let i = 0; i <= pts; i++) { const k = (i * skip) % pts, a = rot + k * Math.PI * 2 / pts; const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.closePath();
}
function rosette(ctx, cx, cy, R, t, color, alpha) {
  ctx.save(); ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = Math.max(1.2, R * 0.004);
  for (let k = 0; k < 5; k++) { starPoly(ctx, cx, cy, R * (1 - k * 0.17), t * (k % 2 ? -0.05 : 0.04) + k * 0.2); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
function drawParticles(ctx, kind, W, H, t, color) {
  const P = particles(W, H);
  if (kind === 'stars') {
    for (const s of P.stars) { ctx.fillStyle = `rgba(255,248,225,${0.25 + 0.75 * Math.pow(Math.sin(t * s.sp + s.ph), 2)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2); ctx.fill(); }
  } else if (kind === 'dust') {
    for (const d of P.dust) {
      const y = ((d.y - t * d.sp * H) % H + H) % H, x = d.x + Math.sin(t * 0.6 + d.ph) * d.dr;
      ctx.fillStyle = rgba(color, 0.55 * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + d.ph))));
      ctx.beginPath(); ctx.arc(x, y, d.s, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'bokeh') {
    for (const d of P.bokeh) {
      const y = ((d.y - t * d.sp * H) % (H + 200) + H + 200) % (H + 200) - 100, x = d.x + Math.sin(t * 0.3 + d.ph) * d.dr;
      const g = ctx.createRadialGradient(x, y, 0, x, y, d.s);
      const a = 0.10 + 0.08 * Math.sin(t * 0.7 + d.ph);
      g.addColorStop(0, rgba(color, a)); g.addColorStop(0.7, rgba(color, a * 0.6)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, d.s, 0, Math.PI * 2); ctx.fill();
    }
  }
}
function vignette(ctx, W, H, a) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
function rad(ctx, x, y, r, stops) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }

function themeBG(ctx, key, W, H, t) {
  const m = Math.min(W, H);
  switch (key) {
    case 'gece':
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#070b1d'], [.6, '#132041'], [1, '#22355e']]); ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = rad(ctx, W * .5, H * .12, m * .55, [[0, 'rgba(232,196,106,.22)'], [1, 'rgba(232,196,106,0)']]); ctx.fillRect(0, 0, W, H);
      break;
    case 'altin': {
      ctx.fillStyle = '#0d0a06'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = rad(ctx, W / 2, H * .45, Math.max(W, H) * .6, [[0, '#3d2c10'], [1, 'rgba(13,10,6,0)']]); ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.strokeStyle = 'rgba(226,184,92,.06)'; ctx.lineWidth = 1.5;
      const c = m * .18, off = (t * 8) % c;
      for (let y = -c; y < H + c; y += c) for (let x = -c; x < W + c; x += c) { starPoly(ctx, x + off * .3, y + off, c * .42, 0); ctx.stroke(); }
      ctx.restore();
      break;
    }
    case 'zumrut':
      ctx.fillStyle = lin(ctx, 0, 0, W, H, [[0, '#021712'], [1, '#0d4a3d']]); ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = rad(ctx, W * .5, H * .42, m * .7, [[0, 'rgba(120,220,180,.16)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(0, 0, W, H);
      break;
    case 'gunbatimi': {
      const s = Math.sin(t * .25) * .06;
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#1f0b45'], [.5 + s, '#b8406a'], [1, '#f4a261']]); ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = rad(ctx, W / 2, H * .98, m * .8, [[0, 'rgba(255,214,150,.55)'], [1, 'rgba(255,214,150,0)']]); ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'aurora': {
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#03060f'], [1, '#0a1f2e']]); ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const bands = [['#2de2a6', .0, .22], ['#3aa8ff', 1.7, .3], ['#b06cff', 3.1, .38]];
      for (const [col, ph, yb] of bands) {
        ctx.beginPath();
        const yc = H * yb;
        ctx.moveTo(0, yc);
        for (let x = 0; x <= W; x += W / 24) ctx.lineTo(x, yc + Math.sin(x / W * 5 + t * .5 + ph) * H * .05 + Math.sin(x / W * 11 - t * .3) * H * .02);
        ctx.lineTo(W, yc + H * .35); ctx.lineTo(0, yc + H * .35); ctx.closePath();
        ctx.fillStyle = lin(ctx, 0, yc - H * .05, 0, yc + H * .35, [[0, rgba(col, .0)], [.12, rgba(col, .28)], [1, rgba(col, 0)]]);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'okyanus': {
      ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#0c5b88'], [.45, '#083a63'], [1, '#03142a']]); ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const x = W * (i / 6) + Math.sin(t * .3 + i) * W * .05, w = W * (.05 + .04 * Math.sin(i * 2.1 + t * .4) ** 2);
        ctx.beginPath(); ctx.moveTo(x - w * .3, 0); ctx.lineTo(x + w * .3, 0); ctx.lineTo(x + w * 2, H * .85); ctx.lineTo(x - w * 2, H * .85); ctx.closePath();
        ctx.fillStyle = lin(ctx, 0, 0, 0, H * .85, [[0, 'rgba(180,230,255,.13)'], [1, 'rgba(180,230,255,0)']]); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(200,235,255,.06)'; ctx.lineWidth = 2;
      for (let k = 0; k < 9; k++) {
        ctx.beginPath(); const y0 = H * (.08 + k * .03);
        for (let x = 0; x <= W; x += W / 30) ctx.lineTo(x, y0 + Math.sin(x / W * 9 + t * 1.2 + k) * H * .006);
        ctx.stroke();
      }
      break;
    }
    case 'bordo':
      ctx.fillStyle = '#1c050b'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = rad(ctx, W / 2 + Math.sin(t * .2) * W * .05, H * .42, Math.max(W, H) * .65, [[0, '#6a1a2e'], [1, 'rgba(28,5,11,0)']]); ctx.fillRect(0, 0, W, H);
      break;
    default: // sade
      ctx.fillStyle = '#f4eee2'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = rad(ctx, W / 2, H / 2, Math.max(W, H) * .7, [[0, 'rgba(255,255,255,.7)'], [1, 'rgba(200,180,140,.18)']]); ctx.fillRect(0, 0, W, H);
  }
}

function colorBG(ctx, S, W, H, t) {
  if (S.colorMode === 'solid') { ctx.fillStyle = S.color1; ctx.fillRect(0, 0, W, H); return; }
  const ang = (S.gradAngle + (S.gradAnimate ? t * 6 : 0)) * Math.PI / 180;
  const R = Math.hypot(W, H) / 2, cx = W / 2, cy = H / 2;
  const dx = Math.cos(ang) * R, dy = Math.sin(ang) * R;
  const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  g.addColorStop(0, S.color1); g.addColorStop(1, S.color2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function drawCover(ctx, el, sw, sh, W, H, zoom = 1, panX = 0, panY = 0) {
  if (!sw || !sh) return false;
  const sc = Math.max(W / sw, H / sh) * zoom;
  const dw = sw * sc, dh = sh * sc;
  const x = (W - dw) / 2 + panX * (dw - W) / 2, y = (H - dh) / 2 + panY * (dh - H) / 2;
  ctx.drawImage(el, x, y, dw, dh);
  return true;
}

function mediaBG(ctx, sc, t) {
  const { W, H, S, media, index, dur } = sc;
  if (!media) return false;
  const blur = S.blur * Math.min(W, H) / 1080;
  ctx.save();
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  let ok;
  const extra = blur > 0 ? 1.06 : 1;
  if (media.type === 'video') {
    const v = media.el;
    ok = v.readyState >= 2 && drawCover(ctx, v, v.videoWidth, v.videoHeight, W, H, extra);
  } else {
    const img = media.el;
    let zoom = extra, px = 0, py = 0;
    if (S.kenburns) {
      const p = clamp(t / Math.max(1, dur));
      zoom = extra * (1.02 + 0.13 * p);
      const dir = index % 4;
      px = [-.6, .6, 0, 0][dir] * (p - .5) * 2 * .8; py = [0, 0, -.6, .6][dir] * (p - .5) * 2 * .8;
    }
    ok = drawCover(ctx, img, img.naturalWidth, img.naturalHeight, W, H, zoom, px, py);
  }
  ctx.restore();
  return ok;
}

export function drawBackground(ctx, sc, t) {
  const { W, H, S, palette } = sc;
  const m = Math.min(W, H);
  let usedTheme = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (S.bgSource === 'color') colorBG(ctx, S, W, H, t);
  else if (S.bgSource === 'media' && sc.media) { if (!mediaBG(ctx, sc, t)) themeBG(ctx, S.theme, W, H, t), usedTheme = true; }
  else { themeBG(ctx, S.theme, W, H, t); usedTheme = true; }

  // karartma
  const dim = S.bgSource === 'theme' ? S.dim * 0.3 : S.dim;
  if (dim > 0) { ctx.fillStyle = palette.dark ? `rgba(0,0,0,${dim})` : `rgba(255,255,255,${dim})`; ctx.fillRect(0, 0, W, H); }

  // parçacıklar
  let pk = S.particles;
  if (pk === 'auto') pk = usedTheme ? THEMES[S.theme].particles : 'none';
  if (pk && pk !== 'none') drawParticles(ctx, pk, W, H, t, palette.dark ? '#fff1d6' : palette.accent);

  if (S.pattern) rosette(ctx, W / 2, H * .47, m * .48, t, palette.accent, palette.dark ? .08 : .07);
  if (S.vignette && palette.dark) vignette(ctx, W, H, .55);

  if (S.frame) {
    const inset = m * .035;
    ctx.save(); ctx.strokeStyle = rgba(palette.accent, .45); ctx.lineWidth = Math.max(2, m * .002);
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
    const i2 = inset + m * .012;
    ctx.strokeStyle = rgba(palette.accent, .2); ctx.strokeRect(i2, i2, W - i2 * 2, H - i2 * 2);
    ctx.restore();
  }
}

export function seekVideo(v, t) {
  return new Promise(res => {
    if (!v.duration || !isFinite(v.duration)) return res();
    const target = ((t % v.duration) + v.duration) % v.duration;
    if (Math.abs(v.currentTime - target) < 0.004 && v.readyState >= 2) return res();
    let done = false;
    const fin = () => { if (done) return; done = true; v.removeEventListener('seeked', fin); res(); };
    v.addEventListener('seeked', fin);
    v.currentTime = target;
    setTimeout(fin, 2000);
  });
}
