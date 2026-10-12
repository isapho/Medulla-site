# The interactive Medulla bot

The channel bot (`bot.mjs`, see `MINI_APP.md`) only *posts* the daily fact.
This one *talks*: people open it in Telegram and it answers in Uzbek, Russian
or English.

| What people can do | How |
|---|---|
| Fact of the day (the same one the website and channel show) | `/fact` or the menu |
| A random fact, a sleep fact | `/random`, `/sleep` |
| Switch between the simple and the detailed text | the 🔎 / ✏️ button under a fact |
| A quick quiz (Telegram's own quiz poll, anonymous) | `/quiz` or ❓ under a fact |
| Hard words explained (the site's glossary) | `/word synapse`, or just send a word |
| Search the facts | send any word, e.g. “sleep”, “память”, “xotira” |
| One calm breathing minute with Syno | `/breathe` |
| Open the website inside Telegram (Mini App) | 🧠 button, once `SITE_URL` is https |
| Share a fact in any chat | type `@your_bot sleep` in any chat (inline mode) |
| Change language | `/lang` |
| See what the bot keeps (nothing) | `/privacy` |

Accessibility in the bot: short messages, every button has an emoji **and**
words, the simple text comes first, quizzes have no time limit, and a word
the person doesn't know can be looked up by just typing it.

## Privacy (why it is built this way)

- **Nothing is stored.** No database, no logs, no user ids. Each message is
  answered and forgotten.
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

prints what the bot would answer, without a token. With the real token
(PowerShell):

```powershell
$env:BOT_TOKEN="123:ABC"; $env:SITE_URL="https://isapho.github.io/Medulla-site"; node telegram/poll.mjs --setup
$env:BOT_TOKEN="123:ABC"; $env:SITE_URL="https://isapho.github.io/Medulla-site"; node telegram/poll.mjs
```

`--setup` registers the command menu and descriptions in all three languages
and the Mini App menu button. The second command runs the bot until you press
Ctrl+C. While it runs this way, `/breathe` can also guide the minute live
(the message changes every 5 seconds).

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

The Worker reads `data/facts.json`, `data/glossary.json` and
`data/bot-strings.json` from `DATA_URL` in `wrangler.toml` (the public GitHub repository, so it works even while the website is offline; `SITE_URL` stays empty until the site is live, then the bot also shows website buttons), so every site update also
updates the bot. (`node tools/build.js` writes `bot-strings.json`.) The guided
live breathing minute is only available in long-polling mode; the Worker sends
the steps and a link to the animated version on the site.

**Long polling and the webhook can't run together.** `poll.mjs` removes the
webhook when it starts; run step 3 again afterwards to switch back.

## Tests

```bash
node --test telegram/assistant.test.mjs
```

17 tests with a fake Telegram: menus in three languages, the daily fact,
every quiz as a valid quiz poll, 64-byte button data, hard-word lookup,
groups, inline mode, the breathing minute, the Worker's secret check, and that
errors never contain the token. GitHub Actions runs them on every push.

## Files

| File | What it is |
|---|---|
| `assistant.mjs` | The bot itself: one `handleUpdate(update)` function, no packages |
| `poll.mjs` | Run with long polling; `--setup`, `--demo` |
| `worker.mjs`, `wrangler.toml` | The same bot as a Cloudflare Worker (webhook) |
| `assistant.test.mjs` | Tests |
| `bot.mjs` | The separate daily channel post (see `MINI_APP.md`) |
