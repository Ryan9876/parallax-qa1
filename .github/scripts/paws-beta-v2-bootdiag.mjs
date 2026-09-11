import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1280,height:800}});
const page = await context.newPage();
const events=[];
page.on('console',m=>events.push({type:'console-'+m.type(),text:m.text()}));
page.on('pageerror',e=>events.push({type:'pageerror',text:e.message,stack:e.stack}));
page.on('requestfailed',r=>events.push({type:'requestfailed',url:r.url(),error:r.failure()?.errorText||''}));
page.on('response',r=>{if(r.status()>=400)events.push({type:'http',url:r.url(),status:r.status()})});
await page.addInitScript(()=>{
  window.__BOOT_FETCH_LOG__=[];
  const original=window.fetch.bind(window);
  window.fetch=async (...args)=>{
    const input=args[0];
    const url=typeof input==='string'?input:(input?.url||String(input));
    try{
      const response=await original(...args);
      window.__BOOT_FETCH_LOG__.push({url,status:response.status,ok:response.ok});
      return response;
    }catch(error){
      window.__BOOT_FETCH_LOG__.push({url,error:String(error),stack:error?.stack||''});
      throw error;
    }
  };
});
await page.goto('http://127.0.0.1:4173/?qa=1',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(8000);
const fetches=await page.evaluate(()=>window.__BOOT_FETCH_LOG__||[]);
const state=await page.evaluate(()=>({hasGame:!!window.__PAWS_GAME__,hasQA:!!window.__PAWS_QA__,body:document.body.innerText.slice(0,800)}));
console.log(JSON.stringify({fetches,events,state},null,2));
await context.close();
await browser.close();
