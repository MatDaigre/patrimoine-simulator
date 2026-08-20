(() => {
'use strict';

if (typeof state === 'undefined' || typeof render !== 'function') {
  console.error('[Reporting V2.1.9] moteur indisponible');
  return;
}

const VERSION='2.1.9.1';

if(!document.querySelector('link[data-reporting-v219-css]')){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./reporting-v219.css?v=219pc';
  link.dataset.reportingV219Css='1';
  document.head.appendChild(link);
}

const N=v=>Number.isFinite(Number(v))?Number(v):0;
const EPS=.005;
const EUR=v=>typeof fmtEUR==='function'
  ? fmtEUR(v)
  : new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(N(v));
const signedEUR=v=>`${N(v)>0?'+':''}${EUR(v)}`;

let activePeriod=null;
let simulationContext=null;

function monthLabel(y,m){
  try{
    if(typeof monthName==='function') return `${monthName(m)} ${y}`;
  }catch(_){}
  return `${String(m).padStart(2,'0')}/${y}`;
}

function ensureJournal(){
  if(!state.reportingV219 || state.reportingV219.schema!==219){
    state.reportingV219={
      schema:219,
      seq:0,
      createdMonth:Math.max(0,N(state.totalMonths)),
      migratedFromLegacy:true,
      entries:[],
      yearPerformance:{}
    };
  }
  if(!Array.isArray(state.reportingV219.entries)) state.reportingV219.entries=[];
  if(!state.reportingV219.yearPerformance || typeof state.reportingV219.yearPerformance!=='object'){
    state.reportingV219.yearPerformance={};
  }
  state.reportingV219.seq=Math.max(0,N(state.reportingV219.seq));
  return state.reportingV219;
}

function currentPerf(){
  try{
    const d=window.PerformanceDashboardV217?.compute?.();
    return Number.isFinite(Number(d?.totalPerf)) ? Number(d.totalPerf) : 0;
  }catch(_){ return 0; }
}

function snapshot(){
  let debt=0;
  try{ debt=typeof totalDebt==='function'?N(totalDebt()):0; }catch(_){}
  return {
    totalMonths:Math.max(0,N(state.totalMonths)),
    year:N(state.year),
    month:N(state.month),
    cash:N(state.cash),
    debt,
    carValue:N(state.carValue),
    homeValue:N(state.homeValue),
    rentalValue:N(state.rentalValue),
    careerLevel:N(state.careerLevel),
    wellbeing:N(state.wellbeing),
    peaSecurities:N(state.pea),
    peaCash:N(state.tax?.peaCash),
    assets:{
      livret:N(state.livret),
      pea:N(state.pea)+N(state.tax?.peaCash),
      assurance:N(state.assurance),
      cto:N(state.cto),
      crypto:N(state.crypto)
    },
    taxes:N(state.pcV215?.monthlyTaxesPaid)+N(state.tax?.totalPaid),
    fees:N(state.market?.fees?.total),
    interest:N(state.pcV215?.bankInterestPaid),
    eventCost:N(state.yearStats?.eventCost),
    eventCount:N(state.yearStats?.events),
    perf:currentPerf()
  };
}

function contextMeta(extra={}){
  const p=activePeriod;
  return {
    gameMonth:p?.gameMonth ?? Math.max(0,N(state.totalMonths)),
    year:p?.year ?? N(state.year),
    month:p?.month ?? N(state.month),
    label:p?.label ?? monthLabel(N(state.year),N(state.month)),
    ...extra
  };
}

function record(type,label,amount=0,extra={}){
  const j=ensureJournal();
  const meta=contextMeta(extra);
  const entry={
    id:`r219-${++j.seq}`,
    seq:j.seq,
    type,
    label:String(label||type),
    amount:N(amount),
    cashImpact:Number.isFinite(Number(extra.cashImpact))?Number(extra.cashImpact):0,
    year:meta.year,
    month:meta.month,
    gameMonth:meta.gameMonth,
    periodLabel:meta.label,
    asset:extra.asset||'',
    includedInExpenses:!!extra.includedInExpenses,
    detail:extra.detail||'',
    createdAt:Date.now()
  };
  j.entries.push(entry);
  if(j.entries.length>1200) j.entries=j.entries.slice(-1200);
  try{ if(typeof silentSave==='function') silentSave(); }catch(_){}
  return entry;
}

function entriesSince(seq){
  return ensureJournal().entries.filter(e=>N(e.seq)>N(seq));
}
function entriesForGameMonth(gameMonth){
  return ensureJournal().entries.filter(e=>N(e.gameMonth)===N(gameMonth));
}
function entriesForYear(year){
  return ensureJournal().entries.filter(e=>N(e.year)===N(year));
}

function sum(entries,types){
  const set=new Set(Array.isArray(types)?types:[types]);
  return entries.filter(e=>set.has(e.type)).reduce((s,e)=>s+N(e.amount),0);
}

function parseEuro(text){
  if(!text)return 0;
  const m=String(text).match(/([+\-−]?\s*\d[\d\s\u00a0\u202f]*(?:[.,]\d+)?)\s*€/);
  if(!m)return 0;
  let s=m[1].replace(/[−\s\u00a0\u202f]/g,x=>x==='−'?'-':'').replace(',','.');
  const n=Number(s);
  return Number.isFinite(n)?Math.abs(n):0;
}

function addMissingYearExpense(amount,beforeExpenses){
  amount=Math.max(0,N(amount));
  if(amount<=EPS || !state.yearStats)return;
  const after=N(state.yearStats.expenses);
  const already=Math.max(0,after-N(beforeExpenses));
  const missing=Math.max(0,amount-already);
  if(missing>EPS) state.yearStats.expenses=after+missing;
}

/* =========================
   ACTIONS IMMÉDIATES
   ========================= */

if(typeof moveAsset==='function' && !moveAsset.__reportingV219){
  const coreMove=moveAsset;
  moveAsset=function(asset,direction){
    const before=snapshot();
    const out=coreMove(asset,direction);
    const after=snapshot();

    if(direction==='in'){
      const cashOut=Math.max(0,before.cash-after.cash);
      const valueIn=Math.max(0,N(after.assets?.[asset])-N(before.assets?.[asset]));
      const peaPocketUsed=asset==='pea'
        ? Math.max(0,N(before.peaCash)-N(after.peaCash))
        : 0;
      const peaSecuritiesAdded=asset==='pea'
        ? Math.max(0,N(after.peaSecurities)-N(before.peaSecurities))
        : 0;

      if(cashOut>EPS){
        record('investment',`${EUR(cashOut)} versés sur ${asset==='pea'?'PEA World':asset}`,cashOut,{
          asset,cashImpact:-cashOut,
          detail:asset==='pea'
            ? `Versement externe ${EUR(cashOut)}${peaPocketUsed>EPS?` • espèces PEA réaffectées ${EUR(peaPocketUsed)}`:''}`
            : (valueIn>0?`Valeur acquise ${EUR(valueIn)}`:'')
        });
      }

      if(asset==='pea' && peaPocketUsed>EPS && peaSecuritiesAdded>EPS){
        const internal=Math.min(peaPocketUsed,peaSecuritiesAdded);
        record('reallocation',`Espèces PEA → PEA World ${EUR(internal)}`,internal,{
          asset:'pea',cashImpact:0,detail:'Réaffectation interne • aucun nouveau versement'
        });
      }
    }

    if(direction==='out' && asset==='livret'){
      const amount=Math.max(0,before.assets.livret-after.assets.livret);
      if(amount>EPS) record('withdrawal',`Retrait Livret ${EUR(amount)}`,amount,{asset:'livret',cashImpact:amount});
    }
    return out;
  };
  moveAsset.__reportingV219=true;
}

if(typeof training==='function' && !training.__reportingV219){
  const coreTraining=training;
  training=function(){
    const before=snapshot();
    const beforeYearExpenses=N(state.yearStats?.expenses);
    const out=coreTraining();
    const after=snapshot();
    const cost=Math.max(0,before.cash-after.cash);
    if(after.careerLevel>before.careerLevel || cost>EPS){
      record('training',`Formation professionnelle${after.careerLevel>before.careerLevel?` • niveau ${after.careerLevel}`:''}`,cost,{
        cashImpact:-cost
      });
      addMissingYearExpense(cost,beforeYearExpenses);
    }
    return out;
  };
  training.__reportingV219=true;
}

if(typeof buyCar==='function' && !buyCar.__reportingV219){
  const coreBuyCar=buyCar;
  buyCar=function(...args){
    const before=snapshot();
    const out=coreBuyCar(...args);
    const after=snapshot();
    const acquired=Math.max(0,after.carValue-before.carValue);
    if(acquired>EPS){
      const cashOut=Math.max(0,before.cash-after.cash);
      const financing=Math.max(0,after.debt-before.debt);
      record('asset_purchase',`Achat véhicule ${EUR(acquired)}`,acquired,{
        cashImpact:-cashOut,detail:`Comptant ${EUR(cashOut)} • financement ${EUR(financing)}`
      });
      if(financing>EPS) record('financing','Financement véhicule',financing,{cashImpact:financing});
    }
    return out;
  };
  buyCar.__reportingV219=true;
}

if(typeof confirmProperty==='function' && !confirmProperty.__reportingV219){
  const coreConfirmProperty=confirmProperty;
  confirmProperty=function(...args){
    const before=snapshot();
    const out=coreConfirmProperty(...args);
    const after=snapshot();
    const acquiredHome=Math.max(0,after.homeValue-before.homeValue);
    const acquiredRental=Math.max(0,after.rentalValue-before.rentalValue);
    const acquired=acquiredHome+acquiredRental;
    if(acquired>EPS){
      const cashOut=Math.max(0,before.cash-after.cash);
      const financing=Math.max(0,after.debt-before.debt);
      record('asset_purchase',`${acquiredRental>0?'Achat immobilier locatif':'Achat résidence principale'} ${EUR(acquired)}`,acquired,{
        cashImpact:-cashOut,detail:`Apport ${EUR(cashOut)} • financement ${EUR(financing)}`
      });
      if(financing>EPS) record('financing','Financement immobilier',financing,{cashImpact:financing});
    }
    return out;
  };
  confirmProperty.__reportingV219=true;
}

/* Les prêts personnels sont créés dans une closure de pc-core : détection
   fiable par comparaison dette/trésorerie autour des boutons concernés. */
document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('#loanBtn,#v215LoanAdd');
  if(!btn)return;
  const before=snapshot();
  setTimeout(()=>{
    const after=snapshot();
    const financing=Math.max(0,after.debt-before.debt);
    const cashIn=Math.max(0,after.cash-before.cash);
    if(financing>EPS || cashIn>EPS){
      record('financing','Prêt personnel obtenu',Math.max(financing,cashIn),{
        cashImpact:cashIn,detail:`Dette +${EUR(financing)} • trésorerie +${EUR(cashIn)}`
      });
    }
  },0);
},true);

