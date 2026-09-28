// FinCalc — main.js v22
window.__BB_MAIN_JS_VERSION = 'v22';

// ============================================================
// GLIFOS — íconos de las herramientas
// Un trazo blanco sobre un cuadrado de color con esquinas suaves, como los
// íconos de iOS: se reconocen de un vistazo y no dependen de cómo dibuje los
// emojis cada teléfono. Cada herramienta tiene el suyo según su archivo, así
// el mismo ícono aparece en el menú, el home y el listado de calculadoras.
// Si JavaScript no corre, quedan los emojis del HTML.
// ============================================================
var BB_TRAZOS = {
  subida:   '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  bajada:   '<path d="M3 7l6 6 4-4 8 8"/><path d="M14 17h7v-7"/>',
  banco:    '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  billetera:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M16 13h2"/><path d="M6 6V5a2 2 0 0 1 2-2h8"/>',
  casa:     '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  porcentaje:'<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  objetivo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  sol:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  maletin:  '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  tarjeta:  '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
  flecha:   '<path d="M7 17L17 7"/><path d="M8 7h9v9"/>',
  capas:    '<path d="M12 3L3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  torta:    '<path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  monedas:  '<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6"/><path d="M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6"/>',
  grilla:   '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  cambio:   '<path d="M17 3l4 4-4 4"/><path d="M3 11V9a2 2 0 0 1 2-2h16"/><path d="M7 21l-4-4 4-4"/><path d="M21 13v2a2 2 0 0 1-2 2H3"/>',
  reloj:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bono:     '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  dolar:    '<path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  enviar:   '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  brujula:  '<circle cx="12" cy="12" r="9"/><path d="M16 8l-2.5 5.5L8 16l2.5-5.5z"/>',
  recibo:   '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  balanza:  '<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>',
  lupa:     '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  diario:   '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
  calendario:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  globo:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>',
  libro:    '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21a2 2 0 0 1 2-2h13"/>',
  destello: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>',
  barras:   '<path d="M4 20V11M10 20V5M16 20v-7M2 20h20"/>',
  estrella: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  calculadora:'<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
};

// archivo → [trazo, color]. Paleta de sistema de Apple (modo oscuro).
var BB_GLIFO_DE = {
  'interes-compuesto': ['subida', '#30d158'],   'interes-simple': ['porcentaje', '#64d2ff'],
  'inflacion': ['bajada', '#ff453a'],            'comparador-plazos-fijos': ['banco', '#0a84ff'],
  'comparador-cuentas': ['billetera', '#5e5ce6'], 'cuentas-remuneradas': ['billetera', '#5e5ce6'],
  'comparador-creditos-uva': ['casa', '#ff9f0a'], 'prestamo': ['recibo', '#ff9f0a'],
  'meta-financiera': ['objetivo', '#ff375f'],     'fire': ['sol', '#ff9f0a'],
  'salario': ['maletin', '#64d2ff'],             'contado-vs-cuotas': ['tarjeta', '#bf5af2'],
  'roi': ['flecha', '#30d158'],                  'vpn': ['capas', '#5e5ce6'],
  'wacc': ['torta', '#bf5af2'],                  'ddm': ['monedas', '#ffb340'],
  'dividendos': ['monedas', '#30d158'],          'multiplos': ['grilla', '#0a84ff'],
  'guia-multiplos': ['libro', '#0a84ff'],        'markowitz': ['torta', '#64d2ff'],
  'conversion-tasas': ['cambio', '#0a84ff'],     'caucion': ['reloj', '#ff9f0a'],
  'renta-fija': ['bono', '#5e5ce6'],             'visor-bonos': ['bono', '#0a84ff'],
  'visor-bonos-ar': ['bono', '#64d2ff'],         'comparador-dolares': ['dolar', '#30d158'],
  'comparador-pix': ['enviar', '#64d2ff'],       'comparador-tasas': ['barras', '#0a84ff'],
  'test-inversor': ['brujula', '#bf5af2'],       'ticker': ['lupa', '#0a84ff'],
  'comparar': ['balanza', '#5e5ce6'],            'noticias': ['diario', '#ff453a'],
  'noticias-ticker': ['diario', '#ff453a'],      'calendario': ['calendario', '#ff453a'],
  'agenda-ar': ['calendario', '#ff9f0a'],        'mercado': ['globo', '#64d2ff'],
  'ranking-semanal': ['barras', '#30d158'],      'datos': ['barras', '#5e5ce6'],
  'empezar-a-invertir': ['destello', '#30d158'], 'conceptos': ['libro', '#ff9f0a'],
  'brokers': ['banco', '#8e8e93'],               'etfs-fci': ['torta', '#0a84ff'],
  'mis-portafolios': ['maletin', '#0a84ff'],     'watchlist': ['estrella', '#ffb340'],
  'calculadoras': ['calculadora', '#8e8e93'],
};

function bbGlifo(href) {
  var m = String(href || '').match(/([a-z0-9-]+)\.html/);
  var g = m && BB_GLIFO_DE[m[1]];
  if (!g) return '';
  return '<span class="bb-glifo" style="--g:' + g[1] + '" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + BB_TRAZOS[g[0]] + '</svg></span>';
}

