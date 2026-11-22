// Gömülü ses kütüphanesi: efektler ve müzik yatakları tarayıcıda sentezlenir (telif yok, indirme yok).
const SR = 48000;

function noiseBuf(ctx, sec) {
  const b = ctx.createBuffer(2, Math.ceil(sec * ctx.sampleRate), ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return b;
}
function reverb(ctx, sec = 2.2, decay = 2.5) {
  const b = ctx.createBuffer(2, Math.ceil(sec * ctx.sampleRate), ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay); }
  const cv = ctx.createConvolver(); cv.buffer = b; return cv;
}
async function render(sec, build) {
  const ctx = new OfflineAudioContext(2, Math.ceil(sec * SR), SR);
  const master = ctx.createGain(); master.connect(ctx.destination);
  build(ctx, master);
  return ctx.startRendering();
}
function env(g, t, a, peak, hold, rel, end = 0.0001) {
  g.setValueAtTime(0.0001, t); g.exponentialRampToValueAtTime(peak, t + a);
  g.setValueAtTime(peak, t + a + hold); g.exponentialRampToValueAtTime(end, t + a + hold + rel);
}

export const SFX = {
  whoosh: { name: 'Hışırtı', len: 0.9 },
  swish: { name: 'Kısa hışırtı', len: 0.45 },
  impact: { name: 'Vurgu', len: 2.2 },
  pop: { name: 'Pop', len: 0.25 },
  riser: { name: 'Yükselen', len: 2.2 },
  ding: { name: 'Zil', len: 1.6 },
  tick: { name: 'Tık', len: 0.08 }
};

const builders = {
  whoosh(ctx, out, len = 0.9) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx, len);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(250, 0); bp.frequency.exponentialRampToValueAtTime(3800, len * 0.55); bp.frequency.exponentialRampToValueAtTime(900, len);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.9, len * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, len);
    const pan = ctx.createStereoPanner(); pan.pan.setValueAtTime(-0.7, 0); pan.pan.linearRampToValueAtTime(0.7, len);
    n.connect(bp).connect(g).connect(pan).connect(out); n.start(0);
  },
  swish(ctx, out) { builders.whoosh(ctx, out, 0.45); },
  impact(ctx, out) {
    const rv = reverb(ctx, 2.0, 3); const wet = ctx.createGain(); wet.gain.value = 0.35; rv.connect(wet).connect(out);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110, 0); o.frequency.exponentialRampToValueAtTime(38, 0.6);
    const g = ctx.createGain(); env(g.gain, 0, 0.005, 1.0, 0.05, 1.2); o.connect(g); g.connect(out); g.connect(rv); o.start(0); o.stop(2);
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx, 0.4); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const gn = ctx.createGain(); env(gn.gain, 0, 0.002, 0.6, 0.01, 0.25); n.connect(lp).connect(gn); gn.connect(out); gn.connect(rv); n.start(0);
  },
  pop(ctx, out) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(1100, 0); o.frequency.exponentialRampToValueAtTime(320, 0.09);
    const g = ctx.createGain(); env(g.gain, 0, 0.003, 0.8, 0.01, 0.12); o.connect(g).connect(out); o.start(0); o.stop(0.25);
  },
  riser(ctx, out) {
    const len = 2.2;
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx, len); const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.Q.value = 2;
    hp.frequency.setValueAtTime(400, 0); hp.frequency.exponentialRampToValueAtTime(6000, len);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.5, len * 0.95); g.gain.linearRampToValueAtTime(0, len);
    n.connect(hp).connect(g).connect(out); n.start(0);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140, 0); o.frequency.exponentialRampToValueAtTime(880, len);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, 0); lp.frequency.exponentialRampToValueAtTime(5000, len);
    const go = ctx.createGain(); go.gain.setValueAtTime(0.0001, 0); go.gain.exponentialRampToValueAtTime(0.12, len * 0.95); go.gain.linearRampToValueAtTime(0, len);
    o.connect(lp).connect(go).connect(out); o.start(0); o.stop(len);
  },
  ding(ctx, out) {
    const rv = reverb(ctx, 1.5, 2.5); const wet = ctx.createGain(); wet.gain.value = 0.3; rv.connect(wet).connect(out);
    for (const [r, a] of [[1, 0.5], [2.76, 0.25], [5.4, 0.12], [8.93, 0.06]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1046.5 * r;
      const g = ctx.createGain(); env(g.gain, 0, 0.004, a, 0.0, 1.3 / Math.sqrt(r)); o.connect(g); g.connect(out); g.connect(rv); o.start(0); o.stop(1.6);
    }
  },
  tick(ctx, out) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx, 0.05); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const g = ctx.createGain(); env(g.gain, 0, 0.001, 0.7, 0.005, 0.03); n.connect(hp).connect(g).connect(out); n.start(0);
  }
};

