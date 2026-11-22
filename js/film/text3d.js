// 3D yazı: her kelime ayrı bir düzlem (doku) olarak uzayda canlandırılır. Arapça şekillendirme 2D kanvasla yapılır.
import * as THREE from '../../vendor/three-bundle.js?v=202611221612';
import { layoutBlock, placeBlock, isMostlyRTL, isRTL } from '../renderer.js?v=202611221612';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeOutBack = p => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

export function rgbOf(hex) { const h = (hex || '#ffffff').replace('#', ''); const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h; return new THREE.Vector3(parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255); }
const TEXT_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const TEXT_FS = `uniform sampler2D map; uniform vec3 color; uniform float opacity; varying vec2 vUv; void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(color * t.rgb, t.a * opacity); }`;
function textMaterial(tex, hex) {
  return new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, color: { value: rgbOf(hex) }, opacity: { value: 1 } }, vertexShader: TEXT_VS, fragmentShader: TEXT_FS, transparent: true, depthTest: false, depthWrite: false });
}

function wordTexture(w, size, color = '#ffffff', shadow = true) {
  const padX = size * 0.35, padY = size * 0.9;
  const cw = Math.ceil(w.w + padX * 2), ch = Math.ceil(size + padY * 2);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  g.font = w.font; g.direction = w.dir; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (shadow) { g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = size * 0.35; g.shadowOffsetY = size * 0.05; }
  g.fillStyle = color; g.fillText(w.text, cw / 2, ch / 2);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  return { tex: t, cw, ch };
}

/**
 * lines: [{text, role:'tag'|'main'|'sub'|'src'}]
 * opts: {W, H, S(style), fonts:{latin, ar, sub}, size}
 * Dünya birimi: kamera z=10, fov 40 iken z=0 düzleminde görünen yükseklik.
 */
