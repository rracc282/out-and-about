/* Sends push notifications. KIND=daily → reminders for today's plans; weekly → "new this week"; test → a test to every device. */
import fs from "node:fs";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { JSDOM } from "jsdom";
const _ce = console.error; console.error = (...a) => _ce("::warning::" + a.map(x => x && x.message ? x.message : typeof x === "object" ? JSON.stringify(x) : String(x)).join(" ").slice(0, 900));
process.on("unhandledRejection", e => console.error("page warning:", e && e.message));
process.on("uncaughtException", e => { _ce("::error::" + (e && (e.stack || e.message))); process.exit(1); });

const KIND = process.env.KIND || "daily";
const { SUPABASE_URL, SUPABASE_SECRET_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
if (!SUPABASE_SECRET_KEY || !VAPID_PRIVATE_KEY) { console.error("Missing SUPABASE_SECRET_KEY or VAPID_PRIVATE_KEY secret"); process.exit(1); }
webpush.setVapidDetails("mailto:noreply@out-and-about.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

/* run the app once to get the expanded event list exactly as the page shows it */
let html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
try { const auto = fs.readFileSync(new URL("../auto.js", import.meta.url), "utf8"); html = html.replace('<script src="auto.js"></script>', () => "<script>" + auto + "</script>"); } catch {}
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

if (KIND === "message" && process.env.MESSAGE) {
  for (const s of subs) await send(s, { title: "Out & About", body: process.env.MESSAGE, tag: "msg-" + Date.now() });
}

if (KIND === "test") {
  for (const s of subs) await send(s, { title: "Out & About", body: "Test: notifications work on this device.", tag: "test" });
}

const H = new Date().getHours(), DOW = new Date().getDay();
const AUTOK = KIND === "auto";
if (KIND === "daily" || (AUTOK && H === 9)) {
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
    /* the morning after: ask how it was (one per day, the first unrated plan) */
    const y = new Date(TODAY + "T12:00:00"); y.setDate(y.getDate() - 1); const YDAY = y.toISOString().slice(0, 10);
    const hist = st.hist || {};
    const past = ALL.find(e => going.has(e.id) && (e.dayEnd || e.day) === YDAY && !(hist[e.id] && hist[e.id].r));
    if (past) for (const s of mine) await send(s, { title: "How was " + past.title + "?", body: "Tap to rate it — the app learns what you like.", url: "./#rate", rate: past.id, tag: "rate-" + past.id });
    for (const [tid, d] of Object.entries(st.trips || {})) {
      if (d !== TODAY) continue;
      const t = TRIPS.find(x => x.id === tid); if (!t) continue;
      const first = (t.day || [])[0];
      const body = (first ? first.t + " " + first.do : t.hook) + " · " + t.train.route;
      for (const s of mine) await send(s, { title: "Today: " + (t.kind === "weekend" ? "weekend in " : "day trip to ") + t.name, body, url: "./#trip-" + encodeURIComponent(tid), tag: "trip-" + tid });
    }
  }
}

if (KIND === "weekly" || (AUTOK && DOW === 1 && H === 12)) {
  const live = ALL.filter(e => ["wd1", "we1"].includes(e.p) && (e.dayEnd || e.day) >= TODAY);
  const n = c => live.filter(e => (e.city || "ge") === c).length;
  const picks = c => [...W.document.querySelectorAll('#picks .pick-block')].slice(0, 1).flatMap(b => [...b.querySelectorAll('.pick[data-city="' + c + '"] b')].map(x => x.textContent.trim())).slice(0, 2);
  const body = "Geneva: " + n("ge") + " things on · Zurich: " + n("zh") + ". Picks: " + [...picks("ge"), ...picks("zh")].join(" · ");
  for (const s of subs.filter(s => s.weekly)) await send(s, { title: "New this week", body, url: "./", tag: "weekly" });
}

/* one friendly message a day at a random hour (10:00–19:59): rain alert, new events, or a recommendation — per user */
const hash = t => [...t].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const nudgeHour = 10 + hash(TODAY) % 10;
if (KIND === "nudge" || (AUTOK && H === nudgeHour && !(DOW === 1 && H === 12))) {
  const { data: rows } = await db.from("state").select("user_id,data");
  const byUser = new Map((rows || []).map(r => [r.user_id, r.data || {}]));
  const CN = { ge: "Geneva", zh: "Zurich" };
  const addDays = (d, k) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
  const sat = (() => { const x = new Date(TODAY + "T12:00:00"); x.setDate(x.getDate() + ((6 - x.getDay() + 7) % 7)); return x.toISOString().slice(0, 10); })();
  const users = [...new Set(subs.filter(s => s.weekly).map(s => s.user_id))];
  for (const uid of users) {
    const st = byUser.get(uid) || {}, city = st.home || "ge", likes = st.likes || [];
    const skip = new Set([...(st.hidden || []), ...(st.going || []), ...Object.keys(st.deleted || {})]);
    const mine = ALL.filter(e => (e.city || "ge") === city && !skip.has(e.id) && (e.dayEnd || e.day) >= TODAY && e.p !== "later");
    let msg = null;
    // 1) Thu/Fri: rainy weekend at home
    const wx = d => { try { return W.wxOf(d, city); } catch { return null; } };
    const wet = [sat, addDays(sat, 1)].map(wx).filter(w => w && w[1] >= 60).length;
    if ((DOW === 4 || DOW === 5) && wet) msg = { title: "Rainy weekend ahead in " + CN[city] + " ☔", body: "Oh no, looks like rain " + (wet === 2 ? "all weekend" : "this weekend") + ". Fancy some rain-proof plans? Tap ☔ Rain-proof in the short list.", url: "./" };
    // 2) new events added in the last 2 days
    const fresh = mine.filter(e => e.seen && e.seen >= addDays(TODAY, -1) && e.p !== "on");
    if (!msg && fresh.length >= 3 && hash(TODAY + uid) % 2 === 0) {
      const sc = e => (e.cat || []).filter(c => likes.includes(c)).length;
      const top = fresh.sort((a, b) => sc(b) - sc(a)).slice(0, 2).map(e => e.titleEn || e.title);
      msg = { title: fresh.length + " new things on in " + CN[city], body: "Just added: " + top.join(" · ") + (fresh.length > 2 ? " and more." : ""), url: "./" };
    }
    // 3) a recommendation for the next 3 days
    if (!msg) {
      const soon = mine.filter(e => e.day >= TODAY && e.day <= addDays(TODAY, 3) && e.p !== "on" && e.p !== "big" && (e.zone === city || e.zone === "45"));
      const score = e => { let s = (e.cat || []).filter(c => likes.includes(c)).length * 3 + (e.free ? 1 : 0) + (e.zone === city ? 1 : 0); const w = wx(e.day); try { if (w && w[1] >= 60) s += W.isIndoor(e) ? 2 : -5; } catch {} return s + (hash(e.id + TODAY) % 100) / 100; };
      const e = soon.sort((a, b) => score(b) - score(a))[0];
      if (e) { const when = e.day === TODAY ? "Tonight" : e.day === addDays(TODAY, 1) ? "Tomorrow" : new Date(e.day + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" });
        const time = (e.when.match(/\d{1,2}:\d{2}/) || [""])[0];
        msg = { title: "Fancy this? " + when + (time ? " at " + time : ""), body: (e.titleEn || e.title) + " — " + ((e.desc || "").split(/(?<=[.!?])\s/)[0] || e.place).slice(0, 140), url: "./#ev-" + encodeURIComponent(e.id) }; }
    }
    if (msg) for (const s of subs.filter(s => s.user_id === uid && s.weekly)) await send(s, { ...msg, tag: "nudge-" + TODAY });
  }
}
if (KIND === "check") { /* privacy-safe status: only whether things are set, never the values */
  const { data: rows } = await db.from("state").select("user_id,data,updated_at");
  for (const r of rows || []) { const d = r.data || {}, a = d.addr || {};
    console.log("::notice::user " + String(r.user_id).slice(0, 6) + "… home=" + (d.home || "-") + " likes=" + (d.likes || []).length + " addrGeneva=" + (a.ge ? (a.ge.ll ? "saved+located" : "saved, NOT located") : "none") + " addrZurich=" + (a.zh ? (a.zh.ll ? "saved+located" : "saved, NOT located") : "none") + " going=" + (d.going || []).length + " subs=" + subs.filter(s => s.user_id === r.user_id).length); }
}
console.log(KIND, "sent", sent, "removed", dropped, "subscriptions", subs.length);
process.exit(0);
