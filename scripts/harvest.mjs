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
/* age range mentioned by the organiser (mostly Meetup): "ages 25-40", "30s and 40s", "25 to 45 years", "30+ only" */
function ageOf(t) {
  t = clean(t || ""); const ok = (a, b) => a >= 16 && a <= 80 && (!b || (b > a && b <= 90)); let m;
  if ((m = t.match(/\b(?:ages?|aged|age group|age range|âge|alter|for people|between)\s*(?:of|from|:)?\s*(\d{2})\s*(?:-|–|to|and|bis|à|et)\s*(\d{2})/i)) && ok(+m[1], +m[2])) return m[1] + "–" + m[2];
  if ((m = t.match(/\b(\d{2})\s*(?:-|–|to|bis|à)\s*(\d{2})\s*(?:y\/?o\b|years?|yrs|ans|jahre|year-olds)/i)) && ok(+m[1], +m[2])) return m[1] + "–" + m[2];
  if ((m = t.match(/\b(\d)0s\s*(?:&|and|,|-|–|to|et|und)\s*(?:early\s*)?(\d)0s\b/i)) && ok(+m[1] * 10, +m[2] * 10 + 9)) return m[1] + "0s–" + m[2] + "0s";
  if ((m = t.match(/\b(?:ages?|aged|age|âge|alter)\s*:?\s*(\d{2})\s*\+|\b(\d{2})\s*\+\s*(?:only|years?|y\/?o|ans|jahre)\b/i))) { const a = +(m[1] || m[2]); if (ok(a) && a > 18) return a + "+"; }
  return "";
}

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
/* Towns an event can name in its title while carrying no venue of its own. Meetup events are the
   usual case: with no place text they used to inherit the search city, so a ski day in Andermatt
   or life drawing in Zug was filed as "Zurich". Ambiguous names need context — "Zug" is also the
   German for a train and "Baden" for bathing — so those only match after a preposition or comma. */
