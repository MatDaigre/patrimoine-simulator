(() => {
'use strict';
if (typeof state === 'undefined' || typeof render !== 'function') return;
const VERSION='2.1.8.1';
const ASSETS=['livret','pea','assurance','cto','crypto'];
const LABEL={livret:'Livret',pea:'PEA World',assurance:'Assurance-vie',cto:'CTO',crypto:'Crypto'};
const ICON={livret:'🛟',pea:'🌍',assurance:'🧱',cto:'📈',crypto:'₿'};
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const EUR=v=>typeof fmtEUR==='function'?fmtEUR(v):new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(N(v));
const PCT=v=>v==null||!Number.isFinite(Number(v))?'—':`${Number(v)>0?'+':''}${Number(v).toFixed(Math.abs(Number(v))<1?2:1).replace('.',',')} %`;
const signedEUR=v=>`${N(v)>0?'+':''}${EUR(v)}`;
const cls=v=>v>0.005?'positive':v<-0.005?'negative':'neutral';

function currentValue(a){return a==='pea'?Math.max(0,N(state.pea))+Math.max(0,N(state.tax?.peaCash)):Math.max(0,N(state[a]));}
function referenceCapital(a){return a==='pea'?Math.max(0,N(state.tax?.peaContributions)||N(state.basis?.pea)):Math.max(0,N(state.basis?.[a]));}
function ensureHistory(){
  if(!state.performanceHistory||state.performanceHistory.schema!==2){
    const assets={};
    ASSETS.forEach(a=>assets[a]={contributions:referenceCapital(a),withdrawals:0});
    state.performanceHistory={schema:2,assets,migratedFromLegacy:true,createdMonth:N(state.totalMonths)};
  }
  ASSETS.forEach(a=>{
    state.performanceHistory.assets[a] ||= {contributions:referenceCapital(a),withdrawals:0};
    state.performanceHistory.assets[a].contributions=Math.max(0,N(state.performanceHistory.assets[a].contributions));
    state.performanceHistory.assets[a].withdrawals=Math.max(0,N(state.performanceHistory.assets[a].withdrawals));
  });
  return state.performanceHistory;
}
function snap(){
  return {
    values:Object.fromEntries(ASSETS.map(a=>[a,currentValue(a)])),
    basis:Object.fromEntries(ASSETS.map(a=>[a,Math.max(0,N(state.basis?.[a]))])),
    peaContrib:Math.max(0,N(state.tax?.peaContributions)),
    fees:Math.max(0,N(state.market?.fees?.total))
  };
}
function addContribution(a,amount){if(amount>0.005)ensureHistory().assets[a].contributions+=amount;}
function addWithdrawal(a,amount){if(amount>0.005)ensureHistory().assets[a].withdrawals+=amount;}
function trackContributionDelta(before,after){
  ASSETS.forEach(a=>{
    const d=a==='pea'?after.peaContrib-before.peaContrib:after.basis[a]-before.basis[a];
    if(d>0.005)addContribution(a,d);
  });
}
function compute(){
  const h=ensureHistory();
  const rows=ASSETS.map(a=>{
    const value=currentValue(a), contributions=h.assets[a].contributions, withdrawals=h.assets[a].withdrawals;
    const perf=value+withdrawals-contributions;
    return {key:a,label:LABEL[a],icon:ICON[a],value,capital:contributions,withdrawals,perf,pct:contributions>0?perf/contributions*100:null};
  });
  const totalCapital=rows.reduce((s,r)=>s+r.capital,0);
  const totalValue=rows.reduce((s,r)=>s+r.value,0);
  const totalWithdrawals=rows.reduce((s,r)=>s+r.withdrawals,0);
  const totalPerf=rows.reduce((s,r)=>s+r.perf,0);
  return {rows,totalCapital,totalValue,totalWithdrawals,totalPerf,totalPct:totalCapital>0?totalPerf/totalCapital*100:null};
}

if(typeof moveAsset==='function'&&!moveAsset.__perf218){
  const core=moveAsset;
  moveAsset=function(asset,direction){
    ensureHistory();
    const before=snap();
    const out=core(asset,direction);
    const after=snap();
    if(direction==='in') trackContributionDelta(before,after);
    if(direction==='out'&&asset==='livret') addWithdrawal('livret',Math.max(0,before.values.livret-after.values.livret));
    return out;
  };
  moveAsset.__perf218=true;
}
if(typeof applyAutoInvestments==='function'&&!applyAutoInvestments.__perf218){
  const coreAuto=applyAutoInvestments;
  applyAutoInvestments=function(){
    const before=snap();
    const out=coreAuto();
    trackContributionDelta(before,snap());
    return out;
  };
  applyAutoInvestments.__perf218=true;
}

document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('#taxConfirmBtn');
  if(!btn)return;
  const title=document.getElementById('taxConfirmTitle')?.textContent||'';
  const before=snap();
  setTimeout(()=>{
    const after=snap();
    const feeDelta=Math.max(0,after.fees-before.fees);
    if(/assurance-vie/i.test(title)) addWithdrawal('assurance',Math.max(0,before.values.assurance-after.values.assurance));
    else if(/Vente CTO/i.test(title)) addWithdrawal('cto',Math.max(0,before.values.cto-after.values.cto-feeDelta));
    else if(/Vente crypto/i.test(title)) addWithdrawal('crypto',Math.max(0,before.values.crypto-after.values.crypto-feeDelta));
    else if(/Retrait du PEA|Clôturer le PEA/i.test(title)) addWithdrawal('pea',Math.max(0,before.values.pea-after.values.pea));
    renderPerformance();
  },0);
},true);

