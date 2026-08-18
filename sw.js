const CACHE='patrimoine-simulator-v172-mobile-ui';
const ASSETS=['./','./index.html','./mobile.css','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const MOBILE_STYLE='<link rel="stylesheet" href="./mobile.css?v=172" media="(max-width: 720px)"><meta name="theme-color" media="(max-width: 720px)" content="#0b1120">';

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(ASSETS).catch(()=>{}))
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
    // Recharge une seule fois les pages déjà ouvertes après l'activation
    // afin que le nouveau thème mobile soit pris en compte immédiatement.
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(clients.map(client=>client.navigate(client.url).catch(()=>null)));
  })());
});

async function injectMobileStyle(response){
  if(!response || !response.ok)return response;
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.includes('text/html'))return response;
  const html=await response.text();
  if(html.includes('mobile.css?v=172')){
    return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
  }
  const patched=html.replace('</head>',`${MOBILE_STYLE}</head>`);
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  return new Response(patched,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const isNavigation=event.request.mode==='navigate' || (url.origin===self.location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')));

  if(isNavigation){
    event.respondWith((async()=>{
      try{
        const network=await fetch(event.request,{cache:'no-store'});
        const cache=await caches.open(CACHE);
        cache.put('./index.html',network.clone()).catch(()=>{});
        return injectMobileStyle(network);
      }catch{
        const cached=await caches.match('./index.html');
        return injectMobileStyle(cached);
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
      return (await caches.match(event.request)) || Response.error();
    }
  })());
});
