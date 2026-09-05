// ============================================================
// GRÁFICOS EN PANTALLA CHICA
// Se carga después de Chart.js y antes de que cada página arme sus gráficos,
// así ajusta los valores por defecto una sola vez en vez de tocar 21 páginas.
// En escritorio no cambia nada.
//
// El problema en 375px: el área de dibujo queda en ~310px y las páginas piden
// hasta 10 etiquetas en el eje X. Son ~30px por etiqueta: se pisan, se cortan
// o se rotan hasta quedar ilegibles. Menos marcas y letra un punto más grande
// se lee mejor que muchas marcas apretadas.
// ============================================================
(function chartMobile() {
  if (typeof Chart === 'undefined') return;
  if (!window.matchMedia('(max-width: 720px)').matches) return;

  const d = Chart.defaults;

  // Letra un punto más grande que el default, que en un teléfono se agradece
  d.font.size = 11;

  // La leyenda arriba come alto útil; abajo y compacta deja más lugar al dibujo
  d.plugins.legend.position = 'bottom';
  d.plugins.legend.labels.boxWidth = 10;
  d.plugins.legend.labels.boxHeight = 10;
  d.plugins.legend.labels.padding = 12;
  d.plugins.legend.labels.font = { size: 11 };

  // Tooltips: en touch no hay hover, así que conviene que sean fáciles de
  // disparar y de leer
  d.plugins.tooltip.titleFont = { size: 12 };
  d.plugins.tooltip.bodyFont = { size: 12 };
  d.plugins.tooltip.padding = 10;
  d.elements.point.hitRadius = 14;
  d.elements.point.hoverRadius = 7;

  // Menos marcas en los ejes: es lo que más descomprime el gráfico
  ['category', 'linear', 'logarithmic', 'time', 'timeseries'].forEach(escala => {
    if (!d.scales[escala]) return;
    d.scales[escala].ticks = Object.assign({}, d.scales[escala].ticks, {
      maxTicksLimit: 6,
      autoSkip: true,
      maxRotation: 0,          // etiquetas rotadas en vertical no se leen
      minRotation: 0,
      padding: 6,
    });
  });

  d.layout = d.layout || {};
  d.layout.padding = { top: 4, right: 8, bottom: 0, left: 0 };
})();
