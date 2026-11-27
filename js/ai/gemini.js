// Google Gemini: senaryo / çeviri / takvim (metin) ve doğal seslendirme (TTS).
// Tarayıcıdan doğrudan çağrılır; anahtar yalnızca bu tarayıcıda saklanır.
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
  modelCache = { key, text: text && text.id, tts: tts && tts.id, all: names.map(n => n.id) };
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
