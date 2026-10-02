// Historial diario de cada dolar (ArgentinaDatos), en formato compacto [fecha, compra, venta]
import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';

const CASAS = new Set(['oficial', 'mayorista', 'blue', 'bolsa', 'contadoconliqui', 'cripto']);

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 60, windowSecs: 60, key: 'dolar-historico' })) return;
  const casa = String(req.query.casa || '');
  if (!CASAS.has(casa)) return res.status(400).json({ error: 'Casa no permitida' });
  try {
    const response = await fetch(`https://api.argentinadatos.com/v1/cotizaciones/dolares/${casa}`, {
      signal: AbortSignal.timeout(9000)
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde ArgentinaDatos' });
    const data = await response.json();
    if (!Array.isArray(data)) return res.status(502).json({ error: 'Respuesta inesperada' });
    const filas = data
      .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha) && Number.isFinite(d.venta))
      .map(d => [d.fecha, Number.isFinite(d.compra) ? d.compra : d.venta, d.venta]);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ casa, filas });
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con ArgentinaDatos' });
  }
}
