// Film Stüdyosu: arayüz
import { Film } from './film/player.js?v=202611221440';
import { direct, clipsOf } from './film/director.js?v=202611221440';
import { STYLES, EFFECTS, SCENES, CAMERAS, TEXT_ANIMS, TRANSITIONS, FX_DEFAULT, GRADE_DEFAULT } from './film/styles.js?v=202611221440';
import { analyzeAudio, analyzeVideo } from './film/analyze.js?v=202611221440';
import { parseList, parseCSV, makeItem, plainItem } from './parser.js?v=202611221440';
import { surahs, buildItems } from './quran.js?v=202611221440';
import { putFile, delFile, allFiles, getFile } from './storage.js?v=202611221440';
import { decodeBlob, mixFor, playPreview, stopPreview, live, mixTimeline, playTimeline, stopTimeline } from './audio.js?v=202611221440';
import { encodeFast, encodeRealtime, hasFast } from './encoder.js?v=202611221440';
import { dims, isMostlyRTL, wordsOf } from './renderer.js?v=202611221440';
import { newId } from './parser.js?v=202611221440';
import { ollamaModels, comfyCheckpoints, comfyGenerate } from './ai/local.js?v=202611221440';
import { writeScript } from './ai/senarist.js?v=202611221440';
import { RECITERS, VOICES, getRecitation, speak, downloadVoice, voiceReady } from './ai/voice.js?v=202611221440';
import { findClips, downloadClip, pixabayTest, queriesFor } from './ai/stock.js?v=202611221440';
import { detectScene } from './film/director.js?v=202611221440';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};
let toastT = 0;
const toast = t => { const l = $('#toast'); l.textContent = t; l.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => l.classList.remove('show'), 3500); };

/* ================= Durum ================= */
const DEFAULTS = {
  style: 'nur', seed: 1, pace: 1, mealMode: 'after', mode: 'film', respectKeywords: true, beatSync: true,
  platforms: ['reels'], previewPlatform: 'reels', durMode: 'auto', targetDur: 60, showSafe: false, fps: '30', quality: '1',
  fxOv: {}, gradeOv: {}, colors: {}, latinFont: '"Playfair Display", serif', arabicFont: 'Amiri', size: 1,
  soundtrack: '', musicVol: 0.8, fadeIn: true, fadeOut: true,
  refUseCuts: true, refUseEnergy: true, refUseColors: false, refUseAudio: false,
  olUrl: 'http://localhost:11434', olModel: '', cfUrl: 'http://127.0.0.1:8188', cfCkpt: '',
  recOn: false, reciter: '7', ttsOn: false, voice: 'tr_TR-dfki-medium', imgOn: true, stockOn: true, pxKey: '', stockNoPeople: true, stockN: '3', aiCount: '3', aiTone: 'huzur', aiNarr: true, aiTopic: ''
};
// Platform ayarları (YouTube ve Instagram önerilerine göre)
const PLATFORMS = {
  youtube: { name: 'YouTube', desc: 'Yatay video', format: '16:9', res: 1080, mbps: 10, max: 0, safe: { top: 0.07, bottom: 0.1, side: 0.08 }, suffix: 'youtube' },
  shorts: { name: 'YouTube Shorts', desc: 'Dikey; en çok 3 dk', format: '9:16', res: 1080, mbps: 10, max: 180, safe: { top: 0.12, bottom: 0.2, side: 0.1 }, suffix: 'shorts' },
  reels: { name: 'Instagram Reels', desc: 'Dikey; 3 dk üstü yeni kitlelere önerilmez', format: '9:16', res: 1080, mbps: 8, max: 180, safe: { top: 0.14, bottom: 0.22, side: 0.1 }, suffix: 'reels' },
  igpost: { name: 'Instagram gönderi', desc: 'Akışta 4:5 dikey video', format: '4:5', res: 1080, mbps: 8, max: 0, safe: { top: 0.07, bottom: 0.08, side: 0.08 }, suffix: 'instagram' },
  kare: { name: 'Kare', desc: 'Her platformda 1:1', format: '1:1', res: 1080, mbps: 8, max: 0, safe: { top: 0.07, bottom: 0.08, side: 0.08 }, suffix: 'kare' }
};
const PV = () => PLATFORMS[F.previewPlatform] || PLATFORMS[F.platforms[0]] || PLATFORMS.reels;
const SAMPLE = [
  { main: 'فَإِنَّ مَعَ ٱلۡعُسۡرِ يُسۡرًا', sub: 'Elbette güçlükle beraber şüphesiz bir kolaylık vardır.', src: 'İnşirâh Sûresi, 5', tag: 'Günün Ayeti' },
  { main: 'إِنَّ مَعَ ٱلۡعُسۡرِ يُسۡرٗا', sub: 'Gerçekten, güçlükle beraber bir kolaylık vardır.', src: 'İnşirâh Sûresi, 6' }
];
let F = { ...DEFAULTS, ...store.get('film-settings', {}) };
if (!Array.isArray(F.platforms) || !F.platforms.length) F.platforms = ['reels'];
F.platforms = F.platforms.filter(k => PLATFORMS[k]); if (!F.platforms.length) F.platforms = ['reels'];
if (!PLATFORMS[F.previewPlatform]) F.previewPlatform = F.platforms[0];
let items = (store.get('tvs-items', null) || SAMPLE).map(makeItem);
let overrides = store.get('film-overrides', {});
let ref = store.get('film-ref', null); // {name, analysis(without audio)}
let refAudio = null; // AudioBuffer (yalnızca bu oturumda)
let sel = 0, selShot = -1;
const music = []; // {id, name, buffer, blob, an}
let saveT = 0;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { store.set('film-settings', F); store.set('tvs-items', items.map(plainItem)); store.set('film-overrides', overrides); }, 300); };

/* ================= Film motoru ================= */
const cv = $('#cv');
const previewDims = () => dims(PV().format, Math.min(PV().res, 720));
let [PW, PH] = previewDims();
cv.width = PW; cv.height = PH;
const film = new Film(cv, PW, PH);
let tl = { shots: [], dur: 0 };

function soundtrack() {
  if (F.refUseAudio && refAudio) return { name: 'Referans videonun sesi', buffer: refAudio, an: ref && ref.analysis.audio };
  return music.find(m => m.id === F.soundtrack) || music[0] || null;
}
function directOpts() {
  const st = soundtrack();
  const beats = F.beatSync && st && st.an ? st.an.beats : null;
  let template = null;
  if (ref && F.refUseCuts) template = { shots: ref.analysis.shots.map(s => ({ dur: s.dur, energy: F.refUseEnergy ? s.energy : null })) };
  if (template && !F.refUseEnergy) template.shots.forEach(s => delete s.energy);
  return { style: F.style, seed: F.seed, pace: F.pace, mealMode: F.mealMode, respectKeywords: F.respectKeywords, beats, template, targetDur: F.durMode === 'target' ? +F.targetDur : 0 };
}
/* yapay zekâ sesleri ve görselleri: öğe kimliğine göre önbellek */
const recCache = new Map(), narrCache = new Map();
function augItems() {
  return items.map(it => {
    const a = { ...it };
    const r = recCache.get(it.id + ':' + F.reciter);
    if (F.recOn && r && r.n === wordsOf(it.main).length) a._rec = { dur: r.buffer.duration, words: r.words };
    const n = narrCache.get(it.id + ':' + F.voice);
    if (F.ttsOn && n) { if (n.main && n.mainText === it.main) a._narrMain = { dur: n.main.duration }; if (n.sub && n.subText === it.sub) a._narrSub = { dur: n.sub.duration }; }
    if (it.imgId && film.images.has(it.imgId)) a._img = it.imgId;
    if (F.stockOn && Array.isArray(it.vids)) { const v = it.vids.map(x => x.id).filter(id => film.videos.has(id)); if (v.length) a._vids = v; }
    if (it.sceneHint) a._scene = it.sceneHint;
    return a;
  });
}
function clipBuffers(timeline) {
  const out = [];
  for (const c of timeline.clips || clipsOf(timeline.shots)) {
    const [kind, idx] = c.key.split(':'); const it = items[+idx]; if (!it) continue;
    let b = null;
    if (kind === 'rec') { const r = recCache.get(it.id + ':' + F.reciter); b = r && r.buffer; }
    else { const n = narrCache.get(it.id + ':' + F.voice); b = n && (kind === 'nm' ? n.main : n.sub); }
    if (b) out.push({ start: c.start, buffer: b, gain: kind === 'rec' ? 1 : 1.6 });
  }
  return out;
}
function audioOpts(timeline) { const st = soundtrack(); return { clips: clipBuffers(timeline), music: st ? st.buffer : null, musicVol: +F.musicVol, fadeIn: F.fadeIn, fadeOut: F.fadeOut }; }

