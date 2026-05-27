// Rate limit por IP para Vercel Serverless usando Upstash Redis REST.
//
// ACTIVACIÓN:
//   1. Crear cuenta gratis en https://upstash.com → New Database (Redis, Global).
//   2. En la sección "REST API" copiar UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN.
//   3. En Vercel Dashboard → tu proyecto → Settings → Environment Variables agregar ambas.
//   4. Re-deploy. El rate limit se activa automáticamente.
//
// Si las env vars NO están configuradas, las funciones API siguen funcionando sin rate limit
// (solo con la protección de origen de _security.js). Esto evita que el sitio se rompa si Upstash
// está caído o si todavía no se configuró.
//
// Algoritmo: ventana deslizante simple — N requests por ventana de M segundos por IP.

const DEFAULT_LIMIT = 30;        // peticiones permitidas
const DEFAULT_WINDOW_SECS = 60;  // ventana en segundos

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/**
 * Aplica rate limit a la request. Si supera el límite, escribe 429 y devuelve true.
 * Si está OK (o Upstash no configurado), devuelve false.
 *
 * @param {object} req - request de Vercel
 * @param {object} res - response de Vercel
 * @param {object} opts - { limit?: number, windowSecs?: number, key?: string }
 * @returns {Promise<boolean>} true si rate-limited (la función debe abortar)
 */
export async function denyRateLimited(req, res, opts = {}) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false; // sin Upstash configurado, no rate-limit

  const limit = opts.limit || DEFAULT_LIMIT;
  const windowSecs = opts.windowSecs || DEFAULT_WINDOW_SECS;
  const ip = getClientIp(req);
  const bucket = Math.floor(Date.now() / 1000 / windowSecs);
  const key = `rl:${opts.key || 'api'}:${ip}:${bucket}`;

  try {
    // INCR + EXPIRE en una sola pipeline REST
    const body = [['INCR', key], ['EXPIRE', key, String(windowSecs + 5)]];
    const r = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok) {
      console.warn('[rateLimit] Upstash respondió', r.status, '— fail-open');
      return false;
    }
    const data = await r.json();
    const count = data?.[0]?.result;
    if (typeof count === 'number' && count > limit) {
      res.setHeader('Retry-After', String(windowSecs));
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.status(429).json({ error: 'Demasiadas peticiones. Esperá unos segundos.' });
      return true;
    }
    if (typeof count === 'number') {
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - count)));
    }
    return false;
  } catch (err) {
    console.warn('[rateLimit] Upstash error — fail-open:', err?.message || err);
    return false;
  }
}
