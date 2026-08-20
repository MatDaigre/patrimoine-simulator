(() => {
'use strict';

if (typeof state === 'undefined' || typeof render !== 'function') {
  console.error('[Performance V2.1.7] moteur indisponible');
  return;
}

const VERSION='2.1.7';
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const EUR=v=>typeof fmtEUR==='function'?fmtEUR(v):new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(N(v));
const PCT=v=>`${N(v)>=0?'+':''}${N(v).toFixed(1).replace('.',',')} %`;
const signedEUR=v=>`${N(v)>=0?'+':''}${EUR(v)}`;

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
    {key:'pea',label:'PEA World',icon:'🌍',value:peaValue,capital:peaCapital,perf:peaPerf,exact:true},
    {key:'assurance',label:'Assurance-vie',icon:'🧱',value:assuranceValue,capital:assuranceCapital,perf:assurancePerf},
    {key:'cto',label:'CTO',icon:'📈',value:ctoValue,capital:ctoCapital,perf:ctoPerf,realized:ctoRealized},
    {key:'crypto',label:'Crypto',icon:'₿',value:cryptoValue,capital:cryptoCapital,perf:cryptoPerf,realized:cryptoRealized},
    {key:'livret',label:'Livret',icon:'🛟',value:livretValue,capital:livretCapital,perf:livretPerf}
  ];

  rows.forEach(r=>{
    const denom=Math.max(0,r.capital);
    r.pct=denom>0?r.perf/denom*100:0;
  });

  const totalCapital=rows.reduce((s,r)=>s+r.capital,0);
  const totalValue=rows.reduce((s,r)=>s+r.value,0);
  const totalPerf=rows.reduce((s,r)=>s+r.perf,0);
  const totalPct=totalCapital>0?totalPerf/totalCapital*100:0;

  return {rows,totalCapital,totalValue,totalPerf,totalPct};
}

function cls(v){return v>0.005?'positive':v<-0.005?'negative':'neutral'};

function findHost(){
  // Priorité à l'onglet Patrimoine : juste avant les placements.
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
      <p>Pour le PEA, les espèces internes font partie du plan : vendre puis réinvestir ne remet donc pas la performance à zéro. Pour le CTO et la crypto, les gains/pertes réalisés suivis par le moteur fiscal sont également intégrés.</p>
      <p class="muted">Les rachats historiques d'assurance-vie et de livret effectués avant l'installation de ce module ne peuvent pas être reconstruits parfaitement à partir d'une ancienne sauvegarde.</p>
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
    lesson.innerHTML=`<strong>🎓 À retenir</strong><span>Tu as affecté ${EUR(d.totalCapital)} aux placements. Ils représentent aujourd’hui ${EUR(d.totalValue)} et ont généré <b class="positive">${signedEUR(d.totalPerf)}</b> de performance suivie.</span>`;
  }else if(d.totalPerf<0){
    lesson.innerHTML=`<strong>🎓 À retenir</strong><span>Tu as affecté ${EUR(d.totalCapital)} aux placements. Leur valeur/performance suivie est actuellement inférieure de <b class="negative">${EUR(Math.abs(d.totalPerf))}</b>. Une perte latente n’est pas forcément définitive tant qu’elle n’est pas réalisée.</span>`;
  }else{
    lesson.innerHTML='<strong>🎓 À retenir</strong><span>Pour l’instant, la valeur suivie de tes placements est proche du capital affecté.</span>';
  }
}

const coreRender=render;
render=function(){
  const result=coreRender();
  renderPerformance();
  return result;
};

renderPerformance();
window.PerformanceDashboardV217={version:VERSION,compute:assetPerformance};
})();
