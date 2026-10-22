import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,cpSync,existsSync,mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
test('packaged Docker COPY includes the full Node module graph',()=>{
 const dockerfile=readFileSync(join(root,'Dockerfile'),'utf8');const target=mkdtempSync(join(tmpdir(),'predbat-packaging-'));
 try{
  const copies=[...dockerfile.matchAll(/^COPY\s+(?:--[^\s]+\s+)*([^\n]+)$/gm)];assert.equal(copies.length,2);
  for(const [,line] of copies){const items=line.trim().split(/\s+/),destination=items.pop();assert.ok(['./', './public'].includes(destination), 'Unrecognized Docker COPY destination');
   for(const name of items){const from=join(root,name);assert.ok(existsSync(from));const to=statSync(from).isDirectory()?join(target,'public'):join(target,name);cpSync(from,to,{recursive:true});}
  }
  for(const moduleFile of ['server.mjs','startup.mjs','source.mjs','public/schedule.js'])assert.ok(existsSync(join(target,moduleFile)));
  execFileSync(process.execPath,['--check','server.mjs'],{cwd:target,timeout:5000});
  execFileSync(process.execPath,['--check','startup.mjs'],{cwd:target,timeout:5000});
  execFileSync(process.execPath,['--input-type=module','-e',"await import('./source.mjs'); await import('./server.mjs')"],{cwd:target,timeout:5000});
 }finally{rmSync(target,{recursive:true,force:true});}
});
test('manifest is an independent Home Assistant add-on',()=>{
 const conf=readFileSync(join(root,'config.yaml'),'utf8'),docker=readFileSync(join(root,'Dockerfile'),'utf8');
 assert.match(conf,/slug: predbat_energy_studio/);assert.match(conf,/version: "0\.1\.3"/);
 assert.match(conf,/homeassistant_api: true/);assert.match(conf,/ingress: true/);assert.match(docker,/source\.mjs/);
});
