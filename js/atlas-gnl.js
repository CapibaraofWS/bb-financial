/* Atlas · GNL: interactivos de la página.
   Datos: IGU World LNG Report 2026 (2025), Energy Institute, EIA, CEDIGAZ, GTT, reportes de empresas
   y prensa (ver "Fuentes" en la página). Son aproximados. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const BASE = '../../';
  const REDUCIR = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const track = (ev, p) => window.bbTrack && window.bbTrack(ev, p);
  const num = (v, d) => v.toLocaleString('es-AR', { maximumFractionDigits: d == null ? 1 : d });
  const NS = 'http://www.w3.org/2000/svg';
  const nombre = iso => (window.AtlasPaises[iso] || [iso])[0];

  // Anima un número de su valor anterior al nuevo
  function contar(el, hasta, fmt, ms) {
    const desde = el._v || 0, t0 = performance.now(); el._v = hasta;
    if (REDUCIR) { el.textContent = fmt(hasta); return; }
    (function paso(t) {
      const p = Math.min(1, (t - t0) / (ms || 900)), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(desde + (hasta - desde) * e);
      if (p < 1) requestAnimationFrame(paso);
    })(t0);
  }
  // Grupo de botones donde uno solo queda marcado
  function grupo(sel, fn) {
    const bs = $$(sel);
    bs.forEach((b, i) => b.addEventListener('click', () => {
      bs.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      fn(b, i);
    }));
    return bs;
  }

  // ============ 1. Enfriar el gas ============
  const FRIO = [
    [20, 'Temperatura ambiente', 'A esta temperatura el gas natural ocupa muchísimo lugar: por eso viaja por caño.'],
    [4, 'Tu heladera', 'A 4 °C sigue siendo gas. Hay que bajar mucho más.'],
    [-18, 'Tu freezer', 'A −18 °C el hielo ya es hielo, pero el metano ni se entera.'],
    [-78, 'Hielo seco', 'A −78 °C el dióxido de carbono se congela. El metano sigue siendo gas.'],
    [-89, 'El récord de frío en la Antártida', 'La temperatura más baja medida en la Tierra: −89 °C. Todavía falta.'],
    [-162, 'Gas natural licuado', 'A −162 °C el metano se vuelve líquido y ocupa 600 veces menos. Una pelota de básquet de gas pasa a ser una cucharada.'],
  ];
  function frio() {
    const r = $('#gx-temp-r'); if (!r) return;
    const bola = $('#gx-bola'), T = $('#gx-temp'), E = $('#gx-estado'), N = $('#gx-frio-n'), X = $('#gx-frio-t'), L = $('#gx-bola-l');
    function pintar() {
      const t = -r.value, liq = t <= -162;
      let ref = FRIO[0];
      FRIO.forEach(f => { if (t <= f[0]) ref = f; });
      T.textContent = (t < 0 ? '−' : '') + Math.abs(t) + ' °C';
      E.textContent = liq ? 'Líquido' : 'Gas'; E.classList.toggle('liq', liq);
      N.textContent = ref[1]; X.textContent = ref[2];
      // A escala en superficie: el círculo líquido tiene 600 veces menos área
      bola.style.transform = 'scale(' + (liq ? (1 / Math.sqrt(600)).toFixed(4) : 1) + ')';
      bola.setAttribute('fill', liq ? '#22d3ee' : 'rgba(251,146,60,0.16)');
      bola.setAttribute('stroke', liq ? '#22d3ee' : '#fb923c');
      L.textContent = liq ? '600 veces menos lugar' : '';
    }
    r.addEventListener('input', pintar);
    r.addEventListener('change', () => track('atlas_gnl_frio', { t: -r.value }));
    $('#gx-enfriar').addEventListener('click', () => { r.value = r.value >= 162 ? -20 : 162; pintar(); $('#gx-enfriar').textContent = r.value >= 162 ? '↺ Volver a gas' : '❄ Enfriar a −162 °C'; });
    pintar();
  }

  // ============ 2. El barco: a escala y por dentro ============
  // Siluetas a escala (metros; el suelo es y=0 y hacia arriba es negativo). Los barcos van parados sobre la popa.
  const poli = pts => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z';
  function siluetaBarco(L, o) {
    const T = (u, v) => [v, -u]; // u: a lo largo del barco, v: altura sobre la quilla
    let d = poli([[0, 6], [5, 0], [L - 16, 0], [L - 6, o.depth * 0.35], [L, o.depth], [0, o.depth]].map(p => T(p[0], p[1])));
    if (o.trunk) d += poli([[0.2 * L, o.depth], [0.93 * L, o.depth], [0.93 * L, o.depth + o.trunk], [0.2 * L, o.depth + o.trunk]].map(p => T(p[0], p[1])));
    if (o.sup) d += poli([[o.supU[0], o.depth], [o.supU[1], o.depth], [o.supU[1], o.depth + o.sup], [o.supU[0], o.depth + o.sup]].map(p => T(p[0], p[1])));
    if (o.funnel) d += poli([[o.supU[0] + 4, o.depth + o.sup], [o.supU[0] + 11, o.depth + o.sup], [o.supU[0] + 11, o.depth + o.sup + 7], [o.supU[0] + 4, o.depth + o.sup + 7]].map(p => T(p[0], p[1])));
    (o.funnels || []).forEach(f => { d += poli([[f * L - 3.5, o.depth + o.sup], [f * L + 3.5, o.depth + o.sup], [f * L + 0.5, o.depth + o.sup + 22], [f * L - 6.5, o.depth + o.sup + 22]].map(p => T(p[0], p[1]))); });
    (o.masts || []).forEach(f => { d += poli([[f * L - 0.8, o.depth], [f * L + 0.8, o.depth], [f * L + 0.8, 58], [f * L - 0.8, 58]].map(p => T(p[0], p[1]))); });
    return d;
  }
  // me: 1 = metanero, 2 = Prelude
  const SIL = [
    { n: 'Obelisco', m: 67.5, x: 0, w: 6.8, cap: 'Obelisco de Buenos Aires', txt: 'Entra 5 veces en un Q-Max.', d: 'M0,0L6.8,0L6,-63L3.4,-67.5L0.8,-63Z' },
    { n: 'Cancha de fútbol', c: 'Cancha', m: 105, x: 22, w: 68, cap: 'Cancha de fútbol', txt: '105 m de largo. Un metanero estándar mide casi 3 canchas.', cancha: 1 },
    { n: 'Edificio Kavanagh', c: 'Kavanagh', m: 120, x: 106, w: 30, cap: 'Edificio Kavanagh (1936)', txt: 'Fue el edificio más alto de Sudamérica. Un Q-Max parado casi lo triplica.', d: 'M0,0L30,0L30,-70L26,-70L26,-90L22,-90L22,-105L19,-105L19,-120L11,-120L11,-105L8,-105L8,-90L4,-90L4,-70L0,-70Z' },
    { n: 'Alvear Tower', c: 'Alvear', m: 235, x: 152, w: 40, cap: 'Alvear Tower, Puerto Madero', txt: 'El edificio más alto de la Argentina. El Q-Max le saca 110 m.', d: 'M0,0L40,0L40,-212Q40,-235 20,-235Q0,-235 0,-212Z' },
    { n: 'Titanic', m: 269, x: 208, w: 53, cap: 'Titanic (1912)', txt: 'El barco más famoso de la historia. Un metanero estándar le saca 26 m.', ship: { depth: 19, sup: 11, supU: [0.14 * 269, 0.8 * 269], funnels: [0.36, 0.48, 0.6, 0.72], masts: [0.1, 0.9] } },
    { n: 'Metanero estándar', c: 'Metanero', m: 295, x: 277, w: 50, me: 1, cap: 'Metanero estándar', txt: 'Carga 174.000 m³ de GNL. Es el tamaño más común de los más de 800 que navegan.', ship: { depth: 26, trunk: 5, sup: 20, supU: [4, 26], funnel: 1 } },
    { n: 'Q-Max', m: 345, x: 343, w: 56, me: 1, cap: 'Q-Max, el metanero más grande', txt: 'Carga 266.000 m³. Parado sobre la popa sería más alto que cualquier edificio de la Argentina.', ship: { depth: 27, trunk: 6, sup: 24, supU: [4, 30], funnel: 1 } },
    { n: 'Prelude', m: 488, x: 420, w: 78, me: 2, cap: 'Prelude, el barco más grande del mundo', txt: '488 m de largo y 74 m de ancho. No navega: está amarrado frente a Australia y licúa el gas en el mar, sin planta en tierra. Pesa unas 600.000 toneladas.', ship: { depth: 44, sup: 32, supU: [0.07 * 488, 0.9 * 488] } },
  ];
  function barco() {
    const svg = $('#gx-sil-svg'); if (!svg) return;
    const caja = $('#gx-sil'), N = $('#gx-sil-num'), C = $('#gx-sil-cap'), X = $('#gx-sil-txt'), chips = $('#gx-sil-chips');
    let sel = SIL.length - 1;
    const color = o => (o.me === 2 ? 'url(#gx-sil-p)' : o.me ? 'url(#gx-sil-g)' : 'rgba(255,255,255,0.3)');
    const tinta = o => (o.me === 2 ? '#fb923c' : o.me ? '#22d3ee' : '#9aa5b8');
    function dibujar() {
      // Los textos se dibujan siempre al mismo tamaño en pantalla, sea cual sea el ancho
      const r = svg.getBoundingClientRect(), ancho = r.width || 524, u = Math.max(524 / ancho, 585 / (r.height || 585)), chico = ancho < 520;
      let h = '<defs><linearGradient id="gx-sil-g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0891b2"/><stop offset="1" stop-color="#67e8f9"/></linearGradient>' +
        '<linearGradient id="gx-sil-p" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ea580c"/><stop offset="1" stop-color="#fdba74"/></linearGradient></defs>' +
        '<line x1="-14" x2="510" y1="0.5" y2="0.5" stroke="rgba(255,255,255,0.25)" stroke-width="' + u.toFixed(2) + '"/>';
      SIL.forEach((o, i) => {
        let forma;
        if (o.ship) forma = '<path d="' + siluetaBarco(o.m, o.ship) + '" fill="' + color(o) + '"/>';
        else if (o.cancha) forma = '<rect x="0" y="-105" width="68" height="105" rx="1" fill="' + color(o) + '"/><g fill="none" stroke="rgba(10,12,15,0.6)" stroke-width="1"><rect x="2" y="-103" width="64" height="101"/><line x1="2" x2="66" y1="-52.5" y2="-52.5"/><circle cx="34" cy="-52.5" r="9.15"/><rect x="13.85" y="-103" width="40.3" height="16.5"/><rect x="13.85" y="-18.5" width="40.3" height="16.5"/></g>';
        else forma = '<path d="' + o.d + '" fill="' + color(o) + '"/>';
        const cx = o.x + o.w / 2;
        h += '<g class="obj' + (i === sel ? '' : ' dim') + '" data-i="' + i + '" tabindex="0" role="button" aria-label="' + esc(o.n + ', ' + num(o.m) + ' metros') + '">' +
          '<rect x="' + (o.x - 6) + '" y="' + (-o.m - 26) + '" width="' + (o.w + 12) + '" height="' + (o.m + 60) + '" fill="transparent"/>' +
          '<g transform="translate(' + o.x + ',0)"><g class="shape" style="transition-delay:' + (i * 0.1) + 's">' + forma + '</g></g>' +
          '<text x="' + cx + '" y="' + (-o.m - 7 * u).toFixed(1) + '" text-anchor="middle" font-family="DM Mono, monospace" font-size="' + ((chico ? 9.5 : 11.5) * u).toFixed(1) + '" fill="' + tinta(o) + '">' + num(o.m) + (chico ? '' : ' m') + '</text>' +
          (chico ? '' : '<text x="' + cx + '" y="' + (15 * u).toFixed(1) + '" text-anchor="middle" font-family="Outfit, sans-serif" font-size="' + (10.5 * u).toFixed(1) + '" fill="#e8edf5">' + esc(o.c || o.n) + '</text>') + '</g>';
      });
      svg.innerHTML = h;
    }
    function elegir(i) {
      sel = i;
      const o = SIL[i];
      $$('.obj', svg).forEach((g, k) => g.classList.toggle('dim', k !== i));
      $$('button', chips).forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-pressed', k === i); });
      N.textContent = num(o.m) + ' m'; N.style.color = tinta(o) === '#9aa5b8' ? '' : tinta(o);
      C.textContent = o.cap; X.textContent = o.txt;
    }
    chips.innerHTML = SIL.map((o, i) => '<button type="button" class="ax-btn" data-i="' + i + '" aria-pressed="false">' + esc(o.c || o.n) + '</button>').join('');
    chips.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { elegir(+b.dataset.i); track('atlas_gnl_escala', { obj: SIL[+b.dataset.i].n }); } });
    svg.addEventListener('click', e => { const g = e.target.closest('.obj'); if (g) elegir(+g.dataset.i); });
    svg.addEventListener('keydown', e => { const g = e.target.closest('.obj'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); elegir(+g.dataset.i); } });
    let w0 = 0;
    new ResizeObserver(() => { const q = svg.getBoundingClientRect(), w = Math.round(q.width) + 'x' + Math.round(q.height); if (w !== w0) { w0 = w; dibujar(); } }).observe(svg);
    dibujar(); elegir(sel);
    // Las siluetas "crecen" desde el piso cuando la sección entra en pantalla
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); caja.classList.add('go'); } }, { threshold: 0.25 });
    io.observe(caja);
    piezas('#gx-piezas', '#gx-barco-svg', '#gx-pieza-det');
  }
  function piezas(lista, svg, det) {
    const items = $$(lista + ' button'), D = $(det);
    function ir(i) {
      items.forEach((b, j) => b.classList.toggle('on', j === i));
      $$(svg + ' .hs').forEach((h, j) => {
        const on = j === i;
        h.querySelector('.p').setAttribute('r', on ? 13 : 10);
        h.querySelector('.p').setAttribute('fill', on ? '#22d3ee' : '#11141a');
        h.querySelector('text').setAttribute('fill', on ? '#04161a' : '#e8edf5');
      });
      D.innerHTML = items[i].dataset.det;
    }
    items.forEach((b, i) => b.addEventListener('click', () => { ir(i); track('atlas_gnl_barco', { parte: i }); }));
    $$(svg + ' .hs').forEach((h, i) => h.addEventListener('click', () => ir(i)));
    ir(0);
  }

  // ============ 3. ¿Cuánto le dura un barco a un país? ============
  // Un barco estándar (174.000 m³ de GNL) ≈ 100 millones de m³ de gas. Consumo 2025 en bcm/año.
  const DURA = [
    ['Argentina', 'todo el país', 43.6], ['Hogares argentinos', 'solo consumo de las casas', null, 3.5 * 24],
    ['España', 'todo el país', 31.3], ['Alemania', 'todo el país', 78.5], ['Japón', 'todo el país', 90.4],
    ['China', 'todo el país', 441.9], ['Estados Unidos', 'todo el país', 913.4],
  ];
  function dura() {
    const box = $('#gx-paises'); if (!box) return;
    const svg = $('#gx-anillo-svg'), V = $('#gx-dura-v'), U = $('#gx-dura-u'), X = $('#gx-dura-x');
    const R = 86, C = 2 * Math.PI * R, COL = ['#67e8f9', '#22d3ee', '#0891b2', '#0e7490'];
    const vueltas = COL.map(c => {
      const e = document.createElementNS(NS, 'circle');
      e.setAttribute('cx', 100); e.setAttribute('cy', 100); e.setAttribute('r', R);
      e.setAttribute('fill', 'none'); e.setAttribute('stroke', c); e.setAttribute('stroke-width', 12); e.setAttribute('stroke-linecap', 'round');
      e.setAttribute('stroke-dasharray', '0 ' + C); svg.appendChild(e); return e;
    });
    DURA.forEach(d => { d.h = d[3] || 100 / (d[2] * 1000 / 365) * 24; });
    box.innerHTML = DURA.map((d, i) => '<button type="button" data-i="' + i + '"><span>' + esc(d[0]) + '<small>' + esc(d[1]) + '</small></span><em>' + (d[2] ? num(d[2]) + ' bcm/año' : '') + '</em></button>').join('');
    let anim = 0;
    function dibujar(p) { vueltas.forEach((e, i) => { const f = Math.max(0, Math.min(1, p - i)); e.setAttribute('stroke-dasharray', (f * C).toFixed(1) + ' ' + C); e.style.opacity = f > 0 ? 1 : 0; }); }
    function elegir(i) {
      $$('button', box).forEach((b, j) => b.classList.toggle('on', j === i));
      const d = DURA[i], h = d.h, total = Math.min(COL.length, h / 24);
      const t = h < 1 ? [Math.round(h * 60), 'minutos'] : h < 48 ? [Math.round(h), 'horas'] : [num(Math.round(h / 24 * 10) / 10), 'días'];
      V.textContent = t[0]; U.textContent = t[1] + ' · ' + d[0];
      X.textContent = total > 1 ? num(total, 1) + ' vueltas de reloj' : 'una vuelta = 24 horas';
      cancelAnimationFrame(anim);
      if (REDUCIR) return dibujar(total);
      const t0 = performance.now(), ms = Math.min(3600, 800 + total * 800);
      (function f(tm) { const q = Math.min(1, (tm - t0) / ms); dibujar(total * (1 - Math.pow(1 - q, 2))); if (q < 1) anim = requestAnimationFrame(f); })(t0);
    }
    box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { elegir(+b.dataset.i); track('atlas_gnl_dura', { pais: DURA[+b.dataset.i][0] }); } });
    elegir(0);
  }

  // ============ 4. La cadena (pestañas) ============
  function cadena() {
    const tabs = $$('.ax-proc-tabs button'); if (!tabs.length) return;
    const panes = $$('.ax-proc-txt'), vis = $$('.ax-proc-vis [data-s]');
    let i = 0;
    function ir(n) {
      i = (n + tabs.length) % tabs.length;
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', j === i); t.classList.toggle('on', j === i); });
      panes.forEach((p, j) => { p.hidden = j !== i; });
      vis.forEach(v => v.classList.toggle('on', +v.dataset.s === i));
      const N = $('#gx-cad-n'), K = $('#gx-cad-c');
      N.textContent = panes[i].dataset.num; K.textContent = panes[i].dataset.cap;
      const fila = tabs[i].parentElement;
      fila.scrollTo({ left: tabs[i].offsetLeft - fila.clientWidth / 2 + tabs[i].offsetWidth / 2, behavior: REDUCIR ? 'auto' : 'smooth' });
    }
    tabs.forEach((t, j) => t.addEventListener('click', () => { ir(j); track('atlas_gnl_cadena', { paso: j }); }));
    $('#proc-ant').addEventListener('click', () => ir(i - 1));
    $('#proc-sig').addEventListener('click', () => ir(i + 1));
    ir(0);
  }

  // ============ 5. El mapa: quién vende, quién compra, rutas y pasos críticos ============
  // Mt de GNL en 2025 (IGU World LNG Report 2026): e = exporta, i = importa
  const M = {
    '840': { e: 110.7, f: '1.º exportador del mundo desde 2023. En 2016 recién mandaba su primer barco.' },
    '634': { e: 81.5, f: 'Todo su GNL sale por el Estrecho de Ormuz. En marzo de 2026 un ataque dejó fuera el 17% de su capacidad.' },
    '036': { e: 80.3, f: 'El gran proveedor de Japón, Corea y China.' },
    '643': { e: 30.5, f: '1.º en reservas de gas del mundo. La Unión Europea prohíbe su GNL desde 2027.' },
    '458': { e: 28.8, i: 3.0 }, '360': { e: 16.5, i: 5.5 }, '566': { e: 14.8 }, '512': { e: 11.9 },
    '012': { e: 9.7, f: 'El primer exportador de la historia: 1964, rumbo a Inglaterra.' },
    '780': { e: 8.9 }, '598': { e: 8.5 }, '784': { e: 4.7 }, '024': { e: 4.9 }, '096': { e: 4.6 }, '604': { e: 3.8 }, '508': { e: 3.7 },
    '578': { e: 3.3, f: 'Casi todo lo exporta por caño: 115 mil millones de m³ por año a Europa.' },
    '124': { e: 2.1, f: 'Debutó como exportador de GNL en 2025.' },
    '818': { i: 9.6, f: 'Pasó de exportar a necesitar importar.' },
    '156': { i: 69.8, f: 'El mayor comprador. Desde febrero de 2025 no le compra GNL a EE.UU. por los aranceles.' },
    '392': { i: 67.4, f: 'Casi no tiene gas propio. Récord de compras en 2014, tras Fukushima.' },
    '410': { i: 48.7 }, '356': { i: 24.6, f: 'Casi la mitad de su GNL viene de Qatar. Muy sensible al precio.' }, '158': { i: 24.2 },
    '250': { i: 21.6 }, '724': { i: 16.9 }, '528': { i: 16.3 }, '380': { i: 15.1 }, '792': { i: 12.4 }, '764': { i: 10.9 },
    '056': { i: 9.3 }, '826': { i: 9.3 },
    '276': { i: 7.1, f: 'En 2022 armó una terminal flotante en 194 días para dejar el gas ruso.' },
    '050': { i: 7.9 }, '414': { i: 7.3 }, '586': { i: 6.5 }, '616': { i: 6.2 },
    '032': { i: 0.7, f: 'Todavía importa GNL en invierno (0,7 Mt en 2025). Su primer barco exportado se espera para fines de 2027.' },
    '364': { e: 0, f: '2.º en reservas de gas del mundo… y exporta cero GNL.' },
    '795': { e: 0, f: 'Reservas enormes: todo su gas viaja por caño a China.' },
  };
  const FLUJOS = [
    ['840', '528', 12], ['840', '250', 9], ['840', '826', 7.5], ['840', '276', 7], ['840', '724', 6], ['840', '380', 6], ['840', '792', 5], ['840', '392', 5.5], ['840', '818', 4.5], ['840', '410', 4.5],
    ['634', '156', 20], ['634', '356', 12], ['634', '158', 8], ['634', '410', 7], ['634', '586', 6], ['634', '380', 5],
    ['036', '392', 27], ['036', '156', 21], ['036', '410', 15], ['036', '158', 8],
    ['643', '156', 7], ['643', '250', 6.3], ['643', '392', 5], ['643', '056', 3.5], ['643', '724', 3.5],
    ['458', '392', 8], ['458', '156', 8], ['360', '156', 3.5], ['360', '392', 3.5], ['360', '410', 3.5],
    ['512', '410', 3.5], ['512', '392', 3.5], ['566', '724', 2.5], ['566', '250', 2.5], ['012', '380', 2.5], ['012', '792', 2.5], ['012', '250', 2.5],
  ];
  const BARCOS_POR_MT = 15.7; // 6.870 viajes / 437 Mt
  // Puntos de paso [lon, lat]
  const SABINE = [-93.87, 29.73], RAS = [51.54, 25.93], TOKIO = [139.8, 35.3], ROTT = [4.05, 51.96];
  const ORMUZ = [56.4, 26.5], MALACA = [101, 2.5], BAB = [43.3, 12.6], SUEZ = [32.5, 30.3], PANAMA = [-79.7, 9.1], CABO = [18.5, -35.5];
  const CANAL = [[-8, 48.8], [1.5, 51], ROTT], ASIA = [MALACA, [104, 1.2], [112, 10], [122, 22], TOKIO];
  const RUTAS = {
    r1: { n: 'EE.UU. → Europa · ~11 días', pts: [SABINE, [-88, 26], [-80.5, 24.3], [-70, 32], [-40, 43], ...CANAL] },
    r2: { n: 'EE.UU. → Japón por Panamá · ~20 días', pts: [SABINE, [-88, 24], [-81, 18], PANAMA, [-85, 5], [-140, 25], [160, 33], TOKIO] },
    r3: { n: 'EE.UU. → Japón por el Cabo · ~35 días', pts: [SABINE, [-80.5, 24.3], [-55, 15], [-25, -10], CABO, [60, -22], [80, 3], [95, 6], ...ASIA] },
    r4: { n: 'Qatar → Japón · ~14 días', pts: [RAS, ORMUZ, [60, 23], [77, 6], [95, 6], ...ASIA] },
    r5a: { n: 'Qatar → Europa por Suez · sin uso desde 2024', sinUso: 1, pts: [RAS, ORMUZ, [60, 22], [51, 13], BAB, [38, 20], SUEZ, [25, 34], [10, 37.5], [-5.5, 36], [-10, 40], ...CANAL] },
    r5b: { n: 'Qatar → Europa por el Cabo · 24–29 días', pts: [RAS, ORMUZ, [60, 20], [52, -2], [42, -15], [35, -28], CABO, [5, -15], [-18, 10], [-18, 25], [-12, 40], ...CANAL] },
    r6: { n: 'Australia → Japón · ~8 días', pts: [[115.4, -20.8], [117, -9], [119, 0], [124, 8], [128, 22], TOKIO] },
    r7: { n: 'Rusia (Ártico) → Europa · 6–9 días', pts: [[72.07, 71.27], [60, 74], [40, 72], [20, 71.5], [5, 65], [3, 56], [3.19, 51.35]] },
    r9: { n: 'EE.UU. → Argentina (Escobar) · ~14 días', pts: [SABINE, [-80.5, 24.3], [-60, 15], [-35, -5], [-45, -25], [-56, -35.5], [-58.78, -34.29]] },
    r10: { n: 'Qatar → India · ~3 días', pts: [RAS, ORMUZ, [62, 23], [72.54, 21.67]] },
  };
  const PASOS = [
    { id: 'ormuz', n: 'Estrecho de Ormuz', p: ORMUZ, big: '20%', cap: 'del GNL mundial pasaba por acá', r: ['r4', 'r5a', 'r5b', 'r10'], f: '39 km de ancho y sin ruta alternativa: es la única salida del gas de Qatar y Emiratos. En 2026, durante semanas no lo cruzó ni un metanero cargado.' },
    { id: 'malaca', n: 'Estrecho de Malaca', p: MALACA, big: '2.º', cap: 'paso más transitado por el GNL', r: ['r3', 'r4'], f: 'La puerta de entrada a Asia para el gas del Golfo y de África rumbo a Japón, Corea y China.' },
    { id: 'bab', n: 'Bab el-Mandeb · Mar Rojo', p: BAB, big: '≈ 0', cap: 'metaneros lo cruzan hoy', r: ['r5a'], f: 'Por los ataques hutíes, desde enero de 2024 Qatar rodea África: el viaje a Europa pasó de 17 a casi 29 días.' },
    { id: 'suez', n: 'Canal de Suez', p: SUEZ, big: '−78%', cap: 'de GNL desde 2023', r: ['r5a'], f: 'El tránsito de GNL cayó de 4,1 a 0,9 Bcf por día entre 2023 y 2025 (EIA).' },
    { id: 'panama', n: 'Canal de Panamá', p: PANAMA, big: '26 → 4', cap: 'metaneros por mes', r: ['r2'], f: 'La sequía de 2023-24 vació el lago Gatún. Muchos barcos de EE.UU. ahora rodean África para llegar a Asia.' },
    { id: 'cabo', n: 'Cabo de Buena Esperanza', p: CABO, big: '+12 a +15', cap: 'días de viaje', r: ['r3', 'r5b'], f: 'El desvío obligado de 2024-2026: el mismo gas necesita más barcos y más semanas en el mar.' },
  ];

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
  function fichaPais(iso, nom) {
    const d = M[iso];
    if (!d) return 'No es un jugador grande del GNL.';
    const partes = [];
    if (d.e) partes.push('Exporta ' + num(d.e) + ' Mt (≈ ' + num(Math.round(d.e * BARCOS_POR_MT / 10) * 10, 0) + ' barcos por año).');
    if (d.i) partes.push('Importa ' + num(d.i) + ' Mt (≈ ' + num(Math.round(d.i * BARCOS_POR_MT / 10) * 10, 0) + ' barcos por año).');
    if (d.f) partes.push(d.f);
    return partes.join(' ');
  }

  function mapa() {
    const canvas = $('#globo-gnl'); if (!canvas) return;
    const tip = tooltip(canvas.parentElement);
    const lista = $('#gx-lista'), det = $('#gx-mapa-det'), tit = $('#gx-mapa-t');
    let modo = 'e', sel = null;
    const g = AtlasGlobo(canvas, {
      base: BASE, foco: [60, 25],
      onPais: (iso, nom, xy) => { if (!iso) return tip(null); tip(window.AtlasPaises[iso] ? nombre(iso) : nom, window.AtlasTerritorio[iso] || fichaPais(iso), xy, iso); track('atlas_gnl_pais', { pais: nom }); },
      onPunto: id => elegir(id),
    });
    const COL = { e: '#fb923c', i: '#22d3ee' };
    const TIT = { e: 'Tres países venden casi dos de cada tres barcos.', i: 'Asia y Europa se reparten las compras.', r: 'Un océano de rutas. Unos pocos pasos obligados.' };

    function pintar(conLista) {
      tit.textContent = TIT[modo];
      if (modo === 'r') {
        const paso = PASOS.find(p => p.id === sel);
        g.set({
          resaltes: {}, arcos: [], etiquetas: [],
          rutas: Object.keys(RUTAS).map(k => {
            const r = RUTAS[k], enPaso = paso && paso.r.includes(k);
            return { pts: r.pts, c: enPaso ? '#ff6b6b' : r.sinUso ? '#9aa5b8' : '#60a5fa', w: enPaso ? 2.4 : 1.5, corte: r.sinUso || (enPaso && paso.id === 'ormuz'), apagado: !!paso && !enPaso };
          }),
          puntos: PASOS.map(p => ({ id: p.id, p: p.p, c: '#ff6b6b', r: p.id === sel ? 6 : 4.5, pulso: p.id === sel, t: p.id === sel ? p.n : '' })),
        });
        if (conLista) lista.innerHTML = PASOS.map(p => '<li><button type="button" class="paso" data-id="' + p.id + '" style="--c:#ff6b6b"><span class="r">' + esc(p.n) + '</span><span class="v"><b>' + esc(p.big) + '</b> ' + esc(p.cap) + '</span></button></li>').join('');
        det.innerHTML = paso ? '<b>' + esc(paso.n) + ': ' + esc(paso.big) + ' ' + esc(paso.cap) + '.</b> ' + esc(paso.f) + (paso.id === 'ormuz' ? ' Si se cierra, las rutas en rojo quedan cortadas.' : '')
          : 'Las líneas son las rutas típicas de los barcos; la gris (Suez) está sin uso desde 2024. Tocá un paso crítico, en la lista o en el globo.';
      } else {
        const k = modo, max = k === 'e' ? 110.7 : 69.8, c = COL[k];
        const res = {};
        for (const iso in M) { const v = M[iso][k]; if (v >= 1) res[iso] = [c, 0.2 + 0.8 * Math.sqrt(v / max)]; }
        const fl = sel ? FLUJOS.filter(f => f[k === 'e' ? 0 : 1] === sel) : [];
        fl.forEach(f => { const otro = f[k === 'e' ? 1 : 0]; res[otro] = res[otro] || [k === 'e' ? COL.i : COL.e, 0.45]; });
        g.set({
          resaltes: res, rutas: [], puntos: [],
          etiquetas: sel ? [sel, ...fl.slice(0, 4).map(f => f[k === 'e' ? 1 : 0])] : [],
          arcos: fl.map(f => ({ de: f[0], a: f[1], c, w: 0.8 + f[2] / 6 })),
        });
        const top = Object.keys(M).filter(iso => M[iso][k] >= 1).sort((a, b) => M[b][k] - M[a][k]).slice(0, 8);
        if (conLista) lista.innerHTML = top.map(iso => '<li><button type="button" data-id="' + iso + '" style="--c:' + c + '"><span class="r">' + esc(nombre(iso)) + '</span><span class="v">' + num(M[iso][k]) + ' Mt</span><span class="b"><i style="width:' + Math.round(M[iso][k] / max * 100) + '%"></i></span></button></li>').join('');
        det.innerHTML = sel ? '<b>' + esc(nombre(sel)) + '.</b> ' + esc(fichaPais(sel)) + (fl.length ? ' Los arcos son sus principales ' + (k === 'e' ? 'clientes' : 'proveedores') + '.' : '')
          : (k === 'e' ? 'EE.UU., Qatar y Australia suman el 62% de los 437 millones de toneladas que se vendieron en 2025.' : 'China, Japón y Corea del Sur compran más de 4 de cada 10 barcos.') + ' Tocá un país de la lista.';
      }
      $$('button', lista).forEach(b => b.classList.toggle('on', b.dataset.id === sel));
    }
    function elegir(id) {
      sel = sel === id ? null : id;
      pintar(false);
      if (sel) {
        const p = modo === 'r' ? PASOS.find(x => x.id === sel).p : [window.AtlasPaises[sel][1], window.AtlasPaises[sel][2]];
        g.girarA(p, 1000);
        if (window.innerWidth < 900) canvas.scrollIntoView({ behavior: REDUCIR ? 'auto' : 'smooth', block: 'center' });
        track('atlas_gnl_mapa', { modo, sel });
      }
    }
    lista.addEventListener('click', e => { const b = e.target.closest('button'); if (b) elegir(b.dataset.id); });
    grupo('[data-mapa]', b => {
      modo = b.dataset.mapa; sel = null; pintar(true);
      g.girarA(modo === 'e' ? [60, 25] : modo === 'i' ? [100, 30] : [50, 15], 1100);
    });
    pintar(true);
  }

  // ============ 6. El mismo gas, tres precios ============
  // US$ por MMBtu, promedio del período: Henry Hub y TTF (Banco Mundial / EIA); Asia: JKM spot (S&P Global) desde 2020,
  // antes precio de importación de GNL en Japón (Banco Mundial). 2025 es aproximado.
  const PRECIOS = [
    ['2010–15', 3.6, 9.8, 14.2, 'Mercados separados. Tras Fukushima, Japón compra todo el gas que encuentra y Asia paga carísimo.'],
    ['2016–19', 2.8, 5.7, 9.3, 'EE.UU. empieza a exportar su gas de shale y sobra oferta: precios bajos en todos lados.'],
    ['2020', 2.0, 3.2, 4.4, 'Pandemia: la demanda se desploma y se cancelan cargamentos enteros.'],
    ['2021', 3.9, 16.1, 18.6, 'Rebote: la industria vuelve con los depósitos vacíos.'],
    ['2022', 6.4, 40.3, 34, 'Guerra en Ucrania: Europa se queda sin gas ruso y paga lo que sea. Por primera vez paga más que Asia. El pico diario pasó los US$ 70.'],
    ['2023', 2.5, 13.1, 13.8, 'Los precios bajan, pero Europa ya no vuelve al gas ruso barato.'],
    ['2024', 2.2, 11, 11.9, 'Inviernos suaves y más renovables: el año más calmo desde la pandemia. En EE.UU., el gas más barato en décadas.'],
    ['2025', 3.5, 12, 12.2, 'Antes de la crisis de Ormuz: Europa y Asia pagan más de 3 veces lo que vale el gas en EE.UU.'],
  ];
  function precios() {
    const per = $('#gx-per'); if (!per) return;
    per.innerHTML = PRECIOS.map((p, i) => '<button type="button" class="ax-btn" data-i="' + i + '" aria-pressed="false">' + p[0] + '</button>').join('');
    const cols = $$('#gx-per-cols .gx-col'), carg = $$('#gx-per-et b'), txt = $('#gx-per-t');
    function ir(i) {
      const p = PRECIOS[i];
      $$('button', per).forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-pressed', j === i); });
      [1, 2, 3].forEach((k, j) => {
        cols[j].querySelector('.c').style.height = Math.max(3, p[k] / 40 * 78) + '%';
        contar(cols[j].querySelector('.n'), p[k], v => 'US$ ' + num(v, 1));
        contar(carg[j], p[k] * 3.8, v => 'un barco: US$ ' + Math.round(v) + ' M');
      });
      txt.textContent = p[4];
    }
    per.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { ir(+b.dataset.i); track('atlas_gnl_precio', { periodo: PRECIOS[+b.dataset.i][0] }); } });
    ir(7);
  }

  // ============ 7. Ormuz 2026 ============
  // flete: US$ por día de alquiler de un metanero (aprox.). paso: tránsito por el estrecho (esquema)
  const ORMUZ_T = [
    ['28 feb', 'Empieza la guerra: Estados Unidos e Israel atacan Irán.', 40000, 100, '≈ 3 metaneros por día'],
    ['2–4 mar', 'Drones sobre Ras Laffan. Qatar frena su GNL y declara fuerza mayor.', 105000, 3, 'frenado'],
    ['5 mar', 'El alquiler de un metanero toca un récord.', 300000, 3, 'frenado'],
    ['18 mar', 'Misiles dañan dos líneas de la planta: el 17% de la capacidad de Qatar queda fuera por 3 a 5 años.', 300000, 3, 'frenado'],
    ['mar–may', 'Durante semanas no cruza ni un metanero cargado. El 11 de mayo pasa el primero.', 250000, 3, 'frenado'],
    ['jul–ago', 'Dos metaneros qataríes son alcanzados en un mes. Qatar suspende 24 cargamentos más.', 180000, 10, 'muy reducido'],
    ['sep', 'Recuperación parcial: unos 4 barcos por semana, contra 3 por día antes de la guerra.', 60000, 19, '≈ 4 por semana'],
  ];
  function ormuz() {
    const tl = $('#gx-tl'); if (!tl) return;
    tl.innerHTML = ORMUZ_T.map((x, i) => '<button type="button" data-i="' + i + '"><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></button>').join('');
    const F = $('#gx-flete-v'), B = $('#gx-paso-b'), E = $('#gx-paso-e');
    function ir(i) {
      $$('button', tl).forEach((b, j) => b.classList.toggle('on', j === i));
      const x = ORMUZ_T[i];
      contar(F, x[2], v => 'US$ ' + num(Math.round(v / 1000) * 1000, 0));
      B.style.width = x[3] + '%'; B.style.background = x[3] < 50 ? '#ff6b6b' : '';
      E.textContent = x[4];
    }
    tl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { ir(+b.dataset.i); track('atlas_gnl_ormuz', { paso: +b.dataset.i }); } });
    ir(0);
  }

  // ============ 8. La paradoja: reservas vs exportación ============
  const PARA = [['Rusia', 37.4, 30.5], ['Irán', 32.1, 0], ['Qatar', 24.7, 81.5], ['Turkmenistán', 13.6, 0], ['Estados Unidos', 12.6, 110.7], ['Australia', 2.4, 80.3]];
  function paradoja() {
    const box = $('#gx-para'); if (!box) return;
    box.innerHTML = PARA.map(d => '<div><span class="n">' + esc(d[0]) + '</span><span class="t"><i></i><span></span></span></div>').join('');
    const nota = $('#gx-para-n');
    function ver(k) {
      const j = k === 'res' ? 1 : 2, max = Math.max(...PARA.map(d => d[j])), c = k === 'res' ? '#a78bfa' : '#fb923c';
      $$('.t', box).forEach((t, i) => {
        const v = PARA[i][j];
        t.querySelector('i').style.width = (v / max * 100) + '%'; t.querySelector('i').style.background = c;
        t.querySelector('span').textContent = k === 'res' ? num(v) + ' billones de m³' : v ? num(v) + ' Mt · ≈ ' + num(Math.round(v * BARCOS_POR_MT / 10) * 10, 0) + ' barcos' : '0 · ni un barco';
      });
      nota.innerHTML = k === 'res'
        ? 'Con sus reservas, <b>Rusia podría llenar unos 432.000 barcos</b>: 63 años de todo el comercio mundial de GNL de hoy.'
        : 'En 2025, <b>Estados Unidos llenó unos 1.740 barcos</b>. Irán y Turkmenistán, con reservas enormes, <b>ninguno</b>: sanciones, falta de plantas y gas que sale por caño.';
    }
    grupo('[data-para]', b => { ver(b.dataset.para); track('atlas_gnl_paradoja', { k: b.dataset.para }); });
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); ver('res'); } }, { threshold: 0.3 });
    io.observe(box);
  }

  // ============ 9. Quién gana: margen por eslabón ============
  // v = margen aproximado (%), var = muy variable. Son márgenes de distinto tipo: sirven para ver órdenes de magnitud.
  const GANA = [
    { n: 'Patente de los tanques', e: 'GTT (Francia)', v: 65, t: '≈ 60–68% (EBITDA)', tk: 'GTT.PA', d: 'No construye nada: cobra una licencia por cada barco que usa sus tanques de membrana, que son 8 de cada 10. Sin acero, sin astillero, sin riesgo. Es el eslabón que más se queda.' },
    { n: 'Tecnología de licuefacción', e: 'Air Products, Linde', v: 18, t: '≈ 15–20% (operativo)', tk: 'APD', d: 'Hacen los intercambiadores de calor gigantes que enfrían el gas. Pocas empresas saben hacerlo, y cobran en cada planta nueva.' },
    { n: 'Productor', e: 'Cheniere, QatarEnergy', v: 18, t: '≈ 14–21% (neto)', tk: 'LNG', d: 'Dueños del gas y de las plantas. Venden con contratos de 15 a 20 años que les aseguran ingresos estables, aunque tuvieron que endeudarse muchísimo para construir.' },
    { n: 'Astillero', e: 'Samsung Heavy, Hanwha Ocean', v: 5, t: 'un dígito bajo (operativo)', tk: '010140.KS', d: 'Construyen un barco de más de US$ 250 millones y se quedan con muy poco: cargan con el precio del acero, la mano de obra y los atrasos.' },
    { n: 'Naviera', e: 'Flex LNG, Nakilat', v: 30, var: 1, t: 'muy variable', tk: 'FLNG', d: 'Alquilan los barcos. En 2022 cobraban US$ 400.000 por día; en 2024, entre 30.000 y 50.000. Y la deuda del barco se paga igual.' },
    { n: 'Comercializador', e: 'Shell, TotalEnergies', v: 45, var: 1, t: 'variable · alto en crisis', tk: 'SHEL', d: 'Compran cargamentos sin destino fijo y los mandan a donde más pagan. Cuando Asia y Europa se pelean por el gas, la diferencia de precio es su ganancia.' },
    { n: 'Distribuidora', e: 'Enagás, KOGAS', v: 6, t: 'un dígito, regulado', tk: 'ENG.MC', d: 'Reciben el barco y llevan el gas a las casas. Ganancia chica y estable, con tarifa fijada por el Estado.' },
  ];
  function gana() {
    const box = $('#gx-gana'); if (!box) return;
    const det = $('#gx-gana-d');
    box.innerHTML = GANA.map((x, i) => '<button type="button" data-i="' + i + '"><span class="n">' + esc(x.n) + '<small>' + esc(x.e) + '</small></span><span class="t"><i class="' + (x.var ? 'var' : '') + '" style="background:' + (x.v > 40 ? '#4ade9a' : x.v > 10 ? '#60a5fa' : '#ff6b6b') + '"></i><span>' + esc(x.t) + '</span></span></button>').join('');
    function ir(i) {
      $$('button', box).forEach((b, j) => b.classList.toggle('on', j === i));
      const x = GANA[i];
      det.innerHTML = '<b>' + esc(x.n) + ' · ' + esc(x.e) + '.</b> ' + esc(x.d) + ' <a href="' + BASE + 'pages/ticker.html?symbol=' + encodeURIComponent(x.tk) + '">Ver la acción →</a>';
    }
    box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { ir(+b.dataset.i); track('atlas_gnl_gana', { i: +b.dataset.i }); } });
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      $$('.t i', box).forEach((b, i) => { b.style.width = (GANA[i].v / 70 * 100) + '%'; });
    }, { threshold: 0.3 });
    io.observe(box);
    ir(0);
  }

  // ============ 10. Argentina ============
  const VM = [-68.6, -38.4], SAO = [-64.9, -41.0], ESCOBAR = [-58.78, -34.29];
  function argentina() {
    const canvas = $('#globo-arg'); if (!canvas) return;
    const g = AtlasGlobo(canvas, { base: BASE, foco: [-62, -36] });
    const VISTAS = {
      arg: { foco: [-62, -36], t: 'El gas de Vaca Muerta (el punto naranja) va a llegar a la costa por un gasoducto nuevo de 472 km (previsto para 2028) hasta el Golfo San Matías, en Río Negro. Ahí lo esperan los barcos-planta que lo enfrían y lo cargan.' },
      eur: { foco: [-25, 10], t: 'Rumbo a Alemania: unos 20 días por el Atlántico. La empresa estatal alemana SEFE acordó comprar hasta 2 millones de toneladas por año durante 8 años.' },
      asia: { foco: [-150, -20], t: 'Rumbo a Asia: 30 a 35 días, cruzando el Pacífico por el sur. Es donde más se paga el gas, pero también el viaje más largo.' },
    };
    g.set({
      resaltes: { '032': ['#4ade9a', 0.55], '276': ['#22d3ee', 0.6], '392': ['#22d3ee', 0.6] },
      puntos: [{ p: VM, c: '#fb923c', r: 4 }, { p: SAO, c: '#22d3ee', r: 5, pulso: true, t: 'Golfo San Matías' }, { p: ESCOBAR, c: '#9aa5b8', r: 3 }],
      rutas: [
        { pts: [VM, SAO], c: '#fb923c', w: 2.5 },
        { pts: [SAO, [-55, -40], [-30, -10], [-20, 15], [-12, 40], [-6, 48.5], [1.5, 51], [8.1, 53.6]], c: '#22d3ee', w: 1.8 },
        { pts: [SAO, [-63, -48], [-66.5, -55.5], [-76, -53], [-110, -40], [-160, -10], [165, 20], TOKIO], c: '#22d3ee', w: 1.8 },
      ],
    });
    const txt = $('#gx-arg-t');
    grupo('[data-arg]', b => { const v = VISTAS[b.dataset.arg]; g.girarA(v.foco, 1300); txt.textContent = v.t; track('atlas_gnl_arg', { vista: b.dataset.arg }); });
    txt.textContent = VISTAS.arg.t;
  }

  // ============ 11. Clima: CO₂ y fugas de metano ============
  // kg de CO₂ por MMBtu al quemar (EIA). Metano: ~19 kg por MMBtu de gas. GWP del metano fósil (IPCC AR6): 82,5 a 20 años y 29,8 a 100.
  function clima() {
    const r = $('#gx-fuga-r'); if (!r) return;
    const B = $$('#gx-clima .t'), V = $('#gx-fuga-v'), X = $('#gx-clima-t');
    let gwp = 82.5;
    function pintar() {
      const L = r.value / 100, gas = 53 + 19 * L / (1 - L) * gwp, vals = [95, 74, gas], max = 150;
      B.forEach((t, i) => {
        t.querySelector('i').style.width = Math.min(100, vals[i] / max * 100) + '%';
        if (i === 2) t.querySelector('i').style.background = gas > 95 ? '#ff6b6b' : '#22d3ee';
        t.querySelector('span').textContent = Math.round(vals[i]) + ' kg' + (i === 2 && L > 0 ? ' · ' + Math.round(gas - 53) + ' son de fugas' : '');
      });
      V.textContent = num(+r.value, 1) + '%';
      const dif = Math.round((1 - gas / 95) * 100);
      X.innerHTML = gas > 95
        ? '<b>Con esta fuga, el gas calienta más que el carbón</b> (' + Math.abs(dif) + '% más), mirado a ' + (gwp > 50 ? '20' : '100') + ' años.'
        : 'Con esta fuga, el gas emite <b>' + dif + '% menos</b> que el carbón, mirado a ' + (gwp > 50 ? '20' : '100') + ' años.';
    }
    r.addEventListener('input', pintar);
    grupo('[data-gwp]', b => { gwp = +b.dataset.gwp; pintar(); track('atlas_gnl_clima', { gwp }); });
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); pintar(); } }, { threshold: 0.3 });
    io.observe($('#gx-clima'));
  }

  // ============ 12. Quiz ============
  const QUIZ = [
    { q: '¿A qué temperatura el gas natural se vuelve líquido?', o: ['−18 °C', '−78 °C', '−162 °C', '−273 °C'], ok: 2, e: 'A −162 °C. Ahí ocupa 600 veces menos y entra en un barco.' },
    { q: '¿Qué país exportó más GNL en 2025?', o: ['Qatar', 'Estados Unidos', 'Australia', 'Rusia'], ok: 1, e: 'Estados Unidos, con 110,7 millones de toneladas. En 2016 recién mandaba su primer barco.' },
    { q: '¿Qué parte del GNL del mundo pasaba por el Estrecho de Ormuz?', o: ['2%', '5%', '20%', '50%'], ok: 2, e: '1 de cada 5 barcos. Y no hay otra salida para el gas de Qatar.' },
    { q: 'En la cadena del GNL, ¿quién se queda con el margen más alto?', o: ['El astillero que construye el barco', 'El dueño de la patente de los tanques', 'La naviera', 'La distribuidora de gas'], ok: 1, e: 'GTT, que licencia los tanques de membrana, gana más del 60%. El astillero, un dígito.' },
    { q: '¿Para cuándo se espera el primer barco de GNL exportado desde Argentina?', o: ['Ya salió', 'Fines de 2027', '2035', 'No hay fecha'], ok: 1, e: 'Fines de 2027, desde el Golfo San Matías, con el barco-planta Hilli Episeyo.' },
  ];
  function quiz() {
    const box = $('#quiz'); if (!box) return;
    let i = 0, pts = 0;
    function pintar() {
      if (i >= QUIZ.length) {
        const msj = pts === QUIZ.length ? 'Sabés más de gas que mucha gente del rubro.' : pts >= 3 ? 'Muy bien. Repasá lo que falló y probá de nuevo.' : 'Volvé a recorrer la página: todo está ahí arriba.';
        box.innerHTML = '<p class="ax-eyebrow">Resultado</p><p class="ax-quiz-q"><b>' + pts + ' de ' + QUIZ.length + '.</b> ' + msj + '</p>' +
          '<div class="ax-chips"><button type="button" class="ax-btn primario" id="quiz-comp">Compartir resultado</button><button type="button" class="ax-btn" id="quiz-otra">Jugar de nuevo</button></div><p class="ax-quiz-exp" id="quiz-msg"></p>';
        $('#quiz-otra').onclick = () => { i = 0; pts = 0; pintar(); };
        $('#quiz-comp').onclick = async () => {
          const url = location.origin + location.pathname;
          const txt = 'Saqué ' + pts + '/' + QUIZ.length + ' en el quiz de GNL del Atlas de BB Finanzas. ¿Sabés cuánto le dura un barco de gas a la Argentina?';
          try {
            if (navigator.share) await navigator.share({ title: 'El gas que viaja en barco', text: txt, url });
            else { await navigator.clipboard.writeText(txt + ' ' + url); $('#quiz-msg').textContent = 'Copiado. Pegalo donde quieras.'; }
            track('atlas_quiz_share', { cap: 'gnl', pts });
          } catch (e) { /* el usuario canceló */ }
        };
        track('atlas_quiz_fin', { cap: 'gnl', pts });
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
    frio(); indice();
    cuandoSeAcerque('#barco', barco);
    cuandoSeAcerque('#dura', dura);
    cuandoSeAcerque('#cadena', cadena);
    cuandoSeAcerque('#mapa', mapa);
    cuandoSeAcerque('#precios', precios);
    cuandoSeAcerque('#ormuz', ormuz);
    cuandoSeAcerque('#paradoja', paradoja);
    cuandoSeAcerque('#gana', gana);
    cuandoSeAcerque('#argentina', argentina);
    cuandoSeAcerque('#clima', clima);
    cuandoSeAcerque('#quiz-sec', quiz);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
