// Query the same hourly Recorder statistics used by Home Assistant's daily Energy table.
// No access to arbitrary commands: a single fixed, read-only statistics query.
const MONEY_KEYS = ['import_cost_t1','import_cost_t2','export_comp_t1','export_comp_t2'];

export function statisticGrowth(rows) {
  if (!Array.isArray(rows)) return null;
  let total = null;
  for (const row of rows) {
    if (!row || row.change == null) continue;
    if (typeof row.change !== 'number' || !Number.isFinite(row.change)) return null;
    total = (total ?? 0) + row.change;
  }
  return total;
}

export function energyDashboardCost(stats, entities) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null;
  const changes = {};
  for (const key of MONEY_KEYS) {
    const entity = entities[key];
    if (!entity || !Object.hasOwn(stats, entity)) return null;
    changes[key] = statisticGrowth(stats[entity]);
    if (changes[key] === null) return null;
  }
  const importCost = changes.import_cost_t1 + changes.import_cost_t2;
  const exportCompensation = changes.export_comp_t1 + changes.export_comp_t2;
  const netCost = importCost - exportCompensation;
  if (![importCost, exportCompensation, netCost].every(Number.isFinite)) return null;
  return {import_cost_today_eur:importCost, export_compensation_today_eur:exportCompensation, net_cost_today_eur:netCost, net_cost_status:'ok'};
}

export async function getCostStatistics({token, entities, startTime, endTime, wsUrl='ws://supervisor/core/websocket', WebSocketImpl=globalThis.WebSocket, timeoutMs=9000}) {
  if (!token || !WebSocketImpl) throw new Error('HA statistics connection not configured');
  const statistic_ids = MONEY_KEYS.map(key=>entities[key]);
  if (statistic_ids.some(id=>!id)) throw new Error('Cost entity not configured');
  return new Promise((resolve, reject)=>{
    const ws = new WebSocketImpl(wsUrl);
    let finished = false;
    const stop=(error,result)=>{
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      if (error) reject(error); else resolve(result);
    };
    const timer=setTimeout(()=>stop(new Error('HA statistics request timed out')),timeoutMs);
    ws.addEventListener('error',()=>stop(new Error('HA statistics socket error')));
    ws.addEventListener('close',()=>stop(new Error('HA statistics socket closed')));
    ws.addEventListener('message',event=>{
      if (finished) return;
      try {
        const raw = typeof event.data === 'string' ? event.data : String(event.data);
        if (raw.length>1_000_000) throw Error('HA statistics response too large');
        const message=JSON.parse(raw);
        if (message.type==='auth_required') {
          ws.send(JSON.stringify({type:'auth',access_token:token}));
        } else if (message.type==='auth_ok') {
          ws.send(JSON.stringify({id:1,type:'recorder/statistics_during_period',start_time:startTime.toISOString(),end_time:endTime.toISOString(),statistic_ids,period:'hour',types:['change']}));
        } else if (message.type==='auth_invalid') {
          stop(new Error('HA statistics authentication rejected'));
        } else if (message.type==='result' && message.id===1) {
          if (!message.success) throw Error('HA statistics query failed');
          stop(null,message.result);
        }
      } catch (e) { stop(e); }
    });
  });
}
