# Optional backend (Supabase)

The site works fully **without** this. Without a backend, every visitor is a
guest and their progress stays in their own browser.

Switching the backend on adds three things:

| Feature | What is stored | Who can read it |
|---|---|---|
| **Sync code**: continue on another device | Progress numbers (XP, badges, saved fact ids, game scores) under the **SHA-256 hash** of a random code like `OCTA-7K3F-92QX-M4TZ` | Only someone who has the code |
| **Anonymous counters**: the live number in the impact bar | Four totals: `facts_read`, `games_played`, `breathing_sessions`, `daily_challenges`. Each browser adds at most +1 per counter per visit. | Everyone (they are public totals) |
| **Club totals**: one shared total for a school or club | The same four totals per club code (4 to 12 letters or digits) | Anyone who knows the club code |

The Medulla tables store no names, emails, IP addresses or device ids.
Supabase itself, like any host, keeps short-lived request logs; this is
mentioned on the Privacy page. Sync asks visitors
under 18 to confirm a parent or guardian agreed, as required by Art. 21 of the
Uzbekistan law "On Personal Data". Get this checked by a lawyer before you
switch sync on (see `HANDOFF.md`).

## Switch it on (about 10 minutes)

1. Create a free project at [supabase.com](https://supabase.com). Pick the
   region closest to your visitors, for example Frankfurt (eu-central-1).
2. In the dashboard, open **SQL Editor → New query**, paste all of
   [`schema.sql`](schema.sql) and press **Run**. It is safe to run again later.
3. Open **Project Settings → API Keys** and copy:
   - the **Project URL** (`https://xxxx.supabase.co`),
   - the **publishable key** (`sb_publishable_…`). A legacy **anon** key
     (`eyJ…`) also works.

   **Never** copy the *secret* or *service_role* key into the site.
4. Edit `js/config.js`:
   ```js
   backend: { provider: "supabase", url: "https://xxxx.supabase.co", anonKey: "sb_publishable_…" },
   anonymousCounters: true,   // only if you want the live counters
   ```
5. Run `node tools/build.js`, deploy, and open **My Medulla → Me → Sync**.

## Test without an account

Add `?backend=mock` to any page URL, for example
`http://localhost:8000/explore.html?backend=mock#/me`. The mock keeps a fake
server in your own browser's `localStorage` (`medulla.mockServer`), so you can
try sync, restore, clubs and counters. `?backend=none` switches back for that
tab.

To test the SQL itself in an in-memory Postgres:

```bash
cd backend
npm install --no-save @electric-sql/pglite
node schema.test.mjs
```

All lines should say `PASS`.

## How it is protected

- Row level security is on for all three tables and there are **no policies**,
  and all table privileges are revoked from `anon` and `authenticated`. The
  browser cannot select, insert, update or delete rows directly.
- The browser can only call six functions: `sync_save`, `sync_load`,
  `sync_delete`, `counter_bump`, `counters_get` and `club_totals`. Each one
  checks its input. Keys must be 64 hex characters, payloads must be JSON
  objects under 100 kB, counter names come from a fixed list, and club codes
  must be 4 to 12 letters or digits.
- A sync code has about 59 bits of randomness and only its hash is sent, so
  guessing someone else's row is not practical.
- **Not included:** rate limiting. Someone could call `counter_bump` in a loop
  to inflate the public totals. If that matters, put the counters behind a
  Supabase Edge Function with a rate limit, or keep `anonymousCounters: false`
  and show only counted numbers from `js/config.js`.
- Optional clean-up: the end of `schema.sql` shows how to delete sync rows
  nobody has used for a year.

## Switching to another provider

All network code lives in `js/backend.js`. Add an object with the same six
methods (`push`, `pull`, `remove`, `bump`, `counters`, `club`) next to `mock`
and `supabase`, and register it in `providers`. The rest of the site does not
change.
