// Yönetmen: metin + (isteğe bağlı) ritim ve referans şablonundan çekim listesi kurar. Kural tabanlı, AI yok.
import { STYLES, SCENES } from './styles.js?v=202611221639';
const SCENE_KEYS = Object.keys(SCENES).filter(k => k !== 'gorsel' && k !== 'video');
import { isMostlyRTL } from '../renderer.js?v=202611221639';

function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const LEXICON = [
  ['yildiz', /gece|seher|şafak|sahur|yıldız|yildiz|\bay\b|karanlık|uyku|kadir|leyl|ليل|نجم|قمر|ظلم/i],
  ['deniz', /deniz|\bsu\b|dalga|yağmur|nehir|okyanus|gemi|بحر|ماء|مطر|موج/i],
  ['col', /çöl|sabır|sabir|kum|sıcak|yolculuk|hicret|güneş|صبر|شمس|سفر/i],
  ['nur', /nur|ışık|isik|hidayet|iman|kalp|kalb|zikir|tövbe|نور|هدى|قلب|ذكر|توب/i],
  ['cami', /namaz|secde|cami|ezan|dua|cuma|kıble|mescid|salat|صلا|سجد|مسجد|دعا/i],
  ['bulut', /cennet|rahmet|gök|bulut|melek|ahiret|sema|جن|رحم|سماء|ملك|آخرة/i],
  ['desen', /ilim|hikmet|ayet|kitap|kur'an|kuran|oku|kalem|علم|حكم|آي|كتاب|قرآن|اقرأ|قلم/i]
];
export function detectScene(text) {
  for (const [scene, re] of LEXICON) if (re.test(text || '')) return scene;
  return null;
}

const STOPS = /([،؛.!?;:…ۖۗۚۛۘۙ۝]+)/;
/** Metni okunabilir ifadelere böler (durak işaretleri ve kelime sınırı) */
export function splitPhrases(text, maxWords) {
  const t = (text || '').replace(/\s+/g, ' ').trim(); if (!t) return [];
  const parts = []; let cur = '';
  for (const tok of t.split(STOPS)) {
    if (!tok) continue;
    if (STOPS.test(tok)) { cur += tok; parts.push(cur.trim()); cur = ''; } else cur += tok;
  }
  if (cur.trim()) parts.push(cur.trim());
  const out = [];
  for (const p of parts) {
    const ws = p.split(' ').filter(Boolean);
    if (ws.length <= maxWords) { out.push(ws); continue; }
    const k = Math.ceil(ws.length / maxWords), per = Math.ceil(ws.length / k);
    for (let i = 0; i < ws.length; i += per) out.push(ws.slice(i, i + per));
  }
  // çok kısa parçaları komşusuyla birleştir
  const merged = [];
  for (const ws of out) {
    const prev = merged[merged.length - 1];
    if (prev && (ws.length <= 1 || prev.length <= 1) && prev.length + ws.length <= maxWords + 1) prev.push(...ws); else merged.push([...ws]);
  }
  return merged.map(ws => ws.join(' '));
}

function readTime(text, pace) {
  const rtl = isMostlyRTL(text); const n = text.split(/\s+/).filter(Boolean).length;
  return Math.max(2.2, Math.min(8, 1.3 + n * (rtl ? 0.72 : 0.38))) / pace;
}

function pickNot(arr, prev, r) {
  if (arr.length <= 1) return arr[0];
  let v; let guard = 0; do { v = arr[Math.floor(r() * arr.length)]; } while (v === prev && guard++ < 10); return v;
}

/**
 * items: [{main, sub, src, tag, timing}]
 * o: {style, seed, pace, beats, template, mode:'film'|'each', mealMode:'after'|'none'}
 */
export function direct(items, o = {}) {
  const style = STYLES[o.style] || STYLES.sinematik;
  const r = rng((o.seed || 1) * 31 + 7);
  const pace = (o.pace || 1) * style.pace;
  const segs = [];
  items.forEach((it, ii) => {
    const main = (it.main || '').trim(), sub = (it.sub || '').trim();
    const tag = (it.tag || '').trim(), src = (it.src || '').trim();
    const local = [];
    const LEAD = 0.5;
    if (it.kind) { // profesyonel format sahnesi: tek çekim, seslendirmeye göre süre
      const L = [];
      if (tag) L.push({ role: 'tag', text: tag });
      if (it.num) L.push({ role: 'num', text: String(it.num) });
      if (it.logo) L.push({ role: 'logo', text: '' });
      if (main) L.push({ role: 'main', text: main });
      if (sub && !(o.capHideSub && it._vo)) L.push({ role: 'sub', text: sub });
      if (it.cta) L.push({ role: 'cta', text: it.cta });
      if (src) L.push({ role: 'src', text: src });
      const base = (it.kind === 'intro' || it.kind === 'outro') ? 2.6 : readTime(`${main} ${sub}`, pace) + (it.cta ? 1.2 : 0) + (it.kind === 'hook' ? 0.4 : 0);
      const mainLetters = (main || '').replace(/[^\p{L}]/gu, '').length;
      const layout = it.layout || (/\d/.test(main || '') && mainLetters <= 14 && ['point', 'item', 'feature', 'price', 'hook'].includes(it.kind) ? 'istatistik' : it.kind === 'feature' ? 'sol' : 'merkez');
      L.layout = layout; L.card = it._card || null;
      if (it._vo) local.push({ lines: L, rt: Math.max(2.4, LEAD + it._vo.dur + 0.55), lock: true, clip: { key: `vo:${ii}`, offset: LEAD }, kind: it.kind });
      else local.push({ lines: L, rt: Math.max(it.kind === 'hook' ? 2.6 : 2.2, base), kind: it.kind });
      local.forEach((sg, k) => segs.push({ ...sg, item: ii, first: k === 0, last: k === local.length - 1, kInItem: k, nInItem: local.length, keyText: `${main} ${sub}` }));
      return;
    }
    const spoken = (phrases, narr, key, extra = {}) => { // seslendirilen ifadeler: toplam süre sese göre, karakter uzunluğuna orantılı
      const tot = LEAD + narr.dur + 0.7, L = phrases.reduce((a, p) => a + p.length, 0) || 1;
      phrases.forEach((ph, k) => local.push({ lines: [{ role: 'main', text: ph }], rt: Math.max(1.4, tot * ph.length / L), lock: true, clip: k === 0 ? { key, offset: LEAD } : null, ...extra }));
    };
    if (Array.isArray(it.timing) && it.timing.length) {
      local.push({ lines: [{ role: 'main', text: main }], timing: it.timing, rt: Math.max(readTime(main, pace), it.timing[it.timing.length - 1] + 1.6) });
    } else if (main && it._rec) {
      local.push({ lines: [{ role: 'main', text: main }], timing: it._rec.words.map(w => w + LEAD), rt: Math.max(readTime(main, pace), LEAD + it._rec.dur + 0.6), lock: true, clip: { key: `rec:${ii}`, offset: LEAD } });
    } else if (main && it._narrMain) {
      spoken(splitPhrases(main, isMostlyRTL(main) ? 5 : 7), it._narrMain, `nm:${ii}`);
    } else if (main) {
      const rtl = isMostlyRTL(main);
      for (const ph of splitPhrases(main, rtl ? 5 : 7)) local.push({ lines: [{ role: 'main', text: ph }], rt: readTime(ph, pace) });
    }
    if (sub && o.mealMode !== 'none') {
      const big = !main || main.split(/\s+/).length <= 2;
      if (it._narrSub) spoken(splitPhrases(sub, 9), it._narrSub, `ns:${ii}`, { meal: true });
      else if (big && local.length === 1 && sub.split(/\s+/).length <= 14) local[0].lines.push({ role: 'sub', text: sub }), local[0].rt += readTime(sub, pace) * 0.6;
      else for (const ph of splitPhrases(sub, 9)) local.push({ lines: [{ role: 'main', text: ph }], rt: readTime(ph, pace), meal: true });
    }
    if (!local.length) return;
    if (tag) local[0].lines.unshift({ role: 'tag', text: tag });
    if (src) { local[local.length - 1].lines.push({ role: 'src', text: src }); local[local.length - 1].rt += 0.8; }
    local.forEach((s, k) => segs.push({ ...s, item: ii, first: k === 0, last: k === local.length - 1, kInItem: k, nInItem: local.length, keyText: `${main} ${sub}` }));
  });
  if (!segs.length) return { shots: [], dur: 0, style: o.style };

  // süreler: şablon > okuma süresi; sonra ritme oturt
  let durs = segs.map(s => s.rt);
  const T = o.template;
  if (T && T.shots && T.shots.length) {
    const cuts = T.shots.map(s => s.dur); let ci = 0;
    durs = segs.map(s => {
      if (s.lock) return s.rt;
      let d = 0, guard = 0;
      while (d < s.rt * 0.75 && guard++ < 12) { d += cuts[ci % cuts.length]; ci++; }
      return Math.min(Math.max(d, s.rt * 0.75), s.rt * 2.2);
    });
  }
  // istenen süreye uydur: kısaltma, uzatma ya da aynı metni farklı açılardan çekerek (kapsama çekimleri) doldurma
  const target = +o.targetDur > 0 ? +o.targetDur : 0;
  if (target) {
    let natural = durs.reduce((a, b) => a + b, 0);
    if (target / natural > 2.2 && o.titleCards !== false) {
      const f = segs[0], tagL = f.lines.find(l => l.role === 'tag');
      if (tagL) { segs.unshift({ lines: [{ role: 'main', text: tagL.text }], item: f.item, first: true, last: false, kInItem: 't0', nInItem: f.nInItem, keyText: f.keyText, title: true }); durs.unshift(3.4); f.first = false; }
      const l = segs[segs.length - 1], srcL = l.lines.find(x => x.role === 'src');
      if (srcL) { segs.push({ lines: [{ role: 'main', text: srcL.text }], item: l.item, first: false, last: true, kInItem: 't1', nInItem: l.nInItem, keyText: l.keyText, title: true }); durs.push(3.4); }
      natural = durs.reduce((a, b) => a + b, 0);
    }
    const isLock = i => !!segs[i].lock;
    const lockSum = durs.reduce((acc, d, i) => acc + (isLock(i) ? d : 0), 0), freeSum = natural - lockSum;
    const avgT = T && T.shots && T.shots.length ? T.shots.reduce((acc, x) => acc + x.dur, 0) / T.shots.length : 0;
    const shotLen = Math.max(2.4, Math.min(7, avgT ? avgT * 2 : 4.4 / pace));
    const ns = [], nd = [];
    const pushCov = (sg, firstDur, extra) => { // ilk çekim + aynı metnin farklı açılardan devam çekimleri
      ns.push({ ...sg, cov: 0 }); nd.push(firstDur);
      const n = Math.round(extra / shotLen);
      if (n >= 1) for (let j = 1; j <= n; j++) { ns.push({ ...sg, cont: true, cov: j, first: false, clip: null }); nd.push(extra / n); }
      else nd[nd.length - 1] += extra;
    };
    const kf = freeSum > 0 ? (target - lockSum) / freeSum : 0;
    segs.forEach((sg, i) => {
      const d = durs[i];
      if (isLock(i)) { const extra = freeSum > 0 ? (kf > 1.6 ? 0 : 0) : Math.max(0, target - natural) * d / natural; pushCov(sg, d, extra); }
      else if (kf <= 0) { ns.push(sg); nd.push(Math.max(1.4, d * 0.5)); }
      else if (kf < 1) { ns.push(sg); nd.push(Math.max(1.4, d * kf)); }
      else if (kf <= 1.6) { ns.push(sg); nd.push(d * kf); }
      else { const tot = d * kf, n = Math.max(1, Math.round(tot / shotLen)); for (let j = 0; j < n; j++) { ns.push({ ...sg, cont: j > 0, cov: j, first: sg.first && j === 0, last: sg.last && j === n - 1 }); nd.push(tot / n); } }
    });
    segs.length = 0; segs.push(...ns); durs = nd;
  }
  const beats = (o.beats && o.beats.length > 4) ? o.beats : null;
  let t = 0; const starts = [];
  for (let i = 0; i < durs.length; i++) {
    starts.push(t);
    let end = t + durs[i];
    if (beats) { // bir sonraki vuruşa (tercihen çift vuruşa) oturt
      let best = end, bd = 1e9;
      for (let b = 0; b < beats.length; b++) { const dd = beats[b] - end; const w = Math.abs(dd) + (b % 2 ? 0.15 : 0) + (dd < -0.25 ? 1 : 0); if (w < bd) { bd = w; best = beats[b]; } }
      if (best - t > 1.4 && !(segs[i].lock && best < t + durs[i] - 0.05)) end = best;
    }
    durs[i] = end - t; t = end;
  }
  if (target && durs.length) {
    const diff = target - t;
    const li = durs.length - 1;
    if (diff >= 0 || (!segs[li].lock && durs[li] + diff >= 1.2)) durs[li] += diff;
    else { const free = durs.reduce((a, d, i) => a + (segs[i].lock ? 0 : d), 0); if (free > 0) { const kk = Math.max(0.3, (free + diff) / free); for (let i = 0; i < durs.length; i++) if (!segs[i].lock) durs[i] = Math.max(1.2, durs[i] * kk); } }
    t = 0; for (let i = 0; i < durs.length; i++) { starts[i] = t; t += durs[i]; }
  }

  // sahne, kamera, animasyon, geçiş
  const shots = []; let prevCam = null, prevScene = null; const itemScene = {};
  segs.forEach((s, i) => {
    if (!(s.item in itemScene)) {
      const kw = detectScene(s.keyText);
      const pool = style.scenes;
      let sc = kw && (o.respectKeywords !== false) ? kw : pool[(s.item + (o.seed || 0)) % pool.length];
      if (sc === prevScene && pool.length > 1 && !kw) sc = pickNot(pool, prevScene, r);
      itemScene[s.item] = sc;
    }
    if (items[s.item] && items[s.item]._img && o.aiImages !== false) itemScene[s.item] = 'gorsel';
    else if (items[s.item] && items[s.item]._scene && SCENE_KEYS.includes(items[s.item]._scene) && itemScene[s.item] !== items[s.item]._scene && !s.cont) itemScene[s.item] = items[s.item]._scene;
    let scene = itemScene[s.item];
    if (s.nInItem >= 4 && s.kInItem >= Math.ceil(s.nInItem / 2)) scene = pickNot(style.scenes.filter(x => x !== itemScene[s.item]).concat(itemScene[s.item]), itemScene[s.item], rng(s.item + 99));
    if (s.cont && s.cov % 2 === 1 && style.scenes.length > 1) scene = pickNot(style.scenes, itemScene[s.item], rng(s.item * 13 + s.cov + (o.seed || 0)));
    const flow = o.flow && o.flow.length ? o.flow : null;
    const vids = flow || (items[s.item] && items[s.item]._vids && o.stock !== false ? items[s.item]._vids : null);
    if (vids && vids.length) scene = 'video';
    else if (scene === 'video') scene = items[s.item] && items[s.item]._img ? 'gorsel' : (style.scenes.find(x => x !== 'video') || 'nur');
    const camera = pickNot(style.cameras, prevCam, r); prevCam = camera;
    const anim = s.meal ? style.anims[0] : style.anims[(s.item + (s.timing ? 0 : 1)) % style.anims.length];
    const energy = T && T.shots && T.shots.length ? T.shots[i % T.shots.length].energy : null;
    let transition = 'fade', transDur = 0.7;
    if (i === 0) { transition = 'none'; transDur = 0; }
    else if (s.first) { transition = style.transitions[(s.item + Math.floor(r() * 2)) % style.transitions.length]; transDur = 0.8; }
    else { transition = scene !== prevScene ? style.transitions[0] : (style.transitions.includes('cut') && r() < 0.35 ? 'cut' : 'fade'); transDur = 0.6; }
    if (s.cont && i > 0) { transition = style.transitions.includes('cut') && r() < 0.5 ? 'cut' : 'fade'; transDur = transition === 'cut' ? 0.05 : 0.9; }
    if (energy != null && energy > 0.6 && i > 0) { transition = energy > 0.8 ? 'cut' : (style.transitions.includes('whip') ? 'whip' : transition); transDur = transition === 'cut' ? 0.05 : 0.45; }
    if (transition === 'cut') transDur = 0.05;
    if (flow && i > 0) { transition = 'fade'; transDur = s.cont ? 0.6 : 0.7; } // arka plan aynı akış: yalnız yazı değişir
    shots.push({
      image: (scene === 'gorsel' || scene === 'video') && items[s.item] ? items[s.item]._img || null : null,
      videos: scene === 'video' ? vids : null, flow: scene === 'video' && !!flow,
      i, key: `${s.item}:${s.kInItem}${s.cov ? ':' + s.cov : ''}`, cont: !!s.cont, title: !!s.title, start: starts[i], dur: durs[i], scene, camera, camK: energy != null ? energy : 0.45 + r() * 0.2, anim, transition, transDur,
      lines: s.lines, item: s.item, seed: Math.floor(r() * 1e6), timing: s.cont ? null : (s.timing || null), clip: s.clip || null, kind: s.kind || null, layout: s.lines.layout || null, card: s.lines.card || null
    });
    prevScene = scene;
  });
  return { shots, dur: t, style: o.style, clips: clipsOf(shots) };
}
export function clipsOf(shots) { return shots.filter(s => s.clip).map(s => ({ key: s.clip.key, start: s.start + s.clip.offset })); }
