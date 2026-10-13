# Medulla

Website and web app for **Medulla**, a student-run brain-health project from Uzbekistan.
*Mind • Learn • Grow*

Plain HTML, CSS and JavaScript in **Uzbek (default), Russian and English**. It
works with no backend and no keys. An optional build script pre-renders pages
for search engines. Sync across devices, a Telegram channel bot and an
interactive Telegram bot are optional add-ons.

**New in 2.6:** the Telegram bot can send the **fact of the day every day**
(opt-in with `/daily`, at 08:00, 13:00 or 18:00 Tashkent time, `/stop` to end
it) and follows the app: a `/map` of the five brain-care areas, and every fact
shows its area and character. A GitHub Action also adds **1–2 new sourced
facts automatically every day** (`tools/auto-fact.mjs`: trusted health sites
only, the evidence sentence must be on the fetched page, a second fact-check,
still "Pending expert review"). See `telegram/BOT.md` and `HANDOFF.md`.

**New in 2.4:** My Medulla is a **brain map**: five daily habits (sleep,
movement, learning, calm, discovery), one per character, with a 30-second
check-in, each habit tied to a checked fact, its own level, and a small
"experiment" comparing the visitor's own sleep with their reaction time. The
app's sidebar became a game-style top bar. See "How the parts connect" below.

**New in 2.3:** the public site (landing, about, parents, events…) and the
app (My Medulla, facts, Lab) are now separate: visitors see the landing with
**Sign in** / **Get started**, signed-in visitors get an app with its own top bar
(phones: tab bar). Sign-in still needs no account. The logo is the team's
wireframe brain. See `CHANGELOG.md`.

**New in 2.1:** an Accessibility & comfort panel with six profiles for
different brains (Focus, Easier reading, Calm senses, Seizure-safe, Simple &
slow, See better), a dark theme, read aloud, hard words explained everywhere,
a glossary page, the interactive Telegram bot, the team's clean character
cut-outs at double resolution, and new imagery. See `CHANGELOG.md`.

- **What only you can do, in order:** [`HANDOFF.md`](HANDOFF.md)
- **Why things are built this way, with sources:** [`RESEARCH.md`](RESEARCH.md)
- **Fonts, art, sounds, sources:** [`CREDITS.md`](CREDITS.md) · **What changed:** [`CHANGELOG.md`](CHANGELOG.md)

---

## Decisions made

1. **No framework and no build step needed to run it.** The site is plain files.
   `node tools/build.js` (Node only, no packages) adds pre-rendered pages for
   search engines and link previews. Vite or React would add a toolchain the
   team would have to maintain, for no gain at this size.
   See RESEARCH.md §7.
2. **Guest first, no accounts.** Progress (XP, badges, saved facts, results)
   stays in the browser. Uzbekistan's personal data law (Art. 21) requires
   written parental consent for minors' data, so by default nothing is sent
   anywhere. Optional sync uses a random code instead of an email and asks
   under-18s to confirm a parent or guardian agreed. See RESEARCH.md §2.
3. **Gentle progress, no manipulation.** There are no leaderboards, push
   notifications, random rewards or loss warnings. One or two missed days never
   break a streak. The only comparison is an opt-in school-club total.
   See RESEARCH.md §1.
4. **Honest brain games.** Every activity ends with "what this measures" and
   "what it doesn't show". The site never claims to raise IQ. Research mode
   stays "coming soon" until there is ethics approval and parental consent.
   See RESEARCH.md §6.
5. **Motion without libraries.** The hero's neural pathways are drawn on a canvas, and
   everything else uses CSS and the Web Animations API. That adds 0 KB, against
   45 to 491 KB for GSAP, Lottie or Rive. Sound is synthesized, off by default,
   and always has a visual equivalent. Calm mode and the system's
   reduced-motion setting switch off all movement. See RESEARCH.md §3–4.
6. **Free hosting on GitHub Pages**, deployed by a GitHub Action. Optional
   Supabase for sync and counters, called with plain `fetch` (no SDK). The
   Telegram bot runs as a daily GitHub Action. See RESEARCH.md §5 and §7.
