// Gerçek video çekimleri: Pixabay video arşivinde arama, sahneye uygun çekim seçimi ve indirme.
// Anahtar yalnızca kullanıcının tarayıcısında durur. Pixabay kuralları gereği arama sonuçları 24 saat önbellekte tutulur,
// videolar doğrudan bağlanmaz, indirilip yerelde saklanır.
const API = 'https://pixabay.com/api/videos/';
const DAY = 24 * 3600 * 1000;

const PEOPLE = /\b(people|person|persons|woman|women|man|men|girl|girls|boy|boys|child|children|kid|kids|baby|couple|model|portrait|face|lady|guy|family|crowd|human|humans|businessman|teen|teenager|selfie|dancer|dancing|bikini|fashion|beauty)\b/i;

const STOP = new Set(('a an the of and or with in on at by for to from into over under after before during through above below behind between among ' +
  'soft warm cold cool light lighting lit cinematic cinema beautiful highly detailed detail atmospheric atmosphere professional photography photo photograph ' +
  'image picture scene background representing symbolizing symbolic intricate journey life style shot view dramatic serene peaceful calm gentle vibrant ' +
  'ultra realistic hd high quality resolution colors colour colors pastel tones tone mood moody ethereal divine heavenly spiritual sacred ' +
  'complex design glowing glow rays ray breaking clouds sky golden hour hours sunset sunrise dawn dusk storm after').split(' '));
// Önemli ama yukarıda elenen kelimeleri sahne ipucu olarak geri kazan
const KEEP = ['clouds', 'sky', 'sunset', 'sunrise', 'dawn', 'storm', 'rays'];

export const SCENE_QUERIES = {
  yildiz: ['night sky stars', 'milky way', 'starry night'],
  deniz: ['ocean waves', 'sea sunset', 'calm sea'],
  col: ['desert dunes', 'sand dunes', 'desert'],
  nur: ['sun rays', 'sunlight forest', 'light rays clouds'],
  cami: ['mosque', 'minaret', 'islamic architecture'],
  bulut: ['clouds timelapse', 'above clouds', 'sky clouds'],
  desen: ['islamic pattern', 'mosque interior', 'ornament'],
  soyut: ['light bokeh', 'abstract light', 'particles'],
  gorsel: ['nature landscape', 'mountains', 'forest'],
  video: ['nature landscape', 'mountains', 'forest']
};

