/* Throwaway: why detailpost__address misses on these three. */
const D={"user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36","accept-language":"de-CH,de;q=0.9"};
const get=async u=>{try{const r=await fetch(u,{headers:D,redirect:"follow"});return{s:r.status,t:await r.text()}}catch(e){return{s:0,t:"",e:String(e).slice(0,100)}}};
const URLS=[
 "https://www.zuerichunbezahlbar.ch/events/kultur-nachtleben/clubs-parties/gonzo-club-damn-dunnstig/",
 "https://www.zuerichunbezahlbar.ch/events/kultur-nachtleben/bildende-kunst-performance/lust-auf-singen/",
 "https://www.zuerichunbezahlbar.ch/events/sport-freizeit/diverse/mini-day/",
 /* one that DID work, as a control */
 "https://www.zuerichunbezahlbar.ch/events/kultur-nachtleben/musik/zirkus-chnopf/"];
for(const u of URLS){
  const r=await get(u);
  console.log("\n================================================");
  console.log(u.replace("https://www.zuerichunbezahlbar.ch/events/",""),"->",r.s,r.t.length);
  if(!r.t)continue;
  console.log("  <address ...> tags:",(r.t.match(/<address[^>]*>/gi)||[]).join(" | ")||"(none)");
  const m=r.t.match(/<address[^>]*>[\s\S]{0,300}?<\/address>/i);
  if(m)console.log("  FULL:",m[0].replace(/\s+/g," ").slice(0,320));
  const pc=r.t.match(/[\s\S]{320}(?:CH-)?80\d\d\s+Z(?:ü|ue|&#252;)rich/);
  if(pc)console.log("  AROUND POSTCODE:",pc[0].replace(/\s+/g," ").slice(-340));
}