7. **Every placeholder lives in `js/config.js`.** No invented names, numbers,
   partners or photos. All health content is labelled "Pending expert review".
   Since 2.1, visitors see **only what is real**: empty values are hidden instead
   of showing dashed "TBD" boxes. The team can see every missing value with
   `?placeholders=1` (or `showPlaceholders: true` in the config).
8. **Accessibility is personalisation, not a separate site.** One panel (same
   place on every page, Alt + A) with six profiles that are just bundles of
   settings. No diagnosis is asked for or stored. Extra spacing is offered
   instead of "dyslexia fonts", because the research supports spacing and not
   the fonts. See RESEARCH.md §8.
9. **Hard words are explained where they appear.** `data/glossary.json` feeds
   the dotted-underline explanations, the glossary page and the bot's `/word`.
10. **The Telegram bot stores nothing, unless someone asks for the daily
    fact.** One dependency-free core (`telegram/assistant.mjs`) runs with long
    polling or as a free Cloudflare Worker; language travels inside the
    buttons; quizzes are anonymous polls. `/daily` (2.6) is opt-in, private
    chats only, and keeps just the chat's number, language and chosen hour
    until `/stop`. See RESEARCH.md §9 and `telegram/BOT.md`.
11. **Character art is the team's (2.2).** The team made every expression in
    Gemini as green-screen sheets with a white sticker border; `tools/cutout.mjs`
    only removes the green (un-mixing edge colours so nothing fringes), splits
    the poses and gives each character the same body size in every pose. The
    drawings are not changed. Raster (WebP) instead of vector, because tracing
    would flatten the soft shading. Decorative scenes (glass brain, neurons,
    night sky, waves) were generated with Canva AI and are labelled in
    CREDITS.md; they show no people.
12. **One icon language.** Icons are inline SVG with rounded 2 px strokes, a
    soft tinted body and solid accents, and they sit on glossy gradient tiles.
    They follow `currentColor`, so one set works on white, on purple buttons
    and in the dark theme.
13. **A public site and a separate app (2.3).** Visitors first see what Medulla
    is (landing, about, parents, events, partners, join); the personal part
    has its own interface (a top bar and, on phones, a tab bar) once they sign in. Signed-in
    visitors skip the landing and land on their dashboard, like most learning
    apps. `js/prefs.js` does these redirects in `<head>`, so no page flashes;
    `<html data-shell="app">` marks app pages and `data-gate` the three pages
    that redirect. Facts, topics and the Lab stay open to guests (they are the
    public, searchable content and the Telegram bot links to them); only the
    dashboard needs a profile.
14. **"Sign in" without accounts (and optional Telegram / Google, 2.7).** Signing in means choosing a character and a
    generated nickname on this device; no email, password or real name, for the
    same legal reason as decision 2. Signing out only hides the app; the
    progress stays until the visitor deletes it. On a shared device, "Start a
    new profile" asks before deleting and offers the download first.
    Since 2.7 a visitor can instead sign in with Telegram or Google (ticked
    consent box first); the server turns the verified id into a sync code and
    drops everything else, so cloud sync works with no name, e-mail or password
    stored. Guest remains the default.
15. **The logo is the team's drawing.** It is used as drawn (only trimmed and
    resized by `tools/logo.mjs`), on a purple-to-navy tile so the white lines
    read on light pages; at icon sizes the thin network lines are made a
    little more opaque instead of redrawing them.
16. **One loop that connects everything (2.4).** The app was a set of
    separate features (facts, Lab, badges). It is now one loop around brain
    care: *notice* (a 30-second check-in), *try* (Lab tests), *understand* (the
    fact behind each habit) and *grow* (the five areas light up and level up),
    plus a door back to the real project (events, volunteering, parents).
    Models: Finch (the visitor chooses, a companion grows, nothing is lost) and
    Pokémon Sleep (the player as a researcher of their own sleep). Self-
    determination research warns that points and streaks backfire when they
    feel controlling, so every area lights with any one action, logging counts,
    there are no penalties, no comparisons with others and no sleep "scores".
    Targets come only from facts with sources (NHLBI, NHS, WHO); mood is a
    private check-in, never a score, and a low mood points to a trusted adult.
