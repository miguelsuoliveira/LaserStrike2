import './touch-controls.css';
import { mobileCamera,offscreenObjective,mapPointer } from './mobile-camera.js';

export function mountTouchControls(canvas,wake=()=>{}) {
  const preference=new URLSearchParams(location.search).get('mobile');
  const coarse=matchMedia('(pointer: coarse)');
  const enabled=()=>preference==='1' || preference!=='0' && coarse.matches;
  const aimPreference='laser-strike-mobile-aim';
  let aimMode='joystick';
  try {if (localStorage.getItem(aimPreference)==='tap') aimMode='tap';} catch {}
  const root=document.createElement('div');
  root.className='touch-controls';
  root.hidden=true;
  root.innerHTML=`<div class="touch-stick touch-move" role="group" aria-label="Move joystick"><span>Move</span></div>
    <div class="touch-stick touch-aim" role="group" aria-label="Aim and fire joystick"><span>Aim + fire</span></div>
    <div class="touch-actions">
      <button type="button" data-key="KeyE">Use</button><button type="button" data-key="KeyR">Reload</button>
      <button type="button" data-key="Tab">Score</button><button type="button" data-key="Escape">Pause</button>
      <button type="button" class="touch-fullscreen" hidden>Fullscreen</button>
    </div><div class="touch-objective" hidden><span aria-hidden="true">➜</span><strong></strong></div>`;
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
  const objectiveLabel=indicator.querySelector('strong');
  const move={x:0,y:0}, aim={x:0,y:0}, lastAim={x:0,y:0};
  const aimStick=root.querySelector('.touch-aim');
  aimStick.hidden=aimMode!=='joystick';
  let firePointer, tapPosition, fireTap=false, visible=false;
  const actions=new Map();
  function key(code,down) {window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,cancelable:true}));}

  function stick(element,vector,onChange) {
    let pointerId;
    const update=event=>{
      if (pointerId!==event.pointerId) return;
      const rect=element.getBoundingClientRect();
      const x=(event.clientX-rect.left-rect.width/2)/(rect.width*.34);
      const y=(event.clientY-rect.top-rect.height/2)/(rect.height*.34);
      const length=Math.hypot(x,y);
      vector.x=length<.12 ? 0 : x/Math.max(1,length);
      vector.y=length<.12 ? 0 : y/Math.max(1,length);
      element.style.setProperty('--stick-x',vector.x*22+'px');
      element.style.setProperty('--stick-y',vector.y*22+'px');
      onChange?.(vector);
      wake();
    };
    const end=event=>{
      if (pointerId!==event.pointerId) return;
      pointerId=undefined;
      vector.x=vector.y=0;
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
  const resetAim=stick(aimStick,aim,vector=>{
    if (!vector.x && !vector.y) return;
    Object.assign(lastAim,vector);
    fireTap=true;
  });
  const point=event=>({clientX:event.clientX,clientY:event.clientY});
  canvas.addEventListener('pointerdown',event=>{
    if (!visible || aimMode!=='tap' || event.pointerType!=='touch' || firePointer!==undefined) return;
    event.preventDefault();
    firePointer=event.pointerId;
    tapPosition=point(event);
    fireTap=true;
    canvas.setPointerCapture(firePointer);
    wake();
  });
  canvas.addEventListener('pointermove',event=>{
    if (event.pointerId!==firePointer) return;
    tapPosition=point(event);
    wake();
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(type,event=>{
    if (event.pointerId!==firePointer) return;
    firePointer=undefined;
    if (type==='pointercancel') fireTap=false;
    wake();
  });
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
    aim.x=aim.y=lastAim.x=lastAim.y=0;
    if (firePointer!==undefined && canvas.hasPointerCapture(firePointer)) canvas.releasePointerCapture(firePointer);
    firePointer=undefined;
    tapPosition=undefined;
    for (const code of actions.keys()) key(code,false);
    actions.clear();
    move.x=move.y=0;
    fireTap=false;
  }
  addEventListener('blur',reset);
  return {
    move,
    enterFullscreen,
    settingsMarkup() {
      return enabled() ? `<label class="settings-row">Shooting controls <select id="mobile-aim"><option value="joystick" ${aimMode==='joystick'?'selected':''}>Joystick</option><option value="tap" ${aimMode==='tap'?'selected':''}>Tap to shoot</option></select></label>` : '';
    },
    setAimMode(mode) {
      if (mode!=='joystick' && mode!=='tap') return;
      reset();
      aimMode=mode;
      aimStick.hidden=mode!=='joystick';
      try {localStorage.setItem(aimPreference,mode);} catch {}
    },
    camera(canvas,player,objective) {
      const zoomed=Boolean(visible && player?.hp>0);
      canvas.classList.toggle('mobile-zoomed',zoomed);
      const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);
      const camera=zoomed ? mobileCamera(player,aspect) : null;
      const direction=offscreenObjective(camera,objective);
      indicator.hidden=!direction;
      if (direction) {
        if (objectiveLabel.textContent!==direction.text) objectiveLabel.textContent=direction.text;
        indicator.style.left=direction.x*100+'%';
        indicator.style.top=direction.y*100+'%';
        arrow.style.transform=`rotate(${direction.angle}rad)`;
      }
      return camera;
    },
    aimAt(pointer,camera,actor) {
      if (visible && aimMode==='joystick' && actor && (lastAim.x || lastAim.y)) {
        pointer.x=actor.x+lastAim.x*80;
        pointer.y=actor.y+lastAim.y*80;
      } else if (visible && tapPosition && (firePointer!==undefined || fireTap)) {
        Object.assign(pointer,mapPointer(canvas,tapPosition,camera));
      }
    },
    firing:()=>firePointer!==undefined || Boolean(aim.x || aim.y) || fireTap,
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
