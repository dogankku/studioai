// Film Stüdyosu: arayüz
import { Film } from './film/player.js?v=202611211416';
import { direct } from './film/director.js?v=202611211416';
import { STYLES, EFFECTS, SCENES, CAMERAS, TEXT_ANIMS, TRANSITIONS, FX_DEFAULT, GRADE_DEFAULT } from './film/styles.js?v=202611211416';
import { analyzeAudio, analyzeVideo } from './film/analyze.js?v=202611211416';
import { parseList, parseCSV, makeItem, plainItem } from './parser.js?v=202611211416';
import { surahs, buildItems } from './quran.js?v=202611211416';
import { putFile, delFile, allFiles } from './storage.js?v=202611211416';
import { decodeBlob, mixFor, playPreview, stopPreview, live } from './audio.js?v=202611211416';
import { encodeFast, encodeRealtime, hasFast } from './encoder.js?v=202611211416';
import { dims, isMostlyRTL } from './renderer.js?v=202611211416';
import { newId } from './parser.js?v=202611211416';

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
  refUseCuts: true, refUseEnergy: true, refUseColors: false, refUseAudio: false
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
  tl = applyOverrides(direct(items, directOpts()));
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
  const st = soundtrack();
  if (st) { try { live(); playPreview(st.buffer, from, tl.dur, { volume: F.musicVol, fadeIn: F.fadeIn, fadeOut: F.fadeOut, loop: true }, 0); } catch (e) { } }
  $('#play').textContent = '❚❚ Durdur';
}
function stopPlayback() { playing = false; stopPreview(); $('#play').textContent = '▶ Oynat'; }
$('#play').onclick = () => { if (playing) stopPlayback(); else startPlayback(curT >= tl.dur - 0.05 ? 0 : curT); };
$('#seek').oninput = e => { const was = playing; stopPlayback(); curT = e.target.value / 1000 * tl.dur; updateTime(); dirty = true; if (was) startPlayback(curT); };
function loop(now) {
  if (!busy) {
    if (playing) { curT = (now - t0) / 1000; if (curT >= tl.dur) { curT = tl.dur; stopPlayback(); } film.render(curT); updateTime(); highlightShotAt(curT); }
    else if (dirty) { film.render(curT); dirty = false; }
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
const FIELDS = ['pace', 'mealMode', 'mode', 'respectKeywords', 'beatSync', 'durMode', 'targetDur', 'showSafe', 'fps', 'quality', 'latinFont', 'arabicFont', 'size', 'musicVol', 'fadeIn', 'fadeOut', 'refUseCuts', 'refUseEnergy', 'refUseColors', 'refUseAudio'];
for (const k of FIELDS) {
  const el = document.getElementById(k); if (!el) continue;
  el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
    F[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
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
function listChanged() { save(); renderList(); loadEditor(); rebuild(); }
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
  const st = soundtrack();
  const audio = st ? await mixFor(st.buffer, timeline.dur, { volume: F.musicVol, fadeIn: F.fadeIn, fadeOut: F.fadeOut, loop: true }, 0) : null;
  const fps = +F.fps, bitrate = Math.round(mbps * 1e6 * (fps > 30 ? 1.5 : 1) * +F.quality * (H * W) / (1920 * 1080));
  let file = null; if (dirHandle) file = await dirHandle.getFileHandle(name + '.mp4', { create: true });
  let res = null;
  if (hasFast()) { try { res = await encodeFast({ canvas: cv, W, H, fps, dur: timeline.dur, bitrate, audio, file, onProgress: onP, cancelled: () => cancelFlag, renderAt: async t => film.render(t) }); } catch (e) { if (e.message !== 'NO_FAST') throw e; } }
  if (!res) res = await encodeRealtime({ canvas: cv, fps, dur: timeline.dur, bitrate, audio, audioCtx: audio ? live() : null, onProgress: onP, cancelled: () => cancelFlag, renderLive: t => film.render(t) });
  return { ...res, name: `${name}.${res.ext}`, file: res.blob ? null : file };
}
function jobsFor(platKey) {
  const p = PLATFORMS[platKey], jobs = [];
  const base = slug(items[0] && (items[0].tag || items[0].src) || 'film') || 'film';
  if (F.mode === 'each') {
    items.forEach((it, i) => {
      const t1 = direct([it], directOpts()); // her öğe kendi süresine göre kurgulanır
      t1.shots.forEach(s => { s.key = s.key.replace(/^0:/, i + ':'); });
      jobs.push({ tl: applyOverrides(t1), name: `${String(i + 1).padStart(2, '0')}-${slug(it.src || it.tag || 'video')}-${p.suffix}` });
    });
  } else jobs.push({ tl, name: `${base}-${p.suffix}` });
  return jobs;
}
async function renderAll() {
  if (busy || !tl.shots.length) return;
  stopPlayback(); cancelFlag = false; setBusy(true); switchTab('uretim');
  await ensureFonts();
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
$('#saveProj').onclick = () => saveFile(new Blob([JSON.stringify({ app: 'film-studyosu', version: 1, settings: F, items: items.map(plainItem), overrides, ref }, null, 2)], { type: 'application/json' }), 'film-projesi.json');
$('#loadProj').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try { const d = JSON.parse(await f.text()); if (d.settings) F = { ...DEFAULTS, ...d.settings }; if (d.items) items = d.items.map(makeItem); overrides = d.overrides || {}; ref = d.ref || null; sel = 0; renderRef(); renderList(); loadEditor(); resizePreview(); changed(); toast('Proje açıldı'); }
  catch (err) { toast('Proje okunamadı'); }
};

/* ================= Genel ================= */
function switchTab(n) { $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === n)); $$('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === n)); }
$('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); };
async function ensureFonts() {
  const fam = s => s.split(',')[0].trim();
  try { await Promise.race([Promise.all([`700 40px ${fam(F.latinFont)}`, `800 40px ${fam(F.latinFont)}`, `700 40px ${F.arabicFont}`, `400 40px ${F.arabicFont}`, '700 40px Amiri', '500 40px Lora', 'italic 500 40px Lora', '600 30px Inter'].map(f => document.fonts.load(f, 'Ağış بسم ٱلۡ'))), new Promise(r => setTimeout(r, 5000))]); } catch (e) { }
}
window.addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); $('#play').click(); } });

(async function init() {
  resizePreview(); syncUI(); renderList(); loadEditor(); renderRef(); fitCanvas();
  await ensureFonts();
  for (const r of await allFiles()) if (r.kind === 'music') await addMusic(r.blob, r.name, r.id, false);
  renderMusic();
  rebuild(false); syncUI();
  $('#loading').classList.add('hide');
  requestAnimationFrame(loop);
})();
