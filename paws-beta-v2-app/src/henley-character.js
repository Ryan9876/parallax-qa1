import * as THREE from 'three';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));

function standard(color,rough=.82){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:.01});}
function shadow(mesh){mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
function capsule(radius,length,material){return shadow(new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,5,10),material));}
function sphere(radius,material){return shadow(new THREE.Mesh(new THREE.SphereGeometry(radius,18,12),material));}
function makePivot(parent,x,y,z){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}

export function createStorybookHenley(){
  const root=new THREE.Group();root.name='henley';
  const body=new THREE.Group();root.add(body);

  const skin=standard(0xf1c8aa,.9),hair=standard(0x85664f,.86),dress=standard(0xf7f1e8,.9),shoe=standard(0xeee9df,.75),sock=standard(0xf8f5ee,.92),ink=standard(0x2b2827,.65);
  const floral=[standard(0xdf6c67,.84),standard(0xd68a55,.84),standard(0x796aa8,.84),standard(0x739f86,.84),standard(0xc65352,.84)];

  const skirt=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.30,.46,.62,20,1,false),dress));skirt.position.y=.78;body.add(skirt);
  const torso=capsule(.265,.34,dress);torso.position.y=1.18;body.add(torso);
  const flowerSpots=[[-.20,.88,.35,0],[-.05,.99,.37,2],[.18,.90,.34,1],[-.16,1.20,.245,3],[.13,1.24,.25,4],[.02,.74,.43,2],[-.27,.73,.30,1],[.26,.78,.29,0]];
  flowerSpots.forEach(([x,y,z,i],n)=>{const dot=sphere(n%3===0?.035:.028,floral[i]);dot.position.set(x,y,z);body.add(dot);});

  const neck=capsule(.075,.06,skin);neck.position.y=1.48;body.add(neck);
  const head=sphere(.245,skin);head.position.y=1.69;head.scale.set(1,.98,.93);body.add(head);
  const hairCap=sphere(.257,hair);hairCap.position.set(0,1.735,-.035);hairCap.scale.set(1.04,1.02,.95);body.add(hairCap);
  const face=sphere(.225,skin);face.position.set(0,1.685,.045);face.scale.set(.92,.93,.88);body.add(face);
  for(const side of [-1,1]){const strand=capsule(.075,.58,hair);strand.position.set(side*.205,1.42,-.015);strand.rotation.z=side*.06;body.add(strand);}
  const backHair=capsule(.19,.58,hair);backHair.position.set(0,1.43,-.17);backHair.scale.set(1.15,1,.72);body.add(backHair);

  for(const x of [-.082,.082]){const eye=sphere(.025,ink);eye.position.set(x,1.705,.222);eye.scale.set(.9,1.12,.65);body.add(eye);const shine=sphere(.007,standard(0xffffff,.3));shine.position.set(x-.006,1.713,.240);body.add(shine);}
  const nose=sphere(.018,skin);nose.position.set(0,1.65,.245);nose.scale.set(.7,.55,.55);body.add(nose);
  const smile=shadow(new THREE.Mesh(new THREE.TorusGeometry(.052,.008,6,18,Math.PI),ink));smile.position.set(0,1.606,.236);smile.rotation.z=Math.PI;body.add(smile);

  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=makePivot(body,side*.31,1.35,0);const upper=capsule(.065,.31,skin);upper.position.y=-.19;arm.add(upper);const hand=sphere(.075,skin);hand.position.set(0,-.42,.01);arm.add(hand);arms.push(arm);
    const leg=makePivot(body,side*.17,.54,0);const shin=capsule(.075,.43,skin);shin.position.y=-.26;leg.add(shin);const sockMesh=capsule(.077,.12,sock);sockMesh.position.set(0,-.52,.015);leg.add(sockMesh);const foot=shadow(new THREE.Mesh(new THREE.BoxGeometry(.16,.11,.25),shoe));foot.position.set(0,-.60,.07);leg.add(foot);legs.push(leg);
  }

  const toy=new THREE.Group();toy.name='held-pet-toy';toy.visible=false;
  const ball=sphere(.085,standard(0x55a89c,.58));ball.position.set(.39,.91,.10);toy.add(ball);
  const tassel=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.22,8),standard(0xe5b75e,.7)));tassel.position.set(.39,.79,.10);toy.add(tassel);body.add(toy);

  root.scale.setScalar(1.02);root.userData.storybook=true;
  let phase=0,actionTimer=0,action='idle',holdingToy=false;
  function play(next){if(next==='call'||next==='celebrate'){action=next;actionTimer=next==='celebrate'?2.2:.85;}}
  function setHoldingToy(value){holdingToy=!!value;toy.visible=holdingToy;}
  function update(dt,{speed=0}={}){
    phase+=dt*(2.4+speed*2.15);actionTimer=Math.max(0,actionTimer-dt);if(actionTimer<=0)action='idle';
    const energy=clamp(speed/3.45,0,1),s=Math.sin(phase),c=Math.cos(phase);
    legs[0].rotation.x=damp(legs[0].rotation.x,s*.62*energy,11,dt);legs[1].rotation.x=damp(legs[1].rotation.x,-s*.62*energy,11,dt);
    arms[0].rotation.x=damp(arms[0].rotation.x,-s*.48*energy,10,dt);arms[1].rotation.x=damp(arms[1].rotation.x,s*.48*energy,10,dt);
    if(action==='call'){arms[1].rotation.x=damp(arms[1].rotation.x,-1.65,16,dt);arms[1].rotation.z=damp(arms[1].rotation.z,-.38,14,dt);body.rotation.y=Math.sin(phase*1.8)*.05;}
    else if(action==='celebrate'){arms[0].rotation.z=damp(arms[0].rotation.z,-1.65,14,dt);arms[1].rotation.z=damp(arms[1].rotation.z,1.65,14,dt);body.rotation.y=Math.sin(phase*2.1)*.09;}
    else{arms[0].rotation.z=damp(arms[0].rotation.z,0,12,dt);arms[1].rotation.z=damp(arms[1].rotation.z,0,12,dt);body.rotation.y=damp(body.rotation.y,0,10,dt);}
    body.position.y=damp(body.position.y,Math.abs(c)*.025*energy,14,dt);body.rotation.z=damp(body.rotation.z,-s*.018*energy,10,dt);head.rotation.y=damp(head.rotation.y,s*.022*energy,8,dt);toy.visible=holdingToy;
  }
  return {group:root,species:'human',storybook:true,play,update,setHoldingToy,get holdingToy(){return holdingToy;},get action(){return action;}};
}
