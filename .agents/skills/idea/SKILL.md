---
name: idea
description: Run the game design workshop with the kids - the Theme question, then the 5 stages (World, Player + View, Goal, Mechanics, Details) built in rounds, with fresh ideas for every next step; turning vague or tiny requests into big connected ideas, and fitting new parts (shops, rooms, loot boxes, mini-games, new modes) into one coherent game. Use at the start (empty world), when opening a stage or offering what's next, when the kids type idea, /idea or $idea, when they can't decide, say "it's boring", or ask for something big, vague or unconnected.
---

# Design it together (the kids decide)

The kids are the designers; their answers win. Your job: offer exciting, specific ideas, build a playable draft
right away, and keep every new part connected to the rest of the game. The plan lives in `our-game.md`: read it
first, update it after every round (short: theme, stages, game map, rounds built, later).

## Theme first, then 5 stages, a few rounds each

| Stage | Ask | First draft (a few minutes) | Later rounds: kinds of change to offer |
|---|---|---|---|
| Theme | "What should your game be about?" | nothing: it opens the World | |
| 1. World | "Where does it happen?" | one small area that looks good and can be walked through: floor, sky, 10-30 real models, not a whole map | a landmark · the mood (time, weather, light, fog, sound) · life (things that move, wander, grow) · shape (heights, paths, a secret corner) |
| 2. Player | "Who are you here?" then "How should we see you?" (behind, your eyes, from above, from the side, chase cam) | that character moving through their world, in that view | a way of moving · a look · one thing only it can do · a companion |
| 3. Goal | "What are you trying to do? How do you win, how do you lose?" | the simplest version that works once (3 things, 1 enemy, 1 finish line) | what's in the way · how it gets harder · why play again |
| 4. Mechanics (the actions and rules that make the game work) | "What do you do again and again? What's the weird rule only your game has?" | one action that feels good + what the world does back | a second rule that plays with the first · risk for reward · earn and spend · the twist (on a slider, so they can make it more or less weird) |
| 5. Details | "What makes it feel finished and yours?" | sounds and effects on the main action | name and title screen · their drawings and voices · win and lose moments · credits |

**How a stage runs**

1. **Open it** with its question and **3 fresh ideas + "or your own idea"**, your favorite marked ⭐. New look
   (a world, a character)? Picture first, then "Like this?" combined with the question (the other takes for a
   world, the View for a player). Don't build a look or view nobody picked.
2. **Build the first draft** right away, see it in a snap, save (the save prints the checked public link for
   your reply), write the round into `our-game.md`.
3. **Offer the next round:** 2-3 directions that push this stage further, each a *different kind* of change from
   the last column (never "more of the same", and never all of them at once).
4. **After two rounds** one option is the door to the next stage, as a question that makes them curious about
   it; **after three rounds** the door is the ⭐. The kids decide: a stage is ✅ only when they take the door or
   jump ahead, and they can always come back.

While the World is being built, the kids walk around in it as an invisible first-person explorer (already in
`src/game/game.js`): "go and look behind the tower" is a fine way to end a reply. The Player stage replaces it.

If their first message already answers several stages ("a girl in a maze" = Theme + World + Player), fill those
in, start with the World anyway, and ask only what's missing when its stage comes. Never choose for them.

The stages are a path, not a gate. The kids plan on a whiteboard between building, so they may come back with
a whole new part decided (the goal and the rules, for example): take it, mark that stage 🔨 and build its first
draft, without walking them through the stages they skipped.

## Fresh ideas (the heart of the workshop)

An idea is fresh when it could only belong to *this* team's game. For every set of options:

1. **Start from them:** their theme, their exact words, their sketch, the thing they laughed about, what's
   already built. Reuse their words in the option.
2. **Push past the obvious.** Think of the first version everybody would suggest, then change one thing about it:
   who does it, what it's made of, what it costs, when it happens, what it does to the rest of the game.
