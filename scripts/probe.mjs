/* Throwaway probe: raw markup for the two sites that DO server-render. Delete before merging. */
const D = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "accept-language": "de-CH,de;q=0.9,en;q=0.8", "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };
const get = async (u) => { try { const r = await fetch(u, { headers: D, redirect: "follow" }); return { s: r.status, u: r.url, t: await r.text() }; } catch (e) { return { s: 0, u, t: "", e: String(e).slice(0, 120) }; } };

console.log("########## ZUERICHUNBEZAHLBAR — raw markup of the list");
{
  const r = await get("https://www.zuerichunbezahlbar.ch/events/");
  console.log("status", r.s, r.t.length);
  const i = r.t.indexOf("Sprachcaf");
  const j = i > 0 ? i : r.t.search(/Mittwoch|Donnerstag/);
  console.log(r.t.slice(Math.max(0, j - 2400), j + 900).replace(/\n\s*/g, "\n").slice(0, 3600));
}

console.log("\n\n########## ZURI.NET — raw markup of one agenda entry");
{
  const r = await get("https://zuri.net/de/zurich/agenda/13-11-2026");
  console.log("status", r.s, r.t.length);
  const j = r.t.indexOf("B.ARBIE");
  console.log(r.t.slice(Math.max(0, j - 3000), j + 1200).replace(/\n\s*/g, "\n").slice(0, 4200));
}

console.log("\n\n########## NEWINZURICH — retry (was 502)");
for (let i = 0; i < 3; i++) {
  const r = await get("https://newinzurich.com/events/");
  console.log(" attempt", i + 1, "->", r.s, r.t.length);
  if (r.s === 200 && r.t.length > 5000) {
    const t = r.t.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    console.log("   times:", (t.match(/\b\d{1,2}:\d{2}\b/g) || []).length,
      "| day+month:", (t.match(/\b\d{1,2}\.? ?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/gi) || []).length);
    console.log("   text:", t.slice(600, 2000));
    break;
  }
  await new Promise(r2 => setTimeout(r2, 4000));
}
console.log("\n=== probe done ===");
