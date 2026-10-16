// ============================================================
// PANEL ARGENTINA — piezas compartidas por la home, el panel y sus páginas:
// pedidos a la API (una sola vez por página), formato, la franja
// "Últimos datos y lo que viene", minigráficos y la descarga de gráficos.
// Todo texto que viene de una fuente externa pasa por esc() o textContent.
// ============================================================
window.BBPanel = (function () {
  const cache = {};
  const json = u => cache[u] || (cache[u] = fetch(u, { signal: AbortSignal.timeout(20000) })
    .then(r => (r.ok ? r.json() : null)).catch(() => null));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, d = 1) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pesos = v => '$' + Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 });
  const signo = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v), d);
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const hoyISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const fechaCorta = iso => { const [, m, d] = iso.split('-').map(Number); return d + ' ' + MES[m - 1]; };
  const mesAnio = ym => { const [y, m] = ym.split('-').map(Number); return MES[m - 1].replace(/^./, c => c.toUpperCase()) + ' ' + y; };
  const mesLargo = ym => { const [y, m] = ym.split('-').map(Number); return MESES[m - 1] + ' de ' + y; };
  // "1er semestre 2026*" → "1.er sem. 2026"
  const semCorto = s => String(s).replace('*', '').replace(/^1er\.? semestre/i, '1.er sem.').replace(/^2do\.? semestre/i, '2.º sem.').trim();

  // ---- Fuentes
  const API = {
    calendario: () => json('/api/indec?calendario=1'),
    canasta: () => json('/api/indec?canasta=1'),
    pobreza: () => json('/api/indec?pobreza=1'),
    inflacion: () => json('/api/argentinadatos?path=finanzas/indices/inflacion'),
    bcra: () => json('/api/bcra?endpoint=Monetarias&categoria=Principales%20Variables'),
    serieBcra: (id, desde) => json('/api/bcra?endpoint=Monetarias&idVariable=' + id + '&desde=' + desde),
    dolar: () => json('/api/dolar'),
  };
  const variable = (b, id) => { const L = b && (b.results || b); const x = Array.isArray(L) && L.find(y => y.idVariable === id); return x && Number.isFinite(x.ultValorInformado) ? x : null; };

  // ---- Minigráfico (SVG en línea, sin librerías)
  function sparkline(valores, { ancho = 260, alto = 54, color = 'var(--accent)', relleno = true } = {}) {
    const v = valores.filter(Number.isFinite);
    if (v.length < 2) return '';
    const min = Math.min(...v), max = Math.max(...v), r = max - min || 1;
    const pts = v.map((y, i) => [i / (v.length - 1) * ancho, alto - 4 - (y - min) / r * (alto - 10)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const u = pts.at(-1);
    return '<svg class="pa-spark" viewBox="0 0 ' + ancho + ' ' + alto + '" preserveAspectRatio="none" aria-hidden="true">' +
      (relleno ? '<path d="' + d + ' L' + ancho + ' ' + alto + ' L0 ' + alto + ' Z" fill="' + color + '" opacity="0.12"/>' : '') +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.8" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + u[0].toFixed(1) + '" cy="' + u[1].toFixed(1) + '" r="3" fill="' + color + '"/></svg>';
  }

  // ---- Nombres cortos para el calendario del INDEC
  // [patrón, nombre corto, tema, nivel]: nivel 1 son los datos que más se siguen; el 2 completa si hay lugar
  const CORTOS = [
    [/^Índice de precios al consumidor/i, 'Inflación (IPC)', 'precios', 1],
    [/canasta básica alimentaria \(CBA\)/i, 'Canastas básicas: pobreza e indigencia', 'pobreza', 1],
    [/^Incidencia de la pobreza/i, 'Pobreza e indigencia', 'pobreza', 1],
    [/Estimador mensual de actividad/i, 'Actividad económica (EMAE)', 'actividad', 1],
    [/^Índice de salarios/i, 'Índice de salarios', 'empleo', 1],
    [/^Mercado de trabajo/i, 'Empleo y desocupación', 'empleo', 1],
    [/^Intercambio comercial argentino/i, 'Comercio exterior', 'comercio', 1],
    [/IPI manufacturero/i, 'Industria (IPI)', 'actividad', 1],
    [/actividad de la construcción/i, 'Construcción (ISAC)', 'actividad', 1],
    [/precios mayoristas/i, 'Precios mayoristas', 'precios', 1],
    [/Informe de avance del nivel de actividad/i, 'PBI trimestral', 'actividad', 1],
    [/^Balanza de pagos/i, 'Balanza de pagos', 'comercio', 1],
    [/canasta de crianza/i, 'Canasta de crianza', 'pobreza', 2],
    [/costo de la construcción/i, 'Costo de la construcción', 'precios', 2],
    [/^Encuesta de supermercados/i, 'Supermercados', 'actividad', 2],
    [/capacidad instalada/i, 'Uso de la capacidad industrial', 'actividad', 2],
    [/servicios públicos/i, 'Servicios públicos (ISSP)', 'actividad', 2],
    [/turismo internacional/i, 'Turismo internacional', 'actividad', 2],
  ];
  function corto(titulo) {
    const c = CORTOS.find(([re]) => re.test(titulo));
    const periodo = (titulo.match(/\.\s*([^.]*\d{4})\s*$/) || [])[1] || '';
    return { nombre: c ? c[1] : titulo.split(/[.(]/)[0].trim().slice(0, 48), tema: c ? c[2] : 'otro', nivel: c ? c[3] : 3, periodo: periodo.replace(/^./, x => x.toUpperCase()) };
  }

  // ---- "Últimos datos y lo que viene"
  // Para los datos que el sitio ya tiene, la tarjeta muestra el valor; para el resto, el enlace al informe.
  async function valoresConocidos() {
    const [inf, can, b] = await Promise.all([API.inflacion(), API.canasta(), API.bcra()]);
    const v = {};
    if (Array.isArray(inf) && inf.length >= 2) {
      const u = inf.at(-1), p = inf.at(-2);
      v.ipc = { valor: signo(u.valor) + '%', clase: u.valor < p.valor ? 'mejor' : u.valor > p.valor ? 'peor' : '', nota: u.valor < p.valor ? 'Bajó vs. el mes anterior' : u.valor > p.valor ? 'Subió vs. el mes anterior' : 'Igual que el mes anterior', mes: String(u.fecha).slice(0, 7) };
    }
    if (can && can.serie && can.serie.length >= 2) {
      const u = can.serie.at(-1), p = can.serie.at(-2);
      v.canasta = { valor: signo((u.cbt / p.cbt - 1) * 100) + '%', nota: 'Línea de pobreza: ' + pesos(u.cbt) + ' por adulto', mes: u.fecha };
    }
    const res = variable(b, 1), may = variable(b, 5);
    if (res) v.reservas = { valor: 'US$' + Math.round(res.ultValorInformado).toLocaleString('es-AR') + ' M', fecha: res.ultFechaInformada };
    if (may) v.mayorista = { valor: '$' + num(may.ultValorInformado, 2), fecha: may.ultFechaInformada };
    return v;
  }

  async function franja(el, { pasados = 4, proximos = 5 } = {}) {
    if (!el) return;
    const [cal, vals] = await Promise.all([API.calendario(), valoresConocidos()]);
    const hoy = hoyISO();
    const items = [];
    if (cal && Array.isArray(cal.eventos)) {
      const ev = cal.eventos.map(e => Object.assign({}, e, corto(e.titulo))).filter(e => e.nivel <= 2);
      const yaSalio = e => e.fecha < hoy || (e.fecha === hoy && new Date().getHours() >= 16);
      // Publicados: los de nivel 1 primero; si sobra lugar, los de nivel 2. Después, en orden de fecha.
      const salieron = ev.filter(yaSalio);
      const antes = salieron.filter(e => e.nivel === 1).slice(-pasados);
      if (antes.length < pasados) antes.push(...salieron.filter(e => e.nivel === 2).slice(-(pasados - antes.length)));
      const despues = ev.filter(e => !yaSalio(e)).slice(0, proximos);
      const pasado = antes.map(e => {
        const dato = /Inflación/.test(e.nombre) ? vals.ipc : /Canastas básicas/.test(e.nombre) ? vals.canasta : null;
        return { orden: e.fecha + e.hora, cuando: fechaCorta(e.fecha) + ' · ' + e.hora, nombre: e.nombre, valor: dato && dato.valor, clase: dato && dato.clase, nota: dato ? dato.nota : e.periodo, url: e.informe, estado: 'paso' };
      });
      if (vals.reservas) pasado.push({ orden: vals.reservas.fecha + '99', cuando: fechaCorta(vals.reservas.fecha), nombre: 'Reservas del Banco Central', valor: vals.reservas.valor, nota: 'Dato diario', url: 'https://www.bcra.gob.ar/estadisticas-indicadores/', estado: 'paso' });
      if (vals.mayorista) pasado.push({ orden: vals.mayorista.fecha + '99', cuando: fechaCorta(vals.mayorista.fecha), nombre: 'Dólar mayorista', valor: vals.mayorista.valor, nota: 'Dato diario', url: 'https://www.bcra.gob.ar/estadisticas-indicadores/', estado: 'paso' });
      items.push(...pasado.sort((a, b) => (a.orden < b.orden ? -1 : 1)));
      for (const e of despues) items.push({ cuando: (e.fecha === hoy ? 'Hoy' : fechaCorta(e.fecha)) + ' · ' + e.hora, nombre: e.nombre, nota: e.periodo, url: cal.url, estado: e.fecha === hoy ? 'hoy' : 'viene' });
    }
    if (!items.length) { el.closest('[data-franja]')?.setAttribute('hidden', ''); return; }
    el.innerHTML = items.map(i => '<a class="pa-hito ' + i.estado + '" href="' + esc(i.url || '#') + '" target="_blank" rel="noopener">' +
      '<span class="cuando">' + esc(i.cuando) + '</span><span class="punto" aria-hidden="true"></span>' +
      '<span class="nombre">' + esc(i.nombre) + '</span>' +
      (i.valor ? '<span class="valor ' + esc(i.clase || '') + '">' + esc(i.valor) + '</span>' : '<span class="valor tenue">' + (i.estado === 'paso' ? 'Ver informe ↗' : 'INDEC') + '</span>') +
      '<span class="nota">' + esc(i.nota || '') + '</span></a>').join('');
    // Que arranque mostrando el último dato publicado
    const ult = el.querySelectorAll('.pa-hito.paso');
    if (ult.length > 2) el.scrollLeft = Math.max(0, ult[ult.length - 3].offsetLeft - 8);
  }

  // ---- Descargar un gráfico como imagen, con título, fuente y marca
  function exportar(canvas, { titulo = '', fuente = '', nombre = 'grafico-bb-finanzas' } = {}) {
    // Si el gráfico está animando (al cargar o al cambiar el tamaño), se dibuja completo antes de copiarlo
    const ch = window.Chart && Chart.getChart(canvas);
    if (ch) { ch.stop(); ch.update('none'); }
    const W = 1200, H = 675, M = 48;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#0a0c0f'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e8edf5'; x.font = '400 34px "DM Serif Display", Georgia, serif'; x.fillText(titulo, M, 70);
    const area = { x: M, y: 100, w: W - 2 * M, h: H - 100 - 80 };
    const k = Math.min(area.w / canvas.width, area.h / canvas.height);
    x.drawImage(canvas, area.x + (area.w - canvas.width * k) / 2, area.y, canvas.width * k, canvas.height * k);
    x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(M, H - 62, W - 2 * M, 1);
    x.fillStyle = '#9aa5b8'; x.font = '400 18px "DM Mono", monospace'; x.fillText('Fuente: ' + fuente, M, H - 30);
    x.fillStyle = '#4ade9a'; x.textAlign = 'right'; x.font = '500 20px Outfit, Arial, sans-serif'; x.fillText('bbfinanzas.com.ar', W - M, H - 30);
    c.toBlob(b => {
      if (!b) return;
      const u = URL.createObjectURL(b), a = document.createElement('a');
      a.href = u; a.download = nombre + '.png'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 5000);
    }, 'image/png');
    if (window.bbTrack) window.bbTrack('grafico_descarga', { grafico: nombre });
  }
  // Botones <button data-exportar="idCanvas" data-titulo="…" data-fuente="…">
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-exportar]'); if (!b) return;
    const cv = document.getElementById(b.dataset.exportar); if (!cv) return;
    exportar(cv, { titulo: b.dataset.titulo, fuente: b.dataset.fuente, nombre: b.dataset.exportar });
  });

  return { API, json, esc, num, pesos, signo, fechaCorta, mesAnio, mesLargo, semCorto, variable, sparkline, franja, exportar, hoyISO };
})();
