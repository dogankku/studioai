import { THEMES, seekVideo } from './backgrounds.js';
import { buildScene, drawFrame, dims, isRTL } from './renderer.js';
import { parseList, parseCSV, toListText, makeItem } from './parser.js';
import { decodeFile, mixFor, playPreview, stopPreview, live } from './audio.js';
import { encodeFast, encodeRealtime, hasFast } from './encoder.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const cv = $('#cv'), ctx = cv.getContext('2d');

/* ================= Durum ================= */
const DEFAULTS = {
  format: '9:16', res: '1080', fps: '30', quality: '1',
  theme: 'gece', bgSource: 'theme', colorMode: 'gradient', color1: '#1b2a4a', color2: '#7a2d5c', gradAngle: 135, gradAnimate: true,
  mediaMode: 'seq', tone: 'dark', kenburns: true, dim: 0.35, blur: 0, particles: 'auto', pattern: true, vignette: true, frame: true,
  anim: 'word', latinFont: '"Playfair Display", serif', arabicFont: 'Amiri', subFont: 'Lora, serif', size: 1, speed: 0.45,
  position: 'center', panel: 'none', shadow: true, textColor: '', accentColor: '', subColor: '',
  handle: '', logoPos: 'br', logoOpacity: 0.85, logoSize: 0.12,
  musicMode: 'none', musicVol: 0.8, fadeIn: true, fadeOut: true,
  durMode: 'auto', fixedDur: 15, hold: 2.6, fileName: '{no}-{kaynak}', defaultTag: ''
};
const SAMPLE = [
  { main: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا (٥) إِنَّ مَعَ الْعُسْرِ يُسْرًا (٦)', sub: 'Demek ki zorlukla beraber bir kolaylık vardır. Evet, zorlukla beraber bir kolaylık vardır.', src: 'İnşirah, 5-6', tag: 'Günün Ayeti' },
  { main: 'رَبِّ زِدْنِي عِلْمًا', sub: 'Rabbim! İlmimi artır.', src: 'Tâhâ, 114', tag: 'Günün Duası' },
  { main: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ', sub: 'Ameller ancak niyetlere göredir.', src: 'Buhârî, Bed’ü’l-vahy 1', tag: 'Hadis-i Şerif' },
  { main: 'Acele etme. Her şey vaktinde ve en güzel hâliyle gelir.', sub: '', src: '', tag: 'Bir Söz' }
];

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};
let S = { ...DEFAULTS, ...store.get('tvs-settings', {}) };
let items = (store.get('tvs-items', null) || SAMPLE).map(makeItem);
let sel = 0;
const media = [];   // {type, el, url, name}
const music = [];   // {name, buffer}
let logo = null, logoUrl = null;
const results = new Map(); // id -> {blob, url, name, ext}

let saveT = 0;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { store.set('tvs-settings', S); store.set('tvs-items', items.map(({ main, sub, src, tag }) => ({ main, sub, src, tag }))); }, 300); }

/* ================= Yardımcılar ================= */
function hash(i) { let x = (i + 1) * 2654435761 >>> 0; x ^= x >>> 15; return x >>> 0; }
function pick(arr, mode, i) {
  if (!arr.length || mode === 'none') return null;
  if (mode === 'first' || mode === 'same') return arr[0];
  if (mode === 'seq') return arr[i % arr.length];
  return arr[hash(i) % arr.length];
}
const pickMedia = i => S.bgSource === 'media' ? pick(media, S.mediaMode, i) : null;
const pickMusic = i => pick(music, S.musicMode, i);
const TR = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u', 'ê': 'e', 'ô': 'o' };
function slug(s, n = 40) {
  return (s || '').toLocaleLowerCase('tr').replace(/[çğıöşüâîûêô]/g, c => TR[c])
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n);
}
function fileNameFor(i) {
  const it = items[i];
  const pad = String(items.length).length < 2 ? 2 : String(items.length).length;
  let n = S.fileName || '{no}';
  n = n.replace(/\{no\}/g, String(i + 1).padStart(pad, '0'))
       .replace(/\{kaynak\}/g, slug(it.src))
       .replace(/\{etiket\}/g, slug(it.tag || S.defaultTag))
       .replace(/\{metin\}/g, slug((isRTL(it.main) ? it.sub : it.main).split(/\s+/).slice(0, 5).join(' ')));
  n = n.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '') || String(i + 1);
  return n;
}
const sceneSettings = () => ({ ...S, forceDark: S.tone === 'dark', size: +S.size, speed: +S.speed });

