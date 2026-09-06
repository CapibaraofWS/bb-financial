// ============================================================
// GENERA data/ipc-argentina.json
//
//   node scripts/gen-ipc.mjs
//
// Arma el indice de precios al consumidor con base diciembre 2016 = 100:
//
//   - Desde 2016-12 usa los niveles oficiales del INDEC tal cual vienen. Son
//     los unicos con precision suficiente; encadenar variaciones redondeadas a
//     un decimal arrastra un error de centesimas de punto por anio.
//   - Antes de 2016-12 el IPC Nacional no existia, asi que se encadenan hacia
//     atras las variaciones mensuales historicas desde esa base.
//
// La pagina igual pide las variaciones en vivo y agrega los meses que el INDEC
// haya publicado despues, asi que este script solo hace falta cuando cambia
// alguna fuente o para consolidar la serie.
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'data', 'ipc-argentina.json');

const SERIE_INDEC = '148.3_INIVELNAL_DICI_M_26';
const URL_INDEC = `https://apis.datos.gob.ar/series/api/series/?ids=${SERIE_INDEC}&format=json&limit=1000`;
const URL_VARIACIONES = 'https://api.argentinadatos.com/v1/finanzas/indices/inflacion';

const ANCLA = '2016-12';   // base oficial del INDEC

const mes = (m, paso) => {
  let [y, mm] = m.split('-').map(Number);
  mm += paso;
  while (mm < 1) { mm += 12; y--; }
  while (mm > 12) { mm -= 12; y++; }
  return `${y}-${String(mm).padStart(2, '0')}`;
};

async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${url} devolvio ${r.status}`);
  return r.json();
}

const [indecRaw, variacionesRaw] = await Promise.all([json(URL_INDEC), json(URL_VARIACIONES)]);

const oficial = new Map(indecRaw.data.map(([f, v]) => [f.slice(0, 7), v]));
const tasa = new Map(variacionesRaw.map(x => [String(x.fecha).slice(0, 7), x.valor]));

if (oficial.get(ANCLA) !== 100) throw new Error(`El ancla ${ANCLA} deberia valer 100 y vale ${oficial.get(ANCLA)}`);

const indice = new Map(oficial);

// Hacia atras: indice[m-1] = indice[m] / (1 + tasa[m]/100)
const primero = String(variacionesRaw[0].fecha).slice(0, 7);
for (let m = ANCLA; m !== primero; m = mes(m, -1)) {
  const r = tasa.get(m);
  if (r == null) throw new Error(`falta la variacion de ${m}`);
  indice.set(mes(m, -1), indice.get(m) / (1 + r / 100));
}

// Hacia adelante, por si las variaciones traen meses que el INDEC no publico
let ultimo = [...oficial.keys()].sort().pop();
while (Number.isFinite(tasa.get(mes(ultimo, 1)))) {
  indice.set(mes(ultimo, 1), indice.get(ultimo) * (1 + tasa.get(mes(ultimo, 1)) / 100));
  ultimo = mes(ultimo, 1);
}

const claves = [...indice.keys()].sort();
const doc = {
  _doc: 'Indice de precios al consumidor de Argentina, base diciembre 2016 = 100. Generado por scripts/gen-ipc.mjs.',
  base: '2016-12 = 100',
  desde: claves[0],
  hasta: claves[claves.length - 1],
  actualizado: new Date().toISOString().slice(0, 10),
  fuentes: {
    '2016-12 en adelante': `INDEC, IPC Nacional base dic-2016=100, serie ${SERIE_INDEC} del portal de datos abiertos (apis.datos.gob.ar)`,
    'anterior a 2016-12': 'Serie de variaciones mensuales de argentinadatos.com, encadenada hacia atras desde la base del INDEC',
    advertencia: 'ATENCION: entre 2007 y 2015 el INDEC estuvo intervenido y esta serie arrastra sus cifras oficiales, que subestiman la inflacion real (da ~11,6% anual contra ~25% de las estimaciones privadas). Todo calculo que cruce ese tramo queda corto.',
  },
  valores: Object.fromEntries(claves.map(k => [k, Number(indice.get(k).toPrecision(9))])),
};

fs.writeFileSync(SALIDA, JSON.stringify(doc));
console.log(`${claves.length} meses: ${doc.desde} -> ${doc.hasta}`);
console.log(`2024 completo: +${((indice.get('2024-12') / indice.get('2023-12') - 1) * 100).toFixed(2)}%  (INDEC publico 117,8%)`);
