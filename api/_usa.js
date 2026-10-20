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
    method: 'POST', headers: { 'Content-Type': 'application/json', ...UA }, signal: AbortSignal.timeout(7000),
    body: JSON.stringify({ seriesid, startyear: String(desde), endyear: String(anio()), registrationkey: process.env.BLS_API_KEY }),
  }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  await Promise.all(partes.map(async seriesid => {
    // BLS a veces contesta "sitio ocupado" por unos segundos: hasta dos reintentos
    let j = await pedir(seriesid);
    for (const espera of [1500, 3500]) {
      if (j && j.status === 'REQUEST_SUCCEEDED') break;
      await new Promise(r => setTimeout(r, espera)); j = await pedir(seriesid);
    }
    if (!j || j.status !== 'REQUEST_SUCCEEDED') throw new Error('BLS');
    for (const s of j.Results.series) {
      out[s.seriesID] = s.data.filter(d => /^M(0[1-9]|1[0-2])$/.test(d.period))
        .map(d => ({ p: d.year + '-' + d.period.slice(1), v: num(d.value) })).filter(x => x.v !== null).reverse();
    }
  }));
  return out;
}

// ---- FRED: [{ f: 'AAAA-MM-DD', v }] en orden
// mensual = true: FRED devuelve el promedio de cada mes (para series diarias o semanales largas)
async function fred(id, desde, mensual) {
  const u = 'https://api.stlouisfed.org/fred/series/observations?series_id=' + id + '&api_key=' + process.env.FRED_API_KEY +
    '&file_type=json&observation_start=' + desde + (mensual ? '&frequency=m&aggregation_method=avg' : '');
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

// Calendario: las publicaciones que más se siguen, con la fecha de FRED (que toma la de cada organismo).
// [nombre, tema, quién la publica, hora de Nueva York]
const PUBLICACIONES = {
  10: ['Inflación (IPC)', 'precios', 'BLS', '8:30'], 46: ['Precios mayoristas (PPI)', 'precios', 'BLS', '8:30'], 54: ['Ingreso y gasto personal (PCE)', 'precios', 'BEA', '8:30'],
  50: ['Empleo (nóminas y desempleo)', 'empleo', 'BLS', '8:30'], 192: ['Vacantes (JOLTS)', 'empleo', 'BLS', '10:00'], 180: ['Pedidos de subsidio por desempleo', 'empleo', 'Dpto. de Trabajo', '8:30'],
  53: ['PBI', 'actividad', 'BEA', '8:30'], 9: ['Ventas minoristas', 'actividad', 'Census', '8:30'], 13: ['Producción industrial', 'actividad', 'Fed', '9:15'],
  51: ['Comercio exterior', 'comercio', 'BEA y Census', '8:30'], 91: ['Confianza del consumidor (Michigan)', 'actividad', 'U. de Michigan', '10:00'],
};
// Hora de Nueva York → hora argentina (UTC−3 todo el año; Nueva York cambia de horario en marzo y noviembre)
const horaAR = (fecha, h) => {
  const off = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' }).formatToParts(new Date(fecha + 'T12:00:00Z')).find(p => p.type === 'timeZoneName').value;
  const [hh, mm] = h.split(':').map(Number), t = hh * 60 + mm + (-3 - Number(off.replace('GMT', ''))) * 60;
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
};
// Reuniones de la Fed: de su calendario oficial. La decisión se anuncia el último día, a las 14 de Nueva York.
async function reunionesFed() {
  const r = await fetch('https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', { headers: UA, signal: AbortSignal.timeout(9000) });
  if (!r.ok) return [];
  const s = await r.text(), out = [];
  const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const partes = s.split(/<h4><a id="\d+">(\d{4}) FOMC Meetings<\/a><\/h4>/);
  for (let i = 1; i < partes.length; i += 2) {
    const re = /fomc-meeting__month[^>]*><strong>([A-Za-z/]+)<\/strong><\/div>\s*<div class="[^"]*fomc-meeting__date[^"]*">([^<]+)<\/div>/g; let m;
    while ((m = re.exec(partes[i + 1]))) {
      const mes = M.indexOf(m[1].split('/').at(-1)) + 1, d = +m[2].replace(/[^\d-]/g, '').split('-').at(-1);
      if (mes && d) out.push({ fecha: partes[i] + '-' + String(mes).padStart(2, '0') + '-' + String(d).padStart(2, '0'), proyecciones: m[2].includes('*') });
    }
  }
  return out;
}
async function calendario() {
  const hoy = new Date(), iso = d => d.toISOString().slice(0, 10), desde = iso(new Date(hoy - 21 * 864e5)), hasta = iso(new Date(hoy.getTime() + 75 * 864e5));
  const porId = await Promise.all(Object.keys(PUBLICACIONES).map(id => fetch('https://api.stlouisfed.org/fred/release/dates?release_id=' + id + '&api_key=' + process.env.FRED_API_KEY +
    '&file_type=json&realtime_start=' + desde + '&realtime_end=9999-12-31&include_release_dates_with_no_data=true&sort_order=asc&limit=60', { signal: AbortSignal.timeout(9000) })
    .then(r => (r.ok ? r.json() : null)).then(j => (j && j.release_dates) || []).catch(() => [])));
  const ev = [];
  Object.keys(PUBLICACIONES).forEach((id, k) => {
    const [nombre, tema, quien, h] = PUBLICACIONES[id];
    for (const d of new Set(porId[k].map(x => x.date))) if (d >= desde && d <= hasta) ev.push({ fecha: d, hora: horaAR(d, h), nombre, tema, quien });
  });
  for (const f of await reunionesFed().catch(() => [])) if (f.fecha >= desde && f.fecha <= hasta)
    ev.push({ fecha: f.fecha, hora: horaAR(f.fecha, '14:00'), nombre: 'Decisión de tasas de la Fed' + (f.proyecciones ? ' (con proyecciones)' : ''), tema: 'tasas', quien: 'Fed' });
  if (!ev.length) throw new Error('calendario vacío');
  return ev.sort((a, b) => (a.fecha + a.hora.padStart(5, '0') < b.fecha + b.hora.padStart(5, '0') ? -1 : 1));
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
    fred('DFEDTARU', hace(800)), fred('DFEDTARL', hace(800)), fred('DGS10', hace(800)), fred('DGS2', hace(800)),
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

// ---- Actividad: PBI por componente, ingreso y ahorro (BEA), PBI por estado (BEA Regional) e indicadores mensuales (FRED)
async function beaEstados() {
  const u = 'https://apps.bea.gov/api/data/?UserID=' + process.env.BEA_API_KEY + '&method=GetData&datasetname=Regional&TableName=SQGDP9&LineCode=1&GeoFips=STATE&Year=LAST5&ResultFormat=JSON';
  const j = await fetch(u, { signal: AbortSignal.timeout(9000) }).then(r => r.json());
  const out = {};
  for (const d of (j && j.BEAAPI && j.BEAAPI.Results && j.BEAAPI.Results.Data) || []) {
    const c = d.GeoFips.slice(0, 2), v = num(d.DataValue);
    if (d.GeoFips.endsWith('000') && c !== '00' && +c < 60 && v !== null) (out[c] = out[c] || []).push({ p: d.TimePeriod, v });
  }
  for (const c in out) out[c].sort((a, b) => (a.p < b.p ? -1 : 1));
  return out;
}
async function actividad() {
  const anios = Array.from({ length: anio() - 2015 }, (_, i) => 2016 + i), d = '2016-01-01', f = (id, m) => fred(id, d, m).catch(() => []);
  const [aportes, ingreso, consumo, estados, indpro, tcu, ventas, ventasReales, michigan, viviendas, gdpnow] = await Promise.all([
    bea('T10102', 'Q', ['1', '2', '8', '14', '15', '22'], anios),
    bea('T20600', 'M', ['35', '37'], anios),
    bea('T20806', 'M', ['1'], anios).catch(() => null),
    beaEstados().catch(() => null),
    f('INDPRO'), f('TCU'), f('RSAFS'), f('RRSFS'), f('UMCSENT'), f('HOUST'), fred('GDPNOW', '2024-01-01').catch(() => []),
  ]);
  return {
    pbi: { pbi: aportes['1'], consumo: aportes['2'], inversion: aportes['8'], inventarios: aportes['14'], exportacionesNetas: aportes['15'], gobierno: aportes['22'], revisado: aportes.revisado },
    familias: { ahorro: ingreso['35'], ingresoReal: ingreso['37'], consumoReal: consumo && consumo['1'] },
    estados, indpro, capacidad: tcu, ventas, ventasReales, michigan, viviendas, gdpnow,
  };
}

// ---- Tasas: la Fed, la curva de bonos, tasas reales, hipotecas, crédito y lo que paga el Tesoro
const PLAZOS = [['DGS1MO', '1 mes'], ['DGS3MO', '3 meses'], ['DGS6MO', '6 meses'], ['DGS1', '1 año'], ['DGS2', '2 años'], ['DGS3', '3 años'], ['DGS5', '5 años'], ['DGS7', '7 años'], ['DGS10', '10 años'], ['DGS20', '20 años'], ['DGS30', '30 años']];
async function tasas() {
  const hace = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10), f = (id, desde, m) => fred(id, desde, m).catch(() => []);
  const [curva, diarias, mensuales, costo] = await Promise.all([
    Promise.all(PLAZOS.map(([id]) => f(id, hace(400)))),
    Promise.all(['DFEDTARU', 'DFEDTARL', 'EFFR', 'SOFR', 'DFII10', 'T10YIE', 'T10Y2Y', 'T10Y3M', 'MORTGAGE30US', 'BAMLH0A0HYM2', 'BAMLC0A0CM', 'WALCL'].map(id => f(id, hace(800)))),
    Promise.all([['FEDFUNDS', false], ['GS2', false], ['GS10', false], ['TB3MS', false], ['USREC', false], ['MORTGAGE30US', true], ['BAMLH0A0HYM2', true], ['BAMLC0A0CM', true], ['WALCL', true], ['DFII10', true]].map(([id, m]) => f(id, '2000-01-01', m))),
    tesoro('v2/accounting/od/avg_interest_rates', 'sort=-record_date&page[size]=200&filter=security_desc:eq:Total Marketable').catch(() => []),
  ]);
  const [techo, piso, efectiva, sofr, real10, inflacion10, d10y2, d10y3m, hipoteca, hy, ig, balance] = diarias;
  const [fedfunds, gs2, gs10, tb3, recesion, hipotecaM, hyM, igM, balanceM, realM] = mensuales;
  const corta = s => s.map(x => ({ p: x.f.slice(0, 7), v: x.v }));
  return {
    curva: PLAZOS.map(([id, n], i) => ({ id, plazo: n, s: curva[i] })),
    diarias: { techo, piso, efectiva, sofr, real10, inflacion10, d10y2, d10y3m, hipoteca, hy, ig, balance },
    mensuales: { fedfunds: corta(fedfunds), bono2: corta(gs2), bono10: corta(gs10), letra3m: corta(tb3), recesion: corta(recesion), hipoteca: corta(hipotecaM), hy: corta(hyM), ig: corta(igM), balance: corta(balanceM), real10: corta(realM) },
    costoDeuda: costo.map(r => ({ p: r.record_date.slice(0, 7), v: num(r.avg_interest_rate_amt) })).filter(x => x.v !== null).reverse(),
  };
}

// ---- Respaldo en Redis (Upstash): si una fuente no contesta, se sirve el último armado completo
async function redis(cmd) {
  // Acepta los nombres de Upstash y los de la integración de Vercel (KV_*), sin comillas
  const limpia = v => (v || '').trim().replace(/^["']|["']$/g, '');
  const url = limpia(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL), token = limpia(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN);
  if (!url || !token) return null;
  try {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd), signal: AbortSignal.timeout(2500) });
    return r.ok ? (await r.json()).result : null;
  } catch { return null; }
}

const MODOS = { resumen, precios, empleo, calendario, actividad, tasas };
export async function usa(req, res) {
  const modo = req.query.usa, f = MODOS[modo];
  if (!f) return res.status(400).json({ error: 'Modo no válido' });
  if (!process.env.BLS_API_KEY || !process.env.BEA_API_KEY) return res.status(500).json({ error: 'Servicio temporalmente no disponible' });
  try {
    const data = await f();
    const cuerpo = { actualizado: new Date().toISOString(), ...(Array.isArray(data) ? { eventos: data } : data) };
    await redis(['SET', 'usa:' + modo, JSON.stringify(cuerpo), 'EX', String(30 * 86400)]);
    // Son datos mensuales o trimestrales (la deuda y las tasas, diarios): con 3 horas alcanza.
    // Si al renovar la fuente no contesta, Vercel sigue sirviendo la copia anterior hasta 7 días.
    res.setHeader('Cache-Control', 's-maxage=10800, stale-while-revalidate=604800');
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
