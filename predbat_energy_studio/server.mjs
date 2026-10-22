import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {join,resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createReader} from './source.mjs';
const publicRoot=fileURLToPath(new URL('./public/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const security={
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'SAMEORIGIN',
 'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'",
};
function sendJson(res,code,body){const text=JSON.stringify(body);res.writeHead(code,{...security,'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(text)});res.end(text);}
export function startServer({hostname='127.0.0.1',listenPort=8099,token=process.env.SUPERVISOR_TOKEN||'',prefix='predbat',socEntity='',language='auto',ingressOnly=false,fetchImpl=fetch}={}){
 const read=createReader({token,prefix,socEntity,fetchImpl});
 const server=createServer(async(req,res)=>{
  // Ingress forwards via the HA Supervisor's actual TCP address. Never trust proxy headers.
  if(ingressOnly&&!['172.30.32.2','::ffff:172.30.32.2'].includes(req.socket.remoteAddress))return sendJson(res,403,{error:'Home Assistant Ingress only'});
  if(!['GET','HEAD'].includes(req.method))return sendJson(res,405,{error:'Read-only: GET only'});
  const raw=req.url||'/';if(!raw.startsWith('/'))return sendJson(res,400,{error:'Invalid URL'});
  let url;try{url=new URL(raw.replace(/^\/+/, '/'),'http://localhost');}catch{return sendJson(res,400,{error:'Invalid URL'});}
  if(url.pathname==='/health')return sendJson(res,200,{status:'ok'});
  if(url.pathname==='/api/settings')return sendJson(res,200,{language:['auto','en','nl'].includes(language)?language:'auto'});
  if(url.pathname==='/api/snapshot')return sendJson(res,200,await read());
  if(url.pathname.startsWith('/api/'))return sendJson(res,404,{error:'Unknown endpoint'});
  try{
   const route=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
   const file=resolve(publicRoot,'.'+route);
   if(file!==resolve(publicRoot)&&!file.startsWith(resolve(publicRoot)+sep))return sendJson(res,403,{error:'Invalid path'});
   const info=await stat(file);if(!info.isFile())return sendJson(res,404,{error:'Not found'});
   const data=await readFile(file);
   res.writeHead(200,{...security,'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':data.length});
   res.end(req.method==='HEAD'?undefined:data);
  }catch{return sendJson(res,404,{error:'Not found'});}
 });
 server.listen(listenPort,hostname);return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))startServer({listenPort:Number(process.env.PORT||8099),hostname:process.env.HOST||'127.0.0.1'});
