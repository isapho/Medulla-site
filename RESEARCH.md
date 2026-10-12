# Research behind the Medulla web app

Done in October 2026, before building. Each topic gives the question, what was found, the sources (all opened), the decision, and what was rejected. **"Guess"** marks anything that is an informed assumption rather than something a source states.

---

## 1. What makes learning sites for young people "sticky", and what to refuse

**Question.** Which engagement features help young people come back and learn, and which ones are manipulative?

**Found.**
- Gamification has small positive effects on learning. A meta-analysis found g = 0.49 for cognitive outcomes, 0.36 for motivation and 0.25 for behaviour, with large differences between studies (Sailer & Homner 2020).
- The two study techniques with the strongest evidence are **practice testing** (quizzes) and **spaced practice**. Rereading and highlighting rate "low utility" (Dunlosky et al. 2013). So a daily quiz is not decoration: it is the learning method.
- Duolingo's streak works by making a small daily action feel automatic. Duolingo itself says the streak leans on loss aversion. An independent case study found its streak, freeze and reminder features drive app dependency more than lasting habits.
- The UK Children's Code (ICO, standard 13) names **streaks and reward loops** as nudges that can push children to stay engaged. It forbids nudges that lead children to share data or weaken privacy settings.
- Science museums such as the Exploratorium ("Science Snacks") and Brain Awareness Week put hands-on activities and printable materials first.

