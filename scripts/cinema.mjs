/* Cinema collector (free, runs nightly on GitHub). Writes cine.js: window.CINE = { at, cinemas, films, links }.
   Only screenings in original English, or with English subtitles, are kept.
   Sources: Pathé Balexert (API), Les Scala / Le City / Le Nord-Sud, Cinémas du Grütli (Geneva);
            Arena Sihlcity, Riffraff / Houdini (Zurich). Other cinemas are listed as links to their own programme. */
import fs from "node:fs";
const root = new URL("../", import.meta.url);
const UA = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "accept-language": "en,fr;q=0.8,de;q=0.7" };
export let get = async (u, json) => { try { const r = await fetch(u, { headers: UA, redirect: "follow" }); if (!r.ok) return null; return json ? await r.json() : await r.text(); } catch { return null; } };
export function setGet(f) { get = f; }
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const tz = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Zurich" }));
const DAYS = [...Array(8)].map((_, i) => { const d = new Date(tz); d.setDate(d.getDate() + i); return iso(d); });
const ent = s => String(s || "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&rsquo;|&#8217;/g, "’").replace(/&quot;/g, '"').replace(/&eacute;/g, "é").replace(/&egrave;/g, "è").replace(/&[a-z]+;/g, " ");
const txt = s => ent(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const EN_COUNTRY = /^(etats-unis|états-unis|usa|royaume-uni|grande-bretagne|grossbritannien|vereinigtes königreich|vereinigte staaten|irlande|irland|australie|australien|nouvelle-zélande|neuseeland|uk|united states|united kingdom|ireland|australia|new zealand)$/i;
const GENRE = { "action": "Action", "aventure": "Adventure", "abenteuer": "Adventure", "animation": "Animation", "biographie": "Biopic", "biografie": "Biopic", "comédie": "Comedy", "komödie": "Comedy", "comédie dramatique": "Comedy drama", "tragikomödie": "Comedy drama", "documentaire": "Documentary", "dokumentation": "Documentary", "dokumentarfilm": "Documentary", "drame": "Drama", "drama": "Drama", "fantastique": "Fantasy", "fantasy": "Fantasy", "horreur": "Horror", "horror": "Horror", "policier": "Crime", "krimi": "Crime", "romance": "Romance", "liebesfilm": "Romance", "science-fiction": "Sci-fi", "sci-fi": "Sci-fi", "thriller": "Thriller", "famille": "Family", "familie": "Family", "familienfilm": "Family", "musical": "Musical", "musique": "Music film", "musik": "Music film", "historique": "Period drama", "historie": "Period drama", "guerre": "War", "kriegsfilm": "War", "western": "Western", "mystery": "Mystery", "court métrage": "Shorts", "kurzfilm": "Shorts", "opéra": "Opera", "oper": "Opera" };
const genreEn = g => { const k = String(g || "").split(/[,/]/)[0].trim().toLowerCase(); return GENRE[k] || (k ? k[0].toUpperCase() + k.slice(1) : ""); };

const cinemas = {}, films = new Map(), report = {};
const C = (id, n, city, q, url, ll) => { cinemas[id] = { n, c: city, q, u: url, ll: ll || null }; };
C("pathe-balexert", "Pathé Balexert", "ge", "Avenue Louis-Casaï 27, Genève", "https://www.pathe.ch/fr/cinemas/cinema-pathe-balexert", [46.2196, 6.1104]);
C("scala", "Les Scala", "ge", "Rue des Eaux-Vives 23, Genève", "https://les-scala.ch/fr/a-l-affiche", [46.2027, 6.1563]);
C("city", "Le City", "ge", "Place des Eaux-Vives, Genève", "https://les-scala.ch/fr/a-l-affiche", [46.2035, 6.1585]);
C("nord-sud", "Le Nord-Sud", "ge", "Rue de la Servette 78, Genève", "https://les-scala.ch/fr/a-l-affiche", [46.2149, 6.1335]);
C("grutli", "Cinémas du Grütli", "ge", "Rue du Général-Dufour 16, Genève", "https://www.cinemas-du-grutli.ch/programme", [46.2006, 6.1427]);
C("arena-sihlcity", "Arena Sihlcity", "zh", "Kalanderplatz 1, Zürich", "https://www.arena.ch/de/sihlcity/programm", [47.3587, 8.5235]);
C("riffraff", "Riffraff", "zh", "Neugasse 57, Zürich", "https://www.riffraff-houdini.ch/de-ch/programm.html", [47.3828, 8.5293]);
C("houdini", "Houdini", "zh", "Badenerstrasse 173, Zürich", "https://www.riffraff-houdini.ch/de-ch/programm.html", [47.3746, 8.5203]);
const links = [
  { n: "Cinélux", c: "ge", u: "https://www.cinelux.ch/" },
  { n: "Cinéma Bio (Carouge)", c: "ge", u: "https://www.cinema-bio.ch/programme" },
  { n: "blue Cinema Abaton", c: "zh", u: "https://www.bluecinema.ch/en/cinemas/abaton-zuerich" },
  { n: "blue Cinema Corso", c: "zh", u: "https://www.bluecinema.ch/en/cinemas/corso-zuerich" },
  { n: "blue Cinema Capitol", c: "zh", u: "https://www.bluecinema.ch/en/cinemas/capitol-zuerich" },
  { n: "Arthouse (Le Paris, Movie, Piccadilly, Uto)", c: "zh", u: "https://www.arthouse.ch/" },
  { n: "Kosmos", c: "zh", u: "https://www.kosmos.ch/" },
  { n: "Xenix", c: "zh", u: "https://www.xenix.ch/" },
];

/* add one screening; lang: "en" = original English, "sub" = other original with English subtitles */
const LANG = {}; /* norm title -> "en" | "other": what a source says about the original language */
const know = (t, l) => { const k = norm(t); if (k && l && !LANG[k]) LANG[k] = l; };
function add(f, cin, day, time, lang, book, country) {
  if (!lang || !DAYS.includes(day) || !/^\d\d:\d\d$/.test(time)) return;
  const key = norm(f.t); if (!key) return;
  let F = films.get(key);
  if (!F) { F = { t: f.t, k: "", m: 0, d: "", de: "", shows: [] }; films.set(key, F); }
  if (!F.k && f.k) F.k = f.k; if (!F.m && f.m) F.m = f.m;
  if (f.dEn && !F.d) F.d = f.dEn; if (f.d && !F.de) F.de = f.d;
  if (f.y && !F.y) F.y = f.y;
  if (!F.shows.some(s => s[0] === cin && s[1] === day && s[2] === time)) F.shows.push([cin, day, time, lang, book || cinemas[cin].u, country || ""]);
  report[cin] = (report[cin] || 0) + 1;
}

/* ---- Pathé Balexert (JSON API) ---- */
async function pathe() {
  const cin = "pathe-balexert", base = "https://www.pathe.ch/api";
  const b = await get(`${base}/cinema/cinema-pathe-balexert/shows?language=en`, true); if (!b || !b.shows) { report[cin + "!"] = "no data"; return; }
  for (const [slug, s] of Object.entries(b.shows)) {
    const want = Object.entries(s.days || {}).filter(([d]) => DAYS.includes(d)).map(([d, x]) => [d, x]).filter(([, x]) => {
      const en = (x.tags || []).includes("Anglais"); return (x.versions || []).some(v => /(^|-)en$|sub-(?:.*-)?en/.test(v) || (en && /^sub/.test(v)) || (en && v === "en"));
    });
    if (!want.length) continue;
    const info = await get(`${base}/show/${slug}?language=en`, true); if (!info || info.isMovie === false) continue;
    const f = { t: info.title, k: (info.genres || [])[0] || "", m: info.duration || 0, dEn: info.synopsis || "" };
    for (const [d, x] of want) {
      const en = (x.tags || []).includes("Anglais"); if (en) know(f.t, "en");
      const st = await get(`${base}/show/${slug}/showtimes/cinema-pathe-balexert/${d}?language=en`, true) || [];
      for (const s2 of st) {
        const v = s2.version || ""; const lang = /sub-(?:.*-)?en|(^|-)en$/.test(v) && !en ? "sub" : en && (/^sub/.test(v) || v === "en") ? "en" : /sub-(?:.*-)?en/.test(v) ? "sub" : null;
        add(f, cin, s2.time.slice(0, 10), s2.time.slice(11, 16), lang, s2.refCmd);
      }
    }
  }
}

/* ---- Les Scala / Le City / Le Nord-Sud (one page per day) ---- */
const SCALA = { "les scala": "scala", "le city": "city", "le nord-sud": "nord-sud", "le nord sud": "nord-sud" };
async function scala() {
  for (const d of DAYS) {
    const h = await get(`https://les-scala.ch/fr/a-l-affiche?dDate=${d}`); if (!h) continue;
    for (const blk of h.split('<div class="container_liste"').slice(1)) {
      const t = txt((blk.match(/<h2><a[^>]*>([\s\S]*?)<\/a><\/h2>/) || [])[1]); if (!t) continue;
      const du = txt((blk.match(/film_duree">([^<]*)/) || [])[1]).split("/").map(x => x.trim());
      const country = (du[2] || "").split(",")[0].trim();
      const hm = (du[1] || "").match(/(\d)h(\d\d)/); const f = { t, k: genreEn(du[0]), m: hm ? +hm[1] * 60 + +hm[2] : 0 };
      for (const cb of blk.split('class="tab_liste_film_titre"').slice(1)) {
        const cn = txt((cb.match(/class="liste_cinema_titre"[^>]*>([^<]*)/) || [])[1]).toLowerCase(); const cin = SCALA[cn]; if (!cin) continue;
        const part = (cb.split('class="tab_liste_film_date">')[1] || "").split("</div>")[0];
        let ver = "", subs = "";
        for (const m of part.matchAll(/bullet_version">([^<]*)<|alt="\s*Sous-titres\s*:\s*([^"]*)"|href="([^"]*ticketack[^"]*\/(\d{12})\d*)"[^>]*>(\d{1,2})h(\d\d)/g)) {
          if (m[1] != null) { ver = m[1].trim(); subs = ""; }
          else if (m[2] != null) subs = m[2];
          else {
            const enSub = /\bEN\b/.test(subs);
            const lang = enSub ? "sub" : ver === "VO" ? "vo?" : null;
            const day = m[4].slice(0, 4) + "-" + m[4].slice(4, 6) + "-" + m[4].slice(6, 8);
            add(f, cin, day, pad(m[5]) + ":" + m[6], lang, m[3], country);
          }
        }
      }
    }
  }
}

/* ---- Cinémas du Grütli (programme + film pages for languages) ---- */
async function grutli() {
  const h = await get("https://www.cinemas-du-grutli.ch/programme"); if (!h) { report["grutli!"] = "no data"; return; }
  const meta = {};
  for (const w of h.split('class="views-rows-wrapper"').slice(1)) {
    const link = (w.match(/href="(https:\/\/www\.cinemas-du-grutli\.ch\/films\/[^"]+)"/) || [])[1]; if (!link) continue;
    const t = txt((w.match(/<h3 class="font1">([\s\S]*?)<\/h3>/) || [])[1]); if (!t) continue;
    if (!meta[link]) {
      const p = await get(link) || ""; const pt = txt(p.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ""));
      const fld = k => ((pt.match(new RegExp(k + "\\s+(.{1,80}?)\\s+(?:Version|Sous-titres|Support|Pays|Année|Genre|Durée|Scénario|Langue du film)\\b")) || [])[1] || "").trim();
      const syn = ((p.match(/Synopsis[\s\S]*?<p>([\s\S]*?)<\/p>\s*<p>([\s\S]*?)<\/p>/) || []).slice(1).map(txt).filter(x => !/séance spéciale/i.test(x)).join(" ")).slice(0, 400);
      meta[link] = { lang: fld("Langue du film"), ver: fld("Version"), subs: fld("Sous-titres"), k: genreEn(fld("Genre")), m: +(fld("Durée").match(/\d+/) || [0])[0], d: syn };
    }
    const M = meta[link];
    if (M.lang) know(t, /^anglais/i.test(M.lang) ? "en" : "other");
    const lang = /anglais/i.test(M.subs) ? "sub" : /^anglais/i.test(M.lang) && /^vo/i.test(M.ver) ? "en" : null;
    for (const s of w.matchAll(/href="([^"]*)"[^>]*>\s*<span class="date-display-single"[^>]*content="(\d{4}-\d\d-\d\d)T(\d\d:\d\d)/g)) add({ t, k: M.k, m: M.m, d: M.d }, "grutli", s[2], s[3], lang, s[1]);
  }
}

/* ---- Arena Sihlcity (one page per day) ---- */
async function arena() {
  for (const d of DAYS) {
    const h = await get(`https://www.arena.ch/de/sihlcity/programm/tickets-kaufen?StartDate=${d.replace(/-/g, "")}`); if (!h) continue;
    for (const blk of h.split('class="movie-block movie-day"').slice(1)) {
      const tm = blk.match(/class="movie-title"><a href="([^"]*)">([\s\S]*?)<\/a>/); if (!tm) continue;
      const ot = txt((blk.match(/Originaltitel:\s*<i>([\s\S]*?)<\/i>/) || [])[1]);
      const info = txt((blk.match(/class="movie-info">([\s\S]*?)<\/p>/) || [])[1]);
      const f = { t: ot || txt(tm[2]), k: genreEn((info.match(/\|\s*([A-Za-zÄÖÜäöü\- ,]+?)\s*\|/) || [])[1] || ""), m: +(info.match(/(\d+)\s*Min/) || [0, 0])[1], d: txt((blk.match(/class="movie-oneline">([\s\S]*?)<\/p>/) || [])[1]) };
      for (const sc of blk.split('class="schedule-container"').slice(1)) {
        const tip = (sc.match(/uk-tooltip="title:\s*([^;"]*)/) || [])[1] || "";
        const lang = /^Englische Version/i.test(tip) ? "en" : /englischen Untertiteln|englische Untertitel/i.test(tip) ? "sub" : null;
        if (/^Englische Version/i.test(tip)) know(f.t, "en"); else if (/^\w+ Version mit/i.test(tip) && !/^Deutsche|^Französische/i.test(tip)) know(f.t, "other");
        for (const t of sc.matchAll(/uk-text-large">(\d\d:\d\d)</g)) add(f, "arena-sihlcity", d, t[1], lang, tm[1]);
      }
    }
  }
}

/* ---- Riffraff / Houdini (film pages carry schema.org ScreeningEvents) ---- */
async function riffraff() {
  const h = await get("https://www.riffraff-houdini.ch/de-ch/programm.html"); if (!h) { report["riffraff!"] = "no data"; return; }
  const pages = [...new Set([...h.matchAll(/href="(\/de-ch\/film\/[^"#?]+\.html)"/g)].map(m => m[1]))];
  for (const p of pages) {
    const x = await get("https://www.riffraff-houdini.ch" + p); if (!x) continue;
    const lds = [...x.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean);
    const mv = lds.find(j => j["@type"] === "Movie"); if (!mv) continue;
    const dur = String(mv.duration || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?/) || [];
    const country = String((mv.countryOfOrigin || [])[0] || "");
    const f = { t: ent(mv.name), k: genreEn((mv.genre || [])[0]), m: (+dur[1] || 0) * 60 + (+dur[2] || 0), d: ent(mv.description || "") };
    for (const s of lds.filter(j => j["@type"] === "ScreeningEvent")) {
      const subs = [].concat(s.subtitleLanguage || []), il = String(s.inLanguage || "").toLowerCase();
      if (il === "en") know(f.t, "en"); else if (il === "ov" && subs.includes("en")) know(f.t, "other");
      const lang = il === "en" ? "en" : subs.includes("en") ? "sub" : il === "ov" ? "vo?" : null;
      const loc = String((s.location || {}).name || ""); const cin = /houdini/i.test(loc) ? "houdini" : "riffraff";
      const sd = String(s.startDate || ""); add(f, cin, sd.slice(0, 10), sd.slice(11, 16), lang, s.url || s.offers?.url, country);
    }
  }
}

/* ---- English descriptions: translate German/French ones (free MyMemory, cached) ---- */
let TR = {}; try { TR = JSON.parse(fs.readFileSync(new URL("data/cine-tr.json", root), "utf8")); } catch {}
async function toEn(t, lang) {
  t = String(t || "").trim().slice(0, 450); if (!t) return ""; const key = lang + ":" + t; if (key in TR) return TR[key];
  const j = await get(`https://api.mymemory.translated.net/get?langpair=${lang}|en&de=bot%40users.noreply.github.com&q=${encodeURIComponent(t)}`, true);
  const out = j && j.responseStatus == 200 && j.responseData && j.responseData.translatedText; if (out && !/MYMEMORY WARNING|QUERY LENGTH/i.test(out)) { TR[key] = ent(out); return TR[key]; }
  return "";
}

export async function run(write = true) {
  for (const [n, fn] of Object.entries({ pathe, scala, grutli, arena, riffraff })) { try { await fn(); } catch (e) { report[n + "!"] = String(e).slice(0, 120); } }
  const out = [];
  for (const F of films.values()) {
    const L = LANG[norm(F.t)];
    F.shows = F.shows.map(x => x[3] !== "vo?" ? x : (L === "en" || (!L && EN_COUNTRY.test(x[5]))) ? [x[0], x[1], x[2], "en", x[4]] : null).filter(Boolean).map(x => x.slice(0, 5));
    if (!F.shows.length) continue;
    F.shows.sort((a, b) => (a[1] + a[2]).localeCompare(b[1] + b[2]));
    let d = F.d; if (!d && F.de) d = await toEn(F.de, /[äöüß]|\b(der|die|und|das|ein)\b/i.test(F.de) ? "de" : "fr");
    out.push({ id: norm(F.t).replace(/ /g, "-").slice(0, 40), t: F.t, k: F.k, m: F.m, d: (d || "").slice(0, 400), shows: F.shows });
  }
  out.sort((a, b) => b.shows.length - a.shows.length);
  const CINE = { at: new Date().toISOString(), days: DAYS, cinemas, links, films: out, report };
  if (write) {
    fs.writeFileSync(new URL("cine.js", root), "window.CINE=" + JSON.stringify(CINE) + ";\n");
    fs.mkdirSync(new URL("data/", root), { recursive: true });
    fs.writeFileSync(new URL("data/cine-tr.json", root), JSON.stringify(TR));
  }
  console.log("films", out.length, JSON.stringify(report));
  return CINE;
}
if (process.argv[1] && process.argv[1].endsWith("cinema.mjs")) await run();
