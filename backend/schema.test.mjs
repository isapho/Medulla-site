// Tests backend/schema.sql in an in-memory Postgres (PGlite). Not needed to run the site.
//   cd backend
//   npm install --no-save @electric-sql/pglite
//   node schema.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin;`);
await db.exec(sql);
await db.exec(sql); // re-runnable
const ok = (label, v) => console.log((v ? "PASS " : "FAIL ") + label);
const key = "a".repeat(64);

await db.exec(`set role anon`);
await db.query(`select sync_save($1, $2::jsonb)`, [key, JSON.stringify({ v: 1, xp: 30 })]);
let r = await db.query(`select sync_load($1) as p`, [key]);
ok("save/load", r.rows[0].p.xp === 30);
await db.query(`select sync_save($1, $2::jsonb)`, [key, JSON.stringify({ v: 1, xp: 55 })]);
r = await db.query(`select sync_load($1) as p`, [key]);
ok("overwrite", r.rows[0].p.xp === 55);
r = await db.query(`select sync_load($1) as p`, ["b".repeat(64)]);
ok("missing → null", r.rows[0].p === null);
await db.query(`select sync_delete($1)`, [key]);
r = await db.query(`select sync_load($1) as p`, [key]);
ok("delete", r.rows[0].p === null);

for (const bad of [["xyz", "{}"], [key, "[1]"], [key, JSON.stringify({ s: "x".repeat(100001) })]]) {
  let threw = false;
  try { await db.query(`select sync_save($1, $2::jsonb)`, bad); } catch (e) { threw = true; }
  ok("rejects bad save " + bad[0].slice(0, 4) + " " + bad[1].slice(0, 4), threw);
}

await db.query(`select counter_bump('facts_read', null)`);
await db.query(`select counter_bump('facts_read', 'SCHOOL7')`);
await db.query(`select counter_bump('games_played', 'SCHOOL7')`);
let threw = false;
try { await db.query(`select counter_bump('hacked', null)`); } catch (e) { threw = true; }
ok("unknown counter rejected", threw);
threw = false;
try { await db.query(`select counter_bump('facts_read', 'bad club!')`); } catch (e) { threw = true; }
ok("bad club rejected", threw);
r = await db.query(`select * from counters_get()`);
const m = Object.fromEntries(r.rows.map((x) => [x.name, Number(x.value)]));
ok("counters_get " + JSON.stringify(m), m.facts_read === 2 && m.games_played === 1 && m.breathing_sessions === 0);
r = await db.query(`select club_totals('SCHOOL7') as t`);
ok("club_totals " + JSON.stringify(r.rows[0].t), r.rows[0].t.facts_read === 1 && r.rows[0].t.games_played === 1);
r = await db.query(`select club_totals('NOPE') as t`);
ok("empty club → {}", JSON.stringify(r.rows[0].t) === "{}");

for (const q of [`select * from sync_rows`, `select * from counters`, `insert into counters values ('x', 1)`, `update counters set value = 999`]) {
  threw = false;
  try { await db.query(q); } catch (e) { threw = true; }
  ok("direct table access denied: " + q.slice(0, 30), threw);
}
await db.exec(`reset role`);
