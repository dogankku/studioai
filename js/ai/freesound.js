// Freesound kütüphanesi: müzik ve efekt araması, önizleme dosyası indirme. Anahtar yalnızca tarayıcıda durur.
const API = 'https://freesound.org/apiv2/search/text/';

export async function freesoundSearch(key, q, { type = 'music', cc0 = false, page = 1, signal } = {}) {
  const dur = type === 'music' ? 'duration:[20 TO 900]' : 'duration:[0 TO 10]';
  const lic = cc0 ? 'license:"Creative Commons 0"' : 'license:("Creative Commons 0" OR "Attribution")';
  const u = `${API}?query=${encodeURIComponent(q)}&token=${encodeURIComponent(key)}&page=${page}&page_size=20&sort=score` +
    `&fields=id,name,previews,duration,license,username,tags,avg_rating,num_downloads&filter=${encodeURIComponent(dur + ' ' + lic)}`;
  const r = await fetch(u, { signal });
  if (r.status === 401 || r.status === 403) throw new Error('Freesound anahtarı geçersiz');
  if (r.status === 429) throw new Error('Freesound istek sınırı doldu, biraz sonra deneyin');
  if (!r.ok) throw new Error('Freesound yanıt vermedi (' + r.status + ')');
  const j = await r.json();
  return (j.results || []).map(x => ({
    id: x.id, name: x.name, dur: x.duration, user: x.username, tags: (x.tags || []).slice(0, 6).join(', '),
    license: /0$|Zero|publicdomain/i.test(x.license || '') ? 'CC0' : /by\//i.test(x.license || '') || /Attribution/i.test(x.license || '') ? 'CC BY' : 'diğer',
    url: (x.previews && (x.previews['preview-hq-mp3'] || x.previews['preview-lq-mp3'])) || '',
    page: `https://freesound.org/s/${x.id}/`, downloads: x.num_downloads || 0
  })).filter(x => x.url);
}
export async function freesoundTest(key) { await freesoundSearch(key, 'piano', { type: 'music' }); return true; }
export async function freesoundFetch(hit, signal) {
  const r = await fetch(hit.url, { signal });
  if (!r.ok) throw new Error('Ses indirilemedi (' + r.status + ')');
  return r.blob();
}
