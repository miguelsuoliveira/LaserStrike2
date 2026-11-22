import assert from 'node:assert/strict';
import { Match, gear } from '../src/game/match.js';
import { spawn, sites, clear, move, route } from '../src/game/arena.js';

const idle={dx:0,dy:0,x:0,y:0};
const make=(size=5,side=0)=>new Match(size,side,'Standard',()=>.2);
const advance=(m,seconds)=>m.step(seconds,idle);
const active=m=>advance(m,10);
const next=m=>advance(m,m.time);

for(let n=1;n<=10;n++) for(const side of [0,1]) {
  const m=make(n,side);
  assert.deepEqual(m.alive(),[n,n]);
  assert.equal(m.player.team,side);
  for (const a of m.actors) {
    assert.ok(clear(a.x,a.y));
    for (const s of sites) assert.ok(route(a,s).length);
  }
}
const wall={x:166,y:150};
move(wall,8,0);
assert.equal(wall.x,166);
assert.ok(!clear(-1,150));
assert.ok(route({x:spawn[0][0],y:360},sites[0]).length);

{
  const m=make(), p=m.player, ally=m.actors[1], rival=m.actors[5];
  assert.equal(m.buy(p,1),false);
  assert.equal(m.buy(p,0),false);
  p.credits=4000;
  assert.ok(m.buy(p,2));
  assert.equal(m.buy(p,1),false);
  assert.equal(p.credits,2000);
  active(m);
  assert.equal(m.time,120);
  assert.equal(m.buy(ally,1),false);
  m.hit(p,ally,40);
  assert.equal(ally.hp,100);
  m.hit(ally,rival,22);
  m.hit(p,rival,120);
  assert.equal(rival.hp,0);
  assert.equal(p.damage,78);
  assert.equal(p.kills,1);
  assert.equal(ally.assists,1);
  assert.equal(rival.deaths,1);
  rival.item=1;
  m.finish(0,'Test');
  assert.equal(p.credits,3500);
  assert.equal(rival.credits,1000);
  assert.equal(rival.item,0);
  next(m);
  assert.equal(p.item,2);
  assert.equal(p.ammo,gear[2].capacity);
  assert.equal(rival.hp,100);
  assert.ok(m.buy(p,3));
}
{
  const m=make(1);
  active(m);
  const o=m.objective;
  Object.assign(m.player,sites[0]);
  m.interact(m.player,1);
  assert.equal(o.progress,.5);
  m.interact(m.player,1);
  assert.equal(o.clock,30);
  const defender=m.actors[1];
  Object.assign(defender,sites[0]);
  m.interact(defender,3);
  assert.equal(m.winner,1);
  assert.equal(m.reason,'Relay disabled');
}
{
  const m=make(1);
  active(m);
  Object.assign(m.player,sites[1]);
  m.interact(m.player,2);
  advance(m,30);
  assert.equal(m.reason,'Relay transmitted');
}
{
  const m=make(1);
  active(m);
  advance(m,120);
  assert.equal(m.reason,'Time expired');
}
for(const draw of [false,true]) {
  const m=make(1,1), p=m.player;
  p.kills=3;
  for(let i=1;i<=(draw?16:9);i++) {
    active(m);
    m.finish(draw?Number(i%2===0):0,'Test');
    if(i===8) {
      assert.equal(m.phase,'halftime');
      assert.deepEqual(m.score,draw?[4,4]:[8,0]);
      next(m);
      assert.equal(m.round,9);
      assert.equal(m.attack,1);
      assert.equal(p.team,1);
      assert.equal(p.kills,3);
      assert.deepEqual(m.score,draw?[4,4]:[8,0]);
    } else if(m.phase!=='results') next(m);
  }
  assert.equal(m.phase,'results');
  assert.deepEqual(m.score,draw?[8,8]:[9,0]);
}

console.log('AK-Strike rules passed for both teams and all ten match sizes.');
