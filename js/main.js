// FinCalc — main.js v8
window.__BB_MAIN_JS_VERSION = 'v8';

// GA4 is now loaded inline at the top of every <head> (per Google's recommendation).

// ============================================================
// FAVICON injection (so every page shows the BB logo in tab)
// ============================================================
(function injectFavicon() {
  if (document.querySelector('link[rel="icon"]')) return;
  // Path is relative to where the document lives. Pages under /pages/ need '../assets'.
  const inPages = location.pathname.includes('/pages/');
  const base = inPages ? '../assets/' : 'assets/';
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

  const inPages = location.pathname.includes('/pages/');
  const root = inPages ? '../' : '';
  const pagesBase = inPages ? '' : 'pages/';

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
        { href: pagesBase + 'comparador-cuentas.html',    label: 'Cuentas remuneradas',   icon: '💳' },
        { href: pagesBase + 'comparador-dolares.html',    label: 'Tipos de dólar',         icon: '💵' },
        { href: pagesBase + 'comparador-plazos-fijos.html', label: 'Plazos fijos',         icon: '🏦' },
        { href: pagesBase + 'contado-vs-cuotas.html',     label: 'Contado vs cuotas',      icon: '🛒' },
        { href: pagesBase + 'comparador-creditos-uva.html', label: 'Créditos UVA',          icon: '🏠' },
      ],
    },
    {
      kind: 'dropdown',
      title: 'Mercado',
      items: [
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
  `;
  target.appendChild(div);
})();

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
        <h3>Ayudame a comprarme una <em>acción de Apple</em> 🍎</h3>
        <p class="donation-sub">El sitio es y va a seguir siendo gratis y sin publicidad. Si te sirvió y querés colaborar, podés ayudarme con el valor de un café o el ladrillo de mi futura jubilación.</p>
      </div>
      <div class="donation-buttons">
        <a href="https://cafecito.app/bbfinancial" target="_blank" rel="noopener noreferrer" class="donation-btn cafecito">
          ☕ Invitame un cafecito
        </a>
        <a href="https://link.mercadopago.com.ar/bbfinancial" target="_blank" rel="noopener noreferrer" class="donation-btn mp">
          💛 Mercado Pago
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
  toggle.addEventListener('click', () => {
    const open = navEl.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
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
