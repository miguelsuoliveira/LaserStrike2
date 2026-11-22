import { width,height,walls,sites,spawn,colors } from './arena.js';

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

const circle = (c,x,y,r)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);};
export function paint(c, match, pointer, mini=false) {
  c.setTransform(c.canvas.width/width,0,0,c.canvas.height/height,0,0);
  c.drawImage(backdrop,0,0);
  const o=match?.objective;
  for (const site of sites) {
    const armed=o?.site===site;
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
    c.lineWidth=3; c.beginPath(); c.moveTo(trace.x,trace.y); c.lineTo(trace.bx,trace.by); c.stroke();
  }
  c.globalAlpha=1;
  for (const a of match.actors) {
    if (!a.hp) continue;
    c.save(); c.translate(a.x,a.y);
    if (mini) {
      c.fillStyle=colors[a.team]; circle(c,0,0,a===match.player?19:12); c.fill();
      c.restore(); continue;
    }
    c.rotate(a.angle);
    c.fillStyle='#222b33'; circle(c,2,3,14); c.fill();
    c.fillStyle=colors[a.team];
    if (a.team===0) {circle(c,0,0,12); c.fill();}
    else c.fillRect(-10,-10,20,20);
    c.fillStyle='#26313e'; c.fillRect(-2,-7,8,14);
    c.fillStyle='#e6f9ff'; c.fillRect(5,-3,15,6);
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
  if (o.dropped) {
    c.fillStyle='#ffdd68';
    c.fillRect(o.dropped.x-5,o.dropped.y-5,10,10);
  }
  if (!mini && pointer && match.phase==='active') {
    c.strokeStyle='#fff'; c.lineWidth=1.5;
    circle(c,pointer.x,pointer.y,8); c.stroke();
    c.beginPath(); c.moveTo(pointer.x-12,pointer.y); c.lineTo(pointer.x+12,pointer.y);
    c.moveTo(pointer.x,pointer.y-12); c.lineTo(pointer.x,pointer.y+12); c.stroke();
  }
}
