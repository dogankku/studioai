// Film Stüdyosu: arayüz
import { Film } from './film/player.js?v=202611221639';
import { direct, clipsOf } from './film/director.js?v=202611221639';
import { STYLES, EFFECTS, SCENES, CAMERAS, TEXT_ANIMS, TRANSITIONS, FX_DEFAULT, GRADE_DEFAULT } from './film/styles.js?v=202611221639';
import { analyzeAudio, analyzeVideo } from './film/analyze.js?v=202611221639';
import { makeItem, plainItem } from './parser.js?v=202611221639';
import { FORMATS, toScenes, aiScenes } from './formats.js?v=202611221639';
import { wordTimes, chunkWords, CAP_STYLES } from './captions.js?v=202611221639';
import { SFX, sfxBuffer, sfxCues, BEDS, bedBuffer } from './sfx.js?v=202611221639';
import { freesoundSearch, freesoundTest, freesoundFetch } from './ai/freesound.js?v=202611221639';
import { putFile, delFile, allFiles, getFile } from './storage.js?v=202611221639';
import { decodeBlob, mixFor, playPreview, stopPreview, live, mixTimeline, playTimeline, stopTimeline } from './audio.js?v=202611221639';
import { encodeFast, encodeRealtime, hasFast } from './encoder.js?v=202611221639';
import { dims, isMostlyRTL, wordsOf } from './renderer.js?v=202611221639';
import { newId } from './parser.js?v=202611221639';
import { ollamaModels, comfyCheckpoints, comfyGenerate } from './ai/local.js?v=202611221639';
import { VOICES, speak, downloadVoice, voiceReady } from './ai/voice.js?v=202611221639';
import { findClips, downloadClip, pixabayTest, queriesFor, pixabaySearch, rankHits, langOf, thumbOf } from './ai/stock.js?v=202611221639';
import { detectScene } from './film/director.js?v=202611221639';

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
  style: 'modern', seed: 1, pace: 1, mode: 'film', fmt: 'bilgi', soundtrack: 'bed:kurumsal', capOn: true, capMode: 'pop', capHideSub: true, ttsSpeed: 1, ttsPitch: 1, ttsPause: 0.15, sfxOn: true, sfxVol: 0.7, sfxOff: {}, fsKey: '', fsCC0: false, respectKeywords: true, beatSync: true,
  platforms: ['reels'], previewPlatform: 'reels', durMode: 'auto', targetDur: 60, showSafe: false, fps: '30', quality: '1',
  fxOv: {}, gradeOv: {}, colors: {}, latinFont: '"Playfair Display", serif', arabicFont: 'Amiri', size: 1,
  soundtrack: '', musicVol: 0.8, fadeIn: true, fadeOut: true,
  refUseCuts: true, refUseEnergy: true, refUseColors: false, refUseAudio: false,
  olUrl: 'http://localhost:11434', olModel: '', cfUrl: 'http://127.0.0.1:8188', cfCkpt: '',
  ttsOn: true, voice: 'tr_TR-dfki-medium', imgOn: true, stockOn: true, pxKey: '', stockNoPeople: true, stockN: '3', stockMode: 'flow', flowXF: 1.2, flowMax: 6, flowMatch: true
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
const SAMPLE_BRIEF = { title: 'Uyku neden bu kadar önemli?', text: 'Uyku, beynin kendini temizlediği zamandır. Gün boyu biriken atıklar uykuda atılır.\n\nYetişkinlerin gecede 7–9 saat uykuya ihtiyacı vardır.\n\nUykusuzluk dikkat, hafıza ve bağışıklığı zayıflatır.', brand: '', author: '', cta: '', countdown: false, logoId: '' };
let brief = { ...SAMPLE_BRIEF, ...store.get('film-brief', {}) };
const KIT_DEFAULT = { on: false, accent: '#ffd84a', text: '#ffffff', sub: '#e9edf3', font: '', intro: false, introText: '', outro: false, outroText: '', mark: false, markPos: 'sag-ust' };
let kit = { ...KIT_DEFAULT, ...store.get('vs-kit', {}) };
const SAMPLE = toScenes('bilgi', SAMPLE_BRIEF);
let F = { ...DEFAULTS, ...store.get('film-settings', {}) };
if (!F.v2) { F.v2 = true; F.latinFont = ''; F.respectKeywords = false; if (!F.soundtrack || F.soundtrack === 'none') F.soundtrack = 'bed:kurumsal'; if (!['modern', 'neonliste', 'marka', 'gercek'].includes(F.style)) F.style = 'modern'; F.ttsOn = true; }
if (!F.v3) { F.v3 = true; F.respectKeywords = false; }
if (!Array.isArray(F.platforms) || !F.platforms.length) F.platforms = ['reels'];
F.platforms = F.platforms.filter(k => PLATFORMS[k]); if (!F.platforms.length) F.platforms = ['reels'];
if (!PLATFORMS[F.previewPlatform]) F.previewPlatform = F.platforms[0];
let items = (store.get('vs-items', null) || SAMPLE).map(makeItem);
let flow = (store.get('film-flow', null) || []).filter(v => v && v.id);
let overrides = store.get('film-overrides', {});
let ref = store.get('film-ref', null); // {name, analysis(without audio)}
let refAudio = null; // AudioBuffer (yalnızca bu oturumda)
let sel = 0, selShot = -1;
const music = []; // {id, name, buffer, blob, an}
let saveT = 0;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { store.set('film-settings', F); store.set('vs-items', items.map(plainItem)); store.set('film-brief', brief); store.set('vs-kit', kit); store.set('film-overrides', overrides); store.set('film-flow', flow); }, 300); };

/* ================= Film motoru ================= */
const cv = $('#cv');
const previewDims = () => dims(PV().format, Math.min(PV().res, 720));
let [PW, PH] = previewDims();
cv.width = PW; cv.height = PH;
const film = new Film(cv, PW, PH);
let tl = { shots: [], dur: 0 };