/* =========================
   ÉVÉNEMENTS
   ========================= */

if(typeof applyAutomaticLifeEvent==='function' && !applyAutomaticLifeEvent.__reportingV219){
  const coreEvent=applyAutomaticLifeEvent;
  applyAutomaticLifeEvent=function(...args){
    const before=snapshot();
    const beforeYearExpenses=N(state.yearStats?.expenses);
    const out=coreEvent(...args);
    const after=snapshot();
    const delta=after.cash-before.cash;
    const label=state.lastEvent||'Événement de vie';
    if(delta<-EPS){
      const amount=-delta;
      record('event_expense',label,amount,{cashImpact:-amount,includedInExpenses:false});
      addMissingYearExpense(amount,beforeYearExpenses);
    }else if(delta>EPS){
      record('event_income',label,delta,{cashImpact:delta});
    }else{
      record('event',label,0,{cashImpact:0});
    }
    return out;
  };
  applyAutomaticLifeEvent.__reportingV219=true;
}

/* =========================
   CONFIRMATIONS FISCALES
   ========================= */

document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('#taxConfirmBtn');
  if(!btn)return;
  const title=document.getElementById('taxConfirmTitle')?.textContent||'Opération';
  const rowsText=document.getElementById('taxConfirmRows')?.innerText||'';
  const before=snapshot();

  setTimeout(()=>{
    const after=snapshot();
    const taxDelta=after.taxes-before.taxes;
    const feeDelta=Math.max(0,after.fees-before.fees);

    if(/Vendre dans le PEA/i.test(title)){
      const sold=Math.max(0,before.peaSecurities-after.peaSecurities);
      if(sold>EPS) record('reallocation',`Vente interne PEA ${EUR(sold)}`,sold,{
        asset:'pea',cashImpact:0,detail:'Titres → espèces PEA • fiscalité immédiate 0 €'
      });
    }else if(/Retrait du PEA|Clôturer le PEA/i.test(title)){
      const amount=Math.max(0,before.assets.pea-after.assets.pea);
      if(amount>EPS) record('withdrawal',`${title} • ${EUR(amount)}`,amount,{
        asset:'pea',cashImpact:Math.max(0,after.cash-before.cash),detail:rowsText
      });
    }else if(/assurance-vie/i.test(title)){
      const amount=Math.max(0,before.assets.assurance-after.assets.assurance);
      if(amount>EPS) record('withdrawal',`Rachat assurance-vie ${EUR(amount)}`,amount,{
        asset:'assurance',cashImpact:Math.max(0,after.cash-before.cash),detail:rowsText
      });
    }else if(/Vente CTO/i.test(title)){
      const amount=Math.max(0,before.assets.cto-after.assets.cto);
      if(amount>EPS) record('sale',`Vente CTO ${EUR(amount)}`,amount,{
        asset:'cto',cashImpact:Math.max(0,after.cash-before.cash),detail:rowsText
      });
    }else if(/Vente crypto/i.test(title)){
      const amount=Math.max(0,before.assets.crypto-after.assets.crypto);
      if(amount>EPS) record('sale',`Vente crypto ${EUR(amount)}`,amount,{
        asset:'crypto',cashImpact:Math.max(0,after.cash-before.cash),detail:rowsText
      });
    }

    if(taxDelta>EPS){
      record('tax','Fiscalité déclenchée par opération',taxDelta,{cashImpact:-taxDelta,includedInExpenses:true,detail:title});
    }else if(taxDelta<-EPS){
      record('tax_refund','Remboursement fiscal simulé',-taxDelta,{cashImpact:-taxDelta,detail:title});
    }

    if(feeDelta>EPS){
      record('fee','Frais de transaction',feeDelta,{cashImpact:-feeDelta,includedInExpenses:true,detail:title});
    }
    renderJournalUi();
  },0);
},true);