**Sources.**
[Sailer & Homner 2020, Educ. Psychol. Rev.](https://link.springer.com/article/10.1007/s10648-019-09498-w) ·
[Dunlosky et al. 2013, PSPI (PubMed 26173288)](https://pubmed.ncbi.nlm.nih.gov/26173288/) ·
[Duolingo: how the streak builds habit](https://blog.duolingo.com/how-duolingo-streak-builds-habit) ·
[Duolingo case study (IJMAT)](https://www.wr-publishing.org/index.php/ijmat/article/view/908) ·
[ICO Children's Code commentary (TechCrunch)](https://techcrunch.com/?p=2191523) ·
[Exploratorium Science Snacks (overview)](https://www.envisionexperience.com/blog/science-snacks-activities-from-the-exploratorium) ·
[Dana Foundation BAW FAQ](https://dana.org/brain-awareness-week-faqs/)

**Decision.**
- **Build:**
  - A daily challenge: one fact, a 3-question quiz with explanations, and one short game.
  - Saved facts and a "my results" history.
  - Character badges.
  - A weekly summary.
  - Gentle "neuron growth" XP.
  - Printable activities.
- **Streak, kept gentle:**
  - One missed day never breaks it (an automatic rest day, no purchase).
  - No "you'll lose your streak" messages and no notifications.
  - The dashboard leads with "days active this week" rather than the streak number.

**Refused (manipulative for children):**
- Push notifications and loss-aversion reminders.
- Leaderboards among strangers.
- Random or variable rewards (loot boxes, spins).
- Countdown pressure on rewards.
- Streak shaming.
- Infinite feeds.
- Social comparison by default.

The only comparison is an opt-in school-club code that shows group totals, and only when sync is set up.

---

## 2. Accounts and login for a young audience

**Question.** Which sign-in is safest for children and teenagers in Uzbekistan, and how little data can we collect?

**Found.**
- **Uzbekistan, Law ZRU-547 "On Personal Data" (2019):**
  - Art. 4 defines personal data as information *"relating to a specific person or allowing them to be identified"*.
  - Art. 21: *"For minors, written consent to process their personal data, including as an electronic document, is given by the parents (guardians, trustees), or in their absence by the guardianship authorities."*
  - Consent must be confirmable by the operator. Operators may also need to register databases in the State Register.
  - Localization was relaxed in 2026 (Law No. 1125, 26 March 2026). Only biometric, genetic and local-telecom subscriber data must stay on servers in Uzbekistan. A Cabinet resolution of 29 July 2026 lists 49 "adequate" countries, including Germany and the USA. Breaches must be reported within 24 hours.
- **COPPA (US, reference only):** a persistent identifier used only for internal operations needs no parental consent. The 2025 amendments add a notice duty for operators who rely on this.
- **GDPR (Art. 8, reference only):** where a service relies on consent, parental consent is required under 13–16, depending on the country.
- **Supabase:**
  - Supports anonymous sessions with no email or other personal data; RLS applies to them too.
  - The free tier pauses a project after about 7 days without activity and allows 500 MB of database.
  - The JS SDK is 28 KB gzipped; the REST API needs no SDK.
  - Firebase app + auth + Firestore is about 109 KB gzipped (measured).
- **Telegram Login** returns the user's id, name, username and photo, and optionally the phone number. That is personal data.

**Sources.**
[ZRU-547 full text (lex.uz, RU)](https://lex.uz/ru/docs/4396428) ·
[Kun.uz: 49 countries approved, localization narrowed](https://kun.uz/en/news/2026/08/04/uzbekistan-approves-49-countries-for-simplified-personal-data-transfers) ·
[Legal500: Uzbekistan personal data compliance](https://www.legal500.com/developments/thought-leadership/personal-data-compliance-in-uzbekistan/) ·
[Latham & Watkins: 2025 COPPA amendments](https://www.lw.com/en/insights/2025/05/ftc-publishes-updates-to-coppa-rule) ·
[Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous) ·
[Supabase free-tier summary (third-party)](https://automationatlas.io/answers/supabase-free-tier-limits-2026/) ·
[Telegram Login](https://core.telegram.org/widgets/login)

**Options compared.**

| Option | Personal data collected | Parental consent needed (Art. 21) | Verdict |
|---|---|---|---|
| Guest, device-only | None leaves the device | No (we never receive or process the data) | **Default** |
| Anonymous **sync code** (random code, no email or name) | Progress numbers, badge ids, generated nickname indexes, never free text | Probably not, if the data cannot identify anyone (**guess**, needs a lawyer), so we ask a parent anyway for under-18s | **Optional, off until keys exist** |
| Email magic link | Email address | Yes | Rejected |
| Google sign-in | Name, email, photo | Yes, plus a third-party processor | Rejected |
| Telegram Login | Telegram id, name, username, photo | Yes | Rejected for the website |
| Parent-managed profiles | Parent email, child profiles | Yes, and verification is hard | Later, if schools ask |
| Firebase (instead of Supabase) | Same as chosen | Same | Rejected: 109 KB SDK, less control over SQL/RLS |
| Self-built server | Same | Same | Rejected: costs money and needs maintenance |

**Decision.** Guest mode always works and sends nothing. The optional sync works like this:
- **No account.** The device makes a random **sync code** (for example `MEMO-7K3F-OCTA-92QX`). Only a SHA-256 hash of the code is stored, together with the progress JSON, in one table. Access is only through `SECURITY DEFINER` functions, and RLS blocks direct access to the table.
- **Consent screen.** Turning sync on asks for an age band. Under 18 requires a parent/guardian step: the parent reads a plain-language summary and confirms.
- **Honest limits.** Neither design is verifiable parental consent, and the documents say so.

**Biggest open legal question (guess):**
- Whether an anonymous sync code plus progress counts as personal data under Art. 4 (Supabase still sees IP addresses at the network level).
- Whether Medulla must register a database.

Both go to a lawyer before sync is switched on (see HANDOFF.md).

---

## 3. Animation and motion

**Question.** What gives smooth 60 fps on mid-range Android phones at the lowest weight?

**Found** (gzipped sizes measured from the CDN builds on 12 Oct 2026):

| Option | Size (gzip) | Notes |
|---|---|---|
| CSS transitions/keyframes + Web Animations API | **0 KB** | Runs on the compositor when animating `transform`/`opacity` |
| CSS scroll-driven animations (`animation-timeline`) | **0 KB** | Chrome/Edge 115+, Safari 26+; Firefox still behind a flag, so needs a fallback |
| Cross-document View Transitions (`@view-transition`) | **0 KB** | Chrome 126+, Safari 18.2+; Firefox simply navigates normally |
| SVG path drawing (`stroke-dashoffset`) | **0 KB** | Ideal for neurons and diagrams |
| One small `<canvas>` (2D) | **0 KB** (about 4 KB of our own code) | Fine for about 100 moving points if paused off-screen |
| GSAP core + ScrollTrigger 3.13 | 27.6 + 17.4 = **45 KB** | Free since the Webflow deal; not needed for our effects |
| lottie-web 5.12 | **46 KB** (light) to **75 KB** (full), plus JSON files | Needs designer-made animation files |
| Rive canvas runtime 2.21 | 52 KB JS + **439 KB wasm** | Best for rigged characters, but heavy |
| three.js r160 | **164 KB** | WebGL is overkill and drains battery |

**Sources.**
[Chrome: cross-document view transitions](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document) ·
[Scroll-driven animations cross-browser status (2026)](https://www.buildmvpfast.com/blog/css-scroll-driven-animations-replace-js-2026) ·
[ICS Media: scroll-driven animations](https://ics.media/en/entry/230718/) ·
[GSAP license (README)](https://cdn.jsdelivr.net/npm/gsap@3.15.0/README.md) ·
[dotLottie runtime claim](https://lottiefiles.com/dotlottie) ·
CDN files measured: jsdelivr `gsap@3.13.0`, `lottie-web@5.12.2`, `@rive-app/canvas@2.21.6`, `three@0.160.0`.

**Decision.** Zero animation libraries.
- **Built with native tools:** CSS + Web Animations + SVG, plus one canvas for the hero neuron network.
- **Scroll storytelling:** uses `animation-timeline: view()` inside `@supports`, with an IntersectionObserver fallback.
- **Page transitions:** use cross-document View Transitions, with a fade-in fallback.
- **Character idle loops:** float, breathe (uniform scale ≤ 2%) and sway. They move the whole PNG, so the art is never redrawn or distorted.
- **Blinking and trunk/tentacle sway:** these need layered art (HANDOFF).

**Rejected.**
- GSAP: 45 KB for effects CSS already does.
- Lottie and Rive: need animation files made in other tools, plus 46–490 KB of runtime.
- WebGL: weight and battery.

---

## 4. Sound

**Question.** How to add sound without annoying anyone or breaking autoplay rules?

**Found.**
- Browsers block audio until the user interacts. Chrome has applied this to the Web Audio API since Chrome 71. The recommended pattern is a visible on/off switch, creating or resuming the `AudioContext` inside the click.
- Synthesized sound needs no files and no licence.

**Sources.**
[Chrome autoplay policy](https://developer.chrome.com/blog/autoplay) ·
[Web Audio spec discussion on auto-suspend](https://github.com/WebAudio/web-audio-api/issues/1802)

**Decision.**
- **Synthesized in code** with Web Audio: about 4 KB of our own code, 0 audio files.
- **Off by default.** It only turns on from the speaker button, and the choice is remembered.
- **Quiet:** master volume is about 15% of full scale.
- **No autoplay**, ever.
- **Visual equivalents:** every sound has one (toast, colour change, text in a live region).
- **Night ambience:** soft filtered noise in sleep mode, at the lowest level.

**Rejected:** audio files, which add weight and licence tracking. CC0 files would be allowed, but they aren't needed. `CREDITS.md` records this.

---

## 5. Telegram

**Question.** How do a daily-fact bot, a Mini App and Telegram login work, and which should we use?

**Found.**
- **Bot API:** `https://api.telegram.org/bot<token>/sendMessage` with `chat_id` (a numeric id or `@channelusername`), text up to 1–4096 characters, `parse_mode` and `link_preview_options`.
- **Mini Apps:** a Mini App is an ordinary web page opened inside Telegram.
  - `telegram-web-app.js` provides `initData` (to be checked on a server with HMAC-SHA256 using the bot token), theme colours, `BackButton` and `expand()`.
  - `CloudStorage` stores up to 1024 keys per user per bot, with keys of 1–128 characters and values of 0–4096 characters.
- **Telegram Login** returns id, name, username and photo.

**Sources.**
[Bot API: sendMessage](https://core.telegram.org/bots/api#sendmessage) ·
[Telegram Mini Apps](https://core.telegram.org/bots/webapps) ·
[Telegram Login](https://core.telegram.org/widgets/login)

**Decision.**
1. **Daily-fact bot:** `telegram/bot.mjs`, a Node script with no dependencies.
   - Posts one message per day in Uzbek, Russian and English to the channel. The bot must be a channel admin.
   - Runs free on GitHub Actions cron.
   - Tested locally against a mock Telegram server.
2. **Mini App:** the same website.
   - `js/telegram.js` loads Telegram's script only when the page is opened inside Telegram, then adapts the header colour, back button and full height.
   - Progress could later use Telegram `CloudStorage`, which needs no server of our own (`telegram/MINI_APP.md`).
3. **Telegram Login:** not used, because it hands us names and photos of children.

---

## 6. Games and exercises that are honest about evidence

**Question.** Which activities are worth building, and what can each one claim?

**Found.**
- Brain training mostly improves the trained task. There is "less evidence" for closely related tasks and "very little evidence" for distant tasks or everyday thinking (Simons et al. 2016).
- Slow breathing (under 10 breaths a minute) is linked to relaxation, comfort and heart-rate-variability changes. However, the review rests on only 15 studies, and the mechanism is still debated (Zaccaro et al. 2018).
- The NHS breathing exercise: breathe in for a count of 1–5, out for 1–5, for at least 5 minutes, regularly.
- NHS sleep tips: a calm bedtime routine, regular times, no phones or tablets for an hour before bed, and breathing exercises.
- NINDS: the frontal lobes keep one idea in mind while others are considered (short-term storage). This is the basis for the digit span and sequence explanations.

**Sources.**
[Simons et al. 2016 (APS summary)](https://www.psychologicalscience.org/publications/brain-training.html) ·
[Zaccaro et al. 2018 (PubMed 30245619)](https://pubmed.ncbi.nlm.nih.gov/30245619/) ·
[NHS breathing exercise](https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/) ·
[NHS sleep tips](https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/how-to-fall-asleep-faster-and-sleep-better/) ·
[NINDS Know Your Brain](https://www.ninds.nih.gov/health-information/public-education/brain-basics/brain-basics-know-your-brain)

**Decision.** Build six activities, each ending with "What it measures" and "What it doesn't show":

| Activity | Measures | Does not show |
|---|---|---|
| Stroop (kept) | Ignoring an automatic habit (reading) to name the ink colour | Intelligence, attention disorders |
| Reaction time (kept) | Simple reaction time on this device | Brain health; device lag differs |
| **Digit span** (new) | How many digits you can hold and repeat in order | IQ; tiredness, language and practice change it |
| **Sequence memory** (new) | Remembering positions in order (visual-spatial span) | Everyday memory; practice inflates it |
| **Breathing with Syno** (new) | Nothing is measured; it is a guided 5-in/5-out exercise (NHS) | That it treats anxiety or any condition |
| **Lumi's wind-down** (new) | Nothing is measured; a 3-minute dark, quiet routine that ends with "put the phone away" | That it cures sleep problems |

**Research mode:** not built. It would collect data from minors, which needs written parental consent (Art. 21), an ethics review and an expert supervisor. It is shown as "coming soon" with these reasons.

**Tests:** never framed as IQ or diagnosis. Flashes stay under 3 per second; sequence tiles light for 600 ms with gaps.

---

## 7. Hosting and architecture

**Question.** Keep plain HTML/JS, or move to a build tool like Vite?

**Found.**
- GitHub Pages is free: 1 GB site, 100 GB/month soft bandwidth limit, HTTPS, custom domains. Netlify and Cloudflare Pages also have free static tiers.
- The site's own JS and CSS is about 150 KB raw before compression. Bundling would save little; images matter far more.
- The founders edit text and JSON, not code.

**Sources.**
[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

**Decision.** Keep the no-build vanilla runtime. Add one optional, zero-dependency Node script, `tools/build.js`, that turns content into pages:
- Uzbek text pre-rendered into the HTML, for search engines and no-JS readers.
- One page per fact (`facts/<id>.html`) and per topic (`topics/<topic>.html`).
- `sitemap.xml`.
- The `file://` mirror of the facts.
- The offline cache list.

It also contains the site's checks (`node tools/build.js --check`). Offline support comes from a hand-written service worker. Hosting is GitHub Pages; Netlify drag-and-drop also works.

**Rejected:**
- **Vite:** adds npm, `node_modules` and a dev server; the founders' edits would need a working toolchain; small benefit at this size.
- **A framework:** same reasons, plus a runtime of tens of KB.

---

## Corrections to the project brief

- **Brain Awareness Week:** the Dana Foundation says no registration or permission is needed, and that it does not partner with individual organizers. "Register Medulla as a partner" became "take part and use Dana's free materials". 2027 dates: **15–21 March**.
- **Data localization:** since March 2026 it applies only to biometric, genetic and telecom subscriber data. Earlier summaries saying all personal data must stay in Uzbekistan are out of date.
