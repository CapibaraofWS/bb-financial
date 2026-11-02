// ============================================================
// CALCULADORA DE ALQUILER. La usan pages/ajuste-alquiler y pages/alquiler-mini (la versión para insertar en otros sitios).
// Todo pasa en el navegador: lo que se carga no se envía a ningún lado, salvo que la persona elija compartirlo.
// ============================================================
window.BBAlquiler = (function () {
  const P = window.BBPanel, $ = id => document.getElementById(id), num = P.num, pesos = P.pesos;
  const SITIO = 'https://www.bbfinanzas.com.ar/pages/ajuste-alquiler';
  // diario: el valor del día 1 de cada mes. rezago: meses entre el dato y el ajuste cuando se toman los últimos publicados.
  const INDICES = {
    ipc: { t: 'IPC', largo: 'Inflación del INDEC', rezago: 2, re: /^Índice de precios al consumidor/i, fuente: 'INDEC, Índice de precios al consumidor', web: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31', color: '#e8c97a' },
    icl: { t: 'ICL', largo: 'Índice para Contratos de Locación del Banco Central', diario: true, fuente: 'BCRA, Índice para Contratos de Locación', web: 'https://www.bcra.gob.ar/estadisticas-indicadores/', color: '#60a5fa' },
    cer: { t: 'CER', largo: 'Coeficiente de Estabilización de Referencia del Banco Central', diario: true, fuente: 'BCRA, Coeficiente de Estabilización de Referencia', web: 'https://www.bcra.gob.ar/estadisticas-indicadores/', color: '#a78bfa' },
    uva: { t: 'UVA', largo: 'Unidad de Valor Adquisitivo del Banco Central', diario: true, fuente: 'BCRA, Unidad de Valor Adquisitivo', web: 'https://www.bcra.gob.ar/estadisticas-indicadores/', color: '#ff9f7a' },
    is: { t: 'Salarios', largo: 'Índice de salarios del INDEC', rezago: 3, re: /^Índice de salarios/i, fuente: 'INDEC, Índice de salarios', web: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-31-61', color: '#4ade9a' },
    ripte: { t: 'RIPTE', largo: 'Remuneración promedio de los trabajadores estables, de la Secretaría de Trabajo', rezago: 3, fuente: 'Secretaría de Trabajo, RIPTE', web: 'https://www.argentina.gob.ar/trabajo/seguridadsocial/ripte', color: '#f472b6' },
    ipim: { t: 'IPIM', largo: 'Precios mayoristas del INDEC', rezago: 2, re: /precios mayoristas/i, fuente: 'INDEC, Sistema de índices de precios mayoristas', web: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-32', color: '#e8edf5' },
    icc: { t: 'ICC', largo: 'Índice del costo de la construcción del INDEC. No es el índice de la Cámara de la Construcción (CAC)', rezago: 2, re: /costo de la construcción/i, fuente: 'INDEC, Índice del costo de la construcción', web: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-33', color: '#22d3ee' },
  };
  const CADA = [1, 2, 3, 4, 6, 12];
  const datos = {}, hoy = P.hoyISO().slice(0, 7), anioHoy = +hoy.slice(0, 4), est = { cada: 3, indice: 'ipc', modo: 'publicados', base: 'actual' };
  let cal = null, resultado = null, resVisible = true;

  const sumar = (ym, n) => { const [y, m] = ym.split('-').map(Number), t = y * 12 + m - 1 + n; return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0'); };
  const mes = ym => P.mesLargo(ym), Mes = ym => mes(ym).replace(/^./, c => c.toUpperCase());
  const dia = f => (+f.slice(8)) + ' de ' + P.MESES[+f.slice(5, 7) - 1];

  const PLANTILLA = `
    <section class="pf-card aq-form" aria-label="Datos del contrato">
      <label class="pf-label" for="aq-monto">Alquiler actual, por mes</label>
      <div class="pf-monto"><span aria-hidden="true">$</span><input id="aq-monto" type="text" inputmode="numeric" autocomplete="off" value="500.000" /></div>
      <span class="pf-label aq-sep" id="aq-inicio-t">Inicio del contrato</span>
      <div class="aq-sel" role="group" aria-labelledby="aq-inicio-t"><select id="aq-mes" aria-label="Mes"></select><select id="aq-anio" aria-label="Año"></select></div>
      <span class="pf-label" id="aq-cada-t">Cada cuántos meses ajusta</span>
      <div class="pa-seg aq-chips" id="aq-cada" role="group" aria-labelledby="aq-cada-t">${CADA.map(n => '<button type="button" data-v="' + n + '" aria-pressed="false">' + n + '</button>').join('')}</div>
      <span class="pf-label aq-sep" id="aq-ind-t">Índice del contrato</span>
      <div class="pa-seg aq-chips" id="aq-indice" role="group" aria-labelledby="aq-ind-t">${Object.entries(INDICES).map(([k, I]) => '<button type="button" data-v="' + k + '" aria-pressed="false">' + I.t + '</button>').join('')}</div>
      <p class="aq-nota" id="aq-ind-n"></p>
      <details class="aq-op">
        <summary>Más opciones</summary>
        <span class="pf-label aq-sep" id="aq-base-t">El monto que cargué es</span>
        <div class="pa-seg" id="aq-base" role="group" aria-labelledby="aq-base-t"><button type="button" data-v="actual" aria-pressed="true">El de hoy</button><button type="button" data-v="inicial" aria-pressed="false">El del inicio</button></div>
        <p class="aq-nota" id="aq-base-n"></p>
        <div id="aq-modo-f">
          <span class="pf-label aq-sep" id="aq-modo-t">Qué meses cuenta</span>
          <div class="pa-seg" id="aq-modo" role="group" aria-labelledby="aq-modo-t"><button type="button" data-v="publicados" aria-pressed="true">Los últimos publicados</button><button type="button" data-v="periodo" aria-pressed="false">El período completo</button></div>
          <p class="aq-nota" id="aq-modo-n"></p>
        </div>
      </details>
    </section>
    <section class="pf-card aq-res" aria-live="polite">
      <p class="aq-estado"><span id="aq-estado">Cargando los datos…</span> <span class="aq-sello" id="aq-sello" hidden></span></p>
      <p class="aq-num" id="aq-num">—</p>
      <p class="aq-txt" id="aq-txt"></p>
      <p class="aq-prox" id="aq-prox"></p>
      <div class="aq-cal" id="aq-cal" role="img"></div>
      <div class="aq-ley" aria-hidden="true"><span><i class="c1"></i>Toca ajuste</span><span><i class="c2"></i>Ya ajustó</span><span><i class="c3"></i>Inicio</span><span><i class="c4"></i>Este mes</span></div>
      <details class="aq-mas" id="aq-mas">
        <summary>Ver la cuenta</summary>
        <div class="aq-cuenta" id="aq-cuenta"></div>
        <p class="aq-nota" id="aq-nota"></p>
        <ul class="aq-pasos" id="aq-pasos"></ul>
        <p class="aq-nota" id="aq-fuente"></p>
      </details>
      <div class="aq-comp" id="aq-comp" hidden>
        <button type="button" data-c="wpp">WhatsApp</button><button type="button" data-c="x">X</button><button type="button" data-c="img">Imagen</button><button type="button" data-c="copiar">Copiar enlace</button><button type="button" data-c="mas" hidden>Compartir</button>
      </div>
    </section>
    <button type="button" class="aq-barra" id="aq-barra" hidden><span id="aq-barra-t"></span><b id="aq-barra-n"></b></button>`;

  // Una fila de cajitas por año: el inicio, los ajustes pasados y los que vienen
  function calendario(inicio, n) {
    const hasta = (anioHoy + 1) + '-12', ajustes = new Set();
    for (let a = sumar(inicio, n); a <= hasta; a = sumar(a, n)) ajustes.add(a);
    const filas = [];
    for (let y = Math.max(+inicio.slice(0, 4), anioHoy - 1); y <= anioHoy + 1; y++) {
      filas.push('<div class="aq-fila-cal"><b>' + y + '</b>' + P.MES.map((m, i) => {
        const p = y + '-' + String(i + 1).padStart(2, '0'), c = ajustes.has(p) ? (p < hoy ? 'hecho' : 'ajuste') : '';
        return '<span class="aq-m ' + c + (p === hoy ? ' hoy' : '') + (p === inicio ? ' desde' : '') + '" title="' + Mes(p) + '">' + m.charAt(0).toUpperCase() + '</span>';
      }).join('') + '</div>');
    }
    $('aq-cal').innerHTML = filas.join('');
    $('aq-cal').setAttribute('aria-label', 'Meses de ajuste: ' + [...ajustes].filter(a => a >= hoy).slice(0, 3).map(mes).join(', '));
  }

  const monto = () => Number($('aq-monto').value.replace(/\D/g, '')) || 0;
  const inicio = () => $('aq-anio').value + '-' + $('aq-mes').value;

  function pone({ estado, sello = '', g = '—', txt = '', prox = '', cuenta = '', nota = '', pasos = '', fuente = '' }) {
    $('aq-estado').textContent = estado; $('aq-num').textContent = g; $('aq-txt').textContent = txt; $('aq-prox').textContent = prox;
    $('aq-sello').textContent = sello; $('aq-sello').hidden = !sello; $('aq-sello').className = 'aq-sello ' + (sello === 'Definitivo' ? 'si' : 'no');
    $('aq-cuenta').innerHTML = cuenta; $('aq-cuenta').hidden = !cuenta; $('aq-nota').textContent = nota; $('aq-pasos').innerHTML = pasos; $('aq-fuente').innerHTML = fuente;
    $('aq-mas').hidden = !cuenta && !nota;
    $('aq-comp').hidden = !resultado;
    $('aq-barra-t').textContent = estado; $('aq-barra-n').textContent = g;
    verBarra();
  }
  // En el celular el resultado queda abajo del formulario: mientras no se ve, una barra lo muestra
  const verBarra = () => { $('aq-barra').hidden = resVisible || !resultado; };

  function calcular() {
    const n = est.cada, I = INDICES[est.indice], serie = datos[est.indice] || {}, M = monto(), ini = inicio(), claves = Object.keys(serie).sort(), fin = claves.at(-1);
    const diario = !!I.diario;
    $('aq-ind-n').textContent = I.t + ': ' + I.largo + '.';
    $('aq-modo-f').hidden = diario;
    $('aq-modo-n').textContent = est.modo === 'publicados' ? 'Para un ajuste de abril usa el último dato ya publicado el 1 de abril.' : 'Para un ajuste de abril cuenta enero, febrero y marzo: el número se conoce cuando sale marzo.';
    $('aq-base-n').textContent = est.base === 'actual' ? 'Calcula el próximo ajuste sobre lo que se paga hoy.' : 'Hace todos los ajustes desde el inicio del contrato, uno atrás del otro.';
    resultado = null;
    if (ini <= hoy) calendario(ini, n); else $('aq-cal').innerHTML = '';
    if (!fin) return pone({ estado: 'Sin datos', txt: 'No se pudo cargar este índice. Probá de nuevo en un rato.' });
    if (!M) return pone({ estado: 'Falta el monto', txt: 'Cargá el alquiler por mes.' });
    if (ini > hoy) return pone({ estado: 'Revisá la fecha', txt: 'El contrato todavía no empezó. Elegí un mes de hoy para atrás.' });
    if (est.base === 'inicial' && ini < claves[0]) return pone({ estado: 'Revisá la fecha', txt: 'Este índice tiene datos desde ' + mes(claves[0]) + '.' });
    // Mes de inicio y de fin del índice para un ajuste en el mes a
    const ventana = a => (diario ? [sumar(a, -n), a] : est.modo === 'publicados' ? [sumar(a, -n - I.rezago), sumar(a, -I.rezago)] : [sumar(a, -n - 1), sumar(a, -1)]);
    const meses = (d, h) => { const L = []; for (let x = sumar(d, 1); x <= h; x = sumar(x, 1)) if (serie[x] && serie[sumar(x, -1)]) L.push(P.MES[+x.slice(5) - 1] + ' ' + P.signo((serie[x] / serie[sumar(x, -1)] - 1) * 100) + '%'); return L.join(' · '); };
    const cuenta = (base, d, h) => '<b>' + pesos(base) + ' × ' + num(serie[h], 2) + ' ÷ ' + num(serie[d], 2) + ' = ' + pesos(base * serie[h] / serie[d]) + '</b>' + (diario ? I.t + ' del 1 de ' + mes(h) + ' ÷ ' + I.t + ' del 1 de ' + mes(d) : 'Índice de ' + mes(h) + ' ÷ índice de ' + mes(d) + (n > 1 ? '. Mes a mes: ' + P.esc(meses(d, h)) : ''));
    // Con el alquiler de hoy, el primer ajuste que importa es el de este mes o el siguiente. Con el inicial, se recorren todos.
    let a = sumar(ini, n);
    if (est.base === 'actual') while (a < hoy) a = sumar(a, n);
    let actual = M; const pasos = [];
    while (a <= hoy) {
      const [d, h] = ventana(a);
      if (!serie[d] || !serie[h]) break;
      const antes = actual; actual *= serie[h] / serie[d];
      pasos.push({ a, f: serie[h] / serie[d], antes, actual, d, h });
      a = sumar(a, n);
    }
    const lista = pasos.length > 1 ? '<li class="tit"><span>Ajuste por ajuste</span><span></span></li>' + pasos.map(p => '<li><span>' + Mes(p.a) + ' · ' + P.signo((p.f - 1) * 100) + '%</span><span>' + pesos(p.actual) + '</span></li>').join('') : '';
    const fuente = 'Fuente: <a href="' + I.web + '" target="_blank" rel="noopener">' + I.fuente + '</a>, datos hasta ' + mes(fin) + '.';
    const u = pasos.at(-1), [d, h] = ventana(a), completo = serie[d] && serie[h], hasta = fin < h ? fin : h, parcial = !completo && serie[d] && hasta > d ? serie[hasta] / serie[d] : null;
    const ev = I.re && cal && cal.eventos && cal.eventos.find(e => I.re.test(e.titulo) && e.fecha >= P.hoyISO());
    const falta = diario ? 'Falta el ' + I.t + ' del 1 de ' + mes(h) + '.' : 'Falta el dato de ' + mes(sumar(fin, 1)) + '.';
    const cuando = diario ? 'El Banco Central lo publica a mediados del mes anterior.' : ev ? 'Sale el ' + dia(ev.fecha) + '.' : '';
    const sobre = (f, base) => 'Sube ' + num((f - 1) * 100) + '%: son ' + pesos(base * f - base) + ' más por mes.';
    const yaSe = diario ? 'Es definitivo: el Banco Central publica este índice por adelantado.' : 'Es definitivo: ese dato ya está publicado.';
    const cierre = (titulo, valor, f) => { resultado = { titulo, valor, f, indice: I.t }; };

    // 1. Este mes toca ajuste
    if (u && u.a === hoy) {
      cierre('Ajuste de ' + mes(hoy), u.actual, u.f);
      return pone({ estado: 'En ' + mes(hoy) + ' toca ajuste', sello: 'Definitivo', g: pesos(u.actual), txt: sobre(u.f, u.antes), prox: 'Próximo ajuste: ' + mes(a) + '.', cuenta: cuenta(u.antes, u.d, u.h), nota: yaSe + (est.base === 'actual' ? ' Si ya cobraste este aumento, cargá el monto anterior.' : ''), pasos: lista, fuente });
    }
    // 2. Ya llegó el mes del ajuste, pero falta el dato
    if (a <= hoy) {
      if (parcial) cierre('Ajuste de ' + mes(a) + ' (provisorio)', actual * parcial, parcial);
      return pone({ estado: 'En ' + mes(a) + ' toca ajuste', sello: 'Provisorio', g: parcial ? pesos(actual * parcial) : '—', txt: parcial ? 'Por ahora sube ' + num((parcial - 1) * 100) + '%.' : falta, prox: parcial ? falta + ' ' + cuando : cuando, cuenta: parcial ? cuenta(actual, d, hasta) : '', nota: 'Cuando salga el dato, el número se actualiza solo.', pasos: lista, fuente });
    }
    // 3. El próximo ajuste está por venir
    const previo = u ? 'Hoy corresponde ' + pesos(actual) + '. ' : '';
    if (completo) {
      const f = serie[h] / serie[d];
      cierre('Ajuste de ' + mes(a), actual * f, f);
      return pone({ estado: 'Próximo ajuste: ' + mes(a), sello: 'Definitivo', g: pesos(actual * f), txt: sobre(f, actual), prox: previo, cuenta: cuenta(actual, d, h), nota: yaSe, pasos: lista, fuente });
    }
    if (parcial) {
      cierre('Ajuste de ' + mes(a) + ' (provisorio)', actual * parcial, parcial);
      return pone({ estado: 'Próximo ajuste: ' + mes(a), sello: 'Provisorio', g: pesos(actual * parcial), txt: 'Por ahora sube ' + num((parcial - 1) * 100) + '%.', prox: previo + falta + ' ' + cuando, cuenta: cuenta(actual, d, hasta), nota: 'Cuando salga el dato, el número se actualiza solo.', pasos: lista, fuente });
    }
    return pone({ estado: 'Próximo ajuste: ' + mes(a), g: pesos(actual), txt: 'Todavía no se publicó ningún dato de ese período.', prox: previo + cuando, pasos: lista, fuente });
  }

  // ---- Enlace con los datos cargados: en el fragmento (#), que no viaja a ningún servidor al abrirlo
  const enlace = () => SITIO + '#' + new URLSearchParams({ monto: monto(), inicio: inicio(), cada: est.cada, indice: est.indice, base: est.base, modo: est.modo });
  function leerEnlace() {
    const q = new URLSearchParams((location.hash || '').slice(1));
    if (+q.get('monto') > 0) $('aq-monto').value = Math.floor(Math.min(+q.get('monto'), 1e10)).toLocaleString('es-AR');
    const f = q.get('inicio'); if (/^20\d\d-(0[1-9]|1[0-2])$/.test(f || '') && f >= '2020-01' && f <= hoy) { $('aq-mes').value = f.slice(5); $('aq-anio').value = f.slice(0, 4); }
    if (CADA.includes(+q.get('cada'))) est.cada = +q.get('cada');
    if (Object.hasOwn(INDICES, q.get('indice') || '')) est.indice = q.get('indice');
    if (['actual', 'inicial'].includes(q.get('base'))) est.base = q.get('base');
    if (['publicados', 'periodo'].includes(q.get('modo'))) est.modo = q.get('modo');
  }
  const marcar = (id, v) => $(id).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));

  const textoCompartir = () => resultado.titulo + ': el alquiler queda en ' + pesos(resultado.valor) + ' (+' + num((resultado.f - 1) * 100) + '% por ' + resultado.indice + ').';
  function imagen() {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1080;
    const x = c.getContext('2d'), M_ = 90;
    x.fillStyle = '#0a0c0f'; x.fillRect(0, 0, 1080, 1080);
    x.fillStyle = '#4ade9a'; x.font = '500 40px Outfit, Arial, sans-serif'; x.fillText('Calculadora de alquiler', M_, 170);
    x.fillStyle = '#9aa5b8'; x.font = '400 46px Outfit, Arial, sans-serif'; x.fillText(resultado.titulo, M_, 330);
    x.fillStyle = '#e8edf5'; x.font = '400 150px "DM Serif Display", Georgia, serif'; x.fillText(pesos(resultado.valor), M_, 520, 900);
    x.fillStyle = '#9aa5b8'; x.font = '400 46px Outfit, Arial, sans-serif'; x.fillText('Sube ' + num((resultado.f - 1) * 100) + '% por ' + resultado.indice, M_, 620);
    x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(M_, 880, 900, 2);
    x.fillStyle = '#4ade9a'; x.font = '500 44px Outfit, Arial, sans-serif'; x.fillText('bbfinanzas.com.ar', M_, 960);
    x.fillStyle = '#9aa5b8'; x.font = '400 30px Outfit, Arial, sans-serif'; x.fillText('Cuenta orientativa: vale lo que dice el contrato.', M_, 1010);
    return new Promise(ok => c.toBlob(ok, 'image/png'));
  }
  async function compartir(accion, boton) {
    if (!resultado) return;
    const url = enlace(), txt = textoCompartir();
    if (window.bbTrack) window.bbTrack('alquiler_compartir', { canal: accion });
    if (accion === 'wpp') return void window.open('https://wa.me/?text=' + encodeURIComponent(txt + ' ' + url), '_blank', 'noopener');
    if (accion === 'x') return void window.open('https://x.com/intent/post?text=' + encodeURIComponent(txt) + '&url=' + encodeURIComponent(url), '_blank', 'noopener');
    if (accion === 'copiar') {
      try { await navigator.clipboard.writeText(url); boton.textContent = 'Copiado'; setTimeout(() => { boton.textContent = 'Copiar enlace'; }, 1800); } catch (e) { prompt('Copiá este enlace:', url); }
      return;
    }
    if (accion === 'mas') { try { await navigator.share({ text: txt, url }); } catch (e) {} return; }
    const b = await imagen(); if (!b) return;
    const archivo = new File([b], 'alquiler-bb-finanzas.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) { try { await navigator.share({ files: [archivo], text: txt }); } catch (e) {} return; }
    const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = archivo.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000);
  }

  // ---- Lo que subió cada índice: tarjetas y gráfico (solo en la página principal)
  let grafico = null, plazo = 12;
  function resumen() {
    const caja = $('aq-cards'); if (!caja) return;
    const filas = Object.entries(INDICES).map(([k, I]) => { const s = datos[k] || {}, u = Object.keys(s).sort().filter(p => p <= sumar(hoy, 1)).at(-1), a = u && sumar(u, -12); return u && s[a] ? { I, v: (s[u] / s[a] - 1) * 100, u } : null; }).filter(Boolean);
    if (!filas.length) return;
    caja.innerHTML = filas.map(f => '<div><span>' + f.I.t + '</span><b>' + P.signo(f.v) + '%</b><small>12 meses a ' + P.mesAnio(f.u) + '</small></div>').join('');
    if (typeof Chart === 'undefined' || !$('g-aq')) return;
    const m0 = sumar(hoy, -plazo), L = []; for (let m = m0; m <= hoy; m = sumar(m, 1)) L.push(m);
    const ds = Object.entries(INDICES).filter(([k]) => datos[k] && datos[k][m0]).map(([k, I]) => ({ label: I.t, data: L.map(m => (datos[k][m] ? (datos[k][m] / datos[k][m0] - 1) * 100 : null)), borderColor: I.color, backgroundColor: I.color, borderWidth: 2, pointRadius: 0, tension: 0.2 }));
    if (grafico) grafico.destroy();
    grafico = new Chart($('g-aq'), { type: 'line', data: { labels: L.map(P.mesAnio), datasets: ds }, options: P.ejes(v => v + '%', { plugins: { legend: { labels: { color: '#9aa5b8', boxWidth: 12 } }, tooltip: { callbacks: { label: c => (c.parsed.y == null ? null : c.dataset.label + ': ' + P.signo(c.parsed.y) + '%') } } } }) });
  }

  async function montar({ raiz, abrirCuenta = false } = {}) {
    $(raiz).innerHTML = PLANTILLA;
    const ini = sumar(hoy, -3);
    $('aq-mes').innerHTML = P.MESES.map((m, i) => '<option value="' + String(i + 1).padStart(2, '0') + '">' + m.replace(/^./, c => c.toUpperCase()) + '</option>').join('');
    for (let y = anioHoy; y >= 2020; y--) $('aq-anio').insertAdjacentHTML('beforeend', '<option value="' + y + '">' + y + '</option>');
    $('aq-mes').value = ini.slice(5); $('aq-anio').value = ini.slice(0, 4);
    leerEnlace();
    marcar('aq-cada', est.cada); marcar('aq-indice', est.indice); marcar('aq-base', est.base); marcar('aq-modo', est.modo);
    if (abrirCuenta) $('aq-mas').open = true;
    $('aq-monto').addEventListener('input', e => { const v = monto(); e.target.value = v ? Math.min(v, 1e10).toLocaleString('es-AR') : ''; calcular(); });
    ['aq-mes', 'aq-anio'].forEach(id => $(id).addEventListener('change', calcular));
    P.seg('aq-cada', v => { est.cada = +v; calcular(); });
    P.seg('aq-indice', v => { est.indice = v; calcular(); });
    P.seg('aq-base', v => { est.base = v; calcular(); });
    P.seg('aq-modo', v => { est.modo = v; calcular(); });
    if (navigator.share) $('aq-comp').querySelector('[data-c="mas"]').hidden = false;
    $('aq-comp').addEventListener('click', e => { const b = e.target.closest('button'); if (b) compartir(b.dataset.c, b); });
    if ($('s-aq')) P.seg('s-aq', v => { plazo = +v; resumen(); });
    $('aq-barra').addEventListener('click', () => $('aq-estado').scrollIntoView({ behavior: 'smooth', block: 'center' }));
    new IntersectionObserver(e => { resVisible = e[0].isIntersecting; verBarra(); }, { rootMargin: '0px 0px -30% 0px' }).observe($('aq-num'));

    // Lo que hace falta primero; lo demás se suma cuando llega
    const aMapa = L => Object.fromEntries(L);
    const [rIpc, rBc, rCal] = await Promise.all([P.API.ipc(), P.json('/api/bcra?endpoint=ICL'), P.API.calendario()]);
    cal = rCal;
    datos.ipc = Object.fromEntries(((rIpc && rIpc.general) || []).map(x => [x.p, x.i]));
    if (rBc) { datos.icl = aMapa(rBc.meses || []); if (rBc.cer) datos.cer = aMapa(rBc.cer); if (rBc.uva) datos.uva = aMapa(rBc.uva); }
    calcular(); resumen();
    const [rOtros, rSal] = await Promise.all([P.API.otrosPrecios(), P.API.salarios()]);
    if (rOtros && rOtros.mayoristas) datos.ipim = aMapa(rOtros.mayoristas.general);
    if (rOtros && rOtros.construccion) datos.icc = aMapa(rOtros.construccion.general);
    if (rSal && rSal.indice) datos.is = Object.fromEntries(rSal.indice.filter(x => x.total > 0).map(x => [x.p, x.total]));
    if (rSal && rSal.ripte) datos.ripte = Object.fromEntries(rSal.ripte.map(x => [x.p, x.v]));
    calcular(); resumen();
  }
  return { montar };
})();
