# Changelog

## 2.7.0 (13 October 2026): sign in with Telegram and Google, cloud sync

### Added
- **Badge pop-up:** a new badge opens a dialog (queued if several) with the character, how it was earned, the date and a sound; tap any badge in Me → Badges for the same details. Sound stays off until the visitor turns it on (button in the pop-up).
- **Profile name:** optional name (20 characters, kept on the device, travels with synced progress) on the sign-in page and in Me → Profile; it replaces the generated nickname.
- **Privacy before sign-in:** a line with a link to the Privacy Policy above the enter button; privacy.html has a new "Your profile name" section.
- **Sign in with Telegram** on the sign-in page (and one tap inside the
  Telegram Mini App) and **Sign in with Google** (button appears when
  `googleClientId` is set). Optional: guests still just pick a character.
  A login needs a ticked box: 18 or older, or a parent or guardian agrees.
- **Telegram sign-in with a code from the bot:** `/login` (or `t.me/<bot>?start=login`)
  sends a one-time code, valid 5 minutes and usable once, which is typed on the
  sign-in page. No script from telegram.org is loaded and `/setdomain` isn't needed.
- **How it stays private:** the Worker verifies the login (Telegram's HMAC,
  Google's signed token) and answers only with a *sync code* derived from the
  account id and a server secret. The existing sync, restore-by-code and
  delete buttons work unchanged. Name, username, photo and e-mail are never
  stored; Telegram's and Google's scripts load only when you ask to sign in.
- **Worker sync** (`provider: "worker"`): progress copies live in the same
  Cloudflare KV namespace under the hash of the code; no Supabase needed.
  Anonymous counters stay off in this mode.
- 7 tests with real signatures (Telegram hash, Mini App data, a throwaway RSA
  key for Google's token), CORS and sync limits.

## 2.6.0 (13 October 2026): a daily fact from the Telegram bot, and a bot that matches the app

### Added
- **Daily fact in a private chat** (`/daily`, or 🔔 in the bot's menu): the
  bot sends the website's fact of the day every day at 08:00, 13:00 or 18:00
  Tashkent time, in the person's language, with a quiz button, the area's step
  for today and `/stop`. If the chosen time has already passed, today's fact
  comes at once. Opt-in only: the screen says the bot keeps just the chat's
  number, the language and the hour, and asks under-18s to check with a parent
  or guardian first. `/stop` or blocking the bot deletes the entry; groups
  can't subscribe; changing the language in the bot changes the daily
  language too.
  - Cloudflare Worker: a KV namespace (`SUBS`) and a cron trigger every
    5 minutes; each delivery hour goes out in 12 batches of up to 45 chats,
    which keeps every run inside the free plan's limit of 50 requests.
  - Long polling (`poll.mjs`): the list lives in `telegram/.subscribers.json`
    (ignored by git) and a computer that was off at the delivery time catches up.
- **Brain map in the bot** (`/map`, 🗺 in the menu): the app's five areas with
  their characters; each area shows the site's step for today, the sleep and
  movement targets (NHLBI, WHO), its "why" fact, another fact from that area,
  a quiz (Learning) or the breathing minute (Calm), and "Open my brain map"
  once the site is live.
- The channel post has a "Get it every day in a private chat" button
  (`t.me/<bot>?start=daily`). New deep links: `?start=map`, `?start=daily`.
- 10 new bot tests (37 in total).
- **Automatic daily fact** (`tools/auto-fact.mjs`, `.github/workflows/auto-fact.yml`):
  every day at 01:30 Tashkent time a GitHub Action adds 1 (or 2) new facts to
  `data/facts.json`, rebuilds the site and starts the deploy; the Telegram bot
  reads `facts.json` from the repository, so it has them at once. A fact is
  searched on trusted health sites only (NHS, WHO, NIH institutes, MedlinePlus,
  CDC, PubMed), written in uz/ru/en with a quiz from the page's own text, and
  must pass: an exact evidence sentence found in the fetched page, an allowed
  https source, no duplicate id, title or source, quiz and Telegram length
  limits, the site's build checks, and a second independent fact-check. Facts
  are published with `reviewed: false` ("Pending expert review"). Needs the
  `ANTHROPIC_API_KEY` secret; without it the job does nothing. 7 tests with a
  fake model.

### Changed
- Every fact in the bot and the channel names its brain-map area and character
  ("🌙 Sleep · Lumi") and shows that character as a small picture (from the site,
  or from the public repository while the site is offline). Only today's fact is
  called "Brain fact of the day".
- Bot menu: Brain map and Daily fact replace the Sleep fact button (`/sleep`
  still works). The command menu gained `/map`, `/daily` and `/stop`:
  run `node telegram/poll.mjs --setup` once to update it.
- `/privacy`, `/help`, the bot descriptions and the site's Privacy page
  describe the daily-fact exception in uz, ru and en.
- Telegram Mini App: Telegram's header now matches the app's navy top bar (and
  the light or dark theme on public pages) instead of always white.
- `data/bot-strings.json` also carries the brain map's area texts.

## 2.5.0 (13 October 2026): more avatars, a dark/light switch, clearer top bar

### Added
- **Avatar studio** in Me (Men): choose a character, then one of nine
  expressions (Classic, Hello, Happy, Champion, Aha!, Curious, Focused, Calm,
  Sleepy), then a background. That makes 45 avatar pictures instead of 5,
  each showing the whole character (not just the head). The
  avatar shows in the top bar, the menu, the greeting and on the sign-in page.
  Like the rewards in Finch, two backgrounds open with levels: Sunset at
  level 3 and Galaxy at level 5. Stored on the device as `profile.mood` and
  `profile.bg`.
- `tools/avatars.mjs`: makes the avatars
  (`assets/characters/avatars/<character>-<mood>.webp`, 160 px) from the
  normal image and the expression poses. It only crops the art.
- **Dark / light switch** in the top bar (app, public site and sign-in page),
  next to the accessibility button: a moon in the light theme, a sun in the
  dark one. It sets the same Theme setting as the accessibility panel, where
  "Auto" (follow the device) is still available.

### Changed
- **Browser-tab icon:** now the team's original drawing
  (`assets/source/logo-original.png`: dark wireframe brain, navy network,
  light paper). The logo everywhere else (header, sign-in page, About, app
  icons, share image) stays the purple tile. `tools/logo.mjs` makes both.
- **Top bar icons:** Map is now a brain, Daily a calendar with a tick, Brain
  Lab a flask, the streak a flame, and the accessibility button a clearer
  figure in a circle.
- **Followers:** the 150+ count is now labelled Instagram + Telegram (home
  page, impact numbers, timeline) with a combined icon.
- **Sign-in page fits one screen:** on wide screens the character sits beside
  the heading and the spacing, logo and text scale with the window height
  (checked at 1885 × 865, 1366 × 650 and 390 × 844). The dark brand panel has
  a new background of glowing neurons on navy, generated with Canva
  (`assets/img/start-neurons.webp`, see CREDITS.md), and its five characters
  are shown whole.

## 2.4.0 (13 October 2026): the brain map, a game-style top bar

### Added
- **Brain map** (the new My Medulla home). Five areas of brain care around
  the visitor's own character, each led by one character: Learning (Memo),
  Movement (Octa), Discovery (Dendi), Calm and kindness (Syno) and Sleep
  (Lumi). Doing one thing in an area lights it for the day; lighting all five
  links the whole network (+15 XP). Each area has its own level, so the five
  habits grow like skills.
  - **30-second check-in** inside the areas: last night's sleep in hours,
    screens away the hour before bed, active minutes today, mood (five faces).
    Self-reported, private, on the device only. A low mood shows a gentle note
    to talk to a trusted adult (no diagnosis, no scores).
  - **The targets come from the checked facts:** 8–10 h of sleep for teens and
    9–12 h for children (NHLBI), screens away an hour before bed (NHS), an
    average of 60 active minutes a day for ages 5–17 (WHO guidelines, linked).
    Every area links its "Why?" fact.
  - **The rest of the site plugs in:** reading a fact or answering a question
    lights Learning; a Lab test or the daily challenge lights Discovery;
    breathing with Syno or a kindness action lights Calm; the wind-down with
    Lumi lights Sleep.
  - **My experiment:** the visitor's own Reaction test results on days after
    8+ hours of sleep against days after less, with an honest note (few days,
    many other causes, not a finding).
  - **Your week:** a 7-day grid of the five areas. Missed days erase nothing.
  - **Medulla in real life:** a card that leads from the app to the project:
    events, volunteering and the parents' page.
  - Four badges: Sleep diary, Brain on the move, Listen to yourself, Full network.
- **"Me" tab** with sub-tabs: Profile (now with the five areas as skills),
  Badges, Saved, Results.

### Changed
- **The sidebar is gone.** The app has a game-style top bar instead: chunky
  tabs (Map, Daily, Facts, Lab, Me), the streak, and the avatar with a ring
  that fills towards the next level. The avatar opens a menu (profile card,
  badges, saved, results, printables, hard words, language, sound, the
  Medulla website, sign out). On phones: the same top bar and a bottom tab bar
  whose active tab pops up. Both are navy in light and dark themes.
- The landing page's My Medulla chapter describes the brain map.
- Old progress is kept: each area's days are rebuilt from the days already
  stored on the device.

### Removed
- The old dashboard cards (purple daily banner, week summary counts, streak
  neuron); their content now lives in the map, the Daily tab and Me.

## 2.3.0 (13 October 2026): a public site and a separate app, the team's logo

### Changed
- **Two interfaces instead of one.** Before, the landing page and every other
  page had the same header, including the visitor's level pill, so a first
  visit looked like someone else's account.
  - **Public site** (landing, About, Parents, Events, Partners, Join, Privacy,
    Accessibility): a site menu with **Sign in** and **Get started**. Once
    signed in, the header shows **My Medulla** with the visitor's character.
  - **App** (My Medulla, Facts, Lab, Printables, Hard words, every fact and
    topic page): a sidebar on wide screens (Learn: Home, Daily challenge,
    Facts, Lab, Printables, Hard words; Personal: Badges, Saved, Results,
    Profile; then the Medulla website and Sign out), and on phones a top bar,
    a slide-in menu and a bottom tab bar. The top bar shows the page name, the
    streak and the level. Guests can still read facts and play in the Lab; the
    menu then shows "Guest mode" with a Sign in button.
  - Signed-in visitors who open the landing page go straight to their
    dashboard (`index.html?site=1` still shows the landing). Guests who open
    the dashboard go to the sign-in page and come back to where they were.
- **Sign-in page** (`start.html`) replaces the welcome pop-up on My Medulla.
  Still no accounts: two steps, pick a character and a nickname made of
  friendly words. A profile already on the device gets "Welcome back" with
  **Continue**, **Start a new profile** (asks first, offers the download) and,
  when sync is on, **I have a code**. **Sign out** keeps the progress on the
  device; "Delete all my data" signs out too.
- **Logo:** the team's own artwork, a white wireframe brain wrapped in a
  network (`assets/source/logo-network.png`), replaces the simplified
  white-line mark from 2.2. `tools/logo.mjs` makes the header mark, the
  favicon, the app icons and the tile; the share image was re-exported.
- My Medulla's own row of tabs is gone (the sidebar and tab bar replace it).
- Dark theme: the XP number on the dashboard had too little contrast; fixed.

### Removed
- `tools/brand.js` and the vector logo files (`logo-mark.svg`,
  `logo-ink.svg`, `logo-tile-maskable.svg`).

## 2.2.0 (13 October 2026): new character expressions, new logo, bubbly icons, richer motion

### Changed
- **Character art:** the team's new Gemini sheets (a line-up for the normal images and two per character, white
  sticker border on green), cut out by `tools/cutout.mjs` without changing the
  drawings: no green fringe on light or dark pages, every pose with the same
  body size. 10 expressions per character (hello, curious, aha, correct, try
  again, focus, win, breathe in, breathe out, asleep); Syno had 5 before.
- **More expressions on the site:** cards change expression when you point at
  them, lab tests show a curious then concentrating Octa, Syno breathes in and
  out with you, Lumi falls asleep during the wind-down, badges celebrate, topic
  pages and page heroes each have a fitting mood. Avatars use head crops.
- **Colouring pages** traced from the new art.
- **Logo:** a clean white-line brain on the purple tile (`tools/brand.js`), so
  the brain is visible at 16–44 px. New favicon (SVG + PNG), app icons and
  share image.
- **Icons:** the whole set redrawn rounder and "bubbly": 2 px rounded strokes,
  a soft tinted body, solid accents, on glossy gradient tiles with a gentle
  shadow.
- **Hero background:** the random network of straight lines is replaced by a few
  smooth pathways that flow into the brain, with soft signals travelling along
  them and two slow orbit rings. Phones keep the headline clear.
- **Explainers redrawn:** a detailed neuron whose signal jumps between the
  myelin gaps and crosses the synapse; memory consolidation in three acts
  (learn, sleep with fast replay, recall with a thicker bundle); a hypnogram
  with a glowing head and deep-sleep band; and a new eye with iris fibres,
  lashes and a lid that narrows in bright light, in a room that goes from night
  through dusk to daylight. On wide screens each explainer sits beside its text.
- Character tints are warm, so the purple characters stand out.

### Removed
- The 2.1 Canva cut-outs, the first AI poses, the bitmap logo and the old colouring pages.

## 2.1.0 (12 October 2026): every brain, Telegram assistant, new look

### Added
- **Accessibility & comfort panel** (header button or Alt + A on any page) with six
  ready-made profiles: Focus, Easier reading, Calm senses, Seizure-safe, Simple &
  slow, See better. Single settings: text size up to 150%, wider spacing, fonts
  (Standard, Atkinson Hyperlegible, dyslexia-friendly), light / dark / auto theme,
  high contrast, underlined links, stop animations, hide decorations, no flashes,
  sound, reading guide, hard-word explanations, read-aloud buttons, more time.
  Saved on the device only; applied before the first paint.
- **Accessibility page** (`accessibility.html`): the profiles, what each setting
  does and why, keyboard shortcuts, honest limits and sources.
- **Hard words:** `data/glossary.json` (29 terms in uz/ru/en with sources), dotted
  underlines on the first use of each term with a pop-up explanation you can
  listen to, and a searchable **glossary page** (`glossary.html`).
- **Read aloud** for a whole page (current block highlighted, pause/next/stop),
  a paragraph or any selection.
- **Dark theme** for the whole site, following the device by default.
- **Interactive Telegram bot** (`telegram/assistant.mjs`): fact of the day, random
  and sleep facts, simple/detailed switch, anonymous quiz polls, hard words, fact
  search by plain text, a guided breathing minute, inline sharing, three
  languages, nothing stored. Runs with long polling (`telegram/poll.mjs`) or as a
  free Cloudflare Worker (`telegram/worker.mjs`). Guide: `telegram/BOT.md`.
  17 tests (`telegram/assistant.test.mjs`), also run in CI.
- **Telegram card** on the home and Join pages (bot, channel, Instagram).
- **"Medulla for every brain"** section on the home page with one-tap profiles.
- `data/bot-strings.json` written by the build for the Worker.
- `?placeholders=1` / `showPlaceholders` show the team every missing value.

### Changed
- **Characters** replaced with the team's clean Canva cut-out at twice the
  resolution, edges cleaned for dark backgrounds; the 41 reaction poses got the
  same edge clean-up.
- **Logo** recoloured to the palette; new app icons, favicon and a designed
  share image (`og-image.jpg`, 138 KB instead of a PNG).
- **New imagery:** glass-brain hero, neuron network, night sky for Lumi's
  chapter, violet waves for the closing band (Canva AI, see CREDITS).
- **Visual polish** (`css/polish.css`): layered shadows, glass cards, gradient
  brand mark, a fine grain on soft sections, refined header and footer.
- **Trust strip** shows only real numbers (followers, checked facts, Lab
  activities, languages) instead of "TBD" dashes; team cards show initials
  instead of "photo TBD"; empty partner slots became one "partner places are
  open" card; missing email falls back to the Telegram contact.
- The service worker now loads JS, CSS and JSON **network-first**, so a new
  page never runs with old cached code.
- Memory games accept "More time" (×1.6) and say so on the result card.
- Privacy page: new settings, read-aloud voices and the bot.

### Fixed
- The Lab's empty "All activities" box showed under the activity list
  (a CSS rule overrode `hidden`).
- Home page called eight people "co-founders".
- Dark theme passes axe-core colour-contrast checks on every page tested.

## 2.0.0 (12 October 2026): from demo to web app

### Added
- **Russian**, next to Uzbek and English. Text now lives in `js/lang/{uz,ru,en}.js` and
  loads only for the chosen language. Uzbek is pre-rendered into every page.
- **My Medulla** (`explore.html`):
  - a daily challenge (one fact, three quiz questions with explanations, one game)
  - XP and levels, a gentle streak (one or two missed days are fine), 17 character badges
  - saved facts, results history and a weekly summary, kindness tasks with Syno
  - a nickname made from friendly words, and a favourite character
- **Optional sync** with a random code (no email or name), with a parent/guardian
  step for under-18s. Also: restore on another device, school-club totals,
  download all data as JSON, and delete everything (including the online copy).
- **Backend adapter** with three modes: none (default), mock (`?backend=mock`)
  and Supabase. Includes `backend/schema.sql` with locked-down database
  functions, plus tests.
- **Four new activities:** digit span, sequence memory, breathing with Syno
  (NHS 5-in / 5-out), and Lumi's night wind-down. Every activity ends with an
  honest result card. Research mode is "coming soon".
- **Fact pages**:
  - 25 facts, each at `facts/<id>.html`, with simple and detailed versions
  - listen (speech synthesis), save, a 1200×630 share card, a quiz
  - related facts, and report or suggest (email)
  - six topic hubs
- **Parents page:** early signs, questions to ask a doctor, a disclaimer,
  "Reviewed by: pending", an empty checked-resource directory and the
  Uzbekistan Early Intervention news.
- **Events page:** Brain Awareness Week (15–21 March 2027) and requesting a visit or workshop.
- **Printables:** 10 A4 sheets, including colouring pages traced from the character art.
- **Kindness wall** on the Join page. It shows only approved messages.
- **Privacy page** in plain language.
- **Motion:**
  - a neuron network that grows with the pointer and scroll, with travelling signals
  - parallax, story chapters with a progress indicator, character idle loops
  - springy buttons, tilt, flip cards, sparkles, a glowing streak neuron
  - page transitions, loading skeletons, animated explainers
  - **calm mode**
- **Synthesized sound**, off by default.
- **PWA:** works offline, can be added to the home screen, and has app icons.
- **SEO:** a sitemap, robots.txt, Open Graph tags and JSON-LD on fact pages.
- **Telegram:** a daily-fact channel bot (uz/ru/en) with tests and a GitHub
  Action, the Mini App adapter and a plan.
- **GitHub Actions:** deploy to Pages, checks on every push, the daily bot.
- **Docs:** `RESEARCH.md`, `HANDOFF.md`, `CREDITS.md`, `backend/README.md`, `telegram/MINI_APP.md`.

### Poses (added after 2.0.0)
- 41 reaction poses (hello, curious, aha, correct, tryagain, win, inhale, exhale,
  asleep) for the five characters, cut out from the team's generated images.
- The five base characters (and the colouring-page line art) were re-cut from
  the new character sheet, so base art and poses match.
- Used in: quiz feedback on fact pages and in the daily challenge (the presenter
  cheers or encourages), game result cards (the host celebrates), the daily
  challenge done screen (Dendi), the fact reader (the presenter is delighted),
  empty states (Memo looks curious), the welcome dialog (Dendi waves), the 404
  and offline pages, and the wind-down result (Lumi asleep). The quiz and result
  poses are also saved for offline use.
- Not used yet: `focus` (faces look angry), Syno `aha`, `inhale`, `exhale`,
  `asleep` (body shape differs from the sheet).
- Team list and Telegram channel/contact filled in from the team's details.

### Changed
- `tools/build.js` replaces `tools/sync-facts.js`. It pre-renders pages,
  generates fact and topic pages, the sitemap and the offline list, and checks
  translations and links.
- Characters and the logo are now WebP (77 KB for all five characters).
- Lab results moved into the shared progress store (`medulla.state`).

### Fixed during testing
- The fact library grid was wider than the screen at desktop width.
- The offline page lost its styles inside `facts/` and `topics/`.
- Several layout shifts while pages load:
  - empty header, icons drawn late, library lists, the My Medulla view
  - the home page's main text painting late
- Breadcrumb links were under the 24 px minimum tap size.
- An automated accessibility audit (axe-core, WCAG 2.2 AA, 26 page loads in uz, en and ru) found three issues, now fixed: the flipped fact card hid a focusable link from screen readers, the quiz heading on fact pages skipped a level, and the fact sidebar was a landmark inside a landmark. It now reports zero issues.
- The small icons in the home page explainer titles were stretched wide on phones, making the page scroll sideways.
- The daily challenge didn't add to the anonymous "daily challenges" counter.
- Sync now waits for a burst of progress events to settle before uploading.
- The welcome dialog's label pointed to a missing heading.
- Supabase's new publishable keys are now sent only in the `apikey` header.
