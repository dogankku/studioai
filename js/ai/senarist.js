// AI senarist: konuya uygun ayetleri yerel mealde arar, yerel dil modeline seçtirir ve kurgu yazdırır.
// Ayet metinleri ASLA modelden alınmaz; her zaman doğrulanmış yerel veriden gelir.
import { surahs, surah } from '../quran.js';
import { ollamaChat, parseJSONLoose } from './local.js';
import { STYLES, SCENES } from '../film/styles.js';

let INDEX = null;
const norm = s => (s || '').toLocaleLowerCase('tr').replace(/[^a-zçğıöşüâîû\s]/g, ' ');
const stem = w => w.length <= 4 ? w : w.slice(0, Math.max(4, Math.min(6, w.length - 1)));
const STOP = new Set('ve ile bir bu şu o da de ki ne için gibi daha en çok her hiç olan olarak onlar biz siz ben sen ama fakat ancak eğer şüphesiz elbette ise diye kadar sonra önce artık işte hem ya veya mi mı mu mü değil yok var'.split(' '));

export async function buildIndex(onProgress = () => { }) {
  if (INDEX) return INDEX;
  const list = await surahs();
  const verses = []; const df = new Map();
  for (let i = 0; i < list.length; i++) {
    const s = list[i]; const vs = await surah(s.id);
    vs.forEach((v, k) => {
      const toks = norm(v[1]).split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem);
      const set = new Set(toks); set.forEach(t => df.set(t, (df.get(t) || 0) + 1));
      verses.push({ s: s.id, a: k + 1, sname: s.tr, ar: v[0], tr: v[1], toks });
    });
    if (i % 10 === 0) onProgress(i / list.length);
  }
  INDEX = { verses, df, N: verses.length };
  return INDEX;
}

export async function searchVerses(words, n = 30, boost = []) {
  const I = await buildIndex();
  const q = [...new Set(words.flatMap(w => norm(w).split(/\s+/)).filter(w => w.length > 2 && !STOP.has(w)).map(stem))];
  const B = new Set(boost.flatMap(w => norm(w).split(/\s+/)).filter(w => w.length > 2 && !STOP.has(w)).map(stem));
  if (!q.length) return [];
  const idf = t => Math.log(1 + I.N / (1 + (I.df.get(t) || 0)));
  const scored = [];
  for (const v of I.verses) {
    let sc = 0, hit = 0;
    for (const t of q) { const c = v.toks.filter(x => x === t).length; if (c) { sc += idf(t) * (1 + Math.log(c)) * (B.has(t) ? 2 : 1); hit++; } }
    if (sc > 0) scored.push({ v, sc: sc * (1 + hit * 0.5) / Math.sqrt(8 + v.toks.length) });
  }
  return scored.sort((a, b) => b.sc - a.sc).slice(0, n).map(x => x.v);
}

const TONES = { huzur: 'huzur veren, sakin', umut: 'umut veren, teselli edici', dusunce: 'düşündüren, derin', coskun: 'coşkulu, heyecan verici' };

/**
 * Konudan senaryo. opts: {url, model, topic, ayahCount, tone, seconds, narration, onStatus}
 * Dönen plan: {title, hook, closing, style, items:[{s,a,ar,tr,sname,scene,image}], youtubeTitle, description, hashtags}
 */
