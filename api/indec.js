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

// ?pobreza=1: pobreza e indigencia oficiales (EPH, semestral) y la estimación mensual de la UTDT.
// El nombre del archivo del INDEC cambia con cada informe, así que se busca en su página del tema.
const INDEC = 'https://www.indec.gob.ar';
const UA = { 'User-Agent': 'Mozilla/5.0 (BB Finanzas)' };
const num = v => (Number.isFinite(v) ? v : null);
async function pobreza(req, res) {
  const out = { fuente: 'INDEC, Incidencia de la pobreza y la indigencia (EPH)' };
  try {
    const tema = await (await fetch(INDEC + '/Nivel4/Tema/4/46/152', { signal: AbortSignal.timeout(10000), headers: UA })).text();
    const ruta = (tema.match(/\/ftp\/cuadros\/sociedad\/cuadros_informe_pobreza_\d{2}_\d{2}\.xls/) || [])[0];
    const informe = (tema.match(/\/uploads\/informesdeprensa\/eph_pobreza_[A-Za-z0-9_]+\.pdf/) || [])[0];
    if (!ruta) throw new Error('sin archivo');
    const r = await fetch(INDEC + ruta, { signal: AbortSignal.timeout(15000), headers: UA });
    if (!r.ok) throw new Error('archivo');
    const hojas = leerXls(Buffer.from(await r.arrayBuffer()));
    const hoja = n => hojas.find(h => h.nombre.trim().toLowerCase() === n)?.filas || [];
    const txt = v => String(v ?? '').replace(/\s+/g, ' ').trim();

    // Cuadro 1: la serie desde el 2.º semestre de 2016
    const c1 = hoja('cuadro 1');
    const cab = c1.find(f => f && txt(f[0]) === 'Indicador') || [];
    const semestres = cab.slice(1).map(s => txt(s).replace(/\s*\(\d\)\s*$/, '').replace(/\./g, '').replace(/\s+/g, ' ')).filter(Boolean);
    let bloque = '';
    const filas = {};
    for (const f of c1) {
      if (!f) continue;
      const k = txt(f[0]);
      if (k === 'Pobreza' || k === 'Indigencia') { bloque = k.toLowerCase(); continue; }
      if (bloque && (k === 'Hogares' || k === 'Personas')) filas[bloque + k] = f.slice(1, 1 + semestres.length).map(num);
    }
    const serie = semestres.map((s, i) => ({
      semestre: s, pobrezaPersonas: filas.pobrezaPersonas?.[i] ?? null, pobrezaHogares: filas.pobrezaHogares?.[i] ?? null,
      indigenciaPersonas: filas.indigenciaPersonas?.[i] ?? null, indigenciaHogares: filas.indigenciaHogares?.[i] ?? null,
    })).filter(x => x.pobrezaPersonas !== null);

    // Cuadro 3.2: por grupos de edad (indigentes y total de pobres)
    // (la hoja trae debajo otra tabla con los mismos grupos: vale la primera)
    const edades = hoja('cuadro 3.2').filter(f => f && /^(\d+-\d+|65 y más)$/.test(txt(f[0])))
      .map(f => ({ grupo: txt(f[0]), indigencia: num(f[2]), pobreza: num(f[4]) }))
      .filter((x, i, a) => a.findIndex(y => y.grupo === x.grupo) === i);

    // Cuadro 4.1 y 4.2: regiones y aglomerados (incidencia en personas)
    const REGIONES = ['Gran Buenos Aires', 'Cuyo', 'Noreste', 'Noroeste', 'Pampeana', 'Patagonia'];
    const indig = Object.fromEntries(hoja('cuadro 4.2').filter(f => f && typeof f[0] === 'string').map(f => [txt(f[0]), num(f[6])]));
    let region = null;
    const areas = [];
    for (const f of hoja('cuadro 4.1')) {
      if (!f || typeof f[0] !== 'string' || !Number.isFinite(f[6])) continue;
      const n = txt(f[0]);
      if (/^Total|Aglomerados del Interior/.test(n)) continue;
      if (REGIONES.includes(n)) region = n;
      areas.push({ nombre: n, region, esRegion: REGIONES.includes(n), pobreza: num(f[6]), indigencia: indig[n] ?? null, cv: num(f[7]) });
    }

    // Anexo: canastas por región del semestre (para estimar la línea de cada región)
    const anexo = hoja('series canastas anexo');
    const bloqueAnexo = titulo => {
      const i = anexo.findIndex(f => f && txt(f[0]).toLowerCase().includes(titulo));
      if (i < 0) return null;
      const meses = (anexo.slice(i, i + 5).find(f => f && f[1] === 'Enero' || (f && /^[A-Z][a-z]+$/.test(txt(f[1])))) || []).slice(1).map(txt).filter(Boolean);
      const regs = anexo.slice(i + 1, i + 12).filter(f => f && REGIONES.includes(txt(f[0])));
      return { meses, valores: Object.fromEntries(regs.map(f => [txt(f[0]), f.slice(1, 1 + meses.length).map(num)])) };
    };
    const cbaReg = bloqueAnexo('canasta básica alimentaria'), cbtReg = bloqueAnexo('canasta básica total');
    const anioAnexo = (anexo.find(f => f && Number.isFinite(f[1]) && f[1] > 2000) || [])[1] || null;

    const u = serie.at(-1);
    if (!u || !(u.pobrezaPersonas > 0 && u.pobrezaPersonas < 100) || serie.length < 10) throw new Error('rango');
    Object.assign(out, {
      archivo: INDEC + ruta, informe: informe ? INDEC + informe : null, serie, edades, areas,
      canastasRegionales: cbaReg && cbtReg ? { anio: anioAnexo, meses: cbtReg.meses, cba: cbaReg.valores, cbt: cbtReg.valores } : null,
    });
  } catch {
    out.error = 'No se pudo leer el informe de pobreza del INDEC';
  }

  // Nowcast de la UTDT (González-Rozada): el dato está en el texto de su página
  try {
    const r = await fetch('https://www.utdt.edu/profesores/mrozada/pobreza', { signal: AbortSignal.timeout(8000), headers: UA });
    const t = new TextDecoder('latin1').decode(await r.arrayBuffer()).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const m = t.match(/tasa de pobreza de ([\d.]+)% para el semestre \S+ con un intervalo del 95% de confianza entre \[([\d.]+)%, ([\d.]+)%\]/);
    const p = t.match(/Tasa de Pobreza para el Semestre ([A-Za-zé]+ \d{4}) - ([A-Za-zé]+ \d{4})/);
    const v = m && +m[1];
    if (v > 0 && v < 100) out.utdt = { valor: v, desde: +m[2], hasta: +m[3], periodo: p ? p[1] + ' a ' + p[2] : null, url: 'https://www.utdt.edu/profesores/mrozada/pobreza' };
  } catch {}

  if (!out.serie && !out.utdt) return res.status(502).json({ error: out.error });
  res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=604800');
  return res.status(200).json(out);
}

