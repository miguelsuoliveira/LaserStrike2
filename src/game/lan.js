import './strike.css';
import './lan.css';
import { Match,gear } from './match.js';
import { width,height,sides,colors } from './arena.js';
import { paint } from './arena-art.js';
import { createStrikeAudio } from './strike-audio.js';

const canvas=document.querySelector('#arena'), context=canvas.getContext('2d');
const overlay=document.querySelector('#overlay'), hud=document.querySelector('#hud');
const audio=createStrikeAudio();
const keys=new Set(), pointer={x:600,y:360};
let session, state, view, requestInFlight=false, online=false, held=false, error='';
let name='', roomCode='', address='', markup='', pickups=[false,false], previousPhase;
const escape = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const button = (text,action,primary='') => `<button class="${primary}" data-action="${action}">${text}</button>`;
const panel = (title,body) => `<section class="panel lan-panel"><div class="kicker">LASER STRIKE 2 · LAN EDITION</div><h1>${title}</h1>${error?`<p class="lan-error" role="alert">${escape(error)}</p>`:''}${body}</section>`;
const localMode=new URLSearchParams(location.search).get('mode')==='local';
const lanPath='/lan.html'+(localMode?'?mode=local':'');
const title = 'LASER <span>STRIKE 2</span>';
const controls = '<p class="tagline">P1 · WASD move, mouse aim and shoot, R reload, E interact</p>';
const localControls = '<p class="tagline">P2 · Arrow keys move, IJKL aim, Right Shift shoot, O reload, Enter interact</p>';

async function api(action, data={}) {
  const response=await fetch('/lan-api/'+action,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...session,...data}),signal:AbortSignal.timeout(4000)});
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Open the LAN host address to start.');
  const result=await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error),{status:response.status});
  return result;
}

function accept(next) {
  state=next;
  if (!next.match) {view=null;previousPhase=undefined;return;}
  const snapshot=next.match;
  if (snapshot.phase==='active' && previousPhase==='buy') audio.play('bell');
  previousPhase=snapshot.phase;
  const {actors,objective}=snapshot;
  const id=next.seats[0];
  view=Object.assign(Object.create(Match.prototype),snapshot,{
    player:actors[id],feedback:{time:0,marker:0},announcement:{time:0},
    objective:{...objective,actor:actors[objective.actor],carrier:actors[objective.carrier]},
  });
}

