(() => {
'use strict';

const VERSION='214directpc';

const css=[
  './tax-ui.css',
  './market-ui.css',
  './personal-ui.css',
  './pc-theme.css',
  './pc-tabs-v211.css',
  './common-fixes-v213.css'
];

const js=[
  './tax-engine.js',
  './market-engine.js',
  './crypto-calibration.js',
  './personal-situation.js',
  './common-fixes-v213.js',
  './common-hotfix-v214.js',
  './pc-tabs-v211.js'
];

function hasCss(path){
  return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some(x => (x.getAttribute('href')||'').includes(path.replace('./','')));
}
function hasJs(path){
  return Array.from(document.querySelectorAll('script[src]'))
    .some(x => (x.getAttribute('src')||'').includes(path.replace('./','')));
}

for(const path of css){
  if(hasCss(path)) continue;
  const l=document.createElement('link');
  l.rel='stylesheet';
  l.href=`${path}?v=${VERSION}`;
  document.head.appendChild(l);
}

function load(i=0){
  if(i>=js.length){
    document.documentElement.dataset.patrimoineVersion='2.1.4';
    window.dispatchEvent(new CustomEvent('patrimoine-v214-ready'));
    return;
  }
  const path=js[i];
  if(hasJs(path)){ load(i+1); return; }
  const s=document.createElement('script');
  s.src=`${path}?v=${VERSION}`;
  s.onload=()=>load(i+1);
  s.onerror=()=>console.error('[Patrimoine V2.1.4] Échec du chargement :',path);
  document.head.appendChild(s);
}
load();
})();
