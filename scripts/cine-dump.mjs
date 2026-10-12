/* temporary: dump cinema programme pages so their structure can be inspected */
import fs from "node:fs";
const UA = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "accept-language": "en,fr;q=0.8,de;q=0.7", accept: "text/html,application/json;q=0.9,*/*;q=0.8" };
const P = {
  pathe_cinemas: "https://www.pathe.ch/api/cinemas?language=en",
  pathe_balexert: "https://www.pathe.ch/api/cinema/cinema-pathe-balexert/shows?language=en",
  pathe_shows: "https://www.pathe.ch/api/shows?language=en",
  pathe_naza: "https://www.pathe.ch/api/show/naza-55507?language=en",
  pathe_naza_st: "https://www.pathe.ch/api/show/naza-55507/showtimes/cinema-pathe-balexert/2026-10-13?language=en",
  scala: "https://les-scala.ch/fr/a-l-affiche",
  grutli: "https://www.cinemas-du-grutli.ch/",
  grutli_prog: "https://www.cinemas-du-grutli.ch/programme",
  cinelux: "https://www.cinelux.ch/",
  bio: "https://www.cinema-bio.ch/",
  kitag: "https://kitag.com/de/programm",
  riffraff: "https://www.riffraff.ch/",
  riffraff_prog: "https://www.riffraff.ch/de-ch/programm.html",
  houdini: "https://www.houdini-kino.ch/",
  kosmos: "https://www.kosmos.ch/kino",
  xenix: "https://www.xenix.ch/programm",
  arena: "https://www.arena.ch/de",
};
fs.mkdirSync("data/cine-raw", { recursive: true });
for (const [k, u] of Object.entries(P)) {
  try { const r = await fetch(u, { headers: UA, redirect: "follow" }); const t = await r.text(); fs.writeFileSync(`data/cine-raw/${k}.txt`, `${r.status} ${r.url}\n` + t.slice(0, 2500000)); console.log(k, r.status, t.length); }
  catch (e) { fs.writeFileSync(`data/cine-raw/${k}.txt`, "ERR " + e); console.log(k, "ERR"); }
}
