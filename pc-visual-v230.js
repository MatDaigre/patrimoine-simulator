(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;

const VERSION='2.3.0';
const EUR=v=>typeof fmtEUR==='function'
  ? fmtEUR(v)
  : new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v)||0);

function perf(){
  try{return window.PerformanceDashboardV217?.compute?.()||null;}
  catch(_){return null;}
}
function pct(v){
  if(v==null||!Number.isFinite(Number(v)))return '—';
  const n=Number(v);
  return `${n>0?'+':''}${n.toFixed(Math.abs(n)<1?2:1).replace('.',',')} %`;
}
function cls(v){return Number(v)>0.005?'positive':Number(v)<-0.005?'negative':'neutral';}

function ensurePerfKpi(){
  const grid=document.querySelector('.stats-grid');
  if(!grid)return null;
  let card=document.getElementById('pcV230PerformanceKpi');
  if(!card){
    card=document.createElement('article');
    card.id='pcV230PerformanceKpi';
    card.className='stat pc-v230-performance-kpi';
    card.innerHTML=`
      <span>📈 Performance globale</span>
      <strong id="pcV230PerfAmount">—</strong>
      <small id="pcV230PerfPct">Depuis le début</small>
      <div class="pc-v230-sparkline" aria-hidden="true">
        <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
      </div>`;
    grid.appendChild(card);
  }
  return card;
}

function refreshKpi(){
  const card=ensurePerfKpi();
  const d=perf();
  if(!card||!d)return;
  const amount=card.querySelector('#pcV230PerfAmount');
  const pc=card.querySelector('#pcV230PerfPct');
  amount.textContent=`${d.totalPerf>0?'+':''}${EUR(d.totalPerf)}`;
  amount.className=cls(d.totalPerf);
  pc.textContent=`${pct(d.totalPct)} • depuis le début`;
  pc.className=cls(d.totalPerf);
}

function refineHero(){
  const hero=document.querySelector('.hero');
  if(!hero)return;
  hero.classList.add('pc-v230-hero');
  const h2=hero.querySelector('h2');
  if(h2&&!h2.dataset.v230){
    h2.dataset.v230='1';
    h2.textContent='Pilote ton patrimoine, un mois après l’autre.';
  }
}

function tagCards(){
  document.querySelector('.budget-card')?.classList.add('pc-v230-budget');
  document.querySelector('.invest-card')?.classList.add('pc-v230-invest');
  document.querySelector('.journey-card')?.classList.add('pc-v230-objectives');
  document.querySelector('.health-card')?.classList.add('pc-v230-health');
  document.getElementById('performanceDashboardV217')?.classList.add('pc-v230-performance');
}

function repairReporting(){
  document.querySelectorAll('.reporting-v219-block,.reporting-v219-cumulative,#reportingCumulativeV219')
    .forEach(el=>el.classList.add('pc-v230-reporting-fixed'));
}

function apply(){
  document.documentElement.dataset.pcVisual='230';
  ensurePerfKpi();
  refreshKpi();
  refineHero();
  tagCards();
  repairReporting();
}

function boot(){
  apply();
  const observer=new MutationObserver(()=>{
    clearTimeout(boot.t);
    boot.t=setTimeout(apply,40);
  });
  observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

window.PcVisualV230={version:VERSION,refresh:apply};
})();