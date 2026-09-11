const FILES={
  jump:['jump-1.wav','jump-2.wav'],land:['land-1.wav','land-2.wav','land-3.wav'],collect:['collect-1.wav','collect-2.wav'],objective:['objective-1.wav','objective-2.wav'],caught:['caught.wav'],success:['success.wav'],switch:['switch.wav'],near:['near.wav'],cat:['cat-1.wav','cat-2.wav']
};
export class AudioBus{
  constructor(){this.ctx=null;this.buffers=new Map();this.active=new Set();this.lastCat=0;this.catCooldown=6500;}
  async unlock(){if(!this.ctx)this.ctx=new (window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')await this.ctx.resume();}
  async preload(){await this.unlock();const jobs=[];for(const [group,names] of Object.entries(FILES))for(const name of names)jobs.push(fetch(`/assets/audio/${name}`).then(r=>r.arrayBuffer()).then(b=>this.ctx.decodeAudioData(b)).then(buf=>this.buffers.set(name,buf)).catch(()=>{}));await Promise.all(jobs);}
  play(group,{volume=0.35,rate=1}={}){if(!this.ctx)return;const names=FILES[group]||[];const ready=names.filter(n=>this.buffers.has(n));if(!ready.length)return;const name=ready[Math.floor(Math.random()*ready.length)],source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=this.buffers.get(name);source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain).connect(this.ctx.destination);source.onended=()=>this.active.delete(source);this.active.add(source);source.start();}
  maybeCat(reason='event'){const now=performance.now();if(now-this.lastCat<this.catCooldown||Math.random()>.34)return;if(['move','jump'].includes(reason))return;this.lastCat=now;this.play('cat',{volume:.28,rate:.94+Math.random()*.12});}
  stopAll(){for(const s of this.active){try{s.stop()}catch{}}this.active.clear();}
}
