import { randomBytes, randomInt } from 'node:crypto';
import { lanAddress,lanPort } from './lib/lan-network.mjs';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { serveOnline } from './lib/serve-online.mjs';

const compress=promisify(gzip);
const internetMode=process.argv.includes('--online');
const port=internetMode ? Number(process.env.PORT || 8080) : lanPort;
const publicOrigin=internetMode ? new URL(process.env.ONLINE_ORIGIN || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).origin : null;
import { characterLook } from '../src/game/character-look.js';
import { Match,defaultRounds,roundOptions } from '../src/game/match.js';

const rooms = new Map();
const disconnectAfter=12000, closedRoomLifetime=30000;
const levels = ['Relaxed','Standard','Expert'];
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
const code = () => String(randomInt(100000,1000000));
const inLan = ip => /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.)/.test(ip.replace(/^::ffff:/,'')) || ip==='::1';
const safeNumber = (value,min,max) => Number.isFinite(value) ? Math.min(max,Math.max(min,value)) : 0;
const actionFields = ['fire','reload','use','pickup'];
function command(raw) {
  return {
    dx:safeNumber(raw?.dx,-1,1),dy:safeNumber(raw?.dy,-1,1),
    x:safeNumber(raw?.x,0,1200),y:safeNumber(raw?.y,0,720),
    ...Object.fromEntries(actionFields.map(key=>[key,raw?.[key]===true])),
  };
}

const cleanName=name=>typeof name==='string' ? name.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,24) : '';

function join(room, name, look) {
  const displayName=cleanName(name);
  const seats=[...room.clients.values()].flatMap(peer=>peer.seats);
  const shortTeam=Number(seats.filter(seat=>seat.team===1).length<seats.filter(seat=>seat.team===0).length);
  const token=randomBytes(24).toString('hex');
  const playerName=displayName || 'Player '+room.nextName;
  room.nextName++;
  const client={token,epoch:0,seen:Date.now(),commands:[],seats:[{name:playerName,team:shortTeam,look:characterLook(look)}]};
  room.clients.set(token,client);
  return client;
}

function removeClient(room, client, now=Date.now(), accidental=false) {
  const wasHost=room.hostToken===client.token;
  const replace=internetMode && accidental && room.match && room.match.phase!=='results';
  if (replace) {
    const actor=room.match.actors[client.seats[0].slot];
    const {kills,deaths,assists,damage}=actor;
    room.detached.set(client.token,{client,until:now+90000,stats:{kills,deaths,assists,damage}});
  }
  room.clients.delete(client.token);
  if (wasHost && !replace) {
    room.endedAt=now;
    return;
  }
  const {name,slot}=client.seats[0];
  room.notices.push({id:++room.noticeId,message:name+' has left the game'});
  if (room.notices.length>20) room.notices.shift();
  if (room.match) {
    const actor=room.match.actors[slot];
    room.match.humans.delete(actor);
    room.match.checkReady();
    actor.name='Bot '+(actor.slot+1);
  }
}

function start(room) {
  room.pausedBy=null;
  room.detached.clear();
  room.history=[];
  const seats=[...room.clients.values()].flatMap(client=>client.seats);
  const counts=[0,0];
  for (const seat of seats) seat.slot=seat.team*room.size+counts[seat.team]++;
  room.match=new Match(room.size,seats[0].team,room.level,Math.random,seats.map(seat=>seat.slot),room.rounds);
  for (const seat of seats) Object.assign(room.match.actors[seat.slot],{name:seat.name,look:seat.look});
  room.sounds=[];
  for (const client of room.clients.values()) client.shots=[];
  room.match.onNetworkSound=(name,actor)=>{
    room.sounds.push({id:++room.soundId,name,actor:actor ? room.match.actors.indexOf(actor) : -1,x:actor?.x,y:actor?.y,at:Date.now()});
    if (room.sounds.length>48) room.sounds.shift();
  };
  room.clock=performance.now();
}

