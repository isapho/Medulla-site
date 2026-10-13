# Telegram: daily-fact channel and Mini App

Two separate things. You can do the first without the second.
The **interactive bot** (facts, quizzes, hard words, breathing, inline sharing)
is a third, separate part: see [`BOT.md`](BOT.md). It can use the same bot token.

## 1. Daily-fact channel bot (ready)

`telegram/bot.mjs` posts the website's fact of the day to a channel in Uzbek,
Russian and English. Each post has the fact with its brain-map area and
character (and that character's picture as a small preview), a quiz question
with the answer behind a spoiler, the source link, the "Pending expert review"
label, a "Get it every day in a private chat" button that opens the bot's
`/daily` (from `telegramBot` in `js/config.js`) and, when `SITE_URL` is set, a
"Read the full fact" button.

**Set it up (about 10 minutes):**

1. In Telegram, open **@BotFather** → `/newbot` → choose a name ("Medulla") and
   a username ending in `bot`. Copy the token. Treat it like a password.
2. Create the channel (or use the existing one). Open **channel → Administrators
   → Add admin**, pick your bot and allow **Post messages** only.
3. Try it on your computer:
   ```bash
   node telegram/bot.mjs --dry-run
   ```
   Then send one real post (PowerShell):
   ```powershell
   $env:BOT_TOKEN="123:ABC"; $env:CHANNEL_ID="@your_channel"; node telegram/bot.mjs --lang=en
   ```
4. Automate it: in the GitHub repository open **Settings → Secrets and variables →
   Actions**, add secret `BOT_TOKEN` and variables `CHANNEL_ID` (and `SITE_URL`).
   `.github/workflows/daily-fact.yml` then posts every day at 08:00 Tashkent time.
   **Actions → Daily fact to Telegram → Run workflow** does a dry run on demand.

One channel for all three languages gets three posts a day. If that is too
many, create three channels and set `CHANNEL_ID_UZ`, `CHANNEL_ID_RU` and
`CHANNEL_ID_EN` instead, or set `LANGS=uz,ru` to post fewer languages.

Tests (a mock Telegram server, nothing is sent): `node --test telegram/bot.test.mjs`

## 2. Mini App (plan; the adapter is already in the site)

A Mini App opens the website inside Telegram with a button in the bot or channel.

**Already done in the site:** `js/main.js` notices the Telegram launch
parameters and loads `js/telegram.js`. That loads Telegram's script, expands
to full height, matches the header colour (the app's navy top bar, or the
light/dark theme on public pages, following the dark/light switch) and shows Telegram's own Back
button on inner pages. Everything else (facts, Lab, daily challenge, progress
on the device) works as on the web.

**To switch it on (you):**

1. Have the site on a public HTTPS address (see `HANDOFF.md`).
2. @BotFather → `/mybots` → your bot → **Bot Settings → Configure Mini App →
   Enable Mini App**, URL `https://YOUR-DOMAIN/index.html`.
   Optionally, **Menu Button** → same URL, title "Medulla".
3. Optional: in the channel, pin a post with a button that opens
   `https://t.me/<bot_username>?startapp`.

**Decisions and privacy:**

- **No Telegram login, and no Telegram user data used.** Telegram passes the
  user's name, username and id to Mini Apps (`initData`). Medulla's audience
  includes minors, and Uzbekistan's personal data law (Art. 21) needs written
  parental consent for their data, so the site never reads or stores it. Progress
  stays in the browser storage of the Telegram app, just as on the web.
- **Telegram CloudStorage (later, optional).** `Telegram.WebApp.CloudStorage`
  could keep progress in the user's own Telegram account across devices
  (up to 1024 keys, each up to 4096 characters). That is still personal data
  linked to a Telegram account, so add it only after the legal review and with
  the same parent/guardian step as sync. The progress store already offers
  `syncPayload()` and `merge()`, which is all an adapter needs.
- **If you ever need to trust `initData` on a server** (for example for
  club totals inside Telegram), validate it on the server with the bot token:
  build the data-check string from the sorted `key=value` pairs except `hash`,
  compute `HMAC_SHA256(key = HMAC_SHA256("WebAppData", bot_token), data_check_string)`,
  compare it with `hash` and reject old `auth_date` values. Never validate in the
  browser and never put the bot token in the site. Telegram's guide:
  https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
- Telegram's script is loaded **only** inside Telegram, so web visitors never
  contact telegram.org. The Privacy page says this.
