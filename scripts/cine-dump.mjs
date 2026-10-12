/* temporary: dump cinema programme pages so their structure can be inspected */
import fs from "node:fs";
const UA = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "accept-language": "en,fr;q=0.8,de;q=0.7", accept: "text/html,application/json;q=0.9,*/*;q=0.8" };
const P = {
  pathe_st1: "https://www.pathe.ch/api/show/the-invite-52031/showtimes/cinema-pathe-balexert/2026-10-13?language=en",
  pathe_st2: "https://www.pathe.ch/api/show/the-invite-52031/showtimes?language=en",
  pathe_st3: "https://www.pathe.ch/api/cinema/cinema-pathe-balexert/showtimes/2026-10-13?language=en",
  rr_js: "https://www.riffraff-houdini.ch/includes/public.js?id=1071",
  rr_film: "https://www.riffraff-houdini.ch/de-ch/film/naza.html",
  blue_abaton: "https://www.bluecinema.ch/en/cinemas/abaton-zuerich",
  cineman_ge: "https://www.cineman.ch/en/showtimes/geneva/",
  cineman_film: "https://www.cineman.ch/en/movie/2026/Naza/",
  arena_prog: "https://www.arena.ch/de/sihlcity/programm",
  cinelux_prog: "https://www.cinelux.ch/programme/",
  bio_prog: "https://www.cinema-bio.ch/programme",
  grutli_film: "https://www.cinemas-du-grutli.ch/films/56991-naza",
  scala_d: "https://les-scala.ch/fr/a-l-affiche?dDate=2026-10-14",
};
fs.mkdirSync("data/cine-raw", { recursive: true });
for (const [k, u] of Object.entries(P)) {
  try { const r = await fetch(u, { headers: UA, redirect: "follow" }); const t = await r.text(); fs.writeFileSync(`data/cine-raw/${k}.txt`, `${r.status} ${r.url}\n` + t.slice(0, 2500000)); console.log(k, r.status, t.length); }
  catch (e) { fs.writeFileSync(`data/cine-raw/${k}.txt`, "ERR " + e); console.log(k, "ERR"); }
}

// round 2
