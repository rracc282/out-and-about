/* Throwaway structure probe, round 2. Delete before merging. */
const UA = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "accept-language": "en,de;q=0.8,fr;q=0.7" };
const get = async u => { try { const r = await fetch(u, { headers: UA, redirect: "follow" }); return { s: r.status, u: r.url, t: await r.text() }; } catch (e) { return { s: 0, u, t: "", e: String(e).slice(0, 120) }; } };
const W = (b, re, n, pad = 500) => { const o = []; for (const m of b.matchAll(re)) { o.push(b.slice(Math.max(0, m.index - pad), m.index + pad).replace(/\s+/g, " ")); if (o.length >= n) break; } return o; };

console.log("\n\n########## BLUE CINEMA — what api endpoints does the page reference?");
{
  const r = await get("https://www.bluecinema.ch/en/cinemas/abaton-zuerich");
  console.log("status", r.s, "bytes", r.t.length);
  const apis = [...new Set([...r.t.matchAll(/["'](\/?(?:api|graphql)[^"'\\\s]{0,120})["']/g)].map(m => m[1]))];
  console.log("API-ISH:", apis.slice(0, 30).join("\n  "));
  const hosts = [...new Set([...r.t.matchAll(/https?:\/\/([a-z0-9.-]+\.(?:ch|com|io|net))/g)].map(m => m[1]))];
  console.log("HOSTS:", hosts.slice(0, 25).join(" "));
  // the RSC payload: find the showtime/performance shape
  for (const k of ["performance", "showtime", "startTime", "startsAt", "sessions", "schedule", "auditorium", "versionTitle", "language"]) {
    const w = W(r.t, new RegExp('\\\\?"' + k + '\\\\?"', "g"), 1, 420);
    if (w.length) console.log("\n-- key " + k + ":\n   " + w[0].slice(0, 820));
  }
}

console.log("\n\n########## FILMPODIUM — day listing and language notation");
{
  const r = await get("https://www.filmpodium.ch/programm-nach-datum");
  console.log("status", r.s, "bytes", r.t.length);
  const ics = [...r.t.matchAll(/GetICSFile\?title=([^"&]+)&amp;StartTime=([^"&]+)/g)].slice(0, 14);
  console.log("ICS entries:", ics.length);
  ics.forEach(m => console.log("   ", decodeURIComponent(m[1]), "|", decodeURIComponent(m[2])));
  for (const k of ["E/d", "e/d", "Ov/", "OV/", "Untertitel", "Sprache", "film-info-version", "sprach"]) {
    const w = W(r.t, new RegExp(k.replace(/\//g, "\\/"), "g"), 1, 380);
    if (w.length) console.log("\n-- " + k + ":\n   " + w[0].slice(0, 700));
  }
  const links = [...new Set([...r.t.matchAll(/href="(\/film\/[^"#?]+)"/g)].map(m => m[1]))].slice(0, 6);
  console.log("\nfilm links:", links.join(" "));
  if (links[0]) {
    const f = await get("https://www.filmpodium.ch" + links[0]);
    console.log("\n-- film page", links[0], "status", f.s, "bytes", f.t.length);
    for (const k of ["E\\/d", "Untertitel", "Dauer", "Min", "\\d\\d:\\d\\d"]) {
      const w = W(f.t, new RegExp(k, "g"), 1, 380);
      if (w.length) console.log("   [" + k + "] " + w[0].slice(0, 640));
    }
  }
}

console.log("\n\n########## KOSMOS / XENIX / ARTHOUSE — where are the real showtimes?");
for (const u of ["https://kosmos.ch/wp-json/wp/v2/types",
                 "https://kosmos.ch/kinoprogramm/",
                 "https://www.xenix.ch/programm",
                 "https://www.xenix.ch/de/programm",
                 "https://www.arthouse.ch/de/programm",
                 "https://www.arthouse.ch/kinoprogramm"]) {
  const r = await get(u);
  console.log("\n", u, "->", r.s, r.t.length, (r.e || ""));
  if (r.s === 200 && r.t.length > 2000) {
    const t = W(r.t, /\d\d:\d\d/g, 1, 350);
    if (t.length) console.log("    TIME:", t[0].slice(0, 560));
  }
}
console.log("\n=== probe 2 done ===");