function findHost(){
  const main=document.querySelector('.main-column');
  if(!main)return null;

  // Prefer the first dashboard card so the performance block is always
  // a Tableau de bord element, never an investment-tab element.
  const firstDashboard=[...main.children].find(el=>el.dataset.pcPanel==='dashboard');
  if(firstDashboard)return {parent:main,before:firstDashboard.nextElementSibling};

  // Fallback before the investment card if tabs are not initialized yet.
  const invest=main.querySelector('.invest-card');
  return {parent:main,before:invest||main.firstElementChild};
}

function applyDashboardVisibility(card){
  card.dataset.pcPanel='dashboard';
  const active=document.documentElement.dataset.pcActiveTab||'dashboard';
  const visible=active==='dashboard';
  card.classList.toggle('pc-tab-hidden-v211',!visible);
  card.setAttribute('aria-hidden',visible?'false':'true');
}

function buildCard(){
  let card=document.getElementById('performanceDashboardV217');
  if(card){
    applyDashboardVisibility(card);
    return card;
  }
  const host=findHost();
  if(!host)return null;

  card=document.createElement('section');
  card.id='performanceDashboardV217';
  card.className='card section-card performance-v217-card';
  applyDashboardVisibility(card);

  card.innerHTML=`<div class="performance-v217-head"><div><p class="eyebrow">Depuis le début de la partie</p><h3>📊 Performance de tes placements</h3><p class="performance-v217-sub">Gains et pertes cumulés, retraits inclus. Les nouveaux versements ne sont jamais comptés comme une performance.</p></div><button type="button" class="performance-v217-info" aria-label="Comprendre la performance">?</button></div><div class="performance-v217-hero"><div><span>Performance totale</span><strong id="perfV217Total">—</strong><small id="perfV217TotalPct">—</small></div><div><span>Capital versé</span><strong id="perfV217Capital">—</strong><small>Depuis le début</small></div><div><span>Valeur actuelle</span><strong id="perfV217Value">—</strong><small>Placements encore détenus</small></div></div><div id="performanceV217Rows" class="performance-v217-rows"></div><div id="performanceV217Lesson" class="performance-v217-lesson"></div><div id="performanceV217Help" class="performance-v217-help" hidden><strong>Comment est calculée la performance ?</strong><p><b>Performance = valeur actuelle + retraits cumulés − capital versé depuis le début.</b></p><p>Une vente suivie d’un retrait ne fait donc plus disparaître les gains déjà réalisés. Les transferts internes du PEA ne sont pas considérés comme de nouveaux versements.</p><p>Les impôts restent suivis séparément. Les frais de placement réduisent bien la performance.</p></div>`;

  host.parent.insertBefore(card,host.before);
  card.querySelector('.performance-v217-info').onclick=()=>{
    const h=card.querySelector('#performanceV217Help');
    h.hidden=!h.hidden;
  };
  return card;
}

function renderPerformance(){
  const card=buildCard();
  if(!card)return;
  applyDashboardVisibility(card);

  const d=compute();
  const total=card.querySelector('#perfV217Total');
  total.textContent=signedEUR(d.totalPerf);
  total.className=cls(d.totalPerf);

  const pct=card.querySelector('#perfV217TotalPct');
  pct.textContent=PCT(d.totalPct);
  pct.className=cls(d.totalPerf);

  card.querySelector('#perfV217Capital').textContent=EUR(d.totalCapital);
  card.querySelector('#perfV217Value').textContent=EUR(d.totalValue);

  card.querySelector('#performanceV217Rows').innerHTML=d.rows.map(r=>`<div class="performance-v217-row"><div class="performance-v217-label"><span>${r.icon}</span><strong>${r.label}</strong></div><div><span>Versé depuis le début</span><strong>${EUR(r.capital)}</strong></div><div><span>Valeur actuelle</span><strong>${EUR(r.value)}</strong></div><div><span>Performance</span><strong class="${cls(r.perf)}">${signedEUR(r.perf)} <small>${PCT(r.pct)}</small></strong></div></div>`).join('');

  const lesson=card.querySelector('#performanceV217Lesson');
  lesson.innerHTML=state.performanceHistory?.migratedFromLegacy
    ? '<strong>🎓 À retenir</strong><span>Ancienne sauvegarde détectée : le suivi est exact à partir de cette version. Les retraits effectués avant cette mise à jour ne peuvent pas être reconstitués.</span>'
    : `<strong>🎓 À retenir</strong><span>Performance cumulée : <b class="${cls(d.totalPerf)}">${signedEUR(d.totalPerf)}</b> (${PCT(d.totalPct)}), retraits réalisés inclus.</span>`;
}

function enhanceEventText(){
  document.getElementById('eventText')?.classList.add('event-text-readable-v217');
}

const coreRender=render;
render=function(){
  const result=coreRender();
  ensureHistory();
  renderPerformance();
  enhanceEventText();
  return result;
};

ensureHistory();
renderPerformance();
enhanceEventText();

window.PerformanceDashboardV217={
  version:VERSION,
  compute,
  history:()=>ensureHistory()
};
})();