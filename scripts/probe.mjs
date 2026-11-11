/* Throwaway: where is the venue on an unbezahlbar detail page, and on a Hallenstadion page. */
const D={"user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36","accept-language":"de-CH,de;q=0.9"};
const get=async u=>{try{const r=await fetch(u,{headers:D,redirect:"follow"});return{s:r.status,t:await r.text()}}catch(e){return{s:0,t:"",e:String(e).slice(0,100)}}};
const txt=h=>h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();

const list=await get("https://www.zuerichunbezahlbar.ch/events/");
const hrefs=[...new Set([...list.t.matchAll(/href="\s*(\/events\/[a-z0-9\-\/]+\/)\s*"/g)].map(m=>m[1]))].filter(h=>!/\/create\//.test(h));
console.log("detail hrefs:",hrefs.length,hrefs.slice(0,3).join(" "));
for(const h of hrefs.slice(0,2)){
  const d=await get("https://www.zuerichunbezahlbar.ch"+h);
  console.log("\n==============",h,"->",d.s,d.t.length);
  console.log("TEXT:",txt(d.t).slice(0,900));
  for(const k of ["location","venue","adresse","address","ort","map","geo","poster__"]){
    const m=d.t.match(new RegExp('class="[^"]*'+k+'[^"]*"[\\s\\S]{0,260}','i'));
    if(m)console.log("  ["+k+"]",m[0].replace(/\s+/g," ").slice(0,300));
  }
  const lat=d.t.match(/(lat|latitude)["':\s]+(-?\d+\.\d+)/i);if(lat)console.log("  LAT:",lat[0]);
}
const hs=await get("https://hallenstadion.ch/events/noah-kahan?availability_id=31543");
console.log("\n\n===== HALLENSTADION og:description =====", hs.s);
console.log((hs.t.match(/<meta[^>]+(?:property|name)="(?:og:)?description"[^>]*content="([^"]*)"/i)||[])[1]||"(none)");
