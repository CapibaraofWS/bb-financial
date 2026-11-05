// Endpoint multiplex para datos de la Agenda AR
// ?source=finanzas-news       → últimas noticias de la Secretaría de Finanzas
// ?source=finanzas-cronograma  → cronograma de licitaciones del Tesoro
// ?source=bcra-calendario      → calendario de informes BCRA
// ?source=arca-recaudacion     → informe mensual de recaudación de ARCA (publicado o con fecha estimada)
// Consolidado en un solo endpoint para no superar el límite de funciones del plan Hobby.
import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';
import * as K from './_curvas.js';

const UA = 'Mozilla/5.0 (compatible; BBFinanzasBot/1.0)';
const TIMEOUT = 9000;

// ============================================================
// HELPERS COMUNES
// ============================================================
function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ');
}
function todayStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// ============================================================
// FINANZAS NEWS
// ============================================================
function classifyNews(title) {
  const t = title.toLowerCase();
  if (t.includes('llamado a licitaci')) return 'llamado';
  if (t.includes('resultado de la licitaci') || t.includes('resultado de la segunda vuelta')) return 'resultado';
  if (t.includes('conversion') || t.includes('conversión')) return 'conversion';
  if (t.includes('comunicaci')) return 'comunicado';
  return 'otro';
}

function parseFinanzasNews(html) {
  const items = [];
  const BASE = 'https://www.argentina.gob.ar';
  const re = /<a\s+href="(\/noticias\/[^"]+)"\s+class="panel\s+panel-default"[\s\S]*?<\/a>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const block = match[0];
    const link = match[1];
    const imgMatch = block.match(/background-image:url\(([^)]+)\)/);
    const timeMatch = block.match(/<time\s+datetime=['"]([^'"]+)['"][^>]*>([^<]+)<\/time>/i);
    const h3Match = block.match(/<h3>([\s\S]*?)<\/h3>/i);
    if (!h3Match) continue;
    const title = decodeEntities(h3Match[1].replace(/<[^>]+>/g, '').trim());
    if (!title) continue;
    items.push({
      title,
      link: BASE + link,
      datetime: timeMatch ? timeMatch[1] : '',
      dateLabel: timeMatch ? timeMatch[2].trim() : '',
      img: imgMatch ? imgMatch[1].trim() : '',
      type: classifyNews(title),
    });
  }
  return items;
}

async function getFinanzasNews() {
  const r = await fetch('https://www.argentina.gob.ar/economia/finanzas/noticias', {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { 'User-Agent': UA },
  });
  if (!r.ok) throw new Error('Finanzas Noticias respondió ' + r.status);
  const html = await r.text();
  const items = parseFinanzasNews(html).slice(0, 20);
  return { source: 'argentina.gob.ar/economia/finanzas/noticias', count: items.length, items };
}

// ============================================================
// FINANZAS CRONOGRAMA
// ============================================================
function parseDDMMYYYY(s) {
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

function extractCronEvents(html) {
  const m = html.match(/const\s+holidays\d{4}\s*=\s*\[([\s\S]*?)\]\s*;/);
  if (!m) return [];
  try { return JSON.parse('[' + m[1] + ']'); }
  catch {
    const events = [];
    const re = /\{\s*"date"\s*:\s*"([^"]+)"\s*,\s*"label"\s*:\s*"([^"]+)"\s*,\s*"type"\s*:\s*"([^"]+)"\s*\}/g;
    let mm;
    while ((mm = re.exec(m[1])) !== null) events.push({ date: mm[1], label: mm[2], type: mm[3] });
    return events;
  }
}

async function getFinanzasCronograma() {
  const year = new Date().getFullYear();
  const years = [year, year + 1];
  const all = [];
  for (const y of years) {
    try {
      const r = await fetch(`https://www.argentina.gob.ar/economia/finanzas/licitaciones-de-letras-y-bonos-del-tesoro/cronograma-${y}`, {
        signal: AbortSignal.timeout(TIMEOUT),
        headers: { 'User-Agent': UA },
      });
      if (!r.ok) continue;
      const html = await r.text();
      const events = extractCronEvents(html);
      for (const e of events) {
        const d = parseDDMMYYYY(e.date);
        if (!d) continue;
        all.push({ ...e, year: y, iso: d.toISOString().slice(0, 10), ts: d.getTime() });
      }
    } catch {}
  }
  if (!all.length) throw new Error('No se pudieron parsear eventos del cronograma');
  all.sort((a, b) => a.ts - b.ts);
  const start = todayStart();
  const upcoming = all.filter(e => e.ts >= start);
  const past = all.filter(e => e.ts < start).slice(-10);
  return {
    source: 'argentina.gob.ar cronograma',
    totalEvents: all.length,
    upcoming: upcoming.slice(0, 30),
    past,
    nextLicitacion: upcoming.find(e => e.type === 'licitacion') || null,
    nextLlamado:    upcoming.find(e => e.type === 'llamado')    || null,
  };
}

// ============================================================
// BCRA CALENDARIO
// ============================================================
const MONTHS = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };

function parseSpanishDate(s) {
  const m = String(s || '').toLowerCase().match(/(\d{1,2})\s+([a-zñ]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].slice(0, 3)];
  if (month === undefined) return null;
  return new Date(parseInt(m[3]), month, parseInt(m[1]));
}

function parseBcraTable(html) {
  const items = [];
  const re = /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const report = decodeEntities(m[1].replace(/<[^>]+>/g, '').trim());
    const dateStr = decodeEntities(m[2].replace(/<[^>]+>/g, '').trim());
    if (!report || /^informe$/i.test(report) || /^fecha/i.test(report)) continue;
    const d = parseSpanishDate(dateStr);
    items.push({
      report, dateLabel: dateStr,
      iso: d ? d.toISOString().slice(0, 10) : null,
      ts:  d ? d.getTime() : null,
      isDaily: /diari/i.test(dateStr),
    });
  }
  return items;
}

async function getBcraCalendario() {
  const r = await fetch('https://www.bcra.gob.ar/calendario-de-informes/', {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { 'User-Agent': UA },
  });
  if (!r.ok) throw new Error('BCRA respondió ' + r.status);
  const html = await r.text();
  const all = parseBcraTable(html);
  const start = todayStart();
  const upcoming = all.filter(it => it.ts !== null && it.ts >= start).sort((a, b) => a.ts - b.ts);
  const past     = all.filter(it => it.ts !== null && it.ts < start).sort((a, b) => b.ts - a.ts).slice(0, 10);
  const daily    = all.filter(it => it.isDaily);
  return {
    source: 'bcra.gob.ar/calendario-de-informes',
    totalEvents: all.length,
    upcoming: upcoming.slice(0, 30),
    past, daily,
    nextREM:       upcoming.find(it => /relevamiento de expectativas/i.test(it.report)) || null,
    nextIPOM:      upcoming.find(it => /política monetaria|ipom/i.test(it.report))      || null,
    nextMonetario: upcoming.find(it => /informe monetario mensual/i.test(it.report))    || null,
  };
}

// ============================================================
// BONOS AR + RIESGO PAÍS INTRADAY
// Scrapea perfiles de Rava (meta description = precio + var%) y combina
// con EOD del riesgo país de argentinadatos para estimar valor intraday.
// ============================================================
const BONOS_AR = [
  // Globales (USD ley NY) — más líquidos
  { symbol: 'GD30D', name: 'Bonar Global 2030', duration: 4.8 },
  { symbol: 'GD35D', name: 'Bonar Global 2035', duration: 8.6 },
  { symbol: 'GD41D', name: 'Bonar Global 2041', duration: 9.4 },
  // Bonares (USD ley AR)
  { symbol: 'AL30D', name: 'Bonar 2030 L.A.',   duration: 4.5 },
  { symbol: 'AL35D', name: 'Bonar 2035 L.A.',   duration: 8.2 },
];

function parseRavaMeta(html) {
  // <meta name="description" content="$91.730 (-0,11%). Símbolo: ..." />
  // Argentina usa coma decimal: $64,11 (+0,02%)
  const m = html.match(/name="description"\s+content="\$([0-9.,]+)\s+\(([+-]?\d+[.,]?\d*)%\)/i);
  if (!m) return null;
  const priceStr = m[1].replace(/\./g, '').replace(',', '.');
  const changeStr = m[2].replace(',', '.');
  const price = parseFloat(priceStr);
  const change = parseFloat(changeStr);
  return Number.isFinite(price) && Number.isFinite(change) ? { price, change } : null;
}

async function scrapeBondPrice(symbol) {
  try {
    const r = await fetch(`https://www.rava.com/perfil/${symbol}`, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'User-Agent': UA },
    });
    if (!r.ok) return null;
    const html = await r.text();
    return parseRavaMeta(html);
  } catch { return null; }
}

