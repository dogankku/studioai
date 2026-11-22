// Sahne yerleşimi ve kare çizimi
import { THEMES, clamp, rgba, mix, drawBackground } from './backgrounds.js?v=202611221646';

const STRONG_RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const STRONG_LTR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;
export const isRTL = s => STRONG_RTL.test(s || '');
const wdir = w => STRONG_RTL.test(w) ? 'rtl' : STRONG_LTR.test(w) ? 'ltr' : null;
export function rtlRatio(text) {
  let r = 0, l = 0;
  for (const w of (text || '').split(/\s+/)) { const d = wdir(w); if (d === 'rtl') r++; else if (d === 'ltr') l++; }
  return r + l ? r / (r + l) : 0;
}
export const isMostlyRTL = t => rtlRatio(t) > 0.5;
export const wordsOf = t => (t || '').trim().split(/\s+/).filter(Boolean);

const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeInOut = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const mctx = document.createElement('canvas').getContext('2d');

export const FORMATS = { '9:16': [9, 16], '16:9': [16, 9], '1:1': [1, 1], '4:5': [4, 5] };
export function dims(format, res) {
  const [a, b] = FORMATS[format] || FORMATS['9:16'];
  const short = +res, long = Math.round(short * Math.max(a, b) / Math.min(a, b) / 2) * 2;
  return a < b ? [short, long] : a > b ? [long, short] : [short, short];
}

/**
 * Metni satırlara böler. Her kelime kendi yönü ve yazı tipiyle ölçülür (Arapça + Latin karışık olabilir).
 * fam: {latin, ar, wLatin, wAr}
 */
function layoutBlock(text, fam, maxW, maxH, maxSize, minSize, lhMul) {
  const blockRtl = isMostlyRTL(text);
  const arScale = blockRtl ? 1 : 1.2, latScale = blockRtl ? 0.8 : 1;
  const paras = text.trim().split(/\n+/).map(p => p.trim()).filter(Boolean);
  let size = Math.round(maxSize);
  for (;;) {
    const space = size * 0.27;
    const lines = [];
    for (const p of paras) {
      const ws = wordsOf(p);
      const pdir = ws.map(wdir).find(Boolean) || 'ltr';
      let prev = pdir, line = [], w = 0;
      for (const word of ws) {
        const dir = wdir(word) || prev; prev = dir;
        const font = dir === 'rtl'
          ? `${fam.wAr} ${Math.round(size * arScale)}px ${fam.ar}`
          : `${fam.wLatin} ${Math.round(size * latScale)}px ${fam.latin}`;
        mctx.font = font;
        const ww = mctx.measureText(word).width;
        if (line.length && w + space + ww > maxW) { lines.push({ words: line, width: w, pdir }); line = []; w = 0; }
        w = line.length ? w + space + ww : ww;
        line.push({ text: word, w: ww, dir, font });
      }
      if (line.length) lines.push({ words: line, width: w, pdir });
    }
    const lh = size * lhMul, h = lines.length * lh;
    const widest = Math.max(0, ...lines.map(l => l.width));
    if ((h <= maxH && widest <= maxW * 1.001) || size <= minSize) return { size, lines, lh, height: h, space, rtl: blockRtl };
    size = Math.max(minSize, Math.floor(size * 0.94));
  }
}

