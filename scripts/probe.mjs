/* Throwaway probe: why do these Zurich feeds return 200 but yield no events?
   Delete this file and .github/workflows/probe.yml before merging. */
const UA = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "accept-language": "en,de;q=0.8,fr;q=0.7" };
const get = async (u, h = UA) => { try { const r = await fetch(u, { headers: h, redirect: "follow" }); return { s: r.status, u: r.url, t: await r.text() }; } catch (e) { return { s: 0, u, t: "", e: String(e).slice(0, 110) }; } };

const DEAD = [
  "https://zuri.net/de/zurich/agenda/",
  "https://newinzurich.com/events/",
  "https://www.zuerichunbezahlbar.ch/",
  "https://hallenstadion.ch/events/",
  "https://www.guidle.com/de/veranstaltungen/zuerich",
  "https://www.tonhalle-orchester.ch/en/concerts/kalender/",
  "https://infomaniak.events/en-ch/comedy/zurich",
];
const MEETUPS = ["les-amis-zurich", "internations-zurich", "zurich-social-club",
  "zurich-language-exchange", "zurich-expats", "zurich-hiking"];

function ldTypes(body) {
  const c = {};
  for (const m of body.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const walk = o => {
        if (Array.isArray(o)) return o.forEach(walk);
        if (o && typeof o === "object") {
          if (o["@type"]) { const t = Array.isArray(o["@type"]) ? o["@type"].join("/") : o["@type"]; c[t] = (c[t] || 0) + 1; }
          Object.values(o).forEach(walk);
        }
      };
      walk(JSON.parse(m[1].trim()));
    } catch { c["(unparseable)"] = (c["(unparseable)"] || 0) + 1; }
  }
  return c;
}

console.log("########## ZERO-YIELD FEEDS");
for (const u of DEAD) {
  const r = await get(u);
  console.log("\n==============================================");
  console.log("URL  ", u, "\nFINAL", r.u, "| status", r.s, "| bytes", r.t.length, r.e || "");
  if (!r.t) continue;
  console.log("LD   ", JSON.stringify(ldTypes(r.t)));
  const marks = ["__NEXT_DATA__", "__NUXT__", "wp-json", "tribe_events", "/events/feed", ".ics",
    "application/json", "data-event", "eventDate", "fullcalendar", "vue", "react", "turbo-frame"]
    .filter(k => r.t.includes(k));
  console.log("MARKS", marks.join(" ") || "(none)");
  // candidate JSON endpoints referenced by the page
  const eps = [...new Set([...r.t.matchAll(/["'](https?:\/\/[^"']*?(?:wp-json|\/api\/|\.ics|\.json)[^"']{0,90})["']/g)].map(m => m[1]))];
  console.log("ENDPOINTS", eps.slice(0, 8).join("\n          ") || "(none)");
  // does an event-detail link even exist?
  const host = new URL(r.u).hostname;
  const links = [...new Set([...r.t.matchAll(/href=["']([^"'#]+)["']/g)].map(m => { try { return new URL(m[1], r.u).href } catch { return "" } })
    .filter(h => h && new URL(h).hostname === host && /event|veranstalt|agenda|konzert|show|programm/i.test(h)))];
  console.log("EVENT LINKS", links.length, links.slice(0, 5).join("\n            "));
  if (links[0]) {
    const d = await get(links[0]);
    console.log("  detail:", links[0].slice(0, 80), "->", d.s, d.t.length, "LD", JSON.stringify(ldTypes(d.t)));
  }
}

console.log("\n\n########## MEETUP GROUPS RETURNING 0 — do they still exist?");
for (const g of MEETUPS) {
  const r = await get("https://www.meetup.com/" + g + "/events/");
  const hasEvent = /"Event"|"@type"\s*:\s*"Event"/.test(r.t);
  const upcoming = (r.t.match(/No upcoming events|Keine bevorstehenden/i) || [])[0] || "";
  console.log(" ", g.padEnd(26), "status", r.s, "| bytes", String(r.t.length).padStart(7),
    "| Event schema:", hasEvent, "|", upcoming || "");
}

/* Try WordPress "The Events Calendar" REST, the usual culprit for a WP events page that
   renders fine but exposes nothing a generic scraper recognises. */
console.log("\n\n########## WORDPRESS EVENT APIS");
for (const b of ["https://newinzurich.com", "https://kaufleuten.ch"]) {
  for (const p of ["/wp-json/tribe/events/v1/events", "/wp-json/wp/v2/tribe_events", "/events/feed/", "/wp-json"]) {
    const r = await get(b + p);
    let n = "";
    try { const j = JSON.parse(r.t); n = Array.isArray(j.events) ? "events:" + j.events.length : Array.isArray(j) ? "array:" + j.length : "keys:" + Object.keys(j).slice(0, 6).join(","); } catch { n = r.t.slice(0, 60).replace(/\s+/g, " "); }
    console.log(" ", (b + p).padEnd(58), r.s, String(r.t.length).padStart(7), n.slice(0, 70));
  }
}
console.log("\n=== probe done ===");