function applyOverrides(t) {
  let start = 0;
  for (const s of t.shots) {
    const o = overrides[s.key + '@' + F.style];
    if (o) { for (const k of ['scene', 'camera', 'anim', 'transition', 'camK']) if (o[k] != null) s[k] = o[k]; if (o.dur) s.dur = o.dur; s.edited = true; }
    if (s.transition === 'cut') s.transDur = 0.05; else if (s.i > 0 && s.transDur < 0.1 && s.transition !== 'none') s.transDur = 0.6;
    s.start = start; start += s.dur;
  }
  t.dur = start;
  return t;
}
function rebuild(keepTime = true) {
  film.fonts = { latin: F.latinFont, ar: F.arabicFont, sub: 'Lora, serif' };
  film.size = +F.size;
  film.safe = PV().safe;
  film.setStyle(F.style, { grade: { ...(ref && F.refUseColors ? ref.analysis.grade : {}), ...F.gradeOv }, fx: F.fxOv, colors: F.colors });
  tl = applyOverrides(direct(augItems(), { ...directOpts(), aiImages: F.imgOn, stock: F.stockOn }));
  tl.clips = clipsOf(tl.shots);
  film.setTimeline(tl);
  const st = soundtrack(); film.beats = st && st.an ? st.an.beats : null;
  if (!keepTime) curT = 0;
  curT = Math.min(curT, tl.dur);
  renderTimeline(); updateInspector(); updateTime(); updateOutInfo(); updateAudioUI();
  dirty = true;
}

/* ================= Önizleme ================= */
let playing = false, busy = false, t0 = 0, curT = 0, dirty = true;
function fitCanvas() {
  const st = $('#stage'); const aw = st.clientWidth - 30, ah = st.clientHeight - 24;
  if (aw <= 0 || ah <= 0) return;
  const k = Math.min(aw / cv.width, ah / cv.height);
  cv.style.width = Math.floor(cv.width * k) + 'px'; cv.style.height = Math.floor(cv.height * k) + 'px';
}
window.addEventListener('resize', fitCanvas);
function updateTime() {
  $('#time').textContent = `${curT.toFixed(1)} / ${tl.dur.toFixed(1)} sn`;
  $('#seek').value = tl.dur ? Math.round(curT / tl.dur * 1000) : 0;
  $('#tlHead').style.left = (tl.dur ? curT / tl.dur * 100 : 0) + '%';
}
function startPlayback(from) {
  if (busy || !tl.dur) return;
  curT = from; t0 = performance.now() - from * 1000; playing = true;
  const ao = audioOpts(tl);
  if (ao.music || ao.clips.length) { try { playTimeline(from, tl.dur, ao); } catch (e) { console.warn(e); } }
  $('#play').textContent = '❚❚ Durdur';
}
function stopPlayback() { playing = false; stopPreview(); stopTimeline(); film.pauseVideos(); $('#play').textContent = '▶ Oynat'; }
$('#play').onclick = () => { if (playing) stopPlayback(); else startPlayback(curT >= tl.dur - 0.05 ? 0 : curT); };
$('#seek').oninput = e => { const was = playing; stopPlayback(); curT = e.target.value / 1000 * tl.dur; updateTime(); dirty = true; if (was) startPlayback(curT); };
function loop(now) {
  if (!busy) {
    if (playing) { curT = (now - t0) / 1000; if (curT >= tl.dur) { curT = tl.dur; stopPlayback(); } film.prepare(curT, true); film.render(curT); updateTime(); highlightShotAt(curT); }
    else if (dirty) { film.render(curT); dirty = false; const at = curT; film.prepare(at).then(ch => { if (ch && !playing && curT === at) dirty = true; }); }
  }
  requestAnimationFrame(loop);
}

/* ================= Zaman çizelgesi ================= */
const SCENE_COLORS = { yildiz: '#2a2f6e', col: '#b5652f', deniz: '#1d4f7a', nur: '#8a5a1c', cami: '#5a3a78', desen: '#7a5d1a', bulut: '#b07a5a', soyut: '#4a2a7a' };
function renderTimeline() {
  const el = $('#tlShots');
  el.innerHTML = tl.shots.map(s => {
    const main = s.lines.find(l => l.role === 'main');
    return `<div class="tl-shot${s.i === selShot ? ' on' : ''}" data-i="${s.i}" style="width:${s.dur / tl.dur * 100}%;background:linear-gradient(180deg,${SCENE_COLORS[s.scene] || '#333'},#111)">
      ${s.i > 0 && s.transition !== 'cut' ? '<span class="tr" title="' + esc(TRANSITIONS[s.transition] || '') + '"></span>' : ''}${s.edited ? '<span class="ov">✎</span>' : ''}
      <b>${esc(SCENES[s.scene] || s.scene)}</b><small>${esc(CAMERAS[s.camera] || '')} · ${esc((main ? main.text : '').slice(0, 28))}</small></div>`;
  }).join('');
  const st = soundtrack(), beats = F.beatSync && st && st.an ? st.an.beats : [];
  $('#tlBeats').innerHTML = beats.filter(b => b < tl.dur).map(b => `<i style="left:${b / tl.dur * 100}%"></i>`).join('');
}
function highlightShotAt(t) {
  const s = tl.shots.findLast ? tl.shots.findLast(x => x.start <= t) : [...tl.shots].reverse().find(x => x.start <= t);
  if (s && s.i !== selShot) { selShot = s.i; $$('.tl-shot').forEach(d => d.classList.toggle('on', +d.dataset.i === selShot)); updateInspector(); }
}
$('#timeline').onclick = e => {
  const r = $('#timeline').getBoundingClientRect(); const t = (e.clientX - r.left) / r.width * tl.dur;
  const was = playing; stopPlayback();
  const s = [...tl.shots].reverse().find(x => x.start <= t); selShot = s ? s.i : -1;
  curT = Math.max(0, Math.min(tl.dur, t)); updateTime(); renderTimeline(); updateInspector(); dirty = true;
  if (was) startPlayback(curT);
};

/* ================= Çekim düzenleyici ================= */
const fillSel = (el, obj) => (el.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join(''));
fillSel($('#iScene'), SCENES); fillSel($('#iCamera'), CAMERAS); fillSel($('#iAnim'), TEXT_ANIMS); fillSel($('#iTrans'), TRANSITIONS);
function updateInspector() {
  const s = tl.shots[selShot];
  $('#inspector').classList.toggle('off', !s);
  if (!s) { $('#insTitle').textContent = 'Çekim seçin'; return; }
  $('#insTitle').textContent = `Çekim ${s.i + 1}/${tl.shots.length}`;
  $('#iScene').value = s.scene; $('#iCamera').value = s.camera; $('#iAnim').value = s.anim; $('#iTrans').value = s.i === 0 ? 'fade' : s.transition;
  $('#iTrans').disabled = s.i === 0; $('#iK').value = s.camK; $('#iDur').textContent = s.dur.toFixed(1) + ' sn';
  $('#iReset').style.display = s.edited ? '' : 'none';
}
function setOv(patch) {
  const s = tl.shots[selShot]; if (!s) return;
  const k = s.key + '@' + F.style; overrides[k] = { ...(overrides[k] || {}), ...patch };
  save(); rebuild(); curT = Math.min(tl.dur, tl.shots[selShot].start + 0.4); updateTime(); dirty = true;
}
$('#iScene').onchange = e => setOv({ scene: e.target.value });
$('#iCamera').onchange = e => setOv({ camera: e.target.value });
$('#iAnim').onchange = e => setOv({ anim: e.target.value });
$('#iTrans').onchange = e => setOv({ transition: e.target.value });
$('#iK').onchange = e => setOv({ camK: +e.target.value });
$('#iShorter').onclick = () => { const s = tl.shots[selShot]; if (s) setOv({ dur: Math.max(1.2, +(s.dur - 0.5).toFixed(2)) }); };
$('#iLonger').onclick = () => { const s = tl.shots[selShot]; if (s) setOv({ dur: Math.min(20, +(s.dur + 0.5).toFixed(2)) }); };
$('#iReset').onclick = () => { const s = tl.shots[selShot]; if (!s) return; delete overrides[s.key + '@' + F.style]; save(); rebuild(); };

