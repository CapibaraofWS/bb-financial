// Helper compartido para validar origen de las requests a endpoints sensibles.
// Bloquea curl directo / otros sites que intenten usar nuestra quota.

// ---- Mitigación temporal de CVE-2026-111497 (aviso de seguridad de Node.js del 21/10/2026): el decodificador
// Brotli tiene una escritura fuera de límites que permite ejecutar código con una respuesta armada, y fetch
// descomprime lo que llegue aunque no lo haya pedido. Vercel corre Node 24.21.0 y el arreglo está en 24.22.1
// (22.23.4 y 26.12.1 en las otras ramas). Hasta entonces, los pedidos a otros servidores piden solo gzip o deflate
// y se cortan si igual llega Brotli, antes de descomprimir nada. Con un Node parcheado esto no se activa.
// Todas las funciones importan este archivo, así que alcanza con hacerlo acá.
const PARCHE = { 22: [23, 4], 24: [22, 1], 26: [12, 1] };
const [nMa, nMi, nPa] = process.versions.node.split('.').map(Number), nMin = PARCHE[nMa];
if (nMin && (nMi < nMin[0] || (nMi === nMin[0] && nPa < nMin[1])) && !globalThis.fetch.sinBrotli) {
  const CLAVE = Symbol.for('undici.globalDispatcher.1'), fetchNode = globalThis.fetch;
  const esBrotli = raw => { for (let i = 0; i + 1 < raw.length; i += 2) if (String(raw[i]).toLowerCase() === 'content-encoding' && /\bbr\b/i.test(String(raw[i + 1]))) return true; return false; };
  const dispatcher = { dispatch(opts, handler) {
    let cortar = null;
    const h = new Proxy(handler, { get(t, k) {
      if (k === 'onConnect') return (abort, ctx) => { cortar = abort; return t.onConnect(abort, ctx); };
      if (k === 'onHeaders') return (estado, raw, seguir, texto) => {
        if (esBrotli(raw || [])) { if (cortar) cortar(new Error('Respuesta comprimida con Brotli rechazada')); return false; }
        return t.onHeaders(estado, raw, seguir, texto);
      };
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    } });
    return globalThis[CLAVE].dispatch(opts, h);
  } };
  const fetchSinBrotli = (url, opts = {}) => {
    const headers = new Headers(opts.headers);
    headers.set('accept-encoding', 'gzip, deflate');
    return fetchNode(url, { ...opts, headers, dispatcher: opts.dispatcher || dispatcher });
  };
  fetchSinBrotli.sinBrotli = true;
  globalThis.fetch = fetchSinBrotli;
  console.info('Node ' + process.version + ': respuestas en Brotli bloqueadas hasta que el runtime tenga el parche');
}

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
