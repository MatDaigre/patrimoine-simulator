(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;
if (typeof state === 'undefined') return;

const VERSION='2.4.16';
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function liquid(){
  return Math.max(0,N(state.cash))+Math.max(0,N(state.livret));
}
function currentExpenses(){
  try{return Math.max(1,N(monthlyExpenses()));}
  catch(_){return 1;}
}
function realWorthRate(report){
  const opening=N(report?.openingWorth);
  if(opening<=0)return null;

  const nominal=N(report?.worthChange)/opening;
  const inflation=Math.max(-.99,N(report?.inflation));
  return (1+nominal)/(1+inflation)-1;
}

function annualScore(report){
  const income=Math.max(1,N(report?.income));
  const expenses=Math.max(0,N(report?.expenses));
  const interest=Math.max(0,N(report?.interest));

  let score=50;

  /* 1. Enrichissement réel : maximum +/- 25 points.
     Aucun bonus lié au simple volume de transferts vers les placements. */
  const real=realWorthRate(report);
  if(real!=null){
    score+=clamp(real*100, -25, 25);
  }else{
    const euroChange=N(report?.worthChange);
    score+=clamp(euroChange/income*20, -15, 15);
  }

  /* 2. Capacité à vivre sous ses revenus : jusqu'à +/- 20 points. */
  const operatingSurplus=(income-expenses)/income;
  score+=clamp(operatingSurplus*50, -20, 20);

  /* 3. Coût de la dette : jusqu'à -15 points. */
  const interestBurden=interest/income;
  score-=clamp(interestBurden*120, 0, 15);

  /* 4. Sécurité financière : trésorerie + Livret uniquement. */
  const securityMonths=liquid()/currentExpenses();
  score+=clamp(securityMonths/3*10, 0, 10);

  /* 5. Qualité de vie : une stratégie financière destructrice du bonheur
     ne peut pas obtenir la meilleure note. */
  const wellbeing=clamp(N(state.wellbeing),0,100);
  score+=clamp((wellbeing-50)/50*10, 0, 10);

  return clamp(score,0,100);
}

function gradeFromScore(score){
  if(score>=85)return 'A';
  if(score>=70)return 'B';
  if(score>=55)return 'C';
  if(score>=40)return 'D';
  return 'E';
}

/* buildAnnualReport appelle annualGrade(report), donc remplacer cette fonction
   suffit sans toucher aux calculs ou à l'historique annuel. */
if(typeof annualGrade==='function'){
  annualGrade=function(report){
    return gradeFromScore(annualScore(report));
  };
  annualGrade.__v2416=true;
}

function explanation(report){
  const score=Math.round(annualScore(report));
  const real=realWorthRate(report);
  const income=Math.max(1,N(report?.income));
  const surplus=(income-Math.max(0,N(report?.expenses)))/income*100;
  const burden=Math.max(0,N(report?.interest))/income*100;
  const months=liquid()/currentExpenses();

  return {
    score,
    real,
    surplus,
    burden,
    months
  };
}

/* Ajoute une lecture pédagogique sous le bilan sans changer les chiffres. */
if(typeof showAnnualReport==='function'&&!showAnnualReport.__gradeV2416){
  const coreShow=showAnnualReport;
  showAnnualReport=function(report,...args){
    const out=coreShow.call(this,report,...args);

    setTimeout(()=>{
      const modal=document.getElementById('annualModal');
      if(!modal || !report)return;

      let box=modal.querySelector('.annual-grade-v2416');
      if(!box){
        box=document.createElement('div');
        box.className='annual-grade-v2416';
        box.style.cssText='margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(79,70,229,.055);border:1px solid rgba(79,70,229,.12);font-size:11px;line-height:1.45;color:#687791';
        const summary=document.getElementById('annualSummary');
        (summary||modal.querySelector('.modal-card'))?.insertAdjacentElement('afterend',box);
      }

      const x=explanation(report);
      const realTxt=x.real==null
        ? 'non calculable (patrimoine de départ nul ou négatif)'
        : `${x.real>=0?'+':''}${(x.real*100).toFixed(1).replace('.',',')} %`;

      box.innerHTML=
        `<strong style="color:#34435a">Comment est calculée la note ?</strong><br>`+
        `Score interne : ${x.score}/100 • évolution réelle du patrimoine : ${realTxt} • `+
        `solde revenus/dépenses : ${x.surplus>=0?'+':''}${x.surplus.toFixed(1).replace('.',',')} % • `+
        `intérêts : ${x.burden.toFixed(1).replace('.',',')} % des revenus • `+
        `sécurité : ${x.months.toFixed(1).replace('.',',')} mois.<br>`+
        `Les retraits puis reversements d'un même capital n'améliorent pas la note.`;
    },50);

    return out;
  };
  showAnnualReport.__gradeV2416=true;
}

window.AnnualGradeV2416={
  version:VERSION,
  score:annualScore,
  grade:r=>gradeFromScore(annualScore(r))
};
})();