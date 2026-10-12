/* one-off check: can the free nightly collector read cinema programmes? Writes data/probe-cinema.json */
import fs from "node:fs";
const UA = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "accept-language": "en,fr;q=0.8,de;q=0.7" };
const urls = [
  "https://www.cineman.ch/fr/horaires/geneve/",
  "https://www.cineman.ch/en/showtimes/geneva/",
  "https://www.cineman.ch/de/kinoprogramm/zuerich/",
  "https://www.pathe.ch/api/cinema/cinema-pathe-balexert/shows?language=fr",
  "https://www.pathe.ch/api/show/naza-55507/showtimes/cinema-pathe-balexert?language=fr",
  "https://www.cinemas-du-grutli.ch/",
  "https://www.cinelux.ch/",
  "https://www.les-scala.ch/",
  "https://www.riffraff.ch/",
  "https://www.xenix.ch/",
  "https://www.arthouse.ch/",
  "https://kitag.com/de/programm",
  "https://www.kinokultur.ch/",
];
const out = {};
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: UA, redirect: "follow" }); const t = await r.text();
    out[u] = { status: r.status, bytes: t.length, naza: (t.match(/naza/gi) || []).length, ld: (t.match(/application\/ld\+json/g) || []).length, langs: [...new Set((t.match(/\b(?:VO\/[a-z\/]+|E\/[a-z\/]+|E\/d\/f|Ov\/d|OV)\b/g) || []))].slice(0, 15), sample: t.replace(/\s+/g, " ").match(/.{0,400}Naza.{0,600}/i)?.[0] || t.replace(/\s+/g, " ").slice(0, 600) };
  } catch (e) { out[u] = { error: String(e) }; }
}
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/probe-cinema.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [v.status, v.bytes, v.naza]]))));

// v2
