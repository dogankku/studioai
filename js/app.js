import { THEMES, seekVideo } from './backgrounds.js?v=202611221506';
import { buildScene, drawFrame, dims, isRTL, isMostlyRTL, wordsOf, toSRT } from './renderer.js?v=202611221506';
import { parseList, parseCSV, toListText, makeItem, plainItem, newId } from './parser.js?v=202611221506';
import { decodeBlob, mixFor, playPreview, stopPreview, playFromStart, live } from './audio.js?v=202611221506';
import { encodeFast, encodeRealtime, hasFast, pickAudio } from './encoder.js?v=202611221506';
import { putFile, delFile, clearFiles, allFiles } from './storage.js?v=202611221506';
import { surahs, buildItems } from './quran.js?v=202611221506';

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
  introText: '', introDur: 0, outroText: '', outroDur: 0,
  handle: '', logoPos: 'br', logoOpacity: 0.85, logoSize: 0.12,
  musicMode: 'none', musicVol: 0.8, fadeIn: true, fadeOut: true,
  durMode: 'auto', fixedDur: 15, hold: 2.6, fileName: '{no}-{kaynak}', defaultTag: '', srt: false
};
const ANIMS = { word: 'Kelime kelime', karaoke: 'Karaoke', kinetic: 'Kinetik', type: 'Daktilo', line: 'Satır satır', fade: 'Yumuşak belirme' };
const SAMPLE = [
  { main: 'فَإِنَّ مَعَ ٱلۡعُسۡرِ يُسۡرًا', sub: 'Elbette güçlükle beraber şüphesiz bir kolaylık vardır.', src: 'İnşirâh Sûresi, 5', tag: 'Günün Ayeti' },
  { main: 'رَبِّ زِدۡنِي عِلۡمٗا', sub: 'Rabbim! İlmimi artır.', src: 'Tâhâ Sûresi, 114', tag: 'Günün Duası' },
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
const media = [];   // {id, type, el, url, name, blob}
const music = [];   // {id, name, buffer, blob}
let logo = null;    // {id, img, url, name, blob}
const results = new Map(); // item id -> {blob|null, file|null, url, name, size, srt}
let dirHandle = null;

let saveT = 0;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { store.set('tvs-settings', S); store.set('tvs-items', items.map(plainItem)); }, 300); }