// Fuente primaria: Ámbito (intraday, actualizado el mismo día)
// Fallback: argentinadatos (EOD, a veces 1-3 días atrás)
async function getRiesgoPaisIntraday() {
  // 1. Probar Ámbito — devuelve {ultimo, fecha "DD-MM-YYYY", variacion "X,XX%"}
  try {
    const r = await fetch('https://mercados.ambito.com/riesgopais/variacion', {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    });
    if (r.ok) {
      const d = await r.json();
      const valor = parseFloat(String(d.ultimo).replace(',', '.'));
      const varPct = parseFloat(String(d.variacion || '0').replace(',', '.').replace('%', ''));
      if (Number.isFinite(valor)) {
        // fecha "DD-MM-YYYY" → ISO "YYYY-MM-DD"
        const fechaParts = String(d.fecha || '').split('-');
        const isoDate = fechaParts.length === 3 ? `${fechaParts[2]}-${fechaParts[1]}-${fechaParts[0]}` : null;
        const prevValor = Number.isFinite(varPct) && varPct !== 0 ? Math.round(valor / (1 + varPct / 100)) : null;
        return {
          valor,
          fecha: isoDate || d.fecha,
          variacionPct: varPct,
          prevValor,
          source: 'ambito.com',
          isIntraday: true,
        };
      }
    }
  } catch {}
  // 2. Fallback: argentinadatos
  try {
    const r = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais', {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'User-Agent': UA },
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!Array.isArray(d) || d.length < 2) return null;
    const last = d[d.length - 1];
    const prev = d[d.length - 2];
    const valor = parseFloat(last.valor);
    const prevValor = parseFloat(prev.valor);
    return {
      valor,
      fecha: last.fecha,
      variacionPct: prevValor ? ((valor - prevValor) / prevValor) * 100 : null,
      prevValor,
      source: 'argentinadatos.com',
      isIntraday: false,
    };
  } catch { return null; }
}

async function getRiesgoPais() {
  const data = await getRiesgoPaisIntraday();
  if (!data) throw new Error('No se pudo obtener riesgo país de ninguna fuente');
  return data;
}

async function getBonosAR() {
  const [rp, ...prices] = await Promise.all([
    getRiesgoPaisIntraday(),
    ...BONOS_AR.map(b => scrapeBondPrice(b.symbol)),
  ]);
  const bonos = BONOS_AR.map((b, i) => ({
    ...b,
    price: prices[i]?.price ?? null,
    change: prices[i]?.change ?? null,
  }));
  const valid = bonos.filter(b => Number.isFinite(b.change));
  // Promedio ponderado por duration (los más largos pesan más)
  let avgChange = null;
  if (valid.length) {
    const wSum = valid.reduce((acc, b) => acc + b.duration, 0);
    avgChange = valid.reduce((acc, b) => acc + b.change * b.duration, 0) / wSum;
  }
  return {
    source: 'rava.com + ambito',
    riesgoPais: rp,
    bonos,
    avgChange,
  };
}

// ============================================================
// BONOS AR SOBERANOS (data912) — precios USD MEP (serie 'D')
// Devuelve precios live para que el cliente calcule TIR/duration con bond-math.js
// ============================================================
// [símbolo que usa la página, símbolo de la serie en USD MEP en la fuente].
// Soberanos/BONTE siguen la regla sym+'D'; los BOPREAL no (BPOA7 → BPA7D).
const AR_BOND_SYMBOLS = [
  ...['AL29','GD29','AL30','GD30','AL35','GD35','AE38','GD38','AL41','GD41','GD46','AO27','AO28','AO29','AN29'].map(s => [s, s + 'D']),
  ['BPOA7','BPA7D'], ['BPOB7','BPB7D'], ['BPOC7','BPC7D'], ['BPOD7','BPD7D'],
  ['BPOA8','BPA8D'], ['BPOB8','BPB8D'],
];

async function getArBonds() {
  const r = await fetch('https://data912.com/live/arg_bonds', {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!r.ok) throw new Error('Fuente de bonos respondió ' + r.status);
  const all = await r.json(), fer = await feriados([new Date().getUTCFullYear()]).catch(() => new Set());
  // A primera hora data912 no lista todos: lo que falta sale de la memoria de la rueda (ver memoriaBonos)
  const lista = await memoriaBonos(Array.isArray(all) ? all : [], fer).then(m => m.lista).catch(() => all);
  const map = Object.fromEntries((Array.isArray(lista) ? lista : []).map(b => [b.symbol, b]));
  const bonds = AR_BOND_SYMBOLS.map(([sym, usdSym]) => {
    const d = map[usdSym] || null; // serie D = USD MEP
    if (!d) return { sym, price: null };
    const price = Number.isFinite(d.c) && d.c > 0 ? d.c : (Number.isFinite(d.px_bid) ? d.px_bid : null);
    return { sym, price, bid: d.px_bid ?? null, ask: d.px_ask ?? null, pct_change: d.pct_change ?? null, volume: d.v ?? null };
  });
  return { source: 'mercado AR (precios USD MEP, diferidos)', asOf: new Date().toISOString(), bonds };
}

// ============================================================
// CURVA EN PESOS — LECAP / BONCAP (tasa fija, cero cupón)
// Precio de mercado (data912) × valor de pago al vencimiento (argentinadatos,
// condiciones de emisión) ⇒ TEM / TNA / TEA exactas.
// Sin credenciales, sin topes diarios y sin cache externo: antes esto dependía
// de Docta (10 req/día) + Redis, y cuando Redis dejó de responder el endpoint
// devolvía "Actualizando…" para siempre sin llegar a consultar nada.
// El contexto macro (CER, REM, inflación, TAMAR) sale de BCRA Estadísticas v4.
// ============================================================
const MS_DAY = 86400000;

async function fetchJson(url, ms = TIMEOUT) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!r.ok) throw new Error(url + ' respondió ' + r.status);
  return r.json();
}

// Principales Variables de BCRA v4 (35 series, ~12 KB) indexadas por idVariable.
// OJO: v4 devuelve ultValorInformado / ultFechaInformada, no "valor" / "fecha".
async function getBcraPrincipales() {
  const j = await fetchJson('https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias?Categoria=Principales%20Variables');
  const map = {};
  for (const v of j?.results || []) {
    map[v.idVariable] = { valor: v.ultValorInformado, fecha: v.ultFechaInformada, descripcion: v.descripcion };
  }
  return map;
}
// tasa=true: el BCRA a veces publica 0 el último día (TAMAR, 16/10/2026); una tasa en 0 es dato faltante
const pickVar = (map, id, tasa) => (map[id] && Number.isFinite(map[id].valor) && !(tasa && map[id].valor <= 0) ? { valor: map[id].valor, fecha: map[id].fecha } : null);

const mediana = a => { a = a.slice().sort((x, y) => x - y); const n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };

// Poca liquidez: en los últimos días hábiles operó (mediana) menos del 5% de lo que opera
// la letra típica de la curva. Su precio puede no ser representativo (Dumrauf, cap. 16: la
// falta de liquidez deja precios desarbitrados que distorsionan la curva). Se marca, no se
// saca. Con menos de 4 letras con volumen la mediana no dice nada y no se marca ninguna.
function marcarLiquidez(bonds) {
  const v = bonds.map(b => b.volumen).filter(x => x > 0);
  if (v.length < 4) return null;
  const m = mediana(v);
  for (const b of bonds) if (b.volumen != null && b.volumen < m * 0.05) b.pocaLiquidez = true;
  return m;
}

// Redis (Upstash), como en _usa.js: guarda el volumen de cada rueda, porque ArgentinaDatos
// solo publica el último día. Sin Redis todo sigue andando con un solo día.
async function redis(cmd) {
  const limpia = v => (v || '').trim().replace(/^["']|["']$/g, '');
  const url = limpia(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL), token = limpia(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN);
  if (!url || !token) return null;
  try {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd), signal: AbortSignal.timeout(2500) });
    return r.ok ? (await r.json()).result : null;
  } catch { return null; }
}

// Días hábiles en la Argentina (UTC−3, sin horario de verano), con los feriados de ArgentinaDatos.
const feriadosPorAnio = {};
async function feriados(anios) {
  const out = new Set();
  for (const a of anios) {
    if (!feriadosPorAnio[a]) {
      const j = await fetchJson('https://api.argentinadatos.com/v1/feriados/' + a).catch(() => null);
      if (Array.isArray(j)) feriadosPorAnio[a] = j.map(f => f.fecha);
    }
    for (const f of feriadosPorAnio[a] || []) out.add(f);
  }
  return out;
}
const masDias = (f, n) => new Date(Date.parse(f + 'T12:00:00Z') + n * MS_DAY).toISOString().slice(0, 10);
const esHabil = (f, fer) => { const d = new Date(f + 'T12:00:00Z').getUTCDay(); return d > 0 && d < 6 && !fer.has(f); };
const habilDesde = (f, paso, fer) => { let x = masDias(f, paso); while (!esHabil(x, fer)) x = masDias(x, paso); return x; };
// Rueda a la que corresponde un precio tomado en `ms`: la del día si el mercado ya abrió (11 h), si no la anterior
function ruedaDe(ms, fer) {
  const ar = new Date(ms - 3 * 3600e3), dia = ar.toISOString().slice(0, 10);
  return esHabil(dia, fer) && ar.getUTCHours() >= 11 ? dia : habilDesde(dia, -1, fer);
}

