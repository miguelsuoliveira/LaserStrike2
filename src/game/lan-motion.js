import { distance, move } from './arena.js';

const turnDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

export function createLanMotion() {
  let target, rendered, receivedAt=0;

  function receive(view, now=performance.now()) {
    const reset=!rendered || !target || !view || target.round!==view.round ||
      target.actors.length!==view.actors.length || (view.phase==='buy' && target.phase==='results');
    if (reset) rendered=view?.actors.map(actor=>({...actor}));
    else {
      view.actors.forEach((actor,index)=>{
        const previous=rendered[index];
        const {x,y,angle}=previous;
        const resetPose=previous.hp!==actor.hp && (!previous.hp || !actor.hp) || distance(actor,previous)>65;
        Object.assign(previous,actor);
        if (!resetPose) Object.assign(previous,{x,y,angle});
      });
    }
    target=view;
    receivedAt=now;
  }

  function frame(now, dt, command) {
    if (!target) return null;
    const blend=1-Math.exp(-dt*20);
    const active=target.phase==='active';
    const actors=target.actors;
    const playerIndex=actors.indexOf(target.player);
    for (let index=0;index<actors.length;index++) {
      const a=actors[index], pose=rendered[index];
      if (!a.hp) continue;
      let desired=a;
      if (active && index===playerIndex) {
        const length=Math.hypot(command.dx,command.dy);
        const ahead=Math.min(.085,Math.max(0,(now-receivedAt)/1000)+.022);
        if (length) {
          desired={x:a.x,y:a.y};
          move(desired,command.dx/length*175*ahead,command.dy/length*175*ahead);
        }
        pose.angle=Math.atan2(command.y-pose.y,command.x-pose.x);
      } else {
        pose.angle+=turnDelta(pose.angle,a.angle)*blend;
      }
      pose.x+=(desired.x-pose.x)*blend;
      pose.y+=(desired.y-pose.y)*blend;
    }
    const actor = reference => reference ? rendered[actors.indexOf(reference)] : undefined;
    return Object.assign(Object.create(Object.getPrototypeOf(target)),target,{
      actors:rendered,
      player:rendered[playerIndex],
      objective:{...target.objective,actor:actor(target.objective.actor),carrier:actor(target.objective.carrier)},
    });
  }

  return {receive,frame};
}
