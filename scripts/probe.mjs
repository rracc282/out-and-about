/* Throwaway probe round 2 — the three feeds that look recoverable. Delete before merging. */
const UA = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "accept-language": "en,de;q=0.8" };
const get = async (u) => { try { const r = await fetch(u, { headers: UA, redirect: "follow" }); return { s: r.status, u: r.url, t: await r.text() }; } catch (e) { return { s: 0, u, t: "", e: String(e).slice(0, 110) }; } };
const W = (b, re, n, pad = 420) => { const o = []; for (const m of b.matchAll(re)) { o.push(b.slice(Math.max(0, m.index - pad), m.index + pad).replace(/\s+/g, " ")); if (o.length >= n) break; } return o; };
function ldTypes(body) { const c = {}; for (const m of body.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)) { try { const walk = o => { if (Array.isArray(o)) return o.forEach(walk); if (o && typeof o === "object") { if (o["@type"]) { const t = Array.isArray(o["@type"]) ? o["@type"].join("/") : o["@type"]; c[t] = (c[t] || 0) + 1 } Object.values(o).forEach(walk) } }; walk(JSON.parse(m[1].trim())) } catch { c["(bad)"] = 1 } } return c }

console.log("########## 1. ZURI.NET per-day agenda pages");
for (const d of ["12-11-2026", "14-11-2026"]) {
  const r = await get("https://zuri.net/de/zurich/agenda/" + d);
  console.log("\n", d, "->", r.s, r.t.length, "LD", JSON.stringify(ldTypes(r.t)));
  const times = W(r.t, /\d\d[:.]\d\d/g, 2, 400);
  times.forEach((t, i) => console.log("   TIME" + i, t.slice(0, 620)));
}

console.log("\n\n########## 2. HALLENSTADION event detail pages");
{
  const l = await get("https://hallenstadion.ch/events/");
  const links = [...new Set([...l.t.matchAll(/href="(https:\/\/hallenstadion\.ch\/events\/[a-z0-9-]+\?[^"]*)"/g)].map(m => m[1]))];
  console.log("detail links found:", links.length);
  for (const u of links.slice(0, 2)) {
    const d = await get(u);
    console.log("\n ", u.slice(0, 90), "->", d.s, d.t.length);
    console.log("   LD", JSON.stringify(ldTypes(d.t)));
    console.log("   MARKS", ["__NEXT_DATA__", "wp-json", "data-event", "datetime", "itemprop"].filter(k => d.t.includes(k)).join(" ") || "(none)");
    const w = W(d.t, /datetime="|itemprop="startDate"|\d{1,2}\.\d{1,2}\.\d{4}/g, 1, 340);
    if (w.length) console.log("   WHEN:", w[0].slice(0, 560));
  }
  // the listing itself: how are cards marked up?
  const w = W(l.t, /data-event/g, 1, 700);
  if (w.length) console.log("\n  LISTING CARD:", w[0].slice(0, 900));
}

console.log("\n\n########## 3. INFOMANIAK embedded JSON");
{
  const r = await get("https://infomaniak.events/en-ch/comedy/zurich");
  console.log("status", r.s, "bytes", r.t.length);
  for (const m of r.t.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]{0,400})/g)) {
    console.log("  json script:", m[1].slice(0, 320).replace(/\s+/g, " "));
  }
  ["__NUXT__", "window.__", "data-page", "nuxt-data", "\"events\"", "\"startDate\""].forEach(k => {
    const w = W(r.t, new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), 1, 380);
    if (w.length) console.log("  [" + k + "] " + w[0].slice(0, 620));
  });
}
console.log("\n=== probe 2 done ===");
