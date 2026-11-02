// Pone en sitemap.xml la fecha del último cambio real de cada página. Ignora los commits que tocan muchas
// páginas a la vez (versiones de main.js, submenú), porque no son cambios de contenido.
// Uso: node scripts/sitemap-fechas.mjs
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const log = execSync('git log --format=@%cs --name-only -- "*.html"', { maxBuffer: 1 << 28 }).toString();
const ultima = {};
for (const bloque of log.split('@').filter(Boolean)) {
  const [fecha, ...archivos] = bloque.trim().split(/\r?\n/).filter(Boolean);
  if (archivos.length > 40) continue;
  for (const a of archivos) ultima[a] ??= fecha;
}
const c = fs.readFileSync('sitemap.xml', 'utf8'), crlf = c.includes('\r\n');
let cambios = 0;
const s = c.replace(/\r\n/g, '\n').replace(/<loc>https:\/\/www\.bbfinanzas\.com\.ar\/([^<]*)<\/loc>(\s*)<lastmod>([^<]*)<\/lastmod>/g, (m, ruta, esp, vieja) => {
  const archivo = ruta === '' ? 'index.html' : fs.existsSync(ruta + '.html') ? ruta + '.html' : ruta + '/index.html';
  const nueva = ultima[archivo] && ultima[archivo] > '2026-10-05' ? ultima[archivo] : ultima[archivo] || vieja;
  if (nueva === vieja) return m;
  cambios++;
  return `<loc>https://www.bbfinanzas.com.ar/${ruta}</loc>${esp}<lastmod>${nueva}</lastmod>`;
});
fs.writeFileSync('sitemap.xml', crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('fechas actualizadas:', cambios);