/* =========================
   PASSAGE DU TEMPS
   ========================= */

function beginPeriod(){
  const s=snapshot();
  const p={
    gameMonth:s.totalMonths,
    year:s.year,
    month:s.month,
    label:monthLabel(s.year,s.month),
    seqStart:ensureJournal().seq,
    snap:s
  };
  const yp=ensureJournal().yearPerformance;
  if(!yp[p.year]) yp[p.year]={start:s.perf,end:null};
  return p;
}

function detectMajorEvent(before,after,isSimulation){
  const b=N(state.pcV215?.events?.largeCount)+N(state.pcV215?.events?.hugeCount);
  /* before snapshot doesn't include counters for backwards compatibility,
     so the caller injects them in before.majorCount. */
  const delta=b-N(before.majorCount);
  if(delta<=0)return null;
  const text=String(state.lastEvent||'');
  const amount=parseEuro(text);
  if(amount<=EPS)return null;
  const beforeYearExpenses=N(before.yearExpenses);
  const e=record('event_expense',text||'Gros imprévu',amount,{
    cashImpact:-amount,
    includedInExpenses:!!isSimulation
  });
  if(!isSimulation) addMissingYearExpense(amount,beforeYearExpenses);
  return e;
}

function finalizePeriod(period,after,isSimulation,row){
  const j=ensureJournal();
  const newEntries=entriesSince(period.seqStart);

  const feeDelta=Math.max(0,after.fees-period.snap.fees);
  const taxDelta=after.taxes-period.snap.taxes;
  const interestDelta=Math.max(0,after.interest-period.snap.interest);
  const debtPrincipalDelta=Math.max(0,period.snap.debt-after.debt);

  const alreadyFee=sum(newEntries,'fee');
  if(feeDelta-alreadyFee>EPS){
    record('fee','Frais de placements du mois',feeDelta-alreadyFee,{
      cashImpact:-(feeDelta-alreadyFee),includedInExpenses:true
    });
  }
  const alreadyTax=sum(newEntries,'tax')-sum(newEntries,'tax_refund');
  if(taxDelta-alreadyTax>EPS){
    record('tax','Impôts et prélèvements du mois',taxDelta-alreadyTax,{
      cashImpact:-(taxDelta-alreadyTax),includedInExpenses:true
    });
  }
  if(interestDelta>EPS){
    record('interest','Intérêts bancaires du mois',interestDelta,{
      cashImpact:-interestDelta,includedInExpenses:true
    });
  }
  if(debtPrincipalDelta>EPS){
    record('debt_repayment','Capital de dette remboursé',debtPrincipalDelta,{
      cashImpact:-debtPrincipalDelta,
      includedInExpenses:true,
      detail:'Part de la mensualité qui réduit réellement le capital restant dû'
    });
  }

  const major=detectMajorEvent({
    majorCount:period.majorCount,
    yearExpenses:period.yearExpenses
  },after,isSimulation);

  const all=entriesSince(period.seqStart);
  const uncountedEventExpense=all
    .filter(e=>e.type==='event_expense'&&!e.includedInExpenses)
    .reduce((s,e)=>s+N(e.amount),0);

  if(isSimulation && row){
    if(uncountedEventExpense>EPS){
      row.expenses=N(row.expenses)+uncountedEventExpense;
      all.filter(e=>e.type==='event_expense'&&!e.includedInExpenses).forEach(e=>e.includedInExpenses=true);
    }
    row.reportingV219=all.map(e=>e.id);
    row.eventCosts=sum(all,'event_expense');
    row.fees=Math.max(N(row.fees),feeDelta);
    row.reportingTaxes=Math.max(0,taxDelta);
    row.reportingInterest=interestDelta;
  }else if(state.lastRecap){
    if(uncountedEventExpense>EPS && !state.lastRecap.reportingEventExpenseAdded){
      state.lastRecap.expenses=N(state.lastRecap.expenses)+uncountedEventExpense;
      state.lastRecap.reportingEventExpenseAdded=uncountedEventExpense;
      all.filter(e=>e.type==='event_expense'&&!e.includedInExpenses).forEach(e=>e.includedInExpenses=true);
    }
    state.lastRecap.reportingV219=all.map(e=>e.id);
    state.lastRecap.eventCosts=sum(all,'event_expense');
    state.lastRecap.reportingTaxes=Math.max(0,taxDelta);
    state.lastRecap.reportingInterest=interestDelta;
  }

  if(after.year!==period.year){
    const yp=j.yearPerformance[period.year] ||= {start:period.snap.perf,end:null};
    yp.end=after.perf;
  }

  try{ if(typeof silentSave==='function') silentSave(); }catch(_){}
  return all;
}

