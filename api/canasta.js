// Canasta básica alimentaria y total (líneas de indigencia y de pobreza) leídas del archivo del INDEC,
// que se actualiza el mismo día del informe. El portal de datos abiertos tarda semanas en cargarlas.
// Devuelve la serie mensual por adulto equivalente y la tabla de equivalencias por sexo y edad.
import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';
import { leerXls, fechaExcel } from './_xls.js';

const URL_INDEC = 'https://www.indec.gob.ar/ftp/cuadros/sociedad/serie_cba_cbt.xls';

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 30, windowSecs: 60, key: 'canasta' })) return;
  try {
    const r = await fetch(URL_INDEC, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (BB Finanzas)' } });
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
    return res.status(200).json({ fuente: 'INDEC, Valorización mensual de la CBA y la CBT (Gran Buenos Aires)', url: URL_INDEC, serie, equivalencias });
  } catch {
    return res.status(502).json({ error: 'No se pudo leer el archivo del INDEC' });
  }
}
