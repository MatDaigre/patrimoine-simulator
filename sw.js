const CACHE='patrimoine-simulator-v210-stable-crypto';
const ASSETS=[
  './','./index.html',
  './tax-ui.css','./tax-engine.js',
  './market-ui.css','./market-engine.js',
  './personal-ui.css','./personal-situation.js','./crypto-calibration.js',
  './mobile.css','./mobile-v2.css','./mobile-v21.css','./mobile-nav-v21.js',
  './manifest.webmanifest','./icon-192.png','./icon-512.png'
];

const MOBILE_LAYER=[
  '<link rel="stylesheet" href="./tax-ui.css?v=210">',
  '<link rel="stylesheet" href="./market-ui.css?v=210">',
  '<link rel="stylesheet" href="./personal-ui.css?v=210">',
  '<link rel="stylesheet" href="./mobile.css?v=210" media="(max-width: 720px)">',
  '<link rel="stylesheet" href="./mobile-v2.css?v=210" media="(max-width: 720px)">',
  '<link rel="stylesheet" href="./mobile-v21.css?v=210" media="(max-width: 720px)">',
  '<meta name="theme-color" media="(max-width: 720px)" content="#070b14">',
  '<script defer src="./tax-engine.js?v=210"></script>',
  '<script defer src="./market-engine.js?v=210"></script>',
  '<script defer src="./crypto-calibration.js?v=210"></script>',
  '<script defer src="./personal-situation.js?v=210"></script>',
  '<script defer src="./mobile-nav-v21.js?v=210"></script>'
].join('');

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS).catch(()=>{})));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(clients.map(client=>client.navigate(client.url).catch(()=>null)));
  })());
});

async function injectLayer(response){
  if(!response||!response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;

  const html=await response.text();
  if(html.includes('personal-situation.js?v=210')&&html.includes('market-engine.js?v=210')){
    return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
  }

  const patched=html.replace('</head>',`${MOBILE_LAYER}</head>`);
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  return new Response(patched,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  const url=new URL(event.request.url);
  const nav=event.request.mode==='navigate'||
    (url.origin===self.location.origin&&(url.pathname.endsWith('/')||url.pathname.endsWith('/index.html')));

  if(nav){
    event.respondWith((async()=>{
      try{
        const network=await fetch(event.request,{cache:'no-store'});
        const cache=await caches.open(CACHE);
        cache.put('./index.html',network.clone()).catch(()=>{});
        return injectLayer(network);
      }catch{
        return injectLayer(await caches.match('./index.html'));
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    try{
      const network=await fetch(event.request);
      const cache=await caches.open(CACHE);
      cache.put(event.request,network.clone()).catch(()=>{});
      return network;
    }catch{
      return(await caches.match(event.request))||Response.error();
    }
  })());
});