// Volumen de cada letra: mediana de hasta 5 ruedas completas (las de ArgentinaDatos). La rueda
// en curso (data912, parcial) solo cuenta para letras que todavía no tienen ninguna completa.
async function volumenes(ruedaCierre, volCierre, ruedaVivo, volVivo) {
  let hist = null;
  try { hist = JSON.parse(await redis(['GET', 'pesos:volumen']) || 'null'); } catch {}
  hist = hist && typeof hist === 'object' ? hist : {};
  const antes = JSON.stringify(hist);
  if (ruedaCierre && Object.keys(volCierre).length) hist[ruedaCierre] = { completa: true, v: volCierre };
  if (ruedaVivo !== ruedaCierre && Object.keys(volVivo).length && !(hist[ruedaVivo] && hist[ruedaVivo].completa)) hist[ruedaVivo] = { completa: false, v: volVivo };
  for (const f of Object.keys(hist).sort().reverse().slice(10)) delete hist[f];
  if (JSON.stringify(hist) !== antes) await redis(['SET', 'pesos:volumen', JSON.stringify(hist), 'EX', String(30 * 86400)]);
  const fechas = Object.keys(hist).sort().reverse();
  const completas = fechas.filter(f => hist[f].completa).slice(0, 5), parcial = fechas.find(f => !hist[f].completa);
  return sym => {
    let vals = completas.map(f => hist[f].v && hist[f].v[sym]).filter(Number.isFinite);
    if (!vals.length && parcial) vals = [hist[parcial].v && hist[parcial].v[sym]].filter(Number.isFinite);
    return vals.length ? { v: mediana(vals), dias: vals.length } : null;
  };
}

// ============================================================
// CAUCIÓN BURSÁTIL — datos abiertos de BYMA. Tasa promedio ponderada de la rueda en curso
// para el plazo más corto en pesos (un día hábil). Fuera del horario del mercado BYMA no
// devuelve operaciones: se sirve la última rueda guardada en Redis, con su fecha.
// ============================================================
async function getCaucion() {
  let lista = null;
  try {
    const r = await fetch('https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/cauciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA, 'Accept': 'application/json' },
      body: JSON.stringify({ excludeZeroPxAndQty: true, T2: true, T1: false, T0: false }), signal: AbortSignal.timeout(6000),
    });
    if (r.ok) lista = await r.json();
  } catch {}
  // BYMA da las tasas como fracción (0,206 = 20,6% anual) y el monto en pesos
  const enPesos = (Array.isArray(lista) ? lista : [])
    .filter(x => x.denominationCcy === 'ARS' && x.daysToMaturity >= 1 && x.vwap > 0 && x.vwap < 5 && x.volumeAmount > 0)
    .sort((a, b) => a.daysToMaturity - b.daysToMaturity);
  const fila = x => ({ dias: x.daysToMaturity, vto: x.maturityDate, tna: x.vwap * 100, ultima: x.trade > 0 ? x.trade * 100 : null,
    hora: /^\d\d:\d\d/.test(x.tradeHour || '') ? x.tradeHour.slice(0, 5) : null, monto: x.volumeAmount });
  if (enPesos.length) {
    // Antes de que abra el mercado, lo que haya es de la rueda anterior
    const ahora = Date.now(), hoy = new Date(ahora - 3 * 3600e3).toISOString().slice(0, 10);
    const rueda = ruedaDe(ahora, await feriados([+hoy.slice(0, 4)]));
    const semana = enPesos.find(x => x.daysToMaturity >= 7);
    const dato = { rueda, corta: fila(enPesos[0]), semana: semana ? fila(semana) : null };
    await redis(['SET', 'caucion:ultima', JSON.stringify(dato), 'EX', String(10 * 86400)]);
    return { ...dato, enVivo: rueda === hoy };
  }
  let guardado = null;
  try { guardado = JSON.parse(await redis(['GET', 'caucion:ultima']) || 'null'); } catch {}
  if (guardado && guardado.corta) return { ...guardado, enVivo: false };
  throw new Error('BYMA no devolvió cauciones');
}

async function getArPesos() {
  const [letras, priceSets, bcra] = await Promise.all([
    fetchJson('https://api.argentinadatos.com/v1/finanzas/letras'),
    // Un reintento por lista: si falla una sola (las LECAP están en arg_notes y las BONCAP en
    // arg_bonds), la curva quedaba mitad con precios del día y mitad con el cierre (29/10/2026)
    Promise.all(['arg_notes', 'arg_bonds'].map(e => fetchJson(`https://data912.com/live/${e}`, 4000)
      .catch(() => fetchJson(`https://data912.com/live/${e}`, 4000)).catch(() => []))),
    getBcraPrincipales().catch(() => ({})),
  ]);

  const px = {};
  for (const set of priceSets) {
    for (const x of Array.isArray(set) ? set : []) {
      const p = Number.isFinite(x.c) && x.c > 0 ? x.c
              : (Number.isFinite(x.px_bid) && x.px_bid > 0 ? x.px_bid : null);
      if (p) px[x.symbol] = { price: p, pct: x.pct_change ?? null, volume: x.v ?? null };
    }
  }

  const now = Date.now();

  // ArgentinaDatos cambio el formato: ahora devuelve { fechaActualizacion, letras: [...] }
  // con precio, TNA, TEA y TEM ya calculados. Con el formato viejo (una lista con
  // vpv) esto devolvia 0 bonos y la curva de pesos quedaba vacia.
  if (letras && Array.isArray(letras.letras)) {
    const ahora = Date.now(), hoy = new Date(ahora - 3 * 3600e3).toISOString().slice(0, 10), anio = +hoy.slice(0, 4);
    const fer = await feriados(hoy.slice(5, 7) === '12' ? [anio, anio + 1] : [anio]);
    const ruedaCierre = letras.fechaActualizacion ? ruedaDe(Date.parse(letras.fechaActualizacion), fer) : null;
    // data912 cotiza el mismo segmento que ArgentinaDatos (su cierre anterior coincide con el de
    // ArgentinaDatos, 28/10/2026): liquida el día hábil siguiente, y desde ahí se cuentan los días.
    const ruedaVivo = ruedaDe(ahora, fer), liq = habilDesde(ruedaVivo, 1, fer);
    const volCierre = {}, volVivo = {};
    const bonds = letras.letras.map(l => {
      const dtm = Number(l.diasAlVencimiento);
      // Solo LECAP (S30S6) y BONCAP (T15E7): cero cupon, comparables en una curva.
      // Quedan afuera los duales (TTD26) y los bonos con cupon (TO26, TY30P).
      if (!/^[ST]\d{2}[A-Z]\d$/.test(l.ticker || '')) return null;
      if (!(l.precioArs > 0) || !(l.teaPorcentaje > 0) || !(dtm >= 4)) return null;
      const tea = l.teaPorcentaje / 100;
      // Lo que paga al vencimiento (condiciones de emisión), implícito en la TEA de ArgentinaDatos
      const vpv = l.precioArs * Math.pow(1 + tea, dtm / 365);
      if (Number.isFinite(l.volumenEfectivoArs)) volCierre[l.ticker] = l.volumenEfectivoArs;
      const b = {
        sym: l.ticker, tipo: 'nominal', vencimiento: l.fechaVencimiento, dtm,
        price: l.precioArs, pct: Number.isFinite(l.variacionPorcentaje) ? l.variacionPorcentaje : null, vpv,
        // TNA de ArgentinaDatos: tasa simple base 365, (pago/precio − 1) × 365/días
        tem: l.temPorcentaje / 100, tna: l.tnaPorcentaje / 100, tir: tea,
        duration: dtm / 365, precio: 'cierre',
      };
      // Precio de la rueda en curso: mismas fórmulas, con los días desde la liquidación.
      // Un salto de más de 10% contra el cierre es un dato mal cargado, no un precio.
      const q = px[l.ticker], d = Math.round((Date.parse(l.fechaVencimiento + 'T12:00:00Z') - Date.parse(liq + 'T12:00:00Z')) / MS_DAY);
      if (q && ruedaVivo !== ruedaCierre && Math.abs(q.price / l.precioArs - 1) < 0.1 && d >= 4) {
        const ratio = vpv / q.price;
        b.vivo = { dtm: d, price: q.price, pct: q.pct, tem: Math.pow(ratio, 30.4 / d) - 1, tna: (ratio - 1) * 365 / d,
          tir: Math.pow(ratio, 365 / d) - 1, duration: d / 365, precio: 'vivo' };
        if (Number.isFinite(q.volume)) volVivo[l.ticker] = q.volume * q.price / 100;   // data912 da valor nominal
      }
      return b;
    }).filter(Boolean);
    // Una letra recién emitida tarda días en aparecer en ArgentinaDatos (S26F7, 30/10/2026). Si ya se opera, el pago sale de la
    // ficha de BYMA: TEM capitalizable desde la emisión, con días 30/360 (así da el 156,03 del T30J7).
    const listadas = new Set(letras.letras.map(l => l.ticker));
    for (const sym of Object.keys(px).filter(s => /^[ST]\d{2}[A-Z]\d$/.test(s) && !listadas.has(s) && (px[s].volume || 0) * px[s].price / 100 >= MINIMO_OPERADO)) {
      const f = await fichaByma(sym).catch(() => null), q = px[sym];
      if (!f || !(f.tem > 0 && f.tem < 10)) continue;
      const [y1, m1, d1] = f.emision.split('-').map(Number), [y2, m2, d2] = f.vence.split('-').map(Number);
      const vpv = 100 * Math.pow(1 + f.tem / 100, ((y2 - y1) * 360 + (m2 - m1) * 30 + Math.min(d2, 30) - Math.min(d1, 30)) / 30);
      const d = Math.round((Date.parse(f.vence + 'T12:00:00Z') - Date.parse(liq + 'T12:00:00Z')) / MS_DAY), ratio = vpv / q.price;
      if (!(d >= 4) || !(ratio > 1 && ratio < 2)) continue;
      const vivo = { dtm: d, price: q.price, pct: q.pct, tem: Math.pow(ratio, 30.4 / d) - 1, tna: (ratio - 1) * 365 / d, tir: Math.pow(ratio, 365 / d) - 1, duration: d / 365, precio: 'vivo' };
      bonds.push({ sym, tipo: 'nominal', vencimiento: f.vence, vpv, ...vivo, vivo });
      volVivo[sym] = q.volume * q.price / 100;
    }
    // Una curva no mezcla días: precios del día solo si los tiene al menos el 80% de las letras.
    // Si no, todas quedan con el cierre de ArgentinaDatos.
    const conVivo = bonds.filter(b => b.vivo).length >= Math.ceil(bonds.length * 0.8);
    for (const b of bonds) { if (conVivo && b.vivo) Object.assign(b, b.vivo); delete b.vivo; }
    bonds.sort((a, b) => a.dtm - b.dtm);
    const vol = await volumenes(ruedaCierre, volCierre, ruedaVivo, volVivo);
    for (const b of bonds) { const x = vol(b.sym); b.volumen = x ? x.v : null; b.volDias = x ? x.dias : 0; }
    const volumenMediana = marcarLiquidez(bonds), vivo = bonds.some(b => b.precio === 'vivo');
    return {
      source: vivo ? 'BYMA vía data912 (precios) y ArgentinaDatos (condiciones de emisión)' : 'ArgentinaDatos (precios de BYMA y condiciones de emisión)',
      asOf: vivo ? new Date(ahora).toISOString() : (letras.fechaActualizacion || new Date().toISOString()),
      vivo, rueda: vivo ? ruedaVivo : ruedaCierre, volumenMediana,
      bonds,
      cer:                 pickVar(bcra, 30),
      rem:                 pickVar(bcra, 29),
      inflacionMensual:    pickVar(bcra, 27),
      inflacionInteranual: pickVar(bcra, 28),
      tamar:               pickVar(bcra, 44, true),
      badlar:              pickVar(bcra, 7, true),
    };
  }

  const bonds = (Array.isArray(letras) ? letras : []).map(l => {
    const q = px[l.ticker];
    const vto = Date.parse(l.fechaVencimiento + 'T00:00:00Z');
    const dtm = Math.round((vto - now) / MS_DAY);
    // A menos de 4 días del vencimiento la TEA se dispara por ruido de precio: no aporta curva
    if (!q || !Number.isFinite(l.vpv) || l.vpv <= 0 || !Number.isFinite(dtm) || dtm < 4) return null;
    const ratio = l.vpv / q.price;
    if (!(ratio > 0)) return null;
    const years = dtm / 365;
    const tem = Math.pow(ratio, 30.4 / dtm) - 1;
    return {
      sym: l.ticker, tipo: 'nominal', vencimiento: l.fechaVencimiento, dtm,
      price: q.price, pct: q.pct, vpv: l.vpv,
      // Misma convención que ArgentinaDatos: TNA simple base 365
      tem, tna: (ratio - 1) * 365 / dtm, tir: Math.pow(ratio, 1 / years) - 1,
      duration: years, // cero cupón: duration = plazo
      volumen: Number.isFinite(q.volume) ? q.volume * q.price / 100 : null, // data912 da valor nominal
    };
  }).filter(Boolean).sort((a, b) => a.dtm - b.dtm);
  marcarLiquidez(bonds);

  return {
    source: 'precios de mercado + condiciones de emisión (LECAP/BONCAP)',
    asOf: new Date().toISOString(),
    bonds,
    cer:                 pickVar(bcra, 30),
    rem:                 pickVar(bcra, 29),
    inflacionMensual:    pickVar(bcra, 27),
    inflacionInteranual: pickVar(bcra, 28),
    tamar:               pickVar(bcra, 44, true),
    badlar:              pickVar(bcra, 7, true),
  };
}