function snapshot(room, client) {
  const clients=[...room.clients.values()];
  const base={code:room.code,serial:++room.serial,epoch:client.epoch,host:room.hostToken===client.token,size:room.size,rounds:room.rounds,level:room.level,
    requests:room.hostToken===client.token ? [...room.requests.values()].filter(request=>!request.outcome && !request.client).map(({id,name})=>({id,name})) : [],
    team:client.seats[0].team,look:client.seats[0].look,pausedBy:room.pausedBy,notices:room.notices,
    players:clients.flatMap(peer=>peer.seats.map(seat=>({name:seat.name,team:seat.team,look:seat.look}))),
    seats:client.seats.map(seat=>seat.slot),match:null};
  const m=room.match;
  if (!m) return base;
  const actorIndex = actor => actor ? m.actors.indexOf(actor) : -1;
  const o=m.objective;
  const slot=client.seats[0].slot;
  base.sounds=room.sounds.filter(sound=>Date.now()-sound.at<650 && (sound.name==='shot' || sound.actor<0 || sound.actor===slot));
  base.ready=[...m.humans].filter(actor=>actor.ready).length;
  base.isReady=m.actors[slot].ready;
  base.shotAck=client.shotAck || 0;
  base.match={serverTime:internetMode ? performance.now() : undefined,phase:m.phase,time:m.time,round:m.round,roundLimit:m.roundLimit,readyCountdown:m.readyCountdown,feedback:m.actors[slot].feedback,score:m.score,attack:m.attack,winner:m.winner,reason:m.reason,
    actors:m.actors.map(({x,y,hp,angle,name,team,slot,ammo,item,credits,reload,bought,kills,deaths,assists,damage,look})=>
      ({x:internetMode?Math.round(x*4)/4:x,y:internetMode?Math.round(y*4)/4:y,hp,
        angle:internetMode?Math.round(angle*1000)/1000:angle,name,team,slot,ammo,item,credits,reload,bought,kills,deaths,assists,damage,look})),
    traces:m.traces, weaponDrops:m.weaponDrops,
    objective:{site:o.site,carrier:actorIndex(o.carrier),actor:actorIndex(o.actor),dropped:o.dropped,progress:o.progress,clock:o.clock}};
  return base;
}

