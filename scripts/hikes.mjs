/* Builds GPX tracks for the "Hikes from Geneva" list (runs on GitHub, free):
   each waypoint is looked up on OpenStreetMap (Nominatim), then BRouter draws the walking route between them along real paths.
   Output: hikes/<id>.gpx and data/hikes.json (distance, ascent, descent, walking time). */
import fs from "node:fs";
const root = new URL("../", import.meta.url);
const UA = { "user-agent": "out-and-about-hikes/1.0 (github.com/rracc282/out-and-about)" };
const H = JSON.parse(fs.readFileSync(new URL("scripts/hikes.json", root), "utf8"));
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function geo(w) {
  if (w.ll) return { ll: w.ll, name: w.q || "fixed point" };
  const [la, lo] = w.near, d = w.r || 0.04;
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ch,fr&bounded=1&viewbox=${lo - d},${la + d},${lo + d},${la - d}&q=${encodeURIComponent(w.q)}`;
  await sleep(1200); const j = await (await fetch(u, { headers: UA })).json();
  if (!j.length) return { ll: w.near, name: "NOT FOUND: " + w.q + " (used hint)" };
  return { ll: [+j[0].lat, +j[0].lon], name: j[0].display_name.slice(0, 90) };
}
const out = {}; fs.mkdirSync(new URL("hikes/", root), { recursive: true });
for (const h of H) {
  const pts = []; for (const w of h.wps) pts.push(await geo(w));
  const url = `https://brouter.de/brouter?lonlats=${pts.map(p => p.ll[1].toFixed(5) + "," + p.ll[0].toFixed(5)).join("|")}&profile=${h.profile || "hiking-mountain"}&alternativeidx=0&format=gpx`;
  let gpx = ""; try { const r = await fetch(url, { headers: UA }); gpx = await r.text(); if (!r.ok) throw new Error(r.status + " " + gpx.slice(0, 200)); } catch (e) { out[h.id] = { error: String(e.message || e), pts }; continue; }
  const len = +(gpx.match(/track-length = (\d+)/) || [])[1] || 0, asc = +(gpx.match(/filtered ascend = (\d+)/) || [])[1] || 0;
  const ele = [...gpx.matchAll(/<ele>([\d.-]+)<\/ele>/g)].map(m => +m[1]); let dsc = 0; for (let i = 1; i < ele.length; i++) if (ele[i] < ele[i - 1]) dsc += ele[i - 1] - ele[i];
  const km = len / 1000, hz = km / 4, up = asc / 300, dn = dsc / 500, v = up + dn; const min = Math.round((Math.max(hz, v) + Math.min(hz, v) / 2) * 60);
  gpx = gpx.replace(/<name>[\s\S]*?<\/name>/, `<name>${h.name.replace(/&/g, "&amp;")}</name>`).replace(/<trk>/, `<trk>\n  <desc>${h.name.replace(/&/g, "&amp;")} – Out &amp; About</desc>`);
  fs.writeFileSync(new URL(`hikes/${h.id}.gpx`, root), gpx);
  const lat = [...gpx.matchAll(/lat="([\d.]+)"/g)].map(m => +m[1]), lon = [...gpx.matchAll(/lon="([\d.]+)"/g)].map(m => +m[1]);
  out[h.id] = { km: Math.round(km * 10) / 10, up: asc, down: Math.round(dsc), min, start: pts[0].ll, pts: pts.map(p => p.name), maxEle: Math.round(Math.max(...ele)), minEle: Math.round(Math.min(...ele)), bbox: [Math.min(...lat), Math.min(...lon), Math.max(...lat), Math.max(...lon)].map(x => Math.round(x * 1e4) / 1e4) };
  console.log(h.id, out[h.id].km, "km", asc, "m up", out[h.id].min, "min"); await sleep(1500);
}
fs.writeFileSync(new URL("data/hikes.json", root), JSON.stringify(out, null, 1));
