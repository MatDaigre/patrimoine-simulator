(() => {
'use strict';
if(typeof state==='undefined'||typeof render!=='function')return;

const C={
 baseState:typeof baseState==='function'?baseState:null,
 hydrate:typeof hydrate==='function'?hydrate:null,
 render,
 nextMonth:typeof nextMonth==='function'?nextMonth:null,
 simulateMonths:typeof simulateMonths==='function'?simulateMonths:null,
 simulateOneMonth:typeof simulateOneMonth==='function'?simulateOneMonth:null,
 showSimulationReport:typeof showSimulationReport==='function'?showSimulationReport:null,
 showAnnualReport:typeof showAnnualReport==='function'?showAnnualReport:null,
 evaluateEndConditions:typeof evaluateEndConditions==='function'?evaluateEndConditions:null,
 showEndModal:typeof showEndModal==='function'?showEndModal:null,
 training:typeof training==='function'?training:null,
 monthlyDebtPayments:typeof monthlyDebtPayments==='function'?monthlyDebtPayments:null,
 totalDebt:typeof totalDebt==='function'?totalDebt:null,
 netWorth:typeof netWorth==='function'?netWorth:null,
 payDebts:typeof payDebts==='function'?payDebts:null,
 debtRatio:typeof debtRatio==='function'?debtRatio:null
};
const N=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const ri=(a,b)=>Math.round(rand(a,b));
const EUR=v=>typeof fmtEUR==='function'?fmtEUR(v):new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const PCT=v=>`${N(v).toFixed(1).replace('.',',')} %`;
const MAX_LEVEL=6, LOSS_HAPPINESS=50;

function defaultFix(s){
 const m=Math.max(0,N(s?.totalMonths));
 return {schema:1,cumulativeIncome:0,taxesPaid:0,bankInterestPaid:0,inflationLoss:0,
 personalLoans:[],events:{nextLargeMonth:m+ri(9,16),nextHugeMonth:m+ri(48,60),largeCount:0,hugeCount:0},
 pea:{closedBefore5y:false,realizedPnL:0,lastRealizedPnL:null}};
}
function ensure(s){
 if(!s||typeof s!=='object')return s;
 const d=defaultFix(s);
 s.commonFixes=Object.assign(d,s.commonFixes||{});
 s.commonFixes.events=Object.assign(d.events,s.commonFixes.events||{});
 s.commonFixes.pea=Object.assign(d.pea,s.commonFixes.pea||{});
 if(!Array.isArray(s.commonFixes.personalLoans))s.commonFixes.personalLoans=[];
 s.commonFixes.personalLoans=s.commonFixes.personalLoans.map((l,i)=>({
   id:l.id||`loan-${Date.now()}-${i}`,principal:Math.max(0,N(l.principal)),
   balance:Math.max(0,N(l.balance)),rate:Math.max(0,N(l.rate)),
   months:Math.max(0,Math.round(N(l.months))),initialMonths:Math.max(0,Math.round(N(l.initialMonths||l.months))),
   payment:Math.max(0,N(l.payment)),totalInterestInitial:Math.max(0,N(l.totalInterestInitial)),
   interestPaid:Math.max(0,N(l.interestPaid))
 })).filter(l=>l.balance>.01&&l.payment>0);
 return s;
}
if(C.baseState)baseState=()=>ensure(C.baseState());
if(C.hydrate)hydrate=raw=>ensure(C.hydrate(raw));
state=ensure(state);

// Bonheur : 50 n'est plus un plancher.
function happinessLoss(){
 if(state.gameOver||N(state.wellbeing)>=LOSS_HAPPINESS)return false;
 state.gameOver=true;state.gameResult='loss-happiness';
 state.lastEvent=`💔 Partie perdue : ton bonheur est descendu sous ${LOSS_HAPPINESS}/100.`;
 if(typeof addHistory==='function')addHistory(`${typeof monthName==='function'?monthName(state.month):'Mois'} ${state.year||''} — ${state.lastEvent}`);
 if(typeof silentSave==='function')silentSave();
 return true;
}
if(C.evaluateEndConditions)evaluateEndConditions=function(){
 const r=C.evaluateEndConditions(); const lost=happinessLoss();
 if(lost&&typeof showEndModal==='function')try{showEndModal('loss-happiness')}catch{}
 return r;
};
if(C.showEndModal)showEndModal=function(kind){
 if(kind!=='loss-happiness')return C.showEndModal(kind);
 const modal=document.getElementById('endModal'); if(!modal)return C.showEndModal('loss');
 const set=(id,t)=>{const x=document.getElementById(id);if(x)x.textContent=t};
 set('endEmoji','💔');set('endEyebrow','Fin de partie');set('endTitle','Bonheur trop faible');
 set('endText',`Ton bonheur est passé sous ${LOSS_HAPPINESS}/100. Une gestion financière durable doit aussi préserver ton équilibre de vie.`);
 const c=document.getElementById('continueAfterWinBtn');if(c)c.style.display='none';modal.classList.remove('hidden');
};

// Audit cumulatif
const monthRate=r=>Math.pow(Math.max(.0001,1+N(r)),1/12)-1;
function rate(k,f){const m=state.debtMeta?.[k]||{};return Number.isFinite(Number(m.rate))?Math.max(0,Number(m.rate)):f}
function legacyInterest(){
 return Math.max(0,N(state.homeDebt))*rate('home',.034)/12+
 Math.max(0,N(state.rentalDebt))*rate('rental',.036)/12+
 Math.max(0,N(state.carDebt))*rate('car',.055)/12+
 Math.max(0,N(state.studentDebt))*rate('student',.025)/12+
 Math.max(0,N(state.consumerDebt))*rate('consumer',.08)/12;
}
function auditBefore(){
 ensure(state);
 const income=typeof monthlyIncome==='function'?Math.max(0,N(monthlyIncome())):0;
 const taxes=typeof monthlyTax==='function'?Math.max(0,N(monthlyTax())):0;
 const base=Math.max(0,N(state.cash))+Math.max(0,N(state.livret))+Math.max(0,N(state.assurance))+Math.max(0,N(state.tax?.peaCash));
 return {income,taxes,inflationLoss:Math.max(0,base*monthRate(state.annualInflation)),legacyInterest:legacyInterest()};
}
function auditAfter(s){
 if(!s)return;const f=ensure(state).commonFixes;
 f.cumulativeIncome+=s.income;f.taxesPaid+=s.taxes;f.inflationLoss+=s.inflationLoss;f.bankInterestPaid+=s.legacyInterest;
}

// Plusieurs prêts personnels
const loans=()=>ensure(state).commonFixes.personalLoans;
const loanBalance=()=>loans().reduce((s,l)=>s+N(l.balance),0);
const loanPayments=()=>loans().reduce((s,l)=>s+N(l.payment),0);
if(C.monthlyDebtPayments)monthlyDebtPayments=()=>N(C.monthlyDebtPayments())+loanPayments();
if(C.totalDebt)totalDebt=()=>N(C.totalDebt())+loanBalance();
if(C.netWorth)netWorth=()=>N(C.netWorth())-loanBalance();
if(C.debtRatio)debtRatio=function(extraPayment=0,extraIncome=0){
 const base=N(C.debtRatio(extraPayment,extraIncome));
 const inc=typeof monthlyIncome==='function'?Math.max(1,N(monthlyIncome())+N(extraIncome)):1;
 return Math.max(base,(loanPayments()+N(extraPayment))/inc*100);
};
function annuity(cap,annual,months){
 cap=Math.max(0,N(cap));annual=Math.max(0,N(annual));months=Math.max(1,Math.round(N(months)));
 const r=annual/12;return r?cap*r/(1-Math.pow(1+r,-months)):cap/months;
}
if(C.payDebts)payDebts=function(){
 const core=Math.max(0,N(C.payDebts()));let extra=0;
 for(const l of loans()){
   if(l.balance<=0||l.payment<=0)continue;
   const interest=l.balance*l.rate/12;extra+=interest;l.interestPaid+=interest;
   l.balance=Math.max(0,l.balance+interest-l.payment);l.months=Math.max(0,l.months-1);
   if(l.balance<1||l.months<=0){l.balance=0;l.payment=0;l.months=0}
 }
 state.commonFixes.personalLoans=loans().filter(l=>l.balance>.01&&l.payment>0);
 state.commonFixes.bankInterestPaid+=extra;
 return core+extra;
};
function addLoan(amount,ratePct,months){
 amount=Math.max(0,N(amount));months=Math.max(1,Math.round(N(months)));const annual=Math.max(0,N(ratePct))/100;
 if(amount<100||months<2)return{ok:false,msg:'Montant ou durée invalide.'};
 const payment=annuity(amount,annual,months);
 if(typeof debtRatio==='function'&&debtRatio(payment)>38)return{ok:false,msg:'Prêt refusé : taux d’endettement simulé supérieur à 38 %.'};
 loans().push({id:`perso-${Date.now()}`,principal:amount,balance:amount,rate:annual,months,initialMonths:months,payment,totalInterestInitial:payment*months-amount,interestPaid:0});
 state.cash=N(state.cash)+amount;
 state.lastEvent=`Prêt personnel obtenu : +${EUR(amount)}, mensualité ${EUR(payment)} pendant ${months} mois.`;
 if(typeof addHistory==='function')addHistory(state.lastEvent);if(typeof silentSave==='function')silentSave();render();return{ok:true};
}

// Gros imprévus
function majorEvent(){
 const f=ensure(state).commonFixes,m=Math.max(0,Math.round(N(state.totalMonths))),idx=Math.max(.5,N(state.priceIndex)||1);
 let cost=0,title='';
 if(m>=N(f.events.nextHugeMonth)){cost=Math.round(rand(5000,10000)*idx);title='🚨 Très gros imprévu';f.events.hugeCount++;f.events.nextHugeMonth=m+ri(54,66);f.events.nextLargeMonth=Math.max(N(f.events.nextLargeMonth),m+ri(6,12))}
 else if(m>=N(f.events.nextLargeMonth)){cost=Math.round(rand(500,1000)*idx);title='⚠️ Gros imprévu';f.events.largeCount++;f.events.nextLargeMonth=m+ri(10,18)}
 if(!cost)return null;
 state.cash=N(state.cash)-cost;state.lastEvent=`${title} : dépense exceptionnelle de ${EUR(cost)}.`;
 if(state.yearStats){state.yearStats.events=N(state.yearStats.events)+1;state.yearStats.eventCost=N(state.yearStats.eventCost)+cost}
 if(typeof addHistory==='function')addHistory(`${typeof monthName==='function'?monthName(state.month):'Mois'} ${state.year||''} — ${state.lastEvent}`);
 return{cost,title};
}

// PEA : retrait cash et clôture avant 5 ans
function peaOpenMonth(){
 const t=state.tax||{},ks=['peaOpenedMonth','peaStartMonth','peaOpenMonth','peaOpenedAtMonth','peaOpeningMonth'];
 const x=ks.map(k=>t[k]).find(v=>Number.isFinite(Number(v)));return Number.isFinite(Number(x))?Number(x):0;
}
const peaAge=()=>Math.max(0,N(state.totalMonths)-peaOpenMonth());
const peaCash=()=>Math.max(0,N(state.tax?.peaCash));
function peaWithdraw(){
 ensure(state);if(!state.tax)state.tax={};const cash=peaCash();
 if(cash<=.01){if(typeof setEvent==='function')setEvent('Aucune espèce disponible dans le PEA.');return render()}
 if(N(state.pea)>.01){if(typeof setEvent==='function')setEvent('Vends d’abord les supports du PEA avant de retirer les espèces.');return render()}
 const before5=peaAge()<60;state.cash=N(state.cash)+cash;state.tax.peaCash=0;state.pea=0;if(state.basis)state.basis.pea=0;
 if(before5){state.commonFixes.pea.closedBefore5y=true;state.lastEvent=`PEA clôturé avant 5 ans : ${EUR(cash)} transférés vers la trésorerie.`}
 else state.lastEvent=`Retrait PEA : ${EUR(cash)} transférés vers la trésorerie.`;
 if(typeof addHistory==='function')addHistory(state.lastEvent);if(typeof silentSave==='function')silentSave();render();
}
function normalizeZero(){
 if(!state.basis)return;for(const a of ['pea','cto','crypto','assurance','livret'])if(Math.abs(N(state[a]))<.01){state[a]=0;if(Math.abs(N(state.basis[a]))<1||a==='pea')state.basis[a]=0}
}

// Simulation : calcul début/fin/% mois par mois
function enhancedRows(rows,startWorth){
 let running=N(startWorth);return(rows||[]).map(r=>{const start=running,d=N(r.worthDelta),end=start+d,p=Math.abs(start)>.01?d/Math.abs(start)*100:0;running=end;return Object.assign({},r,{worthStart:start,worthEnd:end,worthPct:p})})
}
if(C.showSimulationReport)showSimulationReport=function(startLabel,rows,startWorth,totals){
 const e=enhancedRows(rows,startWorth),r=C.showSimulationReport(startLabel,rows,startWorth,totals);
 setTimeout(()=>{const list=document.getElementById('simMonthList');if(!list)return;
  Array.from(list.querySelectorAll('.sim-month-row:not(.head)')).forEach((row,i)=>{const d=e[i],last=row.children[row.children.length-1];if(d&&last&&!last.querySelector('.v213-worth-detail'))last.insertAdjacentHTML('beforeend',`<small class="v213-worth-detail">${EUR(d.worthStart)} → ${EUR(d.worthEnd)} • ${d.worthPct>=0?'+':''}${PCT(d.worthPct)}</small>`)});
 },0);return r;
};

let guard=false;
function afterMonth(s){auditAfter(s);majorEvent();normalizeZero();happinessLoss();if(typeof silentSave==='function')silentSave()}
if(C.simulateOneMonth)simulateOneMonth=function(){if(guard)return C.simulateOneMonth();guard=true;const s=auditBefore();try{const r=C.simulateOneMonth();afterMonth(s);return r}finally{guard=false}};
if(C.nextMonth)nextMonth=function(){if(guard)return C.nextMonth();guard=true;const s=auditBefore();try{const r=C.nextMonth();afterMonth(s);render();return r}finally{guard=false}};
if(C.simulateMonths)simulateMonths=function(count){
 count=Math.max(1,Math.min(120,Math.round(N(count)||1)));
 if(count>1&&!confirm(`Simuler ${count} mois ?\n\nChaque mois sera réellement calculé. La partie peut se terminer pendant la simulation si ton bonheur passe sous ${LOSS_HAPPINESS}/100 ou si une autre condition de défaite est atteinte.`))return;
 return C.simulateMonths(count);
};

// Formation max
if(C.training)training=function(){
 if(N(state.careerLevel)>=MAX_LEVEL){const msg='🎓 Niveau de formation maximal atteint : aucune formation supplémentaire.';if(typeof setEvent==='function')setEvent(msg);else state.lastEvent=msg;if(typeof showSaveNote==='function')showSaveNote('Niveau maximum atteint');render();return}
 return C.training();
};

// UI additive, pas de redesign PC
function budgetCard(){return document.querySelector('.budget-card')||Array.from(document.querySelectorAll('.card')).find(c=>/budget automatique|budget mensuel/i.test(c.textContent||''))}
function happinessUI(){
 const card=budgetCard();if(!card)return;let b=document.getElementById('v213BudgetHappiness');
 if(!b){b=document.createElement('div');b.id='v213BudgetHappiness';b.className='v213-budget-happiness';const h=card.querySelector('.section-head');(h||card.firstElementChild)?.insertAdjacentElement('afterend',b)}
 const imp={economy:-2,balanced:-.5,comfort:2}[state.lifestyle]??0;b.innerHTML=`<span>😊 Bonheur</span><strong>${Math.round(N(state.wellbeing))}/100</strong><small>${imp>=0?'+':''}${String(imp).replace('.',',')} / mois avec ce niveau de vie</small>`;
}
function trainingUI(){const b=document.getElementById('trainingBtn');if(!b)return;const max=N(state.careerLevel)>=MAX_LEVEL;b.disabled=max;if(max)b.textContent='Niveau maximum atteint'}
function peaUI(){
 const card=document.querySelector('.action-card.pea')||Array.from(document.querySelectorAll('.action-card')).find(x=>(x.textContent||'').includes('PEA'));if(!card)return;
 let box=document.getElementById('v213PeaCashBox');if(!box){box=document.createElement('div');box.id='v213PeaCashBox';box.className='v213-pea-cash';card.appendChild(box)}
 const cash=peaCash();if(cash<=.01){box.hidden=true;return}box.hidden=false;const b5=peaAge()<60;
 box.innerHTML=`<span>Espèces dans le PEA</span><strong>${EUR(cash)}</strong><button type="button" class="btn ghost">${b5?'Retirer et clôturer le PEA':'Retirer les espèces'}</button><small>${b5?'Avant 5 ans, le retrait clôture le PEA dans le jeu.':'Après 5 ans, le retrait ne clôture pas automatiquement le PEA.'}</small>`;
 box.querySelector('button').onclick=peaWithdraw;
}
function loanUI(){
 const card=Array.from(document.querySelectorAll('.card')).find(c=>/prêt personnel|crédit|credit/i.test(c.textContent||''));if(!card)return;
 let root=document.getElementById('v213PersonalLoans');if(!root){root=document.createElement('div');root.id='v213PersonalLoans';root.className='v213-loans';card.appendChild(root)}
 const L=loans();root.innerHTML=`<div class="v213-credit-warning"><strong>⚠️ Crédit personnel</strong><span>À utiliser avec rigueur : des mensualités trop élevées peuvent dégrader durablement le budget et augmenter le risque de surendettement.</span></div>
 <div class="v213-loan-form"><label>Montant <input id="v213LoanAmount" type="number" min="100" step="100" value="3000"></label><label>Taux annuel (%) <input id="v213LoanRate" type="number" min="0" step="0.1" value="7.5"></label><label>Durée (mois) <input id="v213LoanMonths" type="number" min="2" step="1" value="36"></label><button id="v213AddLoan" class="btn ghost" type="button">Ajouter un prêt</button></div>
 <div class="v213-loan-list">${L.length?L.map((l,i)=>`<div><span>Prêt ${i+1} • ${(l.rate*100).toFixed(1).replace('.',',')} % • ${l.months} mois</span><strong>${EUR(l.balance)} • ${EUR(l.payment)}/mois</strong><small>Intérêts initiaux : ${EUR(l.totalInterestInitial)} • payés : ${EUR(l.interestPaid)}</small></div>`).join(''):'<small>Aucun prêt personnel supplémentaire.</small>'}</div>`;
 root.querySelector('#v213AddLoan').onclick=()=>{const r=addLoan(document.getElementById('v213LoanAmount').value,document.getElementById('v213LoanRate').value,document.getElementById('v213LoanMonths').value);if(!r.ok){if(typeof setEvent==='function')setEvent(r.msg);else alert(r.msg)}};
}
function cumulativeUI(){
 const f=ensure(state).commonFixes,fees=Math.max(0,N(state.market?.fees?.total)),income=Math.max(0,N(f.cumulativeIncome)),per=x=>income?x/income*100:0,inf=Math.max(0,(N(state.priceIndex)-1)*100);
 const host=document.querySelector('.recap-card')||Array.from(document.querySelectorAll('.card')).find(c=>/bilan/i.test(c.textContent||''));if(!host)return;
 let b=document.getElementById('v213CumulativeBilan');if(!b){b=document.createElement('div');b.id='v213CumulativeBilan';b.className='v213-cumulative-bilan';host.appendChild(b)}
 b.innerHTML=`<h4>Depuis le début de la partie</h4><div><span>Frais de placements</span><strong>${EUR(fees)} • ${PCT(per(fees))} des revenus</strong></div><div><span>Impôts payés</span><strong>${EUR(f.taxesPaid)} • ${PCT(per(f.taxesPaid))} des revenus</strong></div><div><span>Intérêts bancaires</span><strong>${EUR(f.bankInterestPaid)} • ${PCT(per(f.bankInterestPaid))} des revenus</strong></div><div><span>Inflation</span><strong>${EUR(f.inflationLoss)} estimés • +${PCT(inf)} cumulé</strong></div><small>Les pourcentages frais/impôts/intérêts utilisent les revenus cumulés. L’inflation en euros est une estimation de perte de pouvoir d’achat.</small>`;
}
function negativeRemaining(){
 const ids=['availableStat','budgetAvailable','remainingMonthly','monthlyRemaining','budgetCapacity','availableMonthly'];
 for(const id of ids){const x=document.getElementById(id);if(!x)continue;const base=(x.dataset.raw213||x.textContent||'').replace(/\s*\(impact sur la trésorerie\)\s*/i,'').trim();x.dataset.raw213=base;const v=Number(base.replace(/\u202f|\u00a0/g,'').replace(/[^\d,\-.]/g,'').replace(',','.'));if(Number.isFinite(v))x.textContent=base+(v<0?' (impact sur la trésorerie)':'')}
}
function rules(){
 document.querySelectorAll('.rules-box p,.rules-box li,.card p').forEach(x=>{if((x.textContent||'').includes('minimum de 50/100'))x.textContent=x.textContent.replace('avec un minimum de 50/100','et une chute sous 50/100 fait perdre la partie')});
}
render=function(){ensure(state);const r=C.render();happinessUI();trainingUI();peaUI();loanUI();cumulativeUI();negativeRemaining();rules();normalizeZero();return r};

if(C.showAnnualReport)showAnnualReport=function(report){const r=C.showAnnualReport(report);setTimeout(()=>{const m=document.getElementById('annualModal');if(!m)return;let b=m.querySelector('.v213-annual-cumulative');if(!b){b=document.createElement('div');b.className='v213-annual-cumulative';const btn=document.getElementById('closeAnnualBtn');(btn?.parentElement||m).insertBefore(b,btn||null)}const f=ensure(state).commonFixes,fees=N(state.market?.fees?.total),inc=Math.max(1,N(f.cumulativeIncome));b.innerHTML=`<strong>Depuis le début</strong> • frais ${EUR(fees)} (${PCT(fees/inc*100)}) • impôts ${EUR(f.taxesPaid)} (${PCT(f.taxesPaid/inc*100)}) • intérêts ${EUR(f.bankInterestPaid)} (${PCT(f.bankInterestPaid/inc*100)}) • inflation estimée ${EUR(f.inflationLoss)}.`},0);return r};

setTimeout(()=>{const nx=document.getElementById('nextMonthBtn');if(nx)nx.onclick=()=>nextMonth();const sm=document.getElementById('simulateMonthsBtn');if(sm)sm.onclick=()=>simulateMonths(document.getElementById('simulateMonthsSelect')?.value);render()},0);

window.PatrimoineCommonFixes={version:'2.1.3',personalLoans:loans,addPersonalLoan:addLoan,closeOrWithdrawPeaCash:peaWithdraw,audit:()=>JSON.parse(JSON.stringify(ensure(state).commonFixes)),normalizeZeroPositions:normalizeZero};
})();
