import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE=process.env.QA_URL||'http://127.0.0.1:4173/?qa=1';
const outDir=path.resolve('qa-results/onboarding');fs.mkdirSync(outDir,{recursive:true});
const report={checks:[],errors:[],pass:false,timestamp:new Date().toISOString()};
const check=(name,ok,detail='')=>{report.checks.push({name,ok:!!ok,detail});return !!ok;};
const snap=page=>page.evaluate(()=>structuredClone(window.__PAWS_GAME__.snapshot()));
const shot=(page,name)=>page.screenshot({path:path.join(outDir,name)});
async function boot(page){await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__PAWS_GAME__&&window.__PAWS_QA__&&window.__POTR_QA__,null,{timeout:30000});await page.waitForTimeout(900);}
async function enter(page,{touch=false}={}){const act=touch?'tap':'click';await page.locator('[data-play]')[act]();await page.locator('[data-level="ch1-l1"]')[act]();await page.locator('[data-tier="kitten"]')[act]();await page.locator('[data-start]')[act]();await page.waitForFunction(()=>window.__PAWS_QA__.mode==='playing');await page.waitForTimeout(220);}
function attach(page){page.on('pageerror',e=>report.errors.push(`pageerror:${e.message}`));page.on('console',m=>{if(m.type()==='error')report.errors.push(`console:${m.text()}`)});page.on('requestfailed',r=>report.errors.push(`requestfailed:${r.url()}`));}

