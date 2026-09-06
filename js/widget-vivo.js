// ============================================================
// WIDGETS VIVOS PARA EL BLOG
// Una nota que explica las tasas pero no muestra las de hoy se lee una vez y
// se abandona. Estos bloques traen el dato actual dentro del texto, para que
// el artículo siga sirviendo dentro de seis meses.
//
// Uso:  <div class="widget-vivo" data-tipo="tasas"></div>
//       tipos: tasas | dolar | inflacion
// ============================================================
(function widgetsVivos() {
  const nodos = [...document.querySelectorAll('.widget-vivo[data-tipo]')];
  if (!nodos.length) return;

  const base = location.pathname.includes('/blog/') ? '../../' : (location.pathname.includes('/pages/') ? '../' : '');
  const num = (n, d = 0) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

  async function json(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  }
  const bcraVar = (bcra, id) => {
    const v = bcra && bcra.results ? bcra.results.find(x => x.idVariable === id) : null;
    return v && Number.isFinite(v.ultValorInformado) ? v : null;
  };

  const TIPOS = {
    async tasas() {
      const [pf, bcra] = await Promise.all([
        json('/api/argentinadatos?path=finanzas/tasas/plazoFijo').catch(() => null),
        json('/api/bcra?endpoint=Monetarias&categoria=Principales%20Variables').catch(() => null),
      ]);
      const tasas = (Array.isArray(pf) ? pf : [])
        .map(b => ({ entidad: b.entidad, tna: b.tnaClientes }))
        .filter(b => Number.isFinite(b.tna) && b.tna > 0)
        .sort((a, b) => b.tna - a.tna);
      if (!tasas.length) return null;

      const mejor = tasas[0];
      const tamar = bcraVar(bcra, 44);
      const nombreBanco = mejor.entidad
        .replace(/^BANCO (DE )?(LA )?/i, '')
        .replace(/ S\.?A\.?$/i, '')
        .toLowerCase()
        .replace(/(^|\s)\S/g, s => s.toUpperCase());

      return {
        titulo: 'Las tasas de hoy',
        filas: [
          { k: 'Caja de ahorro', v: '0%', nota: 'no paga nada' },
          { k: 'Plazo fijo, mejor tasa', v: num(mejor.tna * 100, 1) + '%', nota: nombreBanco, destacado: true },
          tamar ? { k: 'TAMAR (referencia mayorista)', v: num(tamar.ultValorInformado, 2) + '%', nota: tamar.ultFechaInformada } : null,
        ].filter(Boolean),
        cta: { texto: 'Comparar todas las tasas', href: base + 'pages/comparador-tasas.html' },
      };
    },

    async dolar() {
      const d = await json('/api/dolar').catch(() => null);
      if (!Array.isArray(d)) return null;
      const casa = c => d.find(x => x.casa === c);
      const of = casa('oficial'), blue = casa('blue'), mep = casa('bolsa');
      if (!blue && !mep) return null;
      const brecha = of && blue && of.venta ? ((blue.venta / of.venta - 1) * 100) : null;
      return {
        titulo: 'El dólar hoy',
        filas: [
          of   ? { k: 'Oficial', v: '$' + num(of.venta) } : null,
          blue ? { k: 'Blue', v: '$' + num(blue.venta), destacado: true } : null,
          mep  ? { k: 'MEP', v: '$' + num(mep.venta), nota: 'el que se compra en el broker' } : null,
          brecha != null ? { k: 'Brecha oficial-blue', v: num(brecha, 1) + '%' } : null,
        ].filter(Boolean),
        cta: { texto: 'Ver todos los tipos de dólar', href: base + 'pages/comparador-dolares.html' },
      };
    },

    async inflacion() {
      const bcra = await json('/api/bcra?endpoint=Monetarias&categoria=Principales%20Variables').catch(() => null);
      const mensual = bcraVar(bcra, 27), anual = bcraVar(bcra, 28), rem = bcraVar(bcra, 29);
      if (!mensual && !anual) return null;
      return {
        titulo: 'La inflación hoy',
        filas: [
          mensual ? { k: 'Último mes', v: num(mensual.ultValorInformado, 1) + '%', nota: mensual.ultFechaInformada, destacado: true } : null,
          anual   ? { k: 'Últimos 12 meses', v: num(anual.ultValorInformado, 1) + '%' } : null,
          rem     ? { k: 'Esperada a 12 meses (REM)', v: num(rem.ultValorInformado, 1) + '%', nota: 'lo que proyectan los economistas' } : null,
        ].filter(Boolean),
        cta: { texto: 'Calcular cuánto perdiste', href: base + 'pages/inflacion.html' },
      };
    },
  };

  function pintar(nodo, d) {
    if (!d) { nodo.hidden = true; return; }
    const filas = d.filas.map(f =>
      '<div class="wv-fila' + (f.destacado ? ' wv-destacado' : '') + '">' +
        '<span class="wv-k">' + f.k + '</span>' +
        '<span class="wv-v">' + f.v + '</span>' +
        (f.nota ? '<span class="wv-nota">' + f.nota + '</span>' : '') +
      '</div>').join('');
    nodo.innerHTML =
      '<div class="wv-cab"><span class="wv-vivo">● En vivo</span><span class="wv-titulo">' + d.titulo + '</span></div>' +
      '<div class="wv-filas">' + filas + '</div>' +
      '<a class="wv-cta" href="' + d.cta.href + '">' + d.cta.texto + ' →</a>';
    nodo.hidden = false;
  }

  nodos.forEach(async nodo => {
    const fn = TIPOS[nodo.dataset.tipo];
    if (!fn) { nodo.hidden = true; return; }
    nodo.innerHTML = '<p class="wv-cargando">Buscando los datos de hoy…</p>';
    try { pintar(nodo, await fn()); }
    catch { nodo.hidden = true; }   // si la fuente falla, la nota se lee igual
  });
})();