/* ================= Yardımcılar ================= */
function hash(i) { let x = (i + 1) * 2654435761 >>> 0; x ^= x >>> 15; return x >>> 0; }
function pick(arr, mode, i) {
  if (!arr.length || mode === 'none') return null;
  if (mode === 'first' || mode === 'same') return arr[0];
  if (mode === 'seq') return arr[i % arr.length];
  return arr[hash(i) % arr.length];
}
function effS(i) {
  const ov = (items[i] && items[i].ov) || {};
  const s = { ...S, forceDark: S.tone === 'dark', size: +S.size, speed: +S.speed };
  if (ov.theme) { s.theme = ov.theme; s.textColor = s.accentColor = s.subColor = ''; }
  if (ov.anim) s.anim = ov.anim;
  if (ov.position) s.position = ov.position;
  if (ov.media === 'theme') s.bgSource = 'theme';
  else if (ov.media && media.some(m => m.id === ov.media)) s.bgSource = 'media';
  return s;
}
function mediaFor(i) {
  const ov = (items[i] && items[i].ov) || {};
  if (ov.media === 'theme') return null;
  if (ov.media) { const m = media.find(x => x.id === ov.media); if (m) return m; }
  return S.bgSource === 'media' ? pick(media, S.mediaMode, i) : null;
}
function musicFor(i) {
  const ov = (items[i] && items[i].ov) || {};
  if (ov.music === 'none') return null;
  if (ov.music) { const m = music.find(x => x.id === ov.music); if (m) return m; }
  return pick(music, S.musicMode, i);
}
const TR = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u', 'ê': 'e', 'ô': 'o' };
function slug(s, n = 40) {
  return (s || '').toLocaleLowerCase('tr').replace(/[çğıöşüâîûêô]/g, c => TR[c])
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n);
}
function fileNameFor(i) {
  const it = items[i];
  const pad = Math.max(2, String(items.length).length);
  let n = S.fileName || '{no}';
  n = n.replace(/\{no\}/g, String(i + 1).padStart(pad, '0'))
    .replace(/\{kaynak\}/g, slug(it.src))
    .replace(/\{etiket\}/g, slug(it.tag || S.defaultTag))
    .replace(/\{metin\}/g, slug((isMostlyRTL(it.main) ? it.sub : it.main).split(/\s+/).slice(0, 5).join(' ')));
  return n.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '') || String(i + 1);
}
function sceneFor(i, W, H) {
  const m = musicFor(i);
  return buildScene(items[i] || makeItem(), effS(i), W, H, { index: i, media: mediaFor(i), audioDur: m ? m.buffer.duration : 0, logo: logo && logo.img });
}
function audioPlan(i, sc) {
  const m = musicFor(i); if (!m) return null;
  const recit = !!sc.timing || S.durMode === 'audio';
  return {
    buffer: m.buffer, startAt: recit ? sc.offset : 0, loop: !recit, volume: +S.musicVol,
    fadeIn: recit ? false : S.fadeIn, fadeOut: recit ? (m.buffer.duration > sc.mainDur && S.fadeOut) : S.fadeOut
  };
}
function previewDims() { return dims(S.format, Math.min(+S.res, 1080)); }
function esc(s) { return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
let msgT = 0;
function toast(t) { const l = $('#toast'); l.textContent = t; l.classList.add('show'); clearTimeout(msgT); msgT = setTimeout(() => l.classList.remove('show'), 3500); }

/* ================= Yazı tipleri ================= */
async function ensureFonts() {
  const fam = s => s.split(',')[0].trim();
  const list = [
    `700 60px ${fam(S.latinFont)}`, `800 60px ${fam(S.latinFont)}`, `400 60px ${fam(S.latinFont)}`,
    `700 60px ${S.arabicFont}`, `400 60px ${S.arabicFont}`, '700 60px Amiri', '400 40px "Amiri Quran"',
    `500 40px ${fam(S.subFont)}`, 'italic 500 40px Lora', '600 30px Inter'
  ];
  try {
    await Promise.race([
      Promise.all(list.map(f => document.fonts.load(f, /Amiri|Scheherazade|Naskh|Kufi/.test(f) ? 'بسم ٱلۡ' : 'Ağış'))),
      new Promise(r => setTimeout(r, 5000))
    ]);
  } catch (e) { }
}

/* ================= Ayar kontrolleri ================= */
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
  const ev = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
  el.addEventListener(ev, () => {
    if (el.type === 'checkbox') S[k] = el.checked;
    else if (el.type === 'range') S[k] = +el.value;
    else S[k] = el.value;
    if (['latinFont', 'arabicFont', 'subFont'].includes(k)) ensureFonts().then(changed); else changed();
  });
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
function switchTab(name) {
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $$('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === name));
}
$('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); };

/* ================= Liste ================= */
function renderList() {
  const el = $('#itemList');
  $('#count').textContent = `(${items.length})`;
  if (!items.length) { el.innerHTML = '<div class="empty">Liste boş. "+ Yeni", "Kur\'an\'dan ekle" ya da "Toplu ekle" ile başlayın.</div>'; renderQueue(); return; }
  el.innerHTML = items.map((it, i) => {
    const ar = isMostlyRTL(it.main);
    const first = esc((it.main || it.sub).split('\n')[0]);
    const flags = [it.timing ? '🎙' : '', it.ov && Object.values(it.ov).some(Boolean) ? '⚙' : ''].join('');
    const small = esc([it.src, ar ? it.sub : ''].filter(Boolean).join(' · '));
    const done = results.has(it.id) ? ' ✓' : '';
    return `<div class="it${i === sel ? ' on' : ''}" data-i="${i}">
      <div class="no">${i + 1}${done}</div>
      <div class="tx${ar ? ' ar' : ''}">${first}${small || flags ? `<small>${flags} ${small}</small>` : ''}</div>
      <div class="acts">
        <button data-a="up" title="Yukarı">↑</button><button data-a="down" title="Aşağı">↓</button>
        <button data-a="dup" title="Çoğalt">⧉</button><button data-a="del" title="Sil">✕</button>
      </div></div>`;
  }).join('');
  const on = el.querySelector('.it.on'); if (on) on.scrollIntoView({ block: 'nearest' });
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

function fillOverrideSelects() {
  const opt = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
  $('#oTheme').innerHTML = opt('', 'Genel ayar') + Object.entries(THEMES).map(([k, t]) => opt(k, t.name)).join('');
  $('#oAnim').innerHTML = opt('', 'Genel ayar') + Object.entries(ANIMS).map(([k, t]) => opt(k, t)).join('');
  $('#oMedia').innerHTML = opt('', 'Genel ayar') + opt('theme', 'Hazır tema (görselsiz)') + media.map((m, i) => opt(m.id, `${m.type === 'video' ? 'Video' : 'Görsel'} ${i + 1}: ${m.name}`)).join('');
  $('#oMusic').innerHTML = opt('', 'Genel ayar') + opt('none', 'Sessiz') + music.map((m, i) => opt(m.id, `${i + 1}. ${m.name}`)).join('');
}
function loadEditor() {
  const it = items[sel];
  $('#editor').style.display = it ? '' : 'none';
  if (!it) return;
  $('#editNo').textContent = '#' + (sel + 1);
  $('#eMain').value = it.main; $('#eSub').value = it.sub; $('#eSrc').value = it.src; $('#eTag').value = it.tag;
  const ov = it.ov || {};
  fillOverrideSelects();
  for (const [id, k] of [['oTheme', 'theme'], ['oAnim', 'anim'], ['oPosition', 'position'], ['oMedia', 'media'], ['oMusic', 'music']]) {
    const el = $('#' + id); el.value = ov[k] || ''; if (el.value !== (ov[k] || '')) el.value = '';
  }
  const n = Object.values(ov).filter(Boolean).length;
  $('#ovBadge').textContent = n ? `(${n} özel ayar)` : '';
  updateSyncInfo();
  syncDir();
}
function updateSyncInfo() {
  const it = items[sel]; if (!it) return;
  const n = wordsOf(it.main).length;
  const has = Array.isArray(it.timing);
  $('#syncInfo').textContent = !has ? (musicFor(sel) ? '' : 'Önce Ses sekmesinden ses ekleyin')
    : it.timing.length === n ? `Eşlendi (${n} kelime)` : 'Eşleme geçersiz: kelime sayısı değişti';
  $('#syncClear').style.display = has ? '' : 'none';
}
function syncDir() { ['eMain', 'eSub'].forEach(id => $('#' + id).classList.toggle('rtl', isMostlyRTL($('#' + id).value))); }
[['eMain', 'main'], ['eSub', 'sub'], ['eSrc', 'src'], ['eTag', 'tag']].forEach(([id, k]) => {
  $('#' + id).addEventListener('input', e => {
    const it = items[sel]; if (!it) return;
    it[k] = e.target.value; dropResult(it.id); syncDir(); save(); renderListSoon(); rebuildScene();
    if (k === 'main') updateSyncInfo();
  });
});
[['oTheme', 'theme'], ['oAnim', 'anim'], ['oPosition', 'position'], ['oMedia', 'media'], ['oMusic', 'music']].forEach(([id, k]) => {
  $('#' + id).addEventListener('change', e => {
    const it = items[sel]; if (!it) return;
    it.ov = { ...(it.ov || {}), [k]: e.target.value };
    if (!Object.values(it.ov).some(Boolean)) delete it.ov;
    dropResult(it.id); save(); loadEditor(); renderList(); restart();
  });
});
let listT = 0; function renderListSoon() { clearTimeout(listT); listT = setTimeout(renderList, 250); }

$('#addItem').onclick = () => { items.splice(sel + 1, 0, makeItem({ main: 'Yeni metin' })); sel = Math.min(sel + 1, items.length - 1); listChanged(); $('#eMain').focus(); $('#eMain').select(); };
$('#clearList').onclick = () => { if (!items.length) return; if (!confirmInline($('#clearList'), 'Emin misiniz?')) return; [...results.keys()].forEach(dropResult); items = []; sel = 0; listChanged(); };
function confirmInline(btn, msg) {
  if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.orig; return true; }
  btn.dataset.orig = btn.textContent; btn.dataset.armed = '1'; btn.textContent = msg;
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.orig; } }, 3000);
  return false;
}
function bulkParse() {
  const t = $('#bulkText').value.trim(); if (!t) return [];
  return t.split('\n')[0].includes('\t') ? parseCSV(t) : parseList(t);
}
$('#bulkAppend').onclick = () => { const n = bulkParse(); if (!n.length) return; items.push(...n); sel = items.length - n.length; $('#bulkText').value = ''; listChanged(); };
$('#bulkReplace').onclick = () => { const n = bulkParse(); if (!n.length) return; [...results.keys()].forEach(dropResult); items = n; sel = 0; $('#bulkText').value = ''; listChanged(); };
$('#csvFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const n = parseCSV(await f.text()); e.target.value = '';
  if (n.length) { items.push(...n); sel = items.length - n.length; listChanged(); }
};
$('#exportList').onclick = () => { $('#bulkText').value = toListText(items); $('#bulkText').focus(); };

