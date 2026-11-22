import { spawn, sites, move, distance, wallDistance, visible, route } from './arena.js';

export const gear = [
  ['Spark',0,22,9,.36,315,'Reliable short-range pulse'],
  ['Ripple',1000,16,16,.22,320,'Fast bursts, lighter hits'],
  ['Prism',2000,34,6,.54,410,'Long-range, deliberate pulses'],
  ['Vortex',3000,23,15,.27,365,'Steady pressure at midrange'],
  ['Nova',4000,30,12,.32,405,'Heavy, versatile pulses'],
].map(([name,cost,damage,capacity,interval,range,description]) => ({name,cost,damage,capacity,interval,range,description}));

const difficulty = { Relaxed:[.72,.36,102,1.8], Standard:[.48,.23,125,2.4], Expert:[.3,.15,146,3.1] };
const patrols = [
  [{x:250,y:355},{x:330,y:86},{x:556,y:133},{x:720,y:350},{x:550,y:594},{x:325,y:642}],
  [{x:1086,y:369},{x:980,y:120},{x:832,y:223},{x:735,y:353},{x:815,y:501},{x:1000,y:592}],
];
const streakNames = {2:'DOUBLE KILL',3:'RAMPAGE',5:'ABSOLUTE GODLIKE'};
const pickupRange = 38, lootSearchRange = 130;
const plantTime = 2, defuseTime = 3;
const angleDelta = (from,to) => Math.atan2(Math.sin(to-from),Math.cos(to-from));
const names = ['Iris','Atlas','Mica','Aster','Vale','Dune','Cove','Echo','Sol','Reef'];

export class Match {
  constructor(size, side, level, random = Math.random) {
    this.random = random;
    this.level = level;
    this.score = [0,0];
    this.round = 1;
    this.traces = [];
    this.actors = Array.from({length:2*size}, (_,i) => ({
      team:Number(i>=size), slot:i%size, name:names[(i+(i>=size?3:0))%10],
      credits:0, item:0, kills:0, deaths:0, assists:0, damage:0, hp:100,
    }));
    this.player = this.actors[side*size];
    this.player.name = 'You';
    this.begin();
  }

  begin() {
    this.attack = Number(this.round > 8);
    this.phase = 'buy';
    this.time = 10;
    this.traces.length = 0;
    this.weaponDrops = [];
    this.feedback = { damage:0, time:0, marker:0 };
    this.roundEliminations = 0;
    this.playerRoundEliminations = 0;
    this.announcement = {label:'',time:0,flash:0};
    this.objective = { site:null, carrier:null, dropped:null, progress:0, actor:null, clock:0 };
    this.target = sites[Math.floor(this.random()*sites.length)];
    for (const a of this.actors) {
      const [x,y] = spawn[Number(a.team !== this.attack)];
      Object.assign(a, {
        x:x+(a.slot%2)*31, y:y+Math.floor(a.slot/2)*30-60, hp:100,
        bought:false, ammo:gear[a.item].capacity, reload:0, cooldown:0,
        angle:a.team===this.attack?0:Math.PI, speed:0, path:[], plan:0, reaction:0,
        enemy:null, hits:new Map(), patrol:a.slot%patrols[0].length, patrolStep:a.slot%2 ? -1 : 1,
      });
      if (a !== this.player) {
        const options = gear.map((_,i)=>i).filter(i=>i>a.item && gear[i].cost<=a.credits);
        if (options.length) this.buy(a, options.at(-1));
      }
    }
    const attackers = this.actors.filter(a=>a.team===this.attack);
    this.objective.carrier = attackers[Math.floor(this.random()*attackers.length)];
  }

  buy(actor, item) {
    if (!gear[item] || this.phase !== 'buy' || !actor.hp || actor.bought ||
      actor.item === item || actor.credits < gear[item].cost) return false;
    actor.credits -= gear[item].cost;
    actor.item = item;
    actor.ammo = gear[item].capacity;
    actor.bought = true;
    if (actor===this.player) this.onSound?.('buy');
    return true;
  }

  finish(team, reason) {
    if (this.phase !== 'active') return;
    this.score[team]++;
    this.reason = reason;
    this.winner = team;
    this.onSound?.(reason==='Relay disabled' ? 'defuse' : 'round');
    for (const a of this.actors) {
      a.credits += a.team === team ? 1500 : 1000;
      if (!a.hp) a.item = 0;
    }
    if (this.score[team] === 9 || this.round === 16) {
      this.phase = 'results';
      this.time = 0;
    } else {
      this.phase = this.round === 8 ? 'halftime' : 'result';
      this.time = this.round === 8 ? 5 : 3;
    }
  }

