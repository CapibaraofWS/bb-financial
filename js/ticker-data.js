/* Helper compartido entre ticker.html, watchlist.html, comparar.html
   Cada función devuelve null si la API falla, en lugar de tirar excepción. */

window.TickerData = (function() {

  async function fetchYahoo(symbol, range = '1d', interval = '1d') {
    try {
      const r = await fetch(`/api/acciones?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`,
        { signal: AbortSignal.timeout(9000) });
      if (!r.ok) return null;
      const d = await r.json();
      return d?.chart?.result?.[0] || null;
    } catch { return null; }
  }

  async function fetchFinnhub(type, symbol) {
    try {
      const r = await fetch(`/api/finnhub?type=${type}&symbol=${encodeURIComponent(symbol)}`,
        { signal: AbortSignal.timeout(9000) });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  // Quote rápido (precio + % día) usando Yahoo chart
  async function quickQuote(symbol) {
    const y = await fetchYahoo(symbol, '1mo', '1d');
    if (!y || !y.meta) return null;
    const m = y.meta;
    const price = m.regularMarketPrice;
    const prev  = m.chartPreviousClose ?? m.previousClose;
    const dayChg = prev ? (price - prev) / prev * 100 : 0;
    // % mes: primer cierre disponible vs último
    const closes = y.indicators?.quote?.[0]?.close?.filter(c => c != null) || [];
    const monthChg = closes.length > 1 ? (closes[closes.length-1] - closes[0]) / closes[0] * 100 : null;
    // Mini sparkline data
    const spark = closes.slice(-30);
    return {
      symbol: m.symbol || symbol.toUpperCase(),
      name: m.longName || m.shortName || symbol.toUpperCase(),
      exchange: m.exchangeName || m.fullExchangeName || '',
      currency: m.currency || 'USD',
      price, prev, dayChg, monthChg,
      marketCap: m.marketCap,
      high52: m.fiftyTwoWeekHigh,
      low52: m.fiftyTwoWeekLow,
      spark
    };
  }

  // Bundle completo: precio + perfil + métricas (en paralelo)
  // 2 fetches a Yahoo: una con 1y para el chart histórico, otra con 5d para el %día real
  async function fullQuote(symbol) {
    const [yChart, yQuote, profile, metrics] = await Promise.all([
      fetchYahoo(symbol, '1y', '1d'),
      fetchYahoo(symbol, '5d', '1d'),
      fetchFinnhub('profile', symbol),
      fetchFinnhub('metric', symbol)
    ]);
    if (!yChart || !yChart.meta) return null;

    const m = yChart.meta;
    const price = m.regularMarketPrice;

    // % día real: prev = cierre del día anterior, NO chartPreviousClose (que con range=1y es el precio de hace 1 año)
    // Estrategia: usar los closes del fetch range=5d → penúltimo close (el último puede ser el de hoy intraday)
    let prev;
    if (yQuote?.indicators?.quote?.[0]?.close) {
      const closes5d = yQuote.indicators.quote[0].close.filter(c => c != null);
      // Si el último close del array está cerca del price actual (mismo día), usar el penúltimo
      // Sino, el último es el cierre de ayer (mercado cerrado hoy)
      if (closes5d.length >= 2) {
        const lastClose = closes5d[closes5d.length - 1];
        const penultClose = closes5d[closes5d.length - 2];
        // Si el último close coincide ±0.5% con price actual, ese es el de hoy → prev = penúltimo
        if (Math.abs(lastClose - price) / price < 0.005) {
          prev = penultClose;
        } else {
          prev = lastClose;
        }
      } else if (closes5d.length === 1) {
        prev = closes5d[0];
      }
    }
    // Fallback: usar previousClose si Yahoo lo trae
    if (prev == null) prev = yQuote?.meta?.chartPreviousClose ?? m.previousClose;

    const dayChg = (prev && price) ? (price - prev) / prev * 100 : 0;
    const dayChgAbs = (prev && price) ? price - prev : 0;

    const closes = yChart.indicators?.quote?.[0]?.close || [];
    const timestamps = yChart.timestamp || [];

    const mt = metrics?.metric || {};

    return {
      symbol: m.symbol || symbol.toUpperCase(),
      name: profile?.name || m.longName || m.shortName || symbol.toUpperCase(),
      exchange: profile?.exchange || m.exchangeName || '',
      currency: profile?.currency || m.currency || 'USD',
      logo: profile?.logo || '',
      sector: profile?.finnhubIndustry || '',
      country: profile?.country || '',
      ipo: profile?.ipo || '',
      weburl: profile?.weburl || '',
      price, prev, dayChg, dayChgAbs,
      isArgTicker: /\.BA$/i.test(symbol),
      marketCap: profile?.marketCapitalization ? profile.marketCapitalization * 1_000_000 : m.marketCap,
      shareOutstanding: profile?.shareOutstanding,
      high52: m.fiftyTwoWeekHigh ?? mt['52WeekHigh'],
      low52:  m.fiftyTwoWeekLow  ?? mt['52WeekLow'],
      // Valuación
      pe: mt.peNormalizedAnnual ?? mt.peTTM ?? mt.peExclExtraAnnual,
      pb: mt.pbAnnual ?? mt.pbQuarterly,
      ps: mt.psAnnual ?? mt.psTTM,
      evEbitda: mt['enterpriseValue/ebitdaTTM'] ?? mt.evEbitdaTTM,
      // Rentabilidad
      roe: mt.roeTTM ?? mt.roeRfy,
      roa: mt.roaTTM ?? mt.roaRfy,
      grossMargin: mt.grossMarginTTM ?? mt.grossMarginAnnual,
      operatingMargin: mt.operatingMarginTTM ?? mt.operatingMarginAnnual,
      netMargin: mt.netProfitMarginTTM ?? mt.netProfitMarginAnnual,
      // Crecimiento
      revenueGrowth: mt.revenueGrowthTTMYoy ?? mt.revenueGrowth5Y,
      epsGrowth: mt.epsGrowthTTMYoy ?? mt.epsGrowth5Y,
      // Salud financiera
      debtEquity: mt['totalDebt/totalEquityAnnual'] ?? mt['totalDebt/totalEquityQuarterly'],
      currentRatio: mt.currentRatioAnnual ?? mt.currentRatioQuarterly,
      quickRatio: mt.quickRatioAnnual ?? mt.quickRatioQuarterly,
      // Dividendos
      divYield: mt.dividendYieldIndicatedAnnual ?? mt.currentDividendYieldTTM,
      payoutRatio: mt.payoutRatioTTM ?? mt.payoutRatioAnnual,
      // Riesgo
      beta: mt.beta,
      // Performance
      perf1M: mt['1MonthPriceReturnDaily'],
      perf3M: mt['3MonthPriceReturnDaily'],
      perfYTD: mt.yearToDatePriceReturnDaily,
      perf1Y: mt['52WeekPriceReturnDaily'] ?? mt['1YearPriceReturnDaily'],
      perf5Y: mt['5YearPriceReturnDaily'],
      // Chart histórico
      chart: { closes, timestamps }
    };
  }

  // ---- Helpers de formateo ----
  function fmtMarketCap(n) {
    if (!n || isNaN(n)) return '—';
    if (n >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
    if (n >= 1e9)  return '$' + (n/1e9).toFixed(2) + 'B';
    if (n >= 1e6)  return '$' + (n/1e6).toFixed(2) + 'M';
    return '$' + n.toLocaleString('en-US');
  }
  function fmtPct(n, decimals = 2) {
    if (n == null || isNaN(n)) return '—';
    return (n >= 0 ? '+' : '') + (n).toFixed(decimals) + '%';
  }
  function fmtPctRaw(n, decimals = 2) {
    // Para campos que vienen como decimal (0.15 = 15%) — Finnhub mezcla unidades
    if (n == null || isNaN(n)) return '—';
    return (n >= 0 ? '+' : '') + (n).toFixed(decimals) + '%';
  }
  function fmtNum(n, decimals = 2) {
    if (n == null || isNaN(n)) return '—';
    return n.toFixed(decimals);
  }
  function fmtPrice(n, currency = 'USD') {
    if (n == null || isNaN(n)) return '—';
    const sym = currency === 'USD' ? '$' : currency + ' ';
    return sym + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function chgClass(n) { return n > 0 ? 'pos' : n < 0 ? 'neg' : 'neu'; }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  return { quickQuote, fullQuote, fmtMarketCap, fmtPct, fmtPctRaw, fmtNum, fmtPrice, chgClass, esc };
})();
