import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE='http://127.0.0.1:4173/?qa=1';
const outDir='paws-beta-v2-qa-results';
fs.mkdirSync(outDir,{recursive:true});
const report={timestamp:new Date().toISOString(),desktop:{checks:[],errors:[]},mobile:{checks:[],errors:[]},pass:false};
const check=(bucket,name,ok,detail='')=>{bucket.checks.push({name,ok:!!ok,detail});if(!ok)throw new Error(`${name}: ${detail||'failed'}`)};
const shot=async(page,name)=>{const p=path.join(outDir,name);await page.screenshot({path:p,fullPage:true});fs.writeFileSync(`${p}.b64`,fs.readFileSync(p).toString('base64'));};
const attachErrors=(page,bucket)=>{page.on('console',m=>{if(m.type()==='error')bucket.errors.push(`console: ${m.text()}`)});page.on('pageerror',e=>bucket.errors.push(`pageerror: ${e.message}`));page.on('requestfailed',r=>bucket.errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText||''}`));};
async function waitGame(page){await page.waitForFunction(()=>window.__PAWS_GAME__&&window.__PAWS_QA__,null,{timeout:30000});}
const snap=p=>p.evaluate(()=>structuredClone(window.__PAWS_GAME__.snapshot()));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

async function desktop(browser){
 const bucket=report.desktop;
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();attachErrors(page,bucket);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});await waitGame(page);await page.waitForTimeout(1200);
 check(bucket,'title renders',(await page.title()).includes('Paws on the Run'),await page.title());
 check(bucket,'QA boot has no errors',(await page.evaluate(()=>window.__PAWS_QA__.errors?.length||0))===0,JSON.stringify(await page.evaluate(()=>window.__PAWS_QA__.errors)));
 await shot(page,'desktop-01-title.png');
 await page.locator('[data-play]').click();
 check(bucket,'level map renders',await page.locator('[data-level="ch1-l1"]').isVisible());
 check(bucket,'chapter 2 initially locked',await page.locator('[data-level="ch2-l1"]').isDisabled());
 await shot(page,'desktop-02-map.png');
 await page.locator('[data-tier="kitten"]').click();
 check(bucket,'difficulty selection updates',await page.locator('[data-tier="kitten"]').evaluate(el=>el.classList.contains('selected')));
 await page.locator('[data-level="ch1-l1"]').click();await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');await page.waitForTimeout(500);
 const s0=await snap(page);const c0={...s0.cats[s0.activeCat]};
 await page.keyboard.down('w');await page.waitForTimeout(800);await page.keyboard.up('w');await page.waitForTimeout(120);
 const s1=await snap(page);check(bucket,'keyboard steering moves active cat',dist(c0,s1.cats[s1.activeCat])>.35,`distance=${dist(c0,s1.cats[s1.activeCat]).toFixed(3)}`);
 await page.keyboard.press('Space');let jumped=false,maxY=0;for(let i=0;i<8;i++){await page.waitForTimeout(60);const s=await snap(page);maxY=Math.max(maxY,s.cats[s.activeCat].y);if(maxY>.08)jumped=true;}check(bucket,'space jump produces airborne state',jumped,`maxY=${maxY.toFixed(3)}`);
 const beforeSwitch=(await snap(page)).activeCat;await page.keyboard.press('q');await page.waitForTimeout(120);const afterSwitch=(await snap(page)).activeCat;check(bucket,'Q switches cats',beforeSwitch!==afterSwitch,`${beforeSwitch}->${afterSwitch}`);
 await page.keyboard.press('p');await page.waitForFunction(()=>window.__PAWS_QA__?.paused===true);check(bucket,'pause freezes run',await page.getByText('Paused',{exact:true}).isVisible());
 await page.locator('[data-resume]').click();await page.waitForFunction(()=>window.__PAWS_QA__?.paused===false);check(bucket,'resume restores run',true);
 for(let i=0;i<6;i++){await page.keyboard.press(i%2?'Space':'q');await page.keyboard.press(i%2?'d':'a');}
 await page.waitForTimeout(500);
 check(bucket,'rapid repeated input does not produce QA errors',(await page.evaluate(()=>window.__PAWS_QA__.errors?.length||0))===0,JSON.stringify(await page.evaluate(()=>window.__PAWS_QA__.errors)));
 await shot(page,'desktop-03-gameplay.png');
 // Natural failure: restart, then allow Henley to catch an idle active cat.
 await page.keyboard.press('p');await page.waitForFunction(()=>window.__PAWS_QA__?.paused===true);await page.locator('[data-restart]').click();await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');
 let caught=false;for(let i=0;i<250;i++){await page.waitForTimeout(100);if((await snap(page)).mode==='caught'){caught=true;break;}}
 check(bucket,'Henley can naturally end an idle run',caught,`mode=${(await snap(page)).mode}`);
 check(bucket,'caught failure screen renders',await page.getByText('Caught!',{exact:true}).isVisible());
 await shot(page,'desktop-04-caught.png');
 await page.locator('[data-retry]').click();await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');check(bucket,'retry returns to gameplay',true);
 await context.close();
}

async function mobile(browser){
 const bucket=report.mobile;
 const context=await browser.newContext({...devices['iPhone 14'],locale:'en-US'});
 const page=await context.newPage();attachErrors(page,bucket);
 const cdp=await context.newCDPSession(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});await waitGame(page);await page.waitForTimeout(900);
 await page.locator('[data-play]').tap();await page.locator('[data-tier="kitten"]').tap();await page.locator('[data-level="ch1-l1"]').tap();await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');await page.waitForTimeout(400);
 const metrics=await page.evaluate(()=>({iw:innerWidth,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,ih:innerHeight,touch:getComputedStyle(document.documentElement).touchAction}));
 check(bucket,'mobile layout has no horizontal overflow',metrics.sw<=metrics.iw+1,JSON.stringify(metrics));
 const box=await page.locator('#scene').boundingBox();if(!box)throw new Error('canvas missing');
 const cx=box.x+box.width*.5,cy=box.y+box.height*.68;
 const s0=await snap(page);const c0={...s0.cats[s0.activeCat]};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1,radiusX:4,radiusY:4,force:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+80,y:cy-95,id:1,radiusX:4,radiusY:4,force:1}]});
 await page.waitForTimeout(850);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(150);
 const s1=await snap(page);check(bucket,'direct touch drag steers cat',dist(c0,s1.cats[s1.activeCat])>.30,`distance=${dist(c0,s1.cats[s1.activeCat]).toFixed(3)}`);
 await page.touchscreen.tap(cx,cy);let jumped=false,maxY=0;for(let i=0;i<8;i++){await page.waitForTimeout(60);const s=await snap(page);maxY=Math.max(maxY,s.cats[s.activeCat].y);if(maxY>.08)jumped=true;}check(bucket,'touch tap jumps',jumped,`maxY=${maxY.toFixed(3)}`);
 check(bucket,'mobile QA has no runtime errors',(await page.evaluate(()=>window.__PAWS_QA__.errors?.length||0))===0,JSON.stringify(await page.evaluate(()=>window.__PAWS_QA__.errors)));
 await shot(page,'mobile-01-gameplay.png');
 await page.evaluate(()=>window.__PAWS_GAME__.pause());await page.waitForFunction(()=>window.__PAWS_QA__?.paused===true);await shot(page,'mobile-02-pause.png');
 await page.locator('[data-resume]').tap();await page.waitForFunction(()=>window.__PAWS_QA__?.paused===false);
 await context.close();
}

let browser;
try{
 browser=await chromium.launch({headless:true});
 await desktop(browser);
 await mobile(browser);
 report.pass=[...report.desktop.checks,...report.mobile.checks].every(x=>x.ok)&&report.desktop.errors.length===0&&report.mobile.errors.length===0;
}catch(e){report.fatal=e.stack||String(e);report.pass=false;process.exitCode=1;}finally{if(browser)await browser.close();fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
