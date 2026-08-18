(() => {
  'use strict';

  if (typeof state === 'undefined' || typeof render !== 'function' || typeof moveAsset !== 'function' || typeof marketMonth !== 'function') return;

  /*
    Patrimoine Simulator — moteur marchés & frais V1.9
    - Les actions mondiales sont calibrées sur une tendance de long terme et une volatilité historique,
      puis simulées avec des régimes persistants (normal / haussier / baissier / crise).
    - Les paramètres CTO et crypto sont des hypothèses pédagogiques plus risquées.
    - Les frais sont séparés du rendement et réellement déduits du patrimoine.
  */

  const MARKET_MODEL = Object.freeze({
    world: {
      longRunReturn: 0.085,       // ancrage historique marchés développés
      historicalVol: 0.1489,     // MSCI World, vol. annualisée 10 ans au 30/06/2026
      modelDrift: 0.101,          // calibré pour retrouver ~8,5 %/an sur longue simulation avec régimes/crises
      modelSigma: 0.135
    },
    cto: {
      longRunReturn: 0.075,       // hypothèse pédagogique : portefeuille plus concentré
      modelDrift: 0.121,
      modelSigma: 0.24,
      equityCorrelation: 0.75
    },
    crypto: {
      longRunReturn: 0.10,        // hypothèse de simulation, PAS une prévision
      modelDrift: 0.38,
      modelSigma: 0.70,
      equityCorrelation: 0.35
    },
    shortRateStart: 0.02185,      // €STR 30/07/2026
    assurance2025Net: 0.0263,
    assuranceManagement: 0.0063
  });

  const FEE_RULES = Object.freeze({
    livret: {
      trade: 0,
      annualManagement: 0,
      annualCustody: 0,
      label: '0 € de frais courants'
    },
    pea: {
      trade: 0.0035,              // hypothèse pédagogique, sous le plafond PEA dématérialisé de 0,5 %
      annualEtf: 0.0021,          // ordre de grandeur moyen ETF UCITS européen
      annualCustody: 0.0030,      // scénario "intermédiaire traditionnel" ; les tarifs réels varient
      label: '0,35 %/ordre + 0,21 % ETF + 0,30 % garde/an'
    },
    assurance: {
      trade: 0,
      annualManagement: 0.0063,   // moyenne 2025 ACPR pour contrats individuels
      annualCustody: 0,
      label: '0,63 %/an de gestion'
    },
    cto: {
      trade: 0.0035,              // hypothèse pédagogique ; pas un tarif légal universel
      annualManagement: 0,
      annualCustody: 0.0030,      // scénario "intermédiaire traditionnel"
      label: '0,35 %/ordre + 0,30 % garde/an'
    },
    crypto: {
      trade: 0.0080,              // exemple retail taker niveau 1 Kraken, juillet 2026
      annualManagement: 0,
      annualCustody: 0,
      label: '0,80 %/ordre au marché'
    }
  });

  const REGIMES = {
    normal: {
      label: 'Marché normal', icon: '⚖️',
      transitions: { normal: 0.90, bull: 0.06, bear: 0.035, crisis: 0.005 },
      drift: 0, vol: 1
    },
    bull: {
      label: 'Marché haussier', icon: '📈',
      transitions: { normal: 0.10, bull: 0.86, bear: 0.035, crisis: 0.005 },
      drift: 0.08, vol: 0.85
    },
    bear: {
      label: 'Marché baissier', icon: '📉',
      transitions: { normal: 0.14, bull: 0.04, bear: 0.79, crisis: 0.03 },
      drift: -0.12, vol: 1.25
    },
    crisis: {
      label: 'Crise de marché', icon: '⚠️',
      transitions: { normal: 0.12, bull: 0.01, bear: 0.37, crisis: 0.50 },
      drift: -0.45, vol: 2
    }
  };

  const MARKET_INFO = {
    livret: {
      title: 'Rendement réglementé',
      rows: () => [
        ['Taux appliqué actuellement', pct(currentLivretRate())],
        ['Frais du produit dans le jeu', '0 €'],
        ['Méthode', state.year === 2026 ? 'Barème réel 2026' : 'Formule simplifiée inflation + taux €'],
        ['LEP', 'Non séparé du Livret dans cette version']
      ],
      note: 'En 2026, le jeu applique 1,7 % en janvier, 1,5 % de février à juillet puis 1,7 % à partir d’août. Le LEP reste expliqué dans la fiche mais n’a pas encore de poche distincte.'
    },
    pea: {
      title: 'ETF Monde : rendement & coûts',
      rows: () => [
        ['Ancrage long terme actions développées', '≈ 8,5 % / an'],
        ['Volatilité de référence MSCI World', '≈ 14,9 % / an'],
        ['Frais ETF simulés', '0,21 % / an'],
        ['Droits de garde simulés', '0,30 % / an'],
        ['Frais de transaction simulés', '0,35 % / ordre'],
        ['Frais déjà payés', fmtEUR(feesByAsset('pea'))]
      ],
      note: 'Les 0,30 % de garde et 0,35 % par ordre sont une hypothèse pédagogique de type intermédiaire traditionnel : les tarifs réels peuvent être très différents. Les frais ETF réduisent directement la performance.'
    },
    assurance: {
      title: 'Fonds euros : rendement & coûts',
      rows: () => [
        ['Référence fonds euros 2025', '2,63 % net de frais sur encours'],
        ['Frais de gestion simulés', '0,63 % / an'],
        ['Taux brut reconstitué au départ', '≈ 3,26 % / an'],
        ['Frais déjà payés', fmtEUR(feesByAsset('assurance'))]
      ],
      note: 'Le contrat du jeu est modélisé comme un fonds euros défensif. Les frais d’entrée et d’arbitrage, très variables selon les contrats, sont laissés à 0 dans le profil par défaut.'
    },
    cto: {
      title: 'Actions en CTO : rendement & coûts',
      rows: () => [
        ['Rendement long terme du modèle', '≈ 7,5 % / an'],
        ['Volatilité du modèle', '≈ 26 % / an'],
        ['Frais de transaction simulés', '0,35 % / ordre'],
        ['Droits de garde simulés', '0,30 % / an'],
        ['Frais déjà payés', fmtEUR(feesByAsset('cto'))]
      ],
      note: 'Le CTO représente volontairement un portefeuille d’actions plus concentré que l’ETF Monde : il peut surperformer mais subit davantage de dispersion et de pertes extrêmes.'
    },
    crypto: {
      title: 'Crypto : modèle très volatil',
      rows: () => [
        ['Tendance du modèle', '≈ +10 % / an à très long terme'],
        ['Volatilité du modèle', '≈ 70–75 % / an'],
        ['Frais de transaction simulés', '0,80 % / ordre'],
        ['Frais déjà payés', fmtEUR(feesByAsset('crypto'))]
      ],
      note: 'La tendance crypto est une hypothèse de jeu, pas une moyenne historique fiable ni une prévision. Le moteur ajoute des krachs et rebonds rares pour éviter une distribution artificiellement régulière.'
    }
  };

  const clampLocal = (v, a, b) => Math.max(a, Math.min(b, v));
  const pct = n => `${(Number(n || 0) * 100).toFixed(2).replace('.', ',')} %`;
  const currentGameMonth = () => Math.max(0, Number(state.totalMonths) || 0);

  function defaultMarketState(s) {
    return {
      schema: 1,
      regime: 'normal',
      shortRate: MARKET_MODEL.shortRateStart,
      livretRate: 0.017,
      assuranceGrossRate: MARKET_MODEL.assurance2025Net + MARKET_MODEL.assuranceManagement,
      lastReturns: { livret: 0, pea: 0, assurance: 0, cto: 0, crypto: 0 },
      lastShock: '',
      fees: {
        total: 0,
        byAsset: { livret: 0, pea: 0, assurance: 0, cto: 0, crypto: 0 },
        byType: { transaction: 0, etf: 0, garde: 0, gestion: 0 },
        byYear: {},
        history: []
      }
    };
  }

  function ensureMarketState(s) {
    if (!s || typeof s !== 'object') return s;
    const d = defaultMarketState(s);
    s.market = Object.assign(d, s.market || {});
    const m = s.market;
    if (!REGIMES[m.regime]) m.regime = 'normal';
    if (!Number.isFinite(m.shortRate)) m.shortRate = MARKET_MODEL.shortRateStart;
    if (!Number.isFinite(m.livretRate)) m.livretRate = 0.017;
    if (!Number.isFinite(m.assuranceGrossRate)) m.assuranceGrossRate = MARKET_MODEL.assurance2025Net + MARKET_MODEL.assuranceManagement;
    m.lastReturns = Object.assign(d.lastReturns, m.lastReturns || {});
    m.fees = Object.assign(d.fees, m.fees || {});
    if (!Number.isFinite(m.fees.total)) m.fees.total = 0;
    m.fees.byAsset = Object.assign(d.fees.byAsset, m.fees.byAsset || {});
    m.fees.byType = Object.assign(d.fees.byType, m.fees.byType || {});
    if (!m.fees.byYear || typeof m.fees.byYear !== 'object') m.fees.byYear = {};
    if (!Array.isArray(m.fees.history)) m.fees.history = [];
    return s;
  }

  // La fiscalité a déjà enveloppé baseState/hydrate. On conserve cette chaîne.
  const fiscalBaseState = baseState;
  baseState = function () { return ensureMarketState(fiscalBaseState()); };
  const fiscalHydrate = hydrate;
  hydrate = function (raw) { return ensureMarketState(fiscalHydrate(raw)); };
  state = ensureMarketState(state);

  function gaussian() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function pickTransition(from) {
    const map = REGIMES[from]?.transitions || REGIMES.normal.transitions;
    let r = Math.random();
    for (const [key, p] of Object.entries(map)) {
      r -= p;
      if (r <= 0) return key;
    }
    return 'normal';
  }

  function lognormalMonthly(muAnnual, sigmaAnnual, z) {
    return Math.exp((muAnnual - 0.5 * sigmaAnnual * sigmaAnnual) / 12 + (sigmaAnnual / Math.sqrt(12)) * z) - 1;
  }

  function roundQuarterPoint(rate) {
    return Math.round(rate / 0.0025) * 0.0025;
  }

  function evolveShortRate() {
    const m = ensureMarketState(state).market;
    const neutral = 0.02;
    m.shortRate += (neutral - m.shortRate) * 0.04 + gaussian() * 0.0015;
    m.shortRate = clampLocal(m.shortRate, 0, 0.06);
  }

  function currentLivretRate() {
    const m = ensureMarketState(state).market;
    if (Number(state.year) === 2026) {
      if (Number(state.month) === 1) return 0.017;
      if (Number(state.month) >= 2 && Number(state.month) <= 7) return 0.015;
      return 0.017;
    }
    return Number(m.livretRate) || 0.017;
  }

  function refreshFutureRegulatedRates() {
    const m = ensureMarketState(state).market;
    if (Number(state.year) > 2026 && (Number(state.month) === 2 || Number(state.month) === 8)) {
      const inflation = clampLocal(Number(state.annualInflation) || 0.02, -0.01, 0.08);
      const formula = Math.max(0.005, (inflation + m.shortRate) / 2);
      m.livretRate = clampLocal(roundQuarterPoint(formula), 0.005, 0.06);
    }
    if (Number(state.year) > 2026 && Number(state.month) === 1) {
      // Le fonds euros réagit avec retard aux taux obligataires : approximation volontairement lissée.
      m.assuranceGrossRate = clampLocal(0.0205 + 0.55 * m.shortRate, 0.015, 0.05);
    }
  }

  function feesByAsset(asset) {
    return Number(ensureMarketState(state).market.fees.byAsset?.[asset]) || 0;
  }

  function feesForYear(year = state.year) {
    return Number(ensureMarketState(state).market.fees.byYear?.[year]) || 0;
  }

  function recordFee(asset, type, amount, label) {
    amount = Math.max(0, Number(amount) || 0);
    if (amount < 0.005) return 0;
    const fees = ensureMarketState(state).market.fees;
    fees.total += amount;
    fees.byAsset[asset] = (Number(fees.byAsset[asset]) || 0) + amount;
    fees.byType[type] = (Number(fees.byType[type]) || 0) + amount;
    fees.byYear[state.year] = (Number(fees.byYear[state.year]) || 0) + amount;
    fees.history.unshift({
      year: state.year, month: state.month, asset, type, amount,
      label: label || `${asset} — ${type}`
    });
    fees.history = fees.history.slice(0, 60);
    if (state.yearStats) state.yearStats.expenses = (Number(state.yearStats.expenses) || 0) + amount;
    return amount;
  }

  function deductFromAsset(asset, amount) {
    amount = Math.max(0, Number(amount) || 0);
    if (!amount) return 0;
    if (asset === 'pea') {
      let left = amount;
      const securities = Math.max(0, Number(state.pea) || 0);
      const fromSecurities = Math.min(left, securities);
      state.pea = Math.max(0, securities - fromSecurities);
      left -= fromSecurities;
      if (left > 0 && state.tax) {
        const pocket = Math.max(0, Number(state.tax.peaCash) || 0);
        const fromPocket = Math.min(left, pocket);
        state.tax.peaCash = Math.max(0, pocket - fromPocket);
        left -= fromPocket;
      }
      return amount - left;
    }
    const value = Math.max(0, Number(state[asset]) || 0);
    const actual = Math.min(amount, value);
    state[asset] = Math.max(0, value - actual);
    return actual;
  }

  function recurringFee(asset, baseValue, annualRate, type, label) {
    const amount = Math.max(0, Number(baseValue) || 0) * Math.max(0, Number(annualRate) || 0) / 12;
    const actual = deductFromAsset(asset, amount);
    if (actual > 0) recordFee(asset, type, actual, label);
    return actual;
  }

  function applyBuyFee(asset, acquiredValue) {
    const rate = Number(FEE_RULES[asset]?.trade) || 0;
    if (!rate || acquiredValue <= 0) return 0;
    const fee = Math.min(acquiredValue, acquiredValue * rate);
    const actual = deductFromAsset(asset, fee);
    if (actual > 0) recordFee(asset, 'transaction', actual, `${asset.toUpperCase()} — frais d’achat`);
    return actual;
  }

  // ----- Nouveau moteur mensuel de rendement -----
  marketMonth = function () {
    ensureMarketState(state);
    const m = state.market;

    refreshFutureRegulatedRates();

    const before = {
      livret: Number(state.livret) || 0,
      assurance: Number(state.assurance) || 0,
      pea: Number(state.pea) || 0,
      cto: Number(state.cto) || 0,
      crypto: Number(state.crypto) || 0
    };

    // Épargne réglementée : taux connu pour 2026, puis formule simplifiée.
    const livretAnnual = currentLivretRate();
    state.livret *= 1 + livretAnnual / 12;

    // Fonds euros : rendement brut lissé, frais de gestion explicitement séparés.
    const assuranceGross = Number(m.assuranceGrossRate) || (MARKET_MODEL.assurance2025Net + MARKET_MODEL.assuranceManagement);
    state.assurance *= 1 + assuranceGross / 12;

    // Régime de marché persistant.
    m.regime = pickTransition(m.regime);
    const regime = REGIMES[m.regime];
    const zMarket = gaussian();
    const zCtoIdio = gaussian();
    const zCryptoIdio = gaussian();

    let peaReturn = lognormalMonthly(
      MARKET_MODEL.world.modelDrift + regime.drift,
      MARKET_MODEL.world.modelSigma * regime.vol,
      zMarket
    );

    const zCto = MARKET_MODEL.cto.equityCorrelation * zMarket +
      Math.sqrt(1 - MARKET_MODEL.cto.equityCorrelation ** 2) * zCtoIdio;
    let ctoReturn = lognormalMonthly(
      MARKET_MODEL.cto.modelDrift + regime.drift * 1.10,
      MARKET_MODEL.cto.modelSigma * regime.vol,
      zCto
    );

    const cryptoVolMult = m.regime === 'bull' ? 0.90 : m.regime === 'bear' ? 1.15 : m.regime === 'crisis' ? 1.55 : 1;
    const zCrypto = MARKET_MODEL.crypto.equityCorrelation * zMarket +
      Math.sqrt(1 - MARKET_MODEL.crypto.equityCorrelation ** 2) * zCryptoIdio;
    let cryptoReturn = lognormalMonthly(
      MARKET_MODEL.crypto.modelDrift + regime.drift * 1.40,
      MARKET_MODEL.crypto.modelSigma * cryptoVolMult,
      zCrypto
    );

    m.lastShock = '';

    // Krach commun rare : évite la fausse impression d'une loi normale parfaite.
    if (Math.random() < 0.004) {
      peaReturn += -(0.10 + Math.random() * 0.12);
      ctoReturn += -(0.14 + Math.random() * 0.16);
      cryptoReturn += -(0.15 + Math.random() * 0.20);
      m.lastShock = 'Krach de marché';
    } else if (Math.random() < 0.003) {
      peaReturn += 0.08 + Math.random() * 0.08;
      ctoReturn += 0.10 + Math.random() * 0.12;
      cryptoReturn += 0.12 + Math.random() * 0.18;
      m.lastShock = 'Fort rebond';
    }

    // Crypto : chocs spécifiques supplémentaires.
    const cryptoShock = Math.random();
    if (cryptoShock < 0.012) {
      cryptoReturn += -(0.25 + Math.random() * 0.30);
      m.lastShock = m.lastShock || 'Krach crypto';
    } else if (cryptoShock > 0.988) {
      cryptoReturn += 0.25 + Math.random() * 0.35;
      m.lastShock = m.lastShock || 'Rallye crypto';
    }

    peaReturn = clampLocal(peaReturn, -0.45, 0.35);
    ctoReturn = clampLocal(ctoReturn, -0.60, 0.50);
    cryptoReturn = clampLocal(cryptoReturn, -0.75, 1.20);

    state.pea *= 1 + peaReturn;
    state.cto *= 1 + ctoReturn;
    state.crypto *= 1 + cryptoReturn;

    // Frais récurrents — déduits APRES performance pour qu'ils soient visibles séparément.
    recurringFee('assurance', state.assurance, FEE_RULES.assurance.annualManagement, 'gestion', 'Assurance-vie — frais de gestion');
    recurringFee('pea', state.pea, FEE_RULES.pea.annualEtf, 'etf', 'PEA — frais courants ETF');
    recurringFee('pea', (Number(state.pea) || 0) + (Number(state.tax?.peaCash) || 0), FEE_RULES.pea.annualCustody, 'garde', 'PEA — droits de garde simulés');
    recurringFee('cto', state.cto, FEE_RULES.cto.annualCustody, 'garde', 'CTO — droits de garde simulés');

    // Immobilier et véhicule : comportement de l'ancien moteur conservé.
    if (state.homeValue) state.homeValue *= 1 + rand(-0.003, 0.005);
    if (state.rentalValue) state.rentalValue *= 1 + rand(-0.004, 0.006);
    if (state.carValue) state.carValue *= 0.987;

    evolveShortRate();

    const after = {
      livret: Number(state.livret) || 0,
      assurance: Number(state.assurance) || 0,
      pea: Number(state.pea) || 0,
      cto: Number(state.cto) || 0,
      crypto: Number(state.crypto) || 0
    };

    const actualReturn = key => before[key] > 0 ? after[key] / before[key] - 1 : 0;
    m.lastReturns = {
      livret: actualReturn('livret'),
      assurance: actualReturn('assurance'),
      pea: actualReturn('pea'),
      cto: actualReturn('cto'),
      crypto: actualReturn('crypto')
    };

    return {
      pea: m.lastReturns.pea,
      cto: m.lastReturns.cto,
      crypto: m.lastReturns.crypto,
      regime: m.regime,
      shock: m.lastShock
    };
  };

  // ----- Frais de transaction : achats -----
  const fiscalMoveAsset = moveAsset;
  let pendingSale = null;

  function feeRate(asset) {
    return Math.max(0, Number(FEE_RULES[asset]?.trade) || 0);
  }

  function parseDisplayedEuro(text) {
    if (!text) return NaN;
    const cleaned = String(text)
      .replace(/\u202f|\u00a0/g, '')
      .replace(/[^\d,.\-+]/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }

  function decorateSaleConfirmation(asset, fee) {
    const container = document.getElementById('taxConfirmRows');
    if (!container || document.getElementById('marketSaleFeeRow')) return;

    const rows = Array.from(container.querySelectorAll('.tax-operation-row'));
    const impactRow = rows.find(row => {
      const t = row.querySelector('span')?.textContent || '';
      return t.includes('Impact net') || t.includes('Espèces ajoutées');
    });

    const feeRow = document.createElement('div');
    feeRow.id = 'marketSaleFeeRow';
    feeRow.className = 'tax-operation-row market-fee-row';
    feeRow.innerHTML = `<span>Frais de transaction (${pct(feeRate(asset))})</span><strong class="negative">−${fmtEUR(fee)}</strong>`;

    if (impactRow) {
      container.insertBefore(feeRow, impactRow);
      const strong = impactRow.querySelector('strong');
      const current = parseDisplayedEuro(strong?.textContent);
      if (strong && Number.isFinite(current)) strong.textContent = fmtEUR(current - fee);
    } else {
      container.appendChild(feeRow);
    }
  }

  function clearPendingSale() {
    pendingSale = null;
  }

  moveAsset = function (asset, direction) {
    ensureMarketState(state);
    const rate = feeRate(asset);
    const input = Number(el(`${asset}Amount`)?.value || 0);
    if (input <= 0) return;

    if (direction === 'in') {
      const beforeValue = Number(state[asset]) || 0;
      fiscalMoveAsset(asset, direction);
      const acquired = Math.max(0, (Number(state[asset]) || 0) - beforeValue);
      if (acquired > 0 && rate > 0) {
        const fee = applyBuyFee(asset, acquired);
        if (fee > 0) {
          state.lastEvent = `${state.lastEvent} Frais d’achat : ${fmtEUR(fee)}.`;
          render();
        }
      }
      return;
    }

    if (rate <= 0 || !['pea', 'cto', 'crypto'].includes(asset)) {
      return fiscalMoveAsset(asset, direction);
    }

    const value = Math.max(0, Number(state[asset]) || 0);
    const amount = Math.min(input, value);
    if (amount <= 0) return fiscalMoveAsset(asset, direction);

    const ratio = value > 0 ? amount / value : 0;
    const fee = amount * rate;
    const originalBasis = Math.max(0, Number(state.basis?.[asset]) || 0);
    const desiredRemainingBasis = originalBasis * (1 - ratio);

    /*
      Le moteur fiscal calcule immédiatement la plus-value avant d'afficher la confirmation.
      On augmente temporairement le prix de revient pour que les frais de cession réduisent
      correctement le gain fiscal. Le prix de revient visible est restauré juste après.
    */
    if (ratio > 0 && state.basis) state.basis[asset] = originalBasis + fee / ratio;

    pendingSale = {
      asset,
      fee,
      beforeValue: value,
      desiredRemainingBasis
    };

    fiscalMoveAsset(asset, direction);

    if (state.basis) state.basis[asset] = originalBasis;
    decorateSaleConfirmation(asset, fee);
  };

  // ----- Frais sur versements automatiques -----
  const fiscalAutoInvestments = applyAutoInvestments;
  applyAutoInvestments = function () {
    ensureMarketState(state);
    const before = {};
    for (const a of ['livret', 'pea', 'assurance', 'cto', 'crypto']) before[a] = Number(state[a]) || 0;

    const result = fiscalAutoInvestments();
    let fees = 0;

    for (const a of ['pea', 'cto', 'crypto']) {
      const acquired = Math.max(0, (Number(state[a]) || 0) - before[a]);
      if (acquired <= 0) continue;
      fees += applyBuyFee(a, acquired);
    }

    if (fees > 0) {
      result.fees = fees;
      result.done = result.done || [];
      result.done.push(`frais ${fmtEUR(fees)}`);
    }
    return result;
  };

  // Le listener fiscal est déjà enregistré : celui-ci s'exécute après et finalise les frais.
  function bindSaleFinalizer() {
    const confirm = document.getElementById('taxConfirmBtn');
    if (confirm && !confirm.dataset.marketFeeBound) {
      confirm.dataset.marketFeeBound = '1';
      confirm.addEventListener('click', () => {
        const p = pendingSale;
        pendingSale = null;
        if (!p) return;

        const sold = (Number(state[p.asset]) || 0) < p.beforeValue - 0.001;
        if (!sold) return;

        if (state.basis) state.basis[p.asset] = Math.max(0, p.desiredRemainingBasis);

        if (p.asset === 'pea') {
          if (state.tax) state.tax.peaCash = Math.max(0, (Number(state.tax.peaCash) || 0) - p.fee);
        } else {
          state.cash -= p.fee;
        }

        recordFee(p.asset, 'transaction', p.fee, `${p.asset.toUpperCase()} — frais de vente`);
        state.lastEvent = `${state.lastEvent} Frais de vente : ${fmtEUR(p.fee)}.`;
        render();
      });
    }

    ['taxCancelBtn'].forEach(id => {
      const b = document.getElementById(id);
      if (b && !b.dataset.marketFeeClearBound) {
        b.dataset.marketFeeClearBound = '1';
        b.addEventListener('click', clearPendingSale);
      }
    });

    document.querySelectorAll('[data-tax-close="confirm"]').forEach(b => {
      if (b.dataset.marketFeeClearBound) return;
      b.dataset.marketFeeClearBound = '1';
      b.addEventListener('click', clearPendingSale);
    });

    const overlay = document.getElementById('taxConfirmModal');
    if (overlay && !overlay.dataset.marketFeeClearBound) {
      overlay.dataset.marketFeeClearBound = '1';
      overlay.addEventListener('click', e => {
        if (e.target === overlay) clearPendingSale();
      });
    }
  }

  // ----- Récapitulatifs : rendre les frais visibles -----
  if (typeof nextMonth === 'function') {
    const fiscalNextMonth = nextMonth;
    nextMonth = function () {
      const beforeFees = Number(ensureMarketState(state).market.fees.total) || 0;
      const result = fiscalNextMonth();
      const feeDelta = Math.max(0, (Number(state.market.fees.total) || 0) - beforeFees);
      if (state.lastRecap && feeDelta > 0) {
        state.lastRecap.fees = feeDelta;
        state.lastRecap.expenses = (Number(state.lastRecap.expenses) || 0) + feeDelta;
        if (!String(state.lastRecap.text || '').includes('Frais de placements')) {
          state.lastRecap.text = `${state.lastRecap.text || ''} Frais de placements : ${fmtEUR(feeDelta)}.`;
        }
        silentSave();
        render();
      }
      return result;
    };
  }

  if (typeof simulateOneMonth === 'function') {
    const fiscalSimulateOneMonth = simulateOneMonth;
    simulateOneMonth = function () {
      const beforeFees = Number(ensureMarketState(state).market.fees.total) || 0;
      const row = fiscalSimulateOneMonth();
      const feeDelta = Math.max(0, (Number(state.market.fees.total) || 0) - beforeFees);
      if (row) {
        row.fees = feeDelta;
        row.expenses = (Number(row.expenses) || 0) + feeDelta;
      }
      if (state.lastRecap && feeDelta > 0) {
        state.lastRecap.fees = feeDelta;
        state.lastRecap.expenses = (Number(state.lastRecap.expenses) || 0) + feeDelta;
        state.lastRecap.text = `${state.lastRecap.text || ''} Frais de placements : ${fmtEUR(feeDelta)}.`;
      }
      return row;
    };
  }

  if (typeof showAnnualReport === 'function') {
    const fiscalShowAnnualReport = showAnnualReport;
    showAnnualReport = function (report) {
      const result = fiscalShowAnnualReport(report);
      const grid = document.querySelector('#annualModal .annual-grid');
      if (grid) {
        let cell = document.getElementById('annualFees');
        if (!cell) {
          cell = document.createElement('div');
          cell.innerHTML = '<span>Frais placements</span><strong id="annualFees">—</strong>';
          grid.appendChild(cell);
        }
        const value = cell.id === 'annualFees' ? cell : document.getElementById('annualFees');
        if (value) value.textContent = fmtEUR(feesForYear(report?.year));
      }
      return result;
    };
  }

  if (typeof showSimulationReport === 'function') {
    const fiscalShowSimulationReport = showSimulationReport;
    showSimulationReport = function (startLabel, rows, startWorth, totals) {
      const result = fiscalShowSimulationReport(startLabel, rows, startWorth, totals);
      const grid = document.querySelector('#simulationModal .sim-summary-grid');
      if (grid) {
        let strong = document.getElementById('simFees');
        if (!strong) {
          const cell = document.createElement('div');
          cell.innerHTML = '<span>Frais placements</span><strong id="simFees">—</strong>';
          grid.appendChild(cell);
          strong = document.getElementById('simFees');
        }
        if (strong) strong.textContent = fmtEUR((rows || []).reduce((s, r) => s + (Number(r.fees) || 0), 0));
      }
      return result;
    };
  }

  // ----- UI -----
  function ensureMarketUi() {
    bindSaleFinalizer();

    const investHead = document.querySelector('.invest-card .section-head');
    const taxNote = document.querySelector('.tax-engine-note');
    if (investHead && !document.getElementById('marketSummary')) {
      const box = document.createElement('div');
      box.id = 'marketSummary';
      box.className = 'market-summary';
      box.innerHTML = `
        <div><span>Cycle de marché</span><strong id="marketRegime">—</strong></div>
        <div><span>Frais cumulés</span><strong id="marketFeesTotal">0 €</strong></div>
        <div><span>Frais année</span><strong id="marketFeesYear">0 €</strong></div>`;
      (taxNote || investHead).insertAdjacentElement('afterend', box);
    }

    const cards = {
      livret: document.querySelector('.action-card.safety'),
      pea: document.querySelector('.action-card.pea'),
      assurance: document.querySelector('.action-card.assurance'),
      cto: document.querySelector('.action-card.cto'),
      crypto: document.querySelector('.action-card.crypto')
    };

    for (const [asset, card] of Object.entries(cards)) {
      if (!card || card.querySelector('.market-meta')) continue;
      const meta = document.createElement('div');
      meta.className = 'market-meta';
      meta.dataset.marketAsset = asset;
      meta.innerHTML = '<span class="market-model-line"></span><small class="market-fees-line"></small>';
      const returnLine = card.querySelector('.return-line');
      if (returnLine) returnLine.insertAdjacentElement('afterend', meta);
      else card.querySelector('div')?.appendChild(meta);
    }

    const recapGrid = document.querySelector('.recap-card .recap-grid');
    if (recapGrid && !document.getElementById('recapFees')) {
      const div = document.createElement('div');
      div.innerHTML = '<span>Frais placements</span><strong id="recapFees">—</strong>';
      recapGrid.appendChild(div);
    }

    if (!document.getElementById('marketInfoBlock')) {
      const disclaimer = document.querySelector('#taxInfoModal .tax-disclaimer');
      if (disclaimer) {
        const block = document.createElement('section');
        block.id = 'marketInfoBlock';
        block.className = 'market-info-block';
        block.style.display = 'none';
        disclaimer.insertAdjacentElement('beforebegin', block);
      }
    }
  }

  function marketModelText(asset) {
    const m = ensureMarketState(state).market;
    if (asset === 'livret') return `Taux appliqué : ${pct(currentLivretRate())} / an`;
    if (asset === 'pea') return `Monde : 8,5 % long terme • vol. ≈ 14,9 %`;
    if (asset === 'assurance') return `Fonds € : brut simulé ${pct(m.assuranceGrossRate)} / an`;
    if (asset === 'cto') return `Actions concentrées • vol. modèle ≈ 26 %`;
    return `Crypto • vol. modèle ≈ 70–75 %`;
  }

  function marketFeeText(asset) {
    return `Frais : ${FEE_RULES[asset]?.label || '—'} • cumul ${fmtEUR(feesByAsset(asset))}`;
  }

  function extendInfo(key) {
    ensureMarketUi();
    const block = document.getElementById('marketInfoBlock');
    const info = MARKET_INFO[key];
    if (!block || !info) {
      if (block) block.style.display = 'none';
      return;
    }
    const rows = info.rows().map(([label, value]) =>
      `<div class="market-info-row"><span>${label}</span><strong>${value}</strong></div>`
    ).join('');
    block.innerHTML = `
      <p class="market-info-kicker">Rendement & frais</p>
      <h3>${info.title}</h3>
      <div class="market-info-rows">${rows}</div>
      <p>${info.note}</p>
      <small>Références de calibration : UBS Global Investment Returns Yearbook 2026, MSCI World, ACPR, AMF, BCE et barèmes publics des intermédiaires utilisés comme exemples.</small>`;
    block.style.display = 'block';
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-tax-info]');
    if (!btn) return;
    const key = btn.dataset.taxInfo;
    setTimeout(() => extendInfo(key), 0);
  });

  function refreshMarketUi() {
    ensureMarketUi();
    ensureMarketState(state);
    const m = state.market;
    const regime = REGIMES[m.regime] || REGIMES.normal;

    const versionChip = document.querySelector('.version-chip');
    if (versionChip) versionChip.textContent = 'V1.9 • marchés + frais';

    const investPill = document.querySelector('.invest-card .section-head .pill');
    if (investPill) investPill.textContent = 'Marchés réalistes • frais visibles';

    const r = document.getElementById('marketRegime');
    if (r) r.textContent = `${regime.icon} ${regime.label}${m.lastShock ? ` • ${m.lastShock}` : ''}`;
    const total = document.getElementById('marketFeesTotal');
    if (total) total.textContent = fmtEUR(m.fees.total || 0);
    const year = document.getElementById('marketFeesYear');
    if (year) year.textContent = fmtEUR(feesForYear());

    document.querySelectorAll('.market-meta').forEach(meta => {
      const asset = meta.dataset.marketAsset;
      const model = meta.querySelector('.market-model-line');
      const fees = meta.querySelector('.market-fees-line');
      if (model) model.textContent = marketModelText(asset);
      if (fees) fees.textContent = marketFeeText(asset);
    });

    const recap = document.getElementById('recapFees');
    if (recap) recap.textContent = state.lastRecap ? fmtEUR(state.lastRecap.fees || 0) : '—';

    // Précision pédagogique : le taux de la poche commune suit le Livret A.
    const livretTitle = document.querySelector('.action-card.safety h4');
    if (livretTitle && !livretTitle.dataset.marketAdjusted) {
      livretTitle.dataset.marketAdjusted = '1';
      livretTitle.textContent = 'Livret A / LEP*';
    }
  }

  const fiscalRender = render;
  render = function () {
    const result = fiscalRender();
    refreshMarketUi();
    return result;
  };

  ensureMarketUi();
  render();
})();