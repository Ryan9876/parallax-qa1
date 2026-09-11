import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.QA_URL || 'http://127.0.0.1:4173/?qa=1';
const outDir = path.resolve('qa-results');
fs.mkdirSync(outDir,{recursive:true});
const report={timestamp:new Date().toISOString(),desktop:{checks:[],errors:[]},mobile:{checks:[],errors:[]},pass:false};
const check=(bucket,name,ok,detail='')=>{bucket.checks.push({name,ok:!!ok,detail});if(!ok)throw new Error(`${name}: ${detail||'failed'}`)};
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
  await page.waitForTimeout(400);
}

async function desktop(browser){
  const bucket=report.desktop;
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage(); attach(page,bucket); await boot(page);
  check(bucket,'title renders',(await page.title()).includes('Paws on the Run'),await page.title());
  check(bucket,'build identity',await page.locator('#build').getAttribute('textContent').catch(()=>null)!==null || (await page.locator('#build').innerText()).includes('1.0.0-beta.2'));
  check(bucket,'QA boot has no errors',(await page.evaluate(()=>window.__PAWS_QA__.errors.length))===0,JSON.stringify(await page.evaluate(()=>window.__PAWS_QA__.errors)));
  await shot(page,'desktop-01-title.png');
  await page.locator('[data-play]').click();
  check(bucket,'chapter two locked initially',await page.locator('[data-level="ch2-l1"]').isDisabled());
  await shot(page,'desktop-02-map.png');
  await page.locator('[data-level="ch1-l1"]').click();
  check(bucket,'kitten default selected',await page.locator('[data-tier="kitten"]').evaluate(el=>el.classList.contains('selected')));
  await page.locator('[data-start]').click();
  await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing'); await page.waitForTimeout(500);
  const s0=await snap(page), c0={...s0.cats[s0.activeCat]};
  await page.keyboard.down('w'); await page.waitForTimeout(850); await page.keyboard.up('w'); await page.waitForTimeout(120);
  const s1=await snap(page); check(bucket,'keyboard movement is responsive',dist(c0,s1.cats[s1.activeCat])>.3,`distance=${dist(c0,s1.cats[s1.activeCat]).toFixed(3)}`);
  await page.keyboard.press('Space'); let maxY=0; for(let i=0;i<9;i++){await page.waitForTimeout(55);maxY=Math.max(maxY,(await snap(page)).cats[(await snap(page)).activeCat].y)}
  check(bucket,'jump reaches airborne state',maxY>.08,`maxY=${maxY.toFixed(3)}`);
  const before=(await snap(page)).activeCat; await page.keyboard.press('q'); await page.waitForTimeout(120); const after=(await snap(page)).activeCat;
  check(bucket,'Q switches cats',before!==after,`${before}->${after}`);
  await page.keyboard.press('p'); await page.waitForFunction(()=>window.__PAWS_QA__?.paused===true); check(bucket,'pause screen renders',await page.getByText('Catch your breath.',{exact:true}).isVisible());
  await page.locator('[data-resume]').click(); await page.waitForFunction(()=>window.__PAWS_QA__?.paused===false);
  for(let i=0;i<8;i++){await page.keyboard.press(i%2?'Space':'q');await page.keyboard.press(i%2?'d':'a');} await page.waitForTimeout(450);
  check(bucket,'rapid repeated input has no QA errors',(await page.evaluate(()=>window.__PAWS_QA__.errors.length))===0,JSON.stringify(await page.evaluate(()=>window.__PAWS_QA__.errors)));
  check(bucket,'draw calls under budget',(await page.evaluate(()=>window.__PAWS_QA__.drawCalls))<300,`drawCalls=${await page.evaluate(()=>window.__PAWS_QA__.drawCalls)}`);
  await shot(page,'desktop-03-gameplay.png');
  await page.evaluate(()=>window.__PAWS_GAME__.completeRoute()); await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='success'); await page.waitForTimeout(300);
  check(bucket,'success/results state renders',await page.getByText('Snack Run complete',{exact:true}).isVisible()); await shot(page,'desktop-04-success.png');
  await page.locator('[data-replay]').click(); await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');
  let caught=false; for(let i=0;i<180;i++){await page.waitForTimeout(100);if((await snap(page))?.mode==='caught'){caught=true;break;}}
  check(bucket,'Henley can naturally catch idle active cat',caught,`mode=${(await snap(page))?.mode}`); await page.waitForTimeout(250);
  check(bucket,'caught screen renders',await page.getByText('Caught!',{exact:true}).isVisible()); await shot(page,'desktop-05-caught.png');
  await page.locator('[data-retry]').click(); await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');
  check(bucket,'retry returns to gameplay',true);
  check(bucket,'desktop browser emitted no errors',bucket.errors.length===0,bucket.errors.join(' | '));
  await context.close();
}

