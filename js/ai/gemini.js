// Google Gemini: senaryo / çeviri / takvim (metin) ve doğal seslendirme (TTS).
// Tarayıcıdan doğrudan çağrılır; anahtar yalnızca bu tarayıcıda saklanır.
import { addCost, GM_PRICE } from './cost.js?v=202611271249';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const GM_VOICES = {
  Kore: 'Kadın · net, kararlı', Aoede: 'Kadın · ferah', Leda: 'Kadın · genç', Zephyr: 'Kadın · parlak', Autonoe: 'Kadın · sıcak',
  Sulafat: 'Kadın · yumuşak', Despina: 'Kadın · akıcı', Achernar: 'Kadın · sakin',
  Charon: 'Erkek · bilgilendirici', Puck: 'Erkek · neşeli', Fenrir: 'Erkek · heyecanlı', Orus: 'Erkek · tok',
  Iapetus: 'Erkek · berrak', Algieba: 'Erkek · pürüzsüz', Alnilam: 'Erkek · güçlü', Schedar: 'Erkek · dengeli', Sadaltager: 'Erkek · bilgili'
};

let modelCache = null;
async function call(key, path, body, signal) {
  const r = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET', signal,
    headers: { 'x-goog-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = (j.error && j.error.message) || r.statusText || 'istek başarısız';
    const e = new Error(r.status === 429 ? 'Gemini kotası doldu, biraz sonra tekrar deneyin (' + m.slice(0, 80) + ')' : r.status === 400 && /API key/i.test(m) ? 'Gemini anahtarı geçersiz' : 'Gemini: ' + m.slice(0, 160));
    e.status = r.status; throw e;
  }
  return j;
}

/** Kullanılabilir modelleri bulur (en yeni flash metin modeli ve TTS modeli) */
export async function geminiModels(key) {
  if (modelCache && modelCache.key === key) return modelCache;
  const names = [];
  let tok = '';
  for (let i = 0; i < 5; i++) {
    const j = await call(key, `/models?pageSize=200${tok ? '&pageToken=' + tok : ''}`);
    for (const m of j.models || []) names.push({ id: (m.name || '').replace(/^models\//, ''), methods: m.supportedGenerationMethods || [] });
    tok = j.nextPageToken; if (!tok) break;
  }
  const ver = id => { const m = id.match(/(\d+(?:\.\d+)?)/); return m ? +m[1] : 0; };
  const byVer = (a, b) => ver(b.id) - ver(a.id) || a.id.length - b.id.length;
  const textOk = n => /flash/.test(n.id) && !/tts|image|audio|live|embedding|thinking|exp|lite/.test(n.id) && (!n.methods.length || n.methods.includes('generateContent'));
  const text = names.filter(textOk).sort((a, b) => (/preview/.test(a.id) - /preview/.test(b.id)) || byVer(a, b))[0]
    || names.filter(n => /gemini/.test(n.id) && !/tts|image|embedding/.test(n.id)).sort(byVer)[0];
  const tts = names.filter(n => /tts/.test(n.id) && /flash/.test(n.id) && !/lite/.test(n.id)).sort((a, b) => (/preview/.test(a.id) - /preview/.test(b.id)) || byVer(a, b))[0]
    || names.filter(n => /tts/.test(n.id)).sort(byVer)[0];
  const image = names.filter(n => /nano-banana/.test(n.id)).sort(byVer)[0] || names.filter(n => /image/.test(n.id) && !/lite/.test(n.id) && !/imagen/.test(n.id)).sort((a, b) => (/preview/.test(a.id) - /preview/.test(b.id)) || byVer(a, b))[0];
  const video = names.filter(n => /omni/.test(n.id)).sort(byVer)[0] || names.filter(n => /veo/.test(n.id) && !/preview/.test(n.id)).sort(byVer)[0];
  modelCache = { key, text: text && text.id, tts: tts && tts.id, image: image && image.id, video: video && video.id, all: names.map(n => n.id) };
  return modelCache;
}

export async function geminiTest(key) {
  modelCache = null;
  const m = await geminiModels(key);
  if (!m.text) throw new Error('Bu anahtarla metin modeli bulunamadı');
  return m;
}

/** Ollama'daki ollamaChat ile aynı biçim: messages=[{role,content}] → ham metin (JSON istenirse JSON) */
export async function geminiChat(key, messages, { schema, temperature = 0.6, signal, onToken = () => { }, model } = {}) {
  const m = model || (await geminiModels(key)).text;
  const sys = messages.filter(x => x.role === 'system').map(x => x.content).join('\n\n');
  const contents = messages.filter(x => x.role !== 'system').map(x => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content + (schema && x === messages[messages.length - 1] ? '\n\nYanıt yalnızca şu JSON şemasına uyan geçerli JSON olsun:\n' + JSON.stringify(schema) : '') }] }));
  const body = { contents, generationConfig: { temperature, ...(schema ? { responseMimeType: 'application/json' } : {}) } };
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };
  let j;
  try { j = await call(key, `/models/${m}:generateContent`, body, signal); }
  catch (e) {
    if (e.status !== 404 && e.status !== 400) throw e;
    // yeni "interactions" uç noktası
    j = await call(key, '/interactions', { model: m, input: [{ type: 'user_input', content: [{ type: 'text', text: (sys ? sys + '\n\n' : '') + contents.map(c => c.parts[0].text).join('\n\n') }] }] }, signal);
    const out = (j.steps || []).filter(s => s.type === 'model_output').flatMap(s => s.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    if (!out) throw new Error('Gemini boş yanıt döndürdü');
    return out;
  }
  const um = j.usageMetadata || {}; addCost('gemini', ((um.promptTokenCount || 0) * GM_PRICE.textIn + ((um.candidatesTokenCount || 0) + (um.thoughtsTokenCount || 0)) * GM_PRICE.textOut) / 1e6, 'yazı');
  const c = (j.candidates || [])[0];
  const out = c && c.content && (c.content.parts || []).map(p => p.text || '').join('');
  if (!out) throw new Error(c && c.finishReason === 'SAFETY' ? 'Gemini bu metni güvenlik nedeniyle yazmadı' : 'Gemini boş yanıt döndürdü');
  return out;
}

