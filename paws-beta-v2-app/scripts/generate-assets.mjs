import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import fs from 'node:fs'; import path from 'node:path';

const root=path.resolve('public/assets'); fs.mkdirSync(path.join(root,'models'),{recursive:true}); fs.mkdirSync(path.join(root,'audio'),{recursive:true}); fs.mkdirSync(path.join(root,'textures'),{recursive:true});

globalThis.FileReader ??= class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onload?.({target:this});this.onloadend?.({target:this});});}
  readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(v).toString('base64')}`;this.onload?.({target:this});this.onloadend?.({target:this});});}
};

function weighted(geometry,boneIndex){const n=geometry.getAttribute('position').count,ji=new Uint16Array(n*4),sw=new Float32Array(n*4);for(let i=0;i<n;i++){ji[i*4]=boneIndex;sw[i*4]=1;}geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ji,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));return geometry;}
function place(g,{x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1}={}){const m=new THREE.Matrix4();const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz));m.compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(sx,sy,sz));g.applyMatrix4(m);return g;}
function q(rx=0,ry=0,rz=0){return new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz));}
function track(name,times,qs){return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`,times,qs.flatMap(v=>[v.x,v.y,v.z,v.w]));}
function clip(name,duration,tracks){return new THREE.AnimationClip(name,duration,tracks);}