// Tarjetas del HTML: el ícono de cada una sale del enlace que la contiene
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.cc-icon, .calc-hl-icon, .home-cta-icon, .atajos-calc span').forEach(function (el) {
    var a = el.closest('a[href]');
    var g = a && bbGlifo(a.getAttribute('href'));
    if (g) { el.innerHTML = g; el.classList.add('con-glifo'); }
  });
});


// ============================================================
// GA4 EVENTS — helper centralizado
// Uso: window.bbTrack('calculation_complete', { calc: 'cuotas' })
// ============================================================
window.bbTrack = function (eventName, params) {
  if (typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', eventName, params || {});
  } catch (e) { /* swallow — no romper UI por analytics */ }
};

// ============================================================
// GLOSARIO — tooltips para términos financieros
// Uso: <span data-term="MEP">Dólar MEP</span>
// Definiciones extensibles. Funciona con hover (desktop) y tap (mobile).
// ============================================================
window.BB_GLOSARIO = {
  'MEP':    { titulo: 'Dólar MEP', def: 'Forma legal de comprar dólares vía bolsa. Comprás un bono en pesos y lo vendés en dólares en BYMA, el mismo día. Lo hacés desde el broker (Cocos, IOL, Balanz...). Es la opción estándar para dolarizar ahorros.' },
  'CCL':    { titulo: 'Contado con Liqui (CCL)', def: 'Igual que el MEP pero el dólar te queda en una cuenta en el exterior (típicamente en USA). Útil si querés sacar plata del país legalmente.' },
  'TNA':    { titulo: 'TNA — Tasa Nominal Anual', def: 'Es la tasa "anual" pero sin contar el interés compuesto. Si dice "TNA 30%" y la cuenta paga todos los días, en realidad al final del año tenés más del 30% (por la reinversión diaria). La TNA es la tasa "publicitada"; la TEA es la real.' },
  'TEA':    { titulo: 'TEA — Tasa Efectiva Anual', def: 'La tasa anual REAL que rinde una inversión, considerando que los intereses se reinvierten. Siempre es mayor que la TNA. Es la que te conviene mirar para comparar inversiones distintas (plazo fijo vs FCI vs cuenta remunerada).' },
  'TEM':    { titulo: 'TEM — Tasa Efectiva Mensual', def: 'El interés que rinde una inversión en un mes. Por ejemplo, TEM 2.5% significa que tu plata crece 2.5% cada mes. Si la reinvertís 12 meses, llegás a la TEA.' },
  'CFTEA':  { titulo: 'CFTEA — Costo Financiero Total Efectivo Anual', def: 'En préstamos, es la tasa REAL que pagás incluyendo TODOS los costos: interés, seguros, comisiones, gastos administrativos, IVA. Es lo único que sirve para comparar entre bancos — no la TNA.' },
  'CFT':    { titulo: 'CFT — Costo Financiero Total', def: 'Similar al CFTEA pero sin "anualizar" con interés compuesto. Incluye interés + seguros + comisiones del préstamo.' },
  'IPC':    { titulo: 'IPC — Índice de Precios al Consumidor', def: 'El número que mide la inflación. Lo publica el INDEC cada mes (alrededor del día 15). Por ejemplo, IPC 3.4% en marzo significa que los precios en promedio subieron 3.4% ese mes.' },
  'FCI':    { titulo: 'FCI — Fondo Común de Inversión', def: 'Una "canasta" con muchas inversiones adentro (plazos fijos, bonos, acciones, etc.) gestionada por profesionales. Vos comprás una cuotaparte y participás de todas. Mínimo $1, rescate en T+0/T+1/T+2 según el tipo.' },
  'ALYC':   { titulo: 'ALYC — Agente de Liquidación y Compensación', def: 'Es el nombre técnico de los brokers en Argentina. Empresas autorizadas por la CNV para ejecutar tus órdenes en BYMA. Ejemplos: Cocos, IOL Invertironline, Balanz, Bull Market.' },
  'BYMA':   { titulo: 'BYMA — Bolsas y Mercados Argentinos', def: 'La bolsa de valores de Argentina. Donde se compran y venden las acciones, bonos, CEDEARs. No operás directamente — vas a través de un broker (ALYC).' },
  'FGD':    { titulo: 'FGD — Fondo de Garantía de Depósitos', def: 'Sistema que protege los depósitos bancarios en Argentina. Si quiebra tu banco, te devuelven hasta $1.140.000 por persona (May 2026). Cubre cajas de ahorro, cuentas corrientes y plazos fijos. NO cubre FCI ni billeteras virtuales.' },
  'CER':    { titulo: 'CER — Coeficiente de Estabilización de Referencia', def: 'Índice diario que sigue la inflación argentina. Lo publica el BCRA. Es la base del UVA y de muchos bonos "ajustables por inflación".' },
  'UVA':    { titulo: 'UVA — Unidad de Valor Adquisitivo', def: 'Una "moneda" creada por el BCRA en 2016 que se actualiza diariamente con la inflación (CER). Se usa para créditos hipotecarios: la deuda se mide en UVAs, no en pesos, así siempre debés lo mismo en términos reales.' },
  'BADLAR': { titulo: 'BADLAR', def: 'Tasa que pagan los bancos privados por depósitos de más de $1 millón a 30-35 días. Es la referencia del sistema financiero y la base sobre la que cada banco fija sus TNAs de plazo fijo.' },
  'CEDEAR': { titulo: 'CEDEAR — Certificado de Depósito Argentino', def: 'Te permite comprar acciones extranjeras (Apple, Tesla, Google...) desde Argentina, en pesos. Cada CEDEAR representa una fracción de la acción real. Cotizan en BYMA, los comprás vía tu broker.' },
  'CNV':    { titulo: 'CNV — Comisión Nacional de Valores', def: 'Organismo del Estado que regula el mercado de capitales argentino. Autoriza brokers, FCI, sociedades gerentes, asesores. Si alguien no figura en su registro, no es legal.' },
  'BCRA':   { titulo: 'BCRA — Banco Central de la República Argentina', def: 'El banco central. Define la política monetaria, fija tasas de referencia, regula los bancos, administra las reservas en dólares.' },
  'INDEC':  { titulo: 'INDEC — Instituto Nacional de Estadística y Censos', def: 'Organismo oficial que mide la inflación (IPC), la pobreza, el PBI y otras estadísticas del país.' },
  'TIR':    { titulo: 'TIR — Tasa Interna de Retorno', def: 'La tasa anual que rinde una inversión considerando todos los flujos futuros (cuotas, cupones, etc.) descontados al presente. En bonos, te dice cuánto rinde si lo comprás hoy y lo mantenés hasta el vencimiento.' },
  'PBI':    { titulo: 'PBI — Producto Bruto Interno', def: 'Valor de todos los bienes y servicios producidos en un país durante un año. Es la medida más común para hablar del "tamaño" de una economía.' },
  'EMBI':   { titulo: 'EMBI+ — Riesgo País', def: 'Lo calcula JP Morgan. Mide cuánta tasa "extra" debe pagar Argentina sobre los bonos de EE.UU. para compensar el riesgo de no pagar. Se mide en "puntos básicos" (100 pb = 1%). Hoy ~525 pb significa que Argentina paga ~5.25% más que el Tesoro de EE.UU.' },
  'AL30':   { titulo: 'AL30', def: 'Bono del Estado argentino en dólares con vencimiento en 2030, ley argentina. Es de los más operados, se usa para hacer dólar MEP y CCL.' },
  'GD30':   { titulo: 'GD30', def: 'Bono del Estado argentino en dólares con vencimiento en 2030, ley NEW YORK. Como tiene jurisdicción de EE.UU., los inversores lo consideran "más seguro" que el AL30 — paga una tasa un poco menor.' },
  'ON':     { titulo: 'ON — Obligación Negociable', def: 'Son bonos emitidos por EMPRESAS (no el Estado). Ej: una ON de YPF, Pampa, Vista. Funcionan como un préstamo: vos le prestás plata a la empresa y ella te paga interés.' },
  'LECAP':  { titulo: 'LECAP — Letra Capitalizable', def: 'Letra del Tesoro argentino en pesos a corto plazo (típicamente 30-90 días). El interés se capitaliza diariamente. Es uno de los instrumentos de renta fija en pesos más populares.' },
  'T+0':    { titulo: 'T+0 — Liquidación inmediata', def: '"Hoy mismo". Si vendés algo en T+0, la plata te queda disponible para retirar el mismo día. Las cuentas remuneradas y muchos FCI money market rescatan T+0.' },
  'T+1':    { titulo: 'T+1 — Liquidación al día siguiente', def: 'Si vendés hoy, la plata te queda disponible mañana hábil. Es el plazo típico para bonos en pesos y muchos FCI de renta fija.' },
  'T+2':    { titulo: 'T+2 — Liquidación a 2 días', def: 'Si vendés hoy, la plata te queda disponible en 2 días hábiles. Es el plazo típico de acciones, CEDEARs, bonos en dólares.' },
  'DCA':    { titulo: 'DCA — Dollar Cost Averaging', def: 'Estrategia de invertir un monto fijo todos los meses (ej: $50.000 cada 1ro de mes), sin importar el precio. Neutraliza el riesgo de "comprar caro" y suaviza la volatilidad. Es lo más recomendado para principiantes.' },
  'ETF':    { titulo: 'ETF — Exchange Traded Fund', def: 'Un fondo que cotiza en bolsa como una acción. Adentro tiene muchas inversiones (las 500 empresas de EE.UU. en el caso del SPY, por ejemplo). Comprás "una sola cosa" y diversificás en cientos.' },
  'BCBA':   { titulo: 'BCBA — Bolsa de Comercio de Buenos Aires', def: 'La institución histórica de la bolsa argentina. Hoy la operatoria se hace a través de BYMA, pero la BCBA sigue existiendo como entidad.' },
};

