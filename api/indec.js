// Soporta ?series=id1,id2 para pedir series del portal de datos abiertos
import { denyExternalOrigin } from './_security.js';
import { denyRateLimited } from './_rateLimit.js';
import { leerXls, fechaExcel } from './_xls.js';
import { leerXlsx, archivos } from './_xlsx.js';

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
      // El informe suele estar en uploads/informesdeprensa; algunos (productos industriales, productividad) en ftp/cuadros
      eventos.push({ fecha, hora, titulo, informe: /^(uploads\/informesdeprensa|ftp\/cuadros\/[a-z]+)\/[A-Za-z0-9_]+\.pdf$/.test(limpio) ? INDEC + '/' + limpio : null });
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

// CSV del portal de datos abiertos → filas [fecha 'YYYY-MM', ...números]
const GOB = 'https://infra.datos.gob.ar/catalog/sspm/dataset/';
async function csvGob(ruta) {
  const r = await fetch(GOB + ruta, { signal: AbortSignal.timeout(12000), headers: UA });
  if (!r.ok) throw new Error();
  const lineas = (await r.text()).trim().split(/\r?\n/);
  return { cab: lineas[0].split(','), filas: lineas.slice(1).map(l => l.split(',')).filter(c => /^\d{4}-\d{2}-01$/.test(c[0]))
    .map(c => [c[0].slice(0, 7), ...c.slice(1).map(v => (v === '' ? null : num(+v)))]) };
}
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ?salarios=1: índice de salarios del INDEC, RIPTE y salario mínimo.
// El RIPTE sale de la página de la Secretaría de Seguridad Social, que lo publica antes que el portal de datos abiertos
// (el portal se usa para la serie larga; donde los dos tienen el mes, vale la página oficial).
async function salarios(req, res) {
  const [rIs, rRip, rOf, rMin] = await Promise.allSettled([
    fetch(INDEC + '/ftp/cuadros/sociedad/indice_salarios.csv', { signal: AbortSignal.timeout(12000), headers: UA }).then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer(); }),
    csvGob('158/distribution/158.1/download/remuneracion-imponible-promedio-trabajadores-estables-ripte-total-pais-pesos-serie-mensual.csv'),
    fetch('https://www.argentina.gob.ar/trabajo/seguridadsocial/ripte', { signal: AbortSignal.timeout(10000), headers: UA }).then(r => { if (!r.ok) throw new Error(); return r.text(); }),
    fetch('https://apis.datos.gob.ar/series/api/series/?ids=57.1_SMVMM_0_M_34&format=json&limit=150&sort=desc', { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
  ]);
  const out = { fuente: 'INDEC (índice de salarios), Secretaría de Seguridad Social (RIPTE) y Consejo del Salario (salario mínimo)' };

  // Índice de salarios (base octubre 2016 = 100): privado registrado, público, total registrado, no registrado, total
  if (rIs.status === 'fulfilled') {
    const n = v => { const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };
    const indice = [];
    for (const l of new TextDecoder('latin1').decode(rIs.value).split(/\r?\n/)) {
      const c = l.split(';'), f = (c[0] || '').match(/^\d{1,2}\/(\d{1,2})\/(\d{4})$/);
      if (!f || c.length < 6) continue;
      indice.push({ p: f[2] + '-' + f[1].padStart(2, '0'), privado: n(c[1]), publico: n(c[2]), registrado: n(c[3]), noRegistrado: n(c[4]), total: n(c[5]) });
    }
    const u = indice.at(-1);
    if (indice.length > 60 && u && u.registrado > 100) out.indice = indice;
  }

  // RIPTE en pesos: serie larga del portal + los meses de la página oficial
  const ripte = {};
  if (rRip.status === 'fulfilled') for (const [p, v] of rRip.value.filas) if (v > 0 && p >= '2016-01') ripte[p] = v;
  // El portal a veces repite el valor de un mes anterior en el último mes: si pasa, ese mes no se usa
  const ks = Object.keys(ripte).sort();
  if (ks.length > 2 && ripte[ks.at(-1)] === ripte[ks.at(-3)]) delete ripte[ks.at(-1)];
  if (rOf.status === 'fulfilled') {
    const t = rOf.value.replace(/<\/t[dh]>/gi, ' | ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    for (const m of t.matchAll(/\b(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Setiembre|Octubre|Noviembre|Diciembre)\s*\/?\s*(20\d{2})\s*\|\s*\$\s*([\d.]+(?:,\d{1,2})?)\s*\|/gi)) {
      const mes = MESES_ES.indexOf(m[1].toLowerCase().replace('setiembre', 'septiembre'));
      const v = parseFloat(m[3].replace(/\./g, '').replace(',', '.'));
      if (mes >= 0 && v > 1e5 && v < 1e9) ripte[m[2] + '-' + String(mes + 1).padStart(2, '0')] = v;
    }
  }
  const serieRipte = Object.keys(ripte).sort().map(p => ({ p, v: ripte[p] }));
  if (serieRipte.length > 24) out.ripte = serieRipte;

  // Salario mínimo, vital y móvil (mensual): trae también los aumentos ya fijados para los próximos meses
  if (rMin.status === 'fulfilled') {
    const s = ((rMin.value && rMin.value.data) || []).filter(f => f[1] > 0).map(f => ({ p: f[0].slice(0, 7), v: f[1] })).reverse();
    if (s.length > 12) out.minimo = s;
  }
  if (!out.indice && !out.ripte) return res.status(502).json({ error: 'No se pudieron leer los salarios' });
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
  return res.status(200).json(out);
}

// ?empleo=1: trabajo registrado (SIPA, Secretaría de Trabajo), asalariados privados por provincia y tasas de la EPH (INDEC)
// Códigos de provincia del INDEC (los mismos del mapa del IGN)
const PROVINCIAS = { buenos_aires: '06', caba: '02', catamarca: '10', chaco: '22', chubut: '26', cordoba: '14', corrientes: '18', entre_rios: '30', formosa: '34', jujuy: '38', la_pampa: '42', la_rioja: '46', mendoza: '50', misiones: '54', neuquen: '58', rio_negro: '62', salta: '66', san_juan: '70', san_luis: '74', santa_cruz: '78', santa_fe: '82', santiago_estero: '86', tierra_fuego: '94', tucuman: '90' };
async function empleo(req, res) {
  const [rSipa, rProv, rEph] = await Promise.allSettled([
    csvGob('151/distribution/151.1/download/trabajadores-registrados-modalidad-ocupacional-principal-mensual-total-pais-miles-base-2012.csv'),
    csvGob('154/distribution/154.2/download/asalariados-registrados-sector-privado-segun-provincia-datos-sin-estacionalidad.csv'),
    csvGob('42/distribution/42.3/download/evolucion-principales-variables-ocupacionales-eph-continua-valores-trimestrales.csv'),
  ]);
  const out = { fuente: 'Secretaría de Trabajo (SIPA) e INDEC (EPH), vía datos.gob.ar' };
  const col = (d, nombre) => d.cab.indexOf(nombre);

  // Trabajadores registrados por modalidad, sin estacionalidad (miles)
  if (rSipa.status === 'fulfilled') {
    const d = rSipa.value, K = { privados: 'asalariados_priv_sin_estac', publicos: 'asalariados_pub_sin_estac', casas: 'asalariados_casas_particulares_sin_estac', autonomos: 'independientes_autonomos_sin_estac', monotributo: 'independientes_monotributo_sin_estac', monoSocial: 'independientes_monotributo_social_sin_estac', total: 'total_sin_estac' };
    const idx = Object.fromEntries(Object.entries(K).map(([k, c]) => [k, col(d, c)]));
    if (Object.values(idx).every(i => i > 0)) {
      const s = d.filas.filter(f => f[0] >= '2017-01' && f[idx.total] > 0).map(f => Object.assign({ p: f[0] }, Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, f[i] == null ? null : Math.round(f[i] * 10) / 10]))));
      if (s.length > 24 && s.at(-1).total > 5000) out.sipa = s;
    }
  }
  // Asalariados privados por provincia (miles, sin estacionalidad): los últimos 37 meses
  if (rProv.status === 'fulfilled') {
    const d = rProv.value, f = d.filas.slice(-37), valores = {};
    for (const [k, cod] of Object.entries(PROVINCIAS)) {
      const i = col(d, 'asalariados_priv_sin_estac_' + k);
      if (i > 0) valores[cod] = f.map(x => x[i]);
    }
    if (Object.keys(valores).length === 24 && f.length === 37) out.provincias = { fechas: f.map(x => x[0]), valores };
  }
  // EPH: actividad, empleo, desocupación y subocupación (trimestral, en %)
  if (rEph.status === 'fulfilled') {
    const d = rEph.value, K = { actividad: 'eph_continua_actividad_total', empleo: 'eph_continua_empleo_total', desocupacion: 'eph_continua_desocupacion_total', subocupacion: 'eph_continua_subocupacion_total' };
    const idx = Object.fromEntries(Object.entries(K).map(([k, c]) => [k, col(d, c)]));
    if (Object.values(idx).every(i => i > 0)) {
      const s = d.filas.filter(f => f[0] >= '2016-04' && f[idx.desocupacion] > 0).map(f => Object.assign({ p: f[0] }, Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, f[i] == null ? null : Math.round(f[i] * 1000) / 10]))));
      if (s.length > 8 && s.at(-1).desocupacion < 40) out.eph = s;
    }
  }
  if (!out.sipa && !out.provincias && !out.eph) return res.status(502).json({ error: 'No se pudieron leer los datos de empleo' });
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
  return res.status(200).json(out);
}

