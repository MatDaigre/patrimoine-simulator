(() => {
'use strict';

if (typeof state === 'undefined' || typeof render !== 'function' || typeof moveAsset !== 'function') {
  console.error('[PEA Integrity V2.1.6] moteur indisponible');
  return;
}

const EPS = 0.01;
const PFU_BEFORE_5Y = 0.314;
const SOCIAL_AFTER_5Y = 0.186;
const PEA_FIVE_YEARS = 60;

const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const clamp0 = v => Math.max(0, n(v));
const currentMonth = () => Math.max(0, n(state.totalMonths));

function ensurePeaState() {
  if (!state.tax || typeof state.tax !== 'object') state.tax = {};
  state.tax.peaCash = clamp0(state.tax.peaCash);
  state.tax.peaContributions = clamp0(state.tax.peaContributions);
  if (!state.basis || typeof state.basis !== 'object') state.basis = {};
  state.basis.pea = clamp0(state.basis.pea);
  state.pea = clamp0(state.pea);
}

function snapshot(inputOverride = null) {
  ensurePeaState();
  const inputEl = document.getElementById('peaAmount');
  const rawInput = inputOverride == null ? n(inputEl?.value) : n(inputOverride);
  return {
    input: Math.max(0, rawInput),
    cash: n(state.cash),
    invested: clamp0(state.pea),
    basis: clamp0(state.basis.pea),
    pocket: clamp0(state.tax.peaCash),
    contributions: clamp0(state.tax.peaContributions),
    opened: state.tax.peaOpenedMonth == null ? null : n(state.tax.peaOpenedMonth),
    total: clamp0(state.pea) + clamp0(state.tax.peaCash)
  };
}

function planAgeMonths(s) {
  return s.opened == null ? 0 : Math.max(0, currentMonth() - s.opened);
}

function setInput(value) {
  const input = document.getElementById('peaAmount');
  if (input) input.value = String(Math.max(0, Math.round(value * 100) / 100));
}

function forceRefresh() {
  ensurePeaState();
  try {
    if (typeof silentSave === 'function') silentSave();
  } catch (_) {}
  render();
}

/* ------------------------------------------------------------------
   1. ACHAT / VENTE À L'INTÉRIEUR DU PEA
   ------------------------------------------------------------------ */

const coreMoveAsset = moveAsset;
let pendingPeaOperation = null;

moveAsset = function(asset, direction) {
  if (asset !== 'pea') return coreMoveAsset(asset, direction);

  const before = snapshot();
  if (before.input <= 0) return coreMoveAsset(asset, direction);

  if (direction === 'in') {
    // Le moteur fiscal effectue l'achat. On contrôle ensuite les invariants.
    const fromPocket = Math.min(before.input, before.pocket);
    const external = Math.max(0, before.input - fromPocket);
    const expectedContributions = before.contributions + external;
    const expectedTotal = before.total + external;
    const performanceBefore = before.total - before.contributions;

    const result = coreMoveAsset(asset, direction);

    ensurePeaState();

    // Un réinvestissement d'espèces internes n'est jamais un nouveau versement.
    // Seule la partie venant de la trésorerie augmente les versements du plan.
    if (Math.abs(state.tax.peaContributions - expectedContributions) > EPS) {
      state.tax.peaContributions = expectedContributions;
    }

    // La performance globale du PEA doit être conservée lors d'une réallocation.
    // Valeur totale - versements = performance historique.
    const afterTotal = clamp0(state.pea) + clamp0(state.tax.peaCash);
    const afterPerformance = afterTotal - clamp0(state.tax.peaContributions);
    if (Math.abs(afterPerformance - performanceBefore) > EPS && external <= EPS) {
      // Réallocation 100 % interne : aucun euro ne doit apparaître/disparaître.
      const targetTotal = before.total;
      const delta = targetTotal - afterTotal;
      state.pea = Math.max(0, state.pea + delta);
    } else if (Math.abs(afterTotal - expectedTotal) > EPS && external > EPS) {
      // Versement externe : la valeur du plan n'augmente que du versement réel.
      const delta = expectedTotal - afterTotal;
      state.pea = Math.max(0, state.pea + delta);
    }

    forceRefresh();
    return result;
  }

  if (direction === 'out') {
    // La vente interne est confirmée dans le modal fiscal.
    pendingPeaOperation = {
      type: 'sell',
      before,
      amount: Math.min(before.input, before.invested)
    };
    return coreMoveAsset(asset, direction);
  }

  return coreMoveAsset(asset, direction);
};

/* ------------------------------------------------------------------
   2. RETRAIT VERS LA TRÉSORERIE
   ------------------------------------------------------------------ */

let pendingWithdraw = null;
let integrityLock = false;

function armWithdrawal() {
  if (integrityLock) return;

  const before = snapshot();

  // Si le joueur n'indique aucun montant, retrait des espèces disponibles.
  if (before.input <= 0 && before.pocket > 0) {
    setInput(before.pocket);
    before.input = before.pocket;
  }

  pendingWithdraw = {
    type: 'withdraw',
    before,
    requested: Math.min(Math.max(0, before.input), before.pocket)
  };
}

function enforceAfterWithdrawal(op) {
  if (!op || integrityLock) return;
  integrityLock = true;

  try {
    ensurePeaState();
    const b = op.before;
    const age = planAgeMonths(b);

    if (age < PEA_FIVE_YEARS) {
      // Avant 5 ans : le retrait clôture le plan entier.
      // On conserve le calcul fiscal effectué par tax-engine.js,
      // mais on impose que tous les actifs du PEA disparaissent réellement.
      state.pea = 0;
      state.basis.pea = 0;
      state.tax.peaCash = 0;
      state.tax.peaContributions = 0;
      state.tax.peaOpenedMonth = null;
      setInput(0);
      forceRefresh();
      return;
    }

    const gross = Math.min(
      op.requested > 0 ? op.requested : b.pocket,
      b.pocket
    );

    if (gross <= EPS) {
      setInput(0);
      forceRefresh();
      return;
    }

    const planValue = Math.max(EPS, b.total);
    const allocatedCapital = b.contributions * (gross / planValue);
    const gain = Math.max(0, gross - allocatedCapital);
    const tax = gain * SOCIAL_AFTER_5Y;

    // Valeurs attendues après UNE transaction.
    const expectedPocket = Math.max(0, b.pocket - gross);
    const expectedContributions = Math.max(0, b.contributions - allocatedCapital);
    const expectedCash = b.cash + gross - tax;

    // On fixe les valeurs à l'état attendu : impossible de retirer deux fois
    // le même euro, même si un ancien handler ou un rendu a conservé une valeur.
    state.tax.peaCash = expectedPocket;
    state.tax.peaContributions = expectedContributions;

    // Le moteur fiscal doit avoir crédité le brut puis prélevé les PS.
    // On corrige seulement s'il existe une divergence comptable.
    if (Math.abs(n(state.cash) - expectedCash) > EPS) {
      state.cash = expectedCash;
    }

    if ((clamp0(state.pea) + expectedPocket) < EPS) {
      state.pea = 0;
      state.basis.pea = 0;
      state.tax.peaCash = 0;
      state.tax.peaContributions = 0;
      state.tax.peaOpenedMonth = null;
    }

    setInput(0);
    forceRefresh();
  } finally {
    integrityLock = false;
    pendingWithdraw = null;
  }
}

/* ------------------------------------------------------------------
   3. CONFIRMATION DES MODALES FISCALES
   ------------------------------------------------------------------ */

function handleTaxConfirmAfterCore() {
  // Ce listener est enregistré après tax-engine.js : son callback s'exécute
  // après le callback fiscal officiel sur le même bouton.
  if (pendingWithdraw) {
    const op = pendingWithdraw;
    pendingWithdraw = null;
    enforceAfterWithdrawal(op);
    return;
  }

  if (pendingPeaOperation?.type === 'sell') {
    const op = pendingPeaOperation;
    pendingPeaOperation = null;

    ensurePeaState();

    const b = op.before;
    const amount = Math.min(op.amount, b.invested);
    const ratio = b.invested > EPS ? amount / b.invested : 0;
    const allocatedBasis = b.basis * ratio;

    // Vente interne : aucun euro ne quitte le PEA.
    state.pea = Math.max(0, b.invested - amount);
    state.basis.pea = Math.max(0, b.basis - allocatedBasis);
    state.tax.peaCash = b.pocket + amount;
    state.tax.peaContributions = b.contributions;

    forceRefresh();
  }
}

function clearPending() {
  pendingWithdraw = null;
  pendingPeaOperation = null;
}

/* ------------------------------------------------------------------
   4. BRANCHEMENT UI
   ------------------------------------------------------------------ */

function bind() {
  const withdraw = document.querySelector('[data-tax-withdraw="pea"]');
  if (withdraw && !withdraw.dataset.peaIntegrity216) {
    withdraw.dataset.peaIntegrity216 = '1';
    // Capture l'état juste avant le handler fiscal officiel.
    withdraw.addEventListener('click', armWithdrawal, true);
  }

  const confirm = document.getElementById('taxConfirmBtn');
  if (confirm && !confirm.dataset.peaIntegrity216) {
    confirm.dataset.peaIntegrity216 = '1';
    confirm.addEventListener('click', handleTaxConfirmAfterCore);
  }

  document.querySelectorAll(
    '#taxCancelBtn,[data-tax-close="confirm"]'
  ).forEach(btn => {
    if (btn.dataset.peaIntegrity216) return;
    btn.dataset.peaIntegrity216 = '1';
    btn.addEventListener('click', clearPending);
  });
}

/* Rebranche après chaque rendu si le moteur fiscal recrée un contrôle. */
const coreRender = render;
render = function() {
  const result = coreRender();
  bind();
  return result;
};

bind();

/* Diagnostic disponible dans la console sans modifier l'UI. */
window.PeaIntegrityV216 = {
  version: '2.1.6',
  snapshot,
  performance: () => {
    const s = snapshot();
    return {
      totalPea: s.total,
      contributions: s.contributions,
      performanceEuro: s.total - s.contributions,
      performancePct: s.contributions > EPS
        ? (s.total - s.contributions) / s.contributions * 100
        : 0
    };
  }
};

})();