function soundtrack() {
  if (F.refUseAudio && refAudio) return { name: 'Referans videonun sesi', buffer: refAudio, an: ref && ref.analysis.audio };
  if (!F.soundtrack || F.soundtrack === 'none') return null;
  return music.find(m => m.id === F.soundtrack) || null;
}
function directOpts() {
  const st = soundtrack();
  const beats = F.beatSync && st && st.an ? st.an.beats : null;
  let template = null;
  if (ref && F.refUseCuts) template = { shots: ref.analysis.shots.map(s => ({ dur: s.dur, energy: F.refUseEnergy ? s.energy : null })) };
  if (template && !F.refUseEnergy) template.shots.forEach(s => delete s.energy);
  return { style: F.style, seed: F.seed, pace: F.pace, respectKeywords: F.respectKeywords, beats, template, targetDur: F.durMode === 'target' ? +F.targetDur : 0 };
}
/* yapay zekâ sesleri ve görselleri: öğe kimliğine göre önbellek */
const narrCache = new Map(), ownVoice = new Map();
const ttsCfg = () => `${F.voice}|${(+F.ttsSpeed).toFixed(2)}|${(+F.ttsPitch).toFixed(2)}|${(+F.ttsPause).toFixed(2)}`;
/** sahnenin geçerli seslendirmesi: kendi kaydınız > yapay ses (metin ve ayarlar değişmediyse) */
function narrOf(it) {
  const o = ownVoice.get(it.id); if (o) return o;
  const n = narrCache.get(it.id); return n && n.buf && n.text === voText(it) && n.cfg === ttsCfg() ? n : null;
}
const credits = () => store.get('vs-credits', {});
const voText = it => (it.kind === 'intro' || it.kind === 'outro') ? '' : (it.vo || [it.main, it.sub].filter(Boolean).join('. ')).trim();
const INTRO = { id: '__intro', kind: 'intro', main: '', logo: true }, OUTRO = { id: '__outro', kind: 'outro', main: '', logo: true };
function allItems() {
  if (!kit.on) return items;
  const a = [];
  if (kit.intro && (kit.introText || film.logo)) a.push({ ...INTRO, main: kit.introText || ' ', logo: !!film.logo });
  a.push(...items);
  if (kit.outro && (kit.outroText || film.logo)) a.push({ ...OUTRO, main: kit.outroText || ' ', logo: !!film.logo });
  return a;
}
function augItems() {
  return allItems().map(it => {
    const a = { ...it };
    const n = narrOf(it);
    if ((F.ttsOn || ownVoice.has(it.id)) && n) a._vo = { dur: n.buf.duration };
    if (it.imgId && film.images.has(it.imgId)) a._img = it.imgId;
    if (Array.isArray(it.vids)) {
      let v = it.vids.map(x => x.id).filter(id => film.videos.has(id));
      if (it.layout === 'gorsel') { const ci = v.findIndex(id => film.videos.get(id).tagName === 'IMG'); if (ci >= 0) { a._card = v[ci]; v.splice(ci, 1); } }
      if (F.stockOn && v.length) a._vids = v;
    }
    if (it.sceneHint) a._scene = it.sceneHint;
    return a;
  });
}
function captionChunks(timeline) {
  const out = [];
  for (const c of timeline.clips || []) {
    const [kind, idx] = c.key.split(':'); if (kind !== 'vo') continue; const it = allItems()[+idx]; if (!it) continue;
    const n = narrOf(it); if (!n) continue;
    if (!n.words) n.words = wordTimes(n.text, n.buf);
    out.push(...chunkWords(n.words.map(w => ({ w: w.w, s: w.s + c.start, e: w.e + c.start }))));
  }
  return out;
}
function clipBuffers(timeline) {
  const out = [];
  for (const c of timeline.clips || clipsOf(timeline.shots)) {
    const [kind, idx] = c.key.split(':'); const it = allItems()[+idx]; if (!it) continue;
    let b = null;
    if (kind === 'vo') { const n = narrOf(it); b = n && n.buf; }
    if (b) out.push({ start: c.start, buffer: b, gain: 1.6 });
  }
  return out;
}
const sfxBufs = new Map(); // tür -> AudioBuffer (gömülü ya da Freesound'dan seçilmiş)
function sfxClips(timeline) {
  if (!F.sfxOn) return [];
  return sfxCues(timeline.shots, { enabled: Object.fromEntries(Object.keys(SFX).map(k => [k, !F.sfxOff[k]])) })
    .map(c => ({ start: c.t, buffer: sfxBufs.get(c.kind), gain: c.gain * +F.sfxVol * 1.4, noDuck: true })).filter(c => c.buffer);
}
function audioOpts(timeline) { const st = soundtrack(); return { clips: [...clipBuffers(timeline), ...sfxClips(timeline)], music: st ? st.buffer : null, musicVol: +F.musicVol, fadeIn: F.fadeIn, fadeOut: F.fadeOut, duck: 0.28 }; }

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
  const stl = STYLES[F.style] || {};
  film.fonts = { latin: F.latinFont || (kit.on && kit.font ? kit.font : '') || (stl.font ? `${stl.font}, sans-serif` : '"Playfair Display", serif'), ar: F.arabicFont, sub: stl.subFont || 'Lora, serif' };
  film.size = +F.size;
  film.safe = PV().safe;
  film.setStyle(F.style, { grade: { ...(ref && F.refUseColors ? ref.analysis.grade : {}), ...F.gradeOv }, fx: F.fxOv, colors: kit.on ? { text: kit.text, accent: kit.accent, sub: kit.sub, ...F.colors } : F.colors });
  film.watermark = kit.on && kit.mark ? film.logo : null; film.markPos = kit.markPos;
  film.flow = { ids: flowIds(), xf: +F.flowXF, maxLen: +F.flowMax, match: !!F.flowMatch };
  tl = applyOverrides(direct(augItems(), { ...directOpts(), aiImages: F.imgOn, stock: F.stockOn, flow: flowIds(), capHideSub: F.capOn && F.ttsOn && F.capHideSub }));
  tl.clips = clipsOf(tl.shots);
  film.capOn = F.capOn && F.ttsOn; film.capMode = F.capMode; film.caps.chunks = film.capOn ? captionChunks(tl) : [];
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
const FIELDS = ['pace', 'mode', 'respectKeywords', 'beatSync', 'durMode', 'targetDur', 'showSafe', 'fps', 'quality', 'latinFont', 'arabicFont', 'size', 'musicVol', 'fadeIn', 'fadeOut', 'refUseCuts', 'refUseEnergy', 'refUseColors', 'refUseAudio', 'olUrl', 'olModel', 'cfUrl', 'cfCkpt', 'ttsOn', 'voice', 'imgOn', 'stockOn', 'pxKey', 'stockNoPeople', 'stockN', 'stockMode', 'flowXF', 'flowMax', 'flowMatch', 'sfxOn', 'sfxVol', 'fsKey', 'fsCC0', 'capOn', 'capMode', 'capHideSub', 'ttsSpeed', 'ttsPitch', 'ttsPause'];
for (const k of FIELDS) {
  const el = document.getElementById(k); if (!el) continue;
  el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
    F[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
    if (['olUrl', 'olModel', 'cfUrl', 'cfCkpt', 'pxKey', 'stockNoPeople', 'stockN', 'fsKey', 'fsCC0'].includes(k)) { save(); return; }
    if (['sfxOn', 'sfxVol'].includes(k)) { save(); return; }
    if (['stockOn', 'stockMode', 'flowXF', 'flowMax', 'flowMatch'].includes(k)) { save(); rebuild(); renderStockGrid(); return; }
    if (['ttsOn', 'voice', 'capOn', 'capMode', 'capHideSub', 'ttsSpeed', 'ttsPitch', 'ttsPause'].includes(k)) { save(); rebuild(); updateAiAudioStatus(); $$('output[data-for]').forEach(fmtOut); return; }
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
const KIND_NAMES = { hook: 'Giriş', point: 'Bilgi', item: 'Madde', quote: 'Söz', problem: 'Sorun', solution: 'Çözüm', feature: 'Özellik', price: 'Fiyat', cta: 'Kapanış' };
function renderList() {
  $('#count').textContent = `(${items.length})`;
  $('#itemList').innerHTML = items.length ? items.map((it, i) => {
    const ar = isMostlyRTL(it.main);
    return `<div class="it${i === sel ? ' on' : ''}" data-i="${i}"><div class="no">${esc(it.num && it.num.length <= 2 ? it.num : String(i + 1))}</div><div class="tx${ar ? ' ar' : ''}"><span class="kind">${esc(KIND_NAMES[it.kind] || '')}</span>${esc((it.main || it.sub).split('\n')[0])}${it.sub ? `<small>${esc(it.sub.slice(0, 80))}</small>` : ''}</div>
      <div class="acts"><button data-a="up">↑</button><button data-a="down">↓</button><button data-a="del">✕</button></div></div>`;
  }).join('') : '<div class="empty">Henüz sahne yok. Yukarıda metninizi yazıp "Sahnelere dönüştür"e basın.</div>';
}
$('#itemList').onclick = e => {
  const row = e.target.closest('.it'); if (!row) return;
  const i = +row.dataset.i, a = e.target.closest('[data-a]')?.dataset.a;
  if (a === 'up' && i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; sel = i - 1; }
  else if (a === 'down' && i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; sel = i + 1; }
  else if (a === 'del') { items.splice(i, 1); sel = Math.max(0, Math.min(sel, items.length - 1)); }
  else sel = i;
  listChanged();
  const off = allItems()[0] && allItems()[0].kind === 'intro' ? 1 : 0; const s = tl.shots.find(x => x.item === sel + off); if (s) { curT = s.start + 0.3; selShot = s.i; updateTime(); renderTimeline(); updateInspector(); dirty = true; }
};
function loadEditor() {
  const it = items[sel]; $('#editor').style.display = it ? '' : 'none'; if (!it) return;
  $('#editNo').textContent = '#' + (sel + 1);
  $('#eMain').value = it.main; $('#eSub').value = it.sub; $('#eSrc').value = it.src; $('#eTag').value = it.tag;
  $('#eKind').value = it.kind || 'point'; $('#eLayout').value = it.layout || ''; $('#eNum').value = it.num || ''; $('#eCta').value = it.cta || ''; $('#eVo').value = it.vo || ''; $('#eQ').value = it.stockQ || '';
  $('#eVo').placeholder = [it.main, it.sub].filter(Boolean).join('. ');
  renderRecUI();
  ['eMain', 'eSub'].forEach(id => $('#' + id).classList.toggle('rtl', isMostlyRTL($('#' + id).value)));
}
let editT = 0;
[['eMain', 'main'], ['eSub', 'sub'], ['eSrc', 'src'], ['eTag', 'tag'], ['eNum', 'num'], ['eCta', 'cta'], ['eVo', 'vo'], ['eQ', 'stockQ'], ['eKind', 'kind'], ['eLayout', 'layout']].forEach(([id, k]) => $('#' + id).addEventListener('input', e => {
  const it = items[sel]; if (!it) return; it[k] = e.target.value;
  ['eMain', 'eSub'].forEach(x => $('#' + x).classList.toggle('rtl', isMostlyRTL($('#' + x).value)));
  save(); clearTimeout(editT); editT = setTimeout(() => { renderList(); rebuild(); }, 350);
}));
/* kendi sesini kaydetme (sahne başına) */
let recState = null;
async function loadOwnVoices() { for (const r of await allFiles()) if (r.kind === 'myvoice' && r.item) { try { ownVoice.set(r.item, { buf: await decodeBlob(r.blob), own: true }); } catch (e) { } } }
function renderRecUI() { const it = items[sel]; if (!it) return; const has = ownVoice.has(it.id); $('#eRec').textContent = recState ? '■ Durdur' : (has ? '🎙 Yeniden kaydet' : '🎙 Kendi sesimle kaydet'); $('#eRecPlay').style.display = has && !recState ? '' : 'none'; $('#eRecDel').style.display = has && !recState ? '' : 'none'; $('#eRecInfo').textContent = recState ? 'Kayıt sürüyor… sahnenin metnini okuyun' : has ? `Kendi kaydınız kullanılıyor (${ownVoice.get(it.id).buf.duration.toFixed(1)} sn)` : ''; }
$('#eRec').onclick = async () => {
  const it = items[sel]; if (!it) return;
  if (recState) { recState.rec.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const rec = new MediaRecorder(stream); const parts = [];
    rec.ondataavailable = e => e.data.size && parts.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop()); recState = null;
      const blob = new Blob(parts, { type: rec.mimeType || 'audio/webm' });
      try {
        let buf = await decodeBlob(blob);
        buf = trimSilence(buf);
        for (const r of await allFiles()) if (r.kind === 'myvoice' && r.item === it.id) delFile(r.id);
        await putFile({ id: 'myvoice:' + it.id + ':' + newId(), kind: 'myvoice', item: it.id, name: 'kayıt', type: blob.type, blob, order: Date.now() });
        ownVoice.set(it.id, { buf, own: true }); rebuild(); updateAiAudioStatus();
      } catch (e) { toast('Kayıt okunamadı'); }
      renderRecUI();
    };
    rec.start(); recState = { rec }; renderRecUI();
  } catch (e) { toast('Mikrofona erişilemedi: tarayıcı izin vermedi'); }
};
function trimSilence(buf) {
  const d = buf.getChannelData(0), sr = buf.sampleRate, thr = 0.02; let a = 0, b = d.length - 1;
  while (a < d.length && Math.abs(d[a]) < thr) a++; while (b > a && Math.abs(d[b]) < thr) b--;
  a = Math.max(0, a - Math.round(sr * 0.08)); b = Math.min(d.length - 1, b + Math.round(sr * 0.15));
  const out = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: Math.max(1, b - a), sampleRate: sr });
  for (let c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(a, b));
  return out;
}
$('#eRecPlay').onclick = () => { const o = ownVoice.get((items[sel] || {}).id); if (o) audition(o.buf, 60); };
$('#eRecDel').onclick = async () => { const it = items[sel]; if (!it) return; for (const r of await allFiles()) if (r.kind === 'myvoice' && r.item === it.id) delFile(r.id); ownVoice.delete(it.id); rebuild(); updateAiAudioStatus(); renderRecUI(); };
function listChanged() { save(); renderList(); loadEditor(); rebuild(); renderImgGrid(); updateAiAudioStatus(); }
$('#addItem').onclick = () => { items.splice(sel + 1, 0, makeItem({ kind: 'point', main: 'Yeni sahne' })); sel = Math.min(sel + 1, items.length - 1); listChanged(); $('#eMain').focus(); $('#eMain').select(); };
$('#clearList').onclick = () => { if (!items.length) return; if (!confirm('Tüm liste silinsin mi?')) return; items = []; sel = 0; listChanged(); };
/* ================= Marka kiti ================= */
function syncKit() {
  $('#kitOn').checked = kit.on; $('#kitAccent').value = kit.accent; $('#kitText').value = kit.text; $('#kitSub').value = kit.sub; $('#kitFont').value = kit.font;
  $('#kitIntro').checked = kit.intro; $('#kitIntroText').value = kit.introText; $('#kitOutro').checked = kit.outro; $('#kitOutroText').value = kit.outroText; $('#kitMark').checked = kit.mark; $('#kitMarkPos').value = kit.markPos;
  $('#kitBody').style.opacity = kit.on ? 1 : 0.55;
}
[['kitOn', 'on', 'c'], ['kitAccent', 'accent'], ['kitText', 'text'], ['kitSub', 'sub'], ['kitFont', 'font'], ['kitIntro', 'intro', 'c'], ['kitIntroText', 'introText'], ['kitOutro', 'outro', 'c'], ['kitOutroText', 'outroText'], ['kitMark', 'mark', 'c'], ['kitMarkPos', 'markPos']].forEach(([id, k, c]) => {
  const el = $('#' + id); el.addEventListener(c || el.tagName === 'SELECT' || el.type === 'color' ? 'change' : 'input', () => { kit[k] = c ? el.checked : el.value; save(); syncKit(); clearTimeout(editT); editT = setTimeout(() => { if (k === 'font') ensureFonts().then(rebuild); else rebuild(); }, 250); });
});

