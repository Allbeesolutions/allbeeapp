import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source=readFileSync("public/sw.js","utf8");
function harness({offline=false,entries={}}={}){
  const listeners={};
  const records=new Map(Object.entries(entries));
  const fetch=vi.fn((request)=>{
    if(offline)return Promise.reject(new Error("Network offline"));
    return Promise.resolve({ok:true,clone(){return this;},tag:"network"});
  });
  const cache={put:vi.fn(async(key,value)=>{records.set(typeof key==="string"?key:key.url,value)})};
  const caches={
    keys:vi.fn(async()=>["allbee-shell-v2","allbee-shell-v3","third-party-app-cache"]),
    delete:vi.fn(async()=>true),
    open:vi.fn(async()=>({...cache,addAll:vi.fn(async()=>{})})),
    match:vi.fn(async(key)=>records.get(typeof key==="string"?key:key.url)),
  };
  const self={location:{origin:"https://app.allbeesolutions.com"},clients:{claim:vi.fn(async()=>{}),matchAll:vi.fn(async()=>[])},
    skipWaiting:vi.fn(),addEventListener:(type,fn)=>{listeners[type]=fn}};
  runInNewContext(source,{self,caches,fetch,URL,Promise,clients:self.clients});
  async function dispatch(type,request){
    let promise;
    listeners[type]({request,waitUntil:x=>{promise=x},respondWith:x=>{promise=x}});
    return await promise;
  }
  return {self,fetch,caches,cache,listeners,dispatch};
}
describe("service worker offline and update reliability",()=>{
  it("restores the cached app shell when navigation is offline",async()=>{
    const cached={tag:"previous working app"};
    const sw=harness({offline:true,entries:{"/index.html":cached}});
    const result=await sw.dispatch("fetch",{method:"GET",mode:"navigate",url:"https://app.allbeesolutions.com/client"});
    expect(result).toBe(cached);
    expect(sw.fetch).toHaveBeenCalledTimes(1);
  });
  it("restores cached versioned JavaScript on temporary network loss",async()=>{
    const uri="https://app.allbeesolutions.com/assets/index-oldhash.js",cached={tag:"offline chunk"};
    const sw=harness({offline:true,entries:{[uri]:cached}});
    const response=await sw.dispatch("fetch",{method:"GET",mode:"no-cors",url:uri});
    expect(response).toBe(cached);
  });
  it("does not evict unrelated caches or navigate away from an active draft",async()=>{
    const sw=harness();
    await sw.dispatch("activate");
    expect(sw.caches.delete).toHaveBeenCalledTimes(1);
    expect(sw.caches.delete).toHaveBeenCalledWith("allbee-shell-v2");
    expect(sw.self.clients.claim).toHaveBeenCalledTimes(1);
    expect(sw.self.clients.matchAll).not.toHaveBeenCalled();
  });
  it("never intercepts modifying requests or a foreign origin",async()=>{
    const sw=harness();
    await sw.dispatch("fetch",{method:"POST",mode:"navigate",url:"https://app.allbeesolutions.com/"});
    await sw.dispatch("fetch",{method:"GET",mode:"navigate",url:"https://another-origin.com/"});
    expect(sw.fetch).not.toHaveBeenCalled();
    expect(sw.caches.match).not.toHaveBeenCalled();
  });
});
