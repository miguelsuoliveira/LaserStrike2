#!/usr/bin/env node
// Idea sparks: a few random ingredients, so every team gets different suggestions instead of
// the same "obvious" ones. The AI twists them into the kids' own theme (and never shows the list).
//   npm run spark                  sparks for the stage the team is in (read from our-game.md)
//   npm run spark -- world         theme | world | player | goal | mechanics | details
// `npm run status` (the AI's first command for every message) prints them too, with where the team is.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Everything here is buildable with this engine and its free model sources, original, and fine for 12-year-olds.
const LISTS = {
  place: [
    'a lighthouse on a rock', 'the inside of a giant clock', 'a night market on rooftops', 'a flooded library',
    'a canyon of giant mushrooms', 'a train yard above the clouds', 'a frozen harbor', 'a garden on a whale\'s back',
    'an abandoned fairground', 'a desert of broken statues', 'a table top seen by something tiny',
    'a swamp with glowing lilies', 'a greenhouse on the moon', 'a village on stilts', 'a scrapyard of old machines',
    'an observatory on a volcano', 'a crystal cave', 'a bamboo forest in fog', 'a city made of cardboard',
    'an island that is a sleeping turtle', 'a mine with rail tracks', 'a museum after closing time', 'a beehive city',
    'a graveyard of ships', 'a sky full of kites and balloons', 'a monastery on a snowy peak', 'a toy shelf',
    'a bathtub ocean', 'a rooftop garden in a storm', 'a maze of hedges', 'a sunken temple', 'a candy factory at night',
    'a floating market on canoes', 'a windmill farm', 'a canyon with rope bridges', 'an ice rink on a lake',
    'a tree so big it holds a town', 'a space station with a garden', 'a pier with arcade machines', 'a dragon\'s attic',
  ],
  mood: [
    'at sunrise with long shadows', 'in thick fog', 'during a meteor shower', 'in the rain, full of puddles',
    'at night, lit by lanterns', 'in a sandstorm', 'under northern lights', 'in golden autumn', 'after fresh snow',
    'under a giant moon', 'with everything a bit tilted', 'overgrown with vines', 'half under water',
    'glowing in the dark', 'seen from very close up', 'far too big for you', 'just before a thunderstorm',
    'on the hottest day of summer', 'where it is always sunset', 'with wind that never stops', 'upside down',
    'painted in only two colors', 'quiet, as if everyone just left', 'in the middle of a festival',
  ],
  landmark: [
    'a huge tree you can see from everywhere', 'a broken bridge', 'a tower with a light on top',
    'a giant sleeping creature', 'a crashed ship', 'a windmill that never stops', 'a waterfall', 'a door standing alone',
    'a giant bell', 'a spiral staircase to nowhere', 'a wishing well', 'a crane', 'a ferris wheel', 'a giant skeleton',
    'a ring of standing stones', 'a rocket that never launched', 'a huge clock', 'a statue missing its head',
    'a hot-air balloon tied to the ground', 'a slide as tall as a house', 'a giant teapot', 'a frozen fountain',
  ],
  who: [
    'a nervous delivery robot', 'a round bird that flies badly', 'a lantern keeper', 'a tiny knight', 'a fox', 'a frog',
    'a crab', 'a shy ghost', 'a baby dragon', 'a penguin', 'a wizard\'s apprentice', 'a cat', 'a mushroom creature',
    'a little submarine', 'a kart', 'a forklift', 'a rolling ball', 'a bee', 'a turtle', 'a hovercraft',
    'a skeleton afraid of the dark', 'a paper plane', 'a tractor', 'a bat', 'a duck', 'an astronaut', 'a snowman',
    'a goldfish in a bowl on wheels', 'a raccoon', 'a tiny tugboat', 'a wind-up toy', 'a blob', 'a sheepdog',
    'a mail carrier on a scooter', 'a living suitcase', 'a sleepy bear', 'a UFO', 'a snail', 'an octopus',
  ],
  quirk: [
    'who is always late', 'that glows when it is happy', 'that is afraid of water', 'that leaves a trail behind',
    'twice as big as it should be', 'as small as a coin', 'in a far too big hat', 'carrying something fragile',
    'that bounces instead of walking', 'with a loyal pet following', 'that changes color with speed',
    'that can\'t turn left very well', 'made of the wrong material (jelly, paper, ice)', 'that sneezes fire',
    'that grows when it eats', 'that hums when something is near', 'with one enormous arm', 'wearing a backpack rocket',
    'that is very sleepy', 'held together with tape',
  ],
  move: [
    'glides after a jump', 'dashes in short bursts', 'rolls fast downhill', 'jumps twice', 'hovers for one second',
    'slides on its belly', 'stomps so things shake', 'swims', 'flies when it flaps (Space)', 'drifts around corners',
    'bounces higher each time', 'sticks to walls for a moment', 'charges up a super jump', 'spins like a top',
  ],
  goal: [
    'bring something home before dark', 'wake up something that is asleep', 'light every lantern',
    'catch something that keeps escaping', 'keep something safe until help comes', 'find the parts and fix a machine',
    'reach the very top', 'deliver to the right doors', 'herd a group into place', 'get out before the place changes',
    'feed something very hungry', 'beat a rival to it', 'gather pieces and build something big',
    'clean up a giant mess', 'make something grow', 'sneak past the guards', 'open the way with switches and doors',
    'last through the waves', 'rescue lost friends', 'push things where they belong', 'paint the whole place',
    'put out the fires', 'collect a set of rare things', 'guide something slow and helpless', 'ring all the bells',
    'steal back what was taken', 'cross without touching the floor', 'win the big race',
  ],
  stakes: [
    'before the timer runs out', 'without being seen', 'while the floor disappears', 'with only three hearts',
    'before a rival does it first', 'while carrying something that slows you down', 'in the dark',
    'as everything gets faster', 'while something chases you', 'before the water rises', 'without dropping it',
    'while the wind pushes you', 'with a battery that runs down', 'before the ice melts',
  ],
  rule: [
    'what you carry changes how you move', 'everything you touch changes color', 'day and night swap every minute',
    'you grow when you collect', 'the ground you step on crumbles', 'gravity is weak', 'you can\'t stop moving',
    'a pet copies you one second later', 'noise attracts trouble', 'light keeps you safe', 'things you push keep sliding',
    'you can swap places with an object', 'wind pushes everything', 'your trail does something',
    'enemies freeze when you look at them', 'you can shrink and grow', 'doing it fast gives a combo',
    'you can pick up and throw anything', 'you are a magnet', 'time slows when you stand still', 'everything bounces',
    'you get heavier with every thing you collect', 'the map floods a little every minute', 'you can stack things to climb',
    'what you eat gives you its power', 'your shadow is solid', 'you can only see close to your lamp',
    'the thing you chase gets smarter', 'you can freeze one thing at a time', 'the goal moves',
  ],
  detail: [
    'a win dance', 'the team\'s own voices as sound effects', 'a hand-drawn logo', 'a hidden secret to find',
    'confetti', 'footstep dust', 'music that speeds up near the end', 'credits with first names',
    'a title screen drawn on paper', 'a trophy room', 'a silly name for the player', 'a best-time record',
    'a slow-motion moment', 'a drawing of theirs hanging in the world', 'a funny lose screen', 'weather that changes',
  ],
};

