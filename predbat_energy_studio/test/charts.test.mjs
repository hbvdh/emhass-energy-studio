import test from 'node:test';
import assert from 'node:assert/strict';
import {chartModel} from '../public/mini_charts.js';
test('chart model selects forecast points in the requested horizon',()=>{
 const now=new Date('2026-10-22T11:00:00Z');
 const input=[{name:'grid',color:'#fff',points:[
 {time:'2026-10-22T10:00:00Z',value:2},{time:'2026-10-22T12:00:00Z',value:3},
 {time:'2026-10-22T14:00:00Z',value:4},{time:'2026-10-22T15:00:00Z',value:null}]}];
 assert.deepEqual(chartModel(input,{now,hours:2})[0].points.map(p=>p.value),[3]);
});
test('chart model removes unavailable numbers and sorts time',()=>{
 const now=new Date('2026-10-22T11:00:00Z');
 const data=chartModel([{name:'battery',points:[
 {time:'2026-10-22T12:00:00Z',value:0},
 {time:'2026-10-22T11:05:00Z',value:-5},
 {time:'2026-10-22T11:00:00Z',value:'unavailable'}]}],{now,hours:12});
 assert.deepEqual(data[0].points.map(p=>p.value),[-5,0]);
});
