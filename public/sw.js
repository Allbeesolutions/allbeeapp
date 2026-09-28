const CACHE='allbee-shell-v3';
const SHELL=['/','/index.html','/manifest.webmanifest','/favicon.ico'];
const isMascot=(pathname)=>pathname.includes('allbee-ai-mascot');
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('allbee-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    if(self.location.hostname==='app.allbeesolutions.com'){
      const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      await Promise.all(windows.map(client=>client.navigate(client.url).catch(()=>{})));
    }
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/functions/'))return;
  if(isMascot(url.pathname)){
    event.respondWith(fetch(req,{cache:'reload'}));
    return;
  }
  if(req.mode==='navigate'){
    event.respondWith(fetch(req,{cache:'no-store'}).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put('/index.html',copy));}
      return res;
    }).catch(()=>caches.match('/index.html').then(r=>r||caches.match('/'))));
    return;
  }
  if(url.pathname.startsWith('/assets/')){
    event.respondWith(fetch(req).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
      return res;
    }).catch(()=>caches.match(req)));
    return;
  }
  if(SHELL.includes(url.pathname)){
    event.respondWith(fetch(req).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
      return res;
    }).catch(()=>caches.match(req)));
  }
});
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}};const title=data.title||'ALLBEE';const options={body:data.body||'',icon:data.icon||'/favicon.ico',badge:data.badge||'/favicon.ico',tag:data.tag||data.group_key,data:{deep_link:data.deep_link||null}};event.waitUntil(self.registration.showNotification(title,options));});
self.addEventListener('notificationclick',event=>{event.notification.close();const target=event.notification.data?.deep_link;event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{const url=target?.url?new URL(target.url,self.location.origin).href:self.location.origin+'/';for(const c of list)if('focus'in c)return c.focus().then(()=>c.navigate(url));return clients.openWindow(url);}));});
