(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;
if (typeof state === 'undefined') return;

const VERSION='2.4.6';
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const EUR=v=>typeof fmtEUR==='function'
  ? fmtEUR(v)
  : new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(N(v));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ri=(a,b)=>Math.round(a+Math.random()*(b-a));
const price=base=>Math.max(0,Math.round(base*Math.max(.75,N(state.priceIndex)||1)));

function ensureState(){
  if(!state.choiceEventsV242 || state.choiceEventsV242.schema!==242){
    const old=state.choiceEventsV242||{};
    state.choiceEventsV242={
      schema:242,
      nextMonth:Number.isFinite(Number(old.nextMonth))
        ? N(old.nextMonth)
        : Math.max(3,N(state.totalMonths)+ri(3,6)),
      seen:Array.isArray(old.seen)?old.seen:[],
      resolved:Math.max(0,N(old.resolved)),
      lastMonth:Number.isFinite(Number(old.lastMonth))?N(old.lastMonth):-999,
      livingAdjustmentBase:Number.isFinite(Number(old.livingAdjustmentBase))?N(old.livingAdjustmentBase):0
    };
  }
  return state.choiceEventsV242;
}

const EVENTS=[
  {
    id:'car-repair',
    icon:'🚗',
    title:'Ta voiture commence à montrer des signes de fatigue',
    text:'Un bruit inquiétant apparaît. Tu peux agir maintenant ou prendre le risque d’attendre.',
    when:()=>N(state.carValue)>0,
    choices:[
      {label:'Réparer immédiatement',desc:()=>`Coût ${EUR(price(650))} • bonheur +1`,cash:()=>-price(650),happy:1,lesson:'Payer maintenant réduit le risque d’une panne plus coûteuse.'},
      {label:'Faire seulement l’entretien minimum',desc:()=>`Coût ${EUR(price(250))} • bonheur -1`,cash:()=>-price(250),happy:-1,lesson:'Une solution intermédiaire protège la trésorerie mais laisse davantage de risque.'},
      {label:'Repousser la réparation',desc:()=>`0 € aujourd’hui • bonheur -2`,cash:()=>0,happy:-2,lesson:'Repousser une dépense protège la trésorerie à court terme, mais ne supprime pas le problème.'}
    ]
  },
  {
    id:'family-weekend',
    icon:'🌤️',
    title:'Tes proches proposent un week-end improvisé',
    text:'C’est une dépense non prévue, mais aussi une occasion de préserver ton équilibre de vie.',
    choices:[
      {label:'Profiter pleinement du week-end',desc:()=>`Coût ${EUR(price(420))} • bonheur +4`,cash:()=>-price(420),happy:4,lesson:'Le budget sert aussi à financer ce qui compte pour toi.'},
      {label:'Choisir une version plus simple',desc:()=>`Coût ${EUR(price(180))} • bonheur +2`,cash:()=>-price(180),happy:2,lesson:'Un compromis peut préserver à la fois le budget et la qualité de vie.'},
      {label:'Refuser pour économiser',desc:()=>`0 € • bonheur -2`,cash:()=>0,happy:-2,lesson:'Épargner davantage peut avoir un coût non financier.'}
    ]
  },
  {
    id:'training-opportunity',
    icon:'🎓',
    title:'Une formation courte peut améliorer tes compétences',
    text:'La formation n’est pas obligatoire, mais elle peut soutenir ta progression professionnelle.',
    choices:[
      {label:'Financer la formation complète',desc:()=>`Coût ${EUR(price(500))} • bonheur +1`,cash:()=>-price(500),happy:1,careerChance:.35,lesson:'Investir dans ses compétences peut améliorer les revenus futurs, sans garantie.'},
      {label:'Choisir une formation en ligne',desc:()=>`Coût ${EUR(price(140))} • bonheur 0`,cash:()=>-price(140),happy:0,careerChance:.12,lesson:'Une option moins coûteuse peut conserver une partie du bénéfice potentiel.'},
      {label:'Ne pas la suivre',desc:()=>`0 € • aucun effet immédiat`,cash:()=>0,happy:0,lesson:'Ne pas dépenser est parfois rationnel si l’opportunité n’est pas prioritaire.'}
    ]
  },
  {
    id:'appliance',
    icon:'🧺',
    title:'Un appareil électroménager tombe en panne',
    text:'Tu dois arbitrer entre prix, confort et durée de vie.',
    choices:[
      {label:'Acheter un modèle durable',desc:()=>`Coût ${EUR(price(700))} • bonheur +1`,cash:()=>-price(700),happy:1,lesson:'Le prix d’achat n’est qu’une partie du coût total d’un équipement.'},
      {label:'Acheter un modèle standard',desc:()=>`Coût ${EUR(price(390))} • bonheur 0`,cash:()=>-price(390),happy:0,lesson:'Le milieu de gamme peut être un compromis raisonnable.'},
      {label:'Acheter d’occasion',desc:()=>`Coût ${EUR(price(170))} • bonheur -1`,cash:()=>-price(170),happy:-1,lesson:'L’occasion réduit fortement le coût mais peut offrir moins de confort ou de garantie.'}
    ]
  },
  {
    id:'bonus-choice',
    icon:'💼',
    title:'Tu reçois une petite prime exceptionnelle',
    text:'Tu peux l’utiliser immédiatement, renforcer ta sécurité ou l’investir.',
    choices:[
      {label:'La garder en trésorerie',desc:()=>`+${EUR(price(500))} en trésorerie`,cash:()=>price(500),happy:0,lesson:'Une rentrée d’argent peut renforcer ton fonds de sécurité.'},
      {label:'Te faire plaisir avec une partie',desc:()=>`Prime ${EUR(price(500))} • ${EUR(price(250))} dépensés • +${EUR(price(250))} net • bonheur +3`,cash:()=>price(250),happy:3,grossIncome:()=>price(500),choiceExpense:()=>price(250),lesson:'Un budget durable peut aussi intégrer le plaisir.'},
      {label:'Investir la totalité sur le PEA',desc:()=>`${EUR(price(500))} dirigés vers le PEA`,cash:()=>0,happy:0,pea:()=>price(500),lesson:'Investir une prime accélère le patrimoine mais rend l’argent moins immédiatement disponible.'}
    ]
  },
  {
    id:'subscription',
    icon:'📱',
    title:'Un nouveau service mensuel te tente',
    text:'L’abonnement paraît faible, mais les petites dépenses récurrentes s’accumulent.',
    choices:[
      {label:'Prendre l’abonnement',desc:()=>`${EUR(price(25))}/mois • bonheur +2`,cash:()=>0,happy:2,livingMonthly:()=>price(25),lesson:'Une petite charge mensuelle devient significative lorsqu’elle est répétée.'},
      {label:'Choisir une alternative moins chère',desc:()=>`${EUR(price(10))}/mois • bonheur +1`,cash:()=>0,happy:1,livingMonthly:()=>price(10),lesson:'Comparer les alternatives réduit les dépenses récurrentes.'},
      {label:'Ne rien souscrire',desc:()=>`0 € • bonheur 0`,cash:()=>0,happy:0,lesson:'Éviter une nouvelle charge fixe préserve ton reste mensuel.'}
    ]
  },
  {
    id:'wedding',
    icon:'💌',
    title:'Tu es invité à un événement important',
    text:'Transport, cadeau et hébergement peuvent peser sur le budget.',
    choices:[
      {label:'Participer sans compter',desc:()=>`Coût ${EUR(price(600))} • bonheur +4`,cash:()=>-price(600),happy:4,lesson:'Certaines dépenses ont une valeur personnelle forte malgré leur coût financier.'},
      {label:'Fixer un budget raisonnable',desc:()=>`Coût ${EUR(price(300))} • bonheur +2`,cash:()=>-price(300),happy:2,lesson:'Fixer une enveloppe avant la dépense aide à garder le contrôle.'},
      {label:'Décliner l’invitation',desc:()=>`0 € • bonheur -2`,cash:()=>0,happy:-2,lesson:'La décision financière optimale n’est pas toujours la décision de vie optimale.'}
    ]
  },
  {
    id:'energy-work',
    icon:'💡',
    title:'Tu peux réduire une partie de tes dépenses courantes',
    text:'Un petit investissement permettrait de diminuer durablement certains coûts du quotidien.',
    choices:[
      {label:'Faire les améliorations maintenant',desc:()=>`Coût ${EUR(price(450))} • dépenses -${EUR(price(18))}/mois`,cash:()=>-price(450),happy:1,livingMonthly:()=>-price(18),lesson:'Une dépense initiale peut produire des économies récurrentes.'},
      {label:'Faire seulement le plus rentable',desc:()=>`Coût ${EUR(price(180))} • dépenses -${EUR(price(7))}/mois`,cash:()=>-price(180),happy:0,livingMonthly:()=>-price(7),lesson:'Commencer petit permet de tester le retour sur investissement.'},
      {label:'Ne rien changer',desc:()=>`0 € • situation inchangée`,cash:()=>0,happy:0,lesson:'Conserver sa trésorerie peut être pertinent si la marge de sécurité est faible.'}
    ]
  }
];

function availableEvents(){
  const seen=new Set(ensureState().seen.slice(-4));
  const eligible=EVENTS.filter(e=>!e.when || safeBool(e.when));
  const fresh=eligible.filter(e=>!seen.has(e.id));
  return fresh.length?fresh:eligible;
}
function safeBool(fn){try{return !!fn();}catch(_){return false;}}
function pickEvent(){
  const pool=availableEvents();
  return pool.length?pool[Math.floor(Math.random()*pool.length)]:null;
}

function ensureModal(){
  let modal=document.getElementById('choiceEventV242Modal');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.id='choiceEventV242Modal';
  modal.className='choice-v242-overlay';
  modal.hidden=true;
  modal.innerHTML=`
    <section class="choice-v242-modal">
      <div class="choice-v242-header">
        <span id="choiceV242Icon">⚖️</span>
        <div><p class="eyebrow">Décision du mois</p><h2 id="choiceV242Title">—</h2></div>
      </div>
      <p id="choiceV242Text" class="choice-v242-text">—</p>
      <div id="choiceV242Choices" class="choice-v242-choices"></div>
      <div class="choice-v242-note">Les conséquences sont affichées avant ton choix. Il n’existe pas toujours une seule bonne réponse.</div>
    </section>`;
  document.body.appendChild(modal);
  return modal;
}

let activeEvent=null;
let resolvingChoice=false;

function openEvent(evt){
  if(!evt)return;
  activeEvent=evt;
  const modal=ensureModal();
  modal.querySelector('#choiceV242Icon').textContent=evt.icon;
  modal.querySelector('#choiceV242Title').textContent=evt.title;
  modal.querySelector('#choiceV242Text').textContent=evt.text;
  const host=modal.querySelector('#choiceV242Choices');
  host.innerHTML='';
  evt.choices.forEach((c,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='choice-v242-option';
    b.dataset.choiceIndex=String(i);
    b.innerHTML=`<strong>${c.label}</strong><small>${typeof c.desc==='function'?c.desc():c.desc}</small>`;
    host.appendChild(b);
  });
  modal.hidden=false;
  modal.removeAttribute('aria-hidden');
}

function recordChoice(evt,choice,cashDelta,happinessDelta){
  const label=`${evt.icon} ${evt.title} — ${choice.label}`;
  try{
    const rec=window.PatrimoineReportingV219?.record;
    if(typeof rec==='function'){
      if(cashDelta<0){
        rec('event_expense',label,Math.abs(cashDelta),{
          cashImpact:cashDelta,
          includedInExpenses:true,
          detail:`Décision joueur • bonheur ${happinessDelta>=0?'+':''}${happinessDelta}`
        });
      }else if(cashDelta>0){
        rec('event_income',label,cashDelta,{
          cashImpact:cashDelta,
          detail:`Décision joueur • bonheur ${happinessDelta>=0?'+':''}${happinessDelta}`
        });
      }else{
        rec('event',label,0,{
          cashImpact:0,
          detail:`Décision joueur • bonheur ${happinessDelta>=0?'+':''}${happinessDelta}`
        });
      }
    }
  }catch(_){}

  /* Les décisions V2.4 sont hors du cycle mensuel natif : sans cette
     ventilation, la trésorerie bouge mais le bilan annuel ne voit pas
     forcément la dépense ou la rentrée d'argent. */
  if(state.yearStats && typeof state.yearStats==='object'){
    state.yearStats.events=N(state.yearStats.events)+1;

    if(cashDelta<0){
      const amount=Math.abs(cashDelta);
      state.yearStats.expenses=N(state.yearStats.expenses)+amount;
      state.yearStats.eventCost=N(state.yearStats.eventCost)+amount;
    }else if(cashDelta>0){
      state.yearStats.income=N(state.yearStats.income)+cashDelta;
    }
  }
}

function resolveChoice(evt,c,index){
  if(resolvingChoice || !evt || !c) return;
  resolvingChoice=true;

  /* Libère immédiatement l'interface : même si un effet secondaire échoue,
     le joueur ne peut plus rester prisonnier de la fenêtre de décision. */
  const modal=ensureModal();
  modal.hidden=true;
  modal.setAttribute('aria-hidden','true');
  modal.querySelectorAll('.choice-v242-option').forEach(b=>b.disabled=true);

  const beforeCash=N(state.cash);
  const beforeHappiness=N(state.wellbeing);
  let cashDelta=0;
  let happinessDelta=0;
  let careerResult='';
  let directInvestmentAmount=0;
  let grossChoiceIncome=0;
  let explicitChoiceExpense=0;

  try{
    cashDelta=typeof c.cash==='function'?N(c.cash()):N(c.cash);
    happinessDelta=N(c.happy);
    grossChoiceIncome=c.grossIncome?Math.max(0,N(c.grossIncome())):0;
    explicitChoiceExpense=c.choiceExpense?Math.max(0,N(c.choiceExpense())):0;

    state.cash=beforeCash+cashDelta;
    state.wellbeing=clamp(beforeHappiness+happinessDelta,0,100);

    if(c.pea){
      const amount=Math.max(0,N(c.pea()));
      directInvestmentAmount=amount;
      if(amount>0){
        /* La prime est un nouveau capital, pas un gain de marché.
           On l'inscrit donc dans la base et dans l'historique de contributions. */
        if(!state.tax) state.tax={};
        if(!state.basis) state.basis={};

        state.pea=N(state.pea)+amount;
        state.basis.pea=N(state.basis.pea)+amount;
        state.tax.peaContributions=N(state.tax.peaContributions)+amount;

        try{
          const h=window.PerformanceDashboardV217?.history?.();
          if(h?.assets?.pea){
            h.assets.pea.contributions=N(h.assets.pea.contributions)+amount;
          }
        }catch(_){}
      }
    }

    if(c.livingMonthly){
      const d=N(c.livingMonthly());
      const gf=ensureState();
      const idx=Math.max(.01,N(state.priceIndex)||1);
      gf.livingAdjustmentBase=N(gf.livingAdjustmentBase)+(d/idx);
      state.living=Math.max(0,N(state.living)+d);
    }

    if(c.careerChance && Math.random()<N(c.careerChance)){
      const old=N(state.salary);
      const gain=Math.max(20,Math.round(old*.025));
      state.salary=old+gain;
      careerResult=` • salaire +${EUR(gain)}/mois`;
    }

    const gf=ensureState();
    gf.resolved++;
    gf.lastMonth=N(state.totalMonths);
    gf.seen.push(evt.id);
    gf.seen=gf.seen.slice(-12);
    gf.nextMonth=N(state.totalMonths)+ri(4,7);

    const cashText=cashDelta===0?'0 €':`${cashDelta>0?'+':''}${EUR(cashDelta)}`;
    state.lastEvent=`${evt.icon} ${c.label} : ${cashText}, bonheur ${happinessDelta>=0?'+':''}${happinessDelta}${careerResult}.`;

    try{if(typeof addHistory==='function') addHistory(state.lastEvent);}catch(_){}
    if(directInvestmentAmount>0){
      try{
        const rec=window.PatrimoineReportingV219?.record;
        const label=`${evt.icon} ${evt.title} — ${c.label}`;
        if(typeof rec==='function'){
          rec('event_income',label,directInvestmentAmount,{
            cashImpact:0,
            detail:`Prime investie directement sur le PEA • bonheur ${happinessDelta>=0?'+':''}${happinessDelta}`
          });
          rec('investment',`${label} • PEA`,directInvestmentAmount,{
            cashImpact:0,
            detail:'Versement issu d’une prime exceptionnelle'
          });
        }
      }catch(_){}

      if(state.yearStats && typeof state.yearStats==='object'){
        state.yearStats.income=N(state.yearStats.income)+directInvestmentAmount;
        state.yearStats.investments=N(state.yearStats.investments)+directInvestmentAmount;
        state.yearStats.events=N(state.yearStats.events)+1;
      }
    }else if(grossChoiceIncome>0 || explicitChoiceExpense>0){
      const label=`${evt.icon} ${evt.title} — ${c.label}`;
      try{
        const rec=window.PatrimoineReportingV219?.record;
        if(typeof rec==='function'){
          if(grossChoiceIncome>0){
            rec('event_income',label,grossChoiceIncome,{
              cashImpact:cashDelta,
              detail:'Prime exceptionnelle reçue'
            });
          }
          if(explicitChoiceExpense>0){
            rec('event_expense',`${label} • dépense plaisir`,explicitChoiceExpense,{
              cashImpact:-explicitChoiceExpense,
              includedInExpenses:true,
              detail:`Arbitrage volontaire • bonheur ${happinessDelta>=0?'+':''}${happinessDelta}`
            });
          }
        }
      }catch(_){}

      if(state.yearStats && typeof state.yearStats==='object'){
        state.yearStats.events=N(state.yearStats.events)+1;
        state.yearStats.income=N(state.yearStats.income)+grossChoiceIncome;
        state.yearStats.expenses=N(state.yearStats.expenses)+explicitChoiceExpense;
        state.yearStats.eventCost=N(state.yearStats.eventCost)+explicitChoiceExpense;
      }
    }else{
      recordChoice(evt,c,cashDelta,happinessDelta);
    }

    activeEvent=null;

    try{if(typeof silentSave==='function') silentSave();}catch(_){}
    try{if(typeof render==='function') render();}catch(_){}
    try{window.ProgressionV240?.refresh?.();}catch(_){}
    try{window.GameFeelV241?.check?.();}catch(_){}

    showResult(
      evt,c,
      directInvestmentAmount>0?directInvestmentAmount:cashDelta,
      happinessDelta,
      careerResult,
      directInvestmentAmount>0
    );
  }catch(err){
    console.error('[ChoiceEvents V2.4.2.1] Erreur de résolution',err);

    /* En cas d'erreur avant application complète, on restaure au minimum
       les deux valeurs directement manipulées par tous les choix. */
    state.cash=beforeCash;
    state.wellbeing=beforeHappiness;
    activeEvent=null;

    showTechnicalFallback();
  }finally{
    resolvingChoice=false;
  }
}

function showTechnicalFallback(){
  let toast=document.getElementById('choiceV242Result');
  if(!toast){
    toast=document.createElement('div');
    toast.id='choiceV242Result';
    toast.className='choice-v242-result';
    document.body.appendChild(toast);
  }
  toast.innerHTML=`<div><span>⚠️</span><strong>Décision interrompue</strong></div>
    <p>La décision n’a pas été appliquée. Tu peux continuer la partie sans perte.</p>`;
  toast.classList.add('show');
  clearTimeout(showTechnicalFallback.t);
  showTechnicalFallback.t=setTimeout(()=>toast.classList.remove('show'),4200);
}

function showResult(evt,c,cashDelta,happinessDelta,careerResult,isDirectInvestment=false){
  let toast=document.getElementById('choiceV242Result');
  if(!toast){
    toast=document.createElement('div');
    toast.id='choiceV242Result';
    toast.className='choice-v242-result';
    document.body.appendChild(toast);
  }
  const money=isDirectInvestment
    ? `${EUR(cashDelta)} investis`
    : (cashDelta===0?'0 €':`${cashDelta>0?'+':''}${EUR(cashDelta)}`);
  toast.innerHTML=`
    <div><span>${evt.icon}</span><strong>${c.label}</strong></div>
    <p>${c.lesson}</p>
    <small>Impact : ${money} • bonheur ${happinessDelta>=0?'+':''}${happinessDelta}${careerResult||''}</small>`;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(showResult.t);
  showResult.t=setTimeout(()=>toast.classList.remove('show'),5200);
}

function shouldTrigger(){
  const s=ensureState();
  if(activeEvent)return false;
  if(state.gameOver)return false;
  if(N(state.totalMonths)<N(s.nextMonth))return false;
  if(N(state.totalMonths)-N(s.lastMonth)<3)return false;
  return true;
}

function maybeTrigger(){
  if(!shouldTrigger())return;
  const evt=pickEvent();
  if(evt) setTimeout(()=>openEvent(evt),180);
}

if(typeof nextMonth==='function'&&!nextMonth.__choiceV242){
  const coreNext=nextMonth;
  nextMonth=function(...args){
    const out=coreNext(...args);
    if(!state.gameOver) maybeTrigger();
    return out;
  };
  nextMonth.__choiceV242=true;
}

/* Les simulations multi-mois restent automatiques :
   aucun modal de décision ne bloque une simulation en cours. */

if(typeof applyLifestyle==='function'&&!applyLifestyle.__choiceV245){
  const coreApplyLifestyle=applyLifestyle;
  applyLifestyle=function(...args){
    const out=coreApplyLifestyle(...args);
    try{
      const gf=ensureState();
      const idx=Math.max(.01,N(state.priceIndex)||1);
      const adjustment=N(gf.livingAdjustmentBase)*idx;
      state.living=Math.max(0,N(state.living)+adjustment);
      try{if(typeof silentSave==='function')silentSave();}catch(_){}
      try{if(typeof render==='function')render();}catch(_){}
    }catch(_){}
    return out;
  };
  applyLifestyle.__choiceV245=true;
}

/* Délégation de clic robuste : évite que les handlers individuels soient
   perdus si le DOM est rafraîchi par les autres couches du jeu. */
document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('#choiceEventV242Modal .choice-v242-option');
  if(!btn || btn.disabled || !activeEvent) return;

  e.preventDefault();
  e.stopPropagation();

  const index=Math.max(0,Math.round(N(btn.dataset.choiceIndex)));
  const choice=activeEvent.choices?.[index];
  if(choice) resolveChoice(activeEvent,choice,index);
},true);

ensureState();
window.ChoiceEventsV242={
  version:VERSION,
  events:EVENTS,
  state:()=>ensureState(),
  trigger:()=>openEvent(pickEvent()),
  maybeTrigger
};
})();