/* ================= Kur'an ================= */
let SUR = [];
surahs().then(list => {
  SUR = list;
  $('#qSurah').innerHTML = list.map(s => `<option value="${s.id}">${s.id}. ${esc(s.tr)} — ${s.ar} (${s.n} ayet)</option>`).join('');
  onSurah();
}).catch(() => { $('#qSurah').innerHTML = '<option>Kur\'an verisi yüklenemedi</option>'; $('#qAdd').disabled = true; });
function onSurah() {
  const s = SUR.find(x => x.id === +$('#qSurah').value); if (!s) return;
  $('#qFrom').max = $('#qTo').max = s.n; $('#qFrom').value = 1; $('#qTo').value = Math.min(s.n, 5);
  qInfo();
}
function qInfo() {
  const s = SUR.find(x => x.id === +$('#qSurah').value); if (!s) return;
  const a = Math.max(1, Math.min(+$('#qFrom').value || 1, s.n)), b = Math.max(a, Math.min(+$('#qTo').value || a, s.n));
  $('#qInfo').textContent = $('#qMode').value === 'one' ? '1 video' : `${b - a + 1} video`;
}
$('#qSurah').onchange = onSurah;
['qFrom', 'qTo', 'qMode'].forEach(id => $('#' + id).addEventListener('input', qInfo));
$('#qAdd').onclick = async () => {
  try {
    const n = await buildItems(+$('#qSurah').value, +$('#qFrom').value, +$('#qTo').value, { mode: $('#qMode').value, meal: $('#qMeal').checked });
    const add = n.map(makeItem); items.push(...add); sel = items.length - add.length; listChanged();
    toast(`${add.length} öğe eklendi`);
  } catch (e) { toast('Ayetler yüklenemedi.'); }
};