/* ================= Yönetmen sekmesi ================= */
const STYLE_SW = { sinematik: 'linear-gradient(135deg,#0e4a55,#e08a3c)', nur: 'linear-gradient(135deg,#3a2508,#ffd27a)', gece: 'linear-gradient(135deg,#050a24,#3a6ad0)', retro: 'linear-gradient(135deg,#3a0a5a,#ff4fd8)', noir: 'linear-gradient(135deg,#000,#bbb)', pastel: 'linear-gradient(135deg,#f6c6dc,#bfe3ff)', altin: 'linear-gradient(135deg,#1a1205,#ffc84a)', glitch: 'linear-gradient(135deg,#0a0030,#00f0ff)', vintage: 'linear-gradient(135deg,#5a3a1a,#f0c890)', piksel: 'linear-gradient(135deg,#102040,#ffe066)' };
$('#styles').innerHTML = Object.entries(STYLES).map(([k, s]) => `<div class="style-card" data-v="${k}"><div class="sw2" style="background:${STYLE_SW[k] || '#333'}"></div><b>${esc(s.name)}</b><small>${esc(s.desc)}</small></div>`).join('');
$('#styles').onclick = e => { const c = e.target.closest('[data-v]'); if (!c) return; F.style = c.dataset.v; F.fxOv = {}; F.gradeOv = {}; F.colors = {}; changed(); };
$('#redirect').onclick = () => { F.seed = (F.seed % 9999) + 1; changed(); toast('Yeni kurgu: ' + tl.shots.length + ' çekim'); };
function renderPlatforms() {
  $('#platforms').innerHTML = Object.entries(PLATFORMS).map(([k, p]) => `<div class="plat${F.platforms.includes(k) ? ' on' : ''}${F.previewPlatform === k ? ' prev' : ''}" data-p="${k}"><span class="pv">önizlemede</span><b>${esc(p.name)}</b><small>${esc(p.desc)}</small><span class="fmt">${p.format} · ${dims(p.format, p.res).join('×')}</span></div>`).join('');
}
$('#platforms').onclick = e => {
  const c = e.target.closest('[data-p]'); if (!c) return; const k = c.dataset.p;
  if (F.platforms.includes(k)) {
    if (F.previewPlatform !== k) { F.previewPlatform = k; } // açık olana tıklamak önizlemeyi ona geçirir
    else if (F.platforms.length > 1) { F.platforms = F.platforms.filter(x => x !== k); F.previewPlatform = F.platforms[0]; }
  } else { F.platforms.push(k); F.previewPlatform = k; }
  resizePreview(); changed();
};
$('#durChips').onclick = e => { const b = e.target.closest('[data-d]'); if (!b) return; F.durMode = 'target'; F.targetDur = +b.dataset.d; changed(); };
const FIELDS = ['pace', 'mealMode', 'mode', 'respectKeywords', 'beatSync', 'durMode', 'targetDur', 'showSafe', 'fps', 'quality', 'latinFont', 'arabicFont', 'size', 'musicVol', 'fadeIn', 'fadeOut', 'refUseCuts', 'refUseEnergy', 'refUseColors', 'refUseAudio', 'olUrl', 'olModel', 'cfUrl', 'cfCkpt', 'recOn', 'reciter', 'ttsOn', 'voice', 'imgOn', 'stockOn', 'pxKey', 'stockNoPeople', 'stockN', 'aiCount', 'aiTone', 'aiNarr', 'aiTopic'];
for (const k of FIELDS) {
  const el = document.getElementById(k); if (!el) continue;
  el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
    F[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
    if (['olUrl', 'olModel', 'cfUrl', 'cfCkpt', 'aiCount', 'aiTone', 'aiNarr', 'aiTopic', 'pxKey', 'stockNoPeople', 'stockN'].includes(k)) { save(); return; }
    if (k === 'stockOn') { save(); rebuild(); return; }
    if (['recOn', 'ttsOn', 'reciter', 'voice'].includes(k)) { save(); rebuild(); updateAiAudioStatus(); return; }
    if (k === 'targetDur') F.targetDur = Math.max(5, Math.min(1200, Math.round(+el.value || 60)));
    if (['latinFont', 'arabicFont'].includes(k)) ensureFonts().then(changed); else changed();
  });
}
function resizePreview() { [PW, PH] = previewDims(); if (cv.width !== PW || cv.height !== PH) { cv.width = PW; cv.height = PH; film.resize(PW, PH); } fitCanvas(); placeSafe(); }
function fmtOut(o) { const el = document.getElementById(o.dataset.for); const v = +el.value; o.textContent = o.hasAttribute('data-pct') ? Math.round(v * 100) + '%' : v.toFixed(2); }
function syncUI() {
  for (const k of FIELDS) { const el = document.getElementById(k); if (!el) continue; if (el.type === 'checkbox') el.checked = !!F[k]; else el.value = F[k]; }
  $$('#styles .style-card').forEach(c => c.classList.toggle('on', c.dataset.v === F.style));
  renderPlatforms();
  $('#durBox').style.visibility = F.durMode === 'target' ? 'visible' : 'hidden';
  $('#durFmt').textContent = F.durMode === 'target' ? fmtDur(+F.targetDur) : '';
  $$('#durChips [data-d]').forEach(b => b.classList.toggle('on', F.durMode === 'target' && +b.dataset.d === +F.targetDur));
  updateDurHint(); placeSafe();
  $$('output[data-for]').forEach(fmtOut);
  $('#seedInfo').textContent = `Kurgu #${F.seed}`;
  const st = film.style;
  $('#cText').value = F.colors.text || st.text; $('#cAccent').value = F.colors.accent || st.accent; $('#cSub').value = F.colors.sub || st.sub;
  renderFx();
}
function changed() { save(); rebuild(); syncUI(); }
const fmtDur = t => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;
function updateDurHint() {
  const d = F.durMode === 'target' ? +F.targetDur : tl.dur;
  const warns = F.platforms.map(k => PLATFORMS[k]).filter(p => p.max && d > p.max).map(p => p.suffix === 'shorts' ? 'YouTube Shorts 3 dakikayı geçince normal video sayılır' : 'Instagram 3 dakikadan uzun Reels\'i yeni kitlelere önermez');
  let msg = 'Süre uzunsa yönetmen aynı metni farklı sahne ve kamera açılarından çeker, başa başlık ve sona kaynak kartı ekler; kısaysa çekimleri sıkıştırır.';
  if (F.durMode === 'target' && tl.shots.length && tl.dur > +F.targetDur + 0.5) msg = `Metin bu süreye sığmıyor; en kısa ${tl.dur.toFixed(0)} sn olabildi. Tempoyu artırın ya da metni bölün.`;
  $('#durHint').innerHTML = esc(msg) + (warns.length ? `<br><span style="color:#e0a96d">⚠ ${esc(warns.join('; '))}.</span>` : '');
}
function placeSafe() {
  const ov = $('#safeOv'); ov.classList.toggle('show', !!F.showSafe); if (!F.showSafe) return;
  const r = cv.getBoundingClientRect(), sr = $('#stage').getBoundingClientRect(), sf = PV().safe;
  Object.assign(ov.style, { left: (r.left - sr.left) + 'px', top: (r.top - sr.top) + 'px', width: r.width + 'px', height: r.height + 'px' });
  ov.querySelector('.st').style.height = (sf.top * 100) + '%'; ov.querySelector('.sb').style.height = (sf.bottom * 100) + '%';
}
window.addEventListener('resize', () => setTimeout(placeSafe, 0));

