// Lector mínimo de planillas .xlsx (un zip con XML adentro), para archivos oficiales.
// leerXlsx(buffer) → [{ nombre, filas }] con filas[fila][columna] = número o texto (índices desde 0).
import { inflateRawSync } from 'zlib';

// Archivos del zip a partir del directorio central
function archivos(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('No es un zip');
  const n = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const out = {};
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Zip dañado');
    const metodo = buf.readUInt16LE(p + 10), comp = buf.readUInt32LE(p + 20);
    const lnom = buf.readUInt16LE(p + 28), lext = buf.readUInt16LE(p + 30), lcom = buf.readUInt16LE(p + 32), loc = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + lnom);
    const ini = loc + 30 + buf.readUInt16LE(loc + 26) + buf.readUInt16LE(loc + 28);
    const datos = buf.subarray(ini, ini + comp);
    // Tope de tamaño al descomprimir: una planilla oficial no pesa más que unos pocos MB
    out[nombre] = () => (metodo === 0 ? datos : inflateRawSync(datos, { maxOutputLength: 20e6 }));
    p += 46 + lnom + lext + lcom;
  }
  return out;
}

const ent = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const columna = letras => [...letras].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;

export function leerXlsx(buf) {
  const z = archivos(buf);
  const txt = k => (z[k] ? z[k]().toString('utf8') : '');
  const textos = [...txt('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => ent(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g, '').replace(/<[^>]+>/g, '')));
  const rels = {};
  for (const m of txt('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = (m[1].match(/\bId="([^"]+)"/) || [])[1], t = (m[1].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && t) rels[id] = t.replace(/^\/?xl\//, '');
  }
  return [...txt('xl/workbook.xml').matchAll(/<sheet\b([^>]*)\/?>/g)].map(m => {
    const nombre = ent((m[1].match(/\bname="([^"]+)"/) || [])[1] || '');
    const ruta = rels[(m[1].match(/\br:id="([^"]+)"/) || [])[1]];
    const filas = [];
    for (const r of txt('xl/' + ruta).matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const fila = [];
      for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = (c[1].match(/\br="([A-Z]+)\d+"/) || [])[1];
        if (!ref) continue;
        const tipo = (c[1].match(/\bt="([^"]+)"/) || [])[1], cuerpo = c[2] || '';
        const v = (cuerpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        let val = null;
        if (tipo === 's') val = textos[+v] ?? null;
        else if (tipo === 'inlineStr') val = ent(cuerpo.replace(/<[^>]+>/g, ''));
        else if (tipo === 'str') val = v != null ? ent(v) : null;
        else if (v != null && v !== '') val = Number.isFinite(+v) ? +v : ent(v);
        fila[columna(ref)] = val;
      }
      filas[+r[1] - 1] = fila;
    }
    return { nombre, filas };
  });
}
