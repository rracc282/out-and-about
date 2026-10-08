/* Nightly, free: collects events for Geneva and Zurich, works out this week / next week, adds the weather,
   merges the weekly curation (data/curated.json) and writes auto.js (read by the app) + data/auto.json + data/report.json. */
import fs from "node:fs";
const root = new URL("../", import.meta.url);
const rd = p => fs.readFileSync(new URL(p, root), "utf8");
const cfg = JSON.parse(rd("scripts/sources.json"));
const html = rd("index.html");
const report = { sources: [], kept: 0, dropped: {} };
const samples = {};
const drop = (why, x) => { report.dropped[why] = (report.dropped[why] || 0) + 1; if (x) { const a = samples[why] = samples[why] || []; if (a.length < 6) a.push([x.title, x.start, x.place, x.geo, x.src && x.src.url].map(v => String(v ?? "").slice(0, 70))); } };

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
  { id: "wd1", kind: "weekday", title: "This week", from: MON, to: addD(MON, 3) },
  { id: "we1", kind: "weekend", title: "This weekend", from: addD(MON, 4), to: addD(MON, 6) },
  { id: "wd2", kind: "weekday", title: "Next week", from: addD(MON, 7), to: addD(MON, 10) },
  { id: "we2", kind: "weekend", title: "Next weekend", from: addD(MON, 11), to: addD(MON, 13) },
].map(p => ({ ...p, range: range(p.from, p.to), note: "" }));
const LAST = periods[3].to, BIG_UNTIL = addD(TODAY, 150);
const periodOf = d => { const p = periods.find(q => d >= q.from && d <= q.to); return p ? p.id : null; }; /* weekends run Fri–Sun */

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
  for (const [re, city, zone, trip] of NEAR) if (re.test(text || "")) return { city, zone, trip };
  if (srcCity && !text) return { city: srcCity, zone: srcCity, trip: srcCity === "ge" ? "Geneva" : "Zurich" };
  return null;
}