function sceneFor(i, W, H) {
  const m = pickMusic(i);
  return buildScene(items[i] || makeItem(), sceneSettings(), W, H, { index: i, media: pickMedia(i), audioDur: m ? m.buffer.duration : 0, logo });
}
function previewDims() { return dims(S.format, Math.min(+S.res, 1080)); }

/* ================= Yazı tipleri ================= */
async function ensureFonts() {
  const fam = s => s.split(',')[0].trim();
  const list = [
    `700 60px ${fam(S.latinFont)}`, `800 60px ${fam(S.latinFont)}`, `400 60px ${fam(S.latinFont)}`,
    `700 60px ${S.arabicFont}`, `400 60px ${S.arabicFont}`, '700 60px Amiri',
    `500 40px ${fam(S.subFont)}`, '400 40px Amiri', 'italic 500 40px Lora', '600 30px Inter'
  ];
  try {
    await Promise.race([
      Promise.all(list.map(f => document.fonts.load(f, f.includes('Amiri') || f.includes(S.arabicFont) ? 'بسم' : 'Ağış'))),
      new Promise(r => setTimeout(r, 5000))
    ]);
  } catch (e) { }
}

/* ================= Arayüz kurulum ================= */
const themesEl = $('#themes');
for (const [k, t] of Object.entries(THEMES)) {
  const d = document.createElement('div');
  d.className = 'sw'; d.dataset.v = k; d.style.background = t.swatch;
  d.innerHTML = `<span style="${t.dark ? '' : 'color:#2a2118;text-shadow:none'}">${t.name}</span>`;
  d.onclick = () => { S.theme = k; S.textColor = S.accentColor = S.subColor = ''; changed(); };
  themesEl.appendChild(d);
}

const CHIP_GROUPS = { bgSrc: 'bgSource', anim: 'anim', position: 'position', format: 'format' };
for (const [id, key] of Object.entries(CHIP_GROUPS)) {
  $('#' + id).addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; S[key] = b.dataset.v; changed(); });
}

const FIELD_KEYS = Object.keys(DEFAULTS).filter(k => document.getElementById(k) && !CHIP_GROUPS[k]);
for (const k of FIELD_KEYS) {
  const el = document.getElementById(k);
  const ev = (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'color') ? 'change' : 'input';
  el.addEventListener(ev, () => {
    if (el.type === 'checkbox') S[k] = el.checked;
    else if (el.type === 'range') S[k] = +el.value;
    else S[k] = el.value;
    if (['latinFont', 'arabicFont', 'subFont'].includes(k)) ensureFonts().then(changed); else changed();
  });
  if (el.type === 'color') el.addEventListener('input', () => { S[k] = el.value; changed(); });
}
$('#resetColors').onclick = () => { S.textColor = S.accentColor = S.subColor = ''; changed(); };

function fmtOut(o) {
  const el = document.getElementById(o.dataset.for); const v = +el.value;
  o.textContent = o.hasAttribute('data-pct') ? Math.round(v * 100) + '%' : (Number.isInteger(v) ? v : v.toFixed(2)) + (o.dataset.unit || '');
}

function syncUI() {
  for (const k of FIELD_KEYS) {
    const el = document.getElementById(k);
    if (el.type === 'checkbox') el.checked = !!S[k];
    else if (el.type === 'color') {
      const base = THEMES[S.theme]; const map = { textColor: 'text', accentColor: 'accent', subColor: 'sub' };
      el.value = S[k] || (map[k] ? base[map[k]] : '#000000');
    } else el.value = S[k];
  }
  for (const [id, key] of Object.entries(CHIP_GROUPS)) $$(`#${id} [data-v]`).forEach(b => b.classList.toggle('on', b.dataset.v === S[key]));
  $$('#themes .sw').forEach(d => d.classList.toggle('on', d.dataset.v === S.theme));
  $$('output[data-for]').forEach(fmtOut);
  $('#colorBox').style.display = S.bgSource === 'color' ? '' : 'none';
  $('#mediaBox').style.display = S.bgSource === 'media' ? '' : 'none';
  $('#fixedBox').style.display = S.durMode === 'fixed' ? '' : 'none';
  $('#color2').style.display = S.colorMode === 'solid' ? 'none' : '';
}

