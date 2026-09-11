import { DIFFICULTIES } from './config.js';
import { chapterUnlockThreshold } from './levels.js';

const KEY='potr-save-v1';
const PREVIEW_KEY='paws-profile-v1';
const ACHIEVEMENT_IDS=['cleanSweep','chainReaction','magpie','whiskers','untouchable','tagTeam','doubleTrouble','starCatcher','houseCats'];
const makeId=()=>globalThis.crypto?.randomUUID?.()||`potr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
const freshProfile=()=>({
  schemaVersion:1,
  profileId:makeId(),
  difficulty:'kitten',
  cosmetic:'classic',
  levels:{},
  unlockedCosmetics:['classic','teal','rust'],
  unlockedSets:['kitchen'],
  achievements:Object.fromEntries(ACHIEVEMENT_IDS.map(id=>[id,false])),
  lifetime:{runs:0,escapes:0,activeCaptures:0,autonomousCaptures:0,score:0,collectibles:0,nearMisses:0},
  legacy:{bestTime:null,bestScore:null},
  settings:{routeHints:true,audio:true}
});

function normaliseDifficulty(value){if(value==='legend')return'alley';return DIFFICULTIES[value]?value:'kitten';}
function validProfile(v){return v&&typeof v==='object'&&Number.isInteger(v.schemaVersion)&&v.schemaVersion>=1;}

export class ProfileStore{
  constructor(){this.data=this.load();}
  load(){
    try{
      const current=JSON.parse(localStorage.getItem(KEY)||'null');
      if(validProfile(current))return this._normalise(current);
      const preview=JSON.parse(localStorage.getItem(PREVIEW_KEY)||'null');
      const migrated=freshProfile();
      if(preview&&typeof preview==='object'){
        migrated.difficulty=normaliseDifficulty(preview.difficulty);
        migrated.cosmetic=migrated.unlockedCosmetics.includes(preview.cosmetic)?preview.cosmetic:'classic';
        for(const [id,row] of Object.entries(preview.levels||{}))migrated.levels[id]={stars:Math.max(0,Math.min(3,Number(row?.stars)||0)),bestScore:Math.max(0,Number(row?.bestScore)||0),bestTime:null,completed:(Number(row?.stars)||0)>0,tier:migrated.difficulty};
      }
      const legacyTime=Number(localStorage.getItem('potr-best-040'));
      const legacyScore=Number(localStorage.getItem('potr-mischief-best-070'));
      migrated.legacy.bestTime=Number.isFinite(legacyTime)&&legacyTime>0?legacyTime:null;
      migrated.legacy.bestScore=Number.isFinite(legacyScore)&&legacyScore>0?legacyScore:null;
      this._refreshUnlocks(migrated);
      try{localStorage.setItem(KEY,JSON.stringify(migrated));}catch{}
      return migrated;
    }catch{return freshProfile();}
  }
  _normalise(v){
    const base=freshProfile(),data={...base,...v};data.profileId=typeof v.profileId==='string'&&v.profileId?v.profileId:base.profileId;data.schemaVersion=1;data.difficulty=normaliseDifficulty(v.difficulty);data.levels={};
    for(const [id,row] of Object.entries(v.levels||{}))data.levels[id]={stars:Math.max(0,Math.min(3,Number(row?.stars)||0)),bestScore:Math.max(0,Number(row?.bestScore)||0),bestTime:Number.isFinite(Number(row?.bestTime))&&Number(row.bestTime)>0?Number(row.bestTime):null,completed:!!row?.completed||(Number(row?.stars)||0)>0,tier:normaliseDifficulty(row?.tier||v.difficulty)};
    data.unlockedCosmetics=[...new Set(['classic',...(Array.isArray(v.unlockedCosmetics)?v.unlockedCosmetics:[]),'teal','rust'])];
    data.unlockedSets=[...new Set(Array.isArray(v.unlockedSets)?v.unlockedSets:['kitchen'])];if(!data.unlockedSets.includes('kitchen'))data.unlockedSets.unshift('kitchen');
    data.achievements={...base.achievements,...(v.achievements||{})};data.lifetime={...base.lifetime,...(v.lifetime||{})};data.legacy={...base.legacy,...(v.legacy||{})};data.settings={...base.settings,...(v.settings||{})};this._refreshUnlocks(data);return data;
  }
  _refreshUnlocks(data=this.data){const total=Object.values(data.levels||{}).reduce((n,l)=>n+(l.stars||0),0);if(total>=chapterUnlockThreshold(1)&&!data.unlockedSets.includes('sunroom'))data.unlockedSets.push('sunroom');}
  save(){try{localStorage.setItem(KEY,JSON.stringify(this.data));}catch{/* storage can be disabled */}}
  setDifficulty(id){if(DIFFICULTIES[id]){this.data.difficulty=id;this.save();}}
  setCosmetic(id){if(this.data.unlockedCosmetics.includes(id)){this.data.cosmetic=id;this.save();}}
  markAchievement(id){if(!(id in this.data.achievements)||this.data.achievements[id])return false;this.data.achievements[id]=true;this.save();return true;}
  record(levelId,{score,stars,elapsed=null,difficulty=this.data.difficulty,metrics={}}){
    const prev=this.data.levels[levelId]||{stars:0,bestScore:0,bestTime:null,completed:false,tier:difficulty};const validTime=Number.isFinite(elapsed)&&elapsed>0?elapsed:null;
    this.data.levels[levelId]={stars:Math.max(prev.stars||0,stars||0),bestScore:Math.max(prev.bestScore||0,Math.round(score||0)),bestTime:validTime&&(prev.bestTime==null||validTime<prev.bestTime)?validTime:prev.bestTime,completed:true,tier:normaliseDifficulty(difficulty)};
    this.data.lifetime.runs++;this.data.lifetime.escapes++;this.data.lifetime.score+=Math.round(score||0);this.data.lifetime.autonomousCaptures+=metrics.autonomousCaptures||0;this.data.lifetime.activeCaptures+=metrics.activeCaptures||0;this.data.lifetime.collectibles+=metrics.collectibles||0;this.data.lifetime.nearMisses+=metrics.nearMisses||0;
    this._refreshUnlocks();this.save();
  }
  recordFailedRun({autonomousCaptures=0,score=0,collectibles=0,nearMisses=0}={}){this.data.lifetime.runs++;this.data.lifetime.activeCaptures++;this.data.lifetime.autonomousCaptures+=autonomousCaptures;this.data.lifetime.score+=Math.round(score||0);this.data.lifetime.collectibles+=collectibles;this.data.lifetime.nearMisses+=nearMisses;this.save();}
  totalStars(){return Object.values(this.data.levels).reduce((n,l)=>n+(l.stars||0),0);}
}
