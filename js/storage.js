// Görsel, video, ses ve logo dosyalarını tarayıcıda (IndexedDB) saklar; sayfa yenilense de kaybolmaz.
const DB = 'toplu-video', STORE = 'files';
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx(mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode); const s = t.objectStore(STORE);
    const out = fn(s);
    t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
    t.onerror = () => rej(t.error);
  }));
}
export const putFile = rec => tx('readwrite', s => s.put(rec)).catch(() => null);
export const delFile = id => tx('readwrite', s => s.delete(id)).catch(() => null);
export const clearFiles = () => tx('readwrite', s => s.clear()).catch(() => null);
export async function allFiles() {
  try {
    const d = await db();
    return await new Promise((res, rej) => {
      const r = d.transaction(STORE).objectStore(STORE).getAll();
      r.onsuccess = () => res(r.result.sort((a, b) => a.order - b.order));
      r.onerror = () => rej(r.error);
    });
  } catch (e) { return []; }
}
