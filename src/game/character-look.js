import { colors } from './arena.js';

export const defaultLook={shade:1,pattern:0};
export const shades=['Deep','Original','Bright'];
export const patterns=['Plain','Stripe','Chevron','Speckle'];

export function characterLook(value) {
  return {
    shade:Number.isInteger(value?.shade) && value.shade>=0 && value.shade<shades.length ? value.shade : defaultLook.shade,
    pattern:Number.isInteger(value?.pattern) && value.pattern>=0 && value.pattern<patterns.length ? value.pattern : defaultLook.pattern,
  };
}

export function uniformColor(team,shade) {
  return [['#d47d43',colors[0],'#ffc078'],['#448bce',colors[1],'#abd8ff']][team][shade];
}

export function characterFigure(team,value) {
  const {shade,pattern}=characterLook(value);
  return `<span class="stage-figure custom-figure ${team?'b':'a'}" data-pattern="${pattern}" style="color:${uniformColor(team,shade)}" aria-hidden="true">
    <span class="stage-head"></span><span class="stage-body"></span><span class="stage-boots"></span>
  </span>`;
}
