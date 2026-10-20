import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer, request} from 'node:http';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
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



// node:http preserves the exact request target; fetch() may normalize // itself.
function rawRequest(port, path) {
  return new Promise((resolve, reject) => {
    const req = request({hostname:'127.0.0.1',port,path,method:'GET'},res=>{
      const parts=[];
      res.on('data',p=>parts.push(p));
      res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(parts).toString('utf8')}));
    });
    req.on('error',reject);
    req.end();
  });
}

test('Ingress-style double slash serves dashboard, assets and API without throwing',async()=>{
  const upstream=createServer((req,res)=>{
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({status:'ok',path:req.url}));
  });
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  const app=startServer({hostname:'127.0.0.1',listenPort:0,upstreamUrl:`http://127.0.0.1:${upstream.address().port}`});
  await once(app,'listening');
  try {
    const port=app.address().port;
    const page=await rawRequest(port,'//');
    assert.equal(page.status,200);
    assert.match(page.body,/EMHASS · Energy Studio/);
    assert.equal((await rawRequest(port,'///style.css')).status,200);
    const plan=await rawRequest(port,'//api/plan');
    assert.equal(plan.status,200);
    assert.equal(JSON.parse(plan.body).path,'/api/v1/plan');
    assert.equal((await rawRequest(port,'//api/action/naive-mpc-optim')).status,404);
    assert.equal((await rawRequest(port,'/')).status,200);
    assert.equal((await rawRequest(port,'/https://test')).status,404);
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


test('dashboard opens at 24 hours and table displays 28 quarters per page',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(app,/\bhours:24, filter:/);
  assert.match(app,/const PAGE_SIZE=28;/);
  assert.match(html,/<button[^>]*class="active"[^>]*data-hours="24"[^>]*>24 uur<\/button>/);
  assert.match(html,/<button[^>]*data-hours="48"[^>]*>48 uur<\/button>/);
});

test('language settings endpoint serves only a validated preference and never exposes credentials',async()=>{
 const app=startServer({hostname:'127.0.0.1',listenPort:0,upstreamUrl:'',languagePreference:'nl'});
 await once(app,'listening');
 try {
  const origin=`http://127.0.0.1:${app.address().port}`;
  const result=await fetch(origin+'/api/settings');
  assert.equal(result.status,200);
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.deepEqual(await result.json(),{language:'nl'});
  const doubleSlash=await rawRequest(app.address().port,'//api/settings');
  assert.deepEqual(JSON.parse(doubleSlash.body),{language:'nl'});
  assert.equal((await fetch(origin+'/api/settings',{method:'POST'})).status,405);
 } finally {await new Promise(ok=>app.close(ok));}
});

test('unsupported configuration falls back to auto without breaking API',async()=>{
 const app=startServer({hostname:'127.0.0.1',listenPort:0,languagePreference:'de'});
 await once(app,'listening');
 try {
  const data=await (await fetch(`http://127.0.0.1:${app.address().port}/api/settings`)).json();
  assert.deepEqual(data,{language:'auto'});
 } finally {await new Promise(ok=>app.close(ok));}
});

test('HA app manifest declares a language list with safe default',()=>{
 const manifest=readFileSync(new URL('../config.yaml',import.meta.url),'utf8');
 assert.match(manifest,/language: auto/);
 assert.match(manifest,/language: list\(auto\|en\|nl\)/);
});

test('Live readings endpoint permits only GET and no generic HA proxy',async()=>{
 const app=startServer({hostname:'127.0.0.1',listenPort:0});
 await once(app,'listening');
 try{
 const base=`http://127.0.0.1:${app.address().port}`;
 assert.equal((await fetch(base+'/api/live-actuals',{method:'POST'})).status,405);
 assert.equal((await fetch(base+'/api/live-actuals')).status,200);
 assert.equal((await fetch(base+'/api/states/sensor.any')).status,404);
 }finally{await new Promise(ok=>app.close(ok));}
});
