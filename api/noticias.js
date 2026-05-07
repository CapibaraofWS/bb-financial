// Soporta ?q=finanzas&language=es&pageSize=20
export default async function handler(req, res) {
  const apiKey = process.env.NEWSAPI_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'NEWSAPI_KEY no configurada' });
  }

  const q = req.query.q || 'finanzas argentina';
  const language = req.query.language || 'es';
  const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 50);

  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=${language}&pageSize=${pageSize}&sortBy=publishedAt&apiKey=${apiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde NewsAPI' });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con NewsAPI' });
  }
}
