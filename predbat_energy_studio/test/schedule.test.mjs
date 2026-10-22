import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePredbatTimestamp,upcomingPredbatWindows} from '../public/schedule.js';
const now=new Date('2026-10-22T10:00:00Z');
const ts=min=>new Date(now.getTime()+min*60_000).toISOString();
const data=arr=>arr.map(([m,value])=>({time:ts(m),value}));
test('clock state alone is not a date; timestamp attribute is',()=>{
 assert.equal(parsePredbatTimestamp('12:05:00'),null);
 assert.equal(parsePredbatTimestamp(''),null);
 assert.equal(parsePredbatTimestamp('2026-10-22T11:00:00Z')?.toISOString(),'2026-10-22T11:00:00.000Z');
});
test('forced charging and exporting windows come from complete attributes',()=>{
 const scalar={best_charge_start:{text:'11:00:00',timestamp:ts(60)},best_charge_end:{text:'12:00:00',timestamp:ts(120)},best_export_start:{timestamp:ts(180)},best_export_end:{timestamp:ts(210)}};
 const w=upcomingPredbatWindows({scalar,now});
 assert.deepEqual(w.map(x=>[x.kind,x.source]),[['charge','forced'],['export','forced']]);
 assert.equal(w[0].start.toISOString(),ts(60));
});
test('forecast fallback shows predicted charge and discharge, not a forced command',()=>{
 const points=data([[5,-1.5],[10,-1.4],[15,-0.8],[20,0],[25,1.5],[30,1.4],[35,1.2]]);
 const w=upcomingPredbatWindows({scalar:{best_charge_start:{text:'12:00:00'}},series:{battery_best:points},now});
 assert.deepEqual(w.map(x=>[x.kind,x.source]),[['charge','forecast'],['discharge','forecast']]);
 assert.equal(w[0].end.toISOString(),ts(20));
});
test('brief power spikes are ignored',()=>{
 const points=data([[0,-0.15],[5,-0.4],[10,0],[15,1.1],[20,0]]);
 assert.deepEqual(upcomingPredbatWindows({series:{battery_best:points},now}),[]);
});
test('past forced windows omitted and forecast not double-counted',()=>{
 const scalar={best_charge_start:{timestamp:ts(5)},best_charge_end:{timestamp:ts(20)},best_export_start:{timestamp:ts(-60)},best_export_end:{timestamp:ts(-30)}};
 const points=data([[5,-1],[10,-1],[15,-1],[20,0],[40,1],[45,1],[50,1]]);
 const w=upcomingPredbatWindows({scalar,series:{battery_best:points},now});
 assert.deepEqual(w.map(x=>[x.kind,x.source]),[['charge','forced'],['discharge','forecast']]);
});
