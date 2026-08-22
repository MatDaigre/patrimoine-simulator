(() => {
'use strict';
if (window.matchMedia('(max-width: 720px)').matches) return;

const VERSION='2.4.17';
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
  const config={childList:true,subtree:true};
  const observer=new MutationObserver(()=>{
    clearTimeout(boot.t);
    boot.t=setTimeout(()=>{
      observer.disconnect();
      try{apply();}
      finally{observer.observe(document.body,config);}
    },40);
  });
  observer.observe(document.body,config);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

window.PcVisualV230={version:VERSION,refresh:apply};

/* V2.4 — progression pédagogique / score, PC uniquement. */
(function loadProgressionV240(){
  if(document.querySelector('script[data-progression-v240]')) return;
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='./progression-v240.css?v=240pc';
  css.dataset.progressionV240Css='1';
  document.head.appendChild(css);

  const js=document.createElement('script');
  js.async=false;
  js.src='./progression-v240.js?v=240pc';
  js.dataset.progressionV240='1';
  document.head.appendChild(js);
})();

/* V2.4.1 — jalons, récompenses et bilan de fin de partie. */
(function loadGameFeelV241(){
  if(document.querySelector('script[data-gamefeel-v241]')) return;
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='./gamefeel-v241.css?v=241pc';
  css.dataset.gamefeelV241Css='1';
  document.head.appendChild(css);

  const js=document.createElement('script');
  js.async=false;
  js.src='./gamefeel-v241.js?v=241pc';
  js.dataset.gamefeelV241='1';
  document.head.appendChild(js);
})();

/* V2.4.2 — événements à choix multiples. */
(function loadChoiceEventsV242(){
  if(document.querySelector('script[data-choiceevents-v242]')) return;

  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='./choice-events-v242.css?v=242pc';
  css.dataset.choiceEventsV242Css='1';
  document.head.appendChild(css);

  const js=document.createElement('script');
  js.async=false;
  js.src='./choice-events-v242.js?v=242pc';
  js.dataset.choiceEventsV242='1';
  document.head.appendChild(js);
})();

/* V2.4.3 — scénarios de départ et routes de victoire. */
(function loadReplayabilityV243(){
  if(document.querySelector('script[data-replayability-v243]')) return;

  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='./replayability-v243.css?v=243pc';
  css.dataset.replayabilityV243Css='1';
  document.head.appendChild(css);

  const js=document.createElement('script');
  js.async=false;
  js.src='./replayability-v243.js?v=243pc';
  js.dataset.replayabilityV243='1';
  document.head.appendChild(js);
})();

/* V2.4.10 — cohérence objectifs historiques + inflation. */
(function loadCoherenceV2410(){
  if(document.querySelector('script[data-coherence-v2410]')) return;
  const js=document.createElement('script');
  js.async=false;
  js.src='./coherence-v2410.js?v=2410pc';
  js.dataset.coherenceV2410='1';
  document.head.appendChild(js);
})();

/* V2.4.12 — cohérence comptable des événements historiques. */
(function loadLegacyEventAccountingV2412(){
  if(document.querySelector('script[data-legacy-events-v2412]')) return;
  const js=document.createElement('script');
  js.async=false;
  js.src='./legacy-events-v2412.js?v=2412pc';
  js.dataset.legacyEventsV2412='1';
  document.head.appendChild(js);
})();

/* V2.4.13 — cohérence du récapitulatif mensuel. */
(function loadMonthlyRecapV2413(){
  if(document.querySelector('script[data-monthly-recap-v2413]')) return;
  const js=document.createElement('script');
  js.async=false;
  js.src='./monthly-recap-v2413.js?v=2413pc';
  js.dataset.monthlyRecapV2413='1';
  document.head.appendChild(js);
})();

/* V2.4.14 — taux d’endettement cohérent avec les loyers. */
(function loadDebtRatioV2414(){
  if(document.querySelector('script[data-debt-ratio-v2414]')) return;
  const js=document.createElement('script');
  js.async=false;
  js.src='./debt-ratio-v2414.js?v=2414pc';
  js.dataset.debtRatioV2414='1';
  document.head.appendChild(js);
})();

/* V2.4.15 — cash-flow locatif réellement net. */
(function loadRentalNetV2415(){
  if(document.querySelector('script[data-rental-net-v2415]')) return;
  const js=document.createElement('script');
  js.async=false;
  js.src='./rental-net-v2415.js?v=2415pc';
  js.dataset.rentalNetV2415='1';
  document.head.appendChild(js);
})();

/* V2.4.16 — note annuelle non manipulable par les transferts. */
(function loadAnnualGradeV2416(){
  if(document.querySelector('script[data-annual-grade-v2416]')) return;
  const js=document.createElement('script');
  js.async=false;
  js.src='./annual-grade-v2416.js?v=2416pc';
  js.dataset.annualGradeV2416='1';
  document.head.appendChild(js);
})();

/* V2.4.17 — score global structurel, non dépendant du marché. */
(function loadStructuralScoreV2417(){
  if(document.querySelector('script[data-structural-score-v2417]')) return;
  const js=document.createElement('script');
  js.async=false;
  js.src='./structural-score-v2417.js?v=2417pc';
  js.dataset.structuralScoreV2417='1';
  document.head.appendChild(js);
})();
})();
