/* Nightly, free: collects events for Geneva and Zurich, works out this week / next week, adds the weather,
   merges the weekly curation (data/curated.json) and writes auto.js (read by the app) + data/auto.json + data/report.json. */
import fs from "node:fs";
const root = new URL("../", import.meta.url);
const rd = p => fs.readFileSync(new URL(p, root), "utf8");
const cfg = JSON.parse(rd("scripts/sources.json"));
const html = rd("index.html");
const report = { sources: [], kept: 0, dropped: {} };
const drop = why => { report.dropped[why] = (report.dropped[why] || 0) + 1; };

/* ---------- dates (Europe/Zurich) ---------- */
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
function local(d) { const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value])); return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` }; }
const TODAY = local(new Date()).day;
const addD = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dow = d => new Date(d + "T12:00:00Z").getUTCDay();
const DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const nice = d => `${DN[dow(d)]} ${+d.slice(8)} ${MN[+d.slice(5, 7) - 1]}`;
const MON = addD(TODAY, -((dow(TODAY) + 6) % 7));
const range = (a, b) => a.slice(5, 7) === b.slice(5, 7) ? `${DN[dow(a)]} ${+a.slice(8)} – ${nice(b)}` : `${nice(a)} – ${nice(b)}`;
const periods = [
  { id: "wd1", kind: "weekday", title: "This week", from: MON, to: addD(MON, 4) },
  { id: "we1", kind: "weekend", title: "This weekend", from: addD(MON, 5), to: addD(MON, 6) },
  { id: "wd2", kind: "weekday", title: "Next week", from: addD(MON, 7), to: addD(MON, 11) },
  { id: "we2", kind: "weekend", title: "Next weekend", from: addD(MON, 12), to: addD(MON, 13) },
].map(p => ({ ...p, range: range(p.from, p.to), note: "" }));
const LAST = periods[3].to, BIG_UNTIL = addD(TODAY, 150);
const periodOf = d => { const wk = dow(d) > 0 && dow(d) < 6; const p = periods.find(q => d >= q.from && d <= q.to && (q.kind === "weekday") === wk); return p ? p.id : null; };

/* ---------- places ---------- */
const CITY = { ge: [46.2044, 6.1432], zh: [47.3769, 8.5417] };
const km = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dl = r(b[0] - a[0]), dn = r(b[1] - a[1]); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const LOCAL = { ge: /\b(gen[eè]v[ae]|geneva|genf|carouge|lancy|vernier|meyrin|plan-les-ouates|ch[eê]ne|th[oô]nex|onex|cologny|plainpalais|eaux-vives|p[aâ]quis|servette|champel|versoix|bernex|veyrier)\b/i,
  zh: /\b(z[uü]rich|zurich|oerlikon|altstetten|wiedikon|seebach|wollishofen|schwamendingen|affoltern|h[oö]ngg|enge|wipkingen|aussersihl|hottingen|dübendorf|wallisellen|schlieren|kilchberg|zollikon|adliswil)\b/i };
function placeOf(geo, text, srcCity) {
  if (geo) {
    const d = { ge: km(geo, CITY.ge), zh: km(geo, CITY.zh) }; const city = d.ge < d.zh ? "ge" : "zh"; const k = d[city];
    if (k > 110) return null;
    return { city, zone: k <= 9 ? city : k <= 50 ? "45" : "90", trip: k <= 9 ? (city === "ge" ? "Geneva" : "Zurich") : `≈ ${Math.round(k)} km away` };
  }
  for (const c of ["ge", "zh"]) if (LOCAL[c].test(text || "")) return { city: c, zone: c, trip: c === "ge" ? "Geneva" : "Zurich" };
  if (srcCity && !text) return { city: srcCity, zone: srcCity, trip: srcCity === "ge" ? "Geneva" : "Zurich" };
  return null;
}

/* ---------- categories ---------- */
const CATS = [
  ["rencontre", /meet ?up|social|language exchange|tandem|expat|networking|ap[eé]ro|afterwork|after-work|rencontre|stammtisch|board ?game|jeux de soci|spieleabend|quiz|speed friend|circle|newcomer|internations|mixer|meet new|make friends|conversation|philosoph|book club|lesekreis|club de lecture|walk ?& ?talk|les amis/i],
  ["creatif", /workshop|atelier|drawing|dessin|zeichn|painting|peinture|malen|ceramic|c[eé]ramique|pottery|poterie|t[oö]pfer|craft|bastel|sketch|knit|tricot|strick|printmaking|gravure|linocut|collage|watercolou?r|aquarelle|calligraph|embroider|broderie|sticken|life drawing|croquis|creative writing|[eé]criture/i],
  ["culture", /concert|konzert|jazz|comedy|stand-?up|humou?r|th[eé][aâ]tre|theater|theatre|film|cin[eé]ma|kino|opera|op[eé]ra|oper\b|exhibition|exposition|ausstellung|vernissage|museum|mus[eé]e|lecture|conf[eé]rence|vortrag|lesung|reading|poetry|po[eé]sie|slam|ballet|recital|r[eé]cital|orchestr|choir|chorale|chor\b|live music|musique live|improv|cabaret|kabarett/i],
  ["fete", /festival|f[eê]te\b|fest\b|party|soir[eé]e|\bball\b|\bbal\b|carnival|carnaval|chilbi|kilbi|dance night|clubbing|disco|halloween|oktoberfest|street food|food festival|wine|vin\b|wein/i],
  ["marche", /market|march[eé]|markt|brocante|flea|vide-grenier|flohmarkt|brocki|bazaar|bazar|braderie|vintage sale|troc/i],
  ["corps", /yoga|\brun\b|running|hike|hiking|randonn|wander|salsa|bachata|kizomba|tango|swing|dance class|cours de danse|tanzkurs|climb|grimp|kletter|swim|pilates|meditation|m[eé]ditation|bike|v[eé]lo|velo|sauna|walk\b|balade|spaziergang/i],
  ["chien", /\bdog|chien|hund/i],
];
const BAD = /webinar|online only|virtual|zoom|livestream|kids?\b|children|enfants?\b|kinder|family day|familien|baby|b[eé]b[eé]|crypto|forex|trading|investor|invest |mlm|real estate|immobilier|sales training|job fair|career fair|recruit|bootcamp|certification|hackathon|church service|messe\b|gottesdienst|culte\b|speed dating|singles? (party|night)/i;
const catsOf = (t, d, srcKind) => { const s = t + " " + (d || "").slice(0, 300); const c = CATS.filter(([, re]) => re.test(s)).map(([k]) => k); if (!c.length) c.push(srcKind === "meetup" ? "rencontre" : "culture"); return c.slice(0, 3); };

/* ---------- parsing ---------- */
const clean = s => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const short = (s, n = 230) => { s = clean(s); if (s.length <= n) return s; const cut = s.slice(0, n); const i = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! ")); return (i > 80 ? cut.slice(0, i + 1) : cut.replace(/\s\S*$/, "") + "…"); };
function walk(o, f, seen = new Set()) { if (!o || typeof o !== "object" || seen.has(o)) return; seen.add(o); f(o); for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v, f, seen); }
function blobs(page) {
  const out = [];
  for (const m of page.matchAll(/<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { out.push(JSON.parse(m[1].trim())); } catch {} }
  const nd = page.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i); if (nd) { try { out.push(JSON.parse(nd[1])); } catch {} }
  return out;
}
const isEvType = t => [].concat(t || []).some(x => /Event$/.test(String(x)));
function fromLd(o) {
  if (!isEvType(o["@type"]) || !o.startDate || !o.name) return null;
  if (/Online/i.test(String(o.eventAttendanceMode || "")) && !/Mixed/i.test(String(o.eventAttendanceMode))) return null;
  const loc = [].concat(o.location || [])[0] || {}; const a = loc.address || {};
  const addr = typeof a === "string" ? a : [a.streetAddress, a.addressLocality].filter(Boolean).join(", ");
  const g = loc.geo || {}; const geo = g.latitude ? [+g.latitude, +g.longitude] : null;
  const off = [].concat(o.offers || [])[0] || {}; const pr = off.price ?? off.lowPrice;
  return { title: o.name, start: o.startDate, end: o.endDate, url: o.url || (off && off.url), place: [loc.name, addr].filter(Boolean).join(", "), geo, price: pr, cur: off.priceCurrency, isFree: o.isAccessibleForFree, desc: o.description, type: [].concat(o["@type"]).join(), organizer: ([].concat(o.organizer || [])[0] || {}).name };
}
function fromApp(o) { /* Meetup-style app data */
  if (!o.title || !o.dateTime || !(o.eventUrl || o.link)) return null;
  const v = o.venue || {}; const geo = v.lat ? [+v.lat, +(v.lng ?? v.lon)] : null;
  if (/online/i.test(v.name || "") || o.eventType === "ONLINE") return null;
  return { title: o.title, start: o.dateTime, end: o.endTime, url: o.eventUrl || o.link, place: [v.name, v.address, v.city].filter(Boolean).join(", "), geo, price: o.feeSettings ? o.feeSettings.amount : 0, cur: o.feeSettings && o.feeSettings.currency, desc: o.description, organizer: o.group && o.group.name };
}
function fromIcs(txt) {
  const out = []; txt = txt.replace(/\r?\n[ \t]/g, "");
  for (const b of txt.split("BEGIN:VEVENT").slice(1)) {
    const g = k => { const m = b.match(new RegExp("^" + k + "(?:;[^:\\n]*)?:(.*)$", "m")); return m ? m[1].replace(/\\,/g, ",").replace(/\\n/g, " ").trim() : ""; };
    const iso = v => v ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` + (v.length > 8 ? `T${v.slice(9, 11)}:${v.slice(11, 13)}:00${v.endsWith("Z") ? "Z" : ""}` : "") : "";
    const geo = g("GEO").split(";").map(Number);
    out.push({ title: g("SUMMARY"), start: iso(g("DTSTART")), end: iso(g("DTEND")), url: g("URL"), place: g("LOCATION"), geo: geo.length === 2 && geo[0] ? geo : null, desc: g("DESCRIPTION") });
  }
  return out;
}
function when(s) { if (!s) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { day: s, time: null }; if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) && !/\+0[12]:?00$/.test(s)) return local(new Date(s)); return { day: s.slice(0, 10), time: s.slice(11, 16) || null }; }

