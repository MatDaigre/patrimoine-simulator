(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;
if (typeof state === 'undefined') return;

const VERSION='2.4.12';
const N=v=>Number.isFinite(Number(v))?Number(v):0;

function ensureYear(){
  if(!state.yearStats || typeof state.yearStats!=='object'){
    const opening=typeof netWorth==='function'?N(netWorth()):0;
    state.yearStats={
      year:N(state.year)||2026,
      openingWorth:opening,
      income:0,expenses:0,taxes:0,interest:0,
      investments:0,events:0,eventCost:0
    };
  }
  return state.yearStats;
}

function reporting(type,label,amount,meta={}){
  try{
    const rec=window.PatrimoineReportingV219?.record;
    if(typeof rec==='function') rec(type,label,amount,meta);
  }catch(_){}
}

/* Les événements automatiques historiques bougeaient correctement la
   trésorerie mais ventilaient mal le bilan annuel :
   - gain => eventCost négatif ;
   - perte => eventCost positif mais pas dans expenses.
   On remplace uniquement cette ventilation, sans changer probabilités,
   montants, bonheur ni sélection d'événement. */
if(typeof applyAutomaticLifeEvent==='function'&&!applyAutomaticLifeEvent.__v2412){
  applyAutomaticLifeEvent=function(evt,isPositive){
    const amount=isPositive
      ? scaledAmount(evt.gain)
      : scaledAmount(evt.cost);

    const ys=ensureYear();
    ys.events=N(ys.events)+1;

    if(isPositive){
      state.cash=N(state.cash)+amount;
      ys.income=N(ys.income)+amount;

      reporting(
        'event_income',
        `Bonne surprise — ${evt.title}`,
        amount,
        {
          cashImpact:amount,
          detail:`Événement automatique • bonheur ${N(evt.wellbeing)>=0?'+':''}${N(evt.wellbeing)}`
        }
      );
    }else{
      state.cash=N(state.cash)-amount;
      ys.expenses=N(ys.expenses)+amount;
      ys.eventCost=N(ys.eventCost)+amount;

      reporting(
        'event_expense',
        `Imprévu — ${evt.title}`,
        amount,
        {
          cashImpact:-amount,
          includedInExpenses:true,
          detail:`Événement automatique • bonheur ${N(evt.wellbeing)>=0?'+':''}${N(evt.wellbeing)}`
        }
      );
    }

    state.wellbeing=clampWellbeing(N(state.wellbeing)+N(evt.wellbeing));
    state.lastLifeEventId=evt.id||evt.title;

    const prefix=isPositive?'Bonne surprise':'Imprévu';
    setEvent(`${prefix} — ${evt.title} : ${isPositive?'+':'−'}${fmtEUR(amount)}.`);

    try{if(typeof silentSave==='function')silentSave();}catch(_){}

    return amount;
  };
  applyAutomaticLifeEvent.__v2412=true;
}

/* Même correction pour la prime commerciale :
   elle était encaissée mais absente du total annuel des revenus. */
if(typeof variableCareerEvent==='function'&&!variableCareerEvent.__v2412){
  variableCareerEvent=function(){
    if(state.careerKey!=='sales' || Math.random()>=.14) return false;

    const bonus=Math.round(rand(250,750));
    state.cash=N(state.cash)+bonus;

    const ys=ensureYear();
    ys.income=N(ys.income)+bonus;

    reporting(
      'event_income',
      'Prime commerciale',
      bonus,
      {
        cashImpact:bonus,
        detail:'Revenu professionnel exceptionnel'
      }
    );

    setEvent(`Prime commerciale : +${fmtEUR(bonus)} ce mois-ci.`);
    try{if(typeof silentSave==='function')silentSave();}catch(_){}
    return true;
  };
  variableCareerEvent.__v2412=true;
}

window.LegacyEventAccountingV2412={
  version:VERSION
};
})();