import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request} from 'node:http';
import {startServer} from '../server.mjs';
function raw(port,path){return new Promise((resolve,reject)=>{const r=request({host:'127.0.0.1',port,path},res=>{let data='';res.on('data',s=>data+=s);res.on('end',()=>resolve({code:res.statusCode,data,headers:res.headers}));});r.on('error',reject);r.end();});}
async function host(options,fn){const server=startServer({listenPort:0,hostname:'127.0.0.1',...options});await once(server,'listening');try{await fn(server.address().port);}finally{await new Promise(r=>server.close(r));}}
test('homepage and files work over Home Assistant double slash ingress',async()=>{
 await host({},async port=>{
  const root=await raw(port,'//');assert.equal(root.code,200);assert.match(root.data,/Predbat · Energy Studio/);
  assert.equal((await raw(port,'///style.css')).code,200);assert.equal((await raw(port,'//app.js')).code,200);
  const svg=await raw(port,'/i18n.js');assert.equal(svg.code,200);
  assert.match(root.headers['content-security-policy'],/frame-ancestors 'self'/);
 });
});
test('read-only and fixed API; no generic HA access',async()=>{
 await host({},async port=>{
  assert.equal((await raw(port,'/api/snapshot')).code,200);
  assert.equal((await raw(port,'/api/states')).code,404);
  assert.equal((await raw(port,'/http://evil')).code,404);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/snapshot`,{method:'POST'})).status,405);
  const settings=await(await fetch(`http://127.0.0.1:${port}/api/settings`)).json();assert.deepEqual(settings,{language:'auto'});
 });
});
test('Ingress-only mode denies direct TCP clients',async()=>{
 await host({ingressOnly:true},async port=>{assert.equal((await raw(port,'/')).code,403);assert.equal((await raw(port,'/api/snapshot')).code,403);});
});
test('custom language selection validates unexpected values',async()=>{
 await host({language:'nl'},async port=>{const r=await(await fetch(`http://127.0.0.1:${port}/api/settings`)).json();assert.equal(r.language,'nl');});
 await host({language:'broken'},async port=>{const r=await(await fetch(`http://127.0.0.1:${port}/api/settings`)).json();assert.equal(r.language,'auto');});
});
