import { width,height } from './arena.js';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function mobileCamera(player, aspect) {
  const w=Math.min(width,height*aspect,aspect>=1 ? 420 : 620*aspect);
  const h=w/aspect;
  return {
    x:clamp(player.x-w/2,0,width-w),
    y:clamp(player.y-h/2,0,height-h),
    w,h,
  };
}

export function offscreenBomb(camera, site) {
  if (!camera || !site) return null;
  const x=(site.x-camera.x)/camera.w, y=(site.y-camera.y)/camera.h;
  if (x>=0 && x<=1 && y>=0 && y<=1) return null;
  const dx=x-.5, dy=y-.5;
  const scale=1/Math.max(Math.abs(dx)/.17,Math.abs(dy)/.26);
  return {x:.5+dx*scale,y:.5+dy*scale,angle:Math.atan2(dy*camera.h,dx*camera.w)};
}

export function mapPointer(canvas,event,camera) {
  const r=canvas.getBoundingClientRect();
  const view=camera || {x:0,y:0,w:width,h:height};
  return {x:view.x+(event.clientX-r.left)*view.w/r.width,y:view.y+(event.clientY-r.top)*view.h/r.height};
}
