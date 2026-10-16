/* temporary: dump pages to design parsers */
import fs from "node:fs";
const UA={"user-agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1","accept-language":"fr,en;q=0.8,de;q=0.7","accept":"text/html,application/json;q=0.9,*/*;q=0.8"};
const P={
 ldd_home:"https://www.ladecadanse.ch/",
 ldd_agenda:"https://www.ladecadanse.ch/evenement-agenda.php?courant=2026-10-17",
 ldd_ev:"https://www.ladecadanse.ch/event/evenement.php?idE=523422",
 gecom_list:"https://www.geneve.com/en/events",
 gecom_fr:"https://www.geneve.com/fr/evenements",
 gech:"https://www.geneve.ch/agenda",
 leprog:"https://www.leprogramme.ch/",
 palexpo:"https://www.palexpo.ch/fr/agenda",
 guidle:"https://www.guidle.com/de/veranstaltungen/zuerich",
 zub:"https://www.zuerichunbezahlbar.ch/",
 zuri:"https://zuri.net/de/zurich/agenda/",
 zcom:"https://www.zuerich.com/en/visit/events",
 ronorp:"https://www.ronorp.net/zuerich/events",
 lesamis:"https://lesamis.cc/",
 lesamis_ev:"https://lesamis.cc/events",
 arena:"https://www.geneva-arena.ch/",
 gtg:"https://www.gtg.ch/saison-26-27/",
 metropole:"https://www.sallemetropole.ch/",
 mdg:"https://museesdegeneve.ch/",
 iyf:"https://inyourfacecomedy.ch/",
 kunsthaus:"https://www.kunsthaus.ch/en/exhibitions/",
 tonhalle:"https://www.tonhalle-orchester.ch/en/concerts/",
 eventbrite_api:"https://www.eventbrite.ch/api/v3/destination/search/",
};
fs.mkdirSync("data/cine-raw",{recursive:true});
for(const [k,u] of Object.entries(P)){try{const r=await fetch(u,{headers:UA,redirect:"follow"});const t=await r.text();fs.writeFileSync(`data/cine-raw/${k}.txt`,`${r.status} ${r.url}\n`+t.slice(0,1500000));console.log(k,r.status,t.length)}catch(e){fs.writeFileSync(`data/cine-raw/${k}.txt`,"ERR "+e);console.log(k,"ERR")}}
