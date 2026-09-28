// Proxy para BCRA API v4.0
// Soporta ?endpoint=Monetarias (default) — lista todas las variables con su ultValorInformado
// La v3 está deprecada — migramos a v4 que es la actual del BCRA (api.bcra.gob.ar/estadisticas/v4.0).
import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';

// Además de Monetarias v4 exponemos Estadísticas Cambiarias v1 (tipos de cambio
// oficiales del BCRA para ~40 monedas, con histórico por moneda).
//   ?endpoint=Monetarias[&categoria=Principales%20Variables]  → catálogo + último valor
//   ?endpoint=Cotizaciones[&fecha=YYYY-MM-DD]                 → todas las divisas de un día
//   ?endpoint=Divisas                                         → maestro de monedas
//   ?endpoint=Cotizaciones&moneda=USD[&desde=&hasta=&limit=]  → serie histórica de una moneda
const ALLOWED = new Set(['Monetarias', 'Cotizaciones', 'Divisas', 'Hipotecarios']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const COD_MONEDA = /^[A-Z]{3}$/;

function buildUrl(q) {
  const endpoint = q.endpoint || 'Monetarias';

  // Régimen de Transparencia: lo que cada entidad informa de sus hipotecarios
  if (endpoint === 'Hipotecarios') {
    return 'https://api.bcra.gob.ar/transparencia/v1.0/Prestamos/Hipotecarios';
  }

  if (endpoint === 'Divisas') {
    return 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Maestros/Divisas';
  }

  if (endpoint === 'Cotizaciones') {
    const base = 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones';
    const p = new URLSearchParams();
    if (COD_MONEDA.test(String(q.moneda || ''))) {
      if (ISO_DATE.test(String(q.desde || ''))) p.set('fechaDesde', q.desde);
      if (ISO_DATE.test(String(q.hasta || ''))) p.set('fechaHasta', q.hasta);
      p.set('limit', String(Math.min(Math.max(parseInt(q.limit, 10) || 100, 1), 1000)));
      return `${base}/${q.moneda}?${p}`;
    }
    if (ISO_DATE.test(String(q.fecha || ''))) p.set('fecha', q.fecha);
    return p.toString() ? `${base}?${p}` : base;
  }

  // Monetarias v4. limit 2000 cubre los ~1600 indicadores (incluye TIM id 1197,
  // bandas cambiarias 1187-1188 y la categoría "Informe Monetario Diario").
  const p = new URLSearchParams({ limit: '2000' });
  if (q.categoria) p.set('Categoria', String(q.categoria).slice(0, 60));
  if (q.idVariable && /^\d{1,5}$/.test(String(q.idVariable))) p.set('IdVariable', String(q.idVariable));
  return `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias?${p}`;
}

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 60, windowSecs: 60, key: 'bcra' })) return;
  const endpoint = req.query.endpoint || 'Monetarias';

  if (!ALLOWED.has(endpoint)) {
    return res.status(400).json({ error: 'Endpoint no permitido', validos: [...ALLOWED] });
  }

  try {
    const url = buildUrl(req.query);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde BCRA API' });
    const data = await response.json();
    if (endpoint === 'Hipotecarios') {
      // 230 KB con todos los productos: solo viajan los UVA y los campos que se muestran
      const campos = ['descripcionEntidad', 'destinoFondos', 'tasaEfectivaAnualMaxima', 'costoFinancieroEfectivoTotalMaximo',
        'plazoMaximoOtorgable', 'montoMaximoOtorgable', 'relacionMontoTasacion', 'relacionCuotaIngreso', 'beneficiario', 'fechaInformacion'];
      const results = (data.results || []).filter(x => /UVA/i.test(x.denominacion || ''))
        .map(x => Object.fromEntries(campos.map(c => [c, x[c] ?? null])));
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
      return res.status(200).json({ results });
    }
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con BCRA API' });
  }
}
