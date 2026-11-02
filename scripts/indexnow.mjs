// Avisa a Bing y a los otros buscadores de IndexNow qué páginas hay en el sitemap. Google no usa IndexNow.
// Uso, después de publicar: node scripts/indexnow.mjs            (todas las páginas del sitemap)
//                           node scripts/indexnow.mjs pages/x    (solo esas)
import fs from 'node:fs';

const HOST = 'www.bbfinanzas.com.ar';
const archivo = fs.readdirSync('.').find(f => /^[0-9a-f]{32}\.txt$/.test(f));
if (!archivo) throw new Error('Falta el archivo de la clave en la raíz del sitio');
const key = archivo.replace('.txt', '');
const pedidas = process.argv.slice(2).map(r => `https://${HOST}/${r.replace(/^\//, '')}`);
const urlList = pedidas.length ? pedidas : [...fs.readFileSync('sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${archivo}`, urlList }),
});
console.log(r.status, r.statusText, urlList.length, 'direcciones');