/* ---------- fetch ---------- */
const UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36", "accept-language": "en,fr;q=0.8,de;q=0.7" };
async function get(url) { const c = new AbortController(); const t = setTimeout(() => c.abort(), 20000); try { const r = await fetch(url, { headers: UA, signal: c.signal, redirect: "follow" }); return { status: r.status, body: r.ok ? await r.text() : "" }; } catch (e) { return { status: String(e.name || e) , body: "" }; } finally { clearTimeout(t); } }

const raw = [];
async function harvest(src) {
  const r = await get(src.url); let items = [];
  if (r.body) {
    if (src.kind === "ics" || /^BEGIN:VCALENDAR/.test(r.body)) items = fromIcs(r.body);
    else for (const b of blobs(r.body)) walk(b, o => { const x = fromLd(o) || fromApp(o); if (x) items.push(x); });
  }
  report.sources.push({ url: src.url, status: r.status, bytes: r.body.length, found: items.length });
  items.forEach(x => raw.push({ ...x, src: src }));
}
const groups = new Set([...html.matchAll(/meetup\.com\/([A-Za-z0-9_-]+)\/events/g)].map(m => m[1]).concat(cfg.meetupExtra || []));
const jobs = [...[...groups].map(g => ({ url: `https://www.meetup.com/${g}/events/`, kind: "meetup" })), ...cfg.pages];
for (let i = 0; i < jobs.length; i += 6) await Promise.all(jobs.slice(i, i + 6).map(harvest));

