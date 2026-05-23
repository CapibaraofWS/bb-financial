// Proxy para BCRA API v4.0
// Soporta ?endpoint=Monetarias (default) — lista todas las variables con su ultValorInformado
// La v3 está deprecada — migramos a v4 que es la actual del BCRA (api.bcra.gob.ar/estadisticas/v4.0).
import { denyExternalOrigin } from './_security.js';

const ALLOWED = new Set(['Monetarias']);

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  const endpoint = req.query.endpoint || 'Monetarias';

  if (!ALLOWED.has(endpoint)) {
    return res.status(400).json({ error: 'Endpoint no permitido' });
  }

  try {
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/${endpoint}?limit=1000`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde BCRA API' });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con BCRA API' });
  }
}
