import fs from 'node:fs';

function replaceOnce(text,oldText,newText,label){
  if(!text.includes(oldText))throw new Error(`Missing animation patch target: ${label}`);
  return text.replace(oldText,newText);
}

const modelsPath='src/models.js';let models=fs.readFileSync(modelsPath,'utf8');
models=replaceOnce(models,"  update(dt){this.mixer.update(dt);}\n}","  resetMotion(){this.motion={speed:0,heading:0,initialized:false};this.lockUntil=0;}\n  update(dt){this.mixer.update(dt);}\n}",'model reset motion');
fs.writeFileSync(modelsPath,models);

const gamePath='src/game.js';let game=fs.readFileSync(gamePath,'utf8');
game=replaceOnce(game,"this.applyCosmetic();for(const m of this.models)m.group.visible=true;","this.applyCosmetic();for(const m of this.models){m.resetMotion?.();m.group.visible=true;}",'reset animation motion at start');
game=replaceOnce(game,"this.models[this.state.activeCat].play('nearCatch',{loop:false});","this.models[this.state.activeCat].play('nearCatch',{loop:false,hold:.42,force:true});",'near-catch hold');
const oldSync="  syncModels(dt){if(!this.state||!this.modelReady)return;for(let i=0;i<2;i++){const c=this.state.cats[i],m=this.models[i];m.group.visible=!c.captured;m.group.position.set(c.x,c.y,c.z);m.group.rotation.y=c.heading+Math.PI;const speed=Math.hypot(c.vx,c.vz);let anim='idle';if(this.state.mode==='caught'&&i===this.state.activeCat)anim='caught';else if(c.vaultAnim>0)anim='jumpRise';else if(c.landTimer>0)anim='land';else if(!c.grounded)anim=c.vy>0?'jumpRise':'fall';else if(speed>3.1)anim='run';else if(speed>.5)anim='accelerate';m.play(anim,{loop:!['caught','land','success'].includes(anim)});m.update(dt);}const h=this.state.henley;this.henleyModel.group.position.set(h.x,h.y,h.z);this.henleyModel.group.rotation.y=h.heading+Math.PI;const ha=['windup','reach'].includes(h.state)?'alert':h.state==='pounce'?'run':h.state==='distracted'?'idle':'run';this.henleyModel.play(ha);this.henleyModel.update(dt);}";
const newSync="  syncModels(dt){if(!this.state||!this.modelReady)return;for(let i=0;i<2;i++){const c=this.state.cats[i],m=this.models[i];m.group.visible=!c.captured;m.group.position.set(c.x,c.y,c.z);m.group.rotation.y=c.heading+Math.PI;const speed=Math.hypot(c.vx,c.vz),motion=m.selectMotion({speed,heading:c.heading,grounded:c.grounded,vy:c.vy,vaultAnim:c.vaultAnim,landTimer:c.landTimer,mode:this.state.mode,active:i===this.state.activeCat,dt});m.play(motion.anim,{loop:motion.loop,hold:motion.hold,timeScale:motion.timeScale});m.update(dt);}const h=this.state.henley;this.henleyModel.group.position.set(h.x,h.y,h.z);this.henleyModel.group.rotation.y=h.heading+Math.PI;let ha='run';if(['windup','pounce','reach'].includes(h.state))ha='alert';else if(['distracted','search'].includes(h.state))ha='idle';else if(h.state==='recover')ha='decelerate';this.henleyModel.play(ha,{timeScale:h.state==='chase'?1.08:1});this.henleyModel.update(dt);}";
game=replaceOnce(game,oldSync,newSync,'syncModels semantic animation integration');
fs.writeFileSync(gamePath,game);

const mainPath='src/main.js';let main=fs.readFileSync(mainPath,'utf8');
main=replaceOnce(main,"function modelSummary(model){return model?{failed:!!model.failed,species:model.species||'unknown',clips:[...(model.availableClips||[])],current:model.currentName||'',collar:!!model.group?.getObjectByName('socket_collar'),head:!!model.group?.getObjectByName('socket_head')}:null;}","function modelSummary(model){return model?{failed:!!model.failed,species:model.species||'unknown',clips:[...(model.availableClips||[])],synthetic:[...(model.syntheticClips||[])],current:model.currentName||'',semantic:model.semanticState||'',history:[...(model.stateHistory||[])],collar:!!model.group?.getObjectByName('socket_collar'),head:!!model.group?.getObjectByName('socket_head')}:null;}",'model summary animation diagnostics');
main=replaceOnce(main,"  forcePerformanceTier(tier){return performanceGovernor.forceTier(tier);},\n  playAudioGroup(group){game.audio.play(group);return game.audio.status();},","  forcePerformanceTier(tier){return performanceGovernor.forceTier(tier);},\n  forceCatAnimation(state,index=0){const model=game.models[index];if(!model)return null;const oneShot=['decelerate','jumpRise','land','nearCatch','caught'].includes(state);model.play(state,{loop:!oneShot,hold:.7,force:true});return modelSummary(model);},\n  playAudioGroup(group){game.audio.play(group);return game.audio.status();},",'QA animation forcing');
fs.writeFileSync(mainPath,main);
console.log('Applied gameplay-driven cat animation integration.');
