// Anthropic Claude: senaryo yazarı ve yaratıcı yönetmen (tarayıcıdan doğrudan).
import { addCost } from './cost.js?v=202611271251';

export const CLAUDE_MODELS = {
  'claude-sonnet-5-5': 'Sonnet 5.5 · dengeli (önerilen)',
  'claude-opus-5-5': 'Opus 5.5 · en iyi yazım, daha pahalı',
  'claude-haiku-5-5': 'Haiku 5.5 · en hızlı ve ucuz'
};
// 1 milyon token başına dolar (girdi, çıktı) — tahmin için
export const CLAUDE_PRICE = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] };

async function post(key, body, signal) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = (j.error && j.error.message) || r.statusText || 'istek başarısız';
    throw new Error(r.status === 401 ? 'Claude anahtarı geçersiz' : r.status === 429 ? 'Claude hız sınırı, biraz sonra tekrar deneyin' : r.status === 529 ? 'Claude şu an yoğun, biraz sonra tekrar deneyin' : 'Claude: ' + m.slice(0, 160));
  }
  return j;
}

export async function claudeTest(key, model) {
  const j = await post(key, { model, max_tokens: 16, messages: [{ role: 'user', content: 'Sadece "tamam" yaz.' }] });
  track(model, j.usage, 'bağlantı testi');
  return true;
}

function track(model, u, what) {
  if (!u) return;
  const p = CLAUDE_PRICE[model] || [3, 15];
  addCost('claude', ((u.input_tokens || 0) * p[0] + (u.output_tokens || 0) * p[1]) / 1e6, what);
}

/** ollamaChat ile aynı imza: messages=[{role,content}] → ham metin */
export async function claudeChat(key, model, messages, { schema, temperature = 0.7, signal, maxTokens = 6000, what = 'yazı' } = {}) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const msgs = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
  if (schema) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + '\n\nYanıtın YALNIZCA şu JSON şemasına uyan geçerli JSON olsun; açıklama, kod bloğu ya da başka metin ekleme:\n' + JSON.stringify(schema) };
  const j = await post(key, { model, max_tokens: maxTokens, temperature, ...(system ? { system } : {}), messages: msgs }, signal);
  track(model, j.usage, what);
  const out = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  if (!out) throw new Error(j.stop_reason === 'refusal' ? 'Claude bu metni yazmadı' : 'Claude boş yanıt döndürdü');
  return out;
}
