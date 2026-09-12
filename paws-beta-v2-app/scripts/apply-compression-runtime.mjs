import fs from 'node:fs';

function replaceOnce(text,oldText,newText,label){
  if(!text.includes(oldText))throw new Error(`Missing compression patch target: ${label}`);
  return text.replace(oldText,newText);
}

const scenePath='src/scene.js';let s=fs.readFileSync(scenePath,'utf8');
s=replaceOnce(s,"import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';\nimport { EXRLoader } from 'three/addons/loaders/EXRLoader.js';","import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\nimport { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';\nimport { EXRLoader } from 'three/addons/loaders/EXRLoader.js';\nimport { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';",'scene imports');
s=replaceOnce(s,"function texture(loader,url,repeat=[2,2]){const t=loader.load(url);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}","function configuredTexture(source,repeat=[2,2]){const t=source.clone();t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.needsUpdate=true;return t;}",'texture helper');
s=replaceOnce(s,"this.loader=new THREE.TextureLoader();this.worldGroup=new THREE.Group();this.fxGroup=new THREE.Group();this.scene.add(this.worldGroup,this.fxGroup);","this.ktx2Loader=new KTX2Loader().setTranscoderPath('/assets/basis/').detectSupport(this.renderer);this.worldGroup=new THREE.Group();this.fxGroup=new THREE.Group();this.scene.add(this.worldGroup,this.fxGroup);",'KTX2 loader');
s=replaceOnce(s,"    this.assets.wood=texture(this.loader,'/assets/cc0/textures/wood-floor-1k.jpg',[4,5]);this.assets.plaster=texture(this.loader,'/assets/cc0/textures/plaster-wall-1k.jpg',[4,2]);\n    this._lights();this._contactShadows();this.resize();this.ready=this._loadEnvironmentAssets();","    this._lights();this._contactShadows();this.resize();this.ready=this._loadEnvironmentAssets();",'constructor texture preload');
s=replaceOnce(s,`    const objLoader=new OBJLoader(),exrLoader=new EXRLoader();
    const [sofa,coffee,env]=await Promise.all([
      this._safe('kenney-sofa',objLoader.loadAsync('/assets/cc0/furniture/lounge-sofa.obj')),
      this._safe('kenney-coffee',objLoader.loadAsync('/assets/cc0/furniture/coffee-table.obj')),
      this._safe('polyhaven-hdri',exrLoader.loadAsync('/assets/cc0/hdri/studio-small-08-1k.exr')),
    ]);
    this.assets.sofa=sofa;this.assets.coffee=coffee;
    if(env){env.mapping=THREE.EquirectangularReflectionMapping;this.scene.environment=env;}
`,`    const gltfLoader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(this.ktx2Loader),exrLoader=new EXRLoader();
    const [sofa,coffee,env,wood,plaster,tile,supportWood,rug,fabric]=await Promise.all([
      this._safe('kenney-sofa',gltfLoader.loadAsync('/assets/cc0/furniture/lounge-sofa.glb')),
      this._safe('kenney-coffee',gltfLoader.loadAsync('/assets/cc0/furniture/coffee-table.glb')),
      this._safe('polyhaven-hdri',exrLoader.loadAsync('/assets/cc0/hdri/studio-small-08-1k.exr')),
      this._safe('wood-ktx2',this.ktx2Loader.loadAsync('/assets/cc0/textures/wood-floor-1k.ktx2')),
      this._safe('plaster-ktx2',this.ktx2Loader.loadAsync('/assets/cc0/textures/plaster-wall-1k.ktx2')),
      this._safe('tile-ktx2',this.ktx2Loader.loadAsync('/assets/textures/tile.ktx2')),
      this._safe('support-wood-ktx2',this.ktx2Loader.loadAsync('/assets/textures/wood.ktx2')),
      this._safe('rug-ktx2',this.ktx2Loader.loadAsync('/assets/textures/rug.ktx2')),
      this._safe('fabric-ktx2',this.ktx2Loader.loadAsync('/assets/textures/fabric.ktx2')),
    ]);
    this.assets.sofa=sofa?.scene||null;this.assets.coffee=coffee?.scene||null;this.assets.wood=wood;this.assets.plaster=plaster;this.assets.tile=tile;this.assets.supportWood=supportWood;this.assets.rug=rug;this.assets.fabric=fabric;
    if(env){env.mapping=THREE.EquirectangularReflectionMapping;this.scene.environment=env;}
`,'environment loaders');
s=replaceOnce(s,"    const fallbackFloor=texture(this.loader,kitchen?'/assets/textures/tile.svg':'/assets/textures/wood.svg',kitchen?[8,8]:[6,8]),fallbackWood=texture(this.loader,'/assets/textures/wood.svg',[2,2]),rug=texture(this.loader,'/assets/textures/rug.svg',[2,2]),fabric=texture(this.loader,'/assets/textures/fabric.svg',[2,2]);\n    const floorMap=kitchen?fallbackFloor:this.assets.wood,woodMap=this.assets.wood||fallbackWood,wallMap=this.assets.plaster||null;","    const floorMap=kitchen?configuredTexture(this.assets.tile,[8,8]):configuredTexture(this.assets.wood,[6,8]),woodMap=configuredTexture(this.assets.wood||this.assets.supportWood,[2,2]),wallMap=configuredTexture(this.assets.plaster,[4,2]),rug=configuredTexture(this.assets.rug,[2,2]),fabric=configuredTexture(this.assets.fabric,[2,2]);",'build texture maps');
fs.writeFileSync(scenePath,s);

