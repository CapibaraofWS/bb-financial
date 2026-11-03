// ============================================================
// COMPARTIR EL RESULTADO DE UNA CALCULADORA: WhatsApp, X, imagen con la marca de BB Finanzas y copiar enlace.
// Solo en calculadoras cuyo resultado no tiene datos personales (sueldos e ingresos del hogar quedan afuera).
// Uso: BBCompartir.montar(caja, { nombre, archivo, dato }) — dato() devuelve { titulo, valor, linea, texto } o null.
// ============================================================
window.BBCompartir = (function () {
  const AVISO = 'Cuenta orientativa: los valores reales pueden variar.';

  function imagen(nombre, r) {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1080;
    const x = c.getContext('2d'), M = 90;
    x.fillStyle = '#0a0c0f'; x.fillRect(0, 0, 1080, 1080);
    x.fillStyle = '#4ade9a'; x.font = '500 40px Outfit, Arial, sans-serif'; x.fillText(nombre, M, 170, 900);
    x.fillStyle = '#9aa5b8'; x.font = '400 46px Outfit, Arial, sans-serif'; x.fillText(r.titulo, M, 330, 900);
    x.fillStyle = '#e8edf5'; x.font = '400 150px "DM Serif Display", Georgia, serif'; x.fillText(r.valor, M, 520, 900);
    x.fillStyle = '#9aa5b8'; x.font = '400 46px Outfit, Arial, sans-serif'; x.fillText(r.linea, M, 620, 900);
    x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(M, 880, 900, 2);
    x.fillStyle = '#4ade9a'; x.font = '500 44px Outfit, Arial, sans-serif'; x.fillText('bbfinanzas.com.ar', M, 960);
    x.fillStyle = '#9aa5b8'; x.font = '400 30px Outfit, Arial, sans-serif'; x.fillText(AVISO, M, 1010, 900);
    return new Promise(ok => c.toBlob(ok, 'image/png'));
  }

  function montar(caja, { nombre, archivo, dato }) {
    if (!caja) return;
    caja.classList.add('bb-comp');
    caja.innerHTML = '<button type="button" data-c="wpp">WhatsApp</button><button type="button" data-c="x">X</button><button type="button" data-c="img">Imagen</button>' +
      '<button type="button" data-c="copiar">Copiar enlace</button>' + (navigator.share ? '<button type="button" data-c="mas">Más…</button>' : '');
    caja.addEventListener('click', async e => {
      const b = e.target.closest('button'), r = b && dato();
      if (!r) return;
      const accion = b.dataset.c, url = location.href, txt = r.texto;
      if (window.bbTrack) window.bbTrack('compartir', { calculadora: archivo, canal: accion });
      if (accion === 'wpp') return void window.open('https://wa.me/?text=' + encodeURIComponent(txt + ' ' + url), '_blank', 'noopener');
      if (accion === 'x') return void window.open('https://x.com/intent/post?text=' + encodeURIComponent(txt) + '&url=' + encodeURIComponent(url), '_blank', 'noopener');
      if (accion === 'copiar') {
        try { await navigator.clipboard.writeText(url); b.textContent = 'Copiado'; setTimeout(() => { b.textContent = 'Copiar enlace'; }, 1800); } catch (err) { prompt('Copiá este enlace:', url); }
        return;
      }
      if (accion === 'mas') { try { await navigator.share({ text: txt, url }); } catch (err) {} return; }
      const blob = await imagen(nombre, r); if (!blob) return;
      const f = new File([blob], archivo + '-bb-finanzas.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], text: txt }); } catch (err) {} return; }
      const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000);
    });
  }
  return { montar };
})();