// ============================================================
// YOUTUBE FEED
// Mezcla los últimos videos de varios canales financieros AR.
// El RSS público de YouTube no requiere API key ni quota.
// ============================================================
const YT_CHANNELS = [
  { id: 'UCXgsCoIhEUIwWvGK_JDY21w', name: 'Bull Market' },
  { id: 'UCD83EL-fvAhaZ8_fKfefunw', name: 'Rava Bursátil' },
  { id: 'UCFApRK7ceVV32oyrdOI7oIg', name: 'Mercado Salvaje' },
  { id: 'UCt4iMhUHxnKfxJXIW36Y4Rw', name: 'Bloomberg Línea' },
  { id: 'UCHT4bTA-qJDlY74lUWLwydQ', name: 'After Market' },
  { id: 'UCcSTT2XVT_VIigpjes2hJmA', name: 'Ahora Play' },
  { id: 'UC0CA6eJcGa6qfJkppecctLA', name: 'Claudio Zuchovicki' },
  { id: 'UCGPPguIumMigMZwturFA-3g', name: 'Lara López Calvo' },
  { id: 'UCJfYK2Z_RMgDg4SD1sQH_iQ', name: 'Leandro Zicca' },
  { id: 'UCj4p150wtZ2Vwx6sp-TB-Lw', name: 'Cocos Capital' },
];