/* ================= Medya, ses, logo (kalıcı) ================= */
let order = Date.now();
async function addMediaBlob(blob, name, id = newId(), persist = true) {
  const url = URL.createObjectURL(blob);
  try {
    if ((blob.type || '').startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(name)) {
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = rej; });
      v.addEventListener('seeked', () => { if (!playing && !busy) dirty = true; });
      media.push({ id, type: 'video', el: v, url, name, blob });
    } else {
      const img = new Image(); img.src = url; await img.decode();
      media.push({ id, type: 'image', el: img, url, name, blob });
    }
    if (persist) putFile({ id, kind: 'media', name, type: blob.type, blob, order: order++ });
    return true;
  } catch (err) { URL.revokeObjectURL(url); toast(`${name} açılamadı.`); return false; }
}
async function addMusicBlob(blob, name, id = newId(), persist = true) {
  try {
    const buffer = await decodeBlob(blob);
    music.push({ id, name, buffer, blob });
    if (persist) putFile({ id, kind: 'music', name, type: blob.type, blob, order: order++ });
    return true;
  } catch (err) { toast(`${name} okunamadı.`); return false; }
}
async function setLogoBlob(blob, name, id = newId(), persist = true) {
  if (logo) { URL.revokeObjectURL(logo.url); delFile(logo.id); }
  const url = URL.createObjectURL(blob); const img = new Image(); img.src = url;
  try { await img.decode(); logo = { id, img, url, name, blob }; $('#logoName').textContent = name; if (persist) putFile({ id, kind: 'logo', name, type: blob.type, blob, order: order++ }); }
  catch (e) { URL.revokeObjectURL(url); logo = null; toast('Logo açılamadı.'); }
}