const NEAR = [
  [/\b(nyon|ferney|divonne|gex|saint-julien|st-julien|annemasse|coppet|rolle|gland|thoiry|saint-genis)\b/i, "ge", "45", "≈ 30 min from Geneva"],
  [/\b(lausanne|morges|annecy|thonon|[eé]vian|vevey|montreux|pully|renens)\b/i, "ge", "45", "≈ 45 min from Geneva"],
  [/\b(fribourg|neuch[aâ]tel|gruy[eè]res|bulle|yverdon|chamonix|sion)\b/i, "ge", "90", "≈ 1h30 from Geneva"],
  [/\b(winterthur|baden|zug|uster|w[aä]denswil|rapperswil|thalwil|horgen|k[uü]snacht|meilen|kloten|dietikon|bülach|wetzikon)\b/i, "zh", "45", "≈ 30 min from Zurich"],
  [/\b(luzern|lucerne|aarau|schaffhausen|st\.? ?gallen|frauenfeld|einsiedeln|konstanz|basel|olten)\b/i, "zh", "90", "≈ 1h from Zurich"],
];
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
const NICHE = /pok[eé]mon|yu-?gi-?oh|magic:? the gathering|\bmtg\b|commander (event|night|league|game)|trading card|\btcg\b|\bccg\b|card game|kartenspiel|jeux? de cartes|flesh and blood|lorcana|one piece card|digimon|star wars unlimited|warhammer|kill team|age of sigmar|\b40k\b|wargam|miniature painting|tabletop wargame|\blarp\b|cosplay|anime|manga|furry|vtuber|e-?sports|lan party/i;
const BAD = /webinar|online only|virtual|zoom|livestream|kids?\b|children|enfants?\b|kinder|family day|familien|baby|b[eé]b[eé]|crypto|forex|trading|investor|invest |mlm|real estate|immobilier|sales training|job fair|career fair|recruit|bootcamp|certification|hackathon|church service|messe\b|gottesdienst|culte\b|speed dating|singles? (party|night)|jeune public|d[eè]s \d+ ans|ab \d+ jahren|f[uü]r kinder|marionnette|puppentheater|conte pour|contes pour|bébés lecteurs|seniors?\b|retrait[eé]s|employer une/i;
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
function microdata(page) {
  const out = [];
  for (const m of page.matchAll(/itemtype=["']https?:\/\/schema\.org\/(\w*Event)["']([\s\S]{0,6000}?)(?=itemtype=["']https?:\/\/schema\.org\/\w*Event["']|$)/g)) {
    const b = m[2]; const prop = k => { const r = b.match(new RegExp(`itemprop=["']${k}["'][^>]*?(?:content|datetime|href)=["']([^"']+)`)) || b.match(new RegExp(`itemprop=["']${k}["'][^>]*>([^<]{2,200})<`)); return r ? clean(r[1]) : ""; };
    const name = prop("name"), start = prop("startDate"); if (name && start) out.push({ title: name, start, end: prop("endDate"), url: prop("url"), place: [prop("name\"[^>]*itemprop=\"location") , prop("streetAddress"), prop("addressLocality")].filter(Boolean).join(", "), desc: prop("description"), type: m[1] });
  }
  return out;
}
function fromTribe(j) { return (j.events || []).map(e => ({ title: clean(e.title), start: e.start_date.replace(" ", "T"), end: (e.end_date || "").replace(" ", "T"), url: e.url, place: e.venue ? [e.venue.venue, e.venue.address, e.venue.city].filter(Boolean).join(", ") : "", geo: e.venue && e.venue.geo_lat ? [+e.venue.geo_lat, +e.venue.geo_lng] : null, price: /free|gratuit/i.test(e.cost || "") ? 0 : (String(e.cost || "").match(/\d+/) || [])[0], desc: e.description })); }
let REFS = {};
const deref = v => (v && v.__ref ? REFS[v.__ref] || {} : v || {});
function fromApp(o) { /* Meetup-style app data */
  if (!o.title || !o.dateTime || !(o.eventUrl || o.link)) return null;
  const v = deref(o.venue); const la = v.lat ?? v.latitude, lo = v.lng ?? v.lon ?? v.longitude; const geo = la ? [+la, +lo] : null;
  if (/online/i.test(v.name || "") || o.eventType === "ONLINE") return null;
  const fs_ = deref(o.feeSettings); const grp = deref(o.group);
  return { title: o.title, start: o.dateTime, end: o.endTime, url: o.eventUrl || o.link, place: [v.name, v.address, v.city].filter(Boolean).join(", "), geo, price: fs_.amount || 0, cur: fs_.currency, desc: o.description, organizer: grp.name };
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
    else for (const b of blobs(r.body)) { REFS = {}; walk(b, o => { for (const [k, v] of Object.entries(o)) if (/^[A-Z]\w+:[\w-]+$/.test(k) && v && typeof v === "object") REFS[k] = v; if (o.__typename && o.id) REFS[o.__typename + ":" + o.id] = REFS[o.__typename + ":" + o.id] || o; });
      const got = []; walk(b, o => { const x = fromApp(o) || fromLd(o); if (x) got.push(x); });
      /* JSON-LD and app data often describe the same event: keep the richer one */
      const byKey = new Map(); for (const x of got) { const k = String(x.start).slice(0, 16) + clean(x.title).slice(0, 30); const old = byKey.get(k); if (!old || (!old.geo && x.geo) || (!old.place && x.place)) byKey.set(k, x); }
      items.push(...byKey.values()); }
  }
  if (r.body && src.kind !== "meetup" && items.length < 3) {
    items.push(...microdata(r.body));
    if (/tribe-events|wp-json/.test(r.body)) { const t = await get(new URL("/wp-json/tribe/events/v1/events?per_page=50&start_date=" + TODAY, src.url).href); try { items.push(...fromTribe(JSON.parse(t.body))); } catch {} }
  }
  let followed = 0;
  if (r.body && src.kind !== "meetup" && items.length < 3) { /* open the individual event pages */
    const base = new URL(src.url); const seen = new Set();
    for (const m of r.body.matchAll(/href=["']([^"'#]+)["']/g)) { let u; try { u = new URL(m[1].replace(/&amp;/g, "&"), base); } catch { continue; }
      if (u.hostname !== base.hostname || u.href === base.href || seen.has(u.href)) continue;
      if (!/(event|evenement|[eé]v[eé]nement|veranstaltung|agenda|manifestation|spectacle|konzert|concert|show|ausstellung|exposition|exhibition|termin|programm|spielplan|kalender|\/e\/|\/p\/|idE=)/i.test(u.pathname + u.search)) continue;
      if (/\.(jpg|png|pdf|css|js)$/i.test(u.pathname) || u.pathname.split("/").filter(Boolean).length < 2 && !u.search) continue;
      seen.add(u.href); if (seen.size >= 40) break; }
    const list = [...seen];
    for (let i = 0; i < list.length; i += 8) await Promise.all(list.slice(i, i + 8).map(async u => { const d = await get(u); if (!d.body) return; followed++;
      for (const b of blobs(d.body)) walk(b, o => { const x = fromLd(o) || fromApp(o); if (x) { x.url = x.url || u; items.push(x); } });
      microdata(d.body).forEach(x => { x.url = x.url || u; items.push(x); }); }));
  }
  const mk = r.body ? ["ld+json", "schema.org/Event", "__NEXT_DATA__", "__NUXT__", "tribe-events", ".ics", "wp-json"].filter(k => r.body.includes(k)).join(" ") : "";
  report.sources.push({ url: src.url, status: r.status, bytes: r.body.length, found: items.length, followed, markers: mk });
  items.forEach(x => raw.push({ ...x, src: src }));
}
const groups = new Set([...html.matchAll(/meetup\.com\/([A-Za-z0-9_-]+)\/events/g)].map(m => m[1]).concat(cfg.meetupExtra || []));
const jobs = [...[...groups].map(g => ({ url: `https://www.meetup.com/${g}/events/`, kind: "meetup" })), ...cfg.pages];
for (let i = 0; i < jobs.length; i += 6) await Promise.all(jobs.slice(i, i + 6).map(harvest));

const DE = /\b(und|von|nach|einem|einer|drei|akten|vom|am|den|dem|des|sich|wird|sind|ist|zu|der|die|das|mit|für|ein|eine|im|zum|zur|auf|bei|wir|ihr|nicht|oder|auch|ab|uhr|eintritt|anmeldung|führung|abend|kinder|markt)\b/gi;
const FR = /\b(et|le|la|les|des|du|avec|pour|une|un|dans|sur|nous|vous|soirée|entrée|libre|atelier|inscription|marché|gratuit|au|aux)\b/gi;
const EN = /\b(the|and|with|for|of|is|are|you|your|this|our|join|free|night|event)\b/gi;
const langOf = t => { const d = (t.match(DE) || []).length, f = (t.match(FR) || []).length, e = (t.match(EN) || []).length; if (e >= d && e >= f) return "en"; return d > f ? "de" : f > d ? "fr" : (/[äöüß]/i.test(t) ? "de" : /[éèêàç]/i.test(t) ? "fr" : "en"); };
const DEONLY = /\b(auf|in) (deutsch|deutscher sprache|mundart|schweizerdeutsch|dialekt)\b|sprache:? ?deutsch|\bin german\b|german[- ]language|\bmundart\b|züritüütsch|schwiizerdütsch|schweizerdeutsch|in swiss german|german only/i;
const SPOKEN = /theater|theatre|schauspiel|kabarett|cabaret|komödie|comedy|stand-?up|lesung|vortrag|führung|poetry slam|slam|hörspiel|musical|improtheater|podium|diskussion|lecture|talk\b/i;
/* ---------- normalise ---------- */
const norm = t => clean(t).toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "").slice(0, 28);
const existing = new Set([...html.matchAll(/"day": ?"(\d{4}-\d{2}-\d{2})"[^{}]*?"title": ?"([^"]+)"/g)].map(m => m[1] + "|" + norm(m[2])));
const existingUrl = new Set([...html.matchAll(/"url": ?"([^"]+)"/g)].map(m => m[1].replace(/[?#].*$/, "")));
const slug = s => clean(s).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const SRCNAME = { "meetup.com": "Meetup", "eventbrite.ch": "Eventbrite", "eventbrite.com": "Eventbrite", "eventfrog.ch": "Eventfrog", "songkick.com": "Songkick" };
const out = new Map(), seenVenue = new Set();
for (const x of raw) {
  const s = when(x.start); if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.day)) { drop("no date"); continue; }
  const e = when(x.end); const title = clean(x.title).slice(0, 110);
  if (!title || BAD.test(title + " " + (x.organizer || ""))) { drop("not relevant"); continue; }
  if (NICHE.test(title + " " + (x.organizer || "") + " " + String(x.desc || "").slice(0, 300))) { drop("niche (card games, wargaming…)"); continue; }
  if (/suitable for children|for children aged|für kinder|kinder ab|ab \d+ jahren|dès \d+ ans|pour enfants|jeune public|familienführung|for kids/i.test(String(x.desc || "").slice(0, 400))) { drop("children's event"); continue; }
  const multi = e && e.day > s.day;
  const lastDay = multi ? e.day : s.day;
  if (lastDay < TODAY) { drop("past"); continue; }
  if (s.day > BIG_UNTIL) { drop("far future"); continue; }
  const exhibit = /Exhibition/i.test(x.type || "") || (multi && (Date.parse(e.day) - Date.parse(s.day)) / 864e5 >= 6);
  const gc = x.src.kind === "meetup" ? (/z[uü]e?rich/i.test(x.src.url) ? "zh" : /lausanne/i.test(x.src.url) ? null : /gen[eè]v|geneva/i.test(x.src.url) ? "ge" : x.src.city) : x.src.city;
  const ptmp = placeOf(x.geo, x.place, gc);
  if (ptmp && ptmp.city === "zh") { const t = title + " " + clean(x.desc).slice(0, 400); if (DEONLY.test(t) || (SPOKEN.test(t) && langOf(t) === "de" && !/english|englisch|übertitel|surtit/i.test(t))) { drop("Zurich: German-only spoken event", x); continue; } }
  const pl = placeOf(x.geo, x.place, gc) || (gc && /^\s*$/.test(x.place || "") ? null : null); if (!pl) { drop(x.geo ? "too far" : "unknown place", x); continue; }
  let p, day = s.day < TODAY && multi ? TODAY : s.day;
  if (exhibit) { p = "on"; }
  else if (day <= LAST) { p = periodOf(day); if (!p) { drop("outside weeks"); continue; } }
  else if (x.src.big && day <= BIG_UNTIL) p = "big";
  else { drop("later than 2 weeks"); continue; }
  if (dow(day) >= 1 && dow(day) <= 5 && s.time && s.time < "17:30" && !multi) { drop("weekday daytime"); continue; }
  const url = (x.url || x.src.url).replace(/[?#].*$/, "");
  const key = day + "|" + norm(title);
  if (existing.has(key) || existingUrl.has(url)) { drop("already in app"); continue; }
  if (out.has(key)) { drop("duplicate"); continue; }
  const vkey = day + "|" + (s.time || "") + "|" + norm(String(x.place || "").split(",")[0]);
  if (s.time && x.place && seenVenue.has(vkey)) { drop("duplicate"); continue; } seenVenue.add(vkey);
  const free = x.isFree === true || x.price === 0 || x.price === "0" || /\b(free|gratuit|gratis|kostenlos)\b/i.test(title);
  const price = free ? "Free" : x.price ? `${x.cur || "CHF"} ${Math.round(+x.price) || x.price}` : "Price to check";
  const cat = catsOf(title, x.desc, x.src.kind);
  const tE = e && e.time && !multi ? "–" + e.time : "";
  const whenTxt = p === "on" ? `Until ${nice(lastDay)}` : p === "big" ? `${nice(day)}${s.time ? " · " + s.time : ""}` : `${DN[dow(day)]} ${+day.slice(8)}${s.time && s.time !== "00:00" ? " · " + s.time + tE : ""}`;
  const ev = { id: `a-${pl.city}-${slug(title)}-${day.slice(5)}`, p, day, when: whenTxt, title, url, place: clean(x.place).slice(0, 120) || (pl.city === "ge" ? "Geneva" : "Zurich"), trip: pl.trip, price, cat, zone: pl.zone, city: pl.city, desc: short(x.desc) || "", auto: 1, src: SRCNAME[host(url)] || host(url) };
  if (x.geo) ev.geo = x.geo.map(v => Math.round(v * 1e4) / 1e4);
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

/* ---------- places on the map (free Photon geocoder, cached in data/geo.json) ---------- */
let GEO = {}; try { GEO = JSON.parse(rd("data/geo.json")); } catch {}
const want = new Set();
const TRIPMAP = {}; for (const m of html.matchAll(/\{"id": ?"((?:zh-)?[a-z0-9-]+)", ?"name": ?"[^"]*", ?"kind"[\s\S]{0,6000}?"map": ?"([^"]+)"/g)) { TRIPMAP[m[1]] = m[2]; want.add(m[2]); }
const mq = html.match(/const MAPQ\s*=\s*(\{[\s\S]*?\});/); try { Object.values(JSON.parse(mq[1])).forEach(v => want.add(v)); } catch {}
const mqz = html.match(/const MAPQ_ZH\s*=\s*(\{[\s\S]*?\});/); try { Object.values(JSON.parse(mqz[1])).forEach(v => want.add(v)); } catch {}
for (const m of html.matchAll(/"place": ?"([^"]{6,140})"/g)) want.add(m[1]);

let looked = 0;
for (const q of want) {
  if (q in GEO || looked >= 250) continue; looked++;
  const r = await get("https://photon.komoot.io/api/?limit=1&lat=46.8&lon=7.4&q=" + encodeURIComponent(q));
  try { const f = JSON.parse(r.body).features[0]; GEO[q] = f ? f.geometry.coordinates.slice().reverse().map(v => Math.round(v * 1e4) / 1e4) : null; } catch { GEO[q] = null; }
  await new Promise(z => setTimeout(z, 120));
}
report.geocoded = looked;
/* day-trip weather at the destination (Open-Meteo, 14 days) */
const twx = {}; const tids = Object.keys(TRIPMAP).filter(id => GEO[TRIPMAP[id]]);
for (let i = 0; i < tids.length; i += 25) {
  const b = tids.slice(i, i + 25), ll = b.map(id => GEO[TRIPMAP[id]]);
  const r = await get(`https://api.open-meteo.com/v1/forecast?latitude=${ll.map(x => x[0]).join(",")}&longitude=${ll.map(x => x[1]).join(",")}&daily=temperature_2m_max,precipitation_probability_max&timezone=Europe%2FZurich&forecast_days=14`);
  try { let j = JSON.parse(r.body); if (!Array.isArray(j)) j = [j]; j.forEach((x, k) => { const o = twx[b[k]] = {}; x.daily.time.forEach((d, n) => o[d] = [Math.round(x.daily.temperature_2m_max[n]), x.daily.precipitation_probability_max[n] ?? 0]); }); } catch { report.tripWeather = "failed " + r.status; }
}
const tgeo = {}; for (const id in TRIPMAP) if (GEO[TRIPMAP[id]]) tgeo[id] = GEO[TRIPMAP[id]];

/* ---------- weekly curation (written by the short Claude run) ---------- */
let cur = {}; try { cur = JSON.parse(rd("data/curated.json")); } catch {}
const fresh = cur.week === MON;
const notes = { ge: {}, zh: {} };
for (const p of periods) for (const c of ["ge", "zh"]) notes[c][p.id] = (fresh && cur.notes && cur.notes[c] && cur.notes[c][p.id]) || wetNote(c, p);
periods.forEach(p => { p.note = notes.ge[p.id]; });
const add = (cur.add || []).filter(e => (e.dayEnd || e.day) >= TODAY).map(e => ({ ...e, p: e.p === "big" || e.p === "on" ? e.p : periodOf(e.day) || "later" }));

/* ---------- English: translate German/French titles and descriptions (free MyMemory API, cached in data/tr.json) ---------- */
let TR = {}; try { TR = JSON.parse(rd("data/tr.json")); } catch {}
let budget = 40000, trCount = 0;
async function toEn(t) {
  t = String(t || "").trim(); if (!t) return t;
  const l = langOf(t); if (l === "en") return null;
  const key = l + ":" + t; if (key in TR) return TR[key];
  if (budget - t.length < 0) return null; budget -= t.length;
  const r = await get(`https://api.mymemory.translated.net/get?langpair=${l}|en&de=bot%40users.noreply.github.com&q=${encodeURIComponent(t.slice(0, 480))}`);
  try { const j = JSON.parse(r.body); const out = j.responseData && j.responseData.translatedText; if (out && !/MYMEMORY WARNING|QUERY LENGTH/i.test(out) && j.responseStatus == 200) { TR[key] = clean(out); trCount++; return TR[key]; } } catch {}
  return null;
}
async function titleEn(t, city) {
  t = String(t || "").trim(); if (t.length < 4) return null;
  if ((t.match(EN) || []).length) return null;
  const l = langOf(t) !== "en" ? langOf(t) : (city === "zh" ? "de" : "fr");
  const key = l + ":" + t; if (key in TR) return TR[key];
  if (budget - t.length < 0) return null; budget -= t.length;
  const r = await get(`https://api.mymemory.translated.net/get?langpair=${l}|en&de=bot%40users.noreply.github.com&q=${encodeURIComponent(t)}`);
  try { const j = JSON.parse(r.body); const out = j.responseData && j.responseData.translatedText; if (out && j.responseStatus == 200 && !/MYMEMORY WARNING/i.test(out)) { TR[key] = clean(out); trCount++; return TR[key]; } } catch {}
  return null;
}
/* hand-picked events in the app: translate their names too */
const tEn = {};
for (const m of html.matchAll(/\{"id": ?"([a-z0-9@-]+)", ?"p": ?"[^"]*"[^{}]*?"title": ?"([^"]+)"/g)) {
  const city = m[1].startsWith("zh-") ? "zh" : "ge"; const t = await titleEn(m[2], city);
  if (t && norm(t) !== norm(m[2])) tEn[m[1]] = t.slice(0, 110);
}
for (const e of events.concat(add)) {
  const tt = (await toEn(e.title)) || (await titleEn(e.title, e.city)); if (tt && norm(tt) !== norm(e.title)) e.titleEn = tt.slice(0, 110);
  if (e.desc) { const dd = await toEn(e.desc); if (dd) e.desc = dd; }
}
report.translated = trCount;

/* first time each event was seen (for "new events" messages) */
let SEEN = {}; try { SEEN = JSON.parse(rd("data/seen.json")); } catch {}
const allNow = events.concat(add); allNow.forEach(e => { if (!SEEN[e.id]) SEEN[e.id] = TODAY; });
const liveIds = new Set(allNow.map(e => e.id)); for (const k in SEEN) if (!liveIds.has(k) && SEEN[k] < addD(TODAY, -30)) delete SEEN[k];
allNow.forEach(e => { e.seen = SEEN[e.id]; });
const AUTO = { tEn, generated: new Date().toISOString(), week: MON, periods, notesZh: notes.zh, wx, twx, tgeo, geo: Object.fromEntries(Object.entries(GEO).filter(([, v]) => v)), events: events.concat(add), edits: cur.edits || {}, drop: cur.drop || [], picks: fresh ? cur.picks || [] : [] };
fs.mkdirSync(new URL("data/", root), { recursive: true });
fs.writeFileSync(new URL("data/geo.json", root), JSON.stringify(GEO));
fs.writeFileSync(new URL("data/tr.json", root), JSON.stringify(TR));
fs.writeFileSync(new URL("data/seen.json", root), JSON.stringify(SEEN));
fs.writeFileSync(new URL("auto.js", root), "window.AUTO=" + JSON.stringify(AUTO) + ";\n");
fs.writeFileSync(new URL("data/auto.json", root), JSON.stringify({ week: MON, periods, events: AUTO.events.map(({ id, p, day, when, title, place, price, cat, city, zone, src, desc, url }) => ({ id, p, day, when, title, place, price, cat, city, zone, src, desc: desc.slice(0, 160), url })) }, null, 0).replace(/\},\{/g, "},\n{"));
report.byCity = { ge: events.filter(e => e.city === "ge").length, zh: events.filter(e => e.city === "zh").length };
report.samples = samples;
report.sources.sort((a, b) => b.found - a.found);
fs.writeFileSync(new URL("data/report.json", root), JSON.stringify(report, null, 1));
console.log(`kept ${events.length} (ge ${report.byCity.ge}, zh ${report.byCity.zh})`, JSON.stringify(report.dropped));
