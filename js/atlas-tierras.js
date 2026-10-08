/* Atlas · Tierras raras: interactivos de la página.
   Los juegos son simplificaciones para entender la idea (ver "Fuentes" en la página).
   Datos: USGS (Mineral Commodity Summaries 2026), AIE, Servicio de Investigación del Congreso de EE.UU.,
   SEGEMAR y prensa especializada. Son aproximados. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const BASE = '../../';
  const REDUCIR = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const track = (ev, p) => window.bbTrack && window.bbTrack(ev, p);
  const num = (v, d) => v.toLocaleString('es-AR', { maximumFractionDigits: d == null ? 1 : d });
  const TX = '#fbbf24', LIG = '#60a5fa', PES = '#f472b6', ROJO = '#ff6b6b', VERDE = '#4ade9a';

  // Grupo de botones donde uno solo queda marcado
  function grupo(sel, fn) {
    const bs = $$(sel);
    bs.forEach((b, i) => b.addEventListener('click', () => {
      bs.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      fn(b, i);
    }));
    return bs;
  }

  // ============ 1. Las 17 ============
  // [símbolo, nombre, número atómico, grupo (l ligera · p pesada · o aparte), va en imanes,
  //  licencia china (a: desde abril de 2025 · o: sumada en octubre de 2025 y en suspenso), US$ por kilo de óxido en 2025, uso, texto]
  const ELEM = [
    ['Sc', 'Escandio', 21, 'o', 0, 'a', null, 'Aleaciones livianas', 'Mezclado con aluminio da un metal liviano y muy resistente, usado en aviones y bicicletas de competición. Casi no se produce: unas pocas decenas de toneladas por año.'],
    ['Y', 'Itrio', 39, 'p', 0, 'a', null, 'Láseres y turbinas', 'Es la base de los láseres que marcan el blanco de las bombas guiadas y de la capa cerámica que protege del calor a las turbinas de los aviones. También está en los LED blancos.'],
    ['La', 'Lantano', 57, 'l', 0, null, 1, 'Lentes y refinerías', 'Mejora las lentes de las cámaras y ayuda a las refinerías a sacar más nafta de cada barril. Es de las más baratas: sobra.'],
    ['Ce', 'Cerio', 58, 'l', 0, null, 1.71, 'Pulido y catalizadores', 'La más abundante: en la corteza terrestre hay más cerio que cobre. Su óxido pule pantallas, lentes y obleas de chips, y va en el caño de escape de los autos.'],
    ['Pr', 'Praseodimio', 59, 'l', 1, null, 74, 'Imanes', 'Va junto al neodimio en los imanes potentes. Se venden mezclados, como "NdPr", porque separarlos del todo es caro.'],
    ['Nd', 'Neodimio', 60, 'l', 1, null, 73, 'El imán más fuerte', 'La estrella: con hierro y boro forma el imán más potente que existe. Está en motores de autos eléctricos, turbinas eólicas, auriculares y discos rígidos.'],
    ['Pm', 'Prometio', 61, 'l', 0, null, null, 'Casi no existe', 'Es radiactivo y se desintegra solo: en toda la corteza terrestre hay menos de un kilo. Se fabrica en reactores, para baterías nucleares diminutas.'],
    ['Sm', 'Samario', 62, 'l', 1, 'a', 2.82, 'Imanes para calor extremo', 'Con cobalto forma un imán menos fuerte que el de neodimio, pero que aguanta 300 °C. Por eso va en radares, misiles y motores de avión.'],
    ['Eu', 'Europio', 63, 'l', 0, 'o', 27, 'El rojo de las pantallas', 'Brilla rojo bajo la luz ultravioleta. Dio el color a los televisores y es parte de la tinta de seguridad de los billetes de euro.'],
    ['Gd', 'Gadolinio', 64, 'l', 0, 'a', 30, 'Resonancias magnéticas', 'Es el líquido de contraste que se inyecta para una resonancia. También absorbe neutrones, y por eso se usa en reactores nucleares.'],
    ['Tb', 'Terbio', 65, 'p', 1, 'a', 1010, 'Imanes y sonares', 'La más cara de las que se usan en cantidad. Protege a los imanes del calor y, en una aleación llamada Terfenol-D, hace vibrar los sonares de los barcos.'],
    ['Dy', 'Disprosio', 66, 'p', 1, 'a', 239, 'El escudo térmico del imán', 'Una pizca dentro de un imán de neodimio le permite trabajar a 200 °C sin perder fuerza. Casi todo sale de arcillas del sur de China y de Myanmar.'],
    ['Ho', 'Holmio', 67, 'p', 0, 'o', null, 'Láseres médicos', 'Sus láseres rompen cálculos renales sin cirugía. También concentra campos magnéticos en equipos de laboratorio.'],
    ['Er', 'Erbio', 68, 'p', 0, 'o', null, 'Fibra óptica', 'Amplifica la luz dentro de la fibra óptica. Sin erbio, la señal de internet no llegaría de un continente a otro.'],
    ['Tm', 'Tulio', 69, 'p', 0, 'o', null, 'Rayos X portátiles', 'La más escasa de las estables. Se usa en láseres quirúrgicos y en equipos de rayos X que entran en una valija.'],
    ['Yb', 'Iterbio', 70, 'p', 0, 'o', null, 'Láseres industriales', 'Sus láseres de fibra cortan y sueldan metal en las fábricas. También marca el ritmo de los relojes atómicos más precisos.'],
    ['Lu', 'Lutecio', 71, 'p', 0, 'a', null, 'Tomógrafos y cáncer', 'Sus cristales detectan la radiación en los tomógrafos PET, y una versión radiactiva (lutecio-177) se usa para tratar tumores.'],
  ];
  const GRUPO = { l: ['ligera', LIG], p: ['pesada', PES], o: ['aparte', '#9aa5b8'] };
  const usd = v => 'US$ ' + num(v, v < 10 ? 2 : 0);
  function tabla() {
    const box = $('#tx-tabla'); if (!box) return;
    const F = $('#tx-ficha');
    let sel = 5, filtro = 't';
    const pasa = e => filtro === 't' || (filtro === 'i' ? !!e[4] : filtro === 'c' ? !!e[5] : e[3] === filtro);
    box.innerHTML = ELEM.map((e, i) => '<button type="button" class="tx-el g-' + e[3] + '" data-i="' + i + '" aria-label="' + esc(e[1] + ', número ' + e[2] + ', ' + GRUPO[e[3]][0]) + '"><small>' + e[2] + '</small><b>' + e[0] + '</b><span>' + esc(e[1]) + '</span>' + (e[5] ? '<i class="' + e[5] + '" aria-hidden="true"></i>' : '') + '</button>').join('');
    const bs = $$('button', box);
    function pintar() {
      const e = ELEM[sel];
      bs.forEach((b, i) => { b.classList.toggle('on', i === sel); b.classList.toggle('dim', !pasa(ELEM[i])); });
      F.style.setProperty('--c', GRUPO[e[3]][1]);
      F.innerHTML = '<b class="s">' + e[0] + '</b><div><p class="n">' + esc(e[1]) + ' <small>n.º ' + e[2] + ' · ' + GRUPO[e[3]][0] + '</small></p><p class="u">' + esc(e[7]) + '</p><p class="x">' + esc(e[8]) + '</p><p class="m">' +
        '<span>' + (e[6] ? usd(e[6]) + ' el kilo de óxido' : 'Sin precio de referencia público') + '</span>' +
        (e[5] === 'a' ? '<span class="c">Desde abril de 2025, China pide licencia para exportarla</span>' : e[5] === 'o' ? '<span class="c">China anunció controles en octubre de 2025 y los dejó en suspenso</span>' : '<span>Sin controles específicos de China</span>') + '</p></div>';
    }
    box.addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) { sel = +b.dataset.i; pintar(); track('atlas_tr_elem', { el: ELEM[sel][0] }); } });
    grupo('[data-tf]', b => { filtro = b.dataset.tf; if (!pasa(ELEM[sel])) sel = ELEM.findIndex(pasa); pintar(); track('atlas_tr_filtro', { f: filtro }); });
    pintar();

    // Un kilo de cada una, en escala logarítmica
    const P = $('#tx-precios');
    const L = ELEM.filter(e => e[6]).sort((a, b) => a[6] - b[6]), tope = Math.log10(L[L.length - 1][6] * 1.6);
    P.innerHTML = L.map(e => '<div><span class="n">' + esc(e[1]) + '<small>' + GRUPO[e[3]][0] + '</small></span><span class="t"><i style="background:' + GRUPO[e[3]][1] + '" data-w="' + Math.max(5, (Math.log10(e[6]) + 0.25) / (tope + 0.25) * 100).toFixed(1) + '"></i><span>' + usd(e[6]) + '</span></span></div>').join('');
    requestAnimationFrame(() => requestAnimationFrame(() => $$('i', P).forEach(i => { i.style.width = i.dataset.w + '%'; })));
  }

  // ============ 2. Cuánto lleva cada cosa ============
  // [nombre, kilos de tierras raras (aprox.), etiqueta, texto]
  const USOS = [
    ['Celular', 0.0005, 'menos de 1 g', 'Imanes diminutos en el parlante, el vibrador y la cámara, más un toque de europio y terbio en la pantalla. Es muy poco, pero se venden más de 1.200 millones de teléfonos por año.'],
    ['Auto eléctrico', 0.5, '≈ 0,5 kg', 'El motor lleva entre 1 y 2 kilos de imanes de neodimio, y cerca de un tercio de ese peso son tierras raras. Un auto a nafta también las usa: en parlantes, levantavidrios y el catalizador del escape.'],
    ['Robot humanoide', 1.3, '≈ 1,3 kg', 'Cada articulación es un motor con imanes. Morgan Stanley estima unos 1,3 kilos de neodimio y praseodimio por robot. Todavía se fabrican pocos, pero es la demanda que más podría crecer.'],
    ['Caza F-35', 417, '417 kg', 'Radar, motores de las superficies de control, láser de puntería, pantallas y turbina. Más abajo lo podés girar en 3D y ver dónde va cada una.'],
    ['Turbina eólica marina', 2000, '≈ 2.000 kg', 'Una turbina de 10 MW sin caja de engranajes lleva unas 6 toneladas de imanes en el generador: unos 2.000 kilos de tierras raras. Una sola turbina, casi lo mismo que un buque de guerra.'],
    ['Destructor', 2360, '2.360 kg', 'Un destructor clase Arleigh Burke, de 155 metros: radares, sonar, motores eléctricos y unas 90 celdas de misiles.'],
    ['Submarino nuclear', 4170, '4.170 kg', 'Un submarino de ataque clase Virginia. Es la máquina con más tierras raras de esta lista: sonar, propulsión silenciosa, mástiles electrónicos y misiles.'],
  ];
  function usos() {
    const box = $('#tx-usos'); if (!box) return;
    const D = $('#tx-usos-det');
    const a = Math.log10(USOS[0][1]), b = Math.log10(USOS[USOS.length - 1][1]);
    box.innerHTML = USOS.map((u, i) => '<button type="button" data-i="' + i + '"><span class="n">' + esc(u[0]) + '</span><span class="t"><i style="background:' + (i === 3 || i > 4 ? PES : TX) + '" data-w="' + Math.max(4, (Math.log10(u[1]) - a) / (b - a) * 100).toFixed(1) + '"></i><span>' + esc(u[2]) + '</span></span></button>').join('');
    requestAnimationFrame(() => requestAnimationFrame(() => $$('i', box).forEach(i => { i.style.width = i.dataset.w + '%'; })));
    const bs = $$('button', box);
    function elegir(i) { bs.forEach((x, j) => x.classList.toggle('on', j === i)); D.innerHTML = '<b>' + esc(USOS[i][0]) + ': ' + esc(USOS[i][2]) + '.</b> ' + esc(USOS[i][3]); }
    box.addEventListener('click', e => { const x = e.target.closest('button'); if (x) { elegir(+x.dataset.i); track('atlas_tr_uso', { obj: USOS[+x.dataset.i][0] }); } });
    elegir(1);
  }

  // ============ 3. El imán y el calor ============
  // f: fuerza a 20 °C (neodimio = 100) · a: cuánto pierde por cada grado · max: temperatura de trabajo
  const IMAN = {
    nd: { n: 'Neodimio solo', f: 100, a: 0.0012, max: 80, t: 'Es el más fuerte, pero el más delicado: pasados los 80 °C empieza a desmagnetizarse.' },
    dy: { n: 'Neodimio con disprosio y terbio', f: 85, a: 0.001, max: 200, t: 'Pierde un poco de fuerza de entrada, pero aguanta hasta 200 °C. Es el imán de los autos eléctricos y de los misiles.' },
    sm: { n: 'Samario-cobalto', f: 60, a: 0.00035, max: 300, t: 'Más débil y más caro, pero casi no nota el calor: trabaja a 300 °C. Es el imán de los radares y las turbinas.' },
    fe: { n: 'Ferrita, sin tierras raras', f: 10, a: 0.002, max: 250, t: 'El imán negro de la heladera. Barato y sin tierras raras, pero diez veces más débil: para la misma fuerza hace falta un motor mucho más grande y pesado.' },
  };
  const REF = [[60, 'Un celular al sol'], [150, 'Motor de un auto eléctrico exigido'], [200, 'Aletas de un misil en vuelo'], [300, 'Junto a la turbina de un avión']];
  function iman() {
    const r = $('#tx-iman-t'); if (!r) return;
    const svg = $('#tx-iman-svg'), Fz = $('#tx-iman-f'), E = $('#tx-iman-e'), X = $('#tx-iman-x'), L = $('#tx-iman-ref'), nuevo = $('#tx-iman-nuevo');
    let tipo = 'nd', pico = 20;
    const curva = (m, T) => (T <= m.max ? m.f * (1 - m.a * (T - 20)) : m.f * (1 - m.a * (m.max - 20)) * Math.exp(-(T - m.max) / 22));
    L.innerHTML = REF.map(x => '<li><b>' + x[0] + ' °C</b><span>' + esc(x[1]) + '</span><em></em></li>').join('');
    const li = $$('li', L);
    function pintar() {
      const T = +r.value, m = IMAN[tipo];
      pico = Math.max(pico, T);
      // Pasado el límite, el daño queda aunque después se enfríe
      const roto = pico > m.max, f = Math.max(0, roto ? Math.min(curva(m, T), curva(m, pico)) : curva(m, T)), k = Math.round(f / 10);
      const calor = Math.min(1, (T - 20) / 280), col = 'color-mix(in srgb, ' + ROJO + ' ' + Math.round(calor * 100) + '%, #9aa5b8)';
      let h = '<rect x="90" y="14" width="120" height="46" rx="8" fill="' + col + '" fill-opacity=".22" stroke="' + col + '" stroke-width="2"/><text x="150" y="43" text-anchor="middle" font-family="DM Mono, monospace" font-size="13" fill="' + col + '">' + T + ' °C</text>';
      for (let i = 0; i < 10; i++) {
        const on = i < k;
        h += '<g class="pesa' + (on ? ' on' : '') + '" style="transform:translateY(' + (on ? 0 : 26 + (9 - i) * 1.5) + 'px)"><rect x="118" y="' + (66 + i * 22) + '" width="64" height="18" rx="5"/></g>';
      }
      svg.innerHTML = h + '<line x1="60" x2="240" y1="318" y2="318" stroke="rgba(255,255,255,0.18)"/>';
      Fz.textContent = Math.round(f) + '%';
      E.textContent = roto ? 'Dañado' : T > m.max - 15 ? 'Al límite' : 'Estable';
      E.className = 'gx-estado ' + (roto ? 'mal' : T > m.max - 15 ? 'ojo' : 'ok');
      nuevo.hidden = !roto;
      li.forEach((x, i) => { const ok = REF[i][0] <= m.max; x.classList.toggle('on', T >= REF[i][0]); x.classList.toggle('no', !ok); x.querySelector('em').textContent = ok ? 'aguanta' : 'no aguanta'; });
      X.innerHTML = roto ? '<b>Se pasó de temperatura.</b> Un imán de ' + esc(m.n.toLowerCase()) + ' trabaja hasta ' + m.max + ' °C. Más arriba se desmagnetiza, y aunque lo enfríes no recupera la fuerza: hay que cambiarlo.'
        : '<b>' + esc(m.n) + '.</b> ' + esc(m.t) + (tipo === 'nd' && T < 60 ? ' Subí la temperatura y mirá cuántas pesas sostiene.' : '');
    }
    r.addEventListener('input', pintar);
    r.addEventListener('change', () => track('atlas_tr_iman', { tipo, t: +r.value }));
    nuevo.addEventListener('click', () => { pico = 20; r.value = 20; pintar(); });
    grupo('[data-iman]', b => { tipo = b.dataset.iman; pico = +r.value; pintar(); track('atlas_tr_iman_tipo', { tipo }); });
    pintar();
  }

  // ============ 4. Separar dos vecinas ============
  // Modelo ideal: cada tanque multiplica la proporción entre los dos metales por su "factor de separación"
  const SEP = {
    np: { b: 1.5, a: 'neodimio', z: 'praseodimio', t: 'Son vecinos en la tabla y casi gemelos: cada tanque mejora la mezcla apenas una vez y media.' },
    ln: { b: 18, a: 'neodimio', z: 'lantano', t: 'Están a tres casilleros de distancia: se parecen menos y se separan en un puñado de pasos.' },
  };
  function separar() {
    const r = $('#tx-sep-r'); if (!r) return;
    const G = $('#tx-sep-g'), N = $('#tx-sep-n'), P = $('#tx-sep-p'), U = $('#tx-sep-u'), X = $('#tx-sep-x'), TOT = +r.max;
    let par = 'np';
    const pureza = (b, n) => { const q = Math.pow(b, n); return q / (1 + q); };
    G.innerHTML = Array.from({ length: TOT }, () => '<i></i>').join('');
    const cel = $$('i', G);
    function pintar() {
      const n = +r.value, s = SEP[par], p = pureza(s.b, n) * 100;
      cel.forEach((c, i) => {
        const on = i < n;
        c.classList.toggle('on', on);
        c.style.background = on ? 'color-mix(in srgb, ' + TX + ' ' + (pureza(s.b, i + 1) * 100).toFixed(1) + '%, ' + PES + ')' : '';
      });
      N.textContent = n;
      P.textContent = p >= 99.995 ? '99,99%+' : num(p, p > 99 ? 2 : 1) + '%';
      U.textContent = p >= 99.99 ? 'Pureza de láser' : p >= 99.5 ? 'Pureza de imán' : p >= 95 ? 'Todavía sucio' : 'Sigue mezclado';
      U.className = 'gx-estado ' + (p >= 99.5 ? 'ok' : p >= 95 ? 'ojo' : 'mal');
      X.innerHTML = '<b>' + n + (n === 1 ? ' tanque' : ' tanques') + ': ' + num(p, p > 99 ? 2 : 1) + '% de ' + s.a + '.</b> ' + esc(s.t) + ' ' +
        (p >= 99.99 ? 'Llegaste a la pureza que piden los láseres y las pantallas (99,99%).' : p >= 99.5 ? 'Ya sirve para un imán (99,5%). Para un láser falta un poco más.' : 'Para un imán hace falta 99,5%: seguí sumando tanques.');
    }
    r.addEventListener('input', pintar);
    r.addEventListener('change', () => track('atlas_tr_separar', { par, n: +r.value }));
    grupo('[data-sep]', b => { par = b.dataset.sep; pintar(); });
    pintar();
  }

  // ============ 5. El mapa: reservas, minas y lugares clave ============
  // res: reservas en millones de toneladas · prod: producción de mina 2025 en toneladas (USGS, 2026)
  const PAIS = {
    '156': { n: 'China', p: [105, 35], res: 44, prod: 270000, t: 'Tiene la mitad de las reservas y saca casi 7 de cada 10 toneladas. El Estado fija por año cuánto se puede minar.' },
    '076': { n: 'Brasil', p: [-51, -12], res: 21, prod: 2000, t: 'La segunda reserva del mundo, casi sin tocar. Su primera mina grande, Serra Verde, arrancó en 2024.' },
    '036': { n: 'Australia', p: [134, -25], res: 6.3, prod: 29000, t: 'El principal productor fuera de China en tierras raras ya separadas, gracias a la empresa Lynas.' },
    '643': { n: 'Rusia', p: [95, 61], res: 3.8, prod: 2600, t: 'Reservas grandes y producción chica. En 2026 el USGS revisó su cifra de reservas muy a la baja.' },
    '704': { n: 'Vietnam', p: [106, 16], res: 3.5, prod: 150, t: 'Tiene reservas, pero su producción se desplomó: en 2025 sacó apenas 150 toneladas.' },
    '840': { n: 'EE.UU.', p: [-100, 39], res: 1.9, prod: 51000, t: 'Una sola mina, Mountain Pass, en California. Hasta 2025 mandaba casi todo su concentrado a China para refinarlo.' },
    '304': { n: 'Groenlandia', p: [-42, 70], res: 1.5, prod: 0, t: 'Dos depósitos gigantes en el sur, sin explotar. Uno está frenado desde 2021 por una ley que prohíbe minar donde hay uranio.' },
    '834': { n: 'Tanzania', p: [35, -6], res: 0.89, prod: 0, t: 'Reservas identificadas, todavía sin producción.' },
    '710': { n: 'Sudáfrica', p: [24, -30], res: 0.86, prod: 0, t: 'Reservas identificadas, todavía sin producción.' },
    '124': { n: 'Canadá', p: [-106, 57], res: 0.83, prod: 0, t: 'Tiene reservas y algunos de los mayores recursos sin desarrollar de América del Norte.' },
    '458': { n: 'Malasia', p: [102, 4], res: 0.71, prod: 110, t: 'Produce poco, pero tiene la mayor planta de separación fuera de China: la de Lynas, en Kuantan.' },
    '104': { n: 'Myanmar', p: [96, 21], res: 0, prod: 22000, t: 'Minas informales en la frontera norte, controladas por grupos armados. Casi todo son tierras raras pesadas que cruzan a China.' },
    '764': { n: 'Tailandia', p: [101, 15], res: 0, prod: 4800, t: 'Producción en alza, estimada a partir de lo que China declara importar.' },
    '356': { n: 'India', p: [79, 22], res: 0, prod: 2900, t: 'Saca tierras raras de las arenas de sus playas. El USGS dejó de publicar una cifra de reservas en su revisión de 2026.' },
    '450': { n: 'Madagascar', p: [47, -19], res: 0, prod: 2700, t: 'Producción chica y en alza, estimada por lo que China importa.' },
    '566': { n: 'Nigeria', p: [8, 9], res: 0, prod: 1500, t: 'Producción chica, casi toda exportada a China.' },
  };
  const TIPO = { m: ['Mina', TX], f: ['Planta', '#22d3ee'], y: ['Proyecto', '#a78bfa'], o: ['Fondo del mar', LIG], a: ['Argentina', VERDE] };
  const LUGAR = [
    { id: 'bayan', n: 'Bayan Obo y Baotou', l: 'Mongolia Interior, China', p: [109.9, 41.3], k: 'm', f: 'La mina de tierras raras más grande del mundo. Las saca como subproducto del hierro y las refina en Baotou, 150 km al sur, junto a un lago de residuos de 11 km².' },
    { id: 'ganzhou', n: 'Ganzhou', l: 'Jiangxi, China', p: [114.9, 25.8], k: 'f', f: 'El centro de las tierras raras pesadas. Acá se refina el disprosio y el terbio de las arcillas del sur de China y de Myanmar.' },
    { id: 'kachin', n: 'Kachin', l: 'Norte de Myanmar', p: [97.6, 25.7], k: 'm', f: 'Cientos de minas informales que inyectan químicos en los cerros. Es la principal fuente de tierras raras pesadas del mundo y cruza toda a China.' },
    { id: 'mp', n: 'Mountain Pass', l: 'California, EE.UU.', p: [-115.5, 35.5], k: 'm', f: 'Fue la mayor mina del mundo hasta los años 80, cerró en 2002 y reabrió. Desde 2025 el Pentágono es su principal accionista.' },
    { id: 'weld', n: 'Mount Weld', l: 'Australia Occidental', p: [122.5, -28.9], k: 'm', f: 'Uno de los depósitos más ricos del mundo. Es de Lynas, que manda el mineral a su planta de Malasia.' },
    { id: 'kuantan', n: 'Kuantan', l: 'Malasia', p: [103.3, 4], k: 'f', f: 'La planta de Lynas. En 2025 fue la primera fuera de China en producir disprosio y terbio separados a escala comercial.' },
    { id: 'serra', n: 'Serra Verde', l: 'Goiás, Brasil', p: [-48.3, -13.5], k: 'm', f: 'Arcillas parecidas a las del sur de China, con las cuatro tierras raras de los imanes. Produce desde 2024 y Estados Unidos ya financia su ampliación.' },
    { id: 'fen', n: 'Fen', l: 'Telemark, Noruega', p: [9.3, 59.3], k: 'y', f: 'El mayor depósito de Europa: 15,9 millones de toneladas según la actualización de 2026. La mina no llegaría antes de la década de 2030.' },
    { id: 'groen', n: 'Kvanefjeld y Tanbreez', l: 'Sur de Groenlandia', p: [-45.9, 60.9], k: 'y', f: 'Dos de los mayores depósitos del mundo, a pocos kilómetros uno del otro. Son una de las razones del interés de Estados Unidos por la isla.' },
    { id: 'minami', n: 'Minamitorishima', l: 'Océano Pacífico, Japón', p: [154, 24.3], k: 'o', f: 'En febrero de 2026, un barco japonés subió barro con tierras raras desde 6.000 metros de profundidad. Más de la mitad eran medianas y pesadas.' },
    { id: 'ccz', n: 'Zona Clarion-Clipperton', l: 'Océano Pacífico', p: [-135, 12], k: 'o', f: 'Una llanura a 4.000 metros de profundidad cubierta de nódulos con níquel, cobalto y algo de tierras raras. Nadie los explota todavía.' },
    { id: 'molles', n: 'Rodeo de los Molles', l: 'San Luis, Argentina', p: [-65.6, -32.4], k: 'a', f: 'El depósito más importante identificado en la Argentina: unas 100.000 toneladas, más de la mitad de lo que se conoce en el país. Nunca se explotó.' },
  ];
  const lugar = id => LUGAR.find(x => x.id === id);

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
  const mt = v => num(v, v < 10 ? 2 : 0) + ' millones de t';
  function fichaPais(iso) {
    if (window.AtlasTerritorio[iso]) return window.AtlasTerritorio[iso];
    if (iso === '032') return 'Tiene unas 190.000 toneladas identificadas, sobre todo en San Luis, Río Negro y Salta. No produce desde los años 50.';
    if (iso === '392') return 'No tiene minas, pero sí la industria de imanes más avanzada fuera de China. En 2026 probó sacar barro con tierras raras del fondo del Pacífico.';
    const d = PAIS[iso];
    if (!d) return 'Sin reservas ni producción relevantes de tierras raras.';
    return (d.res ? 'Reservas: ' + mt(d.res) + '. ' : '') + (d.prod ? 'Producción 2025: ' + num(d.prod, 0) + ' t. ' : '') + d.t;
  }
  function mapa() {
    const canvas = $('#globo-t'); if (!canvas) return;
    const tip = tooltip(canvas.parentElement);
    const lista = $('#tx-lista'), det = $('#tx-mapa-det'), tit = $('#tx-mapa-t');
    let modo = 'r', sel = null;
    const g = AtlasGlobo(canvas, {
      base: BASE, foco: [100, 25],
      onPais: (iso, nom, xy) => { if (!iso) return tip(null); tip(PAIS[iso] ? PAIS[iso].n : nom, fichaPais(iso), xy, iso); track('atlas_tr_pais', { pais: nom }); },
      onPunto: id => elegir(id),
    });
    const TIT = { r: 'Hay en muchos lados.', m: 'Pero casi todo sale de un solo país.', l: 'Doce lugares que explican el mapa.' };
    const orden = k => Object.keys(PAIS).filter(i => PAIS[i][k]).sort((a, b) => PAIS[b][k] - PAIS[a][k]);

    function pintar(conLista) {
      tit.textContent = TIT[modo];
      if (modo !== 'l') {
        const k = modo === 'r' ? 'res' : 'prod', O = orden(k), max = PAIS[O[0]][k], col = modo === 'r' ? TX : PES, res = {};
        O.forEach(i => { res[i] = [col, 0.22 + 0.78 * Math.sqrt(PAIS[i][k] / max)]; });
        if (sel) res[sel] = [VERDE, 0.9];
        g.set({ resaltes: res, arcos: [], rutas: [], puntos: [], etiquetas: [] });
        if (conLista) lista.innerHTML = O.slice(0, 8).map(i => '<li><button type="button" data-id="' + i + '" style="--c:' + col + '"><span class="r">' + esc(PAIS[i].n) + '</span><span class="v">' + (modo === 'r' ? mt(PAIS[i].res) : num(PAIS[i].prod, 0) + ' t') + '</span><span class="b"><i style="width:' + Math.max(1, Math.round(PAIS[i][k] / max * 100)) + '%"></i></span></button></li>').join('');
        const d = sel && PAIS[sel];
        det.innerHTML = d ? '<b>' + esc(d.n) + '.</b> ' + esc(d.t)
          : modo === 'r' ? 'El mundo tiene más de 85 millones de toneladas en reservas: alcanzan para más de 200 años al ritmo actual. Tocá un país.'
            : 'En 2025 se minaron unas 390.000 toneladas. China sola sacó 270.000: el 69%. Tocá un país.';
      } else {
        const col = x => TIPO[x.k][1];
        g.set({
          resaltes: { '156': [TX, 0.3], '032': [VERDE, 0.3] }, arcos: [], etiquetas: [],
          rutas: [['kachin', 'ganzhou'], ['weld', 'kuantan']].map(r => ({ pts: [lugar(r[0]).p, lugar(r[1]).p], c: TX, w: 1.4, apagado: !!sel && sel !== r[0] && sel !== r[1] })),
          puntos: LUGAR.map(x => ({ id: x.id, p: x.p, c: col(x), r: x.id === sel ? 6.5 : 4.5, pulso: x.id === sel || (!sel && x.k === 'a'), t: x.id === sel ? x.n : '' })),
        });
        if (conLista) lista.innerHTML = LUGAR.map(x => '<li><button type="button" class="q" data-id="' + x.id + '" style="--c:' + col(x) + '"><span class="r"><i></i>' + esc(x.n) + '</span><span class="v"><b>' + TIPO[x.k][0] + '</b> · ' + esc(x.l) + '</span></button></li>').join('');
        const x = sel && lugar(sel);
        det.innerHTML = x ? '<b>' + esc(x.n) + ' · ' + esc(x.l) + '.</b> ' + esc(x.f)
          : 'Amarillo: minas. Celeste: plantas que separan. Violeta: proyectos. Azul: el fondo del mar. Verde: Argentina. Las líneas muestran de qué mina sale lo que refina cada planta. Tocá un punto o un nombre.';
      }
      $$('button', lista).forEach(b => b.classList.toggle('on', b.dataset.id === sel));
    }
    function elegir(id) {
      sel = sel === id ? null : id;
      pintar(false);
      if (!sel) return;
      g.girarA(modo === 'l' ? lugar(sel).p : PAIS[sel].p, 1000);
      if (window.innerWidth < 900) canvas.scrollIntoView({ behavior: REDUCIR ? 'auto' : 'smooth', block: 'center' });
      track('atlas_tr_mapa', { modo, sel });
    }
    lista.addEventListener('click', e => { const b = e.target.closest('button'); if (b) elegir(b.dataset.id); });
    grupo('[data-tmapa]', b => {
      modo = b.dataset.tmapa; sel = null; pintar(true);
      g.girarA(modo === 'l' ? [60, 25] : [100, 25], 1100);
    });
    pintar(true);
  }

  // ============ 6. El cuello de botella: la parte de China en cada etapa ============
  const EMB = [
    ['Reservas', 'lo que hay bajo tierra', 52, 'China tiene 44 de los 85 millones de toneladas de reservas conocidas (USGS, 2026). Es mucho, pero la otra mitad está repartida entre Brasil, Australia, Rusia, Vietnam y varios más.'],
    ['Minería', 'sacar la roca', 69, 'En 2025 China minó 270.000 de las 390.000 toneladas del mundo (USGS). Estados Unidos, segundo, sacó 51.000.'],
    ['Refinado', 'separar las 17', 91, 'Acá está el verdadero control: 9 de cada 10 toneladas se separan y purifican en China (AIE, datos de 2024). Hasta la roca de California viajaba a China para eso.'],
    ['Imanes', 'el producto final', 94, 'Casi todos los imanes de tierras raras del mundo se fabrican en China (AIE). El resto sale de Japón y, en mucha menor medida, de Europa y Estados Unidos.'],
    ['Disprosio y terbio', 'las pesadas, ya separadas', 99, 'Hasta 2025, prácticamente todo el disprosio y el terbio del mundo se separaba en China. Ese año, Lynas empezó a producirlos en Malasia. Son los dos elementos que hacen falta para que un imán aguante el calor.'],
  ];
  function embudo() {
    const box = $('#tx-emb'); if (!box) return;
    const D = $('#tx-emb-det');
    box.innerHTML = EMB.map((e, i) => '<button type="button" data-i="' + i + '"><span class="n">' + esc(e[0]) + '<small>' + esc(e[1]) + '</small></span><span class="t"><i style="background:' + ROJO + '" data-w="' + e[2] + '"></i><span>China ' + (e[2] === 99 ? '≈ ' : '') + e[2] + '%</span></span></button>').join('');
    requestAnimationFrame(() => requestAnimationFrame(() => $$('i', box).forEach(i => { i.style.width = i.dataset.w + '%'; })));
    const bs = $$('button', box);
    function elegir(i) { bs.forEach((x, j) => x.classList.toggle('on', j === i)); D.innerHTML = '<b>' + esc(EMB[i][0]) + ': ' + EMB[i][2] + '% en China.</b> ' + esc(EMB[i][3]); }
    box.addEventListener('click', e => { const x = e.target.closest('button'); if (x) { elegir(+x.dataset.i); track('atlas_tr_embudo', { etapa: EMB[+x.dataset.i][0] }); } });
    elegir(2);
  }

  // ============ 7. Defensa: visor 3D ============
  // Mallas de caras planas, dibujadas de atrás hacia adelante. Ejes: x hacia la proa, y hacia arriba, z hacia estribor.
  function loft(m, R) {
    const n = R[0].length;
    for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < n; j++) m.push([R[i][j], R[i][(j + 1) % n], R[i + 1][(j + 1) % n], R[i + 1][j]]);
    m.push(R[0]); m.push(R[R.length - 1]);
  }
  // Cuerpo de sección ovalada. Estaciones: [x, medio ancho, medio alto, altura del centro]
  const tubo = (m, est, n) => loft(m, est.map(e => Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI; return [e[0], (e[3] || 0) + e[2] * Math.sin(a), e[1] * Math.cos(a)]; })));
  // Placa: un polígono plano al que se le da espesor
  const placa = (m, P, t) => loft(m, [P.map(p => [p[0] + t[0] / 2, p[1] + t[1] / 2, p[2] + t[2] / 2]), P.map(p => [p[0] - t[0] / 2, p[1] - t[1] / 2, p[2] - t[2] / 2])]);
  const caja = (m, x0, x1, y0, y1, z0, z1) => loft(m, [[[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]]);
  const esp = P => P.map(p => [p[0], p[1], -p[2]]);    // espejo babor/estribor
  const gir = P => P.map(p => [p[0], p[2], p[1]]);     // de horizontal a vertical
  const inv = P => P.map(p => [p[0], -p[1], p[2]]);    // de arriba a abajo
  // Centra la malla y mide su tamaño
  function cerrar(m, pts) {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    m.forEach(c => c.forEach(p => { for (let i = 0; i < 3; i++) { if (p[i] < mn[i]) mn[i] = p[i]; if (p[i] > mx[i]) mx[i] = p[i]; } }));
    const o = [0, 1, 2].map(i => (mn[i] + mx[i]) / 2), mv = p => [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
    const caras = m.map(c => c.map(mv));
    let radio = 0, alto = 0;
    caras.forEach(c => c.forEach(p => { radio = Math.max(radio, Math.hypot(p[0], p[2])); alto = Math.max(alto, Math.abs(p[1])); }));
    return { caras, radio, alto, puntos: pts.map(mv) };
  }
  function caza() {
    const m = [];
    tubo(m, [[7.8, 0.06, 0.06, -0.15], [6.6, 0.45, 0.36, -0.1], [5.2, 0.85, 0.6, 0], [3.4, 1.3, 0.8, 0.05], [1, 1.6, 0.85, 0.05], [-2.5, 1.55, 0.8, 0], [-5.6, 1.1, 0.72, 0], [-7.6, 0.66, 0.62, 0]], 10);
    tubo(m, [[5.7, 0.06, 0.05, 0.5], [5, 0.36, 0.3, 0.68], [4.1, 0.44, 0.4, 0.8], [3, 0.32, 0.26, 0.78], [2.3, 0.06, 0.05, 0.72]], 8);   // cabina
    const ala = [[2.6, 0, 1.2], [-1.9, 0, 5.35], [-3.1, 0, 5.35], [-4.4, 0, 1.2]], cola = [[-4.8, 0, 1], [-6.8, 0, 3.3], [-7.8, 0, 3.3], [-7.6, 0, 1]];
    const deriva = [[-3.9, 0.55, 0.95], [-6.3, 2.9, 1.9], [-7.3, 2.9, 1.9], [-7.1, 0.55, 0.95]];
    [ala, cola].forEach(P => { placa(m, P, [0, 0.14, 0]); placa(m, esp(P), [0, 0.14, 0]); });
    placa(m, deriva, [0, 0, 0.12]); placa(m, esp(deriva), [0, 0, 0.12]);
    return cerrar(m, [[7, -0.1, 0], [5.6, -0.6, 0], [4.1, 1.25, 0], [-2.7, 0.1, 3.6], [-6.6, 0, 0]]);
  }
  function destructor() {
    const m = [];
    // Casco: [x, media manga, altura de la cubierta, altura de la quilla]
    loft(m, [[77, 0.4, 10, 3], [68, 3.2, 9.2, -3.5], [48, 7.8, 8.2, -6], [12, 10, 7, -6.3], [-40, 10, 6, -6.3], [-68, 8.8, 6, -5], [-77, 7.8, 6, -2]].map(e => {
      const md = (e[2] + e[3]) / 2;
      return [[e[0], e[2], -e[1]], [e[0], e[2], e[1]], [e[0], md, e[1] * 0.9], [e[0], e[3], e[1] * 0.3], [e[0], e[3], -e[1] * 0.3], [e[0], md, -e[1] * 0.9]];
    }));
    caja(m, 22, 46, 7.3, 17, -7.5, 7.5); caja(m, 33, 44, 17, 20.5, -6, 6);                        // puente
    placa(m, [[31, 20.5, 0], [30.5, 37, 0], [29, 37, 0], [25, 20.5, 0]], [0, 0, 1.4]);              // mástil
    placa(m, [[30.6, 31, -6], [30.6, 31, 6], [29.4, 31, 6], [29.4, 31, -6]], [0, 0.6, 0]);
    caja(m, 4, 14, 7, 19, -4, 4); caja(m, -22, -12, 6.5, 18, -4, 4);                               // chimeneas
    caja(m, -50, -27, 6, 13, -7.2, 7.2);                                                           // hangar
    caja(m, 56, 60.5, 9, 11.6, -1.7, 1.7); placa(m, [[60.5, 10.9, 0], [68, 11.9, 0], [68, 11.4, 0], [60.5, 10.1, 0]], [0, 0, 0.6]);   // cañón
    caja(m, 47.5, 54, 8.3, 9, -4.2, 4.2);                                                          // lanzadores verticales
    return cerrar(m, [[46, 14.5, 6], [71, -3.2, 0], [50.7, 9.6, 0], [58.2, 12.2, 0], [-58, -3, 0]]);
  }
  function submarino() {
    const m = [];
    tubo(m, [[57, 0.4, 0.4], [55.5, 2.7, 2.7], [52, 4.2, 4.2], [46, 5, 5], [-22, 5, 5], [-38, 3.9, 3.9], [-50, 1.9, 1.9], [-55, 0.8, 0.8]], 12);
    placa(m, [[33, 4.6, 0], [32, 10.5, 0], [24, 10.5, 0], [21, 4.6, 0]], [0, 0, 2.2]);              // vela
    placa(m, [[29.4, 10.5, 0], [29.4, 13.4, 0], [28.8, 13.4, 0], [28.8, 10.5, 0]], [0, 0, 0.5]);    // mástiles
    placa(m, [[27, 10.5, 0], [27, 12.3, 0], [26.5, 12.3, 0], [26.5, 10.5, 0]], [0, 0, 0.5]);
    const timon = [[-43, 0, 3], [-46, 0, 8.2], [-49.5, 0, 8.2], [-49.5, 0, 2]];
    placa(m, timon, [0, 0.5, 0]); placa(m, esp(timon), [0, 0.5, 0]); placa(m, gir(timon), [0, 0, 0.5]); placa(m, inv(gir(timon)), [0, 0, 0.5]);
    tubo(m, [[-52.5, 2.7, 2.7], [-56.5, 2.4, 2.4]], 12);                                            // propulsor
    return cerrar(m, [[53, 0, 0], [39, 5.2, 0], [29, 12.6, 0], [-34, 0, 0]]);
  }
  function misil() {
    const m = [];
    tubo(m, [[28, 0.25, 0.25], [26.6, 1.4, 1.4], [24.2, 2.3, 2.3], [21, 2.6, 2.6], [-24, 2.6, 2.6], [-28, 2, 2]], 12);
    const ala = [[2.5, 0, 2.3], [1.5, 0, 13.3], [-1.8, 0, 13.3], [-3, 0, 2.3]], aleta = [[-20.5, 0, 2.3], [-23, 0, 6.8], [-26, 0, 6.8], [-27, 0, 2.3]];
    placa(m, ala, [0, 0.3, 0]); placa(m, esp(ala), [0, 0.3, 0]);
    placa(m, aleta, [0, 0.3, 0]); placa(m, esp(aleta), [0, 0.3, 0]); placa(m, gir(aleta), [0, 0, 0.3]); placa(m, inv(gir(aleta)), [0, 0, 0.3]);
    tubo(m, [[-11, 1, 0.7, -3], [-19, 1.2, 0.9, -3]], 8);                                            // toma de aire
    return cerrar(m, [[25.6, 0, 0], [0, 0, 8.5], [-24.6, 0, 5.2], [-17, -3, 0]]);
  }
  // kg: kilos de tierras raras por unidad (informe del Congreso de EE.UU.); pts: [nombre, elementos, texto]
  const MODELO = {
    caza: { hacer: caza, b: 'Caza F-35', n: 'F-35 Lightning II', kg: 417, eq: 'Lo que pesa un piano de cola. Mide 15,7 m de largo.', pts: [
      ['Radar', 'Samario · galio', 'El radar de la nariz y los equipos que confunden a los radares enemigos usan imanes de samario-cobalto, que no se debilitan con el calor de la electrónica. Sus chips llevan galio, otro metal que China también controla.'],
      ['Puntería láser', 'Itrio · neodimio', 'Debajo de la nariz va un láser hecho con un cristal de itrio y neodimio. Mide distancias y marca el blanco para las bombas guiadas.'],
      ['Cabina y casco', 'Europio · terbio · lantano', 'Las pantallas y el visor del casco usan europio y terbio para dar color. Las lentes de visión nocturna llevan lantano.'],
      ['Alerones y timones', 'Neodimio · disprosio · terbio', 'Cada superficie de control se mueve con motores eléctricos de imanes de neodimio, reforzados con disprosio y terbio para aguantar el calor y la vibración.'],
      ['Motor', 'Itrio · samario', 'Las paletas de la turbina trabajan a más de 1.000 °C gracias a una capa cerámica con itrio. El generador eléctrico usa imanes de samario-cobalto.'],
    ] },
    destructor: { hacer: destructor, b: 'Destructor', n: 'Destructor clase Arleigh Burke', kg: 2360, eq: 'Lo que pesa una camioneta grande. Mide 155 m de largo.', pts: [
      ['Radar', 'Samario', 'Los cuatro paneles del radar vigilan en todas las direcciones a la vez. Sus generadores de microondas usan imanes de samario-cobalto.'],
      ['Sonar', 'Terbio · disprosio', 'Va en la proa, bajo el agua. Emite sonido con Terfenol-D, una aleación de terbio, disprosio y hierro que cambia de forma cuando recibe un pulso magnético.'],
      ['Misiles', 'Neodimio · disprosio', 'Unas 90 celdas de lanzamiento vertical. Cada misil que sale mueve sus aletas con imanes de neodimio.'],
      ['Cañón y puntería', 'Itrio · neodimio', 'Los láseres que miden la distancia y marcan el blanco son de cristal de itrio con neodimio.'],
      ['Propulsión', 'Neodimio', 'Los motores eléctricos auxiliares, las bombas y los generadores del barco usan imanes permanentes de neodimio.'],
    ] },
    submarino: { hacer: submarino, b: 'Submarino', n: 'Submarino clase Virginia', kg: 4170, eq: 'Lo que pesa un elefante. Mide 115 m de largo.', pts: [
      ['Sonar', 'Terbio · disprosio', 'La esfera de la proa es el oído del submarino. Sus emisores usan Terfenol-D para escuchar y emitir a kilómetros de distancia.'],
      ['Misiles crucero', 'Neodimio · disprosio', 'Doce tubos verticales para misiles Tomahawk, cada uno con sus propios imanes y sensores.'],
      ['Mástiles', 'Itrio · lantano', 'No tiene periscopio de espejos: usa mástiles con cámaras, sensores infrarrojos y láseres que mandan la imagen por cable.'],
      ['Propulsión', 'Neodimio · samario', 'Motores, bombas y generadores silenciosos, con imanes permanentes. En un submarino, hacer menos ruido es sobrevivir.'],
    ] },
    misil: { hacer: misil, b: 'Misil crucero', n: 'Misil crucero Tomahawk', kg: 0, eq: 'Son pocos kilos, pero sin esos imanes no puede guiarse. Mide 5,6 m de largo.', pts: [
      ['Guía', 'Samario · itrio', 'En la nariz van los sensores que comparan el terreno con un mapa guardado. Sus giróscopos y motores diminutos usan imanes de samario-cobalto.'],
      ['Alas', 'Neodimio', 'Sale del tubo con las alas plegadas y las abre en vuelo con motores eléctricos.'],
      ['Aletas de cola', 'Neodimio · disprosio · terbio', 'Corrigen el rumbo muchas veces por segundo. Sus imanes llevan disprosio y terbio: sin ellos, el calor del vuelo los dejaría sin fuerza.'],
      ['Motor', 'Itrio', 'Un pequeño motor a reacción lo empuja a casi 900 km/h, y su generador alimenta toda la electrónica de a bordo.'],
    ] },
  };
  function visor(canvas, alTocar) {
    const ctx = canvas.getContext('2d');
    const LUZ = [-0.42, 0.74, 0.52], INCL = 0.36, ci = Math.cos(INCL), si = Math.sin(INCL);
    let mod = null, yaw = -0.75, sel = -1, W = 0, H = 0, pend = false, visible = false, corre = false, quieto = 0, arr = null, pp = [];
    function medir() {
      const r = canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * d); canvas.height = Math.round(H * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    function dibujar() {
      pend = false;
      if (!mod || !W) return;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const k = Math.min(W * 0.47 / mod.radio, H * 0.45 / (mod.alto * ci + mod.radio * si * 0.55));
      const tr = p => { const x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy; return [x, p[1] * ci - z * si, p[1] * si + z * ci]; };
      ctx.clearRect(0, 0, W, H);
      const F = mod.caras.map(c => {
        const q = c.map(tr), n = q.length;
        let nx = 0, ny = 0, nz = 0, zm = 0;
        for (let i = 0; i < n; i++) { const a = q[i], b = q[(i + 1) % n]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); zm += a[2]; }
        const l = Math.hypot(nx, ny, nz) || 1, s = nz < 0 ? -1 : 1;
        return { q, z: zm / n, luz: Math.max(0, s * (nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2]) / l) };
      }).sort((a, b) => a.z - b.z);
      ctx.lineJoin = 'round'; ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(165,205,255,0.3)';
      F.forEach(f => {
        const b = 0.2 + 0.8 * f.luz;
        ctx.fillStyle = 'rgb(' + Math.round(15 + 120 * b) + ',' + Math.round(21 + 152 * b) + ',' + Math.round(32 + 192 * b) + ')';
        ctx.beginPath();
        f.q.forEach((p, i) => { const x = W / 2 + p[0] * k, y = H / 2 - p[1] * k; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.closePath(); ctx.fill(); ctx.stroke();
      });
      pp = mod.puntos.map(p => { const q = tr(p); return [W / 2 + q[0] * k, H / 2 - q[1] * k]; });
      ctx.font = '500 11px "DM Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      pp.forEach((s, i) => {
        const on = i === sel;
        ctx.beginPath(); ctx.arc(s[0], s[1], on ? 13 : 10.5, 0, 7);
        ctx.fillStyle = on ? TX : 'rgba(10,12,15,0.82)'; ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = TX; ctx.stroke();
        ctx.fillStyle = on ? '#0a0c0f' : TX; ctx.fillText(i + 1, s[0], s[1] + 0.5);
      });
    }
    const pedir = () => { if (!pend) { pend = true; requestAnimationFrame(dibujar); } };
    // Giro solo: se frena unos segundos cuando alguien toca, y del todo si hay un punto elegido
    function tic() {
      if (!visible) { corre = false; return; }
      if (!arr && sel < 0 && performance.now() - quieto > 3500) { yaw += 0.0045; dibujar(); }
      requestAnimationFrame(tic);
    }
    canvas.addEventListener('pointerdown', e => { arr = { x: e.clientX, y: e.clientY, yaw, mov: 0 }; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* puntero ya liberado */ } });
    canvas.addEventListener('pointermove', e => {
      if (!arr) return;
      const dx = e.clientX - arr.x;
      arr.mov = Math.max(arr.mov, Math.abs(dx), Math.abs(e.clientY - arr.y));
      yaw = arr.yaw + dx * 0.012; quieto = performance.now(); pedir();
    });
    const soltar = e => {
      const a = arr; arr = null;
      if (!a || e.type !== 'pointerup' || a.mov > 7) return;
      const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      let m = -1, dm = 26;
      pp.forEach((s, i) => { const d = Math.hypot(s[0] - x, s[1] - y); if (d < dm) { dm = d; m = i; } });
      if (m >= 0) alTocar(m);
    };
    canvas.addEventListener('pointerup', soltar);
    canvas.addEventListener('pointercancel', soltar);
    new ResizeObserver(() => { medir(); dibujar(); }).observe(canvas);
    if ('IntersectionObserver' in window && !REDUCIR) new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !corre) { corre = true; requestAnimationFrame(tic); } }).observe(canvas);
    medir();
    return {
      set(m) { mod = m; yaw = -0.75; sel = -1; quieto = 0; pedir(); },
      elegir(i) { sel = i; quieto = performance.now(); pedir(); },
      girar(d) { yaw += d; quieto = performance.now(); pedir(); },
    };
  }
  function defensa() {
    const canvas = $('#tx-3d'); if (!canvas) return;
    const chips = $('#tx-3d-chips'), KG = $('#tx-3d-kg'), CAP = $('#tx-3d-cap'), EQ = $('#tx-3d-eq'), L = $('#tx-3d-pts'), D = $('#tx-3d-det');
    const hechos = {};
    let cual = 'caza', sel = -1;
    const v = visor(canvas, i => punto(i));
    function punto(i) {
      sel = sel === i ? -1 : i;
      v.elegir(sel);
      $$('button', L).forEach((b, j) => b.classList.toggle('on', j === sel));
      const p = MODELO[cual].pts[sel];
      D.innerHTML = p ? '<b>' + (sel + 1) + ' · ' + esc(p[0]) + '.</b> ' + esc(p[2]) : 'Tocá un punto numerado del modelo, o un nombre de la lista, para ver qué tierra rara va ahí y para qué sirve.';
      if (p) track('atlas_tr_3d_punto', { modelo: cual, punto: p[0] });
    }
    function modelo(k) {
      cual = k; sel = -1;
      const m = MODELO[k];
      v.set(hechos[k] || (hechos[k] = m.hacer()));
      KG.textContent = m.kg ? num(m.kg, 0) + ' kg' : 'Sin cifra pública';
      KG.classList.toggle('chico', !m.kg);
      CAP.textContent = m.n; EQ.textContent = m.eq;
      L.innerHTML = m.pts.map((p, i) => '<li><button type="button" class="q" data-i="' + i + '" style="--c:' + TX + '"><span class="r"><i></i>' + (i + 1) + ' · ' + esc(p[0]) + '</span><span class="v">' + esc(p[1]) + '</span></button></li>').join('');
      canvas.setAttribute('aria-label', 'Modelo 3D simplificado: ' + m.n);
      punto(-1); sel = -1;
    }
    chips.innerHTML = Object.keys(MODELO).map((k, i) => '<button type="button" class="ax-btn' + (i ? '' : ' on') + '" data-m="' + k + '" aria-pressed="' + !i + '">' + esc(MODELO[k].b) + '</button>').join('');
    grupo('#tx-3d-chips button', b => { modelo(b.dataset.m); track('atlas_tr_3d', { modelo: b.dataset.m }); });
    L.addEventListener('click', e => { const b = e.target.closest('button'); if (b) punto(+b.dataset.i); });
    $('#tx-3d-izq').addEventListener('click', () => v.girar(-0.6));
    $('#tx-3d-der').addEventListener('click', () => v.girar(0.6));
    modelo('caza');
  }

  // ============ 8. La canilla: línea de tiempo ============
  // Tipo: h hecho · z corte · i respuesta · p plazo
  const HITOS = [
    ['1992', 'h', 'Frase', 'Se le atribuye al líder chino Deng Xiaoping: "Medio Oriente tiene petróleo; China tiene tierras raras". El país empieza a tratarlas como una industria estratégica.'],
    ['2002', 'h', 'Hecho', 'Cierra Mountain Pass, la mina de California que había sido la mayor del mundo. No puede competir con los precios chinos ni pagar sus costos ambientales. China queda casi sola.'],
    ['2010', 'z', 'Corte', 'Tras un choque entre un pesquero chino y la guardia costera japonesa, China frena dos meses sus envíos a Japón. Los precios se multiplican por diez. Japón empieza a financiar minas en Australia.'],
    ['2023', 'z', 'Corte', 'China prohíbe exportar la tecnología para separar tierras raras y para fabricar imanes. Ya no alcanza con tener la roca: tampoco se puede comprar el saber hacer.'],
    ['Abr 2025', 'z', 'Corte', 'En plena guerra de aranceles, China exige licencia para exportar siete tierras raras (samario, gadolinio, terbio, disprosio, lutecio, escandio e itrio) y sus imanes. En semanas, fábricas de autos de Estados Unidos, Europa, Japón e India frenan líneas.'],
    ['Jul 2025', 'i', 'Respuesta', 'El Pentágono se vuelve el principal accionista de MP Materials, la dueña de Mountain Pass, y le garantiza por diez años un precio mínimo de US$ 110 el kilo: casi el doble de lo que valía en el mercado.'],
    ['Oct 2025', 'z', 'Corte', 'China suma cinco elementos y una regla nueva: cualquier producto hecho en cualquier país con más de 0,1% de tierras raras chinas necesitaría su permiso. Tres semanas después, tras una reunión entre Trump y Xi, la suspende por un año.'],
    ['Feb 2026', 'i', 'Respuesta', 'Estados Unidos lanza una reserva de minerales críticos de US$ 12.000 millones y firma acuerdos con varios países, entre ellos la Argentina. Japón saca barro con tierras raras desde 6.000 metros de profundidad.'],
    ['Sep 2026', 'h', 'Tregua', 'Estados Unidos y China extienden la tregua hasta el 10 de enero de 2027. Los controles de abril de 2025 siguen vigentes: cada envío necesita una licencia.'],
    ['2027', 'p', 'Plazo', 'Desde el 1 de enero, el Pentágono no puede comprar equipos con imanes hechos con tierras raras de China. Diez días después vence la tregua.'],
  ];
  function canilla() {
    const tl = $('#tx-tl'); if (!tl) return;
    tl.innerHTML = HITOS.map((x, i) => '<button type="button" class="ax-btn" data-i="' + i + '" aria-pressed="false">' + esc(x[0]) + '</button>').join('');
    const K = $('#tx-hito-k'), A = $('#tx-hito-a'), X = $('#tx-hito-x'), P = $('#tx-hito'), bs = $$('button', tl);
    let i = 4;
    function ir(n, mover) {
      i = Math.max(0, Math.min(HITOS.length - 1, n));
      bs.forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-pressed', j === i); });
      const x = HITOS[i];
      A.textContent = x[0]; P.dataset.k = x[1]; K.textContent = x[2]; X.textContent = x[3];
      $('#tx-hito-ant').disabled = i === 0; $('#tx-hito-sig').disabled = i === HITOS.length - 1;
      if (mover) tl.scrollTo({ left: bs[i].offsetLeft - tl.clientWidth / 2 + bs[i].offsetWidth / 2, behavior: REDUCIR ? 'auto' : 'smooth' });
    }
    tl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { ir(+b.dataset.i, true); track('atlas_tr_canilla', { hito: HITOS[+b.dataset.i][0] }); } });
    $('#tx-hito-ant').addEventListener('click', () => ir(i - 1, true));
    $('#tx-hito-sig').addEventListener('click', () => ir(i + 1, true));
    ir(4);
  }

  // ============ 9. Las cuatro salidas (pestañas) ============
  function salidas() {
    const tabs = $$('#salidas .ax-proc-tabs button'); if (!tabs.length) return;
    const panes = $$('#salidas .ax-proc-txt'), vis = $$('#salidas .ax-proc-vis [data-s]');
    let i = 0;
    function ir(n) {
      i = (n + tabs.length) % tabs.length;
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', j === i); t.classList.toggle('on', j === i); });
      panes.forEach((p, j) => { p.hidden = j !== i; });
      vis.forEach(x => x.classList.toggle('on', +x.dataset.s === i));
      $('#tx-sal-n').textContent = panes[i].dataset.num; $('#tx-sal-c').textContent = panes[i].dataset.cap;
      const fila = tabs[i].parentElement;
      fila.scrollTo({ left: tabs[i].offsetLeft - fila.clientWidth / 2 + tabs[i].offsetWidth / 2, behavior: REDUCIR ? 'auto' : 'smooth' });
    }
    tabs.forEach((t, j) => t.addEventListener('click', () => { ir(j); track('atlas_tr_salida', { salida: j }); }));
    $('#tx-sal-ant').addEventListener('click', () => ir(i - 1));
    $('#tx-sal-sig').addEventListener('click', () => ir(i + 1));
    ir(0);
  }

  // ============ 11. ¿Mito o verdad? ============
  const MITOS = [
    ['Las tierras raras son escasas.', 0, 'Hay de sobra: el cerio es más abundante que el cobre. Lo raro es encontrarlas concentradas, y lo difícil es separarlas.'],
    ['No son tierra: son metales.', 1, 'En el siglo XVIII se les decía "tierras" a los óxidos, que es como aparecen en la roca. Una vez purificadas son metales plateados.'],
    ['China tiene casi todas las reservas del mundo.', 0, 'Tiene cerca de la mitad. Lo que sí concentra casi por completo es el paso siguiente: el 91% del refinado y el 94% de los imanes.'],
    ['Un auto eléctrico lleva más tierras raras que un caza F-35.', 0, 'Un auto lleva medio kilo; un F-35, 417. Pero por año se venden millones de autos eléctricos y se fabrican menos de 200 cazas: el grueso de la demanda es civil.'],
    ['El litio es una tierra rara.', 0, 'Es otro grupo de la tabla periódica. El litio va en las baterías; las tierras raras, en los imanes del motor. Se suelen confundir porque los dos son "minerales críticos".'],
    ['Se puede hacer un motor eléctrico sin tierras raras.', 1, 'Renault y BMW venden autos con motores sin imanes, y los primeros Tesla tampoco los llevaban. Funcionan, pero son algo más grandes o gastan un poco más.'],
    ['Estados Unidos fue el mayor productor del mundo.', 1, 'Entre los años 60 y los 80, la mina de Mountain Pass, en California, abastecía a casi todo el planeta. Cerró en 2002.'],
  ];
  function mitos() {
    const box = $('#tx-mitos'); if (!box) return;
    let i = 0, pts = 0;
    function pintar() {
      if (i >= MITOS.length) {
        box.innerHTML = '<p class="ax-eyebrow">Resultado</p><p class="ax-quiz-q"><b>' + pts + ' de ' + MITOS.length + '.</b> ' + (pts >= 6 ? 'Ya podés corregir a más de un titular.' : pts >= 4 ? 'Bien: lo más repetido sobre este tema suele estar mal.' : 'Normal: casi todo lo que se repite sobre este tema está mal.') + '</p><div class="ax-chips"><button type="button" class="ax-btn" id="tx-mitos-otra">Jugar de nuevo</button></div>';
        $('#tx-mitos-otra').onclick = () => { i = 0; pts = 0; pintar(); };
        track('atlas_tr_mitos', { pts });
        return;
      }
      const m = MITOS[i];
      box.innerHTML = '<p class="ax-eyebrow">Frase ' + (i + 1) + ' de ' + MITOS.length + '</p><p class="ax-quiz-q">"' + esc(m[0]) + '"</p><div class="qx-mv"><button type="button" data-v="0">Mito</button><button type="button" data-v="1">Verdad</button></div><p class="ax-quiz-exp" aria-live="polite"></p>' +
        '<div class="ax-quiz-pie"><span>' + pts + ' acierto' + (pts === 1 ? '' : 's') + '</span><button type="button" class="ax-btn" id="tx-mitos-sig" hidden>Siguiente →</button></div>';
      $$('.qx-mv button', box).forEach(b => b.addEventListener('click', () => {
        const v = +b.dataset.v;
        $$('.qx-mv button', box).forEach(x => { x.disabled = true; if (+x.dataset.v === m[1]) x.classList.add('ok'); });
        if (v === m[1]) pts++; else b.classList.add('mal');
        $('.ax-quiz-exp', box).innerHTML = '<b>' + (m[1] ? 'Verdad.' : 'Mito.') + '</b> ' + esc(m[2]);
        const s = $('#tx-mitos-sig'); s.hidden = false; s.focus({ preventScroll: true });
        s.onclick = () => { i++; pintar(); };
      }));
    }
    pintar();
  }

  // ============ 12. Quiz ============
  const QUIZ = [
    { q: '¿Cuántas son las tierras raras?', o: ['7', '17', '30', '118'], ok: 1, e: 'Son 17: los 15 lantánidos, más el escandio y el itrio.' },
    { q: '¿Para qué se le agrega disprosio a un imán de neodimio?', o: ['Para que sea más barato', 'Para que pese menos', 'Para que aguante el calor', 'Para que no se oxide'], ok: 2, e: 'Sin disprosio ni terbio, un imán de neodimio empieza a perder fuerza a los 80 °C. Con ellos trabaja a 200 °C.' },
    { q: '¿Qué parte de la cadena controla más China?', o: ['Las reservas', 'Las minas', 'El refinado y los imanes', 'El consumo'], ok: 2, e: 'Tiene la mitad de las reservas, pero el 91% del refinado y el 94% de los imanes.' },
    { q: '¿Cuántos kilos de tierras raras lleva un caza F-35?', o: ['4', '41', '417', '4.170'], ok: 2, e: '417 kilos, según un informe del Congreso de Estados Unidos. Los 4.170 son de un submarino.' },
    { q: '¿Por qué es tan difícil separarlas?', o: ['Porque son radiactivas', 'Porque están muy profundas', 'Porque químicamente son casi idénticas', 'Porque se evaporan'], ok: 2, e: 'Dos vecinas difieren cerca de 1% en tamaño. Por eso hacen falta cientos de tanques en fila.' },
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
          const txt = 'Saqué ' + pts + '/' + QUIZ.length + ' en el quiz de tierras raras del Atlas de BB Finanzas. ¿Sabías que un caza F-35 lleva 417 kilos?';
          try {
            if (navigator.share) await navigator.share({ title: 'Ni tierras, ni raras', text: txt, url });
            else { await navigator.clipboard.writeText(txt + ' ' + url); $('#quiz-msg').textContent = 'Copiado. Pegalo donde quieras.'; }
            track('atlas_quiz_share', { cap: 'tierras', pts });
          } catch (e) { /* el usuario canceló */ }
        };
        track('atlas_quiz_fin', { cap: 'tierras', pts });
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
    tabla(); indice();
    cuandoSeAcerque('#usos', usos);
    cuandoSeAcerque('#iman', iman);
    cuandoSeAcerque('#separar', separar);
    cuandoSeAcerque('#mapa', mapa);
    cuandoSeAcerque('#embudo', embudo);
    cuandoSeAcerque('#defensa', defensa);
    cuandoSeAcerque('#canilla', canilla);
    cuandoSeAcerque('#salidas', salidas);
    cuandoSeAcerque('#mitos', mitos);
    cuandoSeAcerque('#quiz-sec', quiz);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
