// Format motoru: serbest metni profesyonel video formatlarına göre sahnelere böler.
// Sahne: { kind, tag, main, sub, num, cta, src, vo, q }
//   kind: hook | point | item | quote | problem | solution | feature | price | cta
//   vo: seslendirilecek metin (yoksa main + sub okunur), q: çekim arama ipucu
import { ollamaChat, parseJSONLoose } from './ai/local.js?v=202611221618';

export const FORMATS = {
  bilgi: {
    name: 'Bilgi / eğitim', icon: '💡', desc: 'Dikkat çeken giriş, maddeler hâlinde bilgi, kapanış çağrısı',
    style: 'modern', titleLabel: 'Konu başlığı', ctaDefault: 'Daha fazlası için takip et',
    placeholder: 'Anlatmak istediğiniz bilgileri yazın. Her paragraf ayrı bir sahne olur.\n\nÖrnek:\nUyku, beynin kendini temizlediği zamandır. Gün boyu biriken atıklar uykuda atılır.\n\nYetişkinlerin gecede 7–9 saat uykuya ihtiyacı vardır.\n\nUykusuzluk dikkat, hafıza ve bağışıklığı zayıflatır.'
  },
  liste: {
    name: 'Liste (Top 5)', icon: '🔢', desc: 'Numaralı maddeler, her biri ayrı başlık ve açıklama',
    style: 'neonliste', titleLabel: 'Liste başlığı', ctaDefault: 'Hangisini biliyordun? Yorumlara yaz',
    placeholder: 'Her satır ya da paragraf bir madde olur. "Başlık: açıklama" yazarsanız başlık büyük gösterilir.\n\nÖrnek:\nKapadokya: Peri bacaları ve balon turlarıyla ünlü\nPamukkale: Bembeyaz traverten teraslar\nEfes: Antik dünyanın en iyi korunmuş kenti\nSümela: Kayalara oyulmuş manastır\nNemrut: Dev heykellerin arasında gün doğumu'
  },
  soz: {
    name: 'Söz / motivasyon', icon: '✨', desc: 'Tek güçlü söz ya da alıntı, sinematik ve sakin',
    style: 'gercek', titleLabel: 'Üst başlık (isteğe bağlı)', ctaDefault: '',
    placeholder: 'Sözü yazın. Son satıra "— Söyleyen" yazarsanız imza olarak gösterilir.\n\nÖrnek:\nBin kilometrelik bir yolculuk, tek bir adımla başlar.\n— Lao Tzu'
  },
  urun: {
    name: 'Ürün / marka tanıtımı', icon: '🛍️', desc: 'Sorun, çözüm, özellikler, fiyat ve çağrı, logo kapanışı',
    style: 'marka', titleLabel: 'Ürün / marka adı', ctaDefault: 'Hemen sipariş ver',
    placeholder: 'Ürününüzü anlatın. İlk paragraf müşterinin sorunu, ikinci paragraf çözüm olur. "-" ile başlayan satırlar özellik, fiyat geçen satır fiyat sahnesi olur.\n\nÖrnek:\nSabah kahven hep soğuk mu kalıyor?\n\nIsıKupa, içeceğini saatlerce ilk günkü sıcaklıkta tutar.\n- 12 saat sıcak, 24 saat soğuk\n- Tek elle açılan sızdırmaz kapak\n- Bulaşık makinesinde yıkanabilir\nŞimdi sadece 349 TL'
  }
};