// Inyecta tooltip cuando hay <span data-term="...">
(function initGlossary() {
  // CSS tooltip
  if (!document.getElementById('bb-glossary-styles')) {
    const s = document.createElement('style');
    s.id = 'bb-glossary-styles';
    s.textContent = `
      [data-term] { border-bottom: 1px dotted rgba(74,222,154,0.6); cursor: help; position: relative; }
      .bb-tooltip { position: fixed; z-index: 1000;
        background: #0a0c0f; border: 1px solid rgba(74,222,154,0.35); border-radius: 8px;
        padding: 0.7rem 0.85rem; width: 280px; max-width: calc(100vw - 16px); font-size: 0.8rem; color: #e8edf5;
        line-height: 1.55; box-shadow: 0 12px 32px rgba(0,0,0,0.5); pointer-events: auto;
        font-family: 'Outfit', sans-serif; font-weight: 400; text-transform: none; letter-spacing: 0; }
      .bb-tooltip strong { color: #4ade9a; display: block; font-family: 'DM Serif Display', serif; font-size: 0.9rem; margin-bottom: 0.3rem; letter-spacing: -0.01em; }
      @media (max-width: 600px) {
        .bb-tooltip { width: min(280px, calc(100vw - 16px)); font-size: 0.78rem; }
      }
    `;
    document.head.appendChild(s);
  }

  let openTip = null;
  function close() { if (openTip) { openTip.remove(); openTip = null; } }
  function show(el) {
    close();
    const term = el.dataset.term;
    const g = window.BB_GLOSARIO[term];
    if (!g) return;
    // GA4 event — tooltip_view
    window.bbTrack && window.bbTrack('tooltip_view', { term });
    const t = document.createElement('div');
    t.className = 'bb-tooltip';
    t.innerHTML = `<strong>${g.titulo}</strong>${g.def}`;
    document.body.appendChild(t);
    openTip = t;
    // Position relative to viewport — anchor to the term element, clamp to viewport edges
    const er = el.getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    let top = er.top - tr.height - 8; // above
    let placeBelow = false;
    if (top < 8) { top = er.bottom + 8; placeBelow = true; } // flip if no room above
    let left = er.left + (er.width / 2) - (tr.width / 2);
    if (left < 8) left = 8;
    if (left + tr.width > innerWidth - 8) left = innerWidth - tr.width - 8;
    t.style.top = top + 'px';
    t.style.left = left + 'px';
    t._anchor = el;
    t._placeBelow = placeBelow;
  }
  // Reposition on scroll/resize while open
  window.addEventListener('scroll', () => { if (openTip && openTip._anchor) reposition(openTip); }, true);
  window.addEventListener('resize', () => { if (openTip && openTip._anchor) reposition(openTip); });
  function reposition(t) {
    const el = t._anchor; if (!el || !el.isConnected) { close(); return; }
    const er = el.getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    let top = er.top - tr.height - 8;
    if (top < 8) top = er.bottom + 8;
    let left = er.left + (er.width / 2) - (tr.width / 2);
    if (left < 8) left = 8;
    if (left + tr.width > innerWidth - 8) left = innerWidth - tr.width - 8;
    t.style.top = top + 'px';
    t.style.left = left + 'px';
  }

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-term]');
    if (el) show(el);
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('[data-term]')) close();
  });
  // Mobile tap
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-term]');
    if (el) {
      e.preventDefault();
      if (openTip && openTip.parentElement === el) close();
      else show(el);
    } else {
      close();
    }
  });
})();