$('#mediaFiles').onchange = async e => {
  const files = [...e.target.files]; e.target.value = '';
  let ok = 0; for (const f of files) if (await addMediaBlob(f, f.name)) ok++;
  if (ok) S.bgSource = 'media';
  renderMedia(); changed(); loadEditor();
};
function renderMedia() {
  $('#mediaList').innerHTML = media.map((m, i) => `<div class="m" title="${esc(m.name)}">${m.type === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="">`}<b>${i + 1}${m.type === 'video' ? ' ▶' : ''}</b><button data-i="${i}" title="Kaldır">✕</button></div>`).join('');
}
$('#mediaList').onclick = e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  const [m] = media.splice(+b.dataset.i, 1); if (m.type === 'video') m.el.pause(); URL.revokeObjectURL(m.url); delFile(m.id);
  renderMedia(); changed(); loadEditor();
};
$('#musicFiles').onchange = async e => {
  const files = [...e.target.files]; e.target.value = '';
  for (const f of files) await addMusicBlob(f, f.name);
  if (music.length && S.musicMode === 'none') S.musicMode = 'same';
  renderMusic(); changed(); loadEditor();
};
function renderMusic() {
  $('#musicList').innerHTML = music.map((m, i) => `<div class="a"><span>${i + 1}. ${esc(m.name)}</span><span class="muted">${m.buffer.duration.toFixed(1)} sn <button data-i="${i}" title="Kaldır">✕</button></span></div>`).join('');
}
$('#musicList').onclick = e => { const b = e.target.closest('button[data-i]'); if (!b) return; const [m] = music.splice(+b.dataset.i, 1); delFile(m.id); renderMusic(); changed(); loadEditor(); };
$('#logoFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; e.target.value = ''; await setLogoBlob(f, f.name); changed(); };
$('#logoClear').onclick = () => { if (logo) { URL.revokeObjectURL(logo.url); delFile(logo.id); } logo = null; $('#logoName').textContent = 'Logo yok'; changed(); };

async function restoreFiles() {
  const recs = await allFiles();
  for (const r of recs) {
    if (r.kind === 'media') await addMediaBlob(r.blob, r.name, r.id, false);
    else if (r.kind === 'music') await addMusicBlob(r.blob, r.name, r.id, false);
    else if (r.kind === 'logo') await setLogoBlob(r.blob, r.name, r.id, false);
  }
  if (recs.length) { renderMedia(); renderMusic(); loadEditor(); rebuildScene(); }
}

/* ================= Önizleme ================= */
let scene = null, playing = false, busy = false, t0 = 0, curT = 0, dirty = true;
function rebuildScene() {
  const [W, H] = previewDims();
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  fitCanvas();
  scene = sceneFor(Math.min(sel, Math.max(0, items.length - 1)), W, H);
  curT = Math.min(curT, scene.dur);
  $('#itemPos').textContent = items.length ? `${sel + 1} / ${items.length}` : '0 / 0';
  updateTime(); updateAudioUI();
  if (!playing) seekBg();
  dirty = true;
}
function changed() { save(); syncUI(); rebuildScene(); updateEngineInfo(); updateSyncInfo(); }
function updateAudioUI() {
  const pill = $('#audioPill'); const m = items[sel] ? musicFor(sel) : null;
  pill.className = 'audio-pill ' + (m ? 'on' : 'off');
  pill.textContent = m ? `🔈 ${m.name}` : '🔇 Ses yok';
  pill.title = m ? 'Bu videoda çalacak ses' : (music.length ? 'Bu video için ses kapalı (Ses sekmesi ya da videoya özel ayar)' : 'Ses sekmesinden ses ekleyin');
  $('#noMusicWarn').classList.toggle('show', !music.length);
  $('#noMusicWarn').textContent = !music.length ? 'Henüz ses dosyası eklenmedi; videolar sessiz üretilir.' : '';
}
$('#audioPill').onclick = () => switchTab('ses');
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
  const a = audioPlan(sel, scene);
  if (a) { try { live(); playPreview(a.buffer, from, scene.dur, a, a.startAt); } catch (e) { } }
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
      if (v && v.duration && playing) { const tgt = curT % v.duration; const d = Math.abs(v.currentTime - tgt); if (d > 0.3 && d < v.duration - 0.3) v.currentTime = tgt; }
      drawFrame(ctx, scene, curT); updateTime();
    } else if (dirty || bgVideo()) { drawFrame(ctx, scene, curT); dirty = false; }
  }
  requestAnimationFrame(loop);
}
function fitCanvas() {
  const st = $('#stage'); const aw = st.clientWidth - 44, ah = st.clientHeight - 44;
  if (aw <= 0 || ah <= 0) return;
  const k = Math.min(aw / cv.width, ah / cv.height);
  cv.style.width = Math.floor(cv.width * k) + 'px'; cv.style.height = Math.floor(cv.height * k) + 'px';
}
window.addEventListener('resize', fitCanvas);

/* ================= Senkron ================= */
const SY = { open: false, words: [], idxs: [], marks: [], playing: false, start: 0, ctx: null, buffer: null, raf: 0 };
const hasLetters = w => /[\p{L}]/u.test(w);
$('#syncBtn').onclick = () => {
  const it = items[sel]; if (!it) return;
  const m = musicFor(sel);
  if (!m) { toast('Önce Ses sekmesinden bu videoya bir ses (tilavet) ekleyin.'); switchTab('ses'); return; }
  stopPlayback();
  SY.words = wordsOf(it.main);
  if (!SY.words.length) { toast('Ana metin boş.'); return; }
  SY.idxs = SY.words.map((w, k) => hasLetters(w) ? k : -1).filter(k => k >= 0);
  SY.marks = Array.isArray(it.timing) && it.timing.length === SY.words.length ? SY.idxs.map(k => it.timing[k]) : [];
  SY.buffer = m.buffer; SY.playing = false; SY.open = true;
  $('#syncTitle').textContent = `#${sel + 1} · ${m.name} · ${SY.idxs.length} kelime`;
  $('#syncWords').classList.toggle('ltr', !isMostlyRTL(it.main));
  renderSync(); $('#syncModal').classList.add('show');
};
function renderSync() {
  const cur = SY.marks.length;
  $('#syncWords').innerHTML = SY.words.map((w, k) => {
    const j = SY.idxs.indexOf(k);
    const cls = j < 0 ? 'skip' : j < cur ? 'done' : j === cur ? 'cur' : '';
    return `<span class="${cls}" data-j="${j}">${esc(w)}${j >= 0 && j < cur ? `<small>${SY.marks[j].toFixed(2)}</small>` : ''}</span>`;
  }).join('');
  const c = $('#syncWords .cur'); if (c) c.scrollIntoView({ block: 'nearest' });
  const full = cur === SY.idxs.length;
  $('#syncTap').disabled = !SY.playing || full;
  $('#syncTap').textContent = full ? 'Tüm kelimeler işaretlendi' : SY.playing ? `Sıradaki kelime (${cur + 1}/${SY.idxs.length})` : 'Önce Başlat\'a basın';
  $('#syncUndo').disabled = !cur;
  $('#syncSave').disabled = !full; $('#syncPreview').disabled = !full;
  $('#syncStart').textContent = SY.playing ? '■ Durdur' : (cur && !full ? '▶ Kaldığı yerden' : '▶ Başlat');
}
function syncPlay(at) {
  const r = playFromStart(SY.buffer, Math.max(0, at)); SY.ctx = r.ctx; SY.start = r.start; SY.playing = true;
  cancelAnimationFrame(SY.raf);
  const tick = () => { if (!SY.playing) return; const t = SY.ctx.currentTime - SY.start; $('#syncTime').textContent = `${Math.max(0, t).toFixed(1)} / ${SY.buffer.duration.toFixed(1)} sn`; if (t > SY.buffer.duration + 0.3) { syncStop(); return; } SY.raf = requestAnimationFrame(tick); };
  tick(); renderSync();
}
function syncStop() { SY.playing = false; stopPreview(); cancelAnimationFrame(SY.raf); renderSync(); }
function syncTap() {
  if (!SY.playing || SY.marks.length >= SY.idxs.length) return;
  const t = SY.ctx.currentTime - SY.start - 0.04; // tepki gecikmesi için küçük düzeltme
  const prev = SY.marks[SY.marks.length - 1] ?? -1;
  SY.marks.push(Math.max(0, Math.max(t, prev + 0.05)));
  renderSync();
}
function syncUndo() {
  if (!SY.marks.length) return;
  SY.marks.pop();
  const back = (SY.marks[SY.marks.length - 1] ?? 0) - 0.3;
  if (SY.playing) syncPlay(Math.max(0, back)); else renderSync();
}
$('#syncStart').onclick = () => { if (SY.playing) syncStop(); else { if (SY.marks.length === SY.idxs.length) SY.marks = []; syncPlay(SY.marks.length ? SY.marks[SY.marks.length - 1] - 0.5 : 0); } };
$('#syncTap').onclick = syncTap;
$('#syncUndo').onclick = syncUndo;
$('#syncReset').onclick = () => { syncStop(); SY.marks = []; renderSync(); };
function syncCommit() {
  const it = items[sel]; if (!it) return;
  const T = new Array(SY.words.length);
  SY.idxs.forEach((k, j) => (T[k] = +SY.marks[j].toFixed(3)));
  for (let k = 0; k < T.length; k++) if (T[k] === undefined) T[k] = k ? T[k - 1] : (SY.marks[0] || 0);
  it.timing = T;
  if (S.durMode === 'auto') { S.durMode = 'audio'; syncUI(); toast('Süre "sese eşitle" yapıldı.'); }
  dropResult(it.id); save(); renderList(); loadEditor();
}
$('#syncSave').onclick = () => { syncCommit(); closeSync(); restart(); };
$('#syncPreview').onclick = () => { syncCommit(); closeSync(); restart(); startPlayback(0); };
function closeSync() { syncStop(); SY.open = false; $('#syncModal').classList.remove('show'); }
$('#syncCancel').onclick = closeSync;
$('#syncClear').onclick = () => { const it = items[sel]; if (!it) return; delete it.timing; dropResult(it.id); save(); renderList(); loadEditor(); restart(); };

