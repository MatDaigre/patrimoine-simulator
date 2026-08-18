(() => {
  'use strict';
  if (window.matchMedia('(max-width: 720px)').matches) return;

  const TAB_KEY='patrimoine-pc-tab-v211';

  function classify(section){
    if (!section) return 'dashboard';
    if (section.classList.contains('invest-card') || section.classList.contains('realestate-card')) return 'patrimoine';
    const txt=(section.textContent||'').toLowerCase();
    if (section.closest('.side-column') && (txt.includes('répartition') || txt.includes('endettement'))) return 'patrimoine';
    return 'dashboard';
  }

  function initTabs(){
    const main=document.querySelector('main');
    const layout=main?.querySelector('.layout');
    const mainCol=layout?.querySelector('.main-column');
    const sideCol=layout?.querySelector('.side-column');
    if (!main || !layout || !mainCol || !sideCol || document.getElementById('pcTabsV211')) return;

    const nav=document.createElement('nav');
    nav.id='pcTabsV211';
    nav.className='pc-tabs-v211';
    nav.setAttribute('aria-label','Navigation principale');
    nav.innerHTML=`
      <button type="button" class="pc-tab-v211" data-pc-tab="dashboard"><span>📊</span><strong>Tableau de bord</strong><small>Pilotage, budget & progression</small></button>
      <button type="button" class="pc-tab-v211" data-pc-tab="patrimoine"><span>💼</span><strong>Patrimoine & investissements</strong><small>Placements, immobilier & crédits</small></button>`;

    const stats=main.querySelector('.stats-grid');
    (stats || layout).insertAdjacentElement('afterend', nav);

    [...mainCol.children].forEach(el=>el.dataset.pcPanel=classify(el));
    [...sideCol.children].forEach(el=>el.dataset.pcPanel=classify(el));

    function activate(name, persist=true){
      const selected=name==='patrimoine'?'patrimoine':'dashboard';
      document.documentElement.dataset.pcActiveTab=selected;
      document.querySelectorAll('[data-pc-panel]').forEach(el=>{
        const visible=el.dataset.pcPanel===selected;
        el.classList.toggle('pc-tab-hidden-v211',!visible);
        el.setAttribute('aria-hidden',visible?'false':'true');
      });
      nav.querySelectorAll('[data-pc-tab]').forEach(btn=>{
        const active=btn.dataset.pcTab===selected;
        btn.classList.toggle('active',active);
        btn.setAttribute('aria-selected',active?'true':'false');
      });
      if(persist) try{localStorage.setItem(TAB_KEY,selected)}catch(e){}
      window.scrollTo({top:Math.max(0,nav.offsetTop-18),behavior:'smooth'});
    }

    nav.addEventListener('click',e=>{
      const btn=e.target.closest('[data-pc-tab]');
      if(btn) activate(btn.dataset.pcTab);
    });

    let initial='dashboard';
    try{initial=localStorage.getItem(TAB_KEY)||'dashboard'}catch(e){}
    activate(initial,false);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initTabs,{once:true});
  else initTabs();
})();