17. **A game's top bar, not a dashboard's sidebar (2.4).** A sidebar reads as
    an education platform. Games keep navigation and status along the edges in
    fixed places: here chunky tabs with a "pressed key" edge, the streak, and
    the avatar with a level ring that opens the menu; on phones a bottom tab bar
    (as in most mobile games and Duolingo). Navy in both themes, so the app has
    its own frame around the content.

---

## How the parts connect (2.4)

```
            check-in (30 s): sleep · screens · movement · mood
                                   │
   facts ── Learning (Memo)        ▼              Lab tests ── Discovery (Dendi)
   daily challenge ─────────►  BRAIN MAP  ◄──── breathing, kindness ── Calm (Syno)
   wind-down ── Sleep (Lumi)   5 areas, levels    active minutes ── Movement (Octa)
                                   │
          "Why?" fact per area · My experiment (sleep vs reaction) · your week
                                   │
          Medulla in real life: events · volunteering · parents' page
```

All of it is stored on the device (`js/store.js`: `days` and `areas`); sync,
when switched on, carries it like the rest of the progress.

## Run it

Any static server in this folder works:

```bash
npx serve .
```

```bash
python -m http.server 8000
```

Then open the address it prints. Opening `index.html` straight from disk also
works, but offline mode (the service worker) needs a server.

Useful while testing:
- `?lang=ru` or `?lang=en` on any page switches language. The choice is remembered.
- `?backend=mock` uses a fake server in your browser, so you can try sync,
  restore, school clubs and counters without an account (`?backend=none` switches back).
- After editing text, facts or pages, run:
  ```bash
  node tools/build.js
  ```
  It rebuilds the fact and topic pages, the sitemap and the offline file list, then
  checks that all three languages have the same keys, every fact is complete and
  every internal link works. `node tools/build.js --check` only checks.
- Tests for both Telegram bots (a fake Telegram; nothing is sent):
  ```bash
  node --test telegram/bot.test.mjs telegram/assistant.test.mjs
  ```
- See what the interactive bot answers, without a token:
  ```bash
  node telegram/poll.mjs --demo "/word synapse" en
  ```
- `?placeholders=1` on any page shows every value that is still missing.
- `?profile=focus` (or `read`, `calm`, `seizure`, `simple`, `vision`) switches on an accessibility profile.

## Deploy

**GitHub Pages (recommended, free).** Push this folder to a GitHub repository
(see HANDOFF.md step 1). Then open **Settings → Pages → Source: GitHub Actions**.
Every push to `main` runs `.github/workflows/pages.yml`, which builds the site
and publishes it. Tooling and the original art are left out of the published copy.

- **Custom domain:** set it in Settings → Pages, add the DNS records GitHub
  shows you, then set `domain` in `js/config.js` (for example
  `"https://medulla.uz"`) and push. The build then writes canonical links,
  `og:url` and the sitemap.
- **Project address** (`username.github.io/repo/`): everything works except the
  404 page, whose paths start with `/`. Change them to `/repo/` as the comment
  in `404.html` explains, or use a custom domain.

**Netlify or Cloudflare Pages:** build command `node tools/build.js`, publish
directory `.` (the root).

## What's inside

