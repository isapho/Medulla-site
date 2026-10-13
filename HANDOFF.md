# Handoff: what only you can do

The site already works with none of this: guest mode, no keys, dashed "TBD"
placeholders. Work through the list in order. Each step says where the result
goes. Tick the boxes as you go.

---

## 0. Versions 2.2, 2.3 and 2.4: check them, then publish (new)

Version 2.1 is published. Versions 2.2 (your new Gemini character sheets with
ten expressions each, bubbly icons, the new hero background and the redrawn
explainers), 2.3 (separate public site and app, the sign-in page, your
wireframe-brain logo) and 2.4 (the brain map, the game-style top bar) are in this folder but **not yet committed or pushed**.
Pushing to `main` publishes them on GitHub Pages.

- [ ] Try the new flow: open the landing, press **Boshlash**, pick a character,
      enter, look around the app (top bar on a computer, tab bar on a phone),
      then **Chiqish** (sign out) in the avatar menu. Open the landing again after
      signing in: it goes to the dashboard (`index.html?site=1` shows the landing).
- [ ] Try the brain map: tap an area, log sleep, movement and mood, read a
      fact, play a Lab test, and watch the areas light up. Ask a few students
      whether the five areas and their names make sense in Uzbek and Russian.
- [ ] Ask your expert reviewer to check the new health lines too: the sleep
      and movement targets (NHLBI, WHO) and the low-mood note in the Calm area
      (`map.sleep.hint`, `map.move.hint`, `map.mood.support` in `js/lang/*.js`).
      If your school or partners have a helpline for young people, it could be
      added to that note.
- [ ] Check the logo in the header, footer, browser tab and on the sign-in page.
      If you have a larger or sharper export of it, put it in
      `assets/source/logo-network.png` (the original drawing for the browser tab: `assets/source/logo-original.png`) and run `node tools/logo.mjs`, then
      `node tools/export-png.mjs` (share image) and `node tools/build.js`.
- [ ] Telegram: give the bot the new picture with @BotFather `/setuserpic`
      using `assets/brand/icon-512.png` (and the channel/Instagram too, if you
      want them to match).

- [ ] Open the site locally (`npx serve .`) and look at the home page in light
      and dark, the character cards (point at one), the Lab (start a test) and
      the eye on the home page (move the slider).
- [ ] Look at every cut-out: with the local server running, open
      `tools/out/cut.html` (`?bg=d` for the dark background). To fix one, replace
      its sheet in `assets/source/gemini/` and run `node tools/cutout.mjs`.
- [ ] Optional: in the first Memo sheet, "aha" overlapped "curious". It is
      cleaned up, but regenerating that sheet with more space between poses
      would be cleaner. If Gemini lets you download the full-size PNG, use it
      instead of the chat image for sharper art.
- [ ] If you like it, commit and push:
      ```bash
      git add -A
      git commit -m "Medulla 2.2 to 2.4: new characters and icons, public site and app, team logo, brain map"
      git push
      ```

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

**Interactive bot (new in 2.1)**, full guide in `telegram/BOT.md`:

- [ ] @BotFather → `/newbot` (or use the channel bot), then `/setinline` to allow sharing facts in any chat.
- [ ] Put the bot's username (without @) in `js/config.js` → `telegramBot`, build, push.
      Until then the site shows "Bot coming soon".
- [ ] Free hosting: a Cloudflare account, then `npx wrangler deploy` in `telegram/`,
      the two secrets (`BOT_TOKEN`, `WEBHOOK_SECRET`) and the one `setWebhook` link (BOT.md §3).
- [ ] Run `node telegram/poll.mjs --setup` once with the token: command menu and
      descriptions in uz/ru/en. (Run it again after updating to 2.6: the menu
      gained `/map`, `/daily` and `/stop`.)
- [x] **Daily fact for each person (2.6):** the KV namespace `medulla-bot-SUBS` is created and bound in `wrangler.toml`. Still needed: `npx wrangler deploy`. (How it was made: in `telegram/` run
      `npx wrangler kv namespace create SUBS`, paste the id it prints into
      `wrangler.toml` (the commented `[[kv_namespaces]]` block, remove the `#`),
      then `npx wrangler deploy` again. Until then `/daily` politely says it isn't
      switched on. Running the bot on a computer instead (`poll.mjs`) needs nothing:
      it keeps the list in `telegram/.subscribers.json`.
- [ ] When the website is live, set `SITE_URL` in `wrangler.toml` and redeploy:
      the bot then shows "Open my brain map" and website buttons.

**New fact every day, automatically (2.6):**

- [ ] **First push your local work** (versions 2.2–2.6 are still only on this
      computer; GitHub has 2.1). Otherwise the bot reads old texts, and the
      automatic facts would conflict with your local `data/facts.json`.
- [ ] Get an API key at console.anthropic.com, then GitHub → Settings → Secrets
      and variables → Actions → New repository secret: `ANTHROPIC_API_KEY`.
      Expect a few cents a day.
- [ ] Actions → "Add a new fact" → Run workflow (leave "dry run" ticked) and read
      the log. Untick it for one real run. After that it runs by itself every day.
- [ ] Optional variable `FACTS_PER_RUN` = 2 for two facts a day.
- [ ] **Review facts.** They are published as "Pending expert review". Look at
      the new ones in `data/facts.json` now and then, fix or delete any, and set
      `reviewed: true` after a specialist has checked them.
- Note: the daily fact is `facts[day % number of facts]`, so every added fact
  moves today's pick. The job runs at 01:30 so nobody notices.

**Daily channel post:**

- [ ] Create the bot with @BotFather and make it an admin of the channel (Post messages only).
- [ ] GitHub → Settings → Secrets and variables → Actions: add the secret
      `BOT_TOKEN`, plus the variables `CHANNEL_ID` and `SITE_URL`.
      Then run "Daily fact to Telegram" once, by hand.
- [ ] Optional Mini App: @BotFather → Configure Mini App → `https://YOUR-DOMAIN/index.html`.
      See `telegram/MINI_APP.md`.

## 10. Art

- [x] **Characters (2.2):** your Gemini sheets, cut out with `tools/cutout.mjs`.
- [x] **Logo (2.2):** a white-line brain mark for the purple tile, as SVG.
- [ ] Decide whether you are happy with the four Canva-AI scenes (glass brain,
      neurons, night sky, waves; listed in CREDITS.md). Replace any you don't like
      with the same file names in `assets/img/`.
- [x] **Line art** for the colouring pages is traced from the new art
      (`assets/printables/*-lines.png`). Clean line art from an illustrator
      would still look better.
- [ ] A designed 1200×630 share image if you want one instead of
      `assets/brand/og-image.jpg`.

## 10b. Accessibility (new in 2.1)

- [ ] **Test with real people.** Ask 3–5 people who live with ADHD, dyslexia, autism,
      epilepsy, low vision or after a brain injury (adults, or children only with
      their parents' agreement) to try the matching profile for 10 minutes. Note
      what was hard. Don't record names or health details.
- [ ] Try the site with a screen reader (TalkBack on Android, VoiceOver on iPhone,
      NVDA on Windows) and with only a keyboard. axe-core found no problems, but
      tools catch only part of what matters.
- [ ] **Hard words:** have a native speaker check the Uzbek and Russian wording in
      `data/glossary.json`, and a specialist check the definitions (same as the
      facts). Set `"reviewed": true` per word when approved.
- [ ] Read aloud needs an Uzbek voice on the device. If you know a good free one
      for Android/Windows, add a tip to the Accessibility page.

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
