import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {startServer} from '../server.mjs';

test('proxy permits only read-only fixed endpoints; serves UI',async()=>{
 const upstream=createServer((req,res)=>{
   res.writeHead(200,{'Content-Type':'application/json'});
   res.end(JSON.stringify({status:'ok',path:req.url}));
 });
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const app=startServer({hostname:'127.0.0.1',listenPort:0,upstreamUrl:`http://127.0.0.1:${upstream.address().port}`});
 await once(app,'listening');const root=`http://127.0.0.1:${app.address().port}`;
 try{
  const result=await (await fetch(root+'/api/plan')).json();assert.equal(result.path,'/api/v1/plan');
  const last=await (await fetch(root+'/api/last-run')).json();assert.equal(last.path,'/api/v1/last-run');
  assert.equal((await fetch(root+'/api/action/naive-mpc-optim')).status,404);
  assert.equal((await fetch(root+'/api/plan',{method:'POST'})).status,405);
  const home=await fetch(root+'/');
  const html=await home.text();assert.match(html,/EMHASS · Energy Studio/);
  assert.match(html,/href="\.\/style\.css"/);
  assert.match(html,/src="\.\/app\.js"/);
  assert.match(home.headers.get('content-security-policy'),/frame-ancestors 'self'/);
  assert.equal(home.headers.get('x-frame-options'),'SAMEORIGIN');
  const scriptText=await (await fetch(root+'/app.js')).text();
  assert.match(scriptText,/fetchJson\('\.\/api\/plan'\)/);

  assert.equal((await fetch(root+'/data.js')).status,200);
  const head=await fetch(root+'/style.css',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 } finally {await new Promise(ok=>app.close(ok));await new Promise(ok=>upstream.close(ok));}
});


test('Ingress-only HTTP listener blocks requests other than Supervisor TCP peer',async()=>{
 const app=startServer({hostname:'127.0.0.1',listenPort:0,ingressOnly:true});
 await once(app,'listening');
 try {
  const base=`http://127.0.0.1:${app.address().port}`;
  assert.equal((await fetch(base+'/')).status,403);
  assert.equal((await fetch(base+'/api/plan')).status,403);
 } finally { await new Promise(ok=>app.close(ok)); }
});
