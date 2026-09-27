import {chromium} from "playwright";
import {writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
const hosts=["https://allbeeapp-six.vercel.app","https://app.allbeesolutions.com"];
const browser=await chromium.launch();
const results=[];
try{
 for(const host of hosts){
  const html=await (await fetch(host)).text();
  const asset=html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)?.[1];
  if(!asset)throw Error("Main asset not found: "+host);
  const source=await(await fetch(new URL(asset,host))).text();
  const currentUI=source.includes("allbee-sidebar")&&source.includes("Workspace navigation");
  const checksum=createHash("sha256").update(source).digest("hex");
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   const response=await page.goto(host,{waitUntil:"networkidle",timeout:30000});
   await page.waitForFunction(()=>!document.querySelector(".loading-screen,.prism-wrap"),{timeout:15000});
   const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,crash:/Something went wrong|could not render/.test(document.body.innerText),signIn:/sign in|log in/i.test(document.body.innerText)}));
   results.push({host,width,status:response.status(),asset,currentUI,checksum,errors,...state});
   await page.close();
  }
 }
 writeFileSync(new URL("../../.ai/LIVE_UI_RELEASE.json",import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
 console.log(JSON.stringify(results,null,2));
 if(results.some(r=>r.status!==200||!r.currentUI||r.overflow||r.crash||r.errors.length||!r.signIn))process.exitCode=1;
}finally{await browser.close();}