// ?comercio=1: intercambio comercial argentino del INDEC (balanza mensual, exportaciones por rubro,
// importaciones por uso y socios). Los nombres de tres archivos cambian con el año: se buscan en la página del tema.
const MES_RE = /^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/i;
async function comercio(req, res) {
  const tema = await fetch(INDEC + '/Nivel4/Tema/3/2/40', { signal: AbortSignal.timeout(10000), headers: UA }).then(r => (r.ok ? r.text() : '')).catch(() => '');
  const ruta = re => (tema.match(re) || [])[0];
  const xls = async r => {
    if (!r) throw new Error('sin archivo');
    const x = await fetch(INDEC + r, { signal: AbortSignal.timeout(15000), headers: UA });
    if (!x.ok) throw new Error('archivo');
    return leerXls(Buffer.from(await x.arrayBuffer()))[0]?.filas || [];
  };
  const [rBal, rRub, rUso, rPai] = await Promise.allSettled([
    xls('/ftp/cuadros/economia/balanmensual.xls'),
    xls(ruta(/\/ftp\/cuadros\/economia\/expo_grandes_rubros_\d{4}_\d{4}\.xls/)),
    xls(ruta(/\/ftp\/cuadros\/economia\/impo_uso_economico_\d{4}_\d{4}\.xls/)),
    xls(ruta(/\/ftp\/cuadros\/economia\/balan_continentes_paises_\d{4}_\d{4}\.xls/)),
  ]);
  const txt = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const informe = ruta(/\/uploads\/informesdeprensa\/ica_\d{2}_\d{2}[A-Za-z0-9]*\.pdf/);
  const out = { fuente: 'INDEC, Intercambio comercial argentino', url: INDEC + '/Nivel4/Tema/3/2/40', informe: informe ? INDEC + informe : null };

  // Balanza mensual desde 1990 (millones de dólares): el año figura solo en enero
  if (rBal.status === 'fulfilled') {
    const f = rBal.value, cab = f.find(r => r && r.some(v => txt(v) === 'Exportaciones') && r.some(v => txt(v) === 'Saldo')) || [];
    const ce = cab.findIndex(v => txt(v) === 'Exportaciones'), ci = cab.findIndex(v => txt(v) === 'Importaciones'), cs = cab.findIndex(v => txt(v) === 'Saldo');
    const serie = [];
    let anio = null;
    for (const r of f) {
      if (!r || ce < 0) continue;
      const a = txt(r[0]).match(/^(\d{4})/); if (a) anio = +a[1];
      const m = txt(r[1]).match(MES_RE);
      if (!anio || !m || !Number.isFinite(r[ce]) || !Number.isFinite(r[ci])) continue;
      const mes = MESES_ES.indexOf(m[1].toLowerCase().replace('setiembre', 'septiembre')) + 1;
      serie.push({ p: anio + '-' + String(mes).padStart(2, '0'), expo: r[ce], impo: r[ci], saldo: Number.isFinite(r[cs]) ? r[cs] : r[ce] - r[ci] });
    }
    const u = serie.at(-1);
    if (serie.length > 200 && u && u.expo > 1000 && u.expo < 50000) out.mensual = serie.filter(x => x.p >= '2016-01');
  }

  // Acumulado del año por categoría: exportaciones por grandes rubros e importaciones por uso económico
  const porCategoria = f => {
    const cab = f.find(r => r && r.some(v => txt(v) === 'Total') && r.filter(v => typeof v === 'string' && /\(|Resto/.test(v)).length >= 3);
    const acum = f.find(r => r && r.some(v => /^Total acumulado/i.test(txt(v))));
    const anios = f.find(r => r && r.some(v => /^Año \d{4}/.test(txt(v))));
    if (!cab || !acum || !anios) return null;
    const categorias = cab.map((v, i) => [i, txt(v)]).filter(([, v]) => v.length > 3 && !/^Per[ií]odo/.test(v))
      .map(([i, nombre]) => ({ nombre, actual: num(acum[i]), anterior: num(acum[i + 1]) })).filter(c => c.actual != null && c.anterior != null);
    const hasta = (txt(acum.find(v => /^Total acumulado/i.test(txt(v)))).match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i) || [])[1];
    const anio = +(txt(anios.find(v => /^Año \d{4}/.test(txt(v)))).match(/\d{4}/) || [])[0];
    return categorias.length >= 4 && hasta && anio ? { anio, hasta: hasta.toLowerCase(), categorias } : null;
  };
  if (rRub.status === 'fulfilled') out.rubros = porCategoria(rRub.value);
  if (rUso.status === 'fulfilled') out.usos = porCategoria(rUso.value);

  // Socios comerciales: acumulado del año por país (miles de dólares → millones)
  if (rPai.status === 'fulfilled') {
    const f = rPai.value, cab = f.find(r => r && r.some(v => txt(v) === 'Exportaciones') && r.some(v => txt(v) === 'Importaciones'));
    if (cab) {
      // La columna de los nombres: desde octubre de 2026 la primera viene vacía
      const ce = cab.findIndex(v => txt(v) === 'Exportaciones'), ci = cab.findIndex(v => txt(v) === 'Importaciones'), cn = Math.max(0, cab.findIndex(v => /pa[ií]ses/i.test(txt(v))));
      const periodo = txt((f[f.indexOf(cab) + 1] || [])[ce]).replace(/[e*]+$/, '');
      const mill = v => (Number.isFinite(v) ? Math.round(v / 100) / 10 : 0);
      const filas = f.filter(r => r && typeof r[cn] === 'string' && txt(r[cn]) && (Number.isFinite(r[ce]) || Number.isFinite(r[ci])));
      const fila = r => ({ nombre: txt(r[cn]).replace(/^Total de /, ''), expo: mill(r[ce]), expoAnt: mill(r[ce + 1]), impo: mill(r[ci]), impoAnt: mill(r[ci + 1]) });
      // Las filas con sangría son aperturas de la fila de arriba (por ejemplo, China sin Hong Kong ni Macao)
      const paises = filas.filter(r => !/^\s/.test(r[cn]) && !/^Total|^Los demás|^Resto/i.test(txt(r[cn]))).map(fila).sort((a, b) => b.expo + b.impo - a.expo - a.impo).slice(0, 12);
      const continentes = filas.filter(r => /^Total de /.test(txt(r[cn]))).map(fila);
      if (paises.length >= 8) out.socios = { periodo, paises, continentes };
    }
  }
  if (!out.mensual) return res.status(502).json({ error: 'No se pudo leer el intercambio comercial del INDEC' });
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
  return res.status(200).json(out);
}

