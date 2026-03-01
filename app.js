
"use strict";
/**
 * Dual Calendar v2.1 — Umm‑al‑Qura aligned + Fri/Sat weekend + Hijri month numbers
 */

// ---- Intl formatters ----
const FMT_TIME = new Intl.DateTimeFormat('en-GB', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
const FMT_GREG_TITLE = new Intl.DateTimeFormat('en-GB', { month:'long', year:'numeric' });
const FMT_GREG_DATE = new Intl.DateTimeFormat('en-GB', { year:'numeric', month:'2-digit', day:'2-digit' });

const HIJRI_MONTHS = [
  "Muharram","Safar","Rabi' al-Awwal","Rabi' al-Thani","Jumada al-Awwal","Jumada al-Thani",
  "Rajab","Sha'aban","Ramadan","Shawwal","Dhu al-Qi'dah","Dhu al-Hijjah"
];
function hmName(n){ return HIJRI_MONTHS[n-1]; }
function hmDisp(n){ return `${hmName(n)} (${n})`; } // e.g., "Ramadan (9)"

// ---- State ----
const state = { gOffset:0, hYear:null, hMonth:null, hOffsetMonths:0, refineOffsetDays:0, refineEnabled:true };

// ---- DOM ----
const dom = { gGrid:document.getElementById('gGrid'), gTitle:document.getElementById('gTitle'), hGrid:document.getElementById('hGrid'), hTitle:document.getElementById('hTitle'), clock:document.getElementById('clock'), selection:document.getElementById('selection'), todayBlock:document.getElementById('todayBlock'), apiStatus:document.getElementById('apiStatus'), useApiToggle:document.getElementById('useApiToggle') };

let toastTimer=0; function showToast(html, ms=2200){ const t=document.getElementById('toast'); if(!t) return; t.innerHTML=html; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'), ms); }

// ---- Islamic calendar math ----
const ISLAMIC_EPOCH = 1948439.5;
function isIslamicLeapYear(hYear){ return ((11*hYear + 14) % 30) < 11; }
function islamicMonthLength(hYear,hMonth){ return (hMonth===12) ? (isIslamicLeapYear(hYear)?30:29) : ((hMonth%2===1)?30:29); }
function gregorianToJD(y,m,d){ const a=Math.floor((14-m)/12), y2=y+4800-a, m2=m+12*a-3; return d+Math.floor((153*m2+2)/5)+365*y2+Math.floor(y2/4)-Math.floor(y2/100)+Math.floor(y2/400)-32045; }
function jdToGregorian(jd){ let a=jd+32044; const b=Math.floor((4*a+3)/146097); const c=a-Math.floor((146097*b)/4); const d=Math.floor((4*c+3)/1461); const e=c-Math.floor((1461*d)/4); const m=Math.floor((5*e+2)/153); const day=e-Math.floor((153*m+2)/5)+1; const month=m+3-12*Math.floor(m/10); const year=100*b+d-4800+Math.floor(m/10); return {year,month,day}; }
function islamicToJD(hYear,hMonth,hDay){ const n=hDay+Math.ceil(29.5*(hMonth-1))+(hYear-1)*354+Math.floor((3+11*hYear)/30); return Math.floor(n+ISLAMIC_EPOCH-1); }
function jdToIslamic(jd){ const days=Math.floor(jd-ISLAMIC_EPOCH)+1; const hYear=Math.floor((30*days+10646)/10631); const startOfYear=islamicToJD(hYear,1,1); let hMonth=Math.ceil((jd-startOfYear+1)/29.5); if(hMonth<1)hMonth=1; if(hMonth>12)hMonth=12; const startOfMonth=islamicToJD(hYear,hMonth,1); const hDay=jd-startOfMonth+1; return {hYear,hMonth,hDay}; }

function gToH(y,m,d){ return jdToIslamic(gregorianToJD(y,m,d)+state.refineOffsetDays); }
function hToG(hy,hm,hd){ return jdToGregorian(islamicToJD(hy,hm,hd)-state.refineOffsetDays); }

function init(){
  const saved=localStorage.getItem('refineEnabled'); if(saved!==null) state.refineEnabled=(saved==='1');
  dom.useApiToggle.checked=state.refineEnabled; dom.apiStatus.textContent=state.refineEnabled?'refine: pending…':'offline mode';
  updateClock(); setInterval(()=>updateClock(),1000);
  const now=new Date(); const y=now.getFullYear(), m=now.getMonth()+1, d=now.getDate(); const {hYear,hMonth}=gToH(y,m,d); state.hYear=hYear; state.hMonth=hMonth;
  renderGregorian(); renderHijri(); renderTodayBlock();
  document.getElementById('gPrev').addEventListener('click',()=>{ state.gOffset--; renderGregorian(); });
  document.getElementById('gNext').addEventListener('click',()=>{ state.gOffset++; renderGregorian(); });
  document.getElementById('hPrev').addEventListener('click',()=>{ shiftHijri(-1); });
  document.getElementById('hNext').addEventListener('click',()=>{ shiftHijri(1); });
  dom.useApiToggle.addEventListener('change', async (e)=>{ state.refineEnabled=!!e.target.checked; localStorage.setItem('refineEnabled', state.refineEnabled?'1':'0'); if(state.refineEnabled){ await refineWithApiOnce().catch(()=>localUmmAlQuraFallbackAdjust()); } else { state.refineOffsetDays=0; dom.apiStatus.textContent='offline mode'; localUmmAlQuraFallbackAdjust(); rerenderAll(); } });
  if(state.refineEnabled){ refineWithApiOnce().catch(()=>localUmmAlQuraFallbackAdjust()); }
}

function updateClock(){ dom.clock.textContent=FMT_TIME.format(new Date()); }

function renderGregorian(){
  const base=new Date(); base.setMonth(base.getMonth()+state.gOffset); const year=base.getFullYear(); const month=base.getMonth()+1;
  dom.gTitle.textContent = `Gregorian — ${FMT_GREG_TITLE.format(base)}`;
  const firstDow=new Date(year,month-1,1).getDay(); const daysInMonth=new Date(year,month,0).getDate();
  buildGrid(dom.gGrid, firstDow, daysInMonth, (day)=>{ const h=gToH(year,month,day); return { gLabel:String(day), hLabel:`${h.hDay} ${hmDisp(h.hMonth)}`, meta:{y:year,m:month,d:day} }; }, 'greg');
}

function renderHijri(){
  let y=state.hYear, m=state.hMonth+state.hOffsetMonths; while(m>12){m-=12;y++;} while(m<1){m+=12;y--;}
  dom.hTitle.textContent = `Hijri — ${hmDisp(m)} ${y} AH`;
  const firstG=hToG(y,m,1); const firstDow=new Date(firstG.year,firstG.month-1,firstG.day).getDay(); const daysIn=islamicMonthLength(y,m);
  buildGrid(dom.hGrid, firstDow, daysIn, (day)=>{ const g=hToG(y,m,day); return { gLabel:`${g.day}/${g.month}`, hLabel:`${day}`, meta:{hy:y,hm:m,hd:day} }; }, 'hijri');
}

function buildGrid(container, firstDow, daysInMonth, makeCell, mode){
  container.innerHTML=''; const frag=document.createDocumentFragment();
  for(let i=0;i<firstDow;i++){ const e=document.createElement('div'); e.className='cell empty'; frag.appendChild(e); }
  const now=new Date(); const nowY=now.getFullYear(), nowM=now.getMonth()+1, nowD=now.getDate(); const todayH=gToH(nowY,nowM,nowD);
  for(let day=1; day<=daysInMonth; day++){
    const data=makeCell(day); const cell=document.createElement('div'); cell.className='cell';
    let gY,gM,gD; if(mode==='greg'){ gY=data.meta.y; gM=data.meta.m; gD=data.meta.d; } else { const gx=hToG(data.meta.hy,data.meta.hm,data.meta.hd); gY=gx.year; gM=gx.month; gD=gx.day; }
    const w=new Date(gY,gM-1,gD).getDay(); if(w===5||w===6) cell.classList.add('weekend');
    const gSpan=document.createElement('span'); gSpan.className='g'; gSpan.textContent=data.gLabel;
    const hSpan=document.createElement('span'); hSpan.className='h'; hSpan.textContent=data.hLabel;
    cell.appendChild(gSpan); cell.appendChild(hSpan);
    if(mode==='greg'){ if(data.meta.y===nowY && data.meta.m===nowM && data.meta.d===nowD){ cell.classList.add('today'); } }
    else { if(data.meta.hy===todayH.hYear && data.meta.hm===todayH.hMonth && data.meta.hd===todayH.hDay){ cell.classList.add('today'); } }
    cell.addEventListener('click',()=>{
      container.querySelectorAll('.selected').forEach(n=>n.classList.remove('selected'));
      cell.classList.add('selected');
      if(mode==='greg'){
        const gDate=new Date(data.meta.y, data.meta.m-1, data.meta.d); const h=gToH(data.meta.y,data.meta.m,data.meta.d);
        showSelection({ g:`${FMT_GREG_DATE.format(gDate)}`, h:`${h.hDay} ${hmDisp(h.hMonth)} ${h.hYear} AH` });
      } else {
        const g=hToG(data.meta.hy,data.meta.hm,data.meta.hd); const gDate=new Date(g.year,g.month-1,g.day);
        showSelection({ g:`${FMT_GREG_DATE.format(gDate)}`, h:`${data.meta.hd} ${hmDisp(data.meta.hm)} ${data.meta.hy} AH` });
      }
    });
    frag.appendChild(cell);
  }
  container.appendChild(frag);
}

function showSelection(obj){ dom.selection.innerHTML = `<div><strong>Gregorian:</strong> ${obj.g}</div><div><strong>Hijri:</strong> ${obj.h}</div>`; }
function renderTodayBlock(){ const now=new Date(); const y=now.getFullYear(), m=now.getMonth()+1, d=now.getDate(); const h=gToH(y,m,d); dom.todayBlock.innerHTML = `<div><strong>Gregorian today:</strong> ${FMT_GREG_DATE.format(now)}</div><div><strong>Hijri today:</strong> ${h.hDay} ${hmDisp(h.hMonth)} ${h.hYear} AH</div>`; }
function shiftHijri(delta){ state.hOffsetMonths+=delta; renderHijri(); }
function rerenderAll(){ renderGregorian(); renderHijri(); renderTodayBlock(); }

async function refineWithApiOnce(){
  try{ dom.apiStatus.textContent='refine: contacting…'; const now=new Date(); const y=now.getFullYear(), m=now.getMonth()+1, d=now.getDate(); const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),5000); const res=await fetch(`https://api.aladhan.com/v1/gToH/${d}-${m}-${y}?method=4`,{ signal:controller.signal }); clearTimeout(timer); if(!res.ok) throw new Error('HTTP '+res.status); const json=await res.json(); if(json&&json.code===200&&json.data&&json.data.hijri){ const h=json.data.hijri; const target={ y:parseInt(h.year,10), m:parseInt(h.month.number,10), d:parseInt(h.day,10) }; const jdToday=gregorianToJD(y,m,d); let best=0, found=false; for(let off=-2; off<=2; off++){ const probe=jdToIslamic(jdToday+off+state.refineOffsetDays); if(probe.hYear===target.y && probe.hMonth===target.m && probe.hDay===target.d){ best=off; found=true; break; } } state.refineOffsetDays = found ? (state.refineOffsetDays+best) : state.refineOffsetDays; dom.apiStatus.textContent = found ? `refined (offset ${best}d)` : 'refine: no change'; rerenderAll(); return; } throw new Error('Bad payload'); }catch(e){ dom.apiStatus.textContent='refine failed (offline)'; throw e; }
}

function localUmmAlQuraFallbackAdjust(){ const anchorG={year:2026,month:2,day:18}; const anchorH={y:1447,m:9,d:1}; try{ const jdA=gregorianToJD(anchorG.year,anchorG.month,anchorG.day); let best=0, found=false; for(let off=-2; off<=2; off++){ const probe=jdToIslamic(jdA+off+state.refineOffsetDays); if(probe.hYear===anchorH.y && probe.hMonth===anchorH.m && probe.hDay===anchorH.d){ best=off; found=true; break; } } if(found){ state.refineOffsetDays += best; dom.apiStatus.textContent=`refined locally (offset ${best}d)`; rerenderAll(); } }catch{}
}

window.addEventListener('DOMContentLoaded', init);
