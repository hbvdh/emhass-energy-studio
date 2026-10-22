import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {strings} from '../public/i18n.js';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('all HTML localization keys are translated',()=>{
 const keys=[...html.matchAll(/data-i18n="([^"]+)"/g)].map(m=>m[1]);
 for(const key of keys){assert.ok(strings.nl[key],`Missing Dutch key ${key}`);assert.ok(strings.en[key],`Missing English key ${key}`);}
});
test('client only calls local read-only endpoints, with demo visually distinguished',()=>{
 assert.match(app,/fetch\('\.\/api\/snapshot'/);assert.match(app,/fetch\('\.\/api\/settings'/);
 assert.doesNotMatch(app,/method\s*:\s*['"]POST/);
 assert.match(app,/state\.demo=true/);
 assert.match(app,/URL\.createObjectURL/);
 assert.match(app,/textContent/);
});
test('both Predbat and EMHASS use a different add-on slug',()=>{
 const conf=readFileSync(new URL('../config.yaml',import.meta.url),'utf8');
 assert.match(conf,/slug: predbat_energy_studio/);
 assert.doesNotMatch(conf,/slug: emhass_energy_studio\b/);
});