if(typeof simulateOneMonth==='function' && !simulateOneMonth.__reportingV219){
  const coreSimOne=simulateOneMonth;
  simulateOneMonth=function(...args){
    const p=beginPeriod();
    p.majorCount=N(state.pcV215?.events?.largeCount)+N(state.pcV215?.events?.hugeCount);
    p.yearExpenses=N(state.yearStats?.expenses);
    const prev=activePeriod;
    activePeriod=p;
    try{
      const row=coreSimOne(...args);
      if(!row)return row;
      finalizePeriod(p,snapshot(),true,row);
      return row;
    }finally{
      activePeriod=prev;
    }
  };
  simulateOneMonth.__reportingV219=true;
}

if(typeof nextMonth==='function' && !nextMonth.__reportingV219){
  const coreNext=nextMonth;
  nextMonth=function(...args){
    const p=beginPeriod();
    p.majorCount=N(state.pcV215?.events?.largeCount)+N(state.pcV215?.events?.hugeCount);
    p.yearExpenses=N(state.yearStats?.expenses);
    const prev=activePeriod;
    activePeriod=p;
    try{
      const out=coreNext(...args);
      finalizePeriod(p,snapshot(),false,null);
      renderJournalUi();
      return out;
    }finally{
      activePeriod=prev;
    }
  };
  nextMonth.__reportingV219=true;
}