function b64ToBytes(b64) { const s = atob(b64); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function pcmToWav(pcm, rate) {
  const h = new ArrayBuffer(44), v = new DataView(h), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length, true);
  return new Blob([h, pcm], { type: 'audio/wav' });
}
const toWav = (bytes, mime = '') => {
  addCost('gemini', Math.max(1, bytes.length / 48000) * GM_PRICE.ttsSec, 'ses');
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return new Blob([bytes], { type: 'audio/wav' });
  const r = +((mime.match(/rate=(\d+)/) || [])[1] || 24000);
  return pcmToWav(bytes, r);
};

/** Metni Gemini sesiyle okutur → WAV Blob. style: "Enerjik ve samimi" gibi anlatım yönergesi */
export async function geminiSpeak(key, text, { voice = 'Kore', style = '', signal, model } = {}) {
  const m = model || (await geminiModels(key)).tts;
  if (!m) throw new Error('Bu anahtarla Gemini ses modeli bulunamadı');
  // önce yeni interactions uç noktası, olmazsa generateContent
  try {
    const content = { type: 'text', text, ...(style ? { annotations: [{ type: 'speech_metadata', style }] } : {}) };
    const j = await call(key, '/interactions', { model: m, input: [{ type: 'user_input', content: [content] }], response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice }] } }, signal);
    const a = (j.steps || []).filter(s => s.type === 'model_output').flatMap(s => s.content || []).filter(c => c.type === 'audio').pop();
    if (a && a.data) return toWav(b64ToBytes(a.data), a.mime_type || a.mimeType || '');
    throw Object.assign(new Error('ses yok'), { status: 404 });
  } catch (e) {
    if (e.status !== 404 && e.status !== 400) throw e;
    const j = await call(key, `/models/${m}:generateContent`, {
      contents: [{ parts: [{ text: style ? `${style}:\n${text}` : text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } }
    }, signal);
    const p = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const d = p.find(x => x.inlineData);
    if (!d) throw new Error('Gemini ses döndürmedi');
    return toWav(b64ToBytes(d.inlineData.data), d.inlineData.mimeType || '');
  }
}

const outParts = j => (j.steps || []).filter(s => s.type === 'model_output').flatMap(s => s.content || []);
export const aspectOf = (w, h) => { const r = w / h; return r < 0.7 ? '9:16' : r < 0.9 ? '4:5' : r < 1.15 ? '1:1' : '16:9'; };

/** Sahne görseli (Nano Banana) → JPEG Blob */
export async function geminiImage(key, prompt, { aspect = '9:16', size = '2K', signal } = {}) {
  const m = (await geminiModels(key)).image; if (!m) throw new Error('Bu anahtarla görsel modeli bulunamadı');
  const full = prompt + '. Photorealistic, cinematic lighting, high detail. No text, no letters, no watermark, no logos.';
  let data, mime = 'image/jpeg';
  try {
    const j = await call(key, '/interactions', { model: m, input: [{ type: 'text', text: full }], response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: aspect, image_size: size } }, signal);
    const a = outParts(j).filter(c => c.type === 'image').pop(); if (a) { data = a.data; mime = a.mime_type || mime; }
  } catch (e) { if (e.status !== 404 && e.status !== 400) throw e; }
  if (!data) {
    const j = await call(key, `/models/${m}:generateContent`, { contents: [{ parts: [{ text: full }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } } }, signal);
    const d = ((((j.candidates || [])[0] || {}).content || {}).parts || []).find(x => x.inlineData);
    if (!d) throw new Error('Gemini görsel döndürmedi (içerik kuralları nedeniyle olabilir)');
    data = d.inlineData.data; mime = d.inlineData.mimeType || mime;
  }
  addCost('gemini', GM_PRICE.image, 'görsel');
  return new Blob([b64ToBytes(data)], { type: mime });
}

/** Yapay zekâ video klibi (Gemini Omni / Veo) → MP4 Blob. image: isteğe bağlı başlangıç görseli (Blob) */
export async function geminiVideo(key, prompt, { aspect = '9:16', resolution = '720p', image = null, signal, onStatus = () => { } } = {}) {
  const m = (await geminiModels(key)).video; if (!m) throw new Error('Bu anahtarla video modeli bulunamadı (ücretli hesap gerekebilir)');
  const va = aspect === '16:9' ? '16:9' : '9:16';
  const text = prompt + '. Smooth cinematic camera movement, realistic, no text, no subtitles, no logos.';
  let input = text;
  if (image) { const b = new Uint8Array(await image.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); input = [{ type: 'image', data: btoa(s), mime_type: image.type || 'image/jpeg' }, { type: 'text', text }]; }
  onStatus('video üretiliyor (1-3 dk)…');
  const j = await call(key, '/interactions', { model: m, input, response_format: { type: 'video', aspect_ratio: va, resolution }, ...(image ? { generation_config: { video_config: { task: 'image_to_video' } } } : {}) }, signal);
  const v = outParts(j).filter(c => c.type === 'video').pop();
  if (!v) throw new Error('Gemini video döndürmedi');
  let blob;
  if (v.data) blob = new Blob([b64ToBytes(v.data)], { type: 'video/mp4' });
  else if (v.uri) {
    const id = (v.uri.match(/files\/([^/?:]+)/) || [])[1]; if (!id) throw new Error('video adresi okunamadı');
    for (let k = 0; k < 90; k++) { const f = await call(key, `/files/${id}`, null, signal); if (f.state === 'ACTIVE') break; if (f.state === 'FAILED') throw new Error('video üretimi başarısız'); onStatus('video hazırlanıyor…'); await new Promise(r => setTimeout(r, 4000)); }
    const r = await fetch(`${BASE}/files/${id}:download?alt=media`, { headers: { 'x-goog-api-key': key }, signal });
    if (!r.ok) throw new Error('video indirilemedi'); blob = await r.blob();
  } else throw new Error('Gemini video döndürmedi');
  const dur = await new Promise(res => { const el = document.createElement('video'); el.preload = 'metadata'; el.onloadedmetadata = () => { res(el.duration || 6); URL.revokeObjectURL(el.src); }; el.onerror = () => res(6); el.src = URL.createObjectURL(blob); });
  addCost('gemini', dur * GM_PRICE.videoSec * (resolution === '1080p' ? 1.5 : 1), 'video');
  return { blob, dur };
}

/** Sahneye en uygun çekimi seçtir: küçük resimlere bakar, en iyinin sırasını döndürür */
export async function geminiPick(key, sceneText, thumbUrls, { signal } = {}) {
  const imgs = [];
  for (const u of thumbUrls) {
    try { const b = new Uint8Array(await (await fetch(u, { signal })).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); imgs.push(btoa(s)); } catch (e) { imgs.push(null); }
  }
  const parts = [{ text: `Kısa bir sosyal medya videosunun bu sahnesine arka plan çekimi seçiyoruz. Sahne: "${sceneText}". Aşağıda numaralı ${imgs.length} aday kare var. Konuya en uygun, en estetik, üzerinde yazı okunabilecek, içinde yazı/logo olmayan adayı seç. Yalnızca {"i": <0'dan başlayan sıra>} JSON döndür.` }];
  imgs.forEach((d, i) => { if (d) parts.push({ text: `Aday ${i}:` }, { inlineData: { mimeType: 'image/jpeg', data: d } }); });
  const m = (await geminiModels(key)).text;
  const j = await call(key, `/models/${m}:generateContent`, { contents: [{ parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }, signal);
  const um = j.usageMetadata || {}; addCost('gemini', ((um.promptTokenCount || 0) * GM_PRICE.textIn + (um.candidatesTokenCount || 0) * GM_PRICE.textOut) / 1e6, 'çekim seçimi');
  const t = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('');
  const i = +((t.match(/"i"\s*:\s*(\d+)/) || [])[1]);
  return Number.isFinite(i) && i < thumbUrls.length ? i : 0;
}
