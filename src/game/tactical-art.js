import { characterLook,uniformColor } from './character-look.js';

const size = 56;
const uniforms = [
  { cloth:'#756043', armor:'#403d33', helmet:'#9b7850', trim:'#dcab76' },
  { cloth:'#465d76', armor:'#29384e', helmet:'#577695', trim:'#8fbbda' },
];

function makeSprite(team, stride, brightness, pattern) {
  const sprite=document.createElement('canvas');
  sprite.width=sprite.height=size*2;
  const c=sprite.getContext('2d');
  c.setTransform(2,0,0,2,size,size);
  const uniform=uniforms[team];
  const accent=uniformColor(team,brightness);

  function shape(color,points,outline=false) {
    c.beginPath();
    c.moveTo(...points[0]);
    for (const point of points.slice(1)) c.lineTo(...point);
    c.closePath();
    c.fillStyle=color;
    c.fill();
    if (outline) {
      c.lineJoin='round';
      c.lineWidth=1.1;
      c.strokeStyle='#151b21';
      c.stroke();
    }
  }

  c.fillStyle='#130e1063';
  c.beginPath();
  c.ellipse(-1,2,14,13,0,0,Math.PI*2);
  c.fill();

  for (const side of [-1,1]) {
    const boot=-11+side*stride;
    shape('#293039',[[boot-5,side*8],[boot+4,side*8],[boot+4,side*3],[boot-5,side*3]],true);
    shape(uniform.cloth,[[-9,side*5],[-5,side*6],[-3,side*12],[1,side*14],
      [6,side*10],[3,side*7],[1,side*4]],true);
    shape(accent,[[-3,side*12],[1,side*14],[5,side*11],[4,side*8],[0,side*9]]);
  }
  shape(uniform.armor,[[-12,-7],[-8,-10],[3,-8],[6,-4],[5,7],[-6,10],[-12,7]],true);
  if (pattern===1) {c.fillStyle=accent;c.fillRect(-7,-6,2,12);}
  if (pattern===2) shape(accent,[[-9,-5],[-5,0],[-9,5],[-7,5],[-3,0],[-7,-5]]);
  if (pattern===3) {c.fillStyle=accent;for (const y of [-5,0,5]) c.fillRect(-7,y,2,2);}
  const marks=[
    [],[],[],[],
    [[-11,-6,5,2],[-8,-2,5,2],[-12,1,4,2],[-7,4,4,2]],
    [[-11,-6,8,2],[-11,-2,8,1],[-11,1,8,2],[-11,5,8,1]],
    [[-10,-6,2,2],[-6,-3,1,1],[-9,-1,2,4],[-10,0,4,2],[-6,5,2,2]],
    [[-12,-6,5,4],[-8,-2,5,3],[-12,1,6,2],[-7,3,4,3]],
    [[-11,-6,2,10],[-9,-4,3,2],[-8,-2,4,2],[-7,0,3,4],[-10,4,3,2]],
  ][pattern];
  if (!pattern) shape('#626866',[[-11,-6],[-7,-7],[-7,7],[-11,6]]);
  for (let i=0;i<marks.length;i++) {
    c.fillStyle=i%3===1 ? uniformColor(team,Math.max(0,brightness-30)) : accent;
    c.fillRect(...marks[i]);
  }
  if (!pattern) shape('#252a2e',[[-11,-5],[-8,-5],[-8,-2],[-11,-2]]);
  if (!pattern) shape('#252a2e',[[-11,1],[-8,1],[-8,4],[-11,4]]);
  shape('#c4d1d8',[[9,4],[14,3],[15,6],[11,8]],true);
  shape('#9ca9ad',[[12,2],[22,2],[22,4],[12,5]],true);
  shape('#77868d',[[6,2],[16,2],[16,7],[9,7],[6,6]],true);
  shape('#d2dbe0',[[9,2],[15,2],[15,3],[9,3]]);
  if (team===0) {
    shape(uniform.helmet,[[-5,-3],[-2,-7],[4,-7],[8,-4],[9,1],[7,5],[3,7],[-3,5]],true);
  } else {
    shape(uniform.helmet,[[-5,-4],[-2,-7],[5,-7],[9,-4],[9,4],[5,7],[-2,7],[-5,4]],true);
  }
  shape(uniform.trim,[[-2,-5],[4,-6],[7,-4],[5,-3],[-1,-3]]);
  shape('#18212a',[[6,-4],[8,-3],[9,0],[8,3],[6,4],[7,0]]);
  shape(accent,[[-4,-2],[-2,-2],[-2,2],[-4,2]]);
  return sprite;
}

const sprites=new Map();
const motion=new WeakMap();

export function paintTacticalCharacter(context, actor) {
  const previous=motion.get(actor);
  const moved=previous ? Math.hypot(actor.x-previous.x,actor.y-previous.y) : 0;
  const step=moved<45 ? (previous?.step || 0)+moved : 0;
  motion.set(actor,{x:actor.x,y:actor.y,step});
  const pose=moved>.15 && moved<45 ? 1+Math.floor(step/9)%2 : 0;
  context.rotate(actor.angle);
  const {brightness,pattern}=characterLook(actor.look);
  const key=`${actor.team}:${brightness}:${pattern}:${pose}`;
  if (!sprites.has(key)) {
    if (sprites.size>=180) sprites.delete(sprites.keys().next().value);
    sprites.set(key,makeSprite(actor.team,[0,3,-3][pose],brightness,pattern));
  }
  context.drawImage(sprites.get(key),-size/2,-size/2,size,size);
}
