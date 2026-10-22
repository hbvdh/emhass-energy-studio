import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPredbatPlan,groupPredbatPlan} from '../public/plan.js';
import {resolveEntities,createReader} from '../source.mjs';
const midnight='2026-10-22T00:00:00+02:00';
const dateFor=hm=>'2026-10-22T'+hm+':00+02:00';
const rows=[];
for(let minute=675;minute<=885;minute+=15){
 const h=String(Math.floor(minute/60)).padStart(2,'0'),m=String(minute%60).padStart(2,'0');
 const state=minute<735?'HoldChrg':minute<825?'Chrg':minute<840?'HoldChrg':minute<870?'Chrg':'Demand';
 rows.push({time:dateFor(h+':'+m),slot_minute:minute,state});
}
rows[0].time=dateFor('11:20');
const record={entity_id:'predbat.plan_html',state:'',attributes:{raw:{time:midnight,rows,other:'ignored'}}};
test('projected plan uses Predbat raw states and aligns the active first slot',()=>{
 const plan=projectPredbatPlan(record);
 assert.equal(plan.length,rows.length);
 assert.equal(plan[0].time,new Date(dateFor('11:15')).toISOString());
});
test('official Predbat slot states reproduce expected charge/hold/demand transitions',()=>{
 const plan=projectPredbatPlan(record);
 const windows=groupPredbatPlan(plan,{now:new Date(dateFor('11:26'))});
 const hh=d=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'}).format(d);
 assert.deepEqual(windows.map(w=>[hh(w.start),w.end?hh(w.end):'…',w.state]),[
  ['11:15','12:15','HoldChrg'],['12:15','13:45','Chrg'],['13:45','14:00','HoldChrg'],['14:00','14:30','Chrg'],['14:30','…','Demand']]);
});
test('past slots are excluded without inferring false discharge windows',()=>{
 const windows=groupPredbatPlan(projectPredbatPlan(record),{now:new Date(dateFor('13:46'))});
 assert.deepEqual(windows.map(w=>w.state),['HoldChrg','Chrg','Demand']);
});
test('Predbat rowspans preserve the visible state over hidden rows',()=>{
 const table=[];
 for(let minute=690;minute<=885;minute+=15){
  const h=String(Math.floor(minute/60)).padStart(2,'0'),m=String(minute%60).padStart(2,'0');
  const state=minute<735?'HoldChrg':minute<825?'Chrg':minute<840?'HoldChrg':minute<870?'Chrg':'Demand';
  table.push({time:dateFor(h+':'+m),slot_minute:minute,state});
 }
 const byMinute=minute=>table.find(x=>x.slot_minute===minute);
 byMinute(735).rowspan_state=6; // 12:15–13:45 displayed as one Charging cell
 for(let minute=750;minute<825;minute+=15)byMinute(minute).skip_state_cell=true;
 byMinute(840).rowspan_state=2; // 14:00–14:30 displayed as one Charging cell
 byMinute(855).skip_state_cell=true;
 // These raw states are hidden under the merged cell in Predbat's UI.
 byMinute(765).state='HoldChrg';
 byMinute(795).state='HoldChrg';
 byMinute(855).state='HoldChrg';
 const record={attributes:{raw:{time:midnight,rows:table}}};
 const projected=projectPredbatPlan(record);
 assert.equal(projected.find(x=>x.time===new Date(dateFor('12:45')).toISOString()).state,'Chrg');
 assert.equal(projected.find(x=>x.time===new Date(dateFor('14:15')).toISOString()).state,'Chrg');
 const windows=groupPredbatPlan(projected,{now:new Date(dateFor('11:40'))});
 const hh=date=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'}).format(date);
 assert.deepEqual(windows.map(w=>[hh(w.start),w.end?hh(w.end):'…',w.state]),[
  ['11:30','12:15','HoldChrg'],['12:15','13:45','Chrg'],['13:45','14:00','HoldChrg'],
  ['14:00','14:30','Chrg'],['14:30','…','Demand']]);
});
test('without rowspans distinct raw state transitions remain visible',()=>{
 const rawRows=[
  {time:dateFor('12:00'),state:'Chrg'},
  {time:dateFor('12:15'),state:'HoldChrg'},
  {time:dateFor('12:30'),state:'Demand'}
 ];
 const plan=projectPredbatPlan({attributes:{raw:{time:midnight,rows:rawRows}}});
 assert.deepEqual(plan.map(x=>x.state),['Chrg','HoldChrg','Demand']);
});
test('only fixed Home Assistant state paths are fetched; plan HTML is never sent to clients',async()=>{
 const allowed=new Set(Object.values(resolveEntities()));
 const requests=[];
 const fetchImpl=async url=>{
  const id=decodeURIComponent(url.split('/states/')[1]);requests.push(id);
  return id==='predbat.plan_html'?{ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(record)}:{ok:false};
 };
 const snapshot=await createReader({token:'test',fetchImpl})();
 assert(requests.includes('predbat.plan_html'));
 assert(requests.every(id=>allowed.has(id)||id==='predbat.plan_html'));
 assert.equal(snapshot.plan_rows.length,15);
 assert(!('html' in snapshot));
});
