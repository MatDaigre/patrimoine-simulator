const CACHE='patrimoine-simulator-v2418-pc';
const ASSETS=[
  './','./index.html',
  './tax-ui.css','./tax-engine.js',
  './market-ui.css','./market-engine.js',
  './personal-ui.css','./personal-situation.js',
  './pc-theme.css','./crypto-calibration.js',
  './pc-tabs-v211.css','./pc-tabs-v211.js',
  './pc-core-v215.css','./pc-core-v215.js',
  './manifest.webmanifest','./icon-192.png','./icon-512.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(ASSETS))
  );
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

  if(event.request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const network=await fetch(event.request,{cache:'no-store'});
        const cache=await caches.open(CACHE);
        cache.put('./index.html',network.clone()).catch(()=>{});
        return network;
      }catch{
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    try{
      const network=await fetch(event.request,{cache:'no-store'});
      const cache=await caches.open(CACHE);
      cache.put(event.request,network.clone()).catch(()=>{});
      return network;
    }catch{
      return (await caches.match(event.request)) || Response.error();
    }
  })());
});
