// FinCalc — main.js

// Mobile menu toggle
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
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

// ---- Dropdown nav ----
document.querySelectorAll('.nav-dropdown').forEach(dd => {
  const btn = dd.querySelector('.nav-dropdown-btn');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    // Close all others
    document.querySelectorAll('.nav-dropdown.open').forEach(other => {
      if (other !== dd) other.classList.remove('open');
    });
    dd.classList.toggle('open');
  });
});
document.addEventListener('click', () => {
  document.querySelectorAll('.nav-dropdown.open').forEach(dd => dd.classList.remove('open'));
});
