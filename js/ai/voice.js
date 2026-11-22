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

/** Metni seslendirir (önbellekli), AudioBuffer döner. o: {speed, pitch, pause} */
export async function speak(text, voiceId, onStatus = () => { }, o = {}) {
  const speed = +o.speed || 1, pitch = +o.pitch || 1, pause = +o.pause || 0;
  const clean = (text || '').replace(/\s+/g, ' ').trim(); if (!clean) return null;
  // cümle arası durak istenirse cümleleri ayrı seslendirip araya sessizlik koy
  const parts = pause > 0 ? clean.split(/(?<=[.!?…])\s+/).filter(Boolean) : [clean];
  const bufs = [];
  for (const p of parts) bufs.push(await speakOne(p, voiceId, onStatus, speed, pitch));
  if (bufs.length === 1) return bufs[0];
  const sr = bufs[0].sampleRate, gap = Math.round(pause * sr), len = bufs.reduce((a, b) => a + b.length, 0) + gap * (bufs.length - 1);
  const out = new AudioBuffer({ numberOfChannels: 1, length: len, sampleRate: sr }); const d = out.getChannelData(0); let at = 0;
  for (const [k, b] of bufs.entries()) { d.set(b.getChannelData(0), at); at += b.length + (k < bufs.length - 1 ? gap : 0); }
  return out;
}
async function speakOne(clean, voiceId, onStatus, speed, pitch) {
  let h = 0; for (const c of voiceId + clean + speed + ':' + pitch) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const key = `tts:${h.toString(36)}:${clean.length}`;
  let rec = await getFile(key);
  if (!rec) {
    onStatus('Seslendiriliyor…');
    const P = await piper();
    let ses = sessions.get(voiceId);
    if (!ses) { ses = await P.TtsSession.create({ voiceId, progress: p => onStatus(`Ses modeli indiriliyor %${p.total ? Math.round(p.loaded / p.total * 100) : 0}`) }); sessions.set(voiceId, ses); }
    // ton: daha yavaş üret, sonra hızlı çal (süre korunur, ses incelir/kalınlaşır)
    globalThis.__piperLS = pitch / speed;
    let blob; try { blob = await ses.predict(clean); } finally { globalThis.__piperLS = 1; }
    rec = { id: key, kind: 'cache', name: key, type: 'audio/wav', blob, order: Date.now() };
    putFile(rec);
  }
  const buf = await decodeBlob(rec.blob);
  if (Math.abs(pitch - 1) < 0.01) return buf;
  const len = Math.ceil(buf.length / pitch);
  const oc = new OfflineAudioContext(1, len, buf.sampleRate); const src = oc.createBufferSource(); src.buffer = buf; src.playbackRate.value = pitch; src.connect(oc.destination); src.start();
  return oc.startRendering();
}
