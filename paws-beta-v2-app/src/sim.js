import { TUNING, DIFFICULTIES, detectionRadius, clamp, damp, angleDelta } from './config.js';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const VAULTABLE_KINDS=new Set(['island','counter','table','bench','stool','toybox','sofa','chaise','coffee','ottoman']);
function objectiveDeadline(level,index,difficulty){const base=level.objectives[index]?.deadline||12;return base*(DIFFICULTIES[difficulty]||DIFFICULTIES.cat).deadline;}
function pointRectDistance(x,z,c){const dx=Math.max(Math.abs(x-c.x)-c.w/2,0),dz=Math.max(Math.abs(z-c.z)-c.d/2,0);return Math.hypot(dx,dz);}
function circleHits(x,z,r,c){return pointRectDistance(x,z,c)<r;}
function isFree(world,x,z,r=TUNING.cat.radius){return x>=world.bounds.minX+r&&x<=world.bounds.maxX-r&&z>=world.bounds.minZ+r&&z<=world.bounds.maxZ-r&&!world.colliders.some(c=>circleHits(x,z,r,c));}
function effectiveObjectiveCat(state,level){const o=level.objectives[state.objectiveIndex];return state.objectiveCatOverride||o?.cat||null;}
function supportHeight(world,x,z){let y=0;for(const c of world.colliders){if(!VAULTABLE_KINDS.has(c.kind))continue;if(Math.abs(x-c.x)<=Math.max(.05,c.w/2-.04)&&Math.abs(z-c.z)<=Math.max(.05,c.d/2-.04))y=Math.max(y,c.h);}return y;}
function blockingCollider(cat,x,z,world){return world.colliders.find(c=>circleHits(x,z,TUNING.cat.radius,c)&&cat.y<c.h-.04)||null;}
function armVault(cat,c,axis,delta){if(!VAULTABLE_KINDS.has(c.kind)||c.h>1.12||c.h<=cat.y+.04)return;cat.vaultWindow=.12;cat.vaultY=c.h;const inset=.16;if(axis==='x'){cat.vaultX=c.x+(delta>0?-c.w/2+inset:c.w/2-inset);cat.vaultZ=clamp(cat.z,c.z-c.d/2+inset,c.z+c.d/2-inset);}else{cat.vaultZ=c.z+(delta>0?-c.d/2+inset:c.d/2-inset);cat.vaultX=clamp(cat.x,c.x-c.w/2+inset,c.x+c.w/2-inset);}}

export function createRunState(level,world,difficulty='kitten'){
  const resolvedDifficulty=DIFFICULTIES[difficulty]?difficulty:'kitten';
  const cats=world.spawn.cats.map((s,i)=>({name:i===0?'orange':'gray',x:s.x,z:s.z,y:0,vx:0,vz:0,vy:0,heading:0,grounded:true,captured:false,returnTimer:0,lastAnim:'idle',vaultWindow:0,vaultX:0,vaultZ:0,vaultY:0,vaultAnim:0,landTimer:0}));
  return {mode:'playing',paused:false,pauseReason:'',levelId:level.id,difficulty:resolvedDifficulty,elapsed:0,activeCat:0,activeTime:[0,0],cats,henley:{x:world.spawn.henley.x,z:world.spawn.henley.z,y:0,heading:Math.PI,state:'search',timer:0,target:0,lockedHeading:0,minAttemptDistance:999,catchTimer:0,distractionTimer:0},objectiveIndex:0,objectiveTime:objectiveDeadline(level,0,resolvedDifficulty),objectiveCatOverride:null,objectiveTimerPaused:false,objectivePauseReason:null,henleyPaused:false,onboardingPhase:null,objectiveMisses:0,score:0,streak:0,combo:1,pillars:{objective:0,collectible:0,evasion:0,switch:0},collected:new Set(),lastSwitch:-99,switchBonusObjectives:new Set(),nearMisses:0,autonomousCaptures:0,successStars:0,tagTeam:false,lastReturnDistance:null};
}

