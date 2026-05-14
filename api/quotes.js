// Batch quotes — ?symbols=AAPL,MSFT,...
import { denyExternalOrigin } from './_security.js';

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;

  const symbols = (req.query.symbols || '').trim();
  if (!symbols) return res.status(400).json({ error: 'Parámetro symbols requerido (CSV)' });
  // Validar cada symbol y limitar a 60
  const list = symbols.split(',').map(s => s.trim())
    .filter(s => s && /^[A-Z0-9.\-^=]{1,15}$/i.test(s))
    .slice(0, 60);
  if (!list.length) return res.status(400).json({ error: 'Lista inválida' });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json,text/plain,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  async function fetchOne(sym) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
      const r = await fetch(url, { signal: AbortSignal.timeout(7000), headers });
      if (!r.ok) return null;
      const j = await r.json();
      const m = j?.chart?.result?.[0]?.meta;
      if (!m) return null;
      const price = m.regularMarketPrice;
      const prev = m.chartPreviousClose ?? m.previousClose;
      const chg = (price != null && prev) ? price - prev : null;
      const pct = (chg != null && prev) ? (chg / prev) * 100 : null;
      // Volumen del último día disponible
      const vols = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.volume || [];
      const vol = [...vols].reverse().find(v => v != null) || 0;
      return {
        symbol: m.symbol || sym,
        shortName: m.shortName,
        longName: m.longName,
        currency: m.currency,
        regularMarketPrice: price,
        regularMarketChange: chg,
        regularMarketChangePercent: pct,
        regularMarketPreviousClose: prev,
        regularMarketVolume: vol,
        marketCap: m.marketCap, // a veces presente, a veces no
        fiftyTwoWeekHigh: m.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: m.fiftyTwoWeekLow,
        exchangeName: m.exchangeName || m.fullExchangeName,
      };
    } catch { return null; }
  }

  try {
    // Paraleliza con un cap razonable
    const results = await Promise.all(list.map(fetchOne));
    const valid = results.filter(Boolean);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      quoteResponse: { result: valid, error: null },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener quotes', detail: String(err?.message || err) });
  }
}