```
index.html            Landing (public): hero, impact bar, the five characters, story chapters per pillar
start.html            Sign in: pick a character and nickname, continue, start a new profile, restore a sync code
learn.html            Fact library: topic hubs, search (all languages), filters, saved facts
facts/<id>.html       One page per fact (generated): simple/detailed text, listen, save, share card, quiz
topics/<topic>.html   Topic hubs (generated): sleep, learning, brain, movement, senses, myths
lab.html              Brain Lab: 6 activities with honest result cards and "My results"
explore.html          My Medulla: brain map and check-in, daily challenge, Me (profile, badges, saved, results, sync)
parents.html          For parents: early signs, questions for a doctor, disclaimer, resource directory
events.html           Brain Awareness Week (15–21 March 2027) and requesting a visit or workshop
activities.html       10 printable A4 sheets (colouring pages, maze, neuron labels, sleep diary…)
accessibility.html    Medulla for every brain: profiles, every setting explained, limits, sources
glossary.html         Hard words explained (searchable, listen)
about.html · partners.html · join.html · privacy.html · offline.html · 404.html

js/config.js          ← every placeholder (domain, email, team, partners, impact numbers, backend keys)
js/lang/uz|ru|en.js   ← all interface text (same keys in every language)
data/facts.json       ← the facts (source of truth)
data/kindness.json    ← kindness-wall messages the team approved
data/resources.json   ← checked resources for parents
data/glossary.json    ← hard words: plain definitions in uz/ru/en, sources (build checks it)
data/bot-strings.json   generated by the build for the Telegram Worker

js/i18n.js            Language list and loader      js/prefs.js    Settings applied before first paint
js/access.js          Accessibility & comfort panel, reading guide, read aloud, hard-word explanations
js/main.js            Site header/footer, app top bar and tab bar, icons, characters, reader, renderers
js/store.js           Progress: XP, levels, streak, badges, saved facts, results (localStorage)
js/backend.js         Optional sync and counters: none / mock / Supabase
js/motion.js          Neuron canvas, parallax, reveals, tilt, sparkles; pauses when hidden
js/sound.js           Synthesized sounds (Web Audio), off by default
js/games.js           The six activities          js/explore.js   My Medulla      js/start.js   Sign in
js/learn.js · js/fact.js · js/fact-template.js · js/lab.js · js/home.js · js/activities.js · js/telegram.js
css/styles.css · css/app.css · css/polish.css (2.1 look, dark theme, accessibility)
sw.js · manifest.webmanifest   Offline support and "Add to home screen"
tools/build.js        Pre-render + checks         backend/   Supabase schema and guide
tools/logo.mjs        Logo, favicons, app icons   tools/export-png.mjs   Share image (both need Edge or Chrome)
telegram/             Daily-fact channel bot, interactive bot (assistant, poll, worker), tests, guides
.github/workflows/    Deploy, checks, daily bot
```

## Characters

| Character | Stands for | Leads |
|---|---|---|
| **Dendi** (neuron, the guide) | Growth and curiosity | Home, My Medulla, the daily challenge |
| **Memo** (elephant with brain-shaped ears) | Memory | Daily facts, the library (Educational pillar) |
| **Octa** (orange octopus with a thinking cap) | Problem solving | Brain Lab tests and games (Practical pillar) |
| **Syno** (jellyfish with a synapse spark) | Feelings and kindness | Breathing, kindness tasks, parents, visits (Social pillar) |
| **Lumi** (firefly) | Ideas and sleep | "Did you know" moments, sleep facts, the night wind-down |

**Source:** the team's Gemini sheets in `assets/source/gemini/`: `lineup.png` (the five
normal images), `<character>-1.jpg` (hello, curious, aha, correct, try again) and
`-2.jpg` (focus, win, breathe in, breathe out, asleep), flat green background,
white sticker border.
`node tools/cutout.mjs` (needs Edge or Chrome) cuts them out and writes:

- `assets/characters/<id>.webp` (+ `.png` for the Telegram bot): the normal image, from `lineup.png`
- `assets/characters/poses/<id>-<pose>.webp`: 10 expressions each, 512 × 512
- `assets/characters/faces/<id>.webp`: head crops for avatars
- `assets/printables/<id>-lines.png`: colouring pages traced from the "hello" pose

To replace a sheet, save the new image under the same name and run the tool.
The pose order, which pose is the normal image and the head crops are at the
top of `tools/cutout.mjs`.

