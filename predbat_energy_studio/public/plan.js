// A compact, read-only projection of Predbat's published plan_html.attributes.raw.rows.
// Predbat itself decides Chrg, HoldChrg, Demand, etc. We do not infer states
// from power forecasts or from the next forced charge interval.
const PLAN_STATES = new Set(['Demand','Chrg','HoldChrg','FrzChrg','Exp','HoldExp','FrzExp','Chrg/Exp']);
export function parsedDate(time) {
  if (typeof time !== 'string' || time.length > 64 || !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d/.test(time)) return null;
  const result = new Date(time.replace(' ', 'T'));
  return Number.isFinite(result.getTime()) ? result : null;
}
export function projectPredbatPlan(record) {
  const raw = record?.attributes?.raw;
  if (!raw || !Array.isArray(raw.rows)) return [];
  const midnight=parsedDate(raw.time);
  const plan=[];
  // Predbat renders consecutive rows as one state cell via rowspan_state.
  // Rows with skip_state_cell are hidden by that merged cell; their raw
  // 'state' may differ, but the visible plan continues the previous state.
  let visibleState=null;
  for(const row of raw.rows.slice(0,600)) {
    const date=parsedDate(row?.time);
    if (!date) continue;
    const hidden=row.skip_state_cell===true;
    const displayState=hidden && visibleState ? visibleState : row.state;
    if (!PLAN_STATES.has(displayState)) continue;
    if (!hidden) visibleState=displayState;
    let start=date;
    // Predbat renders the first active row as the current minute, but its slot
    // began at the original slot_minute. Preserve that boundary when plausible.
    if (!plan.length && midnight && Number.isInteger(row.slot_minute) && row.slot_minute>=0 && row.slot_minute<=5760) {
      const aligned=new Date(midnight.getTime()+row.slot_minute*60000);
      const drift=date-aligned;
      if (drift>=0 && drift<30*60000) start=aligned;
    }
    plan.push({time:start.toISOString(),state:displayState});
  }
  return plan;
}
export function groupPredbatPlan(rows, {now=new Date(), horizonHours=24, maxWindows=8}={}) {
  if (!Array.isArray(rows))return [];
  const endMs=now.getTime()+Math.max(1,Math.min(48,Number(horizonHours)||24))*3600000;
  const parsed=[];
  for(const row of rows.slice(0,600)){
    const date=parsedDate(row?.time);
    if (!date || !PLAN_STATES.has(row?.state)) continue;
    parsed.push({start:date,state:row.state});
  }
  parsed.sort((a,b)=>a.start-b.start);
  const windows=[];
  for(const row of parsed) {
    const previous=windows.at(-1);
    if(previous && previous.state===row.state)continue;
    if(previous)previous.end=row.start;
    windows.push({state:row.state,start:row.start,end:null});
  }
  return windows.filter(w=>(w.end===null||w.end.getTime()>now.getTime())&&w.start.getTime()<endMs).slice(0,maxWindows);
}
