import { randomBytes, randomInt } from 'node:crypto';
import { lanAddress,lanPort } from './lib/lan-network.mjs';
import { createServer } from 'vite';
import { Match,defaultRounds,roundOptions } from '../src/game/match.js';

const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const disconnectAfter=12000, closedRoomLifetime=30000;
const levels = ['Relaxed','Standard','Expert'];
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
const code = () => Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');
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

function join(room, name) {
  const displayName=typeof name==='string' ? name.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,24) : '';
  const seats=[...room.clients.values()].flatMap(peer=>peer.seats);
  const shortTeam=Number(seats.filter(seat=>seat.team===1).length<seats.filter(seat=>seat.team===0).length);
  const token=randomBytes(24).toString('hex');
  const playerName=displayName || 'Player '+room.nextName;
  room.nextName++;
  const client={token,seen:Date.now(),commands:[],seats:[{name:playerName,team:shortTeam}]};
  room.clients.set(token,client);
  return client;
}

function removeClient(room, client, now=Date.now()) {
  const wasHost=room.clients.values().next().value===client;
  room.clients.delete(client.token);
  if (wasHost) {
    room.endedAt=now;
    return;
  }
  const {name,slot}=client.seats[0];
  room.notices.push({id:++room.noticeId,message:name+' has left the game'});
  if (room.notices.length>20) room.notices.shift();
  if (room.match) {
    const actor=room.match.actors[slot];
    room.match.humans.delete(actor);
    actor.name='Bot '+(actor.slot+1);
  }
}

function start(room) {
  room.pausedBy=null;
  const seats=[...room.clients.values()].flatMap(client=>client.seats);
  const counts=[0,0];
  for (const seat of seats) seat.slot=seat.team*room.size+counts[seat.team]++;
  room.match=new Match(room.size,seats[0].team,room.level,Math.random,seats.map(seat=>seat.slot),room.rounds);
  for (const seat of seats) room.match.actors[seat.slot].name=seat.name;
  room.clock=performance.now();
}

function snapshot(room, client) {
  const clients=[...room.clients.values()];
  const base={code:room.code,serial:++room.serial,host:clients[0]===client,size:room.size,rounds:room.rounds,level:room.level,
    team:client.seats[0].team,pausedBy:room.pausedBy,notices:room.notices,
    players:clients.flatMap(peer=>peer.seats.map(seat=>({name:seat.name,team:seat.team}))),
    seats:client.seats.map(seat=>seat.slot),match:null};
  const m=room.match;
  if (!m) return base;
  const actorIndex = actor => actor ? m.actors.indexOf(actor) : -1;
  const o=m.objective;
  base.match={phase:m.phase,time:m.time,round:m.round,roundLimit:m.roundLimit,score:m.score,attack:m.attack,winner:m.winner,reason:m.reason,
    actors:m.actors.map(({x,y,hp,angle,name,team,slot,ammo,item,credits,reload,bought,kills,damage})=>
      ({x,y,hp,angle,name,team,slot,ammo,item,credits,reload,bought,kills,damage})),
    traces:m.traces, weaponDrops:m.weaponDrops,
    objective:{site:o.site,carrier:actorIndex(o.carrier),actor:actorIndex(o.actor),dropped:o.dropped,progress:o.progress,clock:o.clock}};
  return base;
}

function api(path, data) {
  if (path==='info') return {available:true};
  if (path==='create') {
    if (rooms.size>=40) fail('The LAN server is full. Try again in a moment.',503);
    let id=code();
    while (rooms.has(id)) id=code();
    const room={code:id,size:5,rounds:defaultRounds,level:'Standard',nextName:1,clients:new Map(),notices:[],noticeId:0,serial:0,pausedBy:null,endedAt:null};
    const client=join(room,data.name);
    rooms.set(id,room);
    return {token:client.token,...snapshot(room,client)};
  }
  const room=rooms.get(String(data.code??'').toUpperCase().trim());
  if (!room) fail('Room not found. Check the code.',404);
  if (path==='join') {
    if (room.endedAt) fail('The host has left the match.',410);
    if (room.clients.size>=room.size*2) fail('This room is full.',409);
    if (room.match) fail('This room is already playing.',409);
    const client=join(room,data.name);
    return {token:client.token,...snapshot(room,client)};
  }
  const client=room.clients.get(data.token);
  if (!client) fail('Your connection expired. Join again.',403);
  if (room.endedAt) return {ended:true};
  client.seen=Date.now();
  const host=room.clients.values().next().value===client;
  if (path==='leave') {
    removeClient(room,client);
    return {};
  }
  if (path==='pause') {
    if (!room.match || room.match.phase==='results') fail('There is no active match to pause.',409);
    room.pausedBy=room.pausedBy ? null : client.seats[0].name;
    room.clock=performance.now();
    for (const peer of room.clients.values()) peer.commands=[];
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
  } else if (path==='sync') {
    client.commands=client.seats.map((_,i)=>{
      const next=command(data.commands?.[i]);
      next.pickup ||= Boolean(client.commands[i]?.pickup);
      return next;
    });
  } else if (path==='buy') {
    const seat=Number.isInteger(data.seat) && client.seats[data.seat];
    if (room.pausedBy || !room.match || !seat || !Number.isInteger(data.item)) fail('Invalid purchase.');
    room.match.buy(room.match.actors[seat.slot],data.item);
  } else fail('Unknown room action.',404);
  return snapshot(room,client);
}

function lanRoutes() {
  return {
    name:'laser-strike-lan',
    configureServer(server) {
      server.middlewares.use('/lan-api',async (req,res)=>{
        res.setHeader('Content-Type','application/json');
        res.setHeader('Cache-Control','no-store');
        try {
          if (!inLan(req.socket.remoteAddress || '') || req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']) fail('Use the LAN address on the same network.',403);
          if (req.method!=='POST' || req.headers.origin!==`http://${req.headers.host}` ||
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
          res.end(JSON.stringify(result));
        } catch(error) {
          res.statusCode=error.status || 500;
          res.end(JSON.stringify({error:error.status ? error.message : 'The LAN server could not complete that request.'}));
        }
      });
    },
  };
}

const tick=setInterval(()=>{
  const now=Date.now(), time=performance.now();
  for (const [id,room] of rooms) {
    if (room.endedAt) {
      if (now-room.endedAt>closedRoomLifetime || !room.clients.size) rooms.delete(id);
      continue;
    }
    for (const client of room.clients.values()) {
      if (now-client.seen<=disconnectAfter) continue;
      removeClient(room,client,now);
      if (room.endedAt) break;
    }
    if (room.endedAt || room.pausedBy || !room.match || room.match.phase==='results') continue;
    const m=room.match;
    const commands=new Map();
    for (const client of room.clients.values()) {
      client.seats.forEach((seat,i)=>{
        const input=now-client.seen<450 ? client.commands[i] : undefined;
        if (!input) return;
        commands.set(m.actors[seat.slot],{...input});
        input.pickup=false;
      });
    }
    m.step(Math.min(.05,(time-room.clock)/1000),commands.get(m.player),commands);
    room.clock=time;
  }
},1000/30);
tick.unref();

const port=lanPort;
const server=await createServer({configFile:false,plugins:[lanRoutes()],server:{host:'0.0.0.0',port,strictPort:true}});
await server.listen();
const address=lanAddress();
if (address) console.log(`LAN: http://${address}:${port}/lan.html`);
console.log(`This computer: http://localhost:${port}/lan.html`);