if(typeof simulateMonths==='function' && !simulateMonths.__reportingV219){
  const coreSimMonths=simulateMonths;
  simulateMonths=function(...args){
    simulationContext={
      seqStart:ensureJournal().seq,
      perfStart:currentPerf(),
      gameMonthStart:N(state.totalMonths),
      yearStart:N(state.year)
    };
    try{return coreSimMonths(...args);}
    finally{simulationContext=null;}
  };
  simulateMonths.__reportingV219=true;
}

/* =========================
   BLOCS RÉCAPITULATIFS
   ========================= */

function compactEntries(entries,max=7){
  return [...entries].sort((a,b)=>a.seq-b.seq).slice(-max);
}

function actionLabel(e){
  const prefix={
    investment:'📥',
    reallocation:'🔄',
    withdrawal:'📤',
    sale:'💱',
    training:'🎓',
    financing:'🏦',
    asset_purchase:'🏠',
    event_expense:'⚠️',
    event_income:'🎁',
    tax:'🏛️',
    tax_refund:'🏛️',
    fee:'🧾',
    interest:'💳',
    debt_repayment:'🏦',
    event:'ℹ️'
  }[e.type]||'•';
  return `${prefix} ${e.label}`;
}

function renderMonthlyBlock(){
  const card=document.querySelector('.recap-card');
  if(!card || !state.lastRecap)return;

  let box=document.getElementById('reportingMonthlyV219');
  if(!box){
    box=document.createElement('div');
    box.id='reportingMonthlyV219';
    box.className='reporting-v219-block';
    card.appendChild(box);
  }

  const ids=Array.isArray(state.lastRecap.reportingV219)?new Set(state.lastRecap.reportingV219):null;
  const entries=ids?ensureJournal().entries.filter(e=>ids.has(e.id)):[];
  const events=sum(entries,'event_expense');
  const eventIncome=sum(entries,'event_income');
  const fees=sum(entries,'fee');
  const taxes=sum(entries,'tax')-sum(entries,'tax_refund');
  const interests=sum(entries,'interest');
  const principal=sum(entries,'debt_repayment');
  const actions=compactEntries(entries.filter(e=>!['fee','tax','tax_refund','interest','debt_repayment'].includes(e.type)));

  box.innerHTML=`
    <div class="reporting-v219-title"><strong>Récap comptable du mois</strong><small>Mêmes données utilisées dans les autres bilans</small></div>
    <div class="reporting-v219-grid">
      <div><span>Imprévus / événements</span><strong>${EUR(events)}</strong></div>
      <div><span>Bonnes surprises</span><strong>${eventIncome>EPS?'+'+EUR(eventIncome):EUR(0)}</strong></div>
      <div><span>Frais placements</span><strong>${EUR(fees)}</strong></div>
      <div><span>Impôts / fiscalité</span><strong>${signedEUR(-taxes)}</strong></div>
      <div><span>Intérêts bancaires</span><strong>${EUR(interests)}</strong></div>
      <div><span>Capital dette remboursé</span><strong>${EUR(principal)}</strong></div>
    </div>
    <div class="reporting-v219-actions">
      <strong>Actions enregistrées</strong>
      ${actions.length?actions.map(e=>`<small>${actionLabel(e)}</small>`).join(''):'<small>Aucune action ponctuelle sur ce mois.</small>'}
    </div>`;
}

