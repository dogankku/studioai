// Toplu metin ve CSV ayrıştırma

let _id = 0;
export const newId = () => 'i' + Date.now().toString(36) + (++_id).toString(36);

export function makeItem(o = {}) {
  const it = { id: newId(), main: o.main || '', sub: o.sub || '', src: o.src || '', tag: o.tag || '' };
  if (Array.isArray(o.timing)) it.timing = o.timing.slice();
  if (o.ov && typeof o.ov === 'object') it.ov = { ...o.ov };
  for (const k of ['ref', 'imgPrompt', 'imgId', 'sceneHint', 'aiText', 'stockQ']) if (o[k] != null) it[k] = typeof o[k] === 'object' ? { ...o[k] } : o[k];
  if (Array.isArray(o.vids)) it.vids = o.vids.map(v => ({ ...v }));
  return it;
}
export const plainItem = ({ main, sub, src, tag, timing, ov, ref, imgPrompt, imgId, sceneHint, aiText, stockQ, vids }) => ({ main, sub, src, tag, ...(timing ? { timing } : {}), ...(ov && Object.values(ov).some(Boolean) ? { ov } : {}), ...(ref ? { ref } : {}), ...(imgPrompt ? { imgPrompt } : {}), ...(imgId ? { imgId } : {}), ...(sceneHint ? { sceneHint } : {}), ...(aiText ? { aiText } : {}), ...(stockQ ? { stockQ } : {}), ...(vids && vids.length ? { vids } : {}) });

const KEY_RE = /^(meal|alt|açıklama|aciklama|çeviri|ceviri|kaynak|etiket)\s*:\s*(.*)$/i;

/**
 * Metin listesi biçimi:
 *   Ana metin (birden fazla satır olabilir)
 *   meal: alt metin
 *   kaynak: Bakara, 286
 *   etiket: Günün Ayeti
 *   ---
 *   Sonraki öğe...
 */
export function parseList(text) {
  const blocks = text.replace(/\r/g, '').split(/^\s*-{3,}\s*$/m).map(b => b.trim()).filter(Boolean);
  return blocks.map(b => {
    const it = makeItem();
    const mainLines = [];
    for (const raw of b.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(KEY_RE);
      if (m) {
        const k = m[1].toLocaleLowerCase('tr');
        const v = m[2].trim();
        if (k === 'kaynak') it.src = v;
        else if (k === 'etiket') it.tag = v;
        else it.sub = it.sub ? it.sub + '\n' + v : v;
      } else mainLines.push(line);
    }
    it.main = mainLines.join('\n');
    return it;
  }).filter(i => i.main || i.sub);
}

export function toListText(items) {
  return items.map(i => {
    const out = [i.main];
    if (i.sub) i.sub.split('\n').forEach(l => out.push('meal: ' + l));
    if (i.src) out.push('kaynak: ' + i.src);
    if (i.tag) out.push('etiket: ' + i.tag);
    return out.join('\n');
  }).join('\n---\n');
}

function splitCSV(text, delim) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

const COLS = {
  main: ['ana', 'ana metin', 'metin', 'main', 'text', 'arapça', 'arapca', 'ayet', 'hadis'],
  sub: ['alt', 'alt metin', 'meal', 'çeviri', 'ceviri', 'açıklama', 'aciklama', 'sub', 'translation'],
  src: ['kaynak', 'source', 'referans'],
  tag: ['etiket', 'tag', 'başlık', 'baslik']
};

/** CSV / TSV (Excel'den yapıştırma dahil). Başlık satırı varsa sütunları adına göre eşler. */
export function parseCSV(text) {
  const first = text.split('\n')[0] || '';
  const delim = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = splitCSV(text, delim);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim().toLocaleLowerCase('tr'));
  const map = {};
  for (const [k, names] of Object.entries(COLS)) {
    const idx = head.findIndex(h => names.includes(h));
    if (idx >= 0) map[k] = idx;
  }
  let body = rows;
  if (Object.keys(map).length) body = rows.slice(1);
  else Object.assign(map, { main: 0, sub: 1, src: 2, tag: 3 });
  return body.map(r => makeItem({
    main: (r[map.main] || '').trim(), sub: (r[map.sub] || '').trim(),
    src: (r[map.src] || '').trim(), tag: (r[map.tag] || '').trim()
  })).filter(i => i.main || i.sub);
}
