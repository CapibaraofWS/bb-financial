// Proxy para BCRA API v4.0
// Soporta ?endpoint=Monetarias (default) — lista todas las variables con su ultValorInformado
// La v3 está deprecada — migramos a v4 que es la actual del BCRA (api.bcra.gob.ar/estadisticas/v4.0).
import zlib from 'node:zlib';
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

// ?endpoint=Pagos: Informe de Pagos Minoristas. No está en la API: sale del Excel del informe, que trae la serie
// completa en cada edición. Se guarda en Redis y se busca uno nuevo dos veces por día; si el BCRA falla o cambia
// el archivo, sigue el último guardado. Cada serie: [mes, cantidad, monto en millones de pesos].
const PAGOS_DESDE = '2021-01';
const PAGOS = [
  ['pct', /^Transferencias de fondos/, /^Pagos con transferencia interoperables/],
  ['push', /^Transferencias de fondos/, /^Transferencias inmediatas "push"$/],
  ['debito', /^Tarjetas$/, /^Tarjetas de débito$/],
  ['credito', /^Tarjetas$/, /^Tarjetas de crédito$/],
  ['cajeros', /^Resto$/, /^Extracciones en cajeros automáticos$/],
  ['cuentas', /^Cuentas de pago/, /^Cuentas de pago$/],
  ['fondos', /^Cuentas de pago/, /^Saldos en fondos comunes/],
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Redis (Upstash), como en agenda.js
async function redis(cmd) {
  const limpia = v => (v || '').trim().replace(/^["']|["']$/g, '');
  const url = limpia(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL), token = limpia(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN);
  if (!url || !token) return null;
  try {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd), signal: AbortSignal.timeout(2500) });
    return r.ok ? (await r.json()).result : null;
  } catch { return null; }
}

// Un .xlsx es un zip: se leen las entradas desde su directorio central
function unzip(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('No es un zip');
  const out = {};
  for (let p = buf.readUInt32LE(e + 16), i = buf.readUInt16LE(e + 10); i > 0; i--) {
    const largo = buf.readUInt16LE(p + 28), nombre = buf.toString('utf8', p + 46, p + 46 + largo), ini = buf.readUInt32LE(p + 42);
    const datos = ini + 30 + buf.readUInt16LE(ini + 26) + buf.readUInt16LE(ini + 28), z = buf.subarray(datos, datos + buf.readUInt32LE(p + 20));
    if (nombre.startsWith('xl/') && /\.(xml|rels)$/.test(nombre)) out[nombre] = (buf.readUInt16LE(p + 10) === 8 ? zlib.inflateRawSync(z, { maxOutputLength: 3e7 }) : z).toString('utf8');
    p += 46 + largo + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

// Hojas del Excel: { nombre: [fila] }, cada fila { número de columna: valor }
function hojasXlsx(buf) {
  const z = unzip(buf), sinEntidades = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const col = c => [...c].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0);
  const textos = [...(z['xl/sharedStrings.xml'] || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => sinEntidades([...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(t => t[1]).join('')).trim());
  const rels = (z['xl/_rels/workbook.xml.rels'] || '').match(/<Relationship [^>]*>/g) || [], hojas = {};
  for (const [s] of (z['xl/workbook.xml'] || '').matchAll(/<sheet [^>]*>/g)) {
    const id = /r:id="([^"]*)"/.exec(s)?.[1], rel = rels.find(r => r.includes('Id="' + id + '"'));
    const xml = rel && z['xl/' + /Target="([^"]*)"/.exec(rel)[1].replace(/^\/?(xl\/)?/, '')];
    if (!xml) continue;
    hojas[sinEntidades(/name="([^"]*)"/.exec(s)[1])] = [...xml.matchAll(/<row [^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)].map(f => {
      const fila = {};
      for (const c of (f[1] || '').matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const v = /<v>([^<]*)<\/v>/.exec(c[3] || '')?.[1];
        if (v != null) fila[col(c[1])] = /t="s"/.test(c[2]) ? textos[+v] : +v;
      }
      return fila;
    });
  }
  return hojas;
}