/* sekmeler */
function switchTab(name) {
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $$('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === name));
}
$('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); };

/* ================= Liste ================= */
function esc(s) { return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function renderList() {
  const el = $('#itemList');
  $('#count').textContent = `(${items.length})`;
  if (!items.length) { el.innerHTML = '<div class="empty">Liste boş. "+ Yeni" ile ya da aşağıdan toplu ekleyin.</div>'; renderQueue(); return; }
  el.innerHTML = items.map((it, i) => {
    const ar = isRTL(it.main);
    const first = esc((it.main || it.sub).split('\n')[0]);
    const small = esc([it.src, ar ? it.sub : ''].filter(Boolean).join(' · '));
    const done = results.has(it.id) ? ' ✓' : '';
    return `<div class="it${i === sel ? ' on' : ''}" data-i="${i}">
      <div class="no">${i + 1}${done}</div>
      <div class="tx${ar ? ' ar' : ''}">${first}${small ? `<small>${small}</small>` : ''}</div>
      <div class="acts">
        <button data-a="up" title="Yukarı">↑</button><button data-a="down" title="Aşağı">↓</button>
        <button data-a="dup" title="Çoğalt">⧉</button><button data-a="del" title="Sil">✕</button>
      </div></div>`;
  }).join('');
  renderQueue();
}
$('#itemList').onclick = e => {
  const row = e.target.closest('.it'); if (!row) return;
  const i = +row.dataset.i, a = e.target.closest('[data-a]')?.dataset.a;
  if (a === 'up' && i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; sel = i - 1; }
  else if (a === 'down' && i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; sel = i + 1; }
  else if (a === 'dup') { items.splice(i + 1, 0, makeItem(items[i])); sel = i + 1; }
  else if (a === 'del') { const [r] = items.splice(i, 1); dropResult(r.id); sel = Math.min(sel, items.length - 1); }
  else sel = i;
  sel = Math.max(0, sel);
  listChanged();
};
function listChanged() { save(); renderList(); loadEditor(); restart(); }

function loadEditor() {
  const it = items[sel];
  $('#editor').style.display = it ? '' : 'none';
  if (!it) return;
  $('#editNo').textContent = '#' + (sel + 1);
  $('#eMain').value = it.main; $('#eSub').value = it.sub; $('#eSrc').value = it.src; $('#eTag').value = it.tag;
  syncDir();
}
function syncDir() { ['eMain', 'eSub'].forEach(id => $('#' + id).classList.toggle('rtl', isRTL($('#' + id).value))); }
[['eMain', 'main'], ['eSub', 'sub'], ['eSrc', 'src'], ['eTag', 'tag']].forEach(([id, k]) => {
  $('#' + id).addEventListener('input', e => {
    const it = items[sel]; if (!it) return;
    it[k] = e.target.value; dropResult(it.id); syncDir(); save(); renderListSoon(); rebuildScene();
  });
});
let listT = 0; function renderListSoon() { clearTimeout(listT); listT = setTimeout(renderList, 250); }

$('#addItem').onclick = () => { items.splice(sel + 1, 0, makeItem({ main: 'Yeni metin' })); sel = Math.min(sel + 1, items.length - 1); listChanged(); $('#eMain').focus(); $('#eMain').select(); };
$('#clearList').onclick = () => { if (!items.length) return; if (!confirmInline($('#clearList'), 'Emin misiniz?')) return; items = []; results.forEach((_, id) => dropResult(id)); sel = 0; listChanged(); };
function confirmInline(btn, msg) {
  if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.orig; return true; }
  btn.dataset.orig = btn.textContent; btn.dataset.armed = '1'; btn.textContent = msg;
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.orig; } }, 3000);
  return false;
}
function bulkParse() {
  const t = $('#bulkText').value.trim(); if (!t) return [];
  const looksTable = t.split('\n')[0].includes('\t');
  return looksTable ? parseCSV(t) : parseList(t);
}
$('#bulkAppend').onclick = () => { const n = bulkParse(); if (!n.length) return; items.push(...n); sel = items.length - n.length; $('#bulkText').value = ''; listChanged(); };
$('#bulkReplace').onclick = () => { const n = bulkParse(); if (!n.length) return; results.forEach((_, id) => dropResult(id)); items = n; sel = 0; $('#bulkText').value = ''; listChanged(); };
$('#csvFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const n = parseCSV(await f.text()); e.target.value = '';
  if (n.length) { items.push(...n); sel = items.length - n.length; listChanged(); }
};
$('#exportList').onclick = () => { $('#bulkText').value = toListText(items); $('#bulkText').focus(); };

