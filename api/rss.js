// Proxy RSS — ?source=<id>
// Devuelve { items: [{title, link, pubDate, img, description}] } parseado server-side.
// Whitelist de fuentes para evitar abuso.
import { denyExternalOrigin } from './_security.js';

const SOURCES = {
  // Argentina
  ambito:        'https://www.ambito.com/rss/economia.xml',
  ambito_fin:    'https://www.ambito.com/rss/finanzas.xml',
  cronista:      'https://news.google.com/rss/search?q=site:cronista.com+economia&hl=es-419&gl=AR&ceid=AR:es-419',
  cronista_fin:  'https://news.google.com/rss/search?q=site:cronista.com+finanzas&hl=es-419&gl=AR&ceid=AR:es-419',
  infobae:       'https://www.infobae.com/arc/outboundfeeds/rss/category/economia/',
  infobae_fin:   'https://www.infobae.com/arc/outboundfeeds/rss/category/economia/finanzas/',
  lanacion:      'https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/?outputType=xml',
  iprofesional:  'https://www.iprofesional.com/rss/economia',
  bae:           'https://www.baenegocios.com/feed/',
  pagina12:      'https://news.google.com/rss/search?q=site:pagina12.com.ar+economia&hl=es-419&gl=AR&ceid=AR:es-419',
  // EE.UU. / Internacional
  yahoo:         'https://finance.yahoo.com/news/rssindex',
  bloomberg:     'https://news.google.com/rss/search?q=site:bloomberg.com&hl=en-US&gl=US&ceid=US:en',
  reuters:       'https://news.google.com/rss/search?q=site:reuters.com+business&hl=en-US&gl=US&ceid=US:en',
  cnbc:          'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  marketwatch:   'https://feeds.content.dowjones.io/public/rss/mw_topstories',
  ft:            'https://news.google.com/rss/search?q=site:ft.com&hl=en-US&gl=US&ceid=US:en',
  wsj:           'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
  // Agregadores
  google_markets: 'https://news.google.com/rss/search?q=wall+street+nasdaq+sp500&hl=en-US&gl=US&ceid=US:en',
  google_ar:      'https://news.google.com/rss/search?q=bolsa+argentina+mercados&hl=es-419&gl=AR&ceid=AR:es-419',
};

function escAttr(s) { return String(s ?? '').replace(/"/g, '&quot;'); }

function parseRSS(xml) {
  const items = [];
  // Soporta <item> de RSS 2.0 y <entry> de Atom
  const itemRegex = /<(item|entry)[\s\S]*?<\/(item|entry)>/gi;
  const matches = xml.match(itemRegex) || [];
  for (const block of matches.slice(0, 30)) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      if (!m) return '';
      return m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    };
    const title = get('title');
    let link = get('link');
    if (!link) {
      const linkAttr = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (linkAttr) link = linkAttr[1];
    }
    const pubDate = get('pubDate') || get('published') || get('updated') || get('dc:date');
    const description = get('description') || get('summary') || get('content') || get('content:encoded');
    // Imagen: probar múltiples ubicaciones porque cada portal usa convenciones distintas
    let img = '';
    // 1. <enclosure url="..." type="image/...">
    let m = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i)
         || block.match(/<enclosure[^>]+type=["']image[^"']*["'][^>]*url=["']([^"']+)["']/i);
    if (m) img = m[1];
    // 2. <media:content url="..." medium="image"> o <media:thumbnail url="...">
    if (!img) {
      m = block.match(/<media:content[^>]+url=["']([^"']+)["']/i)
       || block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
      if (m) img = m[1];
    }
    // 3. <itunes:image href="...">
    if (!img) {
      m = block.match(/<itunes:image[^>]+href=["']([^"']+)["']/i);
      if (m) img = m[1];
    }
    // 4. <image><url>...</url></image> dentro del item
    if (!img) {
      m = block.match(/<image>[\s\S]*?<url>([\s\S]*?)<\/url>/i);
      if (m) img = m[1].trim();
    }
    // 5. <img src="..."> en description o content
    if (!img) {
      m = description.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m) img = m[1];
    }
    // 6. Imagen plana en cualquier parte del block (fallback agresivo)
    if (!img) {
      m = block.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/i);
      if (m) img = m[0];
    }
    // Limpiar HTML entities en URL
    if (img) img = img.replace(/&amp;/g, '&').trim();
    // Limpiar título (Google News agrega " - Source")
    const cleanTitle = title.replace(/\s+-\s+[^-]+$/, '').trim();
    if (cleanTitle && link) {
      items.push({
        title: cleanTitle.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
        link: link.replace(/&amp;/g, '&'),
        pubDate,
        img,
      });
    }
  }
  return items;
}

export default async function handler(req, res) {
  if (denyExternalOrigin(req, res)) return;

  const source = req.query.source;
  if (!source || !SOURCES[source]) {
    return res.status(400).json({ error: 'Fuente inválida' });
  }
  const url = SOURCES[source];
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BBFinancialBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Error desde el feed', status: response.status });
    }
    const xml = await response.text();
    const items = parseRSS(xml);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({ source, count: items.length, items });
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo conectar con el feed', detail: String(err?.message || err) });
  }
}
