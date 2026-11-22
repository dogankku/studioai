// Film oynatıcı: çekim listesini t anında 3D sahne + yazı + kamera + geçiş + son işlem olarak çizer
import * as THREE from '../../vendor/three-bundle.js?v=202611221501';
import { getScene, setPointScale, imageScene } from './scenes.js?v=202611221501';
import { applyCamera } from './camera.js?v=202611221501';
import { buildText, animateText, disposeText } from './text3d.js?v=202611221501';
import { Post } from './post.js?v=202611221501';
import { StockScene } from './stock-scene.js?v=202611221501';
import { STYLES, GRADE_DEFAULT, FX_DEFAULT } from './styles.js?v=202611221501';

export class Film {
  constructor(canvas, W, H) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.camA = new THREE.PerspectiveCamera(40, W / H, 0.1, 1200);
    this.camB = new THREE.PerspectiveCamera(40, W / H, 0.1, 1200);
    this.texts = new Map(); this.images = new Map(); this.videos = new Map(); this.stock = [null, null]; this.vSeg = 5.5;
    this.post = null;
    this.resize(W, H);
    this.timeline = { shots: [], dur: 0 };
    this.style = STYLES.sinematik;
    this.fonts = { latin: '"Playfair Display", serif', ar: 'Amiri', sub: 'Lora, serif' };
    this.size = 1; this.safe = null; this.beats = null; this.fadeIn = 0.6; this.fadeOut = 0.9;
  }
  resize(W, H) {
    this.W = W; this.H = H;
    this.renderer.setSize(W, H, false);
    if (this.post) this.post.setSize(W, H); else this.post = new Post(this.renderer, W, H);
    setPointScale(H / 1280);
    this.clearTexts();
  }
  clearTexts() { for (const T of this.texts.values()) disposeText(T); this.texts.clear(); }
  setStyle(key, { grade = {}, fx = {}, colors = {} } = {}) {
    const base = STYLES[key] || STYLES.sinematik;
    this.style = { ...base, grade: { ...GRADE_DEFAULT, ...base.grade, ...grade }, fx: { ...FX_DEFAULT, ...base.fx, ...fx }, text: colors.text || base.text, accent: colors.accent || base.accent, sub: colors.sub || base.sub };
    this.post.apply(this.style);
    this.clearTexts();
  }
  setTimeline(tl) {
    this.timeline = tl; this.clearTexts();
    const first = {}; for (const s of tl.shots) { if (!(s.item in first)) first[s.item] = s.start; s.vStart = first[s.item]; }
  }
  /** Gerçek çekim planı: bu anda hangi çekim(ler), hangi saniyesi, ne opaklıkta */
  vplan(shot, t) {
    const ids = (shot.videos || []).filter(id => this.videos.has(id)); if (!ids.length) return [];
    const L = this.vSeg, XF = 0.8, n = ids.length, s = Math.max(0, t - (shot.vStart ?? shot.start));
    const tm = (id, x) => { const v = this.videos.get(id), d = v.duration || 10; const off = d > L + 3 ? Math.min(1.5, (d - L) / 4) : 0; const y = off + x; return d > 0.5 ? y % (d - 0.15) : 0; };
    const k = n > 1 ? Math.floor(s / L) : 0;
    const a = ids[k % n];
    const out = [{ id: a, video: this.videos.get(a), time: tm(a, s - k * L + (k > 0 ? XF : 0)), alpha: 1 }];
    if (n > 1) { const tb = (k + 1) * L - XF; if (s >= tb) { const b = ids[(k + 1) % n]; out.push({ id: b, video: this.videos.get(b), time: tm(b, s - tb), alpha: Math.min(1, (s - tb) / XF) }); } }
    return out;
  }
  /** Çekim karelerini t anına getir. live: önizlemede oynat ve kaymayı düzelt; değilse kare kare ara (video çıktısı) */
  async prepare(t, live = false) {
    if (!this.videos.size) return false;
    const L = this.locate(t); if (!L) return false;
    const used = new Set(), jobs = []; let changed = false;
    for (const shot of [L.a, L.b]) if (shot && shot.scene === 'video') for (const e of this.vplan(shot, t)) {
      used.add(e.video); const v = e.video;
      if (live) { if (v.paused) v.play().catch(() => { }); if (Math.abs(v.currentTime - e.time) > 0.35) v.currentTime = e.time; }
      else { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - e.time) > 0.01 || v.readyState < 2) { changed = true; jobs.push(seekTo(v, e.time)); } }
    }
    for (const v of this.videos.values()) if (!used.has(v) && !v.paused) v.pause();
    if (jobs.length) await Promise.all(jobs);
    return changed;
  }
  pauseVideos() { for (const v of this.videos.values()) if (!v.paused) v.pause(); }
  textFor(shot) {
    if (!this.texts.has(shot.i)) this.texts.set(shot.i, buildText(shot.lines, { W: this.W, H: this.H, style: this.style, fonts: this.fonts, size: this.size * (shot.title ? 1.15 : 1), safe: this.safe }));
    return this.texts.get(shot.i);
  }
  pruneTexts(keep) { for (const [k, T] of this.texts) if (!keep.has(k)) { disposeText(T); this.texts.delete(k); } }
  side(shot, cam, t, alpha = 1) {
    let sc;
    const vp = shot.scene === 'video' ? this.vplan(shot, t) : null;
    if (vp && vp.length) { const k = cam === this.camA ? 0 : 1; sc = this.stock[k] || (this.stock[k] = new StockScene()); sc.set(vp, t); }
    else {
      const img = (shot.scene === 'gorsel' || shot.scene === 'video') && shot.image && this.images.get(shot.image);
      sc = img ? imageScene(shot.image, img) : getScene(shot.scene === 'gorsel' || shot.scene === 'video' ? 'yildiz' : shot.scene);
      sc.update(t);
    }
    const lt = t - shot.start;
    const { target } = applyCamera(cam, shot.camera, lt / shot.dur, shot.camK, lt, shot.seed % 100, this.W / this.H);
    const T = this.textFor(shot);
    animateText(T, shot.cont ? lt + 60 : lt, shot.cont ? shot.dur + 60 : shot.dur, shot.anim, this.style, shot.seed, shot.timing, alpha);
    return { scene: sc.scene, camera: cam, text: { group: T.group, camera: cam, target } };
  }
  locate(t) {
    const S = this.timeline.shots; if (!S.length) return null;
    let i = 0; while (i + 1 < S.length && S[i + 1].start <= t) i++;
    const cur = S[i], prev = S[i - 1], next = S[i + 1];
    if (prev && cur.transDur > 0.06 && t < cur.start + cur.transDur / 2) return { a: prev, b: cur, p: (t - (cur.start - cur.transDur / 2)) / cur.transDur, kind: cur.transition };
    if (next && next.transDur > 0.06 && t >= next.start - next.transDur / 2) return { a: cur, b: next, p: (t - (next.start - next.transDur / 2)) / next.transDur, kind: next.transition };
    return { a: cur };
  }
  render(t) {
    const L = this.locate(t);
    if (!L) { this.renderer.setRenderTarget(null); this.renderer.setClearColor(0x000000); this.renderer.clear(); return; }
    const p = L.b ? Math.max(0, Math.min(1, L.p)) : 0;
    const tx = L.b ? (L.kind === 'cut' || L.kind === 'glitch' ? (p < 0.5 ? 0 : 1) : Math.min(1, Math.max(0, (p - 0.25) / 0.5))) : 0;
    const A = this.side(L.a, this.camA, t, 1 - tx);
    const job = { a: A }; const texts = [A.text];
    const keep = new Set([L.a.i]);
    if (L.b) { const B = this.side(L.b, this.camB, t, tx); job.b = B; job.p = p; job.kind = L.kind; job.seed = L.b.seed % 97; keep.add(L.b.i); texts.push(B.text); }
    // sonraki çekimin yazısını önceden hazırla
    const nx = this.timeline.shots[(L.b || L.a).i + 1]; if (nx) keep.add(nx.i);
    this.pruneTexts(keep);
    let pulse = 0;
    if (this.beats && this.beats.length) { let lb = -1; for (const b of this.beats) { if (b <= t) lb = b; else break; } if (lb >= 0) pulse = Math.exp(-(t - lb) * 7); }
    const D = this.timeline.dur;
    const fade = Math.max(t < this.fadeIn ? 1 - t / this.fadeIn : 0, t > D - this.fadeOut ? (t - (D - this.fadeOut)) / this.fadeOut : 0);
    this.post.render(job, t, pulse, Math.min(1, fade), texts);
  }
  dispose() { this.clearTexts(); this.renderer.dispose(); }
}
function seekTo(v, t) {
  return new Promise(res => {
    let done = false; const fin = () => { if (done) return; done = true; v.removeEventListener('seeked', fin); res(); };
    if (Math.abs(v.currentTime - t) <= 0.01 && v.readyState >= 2) return res();
    v.addEventListener('seeked', fin); v.currentTime = t; setTimeout(fin, 3000);
  });
}
