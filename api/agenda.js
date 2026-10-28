// Endpoint multiplex para datos de la Agenda AR
// ?source=finanzas-news       → últimas noticias de la Secretaría de Finanzas
// ?source=finanzas-cronograma  → cronograma de licitaciones del Tesoro
// ?source=bcra-calendario      → calendario de informes BCRA
// Consolidado en un solo endpoint para no superar el límite de funciones del plan Hobby.
import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';

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
  ...['AL29','GD29','AL30','GD30','AL35','GD35','AE38','GD38','AL41','GD41','AO27','AO28','AN29'].map(s => [s, s + 'D']),
  ['BPOA7','BPA7D'], ['BPOB7','BPB7D'], ['BPOC7','BPC7D'], ['BPOD7','BPD7D'],
  ['BPOA8','BPA8D'], ['BPOB8','BPB8D'],
];

async function getArBonds() {
  const r = await fetch('https://data912.com/live/arg_bonds', {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!r.ok) throw new Error('Fuente de bonos respondió ' + r.status);
  const all = await r.json();
  const map = Object.fromEntries((Array.isArray(all) ? all : []).map(b => [b.symbol, b]));
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

async function fetchJson(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT),
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

async function getArPesos() {
  const [letras, priceSets, bcra] = await Promise.all([
    fetchJson('https://api.argentinadatos.com/v1/finanzas/letras'),
    Promise.all(['arg_notes', 'arg_bonds'].map(e => fetchJson(`https://data912.com/live/${e}`).catch(() => []))),
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
        Object.assign(b, { dtm: d, price: q.price, pct: q.pct, tem: Math.pow(ratio, 30.4 / d) - 1, tna: (ratio - 1) * 365 / d,
          tir: Math.pow(ratio, 365 / d) - 1, duration: d / 365, precio: 'vivo' });
        if (Number.isFinite(q.volume)) volVivo[l.ticker] = q.volume * q.price / 100;   // data912 da valor nominal
      }
      return b;
    }).filter(Boolean).sort((a, b) => a.dtm - b.dtm);
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
// HANDLER
// ============================================================
const HANDLERS = {
  'finanzas-news':       { fn: getFinanzasNews,       cache: 's-maxage=1800, stale-while-revalidate=3600' },
  'finanzas-cronograma': { fn: getFinanzasCronograma, cache: 's-maxage=3600, stale-while-revalidate=21600' },
  'bcra-calendario':     { fn: getBcraCalendario,     cache: 's-maxage=3600, stale-while-revalidate=21600' },
  'bonos-ar':            { fn: getBonosAR,            cache: 's-maxage=300, stale-while-revalidate=900' },
  'ar-bonds':            { fn: getArBonds,            cache: 's-maxage=600, stale-while-revalidate=1800' },
  'ar-pesos':            { fn: getArPesos,            cache: 's-maxage=600, stale-while-revalidate=1800' },
  'riesgo-pais':         { fn: getRiesgoPais,         cache: 's-maxage=300, stale-while-revalidate=900' },
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
