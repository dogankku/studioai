// Analiz: müzik ritmi (vuruşlar, tempo) ve referans video (kesmeler, sahne süreleri, renkler, hareket yoğunluğu)

/** Ses tamponundan başlangıç (onset) zarfı, tempo ve vuruş ızgarası */
export function analyzeAudio(buffer) {
  const sr = buffer.sampleRate;
  const ch0 = buffer.getChannelData(0), ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
  const hop = Math.round(sr / 100); // 10 ms
  const win = hop * 2;
  const n = Math.floor((ch0.length - win) / hop);
  const env = new Float32Array(Math.max(0, n));
  let prevE = 0, prevHF = 0;
  for (let f = 0; f < n; f++) {
    let e = 0, hf = 0, last = 0;
    const o = f * hop;
    for (let i = 0; i < win; i += 2) { const s = (ch0[o + i] + ch1[o + i]) * 0.5; e += s * s; const d = s - last; hf += d * d; last = s; }
    const le = Math.log(1e-6 + e), lh = Math.log(1e-6 + hf);
    env[f] = Math.max(0, le - prevE) * 0.4 + Math.max(0, lh - prevHF) * 0.6;
    prevE = le; prevHF = lh;
  }
  // uyarlamalı eşikle tepe bulma
  const onsets = [];
  const W = 30;
  for (let f = 1; f < n - 1; f++) {
    let m = 0; const a = Math.max(0, f - W), b = Math.min(n, f + W);
    for (let k = a; k < b; k++) m += env[k]; m /= (b - a);
    if (env[f] > m * 1.6 + 0.05 && env[f] >= env[f - 1] && env[f] >= env[f + 1]) {
      if (!onsets.length || f - onsets[onsets.length - 1].f > 10) onsets.push({ f, s: env[f] });
    }
  }
  // tempo: zarfın öz ilişkisi (60-180 BPM)
  let bestLag = 50, bestV = -1;
  for (let lag = 33; lag <= 100; lag++) {
    let v = 0; for (let f = 0; f + lag < n; f += 2) v += env[f] * env[f + lag];
    v *= 1 + 0.15 * Math.exp(-Math.pow((lag - 50) / 20, 2)); // 120 BPM civarını hafif tercih
    if (v > bestV) { bestV = v; bestLag = lag; }
  }
  const period = bestLag / 100, bpm = 60 / period;
  // faz: vuruş ızgarasını başlangıçlara en iyi oturan kaydırma
  let bestPh = 0, bestScore = -1;
  for (let ph = 0; ph < bestLag; ph += 2) {
    let sc = 0; for (const on of onsets) { const d = ((on.f - ph) % bestLag + bestLag) % bestLag; const dd = Math.min(d, bestLag - d); sc += on.s * Math.exp(-dd * dd / 18); }
    if (sc > bestScore) { bestScore = sc; bestPh = ph; }
  }
  const beats = []; for (let f = bestPh; f < n; f += bestLag) beats.push(+(f / 100).toFixed(3));
  const energy = []; for (let s = 0; s < n; s += 50) { let e = 0; for (let k = s; k < Math.min(n, s + 50); k++) e += env[k]; energy.push(e / 50); }
  const emax = Math.max(1e-6, ...energy);
  return { bpm: Math.round(bpm), beats, onsets: onsets.map(o => o.f / 100), energy: energy.map(e => e / emax), duration: buffer.duration };
}

