import { DIFFICULTIES } from './config.js';
const KEY='paws-profile-v1';
const DEFAULT={version:1,difficulty:'kitten',cosmetic:'classic',levels:{},achievements:{firstEscape:false,threeStars:false,tagTeam:false},settings:{routeHints:true,audio:true}};

export class ProfileStore{
  constructor(){this.data=this.load();}
  load(){
    try{
      const parsed=JSON.parse(localStorage.getItem(KEY)||'null');
      if(parsed?.version===1)return this._normalise(parsed);
      const legacyDifficulty=localStorage.getItem('pawsDifficulty');
      const legacyScore=Number(localStorage.getItem('pawsBestScore')||0);
      const migrated=structuredClone(DEFAULT); if(legacyDifficulty&&DIFFICULTIES[legacyDifficulty])migrated.difficulty=legacyDifficulty;if(legacyScore)migrated.levels['ch1-l1']={stars:0,bestScore:legacyScore};return migrated;
    }catch{return structuredClone(DEFAULT);}
  }
  _normalise(v){return {...structuredClone(DEFAULT),...v,levels:{...DEFAULT.levels,...(v.levels||{})},achievements:{...DEFAULT.achievements,...(v.achievements||{})},settings:{...DEFAULT.settings,...(v.settings||{})}};}
  save(){try{localStorage.setItem(KEY,JSON.stringify(this.data));}catch{/* storage can be disabled */}}
  setDifficulty(id){if(DIFFICULTIES[id]){this.data.difficulty=id;this.save();}}
  setCosmetic(id){this.data.cosmetic=id;this.save();}
  record(levelId,{score,stars,tagTeam=false}){const prev=this.data.levels[levelId]||{stars:0,bestScore:0};this.data.levels[levelId]={stars:Math.max(prev.stars||0,stars),bestScore:Math.max(prev.bestScore||0,score)};this.data.achievements.firstEscape=true;if(stars===3)this.data.achievements.threeStars=true;if(tagTeam)this.data.achievements.tagTeam=true;this.save();}
  totalStars(){return Object.values(this.data.levels).reduce((n,l)=>n+(l.stars||0),0);}
}