3. **Go in different directions.** Three options = three different feelings (cozy / wild / funny, or safe /
   risky / strange), not small, medium and large.
4. **One sentence, with a picture and a verb in it,** so they can already see themselves playing it. No lists of
   features, no "add more X".
5. **Sparks:** `npm run status` prints a few random ingredients with every message (more:
   `npm run spark -- world | player | goal | mechanics | details | theme`). Twist one into an option when it fits
   their theme, drop the rest, never show the list. They exist so two teams never get the same suggestions.
6. **Check before you send:** would this option fit any other game unchanged? Did you already offer it? Is it in
   the stage they're in? Fix or replace it.

Unpicked options go under "Later" in `our-game.md` and are not offered again (bring one back only when the kids
ask "what else?").

## Read between the lines

Kids often ask for tiny steps ("add a lamp", "more sofas", "add coins, it's boring") while they picture a bigger
game, often one they've played. Each time, think:
1. What game are they imagining? What feeling is missing (challenge, surprise, progress, owning stuff, speed,
   power, a little fear, silliness)?
2. What one layer would make the whole game feel like that, building on what exists?

Build the small thing, then offer the big layer as option ⭐ in one exciting sentence. Examples:

| They ask | They probably want | Offer |
|---|---|---|
| "add coins", then "a shop", then "more furniture", then "go back and earn more" | a build-your-dream-room progression game | "Every maze earns coins, the shop gets fancier furniture as mazes get harder, and a rare chest hides in each maze" |
| "add a sword", "add more enemies", "make them stronger" | an adventure where you get more powerful | "Each enemy wave drops loot; better swords unlock in the camp, and a boss guards the last gate" |
| "make the car faster", "add a ramp", "add another ramp" | stunts and showing off | "A stunt park: tricks in the air earn points that unlock new cars and wilder ramps" |
| "it's boring" (and nothing else) | not enough surprise or goal | ask what they love in a game they play, then offer 2-3 directions that change how it plays, not just more stuff. If they also said what they want, build that |

## Keep it one game (the game map)

Fill the **Game map** in `our-game.md` once there's a goal, and keep it current:
- **Core loop:** what you do again and again (explore the maze → solve walls → earn coins).
- **Places:** where you go and how you get between them (maze → door → shop → your room → door back).
- **Progress:** what you earn, what it unlocks, what gets harder.
- **Extras:** decorating, collections, mini-games, pets, characters.

Every new request gets a spot on the map and a connection to the loop: what you earn or find there, where you
spend or show it. Loot boxes cost coins from the maze and drop room items; a mini-game is a special door with a
rare prize; new characters could be unlocked with coins (offer it; if they want a pick at the start, do that).
If a request doesn't connect, suggest the version that does. Reuse the same coins, shop and controls instead of starting a separate game.

## The opening (empty world, nothing chosen yet)

`npm run status` has opened the game on their screen (without a word to them about setup). The kids usually
come from their whiteboard with an idea already, so ask for that first; the three
ideas are only for a team that has none yet. Your first reply has this shape: the words in `<...>` are yours
to invent, new for every team.

> Welcome, game designers! 🎮 Your world is open and empty: walk around with W A S D.
>
> 🔨 World · ⬜ Player · ⬜ Goal · ⬜ Mechanics · ⬜ Details
> 🔗 `<the public link the command just printed>`
>
> **What's your idea?** Tell me in your own words, or send a photo of your whiteboard. No idea yet? Pick one
> to start from:
> 1. ⭐ `<an idea in a few words: a picture and a feeling>`
> 2. `<a very different one>`
> 3. `<another one, different again>`

No setup talk, no commands, no list of controls beyond that one line, no explanation of the stages.

If their very first message already tells you the idea, skip this
question: answer with the picture of their place and "Like this?" (see "How a stage runs").

If their idea copies an existing game's characters or story, suggest an original twist (see AGENTS.md).
Use `game-recipes` for how to build each step.