const TOWNS = [
  [/\b(?:in|nach|bei|near|@|,)\s*Zug\b/i, [47.1662, 8.5155]], [/\b(?:in|nach|bei|near|@|,)\s*Baden\b/i, [47.4733, 8.3064]],
  [/\bwinterthur\b/i, [47.4997, 8.7241]], [/\b(?:luzern|lucerne)\b/i, [47.0502, 8.3093]],
  [/\bst\.?\s?gallen\b/i, [47.4245, 9.3767]], [/\bschaffhausen\b/i, [47.6960, 8.6346]],
  [/\brapperswil\b/i, [47.2260, 8.8180]], [/\buster\b/i, [47.3470, 8.7210]],
  [/\baltdorf\b/i, [46.8803, 8.6444]], [/\bandermatt\b/i, [46.6364, 8.5944]],
  [/\bchur\b/i, [46.8508, 9.5320]], [/\bbasel\b/i, [47.5596, 7.5886]],
  [/\bbern\b/i, [46.9480, 7.4474]], [/\bthun\b/i, [46.7580, 7.6280]],
  [/\binterlaken\b/i, [46.6863, 7.8632]], [/\bdavos\b/i, [46.8027, 9.8360]],
  [/\barosa\b/i, [46.7833, 9.6800]], [/\bengelberg\b/i, [46.8208, 8.4017]],
  [/\baarau\b/i, [47.3909, 8.0455]], [/\bolten\b/i, [47.3500, 7.9030]],
  [/\blausanne\b/i, [46.5197, 6.6323]], [/\bmontreux\b/i, [46.4312, 6.9107]],
  [/\bvevey\b/i, [46.4628, 6.8419]], [/\bnyon\b/i, [46.3833, 6.2394]],
  [/\bmorges\b/i, [46.5113, 6.4981]], [/\byverdon\b/i, [46.7785, 6.6410]],
  [/\bfribourg\b/i, [46.8065, 7.1619]], [/\bneuch[âa]tel\b/i, [46.9900, 6.9293]],
  [/\bsion\b/i, [46.2331, 7.3606]], [/\bverbier\b/i, [46.0961, 7.2286]],
  [/\bzermatt\b/i, [46.0207, 7.7491]], [/\bannecy\b/i, [45.8992, 6.1294]],
  [/\bchamonix\b/i, [45.9237, 6.8694]], [/\bthonon\b/i, [46.3700, 6.4800]],
];
const townGeo = t => { for (const [re, g] of TOWNS) if (re.test(t)) return g; return null; };
function placeOf(geo, text, srcCity, title) {
  if (geo) {
    const d = { ge: km(geo, CITY.ge), zh: km(geo, CITY.zh) }; const city = d.ge < d.zh ? "ge" : "zh"; const k = d[city];
    if (k > 110) return null;
    return { city, zone: k <= 9 ? city : k <= 50 ? "45" : "90", trip: k <= 9 ? (city === "ge" ? "Geneva" : "Zurich") : `≈ ${Math.round(k)} km away` };
  }
  for (const c of ["ge", "zh"]) if (LOCAL[c].test(text || "")) return { city: c, zone: c, trip: c === "ge" ? "Geneva" : "Zurich" };
  for (const [re, city, zone, trip] of NEAR) if (re.test(text || "")) return { city, zone, trip };
  if (srcCity && !text) {
    const g = title && townGeo(title);
    if (g) return placeOf(g, "", srcCity, "");
    return { city: srcCity, zone: srcCity, trip: srcCity === "ge" ? "Geneva" : "Zurich" };
  }
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
const NICHE = /riftbound|swiss rounds|organized play|store tournament|kabooom|one piece store|pok[eé]mon|yu-?gi-?oh|magic:? the gathering|\bmtg\b|commander (event|night|league|game)|trading card|\btcg\b|\bccg\b|card game|kartenspiel|jeux? de cartes|flesh and blood|lorcana|one piece card|digimon|star wars unlimited|warhammer|kill team|age of sigmar|\b40k\b|wargam|miniature painting|tabletop wargame|\blarp\b|cosplay|anime|manga|furry|vtuber|e-?sports|lan party/i;
const BAD = /bourse (?:aux |d.)?(?:jouets|enfan|pu[ée]ricult)|pu[ée]riculture|vide[- ]maison|bourse enfance|webinar|online only|virtual|zoom|livestream|kids?\b|children|enfants?\b|kinder|family day|familien|baby|b[eé]b[eé]|crypto|forex|trading|investor|invest |mlm|real estate|immobilier|sales training|job fair|career fair|recruit|bootcamp|certification|hackathon|church service|messe\b|gottesdienst|culte\b|speed jeune public|d[eè]s \d+ ans|ab \d+ jahren|f[uü]r kinder|marionnette|puppentheater|conte pour|contes pour|bébés lecteurs|seniors?\b|retrait[eé]s|employer une|citizen committee|comité de quartier|citizen assembly|assemblée citoyenne|democracy week|semaine de la démocratie|urbansgemeinde|conseil municipal|gemeindeversammlung|adolescen/i;
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


/* La Décadanse: Geneva's community agenda, one page per day, grouped by genre */
function fromDecadanse(body) {
  const out = []; const ent = t => t.replace(/&#0?39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const parts = body.split(/<h2 id="/);
  for (const part of parts.slice(1)) {
    const genre = part.slice(0, part.indexOf('"'));
    if (/^(cinema|cine|expos)/i.test(genre)) continue;
    for (const a of part.split(/<article id="event-/).slice(1)) {
      const id = (a.match(/^(\d+)/) || [])[1]; const title = ((a.match(/<h3[^>]*>\s*<a[^>]*>([^<]+)<\/a>/) || [])[1] || "").trim();
      if (!id || !title) continue;
      const venue = ((a.match(/<header class="titre">[\s\S]*?<span class="right">([\s\S]*?)<\/span>/) || [])[1] || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const prat = a.match(/<div class="pratique">\s*<span class="left">([^<]*)<\/span>\s*<span class="right">([^<]*)<\/span>/) || [];
      const dt = a.match(/dates=(\d{8})T(\d{4})\d\d(?:%2F|\/)(\d{8})T(\d{4})/) || a.match(/st=(\d{8})T(\d{4})\d\d&(?:amp;)?et=(\d{8})T(\d{4})/);
      if (!dt) continue;
      const iso = (d, h) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${h.slice(0, 2)}:${h.slice(2)}`;
      const info = ent(prat[2] || "").replace(/\s+/g, " ").trim(); const price = (info.split(/,\s*/).slice(1).join(", ") || "").trim();
      const desc = ent(((a.match(/js-description-clamp">([\s\S]*?)<\/p>/) || [])[1] || "").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/\*\*/g, "")).replace(/\s+/g, " ").trim();
      const st0 = iso(dt[1], dt[2]); let en0 = iso(dt[3], dt[4]); if ((new Date(en0) - new Date(st0)) > 14 * 3600e3 || en0 <= st0) en0 = null;
      out.push({ title: ent(title), start: st0, end: en0, url: "https://www.ladecadanse.ch/event/evenement.php?idE=" + id,
        place: [ent(venue), ent(prat[1] || "").trim()].filter(Boolean).join(", "), price: /gratuit|libre|free/i.test(price) ? "Free" : price || null, desc, genre });
    }
  }
  return out;
}

/* OpenAgenda legacy JSON export (Musées de Genève and others) */
function fromOpenAgenda(d) {
  const out = []; const L = o => o ? (o.en || o.fr || o.de || Object.values(o)[0] || "") : "";
  for (const e of d.events || []) {
    const t = (e.timings || []).filter(x => x.end.slice(0, 10) >= TODAY).sort((a, b) => a.start < b.start ? -1 : 1); if (!t.length) continue;
    const loc = [e.locationName && !/autre lieu/i.test(e.locationName) ? e.locationName : (e.custom && e.custom.other_place) || "", e.address, e.city].filter(Boolean).join(", ");
    const base = { title: L(e.title), url: (e.registration || []).map(r => r.value).find(v => /^https?:/.test(v)) || e.canonicalUrl, place: loc,
      geo: e.latitude ? [e.latitude, e.longitude] : null, price: /CHF\s*0\b|gratuit|free|libre/i.test(L(e.conditions)) ? "Free" : L(e.conditions) || null,
      desc: [L(e.description), L(e.longDescription)].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 900) };
    if (t.length > 3) out.push({ ...base, start: t[0].start, end: t[t.length - 1].end });
    else t.forEach(x => out.push({ ...base, start: x.start, end: x.end }));
  }
  return out;
}
const raw = [];
/* numeric and named HTML entities: these venue pages print titles like "Let&#8217;s Dance" */
const cp = n => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");
const unent = s => String(s || "").replace(/&#(\d+);/g, (_, n) => cp(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16)))
  .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const isoAddDays = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const isoAddDay = d => isoAddDays(d, 1);
async function harvest(src) {
  if (src.kind === "openagenda") { const items = []; let st = 0, bytes = 0;
    for (let off = 0; off < 400; off += 100) { const r = await get(src.url + (src.url.includes("?") ? "&" : "?") + "limit=100&offset=" + off); st = r.status; bytes += r.body.length; let d; try { d = JSON.parse(r.body); } catch { break; } items.push(...fromOpenAgenda(d)); if (!d.events || d.events.length < 100) break; }
    report.sources.push({ url: src.url, status: st, bytes, found: items.length, followed: 0, markers: "openagenda json" }); items.forEach(x => raw.push({ ...x, src })); return; }
  if (src.kind === "ladecadanse") { const seen = new Map(); let st = 0, bytes = 0;
    for (let i = 0; i < 14; i += 7) await Promise.all([...Array(7)].map(async (_, k) => { const d = new Date(TODAY + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + i + k); const r = await get("https://www.ladecadanse.ch/index.php?courant=" + d.toISOString().slice(0, 10)); st = r.status; bytes += r.body.length; fromDecadanse(r.body).forEach(x => seen.set(x.url + x.start.slice(0, 10), x)); }));
    report.sources.push({ url: src.url, status: st, bytes, found: seen.size, followed: 14, markers: "day agenda" }); seen.forEach(x => raw.push({ ...x, src })); return; }
  /* Zürich unbezahlbar lists only free events, server-rendered, 24 to a page. No structured data
     at all, which is why the generic path saw nothing — but the title, date and times are right
     there in the markup. The <time datetime=…> attribute is unreliable (it reads 2026-11-11 for a
     12 November event), so the German date in the visible text is what we parse. */
  if (src.kind === "unbezahlbar") {
    const MON = { januar: 1, februar: 2, "märz": 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };
    const base = "https://www.zuerichunbezahlbar.ch/events/";
    const seen = new Map(); let st = 0, bytes = 0, followed = 0;
    for (let p = 1; p <= 4; p++) {
      const r0 = await get(base + (p > 1 ? "?page=" + p : "")); st = r0.status; bytes += r0.body.length; followed++;
      const arts = r0.body.split('<article class="poster').slice(1);
      if (!arts.length) break;
      for (const a of arts) {
        const href = (a.match(/href="\s*([^"]+?)\s*"/) || [])[1];
        const title = unent((a.match(/data-js-poster-title[^>]*>([\s\S]*?)<\/span>/) || [])[1] || "").replace(/\s+/g, " ").trim();
        const tt = unent((a.match(/<time[^>]*>([\s\S]*?)<\/time>/) || [])[1] || "").replace(/\s+/g, " ").trim();
        const dm = tt.match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)/);
        const hh = tt.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/) || tt.match(/(\d{1,2}):(\d{2})/);
        if (!href || !title || !dm || !hh) continue;
        const mo = MON[dm[2].toLowerCase()]; if (!mo) continue;
        /* The listing prints no year. Roll forward only when the date is well behind us, i.e.
           genuinely next year's occurrence — a date that has merely just passed (yesterday, or a
           run that started earlier this month) must stay in this year and be dropped as past,
           not become an event twelve months away. */
        let day = `${+TODAY.slice(0, 4)}-${String(mo).padStart(2, "0")}-${String(+dm[1]).padStart(2, "0")}`;
        if (day < TODAY && (new Date(TODAY) - new Date(day)) > 60 * 864e5) day = `${+TODAY.slice(0, 4) + 1}` + day.slice(4);
        const s0 = hh[1].padStart(2, "0") + ":" + hh[2], e0 = hh[3] ? hh[3].padStart(2, "0") + ":" + hh[4] : "";
        /* permanently-open facilities (a bouldering cube, a parkour park) are listed with
           00:00–23:59 — they are places, not things happening tonight */
        if (/^00:0[01]$/.test(s0) && (!e0 || /^(23:59|00:00|23:5\d)$/.test(e0))) continue;
        let url; try { url = new URL(href, base).href; } catch { continue; }
        /* an end before the start means it runs past midnight */
        const end = e0 ? (e0 > s0 ? day + "T" + e0 : isoAddDay(day) + "T" + e0) : null;
        seen.set(url + day + s0, { title, start: day + "T" + s0, end, url, place: "", isFree: true, desc: "" });
      }
    }
    /* The listing gives no venue and no text. Both matter: "Zurich" as the venue is useless on a
       card and collides in the day+time+venue dedupe, and an empty description means the
       German-language filter has only the title to work with and lets German-only talks through.
       The detail pages carry a clean <address> and real copy, so read them. */
    /* Only the ones that can still be kept — the pipeline drops anything beyond about a fortnight.
       A flat "first 50" missed three near-term events that happened to sit on a later listing page,
       and they shipped with no venue and a page-dump description. Four at a time, because this is
       otherwise the slowest source in the run. */
    const horizon = isoAddDays(TODAY, 24);
    const soon = [...seen.values()].filter(x => x.start.slice(0, 10) <= horizon).slice(0, 70);
    const detail = async x => {
      const d = await get(x.url); if (!d.body) return; bytes += d.body.length; followed++;
      const ad = (d.body.match(/<address[^>]*detailpost__address[^>]*>([\s\S]*?)<\/address>/i) || [])[1];
      if (ad) {
        const parts = unent(ad).replace(/<br\s*\/?>/gi, "|").replace(/<[^>]+>/g, "").split("|").map(s => s.trim()).filter(Boolean);
        x.place = parts.filter((p, i) => parts.indexOf(p) === i).join(", ").replace(/\bCH-(\d{4})\b/, "$1").slice(0, 120);
      }
      let dd = unent((d.body.match(/<meta[^>]+(?:property|name)="(?:og:)?description"[^>]*content="([^"]*)"/i) || [])[1] || "").trim();
      if (dd.length < 60) {
        const ps = [...d.body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => unent(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()).filter(s => s.length >= 60);
        if (ps.length) dd = ps.sort((a, b) => b.length - a.length)[0];
      }
      if (dd) x.desc = dd.slice(0, 500);
    };
    for (let i = 0; i < soon.length; i += 4) await Promise.all(soon.slice(i, i + 4).map(detail));
    report["unbezahlbar.detailed"] = soon.length;
    seen.forEach(x => { if (!x.place) x.place = "Zurich"; });
    report.sources.push({ url: src.url, status: st, bytes, found: seen.size, followed, markers: "poster list" });
    seen.forEach(x => raw.push({ ...x, src })); return;
  }
  /* Hallenstadion's listing carries no event data and its JSON-LD is breadcrumbs only, which is
     why the generic path found nothing. Every event page does carry an AddEvent block with a
     clean start, so read the listing for links and the dates off the pages themselves. */
  if (src.kind === "hallenstadion") {
    const seen = new Map(); let st = 0, bytes = 0, followed = 0; const links = new Set();
    for (const p of ["", "page/2/"]) {
      const r0 = await get("https://hallenstadion.ch/events/" + p); st = r0.status; bytes += r0.body.length;
      for (const m of r0.body.matchAll(/href="(https:\/\/hallenstadion\.ch\/events\/[a-z0-9-]+\?availability_id=\d+)"/g)) links.add(m[1]);
    }
    for (const u of [...links].slice(0, 30)) {
      const d = await get(u); bytes += d.body.length; followed++;
      const m = d.body.match(/<span class="start">\s*(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})\s*<\/span>/);
      const t = (d.body.match(/<span class="title">\s*([^<]+?)\s*<\/span>/) || [])[1];
      if (!m || !t) continue;
      const desc = unent(((d.body.match(/<meta[^>]+(?:property|name)="og:description"[^>]*content="([^"]*)"/) || [])[1] || "")).trim();
      seen.set(u, { title: clean(unent(t)), start: `${m[3]}-${m[2]}-${m[1]}T${m[4].padStart(2, "0")}:${m[5]}`, end: null,
        url: u, place: "Hallenstadion, Wallisellenstrasse 45, Zürich", geo: [47.4114, 8.5516], price: null, desc });
    }
    report.sources.push({ url: src.url, status: st, bytes, found: seen.size, followed, markers: "addevent block" });
    seen.forEach(x => raw.push({ ...x, src })); return;
  }
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
    const hrefs = [...r.body.matchAll(/href=["']([^"'#]+)["']/g)].sort((x, y) => (/\/p\/[^"']+\.html/.test(y[1]) ? 1 : 0) - (/\/p\/[^"']+\.html/.test(x[1]) ? 1 : 0));
    for (const m of hrefs) { let u; try { u = new URL(m[1].replace(/&amp;/g, "&"), base); } catch { continue; }
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
/* meetupSkip holds slugs meetup.com answers with its "Group not found" placeholder. They are
   fetched from the group links inside index.html, so removing them from meetupExtra isn't enough. */
const skipG = new Set(cfg.meetupSkip || []);
const groups = new Set([...html.matchAll(/meetup\.com\/([A-Za-z0-9_-]+)\/events/g)].map(m => m[1]).concat(cfg.meetupExtra || []).filter(g => !skipG.has(g)));
const jobs = [...[...groups].map(g => ({ url: `https://www.meetup.com/${g}/events/`, kind: "meetup" })), ...cfg.pages];
/* Eventfrog rate-limits parallel requests: run those one after another, alongside the rest */
const frog = jobs.filter(j => /eventfrog\./.test(j.url)), rest = jobs.filter(j => !/eventfrog\./.test(j.url));
/* One bad page must not cost us the whole night: an unhandled throw anywhere in here rejects the
   batch, the script exits non-zero, the workflow never reaches its Save step and the app quietly
   keeps yesterday's events. Record the failure against the source instead, as cinema.mjs does. */
const harvestSafe = async j => { try { await harvest(j); } catch (e) { report.sources.push({ url: j.url, status: 0, bytes: 0, found: 0, followed: 0, markers: "FAILED: " + String(e && e.message || e).slice(0, 120) }); } };
const frogRun = (async () => { for (const j of frog) { await harvestSafe(j); await new Promise(r => setTimeout(r, 4000)); } })();
for (let i = 0; i < rest.length; i += 6) await Promise.all(rest.slice(i, i + 6).map(harvestSafe));
await frogRun;

const DE = /\b(und|von|nach|einem|einer|drei|akten|vom|am|den|dem|des|sich|wird|sind|ist|zu|der|die|das|mit|für|ein|eine|im|zum|zur|auf|bei|wir|ihr|nicht|oder|auch|ab|uhr|eintritt|anmeldung|führung|abend|kinder|markt)\b/gi;
const FR = /\b(et|le|la|les|des|du|avec|pour|une|un|dans|sur|nous|vous|soirée|entrée|libre|atelier|inscription|marché|gratuit|au|aux)\b/gi;
const EN = /\b(the|and|with|for|of|is|are|you|your|this|our|join|free|night|event)\b/gi;
const langOf = t => { const d = (t.match(DE) || []).length, f = (t.match(FR) || []).length, e = (t.match(EN) || []).length; if (e >= d && e >= f) return "en"; return d > f ? "de" : f > d ? "fr" : (/[äöüß]/i.test(t) ? "de" : /[éèêàç]/i.test(t) ? "fr" : "en"); };
const DEONLY = /\b(auf|in) (deutsch|deutscher sprache|mundart|schweizerdeutsch|dialekt)\b|sprache:? ?deutsch|\bin german\b|german[- ]language|\bmundart\b|züritüütsch|schwiizerdütsch|schweizerdeutsch|in swiss german|german only/i;
const SPOKEN = /bühne|bühnenprogramm|programm\b|solo\b|satire|humor|witz|theater|theatre|schauspiel|kabarett|cabaret|komödie|comedy|stand-?up|lesung|vortrag|führung|poetry slam|slam|hörspiel|musical|improtheater|podium|diskussion|lecture|talk\b/i;
/* ---------- normalise ---------- */
const norm = t => clean(t).toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "").slice(0, 28);
const existing = new Set([...html.matchAll(/"day": ?"(\d{4}-\d{2}-\d{2})"[^{}]*?"title": ?"([^"]+)"/g)].map(m => m[1] + "|" + norm(m[2])));
const urlKey = u => /\.php\?|[?&](id[A-Z]?|event|e)=/.test(u) ? u.replace(/#.*$/, "") : u.replace(/[?#].*$/, "");
/* 33 · nightly quality check helpers */
const NIGHTLIFE = /\b(club|party|rave|afterhour|after[- ]?party|pub crawl|nightlife|dj\b|techno|sunrise|dawn|silvester|new year)\b/i;
const NOTEVENT = /\b(post it here|introduce yourself|read me|welcome thread|say hello|ask me anything|house rules|announcement|test event)\b/i;
const dayWords = new Map();
const existingUrl = new Set([...html.matchAll(/"url": ?"([^"]+)"/g)].map(m => urlKey(m[1])));
/* day + venue, for sources that cover a single big hall. A hand-written entry for the night is
   always the better one ("Nico Santos — live at Hallenstadion", with a description), and the
   title dedupe above misses it because the scraped title is just "Nico Santos". */
const existingVenueDay = new Set([...html.matchAll(/"day": ?"(\d{4}-\d{2}-\d{2})"[^{}]*?"place": ?"([^",]+)/g)].map(m => m[1] + "|" + norm(m[2])));
const slug = s => clean(s).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const SRCNAME = { "meetup.com": "Meetup", "eventbrite.ch": "Eventbrite", "eventbrite.com": "Eventbrite", "eventfrog.ch": "Eventfrog", "songkick.com": "Songkick" };
const out = new Map(), seenVenue = new Set();
for (const x of raw) {
  const s = when(x.start); if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.day)) { drop("no date"); continue; }
  const e = when(x.end); const title = clean(x.title).slice(0, 110);
  if (!title || BAD.test(title + " " + (x.organizer || ""))) { drop("not relevant"); continue; }
  if (NICHE.test(title + " " + (x.organizer || "") + " " + String(x.desc || "").slice(0, 300))) { drop("niche (card games, wargaming…)"); continue; }
  if (/suitable for children|for children aged|adapt[ée]e?s? aux enfants|pour les enfants|en famille|famili(?:e|en)sport|kindgerecht|für kinder|kinder ab|ab \d+ jahren|dès \d+ ans|pour enfants|jeune public|familienführung|for kids/i.test(String(x.desc || "").slice(0, 400))) { drop("children's event"); continue; }
  /* ends after midnight (e.g. 21:00–04:00) = still a one-night event on the day it starts */
  const overnight = e && e.day > s.day && addD(s.day, 1) === e.day && (!e.time || e.time <= "12:00");
  const multi = e && e.day > s.day && !overnight;
  const lastDay = multi ? e.day : s.day;
  if (lastDay < TODAY) { drop("past"); continue; }
  if (s.day > BIG_UNTIL) { drop("far future"); continue; }
  const exhibit = /Exhibition/i.test(x.type || "") || (multi && (Date.parse(e.day) - Date.parse(s.day)) / 864e5 >= 6);
  const gc = x.src.kind === "meetup" ? (/z[uü]e?rich/i.test(x.src.url) ? "zh" : /lausanne/i.test(x.src.url) ? null : /gen[eè]v|geneva/i.test(x.src.url) ? "ge" : x.src.city) : x.src.city;
  const ptmp = placeOf(x.geo, x.place, gc, title);
  if (ptmp && ptmp.city === "zh") { const t = title + " " + clean(x.desc).slice(0, 400); if (DEONLY.test(t) || (SPOKEN.test(t) && langOf(t) === "de" && !/english|englisch|übertitel|surtit/i.test(t))) { drop("Zurich: German-only spoken event", x); continue; } }
  const pl = placeOf(x.geo, x.place, gc, title) || (gc && /^\s*$/.test(x.place || "") ? null : null); if (!pl) { drop(x.geo ? "too far" : "unknown place", x); continue; }
  let p, day = s.day < TODAY && multi ? TODAY : s.day;
  if (exhibit) { p = "on"; }
  else if (day <= LAST) { p = periodOf(day); if (!p) { drop("outside weeks"); continue; } }
  else if (x.src.big && day <= BIG_UNTIL) p = "big";
  else { drop("later than 2 weeks"); continue; }
  if (dow(day) >= 1 && dow(day) <= 5 && s.time && s.time < "17:30" && !multi) { drop("weekday daytime"); continue; }
  const url = urlKey(x.url || x.src.url);
  const key = day + "|" + norm(title);
  if (existing.has(key) || existingUrl.has(url)) { drop("already in app"); continue; }
  if (x.src.kind === "hallenstadion" && existingVenueDay.has(day + "|" + norm(String(x.place || "").split(",")[0]))) { drop("already in app"); continue; }
  if (out.has(key)) { drop("duplicate"); continue; }
  /* 33 · odd hours. A start between 01:00 and 06:00 is almost always an online event hosted in
     another timezone rather than something to turn up to — the conversion in when() is right, the
     event simply isn't local. Real nightlife is the exception, and early markets start at 06:00+. */
  if (s.time && s.time >= "01:00" && s.time < "06:00" && !NIGHTLIFE.test(title + " " + (x.place || ""))) { drop("odd hour (01:00–06:00)", x); continue; }
  /* 33 · forum threads that Meetup lists as if they were events. */
  if (NOTEVENT.test(title)) { drop("a forum post, not an event", x); continue; }
  /* 33 · the same thing posted twice with slightly different wording, which the exact title key
     misses: "Ice Climbing beginner course" and "Ice climbing beginner course *2 Places". */
  const tw = new Set(norm(title).split(" ").filter(w => w.length > 3));
  if (tw.size >= 3) {
    const prior = dayWords.get(day) || [];
    const dupish = prior.some(p => {
      const i = [...tw].filter(w => p.has(w)).length;
      if (i / (tw.size + p.size - i) >= 0.7) return true;
      /* one title is the other plus extra words — a cross-post with a tag bolted on, like
         "Ice Climbing beginner course" against "Ice climbing beginner course *2 Places free*".
         A plain overlap threshold cannot do this without also merging two different inaugural
         lectures, whose titles share just as many words but neither contains the other. */
      return i >= 3 && (i === tw.size || i === p.size);
    });
    if (dupish) { drop("near-duplicate title", x); continue; }
    dayWords.set(day, prior.concat([tw]));
  }
  const vkey = day + "|" + (s.time || "") + "|" + norm(String(x.place || "").split(",")[0]);
  if (s.time && x.place && seenVenue.has(vkey)) { drop("duplicate"); continue; } seenVenue.add(vkey);
  const free = x.isFree === true || x.price === 0 || x.price === "0" || /\b(free|gratuit|gratis|kostenlos)\b/i.test(title);
  const price = free ? "Free" : x.price ? `${x.cur || "CHF"} ${Math.round(+x.price) || x.price}` : "Price to check";
  const cat = catsOf(title, x.desc, x.src.kind);
  const tE = e && e.time && !multi ? "–" + e.time : "";
  const whenTxt = p === "on" ? `Until ${nice(lastDay)}` : p === "big" ? `${nice(day)}${s.time ? " · " + s.time : ""}` : `${DN[dow(day)]} ${+day.slice(8)}${s.time && s.time !== "00:00" ? " · " + s.time + tE : ""}`;
  const _ag = ageOf(title + " " + (x.desc || ""));
  const ev = { id: `a-${pl.city}-${slug(title)}-${day.slice(5)}`, p, day, when: whenTxt, title, url, place: clean(x.place).replace(/^(autre lieu|other venue|divers lieux|lieu à définir)\s*,\s*/i, "").split(/,\s*/).filter((x, i, A) => !i || x.toLowerCase() !== A[i - 1].toLowerCase()).join(", ").slice(0, 120) || (pl.city === "ge" ? "Geneva" : "Zurich"), trip: pl.trip, price, cat, zone: pl.zone, city: pl.city, desc: (_ag ? "Age range: " + _ag + ". " : "") + (short(x.desc) || ""), auto: 1, src: SRCNAME[host(url)] || host(url) };
  if (x.geo) ev.geo = x.geo.map(v => Math.round(v * 1e4) / 1e4);
  if (multi) ev.dayEnd = e.day; if (free) ev.free = true; if (cat.includes("chien")) ev.dog = true;
  if (x.src.kind === "meetup" && x.organizer) ev.grp = clean(x.organizer);
  out.set(key, ev);
}
let events = [...out.values()];
/* the same event listed by two sites (e.g. a Meetup group and lesgenevois): same city, day and start time, and their words overlap.
   Runs again after descriptions are enriched and translated. */
function dedupeSites() { const STOP = new Set("the and for with from your this that every each will des les une pour avec dans sur par aux est qui que vous nous gratuit gratuite free".split(" "));
  const words = e => new Set(String(e.title + " " + (e.titleEn || "") + " " + (e.desc || "").slice(0, 200)).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z]{4,}/g)?.filter(w => !STOP.has(w)) || []);
  const t0 = e => (String(e.when).match(/(\d{1,2}:\d{2})/) || [])[1] || "";
  const rank = e => (e.src === "Meetup" ? 2 : 0) + ((e.desc || "").length > 120 ? 1 : 0) + (/^https?:\/\/[^/]*(lesgenevois|eventfrog)/.test(e.url) ? 0 : 0.5);
  const drop2 = new Set(); const by = {};
  for (const e of events) { const k = e.city + e.day + t0(e); (by[k] = by[k] || []).push(e); }
  for (const g of Object.values(by)) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { const a = g[i], b = g[j]; if (drop2.has(a.id) || drop2.has(b.id) || !t0(a)) continue;
    const wa = words(a), wb = words(b); let n = 0; wb.forEach(w => { if (wa.has(w)) n++; });
    if (n >= 5 || (n >= 4 && n >= 0.35 * Math.min(wa.size, wb.size))) { const lose = rank(a) >= rank(b) ? b : a; drop2.add(lose.id); drop("same event on two sites", { title: lose.title, start: lose.day, place: lose.place, src: { url: lose.url } }); } }
  events = events.filter(e => !drop2.has(e.id)); }
dedupeSites();
/* keep the list readable: at most 40 per city per day; meeting people, creative, markets and Meetup first */
/* Ticketed halls score nothing on the rules below, so once a day fills up they are the first
   thing cut — which quietly undid the Kaufleuten and Hallenstadion coverage. Give them a lift. */
const BIGV = new Set((cfg.pages || []).filter(p => p.big).map(p => host(p.url)).filter(Boolean));
const per = {}; const pri = e => (e.src === "Meetup" ? 3 : 0) + ((e.cat || []).some(c => /rencontre|creatif|marche/.test(c)) ? 2 : 0) + (e.free ? 1 : 0) + (BIGV.has(host(e.url)) ? 2 : 0);
events.sort((a, b) => pri(b) - pri(a));
events = events.filter(e => { const k = e.city + e.day + e.p; per[k] = (per[k] || 0) + 1; return e.p === "on" || e.p === "big" || per[k] <= 40; });
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

/* Only single-stage halls, where one night means one event and a hand-written entry is certainly
   the same show as a scraped one. A square, a street or an arts centre can host several different
   things on one day, so day+venue must not be treated as proof of a duplicate there. */
const BIGHALL = /hallenstadion|kongresshaus|opernhaus|tonhalle|samsung hall|the hall\b/i;
/* ---------- weekly curation (written by the short Claude run) ---------- */
let cur = {}; try { cur = JSON.parse(rd("data/curated.json")); } catch {}
const fresh = cur.week === MON;
const notes = { ge: {}, zh: {} };
for (const p of periods) for (const c of ["ge", "zh"]) notes[c][p.id] = (fresh && cur.notes && cur.notes[c] && cur.notes[c][p.id]) || wetNote(c, p);
periods.forEach(p => { p.note = notes.ge[p.id]; });
const add = (cur.add || []).filter(e => (e.dayEnd || e.day) >= TODAY).map(e => ({ ...e, p: e.p === "big" || e.p === "on" ? e.p : periodOf(e.day < TODAY ? TODAY : e.day) || "later" }));
/* The weekly curation is merged after the harvest has already deduped, so a hand-written entry
   and a scraped one for the same night at the same hall both survive — the titles differ
   ("Nico Santos" vs "Nico Santos — live at Hallenstadion") so the title key never matches.
   The hand-written one is the better entry, so drop the scraped night it covers. */
{
  const curVenueDay = new Set(add.filter(e => e.place && BIGHALL.test(String(e.place))).map(e => e.day + "|" + norm(String(e.place).split(",")[0])));
  if (curVenueDay.size) {
    const before = events.length, gone = [];
    events = events.filter(e => {
      const hit = e.auto && e.place && BIGHALL.test(String(e.place)) && curVenueDay.has(e.day + "|" + norm(String(e.place).split(",")[0]));
      if (hit) gone.push(e.day + " " + e.title);
      return !hit;
    });
    if (before !== events.length) { report.curatedOverlap = before - events.length; report.curatedOverlapDropped = gone; }
  }
}

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
  t = String(t || "").trim(); if (t.length < 4 || / @ /.test(t)) return null;
  if ((t.match(EN) || []).length) return null;
  const l = city === "zh" ? "de" : "fr";
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
/* weak descriptions ("Pièce de théâtre", "Feature film as part of …"): read the event's own page for a real synopsis (cached in data/desc.json) */
let DESC = {}; try { DESC = JSON.parse(rd("data/desc.json")); } catch {}
const WEAK = /dans le cadre du festival|^(pi[eè]ce de th[ée][aâ]tre|th[ée][aâ]tre|spectacle|concert|exposition|film|projection|ausstellung|konzert|theater)\.?$|\bfilm as part of|film session|short film|film (?:as part of|in the framework of)|as part of the .{0,40}festival\.?$/i;
const JUNK = /\\"|className|\$\d+[a-z]?\\?"|\]\}\]|\{\\?"\w+\\?":/;
const metaDesc = h => { const c = [];
  /* Next.js pages (lesgenevois.com etc.) keep the real text inside the page data as "text":"…" */
  const nx = [...h.matchAll(/\\"text\\":\\"([\s\S]{80,3000}?)\\"[,}]/g)].map(m => m[1].replace(/\\\\n/g, " ").replace(/\\\\"/g, '"').replace(/\\\\u[\da-f]{4}/gi, x => String.fromCharCode(parseInt(x.slice(3), 16))).replace(/\*\*/g, "").replace(/^\s*\d+\s*min\.?[^A-Za-zÀ-ÿ“"]*/, "").replace(/^[\s\S]{0,160}?\((?:[A-Z]{2}(?:,\s*)?)+\)\s*/, "")).filter(x => !/cookie|newsletter/i.test(x) && !JUNK.test(x));
  if (nx.length) return clean(nx.sort((a, b) => b.length - a.length)[0]); for (const m of h.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:description|description|twitter:description)["'][^>]*content=["']([^"']{40,})["']/gi)) c.push(m[1]);
  for (const m of h.matchAll(/<meta[^>]+content=["']([^"']{40,})["'][^>]*(?:property|name)=["'](?:og:description|description)["']/gi)) c.push(m[1]);
  for (const m of h.matchAll(/"description"\s*:\s*"((?:[^"\\]|\\.){60,1500})"/g)) { try { c.push(JSON.parse('"' + m[1] + '"')); } catch {} }
  const body = h.replace(/<(script|style|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " "); const ps = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => clean(m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#0?39;|&rsquo;/g, "'").replace(/&amp;/g, "&"))).filter(x => x.length >= 80 && !/cookie|newsletter|inbox|abonne|subscribe|javascript|copyright|©/i.test(x));
  if (ps.length) c.push(ps.slice(0, 2).join(" "));
  return c.map(x => clean(x.replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/<[^>]+>/g, " "))).filter(x => x.length >= 40 && !JUNK.test(x) && !/cookie|javascript|newsletter|inbox|delivered to your|abonnez|subscribe/i.test(x)).sort((a, b) => b.length - a.length)[0] || ""; };
{ const todo = events.concat(add).filter(e => e.url && (!e.desc || e.desc.length < 70 || WEAK.test(e.desc.trim())) && !/songkick|meetup\.com|hallenstadion\.ch/.test(e.url)).slice(0, 140);
  for (let i = 0; i < todo.length; i += 6) await Promise.all(todo.slice(i, i + 6).map(async e => {
    let d = DESC[e.url]; if (d != null && (/inbox|newsletter|delivered to your|boîte|chaque lundi|meilleur de gen|dans le cadre du festival/i.test(d) || JUNK.test(d) || d.length < 100)) d = null; if (d == null) { const r = await get(e.url); d = r.body ? metaDesc(r.body) : ""; DESC[e.url] = d; }
    const fest = (String(e.desc || "").match(/(?:dans le cadre du|as part of the|im rahmen des?)\s+((?:festival\s+)?[^.,;]{3,60}?festival|festival\s+[^.,;]{3,50})/i) || [])[1];
    if (d && d.length > (e.desc || "").length) e.desc = (fest ? "Part of " + fest.replace(/^festival\s+(.*)$/i, "$1 Festival") + ". " : "") + short(d, 300); }));
  report.descEnriched = todo.length; fs.writeFileSync(new URL("data/desc.json", root), JSON.stringify(DESC)); }
events.concat(add).forEach(e => { if (JUNK.test(e.desc || "")) e.desc = ""; });
dedupeSites(); report.kept = events.length;
for (const e of events.concat(add)) {
  const tt = (e.src === "Songkick" || / @ /.test(e.title)) ? null : ((await toEn(e.title)) || (await titleEn(e.title, e.city))); if (tt && norm(tt) !== norm(e.title)) e.titleEn = tt.slice(0, 110);
  if (e.desc) { const dd = await toEn(e.desc); if (dd) e.desc = dd; }
}
report.translated = trCount;

/* first time each event was seen (for "new events" messages) */
let SEEN = {}; try { SEEN = JSON.parse(rd("data/seen.json")); } catch {}
const allNow = events.concat(add); allNow.forEach(e => { if (!SEEN[e.id]) SEEN[e.id] = TODAY; });
const liveIds = new Set(allNow.map(e => e.id)); for (const k in SEEN) if (!liveIds.has(k) && SEEN[k] < addD(TODAY, -30)) delete SEEN[k];
allNow.forEach(e => { e.seen = SEEN[e.id]; });
let dead = []; try { const L = JSON.parse(rd("data/links.json")); dead = Object.entries(L).filter(([, [st]]) => st === "ERR" || (st >= 400 && ![401, 403, 405, 406, 429].includes(st))).map(([u]) => u); } catch {}
const AUTO = { tEn, dead, generated: new Date().toISOString(), week: MON, periods, notesZh: notes.zh, wx, twx, tgeo, geo: Object.fromEntries(Object.entries(GEO).filter(([, v]) => v)), events: events.concat(add), edits: cur.edits || {}, drop: cur.drop || [], picks: fresh ? cur.picks || [] : [] };
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
