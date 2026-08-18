(() => {
  'use strict';

  if (typeof state === 'undefined' || typeof render !== 'function' || typeof moveAsset !== 'function') return;

  const TAX_RULES = Object.freeze({
    year: 2026,
    pfuIncome: 0.128,
    social: 0.186,
    pfu: 0.314,
    assuranceSocial: 0.172,
    assuranceBefore8Income: 0.128,
    assuranceAfter8Income: 0.075,
    assuranceHighPremiumIncome: 0.128,
    assurancePremiumThreshold: 150000,
    assuranceAllowanceSingle: 4600,
    peaFiveYearsMonths: 60,
    assuranceEightYearsMonths: 96
  });

  const PRODUCT_INFO = {
    livret: {
      icon: '🛟',
      title: 'Livret A / LEP',
      tag: 'Exonéré',
      lead: 'Épargne de précaution liquide et peu risquée.',
      bullets: [
        'Intérêts exonérés d’impôt sur le revenu et de prélèvements sociaux.',
        'Retraits non fiscalisés : l’argent revient directement en trésorerie.',
        'Dans le jeu, Livret A et LEP sont regroupés dans une même poche réglementée simplifiée.',
        'Usage conseillé : constituer d’abord un fonds de sécurité avant d’augmenter le risque.'
      ]
    },
    pea: {
      icon: '🌍',
      title: 'PEA — ETF Monde',
      tag: 'Fiscalité au retrait',
      lead: 'Enveloppe long terme pour investir en actions éligibles.',
      bullets: [
        'Vendre un titre à l’intérieur du PEA ne déclenche pas d’impôt : le produit de vente reste dans la poche espèces du PEA.',
        'Avant 5 ans, un retrait entraîne en principe la clôture du plan ; les gains sont simulés au PFU de 31,4 %.',
        'Après 5 ans, les gains retirés sont exonérés d’impôt sur le revenu mais soumis aux prélèvements sociaux de 18,6 %.',
        'Le plafond de versements du PEA classique est limité à 150 000 € dans le moteur ; les gains n’entrent pas dans ce plafond.',
        'Dans le jeu, un retrait avant 5 ans liquide volontairement tout le PEA afin de reproduire la clôture du plan.'
      ]
    },
    assurance: {
      icon: '🧱',
      title: 'Assurance-vie',
      tag: 'Fiscalité au rachat',
      lead: 'Enveloppe polyvalente de moyen / long terme.',
      bullets: [
        'Tant qu’il n’y a pas de retrait, le jeu ne déclenche pas d’impôt sur la plus-value latente.',
        'Lors d’un rachat partiel, seule la part de gains comprise dans le retrait est fiscalisée.',
        'Avant 8 ans : simulation à 12,8 % d’impôt sur le revenu + 17,2 % de prélèvements sociaux sur les gains.',
        'Après 8 ans : abattement annuel simulé de 4 600 € sur les gains pour une personne seule, puis taux de 7,5 % jusqu’au seuil de primes de 150 000 € ; prélèvements sociaux de 17,2 % sur les gains.'
      ]
    },
    cto: {
      icon: '📈',
      title: 'CTO — Actions',
      tag: 'PFU 31,4 %',
      lead: 'Enveloppe souple, sans avantage fiscal lié à la durée de détention.',
      bullets: [
        'Une vente avec plus-value déclenche la fiscalité dans la simulation.',
        'Régime forfaitaire 2026 simulé : 12,8 % d’impôt sur le revenu + 18,6 % de prélèvements sociaux, soit 31,4 %.',
        'Les moins-values sont compensées avec les plus-values de même nature et le reliquat est reporté jusqu’à 10 ans.',
        'Le jeu recalcule la dette fiscale annuelle : une moins-value ultérieure dans la même année peut donc générer un remboursement simulé.'
      ]
    },
    crypto: {
      icon: '₿',
      title: 'Crypto',
      tag: 'PFU 31,4 %',
      lead: 'Actif très volatil, avec fiscalité lors des cessions imposables.',
      bullets: [
        'Dans le jeu, “Vendre” signifie céder les crypto-actifs contre des euros : la plus-value éventuelle devient imposable.',
        'Pour un particulier, la simulation 2026 applique le PFU de 31,4 % sur le gain net imposable.',
        'Les moins-values crypto compensent les gains crypto de la même année dans la simulation ; elles ne sont pas reportées sur les années suivantes.',
        'Les échanges crypto-contre-crypto, qui bénéficient en droit français d’un sursis d’imposition sans soulte, ne sont pas modélisés dans cette version.'
      ]
    },
    home: {
      icon: '🏠',
      title: 'Résidence principale',
      tag: 'Revente non disponible',
      lead: 'Projet immobilier d’usage avant d’être un placement financier.',
      bullets: [
        'La revente n’existe pas encore dans cette version du jeu, donc aucune plus-value immobilière n’est actuellement déclenchée.',
        'En droit français, la plus-value de cession de la résidence principale bénéficie en principe d’une exonération, sous conditions.',
        'Le financement, les intérêts et les charges restent simulés par le moteur bancaire actuel.'
      ]
    },
    rental: {
      icon: '🔑',
      title: 'Bien locatif',
      tag: 'Revenus fiscalisés',
      lead: 'Immobilier destiné à produire un revenu locatif.',
      bullets: [
        'Le jeu assimile le bien à une location nue simplifiée.',
        'Les revenus locatifs nets supportent désormais 17,2 % de prélèvements sociaux en plus du calcul simplifié d’impôt sur le revenu déjà présent dans le jeu.',
        'La revente du bien n’est pas encore disponible : la fiscalité des plus-values immobilières sera appliquée quand cette action sera ajoutée.',
        'Les règles réelles de charges déductibles, déficit foncier et intérêts sont volontairement simplifiées.'
      ]
    }
  };

  const assetLabel = asset => asset === 'livret' ? 'le livret' : asset === 'assurance' ? 'l’assurance-vie' : asset === 'pea' ? 'le PEA' : asset === 'cto' ? 'le CTO' : 'la crypto';
  const currentGameMonth = () => Math.max(0, Number(state.totalMonths) || 0);
  const yearsSince = opened => opened == null ? 0 : Math.max(0, (currentGameMonth() - opened) / 12);
  const fmtPct = n => `${(n * 100).toFixed(1).replace('.', ',')} %`;
  const deepClone = value => JSON.parse(JSON.stringify(value));

  function defaultTaxState(s) {
    const basis = s.basis || {};
    const now = Math.max(0, Number(s.totalMonths) || 0);
    return {
      schema: 1,
      rulesYear: 2026,
      totalPaid: 0,
      peaOpenedMonth: (s.pea || 0) > 0 ? now : null,
      peaCash: 0,
      peaContributions: Math.max(0, Number(basis.pea) || 0),
      assuranceOpenedMonth: (s.assurance || 0) > 0 ? now : null,
      avAllowanceUsed: {},
      ctoYears: {},
      cryptoYears: {},
      history: []
    };
  }

  function ensureTaxState(s) {
    if (!s || typeof s !== 'object') return s;
    const d = defaultTaxState(s);
    s.tax = Object.assign(d, s.tax || {});
    const t = s.tax;
    if (!Number.isFinite(t.totalPaid)) t.totalPaid = 0;
    if (!Number.isFinite(t.peaCash) || t.peaCash < 0) t.peaCash = 0;
    if (!Number.isFinite(t.peaContributions) || t.peaContributions < 0) t.peaContributions = Math.max(0, Number(s.basis?.pea) || 0);
    if (!t.avAllowanceUsed || typeof t.avAllowanceUsed !== 'object') t.avAllowanceUsed = {};
    if (!t.ctoYears || typeof t.ctoYears !== 'object') t.ctoYears = {};
    if (!t.cryptoYears || typeof t.cryptoYears !== 'object') t.cryptoYears = {};
    if (!Array.isArray(t.history)) t.history = [];
    if (t.peaOpenedMonth != null && !Number.isFinite(Number(t.peaOpenedMonth))) t.peaOpenedMonth = currentGameMonth();
    if (t.assuranceOpenedMonth != null && !Number.isFinite(Number(t.assuranceOpenedMonth))) t.assuranceOpenedMonth = currentGameMonth();
    return s;
  }

  const coreBaseState = baseState;
  baseState = function () { return ensureTaxState(coreBaseState()); };
  const coreHydrate = hydrate;
  hydrate = function (raw) { return ensureTaxState(coreHydrate(raw)); };
  state = ensureTaxState(state);

  const coreNetWorthFromState = netWorthFromState;
  netWorthFromState = function (s) {
    ensureTaxState(s);
    return coreNetWorthFromState(s) + (Number(s.tax?.peaCash) || 0);
  };

  const coreGrossAssets = grossAssets;
  grossAssets = function () { return coreGrossAssets() + (Number(state.tax?.peaCash) || 0); };

  const coreMonthlyTax = monthlyTax;
  monthlyTax = function () {
    const base = coreMonthlyTax();
    const rentalNet = Math.max(0, (Number(state.rentIncome) || 0) - (Number(state.rentalCosts) || 0));
    return base + rentalNet * 0.172;
  };

  function touchWrapperOnContribution(asset, amount) {
    const t = ensureTaxState(state).tax;
    const now = currentGameMonth();
    if (asset === 'pea') {
      if (t.peaOpenedMonth == null) t.peaOpenedMonth = now;
      t.peaContributions += amount;
    }
    if (asset === 'assurance' && t.assuranceOpenedMonth == null) t.assuranceOpenedMonth = now;
  }

  applyAutoInvestments = function () {
    let total = 0, done = [];
    for (const a of ['livret', 'pea', 'assurance', 'cto', 'crypto']) {
      let amount = Math.max(0, Number(state.autoInvest[a] || 0));
      if (!amount) continue;
      let actual = Math.min(amount, Math.max(0, state.cash));
      if (a === 'pea') actual = Math.min(actual, Math.max(0, 150000 - (Number(state.tax?.peaContributions) || 0)));
      if (actual <= 0) { if (state.cash <= 0) break; else continue; }
      state.cash -= actual;
      state[a] += actual;
      state.basis[a] += actual;
      touchWrapperOnContribution(a, actual);
      total += actual;
      done.push(`${a === 'livret' ? 'Livret' : a === 'assurance' ? 'Assurance-vie' : a.toUpperCase()} ${fmtEUR(actual)}`);
    }
    state.monthInvested += total;
    return { total, done };
  };

  function ctoTaxableByYear(years, targetYear) {
    const sorted = Object.keys(years).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    const lossPool = [];
    let targetTaxable = 0;
    for (const y of sorted) {
      for (let i = lossPool.length - 1; i >= 0; i--) {
        if (lossPool[i].origin < y - 10) lossPool.splice(i, 1);
      }
      let net = Number(years[y]?.net) || 0;
      if (net < 0) {
        lossPool.push({ origin: y, amount: -net });
        if (y === targetYear) targetTaxable = 0;
        continue;
      }
      let remaining = net;
      lossPool.sort((a, b) => a.origin - b.origin);
      for (const loss of lossPool) {
        if (remaining <= 0) break;
        const used = Math.min(loss.amount, remaining);
        loss.amount -= used;
        remaining -= used;
      }
      for (let i = lossPool.length - 1; i >= 0; i--) if (lossPool[i].amount <= 1e-9) lossPool.splice(i, 1);
      if (y === targetYear) targetTaxable = Math.max(0, remaining);
    }
    return targetTaxable;
  }

  function previewLedgerTax(kind, realisedGain) {
    const y = Number(state.year) || 2026;
    const t = ensureTaxState(state).tax;
    const source = kind === 'cto' ? t.ctoYears : t.cryptoYears;
    const years = deepClone(source || {});
    years[y] = Object.assign({ net: 0, taxPaid: 0 }, years[y] || {});
    years[y].net = (Number(years[y].net) || 0) + realisedGain;
    const taxable = kind === 'cto' ? ctoTaxableByYear(years, y) : Math.max(0, Number(years[y].net) || 0);
    const liability = taxable * TAX_RULES.pfu;
    const previouslyPaid = Number(source?.[y]?.taxPaid) || 0;
    return { year: y, net: years[y].net, taxable, liability, taxDelta: liability - previouslyPaid };
  }

  function applyLedgerTax(kind, realisedGain) {
    const p = previewLedgerTax(kind, realisedGain);
    const t = ensureTaxState(state).tax;
    const years = kind === 'cto' ? t.ctoYears : t.cryptoYears;
    years[p.year] = Object.assign({ net: 0, taxPaid: 0 }, years[p.year] || {});
    years[p.year].net = (Number(years[p.year].net) || 0) + realisedGain;
    years[p.year].taxPaid = p.liability;
    applyTaxCashflow(p.taxDelta, `${kind === 'cto' ? 'CTO' : 'Crypto'} — régularisation fiscale ${p.year}`);
    return p;
  }

  function applyTaxCashflow(amount, label) {
    if (!Number.isFinite(amount) || Math.abs(amount) < 0.005) return;
    state.cash -= amount;
    state.tax.totalPaid += amount;
    if (state.yearStats) state.yearStats.taxes = (Number(state.yearStats.taxes) || 0) + amount;
    state.tax.history.unshift({ year: state.year, month: state.month, label, amount });
    state.tax.history = state.tax.history.slice(0, 30);
  }

  function taxAgeText(opened, thresholdMonths) {
    if (opened == null) return 'Non ouvert';
    const months = Math.max(0, currentGameMonth() - opened);
    const years = Math.floor(months / 12);
    const rest = months % 12;
    if (thresholdMonths && months >= thresholdMonths) return `${years} ans${rest ? ` ${rest} mois` : ''}`;
    return `${years} an${years > 1 ? 's' : ''}${rest ? ` ${rest} mois` : ''}`;
  }

  function productDynamicTag(key) {
    const t = ensureTaxState(state).tax;
    if (key === 'pea') {
      if (t.peaOpenedMonth == null) return 'Fiscalité au retrait';
      const months = currentGameMonth() - t.peaOpenedMonth;
      return months >= TAX_RULES.peaFiveYearsMonths ? 'PEA ≥ 5 ans • PS 18,6 %' : 'PEA < 5 ans • retrait 31,4 %';
    }
    if (key === 'assurance') {
      if (t.assuranceOpenedMonth == null) return 'Fiscalité au rachat';
      const months = currentGameMonth() - t.assuranceOpenedMonth;
      return months >= TAX_RULES.assuranceEightYearsMonths ? 'AV ≥ 8 ans • abattement' : 'AV < 8 ans • gains fiscalisés';
    }
    return PRODUCT_INFO[key]?.tag || '';
  }

  function operationRow(label, value, cls = '') {
    return `<div class="tax-operation-row"><span>${label}</span><strong class="${cls}">${value}</strong></div>`;
  }

  let pendingTaxConfirm = null;

  function ensureTaxUi() {
    if (!document.getElementById('taxInfoModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="taxInfoModal" class="tax-overlay tax-hidden" role="dialog" aria-modal="true" aria-labelledby="taxInfoTitle">
          <div class="tax-modal-card">
            <button class="tax-modal-close" data-tax-close="info" aria-label="Fermer">×</button>
            <p class="tax-kicker">Fiscalité française 2026</p>
            <h2 id="taxInfoTitle"></h2>
            <p id="taxInfoLead" class="tax-lead"></p>
            <ul id="taxInfoList" class="tax-info-list"></ul>
            <div id="taxInfoDynamic" class="tax-dynamic-box"></div>
            <p class="tax-disclaimer">Simulation pédagogique : régime forfaitaire par défaut, cas personnels et exceptions non modélisés. Sources de référence : impots.gouv.fr et Service-Public.fr.</p>
          </div>
        </div>
        <div id="taxConfirmModal" class="tax-overlay tax-hidden" role="dialog" aria-modal="true" aria-labelledby="taxConfirmTitle">
          <div class="tax-modal-card tax-confirm-card">
            <button class="tax-modal-close" data-tax-close="confirm" aria-label="Fermer">×</button>
            <p class="tax-kicker">Avant de valider</p>
            <h2 id="taxConfirmTitle">Opération</h2>
            <p id="taxConfirmLead" class="tax-lead"></p>
            <div id="taxConfirmRows" class="tax-operation-list"></div>
            <div id="taxConfirmWarning" class="tax-warning-box"></div>
            <div class="tax-modal-actions">
              <button id="taxCancelBtn" class="btn ghost">Annuler</button>
              <button id="taxConfirmBtn" class="btn primary">Confirmer</button>
            </div>
          </div>
        </div>`);
    }

    document.querySelectorAll('.action-card').forEach(card => card.classList.add('tax-enabled-card'));
    const cardMap = {
      livret: document.querySelector('.action-card.safety'),
      pea: document.querySelector('.action-card.pea'),
      assurance: document.querySelector('.action-card.assurance'),
      cto: document.querySelector('.action-card.cto'),
      crypto: document.querySelector('.action-card.crypto')
    };
    for (const [key, card] of Object.entries(cardMap)) {
      if (!card) continue;
      if (!card.querySelector('.tax-info-btn')) {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'tax-info-btn'; btn.dataset.taxInfo = key; btn.setAttribute('aria-label', `Informations sur ${PRODUCT_INFO[key].title}`); btn.textContent = 'ⓘ';
        card.appendChild(btn);
      }
      if (!card.querySelector('.tax-badge')) {
        const badge = document.createElement('span'); badge.className = 'tax-badge'; badge.dataset.taxBadge = key;
        const p = card.querySelector('p'); (p || card.firstElementChild)?.insertAdjacentElement('afterend', badge);
      }
    }

    const peaCard = cardMap.pea;
    if (peaCard && !peaCard.querySelector('.pea-cash-pocket')) {
      const pocket = document.createElement('div'); pocket.className = 'pea-cash-pocket'; pocket.innerHTML = '<span>💶 Espèces dans le PEA</span><strong id="peaCashPocket">0 €</strong>';
      peaCard.querySelector('.return-line')?.insertAdjacentElement('afterend', pocket);
    }
    if (peaCard) {
      const outBtn = peaCard.querySelector('[data-asset="pea"][data-direction="out"]');
      if (outBtn) outBtn.textContent = 'Vendre';
      const row = peaCard.querySelector('.action-row');
      if (row && !row.querySelector('[data-tax-withdraw="pea"]')) {
        const withdraw = document.createElement('button'); withdraw.type = 'button'; withdraw.className = 'btn mini ghost tax-withdraw-btn'; withdraw.dataset.taxWithdraw = 'pea'; withdraw.textContent = 'Retirer';
        row.appendChild(withdraw);
      }
    }

    document.querySelectorAll('.realestate-grid article').forEach(article => {
      const title = article.querySelector('h4')?.textContent || '';
      const key = title.includes('locatif') ? 'rental' : 'home';
      article.classList.add('tax-enabled-property');
      if (!article.querySelector('.tax-info-btn')) {
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tax-info-btn'; btn.dataset.taxInfo = key; btn.setAttribute('aria-label', `Informations fiscales : ${PRODUCT_INFO[key].title}`); btn.textContent = 'ⓘ'; article.appendChild(btn);
      }
    });

    const investHead = document.querySelector('.invest-card .section-head');
    if (investHead && !document.querySelector('.tax-engine-note')) {
      const note = document.createElement('div'); note.className = 'tax-engine-note'; note.innerHTML = '<span>🇫🇷 Fiscalité 2026 activée</span><small>Les plus-values réalisées et retraits fiscalisés sont calculés automatiquement.</small>';
      investHead.insertAdjacentElement('afterend', note);
    }

    document.querySelectorAll('[data-tax-info]').forEach(btn => {
      if (btn.dataset.taxBound) return; btn.dataset.taxBound = '1';
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openInfo(btn.dataset.taxInfo); });
    });
    document.querySelectorAll('[data-tax-withdraw="pea"]').forEach(btn => {
      if (btn.dataset.taxBound) return; btn.dataset.taxBound = '1';
      btn.addEventListener('click', () => preparePeaWithdrawal());
    });

    document.querySelectorAll('[data-tax-close]').forEach(btn => {
      if (btn.dataset.taxBound) return; btn.dataset.taxBound = '1';
      btn.addEventListener('click', () => closeTaxModal(btn.dataset.taxClose));
    });
    const cancel = document.getElementById('taxCancelBtn');
    if (cancel && !cancel.dataset.taxBound) { cancel.dataset.taxBound = '1'; cancel.addEventListener('click', () => closeTaxModal('confirm')); }
    const confirm = document.getElementById('taxConfirmBtn');
    if (confirm && !confirm.dataset.taxBound) {
      confirm.dataset.taxBound = '1';
      confirm.addEventListener('click', () => {
        const fn = pendingTaxConfirm; pendingTaxConfirm = null; closeTaxModal('confirm'); if (fn) fn();
      });
    }
    document.querySelectorAll('.tax-overlay').forEach(overlay => {
      if (overlay.dataset.taxBound) return; overlay.dataset.taxBound = '1';
      overlay.addEventListener('click', e => { if (e.target === overlay) closeTaxModal(overlay.id === 'taxInfoModal' ? 'info' : 'confirm'); });
    });
  }

  function closeTaxModal(which) {
    const id = which === 'info' ? 'taxInfoModal' : 'taxConfirmModal';
    document.getElementById(id)?.classList.add('tax-hidden');
    if (which !== 'info') pendingTaxConfirm = null;
  }

  function openInfo(key) {
    const info = PRODUCT_INFO[key]; if (!info) return;
    document.getElementById('taxInfoTitle').textContent = `${info.icon} ${info.title}`;
    document.getElementById('taxInfoLead').textContent = info.lead;
    document.getElementById('taxInfoList').innerHTML = info.bullets.map(x => `<li>${x}</li>`).join('');
    let dynamic = '';
    const t = ensureTaxState(state).tax;
    if (key === 'pea') {
      const value = (Number(state.pea) || 0) + (Number(t.peaCash) || 0);
      const gain = value - (Number(t.peaContributions) || 0);
      dynamic = `${operationRow('Ancienneté simulée', taxAgeText(t.peaOpenedMonth))}${operationRow('Valeur totale du PEA', fmtEUR(value))}${operationRow('Versements nets suivis', fmtEUR(t.peaContributions))}${operationRow('Gain / perte du plan', `${gain >= 0 ? '+' : ''}${fmtEUR(gain)}`, gain >= 0 ? 'positive' : 'negative')}`;
    } else if (key === 'assurance') {
      dynamic = `${operationRow('Ancienneté simulée', taxAgeText(t.assuranceOpenedMonth))}${operationRow('Valeur du contrat', fmtEUR(state.assurance))}${operationRow('Primes restantes suivies', fmtEUR(state.basis?.assurance || 0))}${operationRow('Abattement utilisé cette année', fmtEUR(t.avAllowanceUsed?.[state.year] || 0))}`;
    } else if (key === 'cto') {
      const y = t.ctoYears?.[state.year] || { net: 0, taxPaid: 0 };
      dynamic = `${operationRow('Résultat réalisé cette année', `${y.net >= 0 ? '+' : ''}${fmtEUR(y.net)}`, y.net >= 0 ? 'positive' : 'negative')}${operationRow('Impôt déjà simulé cette année', fmtEUR(y.taxPaid || 0))}`;
    } else if (key === 'crypto') {
      const y = t.cryptoYears?.[state.year] || { net: 0, taxPaid: 0 };
      dynamic = `${operationRow('Résultat réalisé cette année', `${y.net >= 0 ? '+' : ''}${fmtEUR(y.net)}`, y.net >= 0 ? 'positive' : 'negative')}${operationRow('Impôt déjà simulé cette année', fmtEUR(y.taxPaid || 0))}`;
    } else if (key === 'rental') {
      const net = Math.max(0, (state.rentIncome || 0) - (state.rentalCosts || 0));
      dynamic = `${operationRow('Revenu locatif net mensuel simulé', fmtEUR(net))}${operationRow('Prélèvements sociaux mensuels', fmtEUR(net * 0.172))}`;
    }
    const box = document.getElementById('taxInfoDynamic'); box.innerHTML = dynamic; box.style.display = dynamic ? 'grid' : 'none';
    document.getElementById('taxInfoModal').classList.remove('tax-hidden');
  }

  function askConfirmation({ title, lead, rows, warning, confirmLabel = 'Confirmer', apply }) {
    document.getElementById('taxConfirmTitle').textContent = title;
    document.getElementById('taxConfirmLead').textContent = lead || '';
    document.getElementById('taxConfirmRows').innerHTML = rows || '';
    const warningBox = document.getElementById('taxConfirmWarning'); warningBox.textContent = warning || ''; warningBox.style.display = warning ? 'block' : 'none';
    document.getElementById('taxConfirmBtn').textContent = confirmLabel;
    pendingTaxConfirm = apply;
    document.getElementById('taxConfirmModal').classList.remove('tax-hidden');
  }

  function proportionalBasis(asset, amount) {
    const value = Math.max(0, Number(state[asset]) || 0);
    const basis = Math.max(0, Number(state.basis?.[asset]) || 0);
    if (value <= 0) return { allocated: 0, gain: 0, ratio: 0 };
    const ratio = Math.min(1, amount / value);
    const allocated = basis * ratio;
    return { allocated, gain: amount - allocated, ratio };
  }

  function buyAsset(asset, input) {
    ensureTaxState(state);
    if (asset === 'pea') {
      const t = state.tax;
      const fromPocket = Math.min(input, Math.max(0, Number(t.peaCash) || 0));
      const external = input - fromPocket;
      const remainingCap = Math.max(0, 150000 - (Number(t.peaContributions) || 0));
      if (external > remainingCap + 0.005) {
        setEvent(`Plafond du PEA atteint : il ne reste que ${fmtEUR(remainingCap)} de versements externes possibles.`); return render();
      }
      if (state.cash < external) { setEvent(`Trésorerie insuffisante : ${fmtEUR(external)} doivent venir de ta trésorerie après utilisation des espèces du PEA.`); return render(); }
      t.peaCash -= fromPocket; state.cash -= external; state.pea += input; state.basis.pea += input; state.monthInvested += external;
      if (external > 0) touchWrapperOnContribution('pea', external);
      setEvent(`${fmtEUR(input)} investis dans le PEA${fromPocket > 0 ? `, dont ${fmtEUR(fromPocket)} depuis la poche espèces` : ''}.`); return render();
    }
    if (state.cash < input) { setEvent(`Trésorerie insuffisante pour placer ${fmtEUR(input)}.`); return render(); }
    state.cash -= input; state[asset] += input; state.basis[asset] += input; state.monthInvested += input;
    touchWrapperOnContribution(asset, input);
    setEvent(`${fmtEUR(input)} placés sur ${assetLabel(asset)}.`); render();
  }

  function withdrawLivret(input) {
    const amount = Math.min(input, state.livret);
    if (amount <= 0) { setEvent('Aucun capital disponible à retirer.'); return render(); }
    const p = proportionalBasis('livret', amount);
    state.basis.livret = Math.max(0, state.basis.livret - p.allocated);
    state.livret -= amount; state.cash += amount; state.monthInvested = Math.max(0, state.monthInvested - amount);
    setEvent(`${fmtEUR(amount)} retirés du livret • fiscalité : 0 €.`); render();
  }

  function sellPeaToCash(input) {
    const amount = Math.min(input, state.pea);
    if (amount <= 0) { setEvent('Aucun titre PEA disponible à vendre.'); return render(); }
    const p = proportionalBasis('pea', amount);
    askConfirmation({
      title: 'Vendre dans le PEA',
      lead: 'La vente reste à l’intérieur du PEA : elle ne déclenche pas de fiscalité à ce stade.',
      rows: `${operationRow('Titres vendus', fmtEUR(amount))}${operationRow('Plus-value / perte réalisée sur les titres', `${p.gain >= 0 ? '+' : ''}${fmtEUR(p.gain)}`, p.gain >= 0 ? 'positive' : 'negative')}${operationRow('Fiscalité immédiate', '0 €', 'positive')}${operationRow('Espèces ajoutées au PEA', fmtEUR(amount))}`,
      warning: 'Pour récupérer cet argent dans ta trésorerie personnelle, utilise ensuite le bouton « Retirer ».',
      confirmLabel: 'Vendre dans le PEA',
      apply: () => {
        state.pea -= amount; state.basis.pea = Math.max(0, state.basis.pea - p.allocated); state.tax.peaCash += amount;
        setEvent(`${fmtEUR(amount)} de titres vendus dans le PEA • 0 € d’impôt, fonds conservés dans le PEA.`); render();
      }
    });
  }

  function prepareAssuranceWithdrawal(input) {
    const amount = Math.min(input, state.assurance);
    if (amount <= 0) { setEvent('Aucun capital disponible à retirer.'); return render(); }
    const t = ensureTaxState(state).tax;
    const p = proportionalBasis('assurance', amount);
    const gain = Math.max(0, p.gain);
    const contractMonths = t.assuranceOpenedMonth == null ? 0 : Math.max(0, currentGameMonth() - t.assuranceOpenedMonth);
    const social = gain * TAX_RULES.assuranceSocial;
    let incomeTax = 0, allowanceUsed = 0, incomeRateLabel = '12,8 %';
    if (contractMonths < TAX_RULES.assuranceEightYearsMonths) {
      incomeTax = gain * TAX_RULES.assuranceBefore8Income;
    } else {
      const used = Math.max(0, Number(t.avAllowanceUsed?.[state.year]) || 0);
      const allowanceRemaining = Math.max(0, TAX_RULES.assuranceAllowanceSingle - used);
      allowanceUsed = Math.min(gain, allowanceRemaining);
      const irGain = Math.max(0, gain - allowanceUsed);
      const premiums = Math.max(0, Number(state.basis?.assurance) || 0);
      const lowShare = premiums <= 0 ? 1 : Math.min(1, TAX_RULES.assurancePremiumThreshold / premiums);
      const weightedRate = TAX_RULES.assuranceAfter8Income * lowShare + TAX_RULES.assuranceHighPremiumIncome * (1 - lowShare);
      incomeTax = irGain * weightedRate;
      incomeRateLabel = lowShare >= 0.999 ? '7,5 % après abattement' : `${fmtPct(weightedRate)} moyen après abattement`;
    }
    const tax = social + incomeTax, net = amount - tax;
    askConfirmation({
      title: 'Rachat d’assurance-vie',
      lead: `Ancienneté simulée : ${taxAgeText(t.assuranceOpenedMonth)}. Seule la part de gains du retrait est fiscalisée.`,
      rows: `${operationRow('Retrait brut', fmtEUR(amount))}${operationRow('Capital remboursé', fmtEUR(Math.min(amount, p.allocated)))}${operationRow('Gain compris dans le retrait', fmtEUR(gain), gain > 0 ? 'positive' : '')}${contractMonths >= TAX_RULES.assuranceEightYearsMonths ? operationRow('Abattement utilisé', fmtEUR(allowanceUsed), 'positive') : ''}${operationRow(`Impôt sur le revenu (${incomeRateLabel})`, `−${fmtEUR(incomeTax)}`, incomeTax > 0 ? 'negative' : '')}${operationRow('Prélèvements sociaux (17,2 %)', `−${fmtEUR(social)}`, social > 0 ? 'negative' : '')}${operationRow('Net versé en trésorerie', fmtEUR(net), 'positive')}`,
      warning: 'Hypothèse du jeu : primes versées après le 27/09/2017 et abattement « personne seule ».',
      confirmLabel: 'Confirmer le rachat',
      apply: () => {
        state.assurance -= amount; state.basis.assurance = Math.max(0, state.basis.assurance - p.allocated); state.cash += amount;
        if (allowanceUsed > 0) t.avAllowanceUsed[state.year] = (Number(t.avAllowanceUsed[state.year]) || 0) + allowanceUsed;
        applyTaxCashflow(tax, 'Assurance-vie — rachat');
        state.monthInvested = Math.max(0, state.monthInvested - amount);
        setEvent(`Rachat assurance-vie ${fmtEUR(amount)} • gains ${fmtEUR(gain)} • fiscalité ${fmtEUR(tax)} • net ${fmtEUR(net)}.`); render();
      }
    });
  }

  function prepareMarketSale(asset, input) {
    const amount = Math.min(input, Number(state[asset]) || 0);
    if (amount <= 0) { setEvent('Aucun capital disponible à vendre.'); return render(); }
    const p = proportionalBasis(asset, amount);
    const ledger = previewLedgerTax(asset, p.gain);
    const taxDelta = ledger.taxDelta;
    const net = amount - taxDelta;
    const taxLabel = taxDelta >= 0 ? `−${fmtEUR(taxDelta)}` : `+${fmtEUR(-taxDelta)}`;
    askConfirmation({
      title: asset === 'cto' ? 'Vente CTO' : 'Vente crypto',
      lead: 'La simulation recalcule le résultat fiscal net de l’année avant de déterminer le prélèvement ou l’éventuel remboursement.',
      rows: `${operationRow('Montant vendu', fmtEUR(amount))}${operationRow('Prix de revient attribué', fmtEUR(p.allocated))}${operationRow('Plus-value / moins-value réalisée', `${p.gain >= 0 ? '+' : ''}${fmtEUR(p.gain)}`, p.gain >= 0 ? 'positive' : 'negative')}${operationRow('Résultat fiscal annuel après vente', `${ledger.net >= 0 ? '+' : ''}${fmtEUR(ledger.net)}`, ledger.net >= 0 ? 'positive' : 'negative')}${operationRow('Base taxable après compensations', fmtEUR(ledger.taxable))}${operationRow(taxDelta >= 0 ? 'Fiscalité supplémentaire (31,4 %)' : 'Remboursement fiscal simulé', taxLabel, taxDelta >= 0 ? 'negative' : 'positive')}${operationRow('Impact net sur la trésorerie', fmtEUR(net), 'positive')}`,
      warning: asset === 'cto' ? 'Les moins-values mobilières sont reportées jusqu’à 10 ans dans le moteur fiscal.' : 'Les moins-values crypto sont compensées uniquement avec les gains crypto de la même année dans cette simulation.',
      confirmLabel: 'Confirmer la vente',
      apply: () => {
        state[asset] -= amount; state.basis[asset] = Math.max(0, state.basis[asset] - p.allocated); state.cash += amount;
        const applied = applyLedgerTax(asset, p.gain);
        state.monthInvested = Math.max(0, state.monthInvested - amount);
        const fiscal = applied.taxDelta >= 0 ? `fiscalité ${fmtEUR(applied.taxDelta)}` : `remboursement fiscal ${fmtEUR(-applied.taxDelta)}`;
        setEvent(`${asset === 'cto' ? 'Vente CTO' : 'Vente crypto'} ${fmtEUR(amount)} • résultat réalisé ${p.gain >= 0 ? '+' : ''}${fmtEUR(p.gain)} • ${fiscal}.`); render();
      }
    });
  }

  moveAsset = function (asset, direction) {
    ensureTaxState(state);
    const input = Number(el(`${asset}Amount`)?.value || 0);
    if (input <= 0) return;
    if (direction === 'in') return buyAsset(asset, input);
    if (asset === 'livret') return withdrawLivret(input);
    if (asset === 'pea') return sellPeaToCash(input);
    if (asset === 'assurance') return prepareAssuranceWithdrawal(input);
    if (asset === 'cto' || asset === 'crypto') return prepareMarketSale(asset, input);
  };

  function preparePeaWithdrawal() {
    ensureTaxState(state);
    const input = Number(el('peaAmount')?.value || 0);
    if (input <= 0) return;
    const t = state.tax;
    const planValue = Math.max(0, (Number(state.pea) || 0) + (Number(t.peaCash) || 0));
    if (planValue <= 0) { setEvent('Aucun capital disponible dans le PEA.'); return render(); }
    const months = t.peaOpenedMonth == null ? 0 : Math.max(0, currentGameMonth() - t.peaOpenedMonth);

    if (months < TAX_RULES.peaFiveYearsMonths) {
      const gainRaw = planValue - Math.max(0, Number(t.peaContributions) || 0);
      const gain = Math.max(0, gainRaw);
      let tax = gain * TAX_RULES.pfu;
      let lossCompensation = null;
      if (gainRaw < 0) lossCompensation = previewLedgerTax('cto', gainRaw);
      const net = planValue - tax + (lossCompensation && lossCompensation.taxDelta < 0 ? -lossCompensation.taxDelta : 0);
      askConfirmation({
        title: 'Retrait du PEA avant 5 ans',
        lead: `Le PEA a ${taxAgeText(t.peaOpenedMonth)}. Le jeu applique la clôture complète du plan.`,
        rows: `${operationRow('Valeur totale liquidée', fmtEUR(planValue))}${operationRow('Versements nets suivis', fmtEUR(t.peaContributions))}${operationRow('Gain / perte du plan', `${gainRaw >= 0 ? '+' : ''}${fmtEUR(gainRaw)}`, gainRaw >= 0 ? 'positive' : 'negative')}${operationRow('PFU sur le gain (31,4 %)', `−${fmtEUR(tax)}`, tax > 0 ? 'negative' : '')}${lossCompensation && lossCompensation.taxDelta < 0 ? operationRow('Compensation de moins-value estimée', `+${fmtEUR(-lossCompensation.taxDelta)}`, 'positive') : ''}${operationRow('Net estimé en trésorerie', fmtEUR(net), 'positive')}`,
        warning: 'Retrait avant 5 ans : le plan est fermé dans cette simulation. Les exceptions légales (licenciement, invalidité, création d’entreprise, etc.) ne sont pas modélisées.',
        confirmLabel: 'Clôturer le PEA',
        apply: () => {
          state.cash += planValue; state.pea = 0; state.basis.pea = 0; t.peaCash = 0;
          if (gainRaw < 0) applyLedgerTax('cto', gainRaw); else applyTaxCashflow(tax, 'PEA — clôture avant 5 ans');
          t.peaContributions = 0; t.peaOpenedMonth = null;
          setEvent(`PEA clôturé avant 5 ans • valeur ${fmtEUR(planValue)} • gain ${gainRaw >= 0 ? '+' : ''}${fmtEUR(gainRaw)} • fiscalité ${fmtEUR(tax)}.`); render();
        }
      });
      return;
    }

    const availableCash = Math.max(0, Number(t.peaCash) || 0);
    if (availableCash <= 0) { setEvent('Pour retirer du PEA, vends d’abord des titres afin d’alimenter la poche espèces du PEA.'); return render(); }
    const amount = Math.min(input, availableCash);
    const contributionBase = Math.max(0, Number(t.peaContributions) || 0);
    const allocatedCapital = planValue > 0 ? contributionBase * (amount / planValue) : 0;
    const gain = Math.max(0, amount - allocatedCapital);
    const tax = gain * TAX_RULES.social;
    const net = amount - tax;
    askConfirmation({
      title: 'Retrait du PEA après 5 ans',
      lead: `Ancienneté simulée : ${taxAgeText(t.peaOpenedMonth)}. L’impôt sur le revenu est exonéré ; les prélèvements sociaux restent dus sur la part de gain.`,
      rows: `${operationRow('Retrait brut', fmtEUR(amount))}${operationRow('Capital remboursé estimé', fmtEUR(Math.min(amount, allocatedCapital)))}${operationRow('Gain compris dans le retrait', fmtEUR(gain), gain > 0 ? 'positive' : '')}${operationRow('Impôt sur le revenu', '0 €', 'positive')}${operationRow('Prélèvements sociaux (18,6 %)', `−${fmtEUR(tax)}`, tax > 0 ? 'negative' : '')}${operationRow('Net versé en trésorerie', fmtEUR(net), 'positive')}`,
      warning: amount < input ? `La poche espèces du PEA ne contient que ${fmtEUR(availableCash)}. Le retrait est limité à ce montant.` : '',
      confirmLabel: 'Confirmer le retrait',
      apply: () => {
        t.peaCash -= amount; t.peaContributions = Math.max(0, t.peaContributions - allocatedCapital); state.cash += amount; applyTaxCashflow(tax, 'PEA — retrait après 5 ans');
        if ((state.pea + t.peaCash) < 0.01) { state.pea = 0; state.basis.pea = 0; t.peaCash = 0; t.peaContributions = 0; t.peaOpenedMonth = null; }
        setEvent(`Retrait PEA ${fmtEUR(amount)} • gain fiscalisé ${fmtEUR(gain)} • prélèvements sociaux ${fmtEUR(tax)} • net ${fmtEUR(net)}.`); render();
      }
    });
  }

  function refreshTaxUi() {
    ensureTaxUi(); ensureTaxState(state);
    const t = state.tax;
    const versionChip = document.querySelector('.version-chip'); if (versionChip) versionChip.textContent = 'V1.8 • fiscalité 2026';
    const investPill = document.querySelector('.invest-card .section-head .pill'); if (investPill) investPill.textContent = 'Rendements + fiscalité 2026';
    document.querySelectorAll('[data-tax-badge]').forEach(b => b.textContent = productDynamicTag(b.dataset.taxBadge));
    const pocket = document.getElementById('peaCashPocket'); if (pocket) pocket.textContent = fmtEUR(t.peaCash || 0);
    const taxLabel = el('taxAuto')?.parentElement?.querySelector('span'); if (taxLabel) taxLabel.textContent = '🏛️ Impôts & prélèvements';
    const totalPea = (Number(state.pea) || 0) + (Number(t.peaCash) || 0);
    const planGain = totalPea - (Number(t.peaContributions) || 0);
    const planPct = t.peaContributions ? planGain / t.peaContributions * 100 : 0;
    if (el('peaCard')) el('peaCard').textContent = fmtEUR(totalPea);
    if (el('peaAsset')) el('peaAsset').textContent = fmtEUR(totalPea);
    const planReturnText = `${planGain >= 0 ? '+' : ''}${fmtEUR(planGain)} • ${planPct >= 0 ? '+' : ''}${planPct.toFixed(1).replace('.', ',')} %`;
    if (el('peaReturnCard')) { el('peaReturnCard').textContent = `Gain du plan : ${planReturnText}`; el('peaReturnCard').className = `return-line ${planGain > 0 ? 'return-positive' : planGain < 0 ? 'return-negative' : 'return-neutral'}`; }
    if (el('peaReturn')) { el('peaReturn').textContent = planReturnText; el('peaReturn').className = planGain > 0 ? 'return-positive' : planGain < 0 ? 'return-negative' : 'return-neutral'; }
  }

  const coreRender = render;
  render = function () { const result = coreRender(); refreshTaxUi(); return result; };

  ensureTaxUi();
  render();
})();