function words(s) {
  return (s || '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean);
}

/** Bir öğe için arama sorguları: kullanıcı sorgusu > AI görsel tarifi > sahne ipucu > genel doğa */
export function queriesFor(it, scene) {
  const out = [];
  const add = (q, lang = 'en') => { q = (q || '').trim(); if (q && !out.some(x => x.q === q && x.lang === lang)) out.push({ q, lang }); };
  if (it.stockQ) { add(it.stockQ, /[çğıöşüÇĞİÖŞÜ]/.test(it.stockQ) ? 'tr' : 'en'); }
  if (it.imgPrompt) {
    const all = words(it.imgPrompt.split(',')[0]);
    const content = all.filter(w => w.length > 2 && !STOP.has(w));
    const extra = all.filter(w => KEEP.includes(w));
    if (content.length >= 2) add(content.slice(0, 2).join(' '));
    if (content.length) add(content[0] + (extra[0] ? ' ' + extra[0] : ''));
    if (content.length) add(content[0]);
    if (content[1]) add(content[1]);
  }
  for (const q of SCENE_QUERIES[scene] || []) add(q);
  for (const q of SCENE_QUERIES.gorsel) add(q);
  return out;
}

function cacheGet(k) { try { const v = JSON.parse(localStorage.getItem('px:' + k) || 'null'); if (v && Date.now() - v.t < DAY) return v.d; } catch (e) { } return null; }
function cacheSet(k, d) {
  try { localStorage.setItem('px:' + k, JSON.stringify({ t: Date.now(), d })); }
  catch (e) { // yer kalmadıysa eski önbelleği temizle
    for (const key of Object.keys(localStorage)) if (key.startsWith('px:')) localStorage.removeItem(key);
    try { localStorage.setItem('px:' + k, JSON.stringify({ t: Date.now(), d })); } catch (e2) { }
  }
}

/** Pixabay video araması (ham sonuçlar, 24 saat önbellekli) */
export async function pixabaySearch(key, q, { lang = 'en', perPage = 50, page = 1, signal } = {}) {
  const ck = `${lang}|${q}|${perPage}|${page}`;
  const c = cacheGet(ck); if (c) return c;
  const u = `${API}?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&lang=${lang}&video_type=film&safesearch=true&per_page=${perPage}&page=${page}`;
  const r = await fetch(u, { signal });
  if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error('Pixabay anahtarı geçersiz');
  if (r.status === 429) throw new Error('Pixabay istek sınırı doldu, bir dakika sonra deneyin');
  if (!r.ok) { if (page > 1) return []; throw new Error('Pixabay yanıt vermedi (' + r.status + ')'); }
  const j = await r.json();
  const hits = (j.hits || []).map(h => ({
    px: h.id, dur: h.duration, tags: h.tags || '', user: h.user, page: h.pageURL, downloads: h.downloads || 0, likes: h.likes || 0,
    v: Object.fromEntries(Object.entries(h.videos || {}).filter(([, x]) => x && x.url).map(([k, x]) => [k, { url: x.url, w: x.width, h: x.height, size: x.size, thumb: x.thumbnail || '' }]))
  }));
  cacheSet(ck, hits);
  return hits;
}

export async function pixabayTest(key) { await pixabaySearch(key, 'ocean', { perPage: 3 }); return true; }

/** Hedef boyuta en uygun dosya sürümü (dikey hedefte dikey çekim tam oturur; yataydan kırpılır) */
export function pickRendition(hit, W, H) {
  // 4K gereksiz: çözme yavaş, dosya büyük. Hedefin uzun kenarına en yakın, 1920'yi aşmayan sürümü seç.
  const need = Math.min(1920, Math.max(W, H));
  const all = Object.entries(hit.v).map(([key, x]) => ({ key, ...x, long: Math.max(x.w || 0, x.h || 0) })).filter(x => x.url && x.long);
  const ok = all.filter(x => x.long <= 1920 && (!x.size || x.size < 60e6));
  const pool = ok.length ? ok : all;
  pool.sort((a, b) => (a.long >= need ? a.long - need : (need - a.long) * 3) - (b.long >= need ? b.long - need : (need - b.long) * 3));
  return pool[0] || null;
}
function thumbOf(hit) { for (const k of ['tiny', 'small', 'medium', 'large']) if (hit.v[k] && hit.v[k].thumb) return hit.v[k].thumb; return ''; }

/** Sonuçları puanla: insansız, hedef yönüne uygun, yeterince uzun, beğenilen */
export function rankHits(hits, { portrait = false, noPeople = true, exclude = new Set(), minDur = 5 } = {}) {
  return hits.filter(h => !exclude.has(h.px) && (!noPeople || !PEOPLE.test(h.tags)) && h.dur >= minDur && Object.keys(h.v).length)
    .map(h => {
      const big = h.v.large || h.v.medium || Object.values(h.v)[0];
      const isPortrait = big && big.h > big.w;
      let s = Math.log10(1 + h.downloads) * 0.6 + Math.log10(1 + h.likes) * 0.4;
      if (portrait && isPortrait) s += 2.5; else if (!portrait && isPortrait) s -= 3;
      if (h.dur >= 8 && h.dur <= 40) s += 0.8;
      if (big && Math.max(big.w, big.h) >= 1920) s += 0.6;
      return { h, s };
    }).sort((a, b) => b.s - a.s).map(x => x.h);
}

/** Bir öğe için n çekim bul (sırayla sorguları dener, tekrar etmeyen çekimler seçer) */
export async function findClips(key, it, scene, { n = 3, portrait = false, noPeople = true, exclude = new Set(), signal } = {}) {
  const picked = [];
  for (const { q, lang } of queriesFor(it, scene)) {
    if (picked.length >= n) break;
    const hits = await pixabaySearch(key, q, { lang, signal });
    for (const h of rankHits(hits, { portrait, noPeople, exclude })) {
      if (picked.length >= n) break;
      if (picked.some(p => p.px === h.px)) continue;
      picked.push({ ...h, q }); exclude.add(h.px);
    }
  }
  return picked;
}

/** Çekimi indir (ilerleme bildirimli) */
export async function downloadClip(hit, W, H, { signal, onProgress } = {}) {
  const r0 = pickRendition(hit, W, H); if (!r0) throw new Error('Çekimin dosyası yok');
  const r = await fetch(r0.url, { signal });
  if (!r.ok) throw new Error('Çekim indirilemedi (' + r.status + ')');
  const total = +r.headers.get('content-length') || r0.size || 0;
  if (!r.body || !onProgress) return { blob: await r.blob(), rend: r0, thumb: thumbOf(hit) };
  const rd = r.body.getReader(); const parts = []; let got = 0;
  for (; ;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onProgress(got, total); }
  return { blob: new Blob(parts, { type: 'video/mp4' }), rend: r0, thumb: thumbOf(hit) };
}

export function langOf(q) { return /[çğıöşüÇĞİÖŞÜ]/.test(q) ? 'tr' : 'en'; }
export { thumbOf };
