# Plan: Medulla as a CS/DS application project

Written 12 October 2026. The package: **instrument validation + "run your own
experiment" (n-of-1) + tests/CI + Uzbek neuroscience glossary**, written up as one
case study.

Rules that stay in force (from the project brief): no invented numbers, people,
partners or photos; health content stays "Pending expert review" until a
specialist signs it off; nothing about minors is collected without consent.

---

## 0. Answers I need from you first

| Question | Why it matters |
|---|---|
| Which grade are you in, and which application round (Nov 1 / Jan 1 / next year)? | Decides how much is realistic and whether RSI (juniors only) is open to you. |
| Which countries/universities (US, UK, Turkey, other)? | Changes what to put in the Common App-style activity list and which programs matter. |
| Is there one adult who can act as mentor (teacher, university lecturer)? | Needed for ethics, for JEI, for the "Advisors" slot, and for credibility. |
| Who on the team is 18+? | Decides who can be in the reliability study without parental consent. |
| Do you have 3–6 different devices (phones, a laptop, a school PC) you can test on? | Needed for the timing study. |
| Is a Python install acceptable? (Not installed now; Node is.) | The analysis notebook can be Node-only if not, but Python/Jupyter is what universities recognise. |

---

## 1. Step-by-step plan

### Phase 1: Engineering foundation (weeks 1–2)
1. Unit tests for `js/store.js` (XP, levels, streak with rest days, badges, merge on restore): `node:test`, no packages.
2. Tests for the fact data and i18n key parity beyond `tools/build.js --check`.
3. Add them to `.github/workflows/checks.yml` so every push runs them.
4. Add `docs/ARCHITECTURE.md` (one diagram, data flow, privacy boundaries), `LICENSE`, `CONTRIBUTING.md`.
5. Tag release `v2.1.0` when done.

### Phase 2: Instrument validation (weeks 2–5)
1. **Timing harness** (`lab-calibration.html`, not linked from the main nav): logs `performance.now()` resolution, frame jitter (requestAnimationFrame), event-timestamp vs paint delay, touch vs mouse.
2. **Ground truth**: record a 240 fps slow-motion phone video of a stimulus and a tap to estimate true latency on 3–6 devices.
3. **Reliability**: test-retest (two sessions, a few days apart) and split-half reliability of the Stroop interference score and the reaction-time mean. Pre-register the hypotheses and analysis on OSF *before* collecting.
4. **Analysis notebook**: distributions, intraclass correlation, Bland–Altman plot for device agreement, bootstrap confidence intervals. Report the small-sample limits plainly.
5. **Result goes back into the product**: the "what this measures / doesn't show" cards in the Lab quote your own measured error, not a guess.

### Phase 3: "Run your own experiment" (weeks 4–7)
1. User picks a question from a short list (for example "caffeine-free evening vs. usual evening", "screens off 30 min before bed"), a duration (7–14 days) and a measure (reaction time or Stroop).
2. Daily check-in adds one result; everything stays in the browser (guest mode).
3. At the end the site shows a paired comparison with a permutation test and a confidence interval, and states what it cannot say (confounds, tiny n, not medical advice).
4. Text in uz/ru/en, "Pending expert review" label until reviewed.
5. Tests for the statistics (known inputs, known outputs).

### Phase 4: Uzbek neuroscience glossary (weeks 3–6, in parallel)
1. Extract every term from `data/facts.json` and `js/lang/*.js` into one table: term (uz-Latn / ru / en), plain definition, source fact.
2. Native-speaker review of the Uzbek terms; specialist review of the definitions.
3. Publish as CSV + JSON under CC-BY on Zenodo (DOI) and the repo; add a Glossary page to the site.
4. Stretch: a Latin↔Cyrillic Uzbek transliterator with tests.

### Phase 5: Write-up and evidence (weeks 6–8)
1. `case-study.html` page + a one-page PDF: problem → question → method → result → what I'd do differently.
2. OSF registration + Zenodo DOIs for dataset, glossary and notebook; cite them on the page.
3. 2-minute demo video (screen recording).
4. "My role" log: what you personally designed, built, decided. Feeds the activity list and essays.
5. Optional: submit to JEI (see §3). Realistically this is after application deadlines.

### Phase 6: Partners and expert (start now, runs alongside)
1. Ask one specialist to review health content (HANDOFF step 6) and, if willing, be named under Advisors.
2. Apply for the Brain Awareness Week grant, join Brain Bee (see §3).
3. Only add partners/logos to `js/config.js` after written agreement.

---

## 2. Who does what

### I can really do
- Phase 1 entirely: tests, CI, architecture doc, LICENSE/CONTRIBUTING.
- Build the timing harness, the n-of-1 feature (UI, stats, three languages), and the glossary extraction and page.
- Write the analysis notebook and statistics code, and unit-test it.
- Draft the OSF pre-registration, the case study, the README/CHANGELOG entries, consent and information sheets (for a lawyer/teacher to check).
- Draft emails and application messages to partners/mentors (you send them).
- Help with essays and activity descriptions in your voice.
- Update `tools/build.js` checks so new pages stay consistent.