function api(path, data) {
  if (path==='info') {
    const address=internetMode ? null : lanAddress();
    return {available:true,internetMode,inviteBase:internetMode ? publicOrigin+'/lan.html' : address ? `http://${address}:${lanPort}/lan.html` : null};
  }
  if (path==='create') {
    if (rooms.size>=40) fail('The LAN server is full. Try again in a moment.',503);
    let id=code();
    while (rooms.has(id)) id=code();
    const room={code:id,size:5,rounds:defaultRounds,level:'Standard',nextName:1,clients:new Map(),requests:new Map(),detached:new Map(),notices:[],noticeId:0,soundId:0,serial:0,pausedBy:null,endedAt:null};
    const client=join(room,data.name,data.look);
    room.hostToken=client.token;
    rooms.set(id,room);
    return {token:client.token,...snapshot(room,client)};
  }
  const room=rooms.get(String(data.code??'').toUpperCase().trim());
  if (!room) fail('Room not found. Check the code.',404);
  if (path==='join') {
    if (room.endedAt) fail('The host has left the match.',410);
    if (room.clients.size>=room.size*2) fail('This room is full.',409);
    if (room.match) fail('This room is already playing.',409);
    if (room.requests.size>=24) fail('Too many pending requests. Try again shortly.',429);
    const id=randomBytes(8).toString('hex');
    const secret=randomBytes(24).toString('hex');
    room.requests.set(id,{id,secret,name:cleanName(data.name) || 'Unnamed player',look:characterLook(data.look),until:Date.now()+45000});
    return {pending:true,id,secret,code:room.code};
  }
  if (path==='join-status' || path==='join-cancel') {
    const request=room.requests.get(data.id);
    if (!request || request.secret!==data.secret || request.until<Date.now()) fail('Your join request expired.',404);
    if (path==='join-cancel') {
      if (request.client && room.clients.has(request.client.token)) removeClient(room,request.client);
      room.requests.delete(request.id);
      return {};
    }
    if (request.outcome) fail(request.outcome,409);
    if (room.endedAt) fail('The host has left the match.',410);
    if (request.client && room.clients.has(request.client.token)) {
      request.client.seen=Date.now();
      return {token:request.client.token,...snapshot(room,request.client)};
    }
    if (room.match) fail('The match has already started.',409);
    return {pending:true,code:room.code};
  }
  if ((path==='rejoin-info' || path==='rejoin') && internetMode) {
    const saved=room.detached.get(data.token);
    const client=room.clients.get(data.token) || saved?.client;
    if (!client || room.endedAt || !room.match || room.match.phase==='results' || (saved && saved.until<Date.now())) fail('That match is no longer available.',404);
    if (path==='rejoin-info') return {code:room.code,name:client.seats[0].name};
    if (saved) {
      const seat=client.seats[0], actor=room.match.actors[seat.slot];
      Object.assign(actor,saved.stats,{name:seat.name,look:seat.look});
      room.match.humans.add(actor);
      room.detached.delete(client.token);
      room.clients.set(client.token,client);
    }
    client.epoch++;
    client.seen=Date.now();
    client.commands=[];
    client.shots=[];
    return {token:client.token,...snapshot(room,client)};
  }
  const client=room.clients.get(data.token);
  if (!client) fail('Your connection expired. Join again.',403);
  if (room.endedAt) return {ended:true};
  client.seen=Date.now();
  const host=room.hostToken===client.token;
  if (path==='leave' || path==='disconnect') {
    if (path==='disconnect' && data.epoch!==client.epoch) return {};
    removeClient(room,client,Date.now(),path==='disconnect');
    return {};
  }
  if (path==='join-decision') {
    if (!host) fail('Only the host can decide join requests.',403);
    const request=room.requests.get(data.id);
    if (!request || request.outcome || request.client || request.until<Date.now()) fail('This request is no longer pending.',409);
    if (data.accept!==true) request.outcome='The host declined your join request.';
    else if (room.match) request.outcome='The match has already started.';
    else if (room.clients.size>=room.size*2) request.outcome='This room is full.';
    else {
      request.client=join(room,request.name,request.look);
      request.outcome=null;
    }
  } else if (path==='pause') {
    if (!room.match || room.match.phase==='results') fail('There is no active match to pause.',409);
    room.pausedBy=room.pausedBy ? null : client.seats[0].name;
    room.clock=performance.now();
    for (const peer of room.clients.values()) {peer.commands=[];peer.shots=[];}
  } else if (path==='look') {
    if (room.match) fail('Customize before the match starts.',409);
    client.seats[0].look=characterLook(data.look);
  } else if (path==='team') {
    if (room.match) fail('Teams are locked once the match starts.',409);
    if (data.team!==0 && data.team!==1) fail('Choose a valid team.');
    const seat=client.seats[0];
    const occupied=[...room.clients.values()].flatMap(peer=>peer.seats)
      .filter(other=>other!==seat && other.team===data.team).length;
    if (occupied>=room.size) fail('That team is full.',409);
    seat.team=data.team;
  } else if (path==='settings' || path==='start') {
    if (!host || (room.match && room.match.phase!=='results')) fail('Only the host can change the lobby.',403);
    if (path==='start') start(room);
    else {
      if (!Number.isInteger(data.size) || data.size<1 || data.size>10 || !levels.includes(data.level)) fail('Invalid settings.');
      const players=[...room.clients.values()].flatMap(peer=>peer.seats);
      if ([0,1].some(team=>players.filter(seat=>seat.team===team).length>data.size)) fail('The match size is too small for this room.');
      const rounds=data.rounds ?? room.rounds;
      if (!roundOptions.includes(rounds)) fail('Invalid round count.');
      room.rounds=rounds;
      room.size=data.size;
      room.level=data.level;
      room.match=null;
    }
  } else if (path==='fire' && internetMode) {
    const {sequence,round,x,y,seenTime}=data;
    if (!Number.isSafeInteger(sequence) || sequence<=0 || !Number.isFinite(x) || !Number.isFinite(y)) fail('Invalid shot.');
    if (room.pausedBy || room.match?.phase!=='active' || round!==room.match.round) fail('The round is closed.',409);
    if (sequence>(client.shotAck || 0) && !client.shots.some(shot=>shot.sequence===sequence)) {
      if (client.shots.length>=8) fail('Too many pending shots.',429);
      client.shots.push({sequence,round,x:safeNumber(x,0,1200),y:safeNumber(y,0,720),seenTime:Number.isFinite(seenTime) ? Math.max(performance.now()-300,Math.min(performance.now(),seenTime)) : null,at:Date.now()});
      client.shots.sort((a,b)=>a.sequence-b.sequence);
    }
    return {};
  } else if (path==='sync') {
    client.commands=client.seats.map((_,i)=>{
      const next=command(data.commands?.[i]);
      if (internetMode) next.fire=false;
      next.pickup ||= Boolean(client.commands[i]?.pickup);
      return next;
    });
  } else if (path==='ready') {
    if (room.pausedBy || room.match?.phase!=='buy') fail('The buy phase is closed.',409);
    room.match.markReady(room.match.actors[client.seats[0].slot]);
  } else if (path==='buy') {
    const seat=Number.isInteger(data.seat) && client.seats[data.seat];
    if (room.pausedBy || !room.match || !seat || !Number.isInteger(data.item)) fail('Invalid purchase.');
    room.match.buy(room.match.actors[seat.slot],data.item);
  } else fail('Unknown room action.',404);
  return snapshot(room,client);
}

