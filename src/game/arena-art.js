import { paintTacticalCharacter } from './tactical-art.js';
import { arenaDetail } from './arena-quality.js';
import { gear } from './match.js';
import { width,height,walls,sites,spawn,colors } from './arena.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const backdrop = document.createElement('canvas');
backdrop.width=width;
backdrop.height=height;
const art = backdrop.getContext('2d');
art.fillStyle='#51443b';
art.fillRect(0,0,width,height);
for (let y=0;y<height;y+=24) for (let x=0;x<width;x+=32) {
  const shade = (x*23+y*31)%17;
  art.fillStyle=`rgb(${89+shade},${71+shade},${54+shade})`;
  art.fillRect(x+(y%48?0:1),y,31,23);
}
for (const [x,y] of spawn) {
  art.fillStyle='#263b3a';
  art.fillRect(x-45,y-85,124,170);
  art.strokeStyle='#6a8b83';
  art.strokeRect(x-45,y-85,124,170);
}
for (const [x,y,label] of [[495,155,'NORTH ARCADE'],[495,574,'SOUTH ARCADE'],[243,360,'QUAY PLAZA'],[1100,360,'BASTION']]) {
  art.fillStyle='#d4b79490';
  art.font='bold 14px system-ui';
  art.textAlign='center';
  art.fillText(label,x,y+79);
  art.strokeStyle='#c8a88480';
  art.lineWidth=2;
  art.strokeRect(x-54,y-49,108,98);
}
for (const [x,y] of [[247,360],[888,360]]) {
  art.save();
  art.translate(x,y);
  for (let i=0;i<8;i++) {
    art.rotate(Math.PI/4);
    art.fillStyle=i%2?'#ba885d':'#497c77';
    art.beginPath();
    art.moveTo(0,0);
    art.lineTo(-14,-25);
    art.lineTo(0,-41);
    art.lineTo(14,-25);
    art.closePath();
    art.fill();
  }
  art.restore();
}
for (const [x,y,w,h] of walls) {
  art.fillStyle='#292521';
  art.fillRect(x+5,y+7,w,h);
  art.fillStyle='#bc9168';
  art.fillRect(x,y,w,h);
  art.fillStyle='#743f38';
  art.fillRect(x+5,y+5,w-10,h-10);
  for (let i=8;i<w-6;i+=10) {
    art.fillStyle=i%3?'#9c5545':'#b06451';
    art.fillRect(x+i,y+8,5,h-16);
  }
  art.strokeStyle='#e0b180';
  art.strokeRect(x+1,y+1,w-2,h-2);
}

