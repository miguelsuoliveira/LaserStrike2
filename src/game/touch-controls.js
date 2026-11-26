import './touch-controls.css';
import { mobileCamera,offscreenBomb } from './mobile-camera.js';

export function mountTouchControls(wake=()=>{}) {
  const preference=new URLSearchParams(location.search).get('mobile');
  const coarse=matchMedia('(pointer: coarse)');
  const enabled=()=>preference==='1' || preference!=='0' && coarse.matches;
  const root=document.createElement('div');
  root.className='touch-controls';
  root.hidden=true;
  root.innerHTML=`<div class="touch-stick touch-move" role="group" aria-label="Move joystick"><span>Move</span></div>
    <div class="touch-stick touch-aim" role="group" aria-label="Aim and fire joystick"><span>Aim + fire</span></div>
    <div class="touch-actions">
      <button type="button" data-key="KeyE">Use</button><button type="button" data-key="KeyR">Reload</button>
      <button type="button" data-key="Tab">Score</button><button type="button" data-key="Escape">Pause</button>
      <button type="button" class="touch-fullscreen" hidden>Fullscreen</button>
    </div><div class="touch-objective" hidden><span aria-hidden="true">➜</span><strong>Bomb has been planted</strong></div>`;
  document.body.append(root);
  const fullscreen=root.querySelector('.touch-fullscreen');
  const page=document.documentElement;
  const requestFullscreen=page.requestFullscreen || page.webkitRequestFullscreen;
  const isFullscreen=()=>Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  const updateFullscreen=()=>{fullscreen.hidden=!requestFullscreen || isFullscreen();};
  function enterFullscreen() {
    if (!enabled() || !requestFullscreen || isFullscreen()) return;
    try {requestFullscreen.call(page)?.catch(()=>{});} catch {}
  }
  fullscreen.addEventListener('click',enterFullscreen);
  document.addEventListener('fullscreenchange',updateFullscreen);
  document.addEventListener('webkitfullscreenchange',updateFullscreen);
  updateFullscreen();
  const indicator=root.querySelector('.touch-objective');
  const arrow=indicator.querySelector('span');
  const move={x:0,y:0}, aim={x:0,y:0};
  let firing=false, fireTap=false, visible=false;
  const actions=new Map();
  function key(code,down) {window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,cancelable:true}));}

  function stick(element,vector,isAim=false) {
    let pointerId;
    const update=event=>{
      if (pointerId!==event.pointerId) return;
      const rect=element.getBoundingClientRect();
      const x=(event.clientX-rect.left-rect.width/2)/(rect.width*.34);
      const y=(event.clientY-rect.top-rect.height/2)/(rect.height*.34);
      const length=Math.hypot(x,y);
      vector.x=length<.12 ? 0 : x/Math.max(1,length);
      vector.y=length<.12 ? 0 : y/Math.max(1,length);
      if (isAim) {
        if (!firing && length>=.12) fireTap=true;
        firing=length>=.12;
      }
      element.style.setProperty('--stick-x',vector.x*22+'px');
      element.style.setProperty('--stick-y',vector.y*22+'px');
      wake();
    };
    const end=event=>{
      if (pointerId!==event.pointerId) return;
      pointerId=undefined;
      if (!isAim) {vector.x=0;vector.y=0;} else firing=false;
      element.style.removeProperty('--stick-x');
      element.style.removeProperty('--stick-y');
      wake();
    };
    element.addEventListener('pointerdown',event=>{
      if (pointerId!==undefined) return;
      event.preventDefault();
      pointerId=event.pointerId;
      element.setPointerCapture(pointerId);
      update(event);
    });
    element.addEventListener('pointermove',update);
    for (const type of ['pointerup','pointercancel','lostpointercapture']) element.addEventListener(type,end);
    return ()=>{
      if (pointerId!==undefined && element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
      pointerId=undefined;
      element.style.removeProperty('--stick-x');
      element.style.removeProperty('--stick-y');
    };
  }

  const resetMove=stick(root.querySelector('.touch-move'),move);
  const resetAim=stick(root.querySelector('.touch-aim'),aim,true);
  for (const button of root.querySelectorAll('[data-key]')) {
    const code=button.dataset.key;
    button.addEventListener('pointerdown',event=>{
      if (actions.has(code)) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      actions.set(code,event.pointerId);
      key(code,true);
    });
    for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type,event=>{
      if (actions.get(code)!==event.pointerId) return;
      actions.delete(code);
      key(code,false);
    });
  }

  function reset() {
    resetMove();
    resetAim();
    for (const code of actions.keys()) key(code,false);
    actions.clear();
    move.x=move.y=aim.x=aim.y=0;
    firing=fireTap=false;
  }
  addEventListener('blur',reset);
  return {
    move,
    enterFullscreen,
    camera(canvas,player,site) {
      const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);
      const camera=visible && player ? mobileCamera(player,aspect) : null;
      const direction=offscreenBomb(camera,site);
      indicator.hidden=!direction;
      if (direction) {
        indicator.style.left=direction.x*100+'%';
        indicator.style.top=direction.y*100+'%';
        arrow.style.transform=`rotate(${direction.angle}rad)`;
      }
      return camera;
    },
    aimAt(actor,pointer) {
      if (visible && actor?.hp && (aim.x || aim.y)) {
        pointer.x=actor.x+aim.x*80;
        pointer.y=actor.y+aim.y*80;
      }
    },
    firing:()=>firing || fireTap,
    consumeFire:()=>{fireTap=false;},
    show(active) {
      const show=active && enabled();
      if (visible===show) return;
      visible=show;
      if (!show) reset();
      root.hidden=!show;
      document.body.classList.toggle('touch-match',show);
    },
  };
}
