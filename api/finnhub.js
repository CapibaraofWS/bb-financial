// Proxy a proveedor de datos fundamentales — solo accesible desde el frontend del sitio.
import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';

export default async function handler(req, res) {
  // Bloquear abuso desde curl o terceros (protege quota)
  if (denyExternalOrigin(req, res)) return;
  // Rate limit por IP (sólo activo si Upstash está configurado). Finnhub tiene quota mensual baja.
  if (await denyRateLimited(req, res, { limit: 20, windowSecs: 60, key: 'finnhub' })) return;

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Servicio temporalmente no disponible' });

  const { type = 'quote', symbol, category = 'general' } = req.query;

  // Validación estricta de symbol: solo [A-Z0-9.\-^=]
  if (symbol && !/^[A-Z0-9.\-^=]{1,15}$/i.test(symbol)) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  let url;
  if (type === 'quote' && symbol) {
    url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  } else if (type === 'profile' && symbol) {
    url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  } else if (type === 'metric' && symbol) {
    url = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${apiKey}`;
  } else if (type === 'peers' && symbol) {
    url = `https://finnhub.io/api/v1/stock/peers?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  } else if (type === 'news') {
    // Categoría restringida
    const cat = ['general','forex','crypto','merger'].includes(category) ? category : 'general';
    url = `https://finnhub.io/api/v1/news?category=${cat}&token=${apiKey}`;
  } else if (type === 'company-news' && symbol) {
    const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 14);
    const fmt = d => d.toISOString().slice(0, 10);
    url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${apiKey}`;
  } else if (type === 'insider' && symbol) {
    url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  } else if (type === 'earnings-calendar') {
    const from = req.query.from;
    const to = req.query.to;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ error: 'Parámetros de fecha inválidos' });
    }
    url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${apiKey}`;
  } else if (type === 'recommendation' && symbol) {
    url = `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  } else {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Servicio temporalmente no disponible' });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo obtener datos' });
  }
}