/* ================= Efektler ================= */
const GRADE_UI = { exposure: ['Pozlama', -1, 1, 0.02], contrast: ['Kontrast', 0.5, 1.6, 0.01], saturation: ['Doygunluk', 0, 1.8, 0.01], temperature: ['Sıcaklık', -1, 1, 0.02], tint: ['Ton', -1, 1, 0.02] };
const FX_MAX = { bloom: 2, letterbox: 1 };
function renderFx() {
  const st = film.style;
  $('#fxList').innerHTML = Object.entries(EFFECTS).map(([k, n]) => { const v = F.fxOv[k] ?? st.fx[k] ?? 0; const mx = FX_MAX[k] || 1; return `<div class="fx-row"><span>${esc(n)}</span><input type="range" data-fx="${k}" min="0" max="${mx}" step="0.01" value="${v}"><output>${Math.round(v / mx * 100)}</output></div>`; }).join('');
  $('#gradeList').innerHTML = Object.entries(GRADE_UI).map(([k, [n, a, b, s]]) => { const v = F.gradeOv[k] ?? st.grade[k]; return `<div class="fx-row"><span>${n}</span><input type="range" data-gr="${k}" min="${a}" max="${b}" step="${s}" value="${v}"><output>${(+v).toFixed(2)}</output></div>`; }).join('');
}
$('#fxList').oninput = e => { const k = e.target.dataset.fx; if (!k) return; F.fxOv[k] = +e.target.value; e.target.nextElementSibling.textContent = Math.round(+e.target.value / (FX_MAX[k] || 1) * 100); film.post.apply({ ...film.style, fx: { ...film.style.fx, ...F.fxOv } }); dirty = true; save(); };
$('#gradeList').oninput = e => { const k = e.target.dataset.gr; if (!k) return; F.gradeOv[k] = +e.target.value; e.target.nextElementSibling.textContent = (+e.target.value).toFixed(2); film.style.grade[k] = +e.target.value; film.post.apply(film.style, F.fxOv); dirty = true; save(); };
$('#fxList').onchange = $('#gradeList').onchange = () => rebuild();
$('#fxReset').onclick = () => { F.fxOv = {}; F.gradeOv = {}; F.colors = {}; changed(); };
[['cText', 'text'], ['cAccent', 'accent'], ['cSub', 'sub']].forEach(([id, k]) => $('#' + id).addEventListener('change', e => { F.colors[k] = e.target.value; changed(); }));

