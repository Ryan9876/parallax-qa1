import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve('public/assets');
const furnitureDir=path.join(root,'cc0','furniture');
const textureDir=path.join(root,'cc0','textures');
const hdriDir=path.join(root,'cc0','hdri');
for(const dir of [furnitureDir,textureDir,hdriDir])fs.mkdirSync(dir,{recursive:true});

const USER_AGENT='PawsOnTheRunBetaV2/1.0 (+https://github.com/Ryan9876/parallax-qa1)';
async function request(url,{json=false}={}){
  const r=await fetch(url,{headers:{'User-Agent':USER_AGENT,'Accept':json?'application/json':'*/*'}});
  if(!r.ok)throw new Error(`Asset request failed ${r.status} ${url}`);
  return json?r.json():Buffer.from(await r.arrayBuffer());
}
function md5(buf){return crypto.createHash('md5').update(buf).digest('hex');}
function leaves(node,pathParts=[],out=[]){
  if(!node||typeof node!=='object')return out;
  if(typeof node.url==='string'&&Number.isFinite(Number(node.size)))out.push({path:pathParts.join('/'),...node});
  for(const [k,v] of Object.entries(node))if(v&&typeof v==='object')leaves(v,[...pathParts,k],out);
  return out;
}
async function polyAsset(id,match,outPath,{maxBytes=Infinity}={}){
  const meta=await request(`https://api.polyhaven.com/files/${id}`,{json:true});
  const candidates=leaves(meta).filter(match).sort((a,b)=>Number(a.size)-Number(b.size));
  if(!candidates.length)throw new Error(`No matching Poly Haven asset for ${id}`);
  const selected=candidates[0],buf=await request(selected.url);
  if(buf.length>maxBytes)throw new Error(`${id} exceeds budget: ${buf.length} > ${maxBytes}`);
  if(selected.md5&&md5(buf)!==String(selected.md5).toLowerCase())throw new Error(`MD5 mismatch for ${id}`);
  fs.writeFileSync(outPath,buf);
  return {provider:'Poly Haven',assetId:id,license:'CC0 1.0',source:`https://polyhaven.com/a/${id}`,download:selected.url,path:selected.path,bytes:buf.length,md5:md5(buf),local:`/assets/${path.relative(root,outPath).replaceAll('\\','/')}`};
}
async function pinnedText(url,outPath,label){
  const buf=await request(url);const text=buf.toString('utf8');
  if(!text.includes('Created by Kenney'))throw new Error(`Unexpected Kenney payload for ${label}`);
  fs.writeFileSync(outPath,text);
  return {provider:'Kenney',assetId:label,license:'CC0 1.0',source:'https://kenney.nl/assets/furniture-kit',download:url,bytes:buf.length,md5:md5(buf),local:`/assets/${path.relative(root,outPath).replaceAll('\\','/')}`};
}

const kenneyCommit='dfa19a5602a31f64bd890d15279a61f43b127328';
const kenneyBase=`https://raw.githubusercontent.com/RetroDECK/RetroQUEST/${kenneyCommit}/assets/kenney_furniture-kit/Models/OBJ%20format`;
const furniture=[];
furniture.push(await pinnedText(`${kenneyBase}/loungeSofa.obj`,path.join(furnitureDir,'lounge-sofa.obj'),'loungeSofa'));
furniture.push(await pinnedText(`${kenneyBase}/tableCoffee.obj`,path.join(furnitureDir,'coffee-table.obj'),'tableCoffee'));

const textures=[];
textures.push(await polyAsset('wood_floor',x=>/diffuse/i.test(x.path)&&/1k/i.test(x.path)&&/jpg/i.test(x.path),path.join(textureDir,'wood-floor-1k.jpg'),{maxBytes:900_000}));
textures.push(await polyAsset('plastered_wall_03',x=>/diffuse/i.test(x.path)&&/1k/i.test(x.path)&&/jpg/i.test(x.path),path.join(textureDir,'plaster-wall-1k.jpg'),{maxBytes:900_000}));
const hdri=await polyAsset('studio_small_08',x=>/hdri/i.test(x.path)&&/1k/i.test(x.path)&&/exr/i.test(x.path),path.join(hdriDir,'studio-small-08-1k.exr'),{maxBytes:1_048_576});

const provenancePath=path.join(root,'provenance.json');
let provenance={version:1,assets:{},runtimeOrigins:['same-origin only']};
try{provenance=JSON.parse(fs.readFileSync(provenancePath,'utf8'));}catch{}
provenance.cc0Environment={
  generatedAt:new Date().toISOString(),
  policy:'Build-vendored into same-origin public assets; no third-party runtime fetches.',
  furniture,
  textures,
  hdri,
};
fs.writeFileSync(provenancePath,JSON.stringify(provenance,null,2));

const total=[...furniture,...textures,hdri].reduce((n,a)=>n+a.bytes,0);
console.log(`Vendored ${furniture.length} Kenney furniture meshes, ${textures.length} Poly Haven textures and 1 HDRI (${(total/1024/1024).toFixed(2)} MiB).`);
