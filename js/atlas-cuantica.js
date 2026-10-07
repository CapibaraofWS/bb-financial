/* Atlas · Computación cuántica: interactivos de la página.
   Los juegos son simplificaciones para entender la idea (ver "Fuentes" en la página).
   Datos: Google Quantum AI, IBM, Caltech, Qureca, McKinsey, NIST y prensa especializada. Son aproximados. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const BASE = '../../';
  const REDUCIR = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const track = (ev, p) => window.bbTrack && window.bbTrack(ev, p);
  const num = (v, d) => v.toLocaleString('es-AR', { maximumFractionDigits: d == null ? 1 : d });
  const azar = n => Math.floor(Math.random() * n);

  // Grupo de botones donde uno solo queda marcado
  function grupo(sel, fn) {
    const bs = $$(sel);
    bs.forEach((b, i) => b.addEventListener('click', () => {
      bs.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      fn(b, i);
    }));
    return bs;
  }

  // ============ 1. El qubit: preparar y medir ============
  function qubit() {
    const r = $('#qx-theta'); if (!r) return;
    const aguja = $('#qx-aguja'), P = $$('#qx-prob .t'), res = $('#qx-res'), T = $('#qx-qubit-t'), bit = $('#qx-bit');
    let c0 = 0, c1 = 0, medido = null;
    // La aguja a 0° apunta al 0 y a 180° al 1: la chance de que salga 1 es sen²(ángulo/2)
    const p1 = () => Math.pow(Math.sin(r.value * Math.PI / 360), 2);
    const cuenta = () => 'Hasta ahora: <b>' + c0 + '</b> ' + (c0 === 1 ? 'cero' : 'ceros') + ' y <b>' + c1 + '</b> ' + (c1 === 1 ? 'uno' : 'unos') + '.';
    function preparar(msj) {
      medido = null;
      aguja.style.transform = 'rotate(' + r.value + 'deg)';
      const b = p1();
      [1 - b, b].forEach((v, i) => { P[i].querySelector('i').style.width = (v * 100) + '%'; P[i].querySelector('span').textContent = Math.round(v * 100) + '%'; });
      res.textContent = '?'; res.className = 'qx-res';
      if (msj !== false) T.innerHTML = +r.value === 0 || +r.value === 180 ? 'Así es un bit común: siempre da lo mismo. Mové la barra al medio.' : 'El qubit está en superposición: es una mezcla de 0 y 1. Medilo.';
    }
    r.addEventListener('input', () => { c0 = c1 = 0; preparar(); });
    $('#qx-medir').addEventListener('click', () => {
      if (medido !== null) { T.innerHTML = '<b>Sale ' + medido + ' otra vez.</b> Al medir, la mezcla se perdió: ahora es un ' + medido + ' común. Para repetir el experimento hay que prepararlo de nuevo.'; return; }
      medido = Math.random() < p1() ? 1 : 0;
      medido ? c1++ : c0++;
      aguja.style.transform = 'rotate(' + (medido ? 180 : 0) + 'deg)';
      res.textContent = medido; res.className = 'qx-res v' + medido;
      T.innerHTML = '<b>Salió ' + medido + '.</b> La aguja "cayó" a ese lado y la superposición desapareció. ' + cuenta();
      track('atlas_q_medir', { ang: +r.value });
    });
    $('#qx-medir100').addEventListener('click', () => {
      const b = p1();
      for (let i = 0; i < 100; i++) (Math.random() < b ? c1++ : c0++);
      preparar(false);
      res.textContent = '×100'; res.className = 'qx-res';
      T.innerHTML = 'Preparado y medido 100 veces más. ' + cuenta() + ' Una sola medición no te dice nada; recién con muchas aparece la proporción.';
      track('atlas_q_medir100', { ang: +r.value });
    });
    $('#qx-prep').addEventListener('click', () => preparar());
    bit.addEventListener('click', () => { bit.textContent = bit.textContent === '0' ? '1' : '0'; bit.classList.toggle('uno', bit.textContent === '1'); });
    preparar();

    // Dos qubits: sueltos o entrelazados
    const A = $('#qx-par-a'), B = $('#qx-par-b'), lazo = $('#qx-par-lazo'), X = $('#qx-par-t');
    let ent = 0, n = 0, ig = 0;
    function par(veces) {
      let a, b;
      for (let i = 0; i < veces; i++) { a = azar(2); b = ent ? a : azar(2); n++; if (a === b) ig++; }
      A.textContent = a; B.textContent = b; A.className = 'v' + a; B.className = 'v' + b;
      X.innerHTML = '<b>Coincidieron ' + ig + ' de ' + n + '.</b> ' + (ent ? 'Cada resultado es al azar, pero los dos dan siempre lo mismo, estén donde estén.' : 'Más o menos la mitad: pura casualidad, como tirar dos monedas.');
    }
    grupo('[data-par]', b => { ent = +b.dataset.par; n = ig = 0; A.textContent = B.textContent = '?'; A.className = B.className = ''; lazo.classList.toggle('on', !!ent); X.textContent = ent ? 'Ahora están atados. Medí de nuevo.' : 'Medí varias veces y fijate cuántas coinciden.'; track('atlas_q_par', { ent }); });
    $('#qx-par-medir').addEventListener('click', () => par(1));
    $('#qx-par-10').addEventListener('click', () => par(10));
  }

  // ============ 2. Cada qubit duplica ============
  const HITOS_N = [
    [10, 'Entra en una calculadora de bolsillo.'],
    [30, 'Tu notebook llega hasta acá: 16 GB de memoria.'],
    [50, 'Hacen falta las supercomputadoras más grandes del mundo.'],
    [74, 'Más memoria que todos los datos que la humanidad genera en un año.'],
    [105, 'Los qubits de Willow, el chip de Google. Guardar su estado completo con bits es imposible.'],
    [167, 'Más combinaciones que átomos tiene la Tierra.'],
    [266, 'Más combinaciones que átomos hay en el universo visible.'],
  ];
  function crece() {
    const r = $('#qx-n-r'); if (!r) return;
    const N = $('#qx-n'), E = $('#qx-estados'), M = $('#qx-mem'), H = $('#qx-hitos');
    const U = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    H.innerHTML = HITOS_N.map(h => '<li><b>' + h[0] + '</b><span>' + esc(h[1]) + '</span></li>').join('');
    const li = $$('li', H);
    function pintar() {
      const n = +r.value;
      N.textContent = n;
      if (n <= 33) E.textContent = num(Math.pow(2, n), 0);
      else { const l = n * Math.log10(2), e = Math.floor(l); E.innerHTML = '≈ ' + num(Math.pow(10, l - e), 1) + ' × 10<sup>' + e + '</sup>'; }
      // 16 bytes por combinación: 2^(n+4) bytes
      const k = Math.floor((n + 4) / 10);
      M.textContent = k < U.length ? num(Math.pow(2, (n + 4) % 10), 0) + ' ' + U[k] : 'No existe';
      li.forEach((x, i) => x.classList.toggle('on', n >= HITOS_N[i][0]));
    }
    r.addEventListener('input', pintar);
    r.addEventListener('change', () => track('atlas_q_crece', { n: +r.value }));
    pintar();
  }

  // ============ 3. Buscar la llave: compu normal vs. método de Grover ============
  function grover() {
    const box = $('#qx-cajas'); if (!box) return;
    const T = $('#qx-gro-t'), B = $('#qx-gro-btn'), N = 16;
    let modo = 'c', clave = azar(N), abiertas = [], k = 0, medida = null;
    // Chance de la caja correcta después de k pasos: sen²((2k+1)·θ), con sen θ = 1/√N
    const chance = kk => Math.pow(Math.sin((2 * kk + 1) * Math.asin(1 / Math.sqrt(N))), 2);
    const pct = v => num(v * 100, v < 0.1 ? 1 : 0) + '%';
    function pintar() {
      box.classList.toggle('q', modo === 'q');
      if (modo === 'c') {
        const hallada = abiertas.includes(clave);
        box.innerHTML = Array.from({ length: N }, (_, i) => {
          const ab = abiertas.includes(i);
          return '<button type="button" data-i="' + i + '" class="' + (ab ? (i === clave ? 'ok' : 'no') : '') + '"' + (ab || hallada ? ' disabled' : '') + ' aria-label="Caja ' + (i + 1) + '">' + (ab ? (i === clave ? '🔑' : '·') : '?') + '</button>';
        }).join('');
        T.innerHTML = hallada ? '<b>La encontraste en ' + abiertas.length + (abiertas.length === 1 ? ' intento' : ' intentos') + '.</b> Con suerte sale a la primera; con mala suerte, a la última. En promedio hacen falta 8,5.'
          : abiertas.length ? 'Llevás ' + abiertas.length + (abiertas.length === 1 ? ' intento' : ' intentos') + '. Una compu normal hace esto mismo: abre de a una.'
          : 'Una de las 16 cajas esconde la llave. Tocá para abrir de a una.';
        B.innerHTML = '<button type="button" class="ax-btn" data-a="otra">↺ Esconder de nuevo</button>';
      } else {
        const ps = chance(k), po = (1 - ps) / (N - 1);
        box.innerHTML = Array.from({ length: N }, (_, i) => {
          const v = i === clave ? ps : po;
          return '<div class="' + (i === clave && k ? 'ok' : '') + (medida === i ? ' med' : '') + '"><i style="height:' + (v * 100).toFixed(1) + '%"></i><span>' + pct(v) + '</span></div>';
        }).join('');
        const M = ['Al empezar, todas las cajas tienen la misma chance: 6,3%. Medir ahora es adivinar. Aplicá un paso.',
          '<b>Un paso:</b> la interferencia le sumó chance a la caja correcta (' + pct(chance(1)) + ') y le restó a todas las demás.',
          '<b>Dos pasos:</b> ya está en ' + pct(chance(2)) + '. Uno más.',
          '<b>Tres pasos: ' + pct(chance(3)) + '.</b> Este es el momento de medir.',
          '<b>Te pasaste.</b> Con un paso de más, la chance baja a ' + pct(chance(4)) + '. Hay que saber cuándo frenar.'];
        T.innerHTML = medida !== null
          ? (medida === clave ? '<b>Mediste y salió la caja correcta.</b> La encontraste con ' + k + (k === 1 ? ' paso' : ' pasos') + ' en vez de 8 o 9 intentos.' : '<b>Salió otra caja.</b> Con ' + k + (k === 1 ? ' paso' : ' pasos') + ' eso pasa el ' + pct(1 - ps) + ' de las veces. Por eso los programas cuánticos se repiten.')
          : (M[k] || 'Seguiste de largo: ahora la chance es ' + pct(ps) + '. Sube y baja como una ola.');
        B.innerHTML = '<button type="button" class="ax-btn primario" data-a="paso"' + (medida !== null ? ' disabled' : '') + '>Aplicar un paso</button><button type="button" class="ax-btn" data-a="medir"' + (medida !== null ? ' disabled' : '') + '>Medir</button><button type="button" class="ax-btn" data-a="otra">↺ Reiniciar</button>';
      }
    }
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || modo !== 'c') return;
      abiertas.push(+b.dataset.i); pintar();
      if (+b.dataset.i === clave) track('atlas_q_buscar', { modo: 'c', intentos: abiertas.length });
    });
    B.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'otra') { clave = azar(N); abiertas = []; k = 0; medida = null; }
      if (b.dataset.a === 'paso') k++;
      if (b.dataset.a === 'medir') {
        // Se sortea una caja según la chance de cada una
        medida = Math.random() < chance(k) ? clave : (clave + 1 + azar(N - 1)) % N;
        track('atlas_q_buscar', { modo: 'q', pasos: k, ok: medida === clave });
      }
      pintar();
    });
    grupo('[data-gro]', b => { modo = b.dataset.gro; abiertas = []; k = 0; medida = null; clave = azar(N); pintar(); });
    pintar();

    // ¿Y con más cajas?
    const C = $$('#qx-gro-cmp .t'), X = $('#qx-gro-n');
    const TXT = { 16: 'Con 16 cajas la diferencia es chica: 3 pasos contra unos 8 intentos.', 1000000: 'Con un millón, la compu normal prueba medio millón de veces. La cuántica necesita 785 pasos.', 1000000000000: 'Con un billón de cajas, medio billón de intentos contra menos de 800.000 pasos. La ventaja crece con el tamaño del problema.' };
    function comparar(n) {
      const cl = n / 2, gr = Math.max(1, Math.floor(Math.PI / 4 * Math.sqrt(n)));
      C[0].querySelector('i').style.width = '100%'; C[0].querySelector('span').textContent = num(n === 16 ? 8.5 : cl, 1) + ' intentos';
      C[1].querySelector('i').style.width = Math.max(0.6, gr / cl * 100) + '%'; C[1].querySelector('span').textContent = num(gr, 0) + ' pasos';
      X.textContent = TXT[n];
    }
    grupo('[data-gron]', b => { comparar(+b.dataset.gron); track('atlas_q_cajas', { n: b.dataset.gron }); });
    comparar(16);
  }

  // ============ 4. El refrigerador de dilución ============
  const PLACAS = [
    [300, '27 °C', 'Temperatura ambiente', 'Arriba de todo entran los cables que llevan las órdenes desde la electrónica normal. Todo lo que sigue está al vacío, como un termo.'],
    [50, '−223 °C', 'Primera placa', 'Un compresor de helio saca el primer calor. Ya hace más frío que en cualquier lugar natural de la Tierra.'],
    [4, '−269 °C', 'Segunda placa', 'A esta temperatura el helio común se vuelve líquido. Estamos apenas arriba del frío del espacio exterior.'],
    [0.8, '−272,35 °C', 'El destilador', 'Acá empieza el truco: se bombea helio-3 para enfriar por evaporación, como cuando soplás la sopa. Ya es más frío que cualquier lugar conocido del universo.'],
    [0.1, '−273,05 °C', 'Placa fría', 'Un escalón intermedio para frenar el poco calor que todavía baja por los cables.'],
    [0.015, '−273,14 °C', 'Cámara de mezcla', 'El fondo. El helio-3 se mezcla con helio-4 y esa mezcla absorbe calor sin parar. De acá cuelga el chip, a una centésima de grado del cero absoluto.'],
  ];
  const TERMO = [
    [293, '20 °C', 'Tu casa'], [184, '−89 °C', 'Récord de frío en la Antártida'], [111, '−162 °C', 'Gas natural licuado'], [77, '−196 °C', 'Nitrógeno líquido'],
    [4.2, '−269 °C', 'Helio líquido'], [2.7, '−270,4 °C', 'El espacio exterior'], [1, '−272 °C', 'Nebulosa Boomerang, el lugar natural más frío conocido'], [0.015, '−273,14 °C', 'Chip cuántico'],
  ];
  function frio() {
    const r = $('#qx-frio-r'); if (!r) return;
    const T = $('#qx-t'), C = $('#qx-tc'), N = $('#qx-frio-n'), X = $('#qx-frio-t'), pl = $$('#qx-placas .pl'), chip = $('#qx-chip'), btn = $('#qx-bajar'), L = $('#qx-termo');
    L.innerHTML = TERMO.map(t => '<li><b>' + t[1] + '</b><span>' + esc(t[2]) + '</span></li>').join('');
    const li = $$('li', L);
    function pintar() {
      const i = +r.value, p = PLACAS[i];
      T.textContent = num(p[0], 3) + ' K'; C.textContent = p[1]; C.classList.toggle('liq', i >= 3);
      N.textContent = p[2]; X.textContent = p[3];
      pl.forEach((g, j) => { g.classList.toggle('on', j === i); g.classList.toggle('pas', j < i); });
      chip.classList.toggle('on', i === 5);
      li.forEach((x, j) => x.classList.toggle('on', p[0] <= TERMO[j][0]));
      btn.textContent = i === 5 ? '↺ Volver arriba' : '❄ Bajar una placa';
    }
    r.addEventListener('input', pintar);
    r.addEventListener('change', () => track('atlas_q_frio', { placa: +r.value }));
    btn.addEventListener('click', () => { r.value = +r.value === 5 ? 0 : +r.value + 1; pintar(); });
    pl.forEach(g => {
      g.addEventListener('click', () => { r.value = g.dataset.i; pintar(); });
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.value = g.dataset.i; pintar(); } });
    });
    pintar();
  }

  // ============ 5. Cinco maneras de hacer un qubit (pestañas) ============
  function tipos() {
    const tabs = $$('#tipos .ax-proc-tabs button'); if (!tabs.length) return;
    const panes = $$('#tipos .ax-proc-txt'), vis = $$('#tipos .ax-proc-vis [data-s]');
    let i = 0;
    function ir(n) {
      i = (n + tabs.length) % tabs.length;
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', j === i); t.classList.toggle('on', j === i); });
      panes.forEach((p, j) => { p.hidden = j !== i; });
      vis.forEach(v => v.classList.toggle('on', +v.dataset.s === i));
      $('#qx-tip-n').textContent = panes[i].dataset.num; $('#qx-tip-c').textContent = panes[i].dataset.cap;
      const fila = tabs[i].parentElement;
      fila.scrollTo({ left: tabs[i].offsetLeft - fila.clientWidth / 2 + tabs[i].offsetWidth / 2, behavior: REDUCIR ? 'auto' : 'smooth' });
    }
    tabs.forEach((t, j) => t.addEventListener('click', () => { ir(j); track('atlas_q_tipo', { tipo: j }); }));
    $('#qx-tip-ant').addEventListener('click', () => ir(i - 1));
    $('#qx-tip-sig').addEventListener('click', () => ir(i + 1));
    ir(0);
  }

  // ============ 6. Corrección de errores: código de superficie (simplificado) ============
  // Qubits con el dato en una grilla de d×d. Entre ellos, los detectores: cada uno avisa si entre sus vecinos
  // hay una cantidad impar de errores. Se muestra un solo tipo de error (los detectores del otro tipo van en gris).
  const FALLA = { 3: '0,65%', 5: '0,30%', 7: '0,14%' };
  function errores() {
    const svg = $('#qx-sc-svg'); if (!svg) return;
    const T = $('#qx-sc-t');
    let d = 3, err = new Set();
    const vecinos = (r, c) => [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]].filter(q => q[0] >= 0 && q[1] >= 0 && q[0] < d && q[1] < d);
    function dibujar() {
      const S = 400 / (d + 1);
      let caras = '', puntos = '';
      for (let r = 0; r <= d; r++) for (let c = 0; c <= d; c++) {
        const activo = (r + c) % 2 === 0, dentro = r >= 1 && r < d && c >= 1 && c < d;
        let forma;
        if (dentro) forma = '<rect x="' + (c * S + 2) + '" y="' + (r * S + 2) + '" width="' + (S - 4) + '" height="' + (S - 4) + '" rx="' + (S * 0.12) + '"';
        else if (activo && (r === 0 || r === d) && c >= 1 && c < d) forma = '<path d="M' + (c * S + 2) + ',' + (r ? d * S + 2 : S - 2) + 'A' + (S / 2 - 2) + ',' + (S / 2 - 2) + ' 0 0 ' + (r ? 0 : 1) + ' ' + ((c + 1) * S - 2) + ',' + (r ? d * S + 2 : S - 2) + 'Z"';
        else if (!activo && (c === 0 || c === d) && r >= 1 && r < d) forma = '<path d="M' + (c ? d * S + 2 : S - 2) + ',' + (r * S + 2) + 'A' + (S / 2 - 2) + ',' + (S / 2 - 2) + ' 0 0 ' + (c ? 1 : 0) + ' ' + (c ? d * S + 2 : S - 2) + ',' + ((r + 1) * S - 2) + 'Z"';
        else continue;
        const impar = activo && vecinos(r, c).filter(q => err.has(q[0] + ',' + q[1])).length % 2 === 1;
        caras += forma + ' class="det' + (activo ? ' a' : '') + (impar ? ' on' : '') + '"/>';
      }
      for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) {
        const k = r + ',' + c, x = (c + 1) * S, y = (r + 1) * S;
        puntos += '<g class="qb' + (err.has(k) ? ' err' : '') + '" data-q="' + k + '" tabindex="0" role="button" aria-label="Qubit fila ' + (r + 1) + ', columna ' + (c + 1) + (err.has(k) ? ', con error' : '') + '"><circle cx="' + x + '" cy="' + y + '" r="' + (S * 0.45) + '" fill="transparent"/><circle class="p" cx="' + x + '" cy="' + y + '" r="' + (S * 0.2) + '"/></g>';
      }
      svg.innerHTML = caras + puntos;
      const t = (d - 1) / 2, e = err.size;
      $('#qx-sc-f').textContent = 2 * d * d - 1; $('#qx-sc-a').textContent = t; $('#qx-sc-al').textContent = (t === 1 ? 'error aguanta' : 'errores aguanta') + ' a la vez'; $('#qx-sc-e').textContent = FALLA[d];
      T.innerHTML = !e ? 'Todo en orden. Tocá cualquier qubit blanco para meterle un error, o tirá uno al azar.'
        : e <= t ? '<b>' + e + (e === 1 ? ' error.' : ' errores.') + '</b> Los detectores amarillos marcan dónde está el problema. Con eso la máquina sabe qué arreglar sin mirar el dato, que sigue a salvo.'
        : '<b>Demasiados errores juntos.</b> Una grilla de ' + d + '×' + d + ' aguanta ' + t + '. Los avisos ya no alcanzan para saber qué pasó y el dato se puede arruinar. ' + (d < 7 ? 'Probá con una grilla más grande.' : 'Por eso, además de grillas grandes, hacen falta qubits que fallen poco.');
    }
    function tocar(k) { err.has(k) ? err.delete(k) : err.add(k); dibujar(); }
    svg.addEventListener('click', e => { const g = e.target.closest('.qb'); if (g) { tocar(g.dataset.q); track('atlas_q_error', { d, n: err.size }); } });
    svg.addEventListener('keydown', e => { const g = e.target.closest('.qb'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const k = g.dataset.q; tocar(k); const n = $('[data-q="' + k + '"]', svg); n && n.focus(); } });
    $('#qx-sc-azar').addEventListener('click', () => {
      const libres = [];
      for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) if (!err.has(r + ',' + c)) libres.push(r + ',' + c);
      if (libres.length) tocar(libres[azar(libres.length)]);
    });
    $('#qx-sc-limpiar').addEventListener('click', () => { err.clear(); dibujar(); });
    grupo('[data-d]', b => { d = +b.dataset.d; err.clear(); dibujar(); track('atlas_q_grilla', { d }); });
    dibujar();
  }

  // ============ 7. La carrera: plata pública, quién construye y la cadena de proveedores ============
  // Fondos públicos anunciados, en miles de millones de US$ (aprox.; plazos distintos según el país)
  const FONDOS = [
    ['156', 'China', 108, 33, 15, 'La cifra más repetida es de unos US$ 15.000 millones, pero el gobierno nunca la confirmó. Su polo está en Hefei y tiene la red de comunicación cuántica más larga del mundo.'],
    ['392', 'Japón', 138.5, 36.5, 7, 'Unos US$ 7.000 millones anunciados en 2025, que incluyen también chips de nueva generación.'],
    ['840', 'EE.UU.', -98, 39, 5.2, 'Más de US$ 5.000 millones de fondos federales desde 2018. Pero su fuerza es privada: IBM, Google, Microsoft y la mayoría de las startups.'],
    ['276', 'Alemania', 10.4, 51.1, 3.3, 'Plan de € 3.000 millones lanzado en 2023.'],
    ['826', 'Reino Unido', -2, 53, 3.2, 'Programa de £ 2.500 millones a diez años (2024-2034).'],
    ['410', 'Corea del Sur', 127.8, 36.3, 2.3, 'Más de 3 billones de wones hasta 2035.'],
    ['250', 'Francia', 2.5, 46.5, 2, 'Plan nacional de € 1.800 millones lanzado en 2021, con ampliaciones posteriores.'],
    ['643', 'Rusia', 90, 61, 1, 'Al menos 100.000 millones de rublos hasta 2025.'],
    ['724', 'España', -3.5, 40, 0.9, 'Estrategia 2025-2030: € 808 millones.'],
    ['124', 'Canadá', -106, 57, 0.8, 'Más de 1.000 millones de dólares canadienses en una década. Cuna de D-Wave y Xanadu.'],
    ['356', 'India', 79, 22, 0.7, 'Misión Nacional Cuántica: unos US$ 730 millones.'],
    ['528', 'Países Bajos', 5.3, 52.2, 0.7, 'Quantum Delta NL: € 615 millones.'],
    ['036', 'Australia', 134, -25, 0.6, 'Cerca de 900 millones de dólares australianos, buena parte para que PsiQuantum construya en Brisbane.'],
    ['376', 'Israel', 35, 31.5, 0.3, 'Programa nacional de 1.200 millones de séqueles.'],
    ['076', 'Brasil', -51, -10, 0.08, 'Unos 430 millones de reales en programas nacionales.'],
  ];
  const TIPO = { s: ['Superconductores', '#a78bfa'], i: ['Iones atrapados', '#fb923c'], a: ['Átomos neutros', '#22d3ee'], f: ['Fotones', '#e8c97a'], t: ['Topológicos', '#f472b6'] };
  const QUIEN = [
    { id: 'ibm', n: 'IBM', l: 'Nueva York, EE.UU.', p: [-73.9, 41.7], k: 's', f: 'Tiene la flota más grande de máquinas en la nube. Promete para 2029 la primera computadora cuántica tolerante a fallos, Starling.' },
    { id: 'goo', n: 'Google', l: 'Santa Bárbara, EE.UU.', p: [-119.8, 34.4], k: 's', f: 'Hizo el chip Willow (105 qubits), el primero en mostrar que corregir errores funciona.' },
    { id: 'qnt', n: 'Quantinuum', l: 'Colorado, EE.UU.', p: [-105.1, 39.9], k: 'i', f: 'La máquina más precisa: Helios, de 98 qubits. Es de Honeywell y cotiza en bolsa desde junio de 2026.' },
    { id: 'ionq', n: 'IonQ', l: 'Maryland, EE.UU.', p: [-76.9, 39], k: 'i', f: 'La primera empresa cuántica pura que salió a bolsa (2021). En 2025 compró a la británica Oxford Ionics.' },
    { id: 'quera', n: 'QuEra', l: 'Boston, EE.UU.', p: [-71.1, 42.4], k: 'a', f: 'Nació en Harvard y el MIT. Trabaja con átomos de rubidio atrapados con láser.' },
    { id: 'ms', n: 'Microsoft', l: 'Redmond, EE.UU.', p: [-122.1, 47.7], k: 't', f: 'Apuesta al qubit topológico. Presentó el chip Majorana 1 en 2025; muchos físicos dudan de que funcione.' },
    { id: 'xan', n: 'Xanadu', l: 'Toronto, Canadá', p: [-79.4, 43.7], k: 'f', f: 'Computadoras de luz. En 2025 mostró Aurora, armada con chips conectados por fibra óptica.' },
    { id: 'pas', n: 'Pasqal', l: 'París, Francia', p: [2.3, 48.7], k: 'a', f: 'Cofundada por el Nobel Alain Aspect. Es la apuesta europea en átomos neutros.' },
    { id: 'iqm', n: 'IQM', l: 'Espoo, Finlandia', p: [24.7, 60.2], k: 's', f: 'El mayor fabricante europeo de máquinas superconductoras. Las vende a centros de supercómputo.' },
    { id: 'hefei', n: 'Origin Quantum y USTC', l: 'Hefei, China', p: [117.2, 31.8], k: 's', f: 'El polo cuántico chino: la universidad USTC (chips Zuchongzhi) y la empresa Origin Quantum.' },
    { id: 'riken', n: 'RIKEN y Fujitsu', l: 'Wako, Japón', p: [139.6, 35.8], k: 's', f: 'En 2025 presentaron una máquina de 256 qubits y anunciaron otra de 1.000.' },
    { id: 'psi', n: 'PsiQuantum', l: 'Brisbane, Australia', p: [153, -27.5], k: 'f', f: 'Empresa de California que construye en Australia, con plata del gobierno, una máquina de luz que aspira al millón de qubits.' },
    { id: 'bari', n: 'Centro Atómico Bariloche', l: 'Río Negro, Argentina', p: [-71.3, -41.1], k: 's', arg: 1, f: 'Un grupo de la CNEA y el CONICET desarrolla los primeros prototipos de qubits superconductores hechos en la Argentina. Es experimental.' },
  ];
  const ORO = '#e8c97a';
  const CADENA = [
    { id: 'blue', n: 'Bluefors', l: 'Helsinki, Finlandia', p: [24.9, 60.2], big: 'N.º 1', cap: 'en refrigeradores de dilución', f: 'Casi todos los laboratorios del mundo le compran a esta empresa finlandesa. Sin su equipo, un chip superconductor no llega al frío que necesita.' },
    { id: 'oxi', n: 'Oxford Instruments', l: 'Reino Unido', p: [-1.3, 51.7], big: 'El rival', cap: 'británico de Bluefors', f: 'El otro fabricante histórico de refrigeradores de dilución.' },
    { id: 'he3a', n: 'Helio-3 · Savannah River', l: 'Carolina del Sur, EE.UU.', p: [-81.7, 33.3], big: 'Tritio', cap: 'de las armas nucleares', f: 'El helio-3 aparece cuando el tritio de las ojivas se desintegra. El gobierno de EE.UU. lo junta y lo vende por cuotas.' },
    { id: 'he3b', n: 'Helio-3 · Ontario', l: 'Canadá', p: [-78.7, 43.9], big: 'Reactores', cap: 'nucleares', f: 'Los reactores canadienses generan tritio, y de ahí se obtiene helio-3 para uso civil.' },
    { id: 'lnf', n: 'Low Noise Factory', l: 'Gotemburgo, Suecia', p: [12, 57.7], big: 'Amplificadores', cap: 'que trabajan a 4 K', f: 'La señal de un qubit es tan débil que hay que amplificarla dentro del refrigerador. Esta pyme sueca es el proveedor de referencia.' },
    { id: 'zi', n: 'Zurich Instruments', l: 'Zúrich, Suiza', p: [8.5, 47.4], big: 'Electrónica', cap: 'de control', f: 'Fabrica los equipos que generan los pulsos de microondas con los que se "habla" con cada qubit.' },
    { id: 'top', n: 'Toptica', l: 'Múnich, Alemania', p: [11.6, 48.1], big: 'Láseres', cap: 'para átomos e iones', f: 'Las máquinas de átomos y de iones dependen de láseres ultraestables. Alemania domina ese nicho.' },
    { id: 'qm', n: 'Quantum Machines', l: 'Tel Aviv, Israel', p: [34.8, 32.1], big: 'Control', cap: 'y conexión con Nvidia', f: 'Hace el "sistema nervioso" que coordina los qubits con las computadoras normales.' },
  ];
  const punto = id => (QUIEN.find(x => x.id === id) || CADENA.find(x => x.id === id)).p;

  function tooltip(wrap) {
    const tip = document.createElement('div');
    tip.className = 'ax-tip'; tip.setAttribute('role', 'status');
    wrap.appendChild(tip);
    let t = 0;
    return (titulo, texto, xy, iso) => {
      clearTimeout(t);
      if (!titulo) { tip.classList.remove('on'); return; }
      tip.innerHTML = '<b>' + (iso ? window.AtlasTitulo(iso, titulo) : esc(titulo)) + '</b>' + esc(texto);
      tip.style.left = Math.max(6, Math.min(wrap.clientWidth - 256, xy[0] - 125)) + 'px';
      tip.style.top = Math.max(6, xy[1] + 16) + 'px';
      tip.classList.add('on');
      t = setTimeout(() => tip.classList.remove('on'), 6000);
    };
  }
  function fichaPais(iso) {
    if (window.AtlasTerritorio[iso]) return window.AtlasTerritorio[iso];
    if (iso === '032') return 'No tiene un programa nacional con presupuesto propio. Investiga en Bariloche y en Buenos Aires, y tiene una máquina educativa de 3 qubits en Hurlingham.';
    if (iso === '246') return 'No está entre los que más plata ponen, pero fabrica los refrigeradores (Bluefors) que usa casi todo el mundo.';
    const d = FONDOS.find(f => f[0] === iso);
    return d ? 'Fondos públicos anunciados: unos US$ ' + num(d[4] * 1000, 0) + ' millones. ' + d[5] : 'Sin un programa nacional grande de tecnología cuántica.';
  }

  function mapa() {
    const canvas = $('#globo-q'); if (!canvas) return;
    const tip = tooltip(canvas.parentElement);
    const lista = $('#qx-lista'), det = $('#qx-mapa-det'), tit = $('#qx-mapa-t');
    let modo = 'p', sel = null;
    const g = AtlasGlobo(canvas, {
      base: BASE, foco: [100, 30],
      onPais: (iso, nom, xy) => { if (!iso) return tip(null); const f = FONDOS.find(x => x[0] === iso); tip(f ? f[1] : nom, fichaPais(iso), xy, iso); track('atlas_q_pais', { pais: nom }); },
      onPunto: id => elegir(id),
    });
    const TIT = { p: 'China y Estados Unidos corren adelante.', q: 'Pocas empresas, casi todas en el norte.', c: 'Sin Finlandia y sin helio-3 no hay computadora.' };

    function pintar(conLista) {
      tit.textContent = TIT[modo];
      if (modo === 'p') {
        const res = {};
        FONDOS.forEach(f => { res[f[0]] = ['#a78bfa', 0.25 + 0.75 * Math.sqrt(f[4] / 15)]; });
        if (sel) res[sel] = ['#4ade9a', 0.9];
        g.set({ resaltes: res, arcos: [], rutas: [], puntos: [], etiquetas: [] });
        if (conLista) lista.innerHTML = FONDOS.slice(0, 8).map(f => '<li><button type="button" data-id="' + f[0] + '" style="--c:#a78bfa"><span class="r">' + esc(f[1]) + '</span><span class="v">≈ US$ ' + num(f[4] * 1000, 0) + ' M</span><span class="b"><i style="width:' + Math.round(f[4] / 15 * 100) + '%"></i></span></button></li>').join('');
        const f = sel && FONDOS.find(x => x[0] === sel);
        det.innerHTML = f ? '<b>' + esc(f[1]) + '.</b> ' + esc(f[5]) : 'Entre gobiernos y empresas, el mundo ya comprometió más de US$ 65.000 millones (Qureca, 2026). La Unión Europea suma aparte € 1.000 millones propios. Tocá un país.';
      } else {
        const L = modo === 'q' ? QUIEN : CADENA;
        const col = x => (modo === 'q' ? (x.arg ? '#4ade9a' : TIPO[x.k][1]) : ORO);
        g.set({
          resaltes: modo === 'c' ? { '246': [ORO, 0.5] } : { '032': ['#4ade9a', 0.3] }, arcos: [], etiquetas: [],
          rutas: modo === 'c' ? [['he3a', 'blue'], ['he3b', 'blue'], ['blue', 'ibm'], ['blue', 'goo'], ['blue', 'riken']].map(r => ({ pts: [punto(r[0]), punto(r[1])], c: ORO, w: 1.4, apagado: !!sel && sel !== r[0] && sel !== r[1] })) : [],
          puntos: L.map(x => ({ id: x.id, p: x.p, c: col(x), r: x.id === sel ? 6.5 : 4.5, pulso: x.id === sel || (!sel && !!x.arg), t: x.id === sel ? x.n : '' })),
        });
        if (conLista) lista.innerHTML = L.map(x => '<li><button type="button" class="q" data-id="' + x.id + '" style="--c:' + col(x) + '"><span class="r"><i></i>' + esc(x.n) + '</span><span class="v">' + (modo === 'q' ? esc(TIPO[x.k][0]) + ' · ' + esc(x.l) : '<b>' + esc(x.big) + '</b> ' + esc(x.cap)) + '</span></button></li>').join('');
        const x = sel && L.find(q => q.id === sel);
        det.innerHTML = x ? '<b>' + esc(x.n) + ' · ' + esc(x.l) + '.</b> ' + esc(x.f)
          : modo === 'q' ? 'Cada color es una manera distinta de hacer un qubit. El punto verde es el grupo que trabaja en el primer qubit argentino. Tocá un punto o un nombre.'
          : 'Las líneas muestran el camino: el helio-3 sale de instalaciones nucleares, va a Finlandia y de ahí, hecho refrigerador, a los laboratorios. Tocá un proveedor.';
      }
      $$('button', lista).forEach(b => b.classList.toggle('on', b.dataset.id === sel));
    }
    function elegir(id) {
      sel = sel === id ? null : id;
      pintar(false);
      if (!sel) return;
      const f = FONDOS.find(x => x[0] === sel);
      g.girarA(modo === 'p' ? [f[2], f[3]] : punto(sel), 1000);
      if (window.innerWidth < 900) canvas.scrollIntoView({ behavior: REDUCIR ? 'auto' : 'smooth', block: 'center' });
      track('atlas_q_mapa', { modo, sel });
    }
    lista.addEventListener('click', e => { const b = e.target.closest('button'); if (b) elegir(b.dataset.id); });
    grupo('[data-qmapa]', b => {
      modo = b.dataset.qmapa; sel = null; pintar(true);
      g.girarA(modo === 'p' ? [100, 30] : modo === 'q' ? [-90, 35] : [-20, 50], 1100);
    });
    pintar(true);
  }

  // ============ 8. El candado: cuánto falta para romper una clave ============
  // [año, qubits, texto]. A = qubits que harían falta para romper RSA-2048; B = la máquina más grande de cada momento
  const RSA_A = [
    [2012, 1e9, '<b>2012: unos 1.000 millones de qubits.</b> La primera estimación seria (Fowler y otros). Parecía ciencia ficción.'],
    [2019, 2e7, '<b>2019: 20 millones de qubits, en 8 horas</b> (Gidney y Ekerå, de Google). Durante años fue el número de referencia.'],
    [2025.4, 1e6, '<b>2025: menos de 1 millón, en menos de una semana</b> (Gidney, de Google). El mismo tipo de máquina, con mejores algoritmos: 20 veces menos en seis años.'],
    [2026.15, 1e5, '<b>Febrero de 2026: menos de 100.000</b>, con otro código de corrección de errores. Es un borrador sin revisar, y supone controlar 100.000 qubits tan bien como hoy se controlan 100.'],
    [2026.3, 1e4, '<b>Marzo de 2026: unos 10.000 átomos.</b> El borrador más optimista: a cambio de pocos qubits, el cálculo tarda muchísimo más y pide máquinas que nadie construyó.'],
  ];
  const RSA_B = [
    [2016, 5, '<b>2016: 5 qubits.</b> IBM pone la primera computadora cuántica en internet para que cualquiera la pruebe.'],
    [2019.8, 53, '<b>2019: 53 qubits.</b> El chip Sycamore, de Google.'],
    [2021.9, 127, '<b>2021: 127 qubits.</b> El chip Eagle, de IBM.'],
    [2023.9, 1121, '<b>2023: 1.121 qubits.</b> El chip Condor, de IBM. Después de este, IBM dejó de competir por cantidad.'],
    [2025.7, 6100, '<b>2025: 6.100 átomos atrapados</b> (Caltech). Es un récord de tamaño, pero esa grilla todavía no hace cuentas completas. Las que sí calculan bien tienen unos 100 qubits.'],
  ];
  function candado() {
    const svg = $('#qx-rsa'); if (!svg) return;
    const D = $('#qx-rsa-d');
    let sel = 'a2', w0 = 0;
    function dibujar() {
      const W = Math.max(280, Math.round(svg.getBoundingClientRect().width)), chico = W < 520, H = chico ? 250 : 320;
      const ml = chico ? 44 : 64, mr = 14, mt = 14, mb = 26;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.style.height = H + 'px';
      const x = a => ml + (a - 2011) / 16 * (W - ml - mr), y = v => mt + (1 - Math.log10(v) / 9.4) * (H - mt - mb);
      let h = '';
      [[1, '1'], [1e3, 'mil'], [1e6, chico ? '1 M' : '1 millón'], [1e9, chico ? 'mil M' : 'mil millones']].forEach(t => {
        h += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y(t[0]) + '" y2="' + y(t[0]) + '" stroke="rgba(255,255,255,0.07)"/><text x="' + (ml - 8) + '" y="' + (y(t[0]) + 4) + '" text-anchor="end" class="ej">' + t[1] + '</text>';
      });
      [2012, 2016, 2020, 2024].forEach(a => { h += '<text x="' + x(a) + '" y="' + (H - 6) + '" text-anchor="middle" class="ej">' + a + '</text>'; });
      const linea = (S, c) => '<path d="M' + S.map(p => x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join('L') + '" fill="none" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>';
      h += linea(RSA_A.slice(0, 3), '#ff6b6b') + '<path d="M' + RSA_A.slice(2).map(p => x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join('L') + '" fill="none" stroke="#ff6b6b" stroke-width="2" stroke-dasharray="3 5" opacity=".7"/>' + linea(RSA_B, '#a78bfa');
      const pts = (S, k, c) => S.map((p, i) => '<g class="pt' + (sel === k + i ? ' on' : '') + '" data-k="' + k + i + '" tabindex="0" role="button" aria-label="' + esc(p[2].replace(/<[^>]+>/g, '')) + '"><circle cx="' + x(p[0]) + '" cy="' + y(p[1]) + '" r="16" fill="transparent"/><circle class="p" cx="' + x(p[0]) + '" cy="' + y(p[1]) + '" r="' + (sel === k + i ? 8 : 5.5) + '" fill="' + c + '" stroke="#0a0c0f" stroke-width="2"/></g>').join('');
      svg.innerHTML = h + pts(RSA_A, 'a', '#ff6b6b') + pts(RSA_B, 'b', '#a78bfa');
      D.innerHTML = (sel[0] === 'a' ? RSA_A : RSA_B)[+sel[1]][2];
    }
    function elegir(k) { sel = k; dibujar(); track('atlas_q_rsa', { k }); }
    svg.addEventListener('click', e => { const g = e.target.closest('.pt'); if (g) elegir(g.dataset.k); });
    svg.addEventListener('keydown', e => { const g = e.target.closest('.pt'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); elegir(g.dataset.k); } });
    new ResizeObserver(() => { const w = Math.round(svg.getBoundingClientRect().width); if (w && w !== w0) { w0 = w; dibujar(); } }).observe(svg);
    dibujar();

    // Robar hoy, descifrar mañana (regla de Mosca): si secreto + cambio > llegada, hay problema
    const X = $('#qx-mx'), Y = $('#qx-my'), Z = $('#qx-mz'), B = $$('#qx-mosca-b .t'), T = $('#qx-mosca-t'), pre = $('#qx-mosca-pre');
    const PRE = [['Un chat con amigos', 1, 1], ['Los datos de tu tarjeta', 4, 3], ['Tu historia clínica', 50, 8], ['Un secreto de Estado', 25, 10]];
    pre.innerHTML = PRE.map((p, i) => '<button type="button" class="ax-btn" data-i="' + i + '">' + esc(p[0]) + '</button>').join('');
    const an = n => n + (n === 1 ? ' año' : ' años');
    function calc() {
      const s = +X.value, c = +Y.value, z = +Z.value, nec = s + c, mal = nec > z;
      $('#qx-mx-v').textContent = an(s); $('#qx-my-v').textContent = an(c); $('#qx-mz-v').textContent = an(z);
      B[0].querySelector('i').style.width = (nec / 65 * 100) + '%'; B[0].querySelector('i').style.background = mal ? '#ff6b6b' : '#a78bfa';
      B[0].querySelector('span').textContent = c + ' + ' + s + ' = ' + an(nec);
      B[1].querySelector('i').style.width = (z / 65 * 100) + '%'; B[1].querySelector('span').textContent = an(z);
      T.innerHTML = mal
        ? '<b>En riesgo.</b> Entre cambiar el sistema y lo que dura el secreto pasan ' + an(nec) + ', pero la máquina llegaría en ' + z + '. Lo que alguien copie hoy podría leerlo durante ' + an(nec - z) + ' en los que todavía importa.'
        : '<b>A salvo, por ahora.</b> Para cuando llegue la máquina, el secreto ya no va a importar. ' + (nec === z ? 'Justo.' : 'Sobran ' + an(z - nec) + '.');
    }
    [X, Y, Z].forEach(r => r.addEventListener('input', () => { $$('button', pre).forEach(b => b.classList.remove('on')); calc(); }));
    pre.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const p = PRE[+b.dataset.i]; X.value = p[1]; Y.value = p[2];
      $$('button', pre).forEach(q => q.classList.toggle('on', q === b)); calc();
      track('atlas_q_mosca', { caso: p[0] });
    });
    calc();
  }

  // ============ 9. ¿Mito o verdad? ============
  const MITOS = [
    ['Una computadora cuántica prueba todas las respuestas a la vez.', 0, 'Si fuera así, al medir te tocaría una respuesta al azar. El truco es la interferencia: el programa hace que las respuestas malas se cancelen y la buena se refuerce. Y eso solo se sabe hacer para algunos problemas.'],
    ['Va a reemplazar a tu notebook y a tu celular.', 0, 'Para mails, planillas, juegos o videos es más lenta y carísima. Va a ser un acelerador para tareas puntuales, conectado a computadoras normales, como hoy una placa de video.'],
    ['Algunos chips cuánticos trabajan más fríos que el espacio exterior.', 1, 'Los superconductores, sí: 0,015 K contra los 2,7 K del espacio. Los de iones, átomos o fotones usan láseres y vacío en vez de tanto frío.'],
    ['Ya rompió las claves de los bancos.', 0, 'El número más grande factorizado con el algoritmo de Shor es 21 (3 × 7), en 2012. Una clave RSA tiene 617 dígitos. Falta una máquina miles de veces más grande y mucho más precisa.'],
    ['Sirve para simular moléculas y materiales nuevos.', 1, 'Es la idea original de Feynman y donde primero se espera una ventaja real: remedios, baterías, fertilizantes. La naturaleza es cuántica, y simularla con bits es carísimo.'],
    ['Va a hacer que ChatGPT sea mil veces más rápido.', 0, 'No hay ninguna prueba de que acelere la IA de hoy. Lo que sí pasa es al revés: la IA ayuda a la cuántica, por ejemplo detectando errores en los chips.'],
    ['Cualquiera puede usar una de verdad, hoy y gratis, desde su casa.', 1, 'IBM presta hasta 10 minutos por mes en máquinas de más de 100 qubits, por internet. Se programan en Python.'],
  ];
  function mitos() {
    const box = $('#qx-mitos'); if (!box) return;
    let i = 0, pts = 0;
    function pintar() {
      if (i >= MITOS.length) {
        box.innerHTML = '<p class="ax-eyebrow">Resultado</p><p class="ax-quiz-q"><b>' + pts + ' de ' + MITOS.length + '.</b> ' + (pts >= 6 ? 'No te venden humo fácil.' : pts >= 4 ? 'Bien: ya distinguís la ciencia del marketing.' : 'Normal: sobre este tema hay más humo que datos.') + '</p><div class="ax-chips"><button type="button" class="ax-btn" id="qx-mitos-otra">Jugar de nuevo</button></div>';
        $('#qx-mitos-otra').onclick = () => { i = 0; pts = 0; pintar(); };
        track('atlas_q_mitos', { pts });
        return;
      }
      const m = MITOS[i];
      box.innerHTML = '<p class="ax-eyebrow">Frase ' + (i + 1) + ' de ' + MITOS.length + '</p><p class="ax-quiz-q">"' + esc(m[0]) + '"</p><div class="qx-mv"><button type="button" data-v="0">Mito</button><button type="button" data-v="1">Verdad</button></div><p class="ax-quiz-exp" aria-live="polite"></p>' +
        '<div class="ax-quiz-pie"><span>' + pts + ' acierto' + (pts === 1 ? '' : 's') + '</span><button type="button" class="ax-btn" id="qx-mitos-sig" hidden>Siguiente →</button></div>';
      $$('.qx-mv button', box).forEach(b => b.addEventListener('click', () => {
        const v = +b.dataset.v;
        $$('.qx-mv button', box).forEach(x => { x.disabled = true; if (+x.dataset.v === m[1]) x.classList.add('ok'); });
        if (v === m[1]) pts++; else b.classList.add('mal');
        $('.ax-quiz-exp', box).innerHTML = '<b>' + (m[1] ? 'Verdad.' : 'Mito.') + '</b> ' + esc(m[2]);
        const s = $('#qx-mitos-sig'); s.hidden = false; s.focus({ preventScroll: true });
        s.onclick = () => { i++; pintar(); };
      }));
    }
    pintar();
  }

  // ============ 10. Línea de tiempo ============
  const HITOS = [
    ['1981', 'Idea', 'Richard Feynman propone construir computadoras que usen las reglas de la física cuántica para simular la naturaleza.'],
    ['1994', 'Idea', 'Peter Shor inventa el algoritmo que, con una máquina grande, rompería las claves de internet. Ahí empieza a llegar la plata.'],
    ['2001', 'Hecho', 'IBM factoriza el número 15 (3 × 5) con 7 qubits. Es la primera vez que el algoritmo de Shor corre de verdad.'],
    ['2019', 'Hecho discutido', 'Google anuncia la "supremacía cuántica": su chip Sycamore, de 53 qubits, hace en 200 segundos una cuenta que estimó en 10.000 años para una supercomputadora. IBM contestó que se podía en 2 días y medio.'],
    ['2023', 'Hecho', 'IBM presenta Condor, el primer chip de más de 1.000 qubits. Y avisa que deja de competir por cantidad: ahora importa la calidad.'],
    ['2024', 'Hecho', 'Chip Willow, de Google: por primera vez, sumar qubits baja los errores en lugar de subirlos. Estados Unidos aprueba el cifrado resistente a la cuántica.'],
    ['2025', 'Hecho', 'Año Internacional de la Cuántica. Nobel de Física para los pioneros de los circuitos superconductores. Caltech atrapa 6.100 átomos. Google anuncia la primera ventaja que otra máquina puede verificar.'],
    ['2026', 'Hecho', 'Quantinuum sale a la bolsa. IBM compromete más de US$ 10.000 millones. Google calcula que romper la firma de Bitcoin pediría menos de 500.000 qubits.'],
    ['2029', 'Promesa', 'IBM (Starling) y Quantinuum (Apollo) prometen para este año máquinas con cientos de qubits confiables. Sería la primera computadora cuántica "tolerante a fallos".'],
    ['2030–35', 'Plazo', 'Estados Unidos retira las claves actuales: en 2030 dejan de recomendarse y en 2035 quedan prohibidas en el Estado. Muchos expertos ubican por acá el "Día Q", pero nadie lo sabe.'],
  ];
  function cuando() {
    const tl = $('#qx-tl'); if (!tl) return;
    tl.innerHTML = HITOS.map((x, i) => '<button type="button" class="ax-btn" data-i="' + i + '" aria-pressed="false">' + esc(x[0]) + '</button>').join('');
    const K = $('#qx-hito-k'), A = $('#qx-hito-a'), X = $('#qx-hito-x'), P = $('#qx-hito'), bs = $$('button', tl);
    let i = 5;
    function ir(n, mover) {
      i = Math.max(0, Math.min(HITOS.length - 1, n));
      bs.forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-pressed', j === i); });
      const x = HITOS[i];
      K.textContent = x[1]; A.textContent = x[0]; X.textContent = x[2];
      P.dataset.k = x[1] === 'Promesa' ? 'p' : x[1] === 'Plazo' ? 'z' : x[1] === 'Idea' ? 'i' : 'h';
      $('#qx-hito-ant').disabled = i === 0; $('#qx-hito-sig').disabled = i === HITOS.length - 1;
      if (mover) tl.scrollTo({ left: bs[i].offsetLeft - tl.clientWidth / 2 + bs[i].offsetWidth / 2, behavior: REDUCIR ? 'auto' : 'smooth' });
    }
    tl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { ir(+b.dataset.i, true); track('atlas_q_cuando', { hito: HITOS[+b.dataset.i][0] }); } });
    $('#qx-hito-ant').addEventListener('click', () => ir(i - 1, true));
    $('#qx-hito-sig').addEventListener('click', () => ir(i + 1, true));
    ir(5);
  }

  // ============ 12. Quiz ============
  const QUIZ = [
    { q: '¿Qué pasa cuando medís un qubit que está en superposición?', o: ['Te muestra el 0 y el 1 juntos', 'Da 0 o 1, y la mezcla se pierde', 'Se copia en otro qubit', 'No se puede medir'], ok: 1, e: 'Al medir elige un solo valor. Por eso los programas cuánticos se repiten muchas veces.' },
    { q: '¿A qué temperatura trabaja un chip cuántico superconductor?', o: ['−162 °C, como el GNL', '−196 °C, como el nitrógeno líquido', '−270 °C, como el espacio', '−273,14 °C, casi el cero absoluto'], ok: 3, e: 'A unos 0,015 grados sobre el cero absoluto: una temperatura 180 veces más baja que la del espacio exterior.' },
    { q: '¿Cuál es hoy el mayor problema de estas máquinas?', o: ['Que gastan mucha electricidad', 'Que los qubits se equivocan mucho', 'Que no existen programas', 'Que son muy lentas para prender'], ok: 1, e: 'Un qubit falla una vez cada mil operaciones. Corregir eso cuesta cientos de qubits físicos por cada qubit confiable.' },
    { q: '¿Cuál es el número más grande factorizado de verdad con el algoritmo de Shor?', o: ['21', '2.048', 'Un millón', 'Una clave de banco'], ok: 0, e: '21 = 3 × 7, en 2012. Una clave RSA tiene 617 dígitos.' },
    { q: '¿Qué significa "robar hoy, descifrar mañana"?', o: ['Robar una computadora cuántica', 'Copiar datos cifrados ahora y guardarlos hasta poder leerlos', 'Adivinar contraseñas con IA', 'Minar Bitcoin más rápido'], ok: 1, e: 'Por eso el cambio de cifrado ya empezó, aunque la máquina todavía no exista.' },
  ];
  function quiz() {
    const box = $('#quiz'); if (!box) return;
    let i = 0, pts = 0;
    function pintar() {
      if (i >= QUIZ.length) {
        const msj = pts === QUIZ.length ? 'Ya sabés más que la mayoría de los que opinan del tema.' : pts >= 3 ? 'Muy bien. Repasá lo que falló y probá de nuevo.' : 'Volvé a recorrer la página: todo está ahí arriba.';
        box.innerHTML = '<p class="ax-eyebrow">Resultado</p><p class="ax-quiz-q"><b>' + pts + ' de ' + QUIZ.length + '.</b> ' + msj + '</p>' +
          '<div class="ax-chips"><button type="button" class="ax-btn primario" id="quiz-comp">Compartir resultado</button><button type="button" class="ax-btn" id="quiz-otra">Jugar de nuevo</button></div><p class="ax-quiz-exp" id="quiz-msg"></p>';
        $('#quiz-otra').onclick = () => { i = 0; pts = 0; pintar(); };
        $('#quiz-comp').onclick = async () => {
          const url = location.origin + location.pathname;
          const txt = 'Saqué ' + pts + '/' + QUIZ.length + ' en el quiz de computación cuántica del Atlas de BB Finanzas. ¿Sabías que el chip trabaja más frío que el espacio?';
          try {
            if (navigator.share) await navigator.share({ title: 'Más frío que el espacio', text: txt, url });
            else { await navigator.clipboard.writeText(txt + ' ' + url); $('#quiz-msg').textContent = 'Copiado. Pegalo donde quieras.'; }
            track('atlas_quiz_share', { cap: 'cuantica', pts });
          } catch (e) { /* el usuario canceló */ }
        };
        track('atlas_quiz_fin', { cap: 'cuantica', pts });
        return;
      }
      const Q = QUIZ[i];
      box.innerHTML = '<p class="ax-eyebrow">Pregunta ' + (i + 1) + ' de ' + QUIZ.length + '</p><p class="ax-quiz-q">' + esc(Q.q) + '</p><div class="ax-quiz-op">' +
        Q.o.map((o, j) => '<button type="button" data-j="' + j + '">' + esc(o) + '</button>').join('') + '</div><p class="ax-quiz-exp" aria-live="polite"></p>' +
        '<div class="ax-quiz-pie"><span>' + pts + ' acierto' + (pts === 1 ? '' : 's') + '</span><button type="button" class="ax-btn" id="quiz-sig" hidden>Siguiente →</button></div>';
      $$('.ax-quiz-op button', box).forEach(b => b.addEventListener('click', () => {
        const j = +b.dataset.j;
        $$('.ax-quiz-op button', box).forEach((x, k) => { x.disabled = true; if (k === Q.ok) x.classList.add('ok'); });
        if (j === Q.ok) pts++; else b.classList.add('mal');
        $('.ax-quiz-exp', box).textContent = (j === Q.ok ? '¡Bien! ' : 'No. ') + Q.e;
        const s = $('#quiz-sig'); s.hidden = false; s.focus({ preventScroll: true });
        s.onclick = () => { i++; pintar(); };
      }));
    }
    pintar();
  }

  // ============ Índice: sección activa y barra de progreso ============
  function indice() {
    const links = $$('.ax-indice a'); if (!links.length) return;
    const secs = links.map(a => document.getElementById(a.getAttribute('href').slice(1)));
    const barra = $('.ax-progreso');
    let pend = false;
    function medir() {
      pend = false;
      const h = document.documentElement, p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      barra.style.width = (p * 100).toFixed(1) + '%';
      let i = -1;
      secs.forEach((s, j) => { if (s && s.getBoundingClientRect().top < window.innerHeight * 0.4) i = j; });
      links.forEach((a, j) => a.classList.toggle('on', j === i));
      const on = links[i];
      if (on) { const ul = on.parentElement.parentElement; const x = on.offsetLeft - ul.clientWidth / 2 + on.offsetWidth / 2; if (Math.abs(ul.scrollLeft - x) > 40) ul.scrollTo({ left: x, behavior: 'auto' }); }
    }
    addEventListener('scroll', () => { if (!pend) { pend = true; requestAnimationFrame(medir); } }, { passive: true });
    medir();
  }

  // Cada bloque arranca cuando se acerca a la pantalla; si alguien salta con el índice, igual queda listo a los pocos segundos
  const pendientes = new Set();
  function cuandoSeAcerque(sel, fn) {
    const el = $(sel); if (!el) return;
    let hecho = false;
    const correr = () => { if (hecho) return; hecho = true; pendientes.delete(correr); io && io.disconnect(); fn(); };
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) correr(); }, { rootMargin: '600px 0px' }) : null;
    if (!io) return correr();
    io.observe(el); pendientes.add(correr);
  }
  addEventListener('load', () => setTimeout(() => [...pendientes].forEach(f => f()), 3000));

  function iniciar() {
    qubit(); indice();
    cuandoSeAcerque('#crece', crece);
    cuandoSeAcerque('#buscar', grover);
    cuandoSeAcerque('#frio', frio);
    cuandoSeAcerque('#tipos', tipos);
    cuandoSeAcerque('#errores', errores);
    cuandoSeAcerque('#mapa', mapa);
    cuandoSeAcerque('#candado', candado);
    cuandoSeAcerque('#mitos', mitos);
    cuandoSeAcerque('#cuando', cuando);
    cuandoSeAcerque('#quiz-sec', quiz);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
