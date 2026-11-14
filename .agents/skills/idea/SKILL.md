---
name: idea
description: Plan and grow the game with the kids - the 4 choices (Player + View, World, Goal, Twist), turning vague or tiny requests into big connected ideas, and fitting new parts (shops, rooms, loot boxes, mini-games, new modes) into one coherent game. Use at the start (empty world), when the kids type idea, /idea or $idea, when they can't decide, say "it's boring", or ask for something big, vague or unconnected.
---

# Plan it together (the kids decide)

The kids are the designers; their answers win. Your job: offer exciting, specific ideas, build a playable draft
right away, and keep every new part connected to the rest of the game. The plan lives in `our-game.md`: read it
first, update it after every step (short: choices, game map, next steps, later).

## The 4 choices (one at a time, build after each)

| Step | Ask | Then build (first draft, a few minutes) |
|---|---|---|
| 1. Player | "What do you want to be?" then "How should we see it?" (behind, your eyes, from above, from the side, chase cam) | the player moving on the empty floor with WASD, in that view |
| 2. World | "Where are you?" | one small area that looks good: floor, sky, 10-30 real models, not a whole map |
| 3. Goal | "What do you do? How do you win or lose?" | the simplest version that works once (3 coins, 1 enemy, 1 finish line) |
| 4. Twist | "What makes it weird?" | the twist, on a slider so they can make it more or less weird |

- Each question: **3 big, specific ideas + "or your own idea"**, your favorite marked ⭐. Use the menus in
  `AGENTS.md` as ingredients and give each idea personality ("a ghost with a squeaky lantern", "a giant hedge
  maze at sunset"), different for each team. Stay inside the choice you're asking about.
- Order for a new player or world: picture (if it's a new look) → "Like this?" combined with the next question
  (the View for a player) → build. Don't build with a view or look nobody picked.
- If their first message already answers some choices ("a girl in a maze" = Player + World), fill those in and
  ask the next missing one. Never choose for them: a choice is ✅ only when the kids picked it, the Twist too.
- Before building a new character, vehicle or world look, show a picture first (their paper sketch, or
  `npm run preview`, see AGENTS.md). For models, check `public/assets/CATALOG.md`, then `free-assets`.

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

## Example opening (empty world, nothing chosen yet)

> Welcome, game designers! Let's make your 3D game, one choice at a time. First: **who do you want to be?**
> 1. ⭐ a bulldozer that herds runaway sheep across a stormy meadow
> 2. a blob that grows every time it eats something smaller
> 3. a ghost who sneaks past lanterns to deliver secret letters
>
> …or your own idea! (Drawing it on paper and sending a photo works too.)

If their idea copies an existing game's characters or story, suggest an original twist (see AGENTS.md).
Use `game-recipes` for how to build each step.
