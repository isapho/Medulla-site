# The interactive Medulla bot

The channel bot (`bot.mjs`, see `MINI_APP.md`) only *posts* the daily fact.
This one *talks*: people open it in Telegram and it answers in Uzbek, Russian
or English.

| What people can do | How |
|---|---|
| Fact of the day (the same one the website and channel show) | `/fact` or the menu |
| **Get the fact of the day every day** at 08:00, 13:00 or 18:00 (Tashkent time) | `/daily` or 🔔 in the menu; `/stop` ends it |
| **The brain map**: the app's five areas (Learning · Memo, Movement · Octa, Discovery · Dendi, Calm · Syno, Sleep · Lumi), each with today's small step, its target and its "why" fact | `/map` or 🗺 in the menu |
| A random fact, a sleep fact, another fact from one area | `/random`, `/sleep`, 🎲 in an area |
| Switch between the simple and the detailed text | the 🔎 / ✏️ button under a fact |
| A quick quiz (Telegram's own quiz poll, anonymous) | `/quiz` or ❓ under a fact |
| Hard words explained (the site's glossary) | `/word synapse`, or just send a word |
| Search the facts | send any word, e.g. “sleep”, “память”, “xotira” |
| One calm breathing minute with Syno | `/breathe` |
| Open the website inside Telegram (Mini App) | 🧠 button, once `SITE_URL` is https |
| Share a fact in any chat | type `@your_bot sleep` in any chat (inline mode) |
| Change language | `/lang` |
| See what the bot keeps (nothing) | `/privacy` |

Every fact says which brain-map area it belongs to (the area of the character
who presents it, as on the site) and shows that character as a small picture.
The daily message adds the area's step for today and an "Open my brain map"
button once the site is live, so the bot leads back to the app where the
areas light up. The bot itself never tracks anyone's habits.

Accessibility in the bot: short messages, every button has an emoji **and**
words, the simple text comes first, quizzes have no time limit, and a word
the person doesn't know can be looked up by just typing it.

## Privacy (why it is built this way)

- **Nothing is stored**, except for people who turn on the daily fact. No
  logs, no names or usernames. Each message is answered and forgotten.
- **The daily fact is opt-in.** A bot can't write to someone later without
  remembering where, so `/daily` keeps exactly three things: the private
  chat's number, the language and the hour. The screen that turns it on says
  so and asks under-18s to check with a parent or guardian first. `/stop`
  deletes the entry at once; blocking the bot does too (Telegram answers
  "blocked" on the next send and the bot removes the chat). Groups can't
  subscribe. `/privacy` and the site's Privacy page say the same.
- The language comes from the button someone pressed, or from Telegram's
  `language_code` at the moment they write. It is not saved.
- Quiz polls are **anonymous**.
- In groups the bot answers only commands, never ordinary messages.
- The bot token is a password: it lives only in environment variables /
  Cloudflare secrets, never in the repository. Error messages never contain it.

## 1. Create the bot (5 minutes, you)

1. In Telegram open **@BotFather** → `/newbot`. Name: `Medulla`. Username: for
   example `medulla_mind_bot`. Copy the token.
2. Still in BotFather: `/setinline` → choose the bot → placeholder text
   `fact or word…` (this switches on inline sharing).
3. Optional: `/setuserpic` with `assets/brand/icon-512.png`.
4. Put the username (without @) in `js/config.js` → `telegramBot`, build and
   push. The "Open the bot" buttons on the site appear by themselves.

## 2. Try it on your computer (no server needed)

```bash
node telegram/poll.mjs --demo "/start" uz
```

prints what the bot would answer, without a token (`--demo --daily ru` prints
today's daily message). In Git Bash on Windows, put `MSYS_NO_PATHCONV=1` in
front, or it turns `/start` into a folder path. With the real token
(PowerShell):

```powershell
$env:BOT_TOKEN="123:ABC"; $env:SITE_URL="https://isapho.github.io/Medulla-site"; node telegram/poll.mjs --setup
$env:BOT_TOKEN="123:ABC"; $env:SITE_URL="https://isapho.github.io/Medulla-site"; node telegram/poll.mjs
```

`--setup` registers the command menu and descriptions in all three languages
and the Mini App menu button. The second command runs the bot until you press
Ctrl+C. While it runs this way, `/breathe` can also guide the minute live
(the message changes every 5 seconds), and the daily fact goes out from this
computer: the list is kept in `telegram/.subscribers.json` (never committed),
and if the computer was off at 08:00 the fact goes out when it starts again.

## 3. Run it all the time for free (Cloudflare Workers)

A laptop can't stay on all day, so for real use deploy `worker.mjs`:

1. Create a free Cloudflare account (you).
2. From the `telegram` folder:
   ```bash
   npx wrangler deploy
   npx wrangler secret put BOT_TOKEN
   npx wrangler secret put WEBHOOK_SECRET
   ```
   `WEBHOOK_SECRET` is any long random string you make up. `SITE_URL` is set in
   `wrangler.toml` (change it when you have your own domain).
3. Tell Telegram where to send messages (open this once in a browser, with your values):
   ```
   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://medulla-bot.<your-subdomain>.workers.dev/&secret_token=<WEBHOOK_SECRET>
   ```
4. Run `node telegram/poll.mjs --setup` once (step 2) for the command menu.
5. **Switch on the daily fact** (still in `telegram/`):
   ```bash
   npx wrangler kv namespace create SUBS
   ```
   Copy the `id` it prints into `wrangler.toml` (the `[[kv_namespaces]]` block
   at the bottom; remove the `#` signs), then `npx wrangler deploy` again.
   The cron trigger is already in `wrangler.toml`: every 5 minutes. It only
   works at 08:00, 13:00 and 18:00 Tashkent time; each run sends to one twelfth
   of that hour's people, so the whole list goes out within the hour.

   **How many people:** the free plan allows 50 requests per run, so a run
   sends at most 45 (`MAX_PER_RUN`), which is about 540 people per time
   (about 1,600 across the three times). With Workers Paid ($5 a month), raise
   `MAX_PER_RUN` to a few hundred. If Medulla grows past that, tell people to
   follow the channel instead.

The Worker reads `data/facts.json`, `data/glossary.json` and
`data/bot-strings.json` from `DATA_URL` in `wrangler.toml` (the public GitHub repository, so it works even while the website is offline; `SITE_URL` stays empty until the site is live, then the bot also shows website buttons), so every site update also
updates the bot. (`node tools/build.js` writes `bot-strings.json`.) The guided
live breathing minute is only available in long-polling mode; the Worker sends
the steps and a link to the animated version on the site.

**Long polling and the webhook can't run together.** `poll.mjs` removes the
webhook when it starts; run step 3 again afterwards to switch back.

## Sign in on the website (Telegram and Google)

The Worker also serves the website's sign-in and sync (`auth.mjs`). Setup,
all of it already done for Telegram:

1. `npx wrangler secret put AUTH_SECRET`: any long random string. Keep it: it
   is what turns an account id into a sync code, so a new secret means new
   codes (people can still restore with the old code shown in Me → Sync).
2. **Telegram:** nothing to set up. The person sends `/login` to the bot (or opens
   `t.me/<bot>?start=login`), gets a one-time code (8 symbols, valid 5 minutes,
   usable once) and types it on the sign-in page. The Worker swaps it for the
   same sync code Telegram's login widget would give. Inside the Mini App it is
   one tap. (`/auth/telegram`, the widget route, is still there but unused; that
   is the only reason `/setdomain` would matter.)
3. **Google** (needs your Google account):
   1. console.cloud.google.com → create a project → APIs & Services → OAuth
      consent screen (External; app name Medulla; your e-mail; scopes: only the
      default `openid`, e-mail and profile) → Publish.
   2. Credentials → Create credentials → OAuth client ID → *Web application* →
      Authorized JavaScript origins: `https://isapho.github.io` (and your own
      domain later). No redirect URI is needed.
   3. Copy the Client ID (`…apps.googleusercontent.com`, public, not secret)
      into `js/config.js` → `googleClientId` **and** `telegram/wrangler.toml` →
      `GOOGLE_CLIENT_ID`, then `npx wrangler deploy`, build and push.

What is stored: only the progress numbers (the same payload as code sync, under
the SHA-256 of the code). Routes: `POST /auth/telegram`, `/auth/telegram-webapp`,
`/auth/google`, `/sync/save`, `/sync/load`, `/sync/delete`. Only the site (and
localhost) may call them from a browser.

## Tests

```bash
node --test telegram/assistant.test.mjs
```

26 tests with a fake Telegram and a fake KV: menus in three languages, the
fact of the day, every quiz as a valid quiz poll, 64-byte button data,
hard-word lookup, groups, inline mode, the breathing minute, the Worker's
secret check, that errors never contain the token, the brain map (same five
areas and "why" facts as `js/explore.js`), the whole `/daily` → `/stop` flow,
no fact twice in a day, blocked chats removed, the laptop catching up, and the
Worker's five-minute batches staying under the request limit. GitHub Actions
runs them on every push.

## Files

| File | What it is |
|---|---|
| `assistant.mjs` | The bot itself: `handleUpdate(update)` and `sendDaily(chat, lang)`, no packages |
| `auth.mjs` | Website sign-in (Telegram, Google) and cloud sync routes for the Worker |
| `subscribers.mjs` | Who turned on the daily fact: Workers KV, a JSON file, or memory (tests) |
| `poll.mjs` | Run with long polling (also sends the daily fact); `--setup`, `--demo` |
| `worker.mjs`, `wrangler.toml` | The same bot as a Cloudflare Worker (webhook + cron for the daily fact) |
| `assistant.test.mjs` | Tests |
| `bot.mjs` | The separate daily channel post (see `MINI_APP.md`) |