/* ================= Üretim ================= */
let cancelFlag = false;
const qState = new Map();
function setQ(id, st, p = 0, cls = '') {
  qState.set(id, { st, p, cls });
  const row = document.querySelector(`.q[data-id="${id}"]`);
  if (row) { const s = row.querySelector('.st'); s.textContent = st; s.className = 'st ' + cls; row.querySelector('.prog i').style.width = (p * 100).toFixed(1) + '%'; }
}
const mb = n => (n / 1048576).toFixed(1) + ' MB';
function renderQueue() {
  const el = $('#queueList');
  el.innerHTML = items.map((it, i) => {
    const r = results.get(it.id);
    const q = qState.get(it.id) || (r ? { st: `Hazır · ${mb(r.size)}${r.file ? ' · klasörde' : ''}`, p: 1, cls: 'ok' } : { st: 'Bekliyor', p: 0, cls: '' });
    const acts = r ? `<button class="btn sm" data-a="view" data-id="${it.id}" title="İzle">▶</button>${r.file ? '' : `<button class="btn sm" data-a="dl" data-id="${it.id}" title="İndir">⬇</button>`}${r.srt && !r.file ? `<button class="btn sm" data-a="srt" data-id="${it.id}" title="Altyazı">SRT</button>` : ''}` : '';
    return `<div class="q" data-id="${it.id}"><div class="no muted">${i + 1}</div>
      <div><div class="tx">${esc((it.main || it.sub).split('\n')[0])}</div><div class="st ${q.cls}">${esc(q.st)}</div></div>
      <div class="acts">${acts}</div>
      <div class="prog"><i style="width:${(q.p * 100).toFixed(1)}%"></i></div></div>`;
  }).join('') || '<div class="empty">Önce Metinler sekmesinden liste oluşturun.</div>';
  const n = results.size, inMem = [...results.values()].filter(r => r.blob).length;
  $('#doneBadge').textContent = n ? n : '';
  $('#zipAll').disabled = busy || !inMem; $('#clearDone').disabled = busy || !n;
}
$('#queueList').onclick = async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const r = results.get(b.dataset.id); if (!r) return;
  if (b.dataset.a === 'dl') saveFile(r.blob, r.name);
  else if (b.dataset.a === 'srt') saveFile(new Blob([r.srt], { type: 'text/plain' }), r.name.replace(/\.\w+$/, '.srt'));
  else {
    if (!r.url) { const f = r.file ? await r.file.getFile() : r.blob; r.url = URL.createObjectURL(f); }
    openModal(r);
  }
};
function dropResult(id) { const r = results.get(id); if (r) { if (r.url) URL.revokeObjectURL(r.url); results.delete(id); } qState.delete(id); }
function setBusy(v) {
  busy = v;
  ['#queueAll', '#queueOne', '#renderBtn', '#play', '#seek', '#pickDir'].forEach(s => ($(s).disabled = v));
  $('#cancelAll').disabled = !v;
  $('#hiddenWarn').classList.toggle('show', v);
  renderQueue();
}