/* ================= Metinler ================= */
function renderList() {
  $('#count').textContent = `(${items.length})`;
  $('#itemList').innerHTML = items.length ? items.map((it, i) => {
    const ar = isMostlyRTL(it.main);
    return `<div class="it${i === sel ? ' on' : ''}" data-i="${i}"><div class="no">${i + 1}</div><div class="tx${ar ? ' ar' : ''}">${esc((it.main || it.sub).split('\n')[0])}${it.src ? `<small>${esc(it.src)}</small>` : ''}</div>
      <div class="acts"><button data-a="up">↑</button><button data-a="down">↓</button><button data-a="del">✕</button></div></div>`;
  }).join('') : '<div class="empty">Liste boş.</div>';
}
$('#itemList').onclick = e => {
  const row = e.target.closest('.it'); if (!row) return;
  const i = +row.dataset.i, a = e.target.closest('[data-a]')?.dataset.a;
  if (a === 'up' && i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; sel = i - 1; }
  else if (a === 'down' && i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; sel = i + 1; }
  else if (a === 'del') { items.splice(i, 1); sel = Math.max(0, Math.min(sel, items.length - 1)); }
  else sel = i;
  listChanged();
  const s = tl.shots.find(x => x.item === sel); if (s) { curT = s.start + 0.3; selShot = s.i; updateTime(); renderTimeline(); updateInspector(); dirty = true; }
};
function loadEditor() {
  const it = items[sel]; $('#editor').style.display = it ? '' : 'none'; if (!it) return;
  $('#editNo').textContent = '#' + (sel + 1);
  $('#eMain').value = it.main; $('#eSub').value = it.sub; $('#eSrc').value = it.src; $('#eTag').value = it.tag;
  ['eMain', 'eSub'].forEach(id => $('#' + id).classList.toggle('rtl', isMostlyRTL($('#' + id).value)));
}
let editT = 0;
[['eMain', 'main'], ['eSub', 'sub'], ['eSrc', 'src'], ['eTag', 'tag']].forEach(([id, k]) => $('#' + id).addEventListener('input', e => {
  const it = items[sel]; if (!it) return; it[k] = e.target.value;
  ['eMain', 'eSub'].forEach(x => $('#' + x).classList.toggle('rtl', isMostlyRTL($('#' + x).value)));
  save(); clearTimeout(editT); editT = setTimeout(() => { renderList(); rebuild(); }, 350);
}));
function listChanged() { save(); renderList(); loadEditor(); rebuild(); renderImgGrid(); updateAiAudioStatus(); }
$('#addItem').onclick = () => { items.splice(sel + 1, 0, makeItem({ main: 'Yeni metin' })); sel = Math.min(sel + 1, items.length - 1); listChanged(); $('#eMain').focus(); $('#eMain').select(); };
$('#clearList').onclick = () => { if (!items.length) return; if (!confirm('Tüm liste silinsin mi?')) return; items = []; sel = 0; listChanged(); };
const bulk = () => { const t = $('#bulkText').value.trim(); return !t ? [] : t.split('\n')[0].includes('\t') ? parseCSV(t) : parseList(t); };
$('#bulkAppend').onclick = () => { const n = bulk(); if (!n.length) return; items.push(...n); $('#bulkText').value = ''; listChanged(); };
$('#bulkReplace').onclick = () => { const n = bulk(); if (!n.length) return; items = n; sel = 0; $('#bulkText').value = ''; listChanged(); };
$('#csvFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; const n = parseCSV(await f.text()); e.target.value = ''; if (n.length) { items.push(...n); listChanged(); } };
let SUR = [];
surahs().then(list => {
  SUR = list; $('#qSurah').innerHTML = list.map(s => `<option value="${s.id}">${s.id}. ${esc(s.tr)} — ${s.ar} (${s.n})</option>`).join(''); onSurah();
}).catch(() => { $('#qSurah').innerHTML = '<option>Kur\'an verisi yüklenemedi</option>'; });
function onSurah() { const s = SUR.find(x => x.id === +$('#qSurah').value); if (!s) return; $('#qFrom').max = $('#qTo').max = s.n; $('#qFrom').value = 1; $('#qTo').value = Math.min(s.n, 3); }
$('#qSurah').onchange = onSurah;
$('#qAdd').onclick = async () => {
  try { const n = (await buildItems(+$('#qSurah').value, +$('#qFrom').value, +$('#qTo').value, { mode: $('#qMode').value, meal: $('#qMeal').checked })).map(makeItem); items.push(...n); sel = items.length - n.length; listChanged(); toast(`${n.length} öğe eklendi`); }
  catch (e) { toast('Ayetler yüklenemedi'); }
};

/* ================= Ses ================= */
async function addMusic(blob, name, id = newId(), persist = true) {
  try {
    const buffer = await decodeBlob(blob); const an = analyzeAudio(buffer);
    music.push({ id, name, buffer, blob, an });
    if (persist) putFile({ id, kind: 'music', name, type: blob.type, blob, order: Date.now() });
    if (!F.soundtrack) F.soundtrack = id;
  } catch (e) { toast(`${name} okunamadı`); }
}
$('#musicFiles').onchange = async e => { const fs = [...e.target.files]; e.target.value = ''; for (const f of fs) await addMusic(f, f.name); renderMusic(); changed(); };
function renderMusic() {
  $('#musicList').innerHTML = music.map((m, i) => `<div class="a"><span>${i + 1}. ${esc(m.name)}</span><span class="muted">${m.an.bpm} BPM · ${m.buffer.duration.toFixed(0)} sn <button data-i="${i}">✕</button></span></div>`).join('');
  $('#soundtrack').innerHTML = music.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('') || '<option value="">—</option>';
  $('#soundtrack').value = F.soundtrack;
  $('#noMusicWarn').classList.toggle('show', !music.length && !(F.refUseAudio && refAudio));
}
$('#musicList').onclick = e => { const b = e.target.closest('button[data-i]'); if (!b) return; const [m] = music.splice(+b.dataset.i, 1); delFile(m.id); if (F.soundtrack === m.id) F.soundtrack = music[0] ? music[0].id : ''; renderMusic(); changed(); };
$('#soundtrack').onchange = e => { F.soundtrack = e.target.value; changed(); };
function updateAudioUI() {
  const st = soundtrack();
  const p = $('#audioPill'); p.className = 'audio-pill ' + (st ? 'on' : 'off'); p.textContent = st ? `🔈 ${st.name}` : '🔇 Ses yok';
  $('#beatInfo').textContent = st && st.an ? `Tempo: ${st.an.bpm} BPM · ${st.an.beats.length} vuruş bulundu${F.beatSync ? ' · kesmeler vuruşlara oturtuluyor' : ''}` : '';
  $('#noMusicWarn').classList.toggle('show', !st);
}
$('#audioPill').onclick = () => switchTab('ses');

/* ================= Referans ================= */
$('#refFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  const bar = $('#refProg'); bar.style.display = ''; bar.querySelector('i').style.width = '0';
  try {
    const an = await analyzeVideo(f, p => (bar.querySelector('i').style.width = (p * 100).toFixed(0) + '%'), decodeBlob);
    refAudio = an.audio ? an.audio.buffer : null;
    if (an.audio) delete an.audio.buffer;
    delete an.frames;
    ref = { name: f.name, analysis: an }; store.set('film-ref', ref);
    renderRef(); changed(); toast(`Referans çözümlendi: ${an.shots.length} çekim`);
  } catch (err) { console.error(err); toast('Video çözümlenemedi'); }
  bar.style.display = 'none';
};
function renderRef() {
  $('#refBox').style.display = ref ? '' : 'none'; if (!ref) return;
  const a = ref.analysis;
  $('#refName').textContent = ref.name;
  $('#refStrip').innerHTML = a.shots.map(s => `<div title="${s.dur.toFixed(2)} sn · hareket %${Math.round(s.energy * 100)}" style="flex:${s.dur};background:linear-gradient(180deg,${s.colors[2]},${s.colors[1]} 50%,${s.colors[0]})"></div>`).join('');
  const au = a.audio;
  $('#refStats').innerHTML = `Süre <b>${a.duration.toFixed(1)} sn</b> · <b>${a.shots.length}</b> çekim · ortalama çekim <b>${a.avgShot.toFixed(2)} sn</b>` +
    (au ? ` · tempo <b>${au.bpm} BPM</b>` : ' · ses izi yok') +
    `<br>Renk karakteri: sıcaklık ${a.grade.temperature.toFixed(2)}, doygunluk ${a.grade.saturation.toFixed(2)}, kontrast ${a.grade.contrast.toFixed(2)}` +
    (!refAudio && au ? '<br><span style="color:#e0a96d">Müzik yalnızca videoyu yüklediğiniz oturumda kullanılabilir; sayfa yenilendiyse videoyu yeniden yükleyin.</span>' : '');
}
$('#refClear').onclick = () => { ref = null; refAudio = null; store.set('film-ref', null); renderRef(); changed(); };

/* ================= Üretim ================= */
const results = []; let cancelFlag = false, dirHandle = null;
function updateOutInfo() {
  const n = (F.mode === 'each' ? items.length : 1) * F.platforms.length;
  const pl = F.platforms.map(k => `${PLATFORMS[k].name} (${dims(PLATFORMS[k].format, PLATFORMS[k].res).join('×')})`).join(', ');
  $('#outInfo').innerHTML = `<b>${n}</b> dosya · ${esc(pl)} · ${F.fps} fps<br>${F.mode === 'film' ? `Süre <b>${fmtDur(tl.dur)}</b> (${tl.dur.toFixed(1)} sn), ${tl.shots.length} çekim` : 'Her öğe ayrı video'}<br>` +
    (hasFast() ? 'Hızlı mod (WebCodecs) açık.' : 'Gerçek zamanlı kayıt (Chrome/Edge önerilir).');
}
function setBusy(v) { busy = v; ['#render', '#renderBtn', '#play', '#seek', '#redirect'].forEach(s => ($(s).disabled = v)); $('#cancel').disabled = !v; $('#hiddenWarn').classList.toggle('show', v); }
async function renderOne(timeline, name, W, H, mbps, onP) {
  film.setTimeline(timeline);
  const ao = audioOpts(timeline);
  const audio = (ao.music || ao.clips.length) ? await mixTimeline(timeline.dur, ao) : null;
  const fps = +F.fps, bitrate = Math.round(mbps * 1e6 * (fps > 30 ? 1.5 : 1) * +F.quality * (H * W) / (1920 * 1080));
  let file = null; if (dirHandle) file = await dirHandle.getFileHandle(name + '.mp4', { create: true });
  let res = null;
  if (hasFast()) { try { res = await encodeFast({ canvas: cv, W, H, fps, dur: timeline.dur, bitrate, audio, file, onProgress: onP, cancelled: () => cancelFlag, renderAt: async t => { await film.prepare(t); film.render(t); } }); } catch (e) { if (e.message !== 'NO_FAST') throw e; } }
  if (!res) res = await encodeRealtime({ canvas: cv, fps, dur: timeline.dur, bitrate, audio, audioCtx: audio ? live() : null, onProgress: onP, cancelled: () => cancelFlag, renderLive: t => { film.prepare(t, true); film.render(t); } });
  return { ...res, name: `${name}.${res.ext}`, file: res.blob ? null : file };
}
function jobsFor(platKey) {
  const p = PLATFORMS[platKey], jobs = [];
  const base = slug(items[0] && (items[0].tag || items[0].src) || 'film') || 'film';
  if (F.mode === 'each') {
    items.forEach((it, i) => {
      const t1 = direct([augItems()[i]], { ...directOpts(), aiImages: F.imgOn, stock: F.stockOn }); // her öğe kendi süresine göre kurgulanır
      t1.shots.forEach(s => { s.key = s.key.replace(/^0:/, i + ':'); });
      const t2 = applyOverrides(t1); t2.clips = clipsOf(t2.shots).map(c => ({ ...c, key: c.key.replace(/:0$/, ':' + i) }));
      jobs.push({ tl: t2, name: `${String(i + 1).padStart(2, '0')}-${slug(it.src || it.tag || 'video')}-${p.suffix}` });
    });
  } else jobs.push({ tl, name: `${base}-${p.suffix}` });
  return jobs;
}
async function renderAll() {
  if (busy || !tl.shots.length) return;
  stopPlayback(); cancelFlag = false; setBusy(true); switchTab('uretim');
  await ensureFonts();
  if (F.recOn || F.ttsOn) { $('#barTxt').textContent = 'Sesler hazırlanıyor…'; await prepareAudio(m => ($('#barTxt').textContent = m)); }
  const plan = [];
  for (const k of F.platforms) plan.push(k);
  const total = plan.length * (F.mode === 'each' ? items.length : 1);
  let done = 0; const t0 = performance.now();
  try {
    for (const k of plan) {
      const p = PLATFORMS[k]; const [W, H] = dims(p.format, p.res);
      cv.width = W; cv.height = H; film.resize(W, H); film.safe = p.safe; rebuild();
      for (const j of jobsFor(k)) {
        const r = await renderOne(j.tl, j.name, W, H, p.mbps, q => { $('#bar').style.width = ((done + q) / total * 100).toFixed(1) + '%'; $('#barTxt').textContent = `${done + 1}/${total} · ${p.name} · %${Math.round(q * 100)}`; });
        results.push({ ...r, url: null, plat: p.name }); done++; renderResults();
      }
    }
    $('#barTxt').textContent = `${done} dosya hazır · ${((performance.now() - t0) / 1000).toFixed(0)} sn`;
  } catch (e) { if (e.message === 'CANCEL') $('#barTxt').textContent = 'Durduruldu'; else { console.error(e); $('#barTxt').textContent = 'Hata: ' + e.message; } }
  [PW, PH] = previewDims(); cv.width = PW; cv.height = PH; film.resize(PW, PH); film.safe = PV().safe; fitCanvas();
  setBusy(false); rebuild();
}
const TRM = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
function slug(s) { return (s || '').toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, c => TRM[c]).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
function renderResults() {
  $('#results').innerHTML = results.map((r, i) => `<div class="q"><div class="no muted">${i + 1}</div><div><div class="tx">${esc(r.name)}</div><div class="st ok">${esc(r.plat || '')} · ${(r.size / 1048576).toFixed(1)} MB${r.file ? ' · klasörde' : ''}</div></div><div class="acts"><button class="btn sm" data-a="view" data-i="${i}">▶</button>${r.blob ? `<button class="btn sm" data-a="dl" data-i="${i}">⬇</button>` : ''}</div></div>`).join('');
  $('#doneBadge').textContent = results.length || ''; $('#zipAll').disabled = !results.some(r => r.blob);
}
$('#results').onclick = async e => {
  const b = e.target.closest('[data-a]'); if (!b) return; const r = results[+b.dataset.i];
  if (b.dataset.a === 'dl') saveFile(r.blob, r.name);
  else { if (!r.url) r.url = URL.createObjectURL(r.file ? await r.file.getFile() : r.blob); $('#modalVid').src = r.url; $('#modalDl').style.display = r.blob ? '' : 'none'; $('#modal').dataset.i = b.dataset.i; $('#modal').classList.add('show'); $('#modalVid').play().catch(() => { }); }
};
$('#modalClose').onclick = () => { $('#modalVid').pause(); $('#modal').classList.remove('show'); };
$('#modalDl').onclick = () => { const r = results[+$('#modal').dataset.i]; if (r && r.blob) saveFile(r.blob, r.name); };
$('#render').onclick = $('#renderBtn').onclick = renderAll;
$('#cancel').onclick = () => (cancelFlag = true);
$('#pickDir').style.display = 'showDirectoryPicker' in window ? '' : 'none';
$('#pickDir').onclick = async () => { try { dirHandle = await showDirectoryPicker({ mode: 'readwrite', id: 'film-studyosu' }); $('#dirName').textContent = '📁 ' + dirHandle.name; } catch (e) { } };
let claudeDl = null;
try { if (window.claude && window.claude.use) window.claude.use('downloads').then(d => (claudeDl = d)).catch(() => { }); } catch (e) { }
async function saveFile(blob, name) {
  if (claudeDl) { try { await claudeDl.save({ filename: name, data: blob }); return; } catch (e) { if (e && e.code === 'declined') return; } }
  const a = document.createElement('a'); const u = URL.createObjectURL(blob); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000);
}
$('#zipAll').onclick = async () => { const z = new JSZip(); results.filter(r => r.blob).forEach(r => z.file(r.name, r.blob)); saveFile(await z.generateAsync({ type: 'blob', compression: 'STORE' }), 'filmler.zip'); };

