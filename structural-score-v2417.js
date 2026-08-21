(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;
if (typeof state === 'undefined') return;

const VERSION='2.4.17';
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));

function safe(fn,fallback=0){
  try{return fn();}catch(_){return fallback;}
}

function expenses(){
  return Math.max(
    1,
    safe(
      ()=>N(monthlyExpenses()),
      N(state.housing)+N(state.living)+N(state.transport)+N(state.leisure)
    )
  );
}
function income(){
  return Math.max(
    1,
    safe(()=>N(monthlyIncome()),N(state.salary)+N(state.rentIncome))
  );
}
function worth(){
  return safe(()=>N(netWorth()),0);
}
function liquid(){
  return Math.max(0,N(state.cash))+Math.max(0,N(state.livret));
}
function debtRatioPct(){
  return safe(
    ()=>N(debtRatio()),
    safe(()=>N(monthlyDebtPayments())/income()*100,0)
  );
}
function cashFlow(){
  return safe(()=>N(cashflow()),income()-expenses());
}
function costlyDebt(){
  let d=0;

  const consumerRate=N(state.debtMeta?.consumer?.rate);
  if(N(state.consumerDebt)>0 && (consumerRate>=.06 || consumerRate<=0)){
    d+=Math.max(0,N(state.consumerDebt));
  }

  const loans=state.pcV215?.personalLoans;
  if(Array.isArray(loans)){
    d+=loans
      .filter(l=>N(l.rate)>=.06)
      .reduce((s,l)=>s+Math.max(0,N(l.balance)),0);
  }

  return d;
}
function recurringSaving(){
  const a=state.autoInvest||{};
  return Math.max(0,N(a.livret))+
         Math.max(0,N(a.pea))+
         Math.max(0,N(a.assurance))+
         Math.max(0,N(a.cto))+
         Math.max(0,N(a.crypto));
}

function structuralScore(){
  const exp=expenses();
  const inc=income();
  const nw=worth();
  const ratio=debtRatioPct();
  const flow=cashFlow();

  const emergencyMonths=liquid()/exp;
  const savingRate=flow/inc*100;
  const recurringRate=recurringSaving()/inc*100;

  /* Patrimoine : même logique de fond que le guide V2.4. */
  const patrimoine=clamp(35+(nw/(exp*12))*35);

  /* Résilience : uniquement trésorerie + Livret. */
  const resilience=clamp((emergencyMonths/3)*100);

  /* Dette : taux d'endettement cohérent V2.4.14 + pénalité dette chère. */
  const dettes=clamp(
    100-Math.max(0,ratio-10)*2.25-(costlyDebt()>0?15:0)
  );

  /*
    Efficacité structurelle :
    - capacité à générer un excédent mensuel ;
    - bonus modéré si une épargne/investissement automatique est réellement
      programmé ;
    - aucune récompense/pénalité liée aux mouvements de marché.
  */
  const flowScore=clamp(45+savingRate*2,0,90);
  const recurringBonus=clamp(recurringRate*1.5,0,10);
  const efficacite=clamp(flowScore+recurringBonus);

  const qualite=clamp(N(state.wellbeing));

  const total=Math.round(
    patrimoine*.22+
    resilience*.23+
    dettes*.20+
    efficacite*.20+
    qualite*.15
  );

  return {
    total,
    patrimoine:Math.round(patrimoine),
    resilience:Math.round(resilience),
    dettes:Math.round(dettes),
    efficacite:Math.round(efficacite),
    qualite:Math.round(qualite),
    emergencyMonths,
    savingRate,
    recurringRate,
    ratio
  };
}

function grade(s){
  if(s>=85)return {name:'Gestion très solide',icon:'🏆'};
  if(s>=70)return {name:'Gestionnaire averti',icon:'🌟'};
  if(s>=55)return {name:'Situation en progression',icon:'📈'};
  if(s>=40)return {name:'Patrimoine en construction',icon:'🧱'};
  return {name:'Situation fragile',icon:'🛟'};
}

function applyScoreToCard(){
  const card=document.getElementById('progressionV240');
  if(!card)return;

  const s=structuralScore();
  const g=grade(s.total);

  const set=(id,text)=>{
    const el=document.getElementById(id);
    if(el)el.textContent=text;
  };

  set('progressionV240Score',`${s.total}/100`);
  set('progressionV240Grade',`${g.icon} ${g.name}`);
  set('scoreV240Patrimoine',`${s.patrimoine}/100`);
  set('scoreV240Resilience',`${s.resilience}/100`);
  set('scoreV240Dettes',`${s.dettes}/100`);
  set('scoreV240Efficacite',`${s.efficacite}/100`);
  set('scoreV240Qualite',`${s.qualite}/100`);

  const adv=document.getElementById('progressionV240Advanced');
  if(adv){
    adv.textContent=
      `Sécurité ${s.emergencyMonths.toFixed(1).replace('.',',')} mois • `+
      `endettement ${s.ratio.toFixed(0)} % • `+
      `marge mensuelle ${s.savingRate.toFixed(0)} % • `+
      `versements automatiques ${s.recurringRate.toFixed(0)} % des revenus.`;
  }

  const efficiencyHelp=card.querySelector('#scoreV240Efficacite')?.parentElement?.querySelector('small');
  if(efficiencyHelp){
    efficiencyHelp.textContent=
      'Capacité à dégager une marge mensuelle et régularité des versements. La volatilité des marchés ne modifie pas ce score.';
  }
}

function install(){
  const api=window.ProgressionV240;
  if(!api){
    setTimeout(install,80);
    return;
  }
  if(api.__structuralV2417)return;

  const originalRefresh=
    typeof api.refresh==='function'
      ? api.refresh.bind(api)
      : null;

  /* Les objectifs de victoire appellent window.ProgressionV240.score(). */
  api.score=structuralScore;

  if(originalRefresh){
    api.refresh=function(...args){
      const out=originalRefresh(...args);
      setTimeout(applyScoreToCard,0);
      return out;
    };
  }

  api.__structuralV2417=true;
  api.structuralScore=structuralScore;

  applyScoreToCard();
}

if(typeof render==='function'&&!render.__structuralV2417){
  const coreRender=render;
  render=function(...args){
    const out=coreRender.apply(this,args);
    setTimeout(applyScoreToCard,0);
    return out;
  };
  render.__structuralV2417=true;
}

install();

window.StructuralScoreV2417={
  version:VERSION,
  score:structuralScore,
  refresh:applyScoreToCard
};
})();