// Soporta ?series=id1,id2&limit=N — devuelve los últimos N puntos (no los primeros)
import { denyExternalOrigin } from './_security.js';

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  const series = req.query.series;
  const limit = Math.min(parseInt(req.query.limit) || 12, 60);

  if (!series || !/^[A-Za-z0-9._,-]{1,300}$/.test(series)) {
    return res.status(400).json({ error: 'Parámetro series inválido' });
  }

  try {
    // datos.gob.ar usa `last` para traer los últimos N datapoints (no `limit` que paginaría desde el inicio)
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${encodeURIComponent(series)}&format=json&last=${limit}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde INDEC API' });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con INDEC API' });
  }
}
