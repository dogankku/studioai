// Ses: dosya çözme, video başına karışım, önizleme
export const SR = 48000;
let liveCtx = null;
export function live() {
  if (!liveCtx) liveCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
  if (liveCtx.state === 'suspended') liveCtx.resume();
  return liveCtx;
}

export async function decodeFile(file) {
  const buf = await file.arrayBuffer();
  const ctx = live();
  return await ctx.decodeAudioData(buf);
}

/** Bir videonun ses izini hazırlar: döngü, ses seviyesi, giriş/çıkış yumuşatma. */
export async function mixFor(buffer, dur, { volume = 0.8, fadeIn = true, fadeOut = true, loop = true } = {}) {
  const len = Math.max(1, Math.ceil(dur * SR));
  const oc = new OfflineAudioContext(2, len, SR);
  const src = oc.createBufferSource(); src.buffer = buffer; src.loop = loop;
  const g = oc.createGain();
  const fi = fadeIn ? Math.min(1.0, dur / 4) : 0, fo = fadeOut ? Math.min(1.5, dur / 4) : 0;
  g.gain.setValueAtTime(fi ? 0 : volume, 0);
  if (fi) g.gain.linearRampToValueAtTime(volume, fi);
  if (fo) { g.gain.setValueAtTime(volume, Math.max(fi, dur - fo)); g.gain.linearRampToValueAtTime(0, dur); }
  src.connect(g).connect(oc.destination);
  src.start(0);
  return await oc.startRendering();
}

let current = null;
export function playPreview(buffer, offset, dur, opts) {
  stopPreview();
  if (!buffer) return;
  const ctx = live();
  const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
  const g = ctx.createGain();
  const v = opts.volume ?? 0.8;
  const fi = opts.fadeIn ? Math.min(1.0, dur / 4) : 0, fo = opts.fadeOut ? Math.min(1.5, dur / 4) : 0;
  const now = ctx.currentTime;
  const at = x => now + (x - offset);
  const gainAt = x => (fi && x < fi ? v * x / fi : fo && x > dur - fo ? v * Math.max(0, dur - x) / fo : v);
  g.gain.setValueAtTime(gainAt(offset), now);
  if (fi && offset < fi) g.gain.linearRampToValueAtTime(v, at(fi));
  if (fo) { const s = Math.max(offset, dur - fo); g.gain.setValueAtTime(gainAt(s), at(s)); g.gain.linearRampToValueAtTime(0, at(dur)); }
  src.connect(g).connect(ctx.destination);
  src.start(now, offset % buffer.duration);
  src.stop(at(dur) + 0.05);
  current = src;
}
export function stopPreview() { if (current) { try { current.stop(); } catch (e) { } current = null; } }
