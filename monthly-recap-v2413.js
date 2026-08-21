(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;
if (typeof state === 'undefined') return;

const VERSION='2.4.13';
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const EUR=v=>typeof fmtEUR==='function'
  ? fmtEUR(v)
  : new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(N(v));

let tracker=null;

function beginTrack(){
  tracker={
    extraIncome:0,
    extraExpenses:0,
    details:[]
  };
}
function endTrack(){
  const t=tracker||{extraIncome:0,extraExpenses:0,details:[]};
  tracker=null;
  return t;
}
function addIncome(amount,label){
  if(!tracker)return;
  amount=Math.max(0,N(amount));
  tracker.extraIncome+=amount;
  if(amount>0)tracker.details.push(`+${EUR(amount)} ${label}`);
}
function addExpense(amount,label){
  if(!tracker)return;
  amount=Math.max(0,N(amount));
  tracker.extraExpenses+=amount;
  if(amount>0)tracker.details.push(`−${EUR(amount)} ${label}`);
}

/* Suit les événements automatiques sans modifier leur comptabilité V2.4.12. */
if(typeof applyAutomaticLifeEvent==='function'&&!applyAutomaticLifeEvent.__recapV2413){
  const coreEvent=applyAutomaticLifeEvent;
  applyAutomaticLifeEvent=function(evt,isPositive){
    const before=N(state.cash);
    const out=coreEvent.apply(this,arguments);
    const delta=N(state.cash)-before;

    if(isPositive && delta>0) addIncome(delta,evt?.title||'bonne surprise');
    if(!isPositive && delta<0) addExpense(Math.abs(delta),evt?.title||'imprévu');
    return out;
  };
  applyAutomaticLifeEvent.__recapV2413=true;
}

/* Suit les primes commerciales, elles aussi déclenchées après la création
   du récap dans le nextMonth historique. */
if(typeof variableCareerEvent==='function'&&!variableCareerEvent.__recapV2413){
  const coreCareer=variableCareerEvent;
  variableCareerEvent=function(){
    const before=N(state.cash);
    const out=coreCareer.apply(this,arguments);
    const delta=N(state.cash)-before;
    if(out && delta>0) addIncome(delta,'prime commerciale');
    return out;
  };
  variableCareerEvent.__recapV2413=true;
}

function repairLastRecap(t){
  if(!state.lastRecap || !t)return;

  if(t.extraIncome>0){
    state.lastRecap.income=N(state.lastRecap.income)+t.extraIncome;
  }
  if(t.extraExpenses>0){
    state.lastRecap.expenses=N(state.lastRecap.expenses)+t.extraExpenses;
  }

  if(t.details.length){
    const base=String(state.lastRecap.text||'').replace(/\s+$/,'');
    state.lastRecap.text=
      `${base}${base && !/[.!?]$/.test(base)?'.':''} `+
      `Éléments exceptionnels : ${t.details.join(' • ')}.`;
  }

  try{if(typeof silentSave==='function')silentSave();}catch(_){}
  try{if(typeof render==='function')render();}catch(_){}
}

/* Tour manuel : le moteur construit le récap avant la prime commerciale et
   avant l'événement automatique de fin de mois. On réconcilie après le tour. */
if(typeof nextMonth==='function'&&!nextMonth.__recapV2413){
  const coreNext=nextMonth;
  nextMonth=function(...args){
    beginTrack();
    let out;
    try{
      out=coreNext.apply(this,args);
    }finally{
      const t=endTrack();
      repairLastRecap(t);
    }
    return out;
  };
  nextMonth.__recapV2413=true;
}

/* Simulation multi-mois : chaque ligne doit présenter les mêmes revenus et
   dépenses que le récap du mois et que les compteurs annuels. */
if(typeof simulateOneMonth==='function'&&!simulateOneMonth.__recapV2413){
  const coreSim=simulateOneMonth;
  simulateOneMonth=function(...args){
    beginTrack();
    let row;
    let t;
    try{
      row=coreSim.apply(this,args);
    }finally{
      t=endTrack();
    }

    if(row && t){
      row.income=N(row.income)+t.extraIncome;
      row.expenses=N(row.expenses)+t.extraExpenses;

      if(t.details.length){
        const details=t.details.join(' • ');
        row.event=row.event
          ? `${row.event} • ${details}`
          : details;
      }

      repairLastRecap(t);
    }
    return row;
  };
  simulateOneMonth.__recapV2413=true;
}

window.MonthlyRecapV2413={
  version:VERSION
};
})();