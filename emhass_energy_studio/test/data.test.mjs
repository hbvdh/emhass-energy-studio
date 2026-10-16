import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlan,validateRun,createDemo,computeStats} from '../public/data.js';

test('demo contains 192 correctly spaced 15-minute rows',()=>{
 const {plan,run}=createDemo(new Date('2026-10-17T12:00:00Z'));
 const rows=normalizePlan(plan);
 assert.equal(rows.length,192);assert.equal(rows[1].date-rows[0].date,900000);
 assert.equal(validateRun(plan,run,new Date(plan.generated_at)).length,0);
});
test('SOC fraction converted and battery/grid signs preserved',()=>{
 const data={status:'ok',emhass_schema_version:'1.0',plan:[{timestamp:'2026-10-17T10:00:00Z',P_batt:-2500,P_grid:1500,SOC_opt:.75}]};
 const [row]=normalizePlan(data);assert.equal(row.P_batt,-2500);assert.equal(row.P_grid,1500);assert.equal(row.SOC_opt,75);
});
test('detects outdated plan and failed latest optimization',()=>{
 const plan={generated_at:'2026-10-17T09:00:00Z',emhass_schema_version:'1.0'};
 const run={status:'infeasible',timestamp:'2026-10-17T09:15:00Z',infeasible:true};
 const warnings=validateRun(plan,run,new Date('2026-10-17T10:00:00Z'));
 assert.ok(warnings.some(s=>s.includes('60 minuten')));
 assert.ok(warnings.some(s=>s.includes('niet uitvoerbaar')));
});
test('rejects unsupported plan schema',()=>{
 assert.throws(()=>normalizePlan({status:'ok',emhass_schema_version:'2.0',plan:[{timestamp:'2026-10-17T12:00:00Z'}]}),/schema/);
});
test('cost computes import and export at their own tariffs',()=>{
 const source={status:'ok',plan:[
 {timestamp:'2026-10-17T12:00:00Z',P_PV:0,P_grid:1000,SOC_opt:.5,unit_load_cost:.3,unit_prod_price:.1},
 {timestamp:'2026-10-17T12:15:00Z',P_PV:2000,P_grid:-1000,SOC_opt:.6,unit_load_cost:.3,unit_prod_price:.1}
 ]};
 const stats=computeStats(normalizePlan(source));assert.ok(Math.abs(stats.cost-.05)<1e-9);assert.ok(Math.abs(stats.pv-.5)<1e-9);assert.ok(Math.abs(stats.imp-.25)<1e-9);
});
