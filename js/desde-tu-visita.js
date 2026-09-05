// ============================================================
// "DESDE TU ÚLTIMA VISITA"
// Guarda en el navegador los números clave que viste la última vez y, cuando
// volvés, te muestra cuánto se movieron. Nada sale del dispositivo: es
// localStorage, no hay cuenta ni servidor guardando nada.
//
// Uso: poner <div id="desde-tu-visita"></div> donde se quiera y cargar el
// script. Si el contenedor no existe, no hace nada.
// ============================================================
(function desdeTuVisita() {
  const CONTENEDOR = document.getElementById('desde-tu-visita');
  if (!CONTENEDOR) return;

  const CLAVE = 'bb:ultima-visita';
  // Por debajo de esto no tiene sentido mostrar variaciones: sería el ruido
  // de un mismo día, no "lo que pasó desde que no entrás".
  const MINIMO_MS = 6 * 3600 * 1000;

  const fmtNum = (n, d = 0) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

  function hace(ms) {
    const h = ms / 3600000;
    if (h < 24) return 'hace ' + Math.max(1, Math.round(h)) + (Math.round(h) === 1 ? ' hora' : ' horas');
    const d = Math.round(h / 24);
    if (d < 7) return 'hace ' + d + (d === 1 ? ' día' : ' días');
    const s = Math.round(d / 7);
    if (s < 5) return 'hace ' + s + (s === 1 ? ' semana' : ' semanas');
    return 'hace ' + Math.round(d / 30) + ' meses';
  }

  function leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { return null; }
  }
  function guardar(obj) {
    try { localStorage.setItem(CLAVE, JSON.stringify(obj)); } catch { /* modo privado: no pasa nada */ }
  }

  async function json(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  }

  async function traer() {
    const [dolar, rp, bcra] = await Promise.all([
      json('/api/dolar').catch(() => null),
      json('/api/agenda?source=riesgo-pais').catch(() => null),
      json('/api/bcra?endpoint=Monetarias&categoria=Principales%20Variables').catch(() => null),
    ]);

    const casa = c => (Array.isArray(dolar) ? dolar.find(x => x.casa === c) : null);
    const bcraVar = id => {
      const r = bcra && bcra.results ? bcra.results.find(v => v.idVariable === id) : null;
      return r && Number.isFinite(r.ultValorInformado) ? r.ultValorInformado : null;
    };

    const blue = casa('blue'), mep = casa('bolsa');
    return {
      ts: Date.now(),
      blue: blue ? blue.venta : null,
      mep: mep ? mep.venta : null,
      riesgo: rp && Number.isFinite(rp.valor) ? rp.valor : null,
      tamar: bcraVar(44),
    };
  }

  const METRICAS = [
    { k: 'blue',   etiqueta: 'Dólar blue',   fmt: v => '$' + fmtNum(v),        unidad: '$',   dec: 0 },
    { k: 'mep',    etiqueta: 'Dólar MEP',    fmt: v => '$' + fmtNum(v),        unidad: '$',   dec: 0 },
    { k: 'riesgo', etiqueta: 'Riesgo país',  fmt: v => fmtNum(v) + ' pts',     unidad: 'pts', dec: 0 },
    { k: 'tamar',  etiqueta: 'Tasa TAMAR',   fmt: v => fmtNum(v, 2) + '%',     unidad: 'pp',  dec: 2 },
  ];

  function filaHTML(m, actual, previo) {
    if (actual == null) return '';
    let delta = '';
    if (previo != null && Number.isFinite(previo)) {
      const dif = actual - previo;
      // El riesgo país se lee en puntos y las tasas en puntos porcentuales;
      // el dólar en porcentaje, que es como lo piensa la gente.
      const enPct = m.k === 'blue' || m.k === 'mep';
      const valor = enPct ? (dif / previo) * 100 : dif;
      const umbral = enPct ? 0.05 : (m.k === 'tamar' ? 0.005 : 0.5);
      if (Math.abs(valor) < umbral) {
        delta = '<span class="dv-delta dv-igual">sin cambios</span>';
      } else {
        const signo = valor > 0 ? '+' : '−';
        const texto = enPct
          ? signo + fmtNum(Math.abs(valor), 1) + '%'
          : signo + fmtNum(Math.abs(valor), m.k === 'tamar' ? 2 : 0) + ' ' + m.unidad;
        // Para el riesgo país, bajar es la buena noticia
        const bueno = m.k === 'riesgo' ? valor < 0 : valor > 0;
        delta = '<span class="dv-delta ' + (bueno ? 'dv-sube' : 'dv-baja') + '">' + texto + '</span>';
      }
    }
    return '<div class="dv-item">' +
      '<span class="dv-etiqueta">' + m.etiqueta + '</span>' +
      '<span class="dv-valor">' + m.fmt(actual) + '</span>' +
      delta +
      '</div>';
  }

  async function render() {
    let datos;
    try { datos = await traer(); } catch { CONTENEDOR.hidden = true; return; }

    const hayAlgo = METRICAS.some(m => datos[m.k] != null);
    if (!hayAlgo) { CONTENEDOR.hidden = true; return; }

    const previo = leer();
    const transcurrido = previo && previo.ts ? Date.now() - previo.ts : 0;
    const compara = previo && transcurrido >= MINIMO_MS;

    const filas = METRICAS.map(m => filaHTML(m, datos[m.k], compara ? previo[m.k] : null)).join('');

    CONTENEDOR.innerHTML =
      '<div class="dv-caja">' +
        '<div class="dv-encabezado">' +
          '<span class="dv-titulo">' + (compara ? 'Desde tu última visita' : 'El mercado hoy') + '</span>' +
          '<span class="dv-cuando">' + (compara ? hace(transcurrido) : 'primera vez que entrás') + '</span>' +
        '</div>' +
        '<div class="dv-grilla">' + filas + '</div>' +
        (compara ? '' : '<p class="dv-nota">La próxima vez que entres te mostramos cuánto cambió cada uno. Se guarda sólo en este navegador.</p>') +
      '</div>';
    CONTENEDOR.hidden = false;

    // Se guarda recién después de mostrar, para no pisar el valor con el que
    // había que comparar
    guardar(datos);
  }

  render();
})();
