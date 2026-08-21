(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;
if (typeof state === 'undefined') return;

const VERSION='2.4.15';
const N=v=>Number.isFinite(Number(v))?Number(v):0;

function simplifiedTax(taxable){
  taxable=Math.max(0,N(taxable));
  if(taxable<=1600)return 0;
  if(taxable<=2200)return (taxable-1600)*.05;
  if(taxable<=3000)return 30+(taxable-2200)*.08;
  return 94+(taxable-3000)*.12;
}

function rentalTaxImpact(){
  const salary=Math.max(0,N(state.salary));
  const rentalTaxable=Math.max(0,N(state.rentIncome)-N(state.rentalCosts));

  const withRental=simplifiedTax(salary+rentalTaxable);
  const withoutRental=simplifiedTax(salary);

  return Math.max(0,withRental-withoutRental);
}

function rentalNetAfterTax(){
  const gross=Math.max(0,N(state.rentIncome));
  if(gross<=0)return 0;

  const costs=Math.max(0,N(state.rentalCosts));
  const debt=Math.max(0,N(state.rentalPayment));
  const tax=rentalTaxImpact();

  return Math.max(0,gross-costs-debt-tax);
}

/*
  passiveIncome() n'est utilisé ici que comme indicateur de revenu passif /
  locatif. Le cash-flow réel du mois reste géré par monthlyIncome(),
  monthlyExpenses() et monthlyTax() : aucune trésorerie n'est modifiée.
*/
if(typeof passiveIncome==='function'){
  passiveIncome=function(){
    return rentalNetAfterTax();
  };
  passiveIncome.__v2415=true;
}

function refreshLabels(){
  const passiveLabels=[
    ...document.querySelectorAll('.goal, .replay-v243-goal-card, #replayV243Start')
  ];

  for(const root of passiveLabels){
    if(!root)continue;

    root.querySelectorAll('p,small,strong,label,li').forEach(el=>{
      const t=el.textContent||'';
      if(t.includes('Revenus locatifs nets')){
        el.textContent=t.replace('Revenus locatifs nets','Cash-flow locatif net');
      }
      if(t.includes('Revenu locatif net ≥ 1 000 €/mois')){
        el.textContent=t.replace(
          'Revenu locatif net ≥ 1 000 €/mois',
          'Cash-flow locatif après charges, crédit et impôt ≥ 1 000 €/mois'
        );
      }
      if(t.includes('Après mensualité du crédit locatif') && !t.includes('impôt')){
        el.textContent=`${t} • après fiscalité locative estimée`;
      }
    });
  }

  try{window.ProgressionV240?.refresh?.();}catch(_){}
  try{window.ReplayabilityV243?.refresh?.();}catch(_){}
}

if(typeof render==='function'&&!render.__rentalNetV2415){
  const coreRender=render;
  render=function(...args){
    const out=coreRender.apply(this,args);
    setTimeout(refreshLabels,0);
    return out;
  };
  render.__rentalNetV2415=true;
}

setTimeout(refreshLabels,0);

window.RentalNetV2415={
  version:VERSION,
  taxImpact:rentalTaxImpact,
  net:rentalNetAfterTax
};
})();