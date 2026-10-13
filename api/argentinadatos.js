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
];

// Meses que el INDEC ya publicó y ArgentinaDatos todavía no cargó (suele tardar uno o dos días).
// Solo se agregan si la fuente no los trae; cuando los trae, manda la fuente.
const INFLACION_ADELANTO = [
  { fecha: '2026-09-30', valor: 1.9 },   // INDEC, 13 de octubre de 2026
];

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 120, windowSecs: 60, key: 'argentinadatos' })) return;
  const path = req.query.path;

  if (!path || !ALLOWED_PATHS.includes(path)) {
    return res.status(400).json({ error: 'Path no permitido' });
  }

  try {
    const url = `https://api.argentinadatos.com/v1/${path}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde ArgentinaDatos' });
    const data = await response.json();
    if (path === 'finanzas/indices/inflacion' && Array.isArray(data) && data.length) {
      for (const mes of INFLACION_ADELANTO) {
        if (mes.fecha > String(data[data.length - 1].fecha)) data.push(mes);
      }
    }
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con ArgentinaDatos' });
  }
}
