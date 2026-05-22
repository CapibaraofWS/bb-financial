// Proxy para api.argentinadatos.com — whitelist de paths para prevenir SSRF
import { denyExternalOrigin } from './_security.js';

const ALLOWED_PATHS = [
  'finanzas/reservas',
  'finanzas/riesgo-pais',
  'finanzas/indices/riesgo-pais',
  'finanzas/indices/inflacion',
  'finanzas/indices/uva',
  'finanzas/indices/canasta/basica/alimentaria',
  'finanzas/indices/canasta/basica/total',
  // Tasas en vivo
  'finanzas/tasas/plazoFijo',
  'finanzas/tasas/depositos30Dias',
  // FCI
  'finanzas/fci/mercadoDinero/ultimo',
  'finanzas/fci/rentaVariable/ultimo',
  'finanzas/fci/rentaFija/ultimo',
  'finanzas/fci/rentaMixta/ultimo',
  // Rendimientos en vivo (cripto + ARS via wallets cripto + USD)
  'finanzas/rendimientos',
  'finanzas/criptopesos',
  'finanzas/cuentas-remuneradas-usd',
  // Letras del Tesoro
  'finanzas/letras',
];

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  const path = req.query.path;

  if (!path || !ALLOWED_PATHS.includes(path)) {
    return res.status(400).json({ error: 'Path no permitido' });
  }

  try {
    const url = `https://api.argentinadatos.com/v1/${path}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde ArgentinaDatos' });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con ArgentinaDatos' });
  }
}
