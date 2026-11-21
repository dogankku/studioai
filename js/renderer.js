// Sahne yerleşimi ve kare çizimi
import { THEMES, clamp, rgba, mix, drawBackground } from './backgrounds.js';

const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
export const isRTL = s => RTL_RE.test(s || '');
const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeInOut = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

const mctx = document.createElement('canvas').getContext('2d');

export const FORMATS = { '9:16': [9, 16], '16:9': [16, 9], '1:1': [1, 1], '4:5': [4, 5] };
export function dims(format, res) {
  const [a, b] = FORMATS[format];
  const short = res, long = Math.round(res * Math.max(a, b) / Math.min(a, b) / 2) * 2;
  return a < b ? [short, long] : a > b ? [long, short] : [short, short];
}

function layoutBlock(text, family, weight, maxW, maxH, maxSize, minSize, lhMul) {
  const rtl = isRTL(text);
  const paras = text.trim().split(/\n+/).map(p => p.trim()).filter(Boolean);
  let size = Math.round(maxSize);
  for (;;) {
    const font = `${weight} ${size}px ${family}`;
    mctx.font = font;
    const space = mctx.measureText(' ').width;
    const lines = [];
    for (const p of paras) {
      let line = [], w = 0;
      for (const word of p.split(/\s+/).filter(Boolean)) {
        const ww = mctx.measureText(word).width;
        if (line.length && w + space + ww > maxW) { lines.push({ words: line, width: w }); line = []; w = 0; }
        w = line.length ? w + space + ww : ww;
        line.push({ text: word, w: ww });
      }
      if (line.length) lines.push({ words: line, width: w });
    }
    const lh = size * lhMul, h = lines.length * lh;
    const widest = Math.max(0, ...lines.map(l => l.width));
    if ((h <= maxH && widest <= maxW * 1.001) || size <= minSize) return { font, size, lines, lh, height: h, space, rtl };
    size = Math.max(minSize, Math.floor(size * 0.94));
  }
}
function placeBlock(L, cx, top) {
  const words = []; let gi = 0, chars = 0;
  L.lines.forEach((ln, li) => {
    const y = top + L.lh * (li + 0.5);
    let x = L.rtl ? cx + ln.width / 2 : cx - ln.width / 2;
    for (const w of ln.words) {
      const cxw = L.rtl ? x - w.w / 2 : x + w.w / 2;
      words.push({ ...w, x, cxw, y, align: L.rtl ? 'right' : 'left', line: li, i: gi++, c0: chars });
      chars += w.text.length;
      x += L.rtl ? -(w.w + L.space) : (w.w + L.space);
    }
  });
  L.words = words; L.chars = chars; L.top = top;
  return L;
}

/**
 * item: {main, sub, src, tag}; S: ayarlar
 * extra: {index, media, audioDur, logo}
 */