| Pose | Where |
|---|---|
| `hello` | Hero (Dendi), welcome dialog, greeting on My Medulla, Telegram card, page heroes |
| `curious` | Lab tests before a run, flip cards, empty states, 404, offline |
| `focus` | Lab tests while running, activity cards |
| `aha` | Fact reader, fact pages, fact of the day, Memo's chapter |
| `correct` / `tryagain` | Quiz feedback, finished lab tests; `correct` also stands in for "love" (kindness) |
| `win` | Result cards, badges, daily challenge done, closing band |
| `inhale` / `exhale` | Syno breathing with you (lab and home), Lumi's wind-down |
| `asleep` | Lumi's night mode, the sleep topic |

`M.poseImg(character, pose, class)` and `M.poseSrc(character, pose)` in
`js/main.js` build the image; `M.charFace(character)` gives the avatar crop. In
static HTML use `<img data-char="memo" data-pose="aha">` (`data-pose="face"` for
a crop); the build fills in the `src`.

---

## How to…

### Add a fact
1. In `data/facts.json`, copy an entry and give it a new `id` (lowercase, dashes; it becomes `facts/<id>.html`).
2. Fill `character`, `topic` (an existing topic key), and `title`, `simple`, `detail` in **uz, ru and en**.
   In Uzbek, attribute numbers ("…maʼlumotlariga koʻra") and explain Latin terms in brackets.
3. Add a `quiz`: a question, three options with **the correct one first** (`"answer": 0`; the site shuffles them), and `why`.
4. Add a `source` with `name` and `url`. Open the link and check that it says what the fact says.
5. Keep `"reviewed": false` until an expert has checked it. Then run `node tools/build.js`.

### Add or fix a hard word
1. In `data/glossary.json`, copy an entry. Give it an `id`, the `term` and a short
   plain `def` in **uz, ru and en**, a `source`, and the `fact` it belongs to.
2. `match` lists how the word **starts** in each language (endings are allowed):
   `"neyron"` also finds "neyronlar". Put `=` in front for whole words only
   (`"=rem"` must not match "remember"). At least 3 letters.
3. Keep `"reviewed": false` until a specialist checks it, then run `node tools/build.js`.
   The site, the glossary page and the bot all pick it up.

### Change an accessibility profile
Profiles are in `PROFILES` at the top of `js/access.js` (a list of settings each one
turns on). Every setting and its default is in `DEFAULTS` in `js/prefs.js`; the CSS for
each one is in `css/polish.css` §2–5.

### Change a placeholder
Everything is in `js/config.js`, with comments. `null` shows "TBD". Run
`node tools/build.js` after changing `domain`.

### Add a language
1. In `js/i18n.js`, add `{ code, label, name, locale, bcp47, decimal, group }` to `languages`.
2. Copy `js/lang/en.js` to `js/lang/<code>.js`, change the first line to the new code, and translate the values.
3. Add the new language next to `uz`/`ru`/`en` in every text field of `data/facts.json`.
4. Run `node tools/build.js`. It fails if any key or fact text is missing. The language button appears by itself.

### Add a character
1. Make its two pose sheets (green background, white border), save them as
   `assets/source/gemini/<id>-1.jpg` and `-2.jpg`, add them to `SHEETS`, `IDLE_FROM` and
   `FACE` in `tools/cutout.mjs`, and run `node tools/cutout.mjs`.
2. Add it to `CHARACTERS` and `CHARACTER_ORDER` in `js/main.js` (a tint that contrasts with it),
   and to `CHARS` in `js/fact-template.js`.
3. Add `char.<id>.kind`, `.trait`, `.role`, `.line` and `.alt` to every `js/lang/*.js` file, then run the build.

### Add a badge
1. Add `{ id: "<char>-<name>", char: "<char>", test: function (s) { … } }` to `BADGES` in `js/store.js`.
   `s` is the saved progress (see the top of that file).
2. Add `badge.<id>.name` and `badge.<id>.how` to every language file. Keep badges about learning, not about time spent.

### Add a game or activity
1. In `js/games.js`, add `{ id, char, icon, kind: "test" | "exercise", minutes }` to the list at the top.
   Write a function like the others, `(g, el, opts, signal)`, and register it in `IMPL`.
