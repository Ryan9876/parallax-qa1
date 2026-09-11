import * as THREE from 'three';
import { COLORS } from './config.js';

function texture(loader,url,repeat=[2,2]){const t=loader.load(url);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.colorSpace=THREE.SRGBColorSpace;return t;}
function mat(color,map=null,{rough=.75,metal=.02}={}){return new THREE.MeshStandardMaterial({color,map,roughness:rough,metalness:metal});}
function shadowed(mesh){mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
function box(w,h,d,m,x,y,z,rot=0){const mesh=shadowed(new THREE.Mesh(new THREE.BoxGeometry(w,h,d,2,2,2),m));mesh.position.set(x,y,z);mesh.rotation.y=rot;return mesh;}
function cylinder(r,h,m,x,y,z){const mesh=shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r,r*.92,h,16),m));mesh.position.set(x,y,z);return mesh;}

export class SceneView{
  constructor(canvas){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.04;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xbec8bb);this.scene.fog=new THREE.Fog(0xbec8bb,17,34);
    this.camera=new THREE.PerspectiveCamera(48,1,.08,70);this.camera.position.set(0,5,8);
    this.loader=new THREE.TextureLoader();this.worldGroup=new THREE.Group();this.fxGroup=new THREE.Group();this.scene.add(this.worldGroup,this.fxGroup);
    this.beacon=new THREE.Group();this.scene.add(this.beacon);this.collectibleMeshes=new Map();this.decorAnimations=[];
    this._lights(); this.resize();
  }
  _lights(){const hemi=new THREE.HemisphereLight(0xf8f1df,0x4a5547,1.75);this.scene.add(hemi);const sun=new THREE.DirectionalLight(0xffedd0,3.4);sun.position.set(-6,12,5);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-11;sun.shadow.camera.right=11;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-11;sun.shadow.bias=-.00035;this.scene.add(sun);const fill=new THREE.PointLight(0x79c8bb,14,16,2);fill.position.set(5,4,-2);this.scene.add(fill);}
  clearWorld(){for(const child of [...this.worldGroup.children])this.worldGroup.remove(child);this.collectibleMeshes.clear();this.decorAnimations=[];this.beacon.clear();}
  build(level,world){
    this.clearWorld();const kitchen=level.theme==='kitchen';this.scene.background=new THREE.Color(kitchen?0xcbbfae:0xb7cbbf);this.scene.fog.color.copy(this.scene.background);
    const floorTex=texture(this.loader,kitchen?'/assets/textures/tile.svg':'/assets/textures/wood.svg',kitchen?[8,8]:[6,8]);const wood=texture(this.loader,'/assets/textures/wood.svg',[2,2]),rug=texture(this.loader,'/assets/textures/rug.svg',[2,2]),fabric=texture(this.loader,'/assets/textures/fabric.svg',[2,2]);
    const floor=shadowed(new THREE.Mesh(new THREE.PlaneGeometry(14,14),mat(0xffffff,floorTex,{rough:.9})));floor.rotation.x=-Math.PI/2;floor.position.set(0,-.02,.5);this.worldGroup.add(floor);
    const wallMat=mat(kitchen?0xe8dfcf:0xe2eadf,null,{rough:.92});this.worldGroup.add(box(13,.18,2.9,wallMat,0,1.45,6.35),box(.18,2.9,12.5,wallMat,-6.4,1.45,.2),box(.18,2.9,12.5,wallMat,6.4,1.45,.2));
    const trim=mat(0x725f4d,wood,{rough:.7});this.worldGroup.add(box(13,.15,.12,trim,0,.12,6.18),box(.12,.15,12.3,trim,-6.22,.12,.15),box(.12,.15,12.3,trim,6.22,.12,.15));
    if(!kitchen){for(let x=-4.8;x<=4.8;x+=2.4){const glass=new THREE.Mesh(new THREE.PlaneGeometry(2.05,2.15),new THREE.MeshPhysicalMaterial({color:0xcce2e5,transparent:true,opacity:.32,roughness:.1,transmission:.25}));glass.position.set(x,1.65,6.23);this.worldGroup.add(glass);}}
    const woodMat=mat(0xa06f4c,wood,{rough:.68}),cabinetMat=mat(kitchen?0x718065:0x846d5c,wood,{rough:.78}),fabricMat=mat(0x6e765d,fabric,{rough:.92}),darkMat=mat(0x343d36,null,{rough:.82}),rugMat=mat(0xffffff,rug,{rough:.95});
    for(const p of world.pieces){let obj=null;const y=p.h/2;
      if(p.kind==='rug'){obj=box(p.w,.035,p.d,rugMat,p.x,.01,p.z,p.rot);obj.castShadow=false;}
      else if(['stool','plant','planter','cat-tree'].includes(p.kind)){obj=new THREE.Group();if(p.kind==='stool'){obj.add(cylinder(.3,.55,woodMat,p.x,.28,p.z));}else{const pot=cylinder(p.w*.28,.45,mat(0xa55e43),p.x,.23,p.z);obj.add(pot);for(let i=0;i<4;i++){const leaf=shadowed(new THREE.Mesh(new THREE.SphereGeometry(.32,10,7),mat(0x567c4e)));leaf.scale.set(.7,1.4,.55);leaf.position.set(p.x+(i-1.5)*.14,.72+i*.12,p.z+(i%2?-.08:.08));obj.add(leaf);this.decorAnimations.push({o:leaf,phase:i*.9,base:leaf.rotation.z});}if(p.kind==='cat-tree'){obj.add(box(.9,1.25,.85,fabricMat,p.x,.92,p.z),box(.78,.12,.78,fabricMat,p.x,1.62,p.z));}}
      }
      else if(p.kind==='arch'){const g=new THREE.Group();g.add(box(.28,2.3,.4,darkMat,p.x-p.w/2,1.15,p.z),box(.28,2.3,.4,darkMat,p.x+p.w/2,1.15,p.z),box(p.w+.28,.28,.4,darkMat,p.x,2.16,p.z));obj=g;}
      else {const m=['sofa','chaise','ottoman','bench'].includes(p.kind)?fabricMat:(['cabinet','shelf','toybox'].includes(p.kind)?cabinetMat:woodMat);obj=box(p.w,p.h,p.d,m,p.x,y,p.z,p.rot);if(['table','coffee'].includes(p.kind)){const top=obj;for(const sx of [-1,1])for(const sz of [-1,1])this.worldGroup.add(box(.12,p.h*.8,.12,darkMat,p.x+sx*p.w*.38,p.h*.4,p.z+sz*p.d*.35,p.rot));}}
      if(obj)this.worldGroup.add(obj);
    }
    for(const c of world.collectibles){const g=new THREE.Group();const core=shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(.16,1),new THREE.MeshStandardMaterial({color:0xf3cf68,emissive:0x7a5915,emissiveIntensity:.45,roughness:.35,metalness:.15})));g.add(core);const ring=new THREE.Mesh(new THREE.TorusGeometry(.25,.025,7,20),new THREE.MeshBasicMaterial({color:0xffe59a,transparent:true,opacity:.6}));ring.rotation.x=Math.PI/2;g.add(ring);g.position.set(c.x,.34,c.z);g.userData.phase=Math.random()*Math.PI*2;this.worldGroup.add(g);this.collectibleMeshes.set(c.id,g);}
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.42,.055,8,28),new THREE.MeshBasicMaterial({color:COLORS.teal,transparent:true,opacity:.88}));ring.rotation.x=Math.PI/2;const column=new THREE.Mesh(new THREE.CylinderGeometry(.11,.42,2.2,18,1,true),new THREE.MeshBasicMaterial({color:COLORS.teal,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}));column.position.y=1.05;this.beacon.add(ring,column);this.beacon.visible=false;
  }
  setObjective(o){if(!o){this.beacon.visible=false;return;}this.beacon.visible=true;this.beacon.position.set(o.x,.06,o.z);this.beacon.traverse(x=>{if(x.material?.color)x.material.color.set(o.cat==='orange'?COLORS.rust:COLORS.teal);});}
  collect(id){const m=this.collectibleMeshes.get(id);if(m){m.visible=false;this.collectibleMeshes.delete(id);}}
  resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  update(time,dt){this.beacon.rotation.y+=dt*.8;this.beacon.position.y=.06+Math.sin(time*3.1)*.04;for(const [id,g] of this.collectibleMeshes){g.rotation.y+=dt*1.4;g.position.y=.34+Math.sin(time*2.6+g.userData.phase)*.08;}for(const a of this.decorAnimations)a.o.rotation.z=a.base+Math.sin(time*.9+a.phase)*.05;}
  render(){this.renderer.render(this.scene,this.camera);}
}
