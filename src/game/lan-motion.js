import { distance, move } from './arena.js';

const turnDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

export function createLanMotion() {
  let target, rendered, receivedAt=0;
  let history=[], clockOffset=Infinity, spacing=55, previousArrival=0, localSpeed=0, timeline=-Infinity;

  function receive(view, now=performance.now()) {
    const reset=!rendered || !target || !view || target.round!==view.round ||
      target.actors.length!==view.actors.length || (view.phase==='buy' && target.phase==='results');
    const buffer=Number.isFinite(view?.serverTime);
    if (reset) {
      rendered=view?.actors.map(actor=>({...actor}));
      history=[];
      clockOffset=Infinity;
      spacing=55;
      previousArrival=0;
      localSpeed=0;
      timeline=-Infinity;
    }
    if (buffer) {
      clockOffset=Math.min(clockOffset,now-view.serverTime);
      if (previousArrival) spacing=spacing*.88+Math.min(250,now-previousArrival)*.12;
      previousArrival=now;
      if (!history.length || view.serverTime>history.at(-1).time) {
        history.push({time:view.serverTime,actors:view.actors});
        if (history.length>16) history.shift();
      }
    }
    if (!reset) {
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
    const buffered=active && history.length>0;
    const renderTime=Math.max(timeline,now-clockOffset-Math.max(110,Math.min(250,spacing*2.1)));
    if (buffered) timeline=renderTime;
    while (history.length>2 && history[1].time<=renderTime) history.shift();
    const [older,newer]=history;
    const fraction=newer ? Math.max(0,Math.min(1,(renderTime-older.time)/(newer.time-older.time))) : 0;
    for (let index=0;index<actors.length;index++) {
      const a=actors[index], pose=rendered[index];
      if (!a.hp) continue;
      let desired=a;
      if (buffered && index===playerIndex) {
        const length=Math.hypot(command.dx,command.dy);
        localSpeed+=((length?175:0)-localSpeed)*Math.min(1,dt*16);
        if (length) move(pose,command.dx/length*localSpeed*dt,command.dy/length*localSpeed*dt);
        const gap=distance(pose,a);
        const correction=length ? Math.max(0,gap-22) : gap;
        if (correction>0) {
          const blend=1-Math.exp(-dt*(length?7:12));
          move(pose,(a.x-pose.x)*correction/gap*blend,(a.y-pose.y)*correction/gap*blend);
        }
        pose.angle=Math.atan2(command.y-pose.y,command.x-pose.x);
        continue;
      }
      if (buffered) {
        const from=older.actors[index], to=newer?.actors[index] || from;
        if (from.hp && to.hp && distance(from,to)<65) {
          pose.x=from.x+(to.x-from.x)*fraction;
          pose.y=from.y+(to.y-from.y)*fraction;
          pose.angle=from.angle+turnDelta(from.angle,to.angle)*fraction;
          continue;
        }
      }
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
