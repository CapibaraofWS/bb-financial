// CoinGecko proxy.
// Modo 1 (default): ?ids=bitcoin,ethereum&vs_currencies=usd  → simple/price
// Modo 2: ?path=coins/markets&vs_currency=usd&per_page=50&order=market_cap_desc → coins/markets
import { denyExternalOrigin } from './_security.js';

const ALLOWED_PATHS = new Set([
  'coins/markets',
  'global',
  'simple/price',
]);

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;

  const path = req.query.path;
  let url;

  if (path) {
    if (!ALLOWED_PATHS.has(path)) return res.status(400).json({ error: 'path no permitido' });
    // Whitelist de params: copio todo excepto 'path'
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

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde CoinGecko', status: response.status });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo conectar con CoinGecko', detail: String(err?.message || err) });
  }
}
