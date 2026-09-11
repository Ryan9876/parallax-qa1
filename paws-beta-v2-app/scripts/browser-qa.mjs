import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.QA_URL || 'http://127.0.0.1:4173/?qa=1';
const outDir = path.resolve('qa-results');
fs.mkdirSync(outDir,{recursive:true});
const report={timestamp:new Date().toISOString(),desktop:{checks:[],errors:[]},mobile:{checks:[],errors:[]},pass:false};
const check=(bucket,name,ok,detail='')=>{bucket.checks.push({name,ok:!!ok,detail});return !!ok;};
const shot=(page,name)=>page.screenshot({path:path.join(outDir,name),fullPage:true});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const snap=page=>page.evaluate(()=>structuredClone(window.__PAWS_GAME__.snapshot()));
function attach(page,bucket){
  page.on('console',m=>{if(m.type()==='error')bucket.errors.push(`console:${m.text()}`)});
  page.on('pageerror',e=>bucket.errors.push(`pageerror:${e.message}`));
  page.on('requestfailed',r=>bucket.errors.push(`requestfailed:${r.url()} ${r.failure()?.errorText||''}`));
}
async function boot(page){
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__PAWS_GAME__&&window.__PAWS_QA__,null,{timeout:30000});
  await page.waitForTimeout(1200);
}
async function enterFirstLevel(page,{touch=false}={}){
  const act=touch?'tap':'click';
  await page.locator('[data-play]')[act]();
  await page.locator('[data-level="ch1-l1"]')[act]();
  await page.locator('[data-tier="kitten"]')[act]();
  await page.locator('[data-start]')[act]();
  await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing',null,{timeout:10000});
  await page.waitForTimeout(300);
}
async function restartClean(page){
  await page.evaluate(()=>window.__PAWS_GAME__.restart());
  await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing',null,{timeout:4000});
  await page.waitForTimeout(260);
}
async function waitForActive(page,value,timeout=900){
  try{await page.waitForFunction(v=>window.__PAWS_GAME__?.snapshot()?.activeCat===v,value,{timeout});return true;}catch{return false;}
}