/* ================= Proje ================= */
$('#saveProj').onclick = () => saveFile(new Blob([JSON.stringify({ app: 'film-studyosu', version: 1, settings: { ...F, pxKey: '' }, items: items.map(plainItem), overrides, ref }, null, 2)], { type: 'application/json' }), 'film-projesi.json');
$('#loadProj').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try { const d = JSON.parse(await f.text()); if (d.settings) F = { ...DEFAULTS, ...d.settings }; if (d.items) items = d.items.map(makeItem); overrides = d.overrides || {}; ref = d.ref || null; sel = 0; renderRef(); renderList(); loadEditor(); resizePreview(); changed(); toast('Proje açıldı'); }
  catch (err) { toast('Proje okunamadı'); }
};


/* ================= Yapay zekâ ================= */
$('#reciter').innerHTML = Object.entries(RECITERS).map(([k, r]) => `<option value="${k}">${esc(r.name)}</option>`).join('');
$('#voice').innerHTML = Object.entries(VOICES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
const GUIDE = `<ol>
<li><b>Tek komutla kurulum (Mac):</b> Terminal'i açın ve şu satırı yapıştırın:
<pre>curl -fsSL https://dogankku.github.io/studioai/kurulum/mac.sh | bash</pre>Ollama + qwen2.5:7b (senarist), ComfyUI + SD-Turbo (görseller) kurulur; yaklaşık 12 GB indirilir, yönetici şifresi gerekmez. Tekrar çalıştırmak güvenlidir, bitenleri atlar.</li>
<li><b>Her kullanımda:</b> Ollama kendiliğinden açılır. Görseller için Finder'da <code>~/FilmStudyosu/ComfyUI-Baslat.command</code> dosyasına çift tıklayın ve açılan Terminal penceresini açık bırakın (ya da Terminal'de <code>open ~/FilmStudyosu/ComfyUI-Baslat.command</code>).</li>
<li>Buradaki "Bağlan" düğmelerine basın. Chrome yerel ağa erişim izni sorarsa izin verin.</li></ol>`;
$('#guideBox').innerHTML = GUIDE;

async function olConnect(quiet) {
  $('#olStatus').textContent = 'Bağlanılıyor…';
  try {
    const ms = await ollamaModels(F.olUrl);
    $('#olModel').innerHTML = ms.length ? ms.map(m => `<option value="${esc(m.name)}">${esc(m.name)} (${(m.size / 1e9).toFixed(1)} GB)</option>`).join('') : '<option value="">model yok: ollama pull qwen2.5:7b</option>';
    if (!ms.some(m => m.name === F.olModel)) F.olModel = (ms.find(m => /qwen|llama|gemma|mistral/i.test(m.name)) || ms[0] || {}).name || '';
    $('#olModel').value = F.olModel; save();
    $('#olStatus').textContent = ms.length ? `✓ Bağlı · ${ms.length} model` : '✓ Bağlı ama model yok';
    return true;
  } catch (e) { $('#olStatus').textContent = quiet ? '' : '✗ Bağlanamadı: Ollama açık mı, OLLAMA_ORIGINS ayarlı mı? (rehbere bakın)'; return false; }
}
async function cfConnect(quiet) {
  $('#cfStatus').textContent = 'Bağlanılıyor…';
  try {
    const cs = await comfyCheckpoints(F.cfUrl);
    $('#cfCkpt').innerHTML = cs.length ? cs.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('') : '<option value="">model yok: models/checkpoints klasörüne ekleyin</option>';
    if (!cs.includes(F.cfCkpt)) F.cfCkpt = cs.find(c => /turbo/i.test(c)) || cs[0] || '';
    $('#cfCkpt').value = F.cfCkpt; save();
    $('#cfStatus').textContent = cs.length ? `✓ Bağlı · ${cs.length} model` : '✓ Bağlı ama model yok';
    return true;
  } catch (e) { $('#cfStatus').textContent = quiet ? '' : '✗ Bağlanamadı: ComfyUI çalışıyor mu, --enable-cors-header verildi mi?'; return false; }
}
$('#olTest').onclick = () => olConnect(false);
$('#cfTest').onclick = () => cfConnect(false);

let aiAbort = null, lastPlan = store.get('film-plan', null);
$('#aiWrite').onclick = async () => {
  const topic = $('#aiTopic').value.trim(); if (!topic) { toast('Önce bir konu yazın'); return; }
  if (!F.olModel && !(await olConnect(false))) return;
  if (!F.olModel) { toast('Ollama\'da model yok'); return; }
  aiAbort = new AbortController(); $('#aiWrite').disabled = true; $('#aiStop').disabled = false;
  const t0 = performance.now();
  try {
    lastPlan = await writeScript({ url: F.olUrl, model: F.olModel, topic, ayahCount: +F.aiCount, tone: F.aiTone, seconds: F.durMode === 'target' ? +F.targetDur : 60, narration: F.aiNarr, signal: aiAbort.signal, onStatus: m => ($('#aiStatus').textContent = m) });
    store.set('film-plan', lastPlan); renderPlan();
    $('#aiStatus').textContent = `Senaryo hazır (${((performance.now() - t0) / 1000).toFixed(0)} sn). Kontrol edip listeye uygulayın.`;
  } catch (e) { $('#aiStatus').textContent = e.name === 'AbortError' ? 'Durduruldu' : '✗ ' + e.message; }
  $('#aiWrite').disabled = false; $('#aiStop').disabled = true; aiAbort = null;
};
$('#aiStop').onclick = () => aiAbort && aiAbort.abort();
function planItems(p) {
  const out = [];
  if (p.hook) out.push(makeItem({ main: p.hook, tag: p.title, aiText: true, imgPrompt: 'serene cinematic landscape at golden hour, soft light, atmospheric, no people' }));
  p.items.forEach((v, i) => out.push(makeItem({ main: v.ar, sub: v.tr, src: `${v.sname} Sûresi, ${v.a}`, tag: !p.hook && i === 0 ? p.title : '', ref: { s: v.s, from: v.a, to: v.a }, imgPrompt: v.image || '', sceneHint: v.scene || '' })));
  if (p.closing) out.push(makeItem({ main: p.closing, aiText: true, imgPrompt: 'calm night sky with stars over quiet hills, cinematic, no people' }));
  return out;
}
function renderPlan() {
  const p = lastPlan; $('#aiPlan').style.display = p ? '' : 'none'; if (!p) return;
  $('#aiPlanBox').innerHTML = `<b>${esc(p.title)}</b>${p.style ? ` · stil: ${esc((STYLES[p.style] || {}).name || p.style)}` : ''}` +
    (p.hook ? `<div class="ay"><i>Giriş:</i> ${esc(p.hook)}</div>` : '') +
    p.items.map(v => `<div class="ay"><div class="ar">${esc(v.ar)}</div>${esc(v.tr)} <span class="muted">(${esc(v.sname)}, ${v.a})</span>${v.image ? `<br><span class="muted">Görsel: ${esc(v.image)}</span>` : ''}</div>`).join('') +
    (p.closing ? `<div class="ay"><i>Kapanış:</i> ${esc(p.closing)}</div>` : '');
  $('#aiYt').value = `${p.youtubeTitle}\n\n${p.description}\n\n${p.items.map(v => `${v.sname} Sûresi, ${v.a}`).join(' · ')}\n\n${p.hashtags.map(h => '#' + h).join(' ')}`;
}
$('#aiApply').onclick = () => { if (!lastPlan) return; items = planItems(lastPlan); sel = 0; if (lastPlan.style) F.style = lastPlan.style; F.seed = (F.seed % 9999) + 1; listChanged(); syncUI(); toast('Senaryo listeye uygulandı'); };
$('#aiAppend').onclick = () => { if (!lastPlan) return; const n = planItems(lastPlan); items.push(...n); listChanged(); toast(`${n.length} öğe eklendi`); };
$('#aiCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#aiYt').value); toast('Kopyalandı'); } catch (e) { $('#aiYt').select(); } };