async function makeModel({name,color,scale=1,dog=false}){
  const rootBone=new THREE.Bone();rootBone.name='root';
  const spine=new THREE.Bone();spine.name='spine';spine.position.set(0,.56*scale,0);rootBone.add(spine);
  const head=new THREE.Bone();head.name='head';head.position.set(0,.12*scale,-.72*scale);spine.add(head);
  const frontL=new THREE.Bone();frontL.name='frontL';frontL.position.set(-.28*scale,.5*scale,-.5*scale);rootBone.add(frontL);
  const frontR=new THREE.Bone();frontR.name='frontR';frontR.position.set(.28*scale,.5*scale,-.5*scale);rootBone.add(frontR);
  const rearL=new THREE.Bone();rearL.name='rearL';rearL.position.set(-.28*scale,.5*scale,.52*scale);rootBone.add(rearL);
  const rearR=new THREE.Bone();rearR.name='rearR';rearR.position.set(.28*scale,.5*scale,.52*scale);rootBone.add(rearR);
  const tail=new THREE.Bone();tail.name='tail';tail.position.set(0,.62*scale,.72*scale);spine.add(tail);
  const collar=new THREE.Bone();collar.name='socket_collar';collar.position.set(0,.02*scale,-.46*scale);spine.add(collar);
  const headSocket=new THREE.Bone();headSocket.name='socket_head';headSocket.position.set(0,.32*scale,-.05*scale);head.add(headSocket);
  const bones=[rootBone,spine,head,frontL,frontR,rearL,rearR,tail,collar,headSocket];
  const bodyLen=dog?1.7:1.45, bodyH=dog?.72:.58, bodyW=dog?.72:.6;
  const parts=[];
  parts.push(weighted(place(new THREE.BoxGeometry(bodyW*scale,bodyH*scale,bodyLen*scale,2,2,3),{y:.67*scale}),1));
  parts.push(weighted(place(new THREE.BoxGeometry((dog?.66:.52)*scale,(dog?.58:.48)*scale,(dog?.62:.54)*scale,2,2,2),{y:(dog?1.02:.91)*scale,z:(dog?-.94:-.86)*scale}),2));
  const legH=(dog?.75:.63)*scale,legW=(dog?.21:.17)*scale;
  for(const [idx,x,z] of [[3,-.28,-.53],[4,.28,-.53],[5,-.28,.53],[6,.28,.53]])parts.push(weighted(place(new THREE.BoxGeometry(legW,legH,legW,1,3,1),{x:x*scale,y:.3*scale,z:z*scale}),idx));
  parts.push(weighted(place(new THREE.CylinderGeometry((dog?.12:.09)*scale,(dog?.08:.055)*scale,(dog?1.0:.85)*scale,8,3),{y:.78*scale,z:1.06*scale,rx:Math.PI/2}),7));
  if(!dog){parts.push(weighted(place(new THREE.ConeGeometry(.13*scale,.32*scale,4),{x:-.17*scale,y:1.28*scale,z:-.92*scale,rz:-.08}),2));parts.push(weighted(place(new THREE.ConeGeometry(.13*scale,.32*scale,4),{x:.17*scale,y:1.28*scale,z:-.92*scale,rz:.08}),2));}
  else {parts.push(weighted(place(new THREE.BoxGeometry(.17*scale,.42*scale,.2*scale),{x:-.3*scale,y:1.04*scale,z:-1.03*scale,rz:-.45}),2));parts.push(weighted(place(new THREE.BoxGeometry(.17*scale,.42*scale,.2*scale),{x:.3*scale,y:1.04*scale,z:-1.03*scale,rz:.45}),2));}
  const geometry=mergeGeometries(parts,false);geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({color,roughness:.73,metalness:.02});
  const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=`${name}-skinned`;mesh.add(rootBone);mesh.bind(new THREE.Skeleton(bones));mesh.castShadow=true;mesh.receiveShadow=true;
  const scene=new THREE.Group();scene.name=name;scene.add(mesh);
  const runTimes=[0,.18,.36,.54,.72];
  const runA=[q(.65),q(-.6),q(.65),q(-.6),q(.65)],runB=[q(-.6),q(.65),q(-.6),q(.65),q(-.6)];
  const clips=[
    clip('idle',2,[track('head',[0,1,2],[q(0,-.08,0),q(0,.09,0),q(0,-.08,0)]),track('tail',[0,.5,1,1.5,2],[q(.08,-.24,.05),q(.08,.2,-.04),q(.08,.28,.04),q(.08,-.2,-.04),q(.08,-.24,.05)])]),
    clip('run',.72,[track('frontL',runTimes,runA),track('frontR',runTimes,runB),track('rearL',runTimes,runB),track('rearR',runTimes,runA),track('spine',runTimes,[q(.02),q(-.05),q(.02),q(-.05),q(.02)])]),
    clip('accelerate',.35,[track('spine',[0,.35],[q(.08),q(-.1)]),track('frontL',[0,.35],[q(0),q(.32)]),track('frontR',[0,.35],[q(0),q(-.32)])]),
    clip('decelerate',.38,[track('spine',[0,.38],[q(-.08),q(.1)]),track('frontL',[0,.38],[q(.2),q(-.15)]),track('frontR',[0,.38],[q(-.2),q(.15)])]),
    clip('turn',.34,[track('spine',[0,.17,.34],[q(0,0,.12),q(0,0,-.13),q(0,0,.12)])]),
    clip('jumpRise',.44,[track('frontL',[0,.44],[q(.1),q(-.72)]),track('frontR',[0,.44],[q(.1),q(-.72)]),track('rearL',[0,.44],[q(-.15),q(.55)]),track('rearR',[0,.44],[q(-.15),q(.55)])]),
    clip('fall',.5,[track('frontL',[0,.5],[q(-.45),q(-.25)]),track('frontR',[0,.5],[q(-.45),q(-.25)]),track('rearL',[0,.5],[q(.4),q(.22)]),track('rearR',[0,.5],[q(.4),q(.22)])]),
    clip('land',.32,[track('spine',[0,.16,.32],[q(-.12),q(.18),q(0)]),track('frontL',[0,.16,.32],[q(-.2),q(.35),q(0)]),track('frontR',[0,.16,.32],[q(-.2),q(.35),q(0)])]),
    clip('nearCatch',.42,[track('head',[0,.21,.42],[q(0,-.25,.08),q(0,.32,-.08),q()]),track('tail',[0,.21,.42],[q(0,-.45),q(0,.45),q()])]),
    clip('caught',.9,[track('spine',[0,.35,.9],[q(),q(0,0,.65),q(0,0,.9)]),track('head',[0,.9],[q(),q(.2,0,-.3)])]),
    clip('alert',.55,[track('head',[0,.2,.55],[q(.15),q(-.22),q(.05)]),track('spine',[0,.55],[q(.1),q(-.08)])]),
    clip('success',1.1,[track('frontL',[0,.25,.55,1.1],[q(),q(-.85),q(-.85),q()]),track('head',[0,.55,1.1],[q(),q(-.15,.28),q()]),track('tail',[0,.27,.55,.82,1.1],[q(0,-.3),q(0,.38),q(0,-.38),q(0,.38),q(0,-.3)])])
  ];
  const exporter=new GLTFExporter();const result=await exporter.parseAsync(scene,{binary:false,animations:clips,onlyVisible:true});
  fs.writeFileSync(path.join(root,'models',`${name}.gltf`),JSON.stringify(result));
}

