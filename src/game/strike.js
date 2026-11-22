import './strike.css';
import { Match, gear, defaultRounds } from './match.js';
import { width,height,sides,colors } from './arena.js';
import { graphicsPresets } from './arena-quality.js';
import { paint } from './arena-art.js';
import { mountAudioToggles,roundStepper } from './match-controls.js';
import { createStrikeAudio } from './strike-audio.js';
import { winnersStage } from './winners-stage.js';

document.documentElement.style.setProperty('--liberals',colors[0]);
document.documentElement.style.setProperty('--counter-liberals',colors[1]);

const $ = id => document.getElementById(id);
const canvas=$('arena'), hud=$('hud'), map=$('map'), overlay=$('overlay'), board=$('board');
const context=canvas.getContext('2d'), minimap=map.getContext('2d');
const audio=createStrikeAudio();
const audioToggles=mountAudioToggles(audio);
let graphics='high';

function resizeArena() {
  const {scale}=graphicsPresets[graphics];
  canvas.width=width*scale;
  canvas.height=height*scale;
}

resizeArena();
const keys=new Set(), pointer={x:600,y:360};
let size=5, rounds=defaultRounds, level='Standard', motion=true, match, paused=false, fire=false;
let pickupPressed=false;
let screen='menu', lastOverlay='', lastHud='', lastBoard='';
const shell=(title,body,kicker='PORT MERIDIAN · ARCADE LEAGUE', extraClass='') =>
  `<section class="panel${extraClass?' '+extraClass:''}"><div class="kicker">${kicker}</div><h1>${title}</h1>${body}</section>`;
const btn=(label,action,primary=false)=>`<button data-action="${action}" ${primary?'class="primary"':''}>${label}</button>`;
const score=()=>`<span class="a">${match.score[0]}</span> <span class="divider">:</span> <span class="b">${match.score[1]}</span>`;
const controls=[
  ['W A S D','Move'],['Mouse','Aim'],['Left click','Pulse'],['R','Reload'],['E','Pick up / hold for relay'],
  ['Tab','Hold scoreboard'],['Esc','Pause'],
].map(([key,label])=>`<div><kbd>${key}</kbd><span>${label}</span></div>`).join('');

function table() {
  return `<div class="table-wrap"><table><thead><tr><th>Character</th><th>Team</th><th>Elims</th><th>Deaths</th><th>Assists</th><th>Damage</th></tr></thead><tbody>${
    match.standings().map(a=>`<tr><td>${a.name}</td><td class="${a.team?'b':'a'}">${sides[a.team]}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.assists}</td><td>${a.damage}</td></tr>`).join('')
  }</tbody></table></div>`;
}

function menu() {
  return shell('LASER <span>STRIKE 2</span>',`<p class="tagline">Two crews. One relay. Take the harbor. Based off Counter-Strike 2.</p>
    <div class="settings-row"><span>Match size</span><div class="stepper"><button data-action="minus" aria-label="Fewer players" ${size===1?'disabled':''}>−</button><strong>${size}v${size}</strong><button data-action="plus" aria-label="More players" ${size===10?'disabled':''}>+</button></div></div>
    ${roundStepper(rounds)}
    <div class="actions">${btn('Play','teams',true)}${btn('Settings','settings')} <a class="lan-link" href="/lan.html">Play LAN Server</a></div>
    <h2>Controls</h2><div class="controls">${controls}</div>`,'SINGLE PLAYER · TOP-DOWN ARCADE');
}
function shop() {
  const p=match.player;
  return shell('Equipment',`<p class="tagline">${p.credits.toLocaleString()} credits · One purchase per round</p>
    <div class="shop">${gear.map((item,i)=>{
      const owned=i===p.item, blocked=owned||p.bought||p.credits<item.cost||p.ready;
      return `<button data-action="item-${i}" ${blocked?'disabled':''}><span><strong>${item.name}</strong><small>${item.damage} HP per hit · ${item.description}</small></span><b>${owned?'OWNED':item.cost?item.cost.toLocaleString():'FREE'}</b></button>`;
    }).join('')}</div><div class="actions">${match.readyCountdown?'<strong>Round starts in 1 second…</strong>':btn('Ready','ready',true)}</div>`,'PREPARATION · SUPPLY DESK');
}

