// Kelime kelime altyazı: kelime zamanlarını seslendirme dalgasından tahmin eder, TikTok tarzı altyazıyı çizer.
import * as THREE from '../vendor/three-bundle.js?v=202611221620';

const VOW = /[aeıioöuüâîûAEIİOÖUÜÂÎÛ]/g;
const syl = w => Math.max(1, (w.match(VOW) || []).length);

/** Konuşulan bölümleri bul (sessizliklerle ayrılmış) */
function voiced(buf) {
  const d = buf.getChannelData(0), sr = buf.sampleRate, hop = Math.round(sr * 0.01);
  const env = []; for (let i = 0; i < d.length; i += hop) { let s = 0; const e = Math.min(d.length, i + hop); for (let j = i; j < e; j++) s += d[j] * d[j]; env.push(Math.sqrt(s / Math.max(1, e - i))); }
  const mx = Math.max(...env, 1e-6), thr = mx * 0.07;
  const segs = []; let st = -1, quiet = 0;
  for (let k = 0; k < env.length; k++) {
    if (env[k] > thr) { if (st < 0) st = k; quiet = 0; }
    else if (st >= 0 && ++quiet >= 12) { segs.push([st * 0.01, (k - quiet + 1) * 0.01]); st = -1; quiet = 0; }
  }
  if (st >= 0) segs.push([st * 0.01, (env.length - quiet) * 0.01]);
  return segs.filter(s => s[1] - s[0] > 0.05);
}

/** [{w, s, e}] — kelimelerin ses içindeki başlangıç/bitişi (saniye) */
export function wordTimes(text, buf) {
  const words = (text || '').split(/\s+/).filter(Boolean); if (!words.length || !buf) return [];
  const segs = voiced(buf); if (!segs.length) return [];
  const wts = words.map(w => syl(w) + (/[,;:]$/.test(w) ? 0.6 : /[.!?…]$/.test(w) ? 1 : 0));
  // ifadeler (noktalama ile biten kelime grupları) bölüm sayısına eşitse doğrudan eşle
  const breaks = words.map((w, i) => /[,.;:!?…]$/.test(w) ? i : -1).filter(i => i >= 0 && i < words.length - 1);
  let groups = null;
  if (breaks.length === segs.length - 1) { groups = []; let a = 0; for (const b of [...breaks, words.length - 1]) { groups.push([a, b]); a = b + 1; } }
  const out = [];
  const spread = (i0, i1, t0, t1) => { const W = wts.slice(i0, i1 + 1).reduce((x, y) => x + y, 0); let t = t0; for (let i = i0; i <= i1; i++) { const d = (t1 - t0) * wts[i] / W; out.push({ w: words[i], s: t, e: t + d }); t += d; } };
  if (groups) groups.forEach(([a, b], k) => spread(a, b, segs[k][0], segs[k][1]));
  else { // konuşulan süre boyunca hece ağırlığına göre dağıt (sessizlikleri atlayarak)
    const total = segs.reduce((x, s) => x + s[1] - s[0], 0), W = wts.reduce((x, y) => x + y, 0);
    const at = v => { let r = v; for (const [a, b] of segs) { if (r <= b - a) return a + r; r -= b - a; } return segs[segs.length - 1][1]; };
    let c = 0; for (let i = 0; i < words.length; i++) { const s = at(c / W * total); c += wts[i]; out.push({ w: words[i], s, e: at(c / W * total) }); }
  }
  return out;
}

/** Kelimeleri ekranda birlikte görünecek kısa parçalara böl */
export function chunkWords(ws, maxWords = 3, maxChars = 18) {
  const ch = []; let cur = [];
  for (const x of ws) {
    const len = cur.reduce((a, y) => a + y.w.length + 1, 0) + x.w.length;
    if (cur.length && (cur.length >= maxWords || len > maxChars)) { ch.push(cur); cur = []; }
    cur.push(x);
    if (/[,.;:!?…]$/.test(x.w)) { ch.push(cur); cur = []; }
  }
  if (cur.length) ch.push(cur);
  return ch.map(c => ({ s: c[0].s, e: c[c.length - 1].e, words: c }));
}

