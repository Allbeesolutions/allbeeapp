import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(new URL("../..",import.meta.url).pathname);
const out=resolve(root,".ai/haor-20261017-batch3");
mkdirSync(out,{recursive:true});
const smoke=process.argv.includes("--smoke");
const widths=smoke?[390]:[320,390,768,1440];
const cases=[
  ["superadmin","dashboard"],["superadmin","concepts"],["superadmin","ai-center"],["superadmin","assistant"],
  ["partner","apn/home"],["partner","apn/chat"],["partner","apn/ai"],
  ["client","client/home"],["client","client/chat"],["client","client/ai"],
];
const chosen=smoke?cases.filter(([r,p])=>(r==="superadmin"&&p==="concepts")||(r==="partner"&&p==="apn/ai")||(r==="client"&&p==="client/ai")):cases;
const server=await createServer({root,server:{host:"127.0.0.1",port:0},define:{"import.meta.env.VITE_FOUNDER_LOCKDOWN_QUIET":JSON.stringify("true"),"import.meta.env.VITE_PAUSE_TEST":JSON.stringify("0")},plugins:[{
  name:"isolated-navigation-stress",enforce:"pre",
  resolveId(id){if(/(?:^|\/)supabaseClient(?:\.js)?$/.test(id))return "\0allbee-ui-mock"},
  load(id){if(id==="\0allbee-ui-mock")return readFileSync(resolve(root,"scripts/ui/mockSupabase.js"),"utf8")}
}]});
await server.listen();
const port=server.httpServer.address().port,base=`http://127.0.0.1:${port}`;
const browser=await chromium.launch();
const results=[];
try{
 for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:"block"});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e.message)));
  await page.route("**/*", async route=>{
   const u=new URL(route.request().url());
   if(!["127.0.0.1","localhost"].includes(u.hostname)&&!["data:","blob:"].includes(u.protocol))return route.abort();
   // Introduce a bounded, deterministic module delay on the first request
   // in each navigation without interfering with the mocked backend.
   if(u.pathname.endsWith(".jsx")||u.pathname.endsWith(".js"))await new Promise(r=>setTimeout(r,smoke?10:25));
   return route.continue();
  });
  for(let i=0;i<chosen.length;i++){
   const [role,route]=chosen[i];
   const before=performance.now(),oldErrors=errors.length;
   let failed="";
   try{
    await page.goto(`${base}/?role=${role}&sequence=${i}&width=${width}#/${route}`,{waitUntil:"domcontentloaded",timeout:35000});
    await page.waitForFunction(()=>document.querySelector(".layout,.apn-nav-shell,.topbar")||/could not render/i.test(document.body.innerText),null,{timeout:18000});
    await page.waitForFunction(()=>!document.querySelector(".prism-wrap,.loading-screen")&&document.body.innerText.length>70,null,{timeout:16000});
    await page.waitForTimeout(80);
   }catch(e){failed=String(e.message).slice(0,320)}
   const state=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    fatal:/ALLBEE could not render|Something went wrong|This page could not load|Cannot read properties|ALLBEE services could not be reached/.test(document.body.innerText),
    body:document.body.innerText.slice(0,180),
   }));
   // URL assertions prevent accidentally counting an unrelated page as covered.
   const pass=!failed&&!state.fatal&&!state.overflow&&errors.length===oldErrors;
   results.push({role,route,width,pass,ms:Math.round(performance.now()-before),error:failed||errors.slice(oldErrors).join(" | "),overflow:state.overflow,excerpt:pass?undefined:state.body});
   console.log(JSON.stringify(results.at(-1)));
  }
  await context.close();
 }
}finally{
 writeFileSync(resolve(out,smoke?"navigation-smoke.json":"navigation-stress.json"),JSON.stringify({mocked:true,results},null,2));
 await browser.close(); await server.close();
}
console.log(JSON.stringify({cases:results.length,failed:results.filter(x=>!x.pass).length}));
if(results.some(x=>!x.pass))process.exitCode=1;
