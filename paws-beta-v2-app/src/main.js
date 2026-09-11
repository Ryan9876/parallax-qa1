import './style.css';
import './onboarding.css';
import { ProfileStore } from './profile.js';
import { GameUI } from './ui.js';
import { PawsGame } from './game.js';

const QA_SCHEMA_VERSION=1;
const profile=new ProfileStore();
const ui=new GameUI(profile);
const game=new PawsGame(document.querySelector('#scene'),ui,profile);
const runtimeErrors=[];

function runSnapshot(){return window.__PAWS_GAME__?.snapshot?.()||null;}
function recordRuntimeError(kind,error){
  const s=runSnapshot();
  runtimeErrors.push({
    kind,
    message:String(error?.message||error||'Unknown runtime error'),
    stack:String(error?.stack||''),
    simulationTime:Number(s?.elapsed||0),
  });
}

const qaSurface={
  schemaVersion:QA_SCHEMA_VERSION,
  supportsSchema(version){return {compatible:Number(version)===QA_SCHEMA_VERSION,actual:QA_SCHEMA_VERSION};},
  get levelId(){return runSnapshot()?.levelId||null;},
  get difficultyTier(){return runSnapshot()?.difficulty||profile.data.difficulty||null;},
  get objectiveIndex(){return runSnapshot()?.objectiveIndex??null;},
  get objectiveStatus(){const s=runSnapshot();if(!s)return'menu';if(s.paused)return'paused';if(s.mode!=='playing')return s.mode;if(s.onboardingPhase)return`onboarding-${s.onboardingPhase}`;if(s.objectiveTimerPaused)return`held-${s.objectivePauseReason||'unknown'}`;return s.cats?.some(c=>c.captured)?'autonomous-penalty':'active';},
  get pillars(){const p=runSnapshot()?.pillars||{};return{objective:Number(p.objective||0),collectible:Number(p.collectible||0),evasion:Number(p.evasion||0),switch:Number(p.switch||0)};},
  get starsEarned(){return Number(runSnapshot()?.successStars||0);},
  get autonomousPenalty(){const s=runSnapshot();if(!s)return{active:false,cat:null,remaining:0};const entry=s.cats?.map((cat,index)=>({cat,index})).find(v=>v.cat.captured);return entry?{active:true,cat:entry.cat.name,remaining:Number(entry.cat.returnTimer||0)}:{active:false,cat:null,remaining:0};},
  get runtimeErrors(){return runtimeErrors.map(e=>({...e}));},
  get simulationTime(){return Number(runSnapshot()?.elapsed||0);},
  get build(){return window.__PAWS_QA__?.build||null;},
  prepareInactiveCapture(distance=.52){const s=game.state;if(!s||s.mode!=='playing')return false;const idx=1-s.activeCat,cat=s.cats[idx],h=s.henley;if(cat.captured)return false;h.x=cat.x+distance;h.z=cat.z;h.state='pounce';h.target=idx;h.lockedHeading=Math.atan2(cat.x-h.x,cat.z-h.z);h.timer=.35;h.catchTimer=0;h.minAttemptDistance=999;return true;},
};
window.__POTR_QA__=qaSurface;
window.addEventListener('error',event=>recordRuntimeError('error',event.error||event.message));
window.addEventListener('unhandledrejection',event=>recordRuntimeError('unhandledrejection',event.reason));

export {game,profile,ui};
