(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;
if (typeof state === 'undefined') return;

const VERSION='2.4.1';
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const EUR=v=>typeof fmtEUR==='function'
  ? fmtEUR(v)
  : new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(N(v));

const safe=(fn,fallback=0)=>{try{return fn();}catch(_){return fallback;}};
const worth=()=>safe(()=>N(netWorth()),0);
const expenses=()=>Math.max(1,safe(()=>N(monthlyExpenses()),N(state.housing)+N(state.living)+N(state.transport)+N(state.leisure)));
const debts=()=>safe(()=>N(totalDebt()),N(state.homeDebt)+N(state.rentalDebt)+N(state.carDebt)+N(state.studentDebt)+N(state.consumerDebt));
const invested=()=>Math.max(0,N(state.livret))+Math.max(0,N(state.pea))+Math.max(0,N(state.assurance))+Math.max(0,N(state.cto))+Math.max(0,N(state.crypto));
const liquid=()=>Math.max(0,N(state.cash))+Math.max(0,N(state.livret));

function ensureState(){
  if(!state.gameFeelV241 || state.gameFeelV241.schema!==241){
    const previous=state.gameFeelV241||{};
    state.gameFeelV241={
      schema:241,
      unlocked:previous.unlocked&&typeof previous.unlocked==='object'?previous.unlocked:{},
      firstWorth:Number.isFinite(Number(previous.firstWorth))?N(previous.firstWorth):worth(),
      bestScore:Math.max(0,N(previous.bestScore)),
      completedObjectives:Math.max(0,N(previous.completedObjectives))
    };
  }
  return state.gameFeelV241;
}

const MILESTONES=[
  {id:'cash-positive',icon:'💶',title:'Dans le vert',desc:'Ta trésorerie est positive.',test:()=>N(state.cash)>0},
  {id:'safety-1',icon:'🛟',title:'Premier filet de sécurité',desc:'Tu disposes d’au moins 1 mois de dépenses en liquidités.',test:()=>liquid()>=expenses()},
  {id:'safety-3',icon:'🛡️',title:'Matelas de sécurité',desc:'Tu disposes d’au moins 3 mois de dépenses en liquidités.',test:()=>liquid()>=expenses()*3},
  {id:'invest-1k',icon:'🌱',title:'Premier millier investi',desc:'Tes placements ont franchi 1 000 €.',test:()=>invested()>=1000},
  {id:'invest-10k',icon:'📈',title:'Investisseur régulier',desc:'Tes placements ont franchi 10 000 €.',test:()=>invested()>=10000},
  {id:'worth-10k',icon:'🧱',title:'Patrimoine à cinq chiffres',desc:'Ton patrimoine net dépasse 10 000 €.',test:()=>worth()>=10000},
  {id:'worth-50k',icon:'🏗️',title:'Bâtisseur de patrimoine',desc:'Ton patrimoine net dépasse 50 000 €.',test:()=>worth()>=50000},
  {id:'worth-100k',icon:'🏆',title:'Cap des 100 000 €',desc:'Ton patrimoine net dépasse 100 000 €.',test:()=>worth()>=100000},
  {id:'no-debt',icon:'🔓',title:'Libre de dettes',desc:'Tu n’as plus aucune dette en cours.',test:()=>N(state.totalMonths)>0&&debts()<=1},
  {id:'home-owner',icon:'🏠',title:'Propriétaire',desc:'Tu as acquis ta résidence principale.',test:()=>N(state.homeValue)>0},
  {id:'rental-owner',icon:'🏢',title:'Investisseur immobilier',desc:'Tu as acquis un bien locatif.',test:()=>N(state.rentalValue)>0},
  {id:'wellbeing-85',icon:'❤️',title:'Équilibre préservé',desc:'Ton bonheur atteint au moins 85/100.',test:()=>N(state.wellbeing)>=85},
  {id:'score-70',icon:'🌟',title:'Gestionnaire averti',desc:'Ton score financier atteint 70/100.',test:()=>safe(()=>N(window.ProgressionV240?.score?.()?.total),0)>=70},
  {id:'score-85',icon:'🥇',title:'Gestion très solide',desc:'Ton score financier atteint 85/100.',test:()=>safe(()=>N(window.ProgressionV240?.score?.()?.total),0)>=85}
];

function unlockedList(){
  const u=ensureState().unlocked;
  return MILESTONES.filter(m=>u[m.id]);
}

function showToast(m){
  let toast=document.getElementById('gameFeelV241Toast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='gameFeelV241Toast';
    toast.className='gamefeel-v241-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML=`<span>${m.icon}</span><div><small>Jalon débloqué</small><strong>${m.title}</strong><p>${m.desc}</p></div>`;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t=setTimeout(()=>toast.classList.remove('show'),3600);
}

function checkMilestones({silent=false}={}){
  const gf=ensureState();
  const newly=[];
  for(const m of MILESTONES){
    if(gf.unlocked[m.id]) continue;
    if(safe(()=>!!m.test(),false)){
      gf.unlocked[m.id]={month:N(state.totalMonths),year:N(state.year),at:Date.now()};
      newly.push(m);
    }
  }
  const sc=safe(()=>N(window.ProgressionV240?.score?.()?.total),0);
  gf.bestScore=Math.max(gf.bestScore,sc);
  if(newly.length&&!silent){
    newly.forEach((m,i)=>setTimeout(()=>showToast(m),i*3900));
  }
  try{if(typeof silentSave==='function')silentSave();}catch(_){}
  renderMilestoneStrip();
  return newly;
}

function ensureMilestoneStrip(){
  const card=document.getElementById('progressionV240');
  if(!card)return null;
  let strip=document.getElementById('gameFeelV241Milestones');
  if(strip)return strip;
  strip=document.createElement('div');
  strip.id='gameFeelV241Milestones';
  strip.className='gamefeel-v241-milestones';
  card.appendChild(strip);
  return strip;
}

function renderMilestoneStrip(){
  const strip=ensureMilestoneStrip();
  if(!strip)return;
  const unlocked=unlockedList();
  const latest=unlocked.slice(-5);
  strip.innerHTML=`
    <div class="gamefeel-v241-milestone-head">
      <div><strong>🏅 Jalons</strong><small>${unlocked.length}/${MILESTONES.length} débloqués</small></div>
      <button type="button" id="gameFeelV241AllBtn">${unlocked.length?'Voir les succès':'Découvrir les succès'}</button>
    </div>
    <div class="gamefeel-v241-badges">
      ${latest.length
        ? latest.map(m=>`<span title="${m.desc}">${m.icon}<small>${m.title}</small></span>`).join('')
        : '<em>Continue à jouer : tes premiers jalons apparaîtront ici.</em>'}
    </div>`;
  strip.querySelector('#gameFeelV241AllBtn')?.addEventListener('click',showAchievementsModal);
}

function ensureAchievementsModal(){
  let modal=document.getElementById('gameFeelV241AchievementsModal');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.id='gameFeelV241AchievementsModal';
  modal.className='gamefeel-v241-overlay';
  modal.hidden=true;
  modal.innerHTML=`
    <section class="gamefeel-v241-modal">
      <button type="button" class="gamefeel-v241-close" aria-label="Fermer">×</button>
      <p class="eyebrow">Progression de partie</p>
      <h2>🏅 Tes jalons</h2>
      <p class="gamefeel-v241-modal-intro">Ces succès récompensent plusieurs styles de gestion. Ils ne t’obligent pas à suivre une stratégie unique.</p>
      <div id="gameFeelV241AchievementGrid" class="gamefeel-v241-achievement-grid"></div>
    </section>`;
  document.body.appendChild(modal);
  modal.querySelector('.gamefeel-v241-close').onclick=()=>modal.hidden=true;
  modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true;});
  return modal;
}

