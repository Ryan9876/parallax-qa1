import { clamp } from './config.js';

export class HenleyInput{
  constructor(canvas,{onDeviceChange=()=>{}}={}){
    this.canvas=canvas;this.onDeviceChange=onDeviceChange;this.device='pointer';this.keys=new Set();this.drag=null;this.actions={interact:false,pause:false};this._bind();
  }
  _device(next){if(this.device!==next){this.device=next;this.onDeviceChange(next);}}
  _bind(){const prevent=e=>{if(e.cancelable)e.preventDefault();};
    this.canvas.addEventListener('pointerdown',e=>{prevent(e);this._device(e.pointerType==='touch'?'touch':'pointer');this.canvas.setPointerCapture?.(e.pointerId);this.drag={id:e.pointerId,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,t:performance.now()};},{passive:false});
    this.canvas.addEventListener('pointermove',e=>{if(!this.drag||e.pointerId!==this.drag.id)return;prevent(e);this.drag.x=e.clientX;this.drag.y=e.clientY;},{passive:false});
    const end=e=>{if(!this.drag||e.pointerId!==this.drag.id)return;prevent(e);const d=this.drag,elapsed=performance.now()-d.t,moved=Math.hypot(d.x-d.x0,d.y-d.y0);if(moved<13&&elapsed<380)this.actions.interact=true;this.drag=null;};
    this.canvas.addEventListener('pointerup',end,{passive:false});this.canvas.addEventListener('pointercancel',end,{passive:false});
    addEventListener('keydown',e=>{this._device('keyboard');const k=e.key.toLowerCase();this.keys.add(k);if([' ','e','p','escape'].includes(k)){e.preventDefault();if(e.repeat)return;if(k===' '||k==='e')this.actions.interact=true;if(k==='p'||k==='escape')this.actions.pause=true;}});
    addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));
  }
  sample(cameraYaw=0){let sx=0,sz=0,mag=0;if(this.drag){const dx=this.drag.x-this.drag.x0,dy=this.drag.y-this.drag.y0,len=Math.hypot(dx,dy);if(len>3){const nx=dx/len,nz=-dy/len,c=Math.cos(cameraYaw),s=Math.sin(cameraYaw);sx=nx*c+nz*s;sz=-nx*s+nz*c;mag=clamp(len/78,0,1);}}
    const left=this.keys.has('a')||this.keys.has('arrowleft'),right=this.keys.has('d')||this.keys.has('arrowright'),up=this.keys.has('w')||this.keys.has('arrowup'),down=this.keys.has('s')||this.keys.has('arrowdown');if(left||right||up||down){const kx=(right?1:0)-(left?1:0),kz=(up?1:0)-(down?1:0),len=Math.hypot(kx,kz)||1,c=Math.cos(cameraYaw),s=Math.sin(cameraYaw);const nx=kx/len,nz=kz/len;sx=nx*c+nz*s;sz=-nx*s+nz*c;mag=1;}
    return{steerDirection:{x:sx,z:sz},steerMagnitude:mag,interact:this.actions.interact,pause:this.actions.pause,device:this.device,drag:this.drag?{x0:this.drag.x0,y0:this.drag.y0,x:this.drag.x,y:this.drag.y}:null};}
  consumeTransient(){this.actions.interact=false;this.actions.pause=false;}
  resetTransient(){this.consumeTransient();}
}
