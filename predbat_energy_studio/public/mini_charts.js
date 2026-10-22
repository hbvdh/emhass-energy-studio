// Dependency-free, read-only SVG charts; forecast data stays in the browser.
const SVG='http://www.w3.org/2000/svg';
const number=x=>typeof x==='number' && Number.isFinite(x);
function toDate(x){if(typeof x!=='string')return null;const d=new Date(x.replace(' ','T'));return Number.isFinite(d.getTime())?d:null;}
export function chartModel(streams,{now=new Date(),hours=24}={}){
 const a=now.getTime()-5*60_000,b=now.getTime()+Math.max(1,Math.min(48,hours))*3600000;
 return (Array.isArray(streams)?streams:[]).map(stream=>({
  name:stream.name,color:stream.color,
  points:(stream.points||[]).map(x=>({time:toDate(x.time)?.getTime(),value:x.value}))
   .filter(x=>Number.isFinite(x.time)&&number(x.value)&&x.time>=a&&x.time<=b)
   .sort((x,y)=>x.time-y.time)
 }));
}
function element(root,name,attributes={}){
 const e=document.createElementNS(SVG,name);
 for(const [key,value] of Object.entries(attributes))e.setAttribute(key,String(value));
 root.append(e);return e;
}
export function renderSmallChart(svg,tip,streams,{now=new Date(),hours=24,locale='en',unit='',stepped=false,noData='No data'}={}){
 svg.replaceChildren();tip.hidden=true;
 const data=chartModel(streams,{now,hours}),pts=data.flatMap(s=>s.points);
 if(pts.length<2){const label=element(svg,'text',{x:500,y:135,fill:'#94abc6','text-anchor':'middle','font-size':21});label.textContent=noData;return;}
 const W=1000,H=270,left=65,right=20,top=25,bottom=42,w=W-left-right,h=H-top-bottom;
 let minT=Math.min(...pts.map(p=>p.time)),maxT=Math.max(...pts.map(p=>p.time));
 if(minT===maxT)maxT+=300000;
 const vals=pts.map(p=>p.value);
 let lo=Math.min(0,...vals),hi=Math.max(0,...vals);
 if(Math.abs(hi-lo)<.001){hi+=.5;lo-=.5;}
 const buffer=(hi-lo)*.12;lo-=buffer;hi+=buffer;
 const x=t=>left+(t-minT)/(maxT-minT)*w;
 const y=v=>top+(hi-v)/(hi-lo)*h;
 const language=locale==='nl'?'nl-NL':'en-GB';
 for(let i=0;i<=4;i++){
  const yy=top+i*h,level=hi-i*(hi-lo)/4;
  element(svg,'line',{x1:left,y1:yy,x2:W-right,y2:yy,stroke:'#2b3b53','stroke-dasharray':'4 7'});
  const label=element(svg,'text',{x:left-10,y:yy+4,fill:'#89a0bd','text-anchor':'end','font-size':12});
  label.textContent=level.toFixed(2);
 }
 for(let i=0;i<=5;i++){
  const time=new Date(minT+(maxT-minT)*i/5),xx=x(time.getTime());
  const tick=element(svg,'text',{x:xx,y:H-10,fill:'#8299b7','text-anchor':i===0?'start':i===5?'end':'middle','font-size':11});
  tick.textContent=time.toLocaleTimeString(language,{hour:'2-digit',minute:'2-digit'});
 }
 for(const s of data){
  if(!s.points.length)continue;
  const fragments=[];
  for(let j=0;j<s.points.length;j++){
   const p=s.points[j],prev=s.points[j-1];
   if(!prev)fragments.push('M '+x(p.time)+' '+y(p.value));
   else if(stepped)fragments.push('H '+x(p.time)+' V '+y(p.value));
   else fragments.push('L '+x(p.time)+' '+y(p.value));
  }
  element(svg,'path',{d:fragments.join(' '),stroke:s.color||'#55dfcb','stroke-width':3,fill:'none','stroke-linejoin':'round','stroke-linecap':'round'});
 }
 const pointer=element(svg,'line',{x1:left,x2:left,y1:top,y2:H-bottom,stroke:'#a4c0d7','stroke-dasharray':'5 6',opacity:0});
 const hit=element(svg,'rect',{x:left,y:top,width:w,height:h,fill:'transparent',style:'cursor:crosshair'});
 const host=svg.parentElement;
 function show(event){
  const rect=svg.getBoundingClientRect(),position=(event.clientX-rect.left)/rect.width*W;
  const anchor=pts.reduce((best,p)=>Math.abs(x(p.time)-position)<Math.abs(x(best.time)-position)?p:best,pts[0]);
  const marker=x(anchor.time);pointer.setAttribute('x1',marker);pointer.setAttribute('x2',marker);pointer.setAttribute('opacity','1');
  tip.replaceChildren();
  const h=document.createElement('strong');h.textContent=new Date(anchor.time).toLocaleString(language,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});tip.append(h);
  data.forEach(s=>{
   if(!s.points.length)return;
   const near=s.points.reduce((best,p)=>Math.abs(p.time-anchor.time)<Math.abs(best.time-anchor.time)?p:best,s.points[0]);
   if(Math.abs(near.time-anchor.time)>60*60000)return; // no fabricated distant values
   const div=document.createElement('div');div.textContent=s.name+': '+near.value.toLocaleString(language,{maximumFractionDigits:3})+' '+unit;
   tip.append(div);
  });
  tip.hidden=false;
  tip.style.left=Math.max(0,Math.min((marker/W)*rect.width,rect.width-205))+'px';
 }
 hit.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')show(e)});
 hit.addEventListener('click',show);
 hit.addEventListener('pointerleave',()=>{if(window.matchMedia('(hover: hover)').matches){tip.hidden=true;pointer.setAttribute('opacity','0');}});
}