/** Satırları yerleştirir; yön değişen kelime grupları kendi içinde doğru sırada kalır. */
function placeBlock(L, cx, top, align = 'center') {
  const words = []; let gi = 0, chars = 0;
  const put = (w, x, align, li, y) => {
    words.push({ ...w, x, align, cxw: align === 'left' ? x + w.w / 2 : x - w.w / 2, y, line: li, i: gi++, c0: chars });
    chars += w.text.length;
  };
  L.lines.forEach((ln, li) => {
    const y = top + L.lh * (li + 0.5);
    const runs = [];
    for (const w of ln.words) { if (!runs.length || runs[runs.length - 1].dir !== w.dir) runs.push({ dir: w.dir, words: [] }); runs[runs.length - 1].words.push(w); }
    const runW = r => r.words.reduce((a, w) => a + w.w, 0) + L.space * (r.words.length - 1);
    if (ln.pdir === 'rtl') {
      let x = cx + ln.width / 2;
      for (const r of runs) {
        if (r.dir === 'rtl') for (const w of r.words) { put(w, x, 'right', li, y); x -= w.w + L.space; }
        else { const s = x - runW(r); let xx = s; for (const w of r.words) { put(w, xx, 'left', li, y); xx += w.w + L.space; } x = s - L.space; }
      }
    } else {
      let x = align === 'left' ? cx : cx - ln.width / 2;
      for (const r of runs) {
        if (r.dir !== 'rtl') for (const w of r.words) { put(w, x, 'left', li, y); x += w.w + L.space; }
        else { const e = x + runW(r); let xx = e; for (const w of r.words) { put(w, xx, 'right', li, y); xx -= w.w + L.space; } x = e + L.space; }
      }
    }
  });
  L.words = words; L.chars = chars; L.top = top;
  return L;
}

function cardLayout(text, S, W, H, m) {
  if (!text) return null;
  const rtl = isMostlyRTL(text);
  const fam = { latin: S.latinFont, ar: `${S.arabicFont}, Amiri, serif`, wLatin: '700', wAr: '700' };
  const L = layoutBlock(text, fam, W * 0.8, H * 0.42, m * 0.085 * (rtl ? 1.3 : 1) * S.size, 20, rtl ? 1.85 : 1.3);
  return placeBlock(L, W / 2, H * 0.5 - L.height / 2);
}