/* ses hazırlama */
function updateAiAudioStatus() {
  const need = items.filter(it => F.recOn && it.ref && it.ref.from === it.ref.to && !recCache.has(it.id + ':' + F.reciter)).length + items.filter(it => F.ttsOn && needsTTS(it) && !narrCache.has(it.id + ':' + F.voice)).length;
  $('#audioStatus').textContent = (F.recOn || F.ttsOn) ? (need ? `${need} ses hazırlanmayı bekliyor` : '✓ Sesler hazır') : '';
}
const needsTTS = it => (it.main && !isMostlyRTL(it.main)) || (it.sub && !isMostlyRTL(it.sub));
async function prepareAudio(onStatus = m => ($('#audioStatus').textContent = m)) {
  let n = 0, fails = 0;
  for (const it of items) {
    if (F.recOn && it.ref && it.ref.from === it.ref.to && it.main && !recCache.has(it.id + ':' + F.reciter)) {
      try { const r = await getRecitation(F.reciter, it.ref.s, it.ref.from, wordsOf(it.main).length, m => onStatus(`#${items.indexOf(it) + 1}: ${m}`)); recCache.set(it.id + ':' + F.reciter, { ...r, n: wordsOf(it.main).length }); n++; }
      catch (e) { fails++; console.warn('tilavet', e); }
    }
    if (F.ttsOn && needsTTS(it) && !narrCache.has(it.id + ':' + F.voice)) {
      try {
        const o = { mainText: it.main, subText: it.sub };
        if (it.main && !isMostlyRTL(it.main)) o.main = await speak(it.main, F.voice, m => onStatus(`#${items.indexOf(it) + 1}: ${m}`));
        if (it.sub && !isMostlyRTL(it.sub)) o.sub = await speak(it.sub, F.voice, m => onStatus(`#${items.indexOf(it) + 1}: ${m}`));
        narrCache.set(it.id + ':' + F.voice, o); n++;
      } catch (e) { fails++; console.warn('tts', e); }
    }
  }
  rebuild(); updateAiAudioStatus();
  if (fails) onStatus(`${fails} ses alınamadı (internet bağlantısı ya da kaynak engeli olabilir; konsola bakın)`);
  return n;
}
$('#prepAudio').onclick = async () => { $('#prepAudio').disabled = true; try { await prepareAudio(); } finally { $('#prepAudio').disabled = false; } };
$('#voiceDl').onclick = async () => { try { await downloadVoice(F.voice, p => ($('#audioStatus').textContent = `Ses modeli %${Math.round(p * 100)}`)); $('#audioStatus').textContent = '✓ Ses modeli hazır'; } catch (e) { $('#audioStatus').textContent = '✗ Ses modeli indirilemedi'; } };

/* görseller */
const SCENE_PROMPTS = { yildiz: 'starry night sky over desert mountains, milky way, deep blue, cinematic', col: 'golden desert dunes at sunset, soft warm light, cinematic', deniz: 'calm sea at night under moonlight, reflections, cinematic', nur: 'divine light rays through dark clouds, volumetric light, cinematic', cami: 'silhouette of mosque domes and minarets at dusk, purple sky, crescent moon, cinematic', desen: 'golden islamic geometric pattern, ornate, dark background, cinematic lighting', bulut: 'sea of clouds at sunrise, golden light, heavenly, cinematic', soyut: 'abstract flowing light ribbons, dark background, ethereal' };
function promptFor(it) {
  const base = it.imgPrompt || SCENE_PROMPTS[it.sceneHint] || SCENE_PROMPTS[(STYLES[F.style] || STYLES.nur).scenes[0]] || SCENE_PROMPTS.nur;
  return `${base}, highly detailed, beautiful, atmospheric, professional photography, no people, no text`;
}
async function loadImage(id) {
  if (film.images.has(id)) return true;
  const r = await getFile(id); if (!r) return false;
  const img = new Image(); img.src = URL.createObjectURL(r.blob);
  try { await img.decode(); film.images.set(id, img); return true; } catch (e) { return false; }
}
function renderImgGrid() {
  $('#imgGrid').innerHTML = items.map((it, i) => {
    const img = it.imgId && film.images.get(it.imgId);
    return `<div class="im"><b>${i + 1}</b>${img ? `<img src="${img.src}" alt="">` : esc(promptFor(it).split(',')[0])}<button data-gi="${i}">${img ? '↻' : 'üret'}</button></div>`;
  }).join('');
}
let genAbort = null;
async function genImage(i) {
  const it = items[i]; const [W, H] = dims(PV().format, 512);
  const w = Math.round(Math.min(896, W) / 64) * 64, h = Math.round(Math.min(896, H) / 64) * 64;
  const blob = await comfyGenerate(F.cfUrl, { ckpt: F.cfCkpt, prompt: promptFor(it), w: Math.max(512, w), h: Math.max(512, h) }, { signal: genAbort.signal, onProgress: sec => ($('#imgStatus').textContent = `#${i + 1} üretiliyor… ${sec.toFixed(0)} sn`) });
  const id = 'aiimg:' + newId();
  await putFile({ id, kind: 'aiimg', name: id, type: blob.type, blob, order: Date.now() });
  if (it.imgId) delFile(it.imgId);
  it.imgId = id; await loadImage(id); save();
}
async function genMissing(only = null) {
  if (!F.cfCkpt && !(await cfConnect(false))) return;
  if (!F.cfCkpt) { toast('ComfyUI\'da model yok'); return; }
  genAbort = new AbortController(); $('#genImgs').disabled = true; $('#genStop').disabled = false;
  const list = only != null ? [only] : items.map((it, i) => (!it.imgId || !film.images.has(it.imgId)) ? i : -1).filter(i => i >= 0);
  const t0 = performance.now(); let done = 0;
  try {
    for (const i of list) { await genImage(i); done++; renderImgGrid(); rebuild(); }
    $('#imgStatus').textContent = `${done} görsel üretildi · ${((performance.now() - t0) / 60000).toFixed(1)} dk`;
  } catch (e) { $('#imgStatus').textContent = e.message === 'CANCEL' || e.name === 'AbortError' ? `Durduruldu (${done} görsel üretildi)` : '✗ ' + e.message; }
  $('#genImgs').disabled = false; $('#genStop').disabled = true; genAbort = null;
}
$('#genImgs').onclick = () => genMissing();
$('#genStop').onclick = () => genAbort && genAbort.abort();
$('#imgGrid').onclick = e => { const b = e.target.closest('[data-gi]'); if (b && !genAbort) genMissing(+b.dataset.gi); };
$('#imgOn').addEventListener('change', () => rebuild());

