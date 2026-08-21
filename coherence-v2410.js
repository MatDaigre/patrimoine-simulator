(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;
if (typeof state === 'undefined') return;

const VERSION='2.4.10';
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const EUR=v=>typeof fmtEUR==='function'
  ? fmtEUR(v)
  : new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(N(v));
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));

function monthlyRate(annual){
  return Math.pow(Math.max(.0001,1+N(annual)),1/12)-1;
}
function safeLiquid(){
  return Math.max(0,N(state.cash))+Math.max(0,N(state.livret));
}
function longTermInvested(){
  return Math.max(0,N(state.pea))+
         Math.max(0,N(state.assurance))+
         Math.max(0,N(state.cto))+
         Math.max(0,N(state.crypto));
}
function nominalLiquidity(){
  return Math.max(0,N(state.cash))+
         Math.max(0,N(state.livret))+
         Math.max(0,N(state.tax?.peaCash));
}
function expenses(){
  try{return Math.max(1,N(monthlyExpenses()));}
  catch(_){return 1;}
}

function ensureInflationState(){
  if(!state.inflationV2410 || state.inflationV2410.schema!==2410){
    const old=Math.max(0,N(state.pcV215?.inflationLoss));
    state.inflationV2410={
      schema:2410,
      erosionLiquidity:old,
      createdMonth:Math.max(0,N(state.totalMonths)),
      migratedLegacy:Math.max(0,N(state.totalMonths))>0 && old>0
    };
  }
  return state.inflationV2410;
}

/* ==============================
   OBJECTIFS HISTORIQUES DU MOTEUR
   ============================== */
function patchLegacyGoals(){
  try{
    if(typeof emergencyMonths==='function'){
      emergencyMonths=function(){
        return safeLiquid()/expenses();
      };
    }
  }catch(_){}

  try{
    if(Array.isArray(milestones)){
      const invest=milestones.find(m=>m.id==='invest1k');
      if(invest){
        invest.title='Premier capital investi';
        invest.desc='Atteindre 1 000 € de placements de long terme, hors Livret';
        invest.value=()=>longTermInvested();
      }

      const s1=milestones.find(m=>m.id==='safety1');
      if(s1){
        s1.desc='Avoir 1 mois de dépenses en trésorerie + Livret';
        s1.value=()=>safeLiquid();
      }

      const s3=milestones.find(m=>m.id==='safety3');
      if(s3){
        s3.desc='Avoir 3 mois de dépenses en trésorerie + Livret';
        s3.value=()=>safeLiquid();
      }
    }
  }catch(_){}
}
patchLegacyGoals();

/* ==============================
   INFLATION — ÉROSION DES LIQUIDITÉS
   ============================== */
let inflationGuard=false;

function recordInflationAround(core,args,ctx){
  if(inflationGuard) return core.apply(ctx,args);
  inflationGuard=true;

  const before=nominalLiquidity();
  const annual=N(state.annualInflation);
  try{
    const out=core.apply(ctx,args);
    const after=nominalLiquidity();

    const m=monthlyRate(annual);
    const average=(before+after)/2;
    /* Perte de pouvoir d'achat exacte sur un mois :
       B - B/(1+m) = B*m/(1+m). */
    const erosion=Math.max(0,average*(m/(1+m)));
    ensureInflationState().erosionLiquidity+=erosion;

    try{if(typeof silentSave==='function')silentSave();}catch(_){}
    return out;
  }finally{
    inflationGuard=false;
  }
}

if(typeof nextMonth==='function'&&!nextMonth.__coherenceV2410){
  const coreNext=nextMonth;
  nextMonth=function(...args){
    return recordInflationAround(coreNext,args,this);
  };
  nextMonth.__coherenceV2410=true;
}

if(typeof simulateOneMonth==='function'&&!simulateOneMonth.__coherenceV2410){
  const coreSimOne=simulateOneMonth;
  simulateOneMonth=function(...args){
    return recordInflationAround(coreSimOne,args,this);
  };
  simulateOneMonth.__coherenceV2410=true;
}

/* ==============================
   FORMATION INDEXÉE SUR LES PRIX
   ============================== */
if(typeof training==='function'&&!training.__coherenceV2410){
  const coreTraining=training;
  training=function(...args){
    let c=null,base=null;
    try{
      c=typeof career==='function'?career():null;
      if(c && Number.isFinite(Number(c.training))){
        base=N(c.training);
        c.training=base*Math.max(.5,N(state.priceIndex)||1);
      }
      return coreTraining.apply(this,args);
    }finally{
      if(c && base!=null)c.training=base;
      setTimeout(refreshVisualConsistency,0);
    }
  };
  training.__coherenceV2410=true;
}

/* ==============================
   PRIX FUTURS : AUTO / IMMOBILIER
   ============================== */