const sfxCache = new Map();
export async function sfxBuffer(kind) {
  if (!SFX[kind]) return null;
  if (!sfxCache.has(kind)) sfxCache.set(kind, render(SFX[kind].len, (ctx, out) => builders[kind](ctx, out)));
  return sfxCache.get(kind);
}

/** Zaman çizelgesinden efekt yerleşimi: [{t, kind, gain}] */
export function sfxCues(shots, { enabled = {} } = {}) {
  const out = []; const on = k => enabled[k] !== false;
  shots.forEach((s, i) => {
    if (s.cont) return;
    if (i > 0 && s.transition !== 'cut' && on('whoosh')) out.push({ t: s.start - 0.42, kind: s.transDur > 0.5 ? 'whoosh' : 'swish', gain: 0.55 });
    if (s.kind === 'hook' && on('impact')) out.push({ t: s.start + 0.12, kind: 'impact', gain: 0.8 });
    if ((s.kind === 'item' || s.kind === 'feature' || (s.kind === 'point' && s.lines.some(l => l.role === 'num'))) && on('pop')) out.push({ t: s.start + 0.1, kind: 'pop', gain: 0.6 });
    if (s.kind === 'price' && on('impact')) out.push({ t: s.start + 0.1, kind: 'impact', gain: 0.55 });
    if (s.kind === 'cta') {
      if (on('riser') && s.start > 2.4) out.push({ t: s.start - 2.1, kind: 'riser', gain: 0.45 });
      if (on('ding') && s.lines.some(l => l.role === 'cta')) out.push({ t: s.start + Math.max(0.6, s.dur * 0.35), kind: 'ding', gain: 0.5 });
    }
  });
  return out.filter(c => c.t >= 0);
}

/* ---------------- müzik yatakları ---------------- */
export const BEDS = {
  ambient: { name: 'Sakin ambiyans', bpm: 70 },
  lofi: { name: 'Lo-fi', bpm: 80 },
  kurumsal: { name: 'Kurumsal / pozitif', bpm: 110 },
  sinematik: { name: 'Sinematik', bpm: 72 },
  enerjik: { name: 'Enerjik', bpm: 122 }
};
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
// akor ilerlemeleri (MIDI kök + üçlü yapı)
const PROG = {
  ambient: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 67]],
  lofi: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 60, 64, 67]],
  kurumsal: [[48, 52, 55, 60], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]],
  sinematik: [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]],
  enerjik: [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]]
};

function pad(ctx, out, notes, t, dur, vol = 0.05, bright = 1200) {
  for (const n of notes) for (const det of [-7, 7]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bright; lp.Q.value = 0.3;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(1.2, dur * 0.3)); g.gain.setValueAtTime(vol, t + dur - Math.min(1, dur * 0.25)); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.1);
  }
}
function pluck(ctx, out, n, t, vol = 0.12, len = 0.35, type = 'triangle') {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = NOTE(n);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(600, t + len);
  const g = ctx.createGain(); env(g.gain, t, 0.004, vol, 0.0, len);
  o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + len + 0.05);
}
function kick(ctx, out, t, vol = 0.8) {
  const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  const g = ctx.createGain(); env(g.gain, t, 0.002, vol, 0.02, 0.28); o.connect(g).connect(out); o.start(t); o.stop(t + 0.4);
}
function hat(ctx, out, t, nb, vol = 0.08, len = 0.04) {
  const n = ctx.createBufferSource(); n.buffer = nb; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
  const g = ctx.createGain(); env(g.gain, t, 0.001, vol, 0.0, len); n.connect(hp).connect(g).connect(out); n.start(t, Math.random() * 0.5, len + 0.05);
}
function snare(ctx, out, t, nb, vol = 0.25) {
  const n = ctx.createBufferSource(); n.buffer = nb; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
  const g = ctx.createGain(); env(g.gain, t, 0.002, vol, 0.0, 0.18); n.connect(bp).connect(g).connect(out); n.start(t, Math.random() * 0.5, 0.25);
}

