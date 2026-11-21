// Kur'an metni (King Fahd Uthmani, quranenc.com) ve Diyanet meali (tanzil.net), quran-json paketinden.
let index = null;
const cache = new Map();
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const arNum = n => String(n).replace(/\d/g, d => AR_DIGITS[d]);

export async function surahs() {
  if (!index) index = fetch('data/quran/index.json').then(r => { if (!r.ok) throw new Error('index'); return r.json(); });
  return index;
}
export async function surah(id) {
  if (!cache.has(id)) cache.set(id, fetch(`data/quran/${id}.json`).then(r => { if (!r.ok) throw new Error('surah'); return r.json(); }));
  return cache.get(id);
}

/**
 * Ayetleri liste öğelerine çevirir.
 * mode: 'each' (her ayet ayrı video) | 'one' (hepsi tek video)
 */
export async function buildItems(id, from, to, { mode = 'each', meal = true, tag = '' } = {}) {
  const list = await surahs();
  const s = list.find(x => x.id === id);
  const verses = await surah(id);
  from = Math.max(1, Math.min(from, s.n)); to = Math.max(from, Math.min(to, s.n));
  const pick = verses.slice(from - 1, to).map((v, k) => ({ no: from + k, ar: v[0], tr: v[1] }));
  if (mode === 'one') {
    return [{
      main: pick.map(v => `${v.ar} (${arNum(v.no)})`).join(' '),
      sub: meal ? pick.map(v => v.tr).join(' ') : '',
      src: `${s.tr} Sûresi, ${from === to ? from : `${from}-${to}`}`, tag, ref: { s: id, from, to }
    }];
  }
  return pick.map(v => ({ main: v.ar, sub: meal ? v.tr : '', src: `${s.tr} Sûresi, ${v.no}`, tag, ref: { s: id, from: v.no, to: v.no } }));
}
