// ============================================================
// CÁLCULOS DE BONOS EN PESOS: CER, dólar linked, TAMAR y duales. Funciones puras: las usa api/agenda.js
// (?source=curvas) y los scripts que las comparan con los resultados oficiales de las licitaciones.
// Fechas como 'AAAA-MM-DD'. Tasas en decimal (0,05 = 5%), salvo TAMAR y márgenes, que van en % como los publica el BCRA.
// Referencias: Dumrauf, Análisis cuantitativo de bonos (cap. 2: TIR y duración; cap. 6: bonos CER, flujos con el CER
// conocido a la fecha de valuación) y Fabozzi, Bond Markets (cap. 3: margen sobre la tasa de referencia, suponiendo
// que la tasa se mantiene en su último valor).
// ============================================================
export const DIA = 864e5;

// Feriados nacionales de fecha fija, para los años que la fuente todavía no publica (2028 en adelante)
const FIJOS = ['01-01', '03-24', '04-02', '05-01', '05-25', '06-20', '07-09', '08-17', '10-12', '11-20', '12-08', '12-25'];
export function calendario(feriados) {
  const fer = new Set(feriados), anios = new Set([...fer].map(f => f.slice(0, 4)));
  const esFeriado = f => fer.has(f) || (!anios.has(f.slice(0, 4)) && FIJOS.includes(f.slice(5)));
  const mas = (f, n) => new Date(Date.parse(f + 'T12:00:00Z') + n * DIA).toISOString().slice(0, 10);
  const habil = f => { const d = new Date(f + 'T12:00:00Z').getUTCDay(); return d > 0 && d < 6 && !esFeriado(f); };
  const paso = (f, s) => { let x = mas(f, s); while (!habil(x)) x = mas(x, s); return x; };
  const atras = (f, n) => { for (let i = 0; i < n; i++) f = paso(f, -1); return f; };
  return { mas, habil, paso, atras };
}
export const dias = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DIA);
// Días 30/360 entre dos fechas (convención de los prospectos del Tesoro)
export function dias30360(a, b) {
  const [y1, m1, x1] = a.split('-').map(Number), [y2, m2, x2] = b.split('-').map(Number);
  const d1 = Math.min(x1, 30), d2 = x2 === 31 && d1 >= 30 ? 30 : x2;
  return 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
}
// Valor de una serie diaria en una fecha, o el último publicado antes (serie: objeto fecha → valor, fechas: ordenadas)
export function valorEn(serie, fechas, f) {
  if (serie[f] != null) return serie[f];
  let lo = 0, hi = fechas.length - 1, r = null;
  while (lo <= hi) { const k = (lo + hi) >> 1; if (fechas[k] <= f) { r = fechas[k]; lo = k + 1; } else hi = k - 1; }
  return r ? serie[r] : null;
}
// Tasa efectiva anual de un pago único: (pago / precio) ^ (365 / días) − 1
export const tirUnica = (pago, precio, d) => (pago > 0 && precio > 0 && d > 0 ? Math.pow(pago / precio, 365 / d) - 1 : null);

// ---- TAMAR
// Los días hábiles que todavía no tienen dato se completan con el promedio de los últimos 7 publicados. Es el supuesto
// que mejor reproduce la TIREA de Finanzas: en 9 licitaciones de 2026, 0,12 puntos de diferencia media y 0,32 de máxima
// (con la última tasa sola la máxima era 1,1). Finanzas no publica cómo proyecta.
export const tamarProyectada = (serie, fechas) => fechas.slice(-7).reduce((s, f) => s + serie[f], 0) / Math.min(7, fechas.length);
// Promedio simple de la TAMAR publicada entre dos fechas (ventana de los prospectos: de 10 días hábiles antes de la
// emisión a 10 días hábiles antes del vencimiento), con la proyección para los días que faltan
export function tamarPromedio(serie, fechas, desde, hasta, cal) {
  let suma = 0, n = 0, proyectados = 0;
  for (const f of fechas) if (f >= desde && f <= hasta) { suma += serie[f]; n++; }
  const ultF = fechas.at(-1), supuesto = tamarProyectada(serie, fechas);
  for (let f = cal.paso(ultF > desde ? ultF : cal.mas(desde, -1), 1); f <= hasta; f = cal.paso(f, 1)) { suma += supuesto; n++; proyectados++; }
  return n ? { promedio: suma / n, proyectados, supuesto, ultFecha: ultF } : null;
}
// TAMAR TEM = [(1 + (TAMAR + MARGEN) / (365/32)) ^ (365/32)] ^ (1/12) − 1 (resoluciones de emisión, Boletín Oficial)
export const tamarTem = (tamar, margen) => Math.pow(1 + (tamar + margen) / 100 / (365 / 32), (365 / 32) / 12) - 1;
// Pago al vencimiento por cada 100: VPV = 100 × (1 + TAMAR TEM) ^ (días 30/360 / 360 × 12)
export const vpvTamar = (emision, vence, tamar, margen) => 100 * Math.pow(1 + tamarTem(tamar, margen), dias30360(emision, vence) / 360 * 12);
// Una tasa efectiva anual expresada como TAMAR (nominal anual con capitalización cada 32 días), para medir el margen
export const comoTamar = tea => (365 / 32) * (Math.pow(1 + tea, 32 / 365) - 1) * 100;

// ---- Flujos con cupón (CER con amortización y tasa fija con cupón). Precio sucio por cada 100 de valor nominal original.
// pagos: [{ fecha, amort, interes }] en % del valor nominal original. Devuelve TIR efectiva anual y duración en años.
export function tirFlujos(precio, liq, pagos) {
  const f = pagos.filter(p => p.fecha > liq).map(p => ({ t: dias(liq, p.fecha) / 365, cf: p.amort + p.interes }));
  if (!(precio > 0) || !f.length || f.reduce((s, x) => s + x.cf, 0) <= precio) return null;
  const vp = y => f.reduce((s, x) => s + x.cf / Math.pow(1 + y, x.t), 0);
  let lo = -0.5, hi = 5;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (vp(m) > precio) lo = m; else hi = m; }
  const y = (lo + hi) / 2, v = vp(y), mac = f.reduce((s, x) => s + x.t * x.cf / Math.pow(1 + y, x.t), 0) / v;
  return { tir: y, duracion: mac, modificada: mac / (1 + y) };
}
// Calendario de pagos de un bono con amortizaciones iguales y cupón semestral 30/360 sobre el saldo
// fechas: los pagos semestrales desde el primero hasta el vencimiento; amortDesde: primera fecha con amortización
export function pagosSemestrales({ fechas, tasa, cuotas, amortDesde }) {
  let saldo = 100;
  const cuota = 100 / cuotas;
  return fechas.map(fecha => {
    const interes = saldo * tasa / 2, amort = fecha >= amortDesde && saldo > 1e-9 ? Math.min(cuota, saldo) : 0;
    saldo -= amort;
    return { fecha, amort, interes };
  });
}
// Fechas semestrales: el día dd de los meses m1 y m2 entre dos años (inclusive)
export function semestrales(dd, m1, m2, desdeAnio, hastaFecha) {
  const out = [];
  for (let y = desdeAnio; ; y++) for (const m of [m1, m2]) {
    const f = y + '-' + String(m).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
    if (f > hastaFecha) return out.sort();
    out.push(f);
  }
}
