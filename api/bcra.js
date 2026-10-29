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

  // Serie diaria de una variable: ?endpoint=Monetarias&idVariable=78&desde=YYYY-MM-DD
  if (q.idVariable && /^\d{1,5}$/.test(String(q.idVariable)) && ISO_DATE.test(String(q.desde || ''))) {
    const p = new URLSearchParams({ desde: q.desde, limit: '1000' });
    return `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${q.idVariable}?${p}`;
  }

  // Monetarias v4. limit 2000 cubre los ~1600 indicadores (incluye TIM id 1197,
  // bandas cambiarias 1187-1188 y la categoría "Informe Monetario Diario").
  const p = new URLSearchParams({ limit: '2000' });
  if (q.categoria) p.set('Categoria', String(q.categoria).slice(0, 60));
  if (q.idVariable && /^\d{1,5}$/.test(String(q.idVariable))) p.set('IdVariable', String(q.idVariable));
  return `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias?${p}`;
}

// ?endpoint=Panel: las series del panel del Banco Central en una sola respuesta.
// Por variable: el último dato, el de hace 30 días y un año, el del cierre del año anterior y el promedio
// de cada mes (tres años y medio). Las compras de dólares (78) son flujos: van sumadas, por mes y en el año.
const PANEL = [1, 78, 15, 16, 17, 19, 1526, 1528, 1532, 1534, 1341, 1564, 1355, 1265, 1266, 1225, 1259, 1221, 25];
const SUMA = new Set([78]);
async function panel(res) {
  const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 42);
  const desde = d.toISOString().slice(0, 7) + '-01';
  const rs = await Promise.allSettled(PANEL.map(id => fetch('https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/' + id + '?desde=' + desde + '&limit=1000', { signal: AbortSignal.timeout(12000) })
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })));
  const series = {};
  rs.forEach((r, k) => {
    const det = r.status === 'fulfilled' && r.value.results && r.value.results[0] && r.value.results[0].detalle;
    if (!det || !det.length) return;
    const s = det.map(x => [x.fecha, x.valor]).filter(x => Number.isFinite(x[1])).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const u = s.at(-1), antes = dias => { const t = new Date(u[0] + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - dias); const iso = t.toISOString().slice(0, 10), x = s.filter(z => z[0] <= iso).at(-1); return x ? x[1] : null; };
    const mes = {}; for (const [f, v] of s) (mes[f.slice(0, 7)] = mes[f.slice(0, 7)] || []).push(v);
    const id = PANEL[k], suma = SUMA.has(id), total = a => a.reduce((x, y) => x + y, 0);
    const inicio = u[0].slice(0, 4) + '-01-01', cierre = s.filter(z => z[0] < inicio).at(-1);
    series[id] = { u, d30: antes(30), a1: antes(365), ene: cierre ? cierre[1] : null,
      mes: Object.entries(mes).map(([m, v]) => [m, Number((suma ? total(v) : total(v) / v.length).toPrecision(6))]) };
    if (suma) {
      const t30 = new Date(u[0] + 'T00:00:00Z'); t30.setUTCDate(t30.getUTCDate() - 30);
      series[id].anio = Number(total(s.filter(z => z[0] >= inicio).map(z => z[1])).toPrecision(6));
      series[id].s30 = Number(total(s.filter(z => z[0] > t30.toISOString().slice(0, 10)).map(z => z[1])).toPrecision(6));
    }
  });
  if (Object.keys(series).length < PANEL.length / 2) return res.status(502).json({ error: 'No se pudieron cargar las series del BCRA' });
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=172800');
  return res.status(200).json({ actualizado: new Date().toISOString(), series });
}

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 60, windowSecs: 60, key: 'bcra' })) return;
  const endpoint = req.query.endpoint || 'Monetarias';
  if (endpoint === 'Panel') return panel(res).catch(() => res.status(500).json({ error: 'No se pudo conectar con BCRA API' }));

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
    // La API a veces responde 200 con la serie vacía: eso no se guarda en caché
    if (data.results?.[0]?.detalle && !data.results[0].detalle.length) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'BCRA devolvió la serie vacía' });
    }
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con BCRA API' });
  }
}