// GA4 is now loaded inline at the top of every <head> (per Google's recommendation).

// ============================================================
// MAIN NAV — single source of truth, audience-based dropdowns
// Replaces the static <nav class="main-nav"> on every page so
// we don't have to edit 35 HTML files when nav changes.
// ============================================================
(function buildNav() {
  const nav = document.querySelector('.main-nav');
  if (!nav) return;

  const inBlog = location.pathname.includes('/blog/');
  const inPages = location.pathname.includes('/pages/');
  const root = inBlog ? '../../' : (inPages ? '../' : '');
  const pagesBase = inBlog ? '../' : (inPages ? '' : 'pages/');

  // Helper: build a dropdown { title, items: [{href, label, icon}] }
  const groups = [
    {
      kind: 'link',
      href: root + 'index.html',
      label: 'Inicio',
      match: ['index.html', '/'],
    },
    {
      kind: 'dropdown',
      title: 'Nuevos Inversores',
      highlight: true,
      items: [
        { href: pagesBase + 'empezar-a-invertir.html', label: 'Empezar a Invertir', icon: '🚀' },
        { href: pagesBase + 'conceptos.html',          label: 'Conceptos básicos',  icon: '📖' },
        { href: pagesBase + 'brokers.html',            label: 'Brokers Argentina',  icon: '🏦' },
        { href: pagesBase + 'renta-fija.html',         label: 'Renta Fija',          icon: '📜' },
        { href: pagesBase + 'etfs-fci.html',           label: 'ETFs y FCI',          icon: '💎' },
        { href: pagesBase + 'comparador-plazos-fijos.html', label: 'Calculadora de plazo fijo', icon: '💰' },
        { href: pagesBase + 'cuentas-remuneradas.html',label: 'Cuentas remuneradas', icon: '💳' },
        { href: pagesBase + 'comparador-dolares.html', label: 'Tipos de dólar',           icon: '💵' },
      ],
    },
    {
      kind: 'dropdown',
      title: 'Herramientas',
      items: [
        { href: pagesBase + 'calculadoras.html',      label: 'Todas las calculadoras', icon: '🧮' },
        { href: pagesBase + 'interes-compuesto.html', label: 'Interés Compuesto',      icon: '📈' },
        { href: pagesBase + 'interes-simple.html',    label: 'Interés Simple',         icon: '📊' },
        { href: pagesBase + 'meta-financiera.html',   label: 'Meta Financiera',        icon: '🎯' },
        { href: pagesBase + 'prestamo.html',          label: 'Préstamo',                icon: '💰' },
        { href: pagesBase + 'inflacion.html',         label: 'Inflación',               icon: '📉' },
        { href: pagesBase + 'salario.html',           label: 'Salario',                 icon: '💵' },
        { href: pagesBase + 'conversion-tasas.html',  label: 'Conversión de Tasas',    icon: '🔄' },
        { href: pagesBase + 'roi.html',               label: 'ROI',                     icon: '📊' },
        { href: pagesBase + 'fire.html',              label: 'FIRE',                    icon: '🔥' },
        { href: pagesBase + 'vpn.html',               label: 'VPN',                     icon: '💎' },
        { href: pagesBase + 'caucion.html',           label: 'Caución',                 icon: '⚡' },
      ],
    },
    {
      kind: 'dropdown',
      title: 'Comparadores',
      items: [
        { href: pagesBase + 'comparador-tasas.html',  label: 'Comparador de Tasas',  icon: '📊' },
        { href: pagesBase + 'comparador-pix.html',    label: 'Comparador PIX 🇧🇷',  icon: '💸' },
        { href: pagesBase + 'contado-vs-cuotas.html', label: 'Contado vs cuotas',    icon: '🛒' },
      ],
    },
    {
      kind: 'dropdown',
      title: 'Mercado',
      items: [
        { href: pagesBase + 'agenda-ar.html',  label: 'Agenda AR 🇦🇷', icon: '📅' },
        { href: pagesBase + 'ranking-semanal.html', label: 'Ranking semanal 🔥', icon: '📊' },
        { href: pagesBase + 'ticker.html',     label: 'Acciones',     icon: '📈' },
        { href: pagesBase + 'mercado.html',    label: 'Mercado',      icon: '🌐' },
        { href: pagesBase + 'visor-bonos.html',label: 'Visor de Bonos USA', icon: '💵' },
        { href: pagesBase + 'visor-bonos-ar.html', label: 'Visor de Bonos AR 🇦🇷', icon: '🇦🇷' },
        { href: pagesBase + 'calendario.html', label: 'Calendario',   icon: '📅' },
        { href: pagesBase + 'noticias.html',   label: 'Noticias',     icon: '📰' },
        { href: pagesBase + 'datos.html',      label: 'Datos macro',  icon: '📊' },
        { href: pagesBase + 'dividendos.html', label: 'Dividendos',   icon: '💸' },
      ],
    },
    {
      kind: 'dropdown',
      title: 'Avanzado',
      items: [
        { href: pagesBase + 'guia-multiplos.html', label: 'Guía de Múltiplos', icon: '📘' },
        { href: pagesBase + 'multiplos.html',      label: 'Múltiplos',          icon: '🔢' },
        { href: pagesBase + 'ddm.html',            label: 'DDM',                icon: '📐' },
        { href: pagesBase + 'wacc.html',           label: 'WACC',               icon: '⚖️' },
        { href: pagesBase + 'markowitz.html',      label: 'Markowitz',          icon: '🎲' },
        { href: pagesBase + 'mis-portafolios.html',label: 'Portafolio',         icon: '💼', beta: true },
      ],
    },
    {
      kind: 'link',
      href: pagesBase + 'blog/index.html',
      label: 'Blog',
    },
    // "Proyectos" queda fuera del menu hasta que haya modelos publicados: hoy
    // lleva a un "Proximamente" y solo carga la barra. La pagina sigue existiendo
    // y accesible por URL; para volver a mostrarla, descomentar el bloque de abajo.
    // {
    //   kind: 'link',
    //   href: pagesBase + 'proyectos.html',
    //   label: 'Proyectos',
    // },
    {
      kind: 'link',
      href: pagesBase + 'sobre-el-proyecto.html',
      label: 'Sobre el proyecto',
      extraClass: 'nav-proyectos',
    },
  ];

  const currentFile = location.pathname.split('/').pop() || 'index.html';

  const isActive = (href) => {
    const file = href.split('/').pop();
    return file === currentFile;
  };

  const html = groups.map(g => {
    if (g.kind === 'link') {
      const active = (g.match || []).some(m => currentFile === m || (m === '/' && currentFile === '')) || isActive(g.href);
      return `<a href="${g.href}" class="nav-link${active ? ' active' : ''}${g.extraClass ? ' ' + g.extraClass : ''}">${g.label}</a>`;
    }
    // dropdown
    const anyActive = g.items.some(it => isActive(it.href));
    const itemsHtml = g.items.map(it => `
      <a href="${it.href}" class="${isActive(it.href) ? 'active' : ''}">
        <span class="dd-icon">${bbGlifo(it.href) || it.icon || ''}</span>
        <span>${it.label}${it.beta ? ' <span class="beta-badge">Beta</span>' : ''}</span>
      </a>`).join('');
    const btnStyle = g.highlight ? ' style="color:#4ade9a"' : '';
    return `
      <div class="nav-dropdown${anyActive ? ' has-active' : ''}">
        <button class="nav-dropdown-btn${anyActive ? ' has-active' : ''}"${btnStyle} aria-haspopup="true" aria-expanded="false">
          ${g.title}<span class="dd-arrow">▼</span>
        </button>
        <div class="nav-dropdown-menu" role="menu">
          ${itemsHtml}
        </div>
      </div>`;
  }).join('');

  nav.innerHTML = html;
})();