export function buildScene(item, S, W, H, extra = {}) {
  const portrait = H > W, square = Math.abs(W - H) < 4;
  const m = Math.min(W, H);
  const base = THEMES[S.theme] || THEMES.gece;
  const palette = { ...base, text: S.textColor || base.text, accent: S.accentColor || base.accent, sub: S.subColor || base.sub };
  if (S.bgSource !== 'theme' && S.forceDark !== undefined) palette.dark = S.forceDark;

  const tag = (item.tag || S.defaultTag || '').trim();
  const main = (item.main || '').trim(), sub = (item.sub || '').trim(), src = (item.src || '').trim();
  const handle = (S.handle || '').trim();
  const maxW = W * (portrait ? 0.80 : square ? 0.80 : 0.72);

  let top0 = H * (portrait ? 0.19 : 0.2), bot0 = H * (portrait ? 0.83 : 0.8);
  if (S.position === 'top') { top0 = H * (portrait ? 0.17 : 0.18); bot0 = H * (portrait ? 0.55 : 0.6); }
  if (S.position === 'bottom') { top0 = H * (portrait ? 0.5 : 0.42); bot0 = H * (portrait ? 0.85 : 0.82); }
  const avail = bot0 - top0;

  const mainRTL = isRTL(main), subRTL = isRTL(sub);
  const arFam = `${S.arabicFont}, Amiri, serif`;
  const mainFam = mainRTL ? arFam : S.latinFont;
  const subFam = subRTL ? arFam : S.subFont;
  const nWords = main.split(/\s+/).filter(Boolean).length;
  const bigWord = nWords <= 2 && main.length <= 14;
  let mainMax = m * (bigWord ? 0.22 : 0.11) * S.size * (mainRTL ? 1.25 : 1);
  if (!portrait) mainMax *= 0.9;
  if (S.position !== 'center') mainMax *= 0.85;
  const heavy = /Inter|Montserrat|Bebas|Oswald/.test(S.latinFont);
  const mainW = mainRTL ? '700' : (heavy ? '800' : '700');

  const mainBoxH = sub ? avail * 0.56 : avail;
  const L1 = main ? layoutBlock(main, mainFam, mainW, maxW, mainBoxH, mainMax, 22, mainRTL ? 1.85 : 1.28) : null;
  let L2 = null; const gap = (sub && main) ? m * 0.07 : 0;
  if (sub) {
    const subBoxH = avail - (L1 ? L1.height : 0) - gap;
    const subMax = Math.min(m * 0.052 * S.size * (subRTL ? 1.2 : 1), (L1 ? L1.size : 999) * 0.75);
    L2 = layoutBlock(sub, subFam, subRTL ? '400' : '500', maxW * 0.95, Math.max(subBoxH, m * 0.08), subMax, 18, subRTL ? 1.8 : 1.45);
  }
  const total = (L1 ? L1.height : 0) + (L2 ? gap + L2.height : 0);
  let y = top0 + (avail - total) / 2;
  const blockTop = y;
  if (L1) { placeBlock(L1, W / 2, y); y += L1.height; }
  const divY = y + gap / 2;
  if (L2) { y += gap; placeBlock(L2, W / 2, y); y += L2.height; }
  const blockBottom = y;

  // zaman çizelgesi
  const intro = 0.9, outro = 0.7, hold = +S.hold;
  const n1 = L1 ? L1.words.length : 0, n2 = L2 ? L2.words.length : 0;
  let d1 = n1 ? Math.max(bigWord ? 1.2 : 1.0, n1 * S.speed * (mainRTL ? 1.4 : 1)) : 0;
  let d2 = n2 ? Math.max(0.9, n2 * S.speed * 0.8 * (subRTL ? 1.4 : 1)) : 0;
  const g = (n1 && n2) ? 0.5 : 0;
  let dur = intro + d1 + g + d2 + 0.5 + hold + outro;
  let target = null;
  if (S.durMode === 'audio' && extra.audioDur > 0) target = extra.audioDur;
  if (S.durMode === 'fixed') target = +S.fixedDur;
  if (target) {
    const fixed = intro + g + 0.5 + Math.min(hold, Math.max(1, target * 0.15)) + outro;
    const k = (target - fixed) / Math.max(0.01, d1 + d2);
    if (k > 0.1) { d1 *= k; d2 *= k; }
    else { d1 *= 0.1; d2 *= 0.1; }
    dur = target;
  }
  return {
    W, H, m, portrait, S, palette, tag, src, handle, L1, L2, divY, blockTop, blockBottom,
    t1: intro, d1, t2: intro + d1 + g, d2, tSrc: intro + d1 + g + d2 + 0.25, dur, outro,
    index: extra.index || 0, media: extra.media || null, logo: extra.logo || null
  };
}

