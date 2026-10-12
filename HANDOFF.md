# Handoff: what only you can do

The site already works with none of this: guest mode, no keys, dashed "TBD"
placeholders. Work through the list in order. Each step says where the result
goes. Tick the boxes as you go.

---

## 1. Put the code under version control (15 minutes)

Git is not installed on the computer this was built on, so there is no history
yet.

- [ ] Install Git: https://git-scm.com/download/win (default options are fine).
- [ ] In a terminal inside `medulla-site`, commit the work in steps:

```bash
git init -b main
git add RESEARCH.md
git commit -m "Research: engagement, minors' data, animation, sound, Telegram, games, hosting"
git add assets css js/prefs.js js/config.js js/i18n.js js/lang js/store.js js/backend.js js/sound.js js/motion.js js/main.js
git commit -m "Core: three languages, progress store, backend adapter, sound, motion, shared shell"
git add js/games.js js/lab.js js/explore.js js/learn.js js/fact.js js/fact-template.js js/home.js js/activities.js js/telegram.js
git commit -m "Features: six activities, My Medulla, fact pages, printables, Telegram adapter"
git add *.html data tools facts topics sitemap.xml robots.txt sw.js manifest.webmanifest
git commit -m "Pages, 25 facts, build script, PWA and SEO files"
git add backend telegram .github
git commit -m "Optional Supabase schema, Telegram daily-fact bot with tests, GitHub workflows"
git add README.md HANDOFF.md CREDITS.md CHANGELOG.md .gitignore
git commit -m "Docs: README, handoff checklist, credits, changelog"
git status
```

  `git status` should then say "nothing to commit".
- [ ] Create an empty repository on GitHub (for example `medulla-site`). Then push:

```bash
git remote add origin https://github.com/YOUR-ACCOUNT/medulla-site.git
git push -u origin main
```

## 2. Publish it (15 minutes)

- [ ] GitHub → repository → **Settings → Pages → Source: GitHub Actions**. The
      next push (or **Actions → Deploy to GitHub Pages → Run workflow**)
      publishes the site.
- [ ] Optional domain (for example `medulla.uz`): buy it, add it under
      Settings → Pages, and create the DNS records GitHub shows you. Tick
      "Enforce HTTPS" once it appears.
- [ ] Set `domain` in `js/config.js` (for example `"https://medulla.uz"`), then commit and push.
      The build fills canonical links, `og:url`, absolute share images and `sitemap.xml`.
- [ ] Optional: add the site in Google Search Console and Yandex Webmaster, then submit `sitemap.xml`.

## 3. Contact details → `js/config.js`

- [ ] `contactEmail`: a shared inbox, for example `hello@…`. It powers every
      "write to us" button: visit requests, fact suggestions and reports,
      kindness messages and privacy questions.
- [ ] `telegramHandle`: the channel username, without `@`.
- [ ] Check `instagramHandle` (`medulla.mind`).

## 4. Real people and partners → `js/config.js`

Only with each person's permission. Names and photos of adults only.

- [ ] `team`: names, roles (uz/ru/en), one-line bios. Add a photo only if the
      person wants one (`assets/team/…`).
- [ ] `advisors`: only specialists who have agreed to be listed.
- [ ] `partners`: only organisations that have agreed in writing, with their logo file and URL.

## 5. Real numbers → `js/config.js` → `impact`

- [ ] Fill `visits`, `factsShared` and `volunteers` with counted numbers only.
      Update `followers` (150 in 2026) when it changes.
- [ ] Optional: set `anonymousCounters: true` after step 8, so "experiments"
      counts itself.

## 6. Expert review of health content (most important before promoting the site)

- [ ] Ask a neurologist, paediatrician or psychologist to review:
  - all 25 facts in `data/facts.json`
  - the Lab texts ("what it measures / what it doesn't")
  - the Parents page
  - the breathing and sleep activities
