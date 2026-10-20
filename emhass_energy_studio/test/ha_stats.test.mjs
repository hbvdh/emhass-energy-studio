import test from 'node:test';
import assert from 'node:assert/strict';
import {statisticGrowth, energyDashboardCost,getCostStatistics} from '../ha_stats.mjs';
import {validateEntityConfig,createHaActuals} from '../ha_actuals.mjs';
import {EventEmitter} from 'node:events';

const ent=validateEntityConfig();
const keys=['import_cost_t1','import_cost_t2','export_comp_t1','export_comp_t2'];
function fakeStats(changes) {
 const data={};keys.forEach((key,i)=>data[ent[key]]=[{change:changes[i]},{change:null}]);return data;
}

test('Energy dashboard uses the sum of hourly statistic changes, preserving negatives',()=>{
 const v=energyDashboardCost(fakeStats([0.80,0.32,0.15,-0.02]),ent);
 assert.ok(Math.abs(v.import_cost_today_eur-1.12)<1e-10);
 assert.ok(Math.abs(v.export_compensation_today_eur-.13)<1e-10);
 assert.ok(Math.abs(v.net_cost_today_eur-.99)<1e-10);
 assert.equal(v.net_cost_status,'ok');
 assert.equal(statisticGrowth([{change:null},{change:-.3},{change:0.1}]),-.19999999999999998);
});

test('Statistical gaps are never converted to zero or raw counter deltas',()=>{
 const data=fakeStats([.4,.2,.1,.1]);delete data[ent.export_comp_t2];
 assert.equal(energyDashboardCost(data,ent),null);
 assert.equal(energyDashboardCost(fakeStats([.4,.2,.1,NaN]),ent),null);
 assert.equal(energyDashboardCost(fakeStats([.4,.2,.1,null]),ent),null);
 assert.equal(statisticGrowth([]),null);
});

test('Supervisor websocket performs only one read-only statistics query',async()=>{
 const outbound=[];
 class MockWebSocket extends EventEmitter {
  constructor(url){super();this.url=url;queueMicrotask(()=>this.emit('message',{data:JSON.stringify({type:'auth_required'})}));}
  addEventListener(type,callback){this.on(type,callback);}
  send(raw) {
   const cmd=JSON.parse(raw);outbound.push(cmd);
   if(cmd.type==='auth')queueMicrotask(()=>this.emit('message',{data:JSON.stringify({type:'auth_ok'})}));
   if(cmd.type==='recorder/statistics_during_period')queueMicrotask(()=>this.emit('message',{data:JSON.stringify({type:'result',id:1,success:true,result:fakeStats([.5,.4,.15,.05])})}));
  }
  close() {this.closed=true;}
 }
 const data=await getCostStatistics({token:'fake',entities:ent,startTime:new Date('2026-10-19T22:00:00Z'),endTime:new Date('2026-10-20T10:00:00Z'),WebSocketImpl:MockWebSocket,timeoutMs:2000});
 assert.ok(energyDashboardCost(data,ent));
 assert.equal(outbound[0].type,'auth');assert.equal(outbound[0].access_token,'fake');
 assert.deepEqual(outbound[1],{
  id:1,type:'recorder/statistics_during_period',start_time:'2026-10-19T22:00:00.000Z',end_time:'2026-10-20T10:00:00.000Z',statistic_ids:keys.map(key=>ent[key]),period:'hour',types:['change']
 });
});

test('Bad auth is refused, never silently replaced by wrong monetary totals',async()=>{
 class BadSocket extends EventEmitter {
  constructor(){super();queueMicrotask(()=>this.emit('message',{data:'{"type":"auth_invalid"}'}));}
  addEventListener(type,callback){this.on(type,callback);} send(){} close(){}
 }
 await assert.rejects(()=>getCostStatistics({token:'fake',entities:ent,startTime:new Date(),endTime:new Date(),WebSocketImpl:BadSocket,timeoutMs:1000}),/authentication rejected/);
});

test('HA actual cost uses statistic changes while energy still uses kWh counter history',async()=>{
 const now=new Date('2026-10-20T12:00:00Z');
 const sample={};for(const key of keys)sample[ent[key]]={state:'50',attributes:{unit_of_measurement:'EUR'}};
 const fetched=[];
 const fakeFetch=async u=>{
  fetched.push(u);
  let result=null;
  if(u.includes('/history/period/')){
   const params=new URL(u).searchParams;
   result=params.get('filter_entity_id').split(',').map(id=>[{entity_id:id,state:'100',last_changed:'2026-10-19T21:59:59.000Z'}]);
  }else{
   const id=decodeURIComponent(u.split('/').pop());
   result=sample[id] || {state:'101',attributes:{unit_of_measurement:'kWh'}};
  }
  return {ok:true,text:async()=>JSON.stringify(result)};
 };
 let calls=0;
 const loader=createHaActuals({token:'fake',entities:ent,clock:()=>now,fetchImpl:fakeFetch,statisticsFetch:async()=>{calls++;return fakeStats([.8,.3,.1,.1]);}});
 const result=await loader();
 assert.equal(result.status,'ok');
 assert.ok(Math.abs(result.net_cost_today_eur-.9)<1e-10);
 assert.equal(result.grid_import_kwh,2);
 assert.equal(calls,1);
 assert.ok(fetched.some(u=>u.includes('filter_entity_id=')));
});