/* ================= Medya ================= */
$('#mediaFiles').onchange = async e => {
  const files = [...e.target.files]; e.target.value = '';
  for (const f of files) {
    const url = URL.createObjectURL(f);
    try {
      if (f.type.startsWith('video/')) {
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'; v.src = url;
        await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = rej; });
        v.addEventListener('seeked', () => { if (!playing && !busy) dirty = true; });
        media.push({ type: 'video', el: v, url, name: f.name });
      } else {
        const img = new Image(); img.src = url; await img.decode();
        media.push({ type: 'image', el: img, url, name: f.name });
      }
    } catch (err) { URL.revokeObjectURL(url); alertMsg(`${f.name} açılamadı.`); }
  }
  if (media.length) S.bgSource = 'media';
  renderMedia(); changed();
};
function renderMedia() {
  $('#mediaList').innerHTML = media.map((m, i) => `<div class="m" title="${esc(m.name)}">${m.type === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="">`}<b>${i + 1}${m.type === 'video' ? ' ▶' : ''}</b><button data-i="${i}" title="Kaldır">✕</button></div>`).join('');
}
$('#mediaList').onclick = e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  const [m] = media.splice(+b.dataset.i, 1); if (m.type === 'video') m.el.pause(); URL.revokeObjectURL(m.url);
  renderMedia(); changed();
};

/* ================= Ses ================= */
$('#musicFiles').onchange = async e => {
  const files = [...e.target.files]; e.target.value = '';
  for (const f of files) {
    try { music.push({ name: f.name, buffer: await decodeFile(f) }); }
    catch (err) { alertMsg(`${f.name} okunamadı.`); }
  }
  if (music.length && S.musicMode === 'none') S.musicMode = 'same';
  renderMusic(); changed();
};
function renderMusic() {
  $('#musicList').innerHTML = music.map((m, i) => `<div class="a"><span>${i + 1}. ${esc(m.name)}</span><span class="muted">${m.buffer.duration.toFixed(1)} sn <button data-i="${i}" title="Kaldır">✕</button></span></div>`).join('');
}
$('#musicList').onclick = e => { const b = e.target.closest('button[data-i]'); if (!b) return; music.splice(+b.dataset.i, 1); renderMusic(); changed(); };

/* ================= Logo ================= */
$('#logoFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  if (logoUrl) URL.revokeObjectURL(logoUrl);
  logoUrl = URL.createObjectURL(f); const img = new Image(); img.src = logoUrl;
  try { await img.decode(); logo = img; $('#logoName').textContent = f.name; } catch (err) { alertMsg('Logo açılamadı.'); }
  changed();
};
$('#logoClear').onclick = () => { logo = null; if (logoUrl) URL.revokeObjectURL(logoUrl); logoUrl = null; $('#logoName').textContent = 'Logo yok'; changed(); };

let msgT = 0;
function alertMsg(t) { const l = $('#loading'); l.textContent = t; l.classList.remove('hide'); clearTimeout(msgT); msgT = setTimeout(() => l.classList.add('hide'), 3500); }

/* ================= Önizleme ================= */
let scene = null, playing = false, busy = false, t0 = 0, curT = 0, dirty = true;
function rebuildScene() {
  const [W, H] = previewDims();
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  fitCanvas();
  scene = sceneFor(Math.min(sel, Math.max(0, items.length - 1)), W, H);
  curT = Math.min(curT, scene.dur);
  $('#itemPos').textContent = items.length ? `${sel + 1} / ${items.length}` : '0 / 0';
  updateTime();
  if (!playing) seekBg();
  dirty = true;
}
function changed() { save(); syncUI(); rebuildScene(); updateEngineInfo(); }
function updateTime() {
  if (!scene) return;
  $('#time').textContent = `${curT.toFixed(1)} / ${scene.dur.toFixed(1)} sn`;
  $('#seek').value = Math.round(curT / scene.dur * 1000);
}
function bgVideo() { return scene && scene.media && scene.media.type === 'video' ? scene.media.el : null; }
function seekBg() { const v = bgVideo(); if (v) { v.pause(); seekVideo(v, curT).then(() => (dirty = true)); } }
function startPlayback(from) {
  if (!scene || busy) return;
  curT = from; t0 = performance.now() - from * 1000; playing = true;
  const v = bgVideo(); if (v) { v.currentTime = from % (v.duration || 1); v.play().catch(() => { }); }
  const m = pickMusic(sel);
  if (m) { try { live(); playPreview(m.buffer, from, scene.dur, { volume: S.musicVol, fadeIn: S.fadeIn, fadeOut: S.fadeOut }); } catch (e) { } }
  $('#play').textContent = '❚❚ Durdur';
}
function stopPlayback() {
  playing = false; stopPreview();
  const v = bgVideo(); if (v) v.pause();
  $('#play').textContent = '▶ Oynat';
}
function restart() { stopPlayback(); curT = 0; rebuildScene(); }
$('#play').onclick = () => { if (playing) stopPlayback(); else startPlayback(curT >= scene.dur - 0.05 ? 0 : curT); };
$('#seek').oninput = e => { const was = playing; stopPlayback(); curT = e.target.value / 1000 * scene.dur; updateTime(); seekBg(); dirty = true; if (was) startPlayback(curT); };
$('#prev').onclick = () => { if (sel > 0) { sel--; renderList(); loadEditor(); restart(); } };
$('#next').onclick = () => { if (sel < items.length - 1) { sel++; renderList(); loadEditor(); restart(); } };

function loop(now) {
  if (!busy && scene) {
    if (playing) {
      curT = (now - t0) / 1000;
      if (curT >= scene.dur) { curT = scene.dur; stopPlayback(); }
      const v = bgVideo();
      if (v && v.duration && playing) { const tgt = curT % v.duration; if (Math.abs(v.currentTime - tgt) > 0.3 && Math.abs(v.currentTime - tgt) < v.duration - 0.3) v.currentTime = tgt; }
      drawFrame(ctx, scene, curT); updateTime();
    } else if (dirty || (scene.media && scene.media.type === 'video')) {
      drawFrame(ctx, scene, curT); dirty = false;
    }
  }
  requestAnimationFrame(loop);
}

/* ================= Üretim ================= */
let cancelFlag = false;
const qState = new Map(); // id -> {st, p, cls}
function setQ(id, st, p = 0, cls = '') { qState.set(id, { st, p, cls }); const row = document.querySelector(`.q[data-id="${id}"]`); if (row) { row.querySelector('.st').textContent = st; row.querySelector('.st').className = 'st ' + cls; row.querySelector('.prog i').style.width = (p * 100).toFixed(1) + '%'; } }
function renderQueue() {
  const el = $('#queueList');
  el.innerHTML = items.map((it, i) => {
    const r = results.get(it.id), q = qState.get(it.id) || (r ? { st: `Hazır · ${(r.blob.size / 1048576).toFixed(1)} MB`, p: 1, cls: 'ok' } : { st: 'Bekliyor', p: 0, cls: '' });
    return `<div class="q" data-id="${it.id}"><div class="no muted">${i + 1}</div>
      <div><div class="tx">${esc((it.main || it.sub).split('\n')[0])}</div><div class="st ${q.cls}">${esc(q.st)}</div></div>
      <div class="acts">${r ? `<button class="btn sm" data-a="view" data-id="${it.id}">▶</button><button class="btn sm" data-a="dl" data-id="${it.id}">⬇</button>` : ''}</div>
      <div class="prog"><i style="width:${(q.p * 100).toFixed(1)}%"></i></div></div>`;
  }).join('') || '<div class="empty">Önce Metinler sekmesinden liste oluşturun.</div>';
  const n = results.size;
  $('#doneBadge').textContent = n ? n : '';
  $('#zipAll').disabled = busy || !n; $('#clearDone').disabled = busy || !n;
}
$('#queueList').onclick = e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const r = results.get(b.dataset.id); if (!r) return;
  if (b.dataset.a === 'dl') saveFile(r.blob, r.name);
  else openModal(r);
};
function dropResult(id) { const r = results.get(id); if (r) { URL.revokeObjectURL(r.url); results.delete(id); } qState.delete(id); }

function setBusy(v) {
  busy = v;
  ['#queueAll', '#queueOne', '#renderBtn', '#play', '#seek'].forEach(s => ($(s).disabled = v));
  $('#cancelAll').disabled = !v;
  renderQueue();
}

async function runQueue(indices) {
  if (busy || !indices.length) return;
  stopPlayback(); cancelFlag = false; setBusy(true); switchTab('uretim');
  await ensureFonts();
  indices.forEach(i => setQ(items[i].id, 'Sırada', 0));
  const ex = document.createElement('canvas');
  const ectx = ex.getContext('2d', { alpha: false });
  const [W, H] = dims(S.format, +S.res);
  ex.width = W; ex.height = H;
  const fps = +S.fps;
  const bitrate = Math.round(W * H * fps * 0.11 * +S.quality);
  let done = 0, failed = 0;
  const t0all = performance.now();
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k], it = items[i];
    $('#overallTxt').textContent = `${k + 1} / ${indices.length}`;
    setQ(it.id, 'Hazırlanıyor…', 0);
    try {
      const sc = sceneFor(i, W, H);
      const m = pickMusic(i);
      const audio = m ? await mixFor(m.buffer, sc.dur, { volume: S.musicVol, fadeIn: S.fadeIn, fadeOut: S.fadeOut, loop: true }) : null;
      const vid = sc.media && sc.media.type === 'video' ? sc.media.el : null;
      if (vid) vid.pause();
      const prog = p => { setQ(it.id, `Üretiliyor %${Math.round(p * 100)}`, p); $('#overallBar').style.width = ((k + p) / indices.length * 100).toFixed(1) + '%'; };
      let res = null;
      if (hasFast()) {
        try {
          res = await encodeFast({
            canvas: ex, W, H, fps, dur: sc.dur, bitrate, audio, onProgress: prog, cancelled: () => cancelFlag,
            renderAt: async t => { if (vid) await seekVideo(vid, t); drawFrame(ectx, sc, t); }
          });
        } catch (e) { if (e.message !== 'NO_FAST') throw e; }
      }
      if (!res) {
        res = await encodeRealtime({
          canvas: ex, fps, dur: sc.dur, bitrate, audio, audioCtx: audio ? live() : null, onProgress: prog, cancelled: () => cancelFlag,
          renderLive: t => drawFrame(ectx, sc, t),
          startMedia: () => { if (vid) { vid.currentTime = 0; vid.play().catch(() => { }); } }
        });
        if (vid) vid.pause();
      }
      dropResult(it.id);
      const name = `${fileNameFor(i)}.${res.ext}`;
      results.set(it.id, { blob: res.blob, url: URL.createObjectURL(res.blob), name, ext: res.ext, audioCodec: res.audioCodec });
      qState.delete(it.id);
      setQ(it.id, `Hazır · ${(res.blob.size / 1048576).toFixed(1)} MB`, 1, 'ok');
      done++;
      if (res.audioCodec === 'opus') $('#dlHint').textContent = 'Not: Bu tarayıcı AAC ses kodlayamadı, ses Opus olarak eklendi. Chrome/Edge (Windows, Mac) AAC üretir; iPhone uyumluluğu için onları kullanın.';
    } catch (e) {
      if (e.message === 'CANCEL') { setQ(it.id, 'Durduruldu', 0); indices.slice(k + 1).forEach(j => setQ(items[j].id, 'Bekliyor', 0)); break; }
      console.error(e); failed++;
      setQ(it.id, 'Hata: ' + (e.message || e), 0, 'err');
    }
    renderList();
  }
  if (!cancelFlag) $('#overallBar').style.width = '100%';
  const secs = ((performance.now() - t0all) / 1000).toFixed(0);
  $('#overallTxt').textContent = cancelFlag ? 'Durduruldu' : `${done} video hazır${failed ? `, ${failed} hata` : ''} · ${secs} sn`;
  setBusy(false); renderList(); rebuildScene();
}
$('#queueAll').onclick = $('#renderBtn').onclick = () => runQueue(items.map((_, i) => i));
$('#queueOne').onclick = () => items[sel] && runQueue([sel]);
$('#cancelAll').onclick = () => { cancelFlag = true; };
$('#clearDone').onclick = () => { [...results.keys()].forEach(dropResult); renderList(); };

/* ================= İndirme ================= */
let claudeDl = null;
try { if (window.claude && window.claude.use) window.claude.use('downloads').then(d => (claudeDl = d)).catch(() => { }); } catch (e) { }
async function saveFile(blob, name) {
  if (claudeDl) {
    try { await claudeDl.save({ filename: name, data: blob }); return; }
    catch (e) { if (e && e.code === 'declined') return; }
  }
  const a = document.createElement('a'); const url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
$('#zipAll').onclick = async () => {
  if (!window.JSZip) return alertMsg('ZIP kütüphanesi yüklenemedi.');
  const zip = new JSZip(); const used = new Set();
  items.forEach(it => { const r = results.get(it.id); if (!r) return; let n = r.name, c = 2; while (used.has(n)) n = r.name.replace(/(\.\w+)$/, `-${c++}$1`); used.add(n); zip.file(n, r.blob); });
  $('#zipAll').disabled = true; $('#zipAll').textContent = 'ZIP hazırlanıyor…';
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  $('#zipAll').textContent = '⬇ Hepsini ZIP olarak indir'; $('#zipAll').disabled = false;
  saveFile(blob, `${slug(S.defaultTag) || 'videolar'}.zip`);
};
let modalRes = null;
function openModal(r) { modalRes = r; $('#modalVid').src = r.url; $('#modal').classList.add('show'); $('#modalVid').play().catch(() => { }); }
$('#modalClose').onclick = () => { $('#modalVid').pause(); $('#modal').classList.remove('show'); };
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modalClose').click(); };
$('#modalDl').onclick = () => modalRes && saveFile(modalRes.blob, modalRes.name);

/* ================= Proje ================= */
$('#saveProj').onclick = () => {
  const data = { app: 'toplu-video-studyosu', version: 1, settings: S, items: items.map(({ main, sub, src, tag }) => ({ main, sub, src, tag })) };
  saveFile(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${slug(S.defaultTag) || 'proje'}.json`);
};
$('#loadProj').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try {
    const d = JSON.parse(await f.text());
    if (d.settings) S = { ...DEFAULTS, ...d.settings };
    if (Array.isArray(d.items)) { [...results.keys()].forEach(dropResult); items = d.items.map(makeItem); sel = 0; }
    await ensureFonts(); listChanged(); changed();
  } catch (err) { alertMsg('Proje dosyası okunamadı.'); }
};