// Las columnas se ubican por su título: si el BCRA las mueve sigue andando, y si las renombra o los valores
// cambian de escala no se guarda nada y queda el último dato bueno.
function seriesPagos(hojas) {
  const out = {};
  for (const [id, hoja, titulo] of PAGOS) {
    const filas = hojas[Object.keys(hojas).find(n => hoja.test(n))] || [], datos = filas.filter(f => f[1] > 36000 && f[1] < 60000);
    const cab = filas.slice(0, filas.indexOf(datos[0])), c = +cab.map(f => Object.keys(f).find(k => titulo.test(f[k]))).find(Boolean);
    if (!c || !cab.some(f => /^Cantidad/.test(f[c]) && /^(Monto|Saldo)/.test(f[c + 1]))) throw new Error('Cambió el Excel: ' + id);
    const s = datos.map(f => [new Date(Math.round((f[1] - 25569) * 864e5)).toISOString().slice(0, 7), Math.round(f[c]), Math.round(f[c + 1] / 1e6)])
      .filter(x => x[0] >= PAGOS_DESDE && x[1] > 0 && x[2] > 0);
    const [a, b] = s.slice(-2).map(x => x[2]);
    if (s.length < 24 || b > a * 3 || b < a / 3) throw new Error('Valores raros: ' + id);
    out[id] = s;
  }
  return out;
}

async function bajarPagos(mes) {
  const url = 'https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/Informes/series-informe-mensual-pagos-minoristas-' + mes + '.xlsx';
  // El servidor del BCRA corta más o menos una de cada tres conexiones (30/10/2026)
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(8000) });
      if (r.status === 404) return null;
      const b = r.ok ? Buffer.from(await r.arrayBuffer()) : null;
      if (b && b.subarray(0, 2).toString() === 'PK') return b;
    } catch {}
    await new Promise(x => setTimeout(x, 300));
  }
  return null;
}

async function pagos(res) {
  let g = null;
  try { g = JSON.parse(await redis(['GET', 'pagos:ultimo']) || 'null'); } catch {}
  const listo = d => { res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=172800'); return res.status(200).json(d); };
  if (g && Date.now() - g.revisado < 432e5) return listo(g);
  // El informe sale a fin de mes con datos del mes anterior: se prueba del más nuevo para atrás
  for (let i = 1; i <= 3; i++) {
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i);
    const mes = d.toISOString().slice(0, 7);
    if (g && mes <= g.mes) break;
    try {
      const b = await bajarPagos(mes);
      if (!b) continue;
      const nuevo = { mes, revisado: Date.now(), series: seriesPagos(hojasXlsx(b)) };
      await redis(['SET', 'pagos:ultimo', JSON.stringify(nuevo)]);
      return listo(nuevo);
    } catch (e) { console.error('Pagos minoristas ' + mes + ': ' + e.message); }
  }
  if (g) { g.revisado = Date.now(); await redis(['SET', 'pagos:ultimo', JSON.stringify(g)]); return listo(g); }
  return res.status(502).json({ error: 'No se pudo leer el informe de pagos del BCRA' });
}

