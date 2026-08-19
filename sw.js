const CACHE='patrimoine-simulator-v214-direct-pc';
const ASSETS=[
  './',
  './index.html',
  './bootstrap-v214.js',
  './tax-ui.css',
  './tax-engine.js',
  './market-ui.css',
  './market-engine.js',
  './personal-ui.css',
  './personal-situation.js',
  './pc-theme.css',
  './crypto-calibration.js',
  './pc-tabs-v211.css',
  './pc-tabs-v211.js',
  './common-fixes-v213.css',
  './common-fixes-v213.js',
  './common-hotfix-v214.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS).catch(()=>{})));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  const url=new URL(event.request.url);
  const nav=event.request.mode==='navigate';

  if(nav){
    event.respondWith((async()=>{
      try{
        const response=await fetch(event.request,{cache:'no-store'});
        const cache=await caches.open(CACHE);
        cache.put('./index.html',response.clone()).catch(()=>{});
        return response;
      }catch{
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request,{cache:'no-store'});
      const cache=await caches.open(CACHE);
      cache.put(event.request,response.clone()).catch(()=>{});
      return response;
    }catch{
      return (await caches.match(event.request)) || Response.error();
    }
  })());
});
