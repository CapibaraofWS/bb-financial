// safe-math.js — helpers para evitar NaN / Infinity / valores inválidos en calculadoras.
// Uso: window.SafeMath.parseNum(input.value)
(function () {
  'use strict';

  /** parseFloat con default si NaN / Infinity / null / undefined */
  function parseNum(v, def = 0) {
    if (v == null || v === '') return def;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : def;
  }

  /** Como parseNum pero asegura que esté en [min, max] */
  function clampNum(v, min, max, def = 0) {
    const n = parseNum(v, def);
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  }

  /** División segura: evita /0 (Infinity) y 0/0 (NaN) */
  function safeDiv(a, b, def = 0) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return def;
    const r = a / b;
    return Number.isFinite(r) ? r : def;
  }

  /** Math.pow seguro: evita NaN cuando la base es negativa con exponente fraccionario */
  function safePow(base, exp, def = 0) {
    if (!Number.isFinite(base) || !Number.isFinite(exp)) return def;
    if (base < 0 && !Number.isInteger(exp)) return def;
    const r = Math.pow(base, exp);
    return Number.isFinite(r) ? r : def;
  }

  /** Log seguro: solo positivos */
  function safeLog(x, def = 0) {
    if (!Number.isFinite(x) || x <= 0) return def;
    return Math.log(x);
  }

  /** Sqrt seguro: solo no-negativos */
  function safeSqrt(x, def = 0) {
    if (!Number.isFinite(x) || x < 0) return def;
    return Math.sqrt(x);
  }

  /** Asegura que el resultado final sea finite. Para envolver cálculos compuestos. */
  function safeResult(n, def = 0) {
    return Number.isFinite(n) ? n : def;
  }

  /** Formateo defensivo: si el número no es finite, muestra "—" en vez de "NaN" o "Infinity" */
  function fmtSafe(n, formatter, fallback = '—') {
    if (!Number.isFinite(n)) return fallback;
    try { return formatter(n); }
    catch { return fallback; }
  }

  window.SafeMath = { parseNum, clampNum, safeDiv, safePow, safeLog, safeSqrt, safeResult, fmtSafe };
})();
