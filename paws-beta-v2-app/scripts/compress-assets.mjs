import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import { encodeToKTX2 } from 'ktx2-encoder';
import sharp from 'sharp';

const root=path.resolve('public','assets');
const tempDir=path.resolve('.asset-compress-tmp');
fs.rmSync(tempDir,{recursive:true,force:true});fs.mkdirSync(tempDir,{recursive:true});

// GLTFExporter uses FileReader in browser builds. Node 22 already supplies Blob.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onload?.({target:this});this.onloadend?.({target:this});});}
  readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(v).toString('base64')}`;this.onload?.({target:this});this.onloadend?.({target:this});});}
};

const imageDecoder=async buffer=>{
  const {data,info}=await sharp(Buffer.from(buffer)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  return{data:new Uint8Array(data),width:info.width,height:info.height};
};
const ktxOptions={
  isUASTC:true,
  needSupercompression:true,
  enableRDO:true,
  rdoQualityLevel:1,
  uastcLDRQualityLevel:2,
  generateMipmap:true,
  imageDecoder,
};

function meshopt(input,output){
  const bin=path.resolve('node_modules','.bin',process.platform==='win32'?'gltf-transform.cmd':'gltf-transform');
  execFileSync(bin,['meshopt',input,output,'--level','medium'],{stdio:'inherit'});
  const data=fs.readFileSync(output);
  if(!data.includes(Buffer.from('EXT_meshopt_compression')))throw new Error(`${path.basename(output)} missing EXT_meshopt_compression`);
}

async function compressStandaloneTexture(input,output){
  const encoded=await encodeToKTX2(new Uint8Array(fs.readFileSync(input)),ktxOptions);
  fs.writeFileSync(output,Buffer.from(encoded));
  const magic=fs.readFileSync(output).subarray(0,12).toString('hex');
  if(magic!=='ab4b5458203230bb0d0a1a0a')throw new Error(`${output} is not KTX2`);
  fs.rmSync(input,{force:true});
  return fs.statSync(output).size;
}

async function compressCharacter(file){
  const input=path.join(root,'characters','authored',file),textured=path.join(tempDir,`${file}.ktx.glb`),output=path.join(tempDir,`${file}.meshopt.glb`);
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc=await io.read(input),textureCount=doc.getRoot().listTextures().length;
  if(textureCount){await doc.transform(ktx2(ktxOptions));}
  await io.write(textured,doc);
  meshopt(textured,output);
  fs.copyFileSync(output,input);
  const bytes=fs.statSync(input).size,data=fs.readFileSync(input);
  if(textureCount&&!data.includes(Buffer.from('KHR_texture_basisu')))throw new Error(`${file} textures were not converted to KTX2/Basis`);
  return{bytes,textureCount};
}

async function objToCompressedGlb(inputName,outputName){
  const input=path.join(root,'cc0','furniture',inputName),raw=path.join(tempDir,`${outputName}.raw.glb`),compressed=path.join(root,'cc0','furniture',outputName);
  const object=new OBJLoader().parse(fs.readFileSync(input,'utf8'));
  object.traverse(node=>{if(node.isMesh){node.material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8,metalness:0});}});
  const exporter=new GLTFExporter(),arrayBuffer=await exporter.parseAsync(object,{binary:true,onlyVisible:true});
  fs.writeFileSync(raw,Buffer.from(arrayBuffer));meshopt(raw,compressed);fs.rmSync(input,{force:true});
  return fs.statSync(compressed).size;
}

function copyBasisTranscoder(){
  const src=path.resolve('node_modules','three','examples','jsm','libs','basis'),dst=path.join(root,'basis');
  fs.rmSync(dst,{recursive:true,force:true});fs.mkdirSync(dst,{recursive:true});
  for(const name of ['basis_transcoder.js','basis_transcoder.wasm']){
    const from=path.join(src,name);if(!fs.existsSync(from))throw new Error(`Missing Three Basis transcoder ${from}`);fs.copyFileSync(from,path.join(dst,name));
  }
}

const standalone=[
  ['cc0/textures/wood-floor-1k.jpg','cc0/textures/wood-floor-1k.ktx2'],
  ['cc0/textures/plaster-wall-1k.jpg','cc0/textures/plaster-wall-1k.ktx2'],
  ['textures/tile.svg','textures/tile.ktx2'],
  ['textures/wood.svg','textures/wood.ktx2'],
  ['textures/rug.svg','textures/rug.ktx2'],
  ['textures/fabric.svg','textures/fabric.ktx2'],
];
const textureSizes={};
for(const [source,target] of standalone)textureSizes[target]=await compressStandaloneTexture(path.join(root,source),path.join(root,target));
const furnitureSizes={
  'lounge-sofa.glb':await objToCompressedGlb('lounge-sofa.obj','lounge-sofa.glb'),
  'coffee-table.glb':await objToCompressedGlb('coffee-table.obj','coffee-table.glb'),
};
const characterResults={cat:await compressCharacter('cat.glb'),henley:await compressCharacter('henley.glb')};
copyBasisTranscoder();

const provenancePath=path.join(root,'provenance.json'),provenance=JSON.parse(fs.readFileSync(provenancePath,'utf8'));
const furnitureNames={loungeSofa:'lounge-sofa.glb',tableCoffee:'coffee-table.glb'};
for(const asset of provenance.cc0Environment?.furniture||[]){const file=furnitureNames[asset.assetId];if(!file)continue;asset.sourceBytes=asset.bytes;asset.bytes=furnitureSizes[file];asset.local=`/assets/cc0/furniture/${file}`;asset.compression='EXT_meshopt_compression';}
const textureNames={wood_floor:'wood-floor-1k.ktx2',plastered_wall_03:'plaster-wall-1k.ktx2'};
for(const asset of provenance.cc0Environment?.textures||[]){const file=textureNames[asset.assetId];if(!file)continue;asset.sourceBytes=asset.bytes;asset.bytes=textureSizes[`cc0/textures/${file}`];asset.local=`/assets/cc0/textures/${file}`;asset.compression='KTX2 Basis UASTC + Zstd';}
if(provenance.authoredCharacters?.cat){provenance.authoredCharacters.cat.sourceBytes=provenance.authoredCharacters.cat.bytes;provenance.authoredCharacters.cat.bytes=characterResults.cat.bytes;provenance.authoredCharacters.cat.compression='EXT_meshopt_compression + KTX2/Basis when textured';}
if(provenance.authoredCharacters?.henley){provenance.authoredCharacters.henley.sourceBytes=provenance.authoredCharacters.henley.bytes;provenance.authoredCharacters.henley.bytes=characterResults.henley.bytes;provenance.authoredCharacters.henley.compression='EXT_meshopt_compression + KTX2/Basis when textured';}
provenance.compression={
  generatedAt:new Date().toISOString(),
  geometry:'EXT_meshopt_compression via @gltf-transform/cli 4.5.0, medium level',
  textures:'KTX2 Basis UASTC with Zstd/RDO and mipmaps via ktx2-encoder 0.6.0',
  hdri:'1K EXR retained at <=1 MiB to preserve verified lighting fidelity',
  supportTextures:Object.entries(textureSizes).filter(([name])=>name.startsWith('textures/')).map(([name,bytes])=>({local:`/assets/${name}`,bytes})),
  basisTranscoder:['/assets/basis/basis_transcoder.js','/assets/basis/basis_transcoder.wasm'],
};
fs.writeFileSync(provenancePath,JSON.stringify(provenance,null,2));
fs.rmSync(tempDir,{recursive:true,force:true});
console.log(`Compressed 3 authored character streams, 2 furniture meshes and ${standalone.length} standalone textures to Meshopt/KTX2.`);
