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
    ipc: () => json('/api/indec?ipc=1'),
    emae: () => json('/api/indec?emae=1'),
    cotiz: (casa, dias) => json('/api/argentinadatos?path=cotizaciones/dolares/' + casa + '&dias=' + dias),
    riesgo: dias => json('/api/argentinadatos?path=finanzas/indices/riesgo-pais&dias=' + dias),
    gob: (ids, n) => json('/api/indec?series=' + ids + '&limit=' + n + '&sort=desc'),
    salarios: () => json('/api/indec?salarios=1'),
    empleo: () => json('/api/indec?empleo=1'),
    geo: () => json('/data/provincias-ar.json'),
    comercio: () => json('/api/indec?comercio=1'),
    fiscal: () => json('/api/indec?fiscal=1'),
  };
  // Series del BCRA (vienen de la más nueva a la más vieja) → [{fecha, valor}] en orden
  const det = r => ((r && r.results && r.results[0] && r.results[0].detalle) || []).slice().reverse();
  // Series del portal de datos abiertos (ordenadas desc) → por columna, en orden
  const gobCols = (r, k) => ((r && r.data) || []).filter(f => f[k + 1] != null).map(f => ({ fecha: f[0].slice(0, 7), valor: f[k + 1] })).reverse();
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
  // El resto de las publicaciones (solo para el calendario completo de la Agenda): tema según el título
  const TEMA_RESTO = [[/IPI|tendencia de negocios|supermercados|autoservicios|centros de compras|electrodomésticos|patentamientos|maquinaria agrícola|farmacéutica|sector energético|productos industriales/i, 'actividad'],
    [/distribución del ingreso|condiciones de vida/i, 'pobreza'], [/Dotación de personal|generación del ingreso|microdatos de la Encuesta Permanente/i, 'empleo'], [/comercio exterior/i, 'comercio']];
  function corto(titulo) {
    const c = CORTOS.find(([re]) => re.test(titulo));
    const periodo = (titulo.match(/\.\s*([^.]*\d{4})\s*$/) || [])[1] || '';
    const resto = !c && TEMA_RESTO.find(([re]) => re.test(titulo));
    // Sin nombre corto: el título sin el período ni las siglas (así "Encuesta de tendencia de negocios. Industria manufacturera" no se confunde con la de supermercados)
    const largo = titulo.replace(/\.\s*[^.]*\d{4}\s*$/, '').replace(/\s*\([^)]*\)/g, '').trim();
    return { nombre: c ? c[1] : largo.length > 80 ? largo.slice(0, 78).replace(/\s+\S*$/, '') + '…' : largo, tema: c ? c[2] : resto ? resto[1] : 'otro', nivel: c ? c[3] : 3, periodo: periodo.replace(/^./, x => x.toUpperCase()) };
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

  // Calendario en "días": cada fecha es una columna con sus publicaciones (en el celular, una línea de tiempo vertical)
  const TEMAS = { precios: 'Precios', pobreza: 'Pobreza', actividad: 'Actividad', empleo: 'Empleo', comercio: 'Comercio', dolar: 'Banco Central', otro: 'INDEC' };
  const DSEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const diasEntre = (a, b) => Math.round((Date.UTC(...b.split('-').map((x, i) => i === 1 ? x - 1 : +x)) - Date.UTC(...a.split('-').map((x, i) => i === 1 ? x - 1 : +x))) / 864e5);
  async function franja(el, { pasados = 4, proximos = 5 } = {}) {
    if (!el) return;
    // En el celular la línea es vertical: con menos eventos no se hace eterna
    if (matchMedia('(max-width: 640px)').matches) { pasados = Math.min(pasados, 3); proximos = Math.min(proximos, 4); }
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
      for (const e of antes) {
        const dato = /Inflación/.test(e.nombre) ? vals.ipc : /Canastas básicas/.test(e.nombre) ? vals.canasta : null;
        items.push({ fecha: e.fecha, orden: e.hora, hora: e.hora, tema: e.tema, nombre: e.nombre, valor: dato && dato.valor, clase: dato && dato.clase, nota: dato ? dato.nota : e.periodo, url: e.informe });
      }
      if (vals.reservas) items.push({ fecha: vals.reservas.fecha, orden: '99', tema: 'dolar', nombre: 'Reservas', valor: vals.reservas.valor, nota: 'Dato diario', url: 'https://www.bcra.gob.ar/estadisticas-indicadores/' });
      if (vals.mayorista) items.push({ fecha: vals.mayorista.fecha, orden: '99', tema: 'dolar', nombre: 'Dólar mayorista', valor: vals.mayorista.valor, nota: 'Dato diario', url: 'https://www.bcra.gob.ar/estadisticas-indicadores/' });
      for (const e of despues) items.push({ fecha: e.fecha, orden: e.hora, hora: e.hora, tema: e.tema, nombre: e.nombre, nota: e.periodo, url: cal.url, viene: true });
    }
    if (!items.length) { el.closest('[data-franja]')?.setAttribute('hidden', ''); return; }
    // Agrupar por día
    const dias = [];
    for (const i of items.sort((a, b) => (a.fecha + a.orden < b.fecha + b.orden ? -1 : 1))) {
      let d = dias.find(x => x.fecha === i.fecha);
      if (!d) dias.push(d = { fecha: i.fecha, items: [] });
      d.items.push(i);
    }
    el.classList.add('pa-agenda');
    el.innerHTML = dias.map(d => {
      const [y, m, dd] = d.fecha.split('-').map(Number), dif = diasEntre(hoy, d.fecha);
      const estado = d.fecha === hoy ? 'hoy' : d.items.every(i => i.viene) ? 'viene' : 'paso';
      const falta = estado === 'hoy' ? 'Hoy' : dif === 1 ? 'Mañana' : dif > 1 ? 'En ' + dif + ' días' : dif === -1 ? 'Ayer' : 'Hace ' + (-dif) + ' días';
      return '<div class="pa-dia ' + estado + '"><div class="fecha" aria-label="' + dd + ' de ' + MESES[m - 1] + '"><span class="dsem">' + DSEM[new Date(y, m - 1, dd).getDay()] + '</span><b>' + dd + '</b><span class="mes">' + MES[m - 1] + '</span><span class="falta">' + falta + '</span></div><div class="eventos">' +
        d.items.map(i => '<a class="pa-ev t-' + esc(i.tema) + '" href="' + esc(i.url || '#') + '" target="_blank" rel="noopener">' +
          '<span class="chip">' + esc(TEMAS[i.tema] || 'INDEC') + (i.hora ? ' · ' + esc(i.hora) : '') + '</span>' +
          '<span class="nombre">' + esc(i.nombre) + '</span>' +
          (i.valor ? '<span class="valor ' + esc(i.clase || '') + '">' + esc(i.valor) + '</span>' : '') +
          '<span class="nota">' + esc(i.nota || '') + (i.viene || i.valor ? '' : ' · informe ↗') + '</span></a>').join('') +
        '</div></div>';
    }).join('');
    // Que arranque mostrando el último dato publicado
    const ult = el.querySelectorAll('.pa-dia.paso');
    if (ult.length > 1 && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, ult[ult.length - 2].offsetLeft - 8);
  }

  // ---- Bandera argentina en SVG (en Windows el emoji de bandera se ve como "AR")
  const BANDERA = '<svg class="pa-bandera" viewBox="0 0 30 20" width="20" height="14" aria-hidden="true"><rect width="30" height="20" rx="2.5" fill="#74acdf"/><rect y="6.67" width="30" height="6.66" fill="#fff"/><circle cx="15" cy="10" r="2.3" fill="#f6b40e"/></svg>';
  document.querySelectorAll('[data-bandera]').forEach(e => e.insertAdjacentHTML('afterbegin', BANDERA));

  // ---- Volver: si se llegó desde el sitio, vuelve a la página anterior; si no, va al panel
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-volver]'); if (!a) return;
    if (document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
  });

  // ---- Brillo e inclinación suave de las tarjetas al pasar el mouse (solo con mouse y sin "reducir movimiento")
  function brillo(sel) {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll(sel).forEach(c => {
      c.classList.add('pa-brilla');
      c.addEventListener('pointermove', e => {
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        c.style.setProperty('--rx', ((0.5 - y) * 4).toFixed(2) + 'deg'); c.style.setProperty('--ry', ((x - 0.5) * 5).toFixed(2) + 'deg');
      });
      c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
  }

  // ---- Tarjeta de indicador. Los textos son propios; lo que viene de una fuente se pasa ya escapado.
  // t = { titulo, que, grande, clase, contexto, extra (html), filas: [[nombre, detalle, valor, clase]], fuentes, ir }
  function tarjeta(el, t) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return;
    el.innerHTML = (t.titulo ? '<h3>' + t.titulo + '</h3>' : '') + '<p class="que">' + t.que + '</p>' +
      '<p class="grande ' + (t.clase || '') + '">' + t.grande + '</p><p class="contexto">' + (t.contexto || '') + '</p>' + (t.extra || '') +
      (t.filas && t.filas.length ? '<ul class="pa-filas">' + t.filas.filter(Boolean).map(f => '<li><span class="n">' + f[0] + (f[1] ? '<small>' + f[1] + '</small>' : '') + '</span><span class="v ' + (f[3] || '') + '">' + f[2] + '</span></li>').join('') + '</ul>' : '') +
      (t.fuentes || t.ir ? '<div class="pie"><span>' + (t.fuentes || '') + '</span><span>' + (t.ir || '') + '</span></div>' : '');
  }
  // Diferencia en puntos, coloreada según si subir es bueno o malo
  const pp = (d, mejorSiBaja = true, u = ' p.p.') => '<b class="' + (Math.abs(d) < 0.05 ? '' : (d < 0) === mejorSiBaja ? 'mejor' : 'peor') + '">' + signo(d, u.trim() === 'pb' ? 0 : 1) + u + '</b>';
  const fuente = (u, t) => '<a href="' + u + '" target="_blank" rel="noopener">' + t + ' ↗</a>';
  // Opciones comunes de Chart.js para los gráficos del panel
  const ejes = (fmtY, extra = {}) => Object.assign({
    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { color: '#9aa5b8', boxWidth: 12 } } },
    scales: { x: { ticks: { color: '#9aa5b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
              y: { ticks: { color: '#9aa5b8', callback: fmtY }, grid: { color: 'rgba(255,255,255,0.05)' } } },
  }, extra);

  // ---- Mapa de calor: un año por fila, un mes por columna
  function mapaCalor(el, serie, { escala = [0.5, 1, 1.5, 2, 3, 5, 8, 13], unidad = '%' } = {}) {
    if (!el || !serie || !serie.length) return;
    const nivel = v => { let k = 0; while (k < escala.length && v >= escala[k]) k++; return k; };
    const anios = [...new Set(serie.map(x => x.p.slice(0, 4)))];
    const por = Object.fromEntries(serie.map(x => [x.p, x.m]));
    el.innerHTML = '<div class="pa-calor" role="img" aria-label="Inflación de cada mes desde ' + anios[0] + '">' +
      '<span></span>' + MES.map(m => '<span class="cab">' + m + '</span>').join('') +
      anios.map(a => '<span class="anio">' + a + '</span>' + MES.map((m, i) => {
        const k = a + '-' + String(i + 1).padStart(2, '0'), v = por[k];
        return v == null ? '<span class="c vacia"></span>' : '<span class="c n' + nivel(v) + '" title="' + m + ' ' + a + ': ' + num(v) + unidad + '">' + num(v) + '</span>';
      }).join('')).join('') + '</div>' +
      '<div class="pa-calor-ley"><span>Menos</span>' + escala.concat([Infinity]).map((_, k) => '<i class="n' + k + '"></i>').join('') + '<span>Más</span></div>';
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

  // ---- Nombres largos en los ejes: en el celular se parten en renglones para que las barras tengan lugar
  function corte(t, max = 16) {
    if (!matchMedia('(max-width: 640px)').matches || t.length <= max) return t;
    const r = [];
    for (const p of t.split(' ')) { if (r.length && (r[r.length - 1] + ' ' + p).length <= max) r[r.length - 1] += ' ' + p; else r.push(p); }
    return r;
  }

  // ---- Botonera de opciones: <div class="pa-seg" data-seg><button data-v="12" aria-pressed="true">…</button>…</div>
  function seg(el, alCambiar) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return;
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.getAttribute('aria-pressed') === 'true') return;
      el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      alCambiar(b.dataset.v);
    });
  }

  // ---- Mapa de provincias con los límites del IGN. Tierra del Fuego incluye las Islas Malvinas, territorio argentino.
  // valores: { códigoINDEC: número }; info(cod) devuelve el detalle (html ya escapado) de la provincia elegida
  const COLOR = (v, max) => {
    const k = Math.min(1, Math.abs(v) / (max || 1));
    if (Math.abs(v) < 0.05) return 'rgba(255,255,255,0.09)';
    return v > 0 ? 'rgba(74,222,154,' + (0.18 + 0.72 * k).toFixed(2) + ')' : 'rgba(255,120,100,' + (0.18 + 0.72 * k).toFixed(2) + ')';
  };
  async function mapaProvincias(el, { valores, formato = v => signo(v) + '%', info, etiqueta = '' }) {
    if (typeof el === 'string') el = document.getElementById(el);
    const g = await API.geo();
    if (!el || !g || !g.provincias) return;
    // Al volver a dibujarlo (otro período) se reemplaza el contenedor para no duplicar los eventos
    if (el.dataset.mapa) { const n = el.cloneNode(false); el.replaceWith(n); el = n; }
    el.dataset.mapa = '1';
    // Tope de la escala de colores: el percentil 90, para que un caso extremo no deje a todas las demás del mismo tono
    const abs = Object.values(valores).filter(Number.isFinite).map(Math.abs).sort((a, b) => a - b);
    const max = abs[Math.floor(abs.length * 0.9)] || abs.at(-1) || 1;
    const nombre = Object.fromEntries(g.provincias.map(p => [p.cod, p.nombre]));
    const corto = c => (c === '02' ? 'CABA' : c === '94' ? 'Tierra del Fuego' : nombre[c]);
    const pv = (c, d) => '<path class="pv" data-cod="' + c + '" d="' + d + '" fill="' + COLOR(valores[c], max) + '" tabindex="0" role="button" aria-label="' + esc(corto(c) + ': ' + (Number.isFinite(valores[c]) ? formato(valores[c]) : 'sin dato')) + '"><title>' + esc(corto(c) + ': ' + (Number.isFinite(valores[c]) ? formato(valores[c]) : 'sin dato')) + '</title></path>';
    const ca = g.caba, m = g.malvinas;
    const orden = Object.keys(valores).filter(c => Number.isFinite(valores[c]) && nombre[c]).sort((a, b) => valores[b] - valores[a]);
    el.innerHTML = '<div class="pa-mapa"><div class="lamina"><svg viewBox="' + g.viewBox + '" role="img" aria-label="Mapa de la Argentina por provincia' + (etiqueta ? ': ' + esc(etiqueta) : '') + '">' +
      g.provincias.map(p => pv(p.cod, p.d)).join('') +
      '<line class="guia" x1="' + ca.desde[0].toFixed(1) + '" y1="' + ca.desde[1].toFixed(1) + '" x2="' + ca.x + '" y2="' + (ca.y + ca.h / 2) + '"/>' +
      '<rect class="recuadro" x="' + ca.x + '" y="' + ca.y + '" width="' + ca.w + '" height="' + ca.h + '" rx="6"/>' + pv('02', ca.d) +
      '<text class="rotulo" x="' + (ca.x + ca.w / 2) + '" y="' + (ca.y - 5) + '" text-anchor="middle">CABA</text>' +
      '<text class="rotulo" x="' + (m[0] + 52) + '" y="' + (m[1] + 3) + '">Islas Malvinas</text>' +
      '</svg></div><div class="lado"><div class="pa-mapa-info" aria-live="polite"></div>' +
      '<div class="pa-mapa-ley"><span>' + formato(-max) + ' o menos</span><i></i><span>' + formato(max) + ' o más</span></div>' +
      '<ul class="pa-rank">' + orden.map(c => { const v = valores[c], w = Math.min(50, Math.abs(v) / max * 50).toFixed(1);
        return '<li><button type="button" data-cod="' + c + '"><span>' + esc(corto(c)) + '</span><span class="v">' + esc(formato(v)) + '</span><span class="barra"><i style="' + (v >= 0 ? 'left:50%' : 'right:50%') + ';width:' + w + '%;background:' + COLOR(v, max) + '"></i></span></button></li>'; }).join('') +
      '</ul></div></div>';
    // En el celular la lista completa es muy larga: se ven las 3 que más subieron y las 3 que más bajaron
    if (matchMedia('(max-width: 760px)').matches && orden.length > 8) {
      const ul = el.querySelector('.pa-rank'); ul.classList.add('corta');
      ul.insertAdjacentHTML('afterend', '<button type="button" class="pa-mas-prov">Ver las ' + orden.length + ' provincias</button>');
      el.querySelector('.pa-mas-prov').addEventListener('click', e => { ul.classList.remove('corta'); e.currentTarget.remove(); });
    }
    const caja = el.querySelector('.pa-mapa-info');
    const elegir = c => {
      if (!nombre[c]) return;
      el.dataset.sel = c;
      el.querySelectorAll('[data-cod]').forEach(x => x.classList.toggle('sel', x.dataset.cod === c));
      const v = valores[c];
      caja.innerHTML = '<p class="n">' + esc(nombre[c]) + '</p><p class="g ' + (v > 0.05 ? 'mejor' : v < -0.05 ? 'peor' : '') + '">' + (Number.isFinite(v) ? esc(formato(v)) : '—') + '</p><p class="d">' + (info ? info(c) : '') + '</p>';
    };
    el.addEventListener('click', e => { const x = e.target.closest('[data-cod]'); if (x) elegir(x.dataset.cod); });
    el.addEventListener('keydown', e => { const x = e.target.closest('path[data-cod]'); if (x && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); elegir(x.dataset.cod); } });
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) el.addEventListener('pointerover', e => { const x = e.target.closest('path[data-cod]'); if (x) elegir(x.dataset.cod); });
    elegir(nombre[el.dataset.sel] ? el.dataset.sel : orden.includes('06') ? '06' : orden[0]);
  }

  return { API, json, esc, num, pesos, signo, fechaCorta, mesAnio, mesLargo, semCorto, variable, sparkline, franja, exportar, hoyISO, det, gobCols, brillo, mapaCalor, BANDERA, tarjeta, pp, fuente, ejes, seg, corte, mapaProvincias, corto, TEMAS, MES, MESES, DSEM, diasEntre };
})();
