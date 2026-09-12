import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE=process.env.QA_URL||'http://127.0.0.1:4173/?qa=1';
const outDir=path.resolve('qa-results/animation');fs.mkdirSync(outDir,{recursive:true});
const report={checks:[],errors:[],pass:false,timestamp:new Date().toISOString()};
const check=(name,ok,detail='')=>{report.checks.push({name,ok:!!ok,detail});return !!ok;};
const shot=(page,name)=>page.screenshot({path:path.join(outDir,name),fullPage:true});
const cats=page=>page.evaluate(()=>window.__POTR_QA__.characterAssets.cats);
let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(`pageerror:${e.message}`));page.on('console',m=>{if(m.type()==='error')report.errors.push(`console:${m.text()}`)});page.on('requestfailed',r=>report.errors.push(`requestfailed:${r.url()}`));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__POTR_QA__?.characterAssets?.ready,null,{timeout:30000});
  await page.locator('[data-play]').click();await page.locator('[data-level="ch1-l1"]').click();await page.locator('[data-tier="kitten"]').click();await page.locator('[data-start]').click();await page.waitForFunction(()=>window.__PAWS_QA__?.mode==='playing');
  await page.evaluate(()=>{window.__PAWS_GAME__.completeOnboarding();window.__POTR_QA__.holdHenleyForAnimationQA();});await page.waitForTimeout(250);
  const initial=(await cats(page))[0],required=['Cat_Accelerate','Cat_Run','Cat_Decelerate','Cat_Turn','Cat_JumpRise','Cat_Fall','Cat_Land','Cat_NearCatch','Cat_Caught','Cat_Success'];
  check('cat rig exposes ten semantic synthesized clips',required.every(n=>initial.synthetic.includes(n))&&initial.synthetic.length>=10,JSON.stringify(initial.synthetic));
  check('cat retains authored idle alongside synthesized clips',initial.clips.includes('Cat.001|IdleCat'),JSON.stringify(initial.clips));

  await page.keyboard.down('w');
  try{await page.waitForFunction(()=>window.__POTR_QA__.characterAssets.cats[0]?.semantic==='run',null,{timeout:5000});}catch{}
  let moving=(await cats(page))[0];
  check('real movement transitions through acceleration',moving.history.includes('accelerate'),JSON.stringify(moving.history));
  check('real movement reaches run gait',moving.history.includes('run')&&moving.semantic==='run',JSON.stringify(moving));await shot(page,'01-run.png');

  await page.keyboard.down('d');
  try{await page.waitForFunction(()=>window.__POTR_QA__.characterAssets.cats[0]?.semantic==='turn',null,{timeout:2500});}catch{}
  let turning=(await cats(page))[0];
  check('steering at speed triggers turn animation',turning.history.includes('turn'),JSON.stringify(turning.history));await shot(page,'02-turn.png');
  await page.keyboard.up('d');

  await page.keyboard.press('Space');await page.waitForTimeout(120);let rising=(await cats(page))[0];
  check('jump enters jump-rise animation',rising.semantic==='jumpRise'||rising.history.includes('jumpRise'),JSON.stringify(rising));await shot(page,'03-jump-rise.png');
  await page.waitForTimeout(420);let airborne=(await cats(page))[0];
  check('airborne descent enters fall animation',airborne.history.includes('fall'),JSON.stringify(airborne.history));await shot(page,'04-fall.png');
  await page.waitForTimeout(420);let landed=(await cats(page))[0];
  check('landing triggers dedicated land animation',landed.history.includes('land'),JSON.stringify(landed.history));await shot(page,'05-land.png');

  await page.keyboard.up('w');
  try{await page.waitForFunction(()=>window.__POTR_QA__.characterAssets.cats[0]?.history?.includes('decelerate'),null,{timeout:2500});}catch{}
  let stopped=(await cats(page))[0];
  check('release from speed triggers deceleration animation',stopped.history.includes('decelerate'),JSON.stringify(stopped.history));

  await page.evaluate(()=>window.__POTR_QA__.forceCatAnimation('nearCatch',0));await page.waitForTimeout(160);const near=(await cats(page))[0];
  check('near-catch reaction resolves to synthesized clip',near.semantic==='nearCatch'&&near.current==='Cat_NearCatch',JSON.stringify(near));await shot(page,'06-near-catch.png');

  await page.evaluate(()=>window.__POTR_QA__.forceCatAnimation('caught',0));await page.waitForTimeout(180);const caught=(await cats(page))[0];
  check('caught reaction resolves to synthesized clip',caught.semantic==='caught'&&caught.current==='Cat_Caught',JSON.stringify(caught));await shot(page,'07-caught.png');
  await page.waitForTimeout(700);await page.evaluate(()=>window.__POTR_QA__.forceCatAnimation('idle',0));

  await page.evaluate(()=>window.__PAWS_GAME__.completeRoute());try{await page.waitForFunction(()=>window.__PAWS_QA__.mode==='success',null,{timeout:5000});}catch{}
  await page.waitForTimeout(200);const success=(await cats(page))[0];
  check('success state holds celebration animation',success.semantic==='success'&&success.current==='Cat_Success',JSON.stringify(success));await shot(page,'08-success.png');

  const henley=await page.evaluate(()=>window.__POTR_QA__.characterAssets.henley);
  check('Henley retains authored animation set',henley.clips.includes('Gallop')&&henley.clips.includes('Attack')&&henley.clips.includes('Walk'),JSON.stringify(henley.clips));
  check('animation QA emitted no browser errors',report.errors.length===0,JSON.stringify(report.errors));
  await context.close();
}catch(error){report.fatal=error.stack||String(error);}
finally{if(browser)await browser.close();report.pass=report.checks.every(c=>c.ok)&&report.errors.length===0&&!report.fatal;fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;}
