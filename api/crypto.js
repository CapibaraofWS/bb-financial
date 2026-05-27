// CoinGecko proxy con cache en memoria + stale fallback.
//
// Estrategia anti-429 (free tier ~30 req/min, además rate-limit por IP):
//   1) Edge cache via Cache-Control s-maxage=600  → CDN sirve 10 min sin pegar al origin
//   2) Cache en memoria del proceso serverless (TTL 30 min)
//      → si CoinGecko da 429 o falla, devolvemos el último response válido
//   3) stale-while-revalidate y stale-if-error largos
//      → si todo falla, edge sigue sirviendo lo último que tuvo
//
// Modo 1 (default): ?ids=bitcoin,ethereum&vs_currencies=usd  → simple/price
// Modo 2: ?path=coins/markets&vs_currency=usd&per_page=50    → coins/markets
import { denyExternalOrigin } from './_security.js';

const ALLOWED_PATHS = new Set([
  'coins/markets',
  'global',
  'simple/price',
]);

// Cache en memoria por URL (sobrevive entre requests dentro del mismo instance Vercel)
const MEM_CACHE = new Map(); // url -> { data, ts }
const MEM_TTL_MS = 30 * 60 * 1000; // 30 minutos
const MEM_STALE_MS = 24 * 60 * 60 * 1000; // 24 horas (fallback de emergencia)

function getCached(url) {
  const entry = MEM_CACHE.get(url);
  if (!entry) return null;
  const age = Date.now() - entry.ts;
  if (age > MEM_STALE_MS) {
    MEM_CACHE.delete(url);
    return null;
  }
  return { data: entry.data, age, stale: age > MEM_TTL_MS };
}

function setCached(url, data) {
  MEM_CACHE.set(url, { data, ts: Date.now() });
  // Cap del Map para no crecer indefinidamente
  if (MEM_CACHE.size > 50) {
    const oldest = [...MEM_CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) MEM_CACHE.delete(oldest[0]);
  }
}

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;

  const path = req.query.path;
  let url;

  if (path) {
    if (!ALLOWED_PATHS.has(path)) return res.status(400).json({ error: 'path no permitido' });
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'path') continue;
      params.set(k, String(v));
    }
    url = `https://api.coingecko.com/api/v3/${path}?${params.toString()}`;
  } else {
    const ids = req.query.ids || 'bitcoin,ethereum';
    const vs = req.query.vs_currencies || 'usd';
    url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}&include_24hr_change=true&include_market_cap=true`;
  }

  // Headers de cache largo para edge de Vercel (la primera línea de defensa)
  const CACHE_HEADERS = 's-maxage=600, stale-while-revalidate=86400, stale-if-error=604800';

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': 'BBFinancial/1.0 (+https://bb-financial.vercel.app)' },
    });

    // Rate-limit o error: intentar servir desde memoria
    if (response.status === 429 || !response.ok) {
      const cached = getCached(url);
      if (cached) {
        res.setHeader('Cache-Control', CACHE_HEADERS);
        res.setHeader('X-Cache-Status', cached.stale ? 'stale-memory' : 'memory');
        res.setHeader('X-Cache-Age-Seconds', String(Math.floor(cached.age / 1000)));
        return res.status(200).json(cached.data);
      }
      // Sin fallback: error explícito pero con cache corto en edge para no martillar
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=3600');
      return res.status(response.status === 429 ? 503 : response.status).json({
        error: response.status === 429
          ? 'CoinGecko rate-limit. Intentá en un minuto.'
          : 'Error desde CoinGecko',
        status: response.status,
      });
    }

    const data = await response.json();
    // Guardar en memoria para futuras caídas
    setCached(url, data);

    res.setHeader('Cache-Control', CACHE_HEADERS);
    res.setHeader('X-Cache-Status', 'fresh');
    return res.status(200).json(data);
  } catch (err) {
    // Timeout / network: intentar memoria
    const cached = getCached(url);
    if (cached) {
      res.setHeader('Cache-Control', CACHE_HEADERS);
      res.setHeader('X-Cache-Status', 'stale-memory-error');
      res.setHeader('X-Cache-Age-Seconds', String(Math.floor(cached.age / 1000)));
      return res.status(200).json(cached.data);
    }
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(503).json({
      error: 'No se pudo conectar con CoinGecko y no hay cache en memoria',
      detail: String(err?.message || err),
    });
  }
}