const sentences = t => (t || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+(?=[A-ZÇĞİÖŞÜ0-9"“'(])/).filter(Boolean);
const words = t => (t || '').trim().split(/\s+/).filter(Boolean);
const paras = t => (t || '').replace(/\r/g, '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
const lines = t => (t || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
const BULLET = /^\s*(?:[-–—•*✓✔►▶]|\d{1,2}[.)\-:]|\(\d{1,2}\))\s*/;
const PRICE = /(₺|\bTL\b|\$|€|£|fiyat|indirim|kampanya|sadece|yalnızca|%\s*\d|\d+\s*%)/i;

/** Uzun bir paragraftan kısa başlık + açıklama çıkar */
function headBody(p) {
  const m = p.match(/^([^:\n]{2,60}):\s*(.+)$/s);
  if (m) return { main: m[1].trim(), sub: m[2].trim() };
  const ss = sentences(p);
  if (ss.length > 1 && words(ss[0]).length <= 12) return { main: ss[0].replace(/[.:]$/, ''), sub: ss.slice(1).join(' ') };
  if (words(p).length <= 12) return { main: p.replace(/[.:]$/, ''), sub: '' };
  // tek uzun cümle: ilk 6-8 kelime başlık, devamı açıklama
  const w = words(p); const k = Math.min(8, Math.max(5, Math.round(w.length * 0.35)));
  return { main: w.slice(0, k).join(' ') + '…', sub: '…' + w.slice(k).join(' '), vo: p };
}
const clean = s => (s || '').replace(BULLET, '').trim();

/** Kural tabanlı dönüştürücü (anında, yapay zekâ gerekmez) */
export function toScenes(fmt, brief) {
  const { title = '', text = '', cta = '', author = '', brand = '', countdown = false } = brief;
  const F = FORMATS[fmt] || FORMATS.bilgi;
  const out = [];
  const ctaText = (cta || F.ctaDefault || '').trim();
  if (fmt === 'liste') {
    let its = lines(text).filter(l => BULLET.test(l) || !/[.!?]$/.test(l) || true).map(clean).filter(Boolean);
    const ps = paras(text); if (ps.length > 1 && ps.length >= its.length / 2 && ps.every(p => p.includes('\n'))) its = ps.map(clean);
    const n = its.length;
    out.push({ kind: 'hook', tag: n ? `TOP ${n}` : '', main: title || (n ? `Bilmeniz gereken ${n} şey` : 'Liste'), sub: '', vo: title || '' });
    its.forEach((t, k) => { const hb = headBody(t); const num = countdown ? n - k : k + 1; out.push({ kind: 'item', num: String(num), main: hb.main, sub: hb.sub, vo: `${num}. ${hb.vo || [hb.main, hb.sub].filter(Boolean).join('. ')}` }); });
  } else if (fmt === 'soz') {
    const ls = lines(text); let who = author;
    const last = ls[ls.length - 1] || '';
    if (!who && /^[—–-]\s*\S/.test(last)) { who = last.replace(/^[—–-]\s*/, ''); ls.pop(); }
    const q = ls.join(' ').replace(/^["“]|["”]$/g, '');
    if (title) out.push({ kind: 'hook', tag: '', main: title, sub: '', vo: '' });
    out.push({ kind: 'quote', main: q, sub: '', src: who, vo: q + (who ? ` ${who}.` : '') });
  } else if (fmt === 'urun') {
    const ps = paras(text); const name = (brand || title || '').trim();
    const feats = [], plain = []; let price = '';
    for (const p of ps) for (const l of (p.includes('\n') ? lines(p) : [p])) {
      if (BULLET.test(l)) feats.push(clean(l)); else if (PRICE.test(l) && words(l).length <= 14) price = l; else plain.push(l);
    }
    if (plain[0]) out.push({ kind: 'problem', tag: '', main: plain[0], sub: '', vo: plain[0] });
    if (plain[1] || name) { const hb = plain[1] ? headBody(plain[1]) : { main: name, sub: '' }; out.push({ kind: 'solution', tag: name && plain[1] ? name.toLocaleUpperCase('tr') : '', main: plain[1] && name && !plain[1].includes(name) ? name : hb.main, sub: plain[1] && name && !plain[1].includes(name) ? plain[1] : hb.sub, vo: plain[1] || name }); }
    for (const l of plain.slice(2)) { const hb = headBody(l); out.push({ kind: 'point', main: hb.main, sub: hb.sub, vo: l }); }
    feats.forEach((f, k) => { const hb = headBody(f); out.push({ kind: 'feature', num: '✓', main: hb.main, sub: hb.sub, vo: f }); });
    if (price) out.push({ kind: 'price', tag: 'ŞİMDİ', main: price, sub: '', vo: price });
  } else { // bilgi
    const ps = paras(text).length > 1 ? paras(text) : sentences(text).reduce((acc, s) => { const l = acc[acc.length - 1]; if (l && words(l).length + words(s).length <= 22) acc[acc.length - 1] = l + ' ' + s; else acc.push(s); return acc; }, []);
    out.push({ kind: 'hook', tag: 'BİLİYOR MUYDUNUZ?', main: title || (ps[0] ? headBody(ps[0]).main : 'Bilgi'), sub: '', vo: title || '' });
    ps.forEach((p, k) => { const hb = headBody(p); out.push({ kind: 'point', num: ps.length > 1 ? String(k + 1) : '', main: hb.main, sub: hb.sub, vo: hb.vo || p }); });
  }
  if (ctaText && fmt !== 'soz') out.push({ kind: 'cta', tag: fmt === 'urun' && (brand || title) ? (brand || title).toLocaleUpperCase('tr') : '', main: fmt === 'urun' ? (brand || title || ctaText) : ctaText, cta: fmt === 'urun' ? ctaText : (fmt === 'liste' ? 'YORUMLA 💬' : 'TAKİP ET ➜'), sub: '', vo: ctaText, logo: fmt === 'urun' });
  return out.filter(s => s.main || s.sub);
}

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    scenes: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string' }, tag: { type: 'string' }, main: { type: 'string' }, sub: { type: 'string' }, vo: { type: 'string' }, q: { type: 'string' } }, required: ['kind', 'main', 'vo'] } },
    cta: { type: 'string' },
    youtubeTitle: { type: 'string' }, description: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } }
  },
  required: ['scenes']
};
const GUIDE = {
  bilgi: 'Yapı: 1) "hook": merak uyandıran, 3-8 kelimelik giriş sorusu ya da şaşırtıcı bilgi. 2) 3-6 adet "point": her birinde kısa başlık (main, en çok 7 kelime) ve tek cümlelik açıklama (sub, en çok 18 kelime). 3) "cta": kısa kapanış çağrısı.',
  liste: 'Yapı: 1) "hook": "X Şey" biçiminde liste başlığı. 2) Her madde için bir "item": main = madde adı (en çok 5 kelime), sub = tek cümle açıklama (en çok 15 kelime). 3) "cta": izleyiciyi yoruma çağıran kısa cümle.',
  soz: 'Yapı: tek bir "quote" sahnesi: main = sözün kendisi (değiştirme, yalnızca yazım hatalarını düzelt), sub boş. İsteğe bağlı başta kısa bir "hook" (en çok 6 kelime).',
  urun: 'Yapı: 1) "problem": müşterinin sorununu soran kısa cümle. 2) "solution": main = ürün adı, sub = ürünün sorunu nasıl çözdüğü (tek cümle). 3) 2-5 "feature": main = özellik (en çok 6 kelime), sub boş ya da çok kısa. 4) varsa "price": fiyat/kampanya. 5) "cta": satın alma çağrısı.'
};

