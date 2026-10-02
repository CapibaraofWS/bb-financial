// Paso de build de Vercel: minifica CSS y JS en la copia que se publica.
// Solo corre en el deploy (production/preview). En local (`vercel dev`) no hace
// nada, para no reescribir los archivos fuente.
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

if (!['production', 'preview'].includes(process.env.VERCEL_ENV)) {
  console.log('build.mjs: no es un deploy de Vercel, no se minifica.');
  process.exit(0);
}

const js = readdirSync('js').filter(f => f.endsWith('.js')).map(f => 'js/' + f);
execSync(
  `npx --yes esbuild@0.25.0 css/styles.css ${js.join(' ')} --minify --allow-overwrite --outbase=. --outdir=.`,
  { stdio: 'inherit' }
);