const bedCache = new Map();
/** Döngüye uygun müzik yatağı (4 akorluk ilerleme × 2 tur) */
export async function bedBuffer(kind) {
  if (!BEDS[kind]) return null;
  if (bedCache.has(kind)) return bedCache.get(kind);
  const { bpm } = BEDS[kind]; const beat = 60 / bpm, bar = beat * 4, chords = PROG[kind];
  const bars = kind === 'enerjik' || kind === 'kurumsal' ? 16 : 8; const len = bar * bars;
  const p = render(len, (ctx, master) => {
    const rv = reverb(ctx, 3, 2.2); const wet = ctx.createGain(); wet.gain.value = kind === 'sinematik' || kind === 'ambient' ? 0.5 : 0.25; rv.connect(wet).connect(master);
    const bus = ctx.createGain(); bus.connect(master); bus.connect(rv);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; master.disconnect(); master.connect(comp).connect(ctx.destination);
    const nb = noiseBuf(ctx, 1);
    const per = kind === 'enerjik' || kind === 'kurumsal' ? 4 : 2; // her akor kaç ölçü
    for (let b = 0; b < bars; b += per) {
      const ch = chords[(b / per) % chords.length], t = b * bar, d = per * bar;
      if (kind === 'ambient') { pad(ctx, bus, ch, t, d, 0.035, 900); pad(ctx, bus, [ch[0] - 12], t, d, 0.03, 400); }
      if (kind === 'sinematik') { pad(ctx, bus, ch, t, d, 0.03, 700); pad(ctx, bus, [ch[0] - 24, ch[0] - 12], t, d, 0.05, 250); for (let k = 0; k < per * 4; k += 2) kick(ctx, bus, t + k * beat, 0.35); }
      if (kind === 'lofi') {
        pad(ctx, bus, ch, t, d, 0.025, 700);
        for (let k = 0; k < per * 4; k++) { const tt = t + k * beat; if (k % 4 === 0 || k % 4 === 2.5) kick(ctx, bus, tt, 0.55); if (k % 4 === 2) snare(ctx, bus, tt, nb, 0.12); hat(ctx, bus, tt, nb, 0.035); hat(ctx, bus, tt + beat * 0.55, nb, 0.025); }
        for (let k = 0; k < per * 8; k++) if (k % 3 === 0) pluck(ctx, bus, ch[(k / 3) % ch.length | 0] + 12, t + k * beat / 2, 0.05, 0.5, 'sine');
      }
      if (kind === 'kurumsal' || kind === 'enerjik') {
        pad(ctx, bus, ch, t, d, kind === 'enerjik' ? 0.018 : 0.022, 1400);
        const arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 12];
        for (let k = 0; k < per * 8; k++) pluck(ctx, bus, arp[k % arp.length], t + k * beat / 2, kind === 'enerjik' ? 0.06 : 0.07, 0.25);
        for (let k = 0; k < per * 4; k++) { const tt = t + k * beat; if (kind === 'enerjik' || k % 2 === 0) kick(ctx, bus, tt, kind === 'enerjik' ? 0.7 : 0.5); if (k % 4 === 1 || k % 4 === 3) snare(ctx, bus, tt, nb, kind === 'enerjik' ? 0.16 : 0.1); hat(ctx, bus, tt + beat / 2, nb, kind === 'enerjik' ? 0.06 : 0.04); }
        for (let k = 0; k < per * 4; k++) pluck(ctx, bus, ch[0] - 12, t + k * beat, 0.16, beat * 0.8, 'sawtooth');
      }
    }
  });
  bedCache.set(kind, p);
  return p;
}