async function desktop(browser){
  const bucket=report.desktop;
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage(); attach(page,bucket); await boot(page);
  check(bucket,'title renders',(await page.title()).includes('Paws on the Run'),await page.title());
  check(bucket,'build identity',(await page.locator('#build').innerText()).includes('1.0.0-beta.2'),await page.locator('#build').innerText());
  check(bucket,'QA boot has no errors',(await page.evaluate(()=>window.__PAWS_QA__.errors.length))===0,JSON.stringify(await page.evaluate(()=>window.__PAWS_QA__.errors)));
  await shot(page,'desktop-01-title.png');
  await page.locator('[data-play]').click();
  check(bucket,'chapter two locked initially',await page.locator('[data-level="ch2-l1"]').isDisabled());
  await shot(page,'desktop-02-map.png');
  await page.locator('[data-level="ch1-l1"]').click();
  check(bucket,'kitten default selected',await page.locator('[data-tier="kitten"]').evaluate(el=>el.classList.contains('selected')));
  await page.locator('[data-start]').click();
  await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing'); await page.waitForTimeout(300);

  const initialFrame=await page.evaluate(()=>window.__PAWS_GAME__.framing());
  check(bucket,'active cat starts inside camera frame',initialFrame?.catVisible,JSON.stringify(initialFrame));
  await page.evaluate(()=>window.__PAWS_GAME__.placeHenleyNear(7.2)); await page.waitForTimeout(420);
  const closeFrame=await page.evaluate(()=>window.__PAWS_GAME__.framing());
  check(bucket,'camera keeps cat and Henley visible inside 8m',closeFrame?.distance<8&&closeFrame?.catVisible&&closeFrame?.henleyVisible,JSON.stringify(closeFrame));
  await restartClean(page);
  await page.evaluate(()=>window.__PAWS_GAME__.placeHenleyNear(10)); await page.waitForTimeout(70);
  const bearingFrame=await page.evaluate(()=>window.__PAWS_GAME__.framing());
  check(bucket,'off-screen Henley has directional indicator',bearingFrame?.henleyVisible||bearingFrame?.indicatorVisible,JSON.stringify(bearingFrame));
  await restartClean(page);

  const switch0=await snap(page); const inactive0=1-switch0.activeCat;
  await page.keyboard.press('q'); const switched1=await waitForActive(page,inactive0); const switch1=await snap(page);
  check(bucket,'Q switch is consumed reliably',switched1&&!switch1.cats[inactive0].captured,`active=${switch1.activeCat}, target=${inactive0}, targetCaptured=${switch1.cats[inactive0].captured}, mode=${switch1.mode}`);
  await page.keyboard.press('q'); const switched2=await waitForActive(page,switch0.activeCat); const switch2=await snap(page);
  check(bucket,'second Q switch returns control',switched2,`active=${switch2.activeCat}, expected=${switch0.activeCat}, mode=${switch2.mode}`);

  const s0=await snap(page), c0={...s0.cats[s0.activeCat]};
  await page.keyboard.down('w'); await page.waitForTimeout(850); await page.keyboard.up('w'); await page.waitForTimeout(120);
  const s1=await snap(page); check(bucket,'keyboard movement is responsive',dist(c0,s1.cats[s1.activeCat])>.3,`distance=${dist(c0,s1.cats[s1.activeCat]).toFixed(3)}, mode=${s1.mode}`);
  await page.keyboard.press('Space'); let maxY=0; for(let i=0;i<9;i++){await page.waitForTimeout(55);const s=await snap(page);if(s)maxY=Math.max(maxY,s.cats[s.activeCat].y)}
  check(bucket,'jump reaches airborne state',maxY>.08,`maxY=${maxY.toFixed(3)}`);

  if((await snap(page))?.mode==='playing'){
    await page.keyboard.press('p');
    try{await page.waitForFunction(()=>window.__PAWS_QA__?.paused===true,null,{timeout:900});}catch{}
    check(bucket,'pause screen renders',await page.getByText('Catch your breath.',{exact:true}).isVisible().catch(()=>false));
    if(await page.locator('[data-resume]').isVisible().catch(()=>false)){await page.locator('[data-resume]').click();await page.waitForFunction(()=>window.__PAWS_QA__?.paused===false);}
  }else check(bucket,'pause screen renders',false,`game left playing state early: ${(await snap(page))?.mode}`);

  if((await snap(page))?.mode==='playing'){
    for(let i=0;i<8;i++){await page.keyboard.press(i%2?'Space':'q');await page.keyboard.press(i%2?'d':'a');} await page.waitForTimeout(450);
  }
  check(bucket,'rapid repeated input has no QA errors',(await page.evaluate(()=>window.__PAWS_QA__.errors.length))===0,JSON.stringify(await page.evaluate(()=>window.__PAWS_QA__.errors)));
  check(bucket,'draw calls under budget',(await page.evaluate(()=>window.__PAWS_QA__.drawCalls))<300,`drawCalls=${await page.evaluate(()=>window.__PAWS_QA__.drawCalls)}`);
  await shot(page,'desktop-03-gameplay.png');

  await restartClean(page);
  await page.evaluate(()=>window.__PAWS_GAME__.completeRoute());
  try{await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='success',null,{timeout:1200});}catch{}
  await page.waitForTimeout(300);
  check(bucket,'success/results state renders',await page.getByText('Snack Run complete',{exact:true}).isVisible().catch(()=>false),`mode=${await page.evaluate(()=>window.__PAWS_QA__.mode)}`);
  await shot(page,'desktop-04-success.png');

  if(await page.locator('[data-replay]').isVisible().catch(()=>false)){await page.locator('[data-replay]').click();await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');
    let caught=false; for(let i=0;i<220;i++){await page.waitForTimeout(100);if((await snap(page))?.mode==='caught'){caught=true;break;}}
    check(bucket,'Henley can naturally catch idle active cat',caught,`mode=${(await snap(page))?.mode}`); await page.waitForTimeout(250);
    check(bucket,'caught screen renders',await page.getByText('Caught!',{exact:true}).isVisible().catch(()=>false)); await shot(page,'desktop-05-caught.png');
    if(await page.locator('[data-retry]').isVisible().catch(()=>false)){await page.locator('[data-retry]').click();await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');check(bucket,'retry returns to gameplay',true);}else check(bucket,'retry returns to gameplay',false,'retry button unavailable');
  }else{
    check(bucket,'Henley can naturally catch idle active cat',false,'success replay unavailable');
    check(bucket,'caught screen renders',false,'success replay unavailable');
    check(bucket,'retry returns to gameplay',false,'success replay unavailable');
  }
  check(bucket,'desktop browser emitted no errors',bucket.errors.length===0,bucket.errors.join(' | '));
  await context.close();
}