/* ================= Gerçek video çekimleri (Pixabay) ================= */
async function loadVideo(id) {
  if (film.videos.has(id)) return true;
  const r = await getFile(id); if (!r) return false;
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.loop = false; v.src = URL.createObjectURL(r.blob);
  try {
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('video')); setTimeout(() => rej(new Error('zaman aşımı')), 20000); });
    film.videos.set(id, v); return true;
  } catch (e) { return false; }
}
function itemScene(it) { return it.sceneHint || detectScene(`${it.main} ${it.sub}`) || (STYLES[F.style] || STYLES.nur).scenes.find(x => x !== 'video') || 'nur'; }
function renderStockGrid() {
  const box = $('#stockGrid'); if (!box) return;
  box.innerHTML = items.map((it, i) => {
    const vs = (it.vids || []).filter(x => film.videos.has(x.id));
    const q = it.stockQ || (queriesFor({ ...it, stockQ: '' }, itemScene(it))[0] || {}).q || '';
    return `<div class="stk"><div class="stk-h"><b>${i + 1}</b><input type="text" data-sq="${i}" value="${esc(it.stockQ || '')}" placeholder="${esc(q)}" title="Arama kelimeleri (İngilizce ya da Türkçe). Boş bırakırsanız otomatik seçilir."><button class="btn sm ghost" data-si="${i}" title="Bu metin için yeni çekimler bul">↻</button></div>
      <div class="stk-row">${vs.length ? vs.map(x => `<a href="${esc(x.page || '#')}" target="_blank" rel="noopener" title="${esc(x.tags || '')} · ${esc(x.user || '')}">${x.thumb ? `<img src="${esc(x.thumb)}" alt="">` : '🎬'}</a>`).join('') : '<span class="muted">çekim yok</span>'}</div></div>`;
  }).join('');
}
let stockAbort = null;
async function fetchStockFor(i, exclude) {
  const it = items[i]; const P = PLATFORMS[F.platforms[0]] || PV(); const [W, H] = dims(P.format, P.res || 1080);
  const n = Math.max(1, Math.min(5, +F.stockN || 3));
  $('#stockStatus').textContent = `#${i + 1} için çekim aranıyor…`;
  const hits = await findClips(F.pxKey.trim(), it, itemScene(it), { n, portrait: H > W, noPeople: F.stockNoPeople, exclude, signal: stockAbort.signal });
  if (!hits.length) { $('#stockStatus').textContent = `#${i + 1}: uygun çekim bulunamadı, arama kelimesini değiştirin`; return 0; }
  const vids = [];
  for (const [k, h] of hits.entries()) {
    const { blob, rend, thumb } = await downloadClip(h, W, H, { signal: stockAbort.signal, onProgress: (g, tot) => ($('#stockStatus').textContent = `#${i + 1} · çekim ${k + 1}/${hits.length} indiriliyor… ${(g / 1e6).toFixed(1)}${tot ? ' / ' + (tot / 1e6).toFixed(1) : ''} MB`) });
    const id = 'stock:' + h.px + ':' + rend.key;
    await putFile({ id, kind: 'stock', name: id, type: 'video/mp4', blob, order: Date.now() });
    if (await loadVideo(id)) vids.push({ id, px: h.px, dur: h.dur, w: rend.w, h: rend.h, thumb, page: h.page, user: h.user, tags: h.tags, q: h.q });
  }
  const keep = new Set(vids.map(v => v.id));
  for (const old of it.vids || []) if (!keep.has(old.id) && !items.some((o, j) => j !== i && (o.vids || []).some(x => x.id === old.id))) { delFile(old.id); const v = film.videos.get(old.id); if (v) { URL.revokeObjectURL(v.src); film.videos.delete(old.id); } }
  it.vids = vids; save();
  return vids.length;
}
async function findStock(only = null) {
  if (!F.pxKey.trim()) { $('#stockStatus').textContent = 'Önce Pixabay anahtarınızı girin.'; $('#pxKey').focus(); return; }
  stockAbort = new AbortController(); $('#findStock').disabled = true; $('#stockStop').disabled = false;
  const list = only != null ? [only] : items.map((it, i) => ((it.vids || []).some(x => film.videos.has(x.id)) ? -1 : i)).filter(i => i >= 0);
  const exclude = new Set(items.flatMap((it, j) => (only != null && j === only) ? [] : (it.vids || []).map(x => x.px)));
  if (only != null) for (const x of items[only].vids || []) exclude.add(x.px); // ↻: farklı çekimler gelsin
  const t0 = performance.now(); let got = 0;
  try {
    if (!F.stockOn) { F.stockOn = true; syncUI(); }
    if (only == null && !['gercek', 'sinematik', 'noir', 'gece'].includes(F.style)) { F.style = 'gercek'; syncUI(); toast('Stil "Gerçek çekim" yapıldı (Yönetmen sekmesinden değiştirebilirsiniz)'); }
    for (const i of list) { got += await fetchStockFor(i, exclude); renderStockGrid(); rebuild(); }
    $('#stockStatus').textContent = list.length ? `${got} çekim hazır · ${((performance.now() - t0) / 1000).toFixed(0)} sn` : 'Bütün metinlerin çekimi var. Değiştirmek için ↻ düğmesini kullanın.';
  } catch (e) { $('#stockStatus').textContent = e.name === 'AbortError' ? 'Durduruldu' : '✗ ' + e.message; }
  save(); rebuild(); renderStockGrid();
  $('#findStock').disabled = false; $('#stockStop').disabled = true; stockAbort = null;
}
$('#findStock').onclick = () => findStock();
$('#stockStop').onclick = () => stockAbort && stockAbort.abort();
$('#pxTest').onclick = async () => {
  if (!F.pxKey.trim()) { $('#pxStatus').textContent = 'Anahtar boş'; return; }
  $('#pxStatus').textContent = 'Deneniyor…';
  try { await pixabayTest(F.pxKey.trim()); $('#pxStatus').textContent = '✓ Anahtar çalışıyor'; } catch (e) { $('#pxStatus').textContent = '✗ ' + e.message; }
};
$('#stockGrid').addEventListener('click', e => { const b = e.target.closest('[data-si]'); if (b && !stockAbort) findStock(+b.dataset.si); });
$('#stockGrid').addEventListener('change', e => { const q = e.target.closest('[data-sq]'); if (q) { items[+q.dataset.sq].stockQ = q.value.trim(); save(); } });

/* ================= Genel ================= */
function switchTab(n) { $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === n)); $$('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === n)); }
$('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); };
async function ensureFonts() {
  const fam = s => s.split(',')[0].trim();
  try { await Promise.race([Promise.all([`700 40px ${fam(F.latinFont)}`, `800 40px ${fam(F.latinFont)}`, `700 40px ${F.arabicFont}`, `400 40px ${F.arabicFont}`, '700 40px Amiri', '500 40px Lora', 'italic 500 40px Lora', '600 30px Inter'].map(f => document.fonts.load(f, 'Ağış بسم ٱلۡ'))), new Promise(r => setTimeout(r, 5000))]); } catch (e) { }
}
window.addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); $('#play').click(); } });

window.filmDebug = { tl: () => tl, film, items: () => items, rebuild: () => rebuild(), renderStockGrid: () => renderStockGrid(), loadVideo: id => loadVideo(id), audioOpts: () => audioOpts(tl), mix: async () => { const a = await mixTimeline(tl.dur, audioOpts(tl)); const d = a.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i += 100) pk = Math.max(pk, Math.abs(d[i])); return { dur: a.duration, peak: pk }; } };
(async function init() {
  resizePreview(); syncUI(); renderList(); loadEditor(); renderRef(); fitCanvas();
  await ensureFonts();
  for (const r of await allFiles()) if (r.kind === 'music') await addMusic(r.blob, r.name, r.id, false);
  renderMusic();
  for (const it of items) if (it.imgId) await loadImage(it.imgId);
  for (const it of items) for (const v of it.vids || []) await loadVideo(v.id);
  rebuild(false); syncUI(); renderPlan(); renderImgGrid(); renderStockGrid(); updateAiAudioStatus();
  // motorlar programla birlikte açılıyorsa birkaç dakika boyunca sessizce yeniden dene
  (async () => { let a = false, b = false; for (let i = 0; i < 25 && !(a && b); i++) { if (i) await new Promise(r => setTimeout(r, 5000)); if (!a) a = await olConnect(true); if (!b) b = await cfConnect(true); } })();
  $('#loading').classList.add('hide');
  requestAnimationFrame(loop);
})();
