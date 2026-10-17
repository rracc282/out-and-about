/* temporary: dump pages */
import fs from "node:fs";
const UA={"user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36","accept-language":"en,fr;q=0.8"};
const P={
 mfbg:"https://www.meetup.com/find/?location=ch--Geneve&source=EVENTS&keywords=board%20games",
 mfsoc:"https://www.meetup.com/find/?location=ch--Geneve&source=EVENTS&keywords=social",
 mfall:"https://www.meetup.com/find/?location=ch--Geneve&source=EVENTS",
 mgrp:"https://www.meetup.com/find/?location=ch--Geneve&source=GROUPS&keywords=games",
 mgrp2:"https://www.meetup.com/find/?location=ch--Geneve&source=GROUPS&keywords=social",
};
fs.mkdirSync("data/tmp-raw",{recursive:true});
for(const [k,u] of Object.entries(P)){try{const r=await fetch(u,{headers:UA,redirect:"follow"});const t=await r.text();fs.writeFileSync(`data/tmp-raw/${k}.txt`,`${r.status} ${r.url}\n`+t);console.log(k,r.status,t.length)}catch(e){fs.writeFileSync(`data/tmp-raw/${k}.txt`,"ERR "+e)}}