// ?fiscal=1: ingresos, gastos y resultado del Sector Público Nacional no financiero (base caja, Secretaría de Hacienda)
// y la recaudación tributaria. La serie sale del IMIG del portal de datos abiertos; si Hacienda ya publicó un mes más
// nuevo en su planilla oficial (el comunicado mensual), se suma ese mes con los totales de la planilla.
const ARG = 'https://www.argentina.gob.ar';
async function planillaHacienda() {
  const pag = await fetch(ARG + '/economia/sechacienda', { signal: AbortSignal.timeout(8000), headers: UA }).then(r => (r.ok ? r.text() : ''));
  const notas = [...new Set([...pag.matchAll(/href="(\/noticias\/en-(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)-el-sector-publico-nacional[a-z0-9-]{0,160})"/g)].map(m => m[1]))].slice(0, 3);
  const planillas = (await Promise.all(notas.map(n => fetch(ARG + n, { signal: AbortSignal.timeout(8000), headers: UA }).then(r => (r.ok ? r.text() : '')).catch(() => ''))))
    .flatMap(t => [...t.matchAll(/https:\/\/www\.argentina\.gob\.ar\/sites\/default\/files\/(\d{4})\/(\d{2})\/([a-z]+)_(\d{2})(?:_\d)?\.xlsx/g)])
    .map(m => ({ url: m[0], mes: MESES_ES.indexOf(m[3]) + 1, anio: 2000 + +m[4] })).filter(x => x.mes > 0)
    .sort((a, b) => b.anio * 12 + b.mes - (a.anio * 12 + a.mes));
  if (!planillas.length) return null;
  const r = await fetch(planillas[0].url, { signal: AbortSignal.timeout(10000), headers: UA });
  if (!r.ok || +(r.headers.get('content-length') || 0) > 5e6) return null;
  const filas = leerXlsx(Buffer.from(await r.arrayBuffer()))[0]?.filas || [];
  const t = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const titulo = filas.flat().find(v => typeof v === 'string' && /BASE CAJA - /.test(v)) || '';
  const tm = titulo.match(/BASE CAJA - ([A-ZÁÉÍÓÚ]+) (\d{4})/);
  const p = { anio: planillas[0].anio, mes: planillas[0].mes };
  if (!tm || MESES_ES.indexOf(tm[1].toLowerCase()) + 1 !== p.mes || +tm[2] !== p.anio) return null;   // la planilla tiene que ser del mes que dice el nombre
  const cab = filas.find(f => f && f.some(v => /^T\s*O\s*T\s*A\s*L$/.test(t(v))));
  const col = cab ? cab.findLastIndex(v => /^T\s*O\s*T\s*A\s*L$/.test(t(v))) : -1;
  const fila = re => { const f = filas.find(x => x && re.test(t(x[1]))); return f && Number.isFinite(f[col]) ? f[col] : null; };
  const ingresos = fila(/^INGRESOS ANTES DE FIGURAT/), primario = fila(/^RESULTADO PRIMARIO/), financiero = fila(/^RESULTADO FINANCIERO/), intereses = fila(/^\. Intereses Netos/);
  if ([ingresos, primario, financiero, intereses].some(v => v == null) || Math.abs(primario - intereses - financiero) > 5) return null;
  return { p: p.anio + '-' + String(p.mes).padStart(2, '0'), ingresos, gastos: ingresos - primario, primario, intereses, financiero, planilla: planillas[0].url };
}
// Columnas del IMIG agrupadas para leerlas más fácil
const IMIG_ING = { iva: ['iva_neto_reintegros'], ganancias: ['ganancias'], segSocial: ['aportes_contribuciones_seguridad_social'], cheque: ['debitos_creditos'], exportaciones: ['derechos_exportacion'], importaciones: ['derechos_importacion'],
  otrosImpuestos: ['bienes_personales', 'impuestos_internos', 'combustibles', 'resto_tributarios'], rentas: ['fgs_cobradas_sector_privado_sector_publico_financiero', 'resto_rentas_propiedad'], otros: ['ingresos_no_tributarios', 'transferencias_corrientes', 'resto_ingresos_corrientes', 'ingresos_capital'] };
const IMIG_GAS = { jubilaciones: ['jubilaciones_pensiones_contributivas'], asignaciones: ['asignacion_familiares_hijo'], pensionesNC: ['pensiones_no_contributivas'], pami: ['prestaciones_inssjp'], otrosProgramas: ['otros_programas'],
  energia: ['energia'], transporte: ['transporte'], otrosSubsidios: ['otras_funciones'], salarios: ['salarios'], funcionamiento: ['otros_gastos_funcionamiento'],
  provincias: ['transferencias_corrientes_provincias_educacion', 'transferencias_corrientes_provincias_seguridad_social', 'transferencias_corrientes_provincias_desarrollo_social', 'transferencias_corrientes_provincias_salud', 'transferencias_corrientes_provincias_otras'],
  universidades: ['otros_corrientes_transferencias_universidades'], empresas: ['otros_corrientes_deficit_operativo_empresas_publicas'], otrosCorrientes: ['otros_corrientes_resto'], capital: ['capital_', 'fondo_federal_solidario'] };