if(typeof openVehicle==='function'&&!openVehicle.__coherenceV2410){
  openVehicle=function(type){
    if(state.carValue>0){
      setEvent('Tu possèdes déjà un véhicule. Revendre/renouveler sera ajouté dans une prochaine version.');
      return render();
    }

    const idx=Math.max(.5,N(state.priceIndex)||1);
    const base=type==='used'
      ? {title:'Voiture d’occasion',price:9000,months:48,transport:260}
      : {title:'Voiture récente',price:22000,months:60,transport:330};

    const data={
      ...base,
      price:Math.round(base.price*idx),
      transport:Math.round(base.transport*idx)
    };
    const payment=Math.round(annuity(data.price,.055,data.months));

    pendingPurchase={
      kind:'car',...data,payment,rate:.055,
      totalInterest:payment*data.months-data.price
    };

    el('purchaseTitle').textContent=data.title;
    el('purchaseDetails').innerHTML=
      `<div><span>Prix actuel (inflation incluse)</span><strong>${fmtEUR(data.price)}</strong></div>`+
      `<div><span>Crédit auto</span><strong>${fmtEUR(payment)}/mois</strong></div>`+
      `<div><span>Taux</span><strong>5,5 %</strong></div>`+
      `<div><span>Intérêts totaux</span><strong>${fmtEUR(payment*data.months-data.price)}</strong></div>`+
      `<div><span>Durée</span><strong>${data.months} mois</strong></div>`+
      `<div><span>Budget transport estimé</span><strong>${fmtEUR(data.transport)}/mois</strong></div>`;

    el('purchaseChoices').innerHTML='';
    addPurchaseChoice('Payer comptant',`Il faut ${fmtEUR(data.price)} disponibles`,()=>buyCar(false));
    addPurchaseChoice(
      'Financer à crédit',
      `Taux simulé 5,5 % • ratio après achat ${debtRatio(payment).toFixed(0)} %`,
      ()=>buyCar(true)
    );
    el('purchaseModal').classList.remove('hidden');
  };
  openVehicle.__coherenceV2410=true;
}

if(typeof openPurchase==='function'&&!openPurchase.__coherenceV2410){
  openPurchase=function(kind){
    const base=projects[kind];
    if(!base)return;

    if((kind==='apartment'||kind==='house')&&state.homeValue>0){
      setEvent('Tu possèdes déjà une résidence principale.');
      return render();
    }
    if(kind==='rental'&&state.rentalValue>0){
      setEvent('Tu possèdes déjà un bien locatif dans cette version.');
      return render();
    }

    const idx=Math.max(.5,N(state.priceIndex)||1);
    const p={
      ...base,
      price:Math.round(N(base.price)*idx),
      rent:base.rent?Math.round(N(base.rent)*idx):base.rent,
      depositCash:base.depositCash?Math.round(N(base.depositCash)*idx):base.depositCash
      /* cost reste en euros de base : confirmProperty applique déjà priceIndex. */
    };

    const deposit=p.depositCash||Math.round(p.price*p.deposit);
    const loan=p.price-deposit;
    const payment=Math.round(annuity(loan,p.rate,p.months));
    const bankIncome=kind==='rental'?N(p.rent)*.7:0;
    const ratio=debtRatio(payment,bankIncome);

    pendingPurchase={
      kind,...p,deposit,loan,payment,ratio,
      totalInterest:payment*p.months-loan
    };

    el('purchaseTitle').textContent=p.title;
    el('purchaseDetails').innerHTML=
      `<div><span>Prix actuel (inflation incluse)</span><strong>${fmtEUR(p.price)}</strong></div>`+
      `<div><span>Apport</span><strong>${fmtEUR(deposit)}</strong></div>`+
      `<div><span>Emprunt</span><strong>${fmtEUR(loan)}</strong></div>`+
      `<div><span>Taux</span><strong>${(p.rate*100).toFixed(1).replace('.',',')} %</strong></div>`+
      `<div><span>Mensualité</span><strong>${fmtEUR(payment)}/mois</strong></div>`+
      `<div><span>Intérêts totaux</span><strong>${fmtEUR(payment*p.months-loan)}</strong></div>`+
      `${p.rent?`<div><span>Loyer actuel estimé</span><strong>${fmtEUR(p.rent)}/mois</strong></div>`:''}`+
      `<div><span>Taux d’endettement simulé</span><strong class="${ratio<=35?'positive':'negative'}">${ratio.toFixed(0)} %</strong></div>`;

    el('purchaseChoices').innerHTML='';
    addPurchaseChoice(
      'Confirmer le projet',
      ratio<=35
        ?'Le financement semble compatible avec le critère simplifié de 35 %.'
        :'Le financement risque d’être refusé.',
      ()=>confirmProperty()
    );
    addPurchaseChoice('Annuler','Conserver ta situation actuelle',()=>el('purchaseModal').classList.add('hidden'));
    el('purchaseModal').classList.remove('hidden');
  };
  openPurchase.__coherenceV2410=true;
}

/* ==============================
   BILAN ANNUEL : PERFORMANCE RÉELLE EXACTE
   ============================== */
