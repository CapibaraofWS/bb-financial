// Vercel Serverless Function — proxy para FRED API
// La key se lee desde variables de entorno, nunca del frontend
export default async function handler(req, res) {
  const apiKey = process.env.FRED_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'FRED_API_KEY no configurada' });
  }

  try {
    const url =
      `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=FEDFUNDS&api_key=${apiKey}&limit=2&sort_order=desc&file_type=json`;

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Error desde FRED API' });
    }

    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo conectar con FRED API' });
  }
}
