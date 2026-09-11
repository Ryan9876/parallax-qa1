import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CLIP_ALIASES={jump:'jumpRise',air:'fall',stop:'decelerate',near:'nearCatch'};
export class CharacterModel{
  constructor(group,mixer,clips){this.group=group;this.mixer=mixer;this.actions=new Map(clips.map(c=>[c.name,mixer.clipAction(c)]));this.current=null;this.failed=false;}
  play(name,{fade=.16,loop=true}={}){name=CLIP_ALIASES[name]||name;const next=this.actions.get(name)||this.actions.get('idle');if(!next||next===this.current)return;if(this.current)this.current.fadeOut(fade);next.reset().setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);next.clampWhenFinished=!loop;next.fadeIn(fade).play();this.current=next;}
  update(dt){this.mixer.update(dt);}
}
const loader=new GLTFLoader();
export async function loadCharacter(url,{placeholderColor=0xff00ff,onError=()=>{}}={}){
  try{const gltf=await loader.loadAsync(url);const group=gltf.scene;group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});const mixer=new THREE.AnimationMixer(group);const model=new CharacterModel(group,mixer,gltf.animations);model.play('idle');return model;}
  catch(error){onError(error);const g=new THREE.Group(),mesh=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.7,4,8),new THREE.MeshStandardMaterial({color:placeholderColor,emissive:0x220022}));mesh.position.y=.7;g.add(mesh);const model=new CharacterModel(g,new THREE.AnimationMixer(g),[]);model.failed=true;return model;}
}