function totalsHtml(entries){
  const investments=sum(entries,'investment');
  const withdrawals=sum(entries,['withdrawal','sale']);
  const fees=sum(entries,'fee');
  const taxes=sum(entries,'tax')-sum(entries,'tax_refund');
  const interests=sum(entries,'interest');
  const debtPrincipal=sum(entries,'debt_repayment');
  const events=sum(entries,'event_expense');
  const eventIncome=sum(entries,'event_income');
  const trainingCost=sum(entries,'training');
  const financing=sum(entries,'financing');
  const purchases=sum(entries,'asset_purchase');

  return `
    <div class="reporting-v219-grid">
      <div><span>Versements placements</span><strong>${EUR(investments)}</strong></div>
      <div><span>Retraits / ventes</span><strong>${EUR(withdrawals)}</strong></div>
      <div><span>Frais placements</span><strong>${EUR(fees)}</strong></div>
      <div><span>Impôts nets</span><strong>${EUR(taxes)}</strong></div>
      <div><span>Intérêts bancaires</span><strong>${EUR(interests)}</strong></div>
      <div><span>Capital dette remboursé</span><strong>${EUR(debtPrincipal)}</strong></div>
      <div><span>Imprévus / événements</span><strong>${EUR(events)}</strong></div>
      <div><span>Bonnes surprises</span><strong>${EUR(eventIncome)}</strong></div>
      <div><span>Formations</span><strong>${EUR(trainingCost)}</strong></div>
      <div><span>Financements reçus</span><strong>${EUR(financing)}</strong></div>
      <div><span>Achats d'actifs</span><strong>${EUR(purchases)}</strong></div>
    </div>`;
}