export function buildText(lines, opts) {
  const { W, H, style, fonts } = opts;
  const portrait = H > W, m = Math.min(W, H);
  const visH = 2 * 10 * Math.tan(THREE.MathUtils.degToRad(20));
  const u = visH / H;
  const group = new THREE.Group();
  const words = [];
  const safe = opts.safe || { top: 0.08, bottom: 0.08, side: 0.1 };
  const maxW = W * Math.min(portrait ? 0.8 : 0.7, 1 - safe.side * 2);
  const areaH = H * (1 - safe.top - safe.bottom), centerY = H * (safe.top + (1 - safe.top - safe.bottom) / 2);
  const get = role => lines.find(l => l.role === role && l.text && l.text.trim());
  const tag = get('tag'), main = get('main'), sub = get('sub'), src = get('src'), num = get('num'), cta = get('cta');
  const logoImg = lines.some(l => l.role === 'logo') ? opts.logo : null;

  const blocks = [];
  const arFam = `${fonts.ar}, Amiri, serif`;
  if (main) {
    const rtl = isMostlyRTL(main.text);
    const n = main.text.split(/\s+/).length;
    const big = n <= 2 && main.text.length <= 14;
    const L = layoutBlock(main.text, { latin: fonts.latin, ar: arFam, wLatin: /Inter|Montserrat|Bebas/.test(fonts.latin) ? '800' : '700', wAr: '700' },
      maxW, Math.min(H * (sub ? 0.34 : 0.5), areaH * (sub ? 0.5 : 0.72)), m * (big ? 0.2 : 0.105) * (rtl ? 1.25 : 1) * (opts.size || 1), 20, rtl ? 1.75 : isRTL(main.text) ? 1.5 : 1.25);
    blocks.push({ L, role: 'main', color: style.text });
  }
  if (sub) {
    const rtl = isMostlyRTL(sub.text);
    const L = layoutBlock(sub.text, { latin: fonts.sub, ar: arFam, wLatin: /Inter|Montserrat/.test(fonts.sub) ? '500' : '500', wAr: '400' }, maxW * 0.95, Math.min(H * (main ? 0.22 : 0.45), areaH * (main ? 0.3 : 0.65)),
      m * (main ? (style.font ? 0.058 : 0.05) : 0.075) * (rtl ? 1.2 : 1) * (opts.size || 1), 16, rtl ? 1.7 : 1.42);
    blocks.push({ L, role: 'sub', color: style.sub });
  }
  const gap = m * 0.06;
  const badgeS = num ? m * (num.text.length > 2 ? 0.11 : 0.15) : 0;
  const logoH = logoImg ? m * 0.17 : 0;
  const ctaH = cta ? m * 0.11 : 0;
  const pre = (badgeS ? badgeS + gap * 0.7 : 0) + (logoH ? logoH + gap * 0.7 : 0);
  const post = ctaH ? ctaH + gap * 1.1 : 0;
  const textTotal = blocks.reduce((a, b) => a + b.L.height, 0) + gap * Math.max(0, blocks.length - 1);
  const total = textTotal;
  let y = centerY - (textTotal + pre + post) / 2 + pre;
  const stackTop = y - pre;
  let gi = 0;
  for (const b of blocks) {
    placeBlock(b.L, W / 2, y);
    for (const w of b.L.words) {
      const { tex, cw, ch } = wordTexture(w, b.L.size, '#ffffff');
      const mat = textMaterial(tex, b.color);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cw * u, ch * u), mat);
      mesh.renderOrder = 10;
      const x = (w.cxw - W / 2) * u, yy = (H / 2 - w.y) * u;
      mesh.position.set(x, yy, 0);
      mesh.userData = { x, y: yy, i: gi++, role: b.role, li: w.line, base: rgbOf(b.color) };
      group.add(mesh); words.push(mesh);
    }
    y += b.L.height + gap;
  }
  // okunabilirlik için yazının arkasında yumuşak karartma
  let scrim = null;
  if (words.length) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    const bw = Math.max(...blocks.map(b => Math.max(...b.L.lines.map(l => l.width)))) * u * 1.5 + m * u * 0.2;
    const bh = total * u * 1.8 + m * u * 0.15;
    scrim = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), textMaterial(t, '#ffffff'));
    scrim.position.set(0, (H / 2 - (stackTop + (textTotal + pre + post) / 2)) * u, -0.01); scrim.renderOrder = 5;
    group.add(scrim);
  }
  const extras = [];
  const smallLine = (text, py, color, fontCss, sizePx, spacing = 0) => {
    const c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = fontCss;
    const txt = spacing ? [...text].join(' ') : text;
    const tw = g.measureText(txt).width; c.width = Math.ceil(tw + sizePx * 2); c.height = Math.ceil(sizePx * 2.4);
    g.font = fontCss; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = sizePx * 0.4;
    g.fillStyle = '#fff'; g.fillText(txt, c.width / 2, c.height / 2);
    const t = new THREE.CanvasTexture(c);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(c.width * u, c.height * u), textMaterial(t, color));
    mesh.position.set(0, (H / 2 - py) * u, 0); mesh.renderOrder = 10; mesh.userData = { y: (H / 2 - py) * u };
    group.add(mesh); extras.push(mesh); return mesh;
  };
  const topY = stackTop + pre;
  // numara rozeti, logo, vurgu çizgisi, çağrı düğmesi
  const canvasMesh = (c, cx, cy, kind) => {
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(c.width * u, c.height * u), textMaterial(t, '#ffffff'));
    mesh.position.set((cx - W / 2) * u, (H / 2 - cy) * u, 0.01); mesh.renderOrder = 11; mesh.userData = { x: (cx - W / 2) * u, y: (H / 2 - cy) * u, kind };
    group.add(mesh); return mesh;
  };
  let badge = null, logo = null, bar = null, ctaMesh = null;
  if (num) {
    const S = Math.ceil(badgeS * 1.25), c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    const r = badgeS / 2, cx = S / 2;
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = badgeS * 0.12; g.shadowOffsetY = badgeS * 0.03;
    g.fillStyle = style.accent; g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.fill(); g.shadowColor = 'transparent';
    g.fillStyle = style.badgeText || '#111111'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${Math.round(badgeS * (num.text.length > 1 ? 0.5 : 0.62))}px Montserrat, Inter, sans-serif`; g.fillText(num.text, cx, cx + badgeS * 0.03);
    badge = canvasMesh(c, W / 2, stackTop + badgeS / 2, 'badge');
  }
  if (logoImg) {
    const ar = (logoImg.naturalWidth || logoImg.width) / Math.max(1, logoImg.naturalHeight || logoImg.height);
    const lw = Math.min(maxW * 0.6, logoH * ar), lh = lw / ar;
    const c = document.createElement('canvas'); c.width = Math.ceil(lw); c.height = Math.ceil(lh); c.getContext('2d').drawImage(logoImg, 0, 0, c.width, c.height);
    logo = canvasMesh(c, W / 2, stackTop + (badgeS ? badgeS + gap * 0.7 : 0) + logoH / 2, 'logo');
  }
  if (main && style.bar !== false && blocks.length) {
    const mb = blocks.find(b => b.role === 'main');
    if (mb && !isMostlyRTL(main.text)) {
      const bw = Math.min(m * 0.16, Math.max(...mb.L.lines.map(l => l.width)) * 0.5), bh = Math.max(3, m * 0.007);
      const c = document.createElement('canvas'); c.width = Math.ceil(bw); c.height = Math.ceil(bh); const g = c.getContext('2d'); g.fillStyle = style.accent; g.fillRect(0, 0, c.width, c.height);
      const by = topY + mb.L.height + (blocks.length > 1 ? gap * 0.5 : gap * 0.45);
      bar = canvasMesh(c, W / 2, by, 'bar');
    }
  }
  if (cta) {
    const fs = Math.round(m * 0.046), c0 = document.createElement('canvas').getContext('2d'); c0.font = `800 ${fs}px Montserrat, Inter, sans-serif`;
    const txt = cta.text.toLocaleUpperCase('tr'); const tw = c0.measureText(txt).width;
    const pw = Math.ceil(tw + fs * 2.4), ph = Math.ceil(fs * 2.2), pad = Math.ceil(fs * 0.6);
    const c = document.createElement('canvas'); c.width = pw + pad * 2; c.height = ph + pad * 2; const g = c.getContext('2d');
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = fs * 0.5; g.shadowOffsetY = fs * 0.12;
    g.fillStyle = style.accent; const rr = ph / 2; g.beginPath(); g.moveTo(pad + rr, pad); g.arcTo(pad + pw, pad, pad + pw, pad + ph, rr); g.arcTo(pad + pw, pad + ph, pad, pad + ph, rr); g.arcTo(pad, pad + ph, pad, pad, rr); g.arcTo(pad, pad, pad + pw, pad, rr); g.closePath(); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = style.badgeText || '#111111'; g.font = `800 ${fs}px Montserrat, Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, c.width / 2, c.height / 2 + fs * 0.05);
    ctaMesh = canvasMesh(c, W / 2, topY + textTotal + gap * 1.1 + ctaH / 2, 'cta');
  }
  const tagMesh = tag ? smallLine(tag.text.toLocaleUpperCase('tr'), Math.max(H * (safe.top + 0.02), (pre ? stackTop : topY) - m * 0.09), style.accent, `${style.font ? 800 : 600} ${Math.round(m * (style.font ? 0.04 : 0.03))}px ${style.font ? 'Montserrat, ' : ''}Inter, sans-serif`, m * (style.font ? 0.04 : 0.03), 1) : null;
  const srcMesh = src ? smallLine('— ' + src.text + ' —', Math.min(H * (1 - safe.bottom - 0.02), y + post + m * 0.03), style.accent, `italic 500 ${Math.round(m * 0.032)}px Lora, serif`, m * 0.032) : null;
  return { group, words, tagMesh, srcMesh, scrim, u, count: gi, badge, logo, bar, ctaMesh };
}

