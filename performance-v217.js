(() => {
'use strict';
if (typeof state === 'undefined' || typeof render !== 'function') return;

const VERSION='2.3.1';
const FINANCIAL_ASSETS=['livret','pea','assurance','cto','crypto'];
const LABEL={livret:'Livret',pea:'PEA World',assurance:'Assurance-vie',cto:'CTO',crypto:'Crypto'};
const ICON={livret:'🛟',pea:'🌍',assurance:'🧱',cto:'📈',crypto:'₿'};
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const EUR=v=>typeof fmtEUR==='function'?fmtEUR(v):new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(N(v));
const PCT=v=>v==null||!Number.isFinite(Number(v))?'—':`${Number(v)>0?'+':''}${Number(v).toFixed(Math.abs(Number(v))<1?2:1).replace('.',',')} %`;
const signedEUR=v=>`${N(v)>0?'+':''}${EUR(v)}`;
const cls=v=>v>0.005?'positive':v<-0.005?'negative':'neutral';

function currentValue(a){
  if(a==='pea') return Math.max(0,N(state.pea))+Math.max(0,N(state.tax?.peaCash));
  return Math.max(0,N(state[a]));
}
function referenceCapital(a){
  if(a==='pea') return Math.max(0,N(state.tax?.peaContributions)||N(state.basis?.pea));
  return Math.max(0,N(state.basis?.[a]));
}
function ensureHistory(){
  if(!state.performanceHistory||state.performanceHistory.schema!==2){
    const old=state.performanceHistory?.assets||{};
    const assets={};
    FINANCIAL_ASSETS.forEach(a=>assets[a]={
      contributions:Math.max(0,N(old[a]?.contributions)||referenceCapital(a)),
      withdrawals:Math.max(0,N(old[a]?.withdrawals))
    });
    const isLegacy=N(state.totalMonths)>0||FINANCIAL_ASSETS.some(a=>currentValue(a)>0.005||referenceCapital(a)>0.005);
    state.performanceHistory={schema:2,assets,migratedFromLegacy:!!state.performanceHistory?.migratedFromLegacy||isLegacy,createdMonth:N(state.performanceHistory?.createdMonth??state.totalMonths)};
  }
  FINANCIAL_ASSETS.forEach(a=>{
    state.performanceHistory.assets[a] ||= {contributions:referenceCapital(a),withdrawals:0};
    state.performanceHistory.assets[a].contributions=Math.max(0,N(state.performanceHistory.assets[a].contributions));
    state.performanceHistory.assets[a].withdrawals=Math.max(0,N(state.performanceHistory.assets[a].withdrawals));
  });
  return state.performanceHistory;
}
function snap(){
  return {
    values:Object.fromEntries(FINANCIAL_ASSETS.map(a=>[a,currentValue(a)])),
    basis:Object.fromEntries(FINANCIAL_ASSETS.map(a=>[a,Math.max(0,N(state.basis?.[a]))])),
    peaContrib:Math.max(0,N(state.tax?.peaContributions)),
    fees:Math.max(0,N(state.market?.fees?.total))
  };
}
function addContribution(a,amount){if(amount>0.005)ensureHistory().assets[a].contributions+=amount;}
function addWithdrawal(a,amount){if(amount>0.005)ensureHistory().assets[a].withdrawals+=amount;}
function trackContributionDelta(before,after){
  FINANCIAL_ASSETS.forEach(a=>{
    const d=a==='pea'?after.peaContrib-before.peaContrib:after.basis[a]-before.basis[a];
    if(d>0.005)addContribution(a,d);
  });
}
function compute(){
  const h=ensureHistory();
  const rows=FINANCIAL_ASSETS.map(a=>{
    const value=currentValue(a),contributions=h.assets[a].contributions,withdrawals=h.assets[a].withdrawals;
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
    ensureHistory();const before=snap();const out=core(asset,direction);const after=snap();
    if(direction==='in')trackContributionDelta(before,after);
    if(direction==='out'&&asset==='livret')addWithdrawal('livret',Math.max(0,before.values.livret-after.values.livret));
    return out;
  };
  moveAsset.__perf218=true;
}
if(typeof applyAutoInvestments==='function'&&!applyAutoInvestments.__perf218){
  const coreAuto=applyAutoInvestments;
  applyAutoInvestments=function(){const before=snap();const out=coreAuto();trackContributionDelta(before,snap());return out;};
  applyAutoInvestments.__perf218=true;
}

document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('#taxConfirmBtn');if(!btn)return;
  const title=document.getElementById('taxConfirmTitle')?.textContent||'';
  const before=snap();
  setTimeout(()=>{
    const after=snap(),feeDelta=Math.max(0,after.fees-before.fees);
    if(/assurance-vie/i.test(title))addWithdrawal('assurance',Math.max(0,before.values.assurance-after.values.assurance));
    else if(/Vente CTO/i.test(title))addWithdrawal('cto',Math.max(0,before.values.cto-after.values.cto-feeDelta));
    else if(/Vente crypto/i.test(title))addWithdrawal('crypto',Math.max(0,before.values.crypto-after.values.crypto-feeDelta));
    else if(/Retrait du PEA|Clôturer le PEA/i.test(title))addWithdrawal('pea',Math.max(0,before.values.pea-after.values.pea));
    renderPerformance();
  },0);
},true);

function rentalData(){
  const value=Math.max(0,N(state.rentalValue));
  if(value<=0.005)return null;
  return {
    key:'rental',label:'Immobilier locatif',icon:'🏢',value,
    note:'Valeur actuelle du patrimoine locatif'
  };
}
function findHost(){
  const main=document.querySelector('.main-column');if(!main)return null;
  const firstDashboard=[...main.children].find(el=>el.dataset.pcPanel==='dashboard');
  if(firstDashboard)return {parent:main,before:firstDashboard.nextElementSibling};
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
  if(card){applyDashboardVisibility(card);return card;}
  const host=findHost();if(!host)return null;
  card=document.createElement('section');
  card.id='performanceDashboardV217';
  card.className='card section-card performance-v217-card';
  applyDashboardVisibility(card);
  card.innerHTML=`
    <div class="performance-v217-head">
      <div><p class="eyebrow">Depuis le début de la partie</p><h3>📊 Performance de tes placements</h3>
      <p class="performance-v217-sub">Valeur actuelle et performance cumulée. Les versements historiques restent utilisés uniquement pour calculer correctement la performance.</p></div>
      <button type="button" class="performance-v217-info" aria-label="Comprendre la performance">?</button>
    </div>
    <div class="performance-v217-hero">
      <div><span>Performance totale</span><strong id="perfV217Total">—</strong><small id="perfV217TotalPct">—</small></div>
      <div><span>Capital total actuel</span><strong id="perfV217Capital">—</strong><small>Somme actuellement présente dans les poches d’investissement</small></div>
      <div><span>Placements financiers actuels</span><strong id="perfV217Value">—</strong><small>Livret, PEA, assurance-vie, CTO et crypto</small></div>
    </div>
    <div id="performanceV217Rows" class="performance-v217-rows"></div>
    <div id="performanceV217Rental" class="performance-v217-rental"></div>
    <div id="performanceV217Lesson" class="performance-v217-lesson"></div>
    <div id="performanceV217Help" class="performance-v217-help" hidden>
      <strong>Comment est calculée la performance ?</strong>
      <p><b>Performance = valeur actuelle + retraits cumulés − capital historiquement versé.</b></p>
      <p>Le capital historiquement versé n’est plus affiché dans les cartes, mais il reste conservé en interne pour éviter de confondre versements et gains.</p>
      <p>L’immobilier locatif est affiché séparément avec sa valeur actuelle. Aucun pourcentage de performance locative n’est inventé tant que le moteur ne suit pas une base de coût et les flux locatifs complets.</p>
    </div>`;
  host.parent.insertBefore(card,host.before);
  card.querySelector('.performance-v217-info').onclick=()=>{
    const h=card.querySelector('#performanceV217Help');h.hidden=!h.hidden;
  };
  return card;
}
function renderPerformance(){
  const card=buildCard();if(!card)return;
  applyDashboardVisibility(card);
  const d=compute(), rental=rentalData();
  const totalCurrent=d.totalValue+(rental?.value||0);

  const total=card.querySelector('#perfV217Total');
  total.textContent=signedEUR(d.totalPerf);total.className=cls(d.totalPerf);
  const pc=card.querySelector('#perfV217TotalPct');
  pc.textContent=PCT(d.totalPct);pc.className=cls(d.totalPerf);

  card.querySelector('#perfV217Capital').textContent=EUR(totalCurrent);
  card.querySelector('#perfV217Value').textContent=EUR(d.totalValue);

  card.querySelector('#performanceV217Rows').innerHTML=d.rows.map(r=>`
    <div class="performance-v217-row">
      <div class="performance-v217-label"><span>${r.icon}</span><strong>${r.label}</strong></div>
      <div><span>Capital actuel</span><strong>${EUR(r.value)}</strong></div>
      <div><span>Performance</span><strong class="${cls(r.perf)}">${signedEUR(r.perf)} <small>${PCT(r.pct)}</small></strong></div>
    </div>`).join('');

  const rentalHost=card.querySelector('#performanceV217Rental');
  rentalHost.innerHTML=rental?`
    <div class="performance-v217-row performance-v217-rental-row">
      <div class="performance-v217-label"><span>${rental.icon}</span><strong>${rental.label}</strong></div>
      <div><span>Capital actuel</span><strong>${EUR(rental.value)}</strong></div>
      <div><span>Suivi</span><strong>Valeur patrimoniale</strong></div>
    </div>`:'';

  const lesson=card.querySelector('#performanceV217Lesson');
  lesson.innerHTML=state.performanceHistory?.migratedFromLegacy
    ?'<strong>🎓 À retenir</strong><span>Ancienne sauvegarde détectée : le suivi est exact à partir de cette version. Les retraits antérieurs ne peuvent pas être reconstitués.</span>'
    :`<strong>🎓 À retenir</strong><span>Performance financière cumulée : <b class="${cls(d.totalPerf)}">${signedEUR(d.totalPerf)}</b> (${PCT(d.totalPct)}). L’immobilier locatif est présenté séparément tant que son rendement complet n’est pas calculé.</span>`;
}
function enhanceEventText(){document.getElementById('eventText')?.classList.add('event-text-readable-v217');}

const coreRender=render;
render=function(){
  const result=coreRender();
  ensureHistory();renderPerformance();enhanceEventText();
  return result;
};
ensureHistory();renderPerformance();enhanceEventText();
window.PerformanceDashboardV217={version:VERSION,compute,history:()=>ensureHistory()};

(function loadReportingV219(){
  if(window.PatrimoineReportingV219||document.querySelector('script[data-reporting-v219]'))return;
  const s=document.createElement('script');
  s.src='./reporting-v219.js?v=231pc';
  s.dataset.reportingV219='1';
  document.head.appendChild(s);
})();
})();