(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;
if (typeof state === 'undefined') return;

const VERSION='2.4.9';
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const EUR=v=>typeof fmtEUR==='function'
  ? fmtEUR(v)
  : new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(N(v));
const PCT=v=>`${N(v).toFixed(0)} %`;

function safe(fn,fallback=0){try{return fn();}catch(_){return fallback;}}
function expenses(){return Math.max(1,safe(()=>N(monthlyExpenses()),N(state.housing)+N(state.living)+N(state.transport)+N(state.leisure)));}
function income(){return Math.max(1,safe(()=>N(monthlyIncome()),N(state.salary)+N(state.rentIncome)));}
function worth(){return safe(()=>N(netWorth()),0);}
function debts(){return safe(()=>N(totalDebt()),N(state.homeDebt)+N(state.rentalDebt)+N(state.carDebt)+N(state.studentDebt)+N(state.consumerDebt));}
function debtRatioPct(){return safe(()=>N(debtRatio()), safe(()=>N(monthlyDebtPayments())/income()*100,0));}
function monthlyFlow(){return safe(()=>N(cashflow()),income()-expenses());}
/* Épargne de sécurité = argent immédiatement disponible et sans risque de marché.
   PEA, CTO, crypto, assurance-vie et immobilier sont volontairement exclus. */
function liquid(){return Math.max(0,N(state.cash))+Math.max(0,N(state.livret));}

function invested(){
  return Math.max(0,N(state.pea))+Math.max(0,N(state.assurance))+Math.max(0,N(state.cto))+Math.max(0,N(state.crypto));
}

function autoLongTerm(){
  const a=state.autoInvest||{};
  return Math.max(0,N(a.pea))+Math.max(0,N(a.assurance))+Math.max(0,N(a.cto))+Math.max(0,N(a.crypto));
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
function score(){
  const exp=expenses(), inc=income(), nw=worth(), ratio=debtRatioPct(), flow=monthlyFlow();
  const emergencyMonths=liquid()/exp;
  const savingRate=flow/inc*100;

  const patrimoine=clamp(35 + (nw/(exp*12))*35);
  const resilience=clamp((emergencyMonths/3)*100);
  const dettes=clamp(100 - Math.max(0,ratio-10)*2.25 - (costlyDebt()>0?15:0));
  const efficacite=clamp(45 + savingRate*2 + Math.min(15,Math.max(-15,safe(()=>N(window.PerformanceDashboardV217?.compute?.()?.totalPct),0))));
  const qualite=clamp(N(state.wellbeing));

  const total=Math.round(
    patrimoine*.22 +
    resilience*.23 +
    dettes*.20 +
    efficacite*.20 +
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

function objective(){
  const exp=expenses(), liq=liquid(), cd=costlyDebt(), inv=invested(), nw=worth();

  if(N(state.cash)<0){
    return {
      icon:'💶',title:'Revenir à une trésorerie positive',
      desc:'Avant d’investir davantage, retrouve une marge de sécurité sur ton compte.',
      current:Math.max(0,N(state.cash)+exp),target:exp,
      label:`Trésorerie ${EUR(state.cash)}`,
      tip:'Réduis temporairement les dépenses variables ou évite un nouveau financement.'
    };
  }
  if(liq<exp){
    return {
      icon:'🛟',title:'Construire 1 mois de sécurité',
      desc:'Ton premier filet de sécurité : disposer d’un mois complet de dépenses en trésorerie et/ou Livret, sans dépendre des marchés.',
      current:liq,target:exp,
      label:`${EUR(liq)} sur ${EUR(exp)}`,
      tip:'Le Livret et la trésorerie sont adaptés à cet objectif car l’argent reste disponible.'
    };
  }
  if(cd>0){
    return {
      icon:'💳',title:'Réduire les dettes coûteuses',
      desc:'Les crédits à taux élevé ralentissent fortement la construction du patrimoine.',
      current:Math.max(0,cd),target:0,inverse:true,
      label:`${EUR(cd)} restant`,
      tip:'Compare le taux du crédit au rendement espéré de tes placements avant d’arbitrer.'
    };
  }
  if(liq<exp*3){
    return {
      icon:'🛡️',title:'Atteindre 3 mois de sécurité',
      desc:'Atteins trois mois de dépenses uniquement avec la trésorerie et le Livret. Les placements exposés au marché ne comptent pas.',
      current:liq,target:exp*3,
      label:`${EUR(liq)} sur ${EUR(exp*3)}`,
      tip:'Tu peux avancer progressivement : il n’est pas nécessaire de tout constituer en un seul mois.'
    };
  }
  const autoLT=autoLongTerm();
  if(autoLT<=0){
    const suggested=Math.max(50,Math.round(income()*.05/10)*10);
    return {
      icon:'🔁',title:'Mettre en place un versement automatique',
      desc:'Une fois ton épargne de sécurité constituée, automatise une partie de ton investissement à long terme.',
      current:0,target:suggested,
      label:`0 € / mois programmés`,
      tip:`Un premier repère peut être environ 5 % de tes revenus, soit ${EUR(suggested)}/mois ici. Tu peux adapter selon ta situation.`
    };
  }

  if(inv<exp*3){
    return {
      icon:'📈',title:'Faire grandir tes placements de long terme',
      desc:'Tes versements automatiques sont en place. Laisse maintenant le capital se construire progressivement.',
      current:inv,target:exp*3,
      label:`${EUR(inv)} investis • ${EUR(autoLT)}/mois automatiques`,
      tip:'Le Livret reste ton épargne de sécurité ; ici, seuls PEA, assurance-vie, CTO et crypto sont comptés comme placements de long terme.'
    };
  }

  const step=10000;
  const target=Math.max(step,(Math.floor(Math.max(0,nw)/step)+1)*step);
  return {
    icon:'🎯',title:`Atteindre ${EUR(target)} de patrimoine net`,
    desc:'Ton socle est en place. L’objectif devient maintenant de faire progresser durablement ton patrimoine.',
    current:Math.max(0,nw),target,
    label:`${EUR(nw)} de patrimoine net`,
    tip:'Observe simultanément ton taux d’épargne, tes frais, tes dettes et la performance réelle après inflation.'
  };
}

function objectiveProgress(o){
  if(o.inverse){
    const baseline=Math.max(1,o.current);
    return o.current<=0?100:clamp(100-(o.current/baseline)*100);
  }
  return clamp(o.current/Math.max(1,o.target)*100);
}

function ensureCard(){
  const main=document.querySelector('.main-column');
  if(!main)return null;
  let card=document.getElementById('progressionV240');
  if(card)return card;

  card=document.createElement('section');
  card.id='progressionV240';
  card.className='card section-card progression-v240-card';
  card.dataset.pcPanel='dashboard';
  card.innerHTML=`
    <div class="progression-v240-top">
      <div>
        <p class="eyebrow">Guide de progression</p>
        <h3>🎯 Ton prochain objectif</h3>
      </div>
      <button type="button" class="progression-v240-toggle" id="progressionV240Toggle">Voir mon score</button>
    </div>

    <div class="progression-v240-main">
      <div class="progression-v240-objective">
        <div class="progression-v240-objective-head">
          <span id="progressionV240Icon">🎯</span>
          <div><strong id="progressionV240Title">—</strong><small id="progressionV240Desc">—</small></div>
        </div>
        <div class="progression-v240-progress">
          <div><span id="progressionV240Label">—</span><strong id="progressionV240Percent">—</strong></div>
          <progress id="progressionV240Bar" max="100" value="0"></progress>
        </div>
        <div class="progression-v240-tip"><span>💡</span><p id="progressionV240Tip">—</p></div>
      </div>

      <div class="progression-v240-score-summary">
        <span>Score financier</span>
        <strong id="progressionV240Score">—</strong>
        <small id="progressionV240Grade">—</small>
      </div>
    </div>

    <div class="progression-v240-details" id="progressionV240Details" hidden>
      <p class="progression-v240-details-intro">Le score ne récompense pas une stratégie unique. Il mesure la solidité globale de ta situation.</p>
      <div class="progression-v240-score-grid">
        <div><span>🏦 Patrimoine</span><strong id="scoreV240Patrimoine">—</strong><small>Patrimoine net par rapport à ton niveau de dépenses.</small></div>
        <div><span>🛡️ Résilience</span><strong id="scoreV240Resilience">—</strong><small>Nombre de mois de dépenses immédiatement disponibles.</small></div>
        <div><span>💳 Dettes</span><strong id="scoreV240Dettes">—</strong><small>Poids des mensualités et présence de dettes coûteuses.</small></div>
        <div><span>⚙️ Efficacité</span><strong id="scoreV240Efficacite">—</strong><small>Capacité d’épargne et efficacité de tes placements.</small></div>
        <div><span>❤️ Qualité de vie</span><strong id="scoreV240Qualite">—</strong><small>Ton bonheur reste une composante de la réussite financière.</small></div>
      </div>
      <div class="progression-v240-advanced">
        <strong>Pour aller plus loin</strong>
        <span id="progressionV240Advanced">—</span>
      </div>
    </div>`;

  const budget=main.querySelector('.budget-card');
  main.insertBefore(card,budget||main.firstElementChild);

  card.querySelector('#progressionV240Toggle').addEventListener('click',()=>{
    const details=card.querySelector('#progressionV240Details');
    details.hidden=!details.hidden;
    card.querySelector('#progressionV240Toggle').textContent=details.hidden?'Voir mon score':'Masquer le détail';
  });
  return card;
}

function refresh(){
  const card=ensureCard();
  if(!card)return;

  const active=document.documentElement.dataset.pcActiveTab||'dashboard';
  const visible=active==='dashboard';
  card.classList.toggle('pc-tab-hidden-v211',!visible);
  card.setAttribute('aria-hidden',visible?'false':'true');

  const s=score(), g=grade(s.total), o=objective();
  let prog;
  if(o.inverse){
    // Objectif inverse : on montre une progression qualitative sans prétendre connaître
    // le capital initial de la dette avant installation de V2.4.
    prog=o.current<=0?100:Math.max(5,Math.min(95,100-(o.current/(o.current+expenses()))*100));
  }else{
    prog=objectiveProgress(o);
  }

  card.querySelector('#progressionV240Icon').textContent=o.icon;
  card.querySelector('#progressionV240Title').textContent=o.title;
  card.querySelector('#progressionV240Desc').textContent=o.desc;
  card.querySelector('#progressionV240Label').textContent=o.label;
  card.querySelector('#progressionV240Percent').textContent=PCT(prog);
  card.querySelector('#progressionV240Bar').value=prog;
  card.querySelector('#progressionV240Tip').textContent=o.tip;

  card.querySelector('#progressionV240Score').textContent=`${s.total}/100`;
  card.querySelector('#progressionV240Grade').textContent=`${g.icon} ${g.name}`;

  card.querySelector('#scoreV240Patrimoine').textContent=`${s.patrimoine}/100`;
  card.querySelector('#scoreV240Resilience').textContent=`${s.resilience}/100`;
  card.querySelector('#scoreV240Dettes').textContent=`${s.dettes}/100`;
  card.querySelector('#scoreV240Efficacite').textContent=`${s.efficacite}/100`;
  card.querySelector('#scoreV240Qualite').textContent=`${s.qualite}/100`;

  card.querySelector('#progressionV240Advanced').textContent=
    `Épargne de sécurité : ${s.emergencyMonths.toFixed(1).replace('.',',')} mois • `+
    `Taux d’endettement : ${s.ratio.toFixed(0)} % • `+
    `Capacité d’épargne mensuelle : ${s.savingRate.toFixed(0)} %.`;
}

function boot(){
  refresh();
  const config={childList:true,subtree:true,characterData:true};
  const obs=new MutationObserver(()=>{
    clearTimeout(boot.t);
    boot.t=setTimeout(()=>{
      obs.disconnect();
      try{refresh();}
      finally{obs.observe(document.body,config);}
    },60);
  });
  obs.observe(document.body,config);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

window.ProgressionV240={version:VERSION,score,objective,refresh};
})();
