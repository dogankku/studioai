// Ses: kâri tilaveti (Quran.com / EveryAyah kayıtları, kelime zamanlarıyla) ve Türkçe seslendirme (Piper, tarayıcıda)
import { getFile, putFile } from '../storage.js';
import { decodeBlob } from '../audio.js';

export const RECITERS = {
  7: { name: 'Mişari Raşid el-Afasi', ea: 'Alafasy_128kbps' },
  2: { name: 'Abdulbasit Abdussamed (murattal)', ea: 'Abdul_Basit_Murattal_192kbps' },
  1: { name: 'Abdulbasit Abdussamed (mücevved)', ea: 'Abdul_Basit_Mujawwad_128kbps' },
  6: { name: 'Mahmud Halil el-Husari', ea: 'Husary_128kbps' },
  9: { name: 'Muhammed Sıddık el-Minşavi', ea: 'Minshawy_Murattal_128kbps' },
  3: { name: 'Abdurrahman es-Sudeys', ea: 'Abdurrahmaan_As-Sudais_192kbps' },
  10: { name: 'Suud eş-Şureym', ea: 'Saood_ash-Shuraym_128kbps' },
  4: { name: 'Ebu Bekir eş-Şatri', ea: 'Abu_Bakr_Ash-Shaatree_128kbps' },
  5: { name: 'Hani er-Rifai', ea: 'Hani_Rifai_192kbps' }
};
const pad = n => String(n).padStart(3, '0');

/** Quran.com kelime zaman dilimlerini [{w, s, e}] (ms) biçimine çevirir; farklı biçimlere dayanıklı */
function parseSegments(segs) {
  if (!Array.isArray(segs)) return [];
  if (segs.length === 1 && Array.isArray(segs[0]) && Array.isArray(segs[0][0])) segs = segs[0];
  const out = [];
  for (const g of segs) {
    if (!Array.isArray(g) || g.length < 3) continue;
    const n = g.map(Number);
    if (n.length >= 4) out.push({ w: n[1], s: n[2], e: n[3] }); // [sıra(0), kelime no(1 tabanlı), başlangıç ms, bitiş ms]
    else if (n[1] < n[2] && n[0] < 400) out.push({ w: n[0], s: n[1], e: n[2] });
    else out.push({ w: n[2], s: n[0], e: n[0] + n[1] });
  }
  return out.filter(x => x.w >= 0 && isFinite(x.s)).sort((a, b) => a.s - b.s);
}

async function fetchBlob(url) { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.blob(); }

/**
 * Bir ayetin tilavetini getirir (önbellekli). Dönüş: {buffer, words:[başlangıç sn] | null, source}
 * words: ayetin kelime sayısına göre (nWords) eşlenmiş başlangıç zamanları
 */
