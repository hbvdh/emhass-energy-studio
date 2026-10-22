// Predbat's best_*_start/end states contain time-of-day only; the full date
// comes from attributes.timestamp. Only use complete timestamps here.
const FIVE_MINUTES = 5 * 60_000;
const POWER_THRESHOLD_KW = 0.25;

export function parsePredbatTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(value)) return null;
  const date = new Date(value.replace(' ', 'T'));
  return Number.isFinite(date.getTime()) ? date : null;
}
function explicitWindow(scalar, startKey, endKey, kind, nowMs, endMs) {
  const start = parsePredbatTimestamp(scalar[startKey]?.timestamp || scalar[startKey]?.text);
  const end = parsePredbatTimestamp(scalar[endKey]?.timestamp || scalar[endKey]?.text);
  if (!start || !end || end <= start || end.getTime() <= nowMs || start.getTime() >= endMs) return null;
  return {kind, source:'forced', start, end};
}
function activityWindows(points, nowMs, endMs) {
  if (!Array.isArray(points)) return [];
  const windowPoints = points.map(p => ({date:parsePredbatTimestamp(p?.time), value:p?.value}))
    .filter(p => p.date && typeof p.value === 'number' && Number.isFinite(p.value) && p.date.getTime() >= nowMs - FIVE_MINUTES && p.date.getTime() < endMs)
    .sort((a,b)=>a.date-b.date);
  const windows=[];
  let current=null;
  const close=()=>{
    if (!current) return;
    if (current.end - current.start >= 15*60_000) windows.push({kind:current.kind,source:'forecast',start:new Date(current.start),end:new Date(current.end)});
    current=null;
  };
  for (const p of windowPoints) {
    const time=p.date.getTime();
    const kind=p.value <= -POWER_THRESHOLD_KW ? 'charge' : p.value >= POWER_THRESHOLD_KW ? 'discharge' : null;
    if (!kind) {close();continue;}
    if (current && (kind!==current.kind || time-current.last > 7.5*60_000)) close();
    if (!current) current={kind,start:time,end:time+FIVE_MINUTES,last:time};
    else {current.last=time;current.end=time+FIVE_MINUTES;}
  }
  close();
  return windows;
}
export function upcomingPredbatWindows({scalar={},series={},now=new Date(),horizonHours=24,maxWindows=5}={}) {
  const nowMs=now.getTime();
  if (!Number.isFinite(nowMs)) return [];
  const endMs=nowMs+Math.min(48,Math.max(1,horizonHours))*3600_000;
  const forced=[
    explicitWindow(scalar,'best_charge_start','best_charge_end','charge',nowMs,endMs),
    explicitWindow(scalar,'best_export_start','best_export_end','export',nowMs,endMs),
  ].filter(Boolean);
  const forecast=activityWindows(series.battery_best,nowMs,endMs)
    // A predicted activity interval inside a known forced window is not a second action.
    .filter(w=>!forced.some(f=>w.start<f.end && w.end>f.start));
  return [...forced,...forecast].sort((a,b)=>a.start-b.start || (a.source==='forced'?-1:1)).slice(0,Math.max(0,maxWindows));
}
