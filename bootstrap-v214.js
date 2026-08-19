(() => {
'use strict';

const VERSION='214directpc-r3';

const css=[
  './tax-ui.css',
  './market-ui.css',
  './personal-ui.css',
  './pc-theme.css',
  './pc-tabs-v211.css',
  './common-fixes-v213.css'
];

const scripts=[
  './tax-engine.js',
  './market-engine.js',
  './crypto-calibration.js',
  './personal-situation.js',
  './common-fixes-v213.js',
  './common-hotfix-v214.js',
  './pc-tabs-v211.js'
];

function hasCss(path){
  const name=path.replace('./','');
  return [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some(x=>(x.getAttribute('href')||'').includes(name));
}

function hasJs(path){
  const name=path.replace('./','');
  return [...document.querySelectorAll('script[src]')]
    .some(x=>(x.getAttribute('src')||'').includes(name));
}

for(const path of css){
  if(hasCss(path)) continue;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=`${path}?v=${VERSION}`;
  document.head.appendChild(link);
}

function enforceVersionBadge(){
  const chip=document.querySelector('.version-chip');
  if(!chip) return;
  if(chip.textContent!=='V2.1.4 • stable') chip.textContent='V2.1.4 • stable';
  chip.dataset.runtimeVersion='2.1.4';
  chip.title='Patrimoine Simulator — runtime V2.1.4';
}

function installVersionGuard(){
  const apply=()=>{
    enforceVersionBadge();

    // Le moteur historique reconstruit le badge lors de render().
    // On réapplique donc la version runtime après chaque render.
    if(typeof window.render==='function' && !window.render.__v214VersionGuard){
      const previous=window.render;
      const guarded=function(...args){
        const result=previous.apply(this,args);
        enforceVersionBadge();
        queueMicrotask(enforceVersionBadge);
        return result;
      };
      guarded.__v214VersionGuard=true;
      guarded.__previousRender=previous;
      window.render=guarded;
    }

    // Filet de sécurité si une portion du DOM remplace directement le badge
    // sans passer par render().
    const target=document.querySelector('.top-actions') || document.body;
    if(target && !target.__v214Observer){
      const observer=new MutationObserver(()=>enforceVersionBadge());
      observer.observe(target,{subtree:true,childList:true,characterData:true});
      target.__v214Observer=observer;
    }
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',apply,{once:true});
  }else{
    apply();
  }

  setTimeout(apply,0);
  setTimeout(apply,250);
}

function finish(){
  document.documentElement.dataset.patrimoineVersion='2.1.4';

  window.PatrimoineRuntimeDiagnostic={
    version:'2.1.4',
    bootstrap:VERSION,
    commonFixes:window.PatrimoineCommonFixes?.version || null,
    hotfix:window.PatrimoineHotfixV214?.version || null,
    loadedScripts:[...document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src'))
  };

  installVersionGuard();

  window.dispatchEvent(new CustomEvent('patrimoine-v214-ready',{
    detail:window.PatrimoineRuntimeDiagnostic
  }));
}

function load(index=0){
  if(index>=scripts.length){
    finish();
    return;
  }

  const path=scripts[index];
  if(hasJs(path)){
    load(index+1);
    return;
  }

  const script=document.createElement('script');
  script.src=`${path}?v=${VERSION}`;
  script.async=false;
  script.onload=()=>load(index+1);
  script.onerror=()=>console.error('[Patrimoine V2.1.4] Échec du chargement :',path);
  document.head.appendChild(script);
}

load();
})();
