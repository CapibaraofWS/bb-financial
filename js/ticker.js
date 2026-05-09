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
      const res = await fetch('/api/bcra', { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const d = await res.json();
      const embi = d?.results?.find(v => v.idVariable === 5);
      return embi ? { price: embi.valor, chg: null } : null;
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
  function fmtChg(chg) {
    if (chg == null) return { txt: '', cls: 'neu' };
    const sign = chg >= 0 ? '+' : '';
    return {
      txt: `${sign}${chg.toFixed(2)}%`,
      cls: chg > 0 ? 'pos' : chg < 0 ? 'neg' : 'neu'
    };
  }

  /* ---------- Render ---------- */
  function renderItem({ flag, label, priceStr, chg }) {
    const c = fmtChg(chg);
    return `<div class="mkt-item">
      <span class="mkt-flag">${flag}</span>
      <span class="mkt-label">${label}</span>
      <span class="mkt-price">${priceStr}</span>
      ${c.txt ? `<span class="mkt-chg ${c.cls}">${c.txt}</span>` : ''}
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
      { flag: '⚠️',  label: 'RIESGO PAÍS',   priceStr: rp ? fmtPrice(rp.price) : '—',  chg: null          },
      { flag: '🇺🇸', label: 'NASDAQ 100',    priceStr: fmtPrice(ndx?.price),            chg: ndx?.chg      },
      { flag: '🇺🇸', label: 'DOW JONES',     priceStr: fmtPrice(dji?.price),            chg: dji?.chg      },
      { flag: '🇺🇸', label: 'S&P 500',       priceStr: fmtPrice(gspc?.price),           chg: gspc?.chg     },
      { flag: '🥇',  label: 'ORO NUEVA YORK',priceStr: fmtPrice(gc?.price, '$'),        chg: gc?.chg       },
      { flag: '🛢️', label: 'PETRÓLEO WTI',  priceStr: fmtPrice(cl?.price, '$'),        chg: cl?.chg       },
      { flag: '💵',  label: 'USD BLUE',       priceStr: blue ? fmtPrice(blue, '$') : '—', chg: null        },
    ];

    bar.innerHTML = buildTrack(items);
  }

  refresh();
  setInterval(refresh, 90_000);
})();
