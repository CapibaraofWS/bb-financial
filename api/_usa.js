// Panel Estados Unidos: arma en el servidor los datos de cada sección desde las fuentes oficiales.
// BLS (precios y empleo), BEA (PBI y PCE), FRED (tasas, expectativas y calendario) y el Tesoro (deuda y déficit).
// Las claves viven en las variables de entorno de Vercel. Modos: ?usa=resumen | precios | empleo | calendario
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; bbfinanzas.com.ar)' };   // BLS rechaza los pedidos sin navegador
const anio = () => new Date().getUTCFullYear();
const num = v => { const n = Number(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

// ---- BLS: { serie: [{ p: 'AAAA-MM', v }] } en orden. Hasta 50 series y 20 años por pedido.
async function bls(ids, desde) {
  const out = {}, partes = [];
  for (let i = 0; i < ids.length; i += 50) partes.push(ids.slice(i, i + 50));
  const pedir = seriesid => fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...UA }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ seriesid, startyear: String(desde), endyear: String(anio()), registrationkey: process.env.BLS_API_KEY }),
  }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  await Promise.all(partes.map(async seriesid => {
    // Con varios pedidos seguidos BLS a veces contesta "sitio ocupado": un reintento
    let j = await pedir(seriesid);
    if (!j || j.status !== 'REQUEST_SUCCEEDED') { await new Promise(r => setTimeout(r, 1500)); j = await pedir(seriesid); }
    if (!j || j.status !== 'REQUEST_SUCCEEDED') throw new Error('BLS');
    for (const s of j.Results.series) {
      out[s.seriesID] = s.data.filter(d => /^M(0[1-9]|1[0-2])$/.test(d.period))
        .map(d => ({ p: d.year + '-' + d.period.slice(1), v: num(d.value) })).filter(x => x.v !== null).reverse();
    }
  }));
  return out;
}

