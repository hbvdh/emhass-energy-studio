// Read-only, fixed-sensor Home Assistant data source. No generic HA proxy.
import {localDayKey,localMidnightUtcMs} from './public/data.js';
import {energyDashboardCost,getCostStatistics} from './ha_stats.mjs';

export const SENSOR_DEFAULTS = Object.freeze({
  import_t1:'sensor.electricity_meter_energy_consumption_tarif_1',
  import_t2:'sensor.electricity_meter_energy_consumption_tarif_2',
  export_t1:'sensor.electricity_meter_energy_production_tarif_1',
  export_t2:'sensor.electricity_meter_energy_production_tarif_2',
  pv_total:'sensor.pylontech_pv_total_energy_safe',
  battery_now:'sensor.pylontech_force_h3x_battery_power',
  grid_now:'sensor.pylontech_force_h3x_grid_total_power',
  import_price:'sensor.actuele_stroomprijs_all_in_2',
 import_cost_t1:'sensor.electricity_meter_energy_consumption_tarif_1_cost',
 import_cost_t2:'sensor.electricity_meter_energy_consumption_tarif_2_cost',
 export_comp_t1:'sensor.electricity_meter_energy_production_tarif_1_compensation',
 export_comp_t2:'sensor.electricity_meter_energy_production_tarif_2_compensation',
});
const ENERGY_KEYS = ['import_t1','import_t2','export_t1','export_t2','pv_total'];
const MONEY_KEYS=['import_cost_t1','import_cost_t2','export_comp_t1','export_comp_t2'];
const HISTORY_KEYS=[...ENERGY_KEYS]; // Costs come from Recorder statistics, not midnight state deltas.
const ENTITY_PATTERN = /^(sensor|input_number)\.[a-z0-9_]+$/;
function reading(value) {
  if(value == null || value === '' || ['unknown','unavailable','none'].includes(String(value).toLowerCase()))return null;
  const num=Number(value);return Number.isFinite(num)?num:null;
}
export function validateEntityConfig(options={}) {
  const values={};
  for(const [name,fallback] of Object.entries(SENSOR_DEFAULTS)) {
    const value=String(options[name] ?? fallback).trim();
    if(value && !ENTITY_PATTERN.test(value))throw new Error(`Invalid configured entity for ${name}`);
    values[name]=value;
  }
  return values;
}
function energyKwh(record) {
  if(!record)return null;
  const value=reading(record.state);if(value===null)return null;
  const unit=String(record.attributes?.unit_of_measurement || 'kWh').trim().toLowerCase();
  if(unit==='kwh')return value;
  if(unit==='wh')return value/1000;
  if(unit==='mwh')return value*1000;
  return null;
}
export function moneyEuro(record){
 if(!record)return null;
 const amount=reading(record.state);if(amount===null)return null;
 const unit=String(record.attributes?.unit_of_measurement||'').trim().toLowerCase();
 // HA energy cost and compensation sensors use the configured HA currency.
 // Only EUR is supported by the EUR-only KPI (do not mislabel other currencies).
 return unit==='eur'||unit==='€'?amount:null;
}
export function deltaMoney(start,end){
 if(start===null||end===null||!Number.isFinite(start)||!Number.isFinite(end))return null;
 // Negative cost deltas are valid with dynamic prices. Never clamp to zero.
 return end-start;
}
export function powerKw(record){
  if(!record)return null;
  const value=reading(record.state);if(value===null)return null;
  const unit=String(record.attributes?.unit_of_measurement||'').trim().toLowerCase();
  if(unit==='kw')return value;
  if(unit==='w')return value/1000;
  return null;
}
export function deltaKwh(start,end) {
  if(start===null||end===null||!Number.isFinite(start)||!Number.isFinite(end)||end<start-.005)return null;
  return Math.max(0,end-start);
}
export function calculateDayActuals({now,midnightSamples,states,entities}) {
  const deltas={};
  for(const key of ENERGY_KEYS) {
    const entity=entities[key];
    deltas[key]=!entity?null:deltaKwh(midnightSamples[entity]??null,energyKwh(states[entity]));
  }
  const sum=(keys)=>keys.every(k=>deltas[k]!==null)?keys.reduce((acc,k)=>acc+deltas[k],0):null;
  return {
    measured_at:now.toISOString(),
    day:localDayKey(now),
    grid_import_kwh:sum(['import_t1','import_t2']),
    grid_export_kwh:sum(['export_t1','export_t2']),
    pv_kwh:deltas.pv_total,
    battery_power_kw:powerKw(states[entities.battery_now]),
    grid_power_kw:powerKw(states[entities.grid_now]),
    current_import_price_eur_kwh:reading(states[entities.import_price]?.state),
    // Actual cost is filled separately from Recorder's hourly statistics.
    import_cost_today_eur:null,
    export_compensation_today_eur:null,
    net_cost_today_eur:null,
    net_cost_status:'statistics_unavailable',
  };
}
export function createHaActuals({token, entities, base='http://supervisor/core/api', fetchImpl=fetch, clock=()=>new Date(), statisticsFetch=getCostStatistics}) {
  const verified=validateEntityConfig(entities);
  const urls=Object.values(verified).filter(Boolean);
  const unique=[...new Set(urls)];
  const canonical=String(base).replace(/\/+$/,'');
  let cached=null,validUntil=0,baselineDay='',baseline=null,inflight=null;
  async function readJson(target){
    const response=await fetchImpl(target,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(9000)});
    if(!response.ok)throw new Error(`Home Assistant API HTTP ${response.status}`);
    const data=await response.text();
    if(data.length>1_000_000)throw new Error('Home Assistant history response too large');
    return JSON.parse(data);
  }
  async function doRead(){
    if(!token)return {status:'unavailable',reason:'Supervisor API token missing'};
    const now=clock();const day=localDayKey(now);const midnight=localMidnightUtcMs(day);
    try {
      let samples=baselineDay===day?baseline:null;
      // One bounded request daily for the five kWh counters only.
      // Cost counters use the Recorder statistics API, avoiding raw state reset errors.
      if(!samples){
        const ids=[...new Set(HISTORY_KEYS.map(k=>verified[k]).filter(Boolean))];
        const url=new URL(`${canonical}/history/period/${encodeURIComponent(new Date(midnight).toISOString())}`);
        url.searchParams.set('filter_entity_id',ids.join(','));
        url.searchParams.set('end_time',new Date(midnight+2000).toISOString());
        url.searchParams.set('minimal_response','');
        url.searchParams.set('no_attributes','');
        const groups=await readJson(url.toString());
        if(!Array.isArray(groups))throw new Error('Unexpected Home Assistant history response');
        samples={};
        for(const group of groups){
          if(!Array.isArray(group)||!group.length)continue;
          const item=group.find(row=>row && row.entity_id && reading(row.state)!==null);
          if(!item)continue;
          // Only use baseline snapshots at or before the start of the day.
          const changed=Date.parse(item.last_changed||item.last_updated||'');
          if(Number.isFinite(changed)&&changed>midnight+2000)continue;
          samples[item.entity_id]=reading(item.state);
        }
        baselineDay=day;baseline=samples;
      }
      const fetched=await Promise.all(unique.map(async entity=>{
        try{return [entity,await readJson(`${canonical}/states/${encodeURIComponent(entity)}`)];}
        catch{return [entity,null];}
      }));
      const states=Object.fromEntries(fetched);
      const result=calculateDayActuals({now,midnightSamples:samples,states,entities:verified});
      // Home Assistant's Energy source table sums Recorder's statistic.change
      // for each hourly period. It does not subtract two raw entity states.
      // Do not replace an unavailable result with the old (potentially wrong) delta.
      const validMoney=MONEY_KEYS.every(key=>moneyEuro(states[verified[key]])!==null);
      if(validMoney){
        try {
          const statistics=await statisticsFetch({token,entities:verified,startTime:new Date(midnight),endTime:now});
          const cost=energyDashboardCost(statistics,verified);
          if(cost)Object.assign(result,cost);
        } catch { /* Preserve safe unavailable status; other KPIs remain usable */ }
      }
      return {status:'ok',...result};
    }catch(e){return {status:'unavailable',reason:e.message};}
  }
  return async function load(){
    const time=clock().getTime();if(cached&&validUntil>time)return cached;
    if(inflight)return inflight;
    inflight=doRead().then(result=>{cached=result;validUntil=clock().getTime()+45_000;return result;}).finally(()=>{inflight=null});
    return inflight;
  };
}
