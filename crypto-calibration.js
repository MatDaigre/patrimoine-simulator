(() => {
  'use strict';

  if (typeof state === 'undefined' || typeof marketMonth !== 'function') return;

  /*
    Patrimoine Simulator V2.1 — calibration crypto
    Objectif pédagogique :
    - conserver une volatilité nettement supérieure aux actions ;
    - conserver les cycles et chocs du moteur principal ;
    - réduire les trajectoires exponentielles / quasi-ruineuses sur 20–40 ans.
    La crypto reste un actif spéculatif : ce réglage n'est pas une prévision.
  */
  const CORE_MARKET_MONTH_V21 = marketMonth;
  const CRYPTO_RETURN_SCALE = 0.40;
  const CRYPTO_MONTH_FLOOR = -0.42;
  const CRYPTO_MONTH_CAP = 0.60;

  marketMonth = function () {
    const before = Math.max(0, Number(state.crypto) || 0);
    const result = CORE_MARKET_MONTH_V21();

    if (before > 0) {
      const afterCore = Math.max(0, Number(state.crypto) || 0);
      const rawReturn = afterCore / before - 1;

      if (Number.isFinite(rawReturn)) {
        const adjustedReturn = Math.max(
          CRYPTO_MONTH_FLOOR,
          Math.min(CRYPTO_MONTH_CAP, rawReturn * CRYPTO_RETURN_SCALE)
        );
        state.crypto = Math.max(0, before * (1 + adjustedReturn));

        if (state.market?.lastReturns) {
          state.market.lastReturns.crypto = adjustedReturn;
        }
      }
    }

    return result;
  };

  const coreRenderV21 = render;
  render = function () {
    const result = coreRenderV21();
    const chip = document.querySelector('.version-chip');
    if (chip) chip.textContent = 'V2.1 • stable';
    return result;
  };
})();
