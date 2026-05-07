// Soporta ?type=quote&symbol=AAPL o ?type=news&category=general
export default async function handler(req, res) {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'FINNHUB_API_KEY no configurada' });
  }

  const { type = 'quote', symbol, category = 'general' } = req.query;

  let url;
  if (type === 'quote' && symbol) {
    url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  } else if (type === 'news') {
    url = `https://finnhub.io/api/v1/news?category=${encodeURIComponent(category)}&token=${apiKey}`;
  } else {
    return res.status(400).json({ error: 'Parámetros inválidos. Usá ?type=quote&symbol=AAPL o ?type=news&category=general' });
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde Finnhub' });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con Finnhub' });
  }
}