// ---- FRED: [{ f: 'AAAA-MM-DD', v }] en orden
async function fred(id, desde) {
  const u = 'https://api.stlouisfed.org/fred/series/observations?series_id=' + id + '&api_key=' + process.env.FRED_API_KEY +
    '&file_type=json&observation_start=' + desde;
  const r = await fetch(u, { signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error('FRED ' + r.status);
  return (await r.json()).observations.map(o => ({ f: o.date, v: num(o.value) })).filter(x => x.v !== null);
}

// ---- BEA (NIPA): { línea: [{ p, v }] } en orden. Los períodos vienen como 2026Q2 o 2026M08.
async function bea(tabla, frec, lineas, anios) {
  const u = 'https://apps.bea.gov/api/data/?UserID=' + process.env.BEA_API_KEY + '&method=GetData&datasetname=NIPA&TableName=' + tabla +
    '&Frequency=' + frec + '&Year=' + anios.join(',') + '&ResultFormat=JSON';
  const r = await fetch(u, { signal: AbortSignal.timeout(9000) });
  const j = await r.json();
  const res = j && j.BEAAPI && j.BEAAPI.Results;
  if (!res || !res.Data) throw new Error('BEA');
  const out = {};
  for (const d of res.Data) {
    if (!lineas.includes(d.LineNumber)) continue;
    const p = d.TimePeriod.replace(/M(\d\d)$/, '-$1');
    (out[d.LineNumber] = out[d.LineNumber] || []).push({ p, v: num(d.DataValue) });
  }
  for (const k in out) out[k] = out[k].filter(x => x.v !== null).sort((a, b) => (a.p < b.p ? -1 : 1));
  const nota = (res.Notes || []).find(n => n.NoteRef === tabla);
  out.revisado = nota && (nota.NoteText.match(/LastRevised:\s*(.+)$/) || [])[1] || null;
  return out;
}

// ---- Tesoro (Fiscal Data, sin clave)
const tesoro = (ruta, q) => fetch('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/' + ruta + '?' + q, { signal: AbortSignal.timeout(9000) })
  .then(r => { if (!r.ok) throw new Error('Tesoro ' + r.status); return r.json(); }).then(j => j.data);

// Calendario: las publicaciones que más se siguen, con la fecha de FRED (que toma la de cada organismo)
const PUBLICACIONES = {
  10: ['Inflación (IPC)', 'precios', 'BLS'], 46: ['Precios mayoristas (PPI)', 'precios', 'BLS'], 54: ['Ingreso y gasto personal (PCE)', 'precios', 'BEA'],
  50: ['Empleo (nóminas y desempleo)', 'empleo', 'BLS'], 192: ['Vacantes (JOLTS)', 'empleo', 'BLS'], 180: ['Pedidos de subsidio por desempleo', 'empleo', 'Dpto. de Trabajo'],
  53: ['PBI', 'actividad', 'BEA'], 9: ['Ventas minoristas', 'actividad', 'Census'], 13: ['Producción industrial', 'actividad', 'Fed'],
  51: ['Comercio exterior', 'comercio', 'BEA y Census'], 101: ['Decisión de tasas de la Fed (FOMC)', 'tasas', 'Fed'], 91: ['Confianza del consumidor (Michigan)', 'actividad', 'U. de Michigan'],
};
async function calendario() {
  const hoy = new Date(), desde = new Date(hoy - 21 * 864e5).toISOString().slice(0, 10);
  const u = 'https://api.stlouisfed.org/fred/releases/dates?api_key=' + process.env.FRED_API_KEY + '&file_type=json&realtime_start=' + desde +
    '&realtime_end=9999-12-31&include_release_dates_with_no_data=true&sort_order=asc&limit=1000';
  const r = await fetch(u, { signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error('FRED calendario ' + r.status);
  const j = await r.json();
  const vistos = new Set();
  return (j.release_dates || []).filter(d => PUBLICACIONES[d.release_id]).map(d => {
    const [nombre, tema, quien] = PUBLICACIONES[d.release_id];
    return { fecha: d.date, id: d.release_id, nombre, tema, quien, original: d.release_name };
  }).filter(e => { const k = e.id + e.fecha; if (vistos.has(k)) return false; vistos.add(k); return true; })
    .filter(e => e.fecha <= new Date(hoy.getTime() + 75 * 864e5).toISOString().slice(0, 10));
}

// ---- Precios
const IPC_RUBROS = [['SAF11', 'Alimentos en el hogar'], ['SEFV', 'Comidas fuera del hogar'], ['SA0E', 'Energía'], ['SETB01', 'Nafta'], ['SEHF01', 'Electricidad'],
  ['SAH1', 'Vivienda (alquileres)'], ['SAM', 'Salud'], ['SAS4', 'Servicios de transporte'], ['SETA01', 'Autos nuevos'], ['SETA02', 'Autos usados'],
  ['SAA', 'Ropa'], ['SAR', 'Recreación'], ['SAE', 'Educación y comunicaciones'], ['SACL1E', 'Bienes sin alimentos ni energía'], ['SASLE', 'Servicios sin energía']];
async function precios() {
  const ids = ['CUUR0000SA0', 'CUSR0000SA0', 'CUUR0000SA0L1E', 'CUSR0000SA0L1E', 'WPUFD4', 'WPSFD4', 'WPUFD49104',
    ...IPC_RUBROS.flatMap(([k]) => ['CUUR0000' + k, 'CUSR0000' + k])];
  const hace2 = new Date(Date.now() - 800 * 864e5).toISOString().slice(0, 10);
  const [b, pce, t5, mich] = await Promise.all([
    bls(ids, 2016),
    bea('T20804', 'M', ['1', '25', '28'], Array.from({ length: anio() - 2015 }, (_, i) => 2016 + i)).catch(() => null),
    fred('T5YIE', hace2).catch(() => []), fred('MICH', '2016-01-01').catch(() => []),
  ]);
  return {
    ipc: { nsa: b.CUUR0000SA0, sa: b.CUSR0000SA0 }, nucleo: { nsa: b.CUUR0000SA0L1E, sa: b.CUSR0000SA0L1E },
    rubros: IPC_RUBROS.map(([k, n]) => ({ k, nombre: n, nsa: (b['CUUR0000' + k] || []).slice(-26), sa: (b['CUSR0000' + k] || []).slice(-26) })),
    ppi: { nsa: b.WPUFD4, sa: b.WPSFD4, nucleo: b.WPUFD49104 },
    pce: pce && { general: pce['1'], nucleo: pce['25'], servicios: pce['28'], revisado: pce.revisado },
    expectativas: { breakeven5: t5, michigan: mich },
  };
}

// ---- Empleo
const SECTORES = [['10', 'Minería'], ['20', 'Construcción'], ['30', 'Industria'], ['40', 'Comercio, transporte y servicios públicos'], ['50', 'Información'],
  ['55', 'Finanzas'], ['60', 'Servicios profesionales y empresariales'], ['65', 'Educación y salud'], ['70', 'Hotelería, gastronomía y entretenimiento'], ['80', 'Otros servicios'], ['90', 'Gobierno']];
const ESTADOS = ['01', '02', '04', '05', '06', '08', '09', '10', '11', '12', '13', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '44', '45', '46', '47', '48', '49', '50', '51', '53', '54', '55', '56'];
async function empleo() {
  const ids = ['CES0000000001', 'LNS14000000', 'LNS13327709', 'LNS11300000', 'LNS12300060', 'CES0500000003', 'LNS13000000', 'CUUR0000SA0',
    'JTS000000000000000JOL', 'JTS000000000000000QUR', 'JTS000000000000000HIR', 'JTS000000000000000LDR', ...SECTORES.map(([k]) => 'CES' + k + '00000001')];
  const est = ESTADOS.map(c => 'LASST' + c + '0000000000003');
  const [b, e, icsa] = await Promise.all([bls(ids, 2016), bls(est, anio() - 2),
    fred('ICSA', new Date(Date.now() - 800 * 864e5).toISOString().slice(0, 10)).catch(() => [])]);
  return {
    nominas: b.CES0000000001, desempleo: b.LNS14000000, u6: b.LNS13327709, participacion: b.LNS11300000, empleo2554: b.LNS12300060,
    salarioHora: b.CES0500000003, desocupados: b.LNS13000000, ipc: b.CUUR0000SA0,
    jolts: { vacantes: b.JTS000000000000000JOL, renuncias: b.JTS000000000000000QUR, contrataciones: b.JTS000000000000000HIR, despidos: b.JTS000000000000000LDR },
    sectores: SECTORES.map(([k, n]) => ({ k, nombre: n, s: (b['CES' + k + '00000001'] || []).slice(-40) })),
    estados: Object.fromEntries(ESTADOS.map(c => [c, e['LASST' + c + '0000000000003'] || []])),
    subsidios: icsa,
  };
}

// ---- Resumen: PBI (BEA), tasas (FRED) y deuda y déficit (Tesoro). Precios y empleo los toma de sus modos.
async function resumen() {
  const anios = [anio() - 3, anio() - 2, anio() - 1, anio()], hace = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
  const [pbi, real, nominal, sup, inf, d10, d2, deuda, mts] = await Promise.all([
    bea('T10101', 'Q', ['1'], anios), bea('T10106', 'Q', ['1'], anios), bea('T10105', 'Q', ['1'], anios),
    fred('DFEDTARU', hace(800)), fred('DFEDTARL', hace(800)), fred('DGS10', hace(400)), fred('DGS2', hace(400)),
    tesoro('v2/accounting/od/debt_to_penny', 'sort=-record_date&page[size]=400&fields=record_date,tot_pub_debt_out_amt,debt_held_public_amt,intragov_hold_amt'),
    tesoro('v1/accounting/mts/mts_table_1', 'sort=-record_date&page[size]=60'),
  ]);
  // MTS tabla 1: el último informe trae los meses del año fiscal anterior y del actual, con su acumulado
  const ult = mts[0] && mts[0].record_date, filas = mts.filter(r => r.record_date === ult).sort((a, b) => a.src_line_nbr - b.src_line_nbr);
  const anioFiscal = []; let fy = null;
  for (const r of filas) {
    const m = /^FY (\d{4})$/.exec(r.classification_desc);
    if (m) { anioFiscal.push(fy = { fy: +m[1], meses: [], acumulado: null }); continue; }
    if (!fy) continue;
    const fila = { mes: r.classification_desc, ingresos: num(r.current_month_gross_rcpt_amt), gastos: num(r.current_month_gross_outly_amt), deficit: num(r.current_month_dfct_sur_amt) };
    if (r.classification_desc === 'Year-to-Date') fy.acumulado = fila; else fy.meses.push(fila);
  }
  return {
    pbi: { variacion: pbi['1'], real: real['1'], nominal: nominal['1'], revisado: pbi.revisado },
    fed: { techo: sup, piso: inf }, bonos: { d10, d2 },
    deuda: deuda.map(d => ({ f: d.record_date, total: num(d.tot_pub_debt_out_amt), publico: num(d.debt_held_public_amt), intra: num(d.intragov_hold_amt) })).reverse(),
    fiscal: { informe: ult, anios: anioFiscal },
  };
}

// ---- Respaldo en Redis (Upstash): si una fuente no contesta, se sirve el último armado completo
async function redis(cmd) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd), signal: AbortSignal.timeout(2500) });
    return r.ok ? (await r.json()).result : null;
  } catch { return null; }
}

const MODOS = { resumen, precios, empleo, calendario };
export async function usa(req, res) {
  const modo = req.query.usa, f = MODOS[modo];
  if (!f) return res.status(400).json({ error: 'Modo no válido' });
  if (!process.env.BLS_API_KEY || !process.env.BEA_API_KEY) return res.status(500).json({ error: 'Servicio temporalmente no disponible' });
  try {
    const data = await f();
    const cuerpo = { actualizado: new Date().toISOString(), ...(Array.isArray(data) ? { eventos: data } : data) };
    await redis(['SET', 'usa:' + modo, JSON.stringify(cuerpo), 'EX', String(30 * 86400)]);
    // Son datos mensuales o trimestrales (la deuda y las tasas, diarios): con 3 horas alcanza
    res.setHeader('Cache-Control', 's-maxage=10800, stale-while-revalidate=86400');
    return res.status(200).json(cuerpo);
  } catch {
    const guardado = await redis(['GET', 'usa:' + modo]);
    if (guardado) {
      res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
      return res.status(200).json({ ...JSON.parse(guardado), respaldo: true });
    }
    return res.status(502).json({ error: 'No se pudieron cargar los datos oficiales' });
  }
}