if(typeof showAnnualReport==='function'&&!showAnnualReport.__coherenceV2410){
  const coreAnnual=showAnnualReport;
  showAnnualReport=function(report,...args){
    const out=coreAnnual.call(this,report,...args);

    setTimeout(()=>{
      if(!report)return;
      const opening=N(report.openingWorth);
      const change=N(report.worthChange);
      const inflation=N(report.inflation);
      const changeEl=document.getElementById('annualWorthChange');
      const summary=document.getElementById('annualSummary');

      if(opening>0){
        const nominal=change/opening;
        const real=(1+nominal)/(1+inflation)-1;

        if(changeEl){
          changeEl.textContent=
            `${change>=0?'+':''}${EUR(change)} `+
            `(${nominal>=0?'+':''}${(nominal*100).toFixed(1).replace('.',',')} % nominal)`;
          changeEl.className=change>=0?'positive':'negative';
        }

        if(summary){
          const direction=real>=0?'progressé':'reculé';
          summary.innerHTML=
            `<strong>Note ${report.grade}.</strong> `+
            `En euros constants, ton patrimoine a ${direction} de `+
            `<strong>${Math.abs(real*100).toFixed(1).replace('.',',')} %</strong> `+
            `sur l’année (calcul composé après inflation de ${(inflation*100).toFixed(1).replace('.',',')} %). `+
            `Tu as payé ${EUR(report.taxes)} d’impôts et ${EUR(report.interest)} d’intérêts bancaires.`;
        }
      }else{
        if(changeEl){
          changeEl.textContent=`${change>=0?'+':''}${EUR(change)} • base de départ négative ou nulle`;
          changeEl.className=change>=0?'positive':'negative';
        }
        if(summary){
          summary.innerHTML=
            `<strong>Note ${report.grade}.</strong> Ton patrimoine de départ étant nul ou négatif, `+
            `un pourcentage de performance réelle serait trompeur. `+
            `L’évolution est donc présentée en euros ; inflation de l’année : `+
            `${(inflation*100).toFixed(1).replace('.',',')} %.`;
        }
      }
    },30);

    return out;
  };
  showAnnualReport.__coherenceV2410=true;
}

/* ==============================
   AFFICHAGES COHÉRENTS
   ============================== */
function refreshVisualConsistency(){
  patchLegacyGoals();

  const exp=expenses();
  const safe=safeLiquid();

  const emergency=document.getElementById('emergencyGoal');
  const emergencyText=document.getElementById('emergencyGoalText');
  if(emergency){
    const p=clamp(safe/(exp*3)*100);
    emergency.value=p;
    if(emergencyText)emergencyText.textContent=`${Math.round(p)} %`;
  }

  const cashLoss=document.getElementById('cashInflationLoss');
  if(cashLoss){
    const idx=Math.max(.0001,N(state.priceIndex)||1);
    const cash=Math.max(0,N(state.cash));
    const real=cash/idx;
    const gap=Math.max(0,cash-real);
    cashLoss.textContent=
      `Pouvoir d’achat de la trésorerie actuelle : ${EUR(real)} en euros de départ `+
      `• écart ${EUR(gap)} • inflation cumulée ${((idx-1)*100).toFixed(1).replace('.',',')} %`;
  }

  try{
    const c=typeof career==='function'?career():null;
    const trainingCost=document.getElementById('trainingCost');
    if(c&&trainingCost){
      const base=Math.round(N(c.training)*(1+(Math.max(1,N(state.careerLevel))-1)*.18));
      trainingCost.textContent=EUR(Math.round(base*Math.max(.5,N(state.priceIndex)||1)));
    }
  }catch(_){}

  const box=document.getElementById('v215CumulativeBilan');
  if(box){
    const rows=[...box.querySelectorAll('div')];
    const inflationRow=rows.find(r=>/inflation/i.test(r.querySelector('span')?.textContent||''));
    if(inflationRow){
      const strong=inflationRow.querySelector('strong');
      if(strong){
        const s=ensureInflationState();
        const pct=Math.max(0,(N(state.priceIndex)-1)*100);
        strong.textContent=
          `${EUR(s.erosionLiquidity)} d’érosion estimée des liquidités nominales `+
          `• +${pct.toFixed(1).replace('.',',')} % cumulé`+
          `${s.migratedLegacy?' • historique antérieur approximatif':''}`;
      }
    }
  }
}

if(typeof render==='function'&&!render.__coherenceV2410){
  const coreRender=render;
  render=function(...args){
    const out=coreRender.apply(this,args);
    setTimeout(refreshVisualConsistency,0);
    return out;
  };
  render.__coherenceV2410=true;
}

function boot(){
  ensureInflationState();
  patchLegacyGoals();
  refreshVisualConsistency();
  try{if(typeof render==='function')render();}catch(_){}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

window.CoherenceV2410={
  version:VERSION,
  safeLiquid,
  longTermInvested,
  inflation:()=>ensureInflationState(),
  refresh:refreshVisualConsistency
};
})();