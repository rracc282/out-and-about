/* Throwaway structure probe. Runs on GitHub Actions (which can reach these sites) and prints
   enough about each cinema page to write a collector against it. Not part of the app.
   Delete this file and .github/workflows/probe.yml before the batch is merged. */
const UA = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "accept-language": "en,de;q=0.8,fr;q=0.7" };

const URLS = [
  "https://www.arthouse.ch/",
  "https://www.kosmos.ch/",
  "https://www.xenix.ch/",
  "https://www.bluecinema.ch/en/cinemas/abaton-zuerich",
  "https://www.bluecinema.ch/en/cinemas/corso-zuerich",
  "https://www.bluecinema.ch/en/cinemas/capitol-zuerich",
  "https://www.filmpodium.ch/",
  "https://www.frame-kino.ch/",
];

async function get(u) {
  try {
    const r = await fetch(u, { headers: UA, redirect: "follow" });
    return { status: r.status, url: r.url, body: await r.text() };
  } catch (e) { return { status: 0, url: u, body: "", err: String(e).slice(0, 120) }; }
}

function ldTypes(body) {
  const out = [];
  for (const m of body.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1].trim());
      const walk = o => {
        if (Array.isArray(o)) return o.forEach(walk);
        if (o && typeof o === "object") {
          if (o["@type"]) out.push(Array.isArray(o["@type"]) ? o["@type"].join("/") : o["@type"]);
          Object.values(o).forEach(walk);
        }
      };
      walk(j);
    } catch { out.push("(unparseable)"); }
  }
  const c = {};
  out.forEach(t => c[t] = (c[t] || 0) + 1);
  return c;
}

function links(body, base) {
  const seen = new Set();
  for (const m of body.matchAll(/href=["']([^"'#]+)["']/g)) {
    let u; try { u = new URL(m[1].replace(/&amp;/g, "&"), base); } catch { continue; }
    if (u.hostname !== new URL(base).hostname) continue;
    if (!/(film|movie|programm|program|spielplan|vorstellung|screening|kino|event)/i.test(u.pathname)) continue;
    if (/\.(jpg|jpeg|png|svg|pdf|css|js|webp)$/i.test(u.pathname)) continue;
    seen.add(u.href.split("?")[0]);
    if (seen.size >= 40) break;
  }
  return [...seen];
}

function window_(body, re, n, pad = 320) {
  const out = [];
  for (const m of body.matchAll(re)) {
    out.push(body.slice(Math.max(0, m.index - pad), m.index + pad).replace(/\s+/g, " "));
    if (out.length >= n) break;
  }
  return out;
}

async function look(u, depth) {
  const r = await get(u);
  console.log("\n================================================================");
  console.log("URL   ", u);
  console.log("FINAL ", r.url, "| status", r.status, "| bytes", r.body.length, r.err || "");
  if (!r.body) return;
  console.log("LD    ", JSON.stringify(ldTypes(r.body)));
  const marks = ["__NEXT_DATA__", "__NUXT__", "ScreeningEvent", "showtime", "Showtime", "/api/",
    "wp-json", "Originalversion", "Untertitel", "E/d/f", "OV/d", "englisch", "English"]
    .filter(k => r.body.includes(k));
  console.log("MARKS ", marks.join(" ") || "(none)");
  const L = links(r.body, r.url);
  console.log("LINKS ", L.length, L.slice(0, 12).join("\n       "));
  window_(r.body, /\d\d:\d\d/g, 2).forEach((w, i) => console.log("TIME" + i, w.slice(0, 600)));
  if (depth > 0 && L.length) {
    for (const sub of L.slice(0, 2)) await look(sub, depth - 1);
  }
}

for (const u of URLS) { try { await look(u, 1); } catch (e) { console.log("FAIL", u, String(e).slice(0, 160)); } }
console.log("\n=== probe done ===");