function resolveMove(cat,world,dx,dz){
  const nx=clamp(cat.x+dx,world.bounds.minX+TUNING.cat.radius,world.bounds.maxX-TUNING.cat.radius),blockX=blockingCollider(cat,nx,cat.z,world);if(!blockX)cat.x=nx;else{cat.vx*=.2;armVault(cat,blockX,'x',dx);}
  const nz=clamp(cat.z+dz,world.bounds.minZ+TUNING.cat.radius,world.bounds.maxZ-TUNING.cat.radius),blockZ=blockingCollider(cat,cat.x,nz,world);if(!blockZ)cat.z=nz;else{cat.vz*=.2;armVault(cat,blockZ,'z',dz);}
}
function steerCat(cat,dir,mag,dt,world){
  const has=mag>.02&&Math.hypot(dir.x,dir.z)>.2,targetSpeed=has?TUNING.cat.maxSpeed*mag:0;let tx=0,tz=0;if(has){const l=Math.hypot(dir.x,dir.z)||1;tx=dir.x/l*targetSpeed;tz=dir.z/l*targetSpeed;const targetHeading=Math.atan2(tx,tz);cat.heading+=clamp(angleDelta(cat.heading,targetHeading),-TUNING.cat.turnRate*dt,TUNING.cat.turnRate*dt);}
  const accel=targetSpeed>Math.hypot(cat.vx,cat.vz)?TUNING.cat.accel:TUNING.cat.decel;cat.vx=damp(cat.vx,tx,accel,dt);cat.vz=damp(cat.vz,tz,accel,dt);resolveMove(cat,world,cat.vx*dt,cat.vz*dt);
}
function updateVertical(cat,actions,dt,world){
  cat.vaultWindow=Math.max(0,cat.vaultWindow-dt);cat.vaultAnim=Math.max(0,cat.vaultAnim-dt);cat.landTimer=Math.max(0,cat.landTimer-dt);let event=null;
  if(actions.jump&&cat.grounded&&!cat.captured){
    if(cat.vaultWindow>0&&cat.vaultY>cat.y+.04){cat.x=cat.vaultX;cat.z=cat.vaultZ;cat.y=cat.vaultY;cat.vy=0;cat.grounded=true;cat.vaultWindow=0;cat.vaultAnim=.28;event='vault';}
    else{cat.vy=TUNING.cat.jumpVelocity;cat.grounded=false;event='jump';}
  }
  const ground=supportHeight(world,cat.x,cat.z);
  if(cat.grounded&&cat.y>ground+.05&&cat.vaultAnim<=0){cat.grounded=false;cat.vy=Math.min(cat.vy,0);}
  if(!cat.grounded){cat.vy-=TUNING.cat.gravity*dt;cat.y+=cat.vy*dt;const landing=supportHeight(world,cat.x,cat.z);if(cat.y<=landing&&cat.vy<=0){cat.y=landing;cat.vy=0;cat.grounded=true;cat.landTimer=.18;if(!event)event='land';}}
  return event;
}
function findSafeReturnPoint(state,world,active){
  const required=detectionRadius(state.elapsed,state.difficulty),margin=.15,targetDistance=required+margin;let preferred=null,farthest=null;
  for(let x=world.bounds.minX+.65;x<=world.bounds.maxX-.65;x+=.55){for(let z=world.bounds.minZ+.65;z<=world.bounds.maxZ-.65;z+=.55){
    if(!isFree(world,x,z,.42))continue;
    const henleyDistance=Math.hypot(x-state.henley.x,z-state.henley.z),activeDistance=Math.hypot(x-active.x,z-active.z),candidate={x,z,activeDistance,henleyDistance};
    if(!farthest||candidate.henleyDistance>farthest.henleyDistance)farthest=candidate;
    if(candidate.henleyDistance>=targetDistance&&(!preferred||candidate.activeDistance<preferred.activeDistance))preferred=candidate;
  }}
  if(preferred)return preferred;
  if(!farthest)return null;

  // Small rooms can temporarily have no point D away when Henley is near the centre.
  // The penalty contract still requires an immediate safe return, so reset Henley to the
  // least disruptive valid side of the room and briefly distract him before re-entry.
  const h=state.henley,dx=h.x-farthest.x,dz=h.z-farthest.z,len=Math.hypot(dx,dz)||1,needed=Math.max(0,targetDistance-farthest.henleyDistance);
  let hx=clamp(h.x+dx/len*needed,world.bounds.minX+.3,world.bounds.maxX-.3),hz=clamp(h.z+dz/len*needed,world.bounds.minZ+.3,world.bounds.maxZ-.3),separation=Math.hypot(farthest.x-hx,farthest.z-hz);
  if(separation<targetDistance){
    const anchors=[
      {x:world.bounds.minX+.3,z:world.bounds.minZ+.3},{x:world.bounds.minX+.3,z:world.bounds.maxZ-.3},
      {x:world.bounds.maxX-.3,z:world.bounds.minZ+.3},{x:world.bounds.maxX-.3,z:world.bounds.maxZ-.3}
    ].sort((a,b)=>Math.hypot(farthest.x-b.x,farthest.z-b.z)-Math.hypot(farthest.x-a.x,farthest.z-a.z));
    hx=anchors[0].x;hz=anchors[0].z;separation=Math.hypot(farthest.x-hx,farthest.z-hz);
  }
  if(separation<required)return null;
  h.x=hx;h.z=hz;h.state='distracted';h.distractionTimer=Math.max(h.distractionTimer,.85);h.catchTimer=0;h.minAttemptDistance=999;h.heading=Math.atan2(active.x-h.x,active.z-h.z);
  farthest.henleyDistance=separation;
  return farthest;
}
function updateAutonomous(state,world,dt){
  const active=state.cats[state.activeCat],idx=1-state.activeCat,cat=state.cats[idx];
  if(cat.captured){cat.returnTimer-=dt;if(cat.returnTimer<=0){const returnPoint=findSafeReturnPoint(state,world,active);if(!returnPoint){cat.returnTimer=.1;return null;}cat.captured=false;cat.x=returnPoint.x;cat.z=returnPoint.z;cat.y=0;cat.vx=cat.vz=cat.vy=0;cat.grounded=true;cat.vaultWindow=0;state.lastReturnDistance=returnPoint.henleyDistance;return{type:'returned',cat};}return null;}
  const side=idx===0?-1:1,target={x:active.x+Math.cos(active.heading)*side*1.3-Math.sin(active.heading)*1.15,z:active.z-Math.sin(active.heading)*side*1.3-Math.cos(active.heading)*1.15};const dx=target.x-cat.x,dz=target.z-cat.z,l=Math.hypot(dx,dz);const mag=l>.55?clamp(l/2,0,.72):0;steerCat(cat,{x:dx,z:dz},mag,dt,world);const vertical=updateVertical(cat,{jump:false},dt,world);return vertical==='land'?{type:'autonomousLand',cat}:null;
}
function activeCanReachObjective(state,level,world){const o=level.objectives[state.objectiveIndex],active=state.cats[state.activeCat];return !!o&&!active.captured&&isFree(world,o.x,o.z,.32)&&Math.hypot(active.x-o.x,active.z-o.z)<18;}
function captureAutonomous(state,level,world,idx,cb){
  const cat=state.cats[idx],tier=DIFFICULTIES[state.difficulty]||DIFFICULTIES.cat;cat.captured=true;cat.returnTimer=tier.penalty;cat.vx=cat.vz=cat.vy=0;state.streak=0;state.combo=1;state.autonomousCaptures++;
  const current=level.objectives[state.objectiveIndex];if(current?.cat===cat.name){if(activeCanReachObjective(state,level,world)){state.objectiveCatOverride=state.cats[state.activeCat].name;cb.objectiveReassigned?.(current,state.objectiveCatOverride);}else{state.objectiveTimerPaused=true;state.objectivePauseReason='captured-objective-cat';cb.objectivePaused?.(current,cat);}}
  cb.autonomousCaught?.(cat,tier.penalty);
}
function catchCat(state,level,world,idx,cb){if(idx===state.activeCat){state.mode='caught';cb.caught?.(state.cats[idx]);}else captureAutonomous(state,level,world,idx,cb);}

