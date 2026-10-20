
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEntityConfig,deltaKwh,powerKw,calculateDayActuals} from '../ha_actuals.mjs';
import {remainingEnergyToday,normalizePlan} from '../public/data.js';
test('Meter tariffs and power conversions',()=>{
 const e=validateEntityConfig(),start={},states={};
 for(const key of ['import_t1','import_t2','export_t1','export_t2','pv_total']){
  start[e[key]]=100;states[e[key]]={state:'101',attributes:{unit_of_measurement:'kWh'}};
 }
 states[e.battery_now]={state:'0.625',attributes:{unit_of_measurement:'kW'}};
 states[e.grid_now]={state:'-53',attributes:{unit_of_measurement:'W'}};
 const x=calculateDayActuals({now:new Date('2026-10-20T12:00:00Z'),midnightSamples:start,states,entities:e});
 assert.equal(x.grid_import_kwh,2);assert.equal(x.pv_kwh,1);
 assert.equal(x.battery_power_kw,.625);assert.equal(x.grid_power_kw,-.053);assert.equal(x.net_cost_today_eur,null);
});
test('Missing/reset counters are never treated as zero',()=>{
 assert.equal(deltaKwh(null,5),null);assert.equal(deltaKwh(100,90),null);
 assert.equal(powerKw({state:'unavailable',attributes:{unit_of_measurement:'kW'}}),null);
 assert.throws(()=>validateEntityConfig({pv_total:'http://untrusted/'}),/Invalid/);
});
test('Energy integration ends at local midnight',()=>{
 const rows=normalizePlan({status:'ok',plan:[
  {timestamp:'2026-10-20T21:30:00Z',P_PV:1000},
  {timestamp:'2026-10-20T21:45:00Z',P_PV:2000},
  {timestamp:'2026-10-20T22:00:00Z',P_PV:3000}]});
 assert.ok(Math.abs(remainingEnergyToday(rows,'P_PV',new Date('2026-10-20T21:30:00Z')).kwh-.75)<1e-10);
});
