import './strike.css';
import './lan.css';
import { Match,gear } from './match.js';
import { width,height,sides,colors } from './arena.js';
import { paint } from './arena-art.js';
import { createLanMotion } from './lan-motion.js';
import { mountAudioToggles,roundStepper,scoreboardTable } from './match-controls.js';
import { createStrikeAudio } from './strike-audio.js';

const canvas=document.querySelector('#arena'), context=canvas.getContext('2d');
const overlay=document.querySelector('#overlay'), hud=document.querySelector('#hud');
const board=document.querySelector('#board');
let lastBoard='';
document.documentElement.style.setProperty('--liberals',colors[0]);
document.documentElement.style.setProperty('--counter-liberals',colors[1]);
const notices=document.querySelector('#lan-notices');
const audio=createStrikeAudio();
const audioToggles=mountAudioToggles(audio);
let lastSound=0;
const motion=createLanMotion();
let needsPaint=true, lastFrame=performance.now(), pollTimer;
let lastNotice=0, ending=false;
const mainMenu=new URL('/',location.href);
const keys=new Set(), pointer={x:600,y:360};
let session, state, view, requestInFlight=false, online=false, held=false, firePressed=false, error='';
let inviteBase;
let name='', roomCode=(new URLSearchParams(location.search).get('room') || '').slice(0,6), markup='', pickupPressed=false;
const escape = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const button = (text,action,primary='') => `<button class="${primary}" data-action="${action}">${text}</button>`;
const panel = (title,body) => `<section class="panel lan-panel"><div class="kicker">LASER STRIKE 2 · LAN EDITION</div><h1>${title}</h1>${error?`<p class="lan-error" role="alert">${escape(error)}</p>`:''}${body}</section>`;
const title = 'LASER <span>STRIKE 2</span>';
const controls = '<p class="tagline">WASD move, mouse aim and shoot, R reload, E interact, hold Tab for scoreboard</p>';

async function api(action, data={}) {
  const response=await fetch('/lan-api/'+action,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...session,...data}),signal:AbortSignal.timeout(4000)});
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The LAN host is unavailable.');
  const result=await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error),{status:response.status});
  return result;
}

function stopInput() {
  keys.clear();
  held=false;
  firePressed=false;
  pickupPressed=false;
}

function announce(message) {
  const note=document.createElement('p');
  note.textContent=message;
  notices.append(note);
  setTimeout(()=>note.remove(),5000);
}

function hostLeft() {
  if (ending) return;
  ending=true;
  session=null;
  clearTimeout(pollTimer);
  stopInput();
  display();
  setTimeout(()=>location.replace(mainMenu),2200);
}

function accept(next) {
  if (ending) return;
  if (next.ended) {hostLeft();return;}
  if (state?.code===next.code && next.serial<state.serial) return;
  if (next.pausedBy!==state?.pausedBy) stopInput();
  state=next;
  for (const note of next.notices || []) {
    if (note.id<=lastNotice) continue;
    announce(note.message);
    lastNotice=note.id;
  }
  if (!next.match) {view=null;motion.receive(null);needsPaint=true;return;}
  const snapshot=next.match;
  const {actors,objective}=snapshot;
  const id=next.seats[0];
  for (const sound of next.sounds || []) {
    if (sound.id<=lastSound) continue;
    lastSound=sound.id;
    const remoteShot=sound.name==='shot' && sound.actor!==id;
    const gap=remoteShot ? Math.hypot(sound.x-actors[id].x,sound.y-actors[id].y) : 0;
    audio.play(sound.name,{bot:remoteShot,volume:remoteShot ? Math.max(0,.55-gap/1100) : 1});
  }
  view=Object.assign(Object.create(Match.prototype),snapshot,{
    player:actors[id],feedback:snapshot.feedback,announcement:{time:0},
    objective:{...objective,actor:actors[objective.actor],carrier:actors[objective.carrier]},
  });
  motion.receive(view);
  needsPaint=true;
}