// PBI a precios corrientes del INDEC (millones de pesos, trimestral, en valores anualizados). El nombre del archivo cambia con cada informe.
async function pibCorriente() {
  const tema = await fetch(INDEC + '/Nivel4/Tema/3/9/47', { signal: AbortSignal.timeout(10000), headers: UA }).then(r => (r.ok ? r.text() : ''));
  const ruta = (tema.match(/\/ftp\/cuadros\/economia\/sh_oferta_demanda_\d{2}_\d{2}\.xls/) || [])[0];
  if (!ruta) throw new Error('sin archivo');
  const x = await fetch(INDEC + ruta, { signal: AbortSignal.timeout(15000), headers: UA });
  if (!x.ok) throw new Error('archivo');
  const s = (leerXls(Buffer.from(await x.arrayBuffer())).find(h => /^cuadro 8$/i.test(h.nombre.trim())) || {}).filas || [];
  const fila = s.find(r => r && String(r[1] || '').trim() === 'Producto Interno Bruto'), anios = s[3] || [], trims = s[4] || [];
  if (!fila) throw new Error('sin PBI');
  let anio = null; const out = [];
  for (let c = 2; c < fila.length; c++) {
    const a = parseInt(String(anios[c] ?? ''), 10); if (a > 2000) anio = a;
    const q = String(trims[c] ?? '').match(/^(\d)º trimestre/);
    if (anio && q && Number.isFinite(fila[c])) out.push([anio + 'Q' + q[1], Math.round(fila[c])]);
  }
  return out;
}
// Deuda bruta de la Administración Central (Secretaría de Finanzas, boletín mensual, millones de dólares).
// Las fechas vienen como número de Excel o como "jul-26 (*)" (datos preliminares).
const DEUDA_MONEDA = { pesos: 'Pesos no ajustable por CER', cer: 'Pesos ajustable por CER', dolares: 'Dólares', fmi: 'DEG', euros: 'Euros', yenes: 'Yenes', otras: 'Otras monedas' };
async function deudaTesoro() {
  const pag = await fetch('https://www.argentina.gob.ar/economia/finanzas/datos-mensuales', { signal: AbortSignal.timeout(10000), headers: UA }).then(r => (r.ok ? r.text() : ''));
  const ruta = (pag.match(/\/sites\/default\/files\/boletin_mensual_\d{2}_\d{2}_\d{4}[\w-]*\.xlsx/) || [])[0];
  if (!ruta) throw new Error('sin archivo');
  const x = await fetch('https://www.argentina.gob.ar' + ruta, { signal: AbortSignal.timeout(20000), headers: UA });
  if (!x.ok) throw new Error('archivo');
  const H = Object.fromEntries(leerXlsx(Buffer.from(await x.arrayBuffer())).map(h => [h.nombre.trim(), h.filas]));
  const fecha = v => { if (typeof v === 'number' && v > 40000) return fechaExcel(v).slice(0, 7); const m = String(v || '').match(/^([a-z]{3})[a-z]*-(\d{2})/i); const i = m ? MES_CORTO.indexOf(m[1].toLowerCase()) : -1; return i < 0 ? null : '20' + m[2] + '-' + String(i + 1).padStart(2, '0'); };
  const leer = hoja => { const f = H[hoja] || [], cab = f.find(r => r && r.filter(v => typeof v === 'number' && v > 40000).length > 20) || [];
    const cols = cab.map((v, i) => [i, fecha(v)]).filter(c => c[1]);
    return { fechas: cols.map(c => c[1]), fila: t => { const r = f.find(r => r && String(r[1] || '').trim().startsWith(t)); return r ? cols.map(([i]) => (Number.isFinite(r[i]) ? Math.round(r[i]) : null)) : null; } }; };
  const a1 = leer('A.1'), a3 = leer('A.3'), total = a1.fila('A- DEUDA BRUTA');
  const mon = Object.fromEntries(Object.entries(DEUDA_MONEDA).map(([k, t]) => [k, a3.fila(t)]));
  if (!total || Object.values(mon).some(v => !v) || a1.fechas.join() !== a3.fechas.join() || a1.fechas.length < 24) throw new Error('formato');
  // "Otras" junta euros, yenes, otras monedas y la deuda en pago diferido o pendiente de reestructuración (lo que falta para el total)
  const otras = total.map((t, i) => t - mon.pesos[i] - mon.cer[i] - mon.dolares[i] - mon.fmi[i]);
  return { fechas: a1.fechas, total, pesos: mon.pesos, cer: mon.cer, dolares: mon.dolares, fmi: mon.fmi, otras };
}
async function fiscal(req, res) {
  const [rImig, rRec, rOf, rPib, rDeu] = await Promise.allSettled([
    csvGob('452/distribution/452.3/download/imig-mensual.csv'),
    csvGob('172/distribution/172.3/download/recaudacion-tributaria-datos-mensuales.csv'),
    planillaHacienda(),
    pibCorriente(),
    deudaTesoro(),
  ]);
  const out = { fuente: 'Secretaría de Hacienda (base caja del Sector Público Nacional no financiero y recaudación tributaria)' };
  if (rImig.status === 'fulfilled') {
    const d = rImig.value, idx = c => d.cab.indexOf(c);
    const suma = (f, grupo) => Object.fromEntries(Object.entries(grupo).map(([k, cols]) => [k, Math.round(d.cab.reduce((a, c, i) => a + (cols.some(x => (x.endsWith('_') ? c.startsWith(x) : c === x)) && Number.isFinite(f[i]) ? f[i] : 0), 0))]));
    const [iRP, iInt, iRF] = [idx('resultado_primario'), idx('intereses_netos'), idx('resultado_financiero')];
    if (iRP > 0 && iInt > 0 && iRF > 0) {
      const serie = d.filas.filter(f => f[0] >= '2017-01' && Number.isFinite(f[iRP])).map(f => {
        const ing = suma(f, IMIG_ING), gas = suma(f, IMIG_GAS), ingresos = Object.values(ing).reduce((a, b) => a + b, 0);
        return { p: f[0], ingresos, gastos: Object.values(gas).reduce((a, b) => a + b, 0), primario: Math.round(f[iRP]), intereses: Math.round(f[iInt]), financiero: Math.round(f[iRF]), ing, gas };
      });
      // Control: ingresos menos gastos tiene que dar el resultado primario publicado
      if (serie.length > 24 && serie.every(x => Math.abs(x.ingresos - x.gastos - x.primario) < 50)) out.mensual = serie;
    }
  }
  if (rOf.status === 'fulfilled' && rOf.value && out.mensual) {
    const o = rOf.value, u = out.mensual.at(-1);
    if (o.p > u.p) out.mensual.push({ p: o.p, ingresos: Math.round(o.ingresos), gastos: Math.round(o.gastos), primario: Math.round(o.primario), intereses: Math.round(o.intereses), financiero: Math.round(o.financiero), planilla: true });
    out.planilla = o.planilla;
  }
  if (rRec.status === 'fulfilled') {
    const d = rRec.value, K = { total: 'total_recaudacion', dgi: 'subtotal_dgi', aduana: 'subtotal_dga', segSocial: 'seguridad_social' };
    const idx = Object.fromEntries(Object.entries(K).map(([k, c]) => [k, d.cab.indexOf(c)]));
    if (Object.values(idx).every(i => i > 0)) {
      const s = d.filas.filter(f => f[0] >= '2016-01' && f[idx.total] > 0).map(f => Object.assign({ p: f[0] }, Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, Math.round(f[i])]))));
      if (s.length > 24) out.recaudacion = s;
    }
  }
  if (rPib.status === 'fulfilled' && rPib.value.length > 40) out.pib = rPib.value;
  if (rDeu.status === 'fulfilled') out.deuda = rDeu.value;
  if (!out.mensual && !out.recaudacion) return res.status(502).json({ error: 'No se pudieron leer las cuentas fiscales' });
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
  return res.status(200).json(out);
}

