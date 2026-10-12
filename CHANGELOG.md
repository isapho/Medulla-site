# Changelog

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