function display() {
  audioToggles.show(screen==='match');
  let html='';
  if (screen==='menu') html=menu();
  if (screen==='teams') html=shell('Choose your crew',`<p class="tagline">Your crew stays together when roles switch.</p><div class="teams">${sides.map((side,i)=>`<button class="crew ${i?'b':'a'}" data-action="team-${i}"><i></i><strong>${side}</strong><small>${i?'Round 1 · Defend':'Round 1 · Activate'}</small></button>`).join('')}</div>${btn('Back','menu')}`);
  if (screen==='settings') html=shell('Settings',`<label class="settings-row">Bot difficulty<select id="difficulty">${['Relaxed','Standard','Expert'].map(x=>`<option ${level===x?'selected':''}>${x}</option>`).join('')}</select></label>
    <label class="settings-row">Graphics<select id="graphics">${Object.entries(graphicsPresets).map(([key,preset])=>`<option value="${key}" ${graphics===key?'selected':''}>${preset.label}</option>`).join('')}</select></label>
    <label class="settings-row">Pulse trails<input type="checkbox" id="motion" ${motion?'checked':''}></label>
    <label class="settings-row">Music<input type="checkbox" id="music" ${audioToggles.enabled('music')?'checked':''}></label>
    <label class="settings-row">Sound effects<input type="checkbox" id="effects" ${audioToggles.enabled('effects')?'checked':''}></label>${btn('Back','settings-back',true)}`);
  if (screen==='match') {
    if (paused) html=shell('Paused',`<div class="actions grid">${btn('Resume','resume',true)}${btn('Restart match','restart')}${btn('Settings','settings')}${btn('Main menu','menu')}</div>`);
    else if (match.phase==='buy') html=shop();
    else if (match.phase==='halftime' || match.phase==='result') {
      const elimination = match.reason==='Opposing team eliminated';
      const heading = elimination ? (match.winner===match.player.team ? 'Your team won' : 'Opposing team won') : `${sides[match.winner]} win the round`;
      html=`<section class="notice"><div class="kicker">${match.phase==='halftime'?'HALFTIME · ROLES SWITCH':'ROUND COMPLETE'}</div><h2>${heading}</h2><p>${elimination?'':match.reason+' · '}${score()}</p></section>`;
    }
    else if (match.phase==='results' && !match.announcement.time) {
      const [a,b]=match.score;
      const roster=match.winningRoster();
      const mvp=roster[0] || match.standings()[0];
      html=shell(a===b?'Match drawn':`${sides[Number(b>a)]} win`,`<p class="tagline">${score()} · MVP ${mvp.name} <span class="muted">(${sides[mvp.team]})</span></p>${roster.length?winnersStage(match.winner,roster):''}<details class="results-stats"><summary>Match statistics</summary>${table()}</details><div class="actions">${btn('Play again','restart',true)}${btn('Main menu','menu')}</div>`,'FINAL SCORE · PORT MERIDIAN','results-panel');
    }
  }
  if (html!==lastOverlay) { overlay.innerHTML=html; lastOverlay=html; }
}

function drawHud() {
  hud.hidden=map.hidden=screen!=='match' || match.phase==='results';
  if (hud.hidden) return;
  const p=match.player,o=match.objective,alive=match.alive(),item=gear[p.item];
  const time=Math.ceil(o.site && match.phase==='active'?o.clock:match.time);
  const objective=o.site?`Relay active at ${o.site.name}`:o.dropped?'Relay dropped':o.carrier===p?'You carry the relay':`${sides[match.attack]} carry the relay`;
  const canInteract=p.hp && match.phase==='active';
  const relayHint=canInteract && match.relaySite(p);
  const drop=!relayHint && canInteract && match.nearbyWeapon(p);
  const hint=relayHint ? 'Hold E' : drop ? `E · Pick up ${gear[drop.item].name}` : '';
  const html=`<div class="topbar"><span class="a">LIB · ${alive[0]} LIVE</span><strong>${score()}</strong><span class="b">CL · ${alive[1]} LIVE</span><span>ROUND ${match.round} / ${match.roundLimit}</span><span>${Math.floor(time/60)}:${String(time%60).padStart(2,'0')}</span><span>${match.phase.toUpperCase()}</span></div>
  <div class="objective">${objective}${hint?' · '+hint:''}${o.actor===p? `<progress value="${o.progress}" max="1"></progress>`:''}</div>
  <div class="bottom"><b>${p.hp} HP</b><b>${item.name} · ${p.reload?'Reloading':p.ammo+' / '+item.capacity}</b><b>${p.credits.toLocaleString()} CR</b></div>`;
  if (html!==lastHud) { hud.innerHTML=html; lastHud=html; }
}