- [ ] For each approved fact, set `"reviewed": true`. Then run `node tools/build.js`
      and commit. The "Pending expert review" label disappears for that fact.
- [ ] Parents page: replace "Reviewed by: pending" (`parents.reviewedBy` in `js/lang/*.js`) with the reviewer's name, with their consent.
- [ ] Remove the demo line in the footer (`footer.demo` in `js/lang/*.js`) once everything is reviewed.

## 7. Language review

- [ ] Have a native Uzbek speaker read the site, preferably a teacher or editor.
      Check the Latin script with ʻ and ʼ, the decimal commas, and the
      "…maʼlumotlariga koʻra" attributions. The text is in `js/lang/uz.js` and
      the `uz` fields of `data/facts.json`.
- [ ] Do the same with a native Russian speaker for `js/lang/ru.js` and the `ru` fields.
- [ ] Have a parent read the Parents page and the consent screen in all three
      languages: is it clear, kind and not frightening?

## 8. Legal check before switching on sync (optional feature)

- [ ] Ask a lawyer in Uzbekistan to confirm:
  - the parent/guardian step for under-18s (Law ZRU-547, Art. 21, written consent),
  - whether storing anonymous sync data abroad (Supabase, EU region) is acceptable,
  - whether registration with the personal data authority is needed.

  RESEARCH.md §2 has the details and links. Until then, keep `backend.provider: null`.
- [ ] Then follow `backend/README.md`: create a Supabase project, run
      `backend/schema.sql`, and put the URL and **publishable** key in `js/config.js`.

## 9. Telegram (optional)

- [ ] Create the bot with @BotFather and make it an admin of the channel (Post messages only).
- [ ] GitHub → Settings → Secrets and variables → Actions: add the secret
      `BOT_TOKEN`, plus the variables `CHANNEL_ID` and `SITE_URL`.
      Then run "Daily fact to Telegram" once, by hand.
- [ ] Optional Mini App: @BotFather → Configure Mini App → `https://YOUR-DOMAIN/index.html`.
      See `telegram/MINI_APP.md`.

## 10. Art

- [ ] Ask the illustrator for **high-resolution transparent exports** of the
      five characters and the logo. Use at least 800 px for characters, an SVG
      for the logo if possible, and the same file names in
      `assets/characters/` and `assets/brand/`. The current cut-outs come from a
      1024 px sheet.
- [ ] Optional for richer animation: **layered files** (for example Dendi's
      branches, Octa's arms and Lumi's wings as separate parts), so they can be
      animated without redrawing.
- [ ] **Clean line art** for the colouring pages. It replaces the automatic
      tracing in `assets/printables/*-lines.png`.
- [ ] A designed 1200×630 share image if you want one instead of
      `assets/brand/og-image.png`.

## 11. Ongoing

- [ ] Kindness wall: read incoming messages and add approved ones to `data/kindness.json`.
- [ ] Parents' directory: add services to `data/resources.json` only after checking them, with the date.
- [ ] Events: add real Medulla events for Brain Awareness Week (15–21 March 2027).
      No registration with the Dana Foundation is needed; their free materials can be used.
- [ ] New facts: follow "Add a fact" in README.md, each with a checked source and an expert review.
- [ ] GitHub pauses the daily Telegram workflow after 60 days without commits.
      If posts stop, open Actions and re-enable it.

---

### Things I was unsure about (please decide)

- **Three posts a day** in one Telegram channel (uz, ru, en) may be too many.
  Separate channels per language are supported (`CHANNEL_ID_UZ` etc.), or you
  can post only some languages (`LANGS=uz,ru`).
- **Counters can be inflated.** Anonymous counters have no rate limit, so
  someone could inflate them. They are off by default; see `backend/README.md`.
- **The traced colouring pages** are a stand-in. Their lines are not as clean as hand-drawn ones.
- **The "Uzbekistan Early Intervention" link** on the Parents page points to a
  kun.uz news article, as the brief asked. Replace it with an official service
  page once one exists.