export async function writeScript(opts) {
  const { url, model, topic, ayahCount = 3, tone = 'huzur', seconds = 60, narration = true, onStatus = () => { }, signal } = opts;
  onStatus('Anahtar kelimeler çıkarılıyor…');
  const kwRaw = await ollamaChat(url, model, [
    { role: 'system', content: 'Türkçe konuşan yardımcı bir asistansın. Yalnızca JSON döndür.' },
    { role: 'user', content: `Konu: "${topic}". Bu konuyla ilgili Kur'an meallerinde geçebilecek 10-15 Türkçe anahtar kelime ve eş anlamlı yaz (tek kelimeler, kök halinde). JSON: {"kelimeler": ["...", "..."]}` }
  ], { schema: { type: 'object', properties: { kelimeler: { type: 'array', items: { type: 'string' } } }, required: ['kelimeler'] }, temperature: 0.3, signal, onToken: n => onStatus(`Anahtar kelimeler çıkarılıyor… (${n})`) });
  const kw = (parseJSONLoose(kwRaw) || {}).kelimeler || [];
  onStatus('Mealde aranıyor…');
  await buildIndex(p => onStatus(`Meal dizini hazırlanıyor %${Math.round(p * 100)}`));
  const cands = await searchVerses([topic, ...kw], 28, [topic]);
  if (!cands.length) throw new Error('Bu konuyla eşleşen ayet bulunamadı. Konuyu farklı kelimelerle yazın.');
  const candText = cands.map((v, i) => `[${i}] ${v.sname} ${v.a}: ${v.tr}`).join('\n');
  const styleKeys = Object.keys(STYLES), sceneKeys = Object.keys(SCENES);
  onStatus('Senaryo yazılıyor… (Intel işlemcide birkaç dakika sürebilir)');
  const schema = {
    type: 'object',
    properties: {
      baslik: { type: 'string' }, giris: { type: 'string' }, kapanis: { type: 'string' },
      stil: { type: 'string', enum: styleKeys },
      ayetler: { type: 'array', items: { type: 'object', properties: { no: { type: 'integer' }, sahne: { type: 'string', enum: sceneKeys }, gorsel: { type: 'string' } }, required: ['no', 'sahne', 'gorsel'] } },
      youtube_baslik: { type: 'string' }, aciklama: { type: 'string' }, etiketler: { type: 'array', items: { type: 'string' } }
    },
    required: ['baslik', 'giris', 'kapanis', 'stil', 'ayetler', 'youtube_baslik', 'aciklama', 'etiketler']
  };
  const prompt = `Konu: "${topic}". Üslup: ${TONES[tone] || tone}. Hedef süre: yaklaşık ${seconds} saniye.
Aşağıdaki aday ayetlerden konuya EN uygun ${ayahCount} tanesini seç (yalnızca köşeli parantezdeki numarayı ver, ayet metni yazma). Anlamlı bir sıraya koy.
${candText}

Kurallar:
- "giris": izleyiciyi yakalayan 1 kısa Türkçe cümle (en çok 14 kelime). Ayet ya da hadis uydurma, alıntı yapma; kendi cümlen olsun.
- "kapanis": 1 kısa Türkçe kapanış cümlesi (en çok 14 kelime), yine uydurma alıntı yok.
- "stil": şunlardan biri: ${styleKeys.join(', ')}.
- her ayet için "sahne": ${sceneKeys.join(', ')} içinden biri; "gorsel": o ayete uygun, İNSAN İÇERMEYEN bir manzara için kısa İngilizce görsel tarifi (ör. "golden desert dunes at sunset, soft light, cinematic").
- "youtube_baslik": en çok 70 karakter. "aciklama": 2-3 cümle. "etiketler": 8-12 hashtag (# işaretsiz).
Yalnızca JSON döndür.`;
  let plan = null;
  for (let tries = 0; tries < 2 && !plan; tries++) {
    const raw = await ollamaChat(url, model, [{ role: 'system', content: 'Sen Türkçe yazan, dini konularda saygılı ve dikkatli bir video senaristisin. Ayet metni ya da hadis uydurmazsın. Yalnızca JSON döndürürsün.' }, { role: 'user', content: prompt }],
      { schema, temperature: 0.5, signal, onToken: n => onStatus(`Senaryo yazılıyor… ${n} parça`) });
    plan = parseJSONLoose(raw);
    if (plan && (!Array.isArray(plan.ayetler) || !plan.ayetler.length)) plan = null;
  }
  if (!plan) throw new Error('Model geçerli bir senaryo döndürmedi. Tekrar deneyin ya da daha büyük bir model seçin.');
  const used = new Set();
  const items = plan.ayetler.map(x => cands[x.no] ? { ...cands[x.no], scene: sceneKeys.includes(x.sahne) ? x.sahne : null, image: (x.gorsel || '').slice(0, 300) } : null)
    .filter(v => v && !used.has(v.s + ':' + v.a) && used.add(v.s + ':' + v.a)).slice(0, ayahCount);
  if (!items.length) items.push(...cands.slice(0, ayahCount).map(v => ({ ...v, scene: null, image: '' })));
  return {
    title: plan.baslik || topic, hook: narration ? (plan.giris || '') : '', closing: narration ? (plan.kapanis || '') : '',
    style: styleKeys.includes(plan.stil) ? plan.stil : null, items,
    youtubeTitle: plan.youtube_baslik || plan.baslik || topic, description: plan.aciklama || '',
    hashtags: (plan.etiketler || []).map(t => String(t).replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean).slice(0, 15)
  };
}
