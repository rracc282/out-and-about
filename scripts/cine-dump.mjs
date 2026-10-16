/* temporary: dump pages to design parsers */
import fs from "node:fs";
const UA={"user-agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1","accept-language":"fr,en;q=0.8,de;q=0.7","accept":"text/html,application/json;q=0.9,*/*;q=0.8"};
const P={
 gecal:"https://www.geneve.com/en/events-calendar",
 pxsched:"https://www.palexpo.ch/en/event-schedule/",
 pxev:"https://www.palexpo.ch/evenement/art-geneve/",
 metev:"https://sallemetropole.ch/evenements/christophe-willem/",
 metlist:"https://sallemetropole.ch/evenements/",
 oa:"https://openagenda.com/agendas/96959970/events.json?lang=fr",
 oa2:"https://api.openagenda.com/v2/agendas/96959970/events",
 efge2:"https://eventfrog.ch/fr/events/geneve.html?page=2",
 efgeconc:"https://eventfrog.ch/en/events/ch/geneve/concerts.html",
 efgeparty:"https://eventfrog.ch/en/events/ch/geneve/party.html",
 efgetheatre:"https://eventfrog.ch/en/events/ch/geneve/theatre-musical.html",
 efzhcom:"https://eventfrog.ch/en/events/ch/zuerich/comedy-cabaret.html",
 arenaag:"https://www.geneva-arena.ch/agenda/",
 tonkal:"https://www.tonhalle-orchester.ch/en/concerts/kalender/",
 zubev:"https://www.zuerichunbezahlbar.ch/events/",
 lesamisev2:"https://lesamis.cc/en/events/",
};
fs.mkdirSync("data/cine-raw",{recursive:true});
for(const [k,u] of Object.entries(P)){try{const r=await fetch(u,{headers:UA,redirect:"follow"});const t=await r.text();fs.writeFileSync(`data/cine-raw/${k}.txt`,`${r.status} ${r.url}\n`+t.slice(0,1500000));console.log(k,r.status,t.length)}catch(e){fs.writeFileSync(`data/cine-raw/${k}.txt`,"ERR "+e);console.log(k,"ERR")}}
