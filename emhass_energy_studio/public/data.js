// Official EMHASS schema 1.x fields; no Home Assistant state attributes required.
export const TIMEZONE = 'Europe/Amsterdam';
export const MS_15M = 15 * 60 * 1000;
const METRICS = ['P_Load','P_PV','P_batt','P_grid','SOC_opt','unit_load_cost','unit_prod_price'];

export function finiteNumber(input) {
  if (input === null || input === undefined || input === '') return null;
  const n = typeof input === 'number' ? input : Number(input);
  return Number.isFinite(n) ? n : null;
}

export function normalizePlan(source) {
  if (!source || typeof source !== 'object' || source.status !== 'ok' || !Array.isArray(source.plan)) {
    throw new Error('Er is nog geen bruikbaar optimalisatieplan beschikbaar.');
  }
  const schema = source.emhass_schema_version;
  if (schema && String(schema).split('.')[0] !== '1') throw new Error(`Onbekend plan-schema ${schema}; schema 1.x is vereist.`);
  const parsed = source.plan.map(entry => {
    if (!entry || typeof entry !== 'object') return null;
    const date = new Date(entry.timestamp);
    if (!Number.isFinite(date.getTime()) || !/([zZ]|[+-]\d\d:\d\d)$/.test(String(entry.timestamp))) return null;
    const row = { timestamp: date.toISOString(), date };
    for (const field of METRICS) row[field] = finiteNumber(entry[field]);
    // /api/v1/plan returns the DataFrame value: SOC 0..1, not HA entity percent.
    if (row.SOC_opt !== null && row.SOC_opt >= 0 && row.SOC_opt <= 1.000001) row.SOC_opt *= 100;
    return row;
  }).filter(Boolean).sort((a,b) => a.date - b.date);
  const rows = parsed.filter((r,i) => i === 0 || r.date.getTime() !== parsed[i-1].date.getTime());
  if (!rows.length) throw new Error('Het optimalisatieplan bevat geen geldige tijdstippen.');
  return rows;
}

export function validateRun(plan, run, now = new Date()) {
  const warnings = [];
  if (!run || run.status === 'no-run') warnings.push('Geen uitvoeringsstatus beschikbaar.');
  else if (run.status !== 'ok') warnings.push(`Laatste optimalisatie: ${run.status}${run.error_message ? ' (zie EMHASS-log)' : ''}. Het plan kan van een eerdere, geslaagde uitvoering zijn.`);
  if (run?.infeasible) warnings.push('De laatste optimalisatie was niet uitvoerbaar.');
  const generated = new Date(plan.generated_at);
  if (!plan.generated_at || !Number.isFinite(generated.getTime())) warnings.push('Tijdstip van het plan ontbreekt.');
  else {
    const ageMin = (now - generated) / 60000;
    if (ageMin > 35) warnings.push(`Plan is ${Math.round(ageMin)} minuten oud (verwacht elke 15 minuten).`);
    if (ageMin < -5) warnings.push('Het plantijdstip ligt in de toekomst; controleer de systeemtijd.');
  }
  if (run?.status === 'ok' && run.timestamp && plan.generated_at) {
    const diff = Math.abs(new Date(run.timestamp).getTime() - generated.getTime());
    if (!Number.isFinite(diff) || diff > 3000) warnings.push('Laatste run en plan hebben verschillende generatietijden.');
  }
  if (run?.schema_version && plan.emhass_schema_version && run.schema_version !== plan.emhass_schema_version) {
    warnings.push('Plan-schema wijkt af van het schema van de laatste run.');
  }
  return warnings;
}

export function timeStepHours(rows) {
  if (rows.length < 2) return .25;
  const diffs = rows.slice(1).map((row, i) => (row.date - rows[i].date) / 3600000)
    .filter(x => x > 0 && x <= 1).sort((a,b) => a - b);
  return diffs.length ? diffs[Math.floor(diffs.length / 2)] : .25;
}

export function computeStats(rows) {
  if (!rows.length) return { cost: null, pv: null, imp: null, maxSoc: null };
  const step = timeStepHours(rows);
  let cost = 0, pv = 0, imp = 0, knownPrice = false, knownPV = false, knownGrid = false;
  let maxSoc = null;
  rows.forEach((r, i) => {
    const dt = i < rows.length - 1 ? Math.min(step * 2, Math.max(0, (rows[i+1].date - r.date) / 3600000)) : step;
    if (r.P_PV !== null) { pv += Math.max(0, r.P_PV) / 1000 * dt; knownPV = true; }
    if (r.P_grid !== null) {
      const positive = Math.max(0,r.P_grid), negative = Math.max(0,-r.P_grid);
      imp += positive / 1000 * dt; knownGrid = true;
      if (positive === 0 || r.unit_load_cost !== null) {
        if (negative === 0 || r.unit_prod_price !== null) {
          cost += (positive * (r.unit_load_cost || 0) - negative * (r.unit_prod_price || 0)) / 1000 * dt;
          knownPrice = true;
        }
      }
    }
    if (r.SOC_opt !== null) maxSoc = maxSoc === null ? r.SOC_opt : Math.max(maxSoc, r.SOC_opt);
  });
  return { cost: knownPrice ? cost : null, pv: knownPV ? pv : null, imp: knownGrid ? imp : null, maxSoc };
}