function parseYouTubeRSS(xml, channelName) {
  const items = [];
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  for (const block of entries.slice(0, 5)) {
    const videoId = (block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title   = decodeEntities((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const published = (block.match(/<published>([^<]+)<\/published>/) || [])[1];
    const thumb = (block.match(/<media:thumbnail\s+url="([^"]+)"/) || [])[1];
    if (!videoId || !title) continue;
    items.push({
      videoId,
      title,
      link: `https://www.youtube.com/watch?v=${videoId}`,
      published,
      thumbnail: thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      channel: channelName,
    });
  }
  return items;
}

async function getYouTubeFeed() {
  const results = await Promise.all(
    YT_CHANNELS.map(async ch => {
      try {
        const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`, {
          signal: AbortSignal.timeout(TIMEOUT),
          headers: { 'User-Agent': UA },
        });
        if (!r.ok) return [];
        const xml = await r.text();
        return parseYouTubeRSS(xml, ch.name);
      } catch { return []; }
    })
  );
  const all = results.flat();
  all.sort((a, b) => new Date(b.published) - new Date(a.published));
  return {
    source: 'youtube.com/feeds',
    totalChannels: YT_CHANNELS.length,
    channels: YT_CHANNELS,
    videos: all.slice(0, 24),
  };
}

// ============================================================
// LO QUE DESCUENTA EL MERCADO — inflación y dólar implícitos en los precios de los bonos.
// Bonos CER cero cupón: pagan 100 × CER(10 hábiles antes del vencimiento) / CER(10 hábiles antes de la emisión).
// Dólar linked cero cupón: pagan 100 dólares al A3500, en pesos. Cada uno se compara con la curva a tasa fija
// (LECAP y BONCAP) al mismo plazo: lo implícito es lo que deja indiferente entre una y otra. Solo dentro de esa curva.
// [emisión, vencimiento]. Las fechas van a mano porque la ficha de BYMA erra por un día hábil en varios bonos
// (TZXM7, TZXM8, TZXM9, TZXO7). Esos, TZXS7, TZXS8, TZXY7 y X29E7 dan la TIREA de las licitaciones de Finanzas ±0,02;
// los demás no tuvieron licitación en 2026 con qué compararlos y usan la fecha de BYMA.
// Un bono nuevo que no esté acá entra con la fecha de BYMA, marcado, y se descarta si se aparta de los vecinos.
// ============================================================
const BONOS_CER = {
  X29E7: ['2026-08-14', '2027-01-29'], X30N6: ['2025-12-15', '2026-11-30'], TZX27: ['2024-02-01', '2027-06-30'], TZX28: ['2024-02-01', '2028-06-30'],
  TZXA7: ['2025-11-28', '2027-04-30'], TZXD6: ['2024-03-15', '2026-12-15'], TZXD7: ['2024-03-15', '2027-12-15'], TZXD8: ['2026-06-30', '2028-12-15'],
  TZXM7: ['2024-05-20', '2027-03-31'], TZXM8: ['2026-04-01', '2028-03-31'], TZXM9: ['2026-04-01', '2029-03-28'], TZXO7: ['2026-06-30', '2027-10-29'],
  TZXS7: ['2026-03-31', '2027-09-30'], TZXS8: ['2026-03-31', '2028-09-29'], TZXY7: ['2025-12-15', '2027-05-31'],
};
const RE_CER = /^(X\d{2}[A-Z]\d|TZX(\d\d|[A-Z]\d))$/, RE_DL = /^(D\d{2}[A-Z]\d|TZV(\d\d|[A-Z]\d))$/;
const MINIMO_OPERADO = 30e6;   // pesos en la rueda: menos que eso, el último precio no dice nada
async function fichaByma(sym) {
  let g = null;
  try { g = JSON.parse(await redis(['GET', 'ficha:' + sym]) || 'null'); } catch {}
  if (g) return g;
  const r = await fetch('https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/bnown/fichatecnica/especies/general', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA, Accept: 'application/json' },
    body: JSON.stringify({ symbol: sym, 'Content-Type': 'application/json' }), signal: AbortSignal.timeout(6000),
  });
  const f = r.ok ? ((await r.json()).data || [])[0] : null;
  if (!f || !/^\d{4}-\d{2}-\d{2}/.test(f.fechaEmision || '') || !/^\d{4}-\d{2}-\d{2}/.test(f.fechaVencimiento || '')) return null;
  const tem = parseFloat(((f.interes || '').match(/(\d+[.,]\d+)\s*%/) || [])[1]?.replace(',', '.'));
  const d = { emision: f.fechaEmision.slice(0, 10), vence: f.fechaVencimiento.slice(0, 10), cupon0: /CERO CUP|A DESCUENTO/i.test(f.denominacion || '') && !/DUAL/i.test(f.denominacion || ''), tem: Number.isFinite(tem) ? tem : null };
  await redis(['SET', 'ficha:' + sym, JSON.stringify(d), 'EX', String(30 * 86400)]);
  return d;
}
// Cotizaciones de data912 con memoria (Redis, últimas 3 ruedas). Antes de que abra la rueda data912 lista solo una parte
// de los bonos (el 5/11/2026 a las 10 h, 100 de 205) y con el volumen en cero, aunque el precio y la variación son los del
// cierre anterior. Se guarda la última cotización de cada bono por rueda con el volumen más alto visto:
// - un bono que falta se completa con lo guardado de la misma rueda; si no hay, con el cierre de la rueda anterior y sin variación;
// - la liquidez es lo más alto entre lo operado en la rueda y en la anterior, así a primera hora no queda todo como "poco volumen".
async function memoriaBonos(lista, fer) {
  const rueda = ruedaDe(Date.now(), fer);
  let h = null;
  try { h = JSON.parse(await redis(['GET', 'bonos:rueda']) || 'null'); } catch {}
  h = h && typeof h === 'object' ? h : {};
  const antes = JSON.stringify(h), act = h[rueda] || {};
  for (const x of lista) if (x && x.symbol && x.c > 0) {
    const g = act[x.symbol];
    act[x.symbol] = [x.c, Number.isFinite(x.pct_change) ? x.pct_change : 0, Math.max(x.v || 0, g ? g[2] : 0)];
  }
  if (Object.keys(act).length) h[rueda] = act;
  for (const f of Object.keys(h).sort().reverse().slice(3)) delete h[f];
  if (JSON.stringify(h) !== antes) await redis(['SET', 'bonos:rueda', JSON.stringify(h), 'EX', String(20 * 86400)]);
  const prev = h[Object.keys(h).filter(f => f < rueda).sort().at(-1)] || {}, vistos = new Set(lista.map(x => x && x.symbol));
  const completa = [...lista.filter(x => x && x.symbol)];
  for (const [s, g] of Object.entries(act)) if (!vistos.has(s)) completa.push({ symbol: s, c: g[0], pct_change: g[1], v: g[2], guardado: true });
  for (const [s, g] of Object.entries(prev)) if (!vistos.has(s) && !act[s]) completa.push({ symbol: s, c: g[0], pct_change: 0, v: 0, guardado: true });
  const operado = (g, s) => (g && g[s] ? g[s][2] * g[s][0] / 100 : 0);
  return { lista: completa, op: s => { const hoy = operado(act, s); return { hoy, liquidez: Math.max(hoy, operado(prev, s)) }; } };
}
// Mes del IPC que entra en el CER de una fecha: del 16 al 15 siguiente se reparte el IPC de dos meses antes
function mesIpc(f) {
  const [y, m, d] = f.split('-').map(Number), t = y * 12 + (m - 1) - (d >= 16 ? 1 : 2);
  return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0');
}
async function getArMercado() {
  const [pesos, sets, cerR, techoR] = await Promise.all([
    getArPesos(),
    Promise.all(['arg_notes', 'arg_bonds'].map(e => fetchJson(`https://data912.com/live/${e}`, 4000).catch(() => fetchJson(`https://data912.com/live/${e}`, 4000)))),
    fetchJson('https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/30?desde=2024-01-01&limit=3000'),
    fetchJson('https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/1188?limit=1').catch(() => null),
  ]);
  const curva = (pesos.bonds || []).filter(b => !b.pocaLiquidez && b.tir > 0).sort((a, b) => a.dtm - b.dtm);
  const CER = Object.fromEntries((cerR?.results?.[0]?.detalle || []).filter(x => x.valor > 0).map(x => [x.fecha, x.valor]));
  const fechasCer = Object.keys(CER).sort();
  if (curva.length < 4 || fechasCer.length < 500) throw new Error('faltan datos');
  const ahora = Date.now(), hoy = new Date(ahora - 3 * 3600e3).toISOString().slice(0, 10), anio = +hoy.slice(0, 4);
  const fer = await feriados([2024, 2025, anio, anio + 1, anio + 2].filter((a, i, x) => x.indexOf(a) === i));
  const liq = habilDesde(ruedaDe(ahora, fer), 1, fer), dias = f => Math.round((Date.parse(f + 'T12:00:00Z') - Date.parse(liq + 'T12:00:00Z')) / MS_DAY);
  const atras = (f, n) => { for (let i = 0; i < n; i++) f = habilDesde(f, -1, fer); return f; };
  // Tasa fija al mismo plazo: interpolada entre las dos letras vecinas; fuera de la curva no se calcula
  const fija = d => { for (let i = 1; i < curva.length; i++) { const [a, b] = [curva[i - 1], curva[i]]; if (d >= a.dtm && d <= b.dtm) return a.tir + (b.tir - a.tir) * (d - a.dtm) / (b.dtm - a.dtm); } return null; };
  const px = {}, mem = await memoriaBonos(sets.flat(), fer), op = mem.op;
  for (const x of mem.lista) if (x && x.c > 0) px[x.symbol] = { p: x.c, operado: (x.v || 0) * x.c / 100 };
  const ultF = fechasCer.at(-1), ultCer = CER[ultF], refF = atras(liq, 10);
  if (!CER[refF]) throw new Error('sin CER');

  // ---- Bonos CER
  // Los que operaron lo suficiente (en la rueda o en la anterior); si todavía no hay registro de ninguno, todos los que tienen precio
  const operados = re => { const L = Object.keys(px).filter(s => re.test(s)), conVolumen = L.filter(s => op(s).liquidez >= MINIMO_OPERADO); return conVolumen.length >= 3 ? conVolumen : L; };
  const fichas = Object.fromEntries(await Promise.all([...operados(RE_CER).filter(s => !BONOS_CER[s]), ...operados(RE_DL)].map(async s => [s, await fichaByma(s).catch(() => null)])));
  let cer = [];
  for (const sym of operados(RE_CER)) {
    let datos = BONOS_CER[sym], auto = false;
    if (!datos) { const f = fichas[sym]; if (!f || !f.cupon0) continue; datos = [f.emision, f.vence]; auto = true; }
    const [emision, vence] = datos, d = dias(vence), base = CER[atras(emision, 10)], { p } = px[sym];
    if (!(d >= 20) || !base) continue;
    const real = Math.pow(100 * CER[refF] / base / p, 365 / d) - 1;
    if (!(real > -0.2 && real < 0.3)) continue;
    const fila = { sym, vence, dias: d, precio: p, real, auto };
    const f = fija(d), t10 = atras(vence, 10), ventana = Math.round((Date.parse(t10) - Date.parse(ultF)) / MS_DAY);
    // Lo que el CER ya tiene publicado no se descuenta: lo implícito es la inflación que falta conocer
    if (f != null && ventana >= 30) {
      const hace = Math.pow(1 + f, d / 365) * p * base / 100;
      fila.fija = f; fila.mensual = Math.pow(hace / ultCer, 30.4 / ventana) - 1; fila.hasta = mesIpc(t10);
    }
    cer.push(fila);
  }
  cer.sort((a, b) => a.dias - b.dias);
  // Un bono que entró solo y queda lejos de sus vecinos tiene mal la fecha de emisión
  cer = cer.filter((x, i) => { if (!x.auto) return true; const v = cer.filter((y, j) => j !== i && !y.auto).sort((a, b) => Math.abs(a.dias - x.dias) - Math.abs(b.dias - x.dias)).slice(0, 2); return v.length < 2 || Math.abs(x.real - (v[0].real + v[1].real) / 2) < 0.02; });

  // ---- Dólar linked
  const dolar = [];
  for (const sym of operados(RE_DL)) {
    const ficha = fichas[sym];
    if (!ficha || !ficha.cupon0) continue;
    const d = dias(ficha.vence), f = fija(d), { p } = px[sym];
    if (!(d >= 7) || f == null || !(p > 10000)) continue;
    dolar.push({ sym, vence: ficha.vence, dias: d, precio: p, fija: f, dolar: p / 100 * Math.pow(1 + f, d / 365) });
  }
  dolar.sort((a, b) => a.dias - b.dias);
  if (!cer.length && !dolar.length) throw new Error('sin bonos');
  const bcra = await getBcraPrincipales().catch(() => ({})), techo = techoR?.results?.[0]?.detalle?.[0];
  return {
    asOf: new Date(ahora).toISOString(), liquidacion: liq, curvaDel: pesos.asOf, vivo: !!pesos.vivo,
    ipcConocido: mesIpc(ultF), cer, dolar,
    curva: curva.map(b => ({ sym: b.sym, dias: b.dtm, tir: b.tir })),
    mayorista: pickVar(bcra, 5), rem: pickVar(bcra, 29), ipc: pickVar(bcra, 27),
    techo: techo && Number.isFinite(techo.valor) ? { valor: techo.valor, fecha: techo.fecha } : null,
    fuente: 'Precios de BYMA vía data912; CER, REM y dólar del BCRA; condiciones de emisión de la Secretaría de Finanzas y BYMA',
  };
}

// ============================================================
// CURVAS EN PESOS — tasa fija, CER, dólar linked, TAMAR y duales, hoy y en la rueda anterior (fórmulas en api/_curvas.js).
// Cada grupo con la tasa que mira el mercado: efectiva anual (fija), real (CER y pata CER de los duales), en dólares
// (dólar linked) y margen sobre TAMAR. Verificado contra 26 licitaciones de 2026 (TIREA oficial) y contra Bonistas
// (TX28, TX31 y TY30P).
// ============================================================
// Con cupón: pagos del prospecto (Res. 381/2020 para TX28; los demás, ficha de BYMA y resolución de emisión)
const CON_CUPON = {
  TX28: { g: 'cer', emision: '2020-09-04', vence: '2028-11-09', pagos: () => K.pagosSemestrales({ fechas: K.semestrales(9, 5, 11, 2021, '2028-11-09'), tasa: 0.0225, cuotas: 10, amortDesde: '2024-05-09' }) },
  TX31: { g: 'cer', emision: '2022-05-31', vence: '2031-11-30', pagos: () => K.pagosSemestrales({ fechas: K.semestrales(30, 5, 11, 2022, '2031-11-30').filter(f => f >= '2022-11-30'), tasa: 0.025, cuotas: 10, amortDesde: '2027-05-30' }) },
  TY30P: { g: 'fija', emision: '2025-06-04', vence: '2030-05-30', pagos: () => K.semestrales(30, 5, 11, 2025, '2030-05-30').filter(f => f >= '2025-11-30').map(f => ({ fecha: f, amort: f === '2030-05-30' ? 100 : 0, interes: 14.75 })) },
};
// Margen sobre TAMAR fijado en la licitación de emisión (resultados de la Secretaría de Finanzas). El del TMF27 (licitación
// del 11/2/2026, sin aviso encontrado) se despejó de las reaperturas del 15/4 y del 11/9, que dan 6,516 y 6,531.
const MARGEN_TAMAR = { TMF27: 6.52, TMF28: 6.50, TMG27: 6, TMG28: 6.90, TML27: 5.40 };
// Duales CER / TAMAR: pagan lo que más rinda entre el capital ajustado por CER y la TAMAR más este margen
const DUAL_CER_TAMAR = { TXMJ8: 3, TXMD8: 3, TXMJ9: 3, TXMD9: 3, TXMJ0: 3 };
const RE_TAMAR = /^TM[A-Z]\d{2}$/, RE_DUAL = /^TXM[A-Z]\d$/;
async function getCurvas() {
  const ahora = Date.now(), hoy = new Date(ahora - 3 * 3600e3).toISOString().slice(0, 10), anio = +hoy.slice(0, 4);
  const [pesos, sets, cerR, tamR, fxR, fer] = await Promise.all([
    getArPesos(),
    Promise.all(['arg_notes', 'arg_bonds'].map(e => fetchJson(`https://data912.com/live/${e}`, 4000).catch(() => fetchJson(`https://data912.com/live/${e}`, 4000)))),
    fetchJson('https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/30?desde=2020-01-01&limit=3000'),
    fetchJson('https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/44?desde=2024-12-01&limit=3000'),
    fetchJson('https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/5?desde=' + (anio - 1) + '-11-01&limit=3000'),
    feriados([2020, 2021, 2022, 2023, 2024, 2025, anio, anio + 1].filter((a, i, x) => x.indexOf(a) === i)),
  ]);
  const serie = r => { const o = {}; for (const x of r?.results?.[0]?.detalle || []) if (x.valor > 0) o[x.fecha] = x.valor; return o; };
  const CER = serie(cerR), TAM = serie(tamR), FX = serie(fxR);
  const fC = Object.keys(CER).sort(), fT = Object.keys(TAM).sort(), fX = Object.keys(FX).filter(f => f <= hoy).sort();
  if (fC.length < 1500 || fT.length < 100 || fX.length < 20) throw new Error('faltan series del BCRA');
  const cal = K.calendario([...fer]);
  const liq = habilDesde(ruedaDe(ahora, fer), 1, fer), liqAnt = habilDesde(liq, -1, fer);
  // Hoy y la rueda anterior: el CER de 10 hábiles antes de cada liquidación y el último dólar A3500 publicado de cada día
  const cer = { hoy: K.valorEn(CER, fC, cal.atras(liq, 10)), ant: K.valorEn(CER, fC, cal.atras(liqAnt, 10)) };
  const fx = { hoy: FX[fX.at(-1)], ant: FX[fX.at(-2)] };
  const px = {}, mem = await memoriaBonos(sets.flat(), fer), op = mem.op;
  for (const x of mem.lista) if (x && x.c > 0) px[x.symbol] = { p: x.c, pct: Number.isFinite(x.pct_change) ? x.pct_change : 0, vol: (x.v || 0) * x.c / 100 };
  const tamar = { supuesto: K.tamarProyectada(TAM, fT), ultima: TAM[fT.at(-1)], fecha: fT.at(-1) };
  const fichas = {};
  const ficha = async s => (fichas[s] ??= await fichaByma(s).catch(() => null));
  const out = { fija: [], cer: [], dl: [], tamar: [], duales: [] };
  // Cada bono: precio de hoy y el de la rueda anterior (cierre = hoy / (1 + variación)), con su liquidación
  const momentos = q => [['', q.p, liq], ['Ant', q.p / (1 + q.pct / 100), liqAnt]];
  const agregar = (g, sym, vence, q, calc, extra = {}) => {
    // Con menos de $30 millones operados (en la rueda o en la anterior), el último precio dice poco: se dibuja hueco y no entra en la curva
    const o = op(sym);
    const fila = { sym, vence, dias: K.dias(liq, vence), precio: q.p, variacion: q.pct, operado: o.hoy, liquidez: o.liquidez, poca: o.liquidez < MINIMO_OPERADO, ...extra };
    // Todo lo calculado queda dos veces: tasa y tasaAnt, tamarMargen y tamarMargenAnt, etc.
    for (const [k, p, l] of momentos(q)) { const r = calc(p, l, k); if (!r || !Number.isFinite(r.tasa)) return; for (const [c, v] of Object.entries(r)) fila[c + k] = v; }
    if (fila.dias >= 1) out[g].push(fila);
  };

  // ---- Tasa fija: LECAP y BONCAP de la curva en pesos, y el Bonte 2030
  for (const b of pesos.bonds || []) {
    const q = px[b.sym] || { p: b.price, pct: b.pct || 0, vol: b.volumen || 0 };
    agregar('fija', b.sym, b.vencimiento, q, (p, l) => { const d = K.dias(l, b.vencimiento), t = K.tirUnica(b.vpv, p, d); return t == null ? null : { tasa: t, dur: d / 365 / (1 + t), tem: Math.pow(b.vpv / p, 30 / d) - 1, tna: (b.vpv / p - 1) * 365 / d }; },
      { poca: !!b.pocaLiquidez, liquidez: b.volumen ?? q.vol });
  }
  // ---- Con cupón (TX28, TX31 y TY30P): TIR de los flujos del prospecto; los CER, en términos reales
  for (const [sym, c] of Object.entries(CON_CUPON)) {
    const q = px[sym]; if (!q) continue;
    const pagos = c.pagos(), base = c.g === 'cer' ? K.valorEn(CER, fC, cal.atras(c.emision, 10)) : 1;
    agregar(c.g, sym, c.vence, q, (p, l, k) => { const coef = c.g === 'cer' ? cer[k ? 'ant' : 'hoy'] / base : 1, r = K.tirFlujos(p / coef, l, pagos); return r && { tasa: r.tir, dur: r.modificada }; }, { cupon: true });
  }
  // ---- CER cero cupón (tabla verificada BONOS_CER; uno nuevo entra con la ficha de BYMA)
  for (const sym of Object.keys(px).filter(s => RE_CER.test(s))) {
    let d = BONOS_CER[sym], auto = false;
    if (!d) { const f = await ficha(sym); if (!f || !f.cupon0) continue; d = [f.emision, f.vence]; auto = true; }
    const base = K.valorEn(CER, fC, cal.atras(d[0], 10));
    agregar('cer', sym, d[1], px[sym], (p, l, k) => { const dd = K.dias(l, d[1]), t = K.tirUnica(100 * cer[k ? 'ant' : 'hoy'] / base, p, dd); return t == null ? null : { tasa: t, dur: dd / 365 / (1 + t) }; }, { auto });
  }
  // ---- Dólar linked cero cupón y el dual TAMAR / dólar linked (TMVE8, por su pata en dólares): TIR en dólares
  for (const sym of Object.keys(px).filter(s => RE_DL.test(s) || s === 'TMVE8')) {
    const f = await ficha(sym); if (!f || px[sym].p < 10000) continue;
    agregar('dl', sym, f.vence, px[sym], (p, l, k) => { const dd = K.dias(l, f.vence), t = K.tirUnica(100 * fx[k ? 'ant' : 'hoy'], p, dd); return t == null ? null : { tasa: t, dur: dd / 365 / (1 + t) }; }, sym === 'TMVE8' ? { dual: 'TAMAR' } : {});
  }
  // ---- TAMAR: TIR suponiendo la TAMAR proyectada hasta el vencimiento; se grafica el margen sobre esa TAMAR
  for (const sym of Object.keys(px).filter(s => RE_TAMAR.test(s) && MARGEN_TAMAR[s] != null)) {
    const f = await ficha(sym); if (!f) continue;
    const tp = K.tamarPromedio(TAM, fT, cal.atras(f.emision, 10), cal.atras(f.vence, 10), cal), vpv = K.vpvTamar(f.emision, f.vence, tp.promedio, MARGEN_TAMAR[sym]);
    agregar('tamar', sym, f.vence, px[sym], (p, l) => { const dd = K.dias(l, f.vence), t = K.tirUnica(vpv, p, dd); return t == null ? null : { tasa: K.comoTamar(t) / 100 - tamar.supuesto / 100, tea: t, dur: dd / 365 / (1 + t) }; },
      { margenContrato: MARGEN_TAMAR[sym] });
  }
  // ---- Duales CER / TAMAR: la tasa real de la pata CER (como informa Finanzas) y, aparte, la pata TAMAR
  for (const sym of Object.keys(px).filter(s => RE_DUAL.test(s))) {
    const f = await ficha(sym); if (!f) continue;
    const margen = DUAL_CER_TAMAR[sym] ?? (f.tem > 0 && f.tem < 10 ? f.tem : null); if (margen == null) continue;
    const base = K.valorEn(CER, fC, cal.atras(f.emision, 10)), tp = K.tamarPromedio(TAM, fT, cal.atras(f.emision, 10), cal.atras(f.vence, 10), cal), vpvT = K.vpvTamar(f.emision, f.vence, tp.promedio, margen);
    agregar('duales', sym, f.vence, px[sym], (p, l, k) => {
      const dd = K.dias(l, f.vence), t = K.tirUnica(100 * cer[k ? 'ant' : 'hoy'] / base, p, dd), tt = K.tirUnica(vpvT, p, dd);
      return t == null || tt == null ? null : { tasa: t, dur: dd / 365 / (1 + t), tamarTea: tt, tamarMargen: K.comoTamar(tt) / 100 - tamar.supuesto / 100 };
    }, { margenContrato: margen, auto: DUAL_CER_TAMAR[sym] == null });
  }
  for (const g of Object.values(out)) g.sort((a, b) => a.dias - b.dias);
  if (Object.values(out).reduce((s, g) => s + g.length, 0) < 15) throw new Error('pocos bonos');
  const rueda = habilDesde(liq, -1, fer);
  return { asOf: new Date(ahora).toISOString(), rueda, ruedaAnterior: habilDesde(rueda, -1, fer), liquidacion: liq, liquidacionAnterior: liqAnt, vivo: !!pesos.vivo, tamar, cer: { valor: cer.hoy }, dolar: { valor: fx.hoy, fecha: fX.at(-1) }, grupos: out,
    fuente: 'Precios de BYMA vía data912; CER, TAMAR y dólar A3500 del BCRA; condiciones de emisión de la Secretaría de Finanzas y BYMA' };
}

// ============================================================
// ARCA: INFORME MENSUAL DE RECAUDACIÓN
// No tiene calendario publicado: sale los primeros días hábiles del mes siguiente. Se mira si el PDF de cada mes
// ya está; el que falta va con fecha estimada (el primer día hábil, o hoy si esa fecha ya pasó sin que saliera).
// ============================================================
const MESES_ARCA = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
async function getArcaRecaudacion() {
  const hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);   // hora argentina
  const [y, m] = hoy.split('-').map(Number);
  const fer = await feriados([y - 1, y, y + 1]);
  // k = 0 es el informe del mes en curso (sale el mes que viene); 1 a 3, los anteriores
  const meses = [0, 1, 2, 3].map(k => {
    const t = y * 12 + (m - 1) - k, ay = Math.floor(t / 12), am = t % 12 + 1, sig = t + 1;
    const ini = Math.floor(sig / 12) + '-' + String(sig % 12 + 1).padStart(2, '0') + '-01';
    return { k, titulo: 'Recaudación tributaria de ' + MESES_ARCA[am - 1], estimada: esHabil(ini, fer) ? ini : habilDesde(ini, 1, fer),
      url: 'https://www.afip.gob.ar/institucional/documentos/ARCA-Recaudacion-' + String(am).padStart(2, '0') + ay + '.pdf' };
  });
  const eventos = await Promise.all(meses.map(async x => {
    if (x.k === 0) return { fecha: x.estimada, titulo: x.titulo, estimada: true };
    const r = await fetch(x.url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) }).catch(() => null);
    if (r && r.ok) {
      const lm = Date.parse(r.headers.get('last-modified') || ''), f = lm ? new Date(lm - 3 * 3600e3).toISOString().slice(0, 10) : null;
      // Si el archivo se volvió a subir mucho después, vale la fecha en que suele salir
      return { fecha: f && f >= x.estimada && f <= masDias(x.estimada, 10) ? f : x.estimada, titulo: x.titulo, informe: x.url };
    }
    // El del mes pasado puede no haber salido todavía; los más viejos, si no responden, no se muestran
    return x.k === 1 && r && r.status === 404 ? { fecha: x.estimada < hoy ? hoy : x.estimada, titulo: x.titulo, estimada: true } : null;
  }));
  return { source: 'afip.gob.ar/institucional/informes-anteriores', url: 'https://www.afip.gob.ar/institucional/informes-anteriores/' + y + '.asp',
    eventos: eventos.filter(Boolean).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)) };
}

