// FinCalc — main.js v20
window.__BB_MAIN_JS_VERSION = 'v20';

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
// FAVICON injection (so every page shows the BB logo in tab)
// ============================================================
(function injectFavicon() {
  if (document.querySelector('link[rel="icon"]')) return;
  // Path is relative to where the document lives.
  const inBlog = location.pathname.includes('/blog/');
  const inPages = location.pathname.includes('/pages/');
  const base = inBlog ? '../../assets/' : (inPages ? '../assets/' : 'assets/');
  // Only JPG — browsers prefer SVG when both present and ours is the small old logo
  const links = [
    { rel: 'icon', type: 'image/jpeg', sizes: '512x512', href: base + 'favicon.jpg' },
    { rel: 'shortcut icon', type: 'image/jpeg', href: base + 'favicon.jpg' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: base + 'favicon.jpg' },
  ];
  links.forEach(l => {
    const link = document.createElement('link');
    Object.entries(l).forEach(([k, v]) => link.setAttribute(k, v));
    document.head.appendChild(link);
  });
})();

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
        { href: pagesBase + 'cuentas-remuneradas.html',label: 'Cuentas remuneradas', icon: '💳' },
        { href: pagesBase + 'cuanto-perdi.html',       label: '¿Cuánto perdí ahorrando?', icon: '🔥' },
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
        { href: pagesBase + 'contado-vs-cuotas.html',     label: 'Contado vs cuotas',      icon: '🛒' },
      ],
    },
    {
      kind: 'dropdown',
      title: 'Mercado',
      items: [
        { href: pagesBase + 'ranking-semanal.html', label: 'Ranking semanal 🔥', icon: '📊' },
        { href: pagesBase + 'ticker.html',     label: 'Acciones',     icon: '📈' },
        { href: pagesBase + 'mercado.html',    label: 'Mercado',      icon: '🌐' },
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
    {
      kind: 'link',
      href: pagesBase + 'proyectos.html',
      label: 'Proyectos',
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
        <span class="dd-icon">${it.icon || ''}</span>
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
  const footer = document.querySelector('.site-footer');
  if (!footer || footer.querySelector('.footer-contact')) return;
  const target = footer.querySelector('.footer-brand') || footer.querySelector('.footer-inner') || footer;
  const div = document.createElement('div');
  div.className = 'footer-contact';
  div.innerHTML = `
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

// Mobile menu toggle
const toggle = document.querySelector('.menu-toggle');
const navEl = document.querySelector('.main-nav');
if (toggle && navEl) {
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();   // prevent document handlers from interfering
    const open = navEl.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

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
