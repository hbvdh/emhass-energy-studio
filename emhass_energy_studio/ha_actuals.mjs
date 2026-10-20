
import {localDayKey,localMidnightUtcMs} from './public/data.js';
export const SENSOR_DEFAULTS=Object.freeze({
 import_t1:'sensor.electricity_meter_energy_consumption_tarif_1',
 import_t2:'sensor.electricity_meter_energy_consumption_tarif_2',
 export_t1:'sensor.electricity_meter_energy_production_tarif_1',
 export_t2:'sensor.electricity_meter_energy_production_tarif_2',
 pv_total:'sensor.pylontech_pv_total_energy_safe',
 battery_now:'sensor.pylontech_force_h3x_battery_power',
 grid_now:'sensor.pylontech_force_h3x_grid_total_power',
 import_price:'sensor.actuele_stroomprijs_all_in_2'
});
const ENERGY_KEYS=['import_t1','import_t2','export_t1','export_t2','pv_total'];
function reading(value){
 if(value==null||value===''||['unknown','unavailable','none'].includes(String(value).toLowerCase()))return null;
 const n=Number(value);return Number.isFinite(n)?n:null;
}
export function validateEntityConfig(options={}){
 const values={};
 for(const [key,fallback] of Object.entries(SENSOR_DEFAULTS)){
  const value=String(options[key]??fallback).trim();
  if(value&&!/^(sensor|input_number)\.[a-z0-9_]+$/.test(value))throw new Error('Invalid entity ID: '+key);
  values[key]=value;
 }
 return values;
}
function energyKwh(record){
 if(!record)return null;
 const v=reading(record.state);if(v===null)return null;
 const u=String(record.attributes?.unit_of_measurement||'kWh').trim().toLowerCase();
 return u==='kwh'?v:u==='wh'?v/1000:u==='mwh'?v*1000:null;
}
export function powerKw(record){
 if(!record)return null;
 const v=reading(record.state);if(v===null)return null;
 const u=String(record.attributes?.unit_of_measurement||'').trim().toLowerCase();
 return u==='kw'?v:u==='w'?v/1000:null;
}
export function deltaKwh(start,end){
 if(start===null||end===null||!Number.isFinite(start)||!Number.isFinite(end)||end<start-.005)return null;
 return Math.max(0,end-start);
}
export function calculateDayActuals({now,midnightSamples,states,entities}){
 const amounts={};
 for(const key of ENERGY_KEYS){
  const id=entities[key];
  amounts[key]=!id?null:deltaKwh(midnightSamples[id]??null,energyKwh(states[id]));
 }
 const sum=keys=>keys.every(k=>amounts[k]!==null)?keys.reduce((a,k)=>a+amounts[k],0):null;
 return {measured_at:now.toISOString(),day:localDayKey(now),
  grid_import_kwh:sum(['import_t1','import_t2']),
  grid_export_kwh:sum(['export_t1','export_t2']),
  pv_kwh:amounts.pv_total,
  battery_power_kw:powerKw(states[entities.battery_now]),
  grid_power_kw:powerKw(states[entities.grid_now]),
  current_import_price_eur_kwh:reading(states[entities.import_price]?.state),
  net_cost_today_eur:null,
  net_cost_status:'historical_tariff_and_export_compensation_required'
 };
}
export function createHaActuals({token,entities,base='http://supervisor/core/api',fetchImpl=fetch,clock=()=>new Date()}){
 const conf=validateEntityConfig(entities),ids=[...new Set(Object.values(conf).filter(Boolean))];
 const urlBase=String(base).replace(/\/+$/,'');
 let cached=null,until=0,baselineDay='',baseline=null,inflight=null;
 async function json(url){
  const res=await fetchImpl(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(9000)});
  if(!res.ok)throw Error('HA HTTP '+res.status);
  const body=await res.text();if(body.length>1000000)throw Error('HA history response too large');
  return JSON.parse(body);
 }
 async function read(){
  if(!token)return {status:'unavailable',reason:'Supervisor token missing'};
  const now=clock(),day=localDayKey(now),midnight=localMidnightUtcMs(day);
  try{
   let samples=baselineDay===day?baseline:null;
   if(!samples){
    const energy=[...new Set(ENERGY_KEYS.map(k=>conf[k]).filter(Boolean))];
    const uri=new URL(urlBase+'/history/period/'+encodeURIComponent(new Date(midnight).toISOString()));
    uri.searchParams.set('filter_entity_id',energy.join(','));
    uri.searchParams.set('end_time',new Date(midnight+2000).toISOString());
    uri.searchParams.set('minimal_response','');
    uri.searchParams.set('no_attributes','');
    const groups=await json(uri.toString());
    if(!Array.isArray(groups))throw Error('Invalid HA history response');
    samples={};
    for(const group of groups){
     if(!Array.isArray(group)||!group.length)continue;
     const r=group.find(x=>x&&x.entity_id&&reading(x.state)!==null);
     if(!r)continue;
     const t=Date.parse(r.last_changed||r.last_updated||'');
     if(Number.isFinite(t)&&t>midnight+2000)continue;
     samples[r.entity_id]=reading(r.state);
    }
    baseline=samples;baselineDay=day;
   }
   const pairs=await Promise.all(ids.map(async entity=>{
    try{return [entity,await json(urlBase+'/states/'+encodeURIComponent(entity))]}
    catch{return [entity,null]}
   }));
   return {status:'ok',...calculateDayActuals({now,midnightSamples:samples,states:Object.fromEntries(pairs),entities:conf})};
  }catch(e){return {status:'unavailable',reason:e.message}}
 }
 return async function load(){
  const now=clock().getTime();if(cached&&until>now)return cached;
  if(inflight)return inflight;
  inflight=read().then(x=>{cached=x;until=clock().getTime()+45000;return x}).finally(()=>{inflight=null});
  return inflight;
 };
}
