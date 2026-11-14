---
name: idea
description: Plan the game with the kids through the 4 choices (Player + View, World, Goal, Twist) and turn big ideas into a small first draft. Use at the start (empty world, empty our-game.md), when the kids type idea, /idea or $idea, when they can't decide what to make, or when a request is big or vague ("make a zombie game", "a huge open world", "add a boss fight").
---

# Plan it together (the kids decide)

The kids are the designers; their answers win. Your job is to offer exciting options, then build a small
playable draft right away. Plan and progress live in `our-game.md`: read it first, update it after every step.

## The 4 choices (one at a time, build after each)

| Step | Ask | Then build (first draft, a few minutes) |
|---|---|---|
| 1. Player | "What do you want to be?" then "How should we see it?" (behind, your eyes, from above, from the side, chase cam) | the player moving on the empty floor with WASD, in that view |
| 2. World | "Where are you?" | one small area that looks good: floor, sky, 10-30 things, not a whole map |
| 3. Goal | "What do you do? How do you win or lose?" | the simplest version that works once (3 coins, 1 enemy, 1 finish line) |
| 4. Twist | "What makes it weird?" | the twist, on a slider so they can make it more or less weird |

Each question: **3 options + "or your own idea"**, your favorite marked ⭐. Pick the 3 from the menus in
`AGENTS.md`, different for each team, and mix one safe and one surprising. If their answer is unclear,
suggest the closest option ("A dragon you ride, or a dragon you are?").

Before building a new character, vehicle or world look, show a picture first (their paper sketch, or
`npm run preview`, see AGENTS.md). For the player model, check `public/assets/CATALOG.md`; if it isn't
there, use `free-assets` or build it from shapes (`character-animation` section 5).

## Big ideas, small first draft

Kids often ask for everything at once ("a huge city with 10 levels, shops, cars and a boss"). Say what you'll
build first in one sentence ("Let's start with one street and your car, then add more"), build that, and put the
rest under **Later** in `our-game.md` so nothing is lost. Grow the game in steps they can play after each one.

## our-game.md

- After each answer, fill in the choice (their words, short).
- Tick a step when it's playable (`- [x]`). Add new steps for their own ideas. Keep 6-10 steps visible.
- End every reply with the progress line, e.g. `✅ Player · ✅ World · ⬜ Goal · ⬜ Twist`, then
  **What next?** with 2-3 numbered options.

## Example opening (empty world, nothing chosen yet)

> Welcome, game designers! Let's make your 3D game, one choice at a time. First: **who do you want to be?**
> 1. ⭐ a bulldozer that pushes things
> 2. a blob that grows when it eats
> 3. a ghost that sneaks past lights
>
> …or your own idea! (Drawing it on paper and sending a photo works too.)

If their idea copies an existing game's characters or story, suggest an original twist (see AGENTS.md).
Use `game-recipes` for how to build each step.