function renderAnnualJournal(year){
  const modal=document.getElementById('annualModal');
  if(!modal)return;
  let box=document.getElementById('reportingAnnualV219');
  if(!box){
    box=document.createElement('div');
    box.id='reportingAnnualV219';
    box.className='reporting-v219-block';
    const host=modal.querySelector('.modal-card')||modal;
    host.appendChild(box);
  }
  const entries=entriesForYear(year);
  const yp=ensureJournal().yearPerformance[year];
  const perfEnd=yp?.end??currentPerf();
  const perfStart=yp?.start??perfEnd;
  const perfDelta=perfEnd-perfStart;

  box.innerHTML=`
    <div class="reporting-v219-title"><strong>Audit de cohérence ${year}</strong><small>Actions réellement enregistrées</small></div>
    ${totalsHtml(entries)}
    <div class="reporting-v219-performance"><span>Évolution de la performance cumulée sur l'année</span><strong class="${perfDelta>=0?'positive':'negative'}">${signedEUR(perfDelta)}</strong></div>`;
}

if(typeof showAnnualReport==='function' && !showAnnualReport.__reportingV219){
  const coreAnnual=showAnnualReport;
  showAnnualReport=function(report,...rest){
    const r=coreAnnual(report,...rest);
    const y=N(report?.year)||N(activePeriod?.year)||N(state.year);
    setTimeout(()=>renderAnnualJournal(y),0);
    return r;
  };
  showAnnualReport.__reportingV219=true;
}

function renderSimulationJournal(rows){
  const modal=document.getElementById('simulationModal');
  if(!modal)return;
  let box=document.getElementById('reportingSimulationV219');
  if(!box){
    box=document.createElement('div');
    box.id='reportingSimulationV219';
    box.className='reporting-v219-block';
    const host=modal.querySelector('.modal-card')||modal;
    host.appendChild(box);
  }
  const entries=simulationContext?entriesSince(simulationContext.seqStart):[];
  const perfStart=simulationContext?.perfStart??currentPerf();
  const perfEnd=currentPerf();
  const perfDelta=perfEnd-perfStart;
  box.innerHTML=`
    <div class="reporting-v219-title"><strong>Audit de la simulation</strong><small>${rows?.length||0} mois exécutés</small></div>
    ${totalsHtml(entries)}
    <div class="reporting-v219-performance"><span>Variation de la performance des placements</span><strong class="${perfDelta>=0?'positive':'negative'}">${signedEUR(perfDelta)}</strong></div>`;
}

if(typeof showSimulationReport==='function' && !showSimulationReport.__reportingV219){
  const coreSimReport=showSimulationReport;
  showSimulationReport=function(startLabel,rows,startWorth,totals,...rest){
    const r=coreSimReport(startLabel,rows,startWorth,totals,...rest);

    /* Recalage strict du total Dépenses sur les lignes réellement exécutées.
       Évite qu'un événement ajouté après monthlyExpenses disparaisse du total. */
    if(totals && Array.isArray(rows)){
      totals.expenses=rows.reduce((s,row)=>s+N(row.expenses),0);
      const elExpenses=document.getElementById('simExpenses');
      if(elExpenses) elExpenses.textContent=EUR(totals.expenses);
    }

    setTimeout(()=>renderSimulationJournal(rows),0);
    return r;
  };
  showSimulationReport.__reportingV219=true;
}

function renderCumulativeJournal(){
  const host=document.getElementById('v215CumulativeBilan')||
    document.querySelector('.debt-card')||
    document.querySelector('.side-column');
  if(!host)return;

  let box=document.getElementById('reportingCumulativeV219');
  if(!box){
    box=document.createElement('div');
    box.id='reportingCumulativeV219';
    box.className='reporting-v219-cumulative';
    host.appendChild(box);
  }

  const entries=ensureJournal().entries;
  const perf=currentPerf();
  box.innerHTML=`
    <h4>Journal comptable depuis V2.1.9</h4>
    ${totalsHtml(entries)}
    <div class="reporting-v219-performance"><span>Performance placements actuellement suivie</span><strong class="${perf>=0?'positive':'negative'}">${signedEUR(perf)}</strong></div>
    <small>Les opérations antérieures à l'installation de ce journal ne peuvent pas toutes être reconstruites automatiquement.</small>`;
}

function renderJournalUi(){
  renderMonthlyBlock();
  renderCumulativeJournal();
}

/* =========================
   RENDER
   ========================= */

const coreRender=render;
render=function(){
  const r=coreRender();
  ensureJournal();
  renderJournalUi();
  return r;
};

ensureJournal();
renderJournalUi();

window.PatrimoineReportingV219={
  version:VERSION,
  journal:()=>ensureJournal(),
  entriesForYear,
  entriesForGameMonth,
  record,
  snapshot
};

})();
