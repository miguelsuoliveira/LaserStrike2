import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createLanMotion } from '../src/game/lan-motion.js';

const browser=await chromium.launch();
const url=process.env.STRIKE_LAN_URL || 'http://localhost:5188/lan.html';
const publicGame=process.env.STRIKE_PUBLIC_URL;
const errors=[];
async function pageAt(address=url) {
  const page=await browser.newPage();
  await page.addInitScript(()=>{
    window.lanSoundStarts=0;
    const start=OscillatorNode.prototype.start;
    OscillatorNode.prototype.start=function(...args) {
      window.lanSoundStarts++;
      return start.apply(this,args);
    };
  });
  page.on('pageerror',error=>errors.push(error));
  if (publicGame) {
    await page.goto(publicGame);
    await page.getByRole('link',{name:'Play LAN Server',exact:true}).click();
    await page.waitForURL(address);
    assert.equal(await page.getByLabel('LAN host address').count(),0);
  } else await page.goto(address);
  return page;
}
const label=(page,value)=>page.getByLabel(value);
const button=(page,name)=>page.getByRole('button',{name,exact:true});
const snapshot=async page=>(await page.waitForResponse(res=>res.url().endsWith('/lan-api/sync') && res.ok())).json();

async function capacity() {
  const page=await pageAt();
  const room=await page.evaluate(async()=>{
    const send=async(action,data={})=>{
      const response=await fetch('/lan-api/'+action,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(data)});
      return {status:response.status,...await response.json()};
    };
    const {code,token}=await send('create',{name:'Host'});
    const host={code,token};
    await send('settings',{...host,size:1,level:'Standard'});
    const first=await send('join',{code});
    const oneFull=await send('join',{code});
    await send('settings',{...host,size:2,level:'Standard'});
    const next=await Promise.all([send('join',{code}),send('join',{code}),send('join',{code})]);
    const tooSmall=await send('settings',{...host,size:1,level:'Standard'});
    return {code,token,first,oneFull,next,tooSmall};
  });
  assert.equal(room.first.status,200);
  assert.equal(room.oneFull.error,'This room is full.');
  assert.deepEqual(room.next.map(r=>r.status).sort(),[200,200,409]);
  assert.equal(room.tooSmall.status,400);
  await label(page,'Room code').fill(room.code);
  await button(page,'Join room').click();
  await page.getByRole('alert').getByText('This room is full.').waitFor();
  await page.evaluate(async({code,token})=>{
    await fetch('/lan-api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,token})});
  },room);
  const retry=page.waitForResponse(res=>res.url().endsWith('/lan-api/join'));
  await button(page,'Join room').click();
  assert.equal((await (await retry).json()).error,'This room is full.');
  await page.evaluate(async({code,token})=>{
    await fetch('/lan-api/leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,token})});
  },room);
  await page.close();
}

async function lanRoom() {
  const host=await pageAt(), guest=await pageAt();
  assert.equal(await button(host,'Play Local Co-op').count(),0);
  await label(host,'Your name').fill('Ada');
  await button(host,'Create room').click();
  const room=host.getByRole('heading',{name:/^Room [A-Z0-9]{6}$/});
  await room.waitFor();
  const code=(await room.textContent()).split(' ')[1];
  await label(guest,'Your name').fill('Rowan <LAN>');
  await label(guest,'Room code').fill(code.toLowerCase());
  const joinResponse=guest.waitForResponse(res=>res.url().endsWith('/lan-api/join') && res.ok());
  await button(guest,'Join room').click();
  const {token}=await (await joinResponse).json();
  await guest.getByText('Ada · Liberals',{exact:true}).waitFor();
  await host.getByText('Rowan <LAN> · Counter Liberals',{exact:true}).waitFor();
  assert.equal(await host.locator('.lan-roster li').count(),2);
  assert.equal((await snapshot(host)).match,null);
  await label(host,'Players per team').selectOption('1');
  await guest.getByText(/1v1 · Standard bots/).waitFor();
  assert.ok(await button(guest,'Team full').isDisabled());
  const blocked=await guest.evaluate(async({code,token})=>{
    const res=await fetch('/lan-api/team',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code,token,team:0})});
    return res.status;
  },{code,token});
  assert.equal(blocked,409);
  await label(host,'Players per team').selectOption('3');
  await guest.getByText(/3v3 · Standard bots/).waitFor();
  await host.getByText('11',{exact:true}).waitFor();
  await button(host,'Fewer rounds').click();
  await guest.getByText(/Waiting for host · 10 rounds/).waitFor();
  await label(host,'Bot difficulty').selectOption('Expert');
  await guest.getByText(/3v3 · Expert bots/).waitFor();
  await button(guest,'Join Liberals').click();
  await host.getByText('Rowan <LAN> · Liberals',{exact:true}).waitFor();
  await button(guest,'Join Counter Liberals').click();
  await host.getByText('Rowan <LAN> · Counter Liberals',{exact:true}).waitFor();
  assert.equal(await button(guest,'Start match').count(),0);
  const remaining=await pageAt();
  await label(remaining,'Your name').fill('Nova');
  await label(remaining,'Room code').fill(code);
  await button(remaining,'Join room').click();
  await host.getByText('Nova · Liberals',{exact:true}).waitFor();
  await button(host,'Start match').click();
  await host.getByText('Ada · 0 CR',{exact:true}).waitFor();
  await guest.getByText('Rowan <LAN> · 0 CR',{exact:true}).waitFor();
  await button(guest,'Music on').click();
  await button(guest,'Music off').waitFor();
  await button(guest,'Sound effects on').click();
  await button(guest,'Sound effects off').click();
  await button(host,'Ready').click();
  await guest.getByText(/1 \/ 3 ready/).waitFor();
  assert.equal((await snapshot(host)).match.phase,'buy');
  await button(guest,'Ready').click();
  await remaining.getByText(/2 \/ 3 ready/).waitFor();
  await button(remaining,'Ready').click();
  await host.getByText(/3 \/ 3 ready/).waitFor();
  await guest.getByRole('heading',{name:'Preparation'}).waitFor({state:'hidden',timeout:8000});
  await guest.getByText(/^Round 1 \/ 10/).waitFor();
  const before=await snapshot(guest);
  assert.equal(before.match.actors.length,6);
  assert.equal(before.match.actors.filter(actor=>!['Ada','Rowan <LAN>','Nova'].includes(actor.name)).length,3);
  const guestSlot=before.seats[0];
  await guest.getByRole('button',{name:'Music off',exact:true}).focus();
  await guest.keyboard.down('Tab');
  await guest.getByRole('heading',{name:'Scoreboard',exact:true}).waitFor();
  assert.equal(await guest.locator('#board tbody tr').count(),6);
  assert.equal(await guest.evaluate(()=>document.activeElement.textContent),'Music off');
  await guest.keyboard.up('Tab');
  await guest.locator('#board').waitFor({state:'hidden'});
  await guest.getByText(/Ammo 9\/9/).waitFor();
  const soundCount=await guest.evaluate(()=>window.lanSoundStarts);
  const internetMode=await guest.evaluate(async()=>{
    const response=await fetch('/lan-api/info',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    return (await response.json()).internetMode;
  });
  let releaseShot;
  if (internetMode) await guest.route('**/lan-api/fire',async route=>{
    await new Promise(resolve=>{releaseShot=resolve;});
    await route.continue();
  });
  await guest.locator('#arena').click({position:{x:300,y:200}});
  await guest.getByText(/Ammo 8\/9/).waitFor();
  await guest.waitForFunction(count=>window.lanSoundStarts>count,soundCount);
  if (internetMode) {
    assert.equal((await snapshot(host)).match.actors[guestSlot].ammo,9);
    assert.ok(releaseShot);
    const serverConfirm=guest.waitForResponse(async response=>response.url().endsWith('/lan-api/sync') && response.ok() && (await response.json()).shotAck>0);
    releaseShot();
    const confirmed=await serverConfirm;
    assert.equal((await confirmed.json()).match.actors[guestSlot].ammo,8);
  }
  await guest.keyboard.down('a');
  await guest.waitForTimeout(450);
  await guest.keyboard.up('a');
  const after=await snapshot(host);
  assert.ok(after.match.actors[guestSlot].x<before.match.actors[guestSlot].x-20);
  assert.equal(after.match.actors[guestSlot].name,'Rowan <LAN>');
  await guest.keyboard.press('Escape');
  await host.getByRole('heading',{name:'Match paused',exact:true}).waitFor();
  await remaining.getByText('Paused by Rowan <LAN>',{exact:true}).waitFor();
  const stopped=await snapshot(host);
  await host.waitForTimeout(450);
  assert.equal((await snapshot(host)).match.time,stopped.match.time);
  await button(host,'Resume match').click();
  await remaining.getByRole('heading',{name:'Match paused'}).waitFor({state:'hidden'});
  await guest.context().setOffline(true);
  await remaining.getByText('Rowan <LAN> has left the game',{exact:true}).waitFor({timeout:16000});
  await host.keyboard.press('Escape');
  await button(host,'Leave match').click();
  await remaining.getByRole('heading',{name:'Host has left the match',exact:true}).waitFor();
  await remaining.waitForURL(new URL('/',url).href);
  await remaining.getByRole('heading',{name:'LASER STRIKE 2',exact:true}).waitFor();
  await button(remaining,'Play').waitFor();
  await Promise.all([host.close(),guest.close(),remaining.close()]);
}