function updateEngineInfo() {
  const [W, H] = dims(S.format, +S.res);
  const fast = hasFast();
  $('#engineInfo').innerHTML = `Çıktı: <b>${W}×${H}</b>, ${S.fps} fps, MP4.<br>` + (fast
    ? '<b>Hızlı mod açık.</b> Videolar kare kare kodlanır, çoğu zaman gerçek süresinden hızlı biter. Video arka planlar biraz yavaşlatır.'
    : '<b>Gerçek zamanlı mod.</b> Bu tarayıcıda hızlı kodlama yok; her video kendi süresi kadar sürer. En iyi sonuç için Chrome ya da Edge kullanın.');
}

function fitCanvas() {
  const st = $('#stage'); const aw = st.clientWidth - 44, ah = st.clientHeight - 44;
  if (aw <= 0 || ah <= 0) return;
  const k = Math.min(aw / cv.width, ah / cv.height);
  cv.style.width = Math.floor(cv.width * k) + 'px'; cv.style.height = Math.floor(cv.height * k) + 'px';
}
window.addEventListener('resize', fitCanvas);

/* ================= Başlat ================= */
syncUI(); renderList(); loadEditor(); updateEngineInfo();
ensureFonts().then(() => { $('#loading').classList.add('hide'); rebuildScene(); startPlayback(0); });
rebuildScene();
requestAnimationFrame(loop);
window.addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#play').click(); } });