// ?sectores=1: indicadores de actividad de cada sector, del portal de datos abiertos (INDEC, Ministerio de Economía,
// BCRA, cámaras). Los montos en pesos se pasan a pesos del último mes con el IPC del INDEC.
const SECTORES = {
  ipi: '453.1_SERIE_ORIGNAL_0_0_14_46', vehiculos: '453.2_VEHICULOS_RES_0_0_21_54', acero: '359.3_ACERO_CRUDUDO__11',
  capacidad: '31.3_UNG_2004_M_18', molienda: '453.2_MOLIENDA_OSAS_0_0_20_8', isac: '33.2_ISAC_NIVELRAL_0_M_18_63',
  cemento: '38.3_CEM_1994_M_7', super: '455.1_VENTAS_PRENAL_0_M_34_10', mayoristas: '456.1_VENTAS_PRENAL_0_M_34_85',
  shoppings: '458.1_VENTAS_TOTNAL_0_M_42_19', autosA: '330.3_VENTAS_MERLES__34', autosU: '330.3_VENTAS_MERIOS__34',
  confianza: '380.3_ICC_NACIONNAL_0_T_12', electricidad: '302.3_ELEC_GAS_AGWH_0_S_35', gas: '41.3_GN_0_A_11',
  peajes: '302.3_PEAJES_RUTC_U_0_S_18', servicios: '302.3_S_ORIGINALRAL_0_S_21', agro: '349.2_ACUM_MENSUAL__13',
  faena: '40.3_VC_0_M_15', iva: '142.3_IVA_D_2001_M_7', cheque: '142.3_CREDI_2001_M_24', ivaAduana: '142.3_IVA_DA_2001_M_7',
  prestConsumo: '91.1_DETALLE_PREND_0_0_33', prestComerciales: '91.1_PRESTAMOS_LES_0_0_37', prestHipotecarios: '91.1_DETALLE_PRPOT_0_0_53',
  ipcPortal: '148.3_INIVELNAL_DICI_M_26',
};
const EN_PESOS = ['iva', 'cheque', 'ivaAduana', 'prestConsumo', 'prestComerciales', 'prestHipotecarios'];
// Supermercados, autoservicios mayoristas, centros de compras y capacidad instalada salen semanas antes en los archivos del INDEC
// que en el portal: se leen de ahí (los nombres de dos archivos cambian con cada informe y se buscan en la página del tema).
const planillaIndec = async (ruta, tema) => {
  if (!ruta) {
    const pag = await fetch(INDEC + tema.pagina, { signal: AbortSignal.timeout(10000), headers: UA }).then(r => (r.ok ? r.text() : ''));
    ruta = (pag.match(tema.re) || [])[0];
    if (!ruta) throw new Error('sin archivo');
  }
  const x = await fetch(INDEC + ruta, { signal: AbortSignal.timeout(15000), headers: UA });
  if (!x.ok) throw new Error('archivo');
  const buf = Buffer.from(await x.arrayBuffer());
  return buf[0] === 0x50 ? leerXlsx(buf) : leerXls(buf);   // "PK": .xlsx; si no, .xls
};
// Cuadro 1 de las encuestas de comercio: fecha de Excel y el índice de ventas a precios constantes, serie original
const ventasIndec = H => {
  const f = (H.find(h => /cuadro\s*(web_)?1\.?$/i.test(h.nombre.trim())) || {}).filas || [];
  if (!f.some(r => r && /precios constantes/i.test(String(r[0] || ''))) || !f.some(r => r && /Serie original/i.test(String(r[1] || '')))) throw new Error('formato');
  return f.filter(r => r && typeof r[0] === 'number' && r[0] > 40000 && Number.isFinite(r[1])).map(r => [fechaExcel(r[0]).slice(0, 7), r[1]]);
};
// Capacidad instalada: filas "Año 2026" y después un mes por fila, con el nivel general en la segunda columna
const capacidadIndec = H => {
  let anio = null; const out = [];
  for (const r of (H[0] && H[0].filas) || []) {
    if (!r) continue;
    const a = String(r[0] ?? '').match(/^Año (\d{4})/); if (a) { anio = a[1]; continue; }
    const m = MESES_ES.indexOf(String(r[0] ?? '').replace(/[^a-záéíóú]/gi, '').toLowerCase());
    if (anio && m >= 0 && Number.isFinite(r[1])) out.push([anio + '-' + String(m + 1).padStart(2, '0'), r[1]]);
  }
  if (out.length < 24) throw new Error('formato');
  return out;
};
async function ultimosIndec() {
  const [sup, may, cc, uc] = await Promise.allSettled([
    planillaIndec('/ftp/cuadros/economia/serie_supermercados.xlsx').then(ventasIndec),
    planillaIndec('/ftp/cuadros/economia/serie_autoservicios_mayoristas.xlsx').then(ventasIndec),
    planillaIndec(null, { pagina: '/Nivel4/Tema/3/1/36', re: /\/ftp\/cuadros\/economia\/sh_compras_\d{2}_\d{2}\.xls/ }).then(ventasIndec),
    planillaIndec(null, { pagina: '/Nivel4/Tema/3/6/15', re: /\/ftp\/cuadros\/economia\/sh_capacidad_\d{2}_\d{2}\.xls/ }).then(capacidadIndec),
  ]);
  const ok = r => (r.status === 'fulfilled' ? r.value : []);
  return { super: ok(sup), mayoristas: ok(may), shoppings: ok(cc), capacidad: ok(uc) };
}
async function sectores(req, res) {
  try {
    const ids = Object.values(SECTORES), grupos = [];
    for (let i = 0; i < ids.length; i += 10) grupos.push(ids.slice(i, i + 10));
    const [rCsv, rInd, ...rs] = await Promise.allSettled([
      fetch(INDEC + '/ftp/cuadros/economia/serie_ipc_divisiones.csv', { signal: AbortSignal.timeout(15000), headers: UA }).then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer(); }),
      ultimosIndec(),
      ...grupos.map(g => fetch('https://apis.datos.gob.ar/series/api/series/?format=json&limit=1000&start_date=2017-01-01&ids=' + g.join(','), { signal: AbortSignal.timeout(15000) })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })),
    ]);
    const col = {};
    rs.forEach((r, n) => { if (r.status === 'fulfilled') grupos[n].forEach((id, k) => { col[id] = r.value.data.filter(f => Number.isFinite(f[k + 1])).map(f => [f[0].slice(0, 7), f[k + 1]]); }); });
    const s = Object.fromEntries(Object.entries(SECTORES).map(([k, id]) => [k, col[id] || []]));
    // Encima del portal, lo que ya publicó el INDEC en sus archivos (mismos valores y los meses que al portal le faltan)
    if (rInd.status === 'fulfilled') for (const [k, filas] of Object.entries(rInd.value)) {
      if (!filas.length) continue;
      const m = Object.fromEntries(s[k]); for (const [p, v] of filas) if (p >= '2017-01') m[p] = v;
      s[k] = Object.entries(m).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    }
    // IPC: el portal y, encima, el archivo del INDEC (que trae el último mes antes que el portal)
    const ipc = Object.fromEntries(s.ipcPortal);
    if (rCsv.status === 'fulfilled') for (const linea of new TextDecoder('latin1').decode(rCsv.value).split(/\r?\n/)) {
      const c = linea.split(';');
      if (c[0] === '0' && /^\d{6}$/.test(c[3]) && c[7] && c[7].trim() === 'Nacional') { const v = parseFloat(String(c[4]).replace(',', '.')); if (Number.isFinite(v)) ipc[c[3].slice(0, 4) + '-' + c[3].slice(4)] = v; }
    }
    const ipcHasta = Object.keys(ipc).sort().at(-1);
    for (const k of EN_PESOS) s[k] = s[k].filter(([p]) => ipc[p]).map(([p, v]) => [p, v * ipc[ipcHasta] / ipc[p]]);
    // Autos: automóviles más utilitarios, solo los meses con los dos datos
    const u = Object.fromEntries(s.autosU);
    s.autos = s.autosA.filter(([p]) => u[p] != null).map(([p, v]) => [p, v + u[p]]);
    delete s.autosA; delete s.autosU; delete s.ipcPortal;
    const r4 = v => Number(v.toPrecision(5));
    const series = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.map(([p, x]) => [p, r4(x)])]));
    if (Object.values(series).filter(v => v.length > 24).length < 15) throw new Error('pocas series');
    // Los identificadores van para el enlace de descarga de cada serie
    const { autosA, autosU, ipcPortal, ...idsSerie } = SECTORES;
    idsSerie.autos = autosA + ',' + autosU;
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
    return res.status(200).json({ actualizado: new Date().toISOString(), ipcHasta, ids: idsSerie, series });
  } catch {
    return res.status(502).json({ error: 'No se pudieron leer los indicadores sectoriales' });
  }
}

// ?presupuesto=1: el presupuesto de la Administración Nacional del año y cuánto se gastó, de Presupuesto Abierto.
// El archivo anual se actualiza todos los días; en enero, hasta que aparece el del año nuevo, se usa el anterior.
const PRESU = a => 'https://dgsiaf-repo.mecon.gob.ar/repository/pa/datasets/' + a + '/credito-anual-' + a + '.zip';
// CSV del crédito anual → totales por finalidad, función, jurisdicción e inciso: [presupuestado, vigente, devengado] en millones
export function agregarPresupuesto(texto) {
  const L = texto.replace(/^﻿/, '').split(/\r?\n/), cab = L[0].split(',');
  const K = ['finalidad_desc', 'funcion_desc', 'jurisdiccion_desc', 'inciso_desc', 'credito_presupuestado', 'credito_vigente', 'credito_devengado', 'ultima_actualizacion_fecha'].map(n => cab.indexOf(n));
  if (K.some(i => i < 0)) throw new Error('columnas');
  // Los montos vienen entre comillas y con coma decimal: "112314,62"
  const campos = l => { if (!l.includes('"')) return l.split(','); const o = []; let c = '', q = false;
    for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"') { if (l[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = ''; } else c += ch; }
    o.push(c); return o; };
  const n = x => parseFloat(String(x).replace(',', '.')) || 0;
  const out = { total: [0, 0, 0], fin: {}, fun: {}, jur: {}, inc: {} }, sumar = (o, k, v) => { const a = o[k] = o[k] || [0, 0, 0]; v.forEach((x, i) => (a[i] += x)); };
  let fecha = '';
  for (let i = 1; i < L.length; i++) {
    if (!L[i]) continue;
    const c = campos(L[i]), v = [n(c[K[4]]), n(c[K[5]]), n(c[K[6]])];
    sumar(out, 'total', v); sumar(out.fin, c[K[0]], v); sumar(out.fun, c[K[0]] + '|' + c[K[1]], v); sumar(out.jur, c[K[2]], v); sumar(out.inc, c[K[3]], v);
    fecha = c[K[7]] || fecha;
  }
  const r = a => a.map(x => Math.round(x));
  out.total = r(out.total); for (const g of ['fin', 'fun', 'jur', 'inc']) for (const k in out[g]) out[g][k] = r(out[g][k]);
  out.fecha = (fecha.match(/(\d{1,2} \w+ \d{4})/) || [])[1] || '';
  return out;
}
async function presupuesto(req, res) {
  try {
    let anio = new Date().getUTCFullYear(), r = await fetch(PRESU(anio), { signal: AbortSignal.timeout(20000), headers: UA });
    if (r.status === 404) { anio--; r = await fetch(PRESU(anio), { signal: AbortSignal.timeout(20000), headers: UA }); }
    if (!r.ok) throw new Error();
    const zip = archivos(Buffer.from(await r.arrayBuffer()), 400e6), nombre = Object.keys(zip).find(x => /\.csv$/i.test(x));
    const d = agregarPresupuesto(zip[nombre]().toString('utf8'));
    if (!(d.total[1] > 0)) throw new Error('vacío');
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=604800');
    return res.status(200).json({ anio, ...d });
  } catch {
    return res.status(502).json({ error: 'No se pudo leer el presupuesto' });
  }
}

