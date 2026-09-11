import { TUNING } from './config.js';

const PIECES = {
  kitchen: [
    ['island', 0, 0, 3.2, 1.6, 1.05], ['counter', -4.3, -3.7, 5.8, 0.8, 1.0], ['counter', 4.3, -3.7, 5.8, 0.8, 1.0],
    ['table', -2.9, 3.4, 2.7, 1.45, 0.82], ['bench', 2.9, 3.3, 2.2, 0.72, 0.55], ['stool', -1.9, -1.9, 0.7, 0.7, 0.62],
    ['stool', 1.9, -1.9, 0.7, 0.7, 0.62], ['plant', -5.1, 2.7, 0.8, 0.8, 1.25], ['plant', 5.1, 2.7, 0.8, 0.8, 1.25],
    ['rug', 0, 3.8, 3.8, 2.1, 0.03], ['cabinet', -5.1, -0.5, 0.8, 2.2, 1.25], ['cabinet', 5.1, -0.5, 0.8, 2.2, 1.25],
    ['toybox', 3.35, -1.0, 1.3, 0.78, 0.58], ['arch', 0, 5.6, 3.0, 0.45, 2.3]
  ],
  sunroom: [
    ['sofa', -3.2, -1.7, 3.1, 1.15, 0.78], ['chaise', 3.4, -1.8, 2.4, 1.0, 0.68], ['coffee', 0.1, 0.6, 2.0, 1.15, 0.48],
    ['planter', -5.0, 2.8, 1.0, 1.0, 1.2], ['planter', 5.0, 2.8, 1.0, 1.0, 1.2], ['shelf', -5.1, -2.9, 0.8, 2.6, 1.7],
    ['shelf', 5.1, -2.9, 0.8, 2.6, 1.7], ['ottoman', -1.8, 3.4, 1.25, 1.0, 0.44], ['ottoman', 2.1, 3.2, 1.25, 1.0, 0.44],
    ['rug', 0, 1.2, 4.4, 3.0, 0.03], ['cat-tree', -4.4, 4.8, 1.1, 1.1, 1.8], ['cat-tree', 4.5, 4.8, 1.1, 1.1, 1.8],
    ['bench', 0, -4.3, 2.9, 0.72, 0.52], ['arch', 0, 5.8, 3.4, 0.45, 2.4]
  ]
};

const LEVELS = [
  {id:'ch1-l1',chapter:1,name:'Snack Run',theme:'kitchen',seed:101,parTime:42,targetScore:520,objectives:[['orange','Knock the tea towel',-2.2,-2.6,13],['gray','Tap the toy box',3.35,-0.35,12],['orange','Reach the sunny rug',0.0,4.35,14]]},
  {id:'ch1-l2',chapter:1,name:'Table Trouble',theme:'kitchen',seed:202,parTime:46,targetScore:680,objectives:[['gray','Circle the island',2.35,0.6,12],['orange','Visit the window plant',-4.4,2.65,13],['gray','Make it to the arch',0,5.0,12]]},
  {id:'ch1-l3',chapter:1,name:'Double Mischief',theme:'kitchen',seed:303,parTime:49,targetScore:790,objectives:[['orange','Check the left counter',-3.9,-2.9,11],['gray','Check the right counter',3.9,-2.9,11],['orange','Hide by the bench',3.0,2.45,12],['gray','Dash to the arch',0,5.0,11]]},
  {id:'ch1-l4',chapter:1,name:'Henley Hustle',theme:'kitchen',seed:404,parTime:48,targetScore:920,objectives:[['gray','Slip past the stool',-1.7,-1.35,10],['orange','Reach the toy box',3.35,-0.35,10],['gray','Touch the right plant',4.35,2.55,10],['orange','Escape to the arch',0,5.0,10]]},
  {id:'ch1-l5',chapter:1,name:'Kitchen Finale',theme:'kitchen',seed:505,parTime:52,targetScore:1060,objectives:[['orange','Scout the bench',2.9,2.45,10],['gray','Scout the left plant',-4.35,2.55,10],['orange','Cross the front lane',0,-2.5,10],['gray','Reach the rug',0,4.3,10],['orange','Finish at the arch',0,5.0,10]]},
  {id:'ch2-l1',chapter:2,name:'Sunroom Sprint',theme:'sunroom',seed:606,parTime:48,targetScore:850,objectives:[['gray','Find the coffee table',0.1,1.45,11],['orange','Reach the cat tree',-4.0,4.4,12],['gray','Touch the back bench',0,-3.65,11],['orange','Finish at the arch',0,5.15,11]]},
  {id:'ch2-l2',chapter:2,name:'Golden Hour Escape',theme:'sunroom',seed:707,parTime:55,targetScore:1120,objectives:[['orange','Tag the left ottoman',-1.8,4.28,10],['gray','Tag the right ottoman',2.1,4.05,10],['orange','Reach the chaise',3.45,-1.05,10],['gray','Reach the left planter',-4.45,2.8,10],['orange','Final escape',0,5.15,10]]}
].map(l=>({...l,objectives:l.objectives.map((o,i)=>({id:`${l.id}-o${i+1}`,cat:o[0],label:o[1],x:o[2],z:o[3],deadline:o[4]}))}));