/* ================= Senaryo: format + bilgiler ================= */
function renderFormats() {
  $('#fmts').innerHTML = Object.entries(FORMATS).map(([k, f]) => `<button class="fmt${F.fmt === k ? ' on' : ''}" data-f="${k}"><i>${f.icon}</i><b>${esc(f.name)}</b><span>${esc(f.desc)}</span></button>`).join('');
  const f = FORMATS[F.fmt] || FORMATS.bilgi;
  $('#bTitleLbl').textContent = f.titleLabel; $('#bText').placeholder = f.placeholder;
  $('#bCta').placeholder = f.ctaDefault || 'ör. Takip et';
  $('#bBrandBox').style.display = F.fmt === 'urun' ? '' : 'none';
  $('#bAuthorBox').style.display = F.fmt === 'soz' ? '' : 'none';
  $('#bCtaBox').style.display = F.fmt === 'soz' ? 'none' : '';
  $('#bLogoBox').style.display = '';
  $('#bCountBox').style.display = F.fmt === 'liste' ? '' : 'none';
  $('#bRowB').style.display = '';
}
function syncBrief() {
  $('#bTitle').value = brief.title || ''; $('#bText').value = brief.text || ''; $('#bBrand').value = brief.brand || ''; $('#bAuthor').value = brief.author || ''; $('#bCta').value = brief.cta || ''; $('#bCountdown').checked = !!brief.countdown;
  const img = film.logo; $('#bLogoPrev').style.display = img ? 'inline-block' : 'none'; $('#bLogoDel').style.display = img ? '' : 'none'; if (img) $('#bLogoPrev').src = img.src;
}
$('#fmts').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; F.fmt = b.dataset.f; save(); renderFormats(); };
[['bTitle', 'title'], ['bText', 'text'], ['bBrand', 'brand'], ['bAuthor', 'author'], ['bCta', 'cta']].forEach(([id, k]) => $('#' + id).addEventListener('input', e => { brief[k] = e.target.value; save(); }));
$('#bCountdown').onchange = e => { brief.countdown = e.target.checked; save(); };
async function loadLogo() {
  film.logo = null; if (!brief.logoId) return;
  const r = await getFile(brief.logoId); if (!r) return;
  const img = new Image(); img.src = URL.createObjectURL(r.blob); try { await img.decode(); film.logo = img; } catch (e) { }
}
$('#bLogo').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (brief.logoId) delFile(brief.logoId);
  brief.logoId = 'logo:' + newId(); await putFile({ id: brief.logoId, kind: 'logo', name: f.name, type: f.type, blob: f, order: Date.now() });
  await loadLogo(); save(); syncBrief(); film.clearTexts(); dirty = true;
};
$('#bLogoDel').onclick = () => { if (brief.logoId) delFile(brief.logoId); brief.logoId = ''; film.logo = null; save(); syncBrief(); film.clearTexts(); dirty = true; };
function applyScenes(scenes, label) {
  items = scenes.map(sc => makeItem({ ...sc, stockQ: sc.q || '' })); sel = 0;
  const f = FORMATS[F.fmt]; if (f && f.style && STYLES[f.style]) F.style = f.style;
  F.seed = (F.seed % 9999) + 1; overrides = {};
  listChanged(); syncUI(); toast(label);
}
$('#bMake').onclick = () => {
  if (!(brief.text || '').trim() && !(brief.title || '').trim()) { toast('Önce metninizi yazın'); $('#bText').focus(); return; }
  const sc = toScenes(F.fmt, brief); if (!sc.length) { toast('Metinden sahne çıkarılamadı'); return; }
  applyScenes(sc, `${sc.length} sahne hazır`);
  $('#bStatus').textContent = `${sc.length} sahne oluşturuldu. Aşağıdan düzenleyebilir, sırasını değiştirebilirsiniz.${F.ttsOn ? ' Seslendirme video üretilirken hazırlanır.' : ''}`;
};
let bAbort = null;
$('#bAI').onclick = async () => {
  if (!(brief.text || '').trim() && !(brief.title || '').trim()) { toast('Önce metninizi ya da konuyu yazın'); return; }
  if (!F.olModel && !(await olConnect(false))) { $('#bStatus').textContent = '✗ Ollama\'ya bağlanılamadı. "Yapay zekâ" sekmesindeki rehbere bakın; ya da "Sahnelere dönüştür"ü kullanın.'; return; }
  bAbort = new AbortController(); $('#bAI').disabled = true; $('#bAIStop').disabled = false; const t0 = performance.now();
  try {
    const r = await aiScenes(F.fmt, brief, { url: F.olUrl, model: F.olModel, signal: bAbort.signal, onStatus: m => ($('#bStatus').textContent = m) });
    applyScenes(r.scenes, `${r.scenes.length} sahne yazıldı`);
    if (r.share) { $('#shareText').value = r.share; $('#shareBox').style.display = ''; store.set('vs-share', r.share); }
    $('#bStatus').textContent = `Senaryo hazır (${((performance.now() - t0) / 1000).toFixed(0)} sn): ${r.scenes.length} sahne. Kontrol edip düzenleyebilirsiniz.`;
  } catch (e) { $('#bStatus').textContent = e.name === 'AbortError' ? 'Durduruldu' : '✗ ' + e.message; }
  $('#bAI').disabled = false; $('#bAIStop').disabled = true; bAbort = null;
};
$('#bAIStop').onclick = () => bAbort && bAbort.abort();
/* müzik ve çekimleri otomatik seç */
const MOOD = { bilgi: { bed: 'kurumsal', q: 'corporate upbeat background' }, liste: { bed: 'enerjik', q: 'upbeat energetic background' }, soz: { bed: 'sinematik', q: 'cinematic ambient piano' }, urun: { bed: 'kurumsal', q: 'happy corporate commercial' } };
async function autoMusic(status) {
  const m = MOOD[F.fmt] || MOOD.bilgi;
  if (F.fsKey.trim()) {
    try {
      status('Freesound\'da müzik aranıyor…');
      const need = Math.max(20, tl.dur * 0.6);
      const hits = (await freesoundSearch(F.fsKey.trim(), m.q, { type: 'music', cc0: F.fsCC0 })).filter(h => h.dur >= need).sort((a, b) => b.downloads - a.downloads);
      const h = hits[0];
      if (h) {
        status(`Müzik indiriliyor: ${h.name}`);
        const blob = await freesoundFetch(h); const id = 'fs:' + h.id;
        if (!music.some(x => x.id === id)) await addMusic(blob, `${h.name} (Freesound, ${h.user})`, id);
        F.soundtrack = id; if (h.license !== 'CC0') { const c = credits(); c[id] = `"${h.name}" by ${h.user} (freesound.org/s/${h.id}), CC BY`; store.set('vs-credits', c); }
        renderMusic(); return h.name;
      }
    } catch (e) { console.warn(e); }
  }
  await ensureBed(m.bed); F.soundtrack = 'bed:' + m.bed; renderMusic(); return BEDS[m.bed].name;
}
async function autoFootage(status) {
  if (!F.pxKey.trim()) return 0;
  const [W, H] = outDims(); const exclude = new Set(flow.map(v => v.px)); let got = 0;
  stockAbort = new AbortController();
  try {
    for (const [i, it] of items.entries()) {
      if (it.kind === 'cta' && i > 0) continue;
      status(`Çekim aranıyor ${i + 1}/${items.length}…`);
      const hits = await findClips(F.pxKey.trim(), it, itemScene(it), { n: 1, portrait: H > W, noPeople: F.stockNoPeople, exclude, signal: stockAbort.signal });
      for (const h of hits) { const v = await saveHit(h, W, H, stockAbort.signal, (g, tot) => status(`Çekim ${i + 1}/${items.length} indiriliyor… ${mb(g, tot)}`)); if (v) { flow.push(v); got++; save(); } }
    }
  } finally { stockAbort = null; }
  if (got) { F.stockOn = true; F.stockMode = 'flow'; }
  return got;
}
$('#bAuto').onclick = async () => {
  if (!items.length) { toast('Önce sahneleri oluşturun'); return; }
  $('#bAuto').disabled = true; const st = m => ($('#bStatus').textContent = m);
  try {
    const mus = await autoMusic(st);
    let n = 0; if (F.pxKey.trim()) { if (flow.length && !confirm('Mevcut çekim akışı temizlenip yeni çekimler seçilsin mi? (İptal: mevcutların sonuna eklenir)')) { } else { const old = flow; flow = []; old.forEach(flowRemoveFiles); } n = await autoFootage(st); }
    syncUI(); save(); rebuild(); renderStockGrid(); changed();
    st(`Müzik: ${mus}.${F.pxKey.trim() ? ` ${n} çekim akışa eklendi.` : ' Çekim için "Yapay zekâ" sekmesine Pixabay anahtarı girin.'}${F.fsKey.trim() ? '' : ' (Freesound anahtarı girilirse gerçek müzik aranır.)'}`);
  } catch (e) { st('✗ ' + e.message); }
  $('#bAuto').disabled = false;
};
$('#shareCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#shareText').value); toast('Kopyalandı'); } catch (e) { $('#shareText').select(); } };

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
  const own = music.filter(m => !String(m.id).startsWith('bed:'));
  $('#musicList').innerHTML = own.map(m => `<div class="a"><span>${esc(m.name)}</span><span class="muted">${m.an ? m.an.bpm + ' BPM · ' : ''}${m.buffer.duration.toFixed(0)} sn <button data-id="${esc(m.id)}">✕</button></span></div>`).join('');
  $('#soundtrack').innerHTML = `<option value="none">— Müzik yok —</option><optgroup label="Hazır müzikler">${Object.entries(BEDS).map(([k, b]) => `<option value="bed:${k}">${esc(b.name)}</option>`).join('')}</optgroup>` +
    (own.length ? `<optgroup label="Eklenenler">${own.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</optgroup>` : '');
  $('#soundtrack').value = F.soundtrack || 'none';
  $('#bedBtns').innerHTML = Object.entries(BEDS).map(([k, b]) => `<button class="btn sm${F.soundtrack === 'bed:' + k ? ' primary' : ''}" data-bed="${k}">▶ ${esc(b.name)}</button>`).join('');
  $('#noMusicWarn').classList.toggle('show', !soundtrack() && !(F.refUseAudio && refAudio));
}
$('#musicList').onclick = e => { const b = e.target.closest('button[data-id]'); if (!b) return; const k = music.findIndex(m => m.id === b.dataset.id); if (k < 0) return; const [m] = music.splice(k, 1); delFile(m.id); if (F.soundtrack === m.id) F.soundtrack = 'none'; renderMusic(); changed(); };
$('#soundtrack').onchange = async e => { F.soundtrack = e.target.value; if (F.soundtrack.startsWith('bed:')) await ensureBed(F.soundtrack.slice(4)); renderMusic(); changed(); };
async function ensureBed(k) {
  const id = 'bed:' + k; if (music.some(m => m.id === id) || !BEDS[k]) return;
  const buffer = await bedBuffer(k); music.push({ id, name: BEDS[k].name, buffer, an: analyzeAudio(buffer) });
}
let auditionSrc = null;
function audition(buffer, max = 8) { try { if (auditionSrc) auditionSrc.stop(); } catch (e) { } const ctx = live(); const src = ctx.createBufferSource(); src.buffer = buffer; const g = ctx.createGain(); g.gain.value = 0.8; src.connect(g).connect(ctx.destination); src.start(); src.stop(ctx.currentTime + Math.min(max, buffer.duration)); auditionSrc = src; }
$('#bedBtns').onclick = async e => { const b = e.target.closest('[data-bed]'); if (!b) return; const k = b.dataset.bed; await ensureBed(k); F.soundtrack = 'bed:' + k; audition(music.find(m => m.id === 'bed:' + k).buffer, 10); renderMusic(); changed(); };
/* efektler */
async function loadSfx() {
  for (const k of Object.keys(SFX)) sfxBufs.set(k, await sfxBuffer(k));
  for (const r of await allFiles()) if (r.kind === 'sfx' && r.slot && SFX[r.slot]) { try { sfxBufs.set(r.slot, await decodeBlob(r.blob)); SFX_CUSTOM[r.slot] = r.name; } catch (e) { } }
  renderSfx();
}
const SFX_CUSTOM = {};
function renderSfx() {
  $('#sfxList').innerHTML = Object.entries(SFX).map(([k, x]) => `<span class="btn sm${F.sfxOff[k] ? ' ghost' : ''}" style="display:inline-flex;gap:6px;align-items:center"><label style="display:inline-flex;gap:4px;align-items:center;cursor:pointer"><input type="checkbox" data-sx="${k}" ${F.sfxOff[k] ? '' : 'checked'}>${esc(x.name)}${SFX_CUSTOM[k] ? ' ★' : ''}</label><button class="link" data-sp="${k}" title="Dinle">▶</button>${SFX_CUSTOM[k] ? `<button class="link" data-sr="${k}" title="Gömülü sese dön">↺</button>` : ''}</span>`).join('');
}
$('#sfxList').addEventListener('change', e => { const c = e.target.closest('[data-sx]'); if (!c) return; F.sfxOff[c.dataset.sx] = !c.checked; save(); renderSfx(); });
$('#sfxList').addEventListener('click', async e => {
  const p = e.target.closest('[data-sp]'); if (p) { const b = sfxBufs.get(p.dataset.sp); if (b) audition(b, 3); return; }
  const r = e.target.closest('[data-sr]'); if (r) { const k = r.dataset.sr; for (const f of await allFiles()) if (f.kind === 'sfx' && f.slot === k) delFile(f.id); delete SFX_CUSTOM[k]; sfxBufs.set(k, await sfxBuffer(k)); renderSfx(); }
});
/* Freesound */
let fsHits = [], fsAbort = null;
$('#fsTest').onclick = async () => { if (!F.fsKey.trim()) { $('#fsStatus').textContent = 'Anahtar boş'; return; } $('#fsStatus').textContent = 'Deneniyor…'; try { await freesoundTest(F.fsKey.trim()); $('#fsStatus').textContent = '✓ Anahtar çalışıyor'; } catch (e) { $('#fsStatus').textContent = '✗ ' + e.message; } };
async function fsSearch() {
  if (!F.fsKey.trim()) { $('#fsStatus').textContent = 'Önce Freesound anahtarınızı girin.'; $('#fsKey').focus(); return; }
  const q = $('#fsQ').value.trim() || ($('#fsType').value === 'music' ? 'background music calm' : 'whoosh'); $('#fsList').innerHTML = '<div class="muted">Aranıyor…</div>';
  try { fsHits = await freesoundSearch(F.fsKey.trim(), q, { type: $('#fsType').value, cc0: F.fsCC0 }); renderFs(); }
  catch (e) { $('#fsList').innerHTML = `<div class="muted">✗ ${esc(e.message)}</div>`; }
}
function renderFs() {
  const music = $('#fsType').value === 'music';
  $('#fsList').innerHTML = fsHits.length ? fsHits.map((h, i) => `<div class="fs-it"><button class="btn sm" data-fp="${i}">▶</button><div><div class="nm" title="${esc(h.name)}">${esc(h.name)}</div><div class="meta">${Math.round(h.dur)} sn · ${esc(h.license)} · ${esc(h.user)}</div></div>` +
    (music ? `<button class="btn sm primary" data-fu="${i}">Kullan</button>` : `<select data-fs="${i}"><option value="">Kullan…</option>${Object.entries(SFX).map(([k, x]) => `<option value="${k}">${esc(x.name)} yerine</option>`).join('')}</select>`) + '</div>').join('') : '<div class="muted">Sonuç yok. İngilizce kelimelerle deneyin.</div>';
}
let fsAudio = null;
$('#fsList').addEventListener('click', async e => {
  const p = e.target.closest('[data-fp]');
  if (p) { const h = fsHits[+p.dataset.fp]; if (fsAudio && !fsAudio.paused && fsAudio._i === +p.dataset.fp) { fsAudio.pause(); return; } if (fsAudio) fsAudio.pause(); fsAudio = new Audio(h.url); fsAudio._i = +p.dataset.fp; fsAudio.play().catch(() => { }); return; }
  const u = e.target.closest('[data-fu]');
  if (u) {
    const h = fsHits[+u.dataset.fu]; u.disabled = true; u.textContent = 'İndiriliyor…';
    try { const blob = await freesoundFetch(h); const id = 'fs:' + h.id; if (!music.some(m => m.id === id)) await addMusic(blob, `${h.name} (Freesound, ${h.user})`, id); F.soundtrack = id; if (h.license !== 'CC0') { const c = credits(); c[id] = `"${h.name}" by ${h.user} (freesound.org/s/${h.id}), CC BY`; store.set('vs-credits', c); } renderMusic(); changed(); u.textContent = '✓ Seçildi'; }
    catch (err) { u.textContent = '✗'; toast(err.message); }
  }
});
$('#fsList').addEventListener('change', async e => {
  const sl = e.target.closest('[data-fs]'); if (!sl || !sl.value) return; const h = fsHits[+sl.dataset.fs], slot = sl.value;
  try { const blob = await freesoundFetch(h); for (const f of await allFiles()) if (f.kind === 'sfx' && f.slot === slot) delFile(f.id); const id = 'sfx:' + slot + ':' + h.id; await putFile({ id, kind: 'sfx', slot, name: h.name, type: blob.type, blob, order: Date.now() }); sfxBufs.set(slot, await decodeBlob(blob)); SFX_CUSTOM[slot] = h.name; if (h.license !== 'CC0') { const c = credits(); c[id] = `"${h.name}" by ${h.user} (freesound.org/s/${h.id}), CC BY`; store.set('vs-credits', c); } renderSfx(); toast(`"${SFX[slot].name}" için Freesound sesi kullanılıyor`); }
  catch (err) { toast(err.message); }
  sl.value = '';
});
$('#fsGo').onclick = fsSearch;
$('#fsQ').addEventListener('keydown', e => { if (e.key === 'Enter') fsSearch(); });
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
    (hasFast() ? 'Hızlı mod (WebCodecs) açık.' : 'Gerçek zamanlı kayıt (Chrome/Edge önerilir).') + (Object.keys(credits()).length ? `<br><span class="muted">Açıklamaya ekleyin (CC BY): ${esc(Object.values(credits()).join('; '))}</span>` : '');
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
  const base = slug(batchName || brief.title || (items[0] && (items[0].main || items[0].tag)) || 'video') || 'video';
  if (F.mode === 'each') {
    items.forEach((it, i) => {
      const t1 = direct([augItems()[i]], { ...directOpts(), aiImages: F.imgOn, stock: F.stockOn, flow: flowIds() }); // her öğe kendi süresine göre kurgulanır
      t1.shots.forEach(s => { s.key = s.key.replace(/^0:/, i + ':'); });
      const t2 = applyOverrides(t1); t2.clips = clipsOf(t2.shots).map(c => ({ ...c, key: c.key.replace(/:0$/, ':' + i) }));
      jobs.push({ tl: t2, name: `${String(i + 1).padStart(2, '0')}-${slug(it.src || it.tag || 'video')}-${p.suffix}` });
    });
  } else jobs.push({ tl, name: `${base}-${p.suffix}` });
  return jobs;
}
async function renderAll() {
  if (busy || !tl.shots.length) return;
  if (!batchName) { const L = renderQC(); if (L.some(x => x.lv === 'err') && !confirm('Kalite kontrolünde önemli sorunlar var (Üretim sekmesinde listelendi). Yine de üretilsin mi?')) { switchTab('uretim'); return; } }
  stopPlayback(); cancelFlag = false; setBusy(true); switchTab('uretim');
  await ensureFonts();
  if (F.ttsOn) { $('#barTxt').textContent = 'Seslendirme hazırlanıyor…'; await prepareAudio(m => ($('#barTxt').textContent = m)); }
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
/* otomatik kalite kontrolü */
function qcIssues() {
  const out = []; const add = (lv, msg, fix, label) => out.push({ lv, msg, fix, label });
  const short = F.platforms.filter(k => ['shorts', 'reels'].includes(k));
  if (short.length && tl.dur > 180) add('err', `Video ${fmtDur(tl.dur)}; Shorts/Reels için 3 dakikayı geçmemeli.`, () => { F.durMode = 'target'; F.targetDur = 60; }, 'Süreyi 1 dk yap');
  else if (short.length && tl.dur > 90) add('warn', `Video ${fmtDur(tl.dur)}; Reels/Shorts'ta 15–60 sn arası daha çok izlenir.`, null);
  if (tl.dur < 5) add('warn', 'Video 5 saniyeden kısa.', null);
  if (!items.length) add('err', 'Hiç sahne yok.', null);
  const hasVoice = tl.clips && tl.clips.some(c => c.key.startsWith('vo:'));
  if (F.ttsOn && items.some(it => voText(it) && !narrOf(it))) add('info', 'Bazı sahnelerin seslendirmesi henüz hazırlanmadı (üretimde otomatik hazırlanır).', async () => { await prepareAudio(); }, 'Şimdi hazırla');
  if (!soundtrack() && !hasVoice && !F.ttsOn) add('warn', 'Videoda ne müzik ne seslendirme var; sessiz çıkar.', async () => { await ensureBed('kurumsal'); F.soundtrack = 'bed:kurumsal'; renderMusic(); }, 'Hazır müzik ekle');
  if (soundtrack() && (hasVoice || F.ttsOn) && +F.musicVol > 0.85) add('warn', 'Müzik seviyesi yüksek; seslendirme zor anlaşılabilir.', () => { F.musicVol = 0.6; }, 'Müziği %60 yap');
  items.forEach((it, i) => {
    const w = (it.main || '').split(/\s+/).filter(Boolean).length;
    if (it.kind && w > 10) add('warn', `Sahne ${i + 1}: başlık ${w} kelime; ekranda en çok 7–8 kelime okunaklıdır.`, () => { const ws = it.main.split(/\s+/); it.sub = (ws.slice(7).join(' ') + (it.sub ? ' ' + it.sub : '')).trim(); it.main = ws.slice(0, 7).join(' '); if (!it.vo) it.vo = [ws.join(' '), it.sub].join(' '); }, 'Başlığı kısalt');
    if ((it.sub || '').split(/\s+/).length > 28 && !(F.capOn && F.ttsOn && F.capHideSub)) add('warn', `Sahne ${i + 1}: açıklama uzun; ekranda okunmayabilir.`, null);
  });
  tl.shots.forEach((s, i) => { if (s.cont || s.clip) return; const n = s.lines.reduce((a, l) => a + (['main', 'sub'].includes(l.role) ? l.text.split(/\s+/).length : 0), 0); if (n && s.dur < 0.9 + n * 0.28) add('warn', `Çekim ${i + 1} çok hızlı (${s.dur.toFixed(1)} sn, ${n} kelime).`, () => { F.pace = Math.max(0.6, +F.pace - 0.15); }, 'Tempoyu yavaşlat'); });
  if (kit.on && (kit.mark || (kit.intro && !kit.introText) || (kit.outro && !kit.outroText)) && !film.logo) add('warn', 'Marka kitinde logo kullanılıyor ama logo yüklenmedi.', null);
  if (F.stockOn && F.stockMode === 'flow' && !flowIds().length && F.pxKey) add('info', 'Çekim akışı boş; arka planda 3D sahneler kullanılacak.', null);
  return out;
}
function renderQC() {
  const L = qcIssues();
  $('#qcList').innerHTML = L.length ? L.map((x, i) => `<div class="qc ${x.lv}"><span>${x.lv === 'err' ? '⛔' : x.lv === 'warn' ? '⚠️' : 'ℹ️'} ${esc(x.msg)}</span>${x.fix ? `<button class="btn sm" data-qf="${i}">${esc(x.label)}</button>` : ''}</div>`).join('') : '<div class="qc ok">✓ Sorun bulunmadı.</div>';
  $('#qcList')._L = L; return L;
}
$('#qcList').addEventListener('click', async e => { const b = e.target.closest('[data-qf]'); if (!b) return; const x = $('#qcList')._L[+b.dataset.qf]; if (!x || !x.fix) return; b.disabled = true; await x.fix(); save(); syncUI(); renderList(); loadEditor(); rebuild(); renderQC(); });
$('#qcBtn').onclick = () => renderQC();

/* altyazı dosyası (SRT) ve GIF */
const srtTime = t => { const ms = Math.max(0, Math.round(t * 1000)); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s2 = Math.floor(ms / 1000) % 60, r = ms % 1000; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')},${String(r).padStart(3, '0')}`; };
function buildSRT() {
  const cues = [];
  // seslendirme varsa: cümle parçaları (en çok ~7 kelime) seslendirme zamanlarıyla
  const words = [];
  for (const c of tl.clips || []) { const [kind, idx] = c.key.split(':'); if (kind !== 'vo') continue; const it = allItems()[+idx]; const n = it && narrOf(it); if (!n) continue; if (!n.words) n.words = wordTimes(n.text || voText(it), n.buf); words.push(n.words.map(w => ({ w: w.w, s: w.s + c.start, e: w.e + c.start }))); }
  if (words.length) for (const ws of words) for (const ch of chunkWords(ws, 7, 42)) cues.push([ch.s, ch.e + 0.15, ch.words.map(w => w.w).join(' ')]);
  else for (const s of tl.shots) { if (s.cont) continue; const txt = s.lines.filter(l => ['main', 'sub'].includes(l.role)).map(l => l.text).join('\n'); if (txt.trim()) cues.push([s.start + 0.2, s.start + s.dur - 0.1, txt]); }
  return cues.map((c, i) => `${i + 1}\n${srtTime(c[0])} --> ${srtTime(c[1])}\n${c[2]}\n`).join('\n');
}
$('#srtBtn').onclick = async () => {
  if (F.ttsOn) await prepareAudio(m => ($('#barTxt').textContent = m));
  rebuild(); const t = buildSRT(); if (!t) { toast('Altyazı çıkacak metin yok'); return; }
  const blob = new Blob(['\ufeff' + t], { type: 'text/plain;charset=utf-8' }); const name = `${slug(brief.title || 'video') || 'video'}.srt`;
  results.push({ name, blob, size: blob.size, plat: 'Altyazı dosyası (YouTube\'a yüklenebilir)', img: true, url: null }); renderResults(); switchTab('uretim'); toast('Altyazı dosyası hazır');
};
$('#gifBtn').onclick = async () => {
  if (busy || !tl.shots.length) return; stopPlayback(); setBusy(true); switchTab('uretim'); await ensureFonts();
  try {
    const { GIFEncoder, quantize, applyPalette } = await import('../vendor/gifenc.js?v=202611221556');
    const p = PV(); const [W0, H0] = dims(p.format, 1080); const k = 360 / Math.min(W0, H0), W = Math.round(W0 * k / 2) * 2, H = Math.round(H0 * k / 2) * 2;
    cv.width = W; cv.height = H; film.resize(W, H); film.safe = p.safe; rebuild();
    const fps = 12, dur = Math.min(+($('#gifDur').value) || 6, tl.dur), n = Math.round(dur * fps);
    const gif = GIFEncoder(); const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const g = tmp.getContext('2d', { willReadFrequently: true });
    for (let f = 0; f < n; f++) {
      const t = f / fps; await film.prepare(t); film.render(t); g.drawImage(cv, 0, 0);
      const data = g.getImageData(0, 0, W, H).data; const pal = quantize(data, 128); gif.writeFrame(applyPalette(data, pal), W, H, { palette: pal, delay: Math.round(1000 / fps) });
      $('#bar').style.width = ((f + 1) / n * 100).toFixed(0) + '%'; $('#barTxt').textContent = `GIF %${Math.round((f + 1) / n * 100)}`;
      if (f % 4 === 0) await new Promise(r => setTimeout(r, 0));
    }
    gif.finish(); const blob = new Blob([gif.bytes()], { type: 'image/gif' });
    results.push({ name: `${slug(brief.title || 'video') || 'video'}.gif`, blob, size: blob.size, plat: `GIF önizleme · ${dur} sn`, img: true, url: null }); renderResults();
    $('#barTxt').textContent = 'GIF hazır';
  } catch (e) { console.error(e); $('#barTxt').textContent = 'Hata: ' + e.message; }
  [PW, PH] = previewDims(); cv.width = PW; cv.height = PH; film.resize(PW, PH); film.safe = PV().safe; fitCanvas(); setBusy(false); rebuild();
};

/* toplu üretim */
let batchName = '', batchStop = false;
function parseBatch(t) {
  return (t || '').replace(/\r/g, '').split(/\n\s*-{3,}\s*\n/).map(b => b.trim()).filter(Boolean).map(b => { const ls = b.split('\n'); return { title: ls[0].trim(), text: ls.slice(1).join('\n').trim() }; });
}
$('#batchText').addEventListener('input', () => { const n = parseBatch($('#batchText').value).length; $('#batchInfo').textContent = n ? `${n} video üretilecek · ${F.platforms.length} platform → ${n * F.platforms.length} dosya` : ''; });
$('#batchGo').onclick = async () => {
  const list = parseBatch($('#batchText').value); if (!list.length) { toast('Önce konuları yazın'); return; }
  if (busy) return; batchStop = false; $('#batchGo').disabled = true; $('#batchStop').disabled = false;
  const saved = { items, brief: { ...brief }, flow: [...flow], soundtrack: F.soundtrack };
  const useAI = $('#batchAI').checked && F.olModel, autoMedia = $('#batchAuto').checked;
  try {
    for (const [k, b] of list.entries()) {
      if (batchStop) break;
      $('#batchInfo').textContent = `${k + 1}/${list.length}: ${b.title}`;
      const br = { ...saved.brief, title: b.title, text: b.text || b.title };
      let scenes;
      if (useAI) { try { scenes = (await aiScenes(F.fmt, br, { url: F.olUrl, model: F.olModel, onStatus: m => ($('#batchInfo').textContent = `${k + 1}/${list.length}: ${m}`) })).scenes; } catch (e) { scenes = null; } }
      if (!scenes || !scenes.length) scenes = toScenes(F.fmt, br);
      items = scenes.map(sc => makeItem({ ...sc, stockQ: sc.q || '' })); brief = br; batchName = b.title;
      if (autoMedia) { flow = []; rebuild(); await autoMusic(m => ($('#batchInfo').textContent = `${k + 1}/${list.length}: ${m}`)); await autoFootage(m => ($('#batchInfo').textContent = `${k + 1}/${list.length}: ${m}`)); }
      rebuild(); await renderAll();
      if (cancelFlag) break;
    }
    $('#batchInfo').textContent = batchStop || cancelFlag ? 'Toplu üretim durduruldu' : `${list.length} video üretildi. "Hepsini ZIP indir" ile indirebilirsiniz.`;
  } catch (e) { $('#batchInfo').textContent = '✗ ' + e.message; }
  batchName = ''; items = saved.items; brief = saved.brief; if (autoMedia) flow = saved.flow; F.soundtrack = saved.soundtrack;
  save(); renderList(); loadEditor(); syncBrief(); renderStockGrid(); renderMusic(); rebuild();
  $('#batchGo').disabled = false; $('#batchStop').disabled = true;
};
$('#batchStop').onclick = () => { batchStop = true; cancelFlag = true; };

/* kapak görseli */
const THUMB_DIMS = { youtube: [1280, 720], shorts: [1080, 1920], reels: [1080, 1920], igpost: [1080, 1350], kare: [1080, 1080] };
async function makeThumbs() {
  if (busy || !tl.shots.length) return;
  stopPlayback(); setBusy(true); switchTab('uretim'); await ensureFonts();
  const base = slug(brief.title || (items[0] && items[0].main) || 'video') || 'video';
  const text = ($('#thumbText').value || brief.title || (items.find(i => i.kind !== 'cta') || items[0] || {}).main || '').trim();
  const src = tl.shots.find(s => s.kind !== 'intro') || tl.shots[0];
  const oldSize = film.size, oldCap = film.capOn;
  try {
    for (const k of F.platforms) {
      const p = PLATFORMS[k]; const [W, H] = THUMB_DIMS[k] || dims(p.format, 1080);
      cv.width = W; cv.height = H; film.resize(W, H); film.safe = { top: 0.08, bottom: 0.1, side: 0.07 }; rebuild();
      film.capOn = false; film.size = oldSize * (W > H ? 1.25 : 1.15);
      const at = Math.min(tl.dur * 0.35, (src.start || 0) + 2.5);
      const shot = { ...src, i: 9999, key: 'thumb', start: 0, dur: 30, transition: 'none', transDur: 0, cont: false, anim: 'tek', camera: 'nefes', camK: 0.2, timing: null, clip: null,
        lines: Object.assign([...(src.lines.filter(l => l.role === 'tag')), { role: 'main', text }], { layout: W > H ? 'sol' : 'merkez' }), layout: W > H ? 'sol' : 'merkez', vStart: -at };
      film.setTimeline({ shots: [shot], dur: 30 }); film.fadeIn = 0; await film.prepare(4); film.render(4);
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      results.push({ name: `${base}-kapak-${p.suffix}.png`, blob, size: blob.size, plat: `${p.name} kapağı`, img: true, url: null }); renderResults();
    }
    $('#barTxt').textContent = 'Kapak görselleri hazır';
  } catch (e) { console.error(e); $('#barTxt').textContent = 'Hata: ' + e.message; }
  film.size = oldSize; film.capOn = oldCap; film.fadeIn = 0.6;
  [PW, PH] = previewDims(); cv.width = PW; cv.height = PH; film.resize(PW, PH); film.safe = PV().safe; fitCanvas();
  setBusy(false); rebuild();
}
$('#thumbBtn').onclick = makeThumbs;
const TRM = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
function slug(s) { return (s || '').toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, c => TRM[c]).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
function renderResults() {
  $('#results').innerHTML = results.map((r, i) => `<div class="q"><div class="no muted">${i + 1}</div><div><div class="tx">${esc(r.name)}</div><div class="st ok">${esc(r.plat || '')} · ${(r.size / 1048576).toFixed(1)} MB${r.file ? ' · klasörde' : ''}</div></div><div class="acts"><button class="btn sm" data-a="view" data-i="${i}">▶</button>${r.blob ? `<button class="btn sm" data-a="dl" data-i="${i}">⬇</button>` : ''}</div></div>`).join('');
  $('#doneBadge').textContent = results.length || ''; $('#zipAll').disabled = !results.some(r => r.blob);
}
$('#results').onclick = async e => {
  const b = e.target.closest('[data-a]'); if (!b) return; const r = results[+b.dataset.i];
  if (b.dataset.a === 'dl') saveFile(r.blob, r.name);
  else if (r.img) { if (!r.url) r.url = URL.createObjectURL(r.blob); window.open(r.url, '_blank'); }
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
$('#capMode').innerHTML = Object.entries(CAP_STYLES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
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

/* ses hazırlama */
function updateAiAudioStatus() {
  const need = items.filter(it => F.ttsOn && voText(it) && !narrOf(it)).length;
  $('#audioStatus').textContent = F.ttsOn ? (need ? `${need} sahnenin seslendirmesi hazırlanmayı bekliyor` : '✓ Seslendirme hazır') : '';
}
async function prepareAudio(onStatus = m => ($('#audioStatus').textContent = m)) {
  let n = 0, fails = 0;
  if (!F.ttsOn) return 0;
  for (const [i, it] of items.entries()) {
    const text = voText(it); if (!text) continue;
    if (narrOf(it)) continue;
    try { const buf = await speak(text, F.voice, m => onStatus(`Seslendirme ${i + 1}/${items.length}: ${m}`), { speed: F.ttsSpeed, pitch: F.ttsPitch, pause: F.ttsPause }); narrCache.set(it.id, { text, buf, cfg: ttsCfg() }); n++; }
    catch (e) { fails++; console.warn('tts', e); }
  }
  rebuild(); updateAiAudioStatus();
  if (fails) onStatus(`${fails} sahne seslendirilemedi (ses modeli indirilemedi olabilir; "Ses modelini indir"e basın)`);
  return n;
}
$('#prepAudio').onclick = async () => { $('#prepAudio').disabled = true; try { await prepareAudio(); } finally { $('#prepAudio').disabled = false; } };
$('#voiceDl').onclick = async () => { try { await downloadVoice(F.voice, p => ($('#audioStatus').textContent = `Ses modeli %${Math.round(p * 100)}`)); $('#audioStatus').textContent = '✓ Ses modeli hazır'; } catch (e) { $('#audioStatus').textContent = '✗ Ses modeli indirilemedi'; } };

/* görseller */
const SCENE_PROMPTS = { yildiz: 'starry night sky over desert mountains, milky way, deep blue, cinematic', col: 'golden desert dunes at sunset, soft warm light, cinematic', deniz: 'calm sea at night under moonlight, reflections, cinematic', nur: 'light rays through dark clouds, volumetric light, cinematic', cami: 'city skyline at dusk, purple sky, cinematic', desen: 'golden geometric pattern, ornate, dark background, cinematic lighting', bulut: 'sea of clouds at sunrise, golden light, heavenly, cinematic', soyut: 'abstract flowing light ribbons, dark background, ethereal' };
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
  if ((r.type || '').startsWith('image/')) { // fotoğraf: hareketsiz çekim gibi davranır (akışta yavaş yakınlaşma)
    const img = new Image(); img.src = URL.createObjectURL(r.blob);
    try { await img.decode(); } catch (e) { return false; }
    img.duration = +r.still || 5; img.videoWidth = img.naturalWidth; img.videoHeight = img.naturalHeight; img.readyState = 4; img.paused = true; img.pause = () => { }; img.play = () => Promise.resolve();
    img._mean = await meanColor(img); film.videos.set(id, img); return true;
  }
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.loop = false; v.src = URL.createObjectURL(r.blob);
  try {
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('video')); setTimeout(() => rej(new Error('zaman aşımı')), 20000); });
    v._mean = await meanColor(v);
    film.videos.set(id, v); return true;
  } catch (e) { return false; }
}
async function meanColor(v) {
  try {
    const c = document.createElement('canvas'); c.width = 32; c.height = 18; const g = c.getContext('2d', { willReadFrequently: true });
    const acc = [0, 0, 0]; let n = 0;
    for (const f of (v.tagName === 'IMG' ? [0.5] : [0.25, 0.5, 0.75])) {
      if (v.tagName !== 'IMG') await new Promise(r => { const fin = () => { v.removeEventListener('seeked', fin); r(); }; v.addEventListener('seeked', fin); v.currentTime = (v.duration || 1) * f; setTimeout(fin, 2000); });
      g.drawImage(v, 0, 0, 32, 18); const d = g.getImageData(0, 0, 32, 18).data;
      for (let i = 0; i < d.length; i += 4) { acc[0] += d[i]; acc[1] += d[i + 1]; acc[2] += d[i + 2]; n++; }
    }
    if (v.tagName !== 'IMG') v.currentTime = 0;
    return acc.map(x => x / n / 255);
  } catch (e) { return null; }
}
const flowIds = () => (F.stockOn && F.stockMode === 'flow') ? flow.map(v => v.id).filter(id => film.videos.has(id)) : [];
function renderFlow() {
  const box = $('#flowStrip'); if (!box) return;
  $('#flowBox').style.display = F.stockMode === 'flow' ? '' : 'none';
  $('#stockGrid').style.display = F.stockMode === 'flow' ? 'none' : '';
  const tot = flow.reduce((a, v) => a + Math.min(+F.flowMax, v.dur || 0), 0);
  box.innerHTML = flow.length ? flow.map((v, k) => `<div class="fl" title="${esc(v.tags || '')}">${v.thumb ? `<img src="${esc(v.thumb)}" alt="">` : (film.videos.has(v.id) ? `<video muted playsinline preload="metadata" src="${esc(film.videos.get(v.id).src)}#t=1"></video>` : '')}<b>${k + 1}</b><span>${Math.round(v.dur || 0)} sn</span><div class="fl-b"><button data-fm="${k}:-1" title="Öne al">◀</button><button data-fm="${k}:1" title="Geri al">▶</button><button data-fx="${k}" title="Çıkar">✕</button></div></div>`).join('') : '<span class="muted">Akış boş. "Pixabay\'de ara ve ekle" ile çekim seçin.</span>';
  if (flow.length) box.insertAdjacentHTML('beforeend', `<span class="muted" style="flex:0 0 auto;font-size:11px">${flow.length} çekim · bir tur ≈ ${Math.round(tot)} sn</span>`);
}
function flowRemoveFiles(v) { if (!items.some(o => (o.vids || []).some(x => x.id === v.id)) && !flow.some(x => x.id === v.id)) { delFile(v.id); const el = film.videos.get(v.id); if (el) { URL.revokeObjectURL(el.src); film.videos.delete(v.id); } } }
$('#flowStrip').addEventListener('click', e => {
  const m = e.target.closest('[data-fm]'), x = e.target.closest('[data-fx]');
  if (m) { const [k, d] = m.dataset.fm.split(':').map(Number), j = k + d; if (j < 0 || j >= flow.length) return; [flow[k], flow[j]] = [flow[j], flow[k]]; }
  else if (x) { const [v] = flow.splice(+x.dataset.fx, 1); flowRemoveFiles(v); }
  else return;
  save(); rebuild(); renderFlow();
});
$('#flowAdd').onclick = () => openPicker('flow');
async function addOwnMedia(files, toItem = null) {
  const out = [];
  for (const f of files) {
    if (!/^(image|video)\//.test(f.type)) continue;
    const id = 'own:' + newId();
    await putFile({ id, kind: 'stock', name: f.name, type: f.type, blob: f, order: Date.now(), still: 5 });
    if (await loadVideo(id)) { const el = film.videos.get(id); out.push({ id, px: id, dur: el.duration, w: el.videoWidth, h: el.videoHeight, thumb: f.type.startsWith('image/') ? el.src : '', page: '', user: 'siz', tags: f.name, own: true }); }
    else toast(`${f.name} açılamadı`);
  }
  if (!out.length) return;
  if (toItem != null) { const it = items[toItem]; it.vids = [...(it.vids || []), ...out]; if (!F.stockOn) F.stockOn = true; if (F.stockMode !== 'item') F.stockMode = 'item'; }
  else { flow.push(...out); if (!F.stockOn || F.stockMode !== 'flow') { F.stockOn = true; F.stockMode = 'flow'; } }
  syncUI(); save(); rebuild(); renderStockGrid(); toast(`${out.length} dosya eklendi`);
}
$('#flowOwn').onchange = async e => { const fs = [...e.target.files]; e.target.value = ''; await addOwnMedia(fs); };
$('#stockGrid').addEventListener('change', async e => { const f = e.target.closest('[data-own]'); if (!f) return; const fs = [...f.files]; f.value = ''; await addOwnMedia(fs, +f.dataset.own); });
$('#flowClear').onclick = () => { if (!flow.length || !confirm('Akıştaki bütün çekimler çıkarılsın mı?')) return; const old = flow; flow = []; old.forEach(flowRemoveFiles); save(); rebuild(); renderFlow(); };
function itemScene(it) { return it.sceneHint || detectScene(`${it.main} ${it.sub}`) || (STYLES[F.style] || STYLES.nur).scenes.find(x => x !== 'video') || 'nur'; }
function renderStockGrid() {
  renderFlow();
  const box = $('#stockGrid'); if (!box) return;
  box.innerHTML = items.map((it, i) => {
    const vs = (it.vids || []).filter(x => film.videos.has(x.id));
    const q = it.stockQ || (queriesFor({ ...it, stockQ: '' }, itemScene(it))[0] || {}).q || '';
    return `<div class="stk"><div class="stk-h"><b>${i + 1}</b><input type="text" data-sq="${i}" value="${esc(it.stockQ || '')}" placeholder="${esc(q)}" title="Arama kelimeleri (İngilizce ya da Türkçe). Boş bırakırsanız otomatik seçilir."><button class="btn sm" data-pk="${i}" title="Arama sonuçlarından kendiniz seçin">Seç</button><label class="btn sm" title="Kendi fotoğraf ya da videonuzu ekleyin">📁<input type="file" data-own="${i}" accept="image/*,video/*" multiple hidden></label><button class="btn sm ghost" data-si="${i}" title="Otomatik olarak başka çekimler bul">↻</button></div>
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
  for (const [k, h] of hits.entries()) { const v = await saveHit(h, W, H, stockAbort.signal, (g, tot) => ($('#stockStatus').textContent = `#${i + 1} · çekim ${k + 1}/${hits.length} indiriliyor… ${mb(g, tot)}`)); if (v) vids.push(v); }
  setVids(i, vids);
  return vids.length;
}
const mb = (g, tot) => `${(g / 1e6).toFixed(1)}${tot ? ' / ' + (tot / 1e6).toFixed(1) : ''} MB`;
function outDims() { const P = PLATFORMS[F.platforms[0]] || PV(); return dims(P.format, P.res || 1080); }
async function saveHit(h, W, H, signal, onProgress) {
  const { blob, rend, thumb } = await downloadClip(h, W, H, { signal, onProgress });
  const id = 'stock:' + h.px + ':' + rend.key;
  await putFile({ id, kind: 'stock', name: id, type: 'video/mp4', blob, order: Date.now() });
  return (await loadVideo(id)) ? { id, px: h.px, dur: h.dur, w: rend.w, h: rend.h, thumb: thumb || thumbOf(h), page: h.page, user: h.user, tags: h.tags, q: h.q || '' } : null;
}
function setVids(i, vids) {
  const it = items[i]; const keep = new Set(vids.map(v => v.id));
  for (const old of it.vids || []) if (!keep.has(old.id) && !items.some((o, j) => j !== i && (o.vids || []).some(x => x.id === old.id))) { delFile(old.id); const v = film.videos.get(old.id); if (v) { URL.revokeObjectURL(v.src); film.videos.delete(old.id); } }
  it.vids = vids; save();
}

/* --- çekim seçme penceresi --- */
const PK = { i: -1, q: '', page: 1, hits: [], sel: [], busy: false, abort: null };
function pkUsedElsewhere(px) { return PK.i === 'flow' ? flow.some(x => x.px === px) : items.some((o, j) => j !== PK.i && (o.vids || []).some(x => x.px === px)); }
async function openPicker(i) {
  if (!F.pxKey.trim()) { $('#stockStatus').textContent = 'Önce Pixabay anahtarınızı girin.'; $('#pxKey').focus(); return; }
  PK.i = i; PK.page = 1; PK.hits = [];
  if (i === 'flow') {
    const it = items[0] || {};
    PK.sel = []; PK.local = [];
    PK.q = PK.lastFlowQ || (items[0] ? (queriesFor({ ...it, stockQ: '' }, itemScene(it))[0] || {}).q : '') || 'nature';
    $('#pickTitle').textContent = 'Akışa çekim ekle: seçtikleriniz akışın sonuna, seçme sırasıyla eklenir';
    $('#pickUse').textContent = 'Seçilenleri akışa ekle';
  } else {
    const it = items[i];
    PK.sel = (it.vids || []).filter(v => film.videos.has(v.id)).map(v => v.px);
    // mevcut çekimler en başta
    PK.local = (it.vids || []).filter(v => film.videos.has(v.id)).map(v => ({ px: v.px, dur: v.dur, tags: v.tags, user: v.user, page: v.page, local: v, v: {} }));
    PK.q = it.stockQ || (queriesFor({ ...it, stockQ: '' }, itemScene(it))[0] || {}).q || '';
    $('#pickTitle').textContent = `#${i + 1} için çekim seç · ${(it.sub || it.main || '').slice(0, 70)}`;
    $('#pickUse').textContent = 'Seçilenleri kullan';
  }
  $('#pickQ').value = PK.q; $('#pick').classList.add('show');
  await pkSearch(true);
}
async function pkSearch(reset) {
  if (PK.busy) return; PK.busy = true;
  const q = $('#pickQ').value.trim() || PK.q; PK.q = q;
  if (reset) { PK.page = 1; PK.hits = []; }
  $('#pickInfo').textContent = 'Aranıyor…';
  try {
    const [W, H] = outDims(); const portrait = H > W;
    let hits = await pixabaySearch(F.pxKey.trim(), q, { lang: langOf(q), page: PK.page });
    if (reset && hits.length < 12 && langOf(q) === 'en') { const tr = await pixabaySearch(F.pxKey.trim(), q, { lang: 'tr', page: 1 }); for (const h of tr) if (!hits.some(x => x.px === h.px)) hits.push(h); }
    const ranked = rankHits(hits, { portrait, noPeople: F.stockNoPeople, minDur: 3 });
    for (const h of ranked) if (!PK.hits.some(x => x.px === h.px)) PK.hits.push(h);
    $('#pickInfo').textContent = PK.hits.length ? `${PK.hits.length} çekim · üzerine gelince önizleme oynar, tıklayarak seçin (sıra = seçme sırası)${F.stockNoPeople ? ' · insan görünenler gizli' : ''}` : 'Sonuç yok. Başka kelimelerle deneyin (İngilizce aramalar daha çok sonuç verir).';
  } catch (e) { $('#pickInfo').textContent = '✗ ' + e.message; }
  PK.busy = false; pkRender();
}
function pkCard(h) {
  const big = h.local ? { w: h.local.w, h: h.local.h } : (h.v.large || h.v.medium || h.v.small || Object.values(h.v)[0] || {});
  const n = PK.sel.indexOf(h.px);
  const thumb = h.local ? h.local.thumb : thumbOf(h);
  const prev = !thumb ? (h.local ? (film.videos.get(h.local.id) || {}).src : (h.v.tiny || h.v.small || {}).url) : '';
  return `<div class="pk${big.h > big.w ? ' portrait' : ''}${n >= 0 ? ' on' : ''}${pkUsedElsewhere(h.px) ? ' used' : ''}" data-px="${h.px}">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : prev ? `<img alt="" style="display:none"><video class="poster" muted playsinline preload="metadata" src="${esc(prev)}#t=1"></video>` : ''}<span class="pk-n">${n + 1}</span><div class="pk-info">${Math.round(h.dur)} sn${big.w ? ` · ${big.w}×${big.h}` : ''}${h.local ? ' · seçili' : ''}</div></div>`;
}
function pkRender() {
  const all = [...PK.local, ...PK.hits.filter(h => !PK.local.some(l => l.px === h.px))];
  $('#pickGrid').innerHTML = all.map(pkCard).join('');
  $('#pickCount').textContent = PK.sel.length ? `${PK.sel.length} çekim seçili` : 'Henüz seçim yok';
}
function pkFind(px) { return PK.local.find(h => h.px === px) || PK.hits.find(h => h.px === px); }
$('#pickGrid').addEventListener('click', e => {
  const c = e.target.closest('.pk'); if (!c || PK.busy) return; const px = +c.dataset.px;
  const k = PK.sel.indexOf(px); if (k >= 0) PK.sel.splice(k, 1); else PK.sel.push(px);
  pkRender();
});
$('#pickGrid').addEventListener('mouseover', e => {
  const c = e.target.closest('.pk'); if (!c || c.querySelector('video:not(.poster)')) return;
  const h = pkFind(+c.dataset.px); if (!h) return;
  const src = h.local ? (film.videos.get(h.local.id) || {}).src : ((h.v.tiny || h.v.small || {}).url);
  if (!src) return;
  const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.src = src; c.appendChild(v);
  c.addEventListener('mouseleave', () => { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); }, { once: true });
});
$('#pickGo').onclick = () => pkSearch(true);
$('#pickQ').addEventListener('keydown', e => { if (e.key === 'Enter') pkSearch(true); });
$('#pickMore').onclick = () => { PK.page++; pkSearch(false); };
$('#pickClose').onclick = () => { if (PK.abort) PK.abort.abort(); $('#pick').classList.remove('show'); };
$('#pickUse').onclick = async () => {
  if (PK.busy) return; PK.busy = true; $('#pickUse').disabled = true;
  const i = PK.i, it = items[i]; const [W, H] = outDims(); PK.abort = new AbortController();
  if (i === 'flow') {
    try {
      let added = 0;
      for (const [k, px] of PK.sel.entries()) {
        if (flow.some(v => v.px === px)) continue;
        const have = items.flatMap(o => o.vids || []).find(v => v.px === px && film.videos.has(v.id));
        const h = pkFind(px); if (!have && !h) continue;
        const v = have || await saveHit({ ...h, q: PK.q }, W, H, PK.abort.signal, (g, tot) => ($('#pickInfo').textContent = `Çekim ${k + 1}/${PK.sel.length} indiriliyor… ${mb(g, tot)}`));
        if (v) { flow.push(v); added++; save(); }
      }
      PK.lastFlowQ = PK.q;
      if (!F.stockOn || F.stockMode !== 'flow') { F.stockOn = true; F.stockMode = 'flow'; syncUI(); }
      if (!['gercek', 'sinematik', 'noir', 'gece'].includes(F.style)) { F.style = 'gercek'; syncUI(); }
      save(); rebuild(); renderStockGrid(); $('#pick').classList.remove('show');
      $('#stockStatus').textContent = `${added} çekim akışa eklendi · akışta ${flow.length} çekim`;
    } catch (e) { $('#pickInfo').textContent = e.name === 'AbortError' ? 'Durduruldu' : '✗ ' + e.message; }
    PK.busy = false; PK.abort = null; $('#pickUse').disabled = false; return;
  }
  try {
    const out = [];
    for (const [k, px] of PK.sel.entries()) {
      const have = (it.vids || []).find(v => v.px === px && film.videos.has(v.id)) || items.flatMap(o => o.vids || []).find(v => v.px === px && film.videos.has(v.id));
      if (have) { out.push(have); continue; }
      const h = pkFind(px); if (!h) continue;
      const v = await saveHit({ ...h, q: PK.q }, W, H, PK.abort.signal, (g, tot) => ($('#pickInfo').textContent = `Çekim ${k + 1}/${PK.sel.length} indiriliyor… ${mb(g, tot)}`));
      if (v) out.push(v);
    }
    setVids(i, out); it.stockQ = PK.q === (queriesFor({ ...it, stockQ: '' }, itemScene(it))[0] || {}).q ? (it.stockQ || '') : PK.q;
    if (out.length && !F.stockOn) { F.stockOn = true; syncUI(); }
    if (out.length && !['gercek', 'sinematik', 'noir', 'gece'].includes(F.style)) { F.style = 'gercek'; syncUI(); }
    save(); rebuild(); renderStockGrid();
    $('#pick').classList.remove('show');
    $('#stockStatus').textContent = `#${i + 1}: ${out.length} çekim kullanılıyor`;
  } catch (e) { $('#pickInfo').textContent = e.name === 'AbortError' ? 'Durduruldu' : '✗ ' + e.message; }
  PK.busy = false; PK.abort = null; $('#pickUse').disabled = false;
};
async function findStock(only = null) {
  if (!F.pxKey.trim()) { $('#stockStatus').textContent = 'Önce Pixabay anahtarınızı girin.'; $('#pxKey').focus(); return; }
  stockAbort = new AbortController(); $('#findStock').disabled = true; $('#stockStop').disabled = false;
  if (F.stockMode === 'flow' && only == null) {
    stockAbort = new AbortController(); $('#findStock').disabled = true; $('#stockStop').disabled = false;
    try {
      const [W, H] = outDims(); const exclude = new Set(flow.map(v => v.px)); let got = 0;
      if (!['gercek', 'sinematik', 'noir', 'gece'].includes(F.style)) { F.style = 'gercek'; syncUI(); }
      for (const [i, it] of items.entries()) {
        $('#stockStatus').textContent = `#${i + 1} için çekim aranıyor…`;
        const hits = await findClips(F.pxKey.trim(), it, itemScene(it), { n: 2, portrait: H > W, noPeople: F.stockNoPeople, exclude, signal: stockAbort.signal });
        for (const [k, h] of hits.entries()) { const v = await saveHit(h, W, H, stockAbort.signal, (g, tot) => ($('#stockStatus').textContent = `#${i + 1} · çekim ${k + 1}/${hits.length} indiriliyor… ${mb(g, tot)}`)); if (v) { flow.push(v); got++; save(); renderFlow(); } }
      }
      rebuild(); $('#stockStatus').textContent = `${got} çekim akışa eklendi. Sırayı değiştirebilir, beğenmediğinizi ✕ ile çıkarabilirsiniz.`;
    } catch (e) { $('#stockStatus').textContent = e.name === 'AbortError' ? 'Durduruldu' : '✗ ' + e.message; }
    save(); rebuild(); renderStockGrid(); $('#findStock').disabled = false; $('#stockStop').disabled = true; stockAbort = null; return;
  }
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
$('#stockGrid').addEventListener('click', e => { const p = e.target.closest('[data-pk]'); if (p && !stockAbort) { openPicker(+p.dataset.pk); return; } const b = e.target.closest('[data-si]'); if (b && !stockAbort) findStock(+b.dataset.si); });
$('#stockGrid').addEventListener('change', e => { const q = e.target.closest('[data-sq]'); if (q) { items[+q.dataset.sq].stockQ = q.value.trim(); save(); } });

/* ================= Genel ================= */
function switchTab(n) { if (n === 'uretim') try { renderQC(); } catch (e) { } $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === n)); $$('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === n)); }
$('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); };
async function ensureFonts() {
  const fam = s => s.split(',')[0].trim();
  try { await Promise.race([Promise.all(['800 40px Montserrat', '700 40px Montserrat', '500 40px Inter', '700 40px "Playfair Display"', `700 40px ${fam(F.latinFont || 'Montserrat')}`, `800 40px ${fam(F.latinFont || 'Montserrat')}`, `700 40px ${F.arabicFont}`, `400 40px ${F.arabicFont}`, '700 40px Amiri', '500 40px Lora', 'italic 500 40px Lora', '600 30px Inter'].map(f => document.fonts.load(f, 'Ağış بسم ٱلۡ'))), new Promise(r => setTimeout(r, 5000))]); } catch (e) { }
}
window.addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); $('#play').click(); } });

