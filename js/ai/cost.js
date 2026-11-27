// Yapay zekâ harcama sayacı (tahmini). Aylık tutulur, yalnızca bu tarayıcıda.
const KEY = 'vs-cost';
const month = () => new Date().toISOString().slice(0, 7);
export function costState() {
  let s; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
  if (!s || s.month !== month()) s = { month: month(), claude: 0, gemini: 0, log: [] };
  return s;
}
const subs = new Set();
export const onCost = fn => subs.add(fn);
export function addCost(provider, usd, what = '') {
  if (!(usd > 0)) return;
  const s = costState(); s[provider] = (s[provider] || 0) + usd;
  s.log.unshift({ t: Date.now(), p: provider, usd, what }); s.log = s.log.slice(0, 200);
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { }
  subs.forEach(f => { try { f(s); } catch (e) { } });
}
export const fmtUsd = v => '$' + (v < 0.01 && v > 0 ? v.toFixed(4) : v.toFixed(2));
// Gemini tahmini birim fiyatlar (dolar). Google fiyatları değişebilir; yalnızca yaklaşık gösterim içindir.
export const GM_PRICE = { textIn: 0.75, textOut: 4.5, ttsSec: 0.0005, image: 0.04, videoSec: 0.10 };