// ============================================================
// PIZARRA — panel líder, empresas argentinas en Wall Street, CEDEARs, bonos y obligaciones negociables (data912).
// % mes y % año: contra el último cierre del mes y del año anteriores. Salen una vez por mes del historial de data912
// (acciones, CEDEARs y bonos) o de Yahoo (Wall Street) y se guardan en Redis (pizarra:ref, unos 5 KB). Se completan de
// a 40 por pedido. Las obligaciones negociables no tienen historial en data912: solo la variación del día.
// ============================================================
const PANEL_LIDER = ['ALUA', 'BBAR', 'BMA', 'BYMA', 'CEPU', 'COME', 'CRES', 'ECOG', 'EDN', 'GGAL', 'IRSA', 'LOMA', 'METR', 'PAMP', 'SUPV', 'TECO2', 'TGNO4', 'TGSU2', 'TRAN', 'TXAR', 'VALO', 'YPFD'];
const EN_WALL_STREET = { BBAR: 'BBVA Argentina', BMA: 'Banco Macro', CAAP: 'Corporación América', CEPU: 'Central Puerto', CRESY: 'Cresud', EDN: 'Edenor', GGAL: 'Grupo Galicia', GLOB: 'Globant', IRS: 'IRSA',
  LOMA: 'Loma Negra', MELI: 'Mercado Libre', PAM: 'Pampa Energía', SUPV: 'Supervielle', TEO: 'Telecom', TGS: 'Transportadora Gas del Sur', TS: 'Tenaris', TX: 'Ternium', VIST: 'Vista Energy', YPF: 'YPF' };
