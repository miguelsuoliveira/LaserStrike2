# Talking characters, signs, quests

```js
// src/game/npcs.js
import { createCharacter, input, near, ui, sfx } from '../engine/index.js';

export const npcs = [];

export async function addNpc(model, position, lines) {
  const npc = await createCharacter({ model, position, height: 1.8 });
  npc.lines = lines; // what they say, one line per E press
  npc.lineIndex = -1;
  npcs.push(npc);
  return npc;
}

let talkingTo = null;

export function updateNpcs(dt, player) {
  const close = npcs.find((n) => near(n.position, player.position, 2.5));
  if (close && !talkingTo) ui.text('hint', 'Press E to talk', { at: 'bottom' });
  else if (!close) {
    ui.remove('hint');
    if (talkingTo) stopTalking();
  }
  if (close && input.pressed('interact')) {
    talkingTo = close;
    close.lineIndex++;
    turnTowardsNow(close, player);
    if (close.lineIndex >= close.lines.length) return stopTalking();
    ui.remove('hint');
    ui.text('dialog', close.lines[close.lineIndex], { at: 'bottom', size: 24 });
    sfx('click');
    close.action('Interact');
  }
}

function stopTalking() {
  if (talkingTo) talkingTo.lineIndex = -1;
  talkingTo = null;
  ui.remove('dialog');
}

function turnTowardsNow(npc, player) {
  npc.object.rotation.y = Math.atan2(player.position.x - npc.position.x, player.position.z - npc.position.z);
}
```

Usage in `setup()`:
```js
await addNpc('assets/models/characters/mage.glb', [5, 0, 5], [
  'Hello traveler!',
  'The crystal was stolen by the skeleton king.',
  'Bring back 3 gems and I will open the gate.',
]);
```

## Quests (simple)

Keep a variable: `let quest = 'find-gems'`. Change what the NPC says based on it, e.g. pick
`lines = gems >= 3 ? ['You did it! The gate is open.'] : [...]`, and when done: `quest = 'done'`,
open the door (see `levels.md`), `ui.message('Quest complete!')`.

## Signs and notes

`near(player.position, sign.position, 2)` → `ui.text('sign', 'Danger: lava ahead', { at: 'bottom' })`,
else `ui.remove('sign')`. A sign model: two boxes (post + board) with `texture: 'assets/textures/wood_planks'`.

## Speech bubble over a head

`fx.popup(npc.position.clone().setY(2.3), 'Hi!', { color: '#ffffff', seconds: 2 })` - quick and floaty.
