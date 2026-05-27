// Widget compartido de tasas en vivo.
// Uso: <div data-tasas-widget="cuentas|fci-mm" data-limit="5"></div>
// Carga datos desde /api/argentinadatos y muestra top-N por TNA.

(function () {
  // Escape HTML para prevenir XSS en strings provenientes de APIs externas
  const esc = (s) => (window.escHtml ? window.escHtml(s) : String(s ?? '').replace(/[&<>"'/]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;'})[c]));

  const EMOJI = {
    'NARANJA X': '🟠', 'UALA': '💜', 'BRUBANK': '🏦', 'BNA': '🏛',
    'CARREFOUR BANCO': '🛒', 'CRESIUM': '🔷', 'FIWIND': '🌬',
    'BELO': '🔵', 'PREX': '💚', 'ASTROPAY': '🚀',
    'MERCADO FONDO': '💙', 'PERSONAL PAY': '💛', 'MONTEMAR PAY': '🟢',
    'COCOS': '🥥', 'LEMON': '🍋', 'SUPERVIELLE': '🔶', 'IBANK': '🏦',
  };

  const MAX_DAYS_STALE = 60;

  function daysAgo(fecha) {
    if (!fecha) return Infinity;
    const d = new Date(fecha);
    if (isNaN(d)) return Infinity;
    return (Date.now() - d.getTime()) / 86400000;
  }

  function teaFromTna(tnaPct) {
    const tem = (tnaPct / 100) / 12;
    return (Math.pow(1 + tem, 12) - 1) * 100;
  }

  function titleCaseBilletera(s) {
    if (!s) return '';
    const upper = s.toUpperCase();
    const map = {
      'MERCADO FONDO': 'Mercado Pago',
      'DELTA PESOS': 'Personal Pay',
      'BNA': 'BNA (Banco Nación)',
      'BBVA': 'BBVA', 'ICBC': 'ICBC', 'BIND': 'BIND',
    };
    if (map[upper]) return map[upper];
    return upper.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  }

  function fmtTope(t) {
    if (!t) return '<span style="color:var(--text-subtle)">sin tope</span>';
    return '$' + t.toLocaleString('es-AR', { maximumFractionDigits: 0 });
  }

  function tnaFromVcp(vcpHoy, vcpAyer, fechaHoy, fechaAyer) {
    const dias = Math.max(1, Math.round((new Date(fechaHoy) - new Date(fechaAyer)) / 86400000));
    const rend = (vcpHoy / vcpAyer) - 1;
    return (rend / dias) * 365 * 100;
  }

  function injectStyles() {
    if (document.getElementById('tasas-widget-styles')) return;
    const s = document.createElement('style');
    s.id = 'tasas-widget-styles';
    s.textContent = `
      .tw-wrap { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; margin: 1.5rem 0; }
      .tw-head { display: flex; align-items: center; justify-content: space-between; gap: 0.85rem; padding: 1rem 1.4rem; border-bottom: 1px solid var(--border); background: rgba(74,222,154,0.03); flex-wrap: wrap; }
      .tw-title { font-family: var(--font-display); font-size: 1.1rem; letter-spacing: -0.01em; color: var(--text); display: flex; align-items: center; gap: 0.5rem; }
      .tw-title .tw-live { display: inline-flex; align-items: center; gap: 0.3rem; background: rgba(74,222,154,0.12); color: var(--accent); border: 1px solid rgba(74,222,154,0.3); border-radius: 16px; padding: 0.15rem 0.55rem; font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; }
      .tw-title .tw-live::before { content: '●'; animation: tw-pulse 2s infinite; }
      @keyframes tw-pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      .tw-link { font-family: var(--font-mono); font-size: 0.78rem; color: var(--accent); text-decoration: none; }
      .tw-link:hover { text-decoration: underline; }
      .tw-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
      .tw-table th { background: transparent; color: var(--text-subtle); font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.7rem 1.1rem; text-align: right; border-bottom: 1px solid var(--border); font-weight: 500; }
      .tw-table th:first-child { text-align: left; }
      .tw-table td { padding: 0.85rem 1.1rem; text-align: right; color: var(--text-muted); border-bottom: 1px solid rgba(255,255,255,0.04); }
      .tw-table tr:last-child td { border-bottom: none; }
      .tw-table td:first-child { text-align: left; color: var(--text); font-weight: 500; }
      .tw-table td .tw-emoji { display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; background: var(--bg); border: 1px solid var(--border); border-radius: 7px; margin-right: 0.7rem; vertical-align: middle; font-size: 0.95rem; }
      .tw-tna { font-family: var(--font-display); font-size: 1.05rem; color: var(--accent); }
      .tw-tope { font-family: var(--font-mono); font-size: 0.78rem; }
      .tw-loading { padding: 2rem; text-align: center; color: var(--text-subtle); font-family: var(--font-mono); font-size: 0.82rem; }
      .tw-loading .tw-spin { display: inline-block; width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: tw-spin 0.8s linear infinite; margin-bottom: 0.5rem; }
      @keyframes tw-spin { to { transform: rotate(360deg); } }
      .tw-foot { padding: 0.8rem 1.4rem; background: rgba(0,0,0,0.15); border-top: 1px solid var(--border); font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-subtle); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
      @media (max-width: 640px) {
        .tw-table th, .tw-table td { padding: 0.6rem 0.8rem; font-size: 0.82rem; }
        .tw-table th:nth-child(3), .tw-table td:nth-child(3) { display: none; }
      }
    `;
    document.head.appendChild(s);
  }

  async function loadCuentas() {
    try {
      const r = await fetch('/api/argentinadatos?path=finanzas/fci/otros/ultimo');
      const data = await r.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter(o => o.tna > 0 && daysAgo(o.fecha) <= MAX_DAYS_STALE)
        .map(o => ({
          name: titleCaseBilletera(o.fondo),
          tna: o.tna * 100,
          tope: o.tope || null,
          emoji: EMOJI[(o.fondo || '').toUpperCase()] || '💳',
          fecha: o.fecha,
        }));
    } catch { return []; }
  }

  async function loadFciMM() {
    try {
      const [ult, pen] = await Promise.all([
        fetch('/api/argentinadatos?path=finanzas/fci/mercadoDinero/ultimo').then(r => r.json()),
        fetch('/api/argentinadatos?path=finanzas/fci/mercadoDinero/penultimo').then(r => r.json()),
      ]);
      if (!Array.isArray(ult) || !Array.isArray(pen)) return [];
      const targets = [
        { match: 'Mercado Fondo - Clase A', name: 'Mercado Pago (FCI)', emoji: '💙' },
        { match: 'Delta Pesos - Clase X', name: 'Personal Pay (FCI)', emoji: '💛' },
      ];
      const out = [];
      // Tomar también top fondos Clase A por VCP que no estén en targets
      targets.forEach(t => {
        const h = ult.find(x => x.fondo === t.match);
        const a = pen.find(x => x.fondo === t.match);
        if (!h || !a || !h.vcp || !a.vcp) return;
        if (daysAgo(h.fecha) > MAX_DAYS_STALE) return;
        const tna = tnaFromVcp(h.vcp, a.vcp, h.fecha, a.fecha);
        if (!isFinite(tna) || tna <= 0 || tna > 200) return;
        out.push({ name: t.name, tna, tope: null, emoji: t.emoji, fecha: h.fecha });
      });
      // Sumar top 5 FCI MM Clase A genéricos (excluyendo ya incluidos)
      const usedFondos = new Set(targets.map(t => t.match));
      const genericos = ult
        .filter(x => x.fondo && x.fondo.includes('Clase A') && !usedFondos.has(x.fondo) && daysAgo(x.fecha) <= MAX_DAYS_STALE && x.vcp > 0)
        .map(x => {
          const a = pen.find(p => p.fondo === x.fondo);
          if (!a || !a.vcp) return null;
          const tna = tnaFromVcp(x.vcp, a.vcp, x.fecha, a.fecha);
          if (!isFinite(tna) || tna <= 0 || tna > 200) return null;
          return {
            name: x.fondo.replace(' - Clase A', ''),
            tna, tope: null, emoji: '📜', fecha: x.fecha,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.tna - a.tna)
        .slice(0, 6);
      return [...out, ...genericos];
    } catch { return []; }
  }

  function render(target, rows, type) {
    const limit = parseInt(target.dataset.limit) || 5;
    rows.sort((a, b) => b.tna - a.tna);
    const top = rows.slice(0, limit);

    if (!top.length) {
      target.innerHTML = `
        <div class="tw-wrap">
          <div class="tw-loading">No se pudieron cargar las tasas. Probá refrescar la página.</div>
        </div>`;
      return;
    }

    const titleText = type === 'fci-mm'
      ? '💼 Mejores FCI Money Market hoy'
      : '💳 Mejores cuentas remuneradas hoy';
    const showTope = type !== 'fci-mm';
    const updated = new Date().toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    target.innerHTML = `
      <div class="tw-wrap">
        <div class="tw-head">
          <div class="tw-title">${titleText} <span class="tw-live">En vivo</span></div>
          <a href="tasas-hoy.html" class="tw-link">Ver tabla completa →</a>
        </div>
        <table class="tw-table">
          <thead>
            <tr>
              <th>${type === 'fci-mm' ? 'Fondo' : 'Billetera / Banco'}</th>
              <th>TNA</th>
              <th>TEA</th>
              ${showTope ? '<th>Tope</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${top.map(r => `
              <tr>
                <td><span class="tw-emoji">${esc(r.emoji)}</span>${esc(r.name)}</td>
                <td><span class="tw-tna">${r.tna.toFixed(2)}%</span></td>
                <td>${teaFromTna(r.tna).toFixed(2)}%</td>
                ${showTope ? `<td class="tw-tope">${fmtTope(r.tope)}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="tw-foot">
          <span>Actualizado ${updated} · ${rows.length} ${type === 'fci-mm' ? 'fondos' : 'cuentas'} relevadas</span>
          <span>Fuente: CAFCI vía ArgentinaDatos</span>
        </div>
      </div>
    `;
  }

  async function init() {
    const widgets = document.querySelectorAll('[data-tasas-widget]');
    if (!widgets.length) return;
    injectStyles();
    widgets.forEach(el => {
      el.innerHTML = `
        <div class="tw-wrap">
          <div class="tw-loading"><div class="tw-spin"></div><div>Cargando tasas en vivo…</div></div>
        </div>`;
    });
    for (const el of widgets) {
      const type = el.dataset.tasasWidget;
      const rows = type === 'fci-mm' ? await loadFciMM() : await loadCuentas();
      render(el, rows, type);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