function lobby() {
  const players=state.players.map(player=>`<li style="color:${colors[player.team]}">${escape(player.name)} · ${sides[player.team]}</li>`).join('');
  const fields=state.host ? `<form id="room-settings">
    <label class="settings-row">Players per team <select id="roster-size">${Array.from({length:10},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===state.size?'selected':''}>${n}v${n}</option>`).join('')}</select></label>
    <label class="settings-row">Bot difficulty <select id="bot-level">${['Relaxed','Standard','Expert'].map(level=>`<option ${level===state.level?'selected':''}>${level}</option>`).join('')}</select></label>
    </form>` : `<p class="tagline">${state.size}v${state.size} · ${state.level} bots · Waiting for host</p>`;
  return panel(state.local?'Local co-op':'Room '+state.code,`${state.local?'':'<p class="tagline">Share the code with players on the same network.</p>'}
    <ul class="lan-roster">${players}</ul>${fields}${controls}${state.local?localControls:''}
    <div class="actions">${state.host?button('Start match','start','primary'):''}${button('Leave room','leave')}</div>`);
}

function shop() {
  return panel('Preparation',`<p class="tagline">The match starts when the buy timer reaches zero.</p>${state.seats.map((slot,index)=>{
    const actor=view.actors[slot];
    return `<h2>${escape(actor.name)} · ${actor.credits} CR</h2><div class="lan-equipment">${gear.map((item,i)=>`
      <button data-action="buy-${index}-${i}" ${i===actor.item||actor.bought||actor.credits<item.cost?'disabled':''}>${item.name} · ${i===actor.item?'Owned':item.cost+' CR'} · ${item.damage} HP</button>`).join('')}</div>`;
  }).join('')}`);
}

function display() {
  let html;
  if (!online) html=panel(title,`<p class="tagline">Open the host’s LAN address on the same network, then enter a room code or create a room.</p>
    <form id="address-form"><label class="settings-row">LAN host address <input id="address" placeholder="192.168.1.10:5188" value="${escape(address)}" required></label>
    <div class="actions"><button class="primary">Open LAN host</button><a class="lan-link" href="http://localhost:5188${lanPath}">This computer</a><a class="lan-link" href="/">Back</a></div></form>`);
  else if (!state) html=panel(title,`<label class="settings-row">Your name <input id="player-name" maxlength="24" placeholder="Player name" value="${escape(name)}"></label>
    ${localMode ? '' : `<form id="join-form"><label class="settings-row">Room code <input id="room-code" maxlength="6" autocomplete="off" placeholder="ABC123" value="${escape(roomCode)}" required></label>
    <button class="primary">Join room</button></form>`}
    <div class="actions">${localMode?'':button('Create room','create')}${button('Play Local Co-op','local','coop-button')}<a class="lan-link" href="/">Back</a></div>`);
  else if (!view) html=lobby();
  else if (view.phase==='buy') html=shop();
  else if (view.phase==='results') html=panel(view.score[0]===view.score[1]?'Match drawn':sides[view.winner]+' win',
    `<p class="tagline">${view.score.join(' : ')}</p><div class="actions">${state.host?button('Play again','start','primary'):''}${button('Leave room','leave')}</div>`);
  else if (view.phase==='result' || view.phase==='halftime') html=`<section class="notice"><h2>${sides[view.winner]} win the round</h2><p>${view.score.join(' : ')} · ${escape(view.reason)}</p></section>`;
  else html='';
  if (html!==markup) {overlay.innerHTML=html;markup=html;}
  hud.hidden=!view;
  if (view) {
    const clock=Math.ceil(view.objective.site && view.phase==='active' ? view.objective.clock : view.time);
    const players=state.seats.map(id=>{
      const a=view.actors[id], drop=a.hp && view.nearbyWeapon(a);
      return `<b>${escape(a.name)} · ${a.hp} HP · ${gear[a.item].name} ${a.ammo}/${gear[a.item].capacity}${drop?' · Pick up '+gear[drop.item].name:''}</b>`;
    }).join('');
    const status=view.objective.site ? 'Relay active at '+view.objective.site.name : view.objective.dropped ? 'Relay dropped' : 'Relay carried by '+(view.objective.carrier?.name || sides[view.attack]);
    const next=`<div class="topbar">Round ${view.round} · ${view.score.join(' : ')} · ${clock}s</div><div class="objective">${escape(status)}</div><div class="bottom">${players}</div>`;
    if(hud.dataset.render!==next){hud.innerHTML=next;hud.dataset.render=next;}
  }
}

function input() {
  if (!view) return [];
  const first={...pointer,dx:+keys.has('KeyD')-+keys.has('KeyA'),dy:+keys.has('KeyS')-+keys.has('KeyW'),
    fire:held,reload:keys.has('KeyR'),use:keys.has('KeyE'),pickup:pickups[0]};
  if (!state.local) return [first];
  const a=view.actors[state.seats[1]];
  const aimX=+keys.has('KeyL')-+keys.has('KeyJ'),aimY=+keys.has('KeyK')-+keys.has('KeyI');
  return [first,{x:a.x+100*(aimX||aimY?aimX:Math.cos(a.angle)),y:a.y+100*(aimX||aimY?aimY:Math.sin(a.angle)),
    dx:+keys.has('ArrowRight')-+keys.has('ArrowLeft'),dy:+keys.has('ArrowDown')-+keys.has('ArrowUp'),
    fire:keys.has('ShiftRight'),reload:keys.has('KeyO'),use:keys.has('Enter'),pickup:pickups[1]}];
}

async function poll() {
  if (!session || requestInFlight) return;
  const current=session;
  requestInFlight=true;
  try {
    const commands=input();
    pickups=[false,false];
    const next=await api('sync',{commands});
    if (session===current) {
      accept(next);
      display();
    }
  } catch(e) {
    if (session===current) {
      error=e.message;
      if (e.status===403 || e.status===404) {session=null;state=null;view=null;}
      display();
    }
  } finally {requestInFlight=false;}
}

async function act(action,data) {
  audio.unlock();
  error='';
  try {
    const result=await api(action,data);
    if (result.token) session={token:result.token,code:result.code};
    if (action==='leave') {session=null;state=null;view=null;previousPhase=undefined;}
    else accept(result);
  } catch(e) {error=e.message;}
  display();
}

overlay.addEventListener('input',event=>{
  if (event.target.id==='player-name') name=event.target.value;
  if (event.target.id==='room-code') roomCode=event.target.value;
  if (event.target.id==='address') address=event.target.value;
});
overlay.addEventListener('change',event=>{
  if (event.target.closest('#room-settings')) {
    act('settings',{size:Number(document.querySelector('#roster-size').value),level:document.querySelector('#bot-level').value});
  }
});
overlay.addEventListener('submit',event=>{
  event.preventDefault();
  if (event.target.id==='join-form') act('join',{code:roomCode,name});
  if (event.target.id==='address-form') {
    try {
      const target=new URL(address.includes('://')?address:'http://'+address);
      if (target.protocol!=='http:' || !target.hostname || target.username || target.password) throw new Error();
      if (!target.port) target.port='5188';
      location.href=new URL(lanPath,target.origin);
    } catch {error='Enter the LAN address shown on the host computer.';display();}
  }
});
overlay.addEventListener('click',event=>{
  const action=event.target.closest('button')?.dataset.action;
  if (!action) return;
  if (action==='create' || action==='local') act('create',{local:action==='local',name});
  if (action==='start' || action==='leave') act(action);
  if (action.startsWith('buy-')) {
    const [,seat,item]=action.split('-');
    act('buy',{seat:Number(seat),item:Number(item)});
  }
});
const gameplayKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyR','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyI','KeyJ','KeyK','KeyL','ShiftRight','KeyO','Enter']);
addEventListener('keydown',event=>{
  if (view?.phase!=='active' || !gameplayKeys.has(event.code)) return;
  event.preventDefault();
  keys.add(event.code);
  if (!event.repeat && event.code==='KeyE') pickups[0]=true;
  if (!event.repeat && event.code==='Enter') pickups[1]=true;
});
addEventListener('keyup',event=>keys.delete(event.code));
addEventListener('blur',()=>{keys.clear();held=false;});
canvas.addEventListener('pointermove',event=>{
  const rect=canvas.getBoundingClientRect();
  pointer.x=(event.clientX-rect.left)*width/rect.width;
  pointer.y=(event.clientY-rect.top)*height/rect.height;
});
canvas.addEventListener('pointerdown',event=>{if(event.button===0) held=true;});
addEventListener('pointerup',()=>{held=false;});
function frame() {
  audio.update();
  paint(context,view,view?.phase==='active'?pointer:null);
  requestAnimationFrame(frame);
}
try {await api('info');online=true;} catch {}
display();
setInterval(poll,65);
requestAnimationFrame(frame);