// ============================================================
// FOOTER CONTACT — inject email/contact block in every footer
// ============================================================
(function injectFooterContact() {
  const inBlog = location.pathname.includes('/blog/');
  const inPages = location.pathname.includes('/pages/');
  const root = inBlog ? '../../' : (inPages ? '../' : '');
  const footer = document.querySelector('.site-footer');
  if (!footer || footer.querySelector('.footer-contact')) return;
  const target = footer.querySelector('.footer-brand') || footer.querySelector('.footer-inner') || footer;
  const div = document.createElement('div');
  div.className = 'footer-contact';
  div.innerHTML = `
    <span class="footer-contact-label">El proyecto</span>
    <a href="${root}pages/sobre-el-proyecto.html">👤 Quién está detrás de BB Financial</a>
        <span class="footer-contact-label">Contacto</span>
    <a href="mailto:bb.financial10@gmail.com">📧 bb.financial10@gmail.com</a>
    <a href="https://www.linkedin.com/in/bruno-behr-9647b6217/" target="_blank" rel="noopener noreferrer">💼 LinkedIn — Bruno Behr</a>
  `;
  target.appendChild(div);
})();

// ============================================================
// GLOBAL EVENT LISTENERS — calc, share, donate, faq
// ============================================================
// Track "Calcular" button clicks per page (calculation_complete)
document.addEventListener('click', (e) => {
  const calcBtn = e.target.closest('button.btn.btn-primary');
  if (calcBtn && /calcular/i.test(calcBtn.textContent)) {
    // derive calc name from page path
    const path = location.pathname.split('/').pop().replace('.html', '');
    window.bbTrack && window.bbTrack('calculation_complete', { calc: path });
  }
});