function lobby() {
  const invite=new URL(inviteBase || location.href);
  invite.searchParams.set('room',state.code);
  const teams=sides.map((side,team)=>{
    const players=state.players.filter(player=>player.team===team);
    const current=team===state.team, full=players.length>=state.size;
    return `<section class="lan-team" style="--team-color:${colors[team]}">
      <h2>${side} <span>${players.length} / ${state.size}</span></h2>
      <ul class="lan-roster">${players.map(player=>`<li>${escape(player.name)} · ${side}</li>`).join('')}</ul>
      <button data-action="team-${team}" aria-pressed="${current}" ${current||full?'disabled':''}>${current?'Your team':full?'Team full':'Join '+side}</button>
    </section>`;
  }).join('');
  const fields=state.host ? `<form id="room-settings">
    <label class="settings-row">Players per team <select id="roster-size">${Array.from({length:10},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===state.size?'selected':''}>${n}v${n}</option>`).join('')}</select></label>
    ${roundStepper(state.rounds)}
    <label class="settings-row">Bot difficulty <select id="bot-level">${['Relaxed','Standard','Expert'].map(level=>`<option ${level===state.level?'selected':''}>${level}</option>`).join('')}</select></label>
    </form>` : `<p class="tagline">${state.size}v${state.size} · ${state.level} bots · Waiting for host · ${state.rounds} rounds</p>`;
  return panel('Room '+state.code,`<p class="tagline">${state.players.length} / ${state.size*2} players · Share the room link with players on the same Wi‑Fi.</p>
    <label class="settings-row">Room link <input id="room-invite" readonly value="${escape(invite.href)}"></label>
    <div class="actions">${button('Copy room link','copy-invite')}</div>
    <div class="lan-teams">${teams}</div><p class="tagline">Bots fill empty slots when the match starts.</p>${fields}${controls}
    <div class="actions">${state.host?button('Start match','start','primary'):''}${button('Leave room','leave')}</div>`);
}

function shop() {
  return panel('Preparation',`<p class="tagline">${state.ready} / ${state.players.length} ready · ${view.readyCountdown?'Round starts in 1 second…':'Waiting for all players'}</p>${state.seats.map((slot,index)=>{
    const actor=view.actors[slot];
    return `<h2>${escape(actor.name)} · ${actor.credits} CR</h2><div class="lan-equipment">${gear.map((item,i)=>`
      <button data-action="buy-${index}-${i}" ${i===actor.item||actor.bought||actor.credits<item.cost||state.isReady?'disabled':''}>${item.name} · ${i===actor.item?'Owned':item.cost+' CR'} · ${item.damage} HP</button>`).join('')}</div>`;
  }).join('')}<div class="actions">${state.isReady?'':button('Ready','ready','primary')}</div>`);
}

function canShowScoreboard() {
  return view && view.phase!=='results' && !state?.pausedBy && !ending;
}

function displayScoreboard() {
  board.hidden=!(canShowScoreboard() && keys.has('Tab'));
  if (board.hidden) return;
  const next=`<section class="panel"><h1>Scoreboard</h1><p>${view.score.join(' : ')}</p>${scoreboardTable(view,escape)}</section>`;
  if (lastBoard!==next) {board.innerHTML=next;lastBoard=next;}
}

function display() {
  displayScoreboard();
  audioToggles.show(Boolean(view && !ending));
  let html;
  if (ending) html=panel('Host has left the match',`<a class="lan-link" href="${mainMenu.href}">Main menu</a>`);
  else if (!online) html=panel(title,`<p class="tagline">LAN rooms run on the host laptop. Ask the host to start the LAN server and share the room link. Open that link while connected to the same Wi‑Fi.</p>
    <div class="actions">${button('Try again','retry','primary')}<a class="lan-link" href="/">Back</a></div>`);
  else if (!state) html=panel(title,`<label class="settings-row">Your name <input id="player-name" maxlength="24" placeholder="Player name" value="${escape(name)}"></label>
    <form id="join-form"><label class="settings-row">Room code <input id="room-code" maxlength="6" autocomplete="off" placeholder="ABC123" value="${escape(roomCode)}" required></label>
    <button class="primary">Join room</button></form>
    <div class="actions">${button('Create room','create')}<a class="lan-link" href="/">Back</a></div>`);
  else if (!view) html=lobby();
  else if (state.pausedBy) html=panel('Match paused',`<p class="tagline">Paused by ${escape(state.pausedBy)}</p><div class="actions">${button('Resume match','pause','primary')}${button('Leave match','leave')}</div>`);
  else if (view.phase==='buy') html=shop();
  else if (view.phase==='results') html=panel(view.score[0]===view.score[1]?'Match drawn':sides[view.winner]+' win',
    `<p class="tagline">${view.score.join(' : ')}</p><div class="actions">${state.host?button('Play again','start','primary'):''}${button('Leave room','leave')}</div>`);
  else if (view.phase==='result' || view.phase==='halftime') html=`<section class="notice">${view.phase==='halftime'?'<div class="kicker">HALFTIME · ROLES SWITCH</div>':''}<h2>${sides[view.winner]} win the round</h2><p>${view.score.join(' : ')} · ${escape(view.reason)}</p></section>`;
  else html='';
  if (html!==markup) {overlay.innerHTML=html;markup=html;}
  hud.hidden=!view || ending;
  if (view && !ending) {
    const clock=Math.ceil(view.objective.site && view.phase==='active' ? view.objective.clock : view.time);
    const players=state.seats.map(id=>{
      const a=view.actors[id], drop=a.hp && view.nearbyWeapon(a);
      return `<b>${escape(a.name)} · ${a.hp} HP · ${gear[a.item].name} · Ammo ${a.ammo}/${gear[a.item].capacity}${drop?' · Pick up '+gear[drop.item].name:''}</b>`;
    }).join('');
    const status=view.objective.site ? 'Relay active at '+view.objective.site.name : view.objective.dropped ? 'Relay dropped' : 'Relay carried by '+(view.objective.carrier?.name || sides[view.attack]);
    const next=`<div class="topbar">Round ${view.round} / ${view.roundLimit} · ${view.score.join(' : ')} · ${clock}s</div><div class="objective">${escape(status)}</div><div class="bottom">${players}</div>`;
    if(hud.dataset.render!==next){hud.innerHTML=next;hud.dataset.render=next;}
  }
}

function controlsNow() {
  return {...pointer,dx:+keys.has('KeyD')-+keys.has('KeyA'),dy:+keys.has('KeyS')-+keys.has('KeyW'),
    fire:held||firePressed,reload:keys.has('KeyR'),use:keys.has('KeyE'),pickup:pickupPressed};
}

function schedulePoll(delay) {
  clearTimeout(pollTimer);
  if (session) pollTimer=setTimeout(poll,delay);
}

async function poll() {
  if (!session || requestInFlight) return;
  const current=session;
  requestInFlight=true;
  try {
    const commands=view?.phase==='active' && !state.pausedBy ? [controlsNow()] : [];
    pickupPressed=false;
    firePressed=false;
    const next=await api('sync',{commands});
    if (session===current) {
      accept(next);
      display();
    }
  } catch(e) {
    if (session===current) {
      error=e.message;
      if (e.status===403 || e.status===404) {session=null;state=null;view=null;motion.receive(null);needsPaint=true;}
      display();
    }
  } finally {
    requestInFlight=false;
    schedulePoll(view?.phase==='active' && !state?.pausedBy ? 40 : 125);
  }
}

async function act(action,data) {
  audio.unlock();
  error='';
  try {
    const result=await api(action,data);
    if (result.token) {
      lastNotice=0;
      lastSound=0;
      session={token:result.token,code:result.code};
    }
    if (action==='leave' && !result.ended) {
      const wasHost=state.host;
      session=null;state=null;view=null;motion.receive(null);needsPaint=true;
      notices.replaceChildren();
      stopInput();
      if (wasHost) location.replace(mainMenu);
    }
    else accept(result);
    schedulePoll(0);
  } catch(e) {error=e.message;}
  display();
}

overlay.addEventListener('input',event=>{
  if (event.target.id==='player-name') name=event.target.value;
  if (event.target.id==='room-code') roomCode=event.target.value;
});
overlay.addEventListener('change',event=>{
  if (event.target.closest('#room-settings')) {
    act('settings',{size:Number(document.querySelector('#roster-size').value),rounds:state.rounds,level:document.querySelector('#bot-level').value});
  }
});
overlay.addEventListener('submit',event=>{
  event.preventDefault();
  if (event.target.id==='join-form') act('join',{code:roomCode,name});
});
overlay.addEventListener('click',event=>{
  const action=event.target.closest('button')?.dataset.action;
  if (!action) return;
  if (action==='retry') location.reload();
  if (action==='copy-invite') {
    const field=document.querySelector('#room-invite');
    field.select();
    if (navigator.clipboard) navigator.clipboard.writeText(field.value).then(()=>announce('Room link copied.')).catch(()=>{});
    else if (document.execCommand('copy')) announce('Room link copied.');
  }
  if (action==='create') act('create',{name});
  if (action==='start' || action==='leave' || action==='pause' || action==='ready') act(action);
  if (action==='round-minus' || action==='round-plus') act('settings',{size:state.size,level:state.level,rounds:state.rounds+(action==='round-plus'?1:-1)});
  if (action.startsWith('team-')) act('team',{team:Number(action.at(-1))});
  if (action.startsWith('buy-')) {
    const [,seat,item]=action.split('-');
    act('buy',{seat:Number(seat),item:Number(item)});
  }
});
const gameplayKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyR','KeyE']);
addEventListener('keydown',event=>{
  if (event.code==='Tab' && canShowScoreboard()) {
    event.preventDefault();
    keys.add(event.code);
    displayScoreboard();
    return;
  }
  if (event.code==='Escape' && view && view.phase!=='results' && !ending) {
    event.preventDefault();
    if (!event.repeat) act('pause');
    return;
  }
  if (view?.phase!=='active' || state?.pausedBy || ending || !gameplayKeys.has(event.code)) return;
  event.preventDefault();
  keys.add(event.code);
  if (!event.repeat && event.code==='KeyE') pickupPressed=true;
  if (!event.repeat) schedulePoll(0);
});
addEventListener('keyup',event=>{
  if (!keys.delete(event.code)) return;
  if (event.code==='Tab') displayScoreboard();
  else schedulePoll(0);
});
addEventListener('blur',()=>{keys.clear();held=false;firePressed=false;displayScoreboard();schedulePoll(0);});
canvas.addEventListener('pointermove',event=>{
  const rect=canvas.getBoundingClientRect();
  pointer.x=(event.clientX-rect.left)*width/rect.width;
  pointer.y=(event.clientY-rect.top)*height/rect.height;
});
canvas.addEventListener('pointerdown',event=>{if(event.button===0 && view?.phase==='active' && !state?.pausedBy && !ending) {held=true;firePressed=true;schedulePoll(0);}});
addEventListener('pointerup',()=>{if (held) {held=false;schedulePoll(0);}});
addEventListener('pagehide',()=>{
  if (!session) return;
  fetch('/lan-api/leave',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(session),keepalive:true}).catch(()=>{});
});

function frame(now) {
  const dt=Math.min(.05,(now-lastFrame)/1000);
  lastFrame=now;
  audio.update();
  const active=view?.phase==='active' && !state?.pausedBy && !ending;
  if (active || needsPaint) {
    paint(context,motion.frame(now,dt,controlsNow()),active?pointer:null);
    needsPaint=false;
  }
  requestAnimationFrame(frame);
}
try {
  ({inviteBase}=await api('info'));
  online=true;
} catch {
  try {
    const response=await fetch('/lan-host',{signal:AbortSignal.timeout(2500)});
    if (response.ok) {
      const {url}=await response.json();
      if (url && new URL(url).origin!==location.origin) location.replace(url);
    }
  } catch {}
}
display();
requestAnimationFrame(frame);
