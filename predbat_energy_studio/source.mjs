// Fixed, read-only Home Assistant Predbat data adapter. No arbitrary entity proxy.
export const FIELDS = Object.freeze({
 status:'status', active:'', soc_now:'soc_kw_h0', soc_best:'soc_kw_best', soc_base:'soc_kw',
 battery:'battery_power', battery_best:'battery_power_best', grid:'grid_power', grid_best:'grid_power_best',
 pv:'pv_power', pv_best:'pv_power_best', load:'load_power', load_best:'load_power_best',
 best_metric:'best_metric', base_metric:'metric', cost_today:'cost_today',
 best_charge_limit:'best_charge_limit', best_charge_start:'best_charge_start', best_charge_end:'best_charge_end',
 best_export_start:'best_export_start', best_export_end:'best_export_end',
 pv_today:'pv_energy_h0', import_today:'import_energy_h0', export_today:'export_energy_h0',
 inverter_config:'', solar_forecast:'',
});
const DOMAIN_ID=/^[a-z0-9_]+$/;
export function resolveEntities(prefix='predbat',socEntity='') {
 if (!DOMAIN_ID.test(prefix)) throw new Error('Predbat prefix must contain only lowercase letters, digits or underscores');
 if(socEntity&&!/^(sensor|input_number)\.[a-z0-9_]+$/.test(socEntity)) throw new Error('Invalid battery_soc_entity');
 return Object.fromEntries(Object.entries(FIELDS).map(([key,suffix])=>[key,
  key==='active' ? `switch.${prefix}_active` :
  key==='inverter_config' ? 'sensor.predbat_inverter_config' :
  key==='solar_forecast' ? 'sensor.predbat_pv_today' :
  key==='status' ? `${prefix}.status` : `${prefix}.${suffix}`
 ]).concat(socEntity?[['battery_soc_percent',socEntity]]:[]));
}
function finiteNumber(value) {
 if(value===null||value===undefined||value===''||['unknown','unavailable','none'].includes(String(value).toLowerCase()))return null;
 const n=Number(value);return Number.isFinite(n)?n:null;
}
export function parseResults(results) {
 const pairs=Array.isArray(results) ? results.map(r=>Array.isArray(r)?r:[r?.time??r?.timestamp??r?.start,r?.value??r?.state]) : results&&typeof results==='object' ? Object.entries(results) : [];
 const seen=new Map();
 for(const [time,value] of pairs.slice(0,900)) {
  if(typeof time!=='string'||time.length>48||!/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(time))continue;
  const n=finiteNumber(value);if(n===null)continue;
  seen.set(time,n);
 }
 return [...seen.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(0,600).map(([time,value])=>({time,value}));
}
function summary(record){
 if(!record||!record.entity_id)return null;
 const attr=record.attributes||{};
 return {
  value:finiteNumber(record.state),
  text: typeof record.state==='string'?record.state.slice(0,220):String(record.state??''),
  unit:typeof attr.unit_of_measurement==='string'?attr.unit_of_measurement.slice(0,20):'',
  updated:record.last_updated||record.last_changed||null,
 };
}
export function normalizeStates(states,entities,clock=new Date()) {
 const scalar={},series={};
 for (const [key,id] of Object.entries(entities)) {
  const record=states[id]||null;
  scalar[key]=summary(record);
  if(['soc_best','soc_base','battery_best','grid_best','pv_best','load_best','best_metric','base_metric'].includes(key)) {
   series[key]=parseResults(record?.attributes?.results);
  }
 }
 const statusAttr=states[entities.status]?.attributes||{};
 const version=String(statusAttr.version??statusAttr.Version??'').slice(0,80);
 const runState=String(statusAttr.run_state??'').slice(0,160);
 const config=states[entities.inverter_config]?.attributes||{};
 const capacity=finiteNumber(config.soc_max);
 const percent=scalar.battery_soc_percent?.value??(capacity>0&&scalar.soc_now?.value != null ? scalar.soc_now.value/capacity*100:null);
 const saved=scalar.base_metric?.value != null&&scalar.best_metric?.value != null&&scalar.base_metric?.unit===scalar.best_metric?.unit ? scalar.base_metric.value-scalar.best_metric.value:null;
 const available=!!(scalar.status||scalar.soc_best||scalar.best_metric||scalar.soc_now);
 return {source:'home_assistant',status:available?'ok':'unavailable',observed_at:clock.toISOString(),
  prefix:entities.status?.split('.')[0]||'predbat', version,run_state:runState,
  capacity_kwh:capacity, soc_percent:percent===null?null:Math.max(0,Math.min(100,percent)),
  estimated_saving:saved, scalar, series,
  missing:Object.entries(entities).filter(([key,id])=>!states[id]&&key!=='battery_soc_percent').map(([key])=>key),
 };
}
export function createReader({token,base='http://supervisor/core/api',prefix='predbat',socEntity='',fetchImpl=fetch,clock=()=>new Date(),ttlMs=60000}={}){
 const entities=resolveEntities(prefix,socEntity);
 const api=base.replace(/\/+$/,'');let cached=null,expiry=0,pending=null;
 async function fetchState(id){
  try{
   const response=await fetchImpl(`${api}/states/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(8000)});
   if(!response.ok)return null;
   const raw=await response.text();if(raw.length>150000) return null;
   const record=JSON.parse(raw);return record?.entity_id===id?record:null;
  }catch{return null;}
 }
 async function collect(){
  if(!token)return {status:'unavailable',reason:'Home Assistant Supervisor token unavailable'};
  const ids=[...new Set(Object.values(entities))];const results={};
  // Limit concurrent requests to avoid flooding Home Assistant.
  for(let k=0;k<ids.length;k+=6){
   await Promise.all(ids.slice(k,k+6).map(async id=>{const state=await fetchState(id);if(state)results[id]=state;}));
  }
  return normalizeStates(results,entities,clock());
 }
 return async()=>{
  if(cached&&expiry>clock().getTime())return cached;
  if(pending)return pending;
  pending=collect().then(data=>{cached=data;expiry=clock().getTime()+ttlMs;return data;}).finally(()=>{pending=null;});
  return pending;
 };
}
