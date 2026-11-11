/* Throwaway probe. The question is NOT "is there JSON-LD" but "is the event text present in the
   HTML the server sends". So: strip the tags and look at the words. Delete before merging. */
const M = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "accept-language": "en,de;q=0.8" };
const D = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "accept-language": "de-CH,de;q=0.9,en;q=0.8", "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", "accept-encoding": "gzip, deflate, br", "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"', "sec-fetch-dest": "document", "sec-fetch-mode": "navigate", "sec-fetch-site": "none", "upgrade-insecure-requests": "1" };
const get = async (u, h = D) => { try { const r = await fetch(u, { headers: h, redirect: "follow" }); return { s: r.status, u: r.url, t: await r.text() }; } catch (e) { return { s: 0, u, t: "", e: String(e).slice(0, 120) }; } };

/* visible text only */
function text(h) {
  return h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
const title = h => (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
/* does the visible text look like a list of dated events? */
function dateHits(t) {
  const pats = [[/\d{1,2}\.\d{1,2}\.\d{2,4}/g, "DD.MM.YYYY"], [/\b\d{1,2}:\d{2}\b/g, "HH:MM"],
  [/\b(Mo|Di|Mi|Do|Fr|Sa|So|Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? ?\d{1,2}\b/g, "weekday+day"],
  [/\b\d{1,2}\.? ?(Jan|Feb|Mär|Mar|Apr|Mai|May|Jun|Jul|Aug|Sep|Okt|Oct|Nov|Dez|Dec)/g, "day+month"]];
  return pats.map(([re, n]) => n + ":" + (t.match(re) || []).length).join("  ");
}

console.log("##################### MEETUP: do these groups exist?");
for (const g of ["les-amis-zurich", "internations-zurich", "zurich-social-club",
  "zurich-language-exchange", "zurich-expats", "zurich-hiking",
  "geneva-social-club" /* control: this one WORKS */]) {
  const r = await get("https://www.meetup.com/" + g + "/events/");
  const t = text(r.t);
  console.log("\n--", g, "| status", r.s, "| bytes", r.t.length);
  console.log("   <title>:", title(r.t).trim().slice(0, 110));
  console.log("   text[0:260]:", t.slice(0, 260));
  console.log("   Event schema:", /"@type"\s*:\s*"Event"/.test(r.t), "| dates:", dateHits(t));
}

console.log("\n\n##################### SITES: is the event text server-rendered?");
for (const u of [
  "https://zuri.net/de/zurich/agenda/13-11-2026",
  "https://www.zuerichunbezahlbar.ch/events/",
  "https://www.tonhalle-orchester.ch/en/concerts/kalender/",
  "https://newinzurich.com/events/",
  "https://www.guidle.com/de/veranstaltungen/zuerich",
  "https://infomaniak.events/en-ch/comedy/zurich",
]) {
  const r = await get(u);
  const t = text(r.t);
  console.log("\n============================================================");
  console.log(u, "->", r.s, "| html", r.t.length, "| visible text", t.length);
  console.log("  <title>:", title(r.t).trim().slice(0, 100));
  console.log("  dates in visible text:", dateHits(t));
  console.log("  TEXT 500-1900:", t.slice(500, 1900));
}
console.log("\n=== probe done ===");
