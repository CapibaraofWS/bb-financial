// ============================================================
// CURVAS DE BONOS: hoy contra la rueda anterior, por grupo. La usa pages/visor-bonos-ar (solapa "Curvas").
// Pesos: /api/agenda?source=curvas (cálculos en api/_curvas.js). Dólares: los calcula la página y llegan con el evento bb:usd.
// Cada punto es un bono: el tamaño es lo operado, hueco si operó poco; el punto chico gris es su lugar en la rueda anterior.
// ============================================================
(function () {
  const raiz = document.getElementById('curvas-raiz');
  if (!raiz || typeof Chart === 'undefined') return;
  const $ = id => document.getElementById(id);
  const nf = (v, d = 2) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fecha = f => (f ? f.slice(8, 10) + '/' + f.slice(5, 7) + '/' + f.slice(0, 4) : '');
  const fCorta = f => (f ? f.slice(8, 10) + '/' + f.slice(5, 7) : '');
  const signo = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), d);
  const VERDE = '#4ade9a', CORAL = '#ff9f7a', GRIS = '#9aa5b8', TEXTO = '#e8edf5';
  const GRUPOS = {
    fija: { t: 'Tasa fija', eje: 'Tasa efectiva anual', que: 'Cuánto rinde por año cada LECAP, BONCAP y el Bonte 2030 si se mantiene hasta el vencimiento.' },
    cer: { t: 'CER', eje: 'Tasa real anual', que: 'Cuánto rinde por año por encima de la inflación (CER) cada bono si se mantiene hasta el vencimiento. Incluye los que pagan cupón y amortizan (TX28 y TX31).' },
    dl: { t: 'Dólar linked', eje: 'Tasa anual en dólares', que: 'Cuánto rinde por año en dólares cada bono atado al dólar oficial, si se mantiene hasta el vencimiento. El TMVE8 es dual TAMAR / dólar linked y va por su pata en dólares, como lo informa Finanzas.' },
    tamar: { t: 'TAMAR', eje: 'Margen sobre TAMAR', que: '' },
    duales: { t: 'Duales', eje: '', que: '' },
    usd: { t: 'En dólares', eje: 'TIR en dólares', que: 'TIR en dólares de los bonos soberanos y los BOPREAL, con precios en dólar MEP.' },
  };
  const est = { g: 'cer', x: 'dur', corto: true, pata: 'cer' };
  let D = null, USD = window.BBCurvasUSD || null, graf = null, gVol = null;

  raiz.innerHTML = '<div class="chart-wrap">' +
    '<div class="pa-seg cv-grupos" id="cv-grupos" role="group" aria-label="Grupo de bonos">' + Object.entries(GRUPOS).map(([k, g]) => '<button type="button" data-v="' + k + '" aria-pressed="' + (k === est.g) + '">' + g.t + '</button>').join('') + '</div>' +
    '<p class="cv-sub" id="cv-sub"></p><p class="cv-que" id="cv-que"></p>' +
    '<div class="pa-mini" id="cv-kpis"></div>' +
    '<div class="cv-ctrl"><div class="pa-seg" id="cv-x" role="group" aria-label="Eje horizontal"><button type="button" data-v="dur" aria-pressed="true">Duración</button><button type="button" data-v="dias" aria-pressed="false">Días al vencimiento</button></div>' +
    '<div class="pa-seg" id="cv-pata" role="group" aria-label="Qué pata de los duales" style="display:none"><button type="button" data-v="cer" aria-pressed="true">Pata CER</button><button type="button" data-v="tamar" aria-pressed="false">Pata TAMAR</button></div>' +
    '<label class="cv-check"><input type="checkbox" id="cv-corto" checked> Ocultar los que vencen en menos de 30 días</label></div>' +
    '<div class="cv-lienzo"><canvas id="cv-g" tabindex="0" role="img" aria-label="Curva de rendimientos de hoy y de la rueda anterior. Con las flechas del teclado se recorre bono por bono."></canvas></div>' +
    '<p class="cv-ley"><span><i style="background:' + VERDE + '"></i>La tasa bajó (el precio subió)</span><span><i style="background:' + CORAL + '"></i>La tasa subió</span><span><i style="background:' + GRIS + '"></i>Sin cambio</span>' +
    '<span><i style="border:1.5px solid ' + GRIS + ';background:none"></i>Rueda anterior o poco volumen</span><span><b class="cv-l1"></b>Curva de hoy</span><span><b class="cv-l2"></b>Curva anterior</span><span>Tamaño: lo operado</span></p>' +
    '<h3 class="cv-h">Lo operado en la rueda</h3><div class="cv-vol"><canvas id="cv-v" aria-label="Monto operado por bono"></canvas></div>' +
    '<div class="pa-tabla-wrap"><table class="pa-tabla cv-t" id="cv-t"></table></div>' +
    '<p class="cv-fuente" id="cv-fuente"></p></div>';

  // ---- Datos del grupo elegido, con el eje y la tasa que correspondan
  function filas() {
    const hoy = new Date().toISOString().slice(0, 10), dias = v => Math.round((Date.parse(v + 'T12:00:00Z') - Date.parse(hoy + 'T12:00:00Z')) / 864e5);
    let L = est.g === 'usd' ? (USD || []).map(b => ({ ...b, dias: dias(b.vence), poca: false })) : (D && D.grupos[est.g]) || [];
    if (est.g === 'duales' && est.pata === 'tamar') L = L.map(b => ({ ...b, tasa: b.tamarMargen, tasaAnt: b.tamarMargenAnt }));
    return L.filter(b => !(est.corto && b.dias < 30) && Number.isFinite(b.tasa)).map(b => ({ ...b, x: est.x === 'dur' ? b.dur : b.dias, y: b.tasa * 100,
      yAnt: Number.isFinite(b.tasaAnt) ? b.tasaAnt * 100 : null, dpb: Number.isFinite(b.tasaAnt) ? Math.round((b.tasa - b.tasaAnt) * 1e4) : null }));
  }
  const ejeY = () => (est.g === 'tamar' || (est.g === 'duales' && est.pata === 'tamar') ? 'Margen sobre TAMAR (puntos)' : est.g === 'duales' ? 'Tasa real anual de la pata CER (%)' : GRUPOS[est.g].eje + ' (%)');
  const unidadY = () => (/Margen/.test(ejeY()) ? ' p.' : '%');
  // Curva logarítmica (y = a + b·ln x) con los bonos que operaron normalmente
  function ajuste(P, k) {
    const v = P.filter(p => p.x > 0 && !p.poca && Number.isFinite(p[k]));
    if (v.length < 3) return [];
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const p of v) { const lx = Math.log(p.x); sx += lx; sy += p[k]; sxx += lx * lx; sxy += lx * p[k]; }
    const n = v.length, b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n, lo = Math.min(...v.map(p => p.x)), hi = Math.max(...v.map(p => p.x));
    return Number.isFinite(b) ? Array.from({ length: 48 }, (_, i) => { const x = lo * Math.pow(hi / lo, i / 47); return { x, y: a + b * Math.log(x) }; }) : [];
  }
  const color = p => (p.dpb == null || Math.abs(p.dpb) < 1 ? GRIS : p.dpb < 0 ? VERDE : CORAL);
  const millones = v => (est.g === 'usd' ? 'US$ ' + nf(v / 1e3, 0) + ' mil' : '$ ' + nf(v / 1e6, 0) + ' M');

  // ---- Lo que no hace Chart.js solo: la línea de cada bono a su lugar anterior y las etiquetas sin pisarse
  const extras = {
    id: 'cvExtras',
    beforeDatasetsDraw(ch) {
      const hoyM = ch.getDatasetMeta(3), antM = ch.getDatasetMeta(2), c = ch.ctx;
      c.save(); c.strokeStyle = 'rgba(154,165,184,0.45)'; c.lineWidth = 1; c.setLineDash([2, 2]);
      ch.data.datasets[3].data.forEach((p, i) => { const a = antM.data[i], b = hoyM.data[i]; if (a && b && p.yAnt != null && !a.skip) { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); } });
      c.restore();
    },
    afterDatasetsDraw(ch) {
      const meta = ch.getDatasetMeta(3), pts = ch.data.datasets[3].data, c = ch.ctx, area = ch.chartArea, cajas = [];
      const tope = ch.width < 520 ? 6 : 60, orden = pts.map((p, i) => i).sort((a, b) => (pts[b].operado || 0) - (pts[a].operado || 0));
      c.save(); c.font = '500 10.5px "DM Mono", monospace'; c.textBaseline = 'middle';
      for (const i of orden) {
        if (cajas.length >= tope) break;
        const el = meta.data[i], p = pts[i]; if (!el) continue;
        const sub = p.dpb != null && Math.abs(p.dpb) >= 1 ? (p.dpb > 0 ? '+' : '−') + Math.abs(p.dpb) + ' pb' : '';
        const w1 = c.measureText(p.sym).width, w = w1 + (sub ? c.measureText(' ' + sub).width : 0), h = 13, r = el.options.radius || 4;
        // A la derecha; si no entra, a la izquierda, arriba o abajo. Si todas chocan con otra etiqueta, el bono queda sin etiqueta
        const lugares = [[el.x + r + 4, el.y], [el.x - r - 4 - w, el.y], [el.x - w / 2, el.y - r - 9], [el.x - w / 2, el.y + r + 9]];
        let puesto = null;
        for (const [x, y] of lugares) {
          const caja = { x: x - 1, y: y - h / 2, w: w + 2, h };
          if (caja.x < area.left || caja.x + caja.w > area.right || caja.y < area.top || caja.y + h > area.bottom) continue;
          if (cajas.some(k => !(caja.x > k.x + k.w || caja.x + caja.w < k.x || caja.y > k.y + k.h || caja.y + caja.h < k.y))) continue;
          puesto = { x, y, caja }; break;
        }
        if (!puesto) continue;
        cajas.push(puesto.caja);
        c.fillStyle = TEXTO; c.fillText(p.sym, puesto.x, puesto.y);
        if (sub) { c.fillStyle = color(p); c.fillText(' ' + sub, puesto.x + w1, puesto.y); }
      }
      c.restore();
    },
  };

  function lineasTooltip(p) {
    const g = est.g, L = ['Vence el ' + fecha(p.vence) + ' (' + p.dias + ' días)', 'Precio: ' + (g === 'usd' ? 'US$ ' : '$ ') + nf(p.precio, p.precio < 1000 ? 2 : 0) + (Number.isFinite(p.variacion) ? ' (' + signo(p.variacion, 2) + '% en el día)' : '')];
    L.push(ejeY().replace(/ \(.*\)$/, '') + ': ' + nf(p.y, 2) + unidadY() + (p.dpb != null ? ' (' + (p.dpb > 0 ? '+' : p.dpb < 0 ? '−' : '') + Math.abs(p.dpb) + ' pb)' : ''));
    if (g === 'fija' && Number.isFinite(p.tem)) L.push('TEM ' + nf(p.tem * 100, 2) + '% · TNA ' + nf(p.tna * 100, 2) + '%');
    if (g === 'tamar' && Number.isFinite(p.tea)) L.push('Rinde ' + nf(p.tea * 100, 2) + '% anual si la TAMAR queda en ' + nf(D.tamar.supuesto, 2) + '%');
    if (g === 'duales') L.push(est.pata === 'cer' ? 'Pata TAMAR: margen de ' + nf(p.tamarMargen * 100, 2) + ' p. (' + nf(p.tamarTea * 100, 2) + '% anual)' : 'Pata CER: tasa real de ' + nf(p.tasaCer * 100, 2) + '%');
    if (p.dual) L.push('Dual TAMAR / dólar linked: acá, su pata en dólares');
    L.push('Duración: ' + nf(p.dur, 2) + ' años · Operado: ' + millones(p.operado || 0) + (p.poca ? ' (poco)' : ''));
    return L;
  }

  function pintar() {
    const g = est.g;
    $('cv-pata').style.display = g === 'duales' ? '' : 'none';
    $('cv-x').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === est.x)));
    const tam = D && D.tamar ? nf(D.tamar.supuesto, 2) + '%' : 'su promedio reciente';
    GRUPOS.tamar.que = 'Cuánto rinde cada bono por encima de la TAMAR, si la TAMAR se queda en ' + tam + ' (el promedio de sus últimos 7 días hábiles) hasta el vencimiento.';
    GRUPOS.duales.que = 'Pagan lo que más rinda entre el capital ajustado por CER y la TAMAR más 3%. La pata CER muestra la tasa real, como la informa Finanzas; la pata TAMAR, el margen sobre la TAMAR si se queda en ' + tam + '.';
    $('cv-que').textContent = GRUPOS[g].que;
    if (g === 'usd' && !USD) { $('cv-sub').textContent = 'Cargando los bonos en dólares…'; return; }
    if (g !== 'usd' && !D) return;
    $('cv-sub').textContent = D ? (D.vivo ? 'Precios de la rueda del ' + fecha(D.rueda) + ' contra el cierre del ' + fecha(D.ruedaAnterior) : 'Cierre del ' + fecha(D.rueda) + ' contra el del ' + fecha(D.ruedaAnterior)) : '';
    const P = filas().map(b => (est.g === 'duales' ? { ...b, tasaCer: (D.grupos.duales.find(x => x.sym === b.sym) || {}).tasa } : b));
    const maxVol = Math.max(1, ...P.map(p => p.operado || 0));
    const hoyDs = P.map(p => ({ ...p })), antDs = P.map(p => ({ x: p.x, y: p.yAnt }));

    // ---- Datos clave
    const con = P.filter(p => Number.isFinite(p.variacion)), suben = con.filter(p => p.variacion > 0).length, bajan = con.filter(p => p.variacion < 0).length;
    const dps = P.filter(p => !p.poca && p.dpb != null).map(p => p.dpb).sort((a, b) => a - b), med = dps.length ? dps[Math.floor((dps.length - 1) / 2)] : null;
    const orden = con.slice().sort((a, b) => b.variacion - a.variacion), mas = orden[0], menos = orden.at(-1);
    const caja = (t, v, s, col) => '<div><span>' + t + '</span><b' + (col ? ' style="color:' + col + '"' : '') + '>' + v + '</b><small>' + s + '</small></div>';
    $('cv-kpis').innerHTML = P.length ? caja('Precios', suben + ' suben · ' + bajan + ' bajan', 'de ' + con.length + ' bonos') +
      (med != null ? caja('Cambio típico de la tasa', (med > 0 ? '+' : med < 0 ? '−' : '') + Math.abs(med) + ' pb', 'mediana, sin los de poco volumen', med < 0 ? VERDE : med > 0 ? CORAL : '') : '') +
      (mas ? caja(mas.variacion > 0 ? 'El que más subió' : 'El que menos bajó', esc(mas.sym), signo(mas.variacion, 2) + '% de precio', mas.variacion > 0 ? VERDE : '') : '') +
      (menos && menos !== mas ? caja(menos.variacion < 0 ? 'El que más bajó' : 'El que menos subió', esc(menos.sym), signo(menos.variacion, 2) + '% de precio', menos.variacion < 0 ? CORAL : '') : '') : '';

    // ---- Gráfico
    const curvaHoy = ajuste(P, 'y'), curvaAnt = ajuste(P, 'yAnt');
    // El eje vertical se ajusta a los bonos, no a la curva (cerca del cero la curva logarítmica se va para abajo)
    const ys = P.flatMap(p => [p.y, p.yAnt]).filter(Number.isFinite), lo = Math.min(...ys), hi = Math.max(...ys), pad = Math.max(0.4, (hi - lo) * 0.1);
    const ds = [
      { type: 'line', label: 'Curva de hoy', data: curvaHoy, borderColor: 'rgba(232,237,245,0.85)', borderWidth: 2, pointRadius: 0, tension: 0, order: 4 },
      { type: 'line', label: 'Curva anterior', data: curvaAnt, borderColor: 'rgba(154,165,184,0.55)', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, tension: 0, order: 5 },
      { type: 'scatter', label: 'Rueda anterior', data: antDs, pointRadius: 3, pointBackgroundColor: 'rgba(0,0,0,0)', pointBorderColor: 'rgba(154,165,184,0.7)', pointBorderWidth: 1.2, order: 3 },
      { type: 'scatter', label: 'Hoy', data: hoyDs, order: 1, pointRadius: hoyDs.map(p => 4 + 8 * Math.sqrt((p.operado || 0) / maxVol)), pointHoverRadius: hoyDs.map(p => 6 + 8 * Math.sqrt((p.operado || 0) / maxVol)),
        pointBackgroundColor: hoyDs.map(p => (p.poca ? 'rgba(0,0,0,0)' : color(p))), pointBorderColor: hoyDs.map(color), pointBorderWidth: hoyDs.map(p => (p.poca ? 1.8 : 0)) },
    ];
    const opciones = {
      responsive: true, maintainAspectRatio: false, animation: { duration: 450 },
      layout: { padding: { right: 8, top: 6 } },
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        legend: { display: false },
        tooltip: { filter: it => it.datasetIndex === 3, backgroundColor: '#161b24', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, titleColor: TEXTO, bodyColor: '#c9d1dd', padding: 10, displayColors: false,
          titleFont: { family: '"DM Mono", monospace', size: 12 }, bodyFont: { size: 11.5 }, callbacks: { title: it => it[0].raw.sym + (it[0].raw.nombre ? ' · ' + it[0].raw.nombre : ''), label: it => lineasTooltip(it.raw) } },
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: est.x === 'dur' ? 'Duración modificada (años)' : 'Días al vencimiento', color: GRIS, font: { size: 11 } }, ticks: { color: GRIS }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { min: ys.length ? lo - pad : undefined, max: ys.length ? hi + pad : undefined, title: { display: true, text: ejeY(), color: GRIS, font: { size: 11 } }, ticks: { color: GRIS, callback: v => nf(v, 1) + unidadY() }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    };
    if (graf) { graf.data.datasets = ds; graf.options.scales = opciones.scales; graf.update(); }
    else graf = new Chart($('cv-g'), { type: 'scatter', data: { datasets: ds }, options: opciones, plugins: [extras] });

    // ---- Tira de volumen, en el orden de los vencimientos
    const porPlazo = P.slice().sort((a, b) => a.dias - b.dias);
    const vd = { labels: porPlazo.map(p => p.sym), datasets: [{ data: porPlazo.map(p => (p.operado || 0) / (g === 'usd' ? 1e3 : 1e6)), backgroundColor: porPlazo.map(p => (p.poca ? 'rgba(232,201,122,0.25)' : 'rgba(232,201,122,0.75)')), borderRadius: 3, maxBarThickness: 26 }] };
    if (gVol) { gVol.data = vd; gVol.options.scales.y.title.text = g === 'usd' ? 'Miles de US$' : 'Millones de $'; gVol.update(); }
    else gVol = new Chart($('cv-v'), { type: 'bar', data: vd, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 350 }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: it => millones(it.raw * (g === 'usd' ? 1e3 : 1e6)) } } },
      scales: { x: { ticks: { color: GRIS, font: { size: 10 }, maxRotation: 60, autoSkip: false }, grid: { display: false } }, y: { title: { display: true, text: g === 'usd' ? 'Miles de US$' : 'Millones de $', color: GRIS, font: { size: 10.5 } }, ticks: { color: GRIS, callback: v => nf(v, 0) }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });

    // ---- Tabla: de lo más operado a lo menos, con una nota que describe lo que pasó (sin sugerir qué hacer)
    const porVol = P.slice().sort((a, b) => (b.operado || 0) - (a.operado || 0)), q75 = porVol.length ? (porVol[Math.floor(porVol.length * 0.25)] || {}).operado || 0 : 0;
    const nota = p => { if (p.poca) return 'Poco volumen: el precio dice poco'; const alto = (p.operado || 0) >= q75 && (p.operado || 0) > 0;
      if (alto && p.variacion >= 0.5) return 'Subió con mucho volumen'; if (alto && p.variacion <= -0.5) return 'Bajó con mucho volumen'; if (alto && Math.abs(p.variacion) < 0.1) return 'Mucho volumen, precio quieto'; return ''; };
    const extraCol = g === 'fija' ? ['TEM', p => (Number.isFinite(p.tem) ? nf(p.tem * 100, 2) + '%' : '—')] : g === 'tamar' ? ['Rinde por año', p => nf(p.tea * 100, 2) + '%'] : g === 'duales' ? [est.pata === 'cer' ? 'Pata TAMAR' : 'Pata CER', p => (est.pata === 'cer' ? nf(p.tamarMargen * 100, 2) + ' p.' : nf(p.tasaCer * 100, 2) + '%')] : null;
    $('cv-t').innerHTML = '<thead><tr><th>Bono</th><th>Vence</th><th>Precio</th><th>En el día</th><th>' + esc(ejeY().replace(/ \(.*\)$/, '')) + '</th><th>Cambio</th>' + (extraCol ? '<th>' + extraCol[0] + '</th>' : '') + '<th>Duración</th><th>Operado</th><th>Nota</th></tr></thead><tbody>' +
      porVol.map(p => { const n = nota(p); return '<tr><td>' + esc(p.sym) + (p.dual ? ' <small>dual</small>' : '') + (p.cupon ? ' <small>con cupón</small>' : '') + '</td><td class="v">' + fCorta(p.vence) + '/' + p.vence.slice(2, 4) + '</td><td class="v">' + nf(p.precio, p.precio < 1000 ? 2 : 0) +
        '</td><td class="v" style="color:' + (p.variacion > 0 ? VERDE : p.variacion < 0 ? CORAL : GRIS) + '">' + (Number.isFinite(p.variacion) ? signo(p.variacion, 2) + '%' : '—') + '</td><td class="v">' + nf(p.y, 2) + unidadY() + '</td><td class="v" style="color:' + color(p) + '">' +
        (p.dpb == null ? '—' : (p.dpb > 0 ? '+' : p.dpb < 0 ? '−' : '') + Math.abs(p.dpb) + ' pb') + '</td>' + (extraCol ? '<td class="v">' + extraCol[1](p) + '</td>' : '') + '<td class="v">' + nf(p.dur, 2) + '</td><td class="v">' + millones(p.operado || 0) + '</td><td>' + (n ? '<span class="cv-nota">' + n + '</span>' : '—') + '</td></tr>'; }).join('') + '</tbody>';

    const hora = D ? new Date(D.asOf).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : '';
    $('cv-fuente').innerHTML = (g === 'usd' ? 'Fuente: precios en dólar MEP de BYMA vía data912; flujos de los prospectos. ' : 'Fuente: precios de BYMA vía data912; CER, TAMAR y dólar A3500 del BCRA; condiciones de emisión de la Secretaría de Finanzas y BYMA. Cálculos propios, controlados contra la TIREA oficial de 26 licitaciones de 2026. ') +
      (hora ? 'Último dato: ' + hora + ' h. ' : '') + 'Los que vencen en menos de 30 días pueden mostrar saltos grandes de tasa por movimientos chicos de precio. Información de referencia: los precios y las tasas cambian durante la rueda y pueden no cumplirse. No es una recomendación.';
  }

  // ---- Controles
  const seg = (id, fn) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); fn(b.dataset.v); });
  seg('cv-grupos', v => { est.g = v; pintar(); });
  seg('cv-x', v => { est.x = v; pintar(); });
  seg('cv-pata', v => { est.pata = v; pintar(); });
  $('cv-corto').addEventListener('change', e => { est.corto = e.target.checked; pintar(); });
  // Con el teclado: flechas para ir de bono en bono, en el orden del eje horizontal
  let foco = -1;
  $('cv-g').addEventListener('keydown', e => {
    if (!graf || !['ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) return;
    e.preventDefault();
    const pts = graf.data.datasets[3].data, idx = pts.map((p, i) => i).sort((a, b) => pts[a].x - pts[b].x);
    if (e.key === 'Escape' || !idx.length) { foco = -1; graf.setActiveElements([]); graf.tooltip.setActiveElements([], { x: 0, y: 0 }); graf.update(); return; }
    const k = idx.indexOf(foco); foco = idx[Math.max(0, Math.min(idx.length - 1, k < 0 ? 0 : k + (e.key === 'ArrowRight' ? 1 : -1)))];
    const el = graf.getDatasetMeta(3).data[foco], act = [{ datasetIndex: 3, index: foco }];
    graf.setActiveElements(act); graf.tooltip.setActiveElements(act, { x: el.x, y: el.y }); graf.update();
  });
  window.addEventListener('bb:usd', () => { USD = window.BBCurvasUSD; if (est.g === 'usd') pintar(); });

  fetch('/api/agenda?source=curvas', { signal: AbortSignal.timeout(30000) }).then(r => (r.ok ? r.json() : null)).catch(() => null).then(j => {
    if (!j || !j.grupos) { raiz.querySelector('.chart-wrap').insertAdjacentHTML('afterbegin', '<p class="news-error">No se pudieron cargar los precios. Probá de nuevo en un rato.</p>'); return; }
    D = j; pintar();
  });
})();
