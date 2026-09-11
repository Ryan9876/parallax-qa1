import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1280,height:800}});
const page = await context.newPage();
const events=[];
page.on('console',m=>events.push({type:'console-'+m.type(),text:m.text()}));
page.on('pageerror',e=>events.push({type:'pageerror',text:e.message,stack:e.stack}));
page.on('request',r=>events.push({type:'request',url:r.url(),resourceType:r.resourceType()}));
page.on('requestfailed',r=>events.push({type:'requestfailed',url:r.url(),error:r.failure()?.errorText||''}));
page.on('response',r=>{if(r.status()>=400)events.push({type:'http',url:r.url(),status:r.status()})});
await page.addInitScript(()=>{
  window.__BOOT_FETCH_LOG__=[];
  window.__BOOT_BLOBS__=[];
  const originalFetch=window.fetch.bind(window);
  window.fetch=async (...args)=>{
    const input=args[0];
    const url=typeof input==='string'?input:(input?.url||String(input));
    try{
      const response=await originalFetch(...args);
      window.__BOOT_FETCH_LOG__.push({url,status:response.status,ok:response.ok});
      return response;
    }catch(error){
      window.__BOOT_FETCH_LOG__.push({url,error:String(error),stack:error?.stack||''});
      throw error;
    }
  };
  const originalCreateObjectURL=URL.createObjectURL.bind(URL);
  URL.createObjectURL=(value)=>{
    if(value instanceof Blob){
      value.text().then(text=>window.__BOOT_BLOBS__.push(text)).catch(()=>{});
    }
    return originalCreateObjectURL(value);
  };
});
await page.goto('http://127.0.0.1:4173/?qa=1',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(8000);
const data=await page.evaluate(()=>{
  const blobs=(window.__BOOT_BLOBS__||[]).sort((a,b)=>b.length-a.length);
  const source=blobs[0]||'';
  const imports=[...source.matchAll(/(?:from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s*["']([^"']+)["'])/g)].map(m=>m[1]||m[2]||m[3]).filter(Boolean);
  const urls=[...source.matchAll(/https?:\/\/[^"'\s)]+/g)].map(m=>m[0]);
  const assets=[...source.matchAll(/["']([^"']+\.(?:glb|gltf|bin|png|jpg|jpeg|webp|ktx2|hdr|wav|mp3|ogg|m4a|json)(?:\?[^"']*)?)["']/gi)].map(m=>m[1]);
  return {
    fetches:window.__BOOT_FETCH_LOG__||[],
    blobCount:blobs.length,
    moduleBytes:source.length,
    imports:[...new Set(imports)].slice(0,200),
    urls:[...new Set(urls)].slice(0,200),
    assets:[...new Set(assets)].slice(0,200),
    sourceHead:source.slice(0,1200),
    hasGame:!!window.__PAWS_GAME__,
    hasQA:!!window.__PAWS_QA__,
    body:document.body.innerText.slice(0,800)
  };
});
console.log(JSON.stringify({data,events:events.slice(-300)},null,2));
await context.close();
await browser.close();
