// Proxy para BCRA API v4.0 (Monetarias)
// Uso:
//   /api/bcra                     → lista todas las variables (1 página, 1000 vars)
//   /api/bcra?id=15               → último valor de la variable id=15 (Base monetaria)
//   /api/bcra?id=15&limit=30      → últimos 30 valores
//   /api/bcra?ids=1,7,15,28,29,31 → últimos valores de IDs múltiples (batch)
import { denyExternalOrigin } from './_security.js';
import { fetchWithMemFallback } from './_cacheFallback.js';

const BASE = 'https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias';
const UA = { 'User-Agent': 'Mozilla/5.0 BBFinancial/1.0' };

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;

  const { id, ids, limit } = req.query;

  try {
    // Batch: ids múltiples — fetch en paralelo con mem fallback por id
    if (ids) {
      const idList = String(ids).split(',').map(x => parseInt(x.trim())).filter(n => Number.isFinite(n) && n > 0 && n < 5000).slice(0, 30);
      const results = await Promise.all(
        idList.map(async i => {
          const r = await fetchWithMemFallback(`${BASE}/${i}?limit=1`, { ns: 'bcra', timeoutMs: 8000, headers: UA });
          if (!r.ok) return [i, null];
          const det = r.data?.results?.[0]?.detalle?.[0];
          return [i, det ? { fecha: det.fecha, valor: det.valor } : null];
        })
      );
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400, stale-if-error=604800');
      return res.status(200).json(Object.fromEntries(results));
    }

    // Single variable
    if (id) {
      const i = parseInt(id);
      if (!Number.isFinite(i) || i <= 0 || i > 5000) return res.status(400).json({ error: 'id inválido' });
      const lim = Math.min(parseInt(limit) || 1, 365);
      const r = await fetchWithMemFallback(`${BASE}/${i}?limit=${lim}`, { ns: 'bcra', timeoutMs: 9000, headers: UA });
      if (!r.ok) return res.status(r.status || 502).json({ error: 'Error desde BCRA API' });
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400, stale-if-error=604800');
      res.setHeader('X-Cache-Status', r.source);
      return res.status(200).json(r.data);
    }

    // Lista general (catálogo de variables)
    const r = await fetchWithMemFallback(`${BASE}?limit=1000`, { ns: 'bcra', timeoutMs: 10000, headers: UA });
    if (!r.ok) return res.status(r.status || 502).json({ error: 'Error desde BCRA API' });
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800');
    return res.status(200).json(r.data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con BCRA API' });
  }
}
