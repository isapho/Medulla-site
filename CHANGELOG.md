# Changelog

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