function showAchievementsModal(){
  const modal=ensureAchievementsModal();
  const grid=modal.querySelector('#gameFeelV241AchievementGrid');
  const u=ensureState().unlocked;
  grid.innerHTML=MILESTONES.map(m=>{
    const done=!!u[m.id];
    return `<article class="${done?'done':'locked'}">
      <span>${done?m.icon:'🔒'}</span>
      <div><strong>${m.title}</strong><small>${m.desc}</small></div>
    </article>`;
  }).join('');
  modal.hidden=false;
}

function cumulative(type){
  try{
    const entries=window.PatrimoineReportingV219?.journal?.()?.entries||[];
    return entries.filter(e=>e.type===type).reduce((s,e)=>s+N(e.amount),0);
  }catch(_){return 0;}
}
function cumulativeMany(types){
  try{
    const set=new Set(types);
    const entries=window.PatrimoineReportingV219?.journal?.()?.entries||[];
    return entries.filter(e=>set.has(e.type)).reduce((s,e)=>s+N(e.amount),0);
  }catch(_){return 0;}
}

function profile(sc){
  const dims=[
    ['Résilient',sc.resilience],
    ['Maître des dettes',sc.dettes],
    ['Bâtisseur',sc.patrimoine],
    ['Optimisateur',sc.efficacite],
    ['Équilibré',sc.qualite]
  ].sort((a,b)=>b[1]-a[1]);
  return dims[0][0];
}