const gamePath='src/game.js';let g=fs.readFileSync(gamePath,'utf8');
for(const [oldText,newText,label] of [
  ["placeholderColor:0xff7a22,onError:err('orange')","placeholderColor:0xff7a22,onError:err('orange'),ktx2Loader:this.view.ktx2Loader",'orange loader'],
  ["placeholderColor:0x92a4b5,onError:err('gray')","placeholderColor:0x92a4b5,onError:err('gray'),ktx2Loader:this.view.ktx2Loader",'gray loader'],
  ["placeholderColor:0x8d614e,onError:err('henley')","placeholderColor:0x8d614e,onError:err('henley'),ktx2Loader:this.view.ktx2Loader",'Henley loader'],
])g=replaceOnce(g,oldText,newText,label);
fs.writeFileSync(gamePath,g);

const budgetPath='scripts/asset-budget.mjs';let b=fs.readFileSync(budgetPath,'utf8');
const marker="const sampled=provenance.sampledAudio||{};";
const block=`const compression=provenance.compression||{};
assert(String(compression.geometry||'').includes('EXT_meshopt_compression'),'Meshopt compression provenance missing');
assert(String(compression.textures||'').includes('KTX2'),'KTX2/Basis compression provenance missing');
const uncompressedTextures=walk(publicAssets).filter(p=>/\\.(?:png|jpe?g|webp|svg)$/i.test(p));
assert(uncompressedTextures.length===0,\`uncompressed shipped textures: \${uncompressedTextures.map(p=>path.relative(publicAssets,p)).join(', ')}\`);
for(const rel of ['cc0/textures/wood-floor-1k.ktx2','cc0/textures/plaster-wall-1k.ktx2','textures/tile.ktx2','textures/wood.ktx2','textures/rug.ktx2','textures/fabric.ktx2']){
  const file=path.join(publicAssets,rel);assert(exists(file),\`missing KTX2 \${rel}\`);if(exists(file))assert(fs.readFileSync(file).subarray(0,12).toString('hex')==='ab4b5458203230bb0d0a1a0a',\`invalid KTX2 \${rel}\`);
}
for(const rel of ['characters/authored/cat.glb','characters/authored/henley.glb','cc0/furniture/lounge-sofa.glb','cc0/furniture/coffee-table.glb']){
  const file=path.join(publicAssets,rel);assert(exists(file),\`missing compressed GLB \${rel}\`);if(exists(file))assert(fs.readFileSync(file).includes(Buffer.from('EXT_meshopt_compression')),\`missing Meshopt extension \${rel}\`);
}
for(const rel of ['basis/basis_transcoder.js','basis/basis_transcoder.wasm'])assert(exists(path.join(publicAssets,rel)),\`missing same-origin Basis transcoder \${rel}\`);

${marker}`;
b=replaceOnce(b,marker,block,'asset compression gate');
fs.writeFileSync(budgetPath,b);
console.log('Applied KTX2/Meshopt runtime loader and release-gate conversion.');
