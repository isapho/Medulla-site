# Prompts: one emotion per chat, all five characters at once

How to use, for each emotion:
1. Open a new chat in your image tool.
2. Attach the character sheet (Dendi, Lumi, Memo, Octa, Syno, in that order).
3. Paste the BASE below, then add ONE scene line under it. Send.
4. Name the result `all_<scene name>.png`, for example `all_hello.png`.
5. Compare with the sheet. If any face, colour or shape drifted, regenerate it.

Then send the images to the developer: each character is cut out and saved as
`<character>_<scene>.webp`, and wired into the site.

## BASE (paste this first, every time)

```
Reference image: five mascots in a row, left to right: Dendi (purple neuron
with branching dendrites), Lumi (firefly), Memo (elephant), Octa (octopus),
Syno (jellyfish).

Draw the same five characters again, in the same order and the same positions,
now expressing the emotion or situation described below.

Strict rules:
- Keep every character exactly as in the reference: same shape, proportions,
  colours, outline style, soft shading, eyes, cheeks and level of detail.
  Do not redraw, restyle, recolour or make anything more realistic.
- Change only the pose, the eyes and mouth, and small body movements. Each
  character expresses the emotion in its own way.
- Same image size and layout as the reference (wide, five characters in a row,
  each fully visible with space around it, nobody overlapping).
- Same flat plain background as the reference, no floor, no shadows on the
  ground, no border, no text, no letters, no watermark.
- No new clothes or accessories. Props only where the scene says so, in the
  same style, using only these colours: deep navy #0D1128, purple #6C5CE7,
  lavender #A29BFE, white #FFFFFF, orange #FF9F43.
- Friendly and gentle for children. Never scary, aggressive, sarcastic or
  crying.
```

## Scenes (add one under the BASE)

### Must have

| # | Name | Used for | Scene line |
|---|---|---|---|
| 1 | `hello` | Welcome, onboarding, home | `Scene: HELLO. All five wave hello with a warm smile. Dendi waves with one dendrite, Lumi waves one wing, Memo waves with the trunk, Octa waves with two tentacles, Syno waves with one tentacle.` |
| 2 | `curious` | Loading, search, "did you know" | `Scene: CURIOUS AND THINKING. Heads tilted, eyes looking up to one side, one eyebrow slightly raised. Dendi raises one dendrite like a finger, Lumi hovers with antennae wiggling, Memo touches its chin with the trunk, Octa holds up the magnifying glass, Syno tilts and looks around.` |
| 3 | `aha` | Fact reveal, new discovery | `Scene: AHA, DELIGHTED SURPRISE. Eyes wide, small happy "O" mouth, a tiny orange spark near each. Dendi's dendrite tips glow orange, Lumi's glow flares, Memo's trunk goes up, Octa lifts all arms, Syno's bell lifts.` |
| 4 | `correct` | Right answer | `Scene: PROUD AND HAPPY. Eyes closed in a contented smile, a small proud nod, a few tiny orange sparkles. Dendi stands tall, Lumi glows warmly, Memo spreads its ears, Octa folds two arms proudly, Syno bobs up happily.` |
| 5 | `tryagain` | Wrong answer, gently | `Scene: GENTLE ENCOURAGEMENT, "almost, try again". A soft kind smile, head tilted slightly, a small friendly shrug. Not sad, not disappointed. Dendi tilts a dendrite, Lumi flutters closer, Memo curls its trunk, Octa opens two arms, Syno sways softly.` |
| 6 | `focus` | Games running | `Scene: CONCENTRATING. Eyes slightly narrowed and fixed forward, the tip of a tongue out, leaning slightly forward. Dendi's dendrites point forward, Lumi holds perfectly still, Memo frowns in thought, Octa's arms hover ready, Syno floats very still.` |
| 7 | `win` | Daily challenge done, badge, level up | `Scene: CELEBRATION. Big open smile, eyes sparkling, jumping or floating up with arms raised, a few small orange and lavender sparkles (no confetti, no text). Dendi raises both dendrites, Lumi loops in the air, Memo raises trunk and ears, Octa raises all arms, Syno bounces up.` |
| 8 | `inhale` | Breathing in | `Scene: BREATHING IN, calm. Eyes closed, a peaceful small smile, bodies slightly bigger and lifted. Dendi lifts its dendrites, Lumi rises gently, Memo's chest is full and trunk lifted, Octa's arms float up, Syno's bell expands and rises.` |
| 9 | `exhale` | Breathing out | `Scene: BREATHING OUT, calm. Eyes closed, relaxed small smile, bodies slightly smaller and lower, shoulders dropped. Dendi's dendrites relax down, Lumi settles lower, Memo's trunk rests, Octa's arms drift down, Syno's bell narrows and sinks.` |
| 10 | `asleep` | Night mode, sleep | `Scene: FAST ASLEEP. Eyes closed, curled up or resting, a few small lavender "Z" shapes floating above, glows very soft and dim. Dendi leans against its own body, Lumi curled with a faint glow, Memo with ears wrapped, Octa with arms tucked, Syno hovering low.` |

