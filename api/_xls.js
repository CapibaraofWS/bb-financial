// Lector mínimo de planillas .xls (Excel 97-2003, BIFF8) sin dependencias.
// Solo lo necesario para las series del INDEC: números, fechas (como número de serie) y textos.
// Devuelve [{ nombre, filas: [[celda, ...], ...] }].

// ---- Contenedor OLE2 (Compound File Binary): de ahí sale el stream "Workbook"
function leerStream(buf, nombreBuscado) {
  if (buf.readUInt32LE(0) !== 0xE011CFD0) throw new Error('No es un archivo .xls');
  const sector = 1 << buf.readUInt16LE(30), mini = 1 << buf.readUInt16LE(32);
  const nFat = buf.readUInt32LE(44), dir0 = buf.readInt32LE(48), corteMini = buf.readUInt32LE(56);
  const miniFat0 = buf.readInt32LE(60), difat0 = buf.readInt32LE(68), nDifat = buf.readUInt32LE(72);
  const off = s => (s + 1) * sector;
  // Sectores de la FAT: 109 en la cabecera y el resto en la cadena DIFAT
  const fatSect = [];
  for (let i = 0; i < 109 && fatSect.length < nFat; i++) fatSect.push(buf.readInt32LE(76 + i * 4));
  for (let d = difat0, k = 0; d >= 0 && k < nDifat; k++) {
    for (let i = 0; i < sector / 4 - 1 && fatSect.length < nFat; i++) fatSect.push(buf.readInt32LE(off(d) + i * 4));
    d = buf.readInt32LE(off(d) + sector - 4);
  }
  const fat = [];
  for (const s of fatSect) for (let i = 0; i < sector / 4; i++) fat.push(buf.readInt32LE(off(s) + i * 4));
  const cadena = (ini, tabla) => { const r = []; for (let s = ini; s >= 0 && r.length < 1e6; s = tabla[s]) r.push(s); return r; };
  const leer = ini => Buffer.concat(cadena(ini, fat).map(s => buf.subarray(off(s), off(s) + sector)));
  const dir = leer(dir0);
  const entradas = [];
  for (let p = 0; p + 128 <= dir.length; p += 128) {
    const largo = dir.readUInt16LE(p + 64);
    entradas.push({ nombre: dir.subarray(p, p + Math.max(0, largo - 2)).toString('utf16le'), tipo: dir[p + 66], ini: dir.readInt32LE(p + 116), tam: dir.readUInt32LE(p + 120) });
  }
  const e = entradas.find(x => x.nombre === nombreBuscado) || entradas.find(x => x.nombre === 'Book');
  if (!e) throw new Error('Sin stream Workbook');
  if (e.tam >= corteMini) return leer(e.ini).subarray(0, e.tam);
  // Stream chico: vive en el mini stream de la entrada raíz
  const raiz = leer(entradas[0].ini);
  const miniFat = []; for (const s of cadena(miniFat0, fat)) for (let i = 0; i < sector / 4; i++) miniFat.push(buf.readInt32LE(off(s) + i * 4));
  return Buffer.concat(cadena(e.ini, miniFat).map(s => raiz.subarray(s * mini, (s + 1) * mini))).subarray(0, e.tam);
}

// Número RK: entero o double comprimido
function rk(v) {
  let n;
  if (v & 2) n = v >> 2;
  else { const b = Buffer.alloc(8); b.writeUInt32LE((v & 0xFFFFFFFC) >>> 0, 4); n = b.readDoubleLE(0); }
  return v & 1 ? n / 100 : n;
}

export function leerXls(buf) {
  const wb = leerStream(buf, 'Workbook');
  // Registros, con sus CONTINUE pegados (los necesita la tabla de textos)
  const regs = [];
  for (let p = 0; p + 4 <= wb.length;) {
    const tipo = wb.readUInt16LE(p), largo = wb.readUInt16LE(p + 2);
    const datos = wb.subarray(p + 4, p + 4 + largo);
    if (tipo === 0x003C && regs.length) regs[regs.length - 1].partes.push(datos);
    else regs.push({ tipo, pos: p, partes: [datos] });
    p += 4 + largo;
  }
  // Tabla de textos compartidos (SST)
  const sst = [];
  const regSst = regs.find(r => r.tipo === 0x00FC);
  if (regSst) {
    const partes = regSst.partes; let pi = 0, b = partes[0], p = 8;
    const total = b.readUInt32LE(4);
    const asegurar = () => { if (p >= b.length && pi + 1 < partes.length) { b = partes[++pi]; p = 0; } };
    for (let i = 0; i < total; i++) {
      asegurar();
      let chars = b.readUInt16LE(p); p += 2; let flags = b[p++];
      let runs = 0, ext = 0;
      if (flags & 8) { runs = b.readUInt16LE(p); p += 2; }
      if (flags & 4) { ext = b.readUInt32LE(p); p += 4; }
      let s = '';
      while (chars > 0) {
        const ancho = flags & 1 ? 2 : 1;
        const disp = Math.floor((b.length - p) / ancho), n = Math.min(chars, disp);
        s += ancho === 2 ? b.subarray(p, p + n * 2).toString('utf16le') : b.subarray(p, p + n).toString('latin1');
        p += n * ancho; chars -= n;
        if (chars > 0) { b = partes[++pi]; p = 0; flags = b[p++]; }
      }
      let saltear = runs * 4 + ext;
      while (saltear > 0) { const n = Math.min(saltear, b.length - p); p += n; saltear -= n; if (saltear > 0) { b = partes[++pi]; p = 0; } }
      sst.push(s);
    }
  }
  // Hojas: BOUNDSHEET da el nombre y dónde empieza cada una
  const hojas = regs.filter(r => r.tipo === 0x0085).map(r => {
    const d = r.partes[0], largo = d[6], uni = d[7] & 1;
    return { nombre: uni ? d.subarray(8, 8 + largo * 2).toString('utf16le') : d.subarray(8, 8 + largo).toString('latin1'), inicio: d.readUInt32LE(0), filas: [] };
  });
  let actual = null;
  const poner = (f, c, v) => { (actual.filas[f] = actual.filas[f] || [])[c] = v; };
  for (const r of regs) {
    const h = hojas.find(x => x.inicio === r.pos); if (h) { actual = h; continue; }
    if (!actual) continue;
    const d = r.partes[0];
    if (r.tipo === 0x0203) poner(d.readUInt16LE(0), d.readUInt16LE(2), d.readDoubleLE(6));
    else if (r.tipo === 0x027E) poner(d.readUInt16LE(0), d.readUInt16LE(2), rk(d.readInt32LE(6)));
    else if (r.tipo === 0x00BD) { const f = d.readUInt16LE(0), c0 = d.readUInt16LE(2); for (let k = 0; 4 + k * 6 + 6 <= d.length - 2; k++) poner(f, c0 + k, rk(d.readInt32LE(4 + k * 6 + 2))); }
    else if (r.tipo === 0x00FD) poner(d.readUInt16LE(0), d.readUInt16LE(2), sst[d.readUInt32LE(6)]);
    else if (r.tipo === 0x000A) actual = null;   // EOF de la hoja
  }
  return hojas.map(({ nombre, filas }) => ({ nombre, filas }));
}

// Número de serie de Excel → 'AAAA-MM-DD'
export const fechaExcel = n => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5).toISOString().slice(0, 10);