const labelWidths=new WeakMap();
const circle = (c,x,y,r)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);};
export function paint(c, match, pointer, mini=false, quality='low') {
  c.setTransform(c.canvas.width/width,0,0,c.canvas.height/height,0,0);
  c.drawImage(backdrop,0,0);
  const detail=mini ? null : arenaDetail(quality);
  const high=!mini && quality==='high';
  if (detail) c.drawImage(detail,0,0,width,height);
  const o=match?.objective;
  for (const site of sites) {
    const armed=o?.site===site;
    if (high) {
      const light=c.createRadialGradient(site.x,site.y,27,site.x,site.y,73);
      light.addColorStop(0,armed?'#ffac6075':'#65e8da55');
      light.addColorStop(1,'#00000000');
      c.fillStyle=light;
      c.fillRect(site.x-73,site.y-73,146,146);
    }
    c.fillStyle=armed?'#f0a05088':'#183e3f9e';
    circle(c,site.x,site.y,53); c.fill();
    c.strokeStyle=armed?'#fff08f':'#88c6bd';
    c.lineWidth=2; c.setLineDash([6,6]); c.stroke(); c.setLineDash([]);
    c.font='bold 30px system-ui'; c.textAlign='center'; c.fillStyle='#f7ead1';
    c.fillText(site.name,site.x,site.y+10);
  }
  if (!match) return;
  for (const trace of match.traces) {
    c.strokeStyle=colors[trace.team];
    c.globalAlpha=Math.min(1,trace.life*8);
    c.beginPath(); c.moveTo(trace.x,trace.y); c.lineTo(trace.bx,trace.by);
    if (high) {
      c.globalAlpha*=.22;
      c.lineWidth=11;
      c.stroke();
      c.globalAlpha=Math.min(1,trace.life*8);
    }
    c.lineWidth=3;
    c.stroke();
  }
  c.globalAlpha=1;
  for (const a of match.actors) {
    if (!a.hp) continue;
    c.save(); c.translate(a.x,a.y);
    if (mini) {
      c.fillStyle=colors[a.team]; circle(c,0,0,a===match.player?19:12); c.fill();
      c.restore(); continue;
    }
    paintTacticalCharacter(c,a);
    c.restore();
    if (a===match.player || a===o.carrier) {
      c.strokeStyle=a===match.player?'white':'#ffdf78'; c.lineWidth=2;
      circle(c,a.x,a.y,17); c.stroke();
    }
    if (a.hp<100) {
      c.fillStyle='#181f28'; c.fillRect(a.x-12,a.y-21,24,3);
      c.fillStyle=colors[a.team]; c.fillRect(a.x-12,a.y-21,24*a.hp/100,3);
    }
  }
  if (!mini) {
    c.font='700 11px system-ui';
    c.textAlign='center';
    c.lineWidth=3;
    c.strokeStyle='#152124';
    const labels=[];
    for (const a of match.actors) {
      if (!a.hp || a===match.player) continue;
      const y=a.y<36 ? a.y+27 : a.y-25;
      let halfWidth=labelWidths.get(a);
      if (halfWidth===undefined) {
        halfWidth=c.measureText(a.name).width/2+3;
        labelWidths.set(a,halfWidth);
      }
      let spot;
      for (const dy of [0,-13,13,-26,26]) {
        for (const dx of [0,-12,12,-24,24]) {
          const x=Math.max(halfWidth,Math.min(width-halfWidth,a.x+dx));
          const baseline=y+dy;
          if (baseline<12 || baseline>height ||
              labels.some(label=>Math.abs(label.y-baseline)<13 && Math.abs(label.x-x)<label.halfWidth+halfWidth)) continue;
          spot={x,y:baseline,halfWidth};
          break;
        }
        if (spot) break;
      }
      if (!spot) spot={x:a.x,y,halfWidth};
      labels.push(spot);
      c.fillStyle=colors[a.team];
      c.strokeText(a.name,spot.x,spot.y);
      c.fillText(a.name,spot.x,spot.y);
    }
  }
  if (!mini) {
    const canInspect=match.player.hp && match.phase==='active';
    const selected=canInspect && !match.relaySite(match.player) && match.nearbyWeapon(match.player);
    const labels=[];
    c.font='700 12px system-ui';
    c.textAlign='center';
    for (const drop of match.weaponDrops) {
      c.fillStyle='#17242a';
      c.fillRect(drop.x-11,drop.y-5,22,10);
      c.fillStyle=drop===selected ? '#ffe097' : '#cadbdd';
      c.fillRect(drop.x-8,drop.y-2,16,4);
      if (!canInspect || !match.weaponInReach(match.player,drop)) continue;
      const item=gear[drop.item];
      const text=`${item.name} · ${item.cost.toLocaleString()} CR`;
      const halfWidth=c.measureText(text).width/2+6;
      const x=Math.max(halfWidth,Math.min(width-halfWidth,drop.x));
      const baseline=drop.y<height-36 ? drop.y+22 : drop.y-15;
      let y=baseline;
      for (let offset=0;offset<=labels.length*2;offset++) {
        const candidate=baseline+Math.ceil(offset/2)*17*(offset%2 ? -1 : 1);
        if (candidate<14 || candidate>height-4 ||
            labels.some(label=>Math.abs(label.y-candidate)<17 && Math.abs(label.x-x)<label.halfWidth+halfWidth)) continue;
        y=candidate;
        break;
      }
      labels.push({x,y,halfWidth});
      c.fillStyle='#152124ef';
      c.fillRect(x-halfWidth,y-12,halfWidth*2,16);
      c.fillStyle=drop===selected ? '#ffe097' : '#ecf2f3';
      c.fillText(text,x,y);
    }
  }
  if (o.dropped) {
    c.fillStyle='#ffdd68';
    c.fillRect(o.dropped.x-5,o.dropped.y-5,10,10);
  }
  if (!mini && match.announcement.time>0) {
    const {label,time,flash}=match.announcement;
    if (flash>0 && !reducedMotion.matches) {
      c.fillStyle=`rgba(210, 20, 35, ${flash*.42})`;
      c.fillRect(0,0,width,height);
    }
    c.save();
    c.globalAlpha=Math.min(1,time*6);
    c.textAlign='center';
    c.font='900 62px system-ui';
    c.lineJoin='round';
    c.lineWidth=9;
    c.strokeStyle='#291218';
    c.fillStyle=label==='FIRST BLOOD' ? '#ff5e69' : '#ffe097';
    c.strokeText(label,width/2,height*.48);
    c.fillText(label,width/2,height*.48);
    c.restore();
  }
  const action=match.objectiveAction();
  if (!mini && action && match.phase==='active') {
    const x=Math.max(67,Math.min(width-67,action.actor.x));
    const y=action.actor.y<54 ? action.actor.y+44 : action.actor.y-45;
    c.fillStyle='#152124ef';
    c.fillRect(x-65,y-17,130,24);
    c.fillStyle='#ffe097';
    c.font='bold 14px system-ui';
    c.fillText(`${action.label} · ${action.remaining.toFixed(1)}s`,x,y);
  }
  if (!mini && pointer && match.player.hp && match.phase==='active') {
    c.strokeStyle='#fff'; c.lineWidth=1.5;
    circle(c,pointer.x,pointer.y,8); c.stroke();
    c.beginPath(); c.moveTo(pointer.x-12,pointer.y); c.lineTo(pointer.x+12,pointer.y);
    c.moveTo(pointer.x,pointer.y-12); c.lineTo(pointer.x,pointer.y+12); c.stroke();
    const feedback=match.feedback;
    if (feedback.marker>0) {
      c.strokeStyle='#ff464f';
      c.lineWidth=3;
      c.beginPath();
      c.moveTo(pointer.x-8,pointer.y-8); c.lineTo(pointer.x+8,pointer.y+8);
      c.moveTo(pointer.x+8,pointer.y-8); c.lineTo(pointer.x-8,pointer.y+8);
      c.stroke();
    }
    if (feedback.time>0) {
      const text=`−${feedback.damage} HP`;
      const x=Math.min(width-40,Math.max(40,pointer.x));
      const y=pointer.y<36 ? pointer.y+34 : pointer.y-21;
      c.font='bold 18px system-ui';
      c.lineWidth=4;
      c.strokeStyle='#1b1416';
      c.fillStyle='#ff9298';
      c.strokeText(text,x,y);
      c.fillText(text,x,y);
    }
  }
}
