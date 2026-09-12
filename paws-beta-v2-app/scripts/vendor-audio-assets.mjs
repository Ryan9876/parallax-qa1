import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve('public/assets');
const outDir=path.join(root,'audio');
const voiceDir=path.join(root,'voice');
fs.rmSync(outDir,{recursive:true,force:true});fs.mkdirSync(outDir,{recursive:true});
const USER_AGENT='PawsOnTheRunBetaV2/1.0 (+https://github.com/Ryan9876/parallax-qa1)';
const samples=[
  {file:'cat-1.mp3',id:'0494',name:'Little Meow of a Cat #1',page:'https://bigsoundbank.com/little-meow-of-a-cat-s0494.html',role:'cat vocal'},
  {file:'cat-2.mp3',id:'1479',name:'Little meow of a cat #9',page:'https://bigsoundbank.com/little-meow-of-a-cat-9-s1479.html',role:'cat vocal'},
  {file:'jump-1.mp3',id:'1795',name:'Whoosh #3',page:'https://bigsoundbank.com/whoosh-3-s1795.html',role:'jump/vault'},
  {file:'jump-2.mp3',id:'1798',name:'Whoosh #10',page:'https://bigsoundbank.com/whoosh-10-s1798.html',role:'jump/vault'},
  {file:'near.mp3',id:'1802',name:'Whoosh #9',page:'https://bigsoundbank.com/whoosh-9-s1802.html',role:'near miss'},
  {file:'land.mp3',id:'1836',name:'Jumping on Concrete #2',page:'https://bigsoundbank.com/jumping-on-concrete-2-s1836.html',role:'landing'},
  {file:'collect.mp3',id:'0010',name:'Small bell',page:'https://bigsoundbank.com/small-bell-s0010.html',role:'collectible'},
  {file:'objective.mp3',id:'2080',name:'Chimes dream #2',page:'https://bigsoundbank.com/chimes-dream-2-s2080.html',role:'objective/success'},
  {file:'switch.mp3',id:'1682',name:'Operation game #1',page:'https://bigsoundbank.com/operation-game-1-s1682.html',role:'cat switch'},
  {file:'caught.mp3',id:'2461',name:'Punch #6',page:'https://bigsoundbank.com/punch-6-s2461.html',role:'caught impact'},
];
const voiceLines=[
  {file:'henley-almost.mp3',transcript:'Almost had you!',role:'proximity'},
  {file:'henley-see-you.mp3',transcript:'I see you!',role:'proximity'},
  {file:'henley-gotcha.mp3',transcript:'Gotcha!',role:'terminal catch'},
  {file:'henley-nice-try.mp3',transcript:'Nice try!',role:'terminal catch'},
];
const sha256=buf=>crypto.createHash('sha256').update(buf).digest('hex');
async function fetchSample(sample){
  const url=`https://bigsoundbank.com/UPLOAD/mp3/${sample.id}.mp3`;
  const r=await fetch(url,{headers:{'User-Agent':USER_AGENT,'Accept':'audio/mpeg,*/*'}});
  if(!r.ok)throw new Error(`Audio request failed ${r.status} ${url}`);
  const buf=Buffer.from(await r.arrayBuffer());
  const id3=buf.subarray(0,3).toString('ascii')==='ID3',sync=buf.length>1&&buf[0]===0xff&&(buf[1]&0xe0)===0xe0;
  if(!id3&&!sync)throw new Error(`${sample.file} is not recognizable MP3 data`);
  fs.writeFileSync(path.join(outDir,sample.file),buf);
  return {...sample,provider:'BigSoundBank',creator:'Joseph SARDIN',license:'CC0 1.0',download:url,bytes:buf.length,sha256:sha256(buf),local:`/assets/audio/${sample.file}`};
}
const records=[];for(const sample of samples)records.push(await fetchSample(sample));
const total=records.reduce((n,a)=>n+a.bytes,0);if(total>2*1024*1024)throw new Error(`Sampled audio ${total} bytes exceeds 2 MiB release budget`);
const generatedVoice=voiceLines.map(line=>{const localPath=path.join(voiceDir,line.file);if(!fs.existsSync(localPath))throw new Error(`Missing committed Henley voice line ${line.file}`);const buf=fs.readFileSync(localPath),id3=buf.subarray(0,3).toString('ascii')==='ID3',sync=buf.length>1&&buf[0]===0xff&&(buf[1]&0xe0)===0xe0;if(buf.length<512||(!id3&&!sync))throw new Error(`Invalid Henley voice line ${line.file}`);return{...line,provider:'OpenAI AI Voice Generator',voiceStyle:'deep',origin:'project-generated',bytes:buf.length,sha256:sha256(buf),local:`/assets/voice/${line.file}`};});
const voiceBytes=generatedVoice.reduce((n,a)=>n+a.bytes,0);if(total+voiceBytes>2*1024*1024)throw new Error(`Gameplay audio plus voice ${total+voiceBytes} bytes exceeds 2 MiB release budget`);
const provenancePath=path.join(root,'provenance.json');let provenance={version:1,assets:{},runtimeOrigins:['same-origin only']};
try{provenance=JSON.parse(fs.readFileSync(provenancePath,'utf8'));}catch{}
provenance.sampledAudio={generatedAt:new Date().toISOString(),policy:'CC0 field-recorded samples, build-vendored for same-origin runtime playback. Cat vocalizations are event-gated and never tied to routine movement.',samples:records};
provenance.generatedVoice={generatedAt:new Date().toISOString(),policy:'Project-generated Henley taglines committed to the repository for same-origin runtime playback. Proximity delivery is probabilistic and cooldown-limited; terminal catch delivery is rate-limited.',lines:generatedVoice};
fs.writeFileSync(provenancePath,JSON.stringify(provenance,null,2));
console.log(`Vendored ${records.length} CC0 sampled audio files plus ${generatedVoice.length} Henley voice lines (${((total+voiceBytes)/1024).toFixed(1)} KiB).`);
