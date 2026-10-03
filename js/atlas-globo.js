/* Globo del Atlas: d3-geo dibujando en un canvas 2D. Sin WebGL, así que es
   liviano y anda en cualquier celular. Necesita js/vendor/atlas-geo.min.js.

   const g = AtlasGlobo(canvas, { base: '../../', auto: true, onPais: (iso, nombre, xy) => {} });
   g.set({ resaltes: { '158': ['#4ade9a', 1] }, arcos: [{ de: '158', a: '156', w: 2, c: '#4ade9a' }], etiquetas: ['158'] });
   g.girarA([121, 23]);                                                       */
(function () {
  'use strict';
  const REDUCIR = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Nombre y centro aproximado [lon, lat] de cada país, para arcos y etiquetas.
  // Singapur y Hong Kong no entran en el mapa 1:110m: se dibujan como un punto.
  const P = {
    '840': ['EE.UU.', -98, 39],          '158': ['Taiwán', 121, 23.7],
    '156': ['China', 108, 33],           '344': ['Hong Kong', 114.2, 22.3, 1],
    '410': ['Corea del Sur', 127.8, 36.3], '392': ['Japón', 138.5, 36.5],
    '528': ['Países Bajos', 5.3, 52.2],  '276': ['Alemania', 10.4, 51.1],
    '826': ['Reino Unido', -2, 53],      '458': ['Malasia', 102, 4],
    '702': ['Singapur', 103.8, 1.35, 1], '704': ['Vietnam', 106, 16],
    '356': ['India', 79, 22],            '484': ['México', -102, 23.6],
    '076': ['Brasil', -51, -10],         '032': ['Argentina', -65, -35],
    '804': ['Ucrania', 31, 49],          '643': ['Rusia', 90, 61],
    // Energía
    '634': ['Qatar', 51.2, 25.3],        '036': ['Australia', 134, -25],
    '360': ['Indonesia', 113, -1],       '566': ['Nigeria', 8, 9.5],
    '512': ['Omán', 57, 21],             '012': ['Argelia', 2.6, 28],
    '780': ['Trinidad y Tobago', -61.3, 10.5], '598': ['Papúa Nueva Guinea', 144, -6.5],
    '784': ['Emiratos Árabes', 54, 24],  '024': ['Angola', 17.5, -12],
    '096': ['Brunéi', 114.7, 4.5],       '604': ['Perú', -75, -10],
    '508': ['Mozambique', 35, -18],      '578': ['Noruega', 9, 61],
    '124': ['Canadá', -106, 57],         '818': ['Egipto', 30, 27],
    '250': ['Francia', 2.5, 46.5],       '724': ['España', -3.5, 40],
    '380': ['Italia', 12.5, 42.8],       '792': ['Turquía', 35, 39],
    '764': ['Tailandia', 101, 15],       '056': ['Bélgica', 4.6, 50.6],
    '050': ['Bangladés', 90, 24],        '414': ['Kuwait', 47.6, 29.3],
    '586': ['Pakistán', 69, 30],         '616': ['Polonia', 19, 52],
    '364': ['Irán', 54, 32],             '795': ['Turkmenistán', 59, 39],
  };
  window.AtlasPaises = P;
  // Acepta un país (código) o un punto [lon, lat]
  const coord = iso => (Array.isArray(iso) ? iso : P[iso] ? [P[iso][1], P[iso][2]] : null);

  let mundoP = null;
  function cargarMundo(base) {
    if (!mundoP) {
      mundoP = fetch(base + 'data/atlas/countries-110m.json')
        .then(r => { if (!r.ok) throw new Error('mapa ' + r.status); return r.json(); })
        .then(t => ({
          paises: topojson.feature(t, t.objects.countries).features,
          tierra: topojson.feature(t, t.objects.land),
          bordes: topojson.mesh(t, t.objects.countries, (a, b) => a !== b),
        }));
    }
    return mundoP;
  }

  const easing = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  window.AtlasGlobo = function (canvas, op) {
    op = op || {};
    const ctx = canvas.getContext('2d');
    const proj = d3.geoOrthographic().clipAngle(90).precision(0.6);
    const path = d3.geoPath(proj, ctx);
    const grat = d3.geoGraticule10();
    const esfera = { type: 'Sphere' };

    let rot = op.foco ? [-op.foco[0], -op.foco[1], 0] : [60, -20, 0];
    let dest = null, auto = !!op.auto && !REDUCIR, pausaHasta = 0;
    let resaltes = {}, arcos = [], etiquetas = [], rutas = [], puntos = [], hover = null, datos = null;
    let dpr = 1, W = 0, H = 0, R = 0, cx = 0, cy = 0;
    let visible = false, raf = 0, ult = 0, arrastre = null;

    function medir() {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      R = Math.min(W, H) / 2 * 0.88; cx = W / 2; cy = H / 2;
      pedir(true);
    }

    // Proyección a mano (ortográfica) para poder "levantar" los arcos sobre la superficie
    function xyz(p) {
      const q = d3.geoRotation(rot)(p);
      const l = q[0] * Math.PI / 180, f = q[1] * Math.PI / 180;
      return [Math.cos(f) * Math.sin(l), Math.sin(f), Math.cos(f) * Math.cos(l)];
    }

    function pill(x, y, txt, color) {
      ctx.font = '500 11px Outfit, system-ui, sans-serif';
      const w = ctx.measureText(txt).width + 14, h = 20;
      const X = Math.max(2, Math.min(W - w - 2, x - w / 2)), Y = y - h - 8;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(X, Y, w, h, 10); else ctx.rect(X, Y, w, h);
      ctx.fillStyle = 'rgba(13,17,23,0.88)'; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#e8edf5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, X + w / 2, Y + h / 2 + 0.5);
    }

    function dibujar(t) {
      if (!W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      proj.translate([cx, cy]).scale(R).rotate(rot);

      const halo = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.14);
      halo.addColorStop(0, 'rgba(74,222,154,0.13)'); halo.addColorStop(1, 'rgba(74,222,154,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 1.14, 0, 2 * Math.PI); ctx.fill();

      const mar = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      mar.addColorStop(0, '#1b232e'); mar.addColorStop(1, '#0c1016');
      ctx.beginPath(); path(esfera); ctx.fillStyle = mar; ctx.fill();
      ctx.beginPath(); path(grat); ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 0.6; ctx.stroke();

      if (datos) {
        ctx.beginPath(); path(datos.tierra); ctx.fillStyle = '#2a3240'; ctx.fill();
        for (const f of datos.paises) {
          const r = resaltes[f.id] || (hover === f.id ? ['#e8edf5', 0.18] : null);
          if (!r) continue;
          ctx.beginPath(); path(f); ctx.globalAlpha = r[1]; ctx.fillStyle = r[0]; ctx.fill(); ctx.globalAlpha = 1;
        }
        ctx.beginPath(); path(datos.bordes); ctx.strokeStyle = 'rgba(10,12,15,0.75)'; ctx.lineWidth = 0.5; ctx.stroke();
        if (hover && !P[hover]?.[3]) {
          const f = datos.paises.find(x => x.id === hover);
          if (f) { ctx.beginPath(); path(f); ctx.strokeStyle = 'rgba(232,237,245,0.8)'; ctx.lineWidth = 1; ctx.stroke(); }
        }
      }
      ctx.beginPath(); path(esfera); ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; ctx.stroke();

      // Países que son un punto (Singapur, Hong Kong)
      for (const iso in resaltes) {
        if (!P[iso] || !P[iso][3]) continue;
        const v = xyz(coord(iso)); if (v[2] <= 0) continue;
        ctx.beginPath(); ctx.arc(cx + R * v[0], cy - R * v[1], 4, 0, 2 * Math.PI);
        ctx.fillStyle = resaltes[iso][0]; ctx.globalAlpha = Math.max(0.6, resaltes[iso][1]); ctx.fill(); ctx.globalAlpha = 1;
      }

      // Arcos levantados sobre la superficie, con un punto que viaja
      for (const a of arcos) {
        const k = REDUCIR ? 1 : Math.min(1, Math.max(0, (t - a.t0) / 900));
        if (!k) continue;
        const n = 56, alto = Math.min(0.2, a.d * 0.1);
        const punto = j => {
          const v = xyz(a.i(j)), h = 1 + alto * Math.sin(Math.PI * j);
          const vis = v[2] > -0.08; // lo que pasa por detrás del globo no se dibuja
          return [cx + R * h * v[0], cy - R * h * v[1], vis];
        };
        ctx.beginPath();
        let abierto = false;
        for (let j = 0; j <= n * k; j++) {
          const q = punto(j / n);
          if (!q[2]) { abierto = false; continue; }
          if (abierto) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); abierto = true; }
        }
        ctx.strokeStyle = a.c; ctx.lineWidth = a.w; ctx.lineCap = 'round';
        ctx.globalAlpha = a.apagado ? 0.15 : 0.85; ctx.stroke(); ctx.globalAlpha = 1;
        if (!REDUCIR && k === 1 && !a.apagado) {
          const q = punto(((t - a.t0) / 2600 + a.fase) % 1);
          if (q[2]) {
            ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(2, a.w * 0.9), 0, 2 * Math.PI);
            ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
          }
        }
      }

      // Rutas marítimas: siguen puntos de paso, pegadas a la superficie
      for (const r of rutas) {
        ctx.beginPath();
        let abierto = false;
        for (const p of r.xy) {
          const v = xyz(p);
          if (v[2] <= 0) { abierto = false; continue; }
          const x = cx + R * v[0], y = cy - R * v[1];
          if (abierto) ctx.lineTo(x, y); else { ctx.moveTo(x, y); abierto = true; }
        }
        ctx.strokeStyle = r.c; ctx.lineWidth = r.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.setLineDash(r.corte ? [3, 5] : []);
        ctx.globalAlpha = r.apagado ? 0.16 : r.corte ? 0.7 : 0.9; ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);
        if (!REDUCIR && !r.apagado && !r.corte) {
          const v = xyz(r.xy[Math.floor((((t / r.ms) + r.fase) % 1) * (r.xy.length - 1))]);
          if (v[2] > 0) { ctx.beginPath(); ctx.arc(cx + R * v[0], cy - R * v[1], 2.4, 0, 2 * Math.PI); ctx.fillStyle = '#fff'; ctx.fill(); }
        }
      }
      for (const q of puntos) {
        const v = xyz(q.p); if (v[2] <= 0.05) continue;
        const x = cx + R * v[0], y = cy - R * v[1], rr = q.r || 4;
        if (q.pulso && !REDUCIR) {
          const k = (t / 1600) % 1;
          ctx.beginPath(); ctx.arc(x, y, rr + k * 12, 0, 2 * Math.PI); ctx.strokeStyle = q.c; ctx.lineWidth = 1.5; ctx.globalAlpha = 1 - k; ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.beginPath(); ctx.arc(x, y, rr, 0, 2 * Math.PI); ctx.fillStyle = q.c; ctx.fill();
        ctx.strokeStyle = 'rgba(10,12,15,0.8)'; ctx.lineWidth = 1; ctx.stroke();
        if (q.t) pill(x, y - 2, q.t, q.c);
      }

      for (const iso of etiquetas) {
        const c = coord(iso); if (!c) continue;
        const v = xyz(c); if (v[2] < 0.15) continue;
        pill(cx + R * v[0], cy - R * v[1], P[iso][0], (resaltes[iso] || ['rgba(255,255,255,0.3)'])[0]);
      }
    }

    function animando() {
      return dest || arrastre || (auto && !REDUCIR) || (!REDUCIR && (arcos.length || rutas.length || puntos.some(q => q.pulso)));
    }
    function tick(t) {
      raf = 0;
      const dt = ult ? Math.min(50, t - ult) : 16; ult = t;
      if (dest) {
        const k = Math.min(1, (t - dest.t0) / dest.ms), e = easing(k);
        rot = [dest.a[0] + dest.d[0] * e, dest.a[1] + dest.d[1] * e, 0];
        if (k === 1) dest = null;
      } else if (auto && !arrastre && t > pausaHasta) rot[0] += dt * 0.006;
      dibujar(t);
      if (visible && animando()) raf = requestAnimationFrame(tick); else ult = 0;
    }
    function pedir() { if (!raf && visible) raf = requestAnimationFrame(tick); }

    function girarA(p, ms) {
      const a = [rot[0], rot[1]];
      const b = [-p[0], Math.max(-55, Math.min(55, -p[1]))];
      const d0 = ((b[0] - a[0] + 540) % 360) - 180;
      dest = { a, d: [d0, b[1] - a[1]], t0: performance.now(), ms: REDUCIR ? 1 : (ms || 1200) };
      pedir();
    }

    function set(o) {
      if (o.resaltes) resaltes = o.resaltes;
      if (o.etiquetas) etiquetas = o.etiquetas;
      if (o.arcos) {
        const t0 = performance.now();
        arcos = o.arcos.filter(a => coord(a.de) && coord(a.a)).map((a, i) => {
          const A = coord(a.de), B = coord(a.a);
          return { c: a.c || '#4ade9a', w: a.w || 1.6, apagado: !!a.apagado, i: d3.geoInterpolate(A, B), d: d3.geoDistance(A, B), t0: o.sinAnim ? 0 : t0 + i * 120, fase: (i * 0.17) % 1 };
        });
      }
      if (o.rutas) {
        rutas = o.rutas.map((r, i) => {
          // Cada tramo se interpola por el círculo máximo, con más puntos cuanto más largo
          const xy = [];
          for (let j = 0; j < r.pts.length - 1; j++) {
            const it = d3.geoInterpolate(r.pts[j], r.pts[j + 1]);
            const n = Math.max(2, Math.ceil(d3.geoDistance(r.pts[j], r.pts[j + 1]) * 40));
            for (let k = j ? 1 : 0; k <= n; k++) xy.push(it(k / n));
          }
          return { xy, c: r.c || '#60a5fa', w: r.w || 1.6, corte: !!r.corte, apagado: !!r.apagado, ms: 3000 + xy.length * 90, fase: (i * 0.23) % 1 };
        });
      }
      if (o.puntos) puntos = o.puntos;
      if (o.foco) girarA(o.foco, o.ms);
      if ('auto' in o) auto = !!o.auto && !REDUCIR;
      pedir();
    }

    // País bajo el puntero (los países-punto se buscan por distancia en pantalla)
    function paisEn(x, y) {
      for (const iso in P) {
        if (!P[iso][3]) continue;
        const v = xyz(coord(iso));
        if (v[2] > 0 && Math.hypot(cx + R * v[0] - x, cy - R * v[1] - y) < 12) return iso;
      }
      if (!datos || Math.hypot(x - cx, y - cy) > R) return null;
      const ll = proj.invert([x, y]);
      if (!ll) return null;
      const f = datos.paises.find(p => d3.geoContains(p, ll));
      return f ? f.id : null;
    }
    const nombre = iso => (P[iso] ? P[iso][0] : (datos?.paises.find(p => p.id === iso)?.properties.name || ''));

    canvas.style.touchAction = 'pan-y';
    canvas.addEventListener('pointerdown', e => {
      const r = canvas.getBoundingClientRect();
      arrastre = { x: e.clientX, y: e.clientY, rot: rot.slice(), mov: 0, toque: e.pointerType === 'touch', r };
      dest = null; pausaHasta = performance.now() + 4000;
      canvas.setPointerCapture?.(e.pointerId);
      pedir();
    });
    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      if (arrastre) {
        const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
        arrastre.mov = Math.max(arrastre.mov, Math.hypot(dx, dy));
        const k = 75 / R;
        rot[0] = arrastre.rot[0] + dx * k;
        if (!arrastre.toque) rot[1] = Math.max(-60, Math.min(60, arrastre.rot[1] - dy * k));
        pausaHasta = performance.now() + 4000;
        pedir();
      } else if (e.pointerType === 'mouse' && op.onPais) {
        const iso = paisEn(e.clientX - r.left, e.clientY - r.top);
        if (iso !== hover) { hover = iso; canvas.style.cursor = iso ? 'pointer' : 'grab'; pedir(); if (!animando()) dibujar(performance.now()); }
      }
    });
    const soltar = e => {
      if (!arrastre) return;
      const a = arrastre; arrastre = null;
      if (e.type === 'pointerup' && a.mov < 6 && (op.onPais || op.onPunto)) {
        const x = e.clientX - a.r.left, y = e.clientY - a.r.top;
        const q = op.onPunto && puntos.find(q => { const v = xyz(q.p); return q.id && v[2] > 0 && Math.hypot(cx + R * v[0] - x, cy - R * v[1] - y) < 16; });
        if (q) { op.onPunto(q.id, [x, y]); pedir(); return; }
        if (!op.onPais) { pedir(); return; }
        const iso = paisEn(x, y);
        hover = iso;
        op.onPais(iso, iso ? nombre(iso) : '', [x, y]);
      }
      pedir();
      if (!animando()) dibujar(performance.now());
    };
    canvas.addEventListener('pointerup', soltar);
    canvas.addEventListener('pointercancel', soltar);
    canvas.addEventListener('pointerleave', () => { if (hover && !arrastre) { hover = null; dibujar(performance.now()); } });

    new ResizeObserver(medir).observe(canvas);
    new IntersectionObserver(es => {
      visible = es.some(e => e.isIntersecting);
      if (visible) { pedir(); dibujar(performance.now()); }
    }).observe(canvas);

    medir();
    cargarMundo(op.base || '').then(d => { datos = d; dibujar(performance.now()); pedir(); }).catch(() => {
      canvas.setAttribute('aria-label', 'No se pudo cargar el mapa.');
    });

    return { set, girarA, nombre, redibujar: () => dibujar(performance.now()) };
  };
})();
