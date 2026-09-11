import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('public/assets');
const textureDir=path.join(root,'textures');
fs.mkdirSync(root,{recursive:true});
for(const stale of [path.join(root,'models'),path.join(root,'audio'),path.join(root,'characters','authored')])fs.rmSync(stale,{recursive:true,force:true});
fs.rmSync(textureDir,{recursive:true,force:true});fs.mkdirSync(textureDir,{recursive:true});

const svgs={
  'wood.svg':`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="100%" height="100%" fill="#9b6d4d"/><path d="M0 28H256M0 82H256M0 138H256M0 198H256" stroke="#694632" stroke-width="3" opacity=".38"/><path d="M40 0v256M126 0v256M212 0v256" stroke="#c99770" opacity=".22"/></svg>`,
  'tile.svg':`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="100%" height="100%" fill="#d7d0bf"/><path d="M0 64H256M0 128H256M0 192H256M64 0V256M128 0V256M192 0V256" stroke="#b6ad99" stroke-width="3"/></svg>`,
  'rug.svg':`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="100%" height="100%" fill="#496e67"/><path d="M0 0L256 256M-64 0L192 256M64 0L320 256" stroke="#82a29a" stroke-width="8" opacity=".26"/></svg>`,
  'fabric.svg':`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="100%" height="100%" fill="#66715b"/><path d="M0 16H256M0 48H256M0 80H256M0 112H256M0 144H256M0 176H256M0 208H256M0 240H256" stroke="#a6ad91" opacity=".12"/></svg>`,
};
for(const [name,svg] of Object.entries(svgs))fs.writeFileSync(path.join(textureDir,name),svg);

fs.writeFileSync(path.join(root,'provenance.json'),JSON.stringify({
  version:1,
  generatedAt:new Date().toISOString(),
  assets:{textures:'Small same-origin SVG support textures generated at build time; authored Poly Haven surfaces are vendored separately.'},
  runtimeOrigins:['same-origin only'],
},null,2));
console.log('Generated 4 lightweight support textures; procedural characters and oscillator audio are disabled.');