// ?energia=1: petróleo y gas (convencional y no convencional), litio, oro y plata del IPI minero del INDEC,
// (el comercio exterior de energía sale de ?comercio=1).
async function energia(req, res) {
  try {
    const r0 = await fetch(INDEC + '/ftp/cuadros/economia/serie_ipi_minero.xlsx', { signal: AbortSignal.timeout(15000), headers: UA });
    if (!r0.ok) throw new Error();
    const rx = await r0.arrayBuffer();
    const H = Object.fromEntries(leerXlsx(Buffer.from(rx)).map(h => [h.nombre, h.filas]));
    // Filas [n, año (solo en enero, a veces con asterisco), mes, valores...]
    const filas = (hoja, cols) => { let anio = null; const out = [];
      for (const f of H[hoja] || []) {
        if (!f || typeof f[2] !== 'string') continue;
        const a = parseInt(String(f[1] ?? ''), 10); if (a > 2000) anio = a;
        const m = MESES_ES.indexOf(f[2].replace(/[^a-záéíóú]/gi, '').toLowerCase());
        if (!anio || m < 0) continue;
        const v = cols.map(c => num(typeof f[c] === 'number' ? f[c] : NaN));
        if (v.every(x => x == null)) continue;
        out.push([anio + '-' + String(m + 1).padStart(2, '0'), ...v.map(x => (x == null ? null : Number(x.toPrecision(6))))]);
      }
      return out; };
    const petroleo = filas('Cuadro 5', [3, 4, 5]), gas = filas('Cuadro 6', [3, 4, 5]);
    if (petroleo.length < 60 || gas.length < 60) throw new Error('pocos datos');
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
    return res.status(200).json({ fuente: 'INDEC, Índice de producción industrial minero', url: INDEC + '/ftp/cuadros/economia/serie_ipi_minero.xlsx',
      petroleo, gas, litio: filas('Cuadro 7', [3]), ipi: filas('Cuadro 1', [3, 7]), oroPlata: filas('Cuadro 2', [9]) });
  } catch {
    return res.status(502).json({ error: 'No se pudieron leer los datos de energía y minería' });
  }
}

// ?cambiario=1: balance cambiario del BCRA (dólares que entran y salen por el mercado de cambios), del portal de datos abiertos.
// Algunas series del portal vienen vacías (cobros y pagos por separado, FMI total, variación de reservas): se usan los netos.
const CAMBIARIO = {
  bienes: '182.1_CUENTA_CORNES_0_M_39', servicios: '182.1_CUENTA_CORIOS_0_M_42', intereses: '182.1_CUENTA_CORSES_0_M_59',
  utilidades: '182.1_C_CORR_INGTAS_0_M_57', secundario: '182.1_CUENTA_CORRIO_0_M_51', cuentaCorriente: '182.1_TOTAL_CUENRIA_0_M_32',
  fae: '182.1_C_K_FINC_CINC_0_M_56', deuda: '182.1_C_K_FINC_CRED_0_M_52', directa: '182.1_C_K_FINANCTES_0_M_51', cartera: '182.1_C_K_FINC_CTES_0_M_50',
  organismos: '182.1_C_K_FINC_CLAT_0_M_55', fmiIn: '182.1_C_CAP_FINAFMI_0_M_50', fmiOut: '182.1_C_CAP_FINAFMI_0_M_49', financiera: '182.1_TOTAL_CUENRIA_0_M_41',
};
async function cambiario(req, res) {
  try {
    const ids = Object.values(CAMBIARIO), grupos = [];
    for (let i = 0; i < ids.length; i += 10) grupos.push(ids.slice(i, i + 10));
    const rs = await Promise.all(grupos.map(g => fetch('https://apis.datos.gob.ar/series/api/series/?format=json&limit=1000&start_date=2017-01-01&ids=' + g.join(','), { signal: AbortSignal.timeout(15000) })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })));
    const col = {};
    rs.forEach((r, n) => grupos[n].forEach((id, k) => { col[id] = r.data.filter(f => Number.isFinite(f[k + 1])).map(f => [f[0].slice(0, 7), Number(f[k + 1].toFixed(1))]); }));
    const series = Object.fromEntries(Object.entries(CAMBIARIO).map(([k, id]) => [k, col[id] || []]));
    if (series.cuentaCorriente.length < 24 || series.financiera.length < 24) throw new Error('pocos datos');
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
    return res.status(200).json({ fuente: 'BCRA, Balance cambiario, vía datos.gob.ar', series });
  } catch {
    return res.status(502).json({ error: 'No se pudo leer el balance cambiario' });
  }
}

// ?trabajo=1: puestos de trabajo registrados, no registrados y no asalariados por actividad (cuentas nacionales del INDEC),
// asalariados sin descuento jubilatorio y coeficiente de Gini (EPH), sueldo promedio y mediano del sector privado (SIPA)
// y personal del Estado nacional (INDEC, dotación de la APN, empresas y sociedades).
const ACTIVIDADES = { a: 'Agro', b: 'Pesca', c: 'Minería y petróleo', d: 'Industria', e: 'Electricidad, gas y agua', f: 'Construcción', g: 'Comercio', h: 'Hoteles y restaurantes',
  i: 'Transporte y comunicaciones', j: 'Bancos y seguros', k: 'Inmobiliarias y servicios a empresas', l: 'Administración pública', m: 'Enseñanza', n: 'Salud y servicios sociales', o: 'Otros servicios', p: 'Casas particulares' };
