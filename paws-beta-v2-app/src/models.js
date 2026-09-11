import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CLIP_ALIASES={jump:'jumpRise',air:'fall',stop:'decelerate',near:'nearCatch'};
const STATE_CLIPS={
  idle:['Idle','Idle_2','Idle_2_HeadLow','Sitting_Idle'],
  accelerate:['Walk','Run','Gallop','Idle'],
  run:['Run','Gallop','Walk','Jump_Loop'],
  decelerate:['Walk','Idle','Idle_2'],
  turn:['Walk','Run','Idle'],
  jumpRise:['Gallop_Jump','Jump_Loop','Jump','Run'],
  fall:['Jump_Loop','Gallop_Jump','Jump','Run'],
  land:['Idle_HitReact1','Idle_HitReact2','Idle','Walk'],
  nearCatch:['Idle_HitReact2','Idle_HitReact1','Headbutt','Run'],
  caught:['Death','Idle_HitReact2','Sitting_Idle','Idle_2_HeadLow','Idle'],
  alert:['Idle_HitReact2','Attack','Run','Walk','Idle'],
  success:['Sitting_Idle','Headbutt','Yes','Wave','Idle_2','Idle'],
};
const AUTHORED={
  '/assets/models/cat-orange.gltf':{url:'/assets/characters/authored/cat.glb',tint:0xd87835,height:1.06,yawOffset:Math.PI,species:'cat'},
  '/assets/models/cat-gray.gltf':{url:'/assets/characters/authored/cat.glb',tint:0x7f8b96,height:1.06,yawOffset:Math.PI,species:'cat'},
  '/assets/models/henley.gltf':{url:'/assets/characters/authored/henley.glb',tint:null,height:1.38,yawOffset:Math.PI,species:'dog'},
};

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
  const collar=new THREE.Object3D();collar.name='socket_collar';collar.position.set(0,height*.64,-height*.22);group.add(collar);
  const head=new THREE.Object3D();head.name='socket_head';head.position.set(0,height*.82,-height*.34);group.add(head);
}

export class CharacterModel{
  constructor(group,mixer,clips,{yawOffset=Math.PI,species='unknown'}={}){
    this.group=group;this.mixer=mixer;this.clips=clips;this.actions=new Map(clips.map(c=>[c.name,mixer.clipAction(c)]));this.current=null;this.currentName='';this.failed=false;this.yawOffset=yawOffset;this.species=species;this.availableClips=clips.map(c=>c.name);
  }
  resolve(name){for(const candidate of clipCandidates(name)){if(this.actions.has(candidate))return{candidate,action:this.actions.get(candidate)};}const fallback=this.clips[0];return fallback?{candidate:fallback.name,action:this.actions.get(fallback.name)}:null;}
  play(name,{fade=.18,loop=true}={}){const resolved=this.resolve(name);if(!resolved)return;const next=resolved.action;if(next===this.current)return;if(this.current)this.current.fadeOut(fade);next.reset().setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);next.clampWhenFinished=!loop;next.fadeIn(fade).play();this.current=next;this.currentName=resolved.candidate;}
  update(dt){this.mixer.update(dt);}
}
const loader=new GLTFLoader();
export async function loadCharacter(requestedUrl,{placeholderColor=0xff00ff,onError=()=>{}}={}){
  const config=AUTHORED[requestedUrl]||{url:requestedUrl,tint:null,height:1.1,yawOffset:Math.PI,species:'unknown'};
  try{
    const gltf=await loader.loadAsync(config.url),content=gltf.scene;
    normalizeScene(content,config.height,config.tint);
    const group=new THREE.Group();group.name=`character-${config.species}`;group.add(content);addSockets(group,config.height);
    const mixer=new THREE.AnimationMixer(content),model=new CharacterModel(group,mixer,gltf.animations,{yawOffset:config.yawOffset,species:config.species});model.play('idle');return model;
  }catch(error){
    onError(error);const g=new THREE.Group(),mesh=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.7,4,8),new THREE.MeshStandardMaterial({color:placeholderColor,emissive:0x220022}));mesh.position.y=.7;mesh.castShadow=true;g.add(mesh);addSockets(g,1.1);const model=new CharacterModel(g,new THREE.AnimationMixer(g),[],{yawOffset:Math.PI});model.failed=true;return model;
  }
}
