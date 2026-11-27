import { colors } from './arena.js';

export const defaultLook={brightness:50,pattern:0};
export const patterns=['Plain','Stripe','Chevron','Speckle','Glitchy','Retro','Interstellar','Camo','Graffiti'];

export function characterLook(value) {
  return {
    brightness:Number.isFinite(value?.brightness) ? Math.max(0,Math.min(100,Math.round(value.brightness/5)*5)) :
      (Number.isInteger(value?.shade) ? [15,50,85][value.shade] : undefined) ?? defaultLook.brightness,
    pattern:Number.isInteger(value?.pattern) && value.pattern>=0 && value.pattern<patterns.length ? value.pattern : defaultLook.pattern,
  };
}

export function uniformColor(team,brightness) {
  const base=colors[team];
  const shift=(brightness-50)/50;
  const channels=[1,3,5].map(index=>{
    const original=parseInt(base.slice(index,index+2),16);
    const delta=shift<0 ? original*.52*shift : (255-original)*.65*shift;
    return Math.round(original+delta);
  });
  return `rgb(${channels.join(',')})`;
}

export function characterFigure(team,value) {
  const {brightness,pattern}=characterLook(value);
  return `<span class="stage-figure custom-figure ${team?'b':'a'}" data-pattern="${pattern}" style="color:${uniformColor(team,brightness)}" aria-hidden="true">
    <span class="stage-head"></span><span class="stage-body"></span><span class="stage-boots"></span>
  </span>`;
}
