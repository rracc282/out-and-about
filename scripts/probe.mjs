/* Throwaway structure probe, round 4 — Filmpodium only. Delete before merging. */
const M = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "accept-language": "en,de;q=0.8" };
const get = async (u, h = M) => { try { const r = await fetch(u, { headers: h, redirect: "follow" }); return { s: r.status, u: r.url, t: await r.text() }; } catch (e) { return { s: 0, u, t: "", e: String(e).slice(0, 110) }; } };
const W = (b, re, n, pad = 420) => { const o = []; for (const m of b.matchAll(re)) { o.push(b.slice(Math.max(0, m.index - pad), m.index + pad).replace(/\s+/g, " ")); if (o.length >= n) break; } return o; };

console.log("########## /Calendar");
for (const u of ["https://www.filmpodium.ch/Calendar",
                 "https://www.filmpodium.ch/Calendar?format=ics",
                 "https://www.filmpodium.ch/Home/GetICSFile?title=test&StartTime=11%2F11%2F2026%2015%3A00%3A00&duration=0"]) {
  const r = await get(u);
  console.log("\n", u, "->", r.s, r.t.length);
  console.log("   ", r.t.slice(0, 700).replace(/\s+/g, " "));
}

console.log("\n\n########## one whole day-page film entry, untruncated");
{
  const r = await get("https://www.filmpodium.ch/programm-nach-datum");
  const i = r.t.indexOf("La pianiste") >= 0 ? r.t.indexOf("La pianiste") : r.t.search(/GetICSFile/);
  console.log(r.t.slice(Math.max(0, i - 2600), i + 1400).replace(/\s+/g, " "));
}

console.log("\n\n########## film detail by data-id");
for (const u of ["https://www.filmpodium.ch/film/15033",
                 "https://www.filmpodium.ch/Film/Detail/15033",
                 "https://www.filmpodium.ch/film-detail/15033",
                 "https://www.filmpodium.ch/programm-a-bis-z"]) {
  const r = await get(u);
  console.log("\n", u, "->", r.s, r.t.length);
  if (r.s === 200 && r.t.length > 3000) {
    ["E\\/d", "e\\/d", "/d/f", "Untertitel", "Originalfassung", "Originalversion", "Sprache", "Min\\b"].forEach(k => {
      const w = W(r.t, new RegExp(k, "g"), 1, 280);
      if (w.length) console.log("   [" + k + "] " + w[0].slice(0, 520));
    });
    const hrefs = [...new Set([...r.t.matchAll(/href="(\/[^"#?]{4,})"/g)].map(m => m[1]))];
    console.log("   hrefs:", hrefs.slice(0, 18).join(" "));
  }
}
console.log("\n=== probe 4 done ===");
