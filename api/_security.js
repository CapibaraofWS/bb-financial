// Helper compartido para validar origen de las requests a endpoints sensibles.
// Bloquea curl directo / otros sites que intenten usar nuestra quota.

const PROD_HOSTS = [
  'bbfinanzas.com.ar',
  'www.bbfinanzas.com.ar',
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
export function isAllowedOrigin(req) {
  const referer = req.headers.referer || req.headers.referrer || '';
  const origin = req.headers.origin || '';

  // Se compara el host exacto. Antes se buscaba el texto del host dentro del
  // Referer, y cualquier sitio lo pasaba poniendo "?x=://bb-financial.vercel.app/"
  // en su propia URL: sus visitantes terminaban gastando nuestras cuotas de API.
  const host = u => { try { return new URL(u).host; } catch { return ''; } };
  if (ALLOWED_HOSTS.has(host(referer)) || ALLOWED_HOSTS.has(host(origin))) return true;

  // Sec-Fetch-Site lo pone el navegador y una pagina no lo puede falsificar:
  // es cabecera prohibida para fetch y XHR. Sirve de red de seguridad cuando no
  // llega el Referer, que es justo lo que puede pasar cuando Google renderiza
  // la pagina para indexarla: sin esto sus 19 paginas con datos en vivo se le
  // renderizan vacias.
  if (req.headers['sec-fetch-site'] === 'same-origin') return true;

  return false;
}

export function denyExternalOrigin(req, res) {
  if (!isAllowedOrigin(req)) {
    res.status(403).json({ error: 'Origen no autorizado' });
    return true;
  }
  return false;
}
