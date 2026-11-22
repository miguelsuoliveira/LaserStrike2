export const width = 1200, height = 720, radius = 13;
export const sides = ['Liberals', 'Counter Liberals'];
export const colors = ['#ffa465', '#6db6ff'];
export const sites = [{ x: 894, y: 147, name: 'A' }, { x: 894, y: 569, name: 'B' }];
export const walls = [
  [180,115,180,115], [180,490,180,115], [405,0,130,105], [405,615,130,105],
  [385,270,130,180], [600,165,105,115], [600,440,105,115], [557,326,90,68],
  [770,0,300,65], [770,655,300,65], [800,280,180,160], [1020,196,180,65],
  [1020,459,180,65], [740,115,47,52], [740,553,47,52],
];
export const spawn = [[64, 360], [1082, 360]];
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function clear(x, y, r = radius) {
  return x >= r && x <= width-r && y >= r && y <= height-r &&
    walls.every(([a,b,w,h]) => x+r <= a || x-r >= a+w || y+r <= b || y-r >= b+h);
}

export function move(actor, dx, dy) {
  if (clear(actor.x + dx, actor.y)) actor.x += dx;
  if (clear(actor.x, actor.y + dy)) actor.y += dy;
}

export function wallDistance(x,y,dx,dy,max) {
  let limit = max;
  for (const [a,b,w,h] of walls) {
    if ((!dx && (x < a || x > a+w)) || (!dy && (y < b || y > b+h))) continue;
    const tx = dx ? [(a-x)/dx, (a+w-x)/dx] : [-Infinity,Infinity];
    const ty = dy ? [(b-y)/dy, (b+h-y)/dy] : [-Infinity,Infinity];
    const start = Math.max(Math.min(...tx), Math.min(...ty), 0);
    if (start <= Math.min(Math.max(...tx), Math.max(...ty))) limit = Math.min(limit,start);
  }
  return limit;
}

export function visible(a,b) {
  const d = distance(a,b);
  return !d || wallDistance(a.x,a.y,(b.x-a.x)/d,(b.y-a.y)/d,d+1) > d;
}

const step = 24;
const columns = width / step, rows = height / step;
const nodes = Array.from({length:columns*rows}, (_,i) => ({ x: i%columns*step+12, y: Math.floor(i/columns)*step+12 }));
const neighbors = nodes.map((node,i) => {
  if (!clear(node.x,node.y,radius+2)) return [];
  return [i%columns ? i-1 : -1, i%columns < columns-1 ? i+1 : -1, i-columns,i+columns]
    .filter(j => nodes[j] && clear(nodes[j].x,nodes[j].y,radius+2));
});
function nearest(point) {
  let best = Infinity, index = -1;
  for (let i=0;i<nodes.length;i++) {
    if (!neighbors[i].length) continue;
    const d = distance(point,nodes[i]);
    if (d >= best || !visible(point,nodes[i])) continue;
    best = d;
    index = i;
  }
  return index;
}
export function route(from,to) {
  const start = nearest(from), end = nearest(to);
  if (start < 0 || end < 0) return [];
  const prev = new Int16Array(nodes.length).fill(-1);
  const queue = [start];
  prev[start] = start;
  for (let i=0;i<queue.length && prev[end]<0;i++) {
    for (const j of neighbors[queue[i]]) {
      if (prev[j]>=0) continue;
      prev[j] = queue[i];
      queue.push(j);
    }
  }
  if (prev[end] < 0) return [];
  const path = [to];
  for (let i=end;i!==start;i=prev[i]) path.push(nodes[i]);
  path.push(nodes[start]);
  return path.reverse();
}