window.filmDebug = { tl: () => tl, film, PK, results: () => results, flow: () => flow, setFlow: f => { flow = f; save(); rebuild(); renderStockGrid(); }, pkRender: () => pkRender(), items: () => items, rebuild: () => rebuild(), renderStockGrid: () => renderStockGrid(), loadVideo: id => loadVideo(id), audioOpts: () => audioOpts(tl), mix: async () => { const a = await mixTimeline(tl.dur, audioOpts(tl)); const d = a.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i += 100) pk = Math.max(pk, Math.abs(d[i])); return { dur: a.duration, peak: pk }; } };
(async function init() {
  resizePreview(); syncUI(); renderList(); loadEditor(); renderRef(); fitCanvas();
  await ensureFonts();
  for (const r of await allFiles()) if (r.kind === 'music') await addMusic(r.blob, r.name, r.id, false);
  renderMusic();
  for (const it of items) if (it.imgId) await loadImage(it.imgId);
  for (const it of items) for (const v of it.vids || []) await loadVideo(v.id);
  for (const v of flow) await loadVideo(v.id);
  await loadLogo(); await loadSfx(); await loadOwnVoices(); renderFormats(); syncBrief(); syncKit();
  { const sh = store.get('vs-share', ''); if (sh) { $('#shareText').value = sh; $('#shareBox').style.display = ''; } }
  if (String(F.soundtrack).startsWith('bed:')) await ensureBed(F.soundtrack.slice(4));
  rebuild(false); syncUI(); renderImgGrid(); renderStockGrid(); renderMusic(); updateAiAudioStatus();
  // motorlar programla birlikte açılıyorsa birkaç dakika boyunca sessizce yeniden dene
  (async () => { let a = false, b = false; for (let i = 0; i < 25 && !(a && b); i++) { if (i) await new Promise(r => setTimeout(r, 5000)); if (!a) a = await olConnect(true); if (!b) b = await cfConnect(true); } })();
  $('#loading').classList.add('hide');
  requestAnimationFrame(loop);
})();