// ?calendario=1: publicaciones del INDEC del último mes y de los próximos dos (calendario oficial de difusión).
// La página trae datos de quien cargó cada evento: se devuelven solo fecha, título y enlace al informe.
async function calendario(req, res) {
  try {
    const r = await fetch(INDEC + '/Calendario/Fecha/0', { signal: AbortSignal.timeout(15000), headers: UA });
    if (!r.ok) throw new Error();
    const s = await r.text();
    const hoy = Date.now(), desde = new Date(hoy - 35 * 864e5).toISOString().slice(0, 10), hasta = new Date(hoy + 70 * 864e5).toISOString().slice(0, 10);
    const vistos = new Set();
    const eventos = [];
    for (const m of s.matchAll(/"fechaPublicacion":"(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})[^"]*","hora":"\d*","titulo_espaniol":"((?:[^"\\]|\\.){1,300})"[\s\S]{0,400}?"urlArchivo":"([^"]{0,200})"/g)) {
      const [, fecha, hora, tit, url] = m;
      if (fecha < desde || fecha > hasta) continue;
      let titulo; try { titulo = JSON.parse('"' + tit + '"'); } catch { continue; }
      if (/^Argentine|^INDEC Informa/.test(titulo)) continue;   // versiones en inglés y la revista mensual
      const k = fecha + titulo; if (vistos.has(k)) continue; vistos.add(k);
      const limpio = url.replace(/^\/+/, '');
      eventos.push({ fecha, hora, titulo, informe: /^uploads\/informesdeprensa\/[A-Za-z0-9_]+\.pdf$/.test(limpio) ? INDEC + '/' + limpio : null });
    }
    if (eventos.length < 5) throw new Error();
    eventos.sort((a, b) => (a.fecha + a.hora < b.fecha + b.hora ? -1 : 1));
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=172800');
    return res.status(200).json({ fuente: 'INDEC, Calendario de difusión', url: INDEC + '/indec/web/Calendario-Fecha-0', eventos });
  } catch {
    return res.status(502).json({ error: 'No se pudo leer el calendario del INDEC' });
  }
}

// ?ipc=1: inflación desde el CSV del INDEC (nivel general, categorías, bienes y servicios, rubros y regiones).
// Se actualiza el mismo día del informe; el portal de datos abiertos tarda semanas.
async function ipc(req, res) {
  try {
    const r = await fetch(INDEC + '/ftp/cuadros/economia/serie_ipc_divisiones.csv', { signal: AbortSignal.timeout(15000), headers: UA });
    if (!r.ok) throw new Error();
    const t = new TextDecoder('latin1').decode(await r.arrayBuffer());
    const n = v => { const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };
    const general = [], cat = { 'Núcleo': [], Regulados: [], Estacional: [] }, bys = { Bienes: [], Servicios: [] }, div = {}, reg = {};
    for (const linea of t.split(/\r?\n/)) {
      const c = linea.split(';');
      if (c.length < 8 || !/^\d{6}$/.test(c[3])) continue;
      const p = c[3].slice(0, 4) + '-' + c[3].slice(4), fila = { p, m: n(c[5]), a: n(c[6]) };
      const region = c[7].trim();
      if (c[0] === '0' && region !== 'Nacional') { if (!reg[region] || reg[region].p < p) reg[region] = Object.assign({ region }, fila); continue; }
      if (region !== 'Nacional') continue;
      if (c[0] === '0') general.push(Object.assign({ i: n(c[4]) }, fila));
      else if (c[2] === 'Categorias') { const k = c[0] === 'Estacional' ? 'Estacional' : c[0] === 'Regulados' ? 'Regulados' : 'Núcleo'; cat[k].push(fila); }
      else if (c[2] === 'Bienes y servicios') (c[0] === 'B' ? bys.Bienes : bys.Servicios).push(fila);
      else if (/^\d{2}$/.test(c[0])) div[c[0]] = Object.assign({ codigo: c[0], nombre: c[1].trim() }, fila.p >= (div[c[0]]?.p || '') ? fila : div[c[0]]);
    }
    general.sort((a, b) => (a.p < b.p ? -1 : 1));
    const u = general.at(-1);
    if (!u || general.length < 60 || !(u.m > -5 && u.m < 50)) throw new Error('rango');
    const ult = arr => arr.sort((a, b) => (a.p < b.p ? -1 : 1)).slice(-37);
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
    return res.status(200).json({
      fuente: 'INDEC, Índice de precios al consumidor (cobertura nacional)', url: INDEC + '/ftp/cuadros/economia/serie_ipc_divisiones.csv',
      general: general.filter(x => x.p >= '2017-01'), categorias: Object.fromEntries(Object.entries(cat).map(([k, v]) => [k, ult(v)])),
      bienesServicios: Object.fromEntries(Object.entries(bys).map(([k, v]) => [k, ult(v)])),
      divisiones: Object.values(div).filter(d => d.p === u.p).sort((a, b) => (a.codigo < b.codigo ? -1 : 1)),
      regiones: Object.values(reg).filter(x => x.p === u.p),
    });
  } catch {
    return res.status(502).json({ error: 'No se pudo leer el IPC del INDEC' });
  }
}

// ?emae=1: estimador mensual de actividad desde el archivo del INDEC (el portal de datos abiertos a veces lo devuelve vacío)
async function emae(req, res) {
  try {
    const r = await fetch(INDEC + '/ftp/cuadros/economia/sh_emae_mensual_base2004.xls', { signal: AbortSignal.timeout(15000), headers: UA });
    if (!r.ok) throw new Error();
    const filas = leerXls(Buffer.from(await r.arrayBuffer()))[0]?.filas || [];
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const serie = [];
    let anio = null;
    for (const f of filas) {
      if (!f) continue;
      if (Number.isFinite(f[0]) && f[0] > 2000) anio = f[0];
      const m = MESES.indexOf(String(f[1] || '').trim().toLowerCase());
      if (!anio || m < 0 || !Number.isFinite(f[2])) continue;
      serie.push({ fecha: anio + '-' + String(m + 1).padStart(2, '0'), original: f[2], ia: num(f[3]), desest: num(f[4]), mm: num(f[5]) });
    }
    const u = serie.at(-1);
    if (serie.length < 100 || !u || !(u.desest > 50 && u.desest < 400)) throw new Error('rango');
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
    return res.status(200).json({ fuente: 'INDEC, Estimador mensual de actividad económica (base 2004)', url: INDEC + '/ftp/cuadros/economia/sh_emae_mensual_base2004.xls', serie: serie.slice(-60) });
  } catch {
    return res.status(502).json({ error: 'No se pudo leer el EMAE del INDEC' });
  }
}

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 60, windowSecs: 60, key: 'indec' })) return;
  if (req.query.ipc) return ipc(req, res);
  if (req.query.emae) return emae(req, res);
  if (req.query.canasta) return canasta(req, res);
  if (req.query.pobreza) return pobreza(req, res);
  if (req.query.calendario) return calendario(req, res);
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
