// Proxy para api.argentinadatos.com — whitelist de paths para prevenir SSRF
// + cache en memoria con stale fallback para sobrevivir a caídas/rate-limits
import { denyExternalOrigin } from './_security.js';
import { fetchWithMemFallback } from './_cacheFallback.js';

const ALLOWED_PATHS = [
  'finanzas/reservas',
  'finanzas/riesgo-pais',
  'finanzas/indices/riesgo-pais',
  'finanzas/indices/inflacion',
  'finanzas/indices/uva',
  'finanzas/indices/canasta/basica/alimentaria',
  'finanzas/indices/canasta/basica/total',
  'finanzas/tasas/plazoFijo',
  'finanzas/fci/otros/ultimo',
  'finanzas/fci/mercadoDinero/ultimo',
  'finanzas/fci/mercadoDinero/penultimo',
  'finanzas/indices/riesgo-pais/ultimo',
  'finanzas/indices/inflacion/ultimo',
  'finanzas/indices/uva/ultimo',
];

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  const path = req.query.path;

  if (!path || !ALLOWED_PATHS.includes(path)) {
    return res.status(400).json({ error: 'Path no permitido' });
  }

  const url = `https://api.argentinadatos.com/v1/${path}`;
  const result = await fetchWithMemFallback(url, { ns: 'argdatos', timeoutMs: 9000 });
  if (!result.ok) {
    return res.status(result.status || 502).json({ error: 'No se pudo conectar con ArgentinaDatos' });
  }
  // Cache largo: ArgentinaDatos publica diariamente, no necesitamos chequear más seguido
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800');
  res.setHeader('X-Cache-Status', result.source);
  if (!result.fresh) res.setHeader('X-Cache-Age-Seconds', String(Math.floor(result.age / 1000)));
  return res.status(200).json(result.data);
}
