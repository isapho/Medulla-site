/*
 * Who asked for the daily fact (opt-in, /daily). The only data the bot ever
 * keeps: a private chat's number, its language and the hour it chose.
 * /stop deletes it; so does a blocked bot (Telegram answers 403).
 *
 * Every store has the same three async methods the bot uses:
 *   get(chatId) → { h, l } | null      set(chatId, { h, l })      remove(chatId)
 *
 *   kvStore(KV)      Cloudflare Workers KV (telegram/worker.mjs)
 *   fileStore(path)  a JSON file (telegram/poll.mjs; Workers have no files)
 *   memoryStore()    tests
 * No Node-only imports here: the Worker loads this file too.
 */

export const DAILY_HOURS = [8, 13, 18]; // Tashkent time; 08:00 matches the channel post
export const SLOTS = 12;                 // the Worker runs every 5 minutes: 12 batches per hour

const pad = (n) => String(n).padStart(2, "0");
export const slotOf = (chatId) => Math.abs(Number(chatId)) % SLOTS;
export const validHour = (h) => DAILY_HOURS.includes(Number(h));

/* Workers KV. Two keys per chat:
 *   c:<chatId>              → {"h":8,"l":"uz"}      (lookup for /daily and /stop)
 *   d:<HH>:<SS>:<chatId>    → metadata {l}          (one list() call per batch)
 * Spreading chats over 12 five-minute slots keeps each cron run under the
 * free plan's 50 outgoing requests. */
export function kvStore(KV) {
  const dkey = (chatId, h) => "d:" + pad(h) + ":" + pad(slotOf(chatId)) + ":" + chatId;
  return {
    async get(chatId) {
      const v = await KV.get("c:" + chatId);
      try { return v ? JSON.parse(v) : null; } catch (e) { return null; }
    },
    async set(chatId, { h, l }) {
      const old = await this.get(chatId);
      if (old && old.h !== h) await KV.delete(dkey(chatId, old.h));
      await KV.put("c:" + chatId, JSON.stringify({ h, l }));
      await KV.put(dkey(chatId, h), "", { metadata: { l } });
    },
    async remove(chatId) {
      const old = await this.get(chatId);
      if (old) await KV.delete(dkey(chatId, old.h));
      await KV.delete("c:" + chatId);
    },
    // The chats to send to in one batch: hour h, slot s.
    async due(h, s, limit) {
      const res = await KV.list({ prefix: "d:" + pad(h) + ":" + pad(s) + ":", limit });
      return { list: res.keys.map((k) => ({ chatId: k.name.split(":")[3], lang: (k.metadata && k.metadata.l) || "uz" })), more: !res.list_complete };
    }
  };
}

/* In memory, or over a JSON object that poll.mjs saves to a file:
 * { "<chatId>": { h, l, last: "2027-03-15" } }. `last` is the day the fact was
 * sent, so a laptop that was off at 08:00 catches up when it starts. */
export function storeOver(data, save = () => {}) {
  return {
    data,
    async get(chatId) { const v = data[chatId]; return v ? { h: v.h, l: v.l } : null; },
    async set(chatId, { h, l, last }) { data[chatId] = { h, l, last: last || (data[chatId] && data[chatId].last) || null }; save(); },
    async remove(chatId) { delete data[chatId]; save(); },
    // Everyone whose hour has come today and who hasn't had today's fact yet.
    async dueToday(hour, day) {
      return Object.keys(data).filter((id) => data[id].h <= hour && data[id].last !== day).map((id) => ({ chatId: id, lang: data[id].l }));
    },
    async markSent(chatId, day) { if (data[chatId]) { data[chatId].last = day; save(); } }
  };
}

export const memoryStore = (initial = {}) => storeOver(initial);

/* Tashkent clock for the schedulers: hour, minute and the calendar day. */
export function clock(date = new Date(), timeZone = "Asia/Tashkent") {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  return { hour: Number(p.hour), minute: Number(p.minute), day: p.year + "-" + p.month + "-" + p.day };
}
