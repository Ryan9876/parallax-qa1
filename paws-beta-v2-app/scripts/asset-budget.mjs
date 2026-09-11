import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('.');
const publicAssets=path.join(root,'public','assets');
const dist=path.join(root,'dist');
const MiB=1024*1024;
const failures=[];
const assert=(value,message)=>{if(!value)failures.push(message);};
const exists=p=>fs.existsSync(p)&&fs.statSync(p).isFile()&&fs.statSync(p).size>0;
function walk(dir,out=[]){if(!fs.existsSync(dir))return out;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full,out);else if(entry.isFile())out.push(full);}return out;}
function bytes(files){return files.reduce((sum,p)=>sum+fs.statSync(p).size,0);}
function fmt(n){return `${(n/MiB).toFixed(2)} MiB`;}

const provenancePath=path.join(publicAssets,'provenance.json');
assert(exists(provenancePath),'missing public/assets/provenance.json');
let provenance={};try{provenance=JSON.parse(fs.readFileSync(provenancePath,'utf8'));}catch(error){failures.push(`invalid provenance.json: ${error.message}`);}
const cc0=provenance.cc0Environment||{};
assert(Array.isArray(cc0.furniture)&&cc0.furniture.length>=2,'CC0 furniture provenance requires at least two authored assets');
assert(Array.isArray(cc0.textures)&&cc0.textures.length>=2,'CC0 texture provenance requires at least two authored assets');
assert(cc0.hdri&&typeof cc0.hdri==='object','CC0 HDRI provenance missing');
for(const asset of [...(cc0.furniture||[]),...(cc0.textures||[]),...(cc0.hdri?[cc0.hdri]:[])]){
  assert(String(asset.license||'').toUpperCase().includes('CC0'),`${asset.assetId||'asset'} is not recorded as CC0`);
  assert(typeof asset.source==='string'&&asset.source.startsWith('https://'),`${asset.assetId||'asset'} missing provenance source`);
  assert(typeof asset.local==='string'&&asset.local.startsWith('/assets/'),`${asset.assetId||'asset'} missing same-origin local path`);
  if(asset.local){const local=path.join(root,'public',asset.local.replace(/^\//,''));assert(exists(local),`missing vendored asset ${asset.local}`);}
}
const characters=provenance.authoredCharacters||{};
assert(characters.cat?.license==='CC BY 3.0','authored cat attribution/license missing');
assert(String(characters.henley?.license||'').toUpperCase().includes('CC0'),'Henley authored asset must be CC0');
for(const asset of [characters.cat,characters.henley].filter(Boolean)){
  assert(typeof asset.source==='string'&&asset.source.startsWith('https://'),`${asset.assetId||'character'} missing source attribution`);
  assert(typeof asset.local==='string'&&asset.local.startsWith('/assets/characters/authored/'),`${asset.assetId||'character'} missing authored local path`);
  if(asset.local){const local=path.join(root,'public',asset.local.replace(/^\//,''));assert(exists(local),`missing authored character ${asset.local}`);}
}
const sampled=provenance.sampledAudio||{};
assert(Array.isArray(sampled.samples)&&sampled.samples.length>=10,'sampled audio provenance requires the gameplay sample set');
for(const asset of sampled.samples||[]){
  assert(String(asset.license||'').toUpperCase().includes('CC0'),`${asset.file||'audio'} is not CC0`);
  assert(asset.creator==='Joseph SARDIN',`${asset.file||'audio'} creator provenance missing`);
  assert(typeof asset.page==='string'&&asset.page.startsWith('https://bigsoundbank.com/'),`${asset.file||'audio'} source page missing`);
  assert(typeof asset.local==='string'&&asset.local.startsWith('/assets/audio/'),`${asset.file||'audio'} local path missing`);
  if(asset.local){const local=path.join(root,'public',asset.local.replace(/^\//,''));assert(exists(local),`missing sampled audio ${asset.local}`);}
}

const characterFiles=[...walk(path.join(publicAssets,'models')),...walk(path.join(publicAssets,'characters','authored'))];
const environmentFiles=walk(path.join(publicAssets,'cc0','furniture'));
const textureFiles=[...walk(path.join(publicAssets,'textures')),...walk(path.join(publicAssets,'cc0','textures'))];
const audioFiles=walk(path.join(publicAssets,'audio'));
const hdriPath=path.join(publicAssets,'cc0','hdri','studio-small-08-1k.exr');
const characterBytes=bytes(characterFiles),environmentBytes=bytes(environmentFiles),textureBytes=bytes(textureFiles),audioBytes=bytes(audioFiles),hdriBytes=exists(hdriPath)?fs.statSync(hdriPath).size:0;
assert(characterBytes<=4*MiB,`characters ${fmt(characterBytes)} exceed 4 MiB`);
assert(environmentBytes<=3*MiB,`environment geometry ${fmt(environmentBytes)} exceeds 3 MiB`);
assert(textureBytes<=4*MiB,`textures ${fmt(textureBytes)} exceed 4 MiB`);
assert(hdriBytes>0,'missing 1K HDRI');
assert(hdriBytes<=1*MiB,`HDRI ${fmt(hdriBytes)} exceeds 1 MiB`);
assert(audioBytes<=2*MiB,`audio ${fmt(audioBytes)} exceeds 2 MiB`);

const distFiles=walk(dist);
assert(distFiles.length>0,'dist is empty; run build before asset budget gate');
const distBytes=bytes(distFiles);
assert(distBytes<=15*MiB,`initial distribution ${fmt(distBytes)} exceeds 15 MiB`);
const codeFiles=distFiles.filter(p=>/\.(?:js|css|html)$/i.test(p));
const codeBytes=bytes(codeFiles);
assert(codeBytes<=1*MiB,`code and UI ${fmt(codeBytes)} exceed 1 MiB`);

console.log(`Asset budget: total ${fmt(distBytes)}/15; characters ${fmt(characterBytes)}/4; environment ${fmt(environmentBytes)}/3; textures ${fmt(textureBytes)}/4; HDRI ${fmt(hdriBytes)}/1; audio ${fmt(audioBytes)}/2; code ${fmt(codeBytes)}/1.`);
console.log(`CC0 environment: ${(cc0.furniture||[]).length} furniture, ${(cc0.textures||[]).length} textures, HDRI ${cc0.hdri?.assetId||'missing'}. Authored characters: ${characters.cat?.creator||'missing'} cat / ${characters.henley?.creator||'missing'} Henley. Sampled audio: ${(sampled.samples||[]).length} CC0 files.`);
if(failures.length){for(const failure of failures)console.error(`FAIL ${failure}`);process.exit(1);}console.log('PASS release asset category budgets and provenance');
