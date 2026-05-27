// Helper compartido para validar origen de las requests a endpoints sensibles.
// Bloquea curl directo / otros sites que intenten usar nuestra quota.

const PROD_HOSTS = [
  'bb-financial.vercel.app',
  'bb-financial-capibaraofws-projects.vercel.app',
  'bb-financial-capibaraofws-capibaraofws-projects.vercel.app',
];

const DEV_HOSTS = process.env.NODE_ENV !== 'production'
  ? ['localhost:3000', 'localhost:3001']
  : [];

const ALLOWED_HOSTS = new Set([...PROD_HOSTS, ...DEV_HOSTS]);

/**
 * Devuelve true si la request viene de un origen permitido.
 * Se permite cuando:
 *  - Referer o Origin matchean nuestros hosts
 *  - O la request es interna de Vercel (header X-Vercel-Internal-*)
 */
function hostOf(value) {
  if (!value || typeof value !== 'string') return null;
  try { return new URL(value).host.toLowerCase(); } catch { return null; }
}

export function isAllowedOrigin(req) {
  const refererHost = hostOf(req.headers.referer || req.headers.referrer);
  const originHost = hostOf(req.headers.origin);
  if (refererHost && ALLOWED_HOSTS.has(refererHost)) return true;
  if (originHost && ALLOWED_HOSTS.has(originHost)) return true;
  return false;
}

export function denyExternalOrigin(req, res) {
  if (!isAllowedOrigin(req)) {
    res.status(403).json({ error: 'Origen no autorizado' });
    return true;
  }
  return false;
}
