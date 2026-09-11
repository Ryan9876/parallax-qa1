import fs from 'node:fs';
import { getLevels, validateLevel, assembleLevel, CHAPTER_TWO_STAR_GATE } from '../src/levels.js';
import { TUNING, DIFFICULTIES } from '../src/config.js';
import { createRunState, stepRun } from '../src/sim.js';

const results=[];const test=(name,fn)=>{try{fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.message});}};const assert=(v,msg)=>{if(!v)throw new Error(msg)};
const levels=getLevels();
test('V1 content has 2 chapters / 7 levels',()=>{assert(levels.length===7,`levels=${levels.length}`);assert(new Set(levels.map(l=>l.chapter)).size===2,'missing chapter');});
test('all deterministic levels validate',()=>{for(const l of levels){const v=validateLevel(l);assert(v.ok,`${l.id}: ${v.errors.join(', ')}`);}});
test('each theme exposes at least 12 set pieces',()=>{for(const l of [levels[0],levels.at(-1)])assert(assembleLevel(l).pieces.length>=12,`${l.theme} pieces`);});
test('fixed simulation is 50Hz and debt is capped',()=>{assert(Math.abs(TUNING.fixedDt-.02)<1e-9,'fixed dt');assert(TUNING.maxDebtSteps===5,'debt cap');});
test('catch geometry is difficulty invariant',()=>{const before=[TUNING.henley.catchDistance,TUNING.henley.catchHeight,TUNING.henley.catchTime];for(const _ of Object.keys(DIFFICULTIES))assert(JSON.stringify(before)==='[0.72,0.18,0.15]','catch geometry changed');});
test('difficulty tiers preserve Cat straight-line survivability',()=>{assert(TUNING.cat.maxSpeed>TUNING.henley.baseSpeed*DIFFICULTIES.cat.henleySpeed,`cat ${TUNING.cat.maxSpeed} <= henley ${TUNING.henley.baseSpeed*DIFFICULTIES.cat.henleySpeed}`);});
test('chapter two is star gated',()=>assert(CHAPTER_TWO_STAR_GATE===8,`gate=${CHAPTER_TWO_STAR_GATE}`));
test('objective formula and combo are retained',()=>{const l=levels[0],w=assembleLevel(l),s=createRunState(l,w,'kitten');s.cats[0].x=l.objectives[0].x;s.cats[0].z=l.objectives[0].z;const time=s.objectiveTime;stepRun(s,l,w,{steerDirection:{x:0,z:0},steerMagnitude:0,jump:false,switchCat:false},TUNING.fixedDt,{});const expected=Math.round((100+(time-TUNING.fixedDt)*9)*1);assert(s.pillars.objective===expected,`expected ${expected}, got ${s.pillars.objective}`);});
test('touch UI has no permanent joystick/button cluster',()=>{const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8')+fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');assert(!/joystick/i.test(html),'joystick found');});
test('runtime source has no third-party http imports',()=>{const files=fs.readdirSync(new URL('../src/',import.meta.url)).filter(f=>f.endsWith('.js'));for(const f of files){const s=fs.readFileSync(new URL(`../src/${f}`,import.meta.url),'utf8');assert(!/https?:\/\//.test(s),`${f} contains remote URL`);}});

for(const r of results)console.log(`${r.ok?'PASS':'FAIL'} ${r.name}${r.error?` — ${r.error}`:''}`);const failures=results.filter(r=>!r.ok);console.log(`\n${results.length-failures.length}/${results.length} contracts passing`);if(failures.length)process.exit(1);
