(() => {
'use strict';

if (typeof state === 'undefined' || typeof render !== 'function') {
  console.error('[Patrimoine V2.1.5] moteur principal indisponible');
  return;
}

const VERSION = '2.1.5.3';
const LOSS_HAPPINESS = 50;
const MAX_LEVEL = 6;
const N = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const EUR = v => typeof fmtEUR === 'function'
  ? fmtEUR(v)
  : new Intl.NumberFormat('fr-FR', {
      style:'currency', currency:'EUR', maximumFractionDigits:0
    }).format(v || 0);
const PCT = v => `${N(v).toFixed(1).replace('.', ',')} %`;
const rand = (a,b) => a + Math.random() * (b-a);
const ri = (a,b) => Math.round(rand(a,b));

function defaults(s) {
  const m = Math.max(0, N(s?.totalMonths));
  return {
    schema: 215,
    cumulativeIncome: 0,
    monthlyTaxesPaid: 0,
    bankInterestPaid: 0,
    inflationLoss: 0,
    personalLoans: [],
    events: {
      nextLargeMonth: m + ri(9,16),
      nextHugeMonth: m + ri(48,60),
      largeCount: 0,
      hugeCount: 0
    }
  };
}

function ensureState() {
  const d = defaults(state);
  state.pcV215 = Object.assign(d, state.pcV215 || {});
  state.pcV215.events = Object.assign(d.events, state.pcV215.events || {});
  if (!Array.isArray(state.pcV215.personalLoans)) state.pcV215.personalLoans = [];
  state.pcV215.personalLoans = state.pcV215.personalLoans
    .map((l,i) => ({
      id: l.id || `loan-${Date.now()}-${i}`,
      principal: Math.max(0,N(l.principal)),
      balance: Math.max(0,N(l.balance)),
      rate: Math.max(0,N(l.rate)),
      months: Math.max(0,Math.round(N(l.months))),
      initialMonths: Math.max(0,Math.round(N(l.initialMonths || l.months))),
      payment: Math.max(0,N(l.payment)),
      totalInterestInitial: Math.max(0,N(l.totalInterestInitial)),
      interestPaid: Math.max(0,N(l.interestPaid))
    }))
    .filter(l => l.balance > .01 && l.payment > 0);
  return state.pcV215;
}
ensureState();

const ORIGINAL = {
  render,
  nextMonth: typeof nextMonth === 'function' ? nextMonth : null,
  simulateOneMonth: typeof simulateOneMonth === 'function' ? simulateOneMonth : null,
  simulateMonths: typeof simulateMonths === 'function' ? simulateMonths : null,
  showSimulationReport: typeof showSimulationReport === 'function' ? showSimulationReport : null,
  showAnnualReport: typeof showAnnualReport === 'function' ? showAnnualReport : null,
  evaluateEndConditions: typeof evaluateEndConditions === 'function' ? evaluateEndConditions : null,
  showEndModal: typeof showEndModal === 'function' ? showEndModal : null,
  training: typeof training === 'function' ? training : null,
  monthlyDebtPayments: typeof monthlyDebtPayments === 'function' ? monthlyDebtPayments : null,
  monthlyExpenses: typeof monthlyExpenses === 'function' ? monthlyExpenses : null,
  totalDebt: typeof totalDebt === 'function' ? totalDebt : null,
  netWorth: typeof netWorth === 'function' ? netWorth : null,
  payDebts: typeof payDebts === 'function' ? payDebts : null,
  debtRatio: typeof debtRatio === 'function' ? debtRatio : null
};

const loans = () => ensureState().personalLoans;
const loanBalance = () => loans().reduce((s,l) => s + N(l.balance), 0);
const loanPayments = () => loans().reduce((s,l) => s + N(l.payment), 0);

function annuity(capital, annualRate, months) {
  capital = Math.max(0,N(capital));
  annualRate = Math.max(0,N(annualRate));
  months = Math.max(1,Math.round(N(months)));
  const r = annualRate / 12;
  return r ? capital * r / (1 - Math.pow(1+r, -months)) : capital / months;
}

/* ===== DETTES / PRÊTS MULTIPLES ===== */

if (ORIGINAL.monthlyDebtPayments) {
  monthlyDebtPayments = function() {
    return N(ORIGINAL.monthlyDebtPayments()) + loanPayments();
  };
}
if (ORIGINAL.monthlyExpenses) {
  monthlyExpenses = function() {
    return N(ORIGINAL.monthlyExpenses()) + loanPayments();
  };
}
if (ORIGINAL.totalDebt) {
  totalDebt = function() {
    return N(ORIGINAL.totalDebt()) + loanBalance();
  };
}
if (ORIGINAL.netWorth) {
  netWorth = function() {
    return N(ORIGINAL.netWorth()) - loanBalance();
  };
}
if (ORIGINAL.debtRatio) {
  debtRatio = function(extraPayment=0, extraIncome=0) {
    const income = Math.max(1, N(state.salary) + N(extraIncome));
    const allPayments = Math.max(0,N(monthlyDebtPayments())) + Math.max(0,N(extraPayment));
    return allPayments / income * 100;
  };
}
if (ORIGINAL.payDebts) {
  payDebts = function() {
    const coreInterest = Math.max(0,N(ORIGINAL.payDebts()));
    let personalInterest = 0;

    for (const l of loans()) {
      if (l.balance <= 0 || l.payment <= 0) continue;
      const interest = l.balance * l.rate / 12;
      personalInterest += interest;
      l.interestPaid += interest;
      l.balance = Math.max(0, l.balance + interest - l.payment);
      l.months = Math.max(0, l.months - 1);
      if (l.balance < 1 || l.months <= 0) {
        l.balance = 0;
        l.payment = 0;
        l.months = 0;
      }
    }

    state.pcV215.personalLoans = loans().filter(l => l.balance > .01 && l.payment > 0);
    state.pcV215.bankInterestPaid += coreInterest + personalInterest;
    return coreInterest + personalInterest;
  };
}

function addPersonalLoan(amount, ratePct, months) {
  amount = Math.max(0,N(amount));
  months = Math.max(1,Math.round(N(months)));
  const annual = Math.max(0,N(ratePct)) / 100;

  if (amount < 100 || months < 2) {
    return {ok:false,msg:'Montant ou durée invalide.'};
  }

  const payment = annuity(amount, annual, months);
  if (typeof debtRatio === 'function' && debtRatio(payment) > 38) {
    return {ok:false,msg:'Prêt refusé : le taux d’endettement simulé dépasse 38 %.'};
  }

  loans().push({
    id:`perso-${Date.now()}`,
    principal:amount,
    balance:amount,
    rate:annual,
    months,
    initialMonths:months,
    payment,
    totalInterestInitial:payment*months-amount,
    interestPaid:0
  });

  state.cash = N(state.cash) + amount;
  state.lastEvent = `Prêt personnel obtenu : +${EUR(amount)}, mensualité ${EUR(payment)} pendant ${months} mois.`;
  if (typeof addHistory === 'function') addHistory(state.lastEvent);
  if (typeof silentSave === 'function') silentSave();
  render();
  return {ok:true};
}

/* ===== BONHEUR / FIN DE PARTIE ===== */

function happinessLoss() {
  if (state.gameOver || N(state.wellbeing) >= LOSS_HAPPINESS) return false;

  state.gameOver = true;
  state.gameResult = 'loss-happiness';
  state.lastEvent = `💔 Partie perdue : ton bonheur est descendu sous ${LOSS_HAPPINESS}/100.`;
  if (typeof addHistory === 'function') {
    addHistory(`${typeof monthName==='function' ? monthName(state.month) : 'Mois'} ${state.year || ''} — ${state.lastEvent}`);
  }
  if (typeof silentSave === 'function') silentSave();
  return true;
}

if (ORIGINAL.evaluateEndConditions) {
  evaluateEndConditions = function() {
    const r = ORIGINAL.evaluateEndConditions();
    const lost = happinessLoss();
    if (lost && typeof showEndModal === 'function') showEndModal('loss-happiness');
    return r;
  };
}

if (ORIGINAL.showEndModal) {
  showEndModal = function(kind) {
    if (kind !== 'loss-happiness') return ORIGINAL.showEndModal(kind);

    const modal = document.getElementById('endModal');
    if (!modal) return ORIGINAL.showEndModal('loss');

    const set = (id,text) => {
      const x = document.getElementById(id);
      if (x) x.textContent = text;
    };

    set('endEmoji','💔');
    set('endEyebrow','Fin de partie');
    set('endTitle','Bonheur trop faible');
    set('endText',`Ton bonheur est passé sous ${LOSS_HAPPINESS}/100. Une gestion financière durable doit aussi préserver ton équilibre de vie.`);

    const continueBtn = document.getElementById('continueAfterWinBtn');
    if (continueBtn) continueBtn.style.display = 'none';
    modal.classList.remove('hidden');
  };
}

/* ===== AUDIT CUMULATIF ===== */

const monthlyInflationRate = annual =>
  Math.pow(Math.max(.0001,1+N(annual)),1/12)-1;

function auditBeforeMonth() {
  ensureState();
  const income = typeof monthlyIncome === 'function' ? Math.max(0,N(monthlyIncome())) : 0;
  const taxes = typeof monthlyTax === 'function' ? Math.max(0,N(monthlyTax())) : 0;
  const exposedCash =
    Math.max(0,N(state.cash)) +
    Math.max(0,N(state.livret)) +
    Math.max(0,N(state.assurance)) +
    Math.max(0,N(state.tax?.peaCash));

  return {
    income,
    taxes,
    inflationLoss: Math.max(0, exposedCash * monthlyInflationRate(state.annualInflation))
  };
}

function auditAfterMonth(a) {
  if (!a) return;
  const f = ensureState();
  f.cumulativeIncome += a.income;
  f.monthlyTaxesPaid += a.taxes;
  f.inflationLoss += a.inflationLoss;
}

function totalTaxesPaid() {
  return Math.max(0, N(state.pcV215?.monthlyTaxesPaid) + N(state.tax?.totalPaid));
}

/* ===== GROS IMPRÉVUS ===== */

function majorEvent() {
  const f = ensureState();
  const m = Math.max(0,Math.round(N(state.totalMonths)));
  const priceIndex = Math.max(.5,N(state.priceIndex) || 1);

  let cost = 0;
  let title = '';

  if (m >= N(f.events.nextHugeMonth)) {
    cost = Math.round(rand(5000,10000) * priceIndex);
    title = '🚨 Très gros imprévu';
    f.events.hugeCount++;
    f.events.nextHugeMonth = m + ri(54,66);
    f.events.nextLargeMonth = Math.max(N(f.events.nextLargeMonth), m + ri(6,12));
  } else if (m >= N(f.events.nextLargeMonth)) {
    cost = Math.round(rand(500,1000) * priceIndex);
    title = '⚠️ Gros imprévu';
    f.events.largeCount++;
    f.events.nextLargeMonth = m + ri(10,18);
  }

  if (!cost) return null;

  state.cash = N(state.cash) - cost;
  state.lastEvent = `${title} : dépense exceptionnelle de ${EUR(cost)}.`;

  if (state.yearStats) {
    state.yearStats.events = N(state.yearStats.events) + 1;
    state.yearStats.eventCost = N(state.yearStats.eventCost) + cost;
  }

  if (typeof addHistory === 'function') {
    addHistory(`${typeof monthName==='function' ? monthName(state.month) : 'Mois'} ${state.year || ''} — ${state.lastEvent}`);
  }

  return {cost,title,text:state.lastEvent};
}

/* ===== SIMULATION / PASSAGE DU TEMPS ===== */

let monthGuard = false;

if (ORIGINAL.simulateOneMonth) {
  simulateOneMonth = function() {
    if (monthGuard) return ORIGINAL.simulateOneMonth();

    monthGuard = true;
    const audit = auditBeforeMonth();
    const startWorth = typeof netWorth === 'function' ? N(netWorth()) : 0;
    const startCash = N(state.cash);

    try {
      const row = ORIGINAL.simulateOneMonth();
      if (!row) return row;

      auditAfterMonth(audit);
      const evt = majorEvent();
      happinessLoss();

      const endWorth = typeof netWorth === 'function' ? N(netWorth()) : startWorth;
      row.worthStart = startWorth;
      row.worthEnd = endWorth;
      row.worthDelta = endWorth - startWorth;
      row.worthPct = Math.abs(startWorth) > .01 ? row.worthDelta / Math.abs(startWorth) * 100 : 0;
      row.cashDelta = N(state.cash) - startCash;

      if (evt) {
        row.expenses = N(row.expenses) + evt.cost;
        row.event = row.event ? `${row.event} • ${evt.text}` : evt.text;
      }

      if (typeof silentSave === 'function') silentSave();
      return row;
    } finally {
      monthGuard = false;
    }
  };
}

if (ORIGINAL.nextMonth) {
  nextMonth = function() {
    if (monthGuard) return ORIGINAL.nextMonth();

    monthGuard = true;
    const audit = auditBeforeMonth();
    try {
      const result = ORIGINAL.nextMonth();
      auditAfterMonth(audit);
      majorEvent();
      happinessLoss();
      if (typeof silentSave === 'function') silentSave();
      render();
      return result;
    } finally {
      monthGuard = false;
    }
  };
}

if (ORIGINAL.simulateMonths) {
  simulateMonths = function(count) {
    count = Math.max(1,Math.min(120,Math.round(N(count) || 1)));
    if (count > 1) {
      const ok = confirm(
        `Simuler ${count} mois ?\n\n` +
        `Chaque mois sera réellement calculé. La partie peut se terminer pendant la simulation ` +
        `si ton bonheur passe sous ${LOSS_HAPPINESS}/100 ou si une autre condition de défaite est atteinte.`
      );
      if (!ok) return;
    }
    return ORIGINAL.simulateMonths(count);
  };
}

if (ORIGINAL.showSimulationReport) {
  showSimulationReport = function(startLabel,rows,startWorth,totals) {
    const result = ORIGINAL.showSimulationReport(startLabel,rows,startWorth,totals);

    setTimeout(() => {
      const list = document.getElementById('simMonthList');
      if (!list) return;

      const rendered = [...list.querySelectorAll('.sim-month-row:not(.head)')];
      rendered.forEach((row,i) => {
        const d = rows?.[i];
        const last = row.children[row.children.length-1];
        if (!d || !last || last.querySelector('.v215-worth-detail')) return;

        const start = Number.isFinite(d.worthStart) ? d.worthStart : 0;
        const end = Number.isFinite(d.worthEnd) ? d.worthEnd : start + N(d.worthDelta);
        const pct = Number.isFinite(d.worthPct)
          ? d.worthPct
          : (Math.abs(start) > .01 ? (end-start)/Math.abs(start)*100 : 0);

        last.insertAdjacentHTML(
          'beforeend',
          `<small class="v215-worth-detail">${EUR(start)} → ${EUR(end)} • ${pct>=0?'+':''}${PCT(pct)}</small>`
        );
      });
    },0);

    return result;
  };
}

/* ===== FORMATION MAX ===== */

if (ORIGINAL.training) {
  training = function() {
    if (N(state.careerLevel) >= MAX_LEVEL) {
      const msg = '🎓 Niveau de formation maximal atteint : aucune formation supplémentaire.';
      if (typeof setEvent === 'function') setEvent(msg);
      else state.lastEvent = msg;
      if (typeof showSaveNote === 'function') showSaveNote('Niveau maximum atteint');
      render();
      return;
    }
    return ORIGINAL.training();
  };
}

/* ===== PEA : UTILISE UNIQUEMENT LE MOTEUR FISCAL ===== */

function syncOfficialPeaUi() {
  // Le moteur fiscal crée déjà la poche espèces PEA et son bouton Retirer.
  // On supprime toute ancienne poche V2.1.5 éventuellement laissée dans le DOM.
  document.getElementById('v215PeaCash')?.remove();

  const withdraw = document.querySelector('[data-tax-withdraw="pea"]');
  if (!withdraw || withdraw.dataset.v2153Bound) return;

  withdraw.dataset.v2153Bound = '1';

  // Le handler fiscal lit #peaAmount. S'il est vide/à zéro, on utilise
  // automatiquement la poche espèces disponible afin que "Retirer" ne
  // semble jamais inactif après une vente PEA.
  withdraw.addEventListener('click', () => {
    const input = document.getElementById('peaAmount');
    if (!input) return;
    const current = Number(input.value || 0);
    const available = Math.max(0, Number(state.tax?.peaCash) || 0);
    if (current <= 0 && available > 0) {
      input.value = String(Math.max(1, Math.floor(available)));
    }
  }, true);
}

/* ===== UI ===== */

function budgetCard() {
  return document.querySelector('.budget-card') ||
    [...document.querySelectorAll('.card')].find(c => /budget automatique|budget mensuel/i.test(c.textContent || ''));
}

function renderHappiness() {
  const card = budgetCard();
  if (!card) return;

  let box = document.getElementById('v215BudgetHappiness');
  if (!box) {
    box = document.createElement('div');
    box.id = 'v215BudgetHappiness';
    box.className = 'v215-budget-happiness';
    const h = card.querySelector('.section-head');
    (h || card.firstElementChild)?.insertAdjacentElement('afterend',box);
  }

  const impact = {economy:-2,balanced:-.5,comfort:2}[state.lifestyle] ?? 0;
  box.innerHTML =
    `<span>😊 Bonheur</span>` +
    `<strong>${Math.round(N(state.wellbeing))}/100</strong>` +
    `<small>${impact>=0?'+':''}${String(impact).replace('.',',')} / mois avec ce niveau de vie • défaite sous 50</small>`;
}

function renderLoans() {
  const target =
    document.getElementById('loanBtn')?.closest('.loan-card') ||
    document.getElementById('loanBtn')?.closest('.section-card');
  if (!target) return;

  let root = document.getElementById('v215PersonalLoans');
  if (!root) {
    root = document.createElement('div');
    root.id = 'v215PersonalLoans';
    root.className = 'v215-loans';
    target.appendChild(root);
  }

  const list = loans();
  const debt = typeof debtRatio === 'function' ? debtRatio() : 0;
  const legacyBalance = Math.max(0,N(state.consumerDebt));
  const legacyPayment = Math.max(0,N(state.consumerPayment));
  const extraBalance = list.reduce((sum,loan) => sum + Math.max(0,N(loan.balance)),0);
  const extraPayment = list.reduce((sum,loan) => sum + Math.max(0,N(loan.payment)),0);
  const displayedBalance = legacyBalance + extraBalance;
  const displayedPayment = legacyPayment + extraPayment;
  const loanCount = list.length + (legacyBalance > 0 ? 1 : 0);

  const debtDisplay = document.getElementById('consumerDebtDisplay');
  const debtInfo = document.getElementById('consumerDebtInfo');
  if (debtDisplay) debtDisplay.textContent = EUR(displayedBalance);
  if (debtInfo) {
    debtInfo.textContent = displayedBalance > 0
      ? `${loanCount} prêt${loanCount > 1 ? 's' : ''} • ${EUR(displayedPayment)}/mois`
      : '—';
  }

  root.innerHTML =
    `<div class="v215-credit-warning">` +
      `<strong>Crédit : coût immédiat, engagement durable</strong>` +
      `<span>Taux d’endettement actuel : ${PCT(debt)}. Le jeu refuse un nouveau prêt au-delà de 38 %.</span>` +
    `</div>` +
    `<div class="v215-loan-form">` +
      `<label>Montant (€)<input id="v215LoanAmount" type="number" min="500" step="500" value="5000"></label>` +
      `<label>Taux annuel (%)<input id="v215LoanRate" type="number" min="0" step=".1" value="8"></label>` +
      `<label>Durée (mois)<input id="v215LoanMonths" type="number" min="6" step="6" value="36"></label>` +
      `<button id="v215LoanAdd" class="btn ghost">Ajouter le prêt</button>` +
    `</div>` +
    `<div class="v215-loan-list">` +
      (list.length
        ? list.map(l =>
          `<div><strong>${EUR(l.balance)} restant</strong>` +
          `<small>${PCT(l.rate*100)} • ${EUR(l.payment)}/mois • ${l.months} mois restants • intérêts déjà payés ${EUR(l.interestPaid)}</small></div>`
        ).join('')
        : `<small>Aucun prêt personnel supplémentaire en cours.</small>`) +
    `</div>`;

  root.querySelector('#v215LoanAdd').onclick = () => {
    const r = addPersonalLoan(
      root.querySelector('#v215LoanAmount').value,
      root.querySelector('#v215LoanRate').value,
      root.querySelector('#v215LoanMonths').value
    );
    if (!r.ok) {
      if (typeof setEvent === 'function') setEvent(r.msg);
      else alert(r.msg);
      render();
    }
  };
}

function renderCumulativeBilan() {
  const host =
    document.querySelector('.debt-card') ||
    [...document.querySelectorAll('.side-card')].find(c => /dette|crédit/i.test(c.textContent || '')) ||
    document.querySelector('.side-column');

  if (!host) return;

  let box = document.getElementById('v215CumulativeBilan');
  if (!box) {
    box = document.createElement('div');
    box.id = 'v215CumulativeBilan';
    box.className = 'v215-cumulative-bilan';
    host.appendChild(box);
  }

  const f = ensureState();
  const income = Math.max(0,N(f.cumulativeIncome));
  const fees = Math.max(0,N(state.market?.fees?.total));
  const taxes = totalTaxesPaid();
  const interest = Math.max(0,N(f.bankInterestPaid));
  const inflation = Math.max(0,N(f.inflationLoss));
  const inflationPct = Math.max(0,(N(state.priceIndex)-1)*100);
  const ratio = x => income > 0 ? x/income*100 : 0;

  box.innerHTML =
    `<h4>Depuis le début de la partie</h4>` +
    `<div><span>Frais de placements</span><strong>${EUR(fees)} • ${PCT(ratio(fees))} des revenus</strong></div>` +
    `<div><span>Impôts payés</span><strong>${EUR(taxes)} • ${PCT(ratio(taxes))} des revenus</strong></div>` +
    `<div><span>Intérêts bancaires</span><strong>${EUR(interest)} • ${PCT(ratio(interest))} des revenus</strong></div>` +
    `<div><span>Inflation</span><strong>${EUR(inflation)} estimés • +${PCT(inflationPct)} cumulé</strong></div>` +
    `<small>Les impôts incluent l’imposition mensuelle et la fiscalité réellement déclenchée lors des retraits ou ventes de placements.</small>`;
}

function renderNegativeCashflow() {
  const capacity = document.getElementById('budgetCapacity');
  if (!capacity) return;

  let note = document.getElementById('v215CashImpact');
  if (!note) {
    note = document.createElement('small');
    note.id = 'v215CashImpact';
    note.className = 'v215-cash-impact';
    capacity.insertAdjacentElement('afterend',note);
  }

  const flow = typeof cashflow === 'function' ? N(cashflow()) : 0;
  note.textContent = flow < 0 ? `Impact sur la trésorerie : ${EUR(flow)} / mois` : '';
  note.hidden = flow >= 0;
}

function setVersion() {
  const chip = document.querySelector('.version-chip');
  if (chip) {
    if (chip.textContent !== 'V2.1.5.3 • stable') {
      chip.textContent = 'V2.1.5.3 • stable';
    }
    chip.dataset.runtimeVersion = VERSION;
  }
}

function enhanceUI() {
  ensureState();
  renderHappiness();
  renderLoans();
  syncOfficialPeaUi();
  renderCumulativeBilan();
  renderNegativeCashflow();
  setVersion();
}

render = function() {
  const result = ORIGINAL.render();
  enhanceUI();
  return result;
};

if (ORIGINAL.showAnnualReport) {
  showAnnualReport = function(report) {
    const r = ORIGINAL.showAnnualReport(report);
    setTimeout(() => {
      const modal = document.getElementById('annualModal');
      if (!modal) return;

      let box = modal.querySelector('.v215-annual-cumulative');
      if (!box) {
        box = document.createElement('div');
        box.className = 'v215-annual-cumulative';
        const summary = document.getElementById('annualSummary');
        (summary || modal.querySelector('.modal-card'))?.insertAdjacentElement('beforebegin',box);
      }

      const f = ensureState();
      const income = Math.max(1,N(f.cumulativeIncome));
      const fees = Math.max(0,N(state.market?.fees?.total));
      const taxes = totalTaxesPaid();
      const interest = Math.max(0,N(f.bankInterestPaid));

      box.innerHTML =
        `<strong>Depuis le début</strong> • ` +
        `frais ${EUR(fees)} (${PCT(fees/income*100)}) • ` +
        `impôts ${EUR(taxes)} (${PCT(taxes/income*100)}) • ` +
        `intérêts ${EUR(interest)} (${PCT(interest/income*100)}) • ` +
        `inflation estimée ${EUR(f.inflationLoss)}.`;
    },20);
    return r;
  };
}

function rebindHistoricalControls() {
  // La base V2.1.2 avait capturé les anciennes fonctions dans onclick
  // avant le chargement du moteur V2.1.5. On rebinde explicitement les
  // contrôles vers les fonctions corrigées.

  const nextBtn = document.getElementById('nextMonthBtn');
  if (nextBtn) nextBtn.onclick = () => nextMonth();

  const simBtn = document.getElementById('simulateMonthsBtn');
  if (simBtn) {
    simBtn.onclick = () => {
      const select = document.getElementById('simulateMonthsSelect');
      simulateMonths(select ? select.value : 1);
    };
  }

  const trainingBtn = document.getElementById('trainingBtn');
  if (trainingBtn) trainingBtn.onclick = () => training();

  // Le bouton historique "Prêt personnel" devient compatible avec les prêts multiples.
  const loanBtn = document.getElementById('loanBtn');
  if (loanBtn) {
    loanBtn.onclick = () => {
      const amount = Number(document.getElementById('loanAmount')?.value || 0);
      const months = Number(document.getElementById('loanMonths')?.value || 0);
      const ratePct = 8;
      const annual = ratePct / 100;
      const payment = annuity(amount, annual, months);
      const interest = payment * months - amount;
      const projectedRatio = typeof debtRatio === 'function' ? debtRatio(payment) : 0;

      if (projectedRatio > 38) {
        const msg = `Prêt refusé : taux d’endettement simulé ${projectedRatio.toFixed(0)} %, supérieur au seuil de 38 %.`;
        if (typeof setEvent === 'function') setEvent(msg); else alert(msg);
        render();
        return;
      }

      const ok = confirm(
        `Prêt personnel de ${EUR(amount)}\n\n` +
        `Taux : ${ratePct.toFixed(1).replace('.',',')} %\n` +
        `Durée : ${months} mois\n` +
        `Mensualité : ${EUR(payment)}\n` +
        `Intérêts totaux estimés : ${EUR(interest)}\n` +
        `Endettement après prêt : ${projectedRatio.toFixed(0)} %\n\n` +
        `Accepter ce prêt ?`
      );

      if (ok) addPersonalLoan(amount, ratePct, months);
    };
  }
}

// Pas de MutationObserver ici : render() appelle déjà enhanceUI(), qui remet
// le badge de version. Observer le badge puis réécrire son textContent peut
// créer une boucle de mutations et bloquer le rendu initial du navigateur.
rebindHistoricalControls();
enhanceUI();

window.PatrimoinePCV215 = {
  version: VERSION,
  totalTaxesPaid,
  addPersonalLoan,
  state: () => state.pcV215
};

})();
