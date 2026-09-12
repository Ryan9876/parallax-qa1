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
  await page.locator('[data-play]').click();await page.locator('[data-level="ch1-l1"]').click();await page.locator('[data-tier="kitten"]').click();await page.locator('[data-start]').click();await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');
  try{await page.waitForFunction(()=>{const a=window.__POTR_QA__.audioAssets;return a.total>=18&&a.ready===a.total&&a.voiceReady===4&&a.loops.length===2&&a.errors.length===0;},null,{timeout:9000});}catch{}
  await page.waitForTimeout(600);
  const activeCharacters=await page.evaluate(()=>window.__POTR_QA__.characterAssets),audio=await page.evaluate(()=>window.__POTR_QA__.audioAssets);
  check('animation mixer selects active authored clips',activeCharacters.cats.every(c=>!!c.current)&&!!activeCharacters.henley?.current,JSON.stringify(activeCharacters));
  check('all sampled gameplay audio, background bed and Henley voice decode in Chromium',audio.total>=18&&audio.ready===audio.total&&audio.voiceReady===4&&audio.errors.length===0,JSON.stringify(audio));
  check('music and ambience run as exactly two low-level loops',audio.loops.length===2&&audio.loops.includes('music')&&audio.loops.includes('ambience'),JSON.stringify(audio.loops));
  await page.evaluate(()=>{window.__POTR_QA__.playAudioGroup('land');window.__POTR_QA__.playAudioGroup('land');});await page.waitForTimeout(80);
  const landingAudio=await page.evaluate(()=>window.__POTR_QA__.audioAssets),landHistory=landingAudio.history?.land||[];
  check('consecutive landing events use different samples',landHistory.length>=2&&landHistory.at(-1)!==landHistory.at(-2),JSON.stringify(landHistory));
  for(let i=0;i<5;i++){await page.evaluate(()=>window.__PAWS_GAME__.restart());await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');try{await page.waitForFunction(()=>window.__POTR_QA__.audioAssets.loops.length===2,null,{timeout:2500});}catch{}}
  const restartedAudio=await page.evaluate(()=>window.__POTR_QA__.audioAssets);
  check('five restarts leave one music loop and one ambience loop',restartedAudio.loops.length===2&&new Set(restartedAudio.loops).size===2,JSON.stringify(restartedAudio));
  await page.screenshot({path:path.join(outDir,'desktop-authored-scene.png'),fullPage:true});
  await page.evaluate(()=>window.__PAWS_GAME__.placeHenleyNear(.48));
  try{await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='caught',null,{timeout:2500});}catch{}
  try{await page.waitForFunction(()=>Number(window.__POTR_QA__.audioAssets.plays?.henleyCatch||0)>=1,null,{timeout:1800});}catch{}
  const caughtAudio=await page.evaluate(()=>window.__POTR_QA__.audioAssets);
  check('terminal Henley catch invokes a rate-limited voice line',Number(caughtAudio.plays?.caught||0)>=1&&Number(caughtAudio.plays?.henleyCatch||0)>=1,JSON.stringify(caughtAudio.plays||{}));
  const uniqueHttp=[...new Set(report.requests.filter(u=>/^https?:/.test(u)))];
  const thirdParty=uniqueHttp.filter(url=>{try{return new URL(url).origin!==appOrigin;}catch{return false;}});
  check('all actual runtime HTTP requests stay on app origin',thirdParty.length===0,JSON.stringify(thirdParty));
  await context.close();
}catch(error){report.fatal=error.stack||String(error);}
finally{if(browser)await browser.close();report.pass=report.checks.every(c=>c.ok)&&report.errors.length===0&&!report.fatal;fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;}