function mulberry32(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

export function getLevels(){return LEVELS.map(l=>structuredClone(l));}
export function getLevel(id){const level=LEVELS.find(l=>l.id===id);return level?structuredClone(level):null;}

export function assembleLevel(level){
  const rng=mulberry32(level.seed); const base=PIECES[level.theme];
  const pieces=base.map((p,i)=>({id:`${level.id}-p${i}`,kind:p[0],x:p[1],z:p[2],w:p[3],d:p[4],h:p[5],rot:(rng()-.5)*0.08}));
  const colliders=pieces.filter(p=>!['rug','arch','plant','planter','cat-tree'].includes(p.kind)).map(p=>({x:p.x,z:p.z,w:p.w,d:p.d,h:p.h,kind:p.kind}));
  const collectibles=[[-4.5,0],[4.5,0],[-3.6,4.5],[3.6,4.5]].map((p,i)=>({id:`${level.id}-c${i}`,x:p[0]+(rng()-.5)*.4,z:p[1]+(rng()-.5)*.4,pointValue:25}));
  // Keep the opening lane deliberately generous so initial camera-relative steering teaches movement before collision.
  const catSpawns=level.theme==='sunroom'?[{x:-2.2,z:-4.35},{x:2.2,z:-4.35}]:[{x:-.55,z:-4.35},{x:.55,z:-4.35}];
  return {pieces,colliders,collectibles,bounds:{minX:-5.8,maxX:5.8,minZ:-5.1,maxZ:6.0},spawn:{cats:catSpawns,henley:{x:0,z:4.65}}};
}

function pointInRect(x,z,c,pad=.42){return x>c.x-c.w/2-pad&&x<c.x+c.w/2+pad&&z>c.z-c.d/2-pad&&z<c.z+c.d/2+pad;}
export function validateLevel(level){
  const world=assembleLevel(level); const errors=[];
  for(const o of level.objectives){if(world.colliders.some(c=>pointInRect(o.x,o.z,c,.12))) errors.push(`objective ${o.id} intersects ${world.colliders.find(c=>pointInRect(o.x,o.z,c,.12))?.kind}`);}
  for(const s of world.spawn.cats){if(world.colliders.some(c=>pointInRect(s.x,s.z,c,.2))) errors.push('cat spawn intersects collider');}
  for(const s of world.spawn.cats){const separation=Math.hypot(world.spawn.henley.x-s.x,world.spawn.henley.z-s.z);if(separation<TUNING.henley.detectionBase)errors.push(`Henley spawn inside base detection radius (${separation.toFixed(2)} < ${TUNING.henley.detectionBase})`);}
  return {ok:errors.length===0,errors};
}

export const CHAPTER_UNLOCK_RATIO = 0.5;
export function chapterUnlockThreshold(chapter=1){const count=LEVELS.filter(l=>l.chapter===chapter).length;return Math.ceil(count*3*CHAPTER_UNLOCK_RATIO);}
export const CHAPTER_TWO_STAR_GATE = chapterUnlockThreshold(1);
