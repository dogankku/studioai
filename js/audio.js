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
