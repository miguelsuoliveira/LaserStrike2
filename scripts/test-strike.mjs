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
  assert.deepEqual(m.objectiveAction(),{actor:m.player,label:'Planting',remaining:1});
  m.interact(m.player,1);
  assert.equal(o.clock,30);
  const defender=m.actors[1];
  Object.assign(defender,sites[0]);
  m.interact(defender,1);
  const defuse=m.objectiveAction();
  assert.equal(defuse.actor,defender);
  assert.equal(defuse.label,'Defusing');
  assert.ok(Math.abs(defuse.remaining-2)<1e-8);
  m.interact(defender,2);
  assert.equal(m.objectiveAction(),null);
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
  assert.equal(m.winningRoster().length,draw ? 0 : 1);
}

{
  const m=make(1);
  active(m);
  const p=m.player, bot=m.actors[1];
  Object.assign(p,{x:200,y:350});
  Object.assign(bot,{x:260,y:350});
  m.fire(p,0);
  assert.equal(m.feedback.damage,22);
  assert.ok(m.feedback.marker>0);
  p.cooldown=0;
  m.fire(p,0);
  assert.equal(m.feedback.damage,44);
  assert.equal(bot.hp,56);
  for (let i=0;i<90;i++) advance(m,1/60);
  assert.equal(m.feedback.marker,0);
  assert.equal(m.feedback.time,0);
}
{
  const m=make(1);
  const bot=m.actors[1];
  const start={x:bot.x,y:bot.y};
  const facing=bot.angle;
  m.bot(bot,1/60);
  assert.ok(Math.abs(bot.angle-facing)<=2.4/60+1e-8);
  const firstStop=bot.patrol;
  for (let i=0;i<300;i++) m.bot(bot,1/60);
  assert.ok(Math.hypot(bot.x-start.x,bot.y-start.y)>40);
  assert.notEqual(bot.patrol,firstStop);
  Object.assign(bot,{x:200,y:350,angle:0,plan:1,reaction:0,enemy:m.player});
  Object.assign(m.player,{x:325,y:350});
  let angle;
  m.fire=(_actor, shotAngle)=>{angle=shotAngle;};
  m.bot(bot,1/60);
  assert.notEqual(angle,undefined);
  assert.ok(Math.abs(angle)>.1);
}

for (const opponentIsBot of [false,true]) {
  const m=make(2);
  const opponent=m.actors[Number(opponentIsBot)], bot=m.actors[2];
  m.actors[1-Number(opponentIsBot)].hp=0;
  Object.assign(opponent,{x:50,y:50,item:2});
  Object.assign(bot,{x:50,y:400,item:0});
  const oldY=bot.y;
  for (let i=0;i<24;i++) m.bot(bot,1/60);
  assert.equal(bot.enemy,opponent);
  assert.ok(bot.y<oldY-25);
  assert.equal(bot.ammo,gear[0].capacity);
}

{
  const m=make(6);
  const p=m.player;
  const rivals=m.actors.slice(6);
  m.hit(p,rivals[0],100);
  assert.deepEqual(m.announcement,{label:'FIRST BLOOD',time:1,flash:1});
  m.hit(p,rivals[1],100);
  assert.equal(m.announcement.label,'DOUBLE KILL');
  m.hit(p,rivals[2],100);
  assert.equal(m.announcement.label,'RAMPAGE');
  advance(m,1.4);
  assert.equal(m.announcement.time,0);
  assert.equal(m.announcement.flash,0);
  m.hit(p,rivals[3],100);
  assert.equal(m.announcement.time,0);
  m.hit(p,rivals[4],100);
  assert.equal(m.announcement.label,'ABSOLUTE GODLIKE');
  m.begin();
  m.hit(rivals[0],m.actors[1],100);
  m.hit(p,rivals[0],100);
  assert.equal(m.announcement.time,0);
  m.hit(p,rivals[1],100);
  assert.equal(m.announcement.label,'DOUBLE KILL');
}

{
  const m=make(1);
  const cues=[];
  m.onSound=name=>cues.push(name);
  active(m);
  Object.assign(m.player,{x:200,y:350});
  Object.assign(m.actors[1],{x:325,y:350});
  m.fire(m.player,0);
  m.reload(m.player);
  m.hit(m.player,m.actors[1],100);
  assert.deepEqual(cues,['shot','hit','reload','eliminate']);
}

for(let n=1;n<=10;n++) {
  const m=make(n);
  assert.deepEqual(m.winningRoster(),[]);
  for (let i=0;i<n;i++) {
    m.actors[n+i].damage=i*50;
    m.actors[i].damage=10000;
  }
  m.score=[3,8];
  active(m);
  m.finish(1,'Test');
  const lineup=m.winningRoster();
  assert.equal(lineup.length,n);
  assert.ok(lineup.every(a=>a.team===1));
  assert.deepEqual(lineup.map(a=>a.damage),Array.from({length:n},(_,i)=>(n-1-i)*50));
}

{
  const m=make(2);
  active(m);
  const p=m.player, ally=m.actors[1], rival=m.actors[2];
  Object.assign(rival,{x:233,y:350,item:2,ammo:3});
  Object.assign(p,{x:200,y:350,ammo:4});
  m.hit(p,rival,100);
  assert.deepEqual(m.weaponDrops,[{x:233,y:350,item:2,ammo:3}]);
  const drop=m.nearbyWeapon(p);
  assert.ok(m.pickUpWeapon(p,drop));
  assert.deepEqual(m.weaponDrops,[{x:200,y:350,item:0,ammo:4}]);
  assert.equal(p.item,2);
  assert.equal(p.ammo,3);
  assert.equal(p.credits,0);
  assert.equal(m.pickUpWeapon(p,drop),false);
  Object.assign(ally,{x:205,y:350});
  m.hit(m.actors[3],p,100);
  m.bot(ally,1/60);
  assert.equal(ally.item,2);
  assert.equal(ally.ammo,3);
  assert.equal(m.weaponDrops.length,2);
  m.begin();
  assert.equal(m.weaponDrops.length,0);
}
{
  const m=make(1);
  active(m);
  Object.assign(m.player,{x:168,y:150});
  m.weaponDrops.push({x:188,y:150,item:4,ammo:9});
  assert.equal(m.nearbyWeapon(m.player),null);
  assert.equal(m.pickUpWeapon(m.player,m.weaponDrops[0]),false);
}

console.log('Laser Strike 2 rules passed for both teams and all ten match sizes.');
