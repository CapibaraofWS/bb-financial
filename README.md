# FinCalc — Sitio Web Financiero

Calculadoras financieras gratuitas con SEO optimizado.

## Estructura del proyecto

```
finanzas-web/
├── index.html                  ← Página principal
├── css/
│   └── styles.css              ← Sistema de diseño completo
├── js/
│   └── main.js                 ← Scripts globales (menú, animaciones, formateo)
└── pages/
    ├── interes-compuesto.html  ← Calculadora interés compuesto
    ├── interes-simple.html     ← Calculadora interés simple
    ├── ahorro.html             ← Proyección de ahorro
    └── meta-financiera.html    ← Meta financiera: ahorro vs inversión
```

## Cómo abrir en VS Code

1. Abrí VS Code
2. `Archivo → Abrir carpeta` → seleccioná `finanzas-web/`
3. Instalá la extensión **Live Server** (ritwickdey.LiveServer)
4. Click derecho en `index.html` → `Open with Live Server`
5. Se abre en `http://127.0.0.1:5500`

## Extensiones recomendadas para VS Code

```json
{
  "recommendations": [
    "ritwickdey.LiveServer",
    "esbenp.prettier-vscode",
    "formulahendry.auto-rename-tag",
    "bradlc.vscode-tailwindcss",
    "streetsidesoftware.code-spell-checker-spanish"
  ]
}
```

## SEO implementado

- Meta tags completos (description, keywords, robots, canonical)
- Open Graph para redes sociales
- Twitter Cards
- Schema.org / JSON-LD (WebApplication, WebPage, BreadcrumbList)
- Atributos `lang="es"` y `aria-*` para accesibilidad
- URLs canónicas
- Títulos únicos por página

## Para publicar online (opciones gratuitas)

### GitHub Pages
1. Subí a un repositorio público en GitHub
2. Settings → Pages → Source: main branch / root
3. Tu sitio queda en `https://tuusuario.github.io/finanzas-web/`

### Netlify (recomendado)
1. Creá cuenta en netlify.com
2. Arrastrá la carpeta `finanzas-web/` a la zona de deploy
3. Obtés URL automática tipo `https://fincalc.netlify.app`

### Vercel
1. `npm i -g vercel`
2. `vercel` dentro de la carpeta del proyecto

## Personalización

- **Colores**: modificá las variables CSS en `:root` dentro de `css/styles.css`
- **Moneda**: reemplazá el símbolo `$` en los HTML por el que necesites (USD, €, etc.)
- **Tasas de ejemplo**: ajustá los `value=""` en los inputs de cada calculadora
- **Dominio**: actualizá todas las URLs `https://fincalc.app` con tu dominio real

## Tecnologías usadas

- HTML5 semántico
- CSS3 (custom properties, grid, flexbox, animaciones)
- JavaScript vanilla (sin frameworks)
- Chart.js 4.4 (gráficos, cargado desde CDN)
- Google Fonts (DM Serif Display + Outfit + DM Mono)
