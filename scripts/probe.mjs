/* Throwaway probe: zuerichunbezahlbar detail pages + real Meetup groups by size. Delete before merging. */
const D = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "accept-language": "de-CH,de;q=0.9,en;q=0.8", "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };
const get = async (u) => { try { const r = await fetch(u, { headers: D, redirect: "follow" }); return { s: r.status, u: r.url, t: await r.text() }; } catch (e) { return { s: 0, u, t: "", e: String(e).slice(0, 120) }; } };
const text = h => h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

console.log("########## 1. ZUERICHUNBEZAHLBAR: how many events, and is there paging?");
{
  const r = await get("https://www.zuerichunbezahlbar.ch/events/");
  const arts = r.t.split('<article class="poster').length - 1;
  console.log("articles on page 1:", arts, "| bytes", r.t.length);
  console.log("paging hints:", [...new Set([...r.t.matchAll(/href="([^"]*(?:page|seite|\?p=)[^"]*)"/gi)].map(m => m[1].trim()))].slice(0, 8).join(" | ") || "(none)");
  console.log("load-more hints:", ["data-js-load", "infinite", "load-more", "mehr-anzeigen", "hx-get"].filter(k => r.t.includes(k)).join(" ") || "(none)");
  for (const p of ["?page=2", "?seite=2"]) {
    const x = await get("https://www.zuerichunbezahlbar.ch/events/" + p);
    console.log("  ", p, "->", x.s, x.t.length, "articles", x.t.split('<article class="poster').length - 1);
  }
  // a detail page: is there a venue and a cleaner date?
  const href = (r.t.match(/href="\s*(\/events\/[^"]+?)\s*"/) || [])[1];
  console.log("\n  detail page:", href);
  if (href) {
    const d = await get("https://www.zuerichunbezahlbar.ch" + href);
    console.log("  ->", d.s, d.t.length);
    console.log("  LD:", (d.t.match(/application\/ld\+json/g) || []).length);
    console.log("  TEXT:", text(d.t).slice(0, 1000));
    const loc = d.t.match(/class="[^"]*(?:location|venue|ort|adresse)[^"]*"[\s\S]{0,300}/i);
    if (loc) console.log("  LOC MARKUP:", loc[0].replace(/\s+/g, " ").slice(0, 400));
  }
}

console.log("\n\n########## 2. MEETUP: real Zurich groups, biggest first");
for (const u of ["https://www.meetup.com/find/?source=GROUPS&location=ch--Zurich&order=member_count",
                 "https://www.meetup.com/find/?source=GROUPS&location=ch--Zurich"]) {
  const r = await get(u);
  console.log("\n", u.slice(30), "->", r.s, r.t.length);
  const slugs = [...new Set([...r.t.matchAll(/meetup\.com\/([a-z0-9][a-z0-9-]{3,60})\/(?:events|members)?/gi)].map(m => m[1].toLowerCase()))]
    .filter(s => !/^(find|help|home|about|blog|legal|pro|templates|cities|topics|online-events|en-au|en-us|de-de|fr-fr|es-es|it-it|members|login|register|create|meetup|apps|press|api|start)$/.test(s));
  console.log("  group slugs found:", slugs.length);
  console.log("  ", slugs.slice(0, 40).join("\n   "));
  const t = text(r.t);
  const mem = [...t.matchAll(/([A-ZÄÖÜ][^|]{3,60}?)\s+([\d',.]+)\s+members/g)].slice(0, 15);
  if (mem.length) console.log("  with member counts:"), mem.forEach(m => console.log("    ", m[2].padStart(8), m[1].trim().slice(0, 50)));
}
console.log("\n=== probe done ===");
