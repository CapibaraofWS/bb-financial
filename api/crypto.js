// Soporta ?ids=bitcoin,ethereum&vs_currencies=usd,ars
export default async function handler(req, res) {
  const ids = req.query.ids || 'bitcoin,ethereum';
  const vs = req.query.vs_currencies || 'usd';

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}&include_24hr_change=true&include_market_cap=true`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(response.status).json({ error: 'Error desde CoinGecko' });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'No se pudo conectar con CoinGecko' });
  }
}
