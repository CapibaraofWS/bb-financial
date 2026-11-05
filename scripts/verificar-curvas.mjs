// Controla las fórmulas de api/_curvas.js contra la TIREA que publicó la Secretaría de Finanzas en los resultados de
// las licitaciones de 2026 (TAMAR, dólar linked y la pata CER de los duales). Baja las series del BCRA, las fichas de
// BYMA y los feriados en el momento. Uso: node scripts/verificar-curvas.mjs
import * as C from '../api/_curvas.js';

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; BBFinanzasBot/1.0)' };
const json = (u, o = {}) => fetch(u, { ...o, headers: { ...UA, ...(o.headers || {}) }, signal: AbortSignal.timeout(30000) }).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
const serie = async (id, desde) => { const o = {}; for (const x of (await json(`https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${id}?desde=${desde}&limit=3000`)).results[0].detalle) o[x.fecha] = x.valor; return o; };
const [CER, TAM, fer] = await Promise.all([serie(30, '2025-06-01'), serie(44, '2024-12-01'),
  Promise.all([2025, 2026, 2027].map(a => json('https://api.argentinadatos.com/v1/feriados/' + a).catch(() => []))).then(x => x.flat().map(f => f.fecha))]);
const fC = Object.keys(CER).sort(), fT = Object.keys(TAM).sort(), cal = C.calendario(fer);
const fichas = {};
const ficha = async s => (fichas[s] ??= ((await json('https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/bnown/fichatecnica/especies/general', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ symbol: s, 'Content-Type': 'application/json' }) })).data || [])
  .map(x => ({ e: x.fechaEmision.slice(0, 10), v: x.fechaVencimiento.slice(0, 10) }))[0]);
const liqLic = f => cal.paso(cal.paso(f, 1), 1);   // las licitaciones liquidan en T+2; las emisiones nuevas, el día de emisión

// [bono, licitación, precio por cada 1.000, margen (TAMAR) o nada, TIREA oficial, ¿emisión nueva?]
const TAMAR = [['TMF28', '2026-04-15', 1000, 6.50, 35.27, 1], ['TMG28', '2026-04-28', 1000, 6.90, 33.61, 1], ['TML27', '2026-06-26', 1000, 5.40, 31.50, 1],
  ['TMF27', '2026-04-15', 1080, 6.52, 33.33], ['TMF27', '2026-09-11', 1221, 6.52, 30.55], ['TMG27', '2026-04-15', 1030, 6, 33.15], ['TMG27', '2026-10-28', 1215, 6, 30.94],
  ['TMF28', '2026-04-28', 1007, 6.50, 33.44], ['TMG28', '2026-05-27', 1000, 6.90, 35.53], ['TMG28', '2026-07-15', 1038, 6.90, 34.57], ['TMG28', '2026-10-14', 1096, 6.90, 38.91], ['TML27', '2026-09-28', 1089, 5.40, 30.84]];
const DL = [['TZV28', '2026-04-15', 835.5, 8.50], ['TZV28', '2026-04-28', 850, 7.83], ['TZVD8', '2026-06-26', 817, 8.57], ['TZVD8', '2026-07-15', 811, 9.08],
  ['TZV27', '2026-09-11', 960.35, 5.24], ['TMVE8', '2026-07-29', 908.10, 6.64], ['TMVE8', '2026-10-14', 946.46, 4.35], ['D15E7', '2026-07-29', 975.70, 5.51]];
const DUAL = [['TXMJ9', '2026-04-28', 800, 7.31], ['TXMJ9', '2026-05-13', 842, 6.19], ['TXMD9', '2026-06-26', 822.5, 6.27], ['TXMD9', '2026-10-14', 878, 6.99],
  ['TXMD8', '2026-07-29', 915, 5.40], ['TXMD8', '2026-10-28', 964.5, 6.21]];

const filas = [];
for (const [s, f, p, m, of, nueva] of TAMAR) {
  const { e, v } = await ficha(s), liq = nueva ? e : liqLic(f), antes = fT.filter(d => d < f);
  const t = C.tamarPromedio(TAM, antes, cal.atras(e, 10), cal.atras(v, 10), cal);
  filas.push(['TAMAR', s, f, of, C.tirUnica(C.vpvTamar(e, v, t.promedio, m), p / 10, C.dias(liq, v)) * 100]);
}
for (const [s, f, p, of] of DL) { const { e, v } = await ficha(s), liq = liqLic(f) < e ? e : liqLic(f); filas.push(['Dólar linked', s, f, of, C.tirUnica(1000, p, C.dias(liq, v)) * 100]); }
for (const [s, f, p, of] of DUAL) {
  const { e, v } = await ficha(s), liq = liqLic(f) < e ? e : liqLic(f);
  filas.push(['Dual, pata CER', s, f, of, C.tirUnica(1000 * C.valorEn(CER, fC, cal.atras(liq, 10)) / C.valorEn(CER, fC, cal.atras(e, 10)), p, C.dias(liq, v)) * 100]);
}
for (const [g, s, f, of, c] of filas) console.log(g.padEnd(15), s, f, 'oficial', of.toFixed(2).padStart(6), 'cálculo', c.toFixed(2).padStart(6), 'diferencia', ((c - of >= 0 ? '+' : '') + (c - of).toFixed(2)).padStart(6));
const max = Math.max(...filas.map(x => Math.abs(x[4] - x[3])));
console.log('\n' + filas.length + ' licitaciones · diferencia máxima ' + max.toFixed(2) + ' puntos' + (max > 0.4 ? ' · REVISAR' : ' · bien'));
process.exitCode = max > 0.4 ? 1 : 0;