  hit(from, target, damage) {
    if (from.team === target.team || !target.hp) return;
    const dealt = Math.min(target.hp, damage);
    target.hp -= dealt;
    if (target===this.player) this.onSound?.('hurt');
    from.damage += dealt;
    if (from===this.player) {
      this.onSound?.(target.hp ? 'hit' : 'eliminate');
      this.feedback.damage = (this.feedback.time>0 ? this.feedback.damage : 0) + dealt;
      this.feedback.time = 1.4;
      this.feedback.marker = .18;
    }
    target.hits.set(from, (target.hits.get(from) || 0) + dealt);
    if (target.hp) return;
    this.weaponDrops.push(this.droppedWeapon(target));
    target.deaths++;
    from.kills++;
    this.roundEliminations++;
    if (from===this.player) {
      this.playerRoundEliminations++;
      const firstBlood = this.roundEliminations===1;
      const label = firstBlood ? 'FIRST BLOOD' : streakNames[this.playerRoundEliminations];
      if (label) {
        this.announcement.label = label;
        this.announcement.time = firstBlood ? 1 : 1.4;
        if (firstBlood) this.announcement.flash = 1;
      }
    }
    for (const [helper, amount] of target.hits) {
      if (helper !== from && amount >= 20) helper.assists++;
    }
    if (this.objective.carrier === target) {
      this.objective.carrier = null;
      this.objective.dropped = {x:target.x,y:target.y};
    }
  }

  reload(a) {
    if (!a.reload && a.ammo < gear[a.item].capacity) {
      a.reload = 1.1;
      if (a===this.player) this.onSound?.('reload');
    }
  }

  fire(a, angle) {
    if (a.cooldown || a.reload) return;
    if (!a.ammo) return this.reload(a);
    const item = gear[a.item];
    a.ammo--;
    const bot = a!==this.player;
    this.onSound?.('shot',{bot,volume:bot ? Math.max(0,.55-distance(a,this.player)/1100) : 1});
    a.cooldown = item.interval;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let limit = wallDistance(a.x,a.y,dx,dy,item.range), target;
    for (const b of this.actors) {
      if (b===a || !b.hp || a.team===b.team) continue;
      const x=b.x-a.x,y=b.y-a.y, along=x*dx+y*dy, cross=x*dy-y*dx;
      if (along < 0 || Math.abs(cross) > 13) continue;
      const contact = Math.max(0,along-Math.sqrt(169-cross*cross));
      if (contact < limit) { limit = contact; target = b; }
    }
    this.traces.push({x:a.x,y:a.y,bx:a.x+dx*limit,by:a.y+dy*limit,team:a.team,life:.12});
    if (target) this.hit(a,target,item.damage);
  }

  droppedWeapon(actor) {
    return {x:actor.x,y:actor.y,item:actor.item,ammo:actor.ammo};
  }

  nearbyWeapon(actor, range=pickupRange, upgradesOnly=false) {
    let closest=null, nearest=range;
    for (const drop of this.weaponDrops) {
      if (upgradesOnly && gear[drop.item].cost<=gear[actor.item].cost) continue;
      const gap=distance(actor,drop);
      if (gap>=nearest || !visible(actor,drop)) continue;
      closest=drop;
      nearest=gap;
    }
    return closest;
  }

  weaponInReach(actor,drop) {
    return distance(actor,drop)<pickupRange && visible(actor,drop);
  }

  pickUpWeapon(actor, drop=this.nearbyWeapon(actor)) {
    if (!drop || this.phase!=='active' || !actor.hp ||
        !this.weaponInReach(actor,drop)) return false;
    const index=this.weaponDrops.indexOf(drop);
    if (index<0) return false;
    this.weaponDrops[index]=this.droppedWeapon(actor);
    actor.item=drop.item;
    actor.ammo=drop.ammo;
    actor.reload=0;
    if (actor===this.player) this.onSound?.('buy');
    return true;
  }

  relaySite(actor) {
    const {site,carrier}=this.objective;
    if (site) return actor.team!==this.attack && distance(actor,site)<55 ? site : null;
    return carrier===actor ? sites.find(zone=>distance(actor,zone)<55) : null;
  }

  objectiveAction() {
    const { actor, site, progress } = this.objective;
    if (!actor?.hp) return null;
    const duration = site ? defuseTime : plantTime;
    return { actor, label:site ? 'Defusing' : 'Planting', remaining:duration*(1-progress) };
  }

  interact(a, dt) {
    const o = this.objective;
    if (o.actor && o.actor!==a) return;
    const activating = !o.site && o.carrier===a;
    const location = this.relaySite(a);
    if (!location) return;
    o.engaged = true;
    o.actor = a;
    o.progress += dt / (activating ? plantTime : defuseTime);
    if (o.progress < 1) return;
    o.progress = 0;
    o.actor = null;
    if (activating) {
      o.site = location;
      o.clock = 30;
      this.onSound?.('plant');
      o.carrier = null;
    } else this.finish(a.team,'Relay disabled');
  }

