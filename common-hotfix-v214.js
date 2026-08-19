(() => {
'use strict';

if (typeof state === 'undefined' || typeof render !== 'function') return;

const N = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const EUR = v => typeof fmtEUR === 'function'
  ? fmtEUR(v)
  : new Intl.NumberFormat('fr-FR', {style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const PCT = v => `${N(v).toFixed(1).replace('.', ',')} %`;

/* =========================================================
   V2.1.4 — correctifs ciblés
   - PEA : retrait via le moteur fiscal existant
   - bilan : fiscalité des cessions/retraits incluse
   - simulation : gros imprévus intégrés au détail mensuel
   - prêts multiples : ratio d'endettement complet + bonne carte
   ========================================================= */

/* 1) Taux d'endettement :
   monthlyDebtPayments() contient déjà les dettes historiques + prêts V2.1.3. */
if (typeof monthlyDebtPayments === 'function') {
  debtRatio = function(extraPayment = 0, extraIncome = 0) {
    const income = Math.max(1, N(state.salary) + N(extraIncome));
    return (Math.max(0, N(monthlyDebtPayments())) + Math.max(0, N(extraPayment))) / income * 100;
  };
}

function totalTaxesPaid() {
  const monthly = Math.max(0, N(state.commonFixes?.taxesPaid));
  // tax.totalPaid suit les flux fiscaux PEA / AV / CTO / crypto, remboursements compris.
  const realised = N(state.tax?.totalPaid);
  return Math.max(0, monthly + realised);
}

function patchCumulativeBilan() {
  const f = state.commonFixes;
  if (!f) return;

  const box = document.getElementById('v213CumulativeBilan');
  if (!box) return;

  const fees = Math.max(0, N(state.market?.fees?.total));
  const income = Math.max(0, N(f.cumulativeIncome));
  const taxes = totalTaxesPaid();
  const interests = Math.max(0, N(f.bankInterestPaid));
  const inflationLoss = Math.max(0, N(f.inflationLoss));
  const inflationPct = Math.max(0, (N(state.priceIndex) - 1) * 100);
  const per = x => income > 0 ? x / income * 100 : 0;

  box.innerHTML =
    `<h4>Depuis le début de la partie</h4>` +
    `<div><span>Frais de placements</span><strong>${EUR(fees)} • ${PCT(per(fees))} des revenus</strong></div>` +
    `<div><span>Impôts payés</span><strong>${EUR(taxes)} • ${PCT(per(taxes))} des revenus</strong></div>` +
    `<div><span>Intérêts bancaires</span><strong>${EUR(interests)} • ${PCT(per(interests))} des revenus</strong></div>` +
    `<div><span>Inflation</span><strong>${EUR(inflationLoss)} estimés • +${PCT(inflationPct)} cumulé</strong></div>` +
    `<small>Les impôts incluent l'imposition mensuelle et la fiscalité effectivement déclenchée par les retraits/cessions de placements. Les remboursements fiscaux viennent réduire le cumul net.</small>`;
}

/* 2) PEA :
   le bloc V2.1.3 ne doit jamais effectuer lui-même le transfert.
   Il délègue au bouton créé par tax-engine.js. */
function patchPeaWithdrawal() {
  const box = document.getElementById('v213PeaCashBox');
  if (!box || box.hidden) return;
  const btn = box.querySelector('button');
  if (!btn) return;

  const months = state.tax?.peaOpenedMonth == null
    ? 0
    : Math.max(0, N(state.totalMonths) - N(state.tax.peaOpenedMonth));
  btn.textContent = months < 60 ? 'Retirer et clôturer le PEA' : 'Retirer les espèces';

  btn.onclick = () => {
    const official = document.querySelector('[data-tax-withdraw="pea"]');
    if (official && official !== btn) {
      official.click();
      return;
    }
    if (typeof setEvent === 'function') {
      setEvent('Retrait PEA indisponible : le moteur fiscal n’est pas chargé.');
      render();
    }
  };
}

/* 3) Prêts multiples :
   ancrage garanti sur la carte qui contient le bouton Prêt personnel d'origine. */
function patchLoanCard() {
  const root = document.getElementById('v213PersonalLoans');
  if (!root) return;

  const target =
    document.getElementById('loanBtn')?.closest('.card') ||
    document.getElementById('loanBtn')?.closest('.section-card');

  if (target && root.parentElement !== target) target.appendChild(root);
}

/* 4) Simulation :
   common-fixes V2.1.3 applique le gros imprévu après le calcul initial de la ligne.
   On recalcule donc Δ patrimoine / Δ trésorerie après l'appel et on rattache
   l'événement et son coût à la ligne mensuelle retournée. */
function parseMajorEventFromHistory() {
  const candidates = Array.isArray(state.history) ? state.history.slice(0, 4) : [];
  const text = candidates.find(x => /(?:Très gros|Gros) imprévu/i.test(String(x))) ||
               (/(?:Très gros|Gros) imprévu/i.test(String(state.lastEvent)) ? String(state.lastEvent) : '');
  if (!text) return null;

  const m = text.match(/dépense exceptionnelle de\s*([\d\s\u202f\u00a0.,]+)\s*€/i);
  let cost = 0;
  if (m) {
    const raw = m[1].replace(/[\s\u202f\u00a0]/g, '').replace(',', '.');
    cost = Math.max(0, Number(raw) || 0);
  }
  return { text: text.replace(/^.*?—\s*/, ''), cost };
}

if (typeof simulateOneMonth === 'function') {
  const V213_SIMULATE_ONE = simulateOneMonth;

  simulateOneMonth = function() {
    const startWorth = typeof netWorth === 'function' ? N(netWorth()) : 0;
    const startCash = N(state.cash);
    const beforeLarge = N(state.commonFixes?.events?.largeCount);
    const beforeHuge = N(state.commonFixes?.events?.hugeCount);

    const row = V213_SIMULATE_ONE();
    if (!row) return row;

    const endWorth = typeof netWorth === 'function' ? N(netWorth()) : startWorth;
    row.worthDelta = endWorth - startWorth;
    row.cashDelta = N(state.cash) - startCash;

    const majorTriggered =
      N(state.commonFixes?.events?.largeCount) > beforeLarge ||
      N(state.commonFixes?.events?.hugeCount) > beforeHuge;

    if (majorTriggered) {
      const evt = parseMajorEventFromHistory();
      if (evt) {
        row.event = row.event ? `${row.event} • ${evt.text}` : evt.text;
        if (evt.cost > 0) row.expenses = N(row.expenses) + evt.cost;
      } else {
        row.event = row.event ? `${row.event} • Gros imprévu exceptionnel` : 'Gros imprévu exceptionnel';
      }
    }

    return row;
  };
}

/* Correction de l'encart cumulatif dans le bilan annuel. */
if (typeof showAnnualReport === 'function') {
  const V213_ANNUAL = showAnnualReport;
  showAnnualReport = function(report) {
    const result = V213_ANNUAL(report);
    setTimeout(() => {
      const b = document.querySelector('#annualModal .v213-annual-cumulative');
      if (!b || !state.commonFixes) return;
      const f = state.commonFixes;
      const fees = Math.max(0, N(state.market?.fees?.total));
      const inc = Math.max(1, N(f.cumulativeIncome));
      const taxes = totalTaxesPaid();
      b.innerHTML =
        `<strong>Depuis le début</strong> • ` +
        `frais ${EUR(fees)} (${PCT(fees/inc*100)}) • ` +
        `impôts ${EUR(taxes)} (${PCT(taxes/inc*100)}) • ` +
        `intérêts ${EUR(f.bankInterestPaid)} (${PCT(N(f.bankInterestPaid)/inc*100)}) • ` +
        `inflation estimée ${EUR(f.inflationLoss)}.`;
    }, 20);
    return result;
  };
}

/* Réappliquer les correctifs UI après chaque render, car V2.1.3 reconstruit certains blocs. */
const V213_RENDER = render;
render = function() {
  const result = V213_RENDER();
  patchPeaWithdrawal();
  patchLoanCard();
  patchCumulativeBilan();

  if (window.PatrimoineCommonFixes) {
    window.PatrimoineCommonFixes.version = '2.1.4';
  }

  return result;
};

setTimeout(() => {
  patchPeaWithdrawal();
  patchLoanCard();
  patchCumulativeBilan();
  if (window.PatrimoineCommonFixes) window.PatrimoineCommonFixes.version = '2.1.4';
}, 0);

window.PatrimoineHotfixV214 = {
  version: '2.1.4',
  totalTaxesPaid
};

})();
