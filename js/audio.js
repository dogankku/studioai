// Ses: dosya çözme, video başına karışım, önizleme
export const SR = 48000;
let liveCtx = null;
export function live() {
  if (!liveCtx) liveCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
  if (liveCtx.state === 'suspended') liveCtx.resume();
  return liveCtx;
}

export async function decodeBlob(blob) {
  const buf = await blob.arrayBuffer();
  return await live().decodeAudioData(buf);
}

function envelope(param, { volume, fadeIn, fadeOut }, start, end, t0 = 0) {
  // start..end: sesin videodaki aralığı; t0: zaman kayması (önizlemede ctx.currentTime farkı)
  const len = end - start;
  const fi = fadeIn ? Math.min(1.0, len / 4) : 0, fo = fadeOut ? Math.min(1.5, len / 4) : 0;
  param.setValueAtTime(fi ? 0 : volume, t0 + start);
  if (fi) param.linearRampToValueAtTime(volume, t0 + start + fi);
  if (fo) { param.setValueAtTime(volume, t0 + Math.max(start + fi, end - fo)); param.linearRampToValueAtTime(0, t0 + end); }
}

/**
 * Bir videonun ses izi: toplam süre total, ses startAt anında başlar.
 * loop: ses kısa kalırsa başa sarar (müzik). Tilavette false.
 */
export async function mixFor(buffer, total, opts, startAt = 0) {
  const len = Math.max(1, Math.ceil(total * SR));
  const oc = new OfflineAudioContext(2, len, SR);
  const src = oc.createBufferSource(); src.buffer = buffer; src.loop = !!opts.loop;
  const g = oc.createGain();
  const end = opts.loop ? total : Math.min(total, startAt + buffer.duration);
  envelope(g.gain, { volume: opts.volume ?? 0.8, fadeIn: opts.fadeIn, fadeOut: opts.fadeOut }, startAt, end);
  src.connect(g).connect(oc.destination);
  src.start(startAt);
  return await oc.startRendering();
}

let current = null;
/** Önizleme: videonun 'from' saniyesinden itibaren çal */
export function playPreview(buffer, from, total, opts, startAt = 0) {
  stopPreview();
  if (!buffer) return;
  const ctx = live();
  const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = !!opts.loop;
  const g = ctx.createGain();
  const now = ctx.currentTime;
  const t0 = now - from; // video zamanı x -> ctx zamanı t0 + x
  const end = opts.loop ? total : Math.min(total, startAt + buffer.duration);
  if (from >= end) return;
  envelope(g.gain, { volume: opts.volume ?? 0.8, fadeIn: opts.fadeIn, fadeOut: opts.fadeOut }, startAt, end, t0);
  src.connect(g).connect(ctx.destination);
  const when = Math.max(now, t0 + startAt);
  const offsetInBuf = Math.max(0, from - startAt);
  src.start(when, opts.loop ? offsetInBuf % buffer.duration : offsetInBuf);
  src.stop(t0 + end + 0.05);
  current = src;
}
export function stopPreview() { if (current) { try { current.stop(); } catch (e) { } current = null; } }

/** Senkron ekranı için: baştan çal, başlangıç zamanını döndür */
export function playFromStart(buffer, at = 0) {
  stopPreview();
  const ctx = live();
  const src = ctx.createBufferSource(); src.buffer = buffer; src.connect(ctx.destination);
  const start = ctx.currentTime + 0.05;
  src.start(start, at);
  current = src;
  return { ctx, start: start - at };
}

/* ---------- çok parçalı film sesi: müzik yatağı + tilavet/seslendirme parçaları (müzik konuşmada kısılır) ---------- */
function schedule(ctx, dest, t0, from, total, { clips = [], music = null, musicVol = 0.8, fadeIn = true, fadeOut = true, duck = 0.22 }) {
  const nodes = [];
  if (music) {
    const src = ctx.createBufferSource(); src.buffer = music; src.loop = true;
    const g = ctx.createGain(); const P = g.gain; const at = x => Math.max(ctx.currentTime, t0 + x);
    const fi = fadeIn ? Math.min(1.5, total / 4) : 0, fo = fadeOut ? Math.min(2, total / 4) : 0;
    // zarf noktalarını sırayla hesapla
    const pts = [[0, fi ? 0 : musicVol], [fi, musicVol]];
    for (const c of clips) { const s = c.start, e = c.start + c.buffer.duration; pts.push([s - 0.35, musicVol], [s, musicVol * duck], [e, musicVol * duck], [e + 0.5, musicVol]); }
    pts.push([total - fo, musicVol], [total, 0]);
    pts.sort((a, b) => a[0] - b[0]);
    const val = x => { let v = pts[0][1]; for (let i = 0; i < pts.length - 1; i++) { const [a, va] = pts[i], [b, vb] = pts[i + 1]; if (x >= a && x <= b) return b > a ? va + (vb - va) * (x - a) / (b - a) : vb; if (x > b) v = vb; } return v; };
    P.setValueAtTime(val(from), at(from));
    for (const [x] of pts) if (x > from) P.linearRampToValueAtTime(val(x), t0 + x);
    src.connect(g).connect(dest);
    src.start(at(from), from % music.duration); src.stop(t0 + total + 0.05);
    nodes.push(src);
  }
  for (const c of clips) {
    const e = c.start + c.buffer.duration; if (e <= from) continue;
    const src = ctx.createBufferSource(); src.buffer = c.buffer;
    const g = ctx.createGain(); g.gain.value = c.gain ?? 1;
    src.connect(g).connect(dest);
    const off = Math.max(0, from - c.start);
    src.start(Math.max(ctx.currentTime, t0 + c.start), off);
    nodes.push(src);
  }
  return nodes;
}
export async function mixTimeline(total, opts) {
  const oc = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * SR)), SR);
  schedule(oc, oc.destination, 0, 0, total, opts);
  return await oc.startRendering();
}
let tlNodes = [];
export function playTimeline(from, total, opts) {
  stopTimeline(); stopPreview();
  const ctx = live(); const t0 = ctx.currentTime + 0.05 - from;
  tlNodes = schedule(ctx, ctx.destination, t0, from, total, opts);
}
export function stopTimeline() { for (const n of tlNodes) { try { n.stop(); } catch (e) { } } tlNodes = []; }
