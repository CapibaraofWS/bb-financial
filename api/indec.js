// Soporta ?series=id1,id2 para pedir series del portal de datos abiertos
import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';
import { leerXls, fechaExcel } from './_xls.js';

// ?canasta=1: canastas básicas (líneas de indigencia y pobreza) leídas del archivo del INDEC,
// que se actualiza el mismo día del informe. El portal de datos abiertos tarda semanas en cargarlas.
// Va dentro de esta función porque el plan de Vercel permite 12 funciones como máximo.
const URL_CANASTA = 'https://www.indec.gob.ar/ftp/cuadros/sociedad/serie_cba_cbt.xls';
async function canasta(req, res) {
  try {
    const r = await fetch(URL_CANASTA, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (BB Finanzas)' } });
    if (!r.ok) return res.status(502).json({ error: 'INDEC no respondió' });
    const hojas = leerXls(Buffer.from(await r.arrayBuffer()));
    const hoja = n => hojas.find(h => h.nombre.toLowerCase().includes(n));

    const serie = (hoja('cba-cbt')?.filas || [])
      .filter(f => f && typeof f[0] === 'number' && f[0] > 40000 && Number.isFinite(f[1]) && Number.isFinite(f[3]))
      .map(f => ({ fecha: fechaExcel(f[0]).slice(0, 7), cba: f[1], cbt: f[3] }));

    const equivalencias = (hoja('adulto')?.filas || [])
      .filter(f => f && typeof f[0] === 'string' && Number.isFinite(f[1]) && Number.isFinite(f[2]))
      .map(f => ({ edad: f[0].replace(/(\d)a/, '$1 a').replace(/\s+/g, ' ').trim(), mujer: f[1], varon: f[2] }));

    // Controles mínimos antes de publicar: si el archivo cambió de formato, mejor fallar que mostrar basura
    if (serie.length < 24 || equivalencias.length < 20) return res.status(502).json({ error: 'Formato inesperado del archivo del INDEC' });
    const u = serie.at(-1);
    if (!(u.cba > 0 && u.cbt > u.cba && u.cbt / u.cba < 4)) return res.status(502).json({ error: 'Valores fuera de rango' });

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
    return res.status(200).json({ fuente: 'INDEC, Valorización mensual de la CBA y la CBT (Gran Buenos Aires)', url: URL_CANASTA, serie, equivalencias });
  } catch {
    return res.status(502).json({ error: 'No se pudo leer el archivo del INDEC' });
  }
}

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 60, windowSecs: 60, key: 'indec' })) return;
  if (req.query.canasta) return canasta(req, res);
  const series = req.query.series;

  if (!series || !/^[A-Za-z0-9._,-]{1,300}$/.test(series)) {
    return res.status(400).json({ error: 'Parámetro series inválido' });
  }

  // datos.html ya venia mandando ?limit=N y se ignoraba: siempre devolvia 12 puntos
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 1000);
  const sort = req.query.sort === 'desc' ? 'desc' : 'asc';

  try {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${encodeURIComponent(series)}&format=json&limit=${limit}&sort=${sort}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde INDEC API' });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con INDEC API' });
  }
}
