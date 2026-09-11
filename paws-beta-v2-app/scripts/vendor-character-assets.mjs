import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve('public/assets');
const outDir=path.join(root,'characters','authored');
fs.mkdirSync(outDir,{recursive:true});

const USER_AGENT='PawsOnTheRunBetaV2/1.0 (+https://github.com/Ryan9876/parallax-qa1)';
const upstreamCommit='4fc51d4572ee2e8c3605b6cfa342f15c7e1751a2';
const base=`https://raw.githubusercontent.com/wehrleymullanag18-design/mori-together/${upstreamCommit}/public/assets/pets`;

async function download(spec){
  const url=`${base}/${spec.upstreamFile}`;
  const r=await fetch(url,{headers:{'User-Agent':USER_AGENT,'Accept':'application/octet-stream'}});
  if(!r.ok)throw new Error(`Character request failed ${r.status} ${url}`);
  const buf=Buffer.from(await r.arrayBuffer());
  if(buf.subarray(0,4).toString('ascii')!=='glTF')throw new Error(`${spec.id} is not a valid GLB container`);
  if(buf.length!==spec.expectedBytes)throw new Error(`${spec.id} size changed upstream: ${buf.length} != ${spec.expectedBytes}`);
  const localPath=path.join(outDir,spec.localFile);fs.writeFileSync(localPath,buf);
  return {
    provider:spec.provider,
    assetId:spec.id,
    creator:spec.creator,
    license:spec.license,
    source:spec.source,
    mirror:`https://github.com/wehrleymullanag18-design/mori-together/blob/${upstreamCommit}/public/assets/pets/${spec.upstreamFile}`,
    pinnedCommit:upstreamCommit,
    bytes:buf.length,
    sha256:crypto.createHash('sha256').update(buf).digest('hex'),
    local:`/assets/${path.relative(root,localPath).replaceAll('\\','/')}`,
  };
}

const cat=await download({
  id:'j-toastie-cat',upstreamFile:'cat.glb',localFile:'cat.glb',expectedBytes:280840,
  provider:'Poly Pizza',creator:'J-Toastie',license:'CC BY 3.0',source:'https://poly.pizza/m/DJ9rpAhrh3',
});
const henley=await download({
  id:'quaternius-shiba',upstreamFile:'dog.glb',localFile:'henley.glb',expectedBytes:1752188,
  provider:'Quaternius',creator:'Quaternius',license:'CC0 1.0',source:'https://quaternius.com/packs/ultimateanimatedanimals.html',
});

const provenancePath=path.join(root,'provenance.json');
let provenance={version:1,assets:{},runtimeOrigins:['same-origin only']};
try{provenance=JSON.parse(fs.readFileSync(provenancePath,'utf8'));}catch{}
provenance.authoredCharacters={
  generatedAt:new Date().toISOString(),
  policy:'Build-vendored pinned GLB copies; runtime reads same-origin files only.',
  attribution:'Cat model by J-Toastie, CC BY 3.0, via Poly Pizza. Henley animation base by Quaternius, CC0 1.0.',
  cat,
  henley,
};
fs.writeFileSync(provenancePath,JSON.stringify(provenance,null,2));
console.log(`Vendored authored cat ${(cat.bytes/1024).toFixed(1)} KiB and Henley ${(henley.bytes/1024/1024).toFixed(2)} MiB.`);