let browser;
try{
  browser=await chromium.launch({headless:true});
  {
    const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();attach(page);await boot(page);await enter(page);
    const schema=await page.evaluate(()=>({v:window.__POTR_QA__.schemaVersion,ok:window.__POTR_QA__.supportsSchema(1),bad:window.__POTR_QA__.supportsSchema(99)}));
    check('QA schema is versioned and mismatch-detectable',schema.v===1&&schema.ok.compatible&&!schema.bad.compatible,JSON.stringify(schema));
    check('level one begins with steering guidance',(await page.evaluate(()=>window.__POTR_QA__.objectiveStatus))==='onboarding-steer',await page.evaluate(()=>window.__POTR_QA__.objectiveStatus));
    check('first objective is hidden during steering',await page.locator('.hud .objective').evaluate(el=>el.classList.contains('tutorial-hidden')));
    check('steering guidance is visual',await page.locator('#first-run-guide').getAttribute('data-kind')==='steer');
    await shot(page,'desktop-01-steer.png');
    const before=await snap(page);await page.waitForTimeout(500);const held=await snap(page);
    check('objective timer is frozen before objective issuance',Math.abs(before.objectiveTime-held.objectiveTime)<.001,`${before.objectiveTime}->${held.objectiveTime}`);
    check('Henley is held during onboarding',Math.hypot(before.henley.x-held.henley.x,before.henley.z-held.henley.z)<.001,JSON.stringify({before:before.henley,after:held.henley}));
    await page.keyboard.down('w');try{await page.waitForFunction(()=>window.__POTR_QA__.objectiveStatus==='onboarding-jump',null,{timeout:3600});}catch{}finally{await page.keyboard.up('w');}
    check('steering transitions to jump guidance',(await page.evaluate(()=>window.__POTR_QA__.objectiveStatus))==='onboarding-jump',await page.evaluate(()=>window.__POTR_QA__.objectiveStatus));
    check('jump guidance is visual',await page.locator('#first-run-guide').getAttribute('data-kind')==='jump');await shot(page,'desktop-02-jump.png');
    await page.keyboard.press('Space');try{await page.waitForFunction(()=>window.__POTR_QA__.objectiveStatus==='active',null,{timeout:1800});}catch{}
    const issued=await snap(page);check('first objective issues after steer and jump',issued.onboardingPhase===null&&!issued.objectiveTimerPaused,JSON.stringify({phase:issued.onboardingPhase,paused:issued.objectiveTimerPaused}));
    check('first objective appears within 15 seconds',issued.elapsed<15,`elapsed=${issued.elapsed.toFixed(2)}`);check('objective HUD becomes visible',!(await page.locator('.hud .objective').evaluate(el=>el.classList.contains('tutorial-hidden'))));await shot(page,'desktop-03-first-objective.png');

    await page.evaluate(()=>{window.__PAWS_GAME__.selectObjectiveCat();window.__PAWS_GAME__.teleportToObjective();});
    try{await page.waitForFunction(()=>window.__POTR_QA__.objectiveIndex===1,null,{timeout:1600});}catch{}
    const switchState=await page.evaluate(()=>({status:window.__POTR_QA__.objectiveStatus,kind:document.querySelector('#first-run-guide')?.dataset.kind,time:window.__PAWS_GAME__.snapshot().objectiveTime}));
    check('first inactive-cat objective holds before timer starts',switchState.status==='held-switch-guidance',JSON.stringify(switchState));
    check('inactive-cat switch requirement is visual',switchState.kind==='switch',switchState.kind);await page.waitForTimeout(350);const heldTime=await page.evaluate(()=>window.__PAWS_GAME__.snapshot().objectiveTime);check('switch guidance keeps objective timer frozen',Math.abs(switchState.time-heldTime)<.001,`${switchState.time}->${heldTime}`);await shot(page,'desktop-04-switch.png');
    await page.keyboard.press('q');try{await page.waitForFunction(()=>window.__POTR_QA__.objectiveStatus==='active',null,{timeout:1200});}catch{}
    check('switching to assigned cat starts its timer',(await page.evaluate(()=>window.__POTR_QA__.objectiveStatus))==='active',await page.evaluate(()=>window.__POTR_QA__.objectiveStatus));

    await page.evaluate(()=>window.__POTR_QA__.prepareInactiveCapture());
    try{await page.waitForFunction(()=>window.__POTR_QA__.autonomousPenalty.active===true,null,{timeout:2400});}catch{}
    const penalty=await page.evaluate(()=>({penalty:window.__POTR_QA__.autonomousPenalty,mode:window.__PAWS_QA__.mode,kind:document.querySelector('#first-run-guide')?.dataset.kind,sim:window.__POTR_QA__.simulationTime}));
    check('inactive-cat capture is nonterminal',penalty.penalty.active&&penalty.mode==='playing',JSON.stringify(penalty));
    check('first autonomous capture visually communicates return',penalty.kind==='return',penalty.kind);
    check('Kitten autonomous penalty is configured at four simulation seconds',Math.abs(penalty.penalty.remaining-4)<.3,`remaining=${penalty.penalty.remaining.toFixed(2)}`);await shot(page,'desktop-05-return.png');

    await page.evaluate(()=>window.__POTR_QA__.expireAutonomousPenalty());
    try{await page.waitForFunction(()=>window.__POTR_QA__.autonomousPenalty.active===false||window.__PAWS_QA__.mode!=='playing',null,{timeout:2500});}catch{}
    const returned=await page.evaluate(()=>({penalty:window.__POTR_QA__.autonomousPenalty,mode:window.__PAWS_QA__.mode,lastReturnDistance:window.__POTR_QA__.lastReturnDistance,requiredDetection:window.__POTR_QA__.requiredDetection}));
    check('captured teammate returns without terminating the run',!returned.penalty.active&&returned.mode==='playing',JSON.stringify(returned));
    check('teammate returns at least D from Henley',returned.lastReturnDistance+0.01>=returned.requiredDetection,`return=${returned.lastReturnDistance.toFixed(2)}, D=${returned.requiredDetection.toFixed(2)}`);
    await shot(page,'desktop-06-returned.png');
    await context.close();
  }
  {
    const context=await browser.newContext({...devices['iPhone 14'],locale:'en-US'});const page=await context.newPage();attach(page);await boot(page);await enter(page,{touch:true});
    check('mobile begins with steering guidance',(await page.evaluate(()=>window.__POTR_QA__.objectiveStatus))==='onboarding-steer',await page.evaluate(()=>window.__POTR_QA__.objectiveStatus));await shot(page,'mobile-01-steer.png');
    const box=await page.locator('#scene').boundingBox();if(!box)throw new Error('canvas missing');const x=box.x+box.width*.5,y=box.y+box.height*.72;const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1,radiusX:4,radiusY:4,force:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+70,y:y-90,id:1,radiusX:4,radiusY:4,force:1}]});try{await page.waitForFunction(()=>window.__POTR_QA__.objectiveStatus==='onboarding-jump',null,{timeout:3600});}catch{}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    check('mobile drag teaches steering before jump',(await page.evaluate(()=>window.__POTR_QA__.objectiveStatus))==='onboarding-jump',await page.evaluate(()=>window.__POTR_QA__.objectiveStatus));await shot(page,'mobile-02-jump.png');
    await page.touchscreen.tap(box.x+box.width*.14,box.y+box.height*.82);try{await page.waitForFunction(()=>window.__POTR_QA__.objectiveStatus==='active',null,{timeout:1800});}catch{}
    const mobileIssued=await snap(page);check('mobile first objective issues after touch jump',mobileIssued.onboardingPhase===null&&!mobileIssued.objectiveTimerPaused,JSON.stringify({phase:mobileIssued.onboardingPhase,paused:mobileIssued.objectiveTimerPaused}));check('mobile first objective appears within 15 seconds',mobileIssued.elapsed<15,`elapsed=${mobileIssued.elapsed.toFixed(2)}`);await shot(page,'mobile-03-objective.png');
    await context.close();
  }
}catch(error){report.fatal=error.stack||String(error);}
finally{if(browser)await browser.close();report.pass=report.checks.every(c=>c.ok)&&report.errors.length===0&&!report.fatal;fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;}