function drawBlock(ctx, sc, L, t, start, dur, style, isMain) {
  if (!L) return;
  const P = sc.palette;
  const n = L.words.length, step = n > 1 ? dur / n : dur;
  const nl = L.lines.length, lstep = nl > 0 ? dur / nl : dur;
  ctx.font = L.font; ctx.textBaseline = 'middle'; ctx.direction = L.rtl ? 'rtl' : 'ltr';
  const shadow = P.dark && sc.S.shadow;
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = L.size * 0.35; ctx.shadowOffsetY = L.size * 0.05; }
  const baseCol = isMain ? P.text : P.sub;

  if (style === 'type') {
    const vis = clamp((t - start) / Math.max(0.01, dur)) * L.chars;
    for (const w of L.words) {
      const k = clamp(vis - w.c0, 0, w.text.length); if (k <= 0) continue;
      ctx.globalAlpha = 1; ctx.fillStyle = baseCol; ctx.textAlign = w.align;
      ctx.fillText(w.text.slice(0, Math.ceil(k)), w.x, w.y);
    }
    if (t >= start && t < start + dur + 0.8 && Math.floor(t * 2.5) % 2 === 0) {
      const cur = L.words.find(w => vis < w.c0 + w.text.length) || L.words[n - 1];
      if (cur) {
        const k = clamp(vis - cur.c0, 0, cur.text.length);
        const part = ctx.measureText(cur.text.slice(0, Math.ceil(k))).width;
        const cx = cur.align === 'left' ? cur.x + part + L.size * 0.08 : cur.x - part - L.size * 0.08;
        ctx.shadowBlur = 0; ctx.fillStyle = P.accent; ctx.fillRect(cx, cur.y - L.size * 0.5, Math.max(3, L.size * 0.06), L.size);
      }
    }
  } else {
    for (const w of L.words) {
      const appear = style === 'line' ? start + w.line * lstep : start + w.i * step;
      const life = t - appear;
      ctx.textAlign = w.align;
      if (style === 'karaoke') {
        const blockIn = clamp((t - (start - 0.6)) / 0.6);
        if (blockIn <= 0) continue;
        const lit = clamp(life / Math.max(0.12, step * 0.9));
        ctx.globalAlpha = blockIn * (0.28 + 0.72 * lit);
        ctx.fillStyle = lit <= 0 ? baseCol : (life < step * 2.2 ? P.accent : mix(P.accent, baseCol, clamp((life - step * 2.2) / 0.8)));
        ctx.fillText(w.text, w.x, w.y);
        continue;
      }
      if (style === 'fade') {
        const p = clamp((t - start) / 1.0); if (p <= 0) continue;
        ctx.globalAlpha = easeInOut(p); ctx.fillStyle = baseCol;
        ctx.fillText(w.text, w.x, w.y + (1 - easeOut(p)) * L.size * 0.15);
        continue;
      }
      const p = clamp(life / 0.6); if (p <= 0) continue;
      const e = easeOut(p);
      ctx.globalAlpha = e;
      ctx.fillStyle = isMain ? mix(P.accent, baseCol, clamp((life - 0.15) / 0.9)) : baseCol;
      if (style === 'kinetic') {
        const s = 1 + (1 - e) * 0.9;
        ctx.save(); ctx.translate(w.cxw, w.y); ctx.scale(s, s); ctx.textAlign = 'center';
        ctx.fillText(w.text, 0, (1 - e) * -L.size * 0.2); ctx.restore();
      } else {
        ctx.fillText(w.text, w.x, w.y + (1 - e) * L.size * (style === 'line' ? 0.35 : 0.5));
      }
    }
  }
  ctx.globalAlpha = 1; ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.direction = 'ltr';
}

function spaced(ctx, text, x, y, sp) {
  const chars = [...text]; const ws = chars.map(c => ctx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1); let cx = x - total / 2;
  ctx.textAlign = 'left'; chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += ws[i] + sp; });
  return total;
}

let layer = null;
function withAlpha(ctx, a, fn) {
  if (a >= 0.999) { fn(ctx); return; }
  if (a <= 0.001) return;
  const c = ctx.canvas;
  if (!layer) layer = document.createElement('canvas');
  if (layer.width !== c.width || layer.height !== c.height) { layer.width = c.width; layer.height = c.height; }
  const l = layer.getContext('2d'); l.setTransform(1, 0, 0, 1, 0, 0); l.clearRect(0, 0, layer.width, layer.height);
  fn(l);
  ctx.save(); ctx.globalAlpha = a; ctx.drawImage(layer, 0, 0); ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

function drawPanel(ctx, sc, a) {
  const { S, W, H, m, palette } = sc;
  if (S.panel === 'none' || a <= 0) return;
  const padY = m * 0.06, x = W * 0.06, w = W * 0.88;
  const top = (sc.tag ? Math.min(sc.blockTop, sc.tagY) : sc.blockTop) - padY;
  const bottom = Math.max(sc.blockBottom, sc.src ? sc.srcY + m * 0.03 : 0) + padY;
  const r = m * 0.03;
  ctx.save(); ctx.globalAlpha = a;
  if (S.panel === 'glass') {
    roundRect(ctx, x, top, w, bottom - top, r); ctx.clip();
    ctx.filter = `blur(${m * 0.025}px)`; ctx.drawImage(ctx.canvas, 0, 0); ctx.filter = 'none';
    ctx.fillStyle = palette.dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.45)'; ctx.fillRect(x, top, w, bottom - top);
    ctx.restore(); ctx.save(); ctx.globalAlpha = a;
    roundRect(ctx, x, top, w, bottom - top, r); ctx.strokeStyle = rgba(palette.accent, .35); ctx.lineWidth = Math.max(1.5, m * .0015); ctx.stroke();
  } else {
    roundRect(ctx, x, top, w, bottom - top, r);
    ctx.fillStyle = palette.dark ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.7)'; ctx.fill();
  }
  ctx.restore();
}