/* ---------- normalise ---------- */
const norm = t => clean(t).toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "").slice(0, 28);
const existing = new Set([...html.matchAll(/"day": ?"(\d{4}-\d{2}-\d{2})"[^{}]*?"title": ?"([^"]+)"/g)].map(m => m[1] + "|" + norm(m[2])));
const existingUrl = new Set([...html.matchAll(/"url": ?"([^"]+)"/g)].map(m => m[1].replace(/[?#].*$/, "")));
const slug = s => clean(s).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const SRCNAME = { "meetup.com": "Meetup", "eventbrite.ch": "Eventbrite", "eventbrite.com": "Eventbrite", "eventfrog.ch": "Eventfrog", "songkick.com": "Songkick" };
const out = new Map();
for (const x of raw) {
  const s = when(x.start); if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.day)) { drop("no date"); continue; }
  const e = when(x.end); const title = clean(x.title).slice(0, 110);
  if (!title || BAD.test(title + " " + (x.organizer || ""))) { drop("not relevant"); continue; }
  const multi = e && e.day > s.day;
  const lastDay = multi ? e.day : s.day;
  if (lastDay < TODAY) { drop("past"); continue; }
  const exhibit = /Exhibition/i.test(x.type || "") || (multi && (Date.parse(e.day) - Date.parse(s.day)) / 864e5 >= 6);
  const pl = placeOf(x.geo, x.place, x.src.city); if (!pl) { drop("too far / unknown place"); continue; }
  let p, day = s.day < TODAY && multi ? TODAY : s.day;
  if (exhibit) { p = "on"; }
  else if (day <= LAST) { p = periodOf(day); if (!p) { drop("outside weeks"); continue; } }
  else if (x.src.big && day <= BIG_UNTIL) p = "big";
  else { drop("later than 2 weeks"); continue; }
  const url = (x.url || x.src.url).replace(/[?#].*$/, "");
  const key = day + "|" + norm(title);
  if (existing.has(key) || existingUrl.has(url)) { drop("already in app"); continue; }
  if (out.has(key)) { drop("duplicate"); continue; }
  const free = x.isFree === true || x.price === 0 || x.price === "0" || /\b(free|gratuit|gratis|kostenlos)\b/i.test(title);
  const price = free ? "Free" : x.price ? `${x.cur || "CHF"} ${Math.round(+x.price) || x.price}` : "Price to check";
  const cat = catsOf(title, x.desc, x.src.kind);
  const tE = e && e.time && !multi ? "–" + e.time : "";
  const whenTxt = p === "on" ? `Until ${nice(lastDay)}` : p === "big" ? `${nice(day)}${s.time ? " · " + s.time : ""}` : `${DN[dow(day)]} ${+day.slice(8)}${s.time && s.time !== "00:00" ? " · " + s.time + tE : ""}`;
  const ev = { id: `a-${pl.city}-${slug(title)}-${day.slice(5)}`, p, day, when: whenTxt, title, url, place: clean(x.place).slice(0, 120) || (pl.city === "ge" ? "Geneva" : "Zurich"), trip: pl.trip, price, cat, zone: pl.zone, city: pl.city, desc: short(x.desc) || "", auto: 1, src: SRCNAME[host(url)] || host(url) };
  if (multi) ev.dayEnd = e.day; if (free) ev.free = true; if (cat.includes("chien")) ev.dog = true;
  if (x.src.kind === "meetup" && x.organizer) ev.grp = clean(x.organizer);
  out.set(key, ev);
}
let events = [...out.values()];
/* keep the list readable: at most 30 per city per day (Meetup and free first) */
const per = {}; events.sort((a, b) => (b.src === "Meetup") - (a.src === "Meetup") || (!!b.free - !!a.free));
events = events.filter(e => { const k = e.city + e.day + e.p; per[k] = (per[k] || 0) + 1; return e.p === "on" || e.p === "big" || per[k] <= 30; });
report.kept = events.length;

/* ---------- weather (Open-Meteo, free) ---------- */
const wx = { ge: {}, zh: {} };
for (const c of ["ge", "zh"]) {
  const r = await get(`https://api.open-meteo.com/v1/forecast?latitude=${CITY[c][0]}&longitude=${CITY[c][1]}&daily=temperature_2m_max,precipitation_probability_max&timezone=Europe%2FZurich&forecast_days=14`);
  try { const j = JSON.parse(r.body).daily; j.time.forEach((d, i) => { wx[c][d] = [Math.round(j.temperature_2m_max[i]), j.precipitation_probability_max[i] ?? 0]; }); } catch { report.weather = "failed " + r.status; }
}
const wetNote = (c, p) => { const wet = []; for (let d = p.from; d <= p.to; d = addD(d, 1)) if ((wx[c][d] || [])[1] >= 50) wet.push(DN[dow(d)]); return wet.length ? `Rain likely ${wet.length > 2 ? "most days" : wet.join(" and ")}.` : ""; };

/* ---------- weekly curation (written by the short Claude run) ---------- */
let cur = {}; try { cur = JSON.parse(rd("data/curated.json")); } catch {}
const fresh = cur.week === MON;
const notes = { ge: {}, zh: {} };
for (const p of periods) for (const c of ["ge", "zh"]) notes[c][p.id] = (fresh && cur.notes && cur.notes[c] && cur.notes[c][p.id]) || wetNote(c, p);
periods.forEach(p => { p.note = notes.ge[p.id]; });
const add = (cur.add || []).filter(e => (e.dayEnd || e.day) >= TODAY).map(e => ({ ...e, p: e.p === "big" || e.p === "on" ? e.p : periodOf(e.day) || "later" }));

const AUTO = { generated: new Date().toISOString(), week: MON, periods, notesZh: notes.zh, wx, events: events.concat(add), edits: cur.edits || {}, drop: cur.drop || [], picks: fresh ? cur.picks || [] : [] };
fs.mkdirSync(new URL("data/", root), { recursive: true });
fs.writeFileSync(new URL("auto.js", root), "window.AUTO=" + JSON.stringify(AUTO) + ";\n");
fs.writeFileSync(new URL("data/auto.json", root), JSON.stringify({ week: MON, periods, events: AUTO.events.map(({ id, p, day, when, title, place, price, cat, city, zone, src, desc, url }) => ({ id, p, day, when, title, place, price, cat, city, zone, src, desc: desc.slice(0, 160), url })) }, null, 0).replace(/\},\{/g, "},\n{"));
report.byCity = { ge: events.filter(e => e.city === "ge").length, zh: events.filter(e => e.city === "zh").length };
report.sources.sort((a, b) => b.found - a.found);
fs.writeFileSync(new URL("data/report.json", root), JSON.stringify(report, null, 1));
console.log(`kept ${events.length} (ge ${report.byCity.ge}, zh ${report.byCity.zh})`, JSON.stringify(report.dropped));
