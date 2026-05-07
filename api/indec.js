// Soporta ?series=id1,id2 para pedir series del portal de datos abiertos
export default async function handler(req, res) {
  const series = req.query.series;

  if (!series) {
    return res.status(400).json({ error: 'Parámetro series requerido' });
  }

  try {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${encodeURIComponent(series)}&format=json&limit=12`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde INDEC API' });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con INDEC API' });
  }
}
