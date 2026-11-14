---
name: explain
description: Explain the game's code or the last change like to a curious 12-year-old, then give a small "Code Detective" challenge they can do by hand. Use when kids ask "what did you do?", "how does this work?", "explain", type /explain, or want to learn to change things themselves.
---

# Explain it like I'm 12

1. Say what the code does in **3 sentences or fewer**, using game words, not programming words.
   Compare to real life ("`update` runs 60 times a second, like a flipbook").
2. Point to where it lives: file and line (`src/game/enemies.js` line 24), and show **at most 5 lines**
   of code with one comment per line in plain English.
3. Give a **Code Detective** challenge they do themselves in the editor, with no AI:
   - "Find the line that sets how fast enemies walk. Change 2.2 to 6. Save. What happens?"
     (Check `src/tuning.json` first: if the kids moved that slider, their saved value wins and the
     challenge would do nothing. Then point them to the line in `src/tuning.json` instead, or pick another.)
   - "Find where the coin sound plays. Change `'coin'` to `'laser'`."
   - "Find the color of the lava. Make it purple ('#9b30ff')."
   Pick something safe (a number, a word in quotes, a color) where a mistake can't break much.
4. Offer a "predict, then test" question: "If we double `gravity`, will jumps be higher or lower?"

Words to explain if you use them (once, briefly): variable (a labeled box for a value), function
(a recipe of steps with a name), loop (do this for every coin), if (only when...), array (a list),
object (a thing with named parts), import (borrow code from another file).

Never dump big blocks of code. Keep it fun and quick.
