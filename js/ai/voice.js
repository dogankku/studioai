// Türkçe seslendirme (Piper, tarayıcıda, ücretsiz)
import { getFile, putFile } from '../storage.js';
import { decodeBlob } from '../audio.js';

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