function start(side) {
  match=new Match(size,side,level,Math.random,[],rounds);
  match.onSound=audio.play;
  paused=false; keys.clear(); fire=false; screen='match';
}
let settingsFrom='menu';
overlay.addEventListener('click',event=>{
  const action=event.target.closest('button')?.dataset.action;
  if (!action) return;
  audio.unlock();
  if (action==='minus') size=Math.max(1,size-1);
  if (action==='plus') size=Math.min(10,size+1);
  if (action==='teams') screen='teams';
  if (action==='menu') {screen='menu';match=null;paused=false;}
  if (action==='settings') {settingsFrom=screen;screen='settings';}
  if (action==='settings-back') screen=settingsFrom;
  if (action==='resume') paused=false;
  if (action==='restart') start(match.player.team);
  if (action==='ready') match.markReady(match.player);
  if (action==='round-minus') rounds--;
  if (action==='round-plus') rounds++;
  if (action.startsWith('team-')) start(Number(action.at(-1)));
  if (action.startsWith('item-')) match.buy(match.player,Number(action.at(-1)));
  display();
});
overlay.addEventListener('change',event=>{
  if (event.target.id==='difficulty') {
    level=event.target.value;
    if (match) match.level=level;
  }
  if (event.target.id==='graphics') {
    graphics=event.target.value;
    resizeArena();
  }
  if (event.target.id==='motion') motion=event.target.checked;
  if (event.target.id==='music') audioToggles.set('music',event.target.checked);
  if (event.target.id==='effects') audioToggles.set('effects',event.target.checked);
});
const moveKeys=['KeyW','KeyA','KeyS','KeyD','KeyR','KeyE','Tab','Escape'];
window.addEventListener('keydown',event=>{
  if (screen!=='match' || match.phase==='results' || !moveKeys.includes(event.code)) return;
  if (event.code==='Tab' && paused) return;
  event.preventDefault();
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code==='Escape') { paused=!paused; fire=false; pickupPressed=false; }
  if (event.code==='KeyE' && !paused && match.phase==='active') pickupPressed=true;
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{keys.clear();fire=false;pickupPressed=false;});
canvas.addEventListener('pointermove',event=>{
  const rect=canvas.getBoundingClientRect();
  pointer.x=(event.clientX-rect.left)*width/rect.width;
  pointer.y=(event.clientY-rect.top)*height/rect.height;
});
canvas.addEventListener('pointerdown',event=>{if (event.button===0) fire=true;});
window.addEventListener('pointerup',()=>{fire=false;});

let last=performance.now();
function frame(now) {
  const dt=Math.min(.05,(now-last)/1000);
  last=now;
  audio.update();
  if (match && screen==='match' && !paused) {
    match.step(dt,{...pointer,dx:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),
      dy:Number(keys.has('KeyS'))-Number(keys.has('KeyW')),fire,reload:keys.has('KeyR'),use:keys.has('KeyE'),pickup:pickupPressed});
    pickupPressed=false;
    if (!motion) match.traces.length=0;
  }
  paint(context,match,match && !paused?pointer:null,false,graphics);
  if (match && screen==='match') paint(minimap,match,null,true);
  drawHud();
  display();
  board.hidden=!(match && screen==='match' && !paused && keys.has('Tab') && match.phase!=='results');
  if (!board.hidden) {
    const html=shell('Scoreboard',`<p>${score()}</p>${table()}`);
    if (html!==lastBoard) {board.innerHTML=html;lastBoard=html;}
  }
  requestAnimationFrame(frame);
}
display();
requestAnimationFrame(frame);
