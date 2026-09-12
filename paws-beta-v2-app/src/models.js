import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CLIP_ALIASES={jump:'jumpRise',air:'fall',stop:'decelerate',near:'nearCatch'};
const STATE_CLIPS={
  idle:['Cat.001|IdleCat','Idle','Idle_2','Idle_2_HeadLow','Sitting_Idle'],
  accelerate:['Cat_Accelerate','Walk','Run','Gallop','Idle'],
  run:['Cat_Run','Run','Gallop','Walk','Jump_Loop'],
  decelerate:['Cat_Decelerate','Walk','Idle','Idle_2'],
  turn:['Cat_Turn','Walk','Run','Idle'],
  jumpRise:['Cat_JumpRise','Gallop_Jump','Jump_Loop','Jump','Run'],
  fall:['Cat_Fall','Jump_Loop','Gallop_Jump','Jump','Run'],
  land:['Cat_Land','Idle_HitReact1','Idle_HitReact2','Idle','Walk'],
  nearCatch:['Cat_NearCatch','Idle_HitReact2','Idle_HitReact1','Headbutt','Run'],
  caught:['Cat_Caught','Death','Idle_HitReact2','Sitting_Idle','Idle_2_HeadLow','Idle'],
  alert:['Attack','Idle_HitReact2','Run','Walk','Idle'],
  success:['Cat_Success','Sitting_Idle','Headbutt','Yes','Wave','Idle_2','Idle'],
};
const AUTHORED={
  '/assets/models/cat-orange.gltf':{url:'/assets/characters/authored/cat.glb',tint:0xd87835,height:1.06,yawOffset:Math.PI,species:'cat'},
  '/assets/models/cat-gray.gltf':{url:'/assets/characters/authored/cat.glb',tint:0x7f8b96,height:1.06,yawOffset:Math.PI,species:'cat'},
  '/assets/models/henley.gltf':{url:'/assets/characters/authored/henley.glb',tint:null,height:1.38,yawOffset:Math.PI,species:'dog'},
};
const CAT_SYNTH_NAMES=['Cat_Accelerate','Cat_Run','Cat_Decelerate','Cat_Turn','Cat_JumpRise','Cat_Fall','Cat_Land','Cat_NearCatch','Cat_Caught','Cat_Success'];