document.addEventListener('click', (e) => {
  // Donate click
  const donateBtn = e.target.closest('.donation-btn');
  if (donateBtn) {
    const platform = donateBtn.classList.contains('cafecito') ? 'cafecito'
                   : donateBtn.classList.contains('mp') ? 'mercadopago' : 'other';
    window.bbTrack && window.bbTrack('donate_click', { platform });
  }
  // Share click (calcs)
  const shareBtn = e.target.closest('.share-btn');
  if (shareBtn) {
    const id = shareBtn.id || 'unknown';
    const channel = id.includes('twitter') ? 'twitter' : id.includes('whatsapp') ? 'whatsapp' : id.includes('link') ? 'copy' : 'other';
    window.bbTrack && window.bbTrack('share_click', { channel, page: location.pathname });
  }
});

// FAQ open tracking (<details class="faq-item">)
document.addEventListener('toggle', (e) => {
  const det = e.target;
  if (det && det.classList && det.classList.contains('faq-item') && det.open) {
    const q = (det.querySelector('summary')?.textContent || '').trim().slice(0, 60);
    window.bbTrack && window.bbTrack('faq_open', { question: q, page: location.pathname });
  }
  // use-guide open (calculadora "¿Cómo se usa?")
  if (det && det.classList && det.classList.contains('use-guide') && det.open) {
    window.bbTrack && window.bbTrack('guide_open', { page: location.pathname });
  }
}, true);

// ============================================================
// DONATIONS — finance-themed creative copy block above footer
// ============================================================
(function injectDonations() {
  const footer = document.querySelector('.site-footer');
  if (!footer || document.querySelector('.donation-strip')) return;
  // Skip on the donation-only page itself if we make one later
  const div = document.createElement('section');
  div.className = 'donation-strip';
  div.innerHTML = `
    <div class="container donation-inner">
      <div class="donation-text">
        <p class="donation-eyebrow">¿Te sirvió esta herramienta?</p>
        <h3>Sé mi <em>inversionista ángel</em> 👼📈</h3>
        <p class="donation-sub">El sitio es y va a seguir siendo gratis y sin publicidad. Si te sirvió, sumate con el valor de un café — me ayudás a mantenerlo vivo y a sumar más herramientas.</p>
      </div>
      <div class="donation-buttons">
        <a href="https://cafecito.app/bb-financial" target="_blank" rel="noopener noreferrer" class="donation-btn cafecito">
          ☕ Invitame un cafecito
        </a>
      </div>
    </div>
  `;
  footer.parentNode.insertBefore(div, footer);
})();

// ============================================================
// MENÚ MOBILE
// Antes sólo alternaba una clase: no se cerraba tocando afuera, no respondía
// a Escape, el fondo seguía scrolleando y no había forma de saber que el botón
// también cerraba. Acá agregamos backdrop, bloqueo de scroll y cierre por
// link / afuera / Escape.
// ============================================================
(function menuMobile() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (!toggle || !nav) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'nav-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.appendChild(backdrop);

  let scrollY = 0;

  function abrir() {
    scrollY = window.scrollY;
    nav.classList.add('open');
    backdrop.classList.add('show');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Cerrar menú');
    // Bloquea el scroll del fondo sin perder la posición al cerrar
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
  }

  function cerrar() {
    if (!nav.classList.contains('open')) return;
    nav.classList.remove('open');
    backdrop.classList.remove('show');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menú');
    nav.querySelectorAll('.nav-dropdown.open').forEach(dd => {
      dd.classList.remove('open');
      const b = dd.querySelector('.nav-dropdown-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  }

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    nav.classList.contains('open') ? cerrar() : abrir();
  });

  backdrop.addEventListener('click', cerrar);

  // Elegir un destino cierra el menú (importante cuando el link es un ancla
  // de la misma página y no hay navegación que lo cierre sola)
  nav.addEventListener('click', e => {
    if (e.target.closest('a')) cerrar();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrar();
  });

  // Si se pasa a desktop con el menú abierto, hay que soltar el scroll
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1100) cerrar();
  });

  window.__cerrarMenuMobile = cerrar;
})();

