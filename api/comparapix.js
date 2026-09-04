// Proxy para api.comparapix.ar/quotes — cotizaciones PIX en vivo (BRL/ARS y BRL/USDT)
// Whitelist única: solo /quotes (sin path traversal posible).
import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 30, windowSecs: 60, key: 'comparapix' })) return;

  try {
    const r = await fetch('https://api.comparapix.ar/quotes', {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'BBFinancial/1.0 (proxy)' },
    });
    if (!r.ok) return res.status(r.status).json({ error: 'Error desde ComparaPix' });
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con ComparaPix' });
  }
}
