import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE=process.env.QA_URL||'http://127.0.0.1:4173/?qa=1';
const outDir=path.resolve('qa-results/henley-redesign');fs.mkdirSync(outDir,{recursive:true});
const report={checks:[],errors:[],pass:false,timestamp:new Date().toISOString()};
const check=(name,ok,detail='')=>report.checks.push({name,ok:!!ok,detail});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(`pageerror:${e.message}`));page.on('console',m=>{if(m.type()==='error')report.errors.push(`console:${m.text()}`)});page.on('requestfailed',r=>report.errors.push(`requestfailed:${r.url()}`));
  await page.goto(BASE,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__PAWS_GAME__&&window.__HENLEY_QA__,null,{timeout:30000});
  check('storybook title is visible',await page.locator('text=HENLEY').first().isVisible());
  await page.locator('[data-play]').click();await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');
  const initial=await page.evaluate(()=>({state:window.__PAWS_GAME__.snapshot(),character:window.__HENLEY_QA__.storybookCharacter}));
  check('Henley is the playable human storybook character',initial.character.storybook&&initial.character.visible,JSON.stringify(initial.character));
  check('roundup starts with two autonomous cats',initial.state.cats.length===2&&initial.state.petsReady===0,JSON.stringify(initial.state.cats));
  await page.keyboard.down('w');await page.waitForTimeout(700);await page.keyboard.up('w');const moved=await page.evaluate(()=>window.__PAWS_GAME__.snapshot());
  check('keyboard/direct movement advances Henley',Math.hypot(moved.henley.x-initial.state.henley.x,moved.henley.z-initial.state.henley.z)>.35,JSON.stringify({before:initial.state.henley,after:moved.henley}));
  await page.evaluate(()=>window.__PAWS_GAME__.teleportHenleyToToy());await page.evaluate(()=>window.__PAWS_GAME__.interact());await page.waitForTimeout(150);const toy=await page.evaluate(()=>({state:window.__PAWS_GAME__.snapshot(),character:window.__HENLEY_QA__.storybookCharacter}));
  check('toy pickup changes the objective loop',toy.state.toyPicked&&toy.state.stage==='roundup'&&toy.character.holdingToy,JSON.stringify(toy));
  await page.screenshot({path:path.join(outDir,'desktop-gameplay.png'),fullPage:true});
  await page.evaluate(()=>window.__PAWS_GAME__.completeRoundup());await page.waitForTimeout(120);await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='success',{timeout:3000}).catch(()=>{});const done=await page.evaluate(()=>window.__PAWS_GAME__.snapshot());
  check('both cats on the rug completes Kitchen Roundup',done.mode==='success'&&done.petsReady===2,JSON.stringify(done));
  await page.waitForTimeout(350);await page.screenshot({path:path.join(outDir,'desktop-success.png'),fullPage:true});
  await context.close();

  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const mp=await mobile.newPage();
  mp.on('pageerror',e=>report.errors.push(`mobile-pageerror:${e.message}`));mp.on('console',m=>{if(m.type()==='error')report.errors.push(`mobile-console:${m.text()}`)});
  await mp.goto(BASE,{waitUntil:'networkidle'});await mp.waitForFunction(()=>window.__PAWS_GAME__&&window.__HENLEY_QA__,null,{timeout:30000});await mp.locator('[data-play]').click();await mp.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');
  const before=await mp.evaluate(()=>window.__PAWS_GAME__.snapshot().henley);await mp.mouse.move(195,640);await mp.mouse.down();await mp.mouse.move(195,510,{steps:10});await mp.waitForTimeout(650);await mp.mouse.up();const after=await mp.evaluate(()=>window.__PAWS_GAME__.snapshot().henley);
  check('mobile drag moves Henley without virtual controls',Math.hypot(after.x-before.x,after.z-before.z)>.25,JSON.stringify({before,after}));
  const overflow=await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight);
  check('mobile viewport has no browser overflow',!overflow,`overflow=${overflow}`);
  await mp.screenshot({path:path.join(outDir,'mobile-gameplay.png'),fullPage:true});await mobile.close();
}catch(error){report.fatal=error.stack||String(error);}
finally{if(browser)await browser.close();report.pass=report.checks.every(c=>c.ok)&&report.errors.length===0&&!report.fatal;fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;}
