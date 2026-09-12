const FILES={
  jump:['jump-1.mp3','jump-2.mp3'],
  land:['land.mp3'],
  collect:['collect.mp3'],
  objective:['objective.mp3'],
  caught:['caught.mp3'],
  success:['objective.mp3'],
  switch:['switch.mp3'],
  near:['near.mp3'],
  cat:['cat-1.mp3','cat-2.mp3'],
  henleyNear:['/assets/voice/henley-almost.mp3','/assets/voice/henley-see-you.mp3'],
  henleyCatch:['/assets/voice/henley-gotcha.mp3','/assets/voice/henley-nice-try.mp3'],
};
const UNIQUE_FILES=[...new Set(Object.values(FILES).flat())];
const assetUrl=name=>name.startsWith('/')?name:`/assets/audio/${name}`;
export class AudioBus{
  constructor(){this.ctx=null;this.buffers=new Map();this.active=new Set();this.lastCat=0;this.catCooldown=6500;this.lastHenley=0;this.henleyCooldown=9000;this.lastByGroup=new Map();this.errors=[];this.timers=new Set();}
  async unlock(){if(!this.ctx)this.ctx=new (window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')await this.ctx.resume();}
  async preload(){await this.unlock();const jobs=[];for(const name of UNIQUE_FILES)if(!this.buffers.has(name))jobs.push(fetch(assetUrl(name)).then(r=>{if(!r.ok)throw new Error(`audio ${r.status}: ${name}`);return r.arrayBuffer();}).then(b=>this.ctx.decodeAudioData(b)).then(buf=>this.buffers.set(name,buf)).catch(error=>{const message=String(error?.message||error);if(!this.errors.some(e=>e.includes(name)))this.errors.push(`${name}: ${message}`);}));await Promise.all(jobs);}
  status(){return{ready:this.buffers.size,total:UNIQUE_FILES.length,errors:[...this.errors],active:this.active.size,voiceReady:[...this.buffers.keys()].filter(name=>name.startsWith('/assets/voice/')).length};}
  choose(group,ready){if(ready.length<2)return ready[0];const last=this.lastByGroup.get(group);const choices=ready.filter(name=>name!==last),name=choices[Math.floor(Math.random()*choices.length)];this.lastByGroup.set(group,name);return name;}
  schedule(fn,delay){const timer=setTimeout(()=>{this.timers.delete(timer);fn();},delay);this.timers.add(timer);}
  play(group,{volume=0.35,rate=1}={}){if(!this.ctx)return;const names=FILES[group]||[],ready=names.filter(n=>this.buffers.has(n));if(!ready.length)return;const name=this.choose(group,ready),source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=this.buffers.get(name);source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain).connect(this.ctx.destination);source.onended=()=>this.active.delete(source);this.active.add(source);source.start();if(group==='caught'&&volume>=.3)this.schedule(()=>this.maybeHenley('henleyCatch',{force:true}),120);}
  maybeCat(reason='event'){if(reason==='danger'){this.maybeHenley('henleyNear');return;}const now=performance.now();if(now-this.lastCat<this.catCooldown||Math.random()>.34)return;if(['move','jump'].includes(reason))return;this.lastCat=now;this.play('cat',{volume:.25,rate:.96+Math.random()*.08});}
  maybeHenley(group='henleyNear',{force=false}={}){const now=performance.now(),minimum=force?1200:this.henleyCooldown;if(now-this.lastHenley<minimum)return;if(!force&&Math.random()>.26)return;this.lastHenley=now;this.play(group,{volume:group==='henleyCatch'?.32:.24,rate:1});}
  stopAll(){for(const timer of this.timers)clearTimeout(timer);this.timers.clear();for(const s of this.active){try{s.stop()}catch{}}this.active.clear();}
}