### Nice to have

| # | Name | Used for | Scene line |
|---|---|---|---|
| 11 | `ready` | Reaction test waiting, countdown | `Scene: READY, STEADY. Leaning forward like a sprinter before the start, eyes locked straight ahead, a determined little smile. Dendi crouches, Lumi hovers tense, Memo plants its feet, Octa braces on its arms, Syno leans forward.` |
| 12 | `oops` | Pressed too early, small mistake | `Scene: OOPS, SHEEPISH. An embarrassed smile with rosier cheeks, one small lavender sweat drop, one hand or limb scratching the head. Dendi scratches with a dendrite, Lumi covers its eyes with a wing, Memo covers its mouth with the trunk, Octa scratches its head with one arm, Syno hides half behind its tentacles.` |
| 13 | `reading` | Fact page, reader | `Scene: READING AND LEARNING. Calm, focused eyes looking down at a small open navy book (each holds or has one; Lumi lands on it and lights it softly). Gentle smiles.` |
| 14 | `kind` | Kindness wall, Syno tasks | `Scene: KINDNESS. Each character holds out one small orange heart toward the viewer with a warm, shy smile. Dendi with a dendrite, Lumi with its feet, Memo with its trunk, Octa with one arm, Syno with one tentacle.` |
| 15 | `comfort` | Parents page, gentle moments | `Scene: COMFORT AND CARE. Each character hugs itself with a calm, safe smile and half-closed eyes, leaning slightly toward the next one as if close friends. Dendi crosses its dendrites, Lumi wraps its wings, Memo wraps its trunk, Octa wraps its arms, Syno wraps its tentacles.` |
| 16 | `sleepy` | Wind-down, "time for bed" | `Scene: SLEEPY. A big yawn, half-closed eyes, drooping posture, glows dimmed. Dendi's dendrites droop, Lumi's wings sag, Memo's ears droop, Octa's arms hang, Syno sinks slightly.` |
| 17 | `goodnight` | End of wind-down | `Scene: GOOD NIGHT. A sleepy smile, eyes half closed, a slow wave. Dendi waves one dendrite, Lumi waves one wing, Memo waves its trunk, Octa waves one arm, Syno waves one tentacle.` |
| 18 | `offline` | No internet page | `Scene: LOST, LOOKING AROUND. Head tilted, eyes glancing left and right, one limb shading the eyes as if searching. A calm, slightly puzzled look, not worried. Dendi tilts its dendrites in different directions, Lumi hovers looking down, Memo turns its head, Octa holds the magnifying glass out, Syno looks over its shoulder.` |
| 19 | `safe` | Privacy page, "your data is yours" | `Scene: PROTECTING. The five stand close together in a loose half circle around one small glowing orange dot on the ground between them, shielding it gently with arms, wings, trunk and tentacles. Calm, kind and reassuring faces.` |

Why the order: scenes 1 to 10 cover every place the site shows a character
reacting (welcome, facts, quiz, games, win, breathing, sleep). The rest add
polish and can wait.

## Status (12 October 2026)

Received and cut out: hello, curious, aha, correct, tryagain, win, inhale, exhale, asleep (in use, except Syno aha/inhale/exhale/asleep).
To redo: **focus** (all five look angry; ask for a calm, determined look, no frown) and Syno in aha, inhale, exhale and asleep (the body changed and the orange spark is missing).
Not yet generated: ready, oops, reading, kind, comfort, sleepy, goodnight, offline, safe.