const SOBERANOS_USD = ['AO27D', 'AO28D', 'AO29D', 'AN29D', 'AL29D', 'GD29D', 'AL30D', 'GD30D', 'AL35D', 'GD35D', 'AE38D', 'GD38D', 'AL41D', 'GD41D', 'GD46D'];
const CEDEARS_BASE = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'MELI', 'KO', 'BRKB', 'VIST', 'GLOB', 'AMD'];   // si todavía no operó ninguno
const RE_PESOS = /^([ST]\d{2}[A-Z]\d|X\d{2}[A-Z]\d|TZX(\d\d|[A-Z]\d)|D\d{2}[A-Z]\d|TZV(\d\d|[A-Z]\d)|TM[A-Z]\d{2}|TXM[A-Z]\d|TX\d{2}|TY30P|DICP|PARP|CUAP|TT[A-Z]26)$/;

// [último cierre antes del mes en curso, último cierre antes del año en curso]
function cierresBase(serie, mes) {
  const antes = lim => { let r = null; for (const x of serie) { if (x[0] < lim) r = x[1]; else break; } return r; };
  return [antes(mes + '-01'), antes(mes.slice(0, 4) + '-01-01')];
}
async function historialPizarra(k) {
  const [tipo, s] = k.split(':');
  if (tipo === 'ws') {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(s) + '?interval=1d&range=2y', {
      signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', Accept: 'application/json' } });
    if (!r.ok) throw new Error('Yahoo ' + r.status);
    const res = (await r.json()).chart.result[0], ts = res.timestamp || [], cl = res.indicators.quote[0].close || [], off = (res.meta.gmtoffset || 0) * 1000;
    return ts.map((t, i) => [new Date(t * 1000 + off).toISOString().slice(0, 10), cl[i]]).filter(x => x[1] > 0);
  }
  const a = await fetchJson('https://data912.com/historical/' + { acc: 'stocks', ced: 'cedears', bon: 'bonds' }[tipo] + '/' + encodeURIComponent(s), 6000);
  return Array.isArray(a) ? a.filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.c > 0).map(x => [x.date, x.c]) : [];   // ticker que no tiene: queda sin referencia
}
let refsMemoria = null;   // copia en la instancia, por si Redis no contesta
async function refsPizarra(claves, mes) {
  let g = refsMemoria && refsMemoria.mes === mes ? refsMemoria : null;
  if (!g || claves.some(k => !(k in g.r))) try { const r = JSON.parse(await redis(['GET', 'pizarra:ref']) || 'null'); if (r && r.mes === mes && r.r) g = { mes, r: { ...r.r, ...(g ? g.r : {}) } }; } catch {}
  if (!g) g = { mes, r: {} };
  refsMemoria = g;
  const faltan = [...new Set(claves)].filter(k => !(k in g.r)).slice(0, 90);
  let nuevo = false;
  for (let i = 0; i < faltan.length; i += 15) {   // de a 15 por vez, para no cargar a data912
    const lote = faltan.slice(i, i + 15), res = await Promise.all(lote.map(k => historialPizarra(k).then(s => cierresBase(s, mes)).catch(() => null)));   // si falla la red, se vuelve a probar
    lote.forEach((k, j) => { if (res[j]) { g.r[k] = res[j]; nuevo = true; } });
  }
  if (nuevo) await redis(['SET', 'pizarra:ref', JSON.stringify(g), 'EX', String(40 * 86400)]);
  return g.r;
}
// Lo que no tiene historial (letras, bonos en pesos, obligaciones negociables, bonos nuevos): el último precio que vio
// la página en cada mes (Redis pizarra:cierres, 14 meses). El % mes aparece al mes siguiente y el % año, en enero.
async function cierresPropios(filas, mes) {
  let h = null;
  try { h = JSON.parse(await redis(['GET', 'pizarra:cierres']) || 'null'); } catch {}
  h = h && typeof h === 'object' ? h : {};
  const act = h[mes] || (h[mes] = {});
  for (const f of filas) if (f.k && f.c > 0) act[f.k] = f.c;
  for (const m of Object.keys(h).sort().reverse().slice(14)) delete h[m];
  await redis(['SET', 'pizarra:cierres', JSON.stringify(h), 'EX', String(400 * 86400)]);
  const [y, m] = mes.split('-').map(Number), ant = m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0');
  return k => [h[ant] && h[ant][k], h[(y - 1) + '-12'] && h[(y - 1) + '-12'][k]];
}
// Emisor, cupón y vencimiento de una obligación negociable (ficha de BYMA, guardada 60 días)
// Nombre del emisor sin "S.A." y en minúsculas, salvo las siglas (palabras sin vocales o conocidas)
const SIGLAS = new Set(['IRSA', 'MSU', 'BBVA', 'ICBC', 'HSBC', 'AES', 'GEMSA', 'CAPEX', 'ARCOR', 'YPF']), MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e']);
const tituloEmisor = s => String(s || '').replace(/\s+S\.?\s?A\.?(\s?[A-Z]\.)*\s*$|\s+S\.?R\.?L\.?\s*$/i, '').trim().split(/\s+/)
  .map((w, i) => (i && MENORES.has(w.toLowerCase()) ? w.toLowerCase() : SIGLAS.has(w) || !/[AEIOUÁÉÍÓÚ]/i.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(' ');
async function fichaOn(sym) {
  let g = null;
  try { g = JSON.parse(await redis(['GET', 'on:' + sym]) || 'null'); } catch {}
  if (g) return g;
  const r = await fetch('https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/bnown/fichatecnica/especies/general', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA, Accept: 'application/json' },
    body: JSON.stringify({ symbol: sym, 'Content-Type': 'application/json' }), signal: AbortSignal.timeout(5000),
  });
  const f = r.ok ? ((await r.json()).data || [])[0] : null;
  if (!f || !f.emisor) return null;
  const tasa = parseFloat(((f.interes || '').match(/(\d+[.,]?\d*)\s*%/) || [])[1]?.replace(',', '.'));
  const d = { emisor: tituloEmisor(f.emisor), vence: /^\d{4}-\d{2}-\d{2}/.test(f.fechaVencimiento || '') ? f.fechaVencimiento.slice(0, 10) : null, cupon: /FIJ/i.test(f.interes || '') && Number.isFinite(tasa) ? tasa : null };
  await redis(['SET', 'on:' + sym, JSON.stringify(d), 'EX', String(60 * 86400)]);
  return d;
}