  bot(a, dt) {
    const [delay,spread,speed,turnRate] = difficulty[this.level];
    const o = this.objective;
    const carrying = o.carrier===a;
    const defending = a.team!==this.attack;
    const urgent = carrying ? this.target : defending ? o.site : o.dropped;
    const stops = patrols[Number(defending)];
    if (!urgent && distance(a,stops[a.patrol])<20) {
      a.patrol = (a.patrol+a.patrolStep+stops.length)%stops.length;
      a.plan = 0;
    }
    const canReach = (from,to) => distance(from,to)<gear[from.item].range;
    a.plan -= dt;
    if (a.plan <= 0) {
      a.plan = .34 + this.random()*.24;
      const threat = this.actors.filter(b=>b.hp && b.team!==a.team && (canReach(a,b) || canReach(b,a)) && visible(a,b))
        .sort((left,right)=>distance(a,left)-distance(a,right))[0];
      if (threat!==a.enemy) a.reaction = delay + this.random()*.22;
      a.enemy = threat;
      const approach = threat && !canReach(a,threat) && canReach(threat,a);
      const loot = !threat && !urgent && this.nearbyWeapon(a,lootSearchRange,true);
      a.path = route(a,approach ? threat : urgent || loot || stops[a.patrol]);
    }

    while (a.path.length && distance(a,a.path[0])<5) a.path.shift();
    const point = a.path[0];
    const threat = a.enemy?.hp && visible(a,a.enemy) ? a.enemy : null;
    const inRange = threat && canReach(a,threat);
    const look = threat || point;
    if (look) {
      const desired = Math.atan2(look.y-a.y,look.x-a.x);
      const maxTurn = turnRate*dt;
      a.angle += Math.max(-maxTurn,Math.min(maxTurn,angleDelta(a.angle,desired)));
      if (inRange && a.reaction<=0 && Math.abs(angleDelta(a.angle,desired))<.32) {
        this.fire(a,a.angle+(this.random()*2-1)*spread);
      }
    }
    if ((carrying && sites.some(site=>distance(a,site)<43)) ||
        (defending && o.site && distance(a,o.site)<44)) {
      this.interact(a,dt);
      return;
    }
    const upgrade=this.nearbyWeapon(a,pickupRange,true);
    if (upgrade && this.pickUpWeapon(a,upgrade)) a.plan=0;
    if (!point) return;
    const angle = Math.atan2(point.y-a.y,point.x-a.x);
    const step = Math.min(distance(a,point),dt*speed*(inRange ? .65 : 1));
    move(a,Math.cos(angle)*step,Math.sin(angle)*step);
  }

  step(dt, command) {
    this.announcement.time = Math.max(0,this.announcement.time-dt);
    this.announcement.flash = Math.max(0,this.announcement.flash-dt);
    if (this.phase==='results') return;
    this.time = Math.max(0,this.time-dt);
    if (this.phase!=='active') {
      if (!this.time) {
        if (this.phase==='buy') {
          this.phase='active';
          this.time=120;
          this.onSound?.('bell');
        } else { this.round++; this.begin(); }
      }
      return;
    }
    const o = this.objective;
    this.feedback.time = Math.max(0,this.feedback.time-dt);
    this.feedback.marker = Math.max(0,this.feedback.marker-dt);
    o.engaged = false;
    for (const trace of this.traces) trace.life -= dt;
    this.traces = this.traces.filter(trace=>trace.life>0);
    for (const a of this.actors) {
      if (!a.hp || this.phase!=='active') continue;
      a.cooldown = Math.max(0,a.cooldown-dt);
      a.reaction -= dt;
      if (a.reload) {
        a.reload = Math.max(0,a.reload-dt);
        if (!a.reload) a.ammo = gear[a.item].capacity;
      }
      if (a===this.player) {
        const length = Math.hypot(command.dx,command.dy)||1;
        a.speed += ((length && (command.dx||command.dy) ? 175 : 0)-a.speed)*Math.min(1,dt*16);
        move(a,command.dx/length*a.speed*dt,command.dy/length*a.speed*dt);
        a.angle = Math.atan2(command.y-a.y,command.x-a.x);
        if (command.reload) this.reload(a);
        if (command.fire) this.fire(a,a.angle);
        if (command.use && this.relaySite(a)) this.interact(a,dt);
        else if (command.pickup) this.pickUpWeapon(a);
      } else this.bot(a,dt);
      if (o.dropped && a.team===this.attack && distance(a,o.dropped)<25) {
        o.carrier = a;
        o.dropped = null;
      }
    }
    if (!o.engaged) { o.actor = null; o.progress = 0; }
    if (o.site) {
      o.clock = Math.max(0,o.clock-dt);
      if (!o.clock) this.finish(this.attack,'Relay transmitted');
    } else if (!this.time) this.finish(1-this.attack,'Time expired');
    const alive = this.alive();
    if (!alive[1-this.attack]) this.finish(this.attack,'Opposing team eliminated');
    if (!alive[this.attack] && !o.site) this.finish(1-this.attack,'Opposing team eliminated');
  }

  alive() {
    return this.actors.reduce((count,a)=>{ if (a.hp) count[a.team]++; return count; },[0,0]);
  }

  winningRoster() {
    if (this.phase!=='results' || this.score[0]===this.score[1]) return [];
    return this.actors.filter(actor=>actor.team===this.winner)
      .sort((a,b)=>b.damage-a.damage || b.kills-a.kills || a.slot-b.slot);
  }

  standings() {
    return [...this.actors].sort((a,b)=>b.kills-a.kills || b.damage-a.damage || a.deaths-b.deaths);
  }
}