await makeModel({name:'cat-orange',color:0xd87835,scale:1,dog:false});
await makeModel({name:'cat-gray',color:0x808b96,scale:1,dog:false});
await makeModel({name:'henley',color:0x6c5146,scale:1.25,dog:true});

function wav(name,{duration=.2,f0=420,f1=210,noise=.05,amp=.45,harm=.2}={}){const sr=22050,n=Math.floor(sr*duration),data=Buffer.alloc(44+n*2);data.write('RIFF',0);data.writeUInt32LE(36+n*2,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(sr,24);data.writeUInt32LE(sr*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(n*2,40);let phase=0;for(let i=0;i<n;i++){const t=i/(n-1),freq=f0+(f1-f0)*t;phase+=2*Math.PI*freq/sr;const env=Math.sin(Math.PI*t)**.75;const rnd=(Math.random()*2-1)*noise;const s=Math.sin(phase)+harm*Math.sin(phase*2.01)+rnd;data.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(s*amp*env*32767))),44+i*2);}fs.writeFileSync(path.join(root,'audio',name),data);}
const samples={
 'jump-1.wav':{duration:.12,f0:330,f1:540,amp:.22},'jump-2.wav':{duration:.14,f0:290,f1:480,amp:.2},
 'land-1.wav':{duration:.11,f0:130,f1:70,noise:.35,amp:.25},'land-2.wav':{duration:.13,f0:160,f1:85,noise:.32,amp:.24},'land-3.wav':{duration:.1,f0:110,f1:55,noise:.4,amp:.22},
 'collect-1.wav':{duration:.18,f0:620,f1:940,amp:.19},'collect-2.wav':{duration:.2,f0:700,f1:1040,amp:.18},
 'objective-1.wav':{duration:.35,f0:390,f1:760,amp:.2},'objective-2.wav':{duration:.4,f0:440,f1:880,amp:.18},
 'caught.wav':{duration:.48,f0:260,f1:95,noise:.1,amp:.27},'success.wav':{duration:.65,f0:390,f1:920,amp:.19,harm:.32},
 'switch.wav':{duration:.12,f0:500,f1:730,amp:.16},'near.wav':{duration:.22,f0:260,f1:520,amp:.18,noise:.08},
 'cat-1.wav':{duration:.6,f0:470,f1:260,amp:.22,harm:.45},'cat-2.wav':{duration:.72,f0:520,f1:285,amp:.2,harm:.5}
};for(const [n,o] of Object.entries(samples))wav(n,o);

const svgs={
 'wood.svg':`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="100%" height="100%" fill="#9b6d4d"/><path d="M0 28H256M0 82H256M0 138H256M0 198H256" stroke="#694632" stroke-width="3" opacity=".38"/><path d="M40 0v256M126 0v256M212 0v256" stroke="#c99770" opacity=".22"/></svg>`,
 'tile.svg':`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="100%" height="100%" fill="#d7d0bf"/><path d="M0 64H256M0 128H256M0 192H256M64 0V256M128 0V256M192 0V256" stroke="#b6ad99" stroke-width="3"/></svg>`,
 'rug.svg':`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="100%" height="100%" fill="#496e67"/><path d="M0 0L256 256M-64 0L192 256M64 0L320 256" stroke="#82a29a" stroke-width="8" opacity=".26"/></svg>`,
 'fabric.svg':`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="100%" height="100%" fill="#66715b"/><path d="M0 16H256M0 48H256M0 80H256M0 112H256M0 144H256M0 176H256M0 208H256M0 240H256" stroke="#a6ad91" opacity=".12"/></svg>`
};for(const [n,s] of Object.entries(svgs))fs.writeFileSync(path.join(root,'textures',n),s);
fs.writeFileSync(path.join(root,'provenance.json'),JSON.stringify({version:1,generatedAt:new Date().toISOString(),assets:{characters:'Original procedural low-poly skinned glTF generated at build time; no remote runtime dependency.',audio:'Original pre-rendered sampled WAV cues generated at build time; event-driven playback.',textures:'Original procedural SVG material textures generated at build time.'},runtimeOrigins:['same-origin only']},null,2));
console.log('Generated 3 rigged glTF characters, 15 WAV samples, 4 local textures.');