export function disposeText(T) {
  if (!T) return;
  T.group.traverse(o => { if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } if (o.geometry) o.geometry.dispose(); });
}

/**
 * Kelime animasyonu. lt: çekim içi süre, dur: çekim süresi
 * timing: (isteğe bağlı) kelime başlama zamanları (çekim içi saniye)
 */
export function animateText(T, lt, dur, anim, style, seed = 1, timing = null, alpha = 1) {
  const n = T.words.length;
  const mainN = T.words.filter(w => w.userData.role === 'main').length;
  const readEnd = Math.max(0.8, Math.min(dur * 0.62, n * 0.32 + 0.6));
  const step = n > 1 ? (readEnd - 0.35) / n : 0.3;
  const r = rng(seed * 977 + 13);
  const accent = rgbOf(style.accent);
  for (const w of T.words) {
    const d = w.userData;
    if (!d.rand) d.rand = [r() - .5, r() - .5, r() - .5, r()];
    const appear = timing && d.role === 'main' && timing[d.i] != null ? timing[d.i] : 0.25 + d.i * step;
    const life = lt - appear;
    let p = clamp(life / (anim === 'daktilo' ? 0.08 : 0.7));
    const e = easeOut(p);
    w.position.set(d.x, d.y, 0); w.rotation.set(0, 0, 0); w.scale.set(1, 1, 1);
    let op = e;
    switch (anim) {
      case 'derinlik': w.position.z = -7 * (1 - e); w.position.y = d.y - 0.15 * (1 - e); break;
      case 'dagil': w.position.x = d.x + d.rand[0] * 6 * (1 - e); w.position.y = d.y + d.rand[1] * 4 * (1 - e); w.position.z = d.rand[2] * 8 * (1 - e); w.rotation.z = d.rand[0] * 1.5 * (1 - e); break;
      case 'donus': w.rotation.y = (Math.PI / 2) * (1 - easeOutBack(p)); w.rotation.x = 0.4 * (1 - e); break;
      case 'isik': { const s = 1 + 0.12 * (1 - e); w.scale.set(s, s, 1); w.position.y = d.y - 0.12 * (1 - e); break; }
      case 'tek': { const s = p < 1 ? 0.6 + 0.4 * Math.min(1.05, easeOutBack(p)) : 1; w.scale.set(s, s, 1); break; }
      case 'daktilo': op = p > 0 ? 1 : 0; break;
      default: w.position.y = d.y - 0.35 * (1 - e);
    }
    // vurgu rengi: yeni beliren kelime vurgu renginde başlar
    const hl = clamp((life - 0.2) / 0.9);
    const U = w.material.uniforms;
    if (d.role === 'main') U.color.value.copy(accent).lerp(d.base, hl); else U.color.value.copy(d.base);
    U.opacity.value = op * alpha;
    w.visible = op * alpha > 0.001;
  }
  const extraIn = e => easeOut(clamp(e));
  if (T.tagMesh) { const a = extraIn((lt - 0.05) / 0.6); T.tagMesh.material.uniforms.opacity.value = a * alpha; T.tagMesh.position.y = T.tagMesh.userData.y + 0.08 * (1 - a); }
  if (T.srcMesh) { const a = extraIn((lt - readEnd) / 0.7); T.srcMesh.material.uniforms.opacity.value = a * alpha; T.srcMesh.position.y = T.srcMesh.userData.y - 0.06 * (1 - a); }
  const pop = (mesh, at, dur2 = 0.55) => { if (!mesh) return 0; const p = clamp((lt - at) / dur2); const s = p <= 0 ? 0.001 : Math.max(0.001, easeOutBack(p)); mesh.scale.set(s, s, 1); mesh.material.uniforms.opacity.value = clamp(p * 2) * alpha; mesh.visible = p > 0 && alpha > 0.001; return p; };
  pop(T.logo, 0.05, 0.8); pop(T.badge, 0.08, 0.5);
  if (T.bar) { const p = easeOut(clamp((lt - 0.35) / 0.6)); T.bar.scale.set(Math.max(0.001, p), 1, 1); T.bar.material.uniforms.opacity.value = alpha * (p > 0 ? 1 : 0); }
  if (T.ctaMesh) { const at = Math.min(readEnd, Math.max(0.6, dur * 0.35)); const p = pop(T.ctaMesh, at, 0.6); if (p >= 1) { const k = 1 + 0.045 * Math.max(0, Math.sin((lt - at) * 4.2)); T.ctaMesh.scale.set(k, k, 1); } }
  if (T.scrim) { const first = T.words.length ? Math.min(...T.words.map(w => (timing && w.userData.role === 'main' && timing[w.userData.i] != null) ? timing[w.userData.i] : 0.25)) : 0; T.scrim.material.uniforms.opacity.value = (style.scrim ?? 0.55) * alpha * easeOut(clamp((lt - first + 0.3) / 0.8)); }
  // tüm grup hafifçe kameraya süzülür
  const s = 1 + 0.025 * clamp(lt / Math.max(1, dur));
  T.group.scale.set(s, s, s);
}