async function writeText(dir, name, text) {
  const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(text); await w.close();
}

async function runQueue(indices) {
  if (busy || !indices.length) return;
  stopPlayback(); cancelFlag = false; setBusy(true); switchTab('uretim');
  await ensureFonts();
  if (dirHandle) {
    try { if ((await dirHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') throw 0; }
    catch (e) { toast('Klasöre yazma izni verilmedi; videolar bellekte tutulacak.'); dirHandle = null; updateDirUI(); }
  }
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
      const ap = audioPlan(i, sc);
      const audio = ap ? await mixFor(ap.buffer, sc.dur, ap, ap.startAt) : null;
      const vid = sc.media && sc.media.type === 'video' ? sc.media.el : null;
      if (vid) vid.pause();
      const prog = p => { setQ(it.id, `Üretiliyor %${Math.round(p * 100)}`, p); $('#overallBar').style.width = ((k + p) / indices.length * 100).toFixed(1) + '%'; };
      const base = fileNameFor(i);
      let file = null;
      if (dirHandle) file = await dirHandle.getFileHandle(`${base}.mp4`, { create: true });
      let res = null;
      if (hasFast()) {
        try {
          res = await encodeFast({
            canvas: ex, W, H, fps, dur: sc.dur, bitrate, audio, file, onProgress: prog, cancelled: () => cancelFlag,
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
        if (dirHandle) {
          file = await dirHandle.getFileHandle(`${base}.${res.ext}`, { create: true });
          const w = await file.createWritable(); await w.write(res.blob); await w.close(); res.blob = null;
        }
      }
      dropResult(it.id);
      const srt = S.srt ? toSRT(sc) : null;
      if (srt && dirHandle) await writeText(dirHandle, `${base}.srt`, srt);
      results.set(it.id, { blob: res.blob, file: res.blob ? null : file, url: null, name: `${base}.${res.ext}`, size: res.size, srt });
      qState.delete(it.id);
      setQ(it.id, `Hazır · ${mb(res.size)}${ap ? '' : ' · sessiz'}${dirHandle ? ' · klasörde' : ''}`, 1, 'ok');
      done++;
      if (res.audioCodec === 'opus') $('#dlHint').textContent = 'Not: Bu tarayıcı AAC ses kodlayamadı, ses Opus olarak eklendi. Windows/Mac\'teki Chrome ya da Edge AAC üretir; iPhone uyumluluğu için onları kullanın.';
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

/* klasör */
function updateDirUI() {
  const ok = 'showDirectoryPicker' in window;
  $('#pickDir').style.display = ok ? '' : 'none';
  $('#clearDir').style.display = dirHandle ? '' : 'none';
  $('#dirName').textContent = dirHandle ? `📁 ${dirHandle.name}: videolar buraya yazılır` : (ok ? 'Klasör seçilmedi: videolar bellekte tutulur' : 'Bu tarayıcı klasöre yazmayı desteklemiyor: videolar bellekte tutulur');
}
$('#pickDir').onclick = async () => {
  try { dirHandle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'toplu-video' }); }
  catch (e) { if (e && e.name !== 'AbortError') toast('Klasör seçilemedi (bu görünümde desteklenmiyor olabilir).'); }
  updateDirUI();
};
$('#clearDir').onclick = () => { dirHandle = null; updateDirUI(); };

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
  if (!window.JSZip) return toast('ZIP kütüphanesi yüklenemedi.');
  const zip = new JSZip(); const used = new Set();
  items.forEach(it => {
    const r = results.get(it.id); if (!r || !r.blob) return;
    let n = r.name, c = 2; while (used.has(n)) n = r.name.replace(/(\.\w+)$/, `-${c++}$1`); used.add(n);
    zip.file(n, r.blob); if (r.srt) zip.file(n.replace(/\.\w+$/, '.srt'), r.srt);
  });
  $('#zipAll').disabled = true; $('#zipAll').textContent = 'ZIP hazırlanıyor…';
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  $('#zipAll').textContent = '⬇ Hepsini ZIP olarak indir'; $('#zipAll').disabled = false;
  saveFile(blob, `${slug(S.defaultTag) || 'videolar'}.zip`);
};
let modalRes = null;
function openModal(r) { modalRes = r; $('#modalVid').src = r.url; $('#modalDl').style.display = r.blob ? '' : 'none'; $('#modal').classList.add('show'); $('#modalVid').play().catch(() => { }); }
$('#modalClose').onclick = () => { $('#modalVid').pause(); $('#modal').classList.remove('show'); };
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modalClose').click(); };
$('#modalDl').onclick = () => modalRes && modalRes.blob && saveFile(modalRes.blob, modalRes.name);

/* ================= Proje ================= */
$('#saveProj').onclick = async () => {
  const files = [
    ...media.map((m, i) => ({ id: m.id, kind: 'media', name: m.name, type: m.blob.type, order: i, blob: m.blob })),
    ...music.map((m, i) => ({ id: m.id, kind: 'music', name: m.name, type: m.blob.type, order: 100 + i, blob: m.blob })),
    ...(logo ? [{ id: logo.id, kind: 'logo', name: logo.name, type: logo.blob.type, order: 999, blob: logo.blob }] : [])
  ];
  const data = { app: 'toplu-video-studyosu', version: 2, settings: S, items: items.map(plainItem), files: files.map(({ blob, ...f }) => f) };
  const base = slug(S.defaultTag) || 'toplu-video';
  if (!files.length || !window.JSZip) return saveFile(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${base}.json`);
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(data, null, 2));
  files.forEach(f => zip.file(`files/${f.id}`, f.blob));
  toast('Proje paketleniyor…');
  saveFile(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `${base}-proje.zip`);
};
$('#loadProj').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try {
    let d, zip = null;
    if (/\.zip$/i.test(f.name)) { zip = await JSZip.loadAsync(f); d = JSON.parse(await zip.file('project.json').async('string')); }
    else d = JSON.parse(await f.text());
    if (d.settings) S = { ...DEFAULTS, ...d.settings };
    if (Array.isArray(d.items)) { [...results.keys()].forEach(dropResult); items = d.items.map(makeItem); sel = 0; }
    if (zip && Array.isArray(d.files)) {
      media.splice(0).forEach(m => URL.revokeObjectURL(m.url)); music.splice(0);
      if (logo) URL.revokeObjectURL(logo.url); logo = null; $('#logoName').textContent = 'Logo yok';
      await clearFiles();
      for (const meta of d.files.sort((a, b) => a.order - b.order)) {
        const zf = zip.file(`files/${meta.id}`); if (!zf) continue;
        const blob = new Blob([await zf.async('arraybuffer')], { type: meta.type || '' });
        if (meta.kind === 'media') await addMediaBlob(blob, meta.name, meta.id);
        else if (meta.kind === 'music') await addMusicBlob(blob, meta.name, meta.id);
        else if (meta.kind === 'logo') await setLogoBlob(blob, meta.name, meta.id);
      }
      renderMedia(); renderMusic();
    }
    await ensureFonts(); listChanged(); changed();
    toast('Proje açıldı.');
  } catch (err) { console.error(err); toast('Proje dosyası okunamadı.'); }
};

async function updateEngineInfo() {
  const [W, H] = dims(S.format, +S.res);
  const fast = hasFast();
  let audioTxt = '';
  if (fast) { const a = await pickAudio(); audioTxt = a ? (a.mux === 'aac' ? ' Ses: AAC.' : ' Ses: Opus (bu tarayıcı AAC kodlayamıyor; iPhone\'da sorun olabilir).') : ' Ses kodlanamıyor.'; }
  $('#engineInfo').innerHTML = `Çıktı: <b>${W}×${H}</b>, ${S.fps} fps, MP4.<br>` + (fast
    ? `<b>Hızlı mod açık.</b> Videolar kare kare kodlanır, çoğu zaman gerçek süresinden hızlı biter.${audioTxt}`
    : '<b>Gerçek zamanlı mod.</b> Bu tarayıcıda hızlı kodlama yok; her video kendi süresi kadar sürer. En iyi sonuç için Chrome ya da Edge kullanın.');
}

/* ================= Klavye ================= */
window.addEventListener('keydown', e => {
  if (SY.open) {
    if (e.code === 'Space') { e.preventDefault(); if (SY.playing) syncTap(); else $('#syncStart').click(); }
    else if (e.code === 'Backspace') { e.preventDefault(); syncUndo(); }
    else if (e.code === 'Escape') closeSync();
    return;
  }
  if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); $('#play').click(); }
});

$('#syncModal').addEventListener('keyup', e => { if (e.code === 'Space') e.preventDefault(); }, true);

/* ================= Başlat ================= */
syncUI(); renderList(); loadEditor(); updateEngineInfo(); updateDirUI();
rebuildScene();
requestAnimationFrame(loop);
restoreFiles();
ensureFonts().then(() => { $('#loading').classList.add('hide'); rebuildScene(); startPlayback(0); });
