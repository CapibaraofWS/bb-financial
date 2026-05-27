/* ============================================================
   BB Financial — Market Ticker + News
   ============================================================ */

(function () {
  /* ---------- CSS injected dynamically ---------- */
  const style = document.createElement('style');
  style.textContent = `
    .mkt-bar{
      background:#080a0d;
      border-bottom:1px solid rgba(74,222,154,0.12);
      overflow:hidden;
      height:36px;
      display:flex;
      align-items:center;
      position:relative;
      z-index:200;
      user-select:none;
    }
    .mkt-track{
      display:flex;
      align-items:center;
      gap:0;
      white-space:nowrap;
      animation:mktScroll 60s linear infinite;
      will-change:transform;
    }
    .mkt-bar:hover .mkt-track{ animation-play-state:paused; }
    @keyframes mktScroll{
      0%  { transform:translateX(0); }
      100%{ transform:translateX(-50%); }
    }
    .mkt-item{
      display:inline-flex;
      align-items:center;
      gap:0.55rem;
      padding:0 1.4rem;
      border-right:1px solid rgba(255,255,255,0.05);
      font-family:'DM Mono',monospace;
      font-size:0.7rem;
      letter-spacing:0.04em;
    }
    .mkt-label{
      color:#3d4558;
      text-transform:uppercase;
      letter-spacing:0.09em;
      font-size:0.63rem;
    }
    .mkt-price{ color:#e8edf5; font-weight:500; }
    .mkt-chg{ font-size:0.68rem; font-weight:600; }
    .mkt-chg.pos{ color:#4ade9a; }
    .mkt-chg.neg{ color:#f08080; }
    .mkt-chg.neu{ color:#7a8599; }
    .mkt-flag{ font-size:0.8rem; }
    .mkt-loader{
      padding:0 1.5rem;
      font-family:'DM Mono',monospace;
      font-size:0.68rem;
      color:#3d4558;
      letter-spacing:0.08em;
    }
  `;
  document.head.appendChild(style);

  /* ---------- Build bar ---------- */
  const bar = document.createElement('div');
  bar.className = 'mkt-bar';
  bar.innerHTML = '<div class="mkt-loader">Cargando datos del mercado…</div>';
  const header = document.querySelector('.site-header');
  if (header) {
    document.body.insertBefore(bar, header);
  } else {
    document.body.insertBefore(bar, document.body.firstChild);
  }

  /* ---------- Data sources — all via /api/* proxies ---------- */

  async function getYahoo(sym) {
    try {
      const res = await fetch(`/api/acciones?symbol=${encodeURIComponent(sym)}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return null;
      return extractYahoo(await res.json());
    } catch {
      return null;
    }
  }

  function extractYahoo(d) {
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose;
    const chg   = prev ? ((price - prev) / prev * 100) : 0;
    return { price, chg };
  }

  async function getRiesgoPais() {
    try {
      const res = await fetch('/api/argentinadatos?path=finanzas/indices/riesgo-pais/ultimo', { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const obj = await res.json();
      if (obj?.valor == null) return null;
      return { price: obj.valor, chg: null };
    } catch {
      return null;
    }
  }

  async function getUsdBlue() {
    try {
      const res = await fetch('/api/dolar', { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const arr = await res.json();
      const blue = Array.isArray(arr) ? arr.find(d => d.casa === 'blue') : null;
      return blue?.venta ?? null;
    } catch {
      return null;
    }
  }

  /* ---------- Format helpers ---------- */
  function fmtPrice(n, prefix = '') {
    if (n == null) return '—';
    const s = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    return prefix + s;
  }
  function fmtChg(chg, isAbs = false) {
    if (chg == null) return { txt: '', cls: 'neu' };
    const sign = chg >= 0 ? '+' : '';
    return {
      txt: isAbs ? `${sign}${Math.round(chg)} pts` : `${sign}${chg.toFixed(2)}%`,
      cls: chg > 0 ? 'pos' : chg < 0 ? 'neg' : 'neu'
    };
  }

  /* ---------- Render ---------- */
  // Escape para evitar XSS si una API externa devuelve HTML/script en label/priceStr.
  // Solo permitimos las clases internas conocidas en c.cls (whitelist).
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  const CHG_CLASSES = new Set(['pos','neg','neu']);

  function renderItem({ flag, label, priceStr, chg, chgIsAbs }) {
    const c = fmtChg(chg, !!chgIsAbs);
    const safeCls = CHG_CLASSES.has(c.cls) ? c.cls : 'neu';
    return `<div class="mkt-item">
      <span class="mkt-flag">${esc(flag)}</span>
      <span class="mkt-label">${esc(label)}</span>
      <span class="mkt-price">${esc(priceStr)}</span>
      ${c.txt ? `<span class="mkt-chg ${safeCls}">${esc(c.txt)}</span>` : ''}
    </div>`;
  }

  function buildTrack(items) {
    const html = items.map(renderItem).join('');
    // Duplicate for seamless scroll
    return `<div class="mkt-track">${html}${html}</div>`;
  }

  /* ---------- Fetch all & render ---------- */
  async function refresh() {
    const results = await Promise.allSettled([
      getYahoo('^MERV'),
      getYahoo('^NDX'),
      getYahoo('^DJI'),
      getYahoo('^GSPC'),
      getYahoo('GC=F'),
      getYahoo('CL=F'),
      getRiesgoPais(),
      getUsdBlue(),
    ]);
    const [merv, ndx, dji, gspc, gc, cl, rp, blue] =
      results.map(r => r.status === 'fulfilled' ? r.value : null);

    const mervUsd = (merv && blue) ? { price: merv.price / blue, chg: merv.chg } : null;

    const items = [
      { flag: '🇦🇷', label: 'MERVAL USD',    priceStr: fmtPrice(mervUsd?.price, '$'),  chg: mervUsd?.chg  },
      { flag: '🇦🇷',  label: 'RIESGO PAÍS',
        priceStr: rp ? Math.round(rp.price).toLocaleString('en-US') + ' pts' : '—',
        chg: rp?.chg != null ? rp.chg : null,
        chgIsAbs: true },
      { flag: '🇺🇸', label: 'NASDAQ 100',    priceStr: fmtPrice(ndx?.price),            chg: ndx?.chg      },
      { flag: '🇺🇸', label: 'DOW JONES',     priceStr: fmtPrice(dji?.price),            chg: dji?.chg      },
      { flag: '🇺🇸', label: 'S&P 500',       priceStr: fmtPrice(gspc?.price),           chg: gspc?.chg     },
      { flag: '🥇',  label: 'ORO NUEVA YORK',priceStr: fmtPrice(gc?.price, '$'),        chg: gc?.chg       },
      { flag: '🛢️', label: 'PETRÓLEO WTI',  priceStr: fmtPrice(cl?.price, '$'),        chg: cl?.chg       },
      { flag: '💵',  label: 'USD BLUE',       priceStr: blue ? fmtPrice(blue, '$') : '—', chg: null        },
    ];

    bar.innerHTML = buildTrack(items);

    // Timestamp "Actualizado HH:MM:SS" — solo si al menos 1 dato cargó
    const hasData = items.some(it => it.priceStr && it.priceStr !== '—');
    if (hasData) {
      const now = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const stamp = document.getElementById('ticker-timestamp') || (() => {
        const el = document.createElement('span');
        el.id = 'ticker-timestamp';
        el.style.cssText = 'position:absolute;right:14px;top:50%;transform:translateY(-50%);font-family:var(--font-mono);font-size:0.62rem;color:var(--text-subtle);letter-spacing:0.06em;pointer-events:none;background:linear-gradient(90deg,transparent,var(--bg-card) 30%);padding:0.35rem 0 0.35rem 1.2rem';
        bar.style.position = 'relative';
        bar.appendChild(el);
        return el;
      })();
      stamp.textContent = `Act. ${now}`;
    }
  }

  // Throttling: solo refrescar si la pestaña está visible (ahorra cuotas de APIs y batería del usuario)
  let timer = null;
  function startTimer() {
    if (timer) return;
    timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 90_000);
  }
  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  refresh();
  startTimer();
  // Si el usuario vuelve a la pestaña después de >90s, refrescamos inmediatamente.
  let lastRefresh = Date.now();
  const origRefresh = refresh;
  // Wrap refresh para registrar timestamp del último refresh
  // (evita doble fetch si visibilitychange dispara seguido)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (Date.now() - lastRefresh > 90_000) { origRefresh(); lastRefresh = Date.now(); }
      startTimer();
    } else {
      stopTimer();
    }
  });
})();
