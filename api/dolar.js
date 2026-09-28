import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 60, windowSecs: 60, key: 'dolar' })) return;
  try {
    const response = await fetch('https://dolarapi.com/v1/dolares', {
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde DolarAPI' });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con DolarAPI' });
  }
}
