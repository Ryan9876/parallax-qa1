import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE=process.env.QA_URL||'http://127.0.0.1:4173/?qa=1';
const appOrigin=new URL(BASE).origin;
const outDir=path.resolve('qa-results/runtime');fs.mkdirSync(outDir,{recursive:true});
const report={checks:[],errors:[],requests:[],pass:false,timestamp:new Date().toISOString()};
const check=(name,ok,detail='')=>report.checks.push({name,ok:!!ok,detail});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(`pageerror:${e.message}`));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(`console:${m.text()}`)});
  page.on('request',request=>{const url=request.url();report.requests.push(url);try{const u=new URL(url);if(/^https?:$/.test(u.protocol)&&u.origin!==appOrigin)report.errors.push(`third-party-runtime-request:${url}`);}catch{}});
  page.on('requestfailed',r=>report.errors.push(`requestfailed:${r.url()} ${r.failure()?.errorText||''}`));
  await page.goto(BASE,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__POTR_QA__&&window.__PAWS_GAME__,null,{timeout:30000});
  try{await page.waitForFunction(()=>{const a=window.__POTR_QA__.visualAssets,c=window.__POTR_QA__.characterAssets;return a.sofa&&a.coffee&&a.environment&&a.errors.length===0&&c.ready;},null,{timeout:12000});}catch{}
  const assets=await page.evaluate(()=>window.__POTR_QA__.visualAssets),characters=await page.evaluate(()=>window.__POTR_QA__.characterAssets);
  check('Kenney authored furniture parsed',assets.sofa&&assets.coffee,JSON.stringify(assets));
  check('Poly Haven HDRI environment parsed',assets.environment,JSON.stringify(assets));
  check('three character contact shadows are configured',assets.contactShadows===3,`count=${assets.contactShadows}`);
  check('visual asset loader has no errors',assets.errors.length===0,JSON.stringify(assets.errors));
  check('two authored cat rigs loaded without fallback',characters.ready&&characters.cats.length===2&&characters.cats.every(c=>c&&!c.failed&&c.species==='cat'),JSON.stringify(characters));
  check('authored Henley rig loaded without fallback',!!characters.henley&&!characters.henley.failed&&characters.henley.species==='dog',JSON.stringify(characters.henley));
  check('authored rigs expose animation clips',characters.cats.every(c=>c.clips.length>0)&&characters.henley?.clips.length>0,JSON.stringify({cats:characters.cats.map(c=>c.clips),henley:characters.henley?.clips}));
  check('cat cosmetic/head sockets exist',characters.cats.every(c=>c.collar&&c.head),JSON.stringify(characters.cats));
  await page.locator('[data-play]').click();await page.locator('[data-level="ch1-l1"]').click();await page.locator('[data-tier="kitten"]').click();await page.locator('[data-start]').click();await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');await page.waitForTimeout(1200);
  const activeCharacters=await page.evaluate(()=>window.__POTR_QA__.characterAssets);
  check('animation mixer selects active authored clips',activeCharacters.cats.every(c=>!!c.current)&&!!activeCharacters.henley?.current,JSON.stringify(activeCharacters));
  await page.screenshot({path:path.join(outDir,'desktop-authored-scene.png'),fullPage:true});
  const uniqueHttp=[...new Set(report.requests.filter(u=>/^https?:/.test(u)))];
  const thirdParty=uniqueHttp.filter(url=>{try{return new URL(url).origin!==appOrigin;}catch{return false;}});
  check('all actual runtime HTTP requests stay on app origin',thirdParty.length===0,JSON.stringify(thirdParty));
  await context.close();
}catch(error){report.fatal=error.stack||String(error);}
finally{if(browser)await browser.close();report.pass=report.checks.every(c=>c.ok)&&report.errors.length===0&&!report.fatal;fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;}
