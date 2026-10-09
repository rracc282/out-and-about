/* Checks every external link in the app (free, runs on GitHub). Writes data/links.json: { url: [status, finalUrl] }.
   status: HTTP code, or "ERR". A link counts as broken if status >= 400 (except 401/403/405/406/429, which usually mean "bots not welcome" but works in a browser) or ERR. */
import fs from "node:fs";
const root = new URL("../", import.meta.url);
const text = fs.readFileSync(new URL("index.html", root), "utf8") + fs.readFileSync(new URL("auto.js", root), "utf8");
const skip = /google\.com\/maps|maps\.google|sbb\.ch\/en\?|wa\.me|calendar\.google|cdn\.jsdelivr|fonts\.g|supabase\.co|github\.io|schema\.org|w3\.org|open-meteo|photon\.komoot|example\.org/;
const urls = [...new Set([...text.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)].map(m => m[0].replace(/[.,;]+$/, "")))].filter(u => !skip.test(u) && !u.includes("'+") && !u.includes("${"));
const UA = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "accept-language": "en,fr;q=0.8,de;q=0.7" };
const out = {};
async function check(u) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 20000);
  try { const r = await fetch(u, { headers: UA, redirect: "follow", signal: c.signal }); out[u] = [r.status, r.url !== u ? r.url : ""]; try { await r.body?.cancel(); } catch {} }
  catch (e) { out[u] = ["ERR", ""]; } finally { clearTimeout(t); }
}
for (let i = 0; i < urls.length; i += 12) await Promise.all(urls.slice(i, i + 12).map(check));
fs.mkdirSync(new URL("data/", root), { recursive: true });
fs.writeFileSync(new URL("data/links.json", root), JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"'));
const bad = Object.entries(out).filter(([, [s]]) => s === "ERR" || (s >= 400 && ![401, 403, 405, 406, 429].includes(s)));
console.log("checked", urls.length, "broken", bad.length);