// Which ingredients help in which stage.
const STAGES = {
  theme: ['place', 'who', 'rule'],
  world: ['place', 'mood', 'landmark'],
  player: ['who', 'quirk', 'move'],
  goal: ['goal', 'stakes', 'goal'],
  mechanics: ['rule', 'rule', 'stakes'],
  details: ['detail', 'detail', 'mood'],
};

export function sparks(stage = 'theme') {
  const kinds = STAGES[String(stage).toLowerCase()] || STAGES.theme;
  const out = [];
  for (const kind of kinds) {
    const list = LISTS[kind].filter((s) => !out.includes(s));
    out.push(list[Math.floor(Math.random() * list.length)]);
  }
  return out;
}

// Where the team is, from our-game.md: { theme, stage, rounds, started }.
export function readPlan(root = ROOT) {
  let text = '';
  try {
    text = fs.readFileSync(path.join(root, 'our-game.md'), 'utf8');
  } catch {}
  const theme = (text.match(/\*\*Theme:\*\*[ \t]*(.*)/)?.[1] || '').trim();
  const started = !!theme && theme !== '?';
  const order = ['World', 'Player', 'Goal', 'Mechanics', 'Details'];
  const now = text.match(/^\s*-\s*🔨\s*\*\*(\w+)/m)?.[1];
  const open = order.find((s) => new RegExp(`^\\s*-\\s*⬜\\s*\\*\\*${s}`, 'm').test(text));
  const stage = !started ? 'Theme' : now || open || 'Details';
  const rounds = (text.match(new RegExp(`^\\s*-\\s*\\[x\\]\\s*${stage}\\b`, 'gim')) || []).length;
  const next = order[order.indexOf(stage) + 1] || null;
  return { theme: started ? theme : '', stage, rounds, started, next };
}

// What the stage and the rounds built so far mean for the AI's next reply.
export function planAdvice(plan) {
  if (!plan.started) {
    return (
      'New team, nothing chosen yet. Unless their message already tells you their idea: greet them in one sentence and\n' +
      'ask for their idea (in their own words, or a photo of their whiteboard),\n' +
      'and add 3 fresh, very different ideas to pick from in case they have none yet. No setup talk, no tour of the project.\n' +
      'They told you their idea already? Fill in what it answers and build the World.'
    );
  }
  const { stage, rounds, next } = plan;
  let advice;
  if (rounds === 0) advice = 'open it: its question with 3 fresh, very different ideas grown from their theme, then build the first draft.';
  else if (rounds === 1) advice = `offer 2-3 directions that push the ${stage} further, each a different kind of change.`;
  else if (next && rounds === 2) advice = `offer 2 directions that push the ${stage} further, plus the door to ${next} as the third option.`;
  else if (next) advice = `it has had enough rounds: make the door to ${next} the starred option (keep one option that deepens the ${stage}).`;
  else advice = 'offer finishing touches, and things that grow the whole game (keep the game map connected).';
  return `Team: theme "${plan.theme}". Stage now: ${stage}, ${rounds} round${rounds === 1 ? '' : 's'} built. If this message doesn't ask for something else, ${advice}`;
}

export function sparkLine(stage) {
  return (
    `Idea sparks (${stage.toLowerCase()}; random, different every time): ${sparks(stage).join(' | ')}. ` +
    'The kids\' own words come first: twist a spark into an option only where it fits their theme, at most one per ' +
    'option, and never show or mention this list.'
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  const stage = arg && STAGES[arg.toLowerCase()] ? arg : readPlan().stage;
  console.log(sparkLine(stage));
}
