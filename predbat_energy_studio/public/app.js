import {strings,getLanguage} from './i18n.js';
import {groupPredbatPlan} from './plan.js';
import {formatEuroMetric} from './money.js';
const $=id=>document.getElementById(id);
const state={data:null,locale:'en',horizon:24,series:'soc',page:0,demo:false,loading:false};
const PAGE_SIZE=28;
const t=key=>strings[state.locale][key]||strings.en[key]||key;
const numeric=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const num=(x,d=2)=>numeric(x)===null?'—':x.toLocaleString(state.locale==='nl'?'nl-NL':'en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
const s=(key)=>state.data?.scalar?.[key]||null;
const val=(key)=>numeric(s(key)?.value);
const text=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
const fmtPower=value=>numeric(value)===null?'—':`${num(value,2)} kW`;
const fmtKwh=value=>numeric(value)===null?'—':`${num(value,2)} kWh`;
function fmtMetric(value,unit){
 if(numeric(value)===null)return '—';
 const euro=formatEuroMetric(value,unit);
 if(euro!==null)return euro;
 const u=String(unit||'').trim();
 return `${num(value,2)}${u?' '+u:''}`;
}
const fm=(key)=>fmtMetric(val(key),s(key)?.unit);
function toDate(timestamp){
 if(typeof timestamp!=='string')return null;
 // Unzoned Predbat times are rendered in the viewer's local timezone.
 const d=new Date(timestamp.replace(' ','T'));return Number.isFinite(d.getTime())?d:null;
}
const stamp=d=>d instanceof Date?d.toLocaleString(state.locale==='nl'?'nl-NL':'en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const clock=d=>d instanceof Date?d.toLocaleTimeString(state.locale==='nl'?'nl-NL':'en-GB',{hour:'2-digit',minute:'2-digit'}):'—';
function applyLanguage(){
 document.documentElement.lang=state.locale;
 document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
 render();
}
function sensorDirection(key){
 const v=val(key);if(v===null)return '—';
 if(key==='battery')return v < -60?t('charge'):v>60?t('discharge'):t('hold');
 return v < -60?t('gridImport'):v>60?t('gridExport'):t('gridNeutral');
}
// Predbat's current power entities are in W; results attributes are in kW.
function currentKw(key){const v=val(key);if(v===null)return null;return s(key)?.unit==='kW'?v:v/1000;}
function renderStatus(){
 const d=state.data;const live=d?.status==='ok'&&!state.demo;
 const tag=$('live-pill').querySelector('.pulse');tag.className='pulse'+(state.demo?' demo':live?' online':'');
 text('live-label',state.demo?t('demoMode'):live?t('live'):t('unavailable'));
 $('status-light').className='status-light'+(state.demo?' demo':live?' online':'');
 text('plan-health',state.demo?t('demoMode'):live?t('planOk'):t('planUnavailable'));
 text('plan-version',d?.version?'Predbat '+d.version:'Predbat');
 text('last-update',d?.observed_at?stamp(toDate(d.observed_at)):'—');
 text('refresh-note',d?.observed_at?`${t('updated')}: ${stamp(toDate(d.observed_at))}`:'');
 const status=s('status')?.text||'—';
 text('mode',d?.run_state||status);
 text('raw-status',status);
 text('soc',numeric(d?.soc_percent)===null?fmtKwh(val('soc_now')): `${num(d.soc_percent,0)} %`);
 text('soc-kwh',numeric(d?.soc_percent)===null?t('socHint'):`${fmtKwh(val('soc_now'))} · ${t('capacity')} ${fmtKwh(d.capacity_kwh)}`);
 $('soc-progress').style.width=(numeric(d?.soc_percent)??0)+'%';
 text('best-metric',fm('best_metric'));text('base-metric',fm('base_metric'));
 text('saving',fmtMetric(d?.estimated_saving,s('best_metric')?.unit));text('cost-today',fm('cost_today'));
 for(const [key,id] of [['battery','battery-live'],['grid','grid-live'],['pv','pv-live'],['load','load-live']])text(id,fmtPower(currentKw(key)));
 text('battery-direction',sensorDirection('battery'));text('grid-direction',sensorDirection('grid'));
 const issue=typeof status==='string'&&/^(warn|error)/i.test(status);
 $('alert').hidden=!issue&&!(!d||d.status!=='ok')&&!state.demo;
 if(issue)$('alert').textContent=t('statusWarning')+': '+status;
 else if(state.demo)$('alert').textContent=t('simulated');
 else if(!d||d.status!=='ok')$('alert').textContent=t('noConnection');
 $('demo').hidden=live;
}
function seriesOf(key){return state.data?.series?.[key]||[];}
function selection(seriesName){return seriesName==='soc'?['soc_best','soc_base']:seriesName==='battery'?['battery_best']:seriesName==='grid'?['grid_best']:['pv_best'];}
function joinPoints(seriesNames){
 const now=Date.now(),end=now+state.horizon*3600000;
 const dict=new Map();
 for(const key of seriesNames){for(const p of seriesOf(key)){
  const dt=toDate(p.time);if(!dt||dt.getTime()<now-300000||dt.getTime()>end)continue;
  const tick=dt.getTime();if(!dict.has(tick))dict.set(tick,{date:dt});dict.get(tick)[key]=p.value;
 }}
 return [...dict.values()].sort((a,b)=>a.date-b.date);
}
const svgNs='http://www.w3.org/2000/svg';
function svgElement(name,attrs={},parent=$('graph')){
 const el=document.createElementNS(svgNs,name);
 for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));parent.appendChild(el);return el;
}
function renderGraph(){
 const chart=$('graph');chart.replaceChildren();$('graph-tooltip').hidden=true;
 const chosen=selection(state.series);const rows=joinPoints(chosen);
 const noData=rows.length<2;$('chart-empty').hidden=!noData;
 $('chart-empty').textContent=t('noData');chart.hidden=noData;
 text('graph-count',`${rows.length} ${t('points')}`);
 $('baseline-legend').hidden=state.series!=='soc'||!seriesOf('soc_base').length;
 const titles={soc:'socChart',battery:'chartBattery',grid:'chartGrid',pv:'chartSolar'};
 text('chart-title',t(titles[state.series]));text('chart-sub',t(state.series==='soc'?'socHint':'chartPowerHint'));
 if(noData)return;
 const W=1100,H=330,pad={left:65,right:18,top:24,bottom:40};const w=W-pad.left-pad.right,h=H-pad.top-pad.bottom;
 const xs=rows.map(x=>x.date.getTime()),minX=Math.min(...xs),maxX=Math.max(...xs);
 const vs=rows.flatMap(r=>chosen.map(k=>r[k])).filter(n=>Number.isFinite(n));
 let minY=Math.min(...vs,0),maxY=Math.max(...vs,0);if(state.series==='soc'){minY=Math.max(0,Math.floor(minY/2)*2);maxY=Math.max(maxY,2);}if(maxY-minY<.01){maxY+=1;minY-=1;}
 const buffer=(maxY-minY)*.12;minY-=state.series==='soc'?0:buffer;maxY+=buffer;
 const y=n=>pad.top+(maxY-n)/(maxY-minY)*h;
 const x=dt=>pad.left+(dt.getTime()-minX)/(maxX-minX||1)*w;
 for(let i=0;i<=4;i++){
  const value=minY+(maxY-minY)*(1-i/4),yy=pad.top+i*h;
  svgElement('line',{x1:pad.left,x2:W-pad.right,y1:yy,y2:yy,stroke:'#2c3a52','stroke-dasharray':'4 7'});
  const txt=svgElement('text',{x:pad.left-10,y:yy+4,'font-size':12,'text-anchor':'end',fill:'#879ab6'});txt.textContent=num(value,1);
 }
 for(let i=0;i<=6;i++){
  const time=new Date(minX+(maxX-minX)*i/6),xx=x(time);
  const label=svgElement('text',{x:xx,y:H-9,'font-size':11,'text-anchor':i===0?'start':i===6?'end':'middle',fill:'#8498b2'});label.textContent=clock(time);
 }
 const palettes=['#57e1cb','#a58fff'];
 chosen.forEach((key,i)=>{
  const segments=[];let current=[];
  for(const row of rows){if(numeric(row[key])===null){if(current.length)segments.push(current);current=[];}else current.push([x(row.date),y(row[key])]);}if(current.length)segments.push(current);
  segments.forEach(seg=>{if(seg.length>1)svgElement('polyline',{points:seg.map(p=>p.join(',')).join(' '),fill:'none',stroke:palettes[i]||'#57e1cb','stroke-width':i===0?3.5:2.5,'stroke-linejoin':'round','stroke-linecap':'round',...(i===1?{'stroke-dasharray':'7 6'}:{})});});
 });
 const line=svgElement('line',{x1:pad.left,y1:pad.top,x2:pad.left,y2:H-pad.bottom,stroke:'#8399b6','stroke-width':'1','stroke-dasharray':'4 5',opacity:0});
 const dot=svgElement('circle',{cx:pad.left,cy:pad.top,r:5,fill:'#57e1cb',stroke:'#142033','stroke-width':2,opacity:0});
 const hit=svgElement('rect',{x:pad.left,y:pad.top,width:w,height:h,fill:'transparent',style:'cursor:crosshair'});
 function show(e){
  const rect=chart.getBoundingClientRect();const px=(e.clientX-rect.left)/rect.width*W;
  const index=rows.reduce((best,cur,i)=>Math.abs(x(cur.date)-px)<Math.abs(x(rows[best].date)-px)?i:best,0);
  const r=rows[index],xx=x(r.date);
  line.setAttribute('x1',xx);line.setAttribute('x2',xx);line.setAttribute('opacity','1');
  if(numeric(r[chosen[0]])!==null){dot.setAttribute('cx',xx);dot.setAttribute('cy',y(r[chosen[0]]));dot.setAttribute('opacity','1');}else dot.setAttribute('opacity','0');
  const tooltip=$('graph-tooltip');tooltip.replaceChildren();
  const title=document.createElement('strong');title.textContent=stamp(r.date);tooltip.append(title);
  for(let i=0;i<chosen.length;i++){
   const item=document.createElement('div');item.textContent=`${i===0?t('bestPlan'):t('basePlan')}: ${numeric(r[chosen[i]])===null?'—':num(r[chosen[i]],2)} ${state.series==='soc'?'kWh':'kW'}`;tooltip.append(item);
  }
  tooltip.hidden=false;tooltip.style.left=Math.min(Math.max(0,xx/W*rect.width+4),Math.max(0,rect.width-205))+'px';
 }
 hit.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')show(e)});
 hit.addEventListener('click',show);
 hit.addEventListener('pointerleave',()=>{if(window.matchMedia('(hover: hover)').matches){$('graph-tooltip').hidden=true;line.setAttribute('opacity','0');dot.setAttribute('opacity','0');}});
}
function slots(){
 const keys=['soc_best','soc_base','battery_best','grid_best','pv_best'];return joinPoints(keys);
}
function toSlotDirection(value){return numeric(value)===null?['unknown','']:value<-.06?['charge','charge']:value>.06?['discharge','discharge']:['hold',''];}
function renderTable(){
 const rows=slots(),totalPages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));state.page=Math.min(state.page,totalPages-1);
 const tbody=$('rows');tbody.replaceChildren();const shown=rows.slice(state.page*PAGE_SIZE,(state.page+1)*PAGE_SIZE);
 for(const r of shown){const tr=document.createElement('tr');
  const cols=[stamp(r.date),fmtKwh(r.soc_best),fmtKwh(r.soc_base),fmtPower(r.battery_best),fmtPower(r.grid_best),fmtPower(r.pv_best)];
  cols.forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td)});
  const direction=toSlotDirection(r.battery_best),td=document.createElement('td'),pill=document.createElement('span');pill.className='trend '+direction[1];pill.textContent=t(direction[0]);td.append(pill);tr.append(td);tbody.append(tr);
 }
 if(!shown.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.className='empty-row';td.textContent=t('noRows');tr.append(td);tbody.append(tr);}
 text('table-count',`${rows.length} ${t('records')}`);text('page',`${state.page+1} / ${totalPages}`);
 $('prev').disabled=state.page===0;$('next').disabled=state.page>=totalPages-1;$('download').disabled=!rows.length;
}
function renderSchedule(){
 const out=$('schedule');out.replaceChildren();
 const windows=groupPredbatPlan(state.data?.plan_rows,{now:new Date(),horizonHours:state.horizon,maxWindows:8});
 for(const w of windows){
  const row=document.createElement('div');row.className='action-row';
  const group=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('small');
  title.textContent=t('plan_'+w.state.replace('/','_'));
  const start=clock(w.start),end=w.end?clock(w.end):'…';
  detail.textContent=`${start} – ${end}${w.end && w.start.toDateString()!==w.end.toDateString() ? ' ('+stamp(w.end)+')' : ''}`;
  group.append(title,detail);
  const mark=document.createElement('span');mark.textContent=w.state==='Demand'?'→':w.state.includes('Chrg')?'↙':'↗';
  row.append(group,mark);out.append(row);
 }
 if(!windows.length){const msg=document.createElement('p');msg.className='muted';msg.textContent=t('planMissing');out.append(msg);}
}
function renderHealth(){const out=$('health-lines');out.replaceChildren();
 const d=state.data;const checks=[
  [t('status'),s('status')?.text||t('unknown')],
  [t('knownEntities'),`${Object.entries(d?.scalar||{}).filter(([,v])=>v!==null).length} / ${Object.keys(d?.scalar||{}).length}`],
  [t('forecastPoints'),String(seriesOf('soc_best').length)],
  [t('version'),d?.version||'—']];
 for(const [name,value] of checks){const row=document.createElement('div');row.className='health-row';const col=document.createElement('div');const label=document.createElement('small');label.textContent=name;const strong=document.createElement('strong');strong.textContent=value;col.append(label,strong);row.append(col);out.append(row);}
}
function render(){if(!state.data)return;renderStatus();renderGraph();renderSchedule();renderHealth();renderTable();}
function demoData(){
 const now=new Date(),base=new Date(Math.floor(now.getTime()/300000)*300000),cap=15;
 const keys=['soc_best','soc_base','battery_best','grid_best','pv_best','load_best','best_metric','base_metric'];const series=Object.fromEntries(keys.map(k=>[k,[]]));
 for(let i=0;i<576;i++){
  const ts=new Date(base.getTime()+i*300000).toISOString(),hour=(base.getHours()+i/12)%24;
  const sun=Math.max(0,Math.sin((hour-6)/12*Math.PI));
  const power=hour<5?-3.8:hour<13?-1.1:hour<20?1.3:-.25;
  const soc=Math.max(1,Math.min(cap,7+3.7*Math.sin((i-75)/70)));
  const values={soc_best:soc,soc_base:Math.max(1,soc-1.7+1.3*Math.sin(i/57)),battery_best:power,grid_best:power<0?2.0:-.6,pv_best:3.4*sun,load_best:1+Math.max(0,Math.sin(i/21)),best_metric:55+i*.22,base_metric:77+i*.28};
  for(const k of keys)series[k].push({time:ts,value:Math.round(values[k]*100)/100});
 }
 const data={status:'ok',source:'demo',version:'demo',run_state:'Charging',observed_at:now.toISOString(),soc_percent:67,capacity_kwh:cap,estimated_saving:22,scalar:{status:{text:'Charging',value:null},soc_now:{value:10.05,unit:'kWh'},best_metric:{value:135,unit:'ct'},base_metric:{value:157,unit:'ct'},cost_today:{value:72,unit:'ct'},battery:{value:-3800,unit:'W'},grid:{value:-1750,unit:'W'},pv:{value:2150,unit:'W'},load:{value:900,unit:'W'}},series,missing:[]};return data;
}
function downloadCsv(){const data=slots();if(!data.length)return;
 const header=['timestamp','soc_best_kwh','soc_base_kwh','battery_best_kw','grid_best_kw','pv_best_kw'];
 const content=[header.join(','),...data.map(r=>[r.date.toISOString(),r.soc_best,r.soc_base,r.battery_best,r.grid_best,r.pv_best].map(v=>v??'').join(','))].join('\r\n');
 const blob=new Blob([content],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='predbat-studio-forecast.csv';a.click();URL.revokeObjectURL(url);
}
async function reload(){
 if(state.loading)return;state.loading=true;$('refresh').disabled=true;
 try{
  const response=await fetch('./api/snapshot',{cache:'no-store'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  state.data=await response.json();state.demo=false;state.page=0;render();
 }catch(e){state.data={status:'unavailable'};state.demo=false;render();$('alert').hidden=false;$('alert').textContent=t('readFailed')+': '+e.message;}
 finally{state.loading=false;$('refresh').disabled=false;}
}
for(const btn of document.querySelectorAll('[data-hours]'))btn.addEventListener('click',()=>{state.horizon=Number(btn.dataset.hours);state.page=0;document.querySelectorAll('[data-hours]').forEach(el=>el.classList.toggle('active',el===btn));render();});
for(const btn of document.querySelectorAll('[data-series]'))btn.addEventListener('click',()=>{state.series=btn.dataset.series;document.querySelectorAll('[data-series]').forEach(el=>el.classList.toggle('active',el===btn));renderGraph();});
$('refresh').addEventListener('click',reload);$('demo').addEventListener('click',()=>{state.data=demoData();state.demo=true;state.page=0;render();});
$('prev').addEventListener('click',()=>{state.page--;renderTable();});$('next').addEventListener('click',()=>{state.page++;renderTable();});$('download').addEventListener('click',downloadCsv);
const nowClock=()=>text('current-time',stamp(new Date()));nowClock();setInterval(nowClock,60000);
try{
 const settings=await(await fetch('./api/settings')).json();state.locale=getLanguage(settings.language,navigator.language||'en');
}catch{state.locale=getLanguage('auto',navigator.language||'en');}
applyLanguage();await reload();setInterval(()=>{if(!state.demo&&!document.hidden)reload();},60000);