function updateHenley(state,level,world,dt,cb){
  const h=state.henley,tier=DIFFICULTIES[state.difficulty]||DIFFICULTIES.cat;
  if(h.distractionTimer>0){h.distractionTimer-=dt;h.state='distracted';return;}
  const available=state.cats.map((c,i)=>({c,i,d:dist(h,c)})).filter(v=>!v.c.captured);if(!available.length)return;const active=available.find(v=>v.i===state.activeCat);const nearest=available.slice().sort((a,b)=>a.d-b.d)[0];const detection=detectionRadius(state.elapsed,state.difficulty);let target=(nearest.d<detection*.72?nearest:active)||nearest;h.target=target.i;const cat=target.c,d=target.d;
  if(['pounce','reach'].includes(h.state))h.minAttemptDistance=Math.min(h.minAttemptDistance,d);
  if(h.state==='search'||h.state==='investigate'||h.state==='distracted'){
    if(d<detection){h.state='chase';h.timer=0;cb.henleyState?.('chase');}
    else{const patrol=Math.sin(state.elapsed*.42)*2.8,dx=patrol-h.x,dz=1.15-h.z,l=Math.hypot(dx,dz)||1;h.x+=dx/l*.72*dt;h.z+=dz/l*.72*dt;h.heading=Math.atan2(dx/l,dz/l);return;}
  }
  if(h.state==='chase'){
    if(d>TUNING.henley.pounceDistance){const elapsedTerm=Math.min(1.05,state.elapsed*.0058)*tier.elapsed,dodgeTerm=Math.min(.30,state.nearMisses*.018)*tier.escalation,objTerm=Math.min(.42,state.objectiveIndex*.045)*tier.escalation;const speed=TUNING.henley.baseSpeed*tier.henleySpeed+elapsedTerm+dodgeTerm+objTerm;const dx=cat.x-h.x,dz=cat.z-h.z,l=Math.hypot(dx,dz)||1;h.x+=dx/l*speed*dt;h.z+=dz/l*speed*dt;h.heading=Math.atan2(dx/l,dz/l);
    }else{h.state='windup';h.timer=.31;h.lockedHeading=Math.atan2(cat.x-h.x,cat.z-h.z);h.minAttemptDistance=d;h.catchTimer=0;cb.henleyState?.('windup');}return;
  }
  if(h.state==='windup'){h.timer-=dt;if(h.timer<=0){h.state='pounce';h.timer=.38;cb.henleyState?.('pounce');}return;}
  if(h.state==='pounce'){h.timer-=dt;const sp=6.4;h.x+=Math.sin(h.lockedHeading)*sp*dt;h.z+=Math.cos(h.lockedHeading)*sp*dt;h.heading=h.lockedHeading;if(d<=TUNING.henley.catchDistance&&cat.y<=TUNING.henley.catchHeight){h.catchTimer+=dt;if(h.catchTimer>=TUNING.henley.catchTime){catchCat(state,level,world,h.target,cb);h.state='recover';h.timer=.72;return;}}else h.catchTimer=0;if(h.timer<=0){h.state='reach';h.timer=.18;cb.henleyState?.('reach');}return;}
  if(h.state==='reach'){h.timer-=dt;if(d<=TUNING.henley.catchDistance&&cat.y<=TUNING.henley.catchHeight){h.catchTimer+=dt;if(h.catchTimer>=TUNING.henley.catchTime){catchCat(state,level,world,h.target,cb);h.state='recover';h.timer=.72;return;}}if(h.timer<=0){if(h.minAttemptDistance<=TUNING.nearMissDistance&&state.mode==='playing'){state.score+=60;state.pillars.evasion+=60;state.nearMisses++;cb.nearMiss?.();}h.state='recover';h.timer=.66;}return;}
  if(h.state==='recover'){h.timer-=dt;if(h.timer<=0){h.state='chase';h.minAttemptDistance=999;h.catchTimer=0;}return;}
}