2. End it with `resultCard(…)` and `finish(id, result, opts)`, so the result is saved, XP is
   given and the honest "what it measures / what it doesn't" card appears.
3. Add `game.<id>.title`, `.short`, `.how`, `.what` and `.limits` (plus any messages) to every language file.
   If it is a test, add the id to `GAME_IDS` in `js/store.js`.

### Approve a kindness message or a parents' resource
Messages arrive by email through the "Send a kind message" button on the Join page. After the team
reads one, add it to `data/kindness.json`: no children's names, no photos, no
health details. Add a resource to `data/resources.json` only after someone has
checked that it exists, and record the date.

### Switch on sync and live counters
Follow [`backend/README.md`](backend/README.md) (about 10 minutes, free Supabase project).

### Post the daily fact to Telegram
Follow [`telegram/MINI_APP.md`](telegram/MINI_APP.md). Dry run:
```bash
node telegram/bot.mjs --dry-run
```

---

## Accessibility and motion

- Meets WCAG 2.2 AA targets:
  - skip link, landmarks and one `h1` per page
  - orange focus rings, keyboard use everywhere (arrow keys in the reader, keys 1–4 in Stroop)
  - native `<dialog>` modals with labels, live regions for game status
  - tap targets of at least 24 px (most are 44 px)
  - text contrast of at least 4.5:1
- **Accessibility & comfort** (the accessibility button, or Alt + A), saved on the device only:
  - six profiles: Focus, Easier reading, Calm senses, Seizure-safe, Simple & slow, See better
  - text size 100 / 112 / 125 / 150 %, wider spacing, fonts (Standard, Atkinson Hyperlegible, dyslexia-friendly)
  - theme (auto / light / dark), higher contrast, underlined links
  - stop animations (**calm mode**), hide decorations, no flashes or glows, sound (off by default)
  - reading guide, hard-word explanations (on by default), read-aloud buttons, more time in memory games
  - "Read this page aloud" with the current block highlighted
- The accessibility page (`accessibility.html`) explains every option, with sources.
- The system "reduce motion" setting has the same effect as calm mode.
- Flashes are never faster than 3 per second.
- Animation pauses when the tab is hidden or the element is off screen.
- Every sound has a visual equivalent.
- Characters are decorative (empty `alt`) wherever their name is written next to them.

## Tested (2.4, 13 October 2026)

- **Store:** check-ins, all five areas lighting, the full-network bonus and
  badge, invalid values refused, area totals rebuilt for older saved progress.
- **Flows in headless Edge:** a new profile, check-ins from the map, a
  simulated week (levels, week grid, the experiment comparing two groups), the
  avatar menu, Me sub-tabs, guest mode; the keyboard keeps focus on the chip or
  area that was pressed, Escape closes the menu and returns focus.
- **Top bar fit:** uz/ru/en, guest and signed in, normal and 125 % text, 360 to
  1440 px: nothing overflows. Only at 360 px with 125 % text, one Uzbek
  tab label is shortened with "…".
- **axe-core 4.10:** no violations on the map (three panels), the open menu,
  Me, badges, daily, lab and guest pages, light and dark, 1440 and 390 px.
- **Build checks** pass; 27 bot tests pass.

## Tested (2.3, 13 October 2026)

- **Flows in headless Edge:** guest landing → dashboard link → sign-in page →
  back to the dashboard route; signing in from a fact page returns to that
  fact; landing redirects when signed in, `?site=1` shows it; sign out (with
  message), "Welcome back", start a new profile, delete all data (signs out);
  arrow keys in the character picker; the phone menu closes with Escape and
  gives focus back.
- **Header fit:** public header and app top bar in uz/ru/en, guest and signed
  in, at 360–1440 px: nothing overflows or wraps.
- **axe-core 4.10:** no violations on the landing, sign-in, facts, a fact, a
  topic, about, lab and My Medulla pages, guest and signed in, light and dark,
  1440 and 390 px (run with motion off; with motion on, axe flags text that is
  still fading in).