/** Yapay zekâ ile senaryo: kullanıcının bilgisini formata uygun, kısa ve etkili sahnelere çevirir */
export async function aiScenes(fmt, brief, { url, model, signal, onStatus = () => { } } = {}) {
  const F = FORMATS[fmt] || FORMATS.bilgi;
  const sys = 'Sen kısa video (Reels, Shorts, TikTok) senaristisin. Türkçe yazarsın. Ekranda okunacak metinler çok kısa ve vurucu olmalı; seslendirme metni (vo) doğal konuşma dilinde, sahnedeki yazıyı açıklayan 1-2 cümle olmalı. Kullanıcının verdiği bilgilerin dışına çıkma, bilgi uydurma. Her sahneye uygun stok video aramak için İngilizce 2-3 kelimelik arama ifadesi (q) yaz (insan içermeyen sahneler tercih et). Yalnızca JSON döndür.';
  const user = `Format: ${F.name}. ${GUIDE[fmt] || GUIDE.bilgi}
${brief.title ? `Başlık/konu: ${brief.title}\n` : ''}${brief.brand ? `Marka: ${brief.brand}\n` : ''}${brief.cta ? `İstenen çağrı: ${brief.cta}\n` : ''}Bilgiler:
"""
${(brief.text || '').slice(0, 4000)}
"""
Ayrıca YouTube başlığı (youtubeTitle), 2-3 cümlelik açıklama (description) ve 5-8 hashtag yaz.`;
  onStatus('Senaryo yazılıyor… (Intel işlemcide birkaç dakika sürebilir)');
  const raw = await ollamaChat(url, model, [{ role: 'system', content: sys }, { role: 'user', content: user }], { schema: SCHEMA, temperature: 0.5, signal, onToken: n => onStatus(`Senaryo yazılıyor… ${n} parça`) });
  const j = parseJSONLoose(raw);
  if (!j || !Array.isArray(j.scenes) || !j.scenes.length) throw new Error('Model geçerli bir senaryo döndürmedi, tekrar deneyin');
  let k = 0; const n = j.scenes.filter(s => s.kind === 'item').length;
  const scenes = j.scenes.map(s => {
    const kind = (s.kind || 'point').toLowerCase();
    const sc = { kind, tag: s.tag || '', main: (s.main || '').trim(), sub: (s.sub || '').trim(), vo: (s.vo || '').trim(), q: (s.q || '').trim() };
    if (kind === 'item') { k++; sc.num = String(brief.countdown ? n - k + 1 : k); }
    if (kind === 'feature') sc.num = '✓';
    if (kind === 'hook' && fmt === 'liste' && !sc.tag && n) sc.tag = `TOP ${n}`;
    if (kind === 'hook' && fmt === 'bilgi' && !sc.tag) sc.tag = 'BİLİYOR MUYDUNUZ?';
    if (kind === 'cta') { sc.cta = fmt === 'urun' ? (brief.cta || sc.main) : (fmt === 'liste' ? 'YORUMLA 💬' : 'TAKİP ET ➜'); if (fmt === 'urun') { sc.main = brief.brand || brief.title || sc.main; sc.logo = true; } }
    if (kind === 'quote' && brief.author) sc.src = brief.author;
    return sc;
  }).filter(s => s.main);
  const share = [j.youtubeTitle, j.description, (j.hashtags || []).map(h => h.startsWith('#') ? h : '#' + h.replace(/\s+/g, '')).join(' ')].filter(Boolean).join('\n\n');
  return { scenes, share, title: j.title || brief.title || '' };
}
