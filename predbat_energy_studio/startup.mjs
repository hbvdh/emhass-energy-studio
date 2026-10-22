import {readFile} from 'node:fs/promises';
import {startServer} from './server.mjs';
let cfg={};
try{cfg=JSON.parse(await readFile(process.env.HA_OPTIONS_PATH||'/data/options.json','utf8'));}catch(e){console.warn('Predbat Energy Studio: options unavailable',e.message);}
const prefix=String(cfg.predbat_prefix??'predbat').trim();
const socEntity=String(cfg.battery_soc_entity??'').trim();
const language=['auto','nl','en'].includes(cfg.language)?cfg.language:'auto';
// Drop root before accepting any user traffic. Supervisor token remains in env, never returned.
if(process.getuid?.()===0){process.setgid(1000);process.setuid(1000);}
startServer({hostname:'0.0.0.0',listenPort:8099,prefix,socEntity,language,ingressOnly:true});
console.log('Predbat Energy Studio v0.1.1 - read-only Ingress started');