async function getPizarra() {
  const vivo = e => fetchJson('https://data912.com/live/' + e, 5000).catch(() => fetchJson('https://data912.com/live/' + e, 5000)).catch(() => []);
  const [acc, adr, usa, ced, notas, bonos, corp] = await Promise.all(['arg_stocks', 'usa_adrs', 'usa_stocks', 'arg_cedears', 'arg_notes', 'arg_bonds', 'arg_corp'].map(vivo));
  const ahora = Date.now(), hoy = new Date(ahora - 3 * 3600e3).toISOString().slice(0, 10), mes = hoy.slice(0, 7);
  const fer = await feriados([+hoy.slice(0, 4)]), rueda = ruedaDe(ahora, fer);
  const mem = await memoriaBonos([...(Array.isArray(notas) ? notas : []), ...(Array.isArray(bonos) ? bonos : [])], fer);   // completa los bonos que data912 todavía no lista
  const por = l => Object.fromEntries((Array.isArray(l) ? l : []).filter(x => x && x.symbol && x.c > 0).map(x => [x.symbol, x]));
  const A = por(acc), W = { ...por(usa), ...por(adr) }, C = por(ced), B = por(mem.lista), O = por(corp);
  const monto = (x, div = 1) => (x.v || 0) * x.c / div;
  const fila = (x, k, extra) => ({ s: x.symbol, c: x.c, d: Number.isFinite(x.pct_change) ? x.pct_change : null, k, ...extra });

  const lider = PANEL_LIDER.filter(s => A[s]).map(s => fila(A[s], 'acc:' + s, { vol: monto(A[s]) }));
  const ws = Object.keys(EN_WALL_STREET).filter(s => W[s]).map(s => fila(W[s], 'ws:' + s, { n: EN_WALL_STREET[s], vol: monto(W[s]) }));
  let cl = Object.values(C).filter(x => x.v > 0).sort((a, b) => monto(b) - monto(a)).slice(0, 15);
  if (cl.length < 10) cl = CEDEARS_BASE.filter(s => C[s]).map(s => C[s]);
  const cedears = cl.map(x => fila(x, 'ced:' + x.symbol, { vol: monto(x) }));
  const usd = SOBERANOS_USD.filter(s => B[s]).map(s => fila(B[s], 'bon:' + s, { ley: s.startsWith('GD') ? 'Nueva York' : 'Argentina', vol: monto(B[s], 100) }));
  const pesos = Object.values(B).filter(x => RE_PESOS.test(x.symbol)).sort((a, b) => mem.op(b.symbol).liquidez - mem.op(a.symbol).liquidez).slice(0, 12)
    .map(x => fila(x, 'bon:' + x.symbol, { vol: mem.op(x.symbol).liquidez }));
  const ol = Object.values(O).filter(x => /D$/.test(x.symbol) && x.v > 0).sort((a, b) => monto(b, 100) - monto(a, 100)).slice(0, 12);
  const fichas = await Promise.all(ol.map(x => fichaOn(x.symbol).catch(() => null)));
  const ons = ol.map((x, i) => fila(x, 'on:' + x.symbol, { vol: monto(x, 100), ...(fichas[i] || {}) }));

  const todas = [...lider, ...ws, ...cedears, ...usd, ...pesos, ...ons];
  const [refs, propios] = await Promise.all([refsPizarra([...lider, ...ws, ...cedears, ...usd, ...pesos].map(f => f.k), mes), cierresPropios(todas, mes)]);
  const pct = (c, b) => (b > 0 ? (c / b - 1) * 100 : null);
  for (const f of todas) { const r = refs[f.k] || [], p = propios(f.k); f.m = pct(f.c, r[0] || p[0]); f.a = pct(f.c, r[1] || p[1]); delete f.k; }
  if (!lider.length && !usd.length && !pesos.length) throw new Error('sin datos');
  return { asOf: new Date(ahora).toISOString(), rueda, vivo: rueda === hoy, mes, lider, ws, cedears, usd, pesos, ons,
    fuente: 'Precios de BYMA y de Nueva York vía data912 (con demora); historial de data912 y Yahoo Finance; fichas de BYMA' };
}

// ============================================================
// HANDLER
// ============================================================
const HANDLERS = {
  'arca-recaudacion':    { fn: getArcaRecaudacion,    cache: 's-maxage=3600, stale-while-revalidate=21600' },
  'curvas':              { fn: getCurvas,             cache: 's-maxage=300, stale-while-revalidate=900' },
  'pizarra':             { fn: getPizarra,            cache: 's-maxage=300, stale-while-revalidate=900' },
  'finanzas-news':       { fn: getFinanzasNews,       cache: 's-maxage=1800, stale-while-revalidate=3600' },
  'finanzas-cronograma': { fn: getFinanzasCronograma, cache: 's-maxage=3600, stale-while-revalidate=21600' },
  'bcra-calendario':     { fn: getBcraCalendario,     cache: 's-maxage=3600, stale-while-revalidate=21600' },
  'bonos-ar':            { fn: getBonosAR,            cache: 's-maxage=300, stale-while-revalidate=900' },
  'ar-bonds':            { fn: getArBonds,            cache: 's-maxage=600, stale-while-revalidate=1800' },
  'ar-pesos':            { fn: getArPesos,            cache: 's-maxage=600, stale-while-revalidate=1800' },
  'ar-mercado':          { fn: getArMercado,          cache: 's-maxage=600, stale-while-revalidate=1800' },
  'riesgo-pais':         { fn: getRiesgoPais,         cache: 's-maxage=300, stale-while-revalidate=900' },
  'caucion':             { fn: getCaucion,            cache: 's-maxage=300, stale-while-revalidate=900' },
  'youtube':             { fn: getYouTubeFeed,        cache: 's-maxage=1800, stale-while-revalidate=3600' },
};

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 60, windowSecs: 60, key: 'agenda' })) return;
  const source = req.query.source;
  const h = Object.hasOwn(HANDLERS, source) ? HANDLERS[source] : null;
  if (!h) return res.status(400).json({ error: 'source inválido', validSources: Object.keys(HANDLERS) });
  try {
    const data = await h.fn();
    res.setHeader('Cache-Control', h.cache);
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'Error al obtener datos', source });
  }
}
