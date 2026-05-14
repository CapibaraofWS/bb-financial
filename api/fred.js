// Proxy a FRED (St. Louis Fed) — la key vive solo server-side
import { denyExternalOrigin } from './_security.js';

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Servicio temporalmente no disponible' });
  }

  try {
    const url =
      `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=FEDFUNDS&api_key=${apiKey}&limit=2&sort_order=desc&file_type=json`;

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Servicio temporalmente no disponible' });
    }

    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo conectar con FRED API' });
  }
}
