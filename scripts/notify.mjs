/* Sends push notifications. KIND=daily → reminders for today's plans; weekly → "new this week"; test → a test to every device. */
import fs from "node:fs";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { JSDOM } from "jsdom";
process.on("unhandledRejection", e => console.error("page warning:", e && e.message));

const KIND = process.env.KIND || "daily";
const { SUPABASE_URL, SUPABASE_SECRET_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
if (!SUPABASE_SECRET_KEY || !VAPID_PRIVATE_KEY) { console.error("Missing SUPABASE_SECRET_KEY or VAPID_PRIVATE_KEY secret"); process.exit(1); }
webpush.setVapidDetails("mailto:noreply@out-and-about.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

/* run the app once to get the expanded event list exactly as the page shows it */
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.org/", beforeParse(w) { w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {}; } });
await new Promise(r => setTimeout(r, 1500));
const W = dom.window;
const ALL = W.eval("ALL_EVENTS");
const TRIPS = W.eval("TRIPS");
const TODAY = W.eval("TODAY");
const cityName = c => (c === "zh" ? "Zurich" : "Geneva");

const { data: subs, error: subErr } = await db.from("push_subscriptions").select("*");
if (subErr) throw subErr;
let sent = 0, dropped = 0;
async function send(sub, payload) {
  try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload)); sent++; }
  catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) { await db.from("push_subscriptions").delete().eq("id", sub.id); dropped++; }
    else console.error("push failed", e.statusCode, e.body);
  }
}

if (KIND === "test") {
  for (const s of subs) await send(s, { title: "Out & About", body: "Test: notifications work on this device.", tag: "test" });
}

if (KIND === "daily") {
  const { data: rows, error } = await db.from("state").select("user_id,data");
  if (error) throw error;
  for (const row of rows) {
    const mine = subs.filter(s => s.user_id === row.user_id && s.reminders);
    if (!mine.length) continue;
    const st = row.data || {}, going = new Set(st.going || []);
    const evs = ALL.filter(e => going.has(e.id) && e.day === TODAY);
    for (const e of evs) {
      const time = (e.when.split(" · ").slice(1).join(" · ") || e.when).trim();
      const start = (e.when.match(/(\d{1,2}):\d{2}/) || [])[1];
      const label = start && +start >= 17 ? "Tonight" : "Today";
      const place = (W.eval("MAPQ")[e.id] || e.place);
      const body = time + " · " + place + (e.price ? " · " + e.price : "");
      for (const s of mine) await send(s, { title: label + ": " + e.title, body, url: "./#ev-" + encodeURIComponent(e.id), tag: "ev-" + e.id });
    }
    for (const [tid, d] of Object.entries(st.trips || {})) {
      if (d !== TODAY) continue;
      const t = TRIPS.find(x => x.id === tid); if (!t) continue;
      const first = (t.day || [])[0];
      const body = (first ? first.t + " " + first.do : t.hook) + " · " + t.train.route;
      for (const s of mine) await send(s, { title: "Today: " + (t.kind === "weekend" ? "weekend in " : "day trip to ") + t.name, body, url: "./#trip-" + encodeURIComponent(tid), tag: "trip-" + tid });
    }
  }
}

if (KIND === "weekly") {
  const live = ALL.filter(e => ["wd1", "we1"].includes(e.p) && (e.dayEnd || e.day) >= TODAY);
  const n = c => live.filter(e => (e.city || "ge") === c).length;
  const picks = c => [...W.document.querySelectorAll('#picks .pick-block')].slice(0, 1).flatMap(b => [...b.querySelectorAll('.pick[data-city="' + c + '"] b')].map(x => x.textContent.trim())).slice(0, 2);
  const body = "Geneva: " + n("ge") + " things on · Zurich: " + n("zh") + ". Picks: " + [...picks("ge"), ...picks("zh")].join(" · ");
  for (const s of subs.filter(s => s.weekly)) await send(s, { title: "New this week", body, url: "./", tag: "weekly" });
}
console.log(KIND, "sent", sent, "removed", dropped, "subscriptions", subs.length);
process.exit(0);
