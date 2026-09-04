// Endpoint multiplex para datos de la Agenda AR
// ?source=finanzas-news       → últimas noticias de la Secretaría de Finanzas
// ?source=finanzas-cronograma  → cronograma de licitaciones del Tesoro
// ?source=bcra-calendario      → calendario de informes BCRA
// Consolidado en un solo endpoint para no superar el límite de funciones del plan Hobby.
import { denyExternalOrigin } from './_security.js';

const UA = 'Mozilla/5.0 (compatible; BBFinancialBot/1.0)';
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
const AR_BOND_SYMBOLS = ['AL29','GD29','AL30','GD30','AL35','GD35','AE38','GD38','AL41','GD41','AO27','AO28','AN29'];

async function getArBonds() {
  const r = await fetch('https://data912.com/live/arg_bonds', {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!r.ok) throw new Error('Fuente de bonos respondió ' + r.status);
  const all = await r.json();
  const map = Object.fromEntries((Array.isArray(all) ? all : []).map(b => [b.symbol, b]));
  const bonds = AR_BOND_SYMBOLS.map(sym => {
    const d = map[sym + 'D'] || null; // serie D = USD MEP
    if (!d) return { sym, price: null };
    const price = Number.isFinite(d.c) && d.c > 0 ? d.c : (Number.isFinite(d.px_bid) ? d.px_bid : null);
    return { sym, price, bid: d.px_bid ?? null, ask: d.px_ask ?? null, pct_change: d.pct_change ?? null, volume: d.v ?? null };
  });
  return { source: 'mercado AR (precios USD MEP, diferidos)', asOf: new Date().toISOString(), bonds };
}

// ============================================================
// DOCTA CAPITAL — yields de bonos en pesos (LECAP tasa fija + CER tasa real)
// API con tope DURÍSIMO (10 req/día). Estrategia: Redis cachea el payload 20h
// y un contador diario corta a 9 llamadas/día. Los visitantes leen SIEMPRE de
// Redis (0 llamadas a Docta por visita). Token cacheado en Redis ~50min.
// Credenciales SOLO en env vars (DOCTA_CLIENT_ID / DOCTA_CLIENT_SECRET).
// ============================================================
const DOCTA_BASE = 'https://api.doctacapital.com.ar/api/v1';
// Set curado y chico (cada símbolo = 1 request). Token + 6 = 7/día < 10.
const DOCTA_PESO_SYMBOLS = [
  { sym: 'S30N6', tipo: 'nominal' }, // LECAP nov-2026
  { sym: 'T30J7', tipo: 'nominal' }, // BONCAP jun-2027
  { sym: 'T31Y7', tipo: 'nominal' }, // BONCAP may-2027
  { sym: 'TZX26', tipo: 'cer' },     // CER 2026
  { sym: 'TZX27', tipo: 'cer' },     // CER 2027
  { sym: 'TZX28', tipo: 'cer' },     // CER 2028
];
const DOCTA_DAILY_CAP = 9; // tope duro: 1 refresh/día (~7 llamadas) < 10/día de Docta
const DOCTA_FRESH_MS = 20 * 3600 * 1000; // 20h

// --- Redis REST helpers (Upstash) ---
function redisCfg() {
  // Las env vars se guardaron con comillas literales — las limpiamos.
  const clean = (v) => (v || '').trim().replace(/^['"]|['"]$/g, '');
  return { url: clean(process.env.UPSTASH_REDIS_REST_URL), token: clean(process.env.UPSTASH_REDIS_REST_TOKEN) };
}
async function redisCmd(args) {
  const { url, token } = redisCfg();
  if (!url || !token) return null;
  try {
    // Usa el endpoint /pipeline (mismo patrón probado que _rateLimit.js)
    const r = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([args]),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? (j[0]?.result ?? null) : (j?.result ?? null);
  } catch { return null; }
}
const rGet = (k) => redisCmd(['GET', k]);
const rSet = (k, v, exSec) => exSec ? redisCmd(['SET', k, v, 'EX', String(exSec)]) : redisCmd(['SET', k, v]);
const rSetNX = (k, v, exSec) => redisCmd(['SET', k, v, 'NX', 'EX', String(exSec)]);
const rIncrBy = (k, n) => redisCmd(['INCRBY', k, String(n)]);
const rExpire = (k, s) => redisCmd(['EXPIRE', k, String(s)]);
const rDel = (k) => redisCmd(['DEL', k]);

async function getDoctaToken() {
  const cached = await rGet('docta:token');
  if (cached) return cached;
  const id = process.env.DOCTA_CLIENT_ID, secret = process.env.DOCTA_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Credenciales Docta no configuradas');
  const r = await fetch(`${DOCTA_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret, scope: 'bonds:read' }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!r.ok) throw new Error('Docta auth ' + r.status);
  const j = await r.json();
  if (!j.access_token) throw new Error('Docta sin access_token');
  const ttl = Math.max(300, Math.min((j.expires_in || 3600) - 120, 3300));
  await rSet('docta:token', j.access_token, ttl);
  return j.access_token;
}

async function getArPesos() {
  const KEY = 'docta:pesos:v1', TS = 'docta:pesos:ts';
  const cachedRaw = await rGet(KEY);
  const tsRaw = await rGet(TS);
  const fresh = tsRaw && (Date.now() - Number(tsRaw) < DOCTA_FRESH_MS);
  if (cachedRaw && fresh) { const p = JSON.parse(cachedRaw); p.cache = 'hit'; return p; }

  // Necesita refresh: lock para evitar refresh concurrente
  const gotLock = await rSetNX('docta:lock', '1', 120);
  if (!gotLock) { // otro refresh en curso → servir lo que haya
    if (cachedRaw) { const p = JSON.parse(cachedRaw); p.cache = 'stale-lock'; return p; }
    return { source: 'docta', bonds: [], note: 'Actualizando…' };
  }
  try {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const CNT = 'docta:count:' + day;
    const count = Number(await rGet(CNT) || 0);
    const needed = DOCTA_PESO_SYMBOLS.length + 1; // +1 token
    if (count + needed > DOCTA_DAILY_CAP) {
      if (cachedRaw) { const p = JSON.parse(cachedRaw); p.cache = 'cap-reached'; return p; }
      return { source: 'docta', bonds: [], note: 'Límite diario alcanzado; reintentá más tarde.' };
    }
    // Token PRIMERO: si auth falla, no gastamos el contador de bonos.
    const token = await getDoctaToken();
    // Reservar la quota recién acá (cubre los yields aunque alguno haga timeout).
    await rIncrBy(CNT, needed); await rExpire(CNT, 90000);
    // Pedidos EN PARALELO (sino 6 llamadas secuenciales superan el timeout de 10s)
    const bonds = await Promise.all(DOCTA_PESO_SYMBOLS.map(async (it) => {
      try {
        const r = await fetch(`${DOCTA_BASE}/bonds/yields/${it.sym}/intraday`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(TIMEOUT),
        });
        if (!r.ok) return { sym: it.sym, tipo: it.tipo, error: r.status };
        const j = await r.json();
        const d = Array.isArray(j.data) ? j.data[j.data.length - 1] : null;
        return {
          sym: it.sym, tipo: it.tipo,
          tir: d?.tir ?? null, tna: d?.tna ?? null, tem: d?.tem ?? null,
          duration: d?.duration ?? null, dtm: d?.dtm ?? null,
          subClass: j?.metadata?.sub_asset_class ?? null,
        };
      } catch { return { sym: it.sym, tipo: it.tipo, error: 'timeout' }; }
    }));
    const payload = { source: 'docta (snapshot diario, delay ~20min)', asOf: new Date().toISOString(), bonds, cache: 'miss' };
    // Solo cacheamos si al menos un bono trajo dato real (sino reintenta cuando resetee la quota diaria)
    const hasData = bonds.some(b => Number.isFinite(b.tir));
    if (hasData) { await rSet(KEY, JSON.stringify(payload)); await rSet(TS, String(Date.now())); }
    return payload;
  } finally {
    await rDel('docta:lock');
  }
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
  'ar-pesos':            { fn: getArPesos,            cache: 's-maxage=3600, stale-while-revalidate=72000' },
  'riesgo-pais':         { fn: getRiesgoPais,         cache: 's-maxage=300, stale-while-revalidate=900' },
  'youtube':             { fn: getYouTubeFeed,        cache: 's-maxage=1800, stale-while-revalidate=3600' },
};

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  const source = req.query.source;
  const h = HANDLERS[source];
  if (!h) return res.status(400).json({ error: 'source inválido', validSources: Object.keys(HANDLERS) });
  try {
    const data = await h.fn();
    res.setHeader('Cache-Control', h.cache);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener datos', source, detail: String(err?.message || err) });
  }
}
