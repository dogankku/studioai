// Film oynatıcı: çekim listesini t anında 3D sahne + yazı + kamera + geçiş + son işlem olarak çizer
import * as THREE from '../../vendor/three-bundle.js?v=202611221641';
import { getScene, setPointScale, imageScene } from './scenes.js?v=202611221641';
import { applyCamera } from './camera.js?v=202611221641';
import { buildText, animateText, disposeText } from './text3d.js?v=202611221641';
import { Post } from './post.js?v=202611221641';
import { Captions } from '../captions.js?v=202611221641';
import { StockScene } from './stock-scene.js?v=202611221641';
import { STYLES, GRADE_DEFAULT, FX_DEFAULT } from './styles.js?v=202611221641';

export class Film {
  constructor(canvas, W, H) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.camA = new THREE.PerspectiveCamera(40, W / H, 0.1, 1200);
    this.camB = new THREE.PerspectiveCamera(40, W / H, 0.1, 1200);
    this.texts = new Map(); this.images = new Map(); this.videos = new Map(); this.logo = null; this.stock = [null, null]; this.vSeg = 5.5; this.flow = null; this.caps = new Captions(); this.watermark = null; this.markPos = 'sag-ust'; this._wm = null; this.capOn = false; this.capMode = 'pop';
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
  /** Çekim akışı: bütün film boyunca tek sıra, çekimler kendi uzunluklarında, örtüşen yumuşak geçişlerle */
  flowSegs() {
    const F = this.flow; if (!F || !F.ids || !F.ids.length) return null;
    const ids = F.ids.filter(id => this.videos.has(id) && this.videos.get(id).duration); if (!ids.length) return null;
    const sig = ids.join('|') + F.xf + ':' + F.maxLen;
    if (this._fs && this._fs.sig === sig) return this._fs;
    const XF = ids.length > 1 ? F.xf : 0; let s = 0; const segs = [];
    for (const id of ids) {
      const d = this.videos.get(id).duration, off = d > 4 ? Math.min(0.8, d * 0.1) : 0;
      const L = Math.max(XF + 1.2, Math.min(F.maxLen, d - off - 0.15));
      segs.push({ id, off, L, s }); s += L - XF;
    }
    // çekimlerin ortalama rengine göre eşitleme katsayıları
    const means = ids.map(id => this.videos.get(id)._mean).filter(Boolean);
    const tgt = means.length ? [0, 1, 2].map(c => means.reduce((a, m) => a + m[c], 0) / means.length) : null;
    for (const g of segs) { const m = this.videos.get(g.id)._mean; g.gain = (F.match && tgt && m) ? [0, 1, 2].map(c => { const k = Math.max(0.72, Math.min(1.4, (tgt[c] + 0.05) / (m[c] + 0.05))); return 1 + 0.75 * (k - 1); }) : [1, 1, 1]; }
    this._fs = { sig, segs, T: segs.length > 1 ? s : segs[0].L, XF };
    return this._fs;
  }
  flowPlan(t) {
    const fs = this.flowSegs(); if (!fs) return [];
    const { segs, T, XF } = fs, n = segs.length;
    if (n === 1) { const g = segs[0], v = this.videos.get(g.id); return [{ id: g.id, video: v, time: g.off + (t % g.L), alpha: 1, gain: g.gain }]; }
    const tau = ((t % T) + T) % T, cov = [];
    for (let j = 0; j < n; j++) for (const sh of [0, T]) { const g = segs[j], x = tau + sh - g.s; if (x >= 0 && x < g.L) cov.push({ g, x }); }
    cov.sort((a, b) => b.x - a.x); // önce eski (daha uzun süredir oynayan) çekim
    const sm = u => u * u * (3 - 2 * u);
    return cov.slice(0, 2).map((c, k) => ({ id: c.g.id, video: this.videos.get(c.g.id), time: c.g.off + c.x, alpha: k === 0 ? 1 : sm(Math.min(1, c.x / Math.max(0.01, XF))), gain: c.g.gain }));
  }
  vplan(shot, t) {
    if (shot.flow) return this.flowPlan(t);
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
      used.add(e.video); const v = e.video; if (v.tagName === 'IMG') continue;
      if (live) { if (v.paused) v.play().catch(() => { }); if (Math.abs(v.currentTime - e.time) > 0.35) v.currentTime = e.time; }
      else { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - e.time) > 0.01 || v.readyState < 2) { changed = true; jobs.push(seekTo(v, e.time)); } }
    }
    for (const v of this.videos.values()) if (v.tagName !== 'IMG' && !used.has(v) && !v.paused) v.pause();
    if (jobs.length) await Promise.all(jobs);
    return changed;
  }
  wmItem() {
    const img = this.watermark, key = `${this.W}x${this.H}:${this.markPos}:${img.src}:${JSON.stringify(this.safe)}`;
    if (!this._wm || this._wm.key !== key) {
      if (this._wm) { this._wm.mesh.geometry.dispose(); this._wm.mesh.material.map.dispose(); this._wm.mesh.material.dispose(); }
      const visH = 2 * 10 * Math.tan(THREE.MathUtils.degToRad(20)), u = visH / this.H, m = Math.min(this.W, this.H);
      const ar = (img.naturalWidth || 1) / Math.max(1, img.naturalHeight || 1), h = m * 0.075, w = Math.min(m * 0.3, h * ar), hh = w / ar;
      const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * u, hh * u), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, toneMapped: false }));
      const sf = this.safe || { top: 0.06, bottom: 0.08, side: 0.06 }, pad = m * 0.04;
      const right = /sag/.test(this.markPos), top = /ust/.test(this.markPos);
      const cx = right ? this.W - this.W * sf.side * 0.6 - pad - w / 2 : this.W * sf.side * 0.6 + pad + w / 2;
      const cy = top ? this.H * sf.top + pad + hh / 2 : this.H * (1 - sf.bottom) - pad - hh / 2;
      mesh.position.set((cx - this.W / 2) * u, (this.H / 2 - cy) * u, 0); mesh.renderOrder = 30;
      const group = new THREE.Group(); group.add(mesh);
      const cam = new THREE.PerspectiveCamera(40, this.W / this.H, 0.1, 100); cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0);
      this._wm = { key, mesh, group, cam };
    }
    return { group: this._wm.group, camera: this._wm.cam, target: new THREE.Vector3() };
  }
  pauseVideos() { for (const v of this.videos.values()) if (v.tagName !== 'IMG' && !v.paused) v.pause(); }
  textFor(shot) {
    if (!this.texts.has(shot.i)) this.texts.set(shot.i, buildText(shot.lines, { layout: shot.layout, card: shot.card ? this.videos.get(shot.card) || this.images.get(shot.card) : null, W: this.W, H: this.H, style: this.style, fonts: this.fonts, size: this.size * (shot.title ? 1.15 : 1), safe: this.capOn && this.caps.chunks.length ? { ...(this.safe || { top: 0.08, bottom: 0.08, side: 0.1 }), bottom: (this.safe ? this.safe.bottom : 0.08) + 0.24 } : this.safe, logo: this.logo }));
    return this.texts.get(shot.i);
  }
  pruneTexts(keep) { for (const [k, T] of this.texts) if (!keep.has(k)) { disposeText(T); this.texts.delete(k); } }
  side(shot, cam, t, alpha = 1) {
    let sc;
    const vp = shot.scene === 'video' ? this.vplan(shot, t) : null;
    if (vp && vp.length) { const k = cam === this.camA ? 0 : 1; sc = this.stock[k] || (this.stock[k] = new StockScene()); sc.set(vp, t, !!shot.flow); }
    else {
      const img = (shot.scene === 'gorsel' || shot.scene === 'video') && shot.image && this.images.get(shot.image);
      sc = img ? imageScene(shot.image, img) : getScene(shot.scene === 'gorsel' || shot.scene === 'video' ? 'yildiz' : shot.scene);
      sc.update(t);
    }
    const lt = t - shot.start;
    const { target } = applyCamera(cam, shot.flow && vp && vp.length ? 'akis' : shot.camera, lt / shot.dur, shot.camK, lt, shot.seed % 100, this.W / this.H);
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
    if (this.capOn && this.caps.chunks.length) {
      const sk = `${this.W}x${this.H}:${JSON.stringify(this.safe)}`; if (this._capKey !== sk) { this._capKey = sk; this.caps.setSize(this.W, this.H, this.safe); }
      const c = this.caps.frame(t, this.style, this.style.accent, `${this.style.font || 'Montserrat'}, Inter, sans-serif`, this.capMode); if (c) texts.push(c);
    }
    if (this.watermark) { const w = this.wmItem(); if (w) texts.push(w); }
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