- **Build checks** pass; 27 bot tests pass.
- Not tested: Safari/iOS and real screen readers.

## Tested (2.2, 13 October 2026)

- **axe-core 4.10:** no violations on 14 pages plus a fact and a topic page, light and dark.
- **Build checks** pass; 27 bot tests pass.
- **Screens:** home at 1280–1366 px and 390 px, light and dark, with motion on and
  off; lab, explore, about, topic, fact and offline pages; every character and
  expression on light and dark backgrounds, with no green fringe. The share-card
  canvas exports with the new art.
- Not tested: Safari/iOS and real screen readers.

## Tested (2.1, 12 October 2026)

- **axe-core 4.10 (WCAG 2.2 A/AA rules):** no violations on all 15 pages plus fact
  and topic samples, in the light and the dark theme, with the comfort panel open,
  and with the See better, Easier reading and Simple & slow profiles on.
- **Bots:** 17 interactive-bot tests and the 10 channel-bot tests pass.
- **Build checks:** three languages with identical keys (199 new keys each),
  25 facts, 29 glossary entries, all internal links.
- **Screens:** every page at 1366 px and the home, accessibility and fact pages at
  390–412 px, in Uzbek, Russian and English, light and dark; 150% text and the
  Focus profile; panel, hard-word pop-up and profile switching in a real browser.
- Not tested: real screen-reader sessions, Safari/iOS, and people with the
  disabilities the profiles are for (see HANDOFF.md).

## Tested (2.0, October 2026)

All tests ran on a local server, in Edge or Chromium.

**Every page, in all three languages:**
- 13 pages, 25 fact pages and 6 topic pages.
- No JavaScript errors and no missing translation keys.
- No horizontal scrolling at 375 px or at desktop width.

**My Medulla and the Lab:**
- The full daily challenge: fact, then 3 questions with explanations, then a game, then the badge and the "done" screen.
- All 6 activities open. Stroop, reaction time and sequence memory were played through to their result cards.

**Sync, with the mock backend:**
- Switching sync on, including the parent/guardian step for under-18s.
- The code screen.
- Restore on a "new device", which merges progress.
- School club totals.
- "Delete everything", which also removes the online copy.

**With no backend keys:**
- Sync shows "not set up yet".
- Nothing is sent anywhere.

**Settings:**
- Sound, calm mode, larger text and the dyslexia font switch on, are remembered and switch off.
- With the system "reduce motion" setting (headless Edge): idle loops, entrance animations and scroll reveals are off.

**Offline:**
- The app shell and the Lab work offline.
- Pages that aren't cached show the offline page, including pages inside `facts/` and `topics/`.

**Share card and the Telegram bot:**
- The share card renders at 1200×630.
- The bot passes 10 tests against a mock Telegram server.
- The SQL schema passes 16 checks in an in-memory Postgres.

**Speed:** measured on a phone-sized screen (412 px) with "Slow 4G" and 4× CPU slowdown, gzip on and no cache:

| Page | Transferred | First paint | Largest paint | Layout shift |
|---|---|---|---|---|
| Home | 313 KB | 1.0–1.9 s | 1.0–1.9 s | 0.000 |
| Learn | 234 KB | 1.4–1.6 s | 1.4–1.6 s | 0.000 |
| Lab | 246 KB | 0.8–1.3 s | 0.8–1.3 s | 0.000 |
| My Medulla | 293 KB | 1.0–1.3 s | 3.1 s | 0.000 |
| A fact page | 248 KB | 1.1–1.3 s | 1.1–1.3 s | 0.000 |
| Parents | 207 KB | 0.9–1.3 s | 0.9–1.3 s | ≤ 0.023 |
| Printables | 620 KB | 0.8–1.5 s | 3.6–4.6 s | 0.064 |

Google rates a largest paint under 2.5 s and a layout shift under 0.1 as
"good". Most of the transfer is shared files (CSS, scripts, the language file,
fonts, character art) that are cached after the first page. The printables
page is heavier because of its colouring-page images.