async function roomRequest(req,res) {
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  try {
    if (!internetMode && (!inLan(req.socket.remoteAddress || '') || req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'])) fail('Use the LAN address on the same network.',403);
    if (req.method!=='POST' || req.headers.origin!==(publicOrigin || `http://${req.headers.host}`) ||
        !req.headers['content-type']?.startsWith('application/json')) fail('Invalid room request.',400);
    let body='';
    for await (const piece of req) {
      body+=piece;
      if (body.length>4096) fail('Request too large.',413);
    }
    let data;
    try { data=JSON.parse(body); } catch { fail('Invalid room request.'); }
    if (!data || typeof data!=='object') fail('Invalid room request.');
    const result=api(req.url.slice(1),data);
    const json=JSON.stringify(result);
    if (internetMode && json.length>=1024 && /(?:^|,)\s*gzip\s*(?:,|$)/i.test(req.headers['accept-encoding'] || '')) {
      const compressed=await compress(json,{level:1});
      res.setHeader('Content-Encoding','gzip');
      res.setHeader('Vary','Accept-Encoding');
      res.end(compressed);
    } else res.end(json);
  } catch(error) {
    res.statusCode=error.status || 500;
    res.end(JSON.stringify({error:error.status ? error.message : 'The game server could not complete that request.'}));
  }
}

function rewindTargets(room, stamp, now) {
  if (!Number.isFinite(stamp)) return undefined;
  const samples=room.history.filter(sample=>sample.round===room.match.round && sample.time>=now-340);
  if (!samples.length) return undefined;
  const time=Math.max(now-300,stamp);
  const index=samples.findIndex(sample=>sample.time>=time);
  if (index<0) return samples.at(-1).actors;
  const next=samples[index], prev=samples[Math.max(0,index-1)];
  const fraction=next===prev ? 0 : (time-prev.time)/(next.time-prev.time);
  return prev.actors.map((a,i)=>({x:a.x+(next.actors[i].x-a.x)*fraction,y:a.y+(next.actors[i].y-a.y)*fraction}));
}

const tick=setInterval(()=>{
  const now=Date.now(), time=performance.now();
  for (const [id,room] of rooms) {
    for (const [key,request] of room.requests) if (request.until<=now) room.requests.delete(key);
    if (room.endedAt) {
      if (now-room.endedAt>closedRoomLifetime || !room.clients.size) rooms.delete(id);
      continue;
    }
    for (const [token,saved] of room.detached) {
      if (saved.until>now) continue;
      room.detached.delete(token);
      if (token===room.hostToken) room.endedAt=now;
    }
    for (const client of room.clients.values()) {
      if (now-client.seen<=disconnectAfter) continue;
      removeClient(room,client,now,true);
      if (room.endedAt) break;
    }
    if (room.endedAt || room.pausedBy || !room.match || room.match.phase==='results') continue;
    const m=room.match;
    const dt=Math.min(.05,(time-room.clock)/1000);
    const commands=new Map();
    for (const client of room.clients.values()) {
      client.seats.forEach((seat,i)=>{
        const actor=m.actors[seat.slot];
        const input=now-client.seen<450 ? client.commands[i] : undefined;
        const shot=internetMode ? client.shots[0] : undefined;
        if (shot && (shot.round!==m.round || m.phase!=='active' || now-shot.at>400 || !actor.hp || actor.reload || actor.cooldown<=dt)) {
          client.shots.shift();
          client.shotAck=shot.sequence;
          if (shot.round===m.round && m.phase==='active' && now-shot.at<=400 && actor.hp && !actor.reload) {
            commands.set(actor,{...command(input),x:shot.x,y:shot.y,fire:true,reload:false,rewind:rewindTargets(room,shot.seenTime,time)});
            if (input) input.pickup=false;
            return;
          }
        }
        if (input) {
          commands.set(actor,{...input});
          input.pickup=false;
        }
      });
    }
    m.step(dt,commands.get(m.player),commands);
    room.clock=time;
    if (internetMode && m.phase==='active') {
      room.history.push({time,round:m.round,actors:m.actors.map(({x,y})=>({x,y}))});
      if (room.history.length>14) room.history.shift();
    }
  }
},1000/30);
tick.unref();

if (internetMode) {
  await serveOnline(port,roomRequest);
} else {
  const {createServer}=await import('vite');
  const plugin={name:'laser-strike-lan',configureServer(server){server.middlewares.use('/lan-api',roomRequest);}};
  const server=await createServer({configFile:false,plugins:[plugin],server:{host:'0.0.0.0',port,strictPort:true}});
  await server.listen();
  const address=lanAddress();
  if (address) console.log(`LAN: http://${address}:${port}/lan.html`);
  console.log(`This computer: http://localhost:${port}/lan.html`);
}