const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Referans video analizi: kare farkıyla kesme tespiti, sahne başına renk ve hareket */
export async function analyzeVideo(file, onProgress = () => { }, decodeAudio = null) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('Video açılamadı')); });
  const dur = Math.min(v.duration || 0, 180);
  const fps = dur > 90 ? 5 : 8;
  const cw = 64, chh = Math.max(16, Math.round(64 * v.videoHeight / Math.max(1, v.videoWidth)));
  const c = document.createElement('canvas'); c.width = cw; c.height = chh; const g = c.getContext('2d', { willReadFrequently: true });
  const frames = []; let prev = null;
  const seek = t => new Promise(res => { const f = () => { v.removeEventListener('seeked', f); res(); }; v.addEventListener('seeked', f); v.currentTime = t; setTimeout(f, 1500); });
  for (let t = 0; t < dur; t += 1 / fps) {
    await seek(t);
    g.drawImage(v, 0, 0, cw, chh);
    const d = g.getImageData(0, 0, cw, chh).data;
    const hist = new Float32Array(48); let r = 0, gg = 0, b = 0, motion = 0, lum = 0; const N = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      hist[d[i] >> 4]++; hist[16 + (d[i + 1] >> 4)]++; hist[32 + (d[i + 2] >> 4)]++;
      r += d[i]; gg += d[i + 1]; b += d[i + 2]; lum += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      if (prev) motion += Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]);
    }
    let hd = 0; if (frames.length) { const ph = frames[frames.length - 1].hist; for (let k = 0; k < 48; k++) hd += Math.abs(hist[k] - ph[k]); hd /= (N * 3); }
    frames.push({ t, hist, hd, motion: prev ? motion / (N * 3 * 255) : 0, rgb: [r / N, gg / N, b / N], lum: lum / N / 255 });
    prev = d.slice();
    onProgress(Math.min(0.9, t / dur * 0.9));
  }
  // kesme: histogram farkı yerel ortalamanın çok üstündeyse
  const cuts = [0];
  for (let i = 1; i < frames.length; i++) {
    let m = 0, k0 = Math.max(1, i - 8), k1 = Math.min(frames.length, i + 8); for (let k = k0; k < k1; k++) m += frames[k].hd; m /= (k1 - k0);
    if (frames[i].hd > Math.max(0.25, m * 2.5) && frames[i].t - cuts[cuts.length - 1] > 0.35) cuts.push(frames[i].t);
  }
  const shots = cuts.map((s, i) => {
    const e = i + 1 < cuts.length ? cuts[i + 1] : dur;
    const fs = frames.filter(f => f.t >= s && f.t < e);
    const avg = k => fs.reduce((a, f) => a + f[k], 0) / Math.max(1, fs.length);
    const rgb = [0, 1, 2].map(j => fs.reduce((a, f) => a + f.rgb[j], 0) / Math.max(1, fs.length));
    // açık ve koyu tonlar
    const sorted = [...fs].sort((a, b) => a.lum - b.lum);
    const dark = sorted[Math.floor(sorted.length * 0.15)] || fs[0], light = sorted[Math.floor(sorted.length * 0.85)] || fs[0];
    return { start: s, dur: e - s, motion: avg('motion'), lum: avg('lum'), colors: [hex(...dark.rgb), hex(...rgb), hex(...light.rgb)] };
  });
  const mmax = Math.max(1e-6, ...shots.map(s => s.motion));
  shots.forEach(s => (s.energy = Math.min(1, 0.25 + 0.75 * s.motion / mmax * (s.dur < 1 ? 1.2 : 1))));
  let audio = null;
  if (decodeAudio) { try { onProgress(0.92); const buf = await decodeAudio(file); audio = analyzeAudio(buf); audio.buffer = buf; } catch (e) { audio = null; } }
  onProgress(1);
  URL.revokeObjectURL(url);
  // genel renk karakteri → derecelendirme önerisi
  const all = [0, 1, 2].map(j => frames.reduce((a, f) => a + f.rgb[j], 0) / Math.max(1, frames.length));
  const mean = (all[0] + all[1] + all[2]) / 3;
  const warmth = (all[0] - all[2]) / Math.max(1, mean);
  const sat = Math.max(...all) - Math.min(...all);
  const lumAll = frames.reduce((a, f) => a + f.lum, 0) / Math.max(1, frames.length);
  const lumStd = Math.sqrt(frames.reduce((a, f) => a + (f.lum - lumAll) ** 2, 0) / Math.max(1, frames.length));
  const grade = { temperature: Math.max(-0.6, Math.min(0.6, warmth * 0.9)), saturation: Math.max(0.5, Math.min(1.4, 0.75 + sat / 120)), contrast: Math.max(0.85, Math.min(1.35, 0.9 + lumStd * 2)), exposure: Math.max(-0.3, Math.min(0.3, (lumAll - 0.42) * 0.8)) };
  return { duration: dur, shots, cuts, audio, grade, avgShot: dur / shots.length, frames: frames.map(f => ({ t: f.t, rgb: f.rgb, motion: f.motion })) };
}
