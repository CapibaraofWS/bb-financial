// Proxy para BCRA API v3.0
// Soporta ?endpoint=principalesvariables (default)
const ALLOWED = ['principalesvariables'];

export default async function handler(req, res) {
  const endpoint = req.query.endpoint || 'principalesvariables';

  if (!ALLOWED.includes(endpoint)) {
    return res.status(400).json({ error: 'Endpoint no permitido' });
  }

  try {
    const url = `https://api.bcra.gob.ar/estadisticas/v3.0/${endpoint}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde BCRA API' });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con BCRA API' });
  }
}