// ?endpoint=ICL: Índice para Contratos de Locación (variable 40). Son más de 2.000 valores diarios: para ajustar un
// alquiler alcanza con el del día 1 de cada mes y el último publicado (el BCRA lo publica por adelantado hasta el 16).
async function icl(res) {
  const r = await fetch('https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/40?desde=2020-07-01&limit=3000', { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('BCRA');
  const s = ((await r.json()).results?.[0]?.detalle || []).filter(x => Number.isFinite(x.valor) && x.valor > 0).map(x => [x.fecha, x.valor]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (s.length < 1000) throw new Error('serie corta');
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=172800');
  return res.status(200).json({ meses: s.filter(x => x[0].endsWith('-01')).map(x => [x[0].slice(0, 7), x[1]]), ultimo: s.at(-1) });
}

// ?endpoint=ITCRM: tipo de cambio real multilateral y bilaterales. No está en la API: sale del Excel del BCRA, que pesa
// 3,6 MB y tarda en bajar. Se guarda en Redis y se revisa dos veces por día; si falla o cambia el formato, sigue el último bueno.
const ITCRM_COLS = { itcrm: /^ITCRM/, brasil: /Brasil/, eeuu: /Estados Unidos/, china: /China/ };
function seriesItcrm(hojas) {
  const nombre = Object.keys(hojas), diaria = hojas[nombre.find(n => /^ITCRM y bilaterales$/.test(n.trim()))], mensual = hojas[nombre.find(n => /prom\. mens/.test(n))];
  const fecha = v => new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const leer = filas => {
    const cab = (filas || []).find(f => Object.values(f).some(v => /^Per[ií]odo/.test(v))) || {};
    const col = Object.fromEntries(Object.entries(ITCRM_COLS).map(([k, re]) => [k, +Object.keys(cab).find(c => re.test(cab[c]))]));
    if (Object.values(col).some(c => !c)) throw new Error('Cambió el Excel');
    const k0 = +Object.keys(cab).find(c => /^Per[ií]odo/.test(cab[c]));
    return filas.filter(f => f[k0] > 30000 && f[k0] < 60000 && Number.isFinite(f[col.itcrm])).map(f => [fecha(f[k0]), ...Object.values(col).map(c => (Number.isFinite(f[c]) ? Math.round(f[c] * 100) / 100 : null))]);
  };
  const m = leer(mensual).map(x => [x[0].slice(0, 7), ...x.slice(1)]), d = leer(diaria).at(-1);
  const [a, b] = m.slice(-2).map(x => x[1]);
  if (m.length < 300 || !d || b > a * 1.5 || b < a / 1.5 || d[1] > b * 1.5 || d[1] < b / 1.5) throw new Error('Valores raros');
  return { mensual: m, ultimo: d };
}
async function itcrm(res) {
  let g = null;
  try { g = JSON.parse(await redis(['GET', 'itcrm:ultimo']) || 'null'); } catch {}
  const listo = d => { res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=172800'); return res.status(200).json(d); };
  if (g && Date.now() - g.revisado < 432e5) return listo(g);
  try {
    // El servidor corta algunas conexiones: se reintenta mientras quede tiempo (la función dura 30 s como máximo)
    const fin = Date.now() + 26000;
    for (let i = 0, b = null; i < 6 && !b && fin - Date.now() > 4000; i++) {
      try {
        const r = await fetch('https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/ITCRMSerie.xlsx', { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(fin - Date.now()) });
        const x = r.ok ? Buffer.from(await r.arrayBuffer()) : null;
        if (x && x.subarray(0, 2).toString() === 'PK') b = x;
      } catch {}
      if (b) {
        const d = { ...seriesItcrm(hojasXlsx(b)), revisado: Date.now() };
        await redis(['SET', 'itcrm:ultimo', JSON.stringify(d)]);
        return listo(d);
      }
      await new Promise(x => setTimeout(x, 300));
    }
  } catch (e) { console.error('ITCRM: ' + e.message); }
  if (!g) return res.status(502).json({ error: 'No se pudo leer el tipo de cambio real del BCRA' });
  g.revisado = Date.now();
  await redis(['SET', 'itcrm:ultimo', JSON.stringify(g)]);
  return listo(g);
}

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 60, windowSecs: 60, key: 'bcra' })) return;
  const endpoint = req.query.endpoint || 'Monetarias';
  if (endpoint === 'Panel') return panel(res).catch(() => res.status(500).json({ error: 'No se pudo conectar con BCRA API' }));
  if (endpoint === 'Pagos') return pagos(res).catch(() => res.status(500).json({ error: 'No se pudo leer el informe de pagos del BCRA' }));
  if (endpoint === 'ICL') return icl(res).catch(() => res.status(500).json({ error: 'No se pudo conectar con BCRA API' }));
  if (endpoint === 'ITCRM') return itcrm(res).catch(() => res.status(500).json({ error: 'No se pudo leer el tipo de cambio real del BCRA' }));

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