/**
 * item: {main, sub, src, tag, timing}; S: ayarlar (öğe ayarları birleştirilmiş)
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

  const mainRTL = isMostlyRTL(main), subRTL = isMostlyRTL(sub);
  const arFam = `${S.arabicFont}, Amiri, serif`;
  const nWords = wordsOf(main).length;
  const bigWord = nWords <= 2 && main.length <= 14;
  let mainMax = m * (bigWord ? 0.22 : 0.11) * S.size * (mainRTL ? 1.25 : 1);
  if (!portrait) mainMax *= 0.9;
  if (S.position !== 'center') mainMax *= 0.85;
  const heavy = /Inter|Montserrat|Bebas|Oswald/.test(S.latinFont);
  const famMain = { latin: S.latinFont, ar: arFam, wLatin: heavy ? '800' : '700', wAr: '700' };
  const famSub = { latin: S.subFont, ar: arFam, wLatin: '500', wAr: '400' };

  const mainBoxH = sub ? avail * 0.56 : avail;
  const L1 = main ? layoutBlock(main, famMain, maxW, mainBoxH, mainMax, 18, mainRTL ? 1.85 : isRTL(main) ? 1.5 : 1.28) : null;
  let L2 = null; const gap = (sub && main) ? m * 0.07 : 0;
  if (sub) {
    const subBoxH = avail - (L1 ? L1.height : 0) - gap;
    const subMax = Math.min(m * 0.052 * S.size * (subRTL ? 1.2 : 1), (L1 ? L1.size : 999) * 0.75);
    L2 = layoutBlock(sub, famSub, maxW * 0.95, Math.max(subBoxH, m * 0.08), subMax, 16, subRTL ? 1.8 : isRTL(sub) ? 1.55 : 1.45);
  }
  const total = (L1 ? L1.height : 0) + (L2 ? gap + L2.height : 0);
  let y = top0 + (avail - total) / 2;
  const blockTop = y;
  if (L1) { placeBlock(L1, W / 2, y); y += L1.height; }
  const divY = y + gap / 2;
  if (L2) { y += gap; placeBlock(L2, W / 2, y); y += L2.height; }
  const blockBottom = y;

  // --- ana bölüm zaman çizelgesi (yerel saniye) ---
  const intro = 0.9, outro = 0.7, hold = +S.hold;
  const n1 = L1 ? L1.words.length : 0, n2 = L2 ? L2.words.length : 0;
  let d1 = n1 ? Math.max(bigWord ? 1.2 : 1.0, n1 * S.speed * (mainRTL ? 1.4 : 1)) : 0;
  let d2 = n2 ? Math.max(0.9, n2 * S.speed * 0.8 * (subRTL ? 1.4 : 1)) : 0;
  let t1 = intro, g = (n1 && n2) ? 0.5 : 0;
  let timing = null;
  const T = item.timing;
  if (Array.isArray(T) && n1 && T.length === n1 && T.every(Number.isFinite)) {
    timing = T;
    t1 = T[0];
    const avgGap = n1 > 1 ? (T[n1 - 1] - T[0]) / (n1 - 1) : 0.6;
    d1 = T[n1 - 1] - T[0] + Math.max(0.4, avgGap);
    g = n2 ? 0.2 : 0;
  }
  let t2 = t1 + d1 + g;
  let mainDur = t2 + d2 + 0.5 + hold + outro;
  let target = null;
  if (S.durMode === 'audio' && extra.audioDur > 0) target = extra.audioDur;
  if (S.durMode === 'fixed') target = +S.fixedDur;
  if (target) {
    if (timing) {
      // senkronlu: kelime zamanları sabit, yalnızca alt metin ve bekleme uyarlanır
      const room = target - t2 - outro - 0.5;
      if (room < d2 + 0.6) d2 = Math.max(0.6, Math.min(d2, room - 0.6));
      mainDur = Math.max(target, t2 + d2 + 0.6 + outro);
    } else {
      const fixed = intro + g + 0.5 + Math.min(hold, Math.max(1, target * 0.15)) + outro;
      const k = (target - fixed) / Math.max(0.01, d1 + d2);
      const kk = k > 0.1 ? k : 0.1;
      d1 *= kk; d2 *= kk; t2 = t1 + d1 + g;
      mainDur = target;
    }
  }

  // --- giriş / kapanış kartları ---
  const introCard = (S.introText || '').trim() && +S.introDur > 0 ? cardLayout(S.introText.trim(), S, W, H, m) : null;
  const outroCard = (S.outroText || '').trim() && +S.outroDur > 0 ? cardLayout(S.outroText.trim(), S, W, H, m) : null;
  const offset = introCard ? +S.introDur : 0;
  const outroDur = outroCard ? +S.outroDur : 0;

  return {
    W, H, m, portrait, S, palette, tag, src, handle, L1, L2, divY, blockTop, blockBottom,
    t1, d1, t2, d2, tSrc: t2 + d2 + 0.25, mainDur, outro, timing,
    introCard, outroCard, offset, outroDur, dur: offset + mainDur + outroDur,
    index: extra.index || 0, media: extra.media || null, logo: extra.logo || null
  };
}

function drawBlock(ctx, sc, L, t, start, dur, style, isMain, timing) {
  if (!L) return;
  const P = sc.palette;
  const n = L.words.length, step = n > 1 ? dur / n : dur;
  const nl = L.lines.length, lstep = nl > 0 ? dur / nl : dur;
  ctx.textBaseline = 'middle';
  const shadow = P.dark && sc.S.shadow;
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = L.size * 0.35; ctx.shadowOffsetY = L.size * 0.05; }
  const baseCol = isMain ? P.text : P.sub;
  const appearOf = w => timing ? timing[w.i] : style === 'line' ? start + w.line * lstep : start + w.i * step;
  const stepOf = w => timing ? Math.max(0.15, (timing[w.i + 1] ?? (timing[w.i] + 0.6)) - timing[w.i]) : step;

  if (style === 'type' && !timing) {
    const vis = clamp((t - start) / Math.max(0.01, dur)) * L.chars;
    for (const w of L.words) {
      const k = clamp(vis - w.c0, 0, w.text.length); if (k <= 0) continue;
      ctx.font = w.font; ctx.direction = w.dir; ctx.globalAlpha = 1; ctx.fillStyle = baseCol; ctx.textAlign = w.align;
      ctx.fillText(w.text.slice(0, Math.ceil(k)), w.x, w.y);
    }
    if (t >= start && t < start + dur + 0.8 && Math.floor(t * 2.5) % 2 === 0) {
      const cur = L.words.find(w => vis < w.c0 + w.text.length) || L.words[n - 1];
      if (cur) {
        ctx.font = cur.font; ctx.direction = cur.dir;
        const k = clamp(vis - cur.c0, 0, cur.text.length);
        const part = ctx.measureText(cur.text.slice(0, Math.ceil(k))).width;
        const cx = cur.align === 'left' ? cur.x + part + L.size * 0.08 : cur.x - part - L.size * 0.08;
        ctx.shadowBlur = 0; ctx.fillStyle = P.accent; ctx.fillRect(cx, cur.y - L.size * 0.5, Math.max(3, L.size * 0.06), L.size);
      }
    }
  } else {
    for (const w of L.words) {
      const appear = appearOf(w), life = t - appear;
      ctx.font = w.font; ctx.direction = w.dir; ctx.textAlign = w.align;
      if (style === 'karaoke') {
        const blockIn = clamp((t - ((timing ? timing[0] : start) - 0.6)) / 0.6);
        if (blockIn <= 0) continue;
        const st = stepOf(w);
        const lit = clamp(life / Math.max(0.12, st * 0.9));
        ctx.globalAlpha = blockIn * (0.28 + 0.72 * lit);
        ctx.fillStyle = lit <= 0 ? baseCol : (life < st * 1.6 ? P.accent : mix(P.accent, baseCol, clamp((life - st * 1.6) / 0.8)));
        ctx.fillText(w.text, w.x, w.y);
        continue;
      }
      if (style === 'fade' && !timing) {
        const p = clamp((t - start) / 1.0); if (p <= 0) continue;
        ctx.globalAlpha = easeInOut(p); ctx.fillStyle = baseCol;
        ctx.fillText(w.text, w.x, w.y + (1 - easeOut(p)) * L.size * 0.15);
        continue;
      }
      const p = clamp(life / (timing ? 0.35 : 0.6)); if (p <= 0) continue;
      const e = easeOut(p);
      ctx.globalAlpha = e;
      ctx.fillStyle = isMain ? mix(P.accent, baseCol, clamp((life - (timing ? stepOf(w) : 0.15)) / 0.9)) : baseCol;
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

const layers = new WeakMap();
function withAlpha(ctx, a, fn) {
  if (a >= 0.999) { fn(ctx); return; }
  if (a <= 0.001) return;
  const c = ctx.canvas;
  let layer = layers.get(c);
  if (!layer) { layer = document.createElement('canvas'); layers.set(c, layer); }
  if (layer.width !== c.width || layer.height !== c.height) { layer.width = c.width; layer.height = c.height; }
  const l = layer.getContext('2d'); l.setTransform(1, 0, 0, 1, 0, 0); l.clearRect(0, 0, layer.width, layer.height);
  fn(l);
  ctx.save(); ctx.globalAlpha = a; ctx.drawImage(layer, 0, 0); ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

function panelRect(ctx, sc, top, bottom, a) {
  const { S, W, m, palette } = sc;
  const x = W * 0.06, w = W * 0.88, r = m * 0.03;
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

function drawPanel(ctx, sc, t, a) {
  if (sc.S.panel === 'none' || a <= 0) return;
  const m = sc.m, padY = m * 0.06;
  const top = (sc.tag ? Math.min(sc.blockTop, sc.tagY - m * 0.02) : sc.blockTop) - padY;
  // kutu, alt metin ve kaynak belirdikçe aşağı doğru büyür
  const l1b = sc.L1 ? sc.L1.top + sc.L1.height : sc.blockTop;
  let bottom = l1b;
  if (sc.L2) bottom = l1b + (sc.blockBottom - l1b) * easeInOut(clamp((t - (sc.t2 - 0.7)) / 0.6));
  if (sc.src) bottom = bottom + (Math.max(bottom, sc.srcY + m * 0.03) - bottom) * easeInOut(clamp((t - (sc.tSrc - 0.3)) / 0.6));
  panelRect(ctx, sc, top, bottom + padY, a);
}

function drawCard(ctx, sc, L, lt, dur) {
  if (!L) return;
  const P = sc.palette, m = sc.m, W = sc.W;
  const a = Math.min(easeOut(clamp(lt / 0.5)), 1 - clamp((lt - (dur - 0.5)) / 0.5));
  if (a <= 0) return;
  const s = 0.96 + 0.04 * easeOut(clamp(lt / 0.8));
  ctx.save();
  ctx.translate(W / 2, sc.H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -sc.H / 2);
  ctx.globalAlpha = a;
  if (P.dark && sc.S.shadow) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = L.size * .35; }
  ctx.textBaseline = 'middle'; ctx.fillStyle = P.text;
  for (const w of L.words) { ctx.font = w.font; ctx.direction = w.dir; ctx.textAlign = w.align; ctx.fillText(w.text, w.x, w.y); }
  ctx.shadowColor = 'transparent'; ctx.direction = 'ltr';
  const lw = m * 0.12 * easeOut(clamp(lt / 0.9)), d = m * 0.008;
  ctx.strokeStyle = rgba(P.accent, .8); ctx.fillStyle = P.accent; ctx.lineWidth = Math.max(1.5, m * .0016);
  for (const y of [L.top - m * 0.05, L.top + L.height + m * 0.05]) {
    ctx.beginPath(); ctx.moveTo(W / 2 - d * 2.4, y); ctx.lineTo(W / 2 - d * 2.4 - lw, y); ctx.moveTo(W / 2 + d * 2.4, y); ctx.lineTo(W / 2 + d * 2.4 + lw, y); ctx.stroke();
    ctx.save(); ctx.translate(W / 2, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-d, -d, d * 2, d * 2); ctx.restore();
  }
  ctx.restore();
}

function drawHandle(ctx, sc, a) {
  if (!sc.handle || a <= 0) return;
  const fs = sc.m * 0.024;
  ctx.save(); ctx.font = `600 ${fs}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = a; ctx.fillStyle = sc.palette.sub;
  ctx.fillText(sc.handle, sc.W / 2, sc.H * (sc.portrait ? 0.94 : 0.925));
  ctx.restore();
}

function drawMain(ctx, sc, t) {
  const { W, H, m, palette: P, S } = sc;
  const out = 1 - clamp((t - (sc.mainDur - sc.outro)) / sc.outro);
  const inn = sc.offset ? easeOut(clamp(t / 0.4)) : 1;
  const A = out * inn;

  sc.tagY = sc.blockTop - m * (sc.portrait ? 0.09 : 0.08);
  if (S.position === 'center') sc.tagY = H * (sc.portrait ? 0.115 : 0.11);
  sc.srcY = Math.min(H * (sc.portrait ? 0.885 : 0.87), sc.blockBottom + m * 0.075);

  drawPanel(ctx, sc, t, easeOut(clamp(t / 0.6)) * A);

  if (sc.tag) {
    const a = easeOut(clamp((t - 0.15) / 0.7)) * A;
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

  withAlpha(ctx, A, c => drawBlock(c, sc, sc.L1, t, sc.t1, sc.d1, S.anim, true, sc.timing));

  if (sc.L1 && sc.L2) {
    const p = easeInOut(clamp((t - (sc.t2 - 0.5)) / 0.7));
    if (p > 0) {
      ctx.save(); ctx.globalAlpha = A; const y = sc.divY, half = m * 0.12 * p, d = m * 0.009;
      ctx.strokeStyle = rgba(P.accent, 0.75); ctx.fillStyle = P.accent; ctx.lineWidth = Math.max(1.5, m * 0.0016);
      ctx.beginPath(); ctx.moveTo(W / 2 - d * 2.2, y); ctx.lineTo(W / 2 - d * 2.2 - half, y); ctx.moveTo(W / 2 + d * 2.2, y); ctx.lineTo(W / 2 + d * 2.2 + half, y); ctx.stroke();
      ctx.translate(W / 2, y); ctx.rotate(Math.PI / 4); ctx.globalAlpha = A * p; ctx.fillRect(-d, -d, d * 2, d * 2);
      ctx.restore();
    }
  }
  let subStyle = S.anim === 'kinetic' ? 'word' : S.anim;
  if (sc.timing && subStyle === 'karaoke') subStyle = 'word';
  withAlpha(ctx, A, c => drawBlock(c, sc, sc.L2, t, sc.t2, sc.d2, subStyle, false, null));

  if (sc.src) {
    const a = easeOut(clamp((t - sc.tSrc) / 0.7)) * A;
    if (a > 0) {
      const fs = m * 0.032;
      ctx.save(); ctx.font = `italic 500 ${fs}px Lora, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = a; ctx.fillStyle = P.accent;
      if (P.dark && S.shadow) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = fs * .4; }
      ctx.fillText('— ' + sc.src + ' —', W / 2, sc.srcY + (1 - a) * fs * 0.4);
      ctx.restore();
    }
  }
  drawHandle(ctx, sc, clamp((t - 0.5) / 0.8) * A * 0.8);
}

export function drawFrame(ctx, sc, t) {
  const { W, H, m, S } = sc;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  drawBackground(ctx, sc, t);
  const mainEnd = sc.offset + sc.mainDur;
  if (t < sc.offset) drawCard(ctx, sc, sc.introCard, t, sc.offset);
  else if (t < mainEnd) drawMain(ctx, sc, t - sc.offset);
  else { drawCard(ctx, sc, sc.outroCard, t - mainEnd, sc.outroDur); drawHandle(ctx, sc, 0.8 * clamp((t - mainEnd) / 0.6) * (1 - clamp((t - (sc.dur - 0.5)) / 0.5))); }

  if (sc.logo && sc.logo.naturalWidth) {
    const lw = m * S.logoSize, lh = lw * sc.logo.naturalHeight / sc.logo.naturalWidth;
    const pad = m * 0.065, pos = S.logoPos;
    const x = pos.includes('l') ? pad : pos.includes('r') ? W - pad - lw : (W - lw) / 2;
    const y = pos.includes('t') ? pad : H - pad - lh;
    const a = clamp(t / 0.8) * (1 - clamp((t - (sc.dur - 0.6)) / 0.6));
    ctx.save(); ctx.globalAlpha = S.logoOpacity * a; ctx.drawImage(sc.logo, x, y, lw, lh); ctx.restore();
  }
}

/** Altyazı (SRT) metni */
export function toSRT(sc) {
  const f = s => { s = Math.max(0, s); const h = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = Math.floor(s % 60), ms = Math.round((s % 1) * 1000); return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(Math.min(ms, 999)).padStart(3, '0')}`; };
  const cues = [];
  const o = sc.offset, end = o + sc.mainDur - sc.outro;
  const txt = L => L.lines.map(l => l.words.map(w => w.text).join(' ')).join('\n');
  if (sc.introCard) cues.push([0.2, o - 0.2, txt(sc.introCard)]);
  if (sc.L1) cues.push([o + sc.t1, end, txt(sc.L1)]);
  if (sc.L2) cues.push([o + sc.t2, end, txt(sc.L2)]);
  if (sc.outroCard) cues.push([o + sc.mainDur + 0.2, sc.dur - 0.2, txt(sc.outroCard)]);
  return cues.map((c, i) => `${i + 1}\n${f(c[0])} --> ${f(c[1])}\n${c[2]}\n`).join('\n');
}

export { layoutBlock, placeBlock };