### Needs you (I cannot do these)
- Run the device tests, hold the phone, record the slow-motion video.
- Recruit participants, collect consent, run sessions.
- Find and ask a mentor; get school or ethics sign-off.
- Get native Uzbek and Russian review, and specialist review of health content.
- Create accounts (OSF, Zenodo, GitHub settings) and click submit/send. I won't do these for you.
- Make every claim true: I will not write results that were not measured.

### Needs an adult or a professional
- Mentor/advisor, legal check for data from minors (HANDOFF step 8), specialist signing off facts.

---

## 3. Partners, programs and prestige: what I found

Verified on the pages named. "Unconfirmed" means I could not verify it and you must check.

| Option | What it is | Status / caution |
|---|---|---|
| **IBRO Brain Awareness Week grants** | Up to **$1,250** for outreach, regions outside Europe including Asia. 2026 and 2027 campaigns supported. Favours creative, culturally responsive projects from under-represented regions. [Dana page](https://dana.org/grant/international-brain-research-organization-ibro-3/), [apply: ibro.org/baw-grants](https://ibro.org/baw-grants/) | **2027 call dates unconfirmed.** Last cycle closed 31 Oct 2025, so check now. Funds do not cover overhead or honoraria. Your Events page already targets BAW 15–21 March 2027. |
| **Brain Awareness Week itself** | No registration or permission needed; Dana offers a social-media toolkit and an international events calendar, but does not promote individual events. [FAQ](https://dana.org/brain-awareness-week-faqs/) | List your event on their calendar. |
| **Brain Bee Uzbekistan** | National round of the International Brain Bee (ages 13–19; local → national → world). A Telegram channel [IBB_uzb](https://t.me/s/IBB_uzb) calls itself the official channel. [IBB FAQ](https://www.thebrainbee.org/faq/) | **Affiliation unconfirmed**; verify with the international organisers before announcing anything. Natural fit: a study guide and quiz in Uzbek. |
| **IYNA Virtual Brain Bee** | Fallback for countries without a national round: virtual.brainbee@youthneuro.org | No Uzbekistan chapter found. |
| **Journal of Emerging Investigators (JEI)** | Peer-reviewed journal for grades 6–12 worldwide. Needs hypothesis-driven original research, a senior adult as last author, and an adult (not you) to submit. Review can take up to 12 months. [Eligibility](https://emerginginvestigators.org/submissions/author-eligibility) | Fee policy sources disagree; check the site. Submission *before* university enrolment. Instrument validation could qualify; not guaranteed. |
| **Research Science Institute (RSI, MIT/CEE)** | Free summer program. Page says **juniors only**; applications for 2027 close **11 Dec 2026**. [cee.org](https://www.cee.org/programs/research-science-institute) | International eligibility not stated on the page (third-party sites claim it is open). Only relevant if you are a junior. Very selective. |
| **OSF + Zenodo** | Free pre-registration, preprints and DOIs for data and code. | Nothing blocks you; ethics rules depend on your school. |
| **IT Park Uzbekistan** | "One Million Uzbek Coders" free programming courses and school-level contests that included a data-analysis track. [IT Park news](https://www.it-park.uz/en/itpark/news/it-park-held-it-competition-among-participants-of-the-project-one-million-uzbek-coders) | Useful for a local contest result or a talk; not a research partner. |
| **University faculty** | Inha University in Tashkent has hosted data-science seminars; New Uzbekistan University runs a Yandex ML School (university-level). | Best source of a statistics mentor. Approach by email with a one-page summary. |
| **Presidential / specialised schools** | Government school system with olympiad programs. [piima.uz](https://piima.uz/en/page/presidential-schools) | Only if your school is one; otherwise irrelevant. |
| **Regeneron ISEF** | The big international fair. | **No Uzbekistan affiliate found.** Do not plan around it; ask your school or Ministry if one exists. |
| **Kaggle** | Free datasets/notebooks hosting. | No high-school program found; use only as a place to publish. |

### What gives prestige (honest ranking)
1. A **named adult mentor** who agrees in writing.
2. A **citable DOI** for your dataset/glossary and a pre-registered study.
3. A **real, small, correctly analysed result**, even if it is "the timing error is X ms and the Stroop score has reliability r".
4. A **funded or recognised event** (BAW grant, Brain Bee link).
5. Logos come last and only with written permission.

---

## 4. Timeline at a glance (starting 12 Oct 2026)

| Weeks | Output |
|---|---|
| 1–2 | Tests + CI + architecture; mentor and specialist outreach; check IBRO call |
| 2–5 | Timing harness, device data, pre-registration, notebook |
| 3–6 | Glossary + review |
| 4–7 | n-of-1 feature |
| 6–8 | Case study, DOIs, demo video |

If applying **Nov 1**: finish Phases 1 and a smaller Phase 2 (timing data only, no
participants) and say exactly that. If applying **Jan 1 or later**: all of the
above is realistic, except journal publication.