try {
  const motion=createLanMotion();
  const player={x:160,y:150,angle:0,hp:100}, rival={x:70,y:350,angle:0,hp:100};
  const match={round:1,phase:'active',player,actors:[player,rival],objective:{}};
  const movement={dx:1,dy:0,x:130,y:220};
  motion.receive(match,0);
  const first=motion.frame(16,1/60,movement);
  assert.ok(first.player.x>160 && first.player.x<=167);
  assert.ok(first.player.angle>0);
  const movedRival={...rival,x:95};
  motion.receive({...match,actors:[player,movedRival]},42);
  const interpolated=motion.frame(58,1/60,movement);
  assert.ok(interpolated.actors[1].x>70 && interpolated.actors[1].x<95);
  motion.receive({...match,round:2,actors:[player,movedRival]},83);
  assert.equal(motion.frame(99,1/60,movement).actors[1].x,95);
  const onlineMotion=createLanMotion();
  const sample=(serverTime,x)=>({...match,serverTime,actors:[player,{...rival,x}]});
  onlineMotion.receive(sample(0,70),10);
  onlineMotion.frame(26,1/60,movement);
  onlineMotion.receive(sample(40,74),58);
  onlineMotion.receive(sample(90,79),116);
  onlineMotion.receive(sample(135,83.5),164);
  const rendered1=onlineMotion.frame(170,1/60,movement).actors[1].x;
  const rendered2=onlineMotion.frame(186,1/60,movement).actors[1].x;
  assert.ok(rendered1>70 && rendered2>rendered1 && rendered2<83.5);
  await capacity();
  await lanRoom();
  assert.deepEqual(errors,[]);
  console.log('LAN capacity, teams, movement, shared pause, and departures passed at '+url);
} finally {
  await browser.close();
}