function ensureEndSummary(){
  const modal=document.getElementById('endModal');
  if(!modal)return null;
  const host=modal.querySelector('.modal-card')||modal;
  let box=document.getElementById('gameFeelV241EndSummary');
  if(box)return box;
  box=document.createElement('div');
  box.id='gameFeelV241EndSummary';
  box.className='gamefeel-v241-end-summary';
  const continueBtn=document.getElementById('continueAfterWinBtn');
  if(continueBtn)host.insertBefore(box,continueBtn);
  else host.appendChild(box);
  return box;
}

function renderEndSummary(){
  const box=ensureEndSummary();
  if(!box)return;
  const sc=safe(()=>window.ProgressionV240?.score?.(),null);
  if(!sc)return;
  const gf=ensureState();
  const start=N(gf.firstWorth);
  const end=worth();
  const delta=end-start;
  const months=Math.max(0,N(state.totalMonths));
  const perf=safe(()=>window.PerformanceDashboardV217?.compute?.(),null);
  const fees=cumulative('fee');
  const bankFees=cumulative('bank_fee');
  const interest=cumulative('interest');
  const taxes=Math.max(0,cumulative('tax')-cumulative('tax_refund'));
  const unlocked=unlockedList();

  box.innerHTML=`
    <div class="gamefeel-v241-end-hero">
      <div><span>Score final</span><strong>${sc.total}/100</strong><small>${profile(sc)}</small></div>
      <div><span>Patrimoine net</span><strong>${EUR(end)}</strong><small class="${delta>=0?'positive':'negative'}">${delta>=0?'+':''}${EUR(delta)} depuis le début du suivi</small></div>
      <div><span>Durée</span><strong>${months} mois</strong><small>${unlocked.length} jalon${unlocked.length>1?'s':''} débloqué${unlocked.length>1?'s':''}</small></div>
    </div>
    <div class="gamefeel-v241-end-grid">
      <div><span>Performance placements</span><strong class="${N(perf?.totalPerf)>=0?'positive':'negative'}">${N(perf?.totalPerf)>=0?'+':''}${EUR(perf?.totalPerf||0)}</strong></div>
      <div><span>Intérêts des crédits</span><strong>${EUR(interest)}</strong></div>
      <div><span>Frais bancaires</span><strong>${EUR(bankFees)}</strong></div>
      <div><span>Frais des placements</span><strong>${EUR(fees)}</strong></div>
      <div><span>Impôts suivis</span><strong>${EUR(taxes)}</strong></div>
      <div><span>Bonheur final</span><strong>${Math.round(N(state.wellbeing))}/100</strong></div>
    </div>
    <div class="gamefeel-v241-end-score">
      <div><span>Patrimoine</span><strong>${sc.patrimoine}</strong></div>
      <div><span>Résilience</span><strong>${sc.resilience}</strong></div>
      <div><span>Dettes</span><strong>${sc.dettes}</strong></div>
      <div><span>Efficacité</span><strong>${sc.efficacite}</strong></div>
      <div><span>Qualité de vie</span><strong>${sc.qualite}</strong></div>
    </div>
    <p class="gamefeel-v241-end-note">Le score évalue l’équilibre global de ta situation, pas une allocation ou une stratégie imposée.</p>`;
}

if(typeof showEndModal==='function'&&!showEndModal.__gameFeelV241){
  const coreEnd=showEndModal;
  showEndModal=function(...args){
    const out=coreEnd(...args);
    setTimeout(()=>{
      checkMilestones({silent:true});
      renderEndSummary();
    },0);
    return out;
  };
  showEndModal.__gameFeelV241=true;
}

let lastObjectiveTitle='';
function trackObjectiveCompletion(){
  const o=safe(()=>window.ProgressionV240?.objective?.(),null);
  if(!o)return;
  if(lastObjectiveTitle&&o.title!==lastObjectiveTitle){
    ensureState().completedObjectives++;
  }
  lastObjectiveTitle=o.title;
}

function refresh(){
  ensureState();
  trackObjectiveCompletion();
  checkMilestones();
  renderMilestoneStrip();
}

function boot(){
  // Existing saves should not trigger a flood of celebratory toasts on first load.
  const firstInstall=!state.gameFeelV241;
  ensureState();
  if(firstInstall)checkMilestones({silent:true});
  else checkMilestones({silent:false});
  renderMilestoneStrip();

  const observer=new MutationObserver(()=>{
    clearTimeout(boot.t);
    boot.t=setTimeout(refresh,90);
  });
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

window.GameFeelV241={
  version:VERSION,
  milestones:MILESTONES,
  unlocked:unlockedList,
  check:checkMilestones,
  renderEndSummary
};
})();