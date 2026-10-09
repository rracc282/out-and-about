/* Weather only (free, no tokens): refreshes the forecasts inside auto.js.
   For each place and date: [max temp 08–22h, max rain chance 08–22h, max rain chance 17–23h].
   Places: Geneva + Zurich centres, every day-trip destination, and every event location outside the cities (0.1° grid). */
import fs from "node:fs";
const root = new URL("../", import.meta.url);
const file = new URL("auto.js", root);
const src = fs.readFileSync(file, "utf8");
const A = JSON.parse(src.slice(src.indexOf("=") + 1).trim().replace(/;\s*$/, ""));
const CITY = { ge: [46.2044, 6.1432], zh: [47.3769, 8.5417] };
const grid = ll => (Math.round(ll[0] * 10) / 10).toFixed(1) + "," + (Math.round(ll[1] * 10) / 10).toFixed(1);
const pts = new Map([["ge", CITY.ge], ["zh", CITY.zh]]);
for (const [id, ll] of Object.entries(A.tgeo || {})) pts.set("t:" + id, ll);
for (const e of A.events || []) if (e.geo && e.zone !== "ge" && e.zone !== "zh") pts.set(grid(e.geo), grid(e.geo).split(",").map(Number));
const keys = [...pts.keys()], out = {};
for (let i = 0; i < keys.length; i += 40) {
  const b = keys.slice(i, i + 40), ll = b.map(k => pts.get(k));
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${ll.map(x => x[0]).join(",")}&longitude=${ll.map(x => x[1]).join(",")}&hourly=temperature_2m,precipitation_probability&timezone=Europe%2FZurich&forecast_days=14`;
  let j; try { j = await (await fetch(url)).json(); } catch (e) { console.log("::warning::weather fetch failed", e.message); continue; }
  if (!Array.isArray(j)) j = [j];
  j.forEach((x, n) => { const o = out[b[n]] = {}; const h = x.hourly; if (!h) return;
    h.time.forEach((t, k) => { const d = t.slice(0, 10), hr = +t.slice(11, 13), r = h.precipitation_probability[k] ?? 0, tp = h.temperature_2m[k];
      const a = o[d] = o[d] || [-99, 0, 0];
      if (hr >= 8 && hr <= 22) { a[0] = Math.max(a[0], Math.round(tp)); a[1] = Math.max(a[1], r); }
      if (hr >= 17 && hr <= 23) a[2] = Math.max(a[2], r); }); });
}
if (out.ge) A.wx = { ge: out.ge, zh: out.zh || (A.wx || {}).zh };
const twx = {}; for (const k in out) if (k.startsWith("t:")) twx[k.slice(2)] = out[k];
if (Object.keys(twx).length) A.twx = twx;
const gw = {}; for (const k in out) if (/^-?\d/.test(k)) gw[k] = out[k];
A.gw = gw; A.wxAt = new Date().toISOString();
fs.writeFileSync(file, "window.AUTO=" + JSON.stringify(A) + ";\n");
console.log("weather points", keys.length, "updated", A.wxAt);
