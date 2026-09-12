export class PerformanceGovernor{
  constructor(view){
    this.view=view;
    this.minimumSpec='iPhone 11';
    this.qualityTargetMs=16.6;
    this.fallbackTargetMs=33.3;
    this.tier='quality';
    this.basePixelRatio=Math.min(devicePixelRatio||1,1.75);
    this.avgFrameMs=this.qualityTargetMs;
    this.samples=[];
    this.slowFrames=0;
    this.fastFrames=0;
    this.last=performance.now();
    this._tick=this._tick.bind(this);
    this.raf=requestAnimationFrame(this._tick);
  }
  _tick(now){
    const dt=now-this.last;this.last=now;
    if(!document.hidden&&dt>0&&dt<100){
      this.avgFrameMs=this.avgFrameMs*.94+dt*.06;
      this.samples.push(dt);if(this.samples.length>180)this.samples.shift();
      if(this.tier==='quality'){
        if(this.avgFrameMs>23)this.slowFrames++;else this.slowFrames=Math.max(0,this.slowFrames-2);
        if(this.slowFrames>=75)this.setTier('fallback');
      }else{
        if(this.avgFrameMs<18.5)this.fastFrames++;else this.fastFrames=Math.max(0,this.fastFrames-2);
        if(this.fastFrames>=240)this.setTier('quality');
      }
    }
    this.raf=requestAnimationFrame(this._tick);
  }
  setTier(next){
    if(next!=='quality'&&next!=='fallback')return this.status();
    if(this.tier===next)return this.status();
    this.tier=next;this.slowFrames=0;this.fastFrames=0;
    const dpr=next==='quality'?this.basePixelRatio:Math.min(devicePixelRatio||1,1.0);
    this.view.renderer.setPixelRatio(dpr);this.view.resize();
    return this.status();
  }
  forceTier(next){return this.setTier(next);}
  status(){
    const sorted=[...this.samples].sort((a,b)=>a-b),idx=Math.max(0,Math.ceil(sorted.length*.95)-1);
    return{
      minimumSpec:this.minimumSpec,
      tier:this.tier,
      targetFrameMs:this.tier==='quality'?this.qualityTargetMs:this.fallbackTargetMs,
      qualityTargetMs:this.qualityTargetMs,
      fallbackTargetMs:this.fallbackTargetMs,
      averageFrameMs:Number(this.avgFrameMs.toFixed(2)),
      p95FrameMs:Number((sorted[idx]||this.avgFrameMs).toFixed(2)),
      sampleCount:this.samples.length,
      pixelRatio:Number(this.view.renderer.getPixelRatio().toFixed(2)),
    };
  }
}
