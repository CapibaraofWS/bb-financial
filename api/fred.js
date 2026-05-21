// Proxy a FRED (St. Louis Fed) — la key vive solo server-side.
// Acepta ?series_id=DGS10 (whitelist) o sin parámetro (legacy: FEDFUNDS).
// También acepta ?series_ids=DGS1MO,DGS3MO,... (batch) — devuelve { SERIES_ID: data, ... }.
import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';

const ALLOWED_SERIES = new Set([
  'FEDFUNDS',
  // Treasury yields
  'DGS1MO', 'DGS3MO', 'DGS6MO', 'DGS1', 'DGS2', 'DGS5', 'DGS10', 'DGS30',
  // TIPS (real yields)
  'DFII5', 'DFII10', 'DFII30',
  // Breakeven inflation
  'T5YIE', 'T10YIE',
  // Spreads
  'T10Y2Y', 'T10Y3M',
]);

async function fetchSeries(seriesId, apiKey, limit) {
  const lim = Math.max(1, Math.min(limit || 2, 50));
  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${apiKey}&limit=${lim}&sort_order=desc&file_type=json`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('FRED ' + r.status);
  return r.json();
}

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 60, windowSecs: 60, key: 'fred' })) return;

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Servicio temporalmente no disponible' });
  }

  const { series_id, series_ids, limit } = req.query || {};
  const lim = limit ? parseInt(limit, 10) : 2;

  try {
    // Batch mode
    if (typeof series_ids === 'string' && series_ids.length > 0) {
      const ids = series_ids.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      if (ids.length > 20) return res.status(400).json({ error: 'Máximo 20 series por request' });
      for (const id of ids) {
        if (!ALLOWED_SERIES.has(id)) return res.status(400).json({ error: 'Serie no permitida: ' + id });
      }
      const out = {};
      const results = await Promise.all(ids.map(id => fetchSeries(id, apiKey, lim).catch(() => null)));
      ids.forEach((id, i) => { out[id] = results[i]; });
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
      return res.status(200).json(out);
    }

    // Single-series mode (con default a FEDFUNDS para no romper consumidores existentes)
    const id = (typeof series_id === 'string' ? series_id.toUpperCase() : 'FEDFUNDS');
    if (!ALLOWED_SERIES.has(id)) return res.status(400).json({ error: 'Serie no permitida' });
    const data = await fetchSeries(id, apiKey, lim);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con FRED API' });
  }
}