export const CAP_STYLES = {
  pop: 'Vurgulu (konuşulan kelime renkli ve büyük)',
  kutu: 'Kutulu (konuşulan kelime renkli kutuda)',
  sade: 'Sade (beyaz, gölgeli)'
};

/** Altyazı katmanı: tek düzlem, her karede 2D kanvasa çizilir */
export class Captions {
  constructor() {
    this.cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100); this.cam.position.set(0, 0, 10); this.cam.lookAt(0, 0, 0);
    this.group = new THREE.Group(); this.c = document.createElement('canvas'); this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat); this.mesh.renderOrder = 20; this.group.add(this.mesh);
    this.chunks = []; this.W = 0; this.H = 0; this.key = '';
  }
  setSize(W, H, safe) {
    this.W = W; this.H = H; this.safe = safe || { bottom: 0.1, side: 0.08 };
    this.cam.aspect = W / H; this.cam.updateProjectionMatrix();
    const cw = Math.round(W), chh = Math.round(Math.min(W, H) * 0.26); this.c.width = cw; this.c.height = chh;
    const visH = 2 * 10 * Math.tan(THREE.MathUtils.degToRad(20)), u = visH / H;
    this.mesh.scale.set(cw * u, chh * u, 1);
    const yPx = H * (1 - this.safe.bottom - 0.13); // altyazının merkezi
    this.mesh.position.set(0, (H / 2 - yPx) * u, 0);
    this.key = '';
  }
  /** t anında çiz; görünür bir şey varsa TextPass öğesi döndür */
  frame(t, style, accent, font, mode = 'pop') {
    const k = this.chunks.find(c => t >= c.s - 0.05 && t <= c.e + 0.25);
    if (!k) return null;
    const cur = k.words.findIndex(w => t >= w.s && t < w.e + 0.02);
    const pop = cur >= 0 ? Math.min(1, (t - k.words[cur].s) / 0.12) : 1;
    const key = `${this.chunks.indexOf(k)}:${cur}:${pop < 1 ? pop.toFixed(2) : 1}:${mode}`;
    const fade = Math.min(1, (t - k.s + 0.05) / 0.12, (k.e + 0.25 - t) / 0.15);
    this.mat.opacity = Math.max(0, fade);
    if (key !== this.key) { this.key = key; this.draw(k, cur, pop, accent, font, mode); }
    return { group: this.group, camera: this.cam, target: new THREE.Vector3() };
  }
  draw(k, cur, pop, accent, font, mode) {
    const { g, c } = this; g.clearRect(0, 0, c.width, c.height);
    const m = Math.min(this.W, this.H), fs = Math.round(m * 0.072), maxW = c.width * (1 - this.safe.side * 2 - 0.06);
    const f = (b = 1) => `900 ${Math.round(fs * b)}px ${font}`;
    const txt = k.words.map(w => w.w.toLocaleUpperCase('tr'));
    g.font = f(); let widths = txt.map(s => g.measureText(s).width); const sp = fs * 0.42;
    let tot = widths.reduce((a, b) => a + b, 0) + sp * (txt.length - 1); const sc = tot > maxW ? maxW / tot : 1;
    let x = c.width / 2 - tot * sc / 2; const y = c.height / 2;
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineJoin = 'round';
    txt.forEach((s, i) => {
      const on = i === cur, b = (on && mode === 'pop' ? 1 + 0.12 * Math.sin(pop * Math.PI / 2) : 1) * sc;
      g.font = f(b); const w = g.measureText(s).width, cx = x + widths[i] * sc / 2;
      if (on && mode === 'kutu') { const ph = fs * 1.25 * sc, pw = w + fs * 0.5 * sc; g.fillStyle = accent; roundRect(g, cx - pw / 2, y - ph / 2, pw, ph, ph * 0.22); g.fill(); }
      g.lineWidth = fs * 0.16 * b; g.strokeStyle = 'rgba(0,0,0,0.85)';
      g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = fs * 0.2;
      if (!(on && mode === 'kutu')) g.strokeText(s, cx - w / 2, y);
      g.shadowBlur = 0;
      g.fillStyle = on ? (mode === 'kutu' ? '#111111' : mode === 'pop' ? accent : '#ffffff') : '#ffffff';
      g.fillText(s, cx - w / 2, y);
      x += widths[i] * sc + sp * sc;
    });
    this.tex.needsUpdate = true;
  }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
