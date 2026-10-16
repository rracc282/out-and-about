import fs from "node:fs";
const UA={"user-agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1","accept-language":"fr,en;q=0.8"};
const r=await fetch("https://lesgenevois.com/calendrier/e/lady-film-fiction",{headers:UA});fs.mkdirSync("data/cine-raw",{recursive:true});fs.writeFileSync("data/cine-raw/lg.txt",r.status+"\n"+(await r.text()));
