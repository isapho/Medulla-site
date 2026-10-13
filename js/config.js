/*
 * Medulla site configuration: EVERY placeholder value lives in this file.
 *
 * Rules:
 *  - `null` means "not known yet". The site then shows a dashed "TBD"
 *    placeholder instead of the value. Never put guesses or fake data here.
 *  - Text that differs per language can be a plain string or an object such
 *    as { uz: "...", ru: "...", en: "..." }.
 *  - Image paths are relative to the site root, e.g. "assets/team/aziz.jpg".
 *
 * See HANDOFF.md for the order to fill these in.
 */
window.MEDULLA_CONFIG = {
  // Public site address without a trailing slash, e.g. "https://medulla.uz".
  // Used for share links, Open Graph tags and sitemap.xml (run node tools/build.js after setting it).
  domain: "https://isapho.github.io/Medulla-site",

  // Contact email, e.g. "hello@medulla.uz". Builds every mailto: link.
  contactEmail: null,

  // Social handles, without "@".
  instagramHandle: "medulla.mind",
  telegramHandle: "medullamind",    // the public channel → https://t.me/medullamind
  telegramContact: "medulla_mind",  // the account people write to → https://t.me/medulla_mind
  // Username of the Medulla Telegram bot, without "@" (created with @BotFather,
  // see telegram/BOT.md). null = the site shows "coming soon" instead of a button.
  telegramBot: "medulla_mind_bot",

  // true = show the dashed "TBD" stand-ins for every missing value (team
  // previews). false = visitors only see what is real; empty parts are hidden.
  showPlaceholders: false,

  // Optional backend for sync, anonymous counters and club totals.
  // The site works fully WITHOUT it (guest mode, progress on the device).
  // To switch on: create a Supabase project, run backend/schema.sql, then set
  //   provider: "supabase", url: "https://xxxx.supabase.co", anonKey: "sb_publishable_..."
  // (the publishable key, or a legacy anon key "eyJ...", is designed to be public;
  // the database only allows the functions in backend/schema.sql). Never put the
  // secret / service_role key here. Test without keys: add ?backend=mock.
  // Step by step: backend/README.md.
  //
  // "worker" (2.7) = the Cloudflare Worker from telegram/ keeps the sync copies and
  // verifies Sign in with Telegram / Google. url = the Worker's address. Needs no
  // Supabase and no key in this file. See telegram/BOT.md "Sign in on the website".
  backend: { provider: "worker", url: "https://medulla-bot.medulla-mind.workers.dev", anonKey: null },

  // Sign in with Google needs a Google "OAuth client ID" (public, ends in
  // .apps.googleusercontent.com); put the same value in telegram/wrangler.toml
  // (GOOGLE_CLIENT_ID). null = no Google button. Telegram sign-in needs nothing
  // here: it uses `telegramBot` above and @BotFather /setdomain.
  googleClientId: null,

  // Anonymous +1 counters for the impact bar (no ids, no personal data).
  // Only used when the backend is switched on.
  anonymousCounters: false,

  // Team: names and Telegram roles as given by the team (October 2026).
  // slot is founder / cofounder / member. Bios and photos stay null (shown as
  // "TBD") until each person has written one and agreed to a photo.
  team: [
    { slot: "founder", name: "Sevara",              role: null,   bio: null, photo: null },
    { slot: "member",  name: "Madina",              role: { uz: "CEO", ru: "CEO", en: "CEO" }, bio: null, photo: null },
    { slot: "member",  name: "Dilrabo",             role: { uz: "CEO", ru: "CEO", en: "CEO" }, bio: null, photo: null },
    { slot: "member",  name: "Nazarbek",            role: { uz: "Koordinator", ru: "Координатор", en: "Coordinator" }, bio: null, photo: null },
    { slot: "member",  name: "Fayruza",             role: { uz: "Koordinator", ru: "Координатор", en: "Coordinator" }, bio: null, photo: null },
    { slot: "member",  name: "Munavvar Abdullayeva", role: { uz: "Koordinator", ru: "Координатор", en: "Coordinator" }, bio: null, photo: null },
    { slot: "member",  name: "Sevara M",            role: { uz: "Kopirayter", ru: "Копирайтер", en: "Copywriter" }, bio: null, photo: null },
    { slot: "member",  name: "Dono",                role: { uz: "Kopirayter", ru: "Копирайтер", en: "Copywriter" }, bio: null, photo: null }
  ],

  // Advisors (for example doctors or researchers who review content).
  // Empty list = "Advisors: coming soon". Add only people who have agreed.
  // Example entry: { name: "Dr. First Last", field: { uz: "...", ru: "...", en: "Paediatric neurology" } }
  advisors: [],

  // Partners. Each entry is one grid slot; empty entries show "Partner logo here".
  partners: [
    { name: null, logo: null, url: null },
    { name: null, logo: null, url: null },
    { name: null, logo: null, url: null },
    { name: null, logo: null, url: null }
  ],

  // Impact counters. `value: null` shows a dash until a real, counted number exists.
  // `live` = filled automatically from the anonymous backend counter of that name.
  // Labels come from js/lang/*.js (keys "impact.<key>").
  impact: [
    { key: "followers",   value: 150,  suffix: "+", icon: "social" }, // real (2026), Instagram + Telegram
    { key: "visits",      value: null, suffix: "",  icon: "heart" },
    { key: "factsShared", value: null, suffix: "",  icon: "book" },
    { key: "volunteers",  value: null, suffix: "",  icon: "users" },
    { key: "experiments", value: null, suffix: "",  icon: "target", live: "games_played" }
  ]
};
