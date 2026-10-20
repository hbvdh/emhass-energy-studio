import { TIMEZONE, normalizePlan, validateRun, computeStats, computeDailyCostForecasts, remainingEnergyToday, createDemo } from './data.js';
import { resolveLanguage, normalizeLanguageTag, t, translateStatic } from './i18n.js';

const $ = id => document.getElementById(id);
let language = 'nl';
let languagePreference = 'auto';
let appliedLanguage = null;
let formatter, shortDate, axisDate;
const translation = (key, values) => t(language, key, values);
function configureFormatters() {
  const locale = language === 'nl' ? 'nl-NL' : 'en-GB';
  formatter = new Intl.DateTimeFormat(locale, { timeZone:TIMEZONE, weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'shortOffset' });
  shortDate = new Intl.DateTimeFormat(locale, { timeZone:TIMEZONE, day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit' });
  axisDate = new Intl.DateTimeFormat(locale, { timeZone:TIMEZONE,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit' });
}
const num = (n,d=1) => n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat(language === 'nl' ? 'nl-NL' : 'en-GB',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const eur = n => n === null ? '—' : new Intl.NumberFormat(language === 'nl' ? 'nl-NL' : 'en-GB',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const fmtPower = n => n === null ? '—' : `${num(n/1000,2)} kW`;
const fmtPrice = n => n === null ? '—' : `${num(n,3)} €`;

const state = { actuals:null, mode:'live', plan:null, run:null, rows:[], visible:[], selected:null, hovered:null, tooltipPinned:false, hours:24, filter:'all',query:'',page:0,sortAsc:true,disabledSeries:new Set(), warnings:[], loading:false };
const PAGE_SIZE=28;
const chartDefs=[
  {id:'chart-energy',kind:'energy',series:[{field:'P_Load',label:'field.load',color:'#9b90ff'},{field:'P_PV',label:'PV',color:'#29dac5',area:true},{field:'P_grid',label:'field.grid',color:'#f7b86d'}]},
  {id:'chart-battery',kind:'battery',series:[{field:'P_batt',label:'field.battery',color:'#9b90ff',area:true}]},
  {id:'chart-soc',kind:'soc',series:[{field:'SOC_opt',label:'SOC',color:'#68d9ba',area:true}]},
  {id:'chart-price',kind:'price',series:[{field:'unit_load_cost',label:'field.buy',color:'#f3c56a'},{field:'unit_prod_price',label:'field.sell',color:'#42b6f6'}]},
];

function setText(id, value) { $(id).textContent=String(value); }
function showMessage(message) { $('message').textContent=message; $('message').classList.toggle('hidden',!message); }
function status(color,label,detail) {
  for (const id of ['run-dot','sidebar-dot']) $(id).className=`status-dot ${color}`;
  setText('run-status',label); setText('run-detail',detail);
  setText('sidebar-connection',state.mode==='demo'?translation('status.demoConnection'):color==='good'?translation('status.connected'):color==='bad'?translation('status.problem'):translation('status.warning'));
}
function updateModes() {
  $('live-mode').classList.toggle('active',state.mode==='live'); $('demo-mode').classList.toggle('active',state.mode==='demo');
  $('live-mode').textContent=state.mode==='live'?'● Live':'○ Live'; $('demo-mode').textContent=state.mode==='demo'?'● Demo':'○ Demo';
}
function getVisibleRows() {
  if (!state.rows.length) return [];
  const begin = Math.max(state.rows[0].date.getTime(), Math.floor(Date.now()/900000)*900000);
  // With rolling MPC show the planning from the present; allow full historical sample when demo.
  const anchor = state.mode==='demo' ? state.rows[0].date.getTime() : begin;
  let result = state.rows.filter(r => r.date.getTime() >= anchor && r.date.getTime() < anchor + state.hours*3600000);
  if (!result.length && state.rows.length) result = state.rows.slice(0,Math.min(state.rows.length,state.hours*4));
  return result;
}
function updateView() {
  hideTooltip();
  state.visible=getVisibleRows();
  if (state.selected===null || !state.visible.some(r=>r.timestamp===state.selected)) {
    state.selected = state.visible.length ? state.visible[Math.min(4,state.visible.length-1)].timestamp : null;
  }
  const stats=computeStats(state.visible);
  // Daily cost cards always use the full source plan, not the chart-hour selection.
  const daily = computeDailyCostForecasts(state.rows);
  setText('kpi-cost-today',eur(daily.today.cost));
  setText('kpi-cost-tomorrow',eur(daily.tomorrow.cost));
  setText('kpi-today-desc',translation(daily.today.partial ? 'cost.today.partial' : 'cost.today.full'));
  setText('kpi-tomorrow-desc',translation(daily.tomorrow.partial ? 'cost.tomorrow.partial' : 'cost.tomorrow.full'));
  const actual=state.mode==='live' && state.actuals?.status==='ok'?state.actuals:null;
  const energyMeasures=[
    ['pv','P_PV',actual?.pv_kwh ?? null],
    ['import','P_grid',actual?.grid_import_kwh ?? null],
  ];
  for(const [name,field,measured] of energyMeasures){
    const prediction=remainingEnergyToday(state.rows,field);
    const remaining=prediction.kwh;
    const total=measured!==null&&remaining!==null?measured+remaining:null;
    const formatKwh=value=>value===null?'—':`${num(value,1)} kWh`;
    setText(`kpi-${name}-actual`,formatKwh(measured));
    setText(`kpi-${name}-remaining`,formatKwh(remaining));
    setText(`kpi-${name}-total`,formatKwh(total));
    setText(`kpi-${name}`,formatKwh(total ?? remaining));
    $(`kpi-${name}`).title=prediction.partial?translation('summary.partial'):'';
  }
  const actualCost=actual?.net_cost_today_eur ?? null;
  const projectedCost=actualCost!==null&&daily.today.cost!==null?actualCost+daily.today.cost:null;
  setText('kpi-cost-actual',eur(actualCost));
  setText('kpi-cost-remaining',eur(daily.today.cost));
  setText('kpi-cost-total',eur(projectedCost));
  setText('kpi-cost-today',eur(projectedCost??daily.today.cost));
  if(projectedCost!==null) {
    setText('kpi-today-desc',translation(daily.today.partial?'cost.today.estimatedPartial':'cost.today.estimated'));
  }
  setText('kpi-cost-note',translation(actualCost!==null?'summary.costHourly':'summary.costIncomplete'));
  $('kpi-cost-note').hidden=false;
  setText('kpi-soc',stats.maxSoc===null?'—':`${num(stats.maxSoc,0)} %`);
  updateLiveCards();

  for(const def of chartDefs) drawChart(def);
  updateSelection(); renderTable();
}
function updateLiveCards(){
  const live=state.mode==='live'&&state.actuals?.status==='ok'?state.actuals:null;
  const batt=live?.battery_power_kw ?? null;
  const grid=live?.grid_power_kw ?? null;
  const render=(key,value,isBattery)=>{
    const good=value!==null&&Number.isFinite(value);
    const significant=good&&Math.abs(value)>=0.06;
    const status=!good?'unavailable':!significant?'idle':isBattery?(value>0?'discharging':'charging'):(value>0?'import':'export');
    setText(`live-${key}-value`,good?`${num(Math.abs(value),2)} kW`:'—');
    setText(`live-${key}-state`,translation(`live.${status}`));
    const card=$(`live-${key}-value`).closest('.live-card');
    card.dataset.state=status;
    setText(`live-${key}-icon`,status==='charging'?'↓':status==='discharging'?'↑':status==='import'?'⇦':status==='export'?'⇨':'⇄');
  };
  render('battery',batt,true);
  render('grid',grid,false);
  setText('live-refreshed',live?.measured_at?translation('live.updated',{time:new Intl.DateTimeFormat(language==='nl'?'nl-NL':'en-GB',{timeZone:TIMEZONE,hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(live.measured_at))}):'—');
}
function updateSelection() {
  const row = state.visible.find(r=>r.timestamp===state.selected);
  setText('sel-datetime',row?formatter.format(row.date):'—');
  setText('sel-pv',row?fmtPower(row.P_PV):'—'); setText('sel-load',row?fmtPower(row.P_Load):'—');
  setText('sel-battery',row?fmtPower(row.P_batt):'—'); setText('sel-grid',row?fmtPower(row.P_grid):'—');
  setText('sel-soc',row?.SOC_opt===null||!row? '—':`${num(row.SOC_opt,1)}%`);
  for(const def of chartDefs) updateGuide(def);
  document.querySelectorAll('#table-body tr[data-time]').forEach(tr=>tr.classList.toggle('current',tr.dataset.time===state.selected));
}
function transform(value,kind) { return value===null ? null : ['battery','energy'].includes(kind)?value/1000:value; }
function gridLayout(containerWidth) { return {W:Math.max(260,Math.round(containerWidth)),H:260,L:52,R:17,T:15,B:39}; }
function safe(n) {return Number.isFinite(n)?Number(n.toFixed(2)):0;}
function pathFor(rows,s,kind,X,Y) {
  let d=''; let active=false;
  for(let i=0;i<rows.length;i++) {
    const v=transform(rows[i][s.field],kind); if(v===null || !Number.isFinite(v)) {active=false;continue;}
    const x=safe(X(i)), y=safe(Y(v)); d+=`${active?'L':'M'}${x},${y} `;active=true;
  }
  return d;
}
function drawChart(def) {
  const el=$(def.id), rows=state.visible, {W,H,L,R,T,B}=gridLayout(el.clientWidth);
  el.innerHTML='';
  if(!rows.length) {
    const msg=document.createElement('div');msg.style.cssText='height:100%;display:grid;place-items:center;color:var(--muted);font-size:12px;';
    msg.textContent=translation('chart.empty');el.append(msg);return;
  }
  const enabled=def.series.filter(s=>!state.disabledSeries.has(s.field));
  const available=enabled.flatMap(s=>rows.map(r=>transform(r[s.field],def.kind)).filter(v=>v!==null));
  const minFound=available.length?Math.min(...available):0,maxFound=available.length?Math.max(...available):1;
  let min=minFound,max=maxFound;
  if (def.kind==='soc'){min=0;max=100;}
  else if(def.kind==='energy'||def.kind==='battery'){min=Math.min(0,min);max=Math.max(0,max); const pad=Math.max(.25,(max-min)*.11);min-=pad;max+=pad;}
  else {const pad=Math.max(.02,(max-min)*.2);min-=pad;max+=pad;}
  if(max-min<.001){max+=1;min-=1;}
  const graphWidth=W-L-R,graphHeight=H-T-B;
  const X=i=>L+(rows.length<2?graphWidth/2:i/(rows.length-1)*graphWidth);
  const Y=v=>T+(max-v)/(max-min)*graphHeight;
  const escapedId=def.id.replace(/[^a-zA-Z0-9-]/g,'');
  const pieces=[`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${translation('chart.aria')}">`, '<defs>'];
  for(const s of enabled) pieces.push(`<linearGradient id="fill-${escapedId}-${s.field}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${s.color}" stop-opacity=".18"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`);
  pieces.push('</defs>');
  for(let k=0;k<=4;k++){
    const y=T+graphHeight*k/4, val=max-(max-min)*k/4;
    pieces.push(`<line class="gridline" x1="${L}" y1="${safe(y)}" x2="${W-R}" y2="${safe(y)}"/><text class="axistext" x="${L-13}" y="${safe(y+4)}" text-anchor="end">${num(val,def.kind==='soc'?0:1)}</text>`);
  }
  if(min<0&&max>0) pieces.push(`<line class="zeroline" x1="${L}" y1="${safe(Y(0))}" x2="${W-R}" y2="${safe(Y(0))}"/>`);
  const tickCount=W<520?3:5;
  for(let t=0;t<tickCount;t++){
    const i=Math.round(t*(rows.length-1)/(tickCount-1));
    pieces.push(`<text class="axistext" x="${safe(X(i))}" y="${H-9}" text-anchor="${t===0?'start':t===tickCount-1?'end':'middle'}">${axisDate.format(rows[i].date)}</text>`);
  }
  for(const s of enabled){
    const d=pathFor(rows,s,def.kind,X,Y);
    if(s.area&&d&&rows.length>1){
      const baseline=safe(Y(Math.max(min,Math.min(max,0))));
      const firstIndex=rows.findIndex(r=>r[s.field]!==null);
      const lastIndex=rows.findLastIndex(r=>r[s.field]!==null);
      if(firstIndex>=0&&lastIndex>firstIndex){pieces.push(`<path d="${d} L${safe(X(lastIndex))},${baseline} L${safe(X(firstIndex))},${baseline} Z" fill="url(#fill-${escapedId}-${s.field})"/>`);}
    }
    pieces.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${def.kind==='energy'?2.9:3.2}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`);
  }
  pieces.push(`<g class="chart-guide" style="display:none"><line class="guide" y1="${T}" y2="${H-B}"/><g class="chart-dots"></g></g>`);
  pieces.push(`<rect class="chart-overlay" x="${L}" y="${T}" width="${graphWidth}" height="${graphHeight}" fill="transparent"/>`);
  pieces.push('</svg>');
  el.innerHTML=pieces.join('');
  el._chart={X,Y,enabled,rows,kind:def.kind,L,R,W};
  const overlay=el.querySelector('.chart-overlay');
  function rowAtPointer(e) {
    const r=el.querySelector('svg').getBoundingClientRect();
    const pointer=(e.clientX-r.left)/r.width*W;
    const index=Math.max(0,Math.min(rows.length-1,Math.round((pointer-L)/(W-L-R)*(rows.length-1))));
    return rows[index];
  }
  function selectQuarter(e, pinned) {
    const row=rowAtPointer(e);
    state.selected=row.timestamp;
    state.hovered=null;
    updateSelection();
    if (pinned) showTooltip(e,row,true);
  }
  overlay.addEventListener('pointermove',e=>{
    // On phones 'pointerleave' follows finger-lift or scrolling. A mobile
    // tooltip is only opened on a completed tap, never by touch hover.
    if(e.pointerType!=='mouse' || state.tooltipPinned) return;
    const row=rowAtPointer(e);
    state.hovered=row.timestamp;
    for(const chart of chartDefs) updateGuide(chart);
    showTooltip(e,row);
  });
  overlay.addEventListener('pointerleave',e=>{
    if(e.pointerType!=='mouse' || state.tooltipPinned) return;
    state.hovered=null;
    $('tooltip').hidden=true;
    chartDefs.forEach(updateGuide);
  });
  overlay.addEventListener('pointerup',e=>{
    if(e.pointerType==='touch' || e.pointerType==='pen') selectQuarter(e,true);
  });
  overlay.addEventListener('click',e=>{
    // Click is the keyboard/older touch fallback. A subsequent touch click
    // may run after pointerup; it simply updates the same pinned quarter.
    selectQuarter(e,e.pointerType==='touch' || e.pointerType==='pen' || matchMedia('(hover: none)').matches);
  });
  updateGuide(def);
}
function updateGuide(def) {
  const el=$(def.id),cfg=el._chart;if(!cfg)return;
  const current=state.hovered||state.selected;
  const i=cfg.rows.findIndex(r=>r.timestamp===current);
  const guide=el.querySelector('.chart-guide');if(!guide)return;
  guide.style.display=i<0?'none':'';if(i<0)return;
  const x=safe(cfg.X(i));const line=guide.querySelector('line');line.setAttribute('x1',x);line.setAttribute('x2',x);
  const dots=guide.querySelector('.chart-dots');dots.replaceChildren();
  for(const s of cfg.enabled){const v=transform(cfg.rows[i][s.field],cfg.kind);if(v===null)continue;const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx',x);circle.setAttribute('cy',safe(cfg.Y(v)));circle.setAttribute('r','5');circle.setAttribute('fill',s.color);circle.setAttribute('class','marker');dots.append(circle);}
}
function hideTooltip() {
  state.tooltipPinned=false;
  state.hovered=null;
  const box=$('tooltip');
  box.hidden=true;
  box.classList.remove('pinned');
}
function showTooltip(e,row,pinned=false) {
  const items=[['PV',fmtPower(row.P_PV)],[translation('field.load'),fmtPower(row.P_Load)],[translation('field.battery'),fmtPower(row.P_batt)],[translation('field.grid'),fmtPower(row.P_grid)],['SOC',row.SOC_opt===null?'—':`${num(row.SOC_opt,1)} %`],[translation('field.buy'),fmtPrice(row.unit_load_cost)]];
  const box=$('tooltip');
  state.tooltipPinned=pinned;
  box.classList.toggle('pinned',pinned);
  box.replaceChildren();
  const title=document.createElement('strong');title.textContent=formatter.format(row.date);box.append(title);
  if(pinned){
    const close=document.createElement('button');
    close.type='button';close.className='tooltip-close';close.textContent='×';close.setAttribute('aria-label',translation('tooltip.close'));
    close.addEventListener('click',hideTooltip);box.append(close);
  }
  for(const [label,value] of items){const line=document.createElement('div');line.className='tooltip-line';const l=document.createElement('em'),v=document.createElement('b');l.textContent=label;v.textContent=value;line.append(l,v);box.append(line);}
  box.hidden=false;
  // Never use negative fixed-position coordinates on a narrow viewport.
  // Touch tooltips are anchored by CSS at the bottom, outside the chart.
  if(pinned){box.style.left='';box.style.top='';}
  else {
    box.style.left=`${Math.max(8,Math.min(window.innerWidth-270,e.clientX+18))}px`;
    box.style.top=`${Math.max(8,Math.min(window.innerHeight-205,e.clientY+14))}px`;
  }
}
function getFilteredRows(){
  const q=state.query.toLowerCase().trim();
  return state.visible.filter(row=>{
    const batt=row.P_batt,grid=row.P_grid;
    const matches={all:true,charge:batt!==null&&batt< -50,discharge:batt!==null&&batt>50,import:grid!==null&&grid>50,export:grid!==null&&grid< -50};
    if(!matches[state.filter])return false;
    return !q || `${shortDate.format(row.date)} ${formatter.format(row.date)} ${row.timestamp}`.toLowerCase().includes(q);
  }).sort((a,b)=>(a.date-b.date)*(state.sortAsc?1:-1));
}
function tableCell(text,cls='') {const td=document.createElement('td');td.textContent=text;if(cls)td.className=cls;return td;}
function renderTable(){
  const rows=getFilteredRows(),maxPage=Math.max(0,Math.ceil(rows.length/PAGE_SIZE)-1);state.page=Math.min(maxPage,state.page);
  const part=rows.slice(state.page*PAGE_SIZE,(state.page+1)*PAGE_SIZE);const body=$('table-body');body.replaceChildren();
  for(const row of part){
    const tr=document.createElement('tr');tr.dataset.time=row.timestamp;tr.classList.toggle('current',row.timestamp===state.selected);
    tr.append(tableCell(shortDate.format(row.date)),tableCell(fmtPower(row.P_PV)),tableCell(fmtPower(row.P_Load)),tableCell(fmtPower(row.P_batt),row.P_batt!==null?(row.P_batt<0?'negative':'positive'):''),tableCell(row.SOC_opt===null?'—':`${num(row.SOC_opt,1)} %`),tableCell(fmtPower(row.P_grid),row.P_grid!==null?(row.P_grid<0?'positive':'negative'):''),tableCell(fmtPrice(row.unit_load_cost)),tableCell(fmtPrice(row.unit_prod_price)));
    tr.addEventListener('click',()=>{state.selected=row.timestamp;updateSelection();window.scrollTo({top:document.querySelector('#energy').getBoundingClientRect().top+window.scrollY-22,behavior:'smooth'});});
    body.append(tr);
  }
  if(!part.length){const tr=document.createElement('tr'),td=tableCell(translation('table.empty'));td.colSpan=8;td.style.textAlign='center';tr.append(td);body.append(tr);}
  setText('table-count',translation('table.count',{count:rows.length,total:state.visible.length,hours:state.hours}));
  setText('page-label',`${state.page+1} / ${maxPage+1}`);
  $('page-prev').disabled=state.page===0; $('page-next').disabled=state.page>=maxPage;
  setText('sort-time',translation(state.sortAsc?'table.sortAsc':'table.sortDesc'));
}
function exportCsv(){
  const rows=getFilteredRows();if(!rows.length)return;
  const headings=['csv.utc','csv.local','csv.pv','csv.load','csv.batt','csv.soc','csv.grid','csv.buy','csv.sell'].map(key=>translation(key));
  const cell=x=>x===null||x===undefined?'':String(x).replaceAll('.',',');
  const lines=[headings.join(';'),...rows.map(r=>[r.timestamp,shortDate.format(r.date),r.P_PV,r.P_Load,r.P_batt,r.SOC_opt,r.P_grid,r.unit_load_cost,r.unit_prod_price].map(cell).join(';'))];
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`emhass-plan-${new Date().toISOString().slice(0,10)}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function fetchJson(path){const r=await fetch(path,{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok){const data=await r.json().catch(()=>null);throw new Error(data?.error||`HTTP ${r.status}`);}return r.json();}
async function loadLive(){
  if(state.loading)return;state.loading=true;$('reload').disabled=true;$('refresh-icon').textContent='◌';
  try{
    const [planRes,runRes,actualsRes]=await Promise.allSettled([fetchJson('./api/plan'),fetchJson('./api/last-run'),fetchJson('./api/live-actuals')]);
    if(planRes.status==='rejected')throw planRes.reason;
    const plan=planRes.value,run=runRes.status==='fulfilled'?runRes.value:null;
    const rows=normalizePlan(plan,language);
    state.plan=plan;state.run=run;state.rows=rows;state.warnings=validateRun(plan,run,new Date(),language);
    state.actuals=actualsRes.status==='fulfilled'?actualsRes.value:null;
    $('demo-mode').hidden=true;
    if(runRes.status==='rejected')state.warnings.push(translation('status.lastRunUnknown'));
    updateView();
    const dt=plan.generated_at?formatter.format(new Date(plan.generated_at)):translation('status.unknown');
    const age=plan.generated_at?Math.max(0,Math.round((Date.now()-new Date(plan.generated_at).getTime())/60000)):null;
    const detail=translation('status.planDetail',{count:rows.length,date:dt});
    if(state.warnings.length){status('bad',translation('status.review'),detail);showMessage(state.warnings.join('  •  '));}
    else{status('good',translation('status.optimized'),detail);showMessage('');}
    setText('status-meta',`${run?.action||'naive-mpc-optim'} · ${age===null?translation('status.ageUnknown'):translation('status.ageMinutes',{minutes:age})} · EMHASS ${run?.emhass_version||'—'}`);
  }catch(e){
    if(!state.rows.length){state.plan=null;state.rows=[];updateView();}
    state.actuals=null;updateLiveCards();
    $('demo-mode').hidden=false;
    status('bad',translation('status.noLive'),translation('status.checkConnection'));
    showMessage(translation('status.errorHelp',{error:e.message}));
    setText('status-meta',translation('status.liveUnavailable'));
  }finally{state.loading=false;$('reload').disabled=false;$('refresh-icon').textContent='↻';}
}
function loadDemo(){
  const {plan,run}=createDemo();state.plan=plan;state.run=run;state.rows=normalizePlan(plan,language);state.warnings=[];state.actuals=null;
  updateView();status('',translation('status.demoTitle'),translation('status.demoDetail'));
  setText('status-meta',translation('status.demoMeta',{count:state.rows.length}));
  showMessage(translation('status.demoNotice'));
}
function setMode(mode){state.mode=mode;state.hovered=null;state.selected=null;state.page=0;updateModes();if(mode==='demo')loadDemo();else{state.rows=[];state.actuals=null;updateView();loadLive();}}
function attachEvents(){
  // Pinned mobile detail panel stays open after releasing a finger.
  // Dismiss with its close button or by touching anywhere outside a chart.
  document.addEventListener('pointerdown',e=>{
    if(state.tooltipPinned && !e.target.closest('.chart-overlay') && !e.target.closest('#tooltip')) hideTooltip();
  });
  $('theme').addEventListener('click',()=>{const html=document.documentElement;const now=html.dataset.theme==='light'?'dark':'light';html.dataset.theme=now;try{localStorage.setItem('emhass-theme',now);}catch{}});
  $('reload').addEventListener('click',()=>state.mode==='demo'?loadDemo():loadLive());
  $('live-mode').addEventListener('click',()=>setMode('live')); $('demo-mode').addEventListener('click',()=>setMode('demo'));
  document.querySelectorAll('[data-hours]').forEach(btn=>btn.addEventListener('click',()=>{state.hours=Number(btn.dataset.hours);state.page=0;document.querySelectorAll('[data-hours]').forEach(b=>b.classList.toggle('active',b===btn));updateView();}));
  document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{state.filter=btn.dataset.filter;state.page=0;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===btn));renderTable();}));
  document.querySelectorAll('[data-series]').forEach(btn=>btn.addEventListener('click',()=>{const field=btn.dataset.series;if(state.disabledSeries.has(field))state.disabledSeries.delete(field);else state.disabledSeries.add(field);btn.classList.toggle('selected',!state.disabledSeries.has(field));drawChart(chartDefs[0]);}));
  $('table-search').addEventListener('input',e=>{state.query=e.target.value;state.page=0;renderTable();});
  $('sort-time').addEventListener('click',()=>{state.sortAsc=!state.sortAsc;renderTable();});
  $('page-prev').addEventListener('click',()=>{state.page=Math.max(0,state.page-1);renderTable();});
  $('page-next').addEventListener('click',()=>{state.page++;renderTable();});
  $('export').addEventListener('click',exportCsv);
  const links=[...document.querySelectorAll('.nav-link')];links.forEach(a=>a.addEventListener('click',()=>{links.forEach(l=>l.classList.toggle('active',l===a));}));
  let previousWidth=window.innerWidth;window.addEventListener('resize',()=>{if(Math.abs(window.innerWidth-previousWidth)>10){previousWidth=window.innerWidth;for(const def of chartDefs)drawChart(def);}});
}
function updateClock() {
  setText('clock',new Intl.DateTimeFormat(language === 'nl' ? 'nl-NL' : 'en-GB',{
    timeZone:TIMEZONE,weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'
  }).format(new Date()));
}
function setLanguage(next) {
  const normalized=normalizeLanguageTag(next);
  const changed=normalized!==language;
  language=normalized;
  document.documentElement.lang=language;
  configureFormatters();
  if(appliedLanguage !== language) {
    translateStatic(document,language);
    appliedLanguage = language;
  }
  if(changed && state.rows.length) {
    // Format already fetched values again without restarting or altering EMHASS.
    updateModes();updateView();
    if(state.mode==='demo')loadDemo();
    else loadLive();
  }
  updateClock();
}
function refreshLanguage() {
  setLanguage(resolveLanguage(languagePreference, window.parent, navigator));
}
async function init(){
  // The add-on-wide override is fetched once; 'auto' remains the safe fallback.
  // This endpoint exposes ONLY the language setting, never EMHASS credentials.
  try {
    const settings = await fetchJson('./api/settings');
    languagePreference = ['auto','en','nl'].includes(settings.language) ? settings.language : 'auto';
  } catch { languagePreference = 'auto'; }
  refreshLanguage();
  window.addEventListener('focus',refreshLanguage);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLanguage();});
try{document.documentElement.dataset.theme=localStorage.getItem('emhass-theme')==='light'?'light':'dark';}catch{};
  attachEvents();const demo=new URLSearchParams(location.search).get('demo')==='1';setMode(demo?'demo':'live');
  updateClock();
  setTimeout(refreshLanguage,1500);
  setInterval(()=>{refreshLanguage();if(state.mode==='live')loadLive();},60000);
}
init();
