// Helper compartido: cache en memoria del proceso serverless con stale fallback.
// Sobrevive entre requests dentro del mismo instance de Vercel.
// Diseñado para envolver llamadas a APIs externas con rate-limit (CoinGecko, ArgentinaDatos…).

const STORES = new Map(); // namespace -> Map(key -> {data, ts})

function getStore(ns) {
  if (!STORES.has(ns)) STORES.set(ns, new Map());
  return STORES.get(ns);
}

export function memGet(ns, key, staleMs = 24 * 60 * 60 * 1000) {
  const m = getStore(ns);
  const e = m.get(key);
  if (!e) return null;
  const age = Date.now() - e.ts;
  if (age > staleMs) { m.delete(key); return null; }
  return { data: e.data, age, ts: e.ts };
}

export function memSet(ns, key, data, maxEntries = 50) {
  const m = getStore(ns);
  m.set(key, { data, ts: Date.now() });
  if (m.size > maxEntries) {
    const oldest = [...m.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) m.delete(oldest[0]);
  }
}

/**
 * Fetch con cache en memoria + stale fallback.
 *
 * @param {string} url - URL externa a fetchear
 * @param {object} opts
 *   - ns: namespace para particionar el cache (ej: 'argdatos', 'bcra')
 *   - timeoutMs: timeout del fetch (default 9000)
 *   - headers: headers extra para el fetch
 *   - fresh: si true, ignora cache y siempre va al origin (default false)
 *   - staleMs: tiempo máx que un dato puede estar en memoria como fallback (default 24h)
 *   - tag: identificador para X-Cache-Status (default 'mem')
 * @returns {Promise<{ok: true, data, fresh: boolean, age: number} | {ok: false, error, status}>}
 */
export async function fetchWithMemFallback(url, opts = {}) {
  const {
    ns = 'default',
    timeoutMs = 9000,
    headers = {},
    staleMs = 24 * 60 * 60 * 1000,
  } = opts;
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'BBFinancial/1.0 (+https://bb-financial.vercel.app)', ...headers },
    });
    if (!r.ok) {
      // Buscar fallback en memoria
      const cached = memGet(ns, url, staleMs);
      if (cached) return { ok: true, data: cached.data, fresh: false, age: cached.age, source: 'mem-error' };
      return { ok: false, status: r.status, error: 'origin-error' };
    }
    const data = await r.json();
    memSet(ns, url, data);
    return { ok: true, data, fresh: true, age: 0, source: 'origin' };
  } catch (e) {
    const cached = memGet(ns, url, staleMs);
    if (cached) return { ok: true, data: cached.data, fresh: false, age: cached.age, source: 'mem-network' };
    return { ok: false, status: 0, error: String(e?.message || e) };
  }
}