export function drawFrame(ctx, sc, t) {
  const { W, H, m, palette: P, S } = sc;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  drawBackground(ctx, sc, t);
  const out = 1 - clamp((t - (sc.dur - sc.outro)) / sc.outro);

  sc.tagY = sc.blockTop - m * (sc.portrait ? 0.09 : 0.08);
  if (S.position === 'center') sc.tagY = H * (sc.portrait ? 0.115 : 0.11);
  const lastY = sc.blockBottom;
  sc.srcY = Math.min(H * (sc.portrait ? 0.885 : 0.87), lastY + m * 0.075);

  drawPanel(ctx, sc, easeOut(clamp(t / 0.6)) * out);

  if (sc.tag) {
    const a = easeOut(clamp((t - 0.15) / 0.7)) * out;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = P.accent; ctx.textBaseline = 'middle';
    const fs = m * 0.03; ctx.font = `600 ${fs}px Inter, sans-serif`;
    const y = sc.tagY;
    const tw = spaced(ctx, sc.tag.toLocaleUpperCase('tr'), W / 2, y, fs * 0.28);
    const lw = m * 0.07 * easeOut(clamp((t - 0.3) / 0.8));
    ctx.strokeStyle = rgba(P.accent, 0.7); ctx.lineWidth = Math.max(1.5, m * 0.0016);
    ctx.beginPath(); ctx.moveTo(W / 2 - tw / 2 - fs * 0.8, y); ctx.lineTo(W / 2 - tw / 2 - fs * 0.8 - lw, y);
    ctx.moveTo(W / 2 + tw / 2 + fs * 0.8, y); ctx.lineTo(W / 2 + tw / 2 + fs * 0.8 + lw, y); ctx.stroke();
    ctx.restore();
  }

  withAlpha(ctx, out, c => drawBlock(c, sc, sc.L1, t, sc.t1, sc.d1, S.anim, true));

  if (sc.L1 && sc.L2) {
    const p = easeInOut(clamp((t - (sc.t2 - 0.5)) / 0.7));
    if (p > 0) {
      ctx.save(); ctx.globalAlpha = out; const y = sc.divY, half = m * 0.12 * p, d = m * 0.009;
      ctx.strokeStyle = rgba(P.accent, 0.75); ctx.fillStyle = P.accent; ctx.lineWidth = Math.max(1.5, m * 0.0016);
      ctx.beginPath(); ctx.moveTo(W / 2 - d * 2.2, y); ctx.lineTo(W / 2 - d * 2.2 - half, y); ctx.moveTo(W / 2 + d * 2.2, y); ctx.lineTo(W / 2 + d * 2.2 + half, y); ctx.stroke();
      ctx.translate(W / 2, y); ctx.rotate(Math.PI / 4); ctx.globalAlpha = out * p; ctx.fillRect(-d, -d, d * 2, d * 2);
      ctx.restore();
    }
  }
  const subStyle = S.anim === 'kinetic' ? 'word' : S.anim;
  withAlpha(ctx, out, c => drawBlock(c, sc, sc.L2, t, sc.t2, sc.d2, subStyle, false));

  if (sc.src) {
    const a = easeOut(clamp((t - sc.tSrc) / 0.7)) * out;
    if (a > 0) {
      const fs = m * 0.032;
      ctx.save(); ctx.font = `italic 500 ${fs}px Lora, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = a; ctx.fillStyle = P.accent;
      if (P.dark && S.shadow) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = fs * .4; }
      ctx.fillText('— ' + sc.src + ' —', W / 2, sc.srcY + (1 - a) * fs * 0.4);
      ctx.restore();
    }
  }
  if (sc.handle) {
    const a = clamp((t - 0.5) / 0.8) * out * 0.8;
    const fs = m * 0.024;
    ctx.save(); ctx.font = `600 ${fs}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = a; ctx.fillStyle = P.sub;
    ctx.fillText(sc.handle, W / 2, H * (sc.portrait ? 0.94 : 0.925));
    ctx.restore();
  }
  if (sc.logo && sc.logo.naturalWidth) {
    const lw = m * S.logoSize, lh = lw * sc.logo.naturalHeight / sc.logo.naturalWidth;
    const pad = m * 0.065;
    const pos = S.logoPos;
    const x = pos.includes('l') ? pad : pos.includes('r') ? W - pad - lw : (W - lw) / 2;
    const y = pos.includes('t') ? pad : H - pad - lh;
    ctx.save(); ctx.globalAlpha = S.logoOpacity * clamp(t / 0.8) * out; ctx.drawImage(sc.logo, x, y, lw, lh); ctx.restore();
  }
}
