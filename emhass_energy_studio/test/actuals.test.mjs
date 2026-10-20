import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHaActuals,calculateDayActuals,deltaKwh,deltaMoney,moneyEuro,powerKw,validateEntityConfig} from '../ha_actuals.mjs';
import {remainingEnergyToday,normalizePlan,localMidnightUtcMs} from '../public/data.js';

test('Cumulative counters: sum tariffs and preserve import/export separately',()=>{
  const entities=validateEntityConfig();
  const baseline={};const states={};
  for(const [key,name] of Object.entries(entities)){
    if(['import_t1','import_t2','export_t1','export_t2','pv_total'].includes(key)){
      baseline[name]=100;states[name]={state:'101',attributes:{unit_of_measurement:'kWh'}};
    }
  }
  states[entities.battery_now]={state:'0.625',attributes:{unit_of_measurement:'kW'}};
  states[entities.grid_now]={state:'-53',attributes:{unit_of_measurement:'W'}};
  states[entities.import_price]={state:'0.3206',attributes:{unit_of_measurement:'EUR/kWh'}};
  const x=calculateDayActuals({now:new Date('2026-10-20T12:00:00Z'),midnightSamples:baseline,states,entities});
  assert.equal(x.grid_import_kwh,2);
  assert.equal(x.grid_export_kwh,2);
  assert.equal(x.pv_kwh,1);
  assert.equal(x.battery_power_kw,0.625);
  assert.equal(x.grid_power_kw,-.053);
  assert.equal(x.current_import_price_eur_kwh,.3206);
  assert.equal(x.net_cost_today_eur,null);
  assert.equal(x.net_cost_status,'statistics_unavailable');
});

test('Counters do not fabricate energy from missing, unavailable or reset data',()=>{
  assert.equal(deltaKwh(null,5),null);
  assert.equal(deltaKwh(100,90),null);
  assert.equal(deltaKwh(2,2),0);
  assert.equal(powerKw({state:'unavailable',attributes:{unit_of_measurement:'kW'}}),null);
  assert.throws(()=>validateEntityConfig({pv_total:'http://untrusted/'}),/Invalid/);
});

test('Read-only HA API uses only configured entity states and a short midnight window',async()=>{
  const token='testtoken';const entities=validateEntityConfig();const accesses=[];
  const sampleTime=new Date('2026-10-20T12:00:00Z');
  const server=createServer((req,res)=>{
    accesses.push({url:req.url,authorization:req.headers.authorization,method:req.method});
    res.setHeader('Content-Type','application/json');
    if(req.url.startsWith('/core/api/history/period/')) {
      const u=new URL(req.url,'http://localhost');
      assert.equal(u.searchParams.get('filter_entity_id').split(',').length,5);
      const stamp=new Date(localMidnightUtcMs('2026-10-20')-200).toISOString();
      const groups=[...u.searchParams.get('filter_entity_id').split(',')].map(id=>[{entity_id:id,state:'100',last_changed:stamp}]);
      res.end(JSON.stringify(groups));
    } else if(req.url.startsWith('/core/api/states/')){
      const id=decodeURIComponent(req.url.split('/').pop());
      res.end(JSON.stringify({state:id.includes('_power')?'500':'101',attributes:{unit_of_measurement:id.includes('_power')?'W':'kWh'}}));
    } else {res.statusCode=404;res.end('[]');}
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const load=createHaActuals({token,entities,base:`http://127.0.0.1:${server.address().port}/core/api`,clock:()=>sampleTime});
    const x=await load();assert.equal(x.status,'ok');assert.equal(x.pv_kwh,1);
    assert.equal(x.grid_import_kwh,2);
    assert.equal((await load()).status,'ok');
    assert.equal(accesses.filter(x=>x.url.includes('/history/')).length,1);
    assert.equal(accesses.length,13);
    assert.ok(accesses.every(x=>x.authorization==='Bearer testtoken'&&x.method==='GET'));
  } finally {await new Promise(ok=>server.close(ok));}
});

test('Remaining PV and import energy stops at local midnight',()=>{
  const rows=normalizePlan({status:'ok',plan:[
    {timestamp:'2026-10-20T21:30:00Z',P_PV:1000,P_grid:2000},
    {timestamp:'2026-10-20T21:45:00Z',P_PV:2000,P_grid:3000},
    {timestamp:'2026-10-20T22:00:00Z',P_PV:3000,P_grid:4000},
  ]});
  const pv=remainingEnergyToday(rows,'P_PV',new Date('2026-10-20T21:30:00Z'));
  const grid=remainingEnergyToday(rows,'P_grid',new Date('2026-10-20T21:30:00Z'));
  assert.ok(Math.abs(pv.kwh-.75)<1e-8);
  assert.ok(Math.abs(grid.kwh-1.25)<1e-8);
});

test('Real history missing at midnight is treated as unavailable, not zero',()=>{
  const entities=validateEntityConfig();
  const states={[entities.import_t1]:{state:'101',attributes:{unit_of_measurement:'kWh'}}};
  const d=calculateDayActuals({now:new Date('2026-10-20T12:00:00Z'),midnightSamples:{},states,entities});
  assert.equal(d.grid_import_kwh,null);
  assert.equal(d.pv_kwh,null);
});


test('Money helpers still validate units and retain negative values',()=>{
  assert.ok(Math.abs(deltaMoney(12,11.8)+0.2)<1e-10);
  assert.equal(moneyEuro({state:'-1.42',attributes:{unit_of_measurement:'€'}}),-1.42);
  assert.equal(moneyEuro({state:'4.3',attributes:{unit_of_measurement:'USD'}}),null);
});

test('Real net cost is not inferred from raw monetary sensor state differences',()=>{
 const entities=validateEntityConfig(),baseline={},states={};
 const keys=['import_cost_t1','import_cost_t2','export_comp_t1','export_comp_t2'];
 for (const key of keys) {
   const entity=entities[key]; baseline[entity]=50;
   states[entity]={state:'52',attributes:{unit_of_measurement:'EUR'}};
 }
 const d=calculateDayActuals({now:new Date('2026-10-20T12:00:00Z'),midnightSamples:baseline,states,entities});
 assert.equal(d.net_cost_today_eur,null);
 assert.equal(d.net_cost_status,'statistics_unavailable');
});
