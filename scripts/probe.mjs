/* Throwaway structure probe, round 3. Delete before merging. */
const M = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "accept-language": "en,de;q=0.8,fr;q=0.7" };
const D = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "accept-language": "de-CH,de;q=0.9,en;q=0.8", "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };
const get = async (u, h = M) => { try { const r = await fetch(u, { headers: h, redirect: "follow" }); return { s: r.status, u: r.url, t: await r.text() }; } catch (e) { return { s: 0, u, t: "", e: String(e).slice(0, 110) }; } };
const W = (b, re, n, pad = 460) => { const o = []; for (const m of b.matchAll(re)) { o.push(b.slice(Math.max(0, m.index - pad), m.index + pad).replace(/\s+/g, " ")); if (o.length >= n) break; } return o; };

console.log("\n########## FILMPODIUM — per-screening language notation");
{
  const r = await get("https://www.filmpodium.ch/programm-nach-datum");
  console.log("status", r.s, "bytes", r.t.length);
  const hrefs = [...new Set([...r.t.matchAll(/href="(\/[^"#?]*)"/g)].map(m => m[1]))]
    .filter(h => !/\.(css|js|png|jpg|svg|ico)$/i.test(h) && h.length > 4);
  console.log("HREFS:", hrefs.slice(0, 30).join(" "));
  // one whole film block, to see what sits next to the title and time
  const blocks = r.t.split(/class="big-feature-film\b/).slice(1, 3);
  blocks.forEach((b, i) => console.log("\n--- block " + i + " ---\n" + b.slice(0, 2200).replace(/\s+/g, " ")));
}

console.log("\n\n########## FILMPODIUM — a film detail page");
{
  const r = await get("https://www.filmpodium.ch/programm-a-bis-z");
  const hrefs = [...new Set([...r.t.matchAll(/href="(\/[a-z0-9\-\/]*film[^"#?]*)"/gi)].map(m => m[1]))];
  console.log("a-z film hrefs:", hrefs.slice(0, 10).join(" "));
  if (hrefs[0]) {
    const f = await get("https://www.filmpodium.ch" + hrefs[0]);
    console.log("detail", hrefs[0], f.s, f.t.length);
    ["E\\/d", "e\\/d", "Untertitel", "Originalversion", "Dauer", "Min\\.", "Sprache"].forEach(k => {
      const w = W(f.t, new RegExp(k, "g"), 1, 300);
      if (w.length) console.log("  [" + k + "] " + w[0].slice(0, 560));
    });
  }
}

console.log("\n\n########## ARTHOUSE with a desktop user-agent");
for (const u of ["https://www.arthouse.ch/", "https://www.arthouse.ch/programm"]) {
  const r = await get(u, D);
  console.log("\n", u, "->", r.s, r.t.length, r.e || "");
  if (r.s === 200) {
    console.log("  LD:", (r.t.match(/application\/ld\+json/g) || []).length,
      "| NEXT:", r.t.includes("__NEXT_DATA__"), "| NUXT:", r.t.includes("__NUXT__"));
    const w = W(r.t, /\d\d:\d\d/g, 1, 400); if (w.length) console.log("  TIME:", w[0].slice(0, 620));
  }
}

console.log("\n\n########## XENIX — where does the shell load from?");
{
  const r = await get("https://www.xenix.ch/");
  console.log("body:", r.t.slice(0, 1800).replace(/\s+/g, " "));
  for (const u of ["https://www.xenix.ch/de/programm/", "https://xenix.ch/programm", "https://www.xenix.ch/api/programm"]) {
    const x = await get(u); console.log(" ", u, "->", x.s, x.t.length);
  }
}
console.log("\n=== probe 3 done ===");
