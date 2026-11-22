import { width,height,walls } from './arena.js';

export const graphicsPresets = {
  low:{label:'Low',scale:1},
  medium:{label:'Medium',scale:1.25},
  high:{label:'High',scale:1.5},
};

const layers=new Map();

export function arenaDetail(quality) {
  if (quality==='low') return null;
  if (layers.has(quality)) return layers.get(quality);
  const {scale}=graphicsPresets[quality];
  const high=quality==='high';
  const layer=document.createElement('canvas');
  layer.width=width*scale;
  layer.height=height*scale;
  const c=layer.getContext('2d');
  c.scale(scale,scale);

  c.fillStyle='#ffe7ab19';
  for (let y=0;y<height;y+=24) {
    for (let x=0;x<width;x+=32) {
      c.fillRect(x+2,y+1,28,1);
      if (high) {
        c.fillRect(x+(x*3+y)%23,y+6+(x+y)%13,2,1);
        c.fillRect(x+20,y+4+(x*3+y)%15,1,2);
      }
    }
  }

  for (const [x,y,w,h] of walls) {
    c.fillStyle=high?'#17161966':'#24202055';
    c.beginPath();
    c.moveTo(x+w,y+3);
    c.lineTo(x+w+(high?27:14),y+14);
    c.lineTo(x+w+(high?27:14),y+h+(high?24:13));
    c.lineTo(x+13,y+h+(high?24:13));
    c.lineTo(x,y+h);
    c.lineTo(x+w,y+h);
    c.closePath();
    c.fill();
  }
  for (const [x,y,w,h] of walls) {
    c.fillStyle='#332826';
    c.fillRect(x,y+h,w,5);
    c.fillRect(x+w,y+4,4,h);
    c.fillStyle='#ffd2a051';
    c.fillRect(x+5,y+3,w-10,2);
    if (high) {
      c.fillStyle='#2b222449';
      for (let seam=y+16;seam<y+h-10;seam+=13) c.fillRect(x+6,seam,w-12,1);
      c.fillStyle='#f4b9824f';
      c.fillRect(x+5,y+h-7,w-10,1);
      for (let i=x+15;i<x+w-13;i+=36) {
        c.fillStyle='#2d272c';
        c.fillRect(i,y+8,14,6);
        c.fillStyle='#c9946b';
        c.fillRect(i+2,y+8,10,1);
        c.fillStyle='#edb273';
        c.fillRect(i+5,y+10,4,2);
      }
    }
  }

  if (high) {
    const light=c.createRadialGradient(width*.46,height*.35,110,width*.46,height*.35,710);
    light.addColorStop(0,'#ffc77825');
    light.addColorStop(.55,'#ffcc7709');
    light.addColorStop(1,'#15182c78');
    c.fillStyle=light;
    c.fillRect(0,0,width,height);
  }
  layers.set(quality,layer);
  return layer;
}
