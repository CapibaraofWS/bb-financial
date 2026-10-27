import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';

// Casas permitidas para el historial (ArgentinaDatos)
const CASAS = new Set(['oficial', 'mayorista', 'blue', 'bolsa', 'contadoconliqui', 'cripto']);

// ?historico=blue -> serie diaria compacta [fecha, compra, venta]
async function historico(req, res) {
  const casa = String(req.query.historico || '');
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

// ?simulador=1: precios para el simulador de compra y "qué hubiera pasado" en el último año.
// Bancos y apps cripto: CriptoYa (solo los precios de las últimas 48 horas; sin P2P, donde el precio depende de cada vendedor).
// MEP: DolarAPI (el mismo de las tarjetas). Último año: dólar MEP (ArgentinaDatos), plazo fijo a 30 días (BCRA, variable 12)
// y fondos money market en pesos (ArgentinaDatos, datos de la CAFCI).
const BANCOS = { bna: 'Banco Nación', bapro: 'Banco Provincia', bbva: 'BBVA', galicia: 'Galicia', santander: 'Santander', macro: 'Macro', ciudad: 'Banco Ciudad',
  hipotecario: 'Hipotecario', comafi: 'Comafi', supervielle: 'Supervielle', icbc: 'ICBC', brubank: 'Brubank', patagonia: 'Patagonia', credicoop: 'Credicoop',
  mariva: 'Mariva', piano: 'Banco Piano', bancor: 'Bancor', hsbc: 'HSBC' };
const APPS = { ripio: 'Ripio', ripioexchange: 'Ripio Exchange', satoshitango: 'SatoshiTango', universalcoins: 'Universal Coins', decrypto: 'Decrypto', letsbit: "Let'sBit",
  fiwind: 'Fiwind', lemoncash: 'Lemon', vitawallet: 'Vita Wallet', belo: 'Belo', tiendacrypto: 'TiendaCrypto', saldo: 'Saldo', astropay: 'AstroPay', bybit: 'Bybit',
  eluter: 'Eluter', binance: 'Binance', bitsoalpha: 'Bitso Alpha', cocoscrypto: 'Cocos Crypto', cryptomktpro: 'CryptoMKT Pro', takenos: 'Takenos', wallbit: 'Wallbit',
  mexc: 'MEXC', peanut: 'Peanut', nexo: 'Nexo', buenbit: 'Buenbit' };
async function simulador(req, res) {
  const json = (u, ms = 12000) => fetch(u, { signal: AbortSignal.timeout(ms), headers: { 'User-Agent': 'Mozilla/5.0 (BB Finanzas)' } }).then(r => { if (!r.ok) throw new Error(); return r.json(); });
  const ahora = Date.now(), hace = ahora - 365 * 864e5, dia = t => new Date(t).toISOString().slice(0, 10);
  const [rBan, rApp, rDol, rMep, rPf, rFh] = await Promise.allSettled([
    json('https://criptoya.com/api/bancostodos'), json('https://criptoya.com/api/usdt/ars/100'), json('https://dolarapi.com/v1/dolares'),
    json('https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa'), json('https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/12?desde=' + dia(hace - 40 * 864e5) + '&limit=3000'),
    json('https://api.argentinadatos.com/v1/finanzas/fci/mercadoDinero/ultimo', 20000),
  ]);
  const out = { actualizado: new Date().toISOString() };
  const fresco = t => Number.isFinite(t) && ahora / 1000 - t < 48 * 3600;
  const ok = v => Number.isFinite(v) && v > 0;
  if (rBan.status === 'fulfilled') out.bancos = Object.entries(rBan.value).filter(([k, v]) => BANCOS[k] && v && ok(v.totalAsk) && fresco(v.time))
    .map(([k, v]) => ({ nombre: BANCOS[k], precio: v.totalAsk, hora: new Date(v.time * 1000).toISOString() })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  if (rApp.status === 'fulfilled') {
    const L = Object.entries(rApp.value).filter(([k, v]) => !/p2p$/i.test(k) && v && ok(v.totalAsk) && fresco(v.time));
    const med = L.map(([, v]) => v.totalAsk).sort((a, b) => a - b)[Math.floor(L.length / 2)];
    // Fuera los precios que se alejan más de 15% de la mediana (datos raros de una plataforma)
    out.apps = L.filter(([, v]) => Math.abs(v.totalAsk / med - 1) < 0.15).map(([k, v]) => ({ nombre: APPS[k] || k.replace(/^./, c => c.toUpperCase()), precio: v.totalAsk, hora: new Date(v.time * 1000).toISOString() }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
  if (rDol.status === 'fulfilled' && Array.isArray(rDol.value)) {
    const c = n => rDol.value.find(x => x.casa === n);
    const b = c('bolsa'), o = c('oficial');
    if (b && ok(b.venta)) out.mep = { precio: b.venta, hora: b.fechaActualizacion };
    if (o && ok(o.venta)) out.oficial = { precio: o.venta, hora: o.fechaActualizacion };
  }
  // ---- Qué hubiera pasado en el último año
  const P = {};
  if (rMep.status === 'fulfilled' && Array.isArray(rMep.value)) {
    const s = rMep.value.filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) && ok(x.venta) && ok(x.compra));
    const antes = s.filter(x => x.fecha <= dia(hace)).at(-1), hoy = s.at(-1);
    if (antes && hoy && hoy.fecha > antes.fecha) P.mep = { desde: antes.fecha, hasta: hoy.fecha, compraste: antes.venta, vendes: hoy.compra };
  }
  if (rPf.status === 'fulfilled') {
    // Plazo fijo a 30 días renovado 12 veces, cada vez a la tasa (TNA) de ese día
    const d = ((rPf.value.results && rPf.value.results[0] && rPf.value.results[0].detalle) || []).filter(x => ok(x.valor)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const tasaEn = f => { let v = null; for (const x of d) if (x.fecha <= f) v = x.valor; return v; };
    let factor = 1, n = 0;
    for (let i = 0; i < 12; i++) { const t = tasaEn(dia(hace + i * 30 * 864e5)); if (t == null) break; factor *= 1 + t / 100 * 30 / 365; n++; }
    if (n === 12 && d.length) P.plazoFijo = { desde: dia(hace), factor: Number(factor.toFixed(5)), tasaHoy: d.at(-1).valor, tasaAntes: tasaEn(dia(hace)) };
  }
  if (rFh.status === 'fulfilled' && Array.isArray(rFh.value)) {
    // Fondos money market en pesos: mediana de lo que rindió cada uno entre hace un año y el último dato
    const hoy = rFh.value.filter(x => x && x.fecha && ok(x.vcp)), fh = hoy[0] && hoy[0].fecha;
    if (fh) {
      let antes = [];
      for (let k = 0; k < 6 && antes.length < 20; k++) {
        const f = dia(Date.parse(fh) - (365 + k) * 864e5);
        antes = await json('https://api.argentinadatos.com/v1/finanzas/fci/mercadoDinero/' + f.replace(/-/g, '/'), 15000).then(a => (Array.isArray(a) ? a.filter(x => x && x.fecha && ok(x.vcp)) : [])).catch(() => []);
      }
      const A = Object.fromEntries(antes.map(x => [x.fondo, x.vcp]));
      const r = hoy.filter(x => A[x.fondo] && !/d[oó]lar|usd/i.test(x.fondo) && x.patrimonio > 5e9).map(x => x.vcp / A[x.fondo]).filter(v => v > 1 && v < 4).sort((a, b) => a - b);
      if (r.length >= 20) P.fondos = { desde: antes[0].fecha, hasta: fh, factor: Number(r[Math.floor(r.length / 2)].toFixed(5)), cantidad: r.length };
    }
  }
  if (Object.keys(P).length) out.pasado = P;
  if (!out.bancos && !out.apps && !out.mep) return res.status(502).json({ error: 'No se pudieron leer los precios' });
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  return res.status(200).json(out);
}

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 60, windowSecs: 60, key: 'dolar' })) return;
  if (req.query.historico) return historico(req, res);
  if (req.query.simulador) return simulador(req, res);
  try {
    const response = await fetch('https://dolarapi.com/v1/dolares', {
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde DolarAPI' });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con DolarAPI' });
  }
}