export async function getRecitation(reciter, s, a, nWords, onStatus = () => { }) {
  const key = `rec:${reciter}:${s}:${a}`;
  let rec = await getFile(key);
  if (!rec) {
    let blob = null, segs = [], source = '';
    try {
      onStatus('Quran.com kaydı alınıyor…');
      const r = await fetch(`https://api.quran.com/api/v4/recitations/${reciter}/by_ayah/${s}:${a}?fields=segments`);
      if (r.ok) {
        const j = await r.json(); const f = j.audio_files && j.audio_files[0];
        if (f) {
          segs = parseSegments(f.segments);
          let u = f.url || ''; if (u.startsWith('//')) u = 'https:' + u; else if (!/^https?:/.test(u)) u = 'https://verses.quran.com/' + u.replace(/^\//, '');
          blob = await fetchBlob(u); source = 'quran.com';
        }
      }
    } catch (e) { blob = null; }
    if (!blob) {
      onStatus('EveryAyah kaydı alınıyor…');
      const ea = RECITERS[reciter] ? RECITERS[reciter].ea : RECITERS[7].ea;
      blob = await fetchBlob(`https://everyayah.com/data/${ea}/${pad(s)}${pad(a)}.mp3`); source = 'everyayah.com';
    }
    rec = { id: key, kind: 'cache', name: key, type: blob.type, blob, segs, source, order: Date.now() };
    putFile(rec);
  }
  const buffer = await decodeBlob(rec.blob);
  let words = null;
  if (rec.segs && rec.segs.length) {
    // kelime indeksleri 1 tabanlıdır; bizim kelime sayımız farklıysa orantıla
    const segs = rec.segs.filter(x => x.w >= 1);
    const maxW = Math.max(...segs.map(x => x.w));
    words = new Array(nWords).fill(null);
    for (const g of segs) {
      const k = maxW === nWords ? g.w - 1 : Math.round((g.w - 1) * (nWords - 1) / Math.max(1, maxW - 1));
      if (k >= 0 && k < nWords && words[k] == null) words[k] = g.s / 1000;
    }
    for (let k = 0; k < nWords; k++) if (words[k] == null) words[k] = k ? words[k - 1] + 0.3 : 0.2;
    for (let k = 1; k < nWords; k++) if (words[k] < words[k - 1]) words[k] = words[k - 1] + 0.05;
  } else {
    // zaman bilgisi yoksa: sessizlikleri atla, kelimeleri sesli kısma eşit yay
    const d = buffer.getChannelData(0), sr = buffer.sampleRate; const win = Math.round(sr * 0.02);
    let st = 0, en = buffer.duration;
    for (let i = 0; i < d.length; i += win) { let e = 0; for (let j = i; j < Math.min(d.length, i + win); j++) e += d[j] * d[j]; if (Math.sqrt(e / win) > 0.02) { st = i / sr; break; } }
    for (let i = d.length - win; i > 0; i -= win) { let e = 0; for (let j = i; j < i + win; j++) e += d[j] * d[j]; if (Math.sqrt(e / win) > 0.02) { en = (i + win) / sr; break; } }
    words = Array.from({ length: nWords }, (_, k) => st + (en - st) * k / Math.max(1, nWords));
  }
  return { buffer, words, source: rec.source };
}

/* ---------------- Türkçe seslendirme (Piper) ---------------- */
export const VOICES = { 'tr_TR-dfki-medium': 'Erkek (dfki)', 'tr_TR-fahrettin-medium': 'Erkek (Fahrettin)', 'tr_TR-fettah-medium': 'Erkek (Fettah)' };
let piperMod = null; const sessions = new Map();
async function piper() { if (!piperMod) piperMod = await import('../../vendor/piper-bundle.js'); return piperMod; }

export async function voiceReady(voiceId) { try { const P = await piper(); return (await P.stored()).includes(voiceId); } catch (e) { return false; } }
export async function downloadVoice(voiceId, onProgress = () => { }) {
  const P = await piper(); await P.download(voiceId, p => onProgress(p.total ? p.loaded / p.total : 0));
}

/** Metni seslendirir (önbellekli), AudioBuffer döner */
export async function speak(text, voiceId, onStatus = () => { }) {
  const clean = (text || '').replace(/\s+/g, ' ').trim(); if (!clean) return null;
  let h = 0; for (const c of voiceId + clean) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const key = `tts:${h.toString(36)}:${clean.length}`;
  let rec = await getFile(key);
  if (!rec) {
    onStatus('Seslendiriliyor…');
    const P = await piper();
    let ses = sessions.get(voiceId);
    if (!ses) { ses = await P.TtsSession.create({ voiceId, progress: p => onStatus(`Ses modeli indiriliyor %${p.total ? Math.round(p.loaded / p.total * 100) : 0}`) }); sessions.set(voiceId, ses); }
    const blob = await ses.predict(clean);
    rec = { id: key, kind: 'cache', name: key, type: 'audio/wav', blob, order: Date.now() };
    putFile(rec);
  }
  return await decodeBlob(rec.blob);
}