async function mobile(browser){
  const bucket=report.mobile;
  const context=await browser.newContext({...devices['iPhone 14'],locale:'en-US'});
  const page=await context.newPage(); attach(page,bucket); await boot(page); await enterFirstLevel(page,{touch:true});
  const metrics=await page.evaluate(()=>({iw:innerWidth,sw:document.documentElement.scrollWidth,ih:innerHeight,sh:document.documentElement.scrollHeight,touch:getComputedStyle(document.documentElement).touchAction}));
  check(bucket,'mobile has no horizontal overflow',metrics.sw<=metrics.iw+1,JSON.stringify(metrics));
  const box=await page.locator('#scene').boundingBox(); if(!box)throw new Error('canvas missing');
  const cx=box.x+box.width*.48, cy=box.y+box.height*.72;
  const s0=await snap(page), c0={...s0.cats[s0.activeCat]};
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1,radiusX:4,radiusY:4,force:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+68,y:cy-94,id:1,radiusX:4,radiusY:4,force:1}]});
  await page.waitForTimeout(850); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await page.waitForTimeout(140);
  const s1=await snap(page); check(bucket,'direct touch drag steers cat',dist(c0,s1.cats[s1.activeCat])>.28,`distance=${dist(c0,s1.cats[s1.activeCat]).toFixed(3)}`);
  await page.touchscreen.tap(cx,cy); let maxY=0; for(let i=0;i<9;i++){await page.waitForTimeout(55);const s=await snap(page);maxY=Math.max(maxY,s.cats[s.activeCat].y)}
  check(bucket,'touch tap jumps',maxY>.08,`maxY=${maxY.toFixed(3)}`);
  check(bucket,'mobile draw calls under budget',(await page.evaluate(()=>window.__PAWS_QA__.drawCalls))<300,`drawCalls=${await page.evaluate(()=>window.__PAWS_QA__.drawCalls)}`);
  check(bucket,'mobile QA has no errors',(await page.evaluate(()=>window.__PAWS_QA__.errors.length))===0,JSON.stringify(await page.evaluate(()=>window.__PAWS_QA__.errors)));
  await shot(page,'mobile-01-gameplay.png');
  await page.locator('#pause-button').tap(); await page.waitForFunction(()=>window.__PAWS_QA__?.paused===true); await shot(page,'mobile-02-pause.png');
  await page.locator('[data-resume]').tap(); await page.waitForFunction(()=>window.__PAWS_QA__?.paused===false);
  check(bucket,'mobile browser emitted no errors',bucket.errors.length===0,bucket.errors.join(' | '));
  await context.close();
}

let browser;
try{
  browser=await chromium.launch({headless:true});
  await desktop(browser); await mobile(browser);
  report.pass=[...report.desktop.checks,...report.mobile.checks].every(x=>x.ok)&&report.desktop.errors.length===0&&report.mobile.errors.length===0;
}catch(error){report.fatal=error.stack||String(error);report.pass=false;process.exitCode=1;}
finally{if(browser)await browser.close();fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