const ESTADO = { total: 'Total', apn: 'Administración pública nacional', central: 'Administración centralizada', descentral: 'Administración descentralizada', desconcentrada: 'Administración desconcentrada', otros: 'Otros entes', empresas: 'Empresas y sociedades' };
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
async function trabajo(req, res) {
  const serie = ids => fetch('https://apis.datos.gob.ar/series/api/series/?format=json&limit=1000&start_date=2016-01-01&ids=' + ids, { signal: AbortSignal.timeout(15000) })
    .then(r => { if (!r.ok) throw new Error(); return r.json(); });
  const [rCgi, rEph, rSue, rEst, rGini] = await Promise.allSettled([
    csvGob('324/distribution/324.1/download/insumo-de-mano-de-obra-por-sector-de-actividad-economica-datos-trimestrales.csv'),
    serie('52.2_ASDJ_0_0_37,65.1_CGI_0_0_21'),
    serie('153.1_RNERACIDIO_2009_M_21,153.1_RNERACIANA_2009_M_20'),
    fetch(INDEC + '/ftp/cuadros/economia/serie_dotacion_apn.xlsx', { signal: AbortSignal.timeout(15000), headers: UA }).then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer(); }),
    planillaIndec('/ftp/cuadros/sociedad/serie_coeficiente_gini.xlsx'),
  ]);
  const out = { fuente: 'INDEC (cuentas nacionales, EPH y dotación de la APN) y Secretaría de Trabajo (SIPA), vía datos.gob.ar' };
  const r1 = v => (v == null ? null : Math.round(v * 10) / 10);

  // Puestos de trabajo por actividad (miles, trimestral): total, asalariados registrados, no registrados y no asalariados
  if (rCgi.status === 'fulfilled') {
    const d = rCgi.value, cols = (re, letra) => d.cab.findIndex(c => c.startsWith(letra + '_') && re.test(c));
    const tomar = i => (i > 0 ? d.filas.map(f => r1(f[i])) : null);
    const grupo = letra => ({ total: tomar(cols(/_puestos?_trabajo$/, letra)), noreg: tomar(cols(/no_reg$/, letra)), reg: tomar(cols(/asal(ariado)?_reg(istrado)?$/, letra)), noasal: tomar(cols(/no_asal$/, letra)) });
    const tot = { total: tomar(d.cab.indexOf('total_general_puestos_trabajo')), reg: tomar(d.cab.indexOf('total_general_puestos_trabajo_asalariado_registrado')),
      noreg: tomar(d.cab.indexOf('total_general_asalariados_no_reg')), noasal: tomar(d.cab.indexOf('total_general_puestos_trab_no_asal')), publico: tomar(d.cab.indexOf('total_sector_publico_puestos_trabajo')) };
    const act = Object.entries(ACTIVIDADES).map(([k, n]) => Object.assign({ k, n }, grupo(k)));
    if (Object.values(tot).every(Boolean) && act.every(a => a.total && a.reg) && d.filas.length > 12 && tot.total.at(-1) > 10000) out.puestos = { p: d.filas.map(f => f[0]), ...tot, actividades: act };
  }
  // EPH: asalariados sin descuento jubilatorio (%) y Gini del ingreso per cápita familiar (trimestral)
  if (rEph.status === 'fulfilled') {
    const d = rEph.value.data || [], col = k => d.filter(f => Number.isFinite(f[k])).map(f => [f[0].slice(0, 7), Math.round(f[k] * (k === 1 ? 1000 : 10000)) / (k === 1 ? 10 : 10000)]);
    const inf = col(1), gini = col(2);
    if (inf.length > 8 && inf.at(-1)[1] < 80) out.informalidad = inf;
    if (gini.length > 8 && gini.at(-1)[1] < 1) out.gini = gini;
  }
  // Gini del archivo del INDEC, que trae el trimestre nuevo semanas antes que el portal: filas con el año (solo en el
  // primer trimestre) y "2° trim", desde la EPH continua
  if (rGini.status === 'fulfilled') {
    let anio = null; const M = Object.fromEntries(out.gini || []);
    for (const f of (rGini.value[0] && rGini.value[0].filas) || []) {
      if (!f) continue;
      if (typeof f[0] === 'number' && f[0] > 2000) anio = f[0];
      const q = String(f[1] ?? '').match(/^(\d)\s*°\s*trim/i);
      if (anio >= 2003 && q && Number.isFinite(f[2]) && f[2] > 0 && f[2] < 1) M[anio + '-' + ['01', '04', '07', '10'][q[1] - 1]] = f[2];
    }
    const g = Object.entries(M).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    if (g.length > 8) out.gini = g;
  }
  // Sueldo bruto promedio y mediano de los asalariados privados registrados (mensual, en pesos; junio y diciembre incluyen aguinaldo)
  if (rSue.status === 'fulfilled') {
    const s = (rSue.value.data || []).filter(f => f[1] > 0 && f[2] > 0).map(f => [f[0].slice(0, 7), Math.round(f[1]), Math.round(f[2])]);
    if (s.length > 24) out.sueldos = s;
  }
  // Personal del Estado nacional (personas, mensual desde julio de 2022). Las fechas vienen como número de Excel o como "nov-22 (i)" (con datos imputados)
  if (rEst.status === 'fulfilled') {
    try {
      const h = leerXlsx(Buffer.from(rEst.value))[0].filas, cab = h.find(f => f && typeof f[1] === 'number' && f[1] > 40000 && f[1] < 80000);
      const fecha = v => { if (typeof v === 'number') return fechaExcel(v).slice(0, 7); const m = String(v || '').match(/^([a-z]{3})[a-z]*-(\d{2})/i); const i = m ? MES_CORTO.indexOf(m[1].toLowerCase()) : -1; return i < 0 ? null : '20' + m[2] + '-' + String(i + 1).padStart(2, '0'); };
      const cols = cab.map((v, i) => [i, fecha(v)]).filter(x => x[0] > 0 && x[1]);
      const filas = Object.fromEntries(Object.entries(ESTADO).map(([k, t]) => { const f = h.find(x => x && String(x[0] || '').trim() === t); return [k, f ? cols.map(([i]) => (typeof f[i] === 'number' ? f[i] : null)) : null]; }));
      if (Object.values(filas).every(Boolean) && cols.length > 24 && filas.total.at(-1) > 100000) out.estado = { fechas: cols.map(x => x[1]), ...filas };
    } catch { /* planilla con otro formato: se omite */ }
  }
  if (!out.puestos && !out.informalidad && !out.estado) return res.status(502).json({ error: 'No se pudieron leer los datos del trabajo' });
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
  return res.status(200).json(out);
}

// ?icc=1: Índice de Confianza del Consumidor de la Universidad Torcuato Di Tella (nacional, por tema y por región).
// Se lee la planilla de la UTDT, que tiene el mes recién publicado (el nombre del archivo cambia: se busca en su página);
// si no contesta o cambia el formato, el portal de datos abiertos, que lo carga un mes después.
const ICC_COLS = { icc: 'icc_nacional', capital: 'desagregacion_regiones_capital', interior: 'desagregacion_regiones_interior', gba: 'desagregacion_regiones_gba',
  personal: 'desagregacion_subindices_situacion_personal', macro: 'desagregacion_subindices_situacion_macro', durables: 'desagregacion_subindices_bienes_durables_inmuebles' };
async function iccUtdt() {
  const pag = await fetch('https://www.utdt.edu/listado_contenidos.php?id_item_menu=16458', { signal: AbortSignal.timeout(10000), headers: UA }).then(r => (r.ok ? r.text() : ''));
  const ruta = (pag.match(/\/download\.php\?fname=_\d+\.xls\b/) || [])[0];
  if (!ruta) throw new Error('sin archivo');
  const x = await fetch('https://www.utdt.edu' + ruta, { signal: AbortSignal.timeout(15000), headers: UA });
  if (!x.ok) throw new Error('archivo');
  const H = leerXls(Buffer.from(await x.arrayBuffer())), hoja = re => (H.find(h => re.test(h.nombre)) || {}).filas || [];
  const reg = hoja(/regiones/i), sub = hoja(/sub.ndices/i), txt = v => String(v ?? '').trim();
  // Columnas esperadas: fecha, Capital, var., Interior, var., GBA, var., Nacional | fecha, Personal, var., Macro, var., Durables, var., Nacional
  if (!reg.some(f => f && txt(f[1]) === 'Capital' && txt(f[3]) === 'Interior' && txt(f[5]) === 'GBA') || !sub.some(f => f && /Personal/i.test(txt(f[1])) && /Macro/i.test(txt(f[3])) && /Durables/i.test(txt(f[5])))) throw new Error('formato');
  // Algunas filas traen la fecha como texto ("abr.-22") o vacía: como son meses seguidos, la fecha sale del orden
  // y se corrige con cada fecha de Excel que aparece
  const r2 = v => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null), sig = p => { const [y, m] = p.split('-').map(Number); return m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0'); };
  const meses = filas => { const out = []; let p = null;
    for (const f of filas) {
      if (!f || !Number.isFinite(f[7])) continue;
      p = typeof f[0] === 'number' && f[0] > 30000 ? fechaExcel(f[0]).slice(0, 7) : p && sig(p);
      if (p) out.push([p, f]);
    }
    return out; };
  const M = {};
  for (const [p, f] of meses(reg)) M[p] = { p, icc: r2(f[7]), capital: r2(f[1]), interior: r2(f[3]), gba: r2(f[5]) };
  for (const [p, f] of meses(sub)) if (M[p]) Object.assign(M[p], { personal: r2(f[1]), macro: r2(f[3]), durables: r2(f[5]) });
  return Object.values(M).sort((a, b) => (a.p < b.p ? -1 : 1));
}
async function icc(req, res) {
  let serie = [], fuente = 'Universidad Torcuato Di Tella, Centro de Investigación en Finanzas';
  try { serie = await iccUtdt(); } catch { /* se prueba con el portal */ }
  if (serie.length < 60) {
    try {
      const d = await csvGob('380/distribution/380.3/download/indice-confianza-consumidor-valores-mensuales.csv'), idx = Object.fromEntries(Object.entries(ICC_COLS).map(([k, c]) => [k, d.cab.indexOf(c)]));
      if (Object.values(idx).every(i => i > 0)) {
        serie = d.filas.filter(f => Number.isFinite(f[idx.icc])).map(f => Object.assign({ p: f[0] }, Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, Number.isFinite(f[i]) ? Math.round(f[i] * 100) / 100 : null]))));
        fuente += ', vía datos.gob.ar';
      }
    } catch { /* sin datos */ }
  }
  serie = serie.filter(x => x.p >= '2010-01');
  if (serie.length < 60 || !(serie.at(-1).icc > 0 && serie.at(-1).icc < 100)) return res.status(502).json({ error: 'No se pudo leer la confianza del consumidor' });
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
  return res.status(200).json({ fuente, serie });
}

