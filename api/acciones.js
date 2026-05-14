// Proxy para Yahoo Finance — soporta ?symbol=AAPL&range=1y&interval=1d
import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 40, windowSecs: 60, key: 'acciones' })) return;

  const symbol = req.query.symbol;
  if (symbol && !/^[A-Z0-9.\-^=]{1,15}$/i.test(symbol)) {
    return res.status(400).json({ error: 'Symbol inválido' });
  }
  const range = ['1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','max'].includes(req.query.range) ? req.query.range : '1d';
  const interval = ['1m','5m','15m','30m','1h','1d','1wk','1mo'].includes(req.query.interval) ? req.query.interval : '1d';

  if (!symbol) {
    return res.status(400).json({ error: 'Parámetro symbol requerido' });
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde Yahoo Finance', status: response.status });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo conectar con Yahoo Finance', detail: String(err?.message || err) });
  }
}