async function mobile(browser){
  const bucket=report.mobile;
  const context=await browser.newContext({...devices['iPhone 14'],locale:'en-US'});
  const page=await context.newPage(); attach(page,bucket); await boot(page); await enterFirstLevel(page,{touch:true});
  const metrics=await page.evaluate(()=>({iw:innerWidth,sw:document.documentElement.scrollWidth,ih:innerHeight,sh:document.documentElement.scrollHeight,touch:getComputedStyle(document.documentElement).touchAction}));
  check(bucket,'mobile has no horizontal overflow',metrics.sw<=metrics.iw+1,JSON.stringify(metrics));
  let framing=await page.evaluate(()=>window.__PAWS_GAME__.framing());
  check(bucket,'mobile active cat starts inside camera frame',framing?.catVisible,JSON.stringify(framing));

  const original=await snap(page),inactive=1-original.activeCat;
  const inactivePoint=await page.evaluate(i=>window.__PAWS_GAME__.projectCat(i),inactive);
  check(bucket,'inactive cat is tappable in initial mobile frame',inactivePoint?.visible,JSON.stringify(inactivePoint));
  if(inactivePoint?.visible){await page.touchscreen.tap(inactivePoint.x,inactivePoint.y);const switched=await waitForActive(page,inactive);check(bucket,'touching inactive cat switches control',switched,`active=${(await snap(page)).activeCat}, expected=${inactive}`);}else check(bucket,'touching inactive cat switches control',false,'inactive cat offscreen');
  await restartClean(page);

  const box=await page.locator('#scene').boundingBox(); if(!box)throw new Error('canvas missing');
  const cx=box.x+box.width*.48, cy=box.y+box.height*.72;
  const s0=await snap(page), c0={...s0.cats[s0.activeCat]};
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1,radiusX:4,radiusY:4,force:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+68,y:cy-94,id:1,radiusX:4,radiusY:4,force:1}]});
  await page.waitForTimeout(850); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await page.waitForTimeout(140);
  const s1=await snap(page); check(bucket,'direct touch drag steers cat',dist(c0,s1.cats[s1.activeCat])>.28,`distance=${dist(c0,s1.cats[s1.activeCat]).toFixed(3)}, mode=${s1.mode}`);
  if(s1.mode==='playing'){
    const jumpX=box.x+box.width*.14,jumpY=box.y+box.height*.80;
    await page.touchscreen.tap(jumpX,jumpY); let maxY=0; for(let i=0;i<10;i++){await page.waitForTimeout(50);const s=await snap(page);if(s)maxY=Math.max(maxY,s.cats[s.activeCat].y)}
    check(bucket,'touch tap on open gameplay surface jumps',maxY>.08,`maxY=${maxY.toFixed(3)}`);
  }else check(bucket,'touch tap on open gameplay surface jumps',false,`game left playing state early: ${s1.mode}`);
  check(bucket,'mobile draw calls under budget',(await page.evaluate(()=>window.__PAWS_QA__.drawCalls))<300,`drawCalls=${await page.evaluate(()=>window.__PAWS_QA__.drawCalls)}`);
  check(bucket,'mobile QA has no errors',(await page.evaluate(()=>window.__PAWS_QA__.errors.length))===0,JSON.stringify(await page.evaluate(()=>window.__PAWS_QA__.errors)));
  await shot(page,'mobile-01-gameplay.png');

  await restartClean(page);
  await page.evaluate(()=>window.__PAWS_GAME__.placeHenleyNear(7.2)); await page.waitForTimeout(650);
  framing=await page.evaluate(()=>window.__PAWS_GAME__.framing());
  check(bucket,'mobile camera keeps cat and Henley visible inside 8m',framing?.distance<8&&framing?.catVisible&&framing?.henleyVisible,JSON.stringify(framing));
  await shot(page,'mobile-02-pressure-frame.png');

  await restartClean(page);
  await page.locator('#pause-button').tap();try{await page.waitForFunction(()=>window.__PAWS_QA__?.paused===true,null,{timeout:900});}catch{}await shot(page,'mobile-03-pause.png');
  check(bucket,'mobile pause is usable',await page.locator('[data-resume]').isVisible().catch(()=>false),`mode=${await page.evaluate(()=>window.__PAWS_QA__.mode)}, paused=${await page.evaluate(()=>window.__PAWS_QA__.paused)}`);
  if(await page.locator('[data-resume]').isVisible().catch(()=>false)){await page.locator('[data-resume]').tap();await page.waitForFunction(()=>window.__PAWS_QA__?.paused===false);}
  check(bucket,'mobile browser emitted no errors',bucket.errors.length===0,bucket.errors.join(' | '));
  await context.close();
}

let browser;
try{
  browser=await chromium.launch({headless:true});
  await desktop(browser); await mobile(browser);
}catch(error){report.fatal=error.stack||String(error);}
finally{
  if(browser)await browser.close();
  report.pass=[...report.desktop.checks,...report.mobile.checks].every(x=>x.ok)&&report.desktop.errors.length===0&&report.mobile.errors.length===0&&!report.fatal;
  fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
}