// Date-only partitioning in Europe/Amsterdam (including 23- and 25-hour DST days).
const amsterdamDayFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
});
export function localDayKey(date) {
  const parts = Object.fromEntries(amsterdamDayFormatter.formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function nextDayKey(key) {
  return new Date(Date.parse(`${key}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
}
// Locate the first UTC millisecond of a specified local calendar day.
// Binary search avoids incorrect fixed +01:00/+02:00 assumptions around DST.
export function localMidnightUtcMs(key) {
  const nominal = Date.parse(`${key}T00:00:00Z`);
  let low = nominal - 12 * 3600000, high = nominal + 12 * 3600000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (localDayKey(new Date(mid)) >= key) high = mid;
    else low = mid;
  }
  return high;
}

function forecastCostInWindow(rows, startMs, endMs) {
  if (!rows.length || !(endMs > startMs)) return { cost: null, partial: true };
  const stepMs = timeStepHours(rows) * 3600000;
  let cost = 0, coveredMs = 0, invalid = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const t = r.date.getTime();
    const intervalMs = i < rows.length - 1
      ? Math.min(stepMs * 2, Math.max(0, rows[i + 1].date.getTime() - t))
      : stepMs;
    const overlapMs = Math.max(0, Math.min(endMs, t + intervalMs) - Math.max(startMs, t));
    if (!overlapMs) continue;
    coveredMs += overlapMs;
    const grid = r.P_grid;
    if (grid === null || (grid > 0 && r.unit_load_cost === null) || (grid < 0 && r.unit_prod_price === null)) {
      invalid = true;
      continue;
    }
    cost += (Math.max(0, grid) * (r.unit_load_cost ?? 0)
      - Math.max(0, -grid) * (r.unit_prod_price ?? 0)) / 1000 * overlapMs / 3600000;
  }
  // Missing a whole interval or more is reported as a partial forecast, not a full day.
  const partial = coveredMs < (endMs - startMs) - Math.min(stepMs, MS_15M);
  return { cost: coveredMs && !invalid ? cost : null, partial };
}

// Day cards are independent of the selected 12/24/48h chart filter.
// Today means ONLY the remaining planned hours, not historical actual costs.
export function computeDailyCostForecasts(rows, now = new Date()) {
  const today = localDayKey(now);
  const tomorrowStart = localMidnightUtcMs(nextDayKey(today));
  const dayAfterTomorrow = localMidnightUtcMs(nextDayKey(nextDayKey(today)));
  return {
    today: forecastCostInWindow(rows, now.getTime(), tomorrowStart),
    tomorrow: forecastCostInWindow(rows, tomorrowStart, dayAfterTomorrow)
  };
}

export function createDemo(now = new Date()) {
  const start = Math.ceil(now.getTime() / MS_15M) * MS_15M;
  let soc = 36;
  const plan = Array.from({length:192}, (_, i) => {
    const date = new Date(start + i * MS_15M);
    const hour = Number(new Intl.DateTimeFormat('en-GB', { hour:'numeric',hourCycle:'h23', timeZone:TIMEZONE }).format(date));
    const quarter = i % 4;
    const daylight = Math.max(0, Math.sin(Math.PI * (hour + quarter / 4 - 7) / 10));
    const solar = daylight * (2300 + 390 * Math.sin(i * .53)) * (0.8 + 0.18 * Math.sin(i / 3));
    const load = 420 + 180 * Math.sin(i * .75) ** 2 + (hour >= 17 && hour < 22 ? 600 : 0) + (hour > 7 && hour < 9 ? 310 : 0);
    const price = hour >= 12 && hour <= 15 ? .07 : hour >= 17 && hour <= 21 ? .33 : hour >= 0 && hour <= 5 ? .12 : .22;
    let battery = 0;
    if ((hour >= 3 && hour < 5) || (hour >= 12 && hour < 14)) battery = soc < 96 ? -2800 - 450 * Math.sin(i) : 0;
    if (hour >= 17 && hour < 23 && soc > 12) battery = 1250 + 250 * Math.sin(i / 2);
    soc = Math.max(10, Math.min(100, soc - battery / 1000 * .25 / 15 * 100));
    const grid = load - solar - battery; // P_batt positive discharge; net import = load - PV - battery
    return { timestamp:date.toISOString(), P_Load:Math.round(load), P_PV:Math.round(solar), P_batt:Math.round(battery), SOC_opt:Number((soc / 100).toFixed(4)), P_grid:Math.round(grid), unit_load_cost:price, unit_prod_price:price - .045 };
  });
  return { plan:{ status:'ok',emhass_schema_version:'1.0',generated_at:new Date(start - MS_15M).toISOString(),plan },run:{ status:'ok', timestamp:new Date(start-MS_15M).toISOString(), action:'naive-mpc-optim', emhass_version:'0.18.6', schema_version:'1.0',duration_total_seconds:1.4,infeasible:false,error_message:null } };
}
