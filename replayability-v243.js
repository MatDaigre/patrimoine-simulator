(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;
if (typeof state === 'undefined') return;

const VERSION='2.4.7';
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const EUR=v=>typeof fmtEUR==='function'
  ? fmtEUR(v)
  : new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(N(v));
const safe=(fn,fallback=0)=>{try{return fn();}catch(_){return fallback;}};

const SCENARIOS={
  balanced:{
    icon:'⚖️',name:'Équilibré',
    short:'Aucun modificateur supplémentaire',
    desc:'Tu démarres uniquement avec les paramètres de ta carrière et de la difficulté choisie. Salaire, trésorerie, dépenses et bonheur ne reçoivent aucun bonus ni malus supplémentaire.',
    bullets:[
      'Trésorerie : selon la difficulté choisie',
      'Salaire : selon la carrière choisie',
      'Dépenses : paramètres standards',
      'Dette supplémentaire : aucune',
      'Bonheur de départ : 75/100'
    ],
    apply(){}
  },
  prudent:{
    icon:'🛡️',name:'Prudent',
    short:'1 000 € max placés + dépenses -80 €/mois',
    desc:'Une partie de ta trésorerie est immédiatement placée sur le Livret et tes dépenses courantes sont légèrement réduites.',
    bullets:[
      'Livret : jusqu’à 1 000 € transférés depuis la trésorerie',
      'Trésorerie : conserve au minimum 500 €',
      'Dépenses courantes : -80 €/mois',
      'Salaire : inchangé',
      'Dette supplémentaire : aucune',
      'Bonheur : inchangé'
    ],
    apply(){
      const move=Math.min(1000,Math.max(0,N(state.cash)-500));
      state.cash=N(state.cash)-move;
      state.livret=N(state.livret)+move;
      state.basis ||= {};
      state.basis.livret=N(state.basis.livret)+move;
      state.living=Math.max(0,N(state.living)-80);
    }
  },
  busy:{
    icon:'👨‍👩‍👧',name:'Revenus élevés, vie chargée',
    short:'Salaire +350 € • charges +350 €/mois',
    desc:'Tu gagnes davantage, mais ton niveau de vie et tes déplacements coûtent aussi plus cher.',
    bullets:[
      'Salaire : +350 €/mois',
      'Dépenses courantes : +250 €/mois',
      'Transport : +100 €/mois',
      'Surcoût total : +350 €/mois',
      'Bonheur de départ : -3 points',
      'Dette supplémentaire : aucune'
    ],
    apply(){
      state.salary=N(state.salary)+350;
      state.living=N(state.living)+250;
      state.transport=N(state.transport)+100;
      state.wellbeing=clamp(N(state.wellbeing)-3);
    }
  },
  rebuild:{
    icon:'🔧',name:'Reconstruction',
    short:'Dette 6 000 € à 8 % • +1 500 € de trésorerie',
    desc:'Tu disposes d’un peu plus de liquidités, mais tu dois gérer un crédit personnel coûteux dès le début.',
    bullets:[
      'Trésorerie : +1 500 €',
      'Crédit personnel : 6 000 €',
      'Taux du crédit : 8 %/an',
      'Durée : 36 mois',
      'Mensualité : environ 188 €/mois',
      'Bonheur de départ : -4 points'
    ],
    apply(){
      const capital=6000, annual=.08, months=36, r=annual/12;
      const payment=Math.round(capital*r/(1-Math.pow(1+r,-months)));
      state.consumerDebt=capital;
      state.consumerPayment=payment;
      state.consumerMonths=months;
      state.debtMeta ||= {};
      state.debtMeta.consumer={
        principal:capital,rate:annual,months,payment,
        totalInterest:Math.max(0,payment*months-capital)
      };
      state.cash=N(state.cash)+1500;
      state.wellbeing=clamp(N(state.wellbeing)-4);
    }
  }
};

const GOALS={
  wealth:{
    icon:'🏆',name:'Bâtir 100 000 €',
    desc:'Victoire lorsque ton patrimoine net atteint 100 000 €.',
    value:()=>Math.max(0,safe(()=>N(netWorth()),0)),
    target:()=>100000,
    progress:()=>clamp(safe(()=>N(netWorth()),0)/100000*100),
    reached:()=>safe(()=>N(netWorth()),0)>=100000,
    detail:()=>`${EUR(safe(()=>N(netWorth()),0))} / ${EUR(100000)}`
  },
  safety:{
    icon:'🛡️',name:'Sécurité financière',
    desc:'Atteindre 6 mois de dépenses disponibles, un endettement ≤ 20 % et conserver au moins 65 de bonheur.',
    progress(){
      const exp=Math.max(1,safe(()=>N(monthlyExpenses()),1));
      const liquid=Math.max(0,N(state.cash))+Math.max(0,N(state.livret));
      const months=liquid/exp;
      const debt=safe(()=>N(debtRatio()),0);
      const p1=clamp(months/6*100),p2=clamp((40-debt)/20*100),p3=clamp((N(state.wellbeing)-50)/15*100);
      return (p1+p2+p3)/3;
    },
    reached(){
      const exp=Math.max(1,safe(()=>N(monthlyExpenses()),1));
      const liquid=Math.max(0,N(state.cash))+Math.max(0,N(state.livret));
      return liquid>=exp*6 && safe(()=>N(debtRatio()),0)<=20 && N(state.wellbeing)>=65;
    },
    detail(){
      const exp=Math.max(1,safe(()=>N(monthlyExpenses()),1));
      const months=(Math.max(0,N(state.cash))+Math.max(0,N(state.livret)))/exp;
      return `${months.toFixed(1).replace('.',',')} mois de sécurité • endettement ${safe(()=>N(debtRatio()),0).toFixed(0)} %`;
    }
  },
  passive:{
    icon:'🌱',name:'Revenus passifs',
    desc:'Victoire lorsque tes revenus passifs atteignent 1 000 € par mois.',
    progress:()=>clamp(safe(()=>N(passiveIncome()),0)/1000*100),
    reached:()=>safe(()=>N(passiveIncome()),0)>=1000,
    detail:()=>`${EUR(safe(()=>N(passiveIncome()),0))} / mois`
  },
  balance:{
    icon:'❤️',name:'Équilibre durable',
    desc:'Victoire avec un score financier ≥ 80/100, un bonheur ≥ 75/100 et au moins 3 mois de dépenses disponibles.',
    progress(){
      const sc=safe(()=>N(window.ProgressionV240?.score?.()?.total),0);
      const exp=Math.max(1,safe(()=>N(monthlyExpenses()),1));
      const months=(Math.max(0,N(state.cash))+Math.max(0,N(state.livret)))/exp;
      return (clamp(sc/80*100)+clamp(N(state.wellbeing)/75*100)+clamp(months/3*100))/3;
    },
    reached(){
      const sc=safe(()=>N(window.ProgressionV240?.score?.()?.total),0);
      const exp=Math.max(1,safe(()=>N(monthlyExpenses()),1));
      const months=(Math.max(0,N(state.cash))+Math.max(0,N(state.livret)))/exp;
      return sc>=80 && N(state.wellbeing)>=75 && months>=3;
    },
    detail(){
      const sc=safe(()=>N(window.ProgressionV240?.score?.()?.total),0);
      return `Score ${sc}/100 • bonheur ${Math.round(N(state.wellbeing))}/100`;
    }
  }
};

function ensureState(){
  if(!state.replayabilityV243 || state.replayabilityV243.schema!==243){
    const old=state.replayabilityV243||{};
    state.replayabilityV243={
      schema:243,
      scenario:old.scenario||'balanced',
      goal:old.goal||'wealth',
      scenarioApplied:!!old.scenarioApplied,
      goalVictoryShown:!!old.goalVictoryShown
    };
  }
  return state.replayabilityV243;
}

let pendingScenario='balanced';
let pendingGoal='wealth';

function ensureStartOptions(){
  const startBtn=document.getElementById('startGameBtn');
  const startOptions=document.querySelector('#startModal .start-options') ||
                     startBtn?.previousElementSibling;
  if(!startBtn || !startOptions || document.getElementById('replayV243Start')) return;

  const box=document.createElement('div');
  box.id='replayV243Start';
  box.className='replay-v243-start';
  box.innerHTML=`
    <div class="replay-v243-field">
      <label for="replayV243Scenario">Scénario de départ</label>
      <select id="replayV243Scenario">
        ${Object.entries(SCENARIOS).map(([k,s])=>`<option value="${k}">${s.icon} ${s.name} — ${s.short}</option>`).join('')}
      </select>
      <small id="replayV243ScenarioDesc">${SCENARIOS.balanced.desc}</small>
      <div id="replayV243ScenarioParams" class="replay-v243-params"></div>
    </div>
    <div class="replay-v243-field">
      <label for="replayV243Goal">Objectif principal de la partie</label>
      <select id="replayV243Goal">
        ${Object.entries(GOALS).map(([k,g])=>`<option value="${k}">${g.icon} ${g.name}</option>`).join('')}
      </select>
      <small id="replayV243GoalDesc">${GOALS.wealth.desc}</small>
      <div id="replayV243GoalParams" class="replay-v243-goal-params"></div>
    </div>
    <p class="replay-v243-help">Le scénario modifie les paramètres de départ en plus de ta carrière et de la difficulté. Les critères de victoire sont affichés avant de lancer la partie.</p>`;

  startOptions.insertAdjacentElement('afterend',box);

  const scenario=box.querySelector('#replayV243Scenario');
  const goal=box.querySelector('#replayV243Goal');

  const renderScenarioParams=()=>{
    const s=SCENARIOS[pendingScenario]||SCENARIOS.balanced;
    box.querySelector('#replayV243ScenarioDesc').textContent=s.desc;
    box.querySelector('#replayV243ScenarioParams').innerHTML=
      `<strong>Paramètres appliqués :</strong><ul>${s.bullets.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  };
  const renderGoalParams=()=>{
    const g=GOALS[pendingGoal]||GOALS.wealth;
    box.querySelector('#replayV243GoalDesc').textContent=g.desc;
    let conditions=[];
    if(pendingGoal==='wealth') conditions=['Patrimoine net ≥ 100 000 €'];
    else if(pendingGoal==='safety') conditions=['6 mois de dépenses disponibles','Taux d’endettement ≤ 20 %','Bonheur ≥ 65/100'];
    else if(pendingGoal==='passive') conditions=['Revenus passifs ≥ 1 000 €/mois'];
    else if(pendingGoal==='balance') conditions=['Score financier ≥ 80/100','Bonheur ≥ 75/100','Épargne de sécurité ≥ 3 mois'];
    box.querySelector('#replayV243GoalParams').innerHTML=
      `<strong>Condition${conditions.length>1?'s':''} de victoire :</strong><ul>${conditions.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  };

  renderScenarioParams();
  renderGoalParams();

  scenario.addEventListener('change',()=>{
    pendingScenario=scenario.value;
    renderScenarioParams();
  });
  goal.addEventListener('change',()=>{
    pendingGoal=goal.value;
    renderGoalParams();
  });
}

function syncOpeningWorth(){
  const nw=safe(()=>N(netWorth()),0);

  /* baseState initialise historiquement openingWorth à 2 500 €.
     Après difficulté, carrière et scénario, ce montant n'est plus forcément vrai. */
  if(!state.yearStats || typeof state.yearStats!=='object') state.yearStats={};
  state.yearStats.year=N(state.year)||2026;
  state.yearStats.openingWorth=nw;

  /* Le bilan de fin V2.4.1 doit lui aussi partir du vrai patrimoine initial. */
  if(state.gameFeelV241 && typeof state.gameFeelV241==='object'){
    state.gameFeelV241.firstWorth=nw;
  }
}

function syncStartingInvestmentBasis(){
  /* Le scénario Prudent déplace de la trésorerie vers le Livret.
     C'est un versement, jamais une performance de marché. */
  try{
    const h=window.PerformanceDashboardV217?.history?.();
    if(!h?.assets) return;

    const assets=['livret','pea','assurance','cto','crypto'];
    for(const a of assets){
      if(!h.assets[a]) continue;
      let contribution=Math.max(0,N(state.basis?.[a]));
      if(a==='pea'){
        contribution=Math.max(
          contribution,
          Math.max(0,N(state.tax?.peaContributions))
        );
      }
      h.assets[a].contributions=contribution;
      h.assets[a].withdrawals=0;
    }
    h.migratedFromLegacy=false;
    h.createdMonth=0;
  }catch(_){}
}

function applyNewGameConfig(){
  if(!state.started)return;
  const r=ensureState();
  if(r.scenarioApplied)return;

  r.scenario=pendingScenario in SCENARIOS?pendingScenario:'balanced';
  r.goal=pendingGoal in GOALS?pendingGoal:'wealth';

  SCENARIOS[r.scenario].apply();

  /* Toutes les références de départ sont recalées APRÈS le scénario. */
  syncOpeningWorth();
  syncStartingInvestmentBasis();

  r.scenarioApplied=true;
  r.goalVictoryShown=false;

  const s=SCENARIOS[r.scenario],g=GOALS[r.goal];
  state.history ||= [];
  state.history.unshift(`🎮 Scénario : ${s.name} • Objectif : ${g.name}.`);
  state.lastEvent=`Objectif de partie : ${g.name}. ${g.desc}`;

  try{if(typeof silentSave==='function')silentSave();}catch(_){}
  try{if(typeof render==='function')render();}catch(_){}
  renderGoalCard();
}

function currentGoal(){
  const r=ensureState();
  return GOALS[r.goal]||GOALS.wealth;
}

function ensureGoalCard(){
  const progression=document.getElementById('progressionV240');
  if(!progression)return null;
  let box=document.getElementById('replayV243GoalCard');
  if(box)return box;

  box=document.createElement('div');
  box.id='replayV243GoalCard';
  box.className='replay-v243-goal-card';
  const top=progression.querySelector('.progression-v240-top');
  if(top) top.insertAdjacentElement('afterend',box);
  else progression.prepend(box);
  return box;
}

function renderGoalCard(){
  if(!state.started)return;
  const box=ensureGoalCard();
  if(!box)return;
  const r=ensureState(),g=currentGoal(),s=SCENARIOS[r.scenario]||SCENARIOS.balanced;
  const progress=clamp(safe(()=>N(g.progress()),0));

  box.innerHTML=`
    <div class="replay-v243-goal-head">
      <div><span>${g.icon}</span><div><small>Objectif de partie</small><strong>${g.name}</strong></div></div>
      <em>${s.icon} ${s.name}</em>
    </div>
    <p>${g.desc}</p>
    <div class="replay-v243-goal-progress">
      <progress max="100" value="${progress}"></progress>
      <div><span>${safe(()=>g.detail(),'')}</span><strong>${Math.round(progress)} %</strong></div>
    </div>`;
}

function showAlternativeVictory(){
  const modal=document.getElementById('endModal');
  if(!modal)return;
  const g=currentGoal();
  const set=(id,text)=>{const x=document.getElementById(id);if(x)x.textContent=text;};
  set('endEmoji',g.icon);
  set('endEyebrow','Objectif atteint');
  set('endTitle',`Victoire — ${g.name}`);
  set('endText',`${g.desc} Tu as atteint cette route de victoire sans qu’une stratégie unique te soit imposée.`);
  const continueBtn=document.getElementById('continueAfterWinBtn');
  if(continueBtn) continueBtn.style.display='block';
  modal.classList.remove('hidden');
  setTimeout(()=>window.GameFeelV241?.renderEndSummary?.(),0);
}

function checkGoalVictory(){
  if(!state.started || state.gameOver)return false;
  const r=ensureState(),g=currentGoal();
  if(r.goalVictoryShown || r.goal==='wealth')return false;

  if(safe(()=>!!g.reached(),false)){
    r.goalVictoryShown=true;

    /* Ne pas utiliser victoryShown ici :
       ce drapeau appartient à la victoire historique des 100 000 €.
       Si le joueur continue après une victoire alternative, il peut donc
       encore atteindre et voir la victoire des 100 000 €. */
    state.gameResult='win';
    state.lastEvent=`🏆 Victoire : objectif « ${g.name} » atteint.`;
    try{if(typeof addHistory==='function')addHistory(state.lastEvent);}catch(_){}
    try{if(typeof silentSave==='function')silentSave();}catch(_){}
    showAlternativeVictory();
    return true;
  }
  return false;
}

/* On lit les choix AVANT le startGame d'origine puis on applique le scénario
   juste après que le moteur a construit son état initial. */
document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('#startGameBtn');
  if(!btn || btn.disabled)return;
  pendingScenario=document.getElementById('replayV243Scenario')?.value||'balanced';
  pendingGoal=document.getElementById('replayV243Goal')?.value||'wealth';
  setTimeout(applyNewGameConfig,0);
},true);

if(typeof evaluateEndConditions==='function'&&!evaluateEndConditions.__replayV243){
  const coreEvaluate=evaluateEndConditions;
  evaluateEndConditions=function(...args){
    const out=coreEvaluate(...args);

    /* La victoire historique à 100 000 € et l'objectif choisi sont
       indépendants. Le joueur peut donc débloquer les deux, dans n'importe
       quel ordre, s'il continue sa partie. */
    if(!state.gameOver) checkGoalVictory();

    return out;
  };
  evaluateEndConditions.__replayV243=true;
}

function refresh(){
  ensureStartOptions();
  renderGoalCard();
}

function boot(){
  ensureStartOptions();
  if(state.started){
    ensureState();
    renderGoalCard();
  }
  const obs=new MutationObserver(()=>{
    clearTimeout(boot.t);
    boot.t=setTimeout(refresh,80);
  });
  obs.observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

window.ReplayabilityV243={
  version:VERSION,
  scenarios:SCENARIOS,
  goals:GOALS,
  current:()=>ensureState(),
  checkVictory:checkGoalVictory,
  refresh
};
})();