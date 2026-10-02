/* Atlas · Semiconductores: interactivos de la página.
   Datos: investigación propia sobre SIA/BCG, OCDE, BID, OEC/UN Comtrade, Nikkei/Fomalhaut y
   reportes de las empresas (ver "Fuentes" en la página). Son aproximados. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const BASE = '../../';
  const REDUCIR = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const track = (ev, p) => window.bbTrack && window.bbTrack(ev, p);

  // Qué aporta cada país (se muestra al tocarlo en el globo)
  const ROLES = {
    '840': 'Diseña la mayoría de los chips (Nvidia, Apple, AMD, Qualcomm) y domina el software para diseñarlos.',
    '158': 'Fabrica más del 80% de los chips más avanzados (TSMC) y lidera el ensamblaje y testeo.',
    '156': 'Domina el galio y el germanio, fabrica muchos chips "maduros" y arma gran parte de la electrónica del mundo.',
    '344': 'Puerta de reexportación de chips hacia las fábricas del sur de China.',
    '410': 'Líder mundial en memorias (Samsung, SK Hynix) y segundo en fabricación avanzada.',
    '392': 'Provee químicos, obleas y equipos clave (Shin-Etsu, SUMCO, Tokyo Electron).',
    '528': 'Hogar de ASML: la única empresa del mundo que fabrica máquinas de litografía EUV.',
    '276': 'Hace la óptica (Zeiss) y los láseres (TRUMPF) de las máquinas EUV. Fuerte en chips para autos (Infineon).',
    '826': 'Arm diseña la arquitectura de casi todos los procesadores de celular.',
    '458': 'Gran polo de ensamblaje y testeo (Intel, Texas Instruments, AMD).',
    '702': 'Hub de empaquetado, logística y repuestos para la industria.',
    '704': 'Gana ensamblaje que sale de China (la estrategia "China + 1").',
    '356': 'Arma cada vez más iPhones y está construyendo sus primeras fábricas de chips.',
    '484': 'Ensambla y testea chips al lado de EE.UU. (nearshoring). Importa más de US$ 25.000 M al año en chips.',
    '076': 'Tiene CEITEC, una fábrica estatal de chips en Porto Alegre, y apuesta al carburo de silicio.',
    '032': 'Importa casi todos sus chips. Tierra del Fuego arma celulares y TVs con piezas importadas.',
    '804': 'Antes de 2022 purificaba entre el 50% y el 70% del neón para chips del mundo.',
    '643': 'Su industria del acero generaba el neón que después se purificaba en Ucrania.',
  };

  function tooltip(wrap) {
    const tip = document.createElement('div');
    tip.className = 'ax-tip'; tip.setAttribute('role', 'status');
    wrap.appendChild(tip);
    let t = 0;
    return (iso, nombre, xy) => {
      clearTimeout(t);
      if (!iso) { tip.classList.remove('on'); return; }
      tip.innerHTML = '<b>' + esc(nombre) + '</b>' + esc(ROLES[iso] || 'No tiene un rol central en esta cadena.');
      const w = wrap.clientWidth;
      tip.style.left = Math.max(6, Math.min(w - 256, xy[0] - 125)) + 'px';
      tip.style.top = Math.max(6, xy[1] + 16) + 'px';
      tip.classList.add('on');
      t = setTimeout(() => tip.classList.remove('on'), 5000);
      track('atlas_pais', { pais: nombre });
    };
  }

  // ============ 1. El viaje (globo fijo + pasos que se activan al scrollear) ============
  const VIAJE = [
    { c: '#a78bfa', foco: [-60, 35], p: { '840': 1, '158': .45, '826': .4, '410': .35 }, arcos: [['840', '158'], ['826', '840']], et: ['840', '826'] },
    { c: '#60a5fa', foco: [-40, 42], p: { '840': 1, '826': .55 }, arcos: [['840', '158'], ['840', '410'], ['840', '156'], ['826', '158']], et: ['840', '826'] },
    { c: '#e8c97a', foco: [115, 35], p: { '392': 1, '156': .85, '158': .4, '804': .55 }, arcos: [['392', '158'], ['392', '410'], ['156', '392'], ['804', '410']], et: ['392', '156', '804'] },
    { c: '#fb923c', foco: [60, 40], p: { '528': 1, '392': .75, '840': .85, '276': .5 }, arcos: [['528', '158'], ['528', '410'], ['392', '158'], ['276', '528']], et: ['528', '392', '276'] },
    { c: '#4ade9a', foco: [122, 25], p: { '158': 1, '410': .5 }, arcos: [], et: ['158', '410'] },
    { c: '#2dd4bf', foco: [108, 30], p: { '156': 1, '158': .5, '276': .35 }, arcos: [['156', '344'], ['156', '704']], et: ['156', '158'] },
    { c: '#f472b6', foco: [110, 12], p: { '458': 1, '702': 1, '156': .8, '158': .8 }, arcos: [['158', '458'], ['158', '702'], ['158', '156'], ['458', '840']], et: ['458', '158', '156'] },
    { c: '#e8edf5', foco: [-75, -5], p: { '156': .8, '356': .6, '704': .6, '484': .6, '032': 1 }, arcos: [['156', '032'], ['156', '840'], ['704', '840'], ['484', '840'], ['356', '076']], et: ['032', '484', '156'] },
  ];

  function viaje() {
    const canvas = $('#globo-viaje'); if (!canvas) return;
    const g = AtlasGlobo(canvas, { base: BASE, foco: VIAJE[0].foco, onPais: tooltip(canvas.parentElement) });
    const pasos = $$('.ax-pasos .ax-paso');
    // Celular: la tarjeta activa se copia a un panel debajo del globo
    const movil = $('.ax-paso-movil');
    $('.ax-viaje-grid').classList.add('js-movil');
    let actual = -1;
    function activar(i) {
      if (i === actual) return; actual = i;
      pasos.forEach((p, j) => p.classList.toggle('on', j === i));
      if (movil) {
        movil.innerHTML = '<div class="ax-paso" style="' + pasos[i].getAttribute('style') + '">' + pasos[i].innerHTML + '</div>';
        requestAnimationFrame(() => requestAnimationFrame(() => movil.firstChild && movil.firstChild.classList.add('on')));
      }
      const v = VIAJE[i]; if (!v) return;
      const res = {};
      for (const iso in v.p) res[iso] = [v.c, 0.25 + 0.75 * v.p[iso]];
      g.set({ resaltes: res, etiquetas: v.et, arcos: v.arcos.map(a => ({ de: a[0], a: a[1], c: v.c, w: 1.8 })), foco: v.foco, ms: 1400 });
    }
    let pend = false;
    const esMovil = () => window.innerWidth < 900;
    // Desktop: la parada activa sale del scroll. Celular: de los botones o de deslizar la tarjeta.
    function medir() {
      pend = false;
      if (esMovil()) return;
      const linea = window.innerHeight * 0.55;
      let i = 0;
      pasos.forEach((p, j) => { if (p.getBoundingClientRect().top < linea) i = j; });
      activar(i);
    }
    addEventListener('scroll', () => { if (!pend) { pend = true; requestAnimationFrame(medir); } }, { passive: true });
    addEventListener('resize', medir);

    const puntos = $('#viaje-puntos'), ant = $('#viaje-ant'), sig = $('#viaje-sig');
    puntos.innerHTML = pasos.map(() => '<i></i>').join('');
    const ir = i => {
      i = Math.max(0, Math.min(pasos.length - 1, i));
      activar(i);
      $$('i', puntos).forEach((p, j) => p.classList.toggle('on', j === i));
      ant.disabled = i === 0;
      sig.textContent = i === pasos.length - 1 ? 'Volver a empezar' : 'Siguiente →';
    };
    ant.addEventListener('click', () => ir(actual - 1));
    sig.addEventListener('click', () => { ir(actual === pasos.length - 1 ? 0 : actual + 1); track('atlas_viaje', { parada: actual + 1 }); });
    let x0 = null;
    movil.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    movil.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) ir(actual + (dx < 0 ? 1 : -1));
    }, { passive: true });
    ir(0);
    medir();
  }

  // ============ 2. Rutas comerciales ============
  const FLUJOS = {
    chips: { c: '#4ade9a', t: 'Chips (HS 8542)', l: [
      ['158', '156', 50, 65, 'Obleas de TSMC y UMC que se arman en China dentro de servidores, celulares y PCs.'],
      ['158', '344', 45, 55, 'Hong Kong recibe chips taiwaneses y los reexporta a las fábricas de Shenzhen.'],
      ['410', '156', 40, 50, 'Memorias de Samsung y SK Hynix para los celulares y servidores que se arman en China.'],
      ['156', '344', 30, 40, 'Chips maduros chinos (SMIC) y mercadería en tránsito hacia el resto del mundo.'],
      ['410', '344', 25, 30, 'Otra vía de memorias y pantallas hacia el delta del río Perla.'],
      ['156', '704', 15, 20, '"China + 1": Foxconn y Samsung arman en Vietnam con chips enviados desde China.'],
      ['158', '702', 12, 16, 'Singapur empaqueta, distribuye y conecta con multinacionales.'],
      ['458', '840', 10, 15, 'Chips de Intel, TI y AMD testeados y encapsulados en Malasia que vuelven a EE.UU.'],
      ['702', '156', 10, 14, 'Fundiciones y centros logísticos de Singapur que abastecen a China.'],
      ['458', '484', 5, 6.5, 'Microcontroladores para la industria automotriz mexicana.'],
      ['158', '484', 4, 5.5, 'Procesadores y memorias para las maquiladoras de TVs y routers en México.'],
      ['840', '484', 2.2, 3.5, 'Insumos para electrónica, equipos médicos y aeroespacial bajo el T-MEC.'],
    ] },
    maquinas: { c: '#fb923c', t: 'Máquinas para fabricar chips (HS 8486)', l: [
      ['528', '158', 6.5, 8.5, 'Las máquinas de ASML (DUV y EUV) que hacen posibles los 5, 3 y 2 nm de TSMC.'],
      ['392', '156', 6, 8, 'Equipos japoneses de limpieza, deposición y grabado (Tokyo Electron, Screen).'],
      ['528', '410', 4.5, 6, 'Litografía para Samsung y SK Hynix.'],
      ['528', '156', 4, 6.5, 'China compró todo lo que pudo antes de que se cerraran las licencias (2023-2024).'],
      ['840', '158', 4, 5.5, 'Deposición, implantación e inspección de Applied Materials, Lam y KLA.'],
      ['392', '158', 4, 5, 'Equipos de limpieza y grabado para las fábricas de Taiwán.'],
      ['392', '410', 3.5, 4.5, 'Herramientas japonesas para las plantas coreanas.'],
      ['840', '410', 3, 4, 'Maquinaria para las memorias NAND 3D coreanas.'],
      ['702', '158', 2.5, 3.5, 'Repuestos e instrumental desde la base regional de Singapur.'],
      ['840', '156', 2, 3, 'Lo que quedó después de las sanciones: equipos para chips maduros y repuestos.'],
      ['528', '840', 1.5, 2.5, 'Máquinas EUV para las nuevas fábricas de Intel (CHIPS Act).'],
    ] },
  };
  const nombre = iso => (window.AtlasPaises[iso] || [iso])[0];
  const rango = (a, b) => 'US$ ' + String(a).replace('.', ',') + '–' + String(b).replace('.', ',') + ' mil M';

  function rutas() {
    const canvas = $('#globo-rutas'); if (!canvas) return;
    const g = AtlasGlobo(canvas, { base: BASE, foco: [120, 22], onPais: tooltip(canvas.parentElement) });
    const lista = $('#flujos'), det = $('#flujo-det');
    let tipo = 'chips', sel = -1;
    function pintar(lista_tambien) {
      const F = FLUJOS[tipo], max = F.l[0][3];
      const res = {};
      F.l.forEach(f => { res[f[0]] = [F.c, 0.75]; res[f[1]] = res[f[1]] || [F.c, 0.35]; });
      g.set({
        resaltes: res,
        etiquetas: sel >= 0 ? [F.l[sel][0], F.l[sel][1]] : [],
        arcos: F.l.map((f, i) => ({ de: f[0], a: f[1], c: F.c, w: 0.8 + 3.2 * ((f[2] + f[3]) / 2) / max, apagado: sel >= 0 && i !== sel })),
      });
      // La lista se rearma solo al cambiar de tipo: rearmarla en cada toque hacía saltar la página
      if (lista_tambien) lista.innerHTML = F.l.map((f, i) => '<li><button type="button" data-i="' + i + '" style="--c:' + F.c + '">' +
        '<span class="r">' + esc(nombre(f[0])) + ' → ' + esc(nombre(f[1])) + '</span><span class="v">' + rango(f[2], f[3]) + '</span>' +
        '<span class="b"><i style="width:' + Math.round(((f[2] + f[3]) / 2) / max * 100) + '%"></i></span></button></li>').join('');
      $$('button', lista).forEach((b, i) => b.classList.toggle('on', i === sel));
      det.innerHTML = sel >= 0 ? '<b>' + esc(nombre(F.l[sel][0])) + ' → ' + esc(nombre(F.l[sel][1])) + '.</b> ' + esc(F.l[sel][4])
        : 'Tocá una ruta para verla en el globo. El grosor de cada arco es el tamaño del flujo por año.';
    }
    lista.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const i = +b.dataset.i; sel = sel === i ? -1 : i;
      pintar();
      if (sel >= 0) {
        const F = FLUJOS[tipo].l[sel], a = window.AtlasPaises[F[0]], c = window.AtlasPaises[F[1]];
        const m = d3.geoInterpolate([a[1], a[2]], [c[1], c[2]])(0.5);
        g.girarA(m, 1000);
        if (window.innerWidth < 900) canvas.scrollIntoView({ behavior: REDUCIR ? 'auto' : 'smooth', block: 'center' });
      }
    });
    $$('[data-flujo]').forEach(b => b.addEventListener('click', () => {
      tipo = b.dataset.flujo; sel = -1;
      $$('[data-flujo]').forEach(x => x.setAttribute('aria-pressed', x === b));
      pintar(true); g.girarA(tipo === 'chips' ? [120, 22] : [60, 35], 1100);
      track('atlas_rutas', { tipo });
    }));
    pintar(true);
  }

  // ============ 3. Zoom de escala ============
  const ESCALA = [
    { n: 'Una oblea', nm: 3e8, t: 'El disco de silicio donde se fabrican los chips: 30 cm, como un plato grande. De una sola salen cientos de chips.' },
    { n: 'Un chip de celular', nm: 1e7, t: 'Más o menos 1 cm de lado. Adentro hay unos 19.000 millones de transistores (el A17 Pro del iPhone 15 Pro).' },
    { n: 'Un pelo', nm: 7e4, t: 'Unos 70 micrómetros de ancho. Es lo más chico que ves a simple vista.' },
    { n: 'Un glóbulo rojo', nm: 7e3, t: 'Diez veces más chico que un pelo. Ya hace falta un microscopio.' },
    { n: 'Una bacteria', nm: 2e3, t: 'Unos 2 micrómetros. En el ancho de un pelo entran 35 en fila.' },
    { n: 'Un virus', nm: 100, t: 'Unos 100 nanómetros. Un microscopio común ya no alcanza para verlo.' },
    { n: 'Un transistor de hoy', nm: 48, t: 'En un chip "de 3 nm" los transistores están separados por unos 48 nm. El "3 nm" es un nombre comercial, no una medida real.' },
    { n: 'La luz EUV', nm: 13.5, t: 'La "tinta" de las máquinas de ASML: luz de 13,5 nm. Con una luz más gruesa no se podría dibujar algo tan fino.' },
    { n: 'El ADN', nm: 2.5, t: 'Una hebra de ADN mide unos 2,5 nm de ancho. Las capas más finas de un chip ya están en esta escala.' },
    { n: 'Un átomo de silicio', nm: 0.2, t: 'Unos 0,2 nm. Es el límite: no se puede hacer un transistor más chico que unos pocos átomos.' },
  ];
  const fmtMedida = nm => nm >= 1e6 ? (nm / 1e6).toLocaleString('es-AR') + ' mm' : nm >= 1e3 ? (nm / 1e3).toLocaleString('es-AR') + ' µm' : nm.toLocaleString('es-AR') + ' nm';
  function zoom() {
    const r = $('#zoom-rango'); if (!r) return;
    r.max = ESCALA.length - 1;
    const svg = $('#zoom-svg'), N = $('#zoom-nombre'), M = $('#zoom-medida'), T = $('#zoom-txt');
    function pintar() {
      const i = +r.value, e = ESCALA[i], sig = ESCALA[i + 1];
      N.textContent = e.n; M.textContent = fmtMedida(e.nm); T.textContent = e.t;
      const rr = sig ? Math.max(1.5, 150 * sig.nm / e.nm) : 0;
      svg.innerHTML =
        '<defs><radialGradient id="zg" cx="40%" cy="35%"><stop offset="0" stop-color="#1f2a36"/><stop offset="1" stop-color="#0f141b"/></radialGradient></defs>' +
        '<circle cx="200" cy="200" r="150" fill="url(#zg)" stroke="rgba(74,222,154,0.5)" stroke-width="1.5"/>' +
        (i === 0 ? Array.from({ length: 13 }, (_, k) => '<line x1="' + (60 + k * 23) + '" y1="55" x2="' + (60 + k * 23) + '" y2="345" stroke="rgba(74,222,154,0.16)"/><line x1="55" y1="' + (60 + k * 23) + '" x2="345" y2="' + (60 + k * 23) + '" stroke="rgba(74,222,154,0.16)"/>').join('') : '') +
        (sig ? '<circle cx="200" cy="200" r="' + rr.toFixed(2) + '" fill="#4ade9a" opacity="0.9"/>' +
          '<text x="200" y="' + (200 + Math.max(rr, 4) + 22) + '" text-anchor="middle" fill="#9aa5b8" font-size="13" font-family="Outfit, sans-serif">' + esc(sig.n) + ' (' + Math.round(e.nm / sig.nm).toLocaleString('es-AR') + ' veces más chico)</text>' : '') +
        '<text x="200" y="38" text-anchor="middle" fill="#e8edf5" font-size="14" font-family="Outfit, sans-serif">' + esc(e.n) + '</text>';
      svg.setAttribute('aria-label', e.n + ', ' + fmtMedida(e.nm));
    }
    r.addEventListener('input', pintar);
    r.addEventListener('change', () => track('atlas_zoom', { paso: r.value }));
    pintar();
  }

  // ============ 4. Proceso paso a paso ============
  function proceso() {
    const tabs = $$('.ax-proc-tabs button'); if (!tabs.length) return;
    const panes = $$('.ax-proc-txt'), vis = $$('.ax-proc-vis [data-s]');
    let i = 0;
    function ir(n) {
      i = (n + tabs.length) % tabs.length;
      tabs.forEach((t, j) => t.setAttribute('aria-selected', j === i));
      tabs.forEach((t, j) => t.classList.toggle('on', j === i));
      panes.forEach((p, j) => { p.hidden = j !== i; });
      vis.forEach(v => v.classList.toggle('on', v.dataset.s.split(' ').includes(String(i))));
      // Solo se desplaza la fila de pestañas, nunca la página
      const fila = tabs[i].parentElement;
      fila.scrollTo({ left: tabs[i].offsetLeft - fila.clientWidth / 2 + tabs[i].offsetWidth / 2, behavior: REDUCIR ? 'auto' : 'smooth' });
    }
    tabs.forEach((t, j) => t.addEventListener('click', () => { ir(j); track('atlas_proceso', { paso: j }); }));
    $('#proc-ant').addEventListener('click', () => ir(i - 1));
    $('#proc-sig').addEventListener('click', () => ir(i + 1));
    ir(0);
  }

  // ============ 5. Sankey de la máquina EUV ============
  const SK = {
    cols: ['Materiales', 'Proveedores', 'Partes', 'Máquina'],
    nodos: [
      { id: 'sn', c: 0, n: 'Estaño', d: 'Gotas de estaño fundido: 50.000 por segundo. Al pegarles un láser se vuelven plasma y emiten la luz EUV.' },
      { id: 'mo', c: 0, n: 'Molibdeno y silicio', d: 'Decenas de capas finísimas que convierten un espejo en un reflector de luz EUV.' },
      { id: 'vi', c: 0, n: 'Vidrio ultrapuro', d: 'La base de los espejos: no puede deformarse ni con el calor de la luz.' },
      { id: 'ac', c: 0, n: 'Acero y aluminio', d: 'Cámaras de vacío y estructuras que no pueden vibrar ni un nanómetro.' },
      { id: 'ze', c: 1, n: 'Zeiss SMT', p: 'Alemania', d: '<b>Zeiss SMT (Alemania)</b> hace toda la óptica: espejos tan lisos que, si fueran del tamaño de Alemania, la imperfección más grande sería de menos de un milímetro. ASML tiene cerca del 25% de esta empresa.' },
      { id: 'tr', c: 1, n: 'TRUMPF', p: 'Alemania', d: '<b>TRUMPF (Alemania)</b> fabrica el láser de CO₂ gigante que golpea las gotas de estaño. Sus directivos describen la relación con ASML como "virtualmente fusionada".' },
      { id: 'cy', c: 1, n: 'Cymer', p: 'EE.UU.', d: '<b>Cymer (San Diego, EE.UU.)</b> hace la fuente de luz. ASML la compró en 2013 para poder hacer funcionar el EUV a escala.' },
      { id: 'vd', c: 1, n: 'VDL ETG', p: 'Países Bajos', d: '<b>VDL ETG (Países Bajos)</b> fabrica las cámaras de vacío, estructuras y los sistemas que mueven la oblea.' },
      { id: 'ot', c: 1, n: 'Miles más', p: 'Europa, EE.UU., Asia', d: '<b>Miles de proveedores más</b> de Europa, EE.UU. y Asia: sensores, electrónica, bombas de vacío, cables, software.' },
      { id: 'op', c: 2, n: 'Óptica', d: 'Los espejos que llevan el dibujo del chip hasta la oblea. Cualquier imperfección arruina la impresión.' },
      { id: 'fu', c: 2, n: 'Fuente de luz', d: 'El "corazón": genera la luz EUV de 13,5 nm a partir de plasma de estaño.' },
      { id: 'va', c: 2, n: 'Vacío y estructura', d: 'La luz EUV la absorbe hasta el aire: todo pasa en vacío.' },
      { id: 'mv', c: 2, n: 'Movimiento', d: 'La oblea y la máscara se mueven a toda velocidad con precisión de nanómetros.' },
      { id: 'el', c: 2, n: 'Electrónica', d: 'Control, sensores y software que sincronizan todo miles de veces por segundo.' },
      { id: 'eu', c: 3, n: 'Máquina EUV', p: 'ASML', d: '<b>ASML (Países Bajos)</b> integra todo: más de 100.000 piezas, viaja en varios aviones de carga y se arma en la fábrica del cliente. Es la única del mundo.' },
    ],
    links: [['sn', 'cy', 2], ['mo', 'ze', 2], ['vi', 'ze', 2], ['ac', 'vd', 2], ['ac', 'ot', 1],
      ['ze', 'op', 4], ['tr', 'fu', 2], ['cy', 'fu', 2], ['vd', 'va', 2], ['vd', 'mv', 1], ['ot', 'mv', 1], ['ot', 'el', 2], ['ot', 'va', 1],
      ['op', 'eu', 4], ['fu', 'eu', 4], ['va', 'eu', 3], ['mv', 'eu', 2], ['el', 'eu', 2]],
    color: { 0: '#e8c97a', 1: '#a78bfa', 2: '#60a5fa', 3: '#4ade9a' },
  };
  function sankey() {
    const box = $('#sankey'); if (!box) return;
    const det = $('#sankey-det');
    const porId = {}; SK.nodos.forEach(n => { porId[n.id] = n; });
    // Tamaño de cada nodo: lo que entra o sale (el mayor)
    SK.nodos.forEach(n => { n.in = 0; n.out = 0; });
    SK.links.forEach(([a, b, v]) => { porId[a].out += v; porId[b].in += v; });
    SK.nodos.forEach(n => { n.v = Math.max(n.in, n.out); });
    let sel = null;

    function relacionados(id) {
      const s = new Set([id]);
      const subir = x => SK.links.forEach(l => { if (l[1] === x && !s.has(l[0])) { s.add(l[0]); subir(l[0]); } });
      const bajar = x => SK.links.forEach(l => { if (l[0] === x && !s.has(l[1])) { s.add(l[1]); bajar(l[1]); } });
      subir(id); bajar(id);
      return s;
    }

    function dibujar() {
      const W = box.clientWidth, vertical = W < 640;
      const cols = SK.cols.length;
      // Eje "largo" (por donde avanza el flujo) y eje "ancho" (donde se apilan los nodos)
      // En horizontal quedan márgenes a los costados para las etiquetas
      const L = vertical ? 560 : Math.max(300, W - 290);
      const B = vertical ? W : 400, grosor = vertical ? 34 : 14, gap = vertical ? 6 : 14, padIni = vertical ? 22 : 0;
      const pos = c => padIni + (L - padIni - grosor) * c / (cols - 1);
      const porCol = SK.cols.map((_, c) => SK.nodos.filter(n => n.c === c));
      const margenLado = 0;
      const anchoUtil = B;
      porCol.forEach(ns => {
        const tot = ns.reduce((s, n) => s + n.v, 0), libre = anchoUtil - gap * (ns.length - 1);
        let acc = margenLado;
        ns.forEach(n => {
          n.s = vertical ? libre / ns.length : Math.max(18, libre * n.v / tot * 0.9);
          n.o = acc; acc += n.s + gap;
        });
        const usado = acc - gap - margenLado, corr = (anchoUtil - usado) / 2;
        ns.forEach(n => { n.o += corr; n.oi = 0; n.oo = 0; });
      });
      const xy = (largo, ancho) => (vertical ? [ancho, largo] : [largo, ancho]);
      const rel = sel ? relacionados(sel) : null;
      let cintas = '';
      SK.links.forEach(([a, b, v]) => {
        const A = porId[a], Z = porId[b];
        const ta = A.s * v / A.out, tz = Z.s * v / Z.in;
        const a0 = A.o + A.oo, z0 = Z.o + Z.oi; A.oo += ta; Z.oi += tz;
        const l0 = pos(A.c) + grosor, l1 = pos(Z.c), m = (l0 + l1) / 2;
        const p = [xy(l0, a0), xy(m, a0), xy(m, z0), xy(l1, z0), xy(l1, z0 + tz), xy(m, z0 + tz), xy(m, a0 + ta), xy(l0, a0 + ta)].map(q => q.map(n => n.toFixed(1)).join(','));
        const d = 'M' + p[0] + 'C' + p[1] + ' ' + p[2] + ' ' + p[3] + 'L' + p[4] + 'C' + p[5] + ' ' + p[6] + ' ' + p[7] + 'Z';
        const on = !rel || (rel.has(a) && rel.has(b));
        cintas += '<path class="cinta" d="' + d + '" fill="' + SK.color[A.c] + '" opacity="' + (on ? 0.32 : 0.05) + '"/>';
      });
      let nodos = '', textos = '';
      SK.nodos.forEach(n => {
        const on = !rel || rel.has(n.id);
        const [x, y] = xy(pos(n.c), n.o), [w, h] = vertical ? [n.s, grosor] : [grosor, n.s];
        nodos += '<g class="nodo" data-id="' + n.id + '" tabindex="0" role="button" aria-label="' + esc(n.n) + '"><rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4" fill="' + SK.color[n.c] + '" opacity="' + (on ? 1 : 0.25) + '"/></g>';
        const fs = vertical ? 10 : 12.5;
        if (vertical) {
          const palabras = n.n.split(' '), lineas = palabras.length > 1 && n.n.length > 9 ? [palabras.slice(0, Math.ceil(palabras.length / 2)).join(' '), palabras.slice(Math.ceil(palabras.length / 2)).join(' ')] : [n.n];
          lineas.forEach((t, k) => {
            textos += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2 + (k - (lineas.length - 1) / 2) * 11 + 3.5).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '" fill="#0a0c0f" style="fill:#0a0c0f;font-weight:500" opacity="' + (on ? 1 : 0.4) + '">' + esc(t) + '</text>';
          });
        } else {
          const izq = n.c === 0, ax = izq ? x - 8 : n.c === cols - 1 ? x + w + 8 : x + w + 8;
          const anchor = izq ? 'end' : 'start';
          textos += '<text x="' + ax.toFixed(1) + '" y="' + (y + h / 2 + 4).toFixed(1) + '" text-anchor="' + anchor + '" font-size="' + fs + '" opacity="' + (on ? 1 : 0.35) + '" style="paint-order:stroke;stroke:#11141a;stroke-width:4px">' + esc(n.n) + (n.p ? '<tspan fill="#9aa5b8" style="fill:#9aa5b8" font-size="10.5"> · ' + esc(n.p) + '</tspan>' : '') + '</text>';
        }
      });
      let cabeceras = '';
      SK.cols.forEach((t, c) => {
        if (vertical) cabeceras += '<text class="col" x="0" y="' + (pos(c) - 6).toFixed(1) + '">' + esc(t) + '</text>';
        else cabeceras += '<text class="col" x="' + (pos(c) + grosor / 2).toFixed(1) + '" y="12" text-anchor="middle">' + esc(t) + '</text>';
      });
      const alto = vertical ? L + 4 : anchoUtil;
      if (!vertical) {
        const off = 150;
        box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + (alto + 26) + '" height="' + (alto + 26) + '" role="img" aria-label="De qué está hecha una máquina EUV"><g transform="translate(' + off.toFixed(1) + ',0)">' + cabeceras + '</g><g transform="translate(' + off.toFixed(1) + ',22)">' + cintas + nodos + textos + '</g></svg>';
      } else {
        box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + alto + '" height="' + alto + '" role="img" aria-label="De qué está hecha una máquina EUV">' + cabeceras + cintas + nodos + textos + '</svg>';
      }
    }
    function elegir(id) {
      sel = sel === id ? null : id;
      det.innerHTML = sel ? (porId[sel].p && porId[sel].d.startsWith('<b>') ? porId[sel].d : '<b>' + esc(porId[sel].n) + '.</b> ' + porId[sel].d) : 'Tocá cualquier bloque para ver qué aporta y por dónde pasa.';
      dibujar();
      if (sel) track('atlas_euv', { nodo: sel });
    }
    box.addEventListener('click', e => { const g = e.target.closest('.nodo'); elegir(g ? g.dataset.id : sel); });
    box.addEventListener('keydown', e => { const g = e.target.closest('.nodo'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); elegir(g.dataset.id); } });
    let w0 = 0;
    new ResizeObserver(() => { if (box.clientWidth !== w0) { w0 = box.clientWidth; dibujar(); } }).observe(box);
  }

  // ============ 6. Curva de la sonrisa ============
  const SONRISA = [
    { e: 'Diseño', emp: 'Nvidia', tk: 'NVDA', teo: 78, real: 72.5, r: '70–75%', d: 'Diseña las GPU que entrenan la IA y controla el software (CUDA) con el que se programan. Puede poner el precio.' },
    { e: 'Equipos', emp: 'ASML', tk: 'ASML', teo: 46, real: 52.5, r: '51–54%', d: 'Vender máquinas suele ser un negocio cíclico y de márgenes medios. Pero ASML es la única que hace EUV: cobra peaje.' },
    { e: 'Fábrica', emp: 'TSMC', tk: 'TSM', teo: 24, real: 53.5, r: '53–54%', d: 'En la teoría, fabricar es el fondo de la curva. Pero nadie más produce 3 nm con buenos rendimientos: TSMC rompe la sonrisa.' },
    { e: 'Testeo y empaque', emp: 'ASE', tk: 'ASX', teo: 14, real: 17.5, r: '15–20%', d: 'Acá la curva sí baja: más mano de obra técnica y más competencia.' },
    { e: 'Armado final', emp: 'Foxconn', tk: '2317.TW', teo: 12, real: 7, r: '6–8%', d: 'El verdadero valle: arma millones de celulares y servidores con márgenes mínimos. Vive del volumen.' },
    { e: 'Marca', emp: 'Apple', tk: 'AAPL', teo: 62, real: 42.5, r: '40–45%', d: 'Vuelve a subir: diseño propio, marca y un ecosistema de servicios que retiene al cliente.' },
  ];
  function sonrisa() {
    const box = $('#sonrisa'); if (!box) return;
    const det = $('#sonrisa-det');
    let modo = 'teo', k = 0, anim = 0, sel = -1;
    const curva = pts => {
      let d = 'M' + pts[0][0] + ',' + pts[0][1];
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ',' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ',' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
      }
      return d;
    };
    function dibujar() {
      const W = box.clientWidth, chico = W < 560, H = chico ? 300 : 360;
      const m = { l: chico ? 30 : 44, r: 12, t: 22, b: chico ? 58 : 60 };
      const x = i => m.l + (W - m.l - m.r) * (i + 0.5) / SONRISA.length;
      const y = v => m.t + (H - m.t - m.b) * (1 - v / 85);
      const val = s => s.teo + (s.real - s.teo) * k;
      const pts = SONRISA.map((s, i) => [x(i), y(val(s))]);
      const ptsTeo = SONRISA.map((s, i) => [x(i), y(s.teo)]);
      let h = '';
      [0, 20, 40, 60, 80].forEach(v => {
        h += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="rgba(255,255,255,0.05)"/>';
        if (k > 0.5) h += '<text x="' + (m.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="10" fill="#757f96">' + v + '%</text>';
      });
      if (k <= 0.5) {
        h += '<text x="' + (m.l - 6) + '" y="' + (y(78) + 4) + '" text-anchor="end" font-size="10" fill="#757f96">Alto</text>';
        h += '<text x="' + (m.l - 6) + '" y="' + (y(8) + 4) + '" text-anchor="end" font-size="10" fill="#757f96">Bajo</text>';
      }
      h += '<text x="' + m.l + '" y="12" font-size="10.5" fill="#9aa5b8" font-family="DM Mono, monospace">' + (k > 0.5 ? 'MARGEN BRUTO' : 'VALOR QUE SE QUEDA CADA ETAPA') + '</text>';
      if (k > 0) h += '<path d="' + curva(ptsTeo) + '" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" stroke-dasharray="4 5"/>';
      h += '<path d="' + curva(pts) + ' L' + pts[pts.length - 1][0].toFixed(1) + ',' + y(0) + ' L' + pts[0][0].toFixed(1) + ',' + y(0) + 'Z" fill="rgba(74,222,154,0.07)"/>';
      h += '<path d="' + curva(pts) + '" fill="none" stroke="#4ade9a" stroke-width="2.5"/>';
      SONRISA.forEach((s, i) => {
        const [px, py] = pts[i], on = i === sel;
        h += '<g class="pt" data-i="' + i + '" tabindex="0" role="button" aria-label="' + esc(s.e + ': ' + s.emp) + '">' +
          '<circle cx="' + px + '" cy="' + py + '" r="18" fill="transparent"/>' +
          '<circle cx="' + px + '" cy="' + py + '" r="' + (on ? 8 : 6) + '" fill="' + (on ? '#4ade9a' : '#0a0c0f') + '" stroke="#4ade9a" stroke-width="2"/></g>';
        if (k > 0.5) h += '<text x="' + px + '" y="' + (py - 13) + '" text-anchor="middle" font-size="' + (chico ? 10.5 : 12) + '" fill="#e8edf5" font-family="DM Mono, monospace">' + (k === 1 ? '~' + Math.round(s.real) + '%' : '') + '</text>';
        const pal = s.e.split(' '), lin = pal.length > 1 ? [pal[0], pal.slice(1).join(' ')] : [s.e];
        lin.forEach((t, j) => { h += '<text x="' + px + '" y="' + (H - m.b + 18 + j * 13) + '" text-anchor="middle" font-size="' + (chico ? 10.5 : 12) + '" fill="#e8edf5">' + esc(t) + '</text>'; });
        h += '<text x="' + px + '" y="' + (H - m.b + 18 + lin.length * 13 + 2) + '" text-anchor="middle" font-size="' + (chico ? 9.5 : 10.5) + '" fill="' + (k > 0.5 ? '#4ade9a' : '#757f96') + '">' + esc(k > 0.5 ? s.emp : '') + '</text>';
      });
      box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '" role="img" aria-label="Curva de la sonrisa: margen por etapa">' + h + '</svg>';
    }
    function texto() {
      if (sel < 0) {
        det.innerHTML = modo === 'teo'
          ? '<b>La teoría (Stan Shih, Acer, años 90):</b> el valor está en las puntas, en diseñar y en vender la marca. Fabricar y ensamblar, en el medio, deja poco. Tocá <b>“En los chips”</b> para ver qué pasa en la realidad.'
          : '<b>En los chips la sonrisa se deforma:</b> fabricar en la frontera (TSMC) y hacer las máquinas (ASML) deja casi tanto como diseñar. El valle quedó en el armado final. Tocá cada punto.';
        return;
      }
      const s = SONRISA[sel];
      det.innerHTML = '<b>' + esc(s.e) + ' · ' + esc(s.emp) + '</b> — margen bruto ' + (modo === 'real' ? '<b>' + s.r + '</b>' : 'aprox. ' + s.r) + ' (2023-2024). ' + esc(s.d) +
        ' <a href="' + BASE + 'pages/ticker.html?symbol=' + encodeURIComponent(s.tk) + '">Ver la acción →</a>';
    }
    function animarA(obj) {
      cancelAnimationFrame(anim);
      const k0 = k, t0 = performance.now(), ms = REDUCIR ? 1 : 900;
      const paso = t => {
        const p = Math.min(1, (t - t0) / ms), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        k = k0 + (obj - k0) * e; dibujar();
        if (p < 1) anim = requestAnimationFrame(paso);
      };
      anim = requestAnimationFrame(paso);
    }
    $$('[data-sonrisa]').forEach(b => b.addEventListener('click', () => {
      modo = b.dataset.sonrisa;
      $$('[data-sonrisa]').forEach(x => x.setAttribute('aria-pressed', x === b));
      animarA(modo === 'real' ? 1 : 0); texto();
      track('atlas_sonrisa', { modo });
    }));
    const elegir = i => { sel = sel === i ? -1 : i; dibujar(); texto(); };
    box.addEventListener('click', e => { const g = e.target.closest('.pt'); if (g) elegir(+g.dataset.i); });
    box.addEventListener('keydown', e => { const g = e.target.closest('.pt'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); elegir(+g.dataset.i); } });
    let w0 = 0;
    new ResizeObserver(() => { if (box.clientWidth !== w0) { w0 = box.clientWidth; dibujar(); } }).observe(box);
    texto();
  }

  // ============ 7. Apagá un país ============
  // Nivel por etapa: 3 domina, 2 fuerte, 1 presente, 0 casi nada
  const ETAPAS = ['Diseño', 'Software e IP', 'Equipos', 'Materiales', 'Fábrica de punta', 'Fábrica madura', 'Ensamblaje y testeo'];
  const SIM = {
    '158': { n: 'Taiwán', v: [[2, '~18%'], [0], [0], [1, 'obleas'], [3, '>80%'], [1, 'UMC'], [2, '~30%']], r: 'Se frena más del 80% de los chips más avanzados del mundo. Sin TSMC no hay iPhones nuevos, ni GPUs para IA, ni procesadores de AMD. Es el famoso "escudo de silicio": el resto del mundo depende demasiado de una isla.' },
    '840': { n: 'EE.UU.', v: [[3, '55–60%'], [3, '70–75%'], [2, '~40%'], [0], [1, 'Intel'], [1], [0]], r: 'Nadie podría diseñar chips nuevos: el software de diseño (Synopsys, Cadence) y la mayoría de las patentes son de EE.UU. Las fábricas seguirían andando un tiempo, pero sin diseños nuevos ni repuestos.' },
    '528': { n: 'Países Bajos', v: [[0], [0], [2, '~20% · 100% EUV'], [0], [0], [0], [0]], r: 'Parece poco, pero sin ASML no hay máquinas EUV: nadie podría fabricar chips de 5 nm o menos, ni ampliar las fábricas de punta. Por eso EE.UU. presionó para que no le venda a China.' },
    '392': { n: 'Japón', v: [[0], [0], [2, '~30%'], [3, '50–60%'], [0], [1], [0]], r: 'Faltarían obleas, fotorresinas y químicos de pulido. Las fábricas de Taiwán y Corea se quedarían sin insumos en semanas, aunque tengan las máquinas.' },
    '156': { n: 'China', v: [[1], [0], [0], [3, 'galio 98%'], [0], [2, '30–35%'], [2, '2º polo']], r: 'Los chips de punta seguirían, pero faltarían galio, germanio y muchísimos chips "maduros": los de autos, heladeras y lavarropas. Y gran parte del armado de celulares y computadoras.' },
    '410': { n: 'Corea del Sur', v: [[1, 'memorias'], [0], [0], [0], [2, 'Samsung'], [0], [0]], r: 'Faltarían memorias: Samsung y SK Hynix hacen la mayoría de la DRAM, la NAND y la HBM que usan las GPU de IA. Sin memoria, un procesador no sirve.' },
  };
  const NIVEL = ['Poco', 'Presente', 'Fuerte', 'Domina'];
  function simulador() {
    const lista = $('#cadena'); if (!lista) return;
    const res = $('#sim-res');
    function pintar(iso) {
      const s = SIM[iso];
      lista.innerHTML = ETAPAS.map((e, i) => {
        const v = s ? s.v[i] : [0];
        return '<li data-n="' + (s ? v[0] : 0) + '"><span class="n">0' + (i + 1) + '</span><span class="e">' + esc(e) + (s && v[1] ? '<small>' + esc(v[1]) + '</small>' : '') + '</span><span class="s">' + (s ? NIVEL[v[0]] : '—') + '</span></li>';
      }).join('');
      if (!s) { res.innerHTML = 'Elegí un país para ver qué pasaría si mañana dejara de exportar.'; return; }
      const graves = s.v.filter(v => v[0] >= 2).length;
      res.innerHTML = '<span class="big">' + graves + ' de 7 etapas en problemas</span>' + esc(s.r);
    }
    $$('#sim-paises button').forEach(b => b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      $$('#sim-paises button').forEach(x => { x.setAttribute('aria-pressed', 'false'); x.classList.remove('on'); });
      if (on) { b.setAttribute('aria-pressed', 'true'); b.classList.add('on'); }
      pintar(on ? b.dataset.iso : null);
      if (on) track('atlas_apagar', { pais: SIM[b.dataset.iso].n });
    }));
    pintar(null);
  }

  // ============ 8. El celular por dentro ============
  function celular() {
    const lista = $('#piezas'); if (!lista) return;
    const det = $('#pieza-det');
    const items = $$('button', lista);
    function ir(i) {
      items.forEach((b, j) => b.classList.toggle('on', j === i));
      $$('#cel-svg .hs').forEach((h, j) => {
        const on = j === i;
        h.querySelector('.p').setAttribute('r', on ? 13 : 10);
        h.querySelector('.p').setAttribute('fill', on ? '#4ade9a' : '#11141a');
        h.querySelector('text').setAttribute('fill', on ? '#07110c' : '#e8edf5');
      });
      det.innerHTML = items[i].dataset.det;
    }
    items.forEach((b, i) => b.addEventListener('click', () => { ir(i); track('atlas_pieza', { pieza: i }); }));
    $$('#cel-svg .hs').forEach((h, i) => h.addEventListener('click', () => ir(i)));
    ir(0);
  }

  // ============ 9. Quiz ============
  const QUIZ = [
    { q: '¿Qué país fabrica la gran mayoría de los chips más avanzados?', o: ['Estados Unidos', 'Taiwán', 'China', 'Japón'], ok: 1, e: 'Taiwán, con TSMC, concentra más del 80% de la fabricación de punta.' },
    { q: '¿Cuántas empresas en el mundo fabrican máquinas de litografía EUV?', o: ['Una', 'Tres', 'Diez', 'Más de cincuenta'], ok: 0, e: 'Solo ASML, de Países Bajos. Y depende de proveedores únicos como Zeiss y TRUMPF.' },
    { q: 'En la curva de la sonrisa de los chips, ¿quién se queda con el menor margen?', o: ['Nvidia (diseño)', 'TSMC (fábrica)', 'Foxconn (armado final)', 'ASML (máquinas)'], ok: 2, e: 'El armado final deja un margen bruto de 6–8%. Nvidia, más del 70%.' },
    { q: 'Antes de llegar a tu mano, un chip puede cruzar fronteras…', o: ['2 veces', '5 veces', '10 veces', 'Más de 70 veces'], ok: 3, e: 'Más de 70 veces, entre materiales, fábricas, testeo y armado (SIA/BCG).' },
  ];
  function quiz() {
    const box = $('#quiz'); if (!box) return;
    let i = 0, pts = 0;
    function pintar() {
      if (i >= QUIZ.length) {
        const msj = pts === 4 ? 'Ya entendés la cadena mejor que mucha gente.' : pts >= 2 ? 'Bien. Repasá el viaje y probá de nuevo.' : 'Volvé a recorrer el viaje: todo está ahí arriba.';
        box.innerHTML = '<p class="ax-eyebrow">Resultado</p><p class="ax-quiz-q"><b>' + pts + ' de 4.</b> ' + msj + '</p>' +
          '<div class="ax-chips"><button type="button" class="ax-btn primario" id="quiz-comp">Compartir resultado</button><button type="button" class="ax-btn" id="quiz-otra">Jugar de nuevo</button></div><p class="ax-quiz-exp" id="quiz-msg"></p>';
        $('#quiz-otra').onclick = () => { i = 0; pts = 0; pintar(); };
        $('#quiz-comp').onclick = async () => {
          const url = location.origin + location.pathname;
          const txt = 'Saqué ' + pts + '/4 en el quiz de semiconductores del Atlas de BB Financial. ¿Cuánto sabés de dónde sale tu celular?';
          try {
            if (navigator.share) await navigator.share({ title: 'El viaje de un chip', text: txt, url });
            else { await navigator.clipboard.writeText(txt + ' ' + url); $('#quiz-msg').textContent = 'Copiado. Pegalo donde quieras.'; }
            track('atlas_quiz_share', { pts });
          } catch (e) { /* el usuario canceló */ }
        };
        track('atlas_quiz_fin', { pts });
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

  // Cada bloque arranca cuando se acerca a la pantalla (el globo del viaje, de una)
  // Si alguien salta con el índice por encima de una sección, igual queda lista a los pocos segundos
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
    viaje(); indice();
    cuandoSeAcerque('#rutas', rutas);
    cuandoSeAcerque('#escala', zoom);
    cuandoSeAcerque('#proceso', proceso);
    cuandoSeAcerque('#euv', sankey);
    cuandoSeAcerque('#sonrisa-sec', sonrisa);
    cuandoSeAcerque('#apagar', simulador);
    cuandoSeAcerque('#celular', celular);
    cuandoSeAcerque('#quiz-sec', quiz);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