// Card spotlight effect
document.querySelectorAll('.tool-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mx', `${x}%`);
    card.style.setProperty('--my', `${y}%`);
  });
});

// Animate stats on scroll (hero)
const observerCb = (entries, obs) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      obs.unobserve(entry.target);
    }
  });
};
const io = new IntersectionObserver(observerCb, { threshold: 0.1 });
document.querySelectorAll('.tool-card, .stat, .why-text').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  io.observe(el);
});

// Format numbers with thousand separators (Spanish)
window.formatUSD = (n) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

window.formatYears = (months) => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mes${m !== 1 ? 'es' : ''}`;
  if (m === 0) return `${y} año${y !== 1 ? 's' : ''}`;
  return `${y} año${y !== 1 ? 's' : ''} y ${m} mes${m !== 1 ? 'es' : ''}`;
};

// ---- Dropdown nav interactions ----
document.querySelectorAll('.nav-dropdown').forEach(dd => {
  const btn = dd.querySelector('.nav-dropdown-btn');
  if (!btn) return;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelectorAll('.nav-dropdown.open').forEach(other => {
      if (other !== dd) other.classList.remove('open');
    });
    dd.classList.toggle('open');
    btn.setAttribute('aria-expanded', dd.classList.contains('open'));
  });
});
document.addEventListener('click', () => {
  document.querySelectorAll('.nav-dropdown.open').forEach(dd => {
    dd.classList.remove('open');
    const b = dd.querySelector('.nav-dropdown-btn');
    if (b) b.setAttribute('aria-expanded', 'false');
  });
});

// ============================================================
// TABLAS EN MOBILE
// En pantalla angosta una tabla obliga a scrollear de costado y se pierde de
// vista a qué fila corresponde cada número. Acá cada fila pasa a ser una
// tarjeta con "etiqueta: valor", tomando las etiquetas del propio <thead>.
// Las tablas anchas o de matriz (más de 6 columnas, celdas combinadas, sin
// encabezado) no se convierten: se dejan con scroll horizontal, pero con una
// sombra al borde que avisa que hay más contenido a la derecha.
// ============================================================
(function tablasMobile() {
  const MAX_COLUMNAS = 10;   // más que esto ya no entra ni como tarjeta
  const MAX_FILAS = 40;      // planillas largas (amortización) se recorren mejor scrolleando

  function encabezados(tabla) {
    const filaTh = tabla.querySelector('thead tr');
    if (!filaTh) return null;
    const ths = [...filaTh.children].filter(c => c.tagName === 'TH' || c.tagName === 'TD');
    if (!ths.length) return null;
    if (ths.some(th => th.colSpan > 1)) return null;
    return ths.map(th => th.textContent.trim());
  }

  function apta(tabla, labels) {
    if (!labels || labels.length < 2 || labels.length > MAX_COLUMNAS) return false;
    if (tabla.hasAttribute('data-no-cards')) return false;
    const filas = tabla.querySelectorAll('tbody tr');
    if (!filas.length || filas.length > MAX_FILAS) return false;
    // Una matriz (correlaciones) tiene tantas columnas como filas: como tarjetas
    // no se entiende, conviene dejarla con scroll.
    if (labels.length > filas.length) return false;
    const celdas = tabla.querySelectorAll('tbody td');
    if (!celdas.length) return false;
    for (const td of celdas) if (td.colSpan > 1 || td.rowSpan > 1) return false;
    return true;
  }

  function envolver(tabla) {
    if (tabla.parentElement && tabla.parentElement.classList.contains('tbl-wrap')) return;
    // Respetamos los contenedores con scroll que ya existían en las páginas
    const padre = tabla.parentElement;
    if (padre && padre.tagName === 'DIV' && /auto|scroll/.test(getComputedStyle(padre).overflowX)) {
      padre.classList.add('tbl-wrap');
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'tbl-wrap';
    tabla.parentNode.insertBefore(wrap, tabla);
    wrap.appendChild(tabla);
  }

  function procesar(tabla) {
    envolver(tabla);
    const labels = encabezados(tabla);
    // Se reevalúa en cada pasada: al principio la tabla puede tener sólo una fila
    // de "Cargando…" con colspan y recién después llegar los datos reales.
    if (!apta(tabla, labels)) {
      tabla.classList.add('tbl-scroll');
      tabla.classList.remove('tbl-cards');
      return;
    }
    tabla.classList.remove('tbl-scroll');
    tabla.querySelectorAll('tbody tr').forEach(tr => {
      [...tr.children].forEach((td, i) => {
        if (labels[i] && !td.hasAttribute('data-label')) td.setAttribute('data-label', labels[i]);
      });
    });
    tabla.classList.add('tbl-cards');
  }

  function pasada() {
    document.querySelectorAll('table').forEach(t => {
      try { procesar(t); } catch (e) { /* una tabla rara no debe romper la página */ }
    });
  }

  pasada();

  // Muchas tablas se arman después, con datos de las APIs
  let pendiente = null;
  const obs = new MutationObserver(muts => {
    if (!muts.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.tagName === 'TABLE' || n.querySelector?.('table') || n.tagName === 'TR')))) return;
    clearTimeout(pendiente);
    pendiente = setTimeout(pasada, 120);
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// ============================================================
// "CALCULAR" EN MOBILE
// En escritorio el panel de resultados esta al lado del formulario, asi que
// apretar Calcular muestra el numero al instante. En un telefono los paneles
// se apilan y el resultado queda ~650px mas abajo: la calculadora responde
// bien pero parece rota, porque no cambia nada de lo que se ve.
// Al tocar el boton llevamos la vista al resultado.
// ============================================================
(function calcularScrollMobile() {
  document.addEventListener('click', ev => {
    if (!window.matchMedia('(max-width: 900px)').matches) return;

    const boton = ev.target.closest('.input-panel .btn-primary');
    if (!boton) return;

    // El panel de resultados que corresponde a ESTE formulario: el primero que
    // aparece despues en la pagina. No alcanza con mirar el hermano siguiente
    // porque cada panel suele venir envuelto en su propia <section>, y hay
    // paginas (conversion de tasas, renta fija) con varios bloques.
    const panel = boton.closest('.input-panel');
    const destino = [...document.querySelectorAll('.result-panel')].find(r =>
      r.offsetParent !== null &&   // en las paginas con pestañas hay paneles ocultos
      (panel.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
    if (!destino) return;

    // Despues del calculo, para que el alto ya sea el definitivo
    setTimeout(() => {
      const nav = document.querySelector('.site-header');
      const y = destino.getBoundingClientRect().top + window.scrollY - ((nav ? nav.offsetHeight : 0) + 12);
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, 60);
  });
})();

// ============================================================
// APARICION AL SCROLLEAR
// Los bloques que arrancan debajo del pliegue suben y aparecen cuando entran
// en pantalla, de a uno si llegan juntos. Lo que ya se ve al cargar no se toca:
// animarlo demoraria el primer pintado sin que nadie lo note como transicion.
// Si falta IntersectionObserver o el usuario pidio menos movimiento, no pasa
// nada y todo se ve como siempre.
// ============================================================
(function revelar() {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Los rastreadores sacan una foto de la pagina: que no la saquen a mitad de un fundido
  if (/bot|crawl|spider|lighthouse/i.test(navigator.userAgent)) return;

  const SEL = '.calc-card, .home-cta, .concept-card, .blog-card, .faq-item, .info-box, .example-box, ' +
    '.formula-box, .chart-section, .step-section, .article-cta, .compare-card, .stat-card, ' +
    '.example-card, .chart-card, .mult-card, .macro-card, .calc-hl, .related-reads li, main h2';

  const alto = window.innerHeight;
  const bloques = [...document.querySelectorAll(SEL)].filter(el =>
    !el.parentElement.closest(SEL) &&            // uno adentro de otro animaria dos veces
    el.getBoundingClientRect().top > alto);

  const io = new IntersectionObserver(entradas => {
    let orden = 0;
    entradas.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      io.unobserve(el);
      el.style.transitionDelay = Math.min(orden++, 5) * 70 + 'ms';
      el.classList.add('bb-visible');
      // Al terminar se sacan las clases para que vuelvan los hover de cada tarjeta
      setTimeout(() => {
        el.classList.remove('bb-reveal', 'bb-visible');
        el.style.transitionDelay = '';
      }, 1300);
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  bloques.forEach(el => { el.classList.add('bb-reveal'); io.observe(el); });
})();

// ============================================================
// MEDICION DE USO (para iterar el diseño con datos, no a ojo)
// Tres preguntas que Google Analytics no contesta solo:
//   - hasta dónde baja la gente en cada página (25/50/75/100%)
//   - si llega a tocar la calculadora o se va antes
//   - qué tarjeta o acceso eligió para entrar a una herramienta
// Todo va por window.bbTrack; si GA no cargó, no pasa nada.
// ============================================================
(function medirUso() {
  var pagina = location.pathname.replace(/^.*\//, '') || 'index.html';

  var marcas = [25, 50, 75, 100], vistas = {};
  function scroll() {
    var alto = document.documentElement.scrollHeight - innerHeight;
    if (alto <= 0) return;
    var pct = (scrollY / alto) * 100;
    marcas.forEach(function (m) {
      if (pct >= m - 1 && !vistas[m]) { vistas[m] = 1; window.bbTrack('scroll_profundidad', { pagina: pagina, porcentaje: m }); }
    });
  }
  addEventListener('scroll', function () { clearTimeout(scroll.t); scroll.t = setTimeout(scroll, 250); }, { passive: true });

  var t0 = performance.now(), usada = false;
  document.addEventListener('input', function (e) {
    if (usada || !e.target.closest('main')) return;
    usada = true;
    window.bbTrack('calculadora_usada', { pagina: pagina, segundos_hasta_usar: Math.round((performance.now() - t0) / 1000) });
  }, true);

  document.addEventListener('click', function (e) {
    var a = e.target.closest('.calc-card, .calc-hl, .home-cta, .hero-stats.hoy .stat, .atajos-calc a, .hero-cta a');
    if (!a) return;
    window.bbTrack('select_content', { content_type: a.className.split(' ')[0], item_id: a.getAttribute('href'), pagina: pagina });
  });
})();
