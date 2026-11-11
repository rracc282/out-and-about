/* Throwaway: the three unbezahlbar pages whose address pattern misses, and whether all-day
   entries (a date, no time) exist on the listing. */
const D={"user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36","accept-language":"de-CH,de;q=0.9"};
const get=async u=>{try{const r=await fetch(u,{headers:D,redirect:"follow"});return{s:r.status,t:await r.text()}}catch(e){return{s:0,t:"",e:String(e).slice(0,100)}}};

const list=await get("https://www.zuerichunbezahlbar.ch/events/");
console.log("listing:",list.s,list.t.length);
const arts=list.t.split('<article class="poster').slice(1);
console.log("articles:",arts.length);
let noTime=0, samples=[];
for(const a of arts){
  const tt=(a.match(/<time[^>]*>([\s\S]*?)<\/time>/)||[])[1]||"";
  const clean=tt.replace(/<[^>]+>/g," ").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/\s+/g," ").trim();
  if(!/\d{1,2}:\d{2}/.test(clean)){noTime++; if(samples.length<6)samples.push(clean);}
}
console.log("entries with a date but NO time:",noTime,"of",arts.length);
samples.forEach(s=>console.log("   ",s));

/* the three that fell back to "Zurich" */
for(const h of ["/events/clubs-partys/","/events/bildende-kunst-performance/","/events/sport-freizeit/diverse/"]){
  const r=await get("https://www.zuerichunbezahlbar.ch"+h);
  const m=[...new Set([...r.t.matchAll(/href="\s*(\/events\/[a-z0-9\-\/]+\/)\s*"/g)].map(x=>x[1]))].filter(x=>x.split("/").length>4);
  console.log("\n==== category",h,"->",r.s,"| detail links",m.length);
  if(!m[0])continue;
  const d=await get("https://www.zuerichunbezahlbar.ch"+m[0]);
  console.log("  sample:",m[0],"->",d.s,d.t.length);
  console.log("  has detailpost__address:",/detailpost__address/.test(d.t));
  for(const k of ["address","location","ort\\b","venue","detailpost"]){
    const mm=d.t.match(new RegExp('<[a-z]+[^>]*class="[^"]*'+k+'[^"]*"[^>]*>[\\s\\S]{0,240}','i'));
    if(mm)console.log("  ["+k+"]",mm[0].replace(/\s+/g," ").slice(0,290));
  }
  const z=d.t.match(/[\s\S]{200}\b(?:CH-)?80\d\d\s+Z(?:ü|ue)rich/);
  if(z)console.log("  AROUND POSTCODE:",z[0].replace(/\s+/g," ").slice(-280));
}
