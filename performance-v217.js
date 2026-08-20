(() => {
'use strict';

if (typeof state === 'undefined' || typeof render !== 'function') {
  console.error('[Performance V2.1.7.1] moteur indisponible');
  return;
}

const VERSION='2.1.7.1';
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const EUR=v=>typeof fmtEUR==='function'
  ? fmtEUR(v)
  : new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(N(v));
const PCT=v=>{
  if(v===null||v===undefined||!Number.isFinite(Number(v)))return '—';
  const x=Number(v);
  if(Math.abs(x)<0.005)return '0,00 %';
  const decimals=Math.abs(x)<1?2:1;
  return `${x>0?'+':''}${x.toFixed(decimals).replace('.',',')} %`;
};
const signedEUR=v=>`${N(v)>0?'+':''}${EUR(v)}`;

function taxYearNet(kind){
  const years=state.tax?.[kind==='cto'?'ctoYears':'cryptoYears'];
  if(!years||typeof years!=='object')return 0;
  return Object.values(years).reduce((sum,row)=>sum+N(row?.net),0);
}

function assetPerformance(){
  const peaValue=Math.max(0,N(state.pea))+Math.max(0,N(state.tax?.peaCash));
  const peaCapital=Math.max(0,N(state.tax?.peaContributions));
  const peaPerf=peaValue-peaCapital;

  const assuranceValue=Math.max(0,N(state.assurance));
  const assuranceCapital=Math.max(0,N(state.basis?.assurance));
  const assurancePerf=assuranceValue-assuranceCapital;

  const ctoValue=Math.max(0,N(state.cto));
  const ctoCapital=Math.max(0,N(state.basis?.cto));
  const ctoRealized=taxYearNet('cto');
  const ctoPerf=(ctoValue-ctoCapital)+ctoRealized;

  const cryptoValue=Math.max(0,N(state.crypto));
  const cryptoCapital=Math.max(0,N(state.basis?.crypto));
  const cryptoRealized=taxYearNet('crypto');
  const cryptoPerf=(cryptoValue-cryptoCapital)+cryptoRealized;

  const livretValue=Math.max(0,N(state.livret));
  const livretCapital=Math.max(0,N(state.basis?.livret));
  const livretPerf=livretValue-livretCapital;

  const rows=[
    {key:'pea',label:'PEA World',icon:'🌍',value:peaValue,capital:peaCapital,perf:peaPerf},
    {key:'assurance',label:'Assurance-vie',icon:'🧱',value:assuranceValue,capital:assuranceCapital,perf:assurancePerf},
    {key:'cto',label:'CTO',icon:'📈',value:ctoValue,capital:ctoCapital,perf:ctoPerf},
    {key:'crypto',label:'Crypto',icon:'₿',value:cryptoValue,capital:cryptoCapital,perf:cryptoPerf},
    {key:'livret',label:'Livret',icon:'🛟',value:livretValue,capital:livretCapital,perf:livretPerf}
  ];

  rows.forEach(r=>{
    r.pct=r.capital>0 ? r.perf/r.capital*100 : null;
  });

  const totalCapital=rows.reduce((s,r)=>s+r.capital,0);
  const totalValue=rows.reduce((s,r)=>s+r.value,0);
  const totalPerf=rows.reduce((s,r)=>s+r.perf,0);
  const totalPct=totalCapital>0 ? totalPerf/totalCapital*100 : null;

  return {rows,totalCapital,totalValue,totalPerf,totalPct};
}

function cls(v){
  return v>0.005?'positive':v<-0.005?'negative':'neutral';
}

function findHost(){
  const invest=document.querySelector('.invest-card');
  if(invest?.parentElement)return {parent:invest.parentElement,before:invest};
  const main=document.querySelector('.main-column');
  return main?{parent:main,before:main.firstElementChild}:null;
}

function buildCard(){
  let card=document.getElementById('performanceDashboardV217');
  if(card)return card;
  const host=findHost();
  if(!host)return null;

  card=document.createElement('section');
  card.id='performanceDashboardV217';
  card.className='card section-card performance-v217-card';
  card.dataset.pcPanel='patrimoine';
  card.innerHTML=`
    <div class="performance-v217-head">
      <div>
        <p class="eyebrow">Depuis le début de la partie</p>
        <h3>📊 Performance de tes placements</h3>
        <p class="performance-v217-sub">Ce que tes placements ont réellement créé ou détruit, indépendamment de l'argent versé.</p>
      </div>
      <button type="button" class="performance-v217-info" aria-label="Comprendre la performance">?</button>
    </div>
    <div class="performance-v217-hero">
      <div><span>Performance totale</span><strong id="perfV217Total">—</strong><small id="perfV217TotalPct">—</small></div>
      <div><span>Capital suivi</span><strong id="perfV217Capital">—</strong><small>Versements / prix de revient</small></div>
      <div><span>Valeur actuelle</span><strong id="perfV217Value">—</strong><small>Placements + espèces PEA</small></div>
    </div>
    <div id="performanceV217Rows" class="performance-v217-rows"></div>
    <div id="performanceV217Lesson" class="performance-v217-lesson"></div>
    <div id="performanceV217Help" class="performance-v217-help" hidden>
      <strong>Comment lire cette donnée ?</strong>
      <p><b>Capital suivi</b> = l'argent réellement affecté aux placements. <b>Performance</b> = gains ou pertes produits par les placements, hors nouveaux versements.</p>
      <p>Pour le PEA, les espèces internes font partie du plan : vendre puis réinvestir ne remet pas la performance à zéro.</p>
      <p>Si aucun capital de référence fiable n'existe, le pourcentage affiche « — » plutôt qu'un faux 0 %.</p>
    </div>`;

  host.parent.insertBefore(card,host.before);
  card.querySelector('.performance-v217-info').onclick=()=>{
    const help=card.querySelector('#performanceV217Help');
    help.hidden=!help.hidden;
  };
  return card;
}

function renderPerformance(){
  const card=buildCard();
  if(!card)return;
  const d=assetPerformance();

  const total=card.querySelector('#perfV217Total');
  total.textContent=signedEUR(d.totalPerf);
  total.className=cls(d.totalPerf);

  const pct=card.querySelector('#perfV217TotalPct');
  pct.textContent=PCT(d.totalPct);
  pct.className=cls(d.totalPerf);

  card.querySelector('#perfV217Capital').textContent=EUR(d.totalCapital);
  card.querySelector('#perfV217Value').textContent=EUR(d.totalValue);

  card.querySelector('#performanceV217Rows').innerHTML=d.rows.map(r=>`
    <div class="performance-v217-row">
      <div class="performance-v217-label"><span>${r.icon}</span><strong>${r.label}</strong></div>
      <div><span>Capital suivi</span><strong>${EUR(r.capital)}</strong></div>
      <div><span>Valeur</span><strong>${EUR(r.value)}</strong></div>
      <div><span>Performance</span><strong class="${cls(r.perf)}">${signedEUR(r.perf)} <small>${PCT(r.pct)}</small></strong></div>
    </div>`).join('');

  const lesson=card.querySelector('#performanceV217Lesson');
  if(d.totalCapital<=0){
    lesson.innerHTML='<strong>🎓 À retenir</strong><span>Commence à investir pour voir apparaître la différence entre l’argent versé et la richesse créée par tes placements.</span>';
  }else if(d.totalPerf>0){
    lesson.innerHTML=`<strong>🎓 À retenir</strong><span>Tu as affecté ${EUR(d.totalCapital)} aux placements. Ils représentent aujourd’hui ${EUR(d.totalValue)} et ont généré <b class="positive">${signedEUR(d.totalPerf)}</b> de performance suivie (${PCT(d.totalPct)}).</span>`;
  }else if(d.totalPerf<0){
    lesson.innerHTML=`<strong>🎓 À retenir</strong><span>Tu as affecté ${EUR(d.totalCapital)} aux placements. La performance suivie est de <b class="negative">${signedEUR(d.totalPerf)}</b> (${PCT(d.totalPct)}).</span>`;
  }else{
    lesson.innerHTML='<strong>🎓 À retenir</strong><span>Pour l’instant, la valeur suivie de tes placements est proche du capital affecté.</span>';
  }
}

/* ===== Notifications lisibles pour les actions utilisateur ===== */

function notificationKind(text){
  const t=String(text||'').toLowerCase();
  if(/refus|insuffisant|impossible|aucun|critique|perdu|erreur|attention/.test(t))return 'warning';
  if(/termin|obtenu|invest|plac|vend|retir|récup|atteint|progress|sauvegard/.test(t))return 'success';
  return 'info';
}

function showActionNotification(text){
  if(!text)return;
  let host=document.getElementById('actionNotificationsV217');
  if(!host){
    host=document.createElement('div');
    host.id='actionNotificationsV217';
    host.className='action-notifications-v217';
    host.setAttribute('aria-live','polite');
    document.body.appendChild(host);
  }
  const kind=notificationKind(text);
  const item=document.createElement('div');
  item.className=`action-notification-v217 ${kind}`;
  item.innerHTML=`<span class="action-notification-icon">${kind==='success'?'✓':kind==='warning'?'!':'i'}</span><span>${String(text)}</span>`;
  host.replaceChildren(item);
  clearTimeout(showActionNotification.timer);
  showActionNotification.timer=setTimeout(()=>{
    item.classList.add('leaving');
    setTimeout(()=>item.remove(),220);
  },4200);
}

/* setEvent = principal retour des boutons */
if(typeof setEvent==='function'&&!setEvent.__readabilityV217){
  const coreSetEvent=setEvent;
  const wrapped=function(text){
    const result=coreSetEvent(text);
    showActionNotification(text);
    return result;
  };
  wrapped.__readabilityV217=true;
  setEvent=wrapped;
}

/* Les notifications de sauvegarde restent elles aussi visibles. */
if(typeof showSaveNote==='function'&&!showSaveNote.__readabilityV217){
  const coreShowSaveNote=showSaveNote;
  const wrappedSave=function(text){
    const result=coreShowSaveNote(text);
    showActionNotification(text);
    return result;
  };
  wrappedSave.__readabilityV217=true;
  showSaveNote=wrappedSave;
}

function enhanceEventText(){
  document.getElementById('eventText')?.classList.add('event-text-readable-v217');
}

const coreRender=render;
render=function(){
  const result=coreRender();
  renderPerformance();
  enhanceEventText();
  return result;
};

renderPerformance();
enhanceEventText();

window.PerformanceDashboardV217={
  version:VERSION,
  compute:assetPerformance,
  notify:showActionNotification
};

})();
