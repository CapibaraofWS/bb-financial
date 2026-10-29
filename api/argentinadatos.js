// Proxy para api.argentinadatos.com — whitelist de paths para prevenir SSRF
import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';

const ALLOWED_PATHS = [
  'finanzas/indices/riesgo-pais',
  'finanzas/indices/inflacion',
  'finanzas/indices/uva',
  // Tasas en vivo
  'finanzas/tasas/plazoFijo',
  'finanzas/tasas/depositos30Dias',
  // FCI - ultimo
  'finanzas/fci/mercadoDinero/ultimo',
  'finanzas/fci/rentaVariable/ultimo',
  'finanzas/fci/rentaFija/ultimo',
  'finanzas/fci/rentaMixta/ultimo',
  'finanzas/fci/otros/ultimo',
  'finanzas/fci/variables/ultimo',
  'finanzas/fci/retornoTotal/ultimo',
  // FCI - penultimo (para calcular TNA estimada)
  'finanzas/fci/mercadoDinero/penultimo',
  'finanzas/fci/rentaVariable/penultimo',
  'finanzas/fci/rentaFija/penultimo',
  'finanzas/fci/rentaMixta/penultimo',
  // Tasas adicionales
  'finanzas/tasas/plazoFijoPrecancelable',
  'finanzas/tasas/plazoFijoUvaPagoPeriodico',
  // Rendimientos en vivo (cripto + ARS via wallets cripto + USD)
  'finanzas/rendimientos',
  'finanzas/criptopesos',
  'finanzas/cuentas-remuneradas-usd',
  // Letras del Tesoro
  'finanzas/letras',
  // Historial de cotizaciones (Panel Argentina): se recortan con ?dias=N
  'cotizaciones/dolares/oficial',
  'cotizaciones/dolares/blue',
  'cotizaciones/dolares/bolsa',
  'cotizaciones/dolares/contadoconliqui',
  'cotizaciones/dolares/mayorista',
];
// Series largas que se pueden recortar a los últimos N días para no mandar años de datos
const RECORTABLES = new Set(['finanzas/indices/riesgo-pais', 'cotizaciones/dolares/oficial', 'cotizaciones/dolares/blue',
  'cotizaciones/dolares/bolsa', 'cotizaciones/dolares/contadoconliqui', 'cotizaciones/dolares/mayorista']);

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 120, windowSecs: 60, key: 'argentinadatos' })) return;
  const path = req.query.path;

  if (!path || !ALLOWED_PATHS.includes(path)) {
    return res.status(400).json({ error: 'Path no permitido' });
  }

  try {
    const url = `https://api.argentinadatos.com/v1/${path}`;
    // Un reintento si ArgentinaDatos no contesta o da error del servidor: después de cada deploy la
    // caché arranca vacía y un corte de un momento dejaba en blanco la tarjeta de la brecha (29/10/2026)
    const pedir = ms => fetch(url, { signal: AbortSignal.timeout(ms) });
    let response = await pedir(5000).catch(() => null);
    if (!response || response.status >= 500) { await new Promise(r => setTimeout(r, 500)); response = await pedir(4000); }
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde ArgentinaDatos' });
    let data = await response.json();
    const dias = Math.min(Math.max(parseInt(req.query.dias, 10) || 0, 0), 2000);
    if (dias && RECORTABLES.has(path) && Array.isArray(data)) {
      const desde = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
      data = data.filter(x => String(x.fecha) >= desde);
    }
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con ArgentinaDatos' });
  }
}