// ?otrosprecios=1: precios mayoristas (IPIM) y costo de la construcción (ICC) de los CSV del INDEC, que se actualizan el día del informe
const IPIM = { general: /^ng_/, primarios: /^1_primarios/, manufacturados: /^2_industria/, importados: /^i_productos_importados/ };
const ICC_CONS = { general: 'nivel_general', materiales: 'materiales', manoDeObra: 'mano_de_obra', gastos: 'gastos_generales' };
async function otrosPrecios(req, res) {
  const csv = f => fetch(INDEC + '/ftp/cuadros/economia/' + f, { signal: AbortSignal.timeout(15000), headers: UA }).then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer(); })
    .then(b => new TextDecoder('latin1').decode(b).split(/\r?\n/).slice(1).map(l => l.split(';')).filter(c => c.length >= 3));
  const [rIpim, rIcc] = await Promise.allSettled([csv('indice_ipim.csv'), csv('indice_icc_general_capitulos.csv')]);
  const n = v => { const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? Number(x.toPrecision(7)) : null; };
  const out = { fuente: 'INDEC, Sistema de índices de precios mayoristas e Índice del costo de la construcción' };
  if (rIpim.status === 'fulfilled') {
    // Filas "2026-09-01;ng_nivel_general;17104,02"
    const m = Object.fromEntries(Object.entries(IPIM).map(([k, re]) => [k, rIpim.value.filter(c => re.test(c[1]) && /^\d{4}-\d{2}-01$/.test(c[0]) && n(c[2])).map(c => [c[0].slice(0, 7), n(c[2])])]));
    if (m.general.length > 24 && Object.values(m).every(s => s.length > 24)) out.mayoristas = m;
  }
  if (rIcc.status === 'fulfilled') {
    // Filas "1/9/2026;nivel_general;1779,72" (día/mes/año)
    const per = f => { const x = String(f).match(/^\d{1,2}\/(\d{1,2})\/(\d{4})$/); return x ? x[2] + '-' + x[1].padStart(2, '0') : null; };
    const m = Object.fromEntries(Object.entries(ICC_CONS).map(([k, c]) => [k, rIcc.value.filter(r => r[1] === c && per(r[0]) && n(r[2])).map(r => [per(r[0]), n(r[2])]).sort((a, b) => (a[0] < b[0] ? -1 : 1))]));
    if (m.general.length > 12 && Object.values(m).every(s => s.length > 12)) out.construccion = m;
  }
  if (!out.mayoristas && !out.construccion) return res.status(502).json({ error: 'No se pudieron leer los precios mayoristas ni la construcción' });
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
  return res.status(200).json(out);
}

// ?externo=1: turismo internacional (llegadas y salidas de turistas, mensual) y balanza de pagos (trimestral) del INDEC.
// El archivo de la balanza de pagos cambia de nombre cada trimestre (cin_II_2026.xls): se busca en la página del tema.
const BOP_FILAS = { cuentaCorriente: /^1\.\s*Cuenta corriente/, bienes: /^1\.A\.a\s*Bienes/, servicios: /^1\.A\.b\s*Servicios/, primario: /^1\.B\.?\s*Ingreso primario/,
  secundario: /^1\.C\.?\s*Ingreso secundario/, financiera: /^3\.\s*Cuenta financiera/, directa: /^3\.1\s*Inversión directa/, reservas: /^3\.5\s*Activos de reserva/, errores: /^Errores y omisiones/ };
async function externo(req, res) {
  const [rTur, rBop] = await Promise.allSettled([
    planillaIndec('/ftp/cuadros/economia/serie_turismo_receptivo_emisivo.xlsx'),
    planillaIndec(null, { pagina: '/Nivel4/Tema/3/35/45', re: /\/ftp\/cuadros\/economia\/cin_[IV]+_\d{4}\.xls/ }),
  ]);
  const out = { fuente: 'INDEC, Estadísticas de turismo internacional y Balanza de pagos' };
  if (rTur.status === 'fulfilled') {
    const f = (rTur.value[0] && rTur.value[0].filas) || [];
    if (f.some(r => r && /receptivo/i.test(String(r[1] || '')) && /emisivo/i.test(String(r[2] || '')))) {
      const s = f.filter(r => r && typeof r[0] === 'number' && r[0] > 40000 && Number.isFinite(r[1]) && Number.isFinite(r[2])).map(r => [fechaExcel(r[0]).slice(0, 7), Math.round(r[1]), Math.round(r[2])]);
      if (s.length > 24) out.turismo = s;
    }
  }
  if (rBop.status === 'fulfilled') {
    const f = ((rBop.value.find(h => /^cuadro 1$/i.test(h.nombre.trim())) || {}).filas) || [];
    const cab = f.find(r => r && r.filter(v => /^\d{4}T[1-4]/.test(String(v || ''))).length > 8) || [];
    const cols = cab.map((v, i) => [i, (String(v || '').match(/^(\d{4})T([1-4])/) || [])]).filter(c => c[1].length).map(([i, m]) => [i, m[1] + '-Q' + m[2]]);
    const txt = v => String(v ?? '').replace(/\s+/g, ' ').trim();
    const filas = Object.fromEntries(Object.entries(BOP_FILAS).map(([k, re]) => { const r = f.find(x => x && re.test(txt(x[0]))); return [k, r ? cols.map(([i]) => (Number.isFinite(r[i]) ? Math.round(r[i]) : null)) : null]; }));
    // Control: la cuenta corriente tiene que ser la suma de sus cuatro partes
    const cc = filas.cuentaCorriente, suma = i => filas.bienes[i] + filas.servicios[i] + filas.primario[i] + filas.secundario[i];
    if (Object.values(filas).every(Boolean) && cols.length > 20 && cc.every((v, i) => v == null || Math.abs(v - suma(i)) < 5)) out.balanza = { trimestres: cols.map(c => c[1]), ...filas };
  }
  if (!out.turismo && !out.balanza) return res.status(502).json({ error: 'No se pudieron leer el turismo ni la balanza de pagos' });
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
  return res.status(200).json(out);
}

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;
  if (await denyRateLimited(req, res, { limit: 60, windowSecs: 60, key: 'indec' })) return;
  if (req.query.comercio) return comercio(req, res);
  if (req.query.fiscal) return fiscal(req, res);
  if (req.query.salarios) return salarios(req, res);
  if (req.query.empleo) return empleo(req, res);
  if (req.query.ipc) return ipc(req, res);
  if (req.query.emae) return emae(req, res);
  if (req.query.canasta) return canasta(req, res);
  if (req.query.pobreza) return pobreza(req, res);
  if (req.query.calendario) return calendario(req, res);
  if (req.query.sectores) return sectores(req, res);
  if (req.query.presupuesto) return presupuesto(req, res);
  if (req.query.energia) return energia(req, res);
  if (req.query.cambiario) return cambiario(req, res);
  if (req.query.trabajo) return trabajo(req, res);
  if (req.query.icc) return icc(req, res);
  if (req.query.otrosprecios) return otrosPrecios(req, res);
  if (req.query.externo) return externo(req, res);
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