function objectiveComplete(state,level,cb){const o=level.objectives[state.objectiveIndex],timeLeft=Math.max(0,state.objectiveTime);state.streak++;state.combo=clamp(1+Math.floor(state.streak/2),1,4);const pts=Math.round((100+timeLeft*9)*state.combo);state.score+=pts;state.pillars.objective+=pts;state.objectiveIndex++;state.objectiveCatOverride=null;state.objectiveTimerPaused=false;state.objectivePauseReason=null;const burst=state.objectiveIndex%3===0,tier=DIFFICULTIES[state.difficulty]||DIFFICULTIES.cat;state.henley.distractionTimer=(burst?TUNING.henley.burstDistraction:TUNING.henley.distraction)*tier.distraction;cb.objective?.(o,pts,burst);if(state.objectiveIndex>=level.objectives.length){state.mode='success';const ratio=state.score/level.targetScore;state.successStars=ratio>=.9&&state.elapsed<=level.parTime?3:ratio>=.6?2:1;cb.success?.();}else state.objectiveTime=objectiveDeadline(level,state.objectiveIndex,state.difficulty);}

export function stepRun(state,level,world,actions,dt,cb={}){
  if(state.mode!=='playing'||state.paused)return;state.elapsed+=dt;state.activeTime[state.activeCat]+=dt;
  if(actions.switchCat){const next=1-state.activeCat;if(!state.cats[next].captured){state.activeCat=next;const o=level.objectives[state.objectiveIndex],objectiveCat=effectiveObjectiveCat(state,level),eligible=objectiveCat===state.cats[next].name&&!state.switchBonusObjectives.has(o?.id)&&state.elapsed-state.lastSwitch>=TUNING.switchBonusCooldown;state.lastSwitch=state.elapsed;if(eligible){state.score+=40;state.pillars.switch+=40;state.switchBonusObjectives.add(o.id);state.tagTeam=true;cb.switchBonus?.();}cb.switchCat?.(state.cats[next]);}}
  const controlled=state.cats[state.activeCat];steerCat(controlled,actions.steerDirection,actions.steerMagnitude,dt,world);const vertical=updateVertical(controlled,actions,dt,world);if(vertical)cb[vertical]?.(controlled);
  const autoEvent=updateAutonomous(state,world,dt);if(autoEvent?.type==='returned'){if(state.objectivePauseReason==='captured-objective-cat'&&level.objectives[state.objectiveIndex]?.cat===autoEvent.cat.name){state.objectiveTimerPaused=false;state.objectivePauseReason=null;cb.objectiveResumed?.(level.objectives[state.objectiveIndex],autoEvent.cat);}cb.autonomousReturned?.(autoEvent.cat);}
  const o=level.objectives[state.objectiveIndex];if(o&&!state.objectiveTimerPaused){state.objectiveTime-=dt;if(state.objectiveTime<=0){state.streak=0;state.combo=1;state.objectiveMisses++;state.objectiveTime=objectiveDeadline(level,state.objectiveIndex,state.difficulty)*.72;cb.deadline?.(o);}if(controlled.name===effectiveObjectiveCat(state,level)&&Math.hypot(controlled.x-o.x,controlled.z-o.z)<.72&&Math.abs(controlled.y-supportHeight(world,controlled.x,controlled.z))<.28)objectiveComplete(state,level,cb);}
  for(const c of world.collectibles){if(!state.collected.has(c.id)&&Math.hypot(controlled.x-c.x,controlled.z-c.z)<.5){state.collected.add(c.id);const pts=c.pointValue||25;state.score+=pts;state.pillars.collectible+=pts;cb.collect?.(c,pts);}}
  if(!state.henleyPaused)updateHenley(state,level,world,dt,cb);
}

export function snapshotRun(state){return {...state,activeTime:[...state.activeTime],cats:state.cats.map(c=>({...c})),henley:{...state.henley},pillars:{...state.pillars},collected:[...state.collected],switchBonusObjectives:[...state.switchBonusObjectives]};}
export function stateDistance(a,b){return dist(a,b);}
