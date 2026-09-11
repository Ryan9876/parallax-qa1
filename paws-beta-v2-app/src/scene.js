import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, clamp } from './config.js';

function texture(loader,url,repeat=[2,2]){const t=loader.load(url);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function mat(color,map=null,{rough=.75,metal=.02,transparent=false,opacity=1}={}){return new THREE.MeshStandardMaterial({color,map,roughness:rough,metalness:metal,transparent,opacity});}
function shadowed(mesh){mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
function box(w,h,d,m,x,y,z,rot=0,{rounded=false,radius=.06}={}){const geo=rounded?new RoundedBoxGeometry(w,h,d,2,Math.min(radius,w*.18,h*.18,d*.18)):new THREE.BoxGeometry(w,h,d,1,1,1);const mesh=shadowed(new THREE.Mesh(geo,m));mesh.position.set(x,y,z);mesh.rotation.y=rot;return mesh;}
function cylinder(r,h,m,x,y,z){const mesh=shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r,r*.92,h,14),m));mesh.position.set(x,y,z);return mesh;}
function radialShadowTexture(){const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d'),grad=g.createRadialGradient(48,48,4,48,48,46);grad.addColorStop(0,'rgba(22,25,22,.62)');grad.addColorStop(.52,'rgba(22,25,22,.30)');grad.addColorStop(1,'rgba(22,25,22,0)');g.fillStyle=grad;g.fillRect(0,0,96,96);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}

export class SceneView{
  constructor(canvas){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xbec8bb);this.scene.fog=new THREE.Fog(0xbec8bb,20,38);this.scene.environmentIntensity=.78;
    this.camera=new THREE.PerspectiveCamera(48,1,.08,70);this.camera.position.set(0,5,-8);
    this.loader=new THREE.TextureLoader();this.worldGroup=new THREE.Group();this.fxGroup=new THREE.Group();this.scene.add(this.worldGroup,this.fxGroup);
    this.beacon=new THREE.Group();this.scene.add(this.beacon);this.collectibleMeshes=new Map();this.decorAnimations=[];this.assetErrors=[];this.assets={};
    this.assets.wood=texture(this.loader,'/assets/cc0/textures/wood-floor-1k.jpg',[4,5]);this.assets.plaster=texture(this.loader,'/assets/cc0/textures/plaster-wall-1k.jpg',[4,2]);
    this._lights();this._contactShadows();this.resize();this.ready=this._loadEnvironmentAssets();
  }
  async _safe(name,promise){try{return await promise;}catch(error){this.assetErrors.push(`${name}:${error?.message||error}`);return null;}}
  async _loadEnvironmentAssets(){
    const objLoader=new OBJLoader(),exrLoader=new EXRLoader();
    const [sofa,coffee,env]=await Promise.all([
      this._safe('kenney-sofa',objLoader.loadAsync('/assets/cc0/furniture/lounge-sofa.obj')),
      this._safe('kenney-coffee',objLoader.loadAsync('/assets/cc0/furniture/coffee-table.obj')),
      this._safe('polyhaven-hdri',exrLoader.loadAsync('/assets/cc0/hdri/studio-small-08-1k.exr')),
    ]);
    this.assets.sofa=sofa;this.assets.coffee=coffee;
    if(env){env.mapping=THREE.EquirectangularReflectionMapping;this.scene.environment=env;}
  }
  _lights(){
    const hemi=new THREE.HemisphereLight(0xfff5df,0x4a5547,1.32);this.scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffe1b8,2.25);sun.position.set(-5.5,11,3.5);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-11;sun.shadow.camera.right=11;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-11;sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;this.scene.add(sun);
    const warm=new THREE.PointLight(0xffbd83,18,13,2);warm.position.set(-4.7,3.6,4.7);this.scene.add(warm);
    const cool=new THREE.PointLight(0x77c9c0,10,12,2);cool.position.set(4.8,3.1,-1.4);this.scene.add(cool);
  }
  _contactShadows(){const map=radialShadowTexture(),geo=new THREE.PlaneGeometry(1.35,1.05);this.contactShadows=[0,1,2].map((_,i)=>{const m=new THREE.MeshBasicMaterial({map,transparent:true,opacity:i===2?.25:.22,depthWrite:false,toneMapped:false});const s=new THREE.Mesh(geo,m);s.rotation.x=-Math.PI/2;s.position.y=.014;s.renderOrder=1;s.visible=false;this.fxGroup.add(s);return s;});}
  _syncContactShadows(){const names=['cat-orange','cat-gray','henley'];for(let i=0;i<names.length;i++){const s=this.contactShadows[i],v=this.scene.getObjectByName(names[i]);if(!v||!v.visible){s.visible=false;continue;}s.visible=true;const height=Math.max(0,v.position.y);s.position.set(v.position.x,.014,v.position.z);const fade=1-clamp(height/2.1,0,.82);s.material.opacity=(i===2?.24:.21)*fade;const scale=1+clamp(height*.16,0,.28);s.scale.set(scale,scale,scale);}}
  _fitAuthored(template,p,material){if(!template)return null;const obj=template.clone(true);obj.traverse(n=>{if(n.isMesh){n.material=material;n.castShadow=true;n.receiveShadow=true;}});const base=new THREE.Box3().setFromObject(obj),size=base.getSize(new THREE.Vector3());if(size.x<.001||size.y<.001||size.z<.001)return null;obj.scale.set(p.w/size.x,p.h/size.y,p.d/size.z);const scaled=new THREE.Box3().setFromObject(obj);obj.position.set(p.x,-scaled.min.y,p.z);obj.rotation.y=p.rot;return obj;}
  _backgroundCluster(kitchen,{woodMat,fabricMat,cabinetMat}){
    const group=new THREE.Group();group.name='decorative-depth-cluster';
    const sofa=this._fitAuthored(this.assets.sofa,{w:kitchen?2.7:3.1,h:.74,d:1.05,x:-3.7,z:7.15,rot:.06},fabricMat);if(sofa)group.add(sofa);else group.add(box(2.7,.74,1.05,fabricMat,-3.7,.37,7.15,.06,{rounded:true,radius:.12}));
    const coffee=this._fitAuthored(this.assets.coffee,{w:1.45,h:.42,d:.8,x:-1.35,z:7.05,rot:-.04},woodMat);if(coffee)group.add(coffee);else group.add(box(1.45,.42,.8,woodMat,-1.35,.21,7.05,-.04,{rounded:true}));
    const console=box(2.1,.9,.48,cabinetMat,3.8,.45,7.45,-.03,{rounded:true,radius:.08});group.add(console);
    const lampBase=cylinder(.2,.58,woodMat,3.15,.3,6.78),lampShade=new THREE.Mesh(new THREE.ConeGeometry(.36,.5,18,1,true),new THREE.MeshStandardMaterial({color:0xf2d8ac,roughness:.72,side:THREE.DoubleSide}));lampShade.position.set(3.15,.94,6.78);lampShade.castShadow=true;group.add(lampBase,lampShade);
    const artMat=new THREE.MeshStandardMaterial({color:kitchen?0xb45f48:0x4e887d,roughness:.8});group.add(box(1.1,.06,.8,artMat,1.7,1.72,8.24,0));
    this.worldGroup.add(group);
  }
  clearWorld(){for(const child of [...this.worldGroup.children])this.worldGroup.remove(child);this.collectibleMeshes.clear();this.decorAnimations=[];this.beacon.clear();}
  build(level,world){
    this.clearWorld();const kitchen=level.theme==='kitchen';this.scene.background=new THREE.Color(kitchen?0xc8bcaa:0xb5c8bc);this.scene.fog.color.copy(this.scene.background);
    const fallbackFloor=texture(this.loader,kitchen?'/assets/textures/tile.svg':'/assets/textures/wood.svg',kitchen?[8,8]:[6,8]),fallbackWood=texture(this.loader,'/assets/textures/wood.svg',[2,2]),rug=texture(this.loader,'/assets/textures/rug.svg',[2,2]),fabric=texture(this.loader,'/assets/textures/fabric.svg',[2,2]);
    const floorMap=kitchen?fallbackFloor:this.assets.wood,woodMap=this.assets.wood||fallbackWood,wallMap=this.assets.plaster||null;
    const floor=shadowed(new THREE.Mesh(new THREE.PlaneGeometry(14.2,17.4),mat(0xffffff,floorMap,{rough:.88})));floor.rotation.x=-Math.PI/2;floor.position.set(0,-.02,1.5);this.worldGroup.add(floor);
    const wallColor=kitchen?0xeee3d2:0xe6ece2,backWallMat=mat(wallColor,wallMap,{rough:.94}),sideWallMat=new THREE.MeshStandardMaterial({color:wallColor,map:wallMap,roughness:.94,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide});
    const backWall=box(13,3.15,.18,backWallMat,0,1.575,8.42),leftWall=box(.18,3.15,16.2,sideWallMat,-6.4,1.575,1.05),rightWall=box(.18,3.15,16.2,sideWallMat,6.4,1.575,1.05);leftWall.castShadow=rightWall.castShadow=false;leftWall.receiveShadow=rightWall.receiveShadow=false;leftWall.renderOrder=2;rightWall.renderOrder=2;this.worldGroup.add(backWall,leftWall,rightWall);
    const trim=mat(0x715a48,woodMap,{rough:.68});this.worldGroup.add(box(13,.14,.12,trim,0,.11,8.25),box(.12,.14,15.9,trim,-6.22,.11,1.0),box(.12,.14,15.9,trim,6.22,.11,1.0));
    if(!kitchen){for(let x=-4.8;x<=4.8;x+=2.4){const glass=new THREE.Mesh(new THREE.PlaneGeometry(2.02,2.25),new THREE.MeshPhysicalMaterial({color:0xcce2e5,transparent:true,opacity:.28,roughness:.12,transmission:.32,depthWrite:false}));glass.position.set(x,1.7,8.31);this.worldGroup.add(glass);}}
    const woodMat=mat(0xffffff,woodMap,{rough:.64}),cabinetMat=mat(kitchen?0x6f7e63:0x816c5d,woodMap,{rough:.76}),fabricMat=mat(0x66745d,fabric,{rough:.92}),darkMat=mat(0x343d36,null,{rough:.82}),rugMat=mat(0xffffff,rug,{rough:.95});
    for(const p of world.pieces){let obj=null;const y=p.h/2;
      if(p.kind==='rug'){obj=box(p.w,.035,p.d,rugMat,p.x,.01,p.z,p.rot,{rounded:true,radius:.025});obj.castShadow=false;}
      else if(['stool','plant','planter','cat-tree'].includes(p.kind)){obj=new THREE.Group();if(p.kind==='stool'){obj.add(cylinder(.3,.55,woodMat,p.x,.28,p.z));}else{const pot=cylinder(p.w*.28,.45,mat(0xa55e43),p.x,.23,p.z);obj.add(pot);for(let i=0;i<4;i++){const leaf=shadowed(new THREE.Mesh(new THREE.SphereGeometry(.32,9,6),mat(0x567c4e)));leaf.scale.set(.7,1.4,.55);leaf.position.set(p.x+(i-1.5)*.14,.72+i*.12,p.z+(i%2?-.08:.08));obj.add(leaf);this.decorAnimations.push({o:leaf,phase:i*.9,base:leaf.rotation.z});}if(p.kind==='cat-tree'){obj.add(box(.9,1.25,.85,fabricMat,p.x,.92,p.z,0,{rounded:true,radius:.1}),box(.78,.12,.78,fabricMat,p.x,1.62,p.z,0,{rounded:true}));}}
      }
      else if(p.kind==='arch'){const g=new THREE.Group();g.add(box(.28,2.3,.4,darkMat,p.x-p.w/2,1.15,p.z,0,{rounded:true}),box(.28,2.3,.4,darkMat,p.x+p.w/2,1.15,p.z,0,{rounded:true}),box(p.w+.28,.28,.4,darkMat,p.x,2.16,p.z,0,{rounded:true}));obj=g;}
      else {
        const material=['sofa','chaise','ottoman','bench'].includes(p.kind)?fabricMat:(['cabinet','shelf','toybox'].includes(p.kind)?cabinetMat:woodMat);
        const template=['sofa','chaise'].includes(p.kind)?this.assets.sofa:(['table','coffee'].includes(p.kind)?this.assets.coffee:null);
        obj=this._fitAuthored(template,p,material)||box(p.w,p.h,p.d,material,p.x,y,p.z,p.rot,{rounded:true,radius:['sofa','chaise','ottoman'].includes(p.kind)?.12:.07});
        if(!template&&['table','coffee'].includes(p.kind)){for(const sx of [-1,1])for(const sz of [-1,1])this.worldGroup.add(box(.12,p.h*.8,.12,darkMat,p.x+sx*p.w*.38,p.h*.4,p.z+sz*p.d*.35,p.rot,{rounded:true,radius:.025}));}
      }
      if(obj)this.worldGroup.add(obj);
    }
    this._backgroundCluster(kitchen,{woodMat,fabricMat,cabinetMat});
    for(const c of world.collectibles){const g=new THREE.Group();const core=shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(.16,1),new THREE.MeshStandardMaterial({color:0xf3cf68,emissive:0x7a5915,emissiveIntensity:.45,roughness:.35,metalness:.15})));g.add(core);const ring=new THREE.Mesh(new THREE.TorusGeometry(.25,.025,7,20),new THREE.MeshBasicMaterial({color:0xffe59a,transparent:true,opacity:.6}));ring.rotation.x=Math.PI/2;g.add(ring);g.position.set(c.x,.34,c.z);g.userData.phase=Math.random()*Math.PI*2;this.worldGroup.add(g);this.collectibleMeshes.set(c.id,g);}
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.42,.055,8,28),new THREE.MeshBasicMaterial({color:COLORS.teal,transparent:true,opacity:.88}));ring.rotation.x=Math.PI/2;const column=new THREE.Mesh(new THREE.CylinderGeometry(.11,.42,2.2,18,1,true),new THREE.MeshBasicMaterial({color:COLORS.teal,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}));column.position.y=1.05;this.beacon.add(ring,column);this.beacon.visible=false;
  }
  setObjective(o){if(!o){this.beacon.visible=false;return;}this.beacon.visible=true;this.beacon.position.set(o.x,.06,o.z);this.beacon.traverse(x=>{if(x.material?.color)x.material.color.set(o.cat==='orange'?COLORS.rust:COLORS.teal);});}
  collect(id){const m=this.collectibleMeshes.get(id);if(m){m.visible=false;this.collectibleMeshes.delete(id);}}
  resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  update(time,dt){this._syncContactShadows();this.beacon.rotation.y+=dt*.8;this.beacon.position.y=.06+Math.sin(time*3.1)*.04;for(const [,g] of this.collectibleMeshes){g.rotation.y+=dt*1.4;g.position.y=.34+Math.sin(time*2.6+g.userData.phase)*.08;}for(const a of this.decorAnimations)a.o.rotation.z=a.base+Math.sin(time*.9+a.phase)*.05;}
  render(){this.renderer.render(this.scene,this.camera);}
}
