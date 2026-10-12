# Handoff: what only you can do

The site already works with none of this: guest mode, no keys, dashed "TBD"
placeholders. Work through the list in order. Each step says where the result
goes. Tick the boxes as you go.

---

## 1. Version control: DONE

Git is installed, the work is committed, and the repository is
https://github.com/isapho/Medulla-site (public). Later changes:

```bash
git add -A
git commit -m "What you changed"
git push
```

## 2. Publishing: set up, not yet announced

Pages is switched on, and every push to `main` republishes the site at
https://isapho.github.io/Medulla-site/ (Settings → Pages → Source: GitHub Actions).

- [ ] **Decide when to go public.** The repository and the site are public now.
      To take the site down until you are ready: Settings → Pages → "Unpublish
      site". To stop deploys, turn off Actions for the repository. To make the
      code private too: Settings → General → Danger Zone (private repositories
      need a paid plan for Pages).
- [ ] Optional domain (for example `medulla.uz`): buy it, add it under
      Settings → Pages, and create the DNS records GitHub shows you. Tick
      "Enforce HTTPS" once it appears.
- [ ] Set `domain` in `js/config.js` (the final address, for example
      `"https://medulla.uz"`), then commit and push. The build fills canonical
      links, `og:url`, absolute share images and `sitemap.xml`. Set it once the
      address is final, because link previews and search engines remember it.
- [ ] On a project address (`…github.io/Medulla-site/`) the 404 page needs its
      paths changed to `/Medulla-site/` (see the comment in `404.html`). A custom
      domain avoids that.
- [ ] Optional: add the site in Google Search Console and Yandex Webmaster, then submit `sitemap.xml`.
## 3. Contact details → `js/config.js`

- [ ] `contactEmail`: a shared inbox, for example `hello@…`. It powers every
      "write to us" button: visit requests, fact suggestions and reports,
      kindness messages and privacy questions.
- [x] Telegram is set: channel `medullamind` (`telegramHandle`), contact account `medulla_mind` (`telegramContact`).
- [ ] Check `instagramHandle` (`medulla.mind`).

## 4. Real people and partners → `js/config.js`

Only with each person's permission. Names and photos of adults only.

- [x] `team`: 8 names and roles are in `js/config.js`.
- [ ] `team`: one-line bios (uz/ru/en), and a photo only if the person wants one
      (`assets/team/…`). Until then each card shows "TBD".
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
- [x] First set of 10 emotion images received (hello, curious, aha, correct, tryagain,
      focus, win, inhale, exhale, asleep). **Redo these**, because they drifted from the
      sheet: ocus for all five (frowning, looks angry; ask for a calm, determined
      look), and Syno in ha, inhale, exhale, sleep (different body, missing the
      orange spark). The other scenes in ssets/source/character-poses-prompt.md
      (ready, oops, reading, kind, comfort, sleepy, goodnight, offline, safe) are optional.
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
