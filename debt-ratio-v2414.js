(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;
if (typeof state === 'undefined') return;

const VERSION='2.4.14';
const N=v=>Number.isFinite(Number(v))?Number(v):0;

/*
  Cohérence bancaire :
  - 100 % du salaire ;
  - 70 % des loyers existants ;
  - extraIncome est déjà une ressource bancaire pondérée lorsqu'un projet
    futur est étudié (openPurchase passe 70 % du futur loyer).
*/
function bankIncome(extraIncome=0){
  const salary=Math.max(0,N(state.salary));
  const existingRent=Math.max(0,N(state.rentIncome))*.70;
  return Math.max(1,salary+existingRent+Math.max(0,N(extraIncome)));
}

function payments(extraPayment=0){
  const current=typeof monthlyDebtPayments==='function'
    ? Math.max(0,N(monthlyDebtPayments()))
    : 0;
  return current+Math.max(0,N(extraPayment));
}

if(typeof debtRatio==='function'){
  debtRatio=function(extraPayment=0,extraIncome=0){
    return payments(extraPayment)/bankIncome(extraIncome)*100;
  };
  debtRatio.__v2414=true;
}

/* Rafraîchit les systèmes qui lisent debtRatio() après le chargement. */
function refresh(){
  try{window.ProgressionV240?.refresh?.();}catch(_){}
  try{window.ReplayabilityV243?.refresh?.();}catch(_){}
  try{window.CoherenceV2410?.refresh?.();}catch(_){}
}

setTimeout(refresh,0);

window.DebtRatioV2414={
  version:VERSION,
  bankIncome,
  ratio:(extraPayment=0,extraIncome=0)=>payments(extraPayment)/bankIncome(extraIncome)*100
};
})();