// bond-math.js — Funciones puras para cálculo de bonos.
// Todas las funciones son side-effect-free y trabajan sobre primitivos / arrays.
// Cargar via <script src="../js/bond-math.js"></script> — expone window.BondMath.
//
// Convenciones:
//   - Tasas se reciben/devuelven en forma decimal (0.05 = 5%), salvo helpers fmt*.
//   - Precios y flujos en la moneda del bono (no se convierte).
//   - Tiempos en años (fracciones permitidas).
//   - schedule = [{ t, amort, cupon }] donde t = años desde hoy hasta el flujo.

(function (root) {
  'use strict';

  function isFiniteNum(x) { return typeof x === 'number' && Number.isFinite(x); }

  // ---------- BULLET (cupón fijo, capital al final) ----------

  // Precio bullet dado yield y. m = frecuencia anual.
  function priceBullet(VN, cuponAnualPct, m, years, y) {
    const c = (cuponAnualPct / m) * VN;
    const n = Math.round(years * m);
    let p = 0;
    for (let k = 1; k <= n; k++) p += c / Math.pow(1 + y / m, k);
    p += VN / Math.pow(1 + y / m, n);
    return p;
  }

  // ---------- TIR genérica desde schedule de flujos ----------
  // schedule: [{ t: añosDesdeHoy, cf: flujo total }]
  // P = precio sucio (lo que se paga hoy)
  // Devuelve y anual (compounding continuo discretizado por t).
  // Resuelve con bisección: robusto, sin derivadas.
  function ytmFromSchedule(P, schedule) {
    if (!isFiniteNum(P) || P <= 0 || !Array.isArray(schedule) || schedule.length === 0) return NaN;
    const sumCF = schedule.reduce((s, f) => s + (isFiniteNum(f.cf) ? f.cf : 0), 0);
    if (sumCF <= P) return NaN; // si la suma de flujos no supera el precio, no hay TIR positiva

    function npv(y) {
      let v = 0;
      for (const f of schedule) v += f.cf / Math.pow(1 + y, f.t);
      return v - P;
    }

    let lo = -0.5, hi = 5.0;
    let fLo = npv(lo), fHi = npv(hi);
    if (!isFiniteNum(fLo) || !isFiniteNum(fHi)) return NaN;
    if (fLo * fHi > 0) {
      // expandir hi si hace falta
      for (let i = 0; i < 6 && fLo * fHi > 0; i++) { hi *= 2; fHi = npv(hi); }
      if (fLo * fHi > 0) return NaN;
    }
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const f = npv(mid);
      if (!isFiniteNum(f)) return NaN;
      if (Math.abs(f) < 1e-8 || (hi - lo) < 1e-10) return mid;
      if (f * fLo < 0) { hi = mid; fHi = f; } else { lo = mid; fLo = f; }
    }
    return (lo + hi) / 2;
  }

  // ---------- Macaulay Duration desde schedule ----------
  // Devuelve duration en años.
  function macaulayDuration(P, schedule, y) {
    if (!isFiniteNum(P) || P <= 0 || !isFiniteNum(y) || !Array.isArray(schedule)) return NaN;
    let weighted = 0;
    for (const f of schedule) {
      const pv = f.cf / Math.pow(1 + y, f.t);
      weighted += f.t * pv;
    }
    return weighted / P;
  }

  // ---------- Modified Duration ----------
  // Para schedule con t en años y y anual: D_mod = D_mac / (1 + y).
  // (Convención de capitalización continua-en-base-anual. Para frec m: usar (1 + y/m) ajustando t.)
  function modifiedDuration(macDur, y, m) {
    if (!isFiniteNum(macDur) || !isFiniteNum(y)) return NaN;
    const mm = isFiniteNum(m) && m > 0 ? m : 1;
    return macDur / (1 + y / mm);
  }

  // ---------- Convexity ----------
  // C = Σ [t(t+1) × CF/(1+y)^(t+2)] / P
  function convexity(P, schedule, y) {
    if (!isFiniteNum(P) || P <= 0 || !isFiniteNum(y) || !Array.isArray(schedule)) return NaN;
    let sum = 0;
    for (const f of schedule) {
      sum += f.t * (f.t + 1) * f.cf / Math.pow(1 + y, f.t + 2);
    }
    return sum / P;
  }

  // ---------- Cambio estimado de precio (1er + 2do orden) ----------
  function priceChangeEstimate(P, modDur, conv, deltaY) {
    if (!isFiniteNum(P) || !isFiniteNum(modDur) || !isFiniteNum(deltaY)) return NaN;
    const c = isFiniteNum(conv) ? conv : 0;
    return (-modDur * deltaY + 0.5 * c * deltaY * deltaY) * P;
  }

  // ---------- Intereses corridos (lineal, día/día entre fechas de cupón) ----------
  function accruedInterest(cuponPeriodo, diasDesdeUltCupon, diasEntreCupones) {
    if (!isFiniteNum(cuponPeriodo) || !isFiniteNum(diasDesdeUltCupon) || !isFiniteNum(diasEntreCupones) || diasEntreCupones <= 0) return 0;
    return cuponPeriodo * (diasDesdeUltCupon / diasEntreCupones);
  }

  // ---------- Paridad (precio sucio / valor técnico × 100) ----------
  function paridad(precioSucio, valorTecnico) {
    if (!isFiniteNum(precioSucio) || !isFiniteNum(valorTecnico) || valorTecnico <= 0) return NaN;
    return (precioSucio / valorTecnico) * 100;
  }

  // ---------- Yield (rendimiento) a precio para zero-coupon ----------
  // P = VN / (1 + y)^t  =>  y = (VN/P)^(1/t) - 1
  function yieldZeroCoupon(VN, P, years) {
    if (!isFiniteNum(VN) || !isFiniteNum(P) || P <= 0 || !isFiniteNum(years) || years <= 0) return NaN;
    return Math.pow(VN / P, 1 / years) - 1;
  }

  // ---------- Generador de schedule para bono bullet ----------
  // Útil para tests y para Treasuries.
  function bulletSchedule(VN, cuponAnualPct, m, years) {
    const cf = (cuponAnualPct / m) * VN;
    const n = Math.round(years * m);
    const sched = [];
    for (let k = 1; k <= n; k++) {
      sched.push({ t: k / m, cf: cf + (k === n ? VN : 0) });
    }
    return sched;
  }

  // ---------- Spread sobre Treasury ----------
  function spreadBps(tirBono, yieldTreasury) {
    if (!isFiniteNum(tirBono) || !isFiniteNum(yieldTreasury)) return NaN;
    return (tirBono - yieldTreasury) * 10000;
  }

  // ---------- Tests numéricos (corre desde consola: BondMath._test()) ----------
  function _test() {
    const results = [];
    function ok(name, actual, expected, tol) {
      const t = tol == null ? 1e-4 : tol;
      const pass = Math.abs(actual - expected) < t;
      results.push({ test: name, expected, actual, pass });
      return pass;
    }

    // Test 1: bono bullet 5% cupón, 3 años, yield 5%, anual → precio = 100
    const p1 = priceBullet(100, 0.05, 1, 3, 0.05);
    ok('Bullet 5%/3y/y=5% → P=100', p1, 100, 1e-6);

    // Test 2: zero-coupon: VN=100, P=80, 5y → y = (100/80)^(1/5) - 1 ≈ 0.04564
    const y2 = yieldZeroCoupon(100, 80, 5);
    ok('ZC 100/80/5y → y≈4.564%', y2, 0.045639, 1e-4);

    // Test 3: TIR desde schedule (mismo bono bullet 5%/3y/anual a precio 100) → y=5%
    const s3 = bulletSchedule(100, 0.05, 1, 3);
    const y3 = ytmFromSchedule(100, s3);
    ok('YTM bullet 5%/3y a P=100 → y=5%', y3, 0.05, 1e-5);

    // Test 4: Macaulay duration bullet 5%/3y/y=5%/anual → conocido ≈ 2.859
    const dMac4 = macaulayDuration(100, s3, 0.05);
    ok('Macaulay bullet 5%/3y/y=5% ≈ 2.859', dMac4, 2.8594, 1e-3);

    // Test 5: Modified duration = Mac / (1+y) → ≈ 2.723
    const dMod5 = modifiedDuration(dMac4, 0.05, 1);
    ok('ModDur ≈ 2.723', dMod5, 2.7232, 1e-3);

    // Test 6: Convexity bullet 5%/3y/y=5% ≈ 10.2056 (calculado: Σ t(t+1)CF/(1+y)^(t+2) / P)
    const c6 = convexity(100, s3, 0.05);
    ok('Convexity ≈ 10.2056', c6, 10.2056, 1e-3);

    // Test 7: precio bullet 5%/3y a yield 7% (anual) ≈ 94.749
    const p7 = priceBullet(100, 0.05, 1, 3, 0.07);
    ok('Bullet 5%/3y/y=7% → P≈94.75', p7, 94.7515, 1e-2);

    // Test 8: spread 10% vs 4% → 600 bps
    ok('spreadBps(0.10, 0.04) = 600', spreadBps(0.10, 0.04), 600, 1e-6);

    const allPass = results.every(r => r.pass);
    if (typeof console !== 'undefined') {
      console.log('%c[BondMath tests]', 'color:#4ade9a;font-weight:bold', allPass ? 'ALL PASS' : 'FAIL');
      console.table(results);
    }
    return { allPass, results };
  }

  root.BondMath = {
    priceBullet,
    bulletSchedule,
    ytmFromSchedule,
    macaulayDuration,
    modifiedDuration,
    convexity,
    priceChangeEstimate,
    accruedInterest,
    paridad,
    yieldZeroCoupon,
    spreadBps,
    _test,
  };
})(typeof window !== 'undefined' ? window : globalThis);
