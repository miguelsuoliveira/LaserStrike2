import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser=await chromium.launch();
const url=process.env.STRIKE_LAN_URL || 'http://localhost:5188/lan.html';
const publicGame=process.env.STRIKE_PUBLIC_URL;
const errors=[];
async function pageAt(address=url) {
  const page=await browser.newPage();
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
  await label(host,'Bot difficulty').selectOption('Expert');
  await guest.getByText(/3v3 · Expert bots/).waitFor();
  await button(guest,'Join Liberals').click();
  await host.getByText('Rowan <LAN> · Liberals',{exact:true}).waitFor();
  await button(guest,'Join Counter Liberals').click();
  await host.getByText('Rowan <LAN> · Counter Liberals',{exact:true}).waitFor();
  assert.equal(await button(guest,'Start match').count(),0);
  await button(host,'Start match').click();
  await host.getByText('Ada · 0 CR',{exact:true}).waitFor();
  await guest.getByText('Rowan <LAN> · 0 CR',{exact:true}).waitFor();
  await guest.getByRole('heading',{name:'Preparation'}).waitFor({state:'hidden',timeout:18000});
  const before=await snapshot(guest);
  assert.equal(before.match.actors.length,6);
  assert.equal(before.match.actors.filter(actor=>!['Ada','Rowan <LAN>'].includes(actor.name)).length,4);
  const guestSlot=before.seats[0];
  await guest.keyboard.down('a');
  await guest.waitForTimeout(450);
  await guest.keyboard.up('a');
  const after=await snapshot(host);
  assert.ok(after.match.actors[guestSlot].x<before.match.actors[guestSlot].x-20);
  assert.equal(after.match.actors[guestSlot].name,'Rowan <LAN>');
  await Promise.all([host.close(),guest.close()]);
}

try {
  await lanRoom();
  assert.deepEqual(errors,[]);
  console.log('LAN rooms, names, host settings, and remote movement passed at '+url);
} finally {
  await browser.close();
}
