// ============================================================
// ESQUELETOS DE CARGA
// Reemplaza los "Cargando…" en texto pelado por bloques con la forma del
// contenido que está por llegar. La diferencia no es estética: un esqueleto
// dice "acá va a haber una tabla de 5 columnas" y la página no salta cuando
// llegan los datos, mientras que una línea de texto se reemplaza por un bloque
// tres veces más alto y todo se corre de lugar.
//
// Se aplica solo, sin tocar las 15 páginas que tenían el texto: busca los
// placeholders por clase o por forma, y el JS de cada página los pisa igual
// cuando termina de traer sus datos.
// ============================================================
(function esqueletos() {
  const RE_CARGANDO = /^\s*(cargando|buscando|calculando|actualizando)/i;

  function barra(ancho, alto) {
    return '<span class="bb-skel" style="width:' + ancho + ';height:' + (alto || '1rem') + '"></span>';
  }

  // Anchos irregulares: una grilla de barras todas iguales parece una tabla
  // vacía, no algo cargando.
  const ANCHOS = ['72%', '54%', '88%', '46%', '65%', '78%'];

  function comoFila(td) {
    const fila = td.closest('tr');
    const tabla = td.closest('table');
    const cols = td.colSpan > 1
      ? td.colSpan
      : (tabla && tabla.querySelector('thead tr') ? tabla.querySelector('thead tr').children.length : 4);
    const filas = 3;
    let html = '<span class="bb-skel-tabla" role="status" aria-label="Cargando datos">';
    for (let f = 0; f < filas; f++) {
      html += '<span class="bb-skel-fila">';
      for (let c = 0; c < Math.min(cols, 6); c++) {
        html += barra(ANCHOS[(f * 3 + c) % ANCHOS.length], '0.85rem');
      }
      html += '</span>';
    }
    return html + '</span>';
  }

  function comoBloque(el) {
    const alto = el.getBoundingClientRect().height;
    const lineas = alto > 160 ? 4 : 3;
    let html = '<span class="bb-skel-bloque" role="status" aria-label="Cargando datos">';
    for (let i = 0; i < lineas; i++) html += barra(ANCHOS[i % ANCHOS.length], '0.95rem');
    return html + '</span>';
  }

  function transformar(el) {
    if (el.dataset.skel) return;
    const texto = (el.textContent || '').trim();
    if (!RE_CARGANDO.test(texto)) return;
    // El texto original se conserva para lectores de pantalla
    el.dataset.skel = '1';
    el.dataset.skelTexto = texto;
    el.innerHTML = (el.tagName === 'TD' ? comoFila(el) : comoBloque(el)) +
      '<span class="bb-skel-sr">' + texto + '</span>';
  }

  function pasada() {
    // Placeholders de tabla y contenedores marcados como "cargando"
    document.querySelectorAll(
      'td.loading-cell, td[colspan], .loading-cell, .news-loading, .loader, ' +
      '.countdown-loading, .loading-card, .wv-cargando'
    ).forEach(el => {
      // Un td sin texto de carga es una celda normal: no se toca
      if (el.tagName === 'TD' && !RE_CARGANDO.test((el.textContent || '').trim())) return;
      transformar(el);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasada);
  else pasada();

  // Varias tablas se arman después con los datos de las APIs y vuelven a
  // dibujar su propio "Cargando…" mientras tanto.
  // El observador filtra antes de trabajar: el reloj del ticker muta el DOM una
  // vez por segundo y no tiene sentido recorrer la página entera por eso.
  let pendiente = null;
  new MutationObserver(muts => {
    const puedeHaber = muts.some(m =>
      [...m.addedNodes].some(n =>
        n.nodeType === 1 && RE_CARGANDO.test((n.textContent || '').trim())
      )
    );
    if (!puedeHaber) return;
    clearTimeout(pendiente);
    pendiente = setTimeout(pasada, 100);
  }).observe(document.body, { childList: true, subtree: true });
})();
