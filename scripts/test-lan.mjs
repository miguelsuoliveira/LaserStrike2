import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser=await chromium.launch();
const url=process.env.STRIKE_LAN_URL || 'http://localhost:5188/lan.html';
const errors=[];
async function pageAt(address=url) {
  const page=await browser.newPage();
  page.on('pageerror',error=>errors.push(error));
  await page.goto(address);
  return page;
}
const label=(page,value)=>page.getByLabel(value);
const button=(page,name)=>page.getByRole('button',{name,exact:true});
const snapshot=async page=>(await page.waitForResponse(res=>res.url().endsWith('/lan-api/sync') && res.ok())).json();

async function lanRoom() {
  const host=await pageAt(), guest=await pageAt();
  await label(host,'Your name').fill('Ada');
  await button(host,'Create room').click();
  const room=host.getByRole('heading',{name:/^Room [A-Z0-9]{6}$/});
  await room.waitFor();
  const code=(await room.textContent()).split(' ')[1];
  await label(guest,'Your name').fill('Rowan <LAN>');
  await label(guest,'Room code').fill(code.toLowerCase());
  await button(guest,'Join room').click();
  await guest.getByText('Ada · Liberals',{exact:true}).waitFor();
  await host.getByText('Rowan <LAN> · Counter Liberals',{exact:true}).waitFor();
  await label(host,'Players per team').selectOption('3');
  await guest.getByText(/3v3 · Standard bots/).waitFor();
  await label(host,'Bot difficulty').selectOption('Expert');
  await guest.getByText(/3v3 · Expert bots/).waitFor();
  assert.equal(await button(guest,'Start match').count(),0);
  await button(host,'Start match').click();
  await host.getByText('Ada · 0 CR',{exact:true}).waitFor();
  await guest.getByText('Rowan <LAN> · 0 CR',{exact:true}).waitFor();
  await guest.getByRole('heading',{name:'Preparation'}).waitFor({state:'hidden',timeout:18000});
  const before=await snapshot(guest);
  assert.equal(before.match.actors.length,6);
  const guestSlot=before.seats[0];
  await guest.keyboard.down('a');
  await guest.waitForTimeout(450);
  await guest.keyboard.up('a');
  const after=await snapshot(host);
  assert.ok(after.match.actors[guestSlot].x<before.match.actors[guestSlot].x-20);
  assert.equal(after.match.actors[guestSlot].name,'Rowan <LAN>');
  await Promise.all([host.close(),guest.close()]);
}

async function localRoom() {
  const page=await pageAt(url+'?mode=local');
  await label(page,'Your name').fill('Captain');
  await button(page,'Play Local Co-op').click();
  await page.getByText('Captain · Liberals',{exact:true}).waitFor();
  await page.getByText('Player 2 · Liberals',{exact:true}).waitFor();
  await button(page,'Start match').click();
  await page.getByText('Player 2 · 0 CR',{exact:true}).waitFor();
  await page.getByRole('heading',{name:'Preparation'}).waitFor({state:'hidden',timeout:18000});
  const before=await snapshot(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(450);
  await page.keyboard.up('ArrowRight');
  const after=await snapshot(page);
  const [first,second]=before.seats;
  assert.equal(after.match.actors[first].x,before.match.actors[first].x);
  assert.ok(after.match.actors[second].x>before.match.actors[second].x+20);
  await page.close();
}

try {
  await Promise.all([lanRoom(),localRoom()]);
  assert.deepEqual(errors,[]);
  console.log('LAN rooms, names, host settings, remote movement and local co-op passed at '+url);
} finally {
  await browser.close();
}
