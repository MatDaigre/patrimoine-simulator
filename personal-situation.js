(() => {
  'use strict';

  if (typeof state === 'undefined' || typeof render !== 'function' || typeof baseState !== 'function') return;

  const CORE = {
    baseState,
    hydrate,
    render,
    monthlyIncome,
    monthlyExpenses,
    monthlyTax,
    otherFixedCosts,
    debtRatio,
    annualUpdate,
    inflateMonthlyCosts,
    payDebts,
    simulateMonths
  };

  function defaultPersonalProfile() {
    return {
      enabled: false,
      otherIncome: 0,
      taxMonthly: 0,
      otherExpenses: 0,
      lastAnnualReviewYear: null,
      annualReviewDue: false,
      source: 'manual'
    };
  }

  function ensurePersonalState(s) {
    if (!s || typeof s !== 'object') return s;
    s.personalProfile = Object.assign(defaultPersonalProfile(), s.personalProfile || {});
    return s;
  }

  baseState = function () {
    return ensurePersonalState(CORE.baseState());
  };

  hydrate = function (raw) {
    return ensurePersonalState(CORE.hydrate(raw));
  };

  state = ensurePersonalState(state);

  const isPersonal = () => !!state?.personalProfile?.enabled;
  const n = id => Math.max(0, Number(document.getElementById(id)?.value || 0));
  const signed = id => Number(document.getElementById(id)?.value || 0);
  const monthsAgo = years => Math.max(0, Math.round(Number(years || 0) * 12));
  const inflationFromInput = (id, fallback = 0.024) => {
    const raw = document.getElementById(id)?.value;
    if (raw === '' || raw == null) return fallback;
    const pct = Number(raw);
    if (!Number.isFinite(pct)) return fallback;
    return Math.max(-0.05, Math.min(0.20, pct / 100));
  };

  monthlyIncome = function () {
    if (!isPersonal()) return CORE.monthlyIncome();
    return Math.max(0, Number(state.salary) || 0) +
      Math.max(0, Number(state.personalProfile.otherIncome) || 0) +
      Math.max(0, Number(state.rentIncome) || 0);
  };

  monthlyTax = function () {
    if (!isPersonal()) return CORE.monthlyTax();
    // Le joueur saisit son impôt/prélèvement à la source réel.
    // Les prélèvements sociaux sur le revenu locatif restent calculés séparément,
    // comme dans le moteur fiscal standard.
    const manualTax = Math.max(0, Number(state.personalProfile.taxMonthly) || 0);
    const rentalNet = Math.max(
      0,
      (Number(state.rentIncome) || 0) - (Number(state.rentalCosts) || 0)
    );
    return manualTax + rentalNet * 0.172;
  };

  monthlyExpenses = function () {
    const base = CORE.monthlyExpenses();
    if (!isPersonal()) return base;
    return base + Math.max(0, Number(state.personalProfile.otherExpenses) || 0);
  };

  otherFixedCosts = function () {
    const base = CORE.otherFixedCosts();
    if (!isPersonal()) return base;
    return base + Math.max(0, Number(state.personalProfile.otherExpenses) || 0);
  };

  debtRatio = function (extraPayment = 0, extraIncome = 0) {
    if (!isPersonal()) return CORE.debtRatio(extraPayment, extraIncome);
    return ((monthlyDebtPayments() + extraPayment) /
      Math.max(1, monthlyIncome() + extraIncome)) * 100;
  };

  annualUpdate = function () {
    if (!isPersonal()) return CORE.annualUpdate();

    state.personalProfile.annualReviewDue = true;
    state.lastEvent =
      `Nouvelle année : vérifie tes revenus, tes dépenses et le taux d’inflation. ` +
      `Taux actuellement retenu : ${(state.annualInflation * 100).toFixed(1).replace('.', ',')} %.`;
  };

  // Dans « Ma situation », les dépenses de consommation suivent l'inflation.
  // Salaire, impôts saisis manuellement et mensualités de crédit restent inchangés.
  inflateMonthlyCosts = function () {
    const beforeOther = isPersonal()
      ? Math.max(0, Number(state.personalProfile.otherExpenses) || 0)
      : 0;

    CORE.inflateMonthlyCosts();

    if (isPersonal() && beforeOther > 0) {
      const factor = Math.pow(1 + state.annualInflation, 1 / 12);
      state.personalProfile.otherExpenses = beforeOther * factor;
    }
  };

  // En profil « Ma situation », les crédits utilisent réellement le taux et
  // la durée restante saisis par le joueur au lieu des hypothèses des profils standards.
  payDebts = function () {
    if (!isPersonal()) return CORE.payDebts();

    let interest = 0;
    const defaults = { home: .034, rental: .036, car: .055, student: .025, consumer: .08 };

    function pay(balanceKey, paymentKey, metaKey, monthsKey = null) {
      let balance = Math.max(0, Number(state[balanceKey]) || 0);
      let payment = Math.max(0, Number(state[paymentKey]) || 0);
      if (!balance || !payment) return;

      const meta = state.debtMeta?.[metaKey] || {};
      const rate = Number.isFinite(Number(meta.rate)) ? Math.max(0, Number(meta.rate)) : defaults[metaKey];
      let remaining = Number.isFinite(Number(meta.months))
        ? Math.max(0, Math.round(Number(meta.months)))
        : (monthsKey ? Math.max(0, Math.round(Number(state[monthsKey]) || 0)) : 0);

      const monthInterest = balance * rate / 12;
      interest += monthInterest;
      balance = Math.max(0, balance + monthInterest - payment);

      if (remaining > 0) remaining--;

      if (balance < 10) {
        balance = 0;
        payment = 0;
        remaining = 0;
      }

      state[balanceKey] = balance;
      state[paymentKey] = payment;

      if (!state.debtMeta) state.debtMeta = {};
      state.debtMeta[metaKey] = Object.assign({}, meta, {
        rate,
        months: remaining,
        payment,
        remainingBalance: balance,
        overdue: remaining <= 0 && balance >= 10
      });

      if (monthsKey) state[monthsKey] = remaining;
    }

    pay('homeDebt', 'homePayment', 'home');
    pay('rentalDebt', 'rentalPayment', 'rental');
    pay('carDebt', 'carPayment', 'car', 'carMonths');
    pay('studentDebt', 'studentPayment', 'student', 'studentMonths');
    pay('consumerDebt', 'consumerPayment', 'consumer', 'consumerMonths');

    if (state.repairSurchargeMonths > 0) state.repairSurchargeMonths--;
    return interest;
  };

  function euroInput(id, label, value = 0, hint = '') {
    return `
      <label class="personal-field">
        <span>${label}</span>
        <div class="personal-input-wrap"><input id="${id}" type="number" min="0" step="1" value="${value}"><b>€</b></div>
        ${hint ? `<small>${hint}</small>` : ''}
      </label>`;
  }

  function numberInput(id, label, value = 0, suffix = '', hint = '', step = '1') {
    return `
      <label class="personal-field">
        <span>${label}</span>
        <div class="personal-input-wrap"><input id="${id}" type="number" min="0" step="${step}" value="${value}">${suffix ? `<b>${suffix}</b>` : ''}</div>
        ${hint ? `<small>${hint}</small>` : ''}
      </label>`;
  }

  function makeUi() {
    const careerGrid = document.querySelector('#startModal .career-choice-grid');
    if (careerGrid && !document.getElementById('personalSituationChoice')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'personalSituationChoice';
      btn.className = 'career-choice personal-situation-choice';
      btn.innerHTML = `
        <span>👤</span>
        <strong>Ma situation</strong>
        <small>Pars de ta situation financière réelle : revenus, dépenses, placements, immobilier et crédits.</small>`;
      careerGrid.appendChild(btn);

      btn.addEventListener('click', () => {
        document.querySelectorAll('.career-choice').forEach(x => x.classList.toggle('selected', x === btn));
        selectedCareer = null;
        const startBtn = el('startGameBtn');
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.textContent = 'Configurer Ma situation';
          startBtn.onclick = openPersonalSetup;
        }
      });

      careerGrid.querySelectorAll('.career-choice:not(#personalSituationChoice)').forEach(choice => {
        choice.addEventListener('click', () => {
          const startBtn = el('startGameBtn');
          if (startBtn) {
            startBtn.textContent = 'Démarrer la partie';
            startBtn.onclick = startGame;
          }
        });
      });
    }

    if (!document.getElementById('personalSetupModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="personalSetupModal" class="modal hidden personal-modal">
          <div class="modal-card wide personal-card">
            <button type="button" class="modal-close" id="closePersonalSetup">×</button>
            <p class="eyebrow">Profil personnalisé</p>
            <h2>👤 Ma situation</h2>
            <p class="muted personal-intro">
              Renseigne ta situation actuelle. Les montants mensuels doivent correspondre à ce que tu touches
              et dépenses réellement aujourd’hui.
            </p>

            <section class="personal-section">
              <h3>1. Profil et trésorerie</h3>
              <div class="personal-grid cols-3">
                ${numberInput('psAge', 'Âge', 30, 'ans')}
                ${euroInput('psCash', 'Compte courant / trésorerie', 2500)}
                ${euroInput('psTax', 'Impôt / prélèvement à la source mensuel', 0, 'Hors fiscalité des placements et hors prélèvements sociaux sur les revenus locatifs, calculés séparément.')}
                ${numberInput('psInflation', 'Inflation annuelle connue', 2.4, '%', 'Si tu ne connais pas le taux, laisse la valeur proposée par défaut.', '0.1')}
              </div>
            </section>

            <section class="personal-section">
              <h3>2. Revenus mensuels</h3>
              <div class="personal-grid cols-2">
                ${euroInput('psSalary', 'Salaire net mensuel', 2500)}
                ${euroInput('psOtherIncome', 'Autres revenus réguliers', 0, 'Primes récurrentes, pensions, revenus du conjoint si tu veux simuler le foyer, etc.')}
              </div>
            </section>

            <section class="personal-section">
              <h3>3. Dépenses mensuelles</h3>
              <div class="personal-grid cols-3">
                ${euroInput('psHousing', 'Logement / charges hors mensualité de crédit', 700, 'Si tu as un crédit immobilier, sa mensualité se renseigne séparément plus bas.')}
                ${euroInput('psLiving', 'Vie courante / alimentation', 500)}
                ${euroInput('psTransport', 'Transport', 180)}
                ${euroInput('psLeisure', 'Loisirs / sorties', 200)}
                ${euroInput('psOtherExpenses', 'Autres dépenses', 0, 'Enfants, abonnements, santé, assurances ou autres charges non classées.')}
              </div>
            </section>

            <section class="personal-section">
              <div class="personal-section-head">
                <div><h3>4. Investissements déjà détenus</h3><p>Indique la valeur actuelle et, si tu la connais, le prix de revient.</p></div>
              </div>

              <div class="personal-asset-block">
                <h4>🛟 Livret</h4>
                <div class="personal-grid cols-2">
                  ${euroInput('psLivret', 'Valeur actuelle', 0)}
                  ${euroInput('psLivretAuto', 'Versement automatique / mois', 0)}
                </div>
              </div>

              <div class="personal-asset-block">
                <h4>🌍 PEA / ETF Monde</h4>
                <div class="personal-grid cols-3">
                  ${euroInput('psPea', 'Valeur actuelle', 0)}
                  ${euroInput('psPeaBasis', 'Sommes versées / prix de revient', 0, 'Si inconnu, laisse 0 : la valeur actuelle sera utilisée.')}
                  ${numberInput('psPeaAge', 'Ancienneté du PEA', 0, 'ans', '', '0.1')}
                  ${euroInput('psPeaAuto', 'Versement automatique / mois', 0)}
                </div>
              </div>

              <div class="personal-asset-block">
                <h4>🧱 Assurance-vie</h4>
                <div class="personal-grid cols-3">
                  ${euroInput('psAv', 'Valeur actuelle', 0)}
                  ${euroInput('psAvBasis', 'Primes / prix de revient', 0, 'Si inconnu, laisse 0 : la valeur actuelle sera utilisée.')}
                  ${numberInput('psAvAge', 'Ancienneté du contrat', 0, 'ans', '', '0.1')}
                  ${euroInput('psAvAuto', 'Versement automatique / mois', 0)}
                </div>
              </div>

              <div class="personal-asset-block">
                <h4>📈 CTO / Actions</h4>
                <div class="personal-grid cols-3">
                  ${euroInput('psCto', 'Valeur actuelle', 0)}
                  ${euroInput('psCtoBasis', 'Prix de revient', 0, 'Si inconnu, laisse 0 : la valeur actuelle sera utilisée.')}
                  ${euroInput('psCtoAuto', 'Versement automatique / mois', 0)}
                </div>
              </div>

              <div class="personal-asset-block">
                <h4>₿ Crypto</h4>
                <div class="personal-grid cols-3">
                  ${euroInput('psCrypto', 'Valeur actuelle', 0)}
                  ${euroInput('psCryptoBasis', 'Prix de revient', 0, 'Si inconnu, laisse 0 : la valeur actuelle sera utilisée.')}
                  ${euroInput('psCryptoAuto', 'Versement automatique / mois', 0)}
                </div>
              </div>

              <div class="personal-asset-block property-block">
                <h4>🏠 Bien immobilier — résidence principale</h4>
                <div class="personal-grid cols-3">
                  ${euroInput('psHomeValue', 'Valeur actuelle du bien', 0)}
                  ${euroInput('psHomeDebt', 'Capital restant dû', 0)}
                  ${euroInput('psHomePayment', 'Mensualité du crédit', 0)}
                  ${numberInput('psHomeRate', 'Taux du crédit', 3.0, '%', '', '0.01')}
                  ${numberInput('psHomeMonths', 'Durée restante', 0, 'mois')}
                </div>
              </div>

              <div class="personal-asset-block property-block">
                <h4>🔑 Bien immobilier — locatif</h4>
                <div class="personal-grid cols-3">
                  ${euroInput('psRentalValue', 'Valeur actuelle du bien', 0)}
                  ${euroInput('psRentalDebt', 'Capital restant dû', 0)}
                  ${euroInput('psRentalPayment', 'Mensualité du crédit', 0)}
                  ${numberInput('psRentalRate', 'Taux du crédit', 3.2, '%', '', '0.01')}
                  ${numberInput('psRentalMonths', 'Durée restante', 0, 'mois')}
                  ${euroInput('psRentIncome', 'Loyer encaissé / mois', 0)}
                  ${euroInput('psRentalCosts', 'Charges du bien / mois', 0)}
                </div>
              </div>
            </section>

            <section class="personal-section">
              <h3>5. Autres crédits et actifs</h3>
              <div class="personal-asset-block">
                <h4>🚗 Véhicule / crédit auto</h4>
                <div class="personal-grid cols-3">
                  ${euroInput('psCarValue', 'Valeur actuelle du véhicule', 0)}
                  ${euroInput('psCarDebt', 'Capital restant dû', 0)}
                  ${euroInput('psCarPayment', 'Mensualité', 0)}
                  ${numberInput('psCarRate', 'Taux', 5.5, '%', '', '0.01')}
                  ${numberInput('psCarMonths', 'Mois restants', 0, 'mois')}
                </div>
              </div>
              <div class="personal-asset-block">
                <h4>💳 Prêt personnel / consommation</h4>
                <div class="personal-grid cols-3">
                  ${euroInput('psConsumerDebt', 'Capital restant dû', 0)}
                  ${euroInput('psConsumerPayment', 'Mensualité', 0)}
                  ${numberInput('psConsumerRate', 'Taux', 8, '%', '', '0.01')}
                  ${numberInput('psConsumerMonths', 'Mois restants', 0, 'mois')}
                </div>
              </div>
              <div class="personal-asset-block">
                <h4>🎓 Prêt étudiant / autre</h4>
                <div class="personal-grid cols-3">
                  ${euroInput('psStudentDebt', 'Capital restant dû', 0)}
                  ${euroInput('psStudentPayment', 'Mensualité', 0)}
                  ${numberInput('psStudentRate', 'Taux', 2.5, '%', '', '0.01')}
                  ${numberInput('psStudentMonths', 'Mois restants', 0, 'mois')}
                </div>
              </div>
            </section>

            <section class="personal-summary" id="personalStartSummary">
              <div><span>Revenus</span><strong id="psSummaryIncome">—</strong></div>
              <div><span>Dépenses</span><strong id="psSummaryExpenses">—</strong></div>
              <div><span>Capacité mensuelle</span><strong id="psSummaryFlow">—</strong></div>
              <div><span>Patrimoine net initial</span><strong id="psSummaryWorth">—</strong></div>
            </section>

            <p class="personal-disclaimer">
              Si un prix de revient est inconnu, le jeu utilisera la valeur actuelle : les plus-values antérieures
              ne pourront alors pas être reconstituées exactement.
            </p>
            <button type="button" id="confirmPersonalSetup" class="btn primary full big">Démarrer avec Ma situation</button>
          </div>
        </div>`);

      el('closePersonalSetup').onclick = closePersonalSetup;
      el('confirmPersonalSetup').onclick = startPersonalGame;
      document.querySelectorAll('#personalSetupModal input').forEach(input =>
        input.addEventListener('input', refreshSetupSummary)
      );
    }

    if (!document.getElementById('personalAnnualModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="personalAnnualModal" class="modal hidden personal-modal">
          <div class="modal-card personal-card annual-personal-card">
            <p class="eyebrow">Mise à jour annuelle</p>
            <h2>📅 Ma situation — <span id="personalAnnualYear"></span></h2>
            <p class="muted">
              Mets à jour uniquement ce qui a réellement changé. Les placements et crédits continuent
              d’évoluer automatiquement dans le jeu.
            </p>

            <section class="personal-section">
              <h3>Revenus mensuels</h3>
              <div class="personal-grid cols-2">
                ${euroInput('paSalary', 'Salaire net mensuel', 0)}
                ${euroInput('paOtherIncome', 'Autres revenus réguliers', 0)}
                ${euroInput('paTax', 'Impôt / prélèvement à la source mensuel', 0, 'Hors fiscalité des placements et prélèvements sociaux locatifs.')}
                ${numberInput('paInflation', 'Inflation annuelle retenue', 2.4, '%', 'Si tu ne connais pas le nouveau taux, conserve la valeur proposée.', '0.1')}
              </div>
            </section>

            <section class="personal-section">
              <h3>Dépenses mensuelles</h3>
              <div class="personal-grid cols-2">
                ${euroInput('paHousing', 'Logement / charges hors mensualité de crédit', 0)}
                ${euroInput('paLiving', 'Vie courante / alimentation', 0)}
                ${euroInput('paTransport', 'Transport', 0)}
                ${euroInput('paLeisure', 'Loisirs / sorties', 0)}
                ${euroInput('paOtherExpenses', 'Autres dépenses', 0)}
              </div>
            </section>

            <div class="personal-annual-actions">
              <button type="button" id="personalAnnualNoChange" class="btn ghost">Aucun changement</button>
              <button type="button" id="personalAnnualSave" class="btn primary">Enregistrer les changements</button>
            </div>
          </div>
        </div>`);

      el('personalAnnualNoChange').onclick = () => completeAnnualReview(false);
      el('personalAnnualSave').onclick = () => completeAnnualReview(true);
    }
  }

  function openPersonalSetup() {
    makeUi();
    refreshSetupSummary();
    el('personalSetupModal').classList.remove('hidden');
  }

  function closePersonalSetup() {
    el('personalSetupModal').classList.add('hidden');
  }

  function calculateSetup() {
    const income = n('psSalary') + n('psOtherIncome') + n('psRentIncome');
    const debts = n('psHomePayment') + n('psRentalPayment') + n('psCarPayment') +
      n('psConsumerPayment') + n('psStudentPayment');
    const expenses = n('psHousing') + n('psLiving') + n('psTransport') + n('psLeisure') +
      n('psOtherExpenses') + n('psTax') + n('psRentalCosts') + debts;
    const assets = n('psCash') + n('psLivret') + n('psPea') + n('psAv') + n('psCto') +
      n('psCrypto') + n('psHomeValue') + n('psRentalValue') + n('psCarValue');
    const debt = n('psHomeDebt') + n('psRentalDebt') + n('psCarDebt') +
      n('psConsumerDebt') + n('psStudentDebt');
    return { income, expenses, flow: income - expenses, worth: assets - debt };
  }

  function refreshSetupSummary() {
    const s = calculateSetup();
    if (!el('psSummaryIncome')) return;
    el('psSummaryIncome').textContent = `${fmtEUR(s.income)}/mois`;
    el('psSummaryExpenses').textContent = `${fmtEUR(s.expenses)}/mois`;
    el('psSummaryFlow').textContent = `${s.flow >= 0 ? '+' : ''}${fmtEUR(s.flow)}/mois`;
    el('psSummaryFlow').className = s.flow >= 0 ? 'positive' : 'negative';
    el('psSummaryWorth').textContent = fmtEUR(s.worth);
    el('psSummaryWorth').className = s.worth >= 0 ? 'positive' : 'negative';
  }

  function basisOrValue(basisId, value) {
    const entered = n(basisId);
    return entered > 0 ? entered : value;
  }

  function makeDebtMeta(balance, ratePercent, months, payment) {
    if (balance <= 0) return null;
    const rate = Math.max(0, ratePercent / 100);
    const m = Math.max(1, months || 1);
    return creditMeta(balance, rate, m, payment || 0);
  }

  function startPersonalGame() {
    state = baseState();
    state.started = true;
    state.careerKey = 'public'; // clé technique ; l'interface affiche "Ma situation"
    state.difficulty = 'normal';
    state.wellbeing = 75;
    state.ageMonths = Math.max(18 * 12, Math.round(n('psAge') * 12));

    state.personalProfile = Object.assign(defaultPersonalProfile(), {
      enabled: true,
      otherIncome: n('psOtherIncome'),
      taxMonthly: n('psTax'),
      otherExpenses: n('psOtherExpenses'),
      lastAnnualReviewYear: state.year,
      annualReviewDue: false,
      source: 'manual'
    });

    state.cash = n('psCash');
    state.salary = n('psSalary');
    state.annualInflation = inflationFromInput('psInflation', 0.024);
    state.housing = n('psHousing');
    state.living = n('psLiving');
    state.transport = n('psTransport');
    state.leisure = n('psLeisure');

    state.livret = n('psLivret');
    state.pea = n('psPea');
    state.assurance = n('psAv');
    state.cto = n('psCto');
    state.crypto = n('psCrypto');

    state.basis.livret = state.livret;
    state.basis.pea = basisOrValue('psPeaBasis', state.pea);
    state.basis.assurance = basisOrValue('psAvBasis', state.assurance);
    state.basis.cto = basisOrValue('psCtoBasis', state.cto);
    state.basis.crypto = basisOrValue('psCryptoBasis', state.crypto);

    state.autoInvest = {
      livret: n('psLivretAuto'),
      pea: n('psPeaAuto'),
      assurance: n('psAvAuto'),
      cto: n('psCtoAuto'),
      crypto: n('psCryptoAuto')
    };

    state.homeValue = n('psHomeValue');
    state.homeDebt = n('psHomeDebt');
    state.homePayment = n('psHomePayment');
    state.homeCost = state.housing;
    state.debtMeta.home = makeDebtMeta(
      state.homeDebt, n('psHomeRate'), n('psHomeMonths'), state.homePayment
    );

    state.rentalValue = n('psRentalValue');
    state.rentalDebt = n('psRentalDebt');
    state.rentalPayment = n('psRentalPayment');
    state.rentIncome = n('psRentIncome');
    state.rentalCosts = n('psRentalCosts');
    state.debtMeta.rental = makeDebtMeta(
      state.rentalDebt, n('psRentalRate'), n('psRentalMonths'), state.rentalPayment
    );

    state.carValue = n('psCarValue');
    state.carDebt = n('psCarDebt');
    state.carPayment = n('psCarPayment');
    state.carMonths = Math.round(n('psCarMonths'));
    state.debtMeta.car = makeDebtMeta(
      state.carDebt, n('psCarRate'), state.carMonths, state.carPayment
    );

    state.consumerDebt = n('psConsumerDebt');
    state.consumerPayment = n('psConsumerPayment');
    state.consumerMonths = Math.round(n('psConsumerMonths'));
    state.debtMeta.consumer = makeDebtMeta(
      state.consumerDebt, n('psConsumerRate'), state.consumerMonths, state.consumerPayment
    );

    state.studentDebt = n('psStudentDebt');
    state.studentPayment = n('psStudentPayment');
    state.studentMonths = Math.round(n('psStudentMonths'));
    state.debtMeta.student = makeDebtMeta(
      state.studentDebt, n('psStudentRate'), state.studentMonths, state.studentPayment
    );

    // Synchronisation avec le moteur fiscal installé.
    if (state.tax) {
      state.tax.peaCash = 0;
      state.tax.peaContributions = Math.max(0, state.basis.pea);
      state.tax.peaOpenedMonth = state.pea > 0 ? -monthsAgo(n('psPeaAge')) : null;
      state.tax.assuranceOpenedMonth = state.assurance > 0 ? -monthsAgo(n('psAvAge')) : null;
      state.tax.avAllowanceUsed = {};
      state.tax.ctoYears = {};
      state.tax.cryptoYears = {};
      state.tax.totalPaid = 0;
      state.tax.history = [];
    }

    state.history = [
      `Début de partie — Ma situation : revenus ${fmtEUR(monthlyIncome())}/mois, ` +
      `patrimoine net ${fmtEUR(netWorth())}.`
    ];
    state.lastEvent =
      'Profil « Ma situation » activé. Chaque début d’année, tu pourras actualiser tes revenus et dépenses.';

    resetYearStats(state.year);
    state.yearStats.openingWorth = netWorth();

    selectedCareer = state.careerKey;
    closePersonalSetup();
    el('startModal').classList.add('hidden');
    silentSave();
    render();
  }

  function applyPersonalUi() {
    if (!state.started) return;

    const training = el('trainingBtn');
    if (training) training.style.display = isPersonal() ? 'none' : '';

    if (!isPersonal()) return;

    if (el('careerHero')) el('careerHero').textContent = 'Ma situation • profil personnel';
    if (el('difficultyTag')) el('difficultyTag').textContent = 'Situation réelle';
    if (el('jobTitle')) el('jobTitle').textContent = 'Ma situation';
    if (el('careerDescription')) {
      el('careerDescription').textContent =
        'Tes revenus, dépenses, placements et crédits de départ correspondent aux données que tu as renseignées.';
    }
    if (el('careerLevel')) el('careerLevel').textContent = 'Profil personnel';
    if (el('salaryCareer')) el('salaryCareer').textContent = `${fmtEUR(state.salary)}/mois`;
    if (el('stabilityCareer')) el('stabilityCareer').textContent = 'Révision annuelle';
    if (el('trainingCost')) el('trainingCost').textContent = '—';
  }

  function refreshSavedGamePreview() {
    if (state.started) return;
    const box = document.getElementById('existingSaveBox');
    const small = box?.querySelector('small');
    if (!small || typeof load !== 'function') return;
    const raw = load();
    if (!raw || !raw.started) return;
    const saved = hydrate(raw);
    const worth = typeof netWorthFromState === 'function'
      ? netWorthFromState(saved)
      : 0;
    small.textContent = `${monthName(saved.month)} ${saved.year} • ${Math.floor(saved.ageMonths / 12)} ans • patrimoine ${fmtEUR(worth)}`;
  }

  render = function () {
    const result = CORE.render();
    makeUi();
    applyPersonalUi();
    refreshSavedGamePreview();
    return result;
  };

  function openAnnualReview() {
    if (!isPersonal() || !state.personalProfile.annualReviewDue || state.gameOver) return;
    makeUi();

    el('personalAnnualYear').textContent = String(state.year);
    el('paSalary').value = Math.round(state.salary || 0);
    el('paOtherIncome').value = Math.round(state.personalProfile.otherIncome || 0);
    el('paTax').value = Math.round(state.personalProfile.taxMonthly || 0);
    el('paInflation').value = ((Number(state.annualInflation) || 0.024) * 100).toFixed(1);
    el('paHousing').value = Math.round(state.housing || 0);
    el('paLiving').value = Math.round(state.living || 0);
    el('paTransport').value = Math.round(state.transport || 0);
    el('paLeisure').value = Math.round(state.leisure || 0);
    el('paOtherExpenses').value = Math.round(state.personalProfile.otherExpenses || 0);

    el('personalAnnualModal').classList.remove('hidden');
  }

  function completeAnnualReview(saveChanges) {
    if (saveChanges) {
      state.salary = n('paSalary');
      state.personalProfile.otherIncome = n('paOtherIncome');
      state.personalProfile.taxMonthly = n('paTax');
      state.annualInflation = inflationFromInput('paInflation', Number(state.annualInflation) || 0.024);
      state.housing = n('paHousing');
      state.living = n('paLiving');
      state.transport = n('paTransport');
      state.leisure = n('paLeisure');
      state.personalProfile.otherExpenses = n('paOtherExpenses');

      state.lastEvent =
        `Ma situation mise à jour pour ${state.year} : revenus ${fmtEUR(monthlyIncome())}/mois, ` +
        `dépenses ${fmtEUR(monthlyExpenses())}/mois, inflation ${(state.annualInflation * 100).toFixed(1).replace('.', ',')} %.`;
    } else {
      state.lastEvent =
        `Ma situation confirmée sans changement pour ${state.year}. ` +
        `Inflation conservée à ${(state.annualInflation * 100).toFixed(1).replace('.', ',')} %.`;
    }

    state.personalProfile.lastAnnualReviewYear = state.year;
    state.personalProfile.annualReviewDue = false;
    addHistory(`${monthName(state.month)} ${state.year} — ${state.lastEvent}`);
    el('personalAnnualModal').classList.add('hidden');
    silentSave();
    render();
  }

  // Après fermeture du bilan annuel normal, le profil réel est invité à réviser ses paramètres.
  const annualClose = el('closeAnnualBtn');
  if (annualClose && !annualClose.dataset.personalBound) {
    annualClose.dataset.personalBound = '1';
    annualClose.addEventListener('click', () => setTimeout(openAnnualReview, 0));
  }

  // Après une simulation interrompue à la fin d'une année.
  const simClose = el('closeSimulationBtn');
  if (simClose && !simClose.dataset.personalBound) {
    simClose.dataset.personalBound = '1';
    simClose.addEventListener('click', () => setTimeout(openAnnualReview, 0));
  }

  // En mode Ma situation, une avance rapide s'arrête au prochain changement d'année
  // afin que le joueur puisse réviser ses données avant de poursuivre.
  simulateMonths = function (count) {
    if (!isPersonal()) return CORE.simulateMonths(count);

    count = Math.max(1, Math.min(120, Number(count) || 1));
    if (state.gameOver) {
      showEndModal('loss');
      return;
    }

    const monthsToYearEnd = Math.max(1, 13 - Number(state.month || 1));
    const actualCount = Math.min(count, monthsToYearEnd);

    simulationMode = true;
    const startWorth = netWorth();
    const startLabel = `${monthName(state.month)} ${state.year}`;
    const rows = [];
    const totals = { income: 0, expenses: 0, investments: 0, taxes: 0, interest: 0, events: 0 };

    for (let i = 0; i < actualCount; i++) {
      const r = simulateOneMonth();
      if (!r) break;
      rows.push(r);
      totals.income += r.income;
      totals.expenses += r.expenses;
      totals.investments += r.investments;
      totals.taxes += r.taxes;
      totals.interest += r.interest;
      if (r.event) totals.events++;
      if (state.gameOver) break;
    }

    simulationMode = false;
    render();
    showSimulationReport(startLabel, rows, startWorth, totals);

    if (count > actualCount && state.personalProfile.annualReviewDue) {
      const subtitle = el('simulationSubtitle');
      if (subtitle) {
        subtitle.textContent +=
          ` La simulation demandée (${count} mois) a été arrêtée au changement d’année pour mettre à jour « Ma situation ».`;
      }
    }
  };

  // Les scripts précédents avaient déjà branché ce bouton : on le rebranche sur notre version finale.
  const simulateControl = el('simulateMonthsBtn');
  if (simulateControl) simulateControl.onclick = () => simulateMonths(el('simulateMonthsSelect').value);

  makeUi();
  render();
})();