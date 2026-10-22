import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveEntities,parseResults,normalizeStates,createReader} from '../source.mjs';
const entities=resolveEntities();
const record=(id,value,unit='',attrs={})=>({entity_id:id,state:String(value),attributes:{unit_of_measurement:unit,...attrs},last_updated:'2026-10-22T09:05:00+02:00'});
test('Predbat custom domain, H3X-independent default entities',()=>{
 assert.equal(entities.status,'predbat.status');assert.equal(entities.soc_best,'predbat.soc_kw_best');
 assert.equal(entities.inverter_config,'sensor.predbat_inverter_config');
 assert.equal(entities.active,'switch.predbat_active');
 assert.equal(resolveEntities('battery_plan').battery_best,'battery_plan.battery_power_best');
 assert.equal(resolveEntities('predbat','sensor.battery_soc').battery_soc_percent,'sensor.battery_soc');
});
test('rejects arbitrary or malicious entity configuration',()=>{
 for(const prefix of ['','Predbat','../../etc','predbat/foo','hello.domain'])assert.throws(()=>resolveEntities(prefix));
 for(const soc of ['http://server','sensor.foo-bar','sensor.foo/other','predbat.status'])assert.throws(()=>resolveEntities('predbat',soc));
});
test('results map sorts and filters unknown values',()=>{
 assert.deepEqual(parseResults({'2026-10-22 11:05:00':'5','2026-10-22 11:00:00':4,'2026-10-22 11:10:00':'unavailable','bad':7}),[
  {time:'2026-10-22 11:00:00',value:4},{time:'2026-10-22 11:05:00',value:5}
 ]);
 assert.deepEqual(parseResults(null),[]);
 assert.deepEqual(parseResults([{time:'2026-10-22T11:00:00+02:00',value:1}]),[{time:'2026-10-22T11:00:00+02:00',value:1}]);
 assert.deepEqual(parseResults({'2026-10-22 11:00:00':{value:5}}),[]);
});
test('normalization calculates SoC and comparable savings, never guesses missing data',()=>{
 const rows={
  [entities.status]:record(entities.status,'Hold charging','',{run_state:'Hold charging',version:'9.4.1'}),
  [entities.soc_now]:record(entities.soc_now,8,'kWh'),
  [entities.inverter_config]:record(entities.inverter_config,10,'kW',{soc_max:10.24}),
  [entities.best_metric]:record(entities.best_metric,75,'ct',{results:{'2026-10-22 10:00:00':77}}),
  [entities.base_metric]:record(entities.base_metric,124,'ct'),
  [entities.soc_best]:record(entities.soc_best,9,'kWh',{results:{'2026-10-22 10:00:00':8.1}}),
 };
 const data=normalizeStates(rows,entities,new Date('2026-10-22T09:00:00Z'));
 assert.equal(data.status,'ok');assert.equal(data.run_state,'Hold charging');assert.equal(data.estimated_saving,49);
 assert.equal(Math.round(data.soc_percent),78);assert.equal(data.series.soc_best.length,1);
 assert.equal(data.missing.includes('battery'),true);
 rows[entities.base_metric].attributes.unit_of_measurement='€';
 assert.equal(normalizeStates(rows,entities).estimated_saving,null);
});
test('unavailable sensors do not become zero or fake savings',()=>{
 const data=normalizeStates({},entities);assert.equal(data.status,'unavailable');assert.equal(data.estimated_saving,null);
 assert.equal(data.soc_percent,null);assert.equal(data.scalar.best_metric,null);
});
test('adapter uses only GET for fixed paths and caches reads',async()=>{
 const calls=[];const fetchImpl=async(url,options)=>{
  calls.push({url,options});const id=decodeURIComponent(url.split('/states/')[1]);
  return {ok:true,text:async()=>JSON.stringify(record(id,id==='predbat.status'?'Demand':'2','kWh'))};
 };
 const now=new Date('2026-10-22T10:00:00Z');const read=createReader({token:'secret',fetchImpl,clock:()=>now});
 const a=await read(),b=await read();assert.equal(a,b);assert.equal(a.status,'ok');
 assert.equal(calls.length,new Set(Object.values(entities)).size);
 assert(calls.every(c=>c.url.startsWith('http://supervisor/core/api/states/')&&!c.url.includes('?')));
 assert(calls.every(c=>c.options.headers.Authorization==='Bearer secret'));
 assert(calls.every(c=>c.options.method===undefined));
});
test('missing supervisor token returns explicit unavailable',async()=>{
 const read=createReader({token:'',fetchImpl:()=>{throw Error('should not connect')}});const result=await read();
 assert.equal(result.status,'unavailable');assert.match(result.reason,/token/);
});
test('state parser respects size and response identity',async()=>{
 const read=createReader({token:'secret',fetchImpl:async(url)=>({ok:true,text:async()=>JSON.stringify({entity_id:'sensor.other',state:'888',attributes:{}})})});
 const data=await read();assert.equal(data.status,'unavailable');
});