function clipCandidates(name){return STATE_CLIPS[CLIP_ALIASES[name]||name]||[name,'Idle','idle'];}
function materialList(material){return Array.isArray(material)?material:[material];}
function styleMesh(mesh,tint){
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
  if(!tint||!mesh.material)return;
  const protectedName=/eye|pupil|nose|mouth|teeth|tooth|claw|black/i;
  const styled=materialList(mesh.material).map(source=>{
    if(!source?.clone)return source;
    const next=source.clone(),name=String(next.name||'');
    if(next.color&&!protectedName.test(name)){
      const target=new THREE.Color(tint);
      const luminance=.2126*next.color.r+.7152*next.color.g+.0722*next.color.b;
      target.multiplyScalar(.55+.65*Math.max(.1,luminance));
      next.color.lerp(target,.78);
    }
    if('roughness'in next)next.roughness=Math.max(.58,Math.min(.92,next.roughness??.78));
    if('metalness'in next)next.metalness=Math.min(.08,next.metalness??0);
    next.needsUpdate=true;return next;
  });
  mesh.material=Array.isArray(mesh.material)?styled:styled[0];
}
function normalizeScene(scene,height,tint){
  scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isMesh)styleMesh(o,tint);});
  const initial=new THREE.Box3().setFromObject(scene),size=initial.getSize(new THREE.Vector3());
  const scale=height/Math.max(.001,size.y);scene.scale.multiplyScalar(scale);scene.updateMatrixWorld(true);
  const scaled=new THREE.Box3().setFromObject(scene),center=scaled.getCenter(new THREE.Vector3());
  scene.position.x-=center.x;scene.position.z-=center.z;scene.position.y-=scaled.min.y;scene.updateMatrixWorld(true);
}
function addSockets(group,height){
  const collar=new THREE.Object3D();collar.name='socket_collar';collar.position.set(0,height*.69,height*.30);collar.rotation.x=-Math.PI/2;collar.scale.setScalar(.68);group.add(collar);
  const head=new THREE.Object3D();head.name='socket_head';head.position.set(0,height*.86,height*.38);group.add(head);
}
function deltaQuaternion(base,[x=0,y=0,z=0]){
  return base.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z,'XYZ'))).normalize();
}
function quaternionTrack(root,boneName,times,deltas){
  const bone=root.getObjectByName(boneName);if(!bone||deltas.length!==times.length)return null;
  const values=[];for(const delta of deltas){const q=deltaQuaternion(bone.quaternion,delta);values.push(q.x,q.y,q.z,q.w);}
  return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`,times,values);
}
function positionTrack(root,boneName,times,offsets){
  const bone=root.getObjectByName(boneName);if(!bone||offsets.length!==times.length)return null;
  const values=[];for(const [x=0,y=0,z=0] of offsets)values.push(bone.position.x+x,bone.position.y+y,bone.position.z+z);
  return new THREE.VectorKeyframeTrack(`${boneName}.position`,times,values);
}
function makeCatClip(root,name,times,{rot={},pos={}}={}){
  const tracks=[];
  for(const [bone,deltas] of Object.entries(rot)){const track=quaternionTrack(root,bone,times,deltas);if(track)tracks.push(track);}
  for(const [bone,offsets] of Object.entries(pos)){const track=positionTrack(root,bone,times,offsets);if(track)tracks.push(track);}
  return new THREE.AnimationClip(name,times.at(-1),tracks);
}
function synthesizeCatClips(root){
  const clips=[];
  const gait=[0,1,0,-1,0],opposite=gait.map(v=>-v),bend=[0,.28,.06,.22,0],bendOpp=[0,.22,.06,.28,0],tail=[0,-.10,0,.10,0];
  const runTimes=[0,.14,.28,.42,.56];
  const runRot={
    L_Leg_Upper:gait.map(v=>[0,0,v*.52]),R_BLeg_Upper:gait.map(v=>[0,0,v*.52]),R_Leg_Upper:opposite.map(v=>[0,0,v*.52]),L_BLeg_Upper:opposite.map(v=>[0,0,v*.52]),
    L_Leg_Lower:bend.map(v=>[0,0,-v]),R_BLeg_Lower:bend.map(v=>[0,0,-v]),R_Leg_Lower:bendOpp.map(v=>[0,0,-v]),L_BLeg_Lower:bendOpp.map(v=>[0,0,-v]),
    L_Foot:gait.map(v=>[0,0,-v*.16]),R_BFoot:gait.map(v=>[0,0,-v*.16]),R_Foot:opposite.map(v=>[0,0,-v*.16]),L_BFoot:opposite.map(v=>[0,0,-v*.16]),
    belly:gait.map(v=>[0,v*.018,v*.045]),chest:gait.map(v=>[0,0,-v*.055]),butt:gait.map(v=>[0,0,v*.05]),Neck:gait.map(v=>[0,0,-v*.035]),Head:gait.map(v=>[0,0,v*.025]),
    tail1:tail.map(v=>[0,v*.7,v]),tail2:tail.map(v=>[0,v,v*.75]),tail3:tail.map(v=>[0,v*.8,v*.55]),tail4:tail.map(v=>[0,v*.6,v*.4]),
  };
  clips.push(makeCatClip(root,'Cat_Run',runTimes,{rot:runRot}));

  const walkTimes=[0,.20,.40,.60,.80],walkPhase=[0,.72,0,-.72,0],walkOpp=walkPhase.map(v=>-v);
  clips.push(makeCatClip(root,'Cat_Accelerate',walkTimes,{rot:{
    L_Leg_Upper:walkPhase.map(v=>[0,0,v*.42]),R_BLeg_Upper:walkPhase.map(v=>[0,0,v*.42]),R_Leg_Upper:walkOpp.map(v=>[0,0,v*.42]),L_BLeg_Upper:walkOpp.map(v=>[0,0,v*.42]),
    L_Leg_Lower:walkPhase.map(v=>[0,0,-Math.max(0,v)*.22]),R_Leg_Lower:walkOpp.map(v=>[0,0,-Math.max(0,v)*.22]),L_BLeg_Lower:walkOpp.map(v=>[0,0,-Math.max(0,v)*.18]),R_BLeg_Lower:walkPhase.map(v=>[0,0,-Math.max(0,v)*.18]),
    belly:walkPhase.map(v=>[0,v*.012,v*.035]),Neck:walkPhase.map(v=>[0,0,-v*.028]),Head:walkPhase.map(v=>[0,0,v*.018]),tail1:walkPhase.map(v=>[0,v*.08,-v*.08]),tail2:walkPhase.map(v=>[0,v*.10,-v*.06]),
  }}));

  const stopTimes=[0,.10,.23,.38];
  clips.push(makeCatClip(root,'Cat_Decelerate',stopTimes,{rot:{
    L_Leg_Upper:[[0,0,0],[0,0,-.18],[0,0,-.10],[0,0,0]],R_Leg_Upper:[[0,0,0],[0,0,-.18],[0,0,-.10],[0,0,0]],
    L_BLeg_Upper:[[0,0,0],[0,0,.20],[0,0,.10],[0,0,0]],R_BLeg_Upper:[[0,0,0],[0,0,.20],[0,0,.10],[0,0,0]],
    chest:[[0,0,0],[0,0,.09],[0,0,.04],[0,0,0]],butt:[[0,0,0],[0,0,-.07],[0,0,-.03],[0,0,0]],Head:[[0,0,0],[0,0,.07],[0,0,.03],[0,0,0]],
  }}));

  const turnTimes=[0,.18,.36,.54];
  clips.push(makeCatClip(root,'Cat_Turn',turnTimes,{rot:{
    belly:[[0,0,0],[0,.08,.08],[0,-.08,-.08],[0,0,0]],chest:[[0,0,0],[0,.06,-.10],[0,-.06,.10],[0,0,0]],butt:[[0,0,0],[0,-.05,.07],[0,.05,-.07],[0,0,0]],
    Neck:[[0,0,0],[0,.10,-.08],[0,-.10,.08],[0,0,0]],Head:[[0,0,0],[0,.12,.10],[0,-.12,-.10],[0,0,0]],tail1:[[0,0,0],[0,-.18,-.14],[0,.18,.14],[0,0,0]],tail2:[[0,0,0],[0,-.20,-.12],[0,.20,.12],[0,0,0]],
    L_Leg_Upper:[[0,0,0],[0,0,.16],[0,0,-.16],[0,0,0]],R_Leg_Upper:[[0,0,0],[0,0,-.16],[0,0,.16],[0,0,0]],
  }}));

  const jumpTimes=[0,.10,.24,.42];
  clips.push(makeCatClip(root,'Cat_JumpRise',jumpTimes,{rot:{
    L_Leg_Upper:[[0,0,0],[0,0,-.34],[0,0,.28],[0,0,.12]],R_Leg_Upper:[[0,0,0],[0,0,-.34],[0,0,.28],[0,0,.12]],L_BLeg_Upper:[[0,0,0],[0,0,.34],[0,0,-.30],[0,0,-.14]],R_BLeg_Upper:[[0,0,0],[0,0,.34],[0,0,-.30],[0,0,-.14]],
    L_Leg_Lower:[[0,0,0],[0,0,-.30],[0,0,-.08],[0,0,-.04]],R_Leg_Lower:[[0,0,0],[0,0,-.30],[0,0,-.08],[0,0,-.04]],L_BLeg_Lower:[[0,0,0],[0,0,-.24],[0,0,-.06],[0,0,-.03]],R_BLeg_Lower:[[0,0,0],[0,0,-.24],[0,0,-.06],[0,0,-.03]],
    chest:[[0,0,0],[0,0,-.12],[0,0,.12],[0,0,.06]],butt:[[0,0,0],[0,0,.10],[0,0,-.10],[0,0,-.05]],Neck:[[0,0,0],[0,0,-.10],[0,0,.10],[0,0,.05]],Head:[[0,0,0],[0,0,.12],[0,0,-.08],[0,0,-.03]],tail1:[[0,0,0],[0,-.10,.16],[0,-.20,.25],[0,-.15,.18]],tail2:[[0,0,0],[0,-.08,.12],[0,-.16,.22],[0,-.12,.16]],
  }}));

  const fallTimes=[0,.24,.48];
  clips.push(makeCatClip(root,'Cat_Fall',fallTimes,{rot:{
    L_Leg_Upper:[[0,0,.12],[0,0,-.12],[0,0,.12]],R_Leg_Upper:[[0,0,.12],[0,0,-.12],[0,0,.12]],L_BLeg_Upper:[[0,0,-.18],[0,0,.12],[0,0,-.18]],R_BLeg_Upper:[[0,0,-.18],[0,0,.12],[0,0,-.18]],
    L_Leg_Lower:[[0,0,-.18],[0,0,-.24],[0,0,-.18]],R_Leg_Lower:[[0,0,-.18],[0,0,-.24],[0,0,-.18]],L_BLeg_Lower:[[0,0,-.16],[0,0,-.22],[0,0,-.16]],R_BLeg_Lower:[[0,0,-.16],[0,0,-.22],[0,0,-.16]],
    chest:[[0,0,.05],[0,0,.02],[0,0,.05]],Head:[[0,0,-.05],[0,0,-.02],[0,0,-.05]],tail1:[[0,-.18,.28],[0,-.10,.34],[0,-.18,.28]],tail2:[[0,-.15,.24],[0,-.08,.30],[0,-.15,.24]],
  }}));

  const landTimes=[0,.07,.18,.34];
  clips.push(makeCatClip(root,'Cat_Land',landTimes,{rot:{
    L_Leg_Upper:[[0,0,.10],[0,0,-.30],[0,0,-.16],[0,0,0]],R_Leg_Upper:[[0,0,.10],[0,0,-.30],[0,0,-.16],[0,0,0]],L_BLeg_Upper:[[0,0,-.10],[0,0,.30],[0,0,.16],[0,0,0]],R_BLeg_Upper:[[0,0,-.10],[0,0,.30],[0,0,.16],[0,0,0]],
    L_Leg_Lower:[[0,0,-.08],[0,0,-.30],[0,0,-.18],[0,0,0]],R_Leg_Lower:[[0,0,-.08],[0,0,-.30],[0,0,-.18],[0,0,0]],L_BLeg_Lower:[[0,0,-.06],[0,0,-.24],[0,0,-.14],[0,0,0]],R_BLeg_Lower:[[0,0,-.06],[0,0,-.24],[0,0,-.14],[0,0,0]],
    chest:[[0,0,.04],[0,0,-.14],[0,0,-.06],[0,0,0]],butt:[[0,0,-.03],[0,0,.11],[0,0,.05],[0,0,0]],Head:[[0,0,-.03],[0,0,.10],[0,0,.04],[0,0,0]],tail1:[[0,-.10,.18],[0,.05,.08],[0,.08,.03],[0,0,0]],
  }}));

  const nearTimes=[0,.09,.22,.42];
  clips.push(makeCatClip(root,'Cat_NearCatch',nearTimes,{rot:{
    belly:[[0,0,0],[.04,.12,-.14],[-.02,-.06,.08],[0,0,0]],chest:[[0,0,0],[0,-.12,.16],[0,.06,-.08],[0,0,0]],Neck:[[0,0,0],[0,-.16,-.18],[0,.08,.10],[0,0,0]],Head:[[0,0,0],[0,-.22,.20],[0,.10,-.10],[0,0,0]],
    tail1:[[0,0,0],[0,.30,-.28],[0,-.16,.18],[0,0,0]],tail2:[[0,0,0],[0,.34,-.24],[0,-.18,.15],[0,0,0]],L_Leg_Upper:[[0,0,0],[0,0,-.18],[0,0,.08],[0,0,0]],R_Leg_Upper:[[0,0,0],[0,0,-.18],[0,0,.08],[0,0,0]],
  }}));

  const caughtTimes=[0,.18,.42,.72];
  clips.push(makeCatClip(root,'Cat_Caught',caughtTimes,{rot:{
    chest:[[0,0,0],[0,0,-.18],[0,0,-.26],[0,0,-.28]],butt:[[0,0,0],[0,0,.18],[0,0,.26],[0,0,.28]],Neck:[[0,0,0],[0,0,-.14],[0,0,-.22],[0,0,-.24]],Head:[[0,0,0],[0,0,.10],[0,0,.20],[0,0,.22]],
    L_Leg_Upper:[[0,0,0],[0,0,-.28],[0,0,-.38],[0,0,-.40]],R_Leg_Upper:[[0,0,0],[0,0,-.28],[0,0,-.38],[0,0,-.40]],L_BLeg_Upper:[[0,0,0],[0,0,.32],[0,0,.42],[0,0,.44]],R_BLeg_Upper:[[0,0,0],[0,0,.32],[0,0,.42],[0,0,.44]],
    L_Leg_Lower:[[0,0,0],[0,0,-.22],[0,0,-.32],[0,0,-.34]],R_Leg_Lower:[[0,0,0],[0,0,-.22],[0,0,-.32],[0,0,-.34]],L_BLeg_Lower:[[0,0,0],[0,0,-.20],[0,0,-.30],[0,0,-.32]],R_BLeg_Lower:[[0,0,0],[0,0,-.20],[0,0,-.30],[0,0,-.32]],
    tail1:[[0,0,0],[0,.06,-.12],[0,.02,-.20],[0,0,-.22]],tail2:[[0,0,0],[0,.04,-.10],[0,.02,-.16],[0,0,-.18]],
  }}));

  const successTimes=[0,.25,.50,.75,1.0];
  const happy=[0,1,0,-1,0];
  clips.push(makeCatClip(root,'Cat_Success',successTimes,{rot:{
    Head:happy.map(v=>[0,v*.12,v*.09]),Neck:happy.map(v=>[0,v*.08,-v*.06]),chest:happy.map(v=>[0,0,v*.05]),tail1:happy.map(v=>[0,v*.32,v*.18]),tail2:happy.map(v=>[0,v*.38,v*.16]),tail3:happy.map(v=>[0,v*.34,v*.12]),tail4:happy.map(v=>[0,v*.28,v*.08]),
    L_Leg_Upper:happy.map(v=>[0,0,v*.08]),R_Leg_Upper:happy.map(v=>[0,0,-v*.08]),
  }}));
  return clips.filter(c=>c.tracks.length>0);
}

export class CharacterModel{
  constructor(group,mixer,clips,{yawOffset=Math.PI,species='unknown'}={}){
    this.group=group;this.mixer=mixer;this.clips=clips;this.actions=new Map(clips.map(c=>[c.name,mixer.clipAction(c)]));this.current=null;this.currentName='';this.semanticState='idle';this.stateHistory=[];this.lockUntil=0;this.motion={speed:0,heading:0,initialized:false,movingFor:0,wasMoving:false};this.failed=false;this.yawOffset=yawOffset;this.species=species;this.availableClips=clips.map(c=>c.name);this.syntheticClips=this.availableClips.filter(n=>CAT_SYNTH_NAMES.includes(n));
  }
  resolve(name){for(const candidate of clipCandidates(name)){if(this.actions.has(candidate))return{candidate,action:this.actions.get(candidate)};}const fallback=this.clips[0];return fallback?{candidate:fallback.name,action:this.actions.get(fallback.name)}:null;}
  play(name,{fade=.14,loop=true,hold=0,timeScale=1,force=false}={}){
    const resolved=this.resolve(name);if(!resolved)return false;const terminal=name==='caught'||name==='success';if(!force&&!terminal&&this.mixer.time<this.lockUntil&&resolved.action!==this.current)return false;
    const next=resolved.action;next.timeScale=timeScale;if(next===this.current){if(hold>0)this.lockUntil=Math.max(this.lockUntil,this.mixer.time+hold);return true;}
    if(this.current)this.current.fadeOut(fade);next.reset().setEffectiveWeight(1).setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);next.clampWhenFinished=!loop;next.fadeIn(fade).play();this.current=next;this.currentName=resolved.candidate;this.semanticState=name;if(hold>0)this.lockUntil=this.mixer.time+hold;if(this.stateHistory.at(-1)!==name){this.stateHistory.push(name);if(this.stateHistory.length>24)this.stateHistory.shift();}return true;
  }
  selectMotion({speed=0,heading=0,grounded=true,vy=0,vaultAnim=0,landTimer=0,mode='playing',active=false,dt=1/60}={}){
    const prev=this.motion,delta=prev.initialized?Math.atan2(Math.sin(heading-prev.heading),Math.cos(heading-prev.heading)):0,turnRate=Math.abs(delta)/Math.max(.001,dt),moving=speed>.34,movingFor=moving?(prev.movingFor||0)+dt:0;
    let anim='idle',loop=true,hold=0,timeScale=1,wasMoving=!!prev.wasMoving||speed>.55;
    if(mode==='caught'&&active){anim='caught';loop=false;hold=.7;}
    else if(mode==='success'){anim='success';loop=true;}
    else if(vaultAnim>0){anim='jumpRise';loop=false;hold=.18;}
    else if(landTimer>0){anim='land';loop=false;hold=.22;}
    else if(!grounded){anim=vy>0?'jumpRise':'fall';loop=vy<=0;timeScale=.95;}
    else if(speed<.18&&prev.wasMoving){anim='decelerate';loop=false;hold=.28;wasMoving=false;}
    else if(moving){
      const justStarted=!prev.initialized||prev.speed<=.34||movingFor<.28;
      const deliberateTurn=movingFor>.35&&speed>.75&&turnRate>2.8;
      if(justStarted){anim='accelerate';timeScale=Math.min(1.16,Math.max(.76,speed/1.55));}
      else if(deliberateTurn){anim='turn';timeScale=Math.min(1.28,.88+turnRate*.07);}
      else if(speed>2.15){anim='run';timeScale=Math.min(1.25,Math.max(.78,speed/3.25));}
      else{anim='accelerate';timeScale=Math.min(1.14,Math.max(.76,speed/1.55));}
    }
    this.motion={speed,heading,initialized:true,movingFor,wasMoving};return{anim,loop,hold,timeScale,turnRate,movingFor};
  }
  resetMotion(){this.motion={speed:0,heading:0,initialized:false,movingFor:0,wasMoving:false};this.lockUntil=0;}
  update(dt){this.mixer.update(dt);}
}
const loader=new GLTFLoader();
export async function loadCharacter(requestedUrl,{placeholderColor=0xff00ff,onError=()=>{}}={}){
  const config=AUTHORED[requestedUrl]||{url:requestedUrl,tint:null,height:1.1,yawOffset:Math.PI,species:'unknown'};
  try{
    const gltf=await loader.loadAsync(config.url),content=gltf.scene;
    normalizeScene(content,config.height,config.tint);
    const clips=config.species==='cat'?[...gltf.animations,...synthesizeCatClips(content)]:gltf.animations;
    const group=new THREE.Group();group.name=`character-${config.species}`;group.add(content);addSockets(group,config.height);
    const mixer=new THREE.AnimationMixer(content),model=new CharacterModel(group,mixer,clips,{yawOffset:config.yawOffset,species:config.species});model.play('idle',{fade:0});return model;
  }catch(error){
    onError(error);const g=new THREE.Group(),mesh=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.7,4,8),new THREE.MeshStandardMaterial({color:placeholderColor,emissive:0x220022}));mesh.position.y=.7;mesh.castShadow=true;g.add(mesh);addSockets(g,1.1);const model=new CharacterModel(g,new THREE.AnimationMixer(g),[],{yawOffset:Math.PI});model.failed=true;return model;
  }
}
