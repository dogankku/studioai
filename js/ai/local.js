// Yerel yapay zekâ servisleri: Ollama (metin) ve ComfyUI (görsel). İkisi de kullanıcının kendi bilgisayarında çalışır.

async function getJSON(url, opts = {}, timeout = 8000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeout);
  try { const r = await fetch(url, { ...opts, signal: ac.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
  finally { clearTimeout(t); }
}
const clean = u => (u || '').trim().replace(/\/+$/, '');

/* ---------------- Ollama ---------------- */
export async function ollamaModels(url) {
  const d = await getJSON(`${clean(url)}/api/tags`);
  return (d.models || []).map(m => ({ name: m.name, size: m.size }));
}

/**
 * Sohbet isteği; akış (stream) ile gelen parçaları birleştirir.
 * schema verilirse çıktı JSON şemasına zorlanır (Ollama 0.5+), yoksa format:'json'.
 */
export async function ollamaChat(url, model, messages, { schema = null, temperature = 0.6, onToken = () => { }, signal } = {}) {
  const r = await fetch(`${clean(url)}/api/chat`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true, format: schema || 'json', options: { temperature, num_ctx: 8192 } })
  });
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = '', out = '', n = 0;
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
      try { const j = JSON.parse(line); if (j.message && j.message.content) { out += j.message.content; onToken(++n, out); } if (j.error) throw new Error(j.error); } catch (e) { if (e.message && !e.message.startsWith('Unexpected')) throw e; }
    }
  }
  return out;
}
export function parseJSONLoose(s) {
  try { return JSON.parse(s); } catch (e) { }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { } }
  return null;
}

/* ---------------- ComfyUI ---------------- */
export async function comfyCheckpoints(url) {
  const d = await getJSON(`${clean(url)}/object_info/CheckpointLoaderSimple`, {}, 15000);
  const req = d.CheckpointLoaderSimple && d.CheckpointLoaderSimple.input && d.CheckpointLoaderSimple.input.required;
  const list = req && req.ckpt_name && req.ckpt_name[0];
  return Array.isArray(list) ? list : [];
}

function workflow({ ckpt, prompt, negative, w, h, seed, steps }) {
  const turbo = /turbo|lightning|lcm|schnell/i.test(ckpt);
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['1', 1] } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width: w, height: h, batch_size: 1 } },
    '5': { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0], seed, steps: steps || (turbo ? 1 : 20), cfg: turbo ? 1.0 : 6.5, sampler_name: turbo ? 'euler_ancestral' : 'dpmpp_2m', scheduler: turbo ? 'normal' : 'karras', denoise: 1 } },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'film_studyosu' } }
  };
}

export const NEGATIVE = 'people, person, human, face, hands, body, crowd, man, woman, child, animal, text, letters, writing, calligraphy, watermark, logo, signature, frame, border, blurry, lowres, deformed, ugly, nsfw';

/** Görsel üretir; ComfyUI kuyruğunda bitene kadar bekler, PNG Blob döner */
export async function comfyGenerate(url, opts, { onProgress = () => { }, signal } = {}) {
  const base = clean(url);
  const client_id = 'fs-' + Math.random().toString(36).slice(2);
  const wf = workflow({ negative: NEGATIVE, seed: Math.floor(Math.random() * 1e9), ...opts });
  const r = await fetch(`${base}/prompt`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: wf, client_id }) });
  if (!r.ok) throw new Error(`ComfyUI HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const { prompt_id } = await r.json();
  const t0 = performance.now();
  for (;;) {
    if (signal && signal.aborted) throw new Error('CANCEL');
    await new Promise(res => setTimeout(res, 1500));
    onProgress((performance.now() - t0) / 1000);
    let h; try { h = await getJSON(`${base}/history/${prompt_id}`, {}, 10000); } catch (e) { continue; }
    const job = h[prompt_id]; if (!job) continue;
    if (job.status && job.status.status_str === 'error') throw new Error('ComfyUI görseli üretemedi: ' + JSON.stringify(job.status.messages || '').slice(0, 300));
    const outs = job.outputs || {};
    for (const k of Object.keys(outs)) {
      const im = outs[k].images && outs[k].images[0];
      if (im) {
        const q = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || '', type: im.type || 'output' });
        const ir = await fetch(`${base}/view?${q}`, { signal }); if (!ir.ok) throw new Error('Görsel indirilemedi');
        return await ir.blob();
      }
    }
  }
}
