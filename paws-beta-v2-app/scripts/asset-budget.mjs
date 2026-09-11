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

const hdriPath=path.join(publicAssets,'cc0','hdri','studio-small-08-1k.exr');
assert(exists(hdriPath),'missing 1K HDRI');
const hdriBytes=exists(hdriPath)?fs.statSync(hdriPath).size:0;
assert(hdriBytes<=1*MiB,`HDRI ${hdriBytes} bytes exceeds 1 MiB`);

const furnitureFiles=walk(path.join(publicAssets,'cc0','furniture'));
const furnitureBytes=bytes(furnitureFiles);
assert(furnitureBytes<=2*MiB,`CC0 environment geometry source ${furnitureBytes} bytes exceeds 2 MiB`);

const distFiles=walk(dist);
assert(distFiles.length>0,'dist is empty; run build before asset budget gate');
const distBytes=bytes(distFiles);
assert(distBytes<=15*MiB,`initial distribution ${distBytes} bytes exceeds 15 MiB`);

const runtimeFiles=distFiles.filter(p=>/\.(?:js|css|html)$/i.test(p));
for(const p of runtimeFiles){const text=fs.readFileSync(p,'utf8');const remote=text.match(/https?:\/\/[^"'`\s)]+/g)||[];const disallowed=remote.filter(u=>!u.includes('www.w3.org/2000/svg'));assert(disallowed.length===0,`${path.relative(dist,p)} contains runtime remote origin(s): ${disallowed.slice(0,3).join(', ')}`);}

const generatedRuntime=runtimeFiles.filter(p=>/\.js$/i.test(p));
const jsBytes=bytes(generatedRuntime);
console.log(`Asset budget: dist ${(distBytes/MiB).toFixed(2)} MiB / 15 MiB; HDRI ${(hdriBytes/1024).toFixed(1)} KiB / 1024 KiB; CC0 furniture ${(furnitureBytes/1024).toFixed(1)} KiB; JS ${(jsBytes/1024).toFixed(1)} KiB.`);
console.log(`CC0 provenance: ${(cc0.furniture||[]).length} furniture, ${(cc0.textures||[]).length} textures, HDRI ${cc0.hdri?.assetId||'missing'}.`);
if(failures.length){for(const failure of failures)console.error(`FAIL ${failure}`);process.exit(1);}console.log('PASS release asset/origin budgets');
