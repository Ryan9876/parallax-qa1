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
};
export class AudioBus{
  constructor(){this.ctx=null;this.buffers=new Map();this.active=new Set();this.lastCat=0;this.catCooldown=6500;this.lastByGroup=new Map();}
  async unlock(){if(!this.ctx)this.ctx=new (window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')await this.ctx.resume();}
  async preload(){await this.unlock();const jobs=[];for(const names of Object.values(FILES))for(const name of names)if(!this.buffers.has(name))jobs.push(fetch(`/assets/audio/${name}`).then(r=>{if(!r.ok)throw new Error(`audio ${r.status}: ${name}`);return r.arrayBuffer();}).then(b=>this.ctx.decodeAudioData(b)).then(buf=>this.buffers.set(name,buf)).catch(()=>{}));await Promise.all(jobs);}
  choose(group,ready){if(ready.length<2)return ready[0];const last=this.lastByGroup.get(group);const choices=ready.filter(name=>name!==last),name=choices[Math.floor(Math.random()*choices.length)];this.lastByGroup.set(group,name);return name;}
  play(group,{volume=0.35,rate=1}={}){if(!this.ctx)return;const names=FILES[group]||[],ready=names.filter(n=>this.buffers.has(n));if(!ready.length)return;const name=this.choose(group,ready),source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=this.buffers.get(name);source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain).connect(this.ctx.destination);source.onended=()=>this.active.delete(source);this.active.add(source);source.start();}
  maybeCat(reason='event'){const now=performance.now();if(now-this.lastCat<this.catCooldown||Math.random()>.34)return;if(['move','jump'].includes(reason))return;this.lastCat=now;this.play('cat',{volume:.25,rate:.96+Math.random()*.08});}
  stopAll(){for(const s of this.active){try{s.stop()}catch{}}this.active.clear();}
}
