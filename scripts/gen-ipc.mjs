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

// Serie compuesta que enlaza los IPC de CABA, Cordoba y San Luis con el INDEC.
// Sirve para reemplazar el tramo intervenido, donde la oficial no es creible.
// Solo la usamos hasta 2016-11: de ahi en adelante mandan los datos del INDEC,
// y ademas el repo proyecta sus ultimos meses en vez de observarlos.
const URL_COMBINADA = 'https://raw.githubusercontent.com/matuteiglesias/IPC-Argentina/master/data/info/indice_precios_M.csv';

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

async function texto(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${url} devolvio ${r.status}`);
  return r.text();
}

const [indecRaw, variacionesRaw, combinadaCsv] = await Promise.all([
  json(URL_INDEC), json(URL_VARIACIONES), texto(URL_COMBINADA),
]);

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

// ---- Serie combinada ----
// Igual a la oficial desde ANCLA en adelante, y con los indices provinciales
// antes. Como es una reescala de la serie compuesta a nuestra base, alcanza con
// una regla de tres contra su propio valor en ANCLA: los cocientes entre dos
// meses cualesquiera del tramo quedan intactos.
const comp = new Map();
for (const linea of combinadaCsv.trim().split('\n').slice(1)) {
  const c = linea.split(',');
  const v = parseFloat(c[2]);
  if (c[0] && Number.isFinite(v)) comp.set(c[0].slice(0, 7), v);
}
if (!comp.has(ANCLA)) throw new Error(`la serie combinada no llega a ${ANCLA}`);

const combinada = new Map();
const factorComp = indice.get(ANCLA) / comp.get(ANCLA);
const primeroComp = [...comp.keys()].sort()[0];

for (const k of claves) {
  if (k >= ANCLA) { combinada.set(k, indice.get(k)); continue; }        // manda el INDEC
  if (comp.has(k)) { combinada.set(k, comp.get(k) * factorComp); continue; }
  combinada.set(k, null);   // antes de que arranque la compuesta: se resuelve abajo
}
// Antes de que arranque la compuesta no hay discusion sobre el dato oficial, asi
// que se reescala la oficial para que empalme sin escalon.
const factorViejo = combinada.get(primeroComp) / indice.get(primeroComp);
for (const k of claves) if (combinada.get(k) === null) combinada.set(k, indice.get(k) * factorViejo);

const control = (m, a, b) => ((Math.pow(m.get(b) / m.get(a), 12 / 108) - 1) * 100).toFixed(2);

const doc = {
  _doc: 'Indice de precios al consumidor de Argentina, base diciembre 2016 = 100. Generado por scripts/gen-ipc.mjs.',
  base: '2016-12 = 100',
  desde: claves[0],
  hasta: claves[claves.length - 1],
  actualizado: new Date().toISOString().slice(0, 10),
  series: {
    oficial: {
      nombre: 'INDEC oficial',
      fuentes: {
        '2016-12 en adelante': `INDEC, IPC Nacional base dic-2016=100, serie ${SERIE_INDEC} del portal de datos abiertos (apis.datos.gob.ar)`,
        'anterior a 2016-12': 'Serie de variaciones mensuales de argentinadatos.com, encadenada hacia atras desde la base del INDEC',
      },
      advertencia: 'Entre 2007 y 2015 el INDEC estuvo intervenido y esta serie arrastra sus cifras oficiales, que subestiman la inflacion real. Todo calculo que cruce ese tramo queda corto.',
    },
    combinada: {
      nombre: 'Serie combinada',
      fuentes: {
        '2016-12 en adelante': 'Identica a la oficial del INDEC',
        '2000-01 a 2016-11': 'IPC-Argentina (matuteiglesias/IPC-Argentina), promedio mensual de las series disponibles, alineadas en escala logaritmica',
        'anterior a 2000-01': 'La oficial, reescalada para empalmar sin escalon: ese tramo no esta en discusion',
        componentes: {
          'San Luis': 'Direccion Provincial de Estadistica y Censos, desde 2005-10',
          'CABA (IPCBA)': 'Direccion General de Estadistica y Censos de la Ciudad, desde 2012-07',
          'Cordoba': 'Direccion General de Estadistica y Censos, desde 2014-01',
          'INDEC serie vieja': 'hasta 2007-02, donde arranca la intervencion',
          'INDEC IPC Nacional': 'desde 2016-12',
        },
      },
      advertencia: 'Entre 2007 y mediados de 2012 la unica serie provincial disponible es San Luis, asi que ese tramo descansa en una sola provincia. Ademas una provincia no es el pais: los precios y el peso de cada rubro difieren. Es una aproximacion a lo que habria medido un IPC nacional bien hecho, no ese IPC.',
    },
  },
  valores: Object.fromEntries(claves.map(k => [k, Number(indice.get(k).toPrecision(9))])),
  valoresCombinada: Object.fromEntries(claves.map(k => [k, Number(combinada.get(k).toPrecision(9))])),
};

fs.writeFileSync(SALIDA, JSON.stringify(doc));
console.log(`${claves.length} meses: ${doc.desde} -> ${doc.hasta}`);
console.log(`2024 completo: +${((indice.get('2024-12') / indice.get('2023-12') - 1) * 100).toFixed(2)}%  (INDEC publico 117,8%)`);
console.log(`2007-2015 anual  oficial ${control(indice, '2006-12', '2015-12')}%  combinada ${control(combinada, '2006-12', '2015-12')}%`);
console.log(`control: desde ${ANCLA} las dos series tienen que ser identicas -> ` +
  (claves.filter(k => k >= ANCLA).every(k => indice.get(k) === combinada.get(k)) ? 'OK' : 'FALLA'));
