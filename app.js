
"use strict";
/**
 * Dual Calendar — offline-first Hijri (tabular) + Gregorian
 * - Fast & lightweight (no frameworks)
 * - Optional one-shot online refinement via Aladhan gToH
 * - No timers besides 1s clock; event delegation; no alerts
 */

// ---- Intl formatters (cached) ----
const FMT_TIME = new Intl.DateTimeFormat('en-GB', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
const FMT_GREG_TITLE = new Intl.DateTimeFormat('en-GB', { month:'long', year:'numeric' });
const FMT_GREG_DATE = new Intl.DateTimeFormat('en-GB', { year:'numeric', month:'2-digit', day:'2-digit' });

const HIJRI_MONTHS = [
  'Muharram','Safar','Rabi\' al-Awwal','Rabi\' al-Thani','Jumada al-Awwal','Jumada al-Thani',
  'Rajab','Sha\'aban','Ramadan','Shawwal','Dhu al-Qi\'dah','Dhu al-Hijjah'
];

// ---- State ----
const state = {
  // Gregorian view: month offset from today
  gOffset: 0,
  // Hijri view: (year, month) derived from today + offset
  hYear: null,
  hMonth: null, // 1..12
  hOffsetMonths: 0,
  // One-shot network refinement (difference in days vs tabular)
  refineOffsetDays: 0,
  refineEnabled: false,
};

// ---- DOM ----
const dom = {
  gGrid: document.getElementById('gGrid'),
  gTitle: document.getElementById('gTitle'),
  hGrid: document.getElementById('hGrid'),
  hTitle: document.getElementById('hTitle'),
  clock: document.getElementById('clock'),
  selection: document.getElementById('selection'),
  todayBlock: document.getElementById('todayBlock'),
  apiStatus: document.getElementById('apiStatus'),
  useApiToggle: document.getElementById('useApiToggle'),
};

// ---- Utility: toast ----
let toastTimer=0; function showToast(html, ms=2200){ const t=document.getElementById('toast'); if(!t) return; t.innerHTML=html; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'), ms); }

// ---- Islamic calendar math (tabular) ----
// Algorithms adapted from the arithmetic Islamic calendar
const ISLAMIC_EPOCH = 1948439.5; // Julian Day for 1 Muharram 1 AH

function isIslamicLeapYear(hYear){
  return ((11*hYear + 14) % 30) < 11;
}

function islamicMonthLength(hYear, hMonth){
  // Muharram (1) starts with 30, alternating 30/29, with Dhu al-Hijjah +1 on leap
  if (hMonth === 12) return isIslamicLeapYear(hYear) ? 30 : 29;
  return (hMonth % 2 === 1) ? 30 : 29;
}

// Gregorian → Julian Day Number (integer JD at noon)
function gregorianToJD(y,m,d){
  // Fliegel–Van Flandern algorithm
  const a = Math.floor((14 - m)/12);
  const y2 = y + 4800 - a;
  const m2 = m + 12*a - 3;
  let jd = d + Math.floor((153*m2 + 2)/5) + 365*y2 + Math.floor(y2/4) - Math.floor(y2/100) + Math.floor(y2/400) - 32045;
  return jd;
}

// JD → Gregorian (y,m,d)
function jdToGregorian(jd){
  let a = jd + 32044;
  let b = Math.floor((4*a + 3)/146097);
  let c = a - Math.floor((146097*b)/4);
  let d = Math.floor((4*c + 3)/1461);
  let e = c - Math.floor(1461*d/4);
  let m = Math.floor((5*e + 2)/153);
  let day = e - Math.floor((153*m + 2)/5) + 1;
  let month = m + 3 - 12*Math.floor(m/10);
  let year = 100*b + d - 4800 + Math.floor(m/10);
  return {year, month, day};
}

function islamicToJD(hYear, hMonth, hDay){
  // arithmetic Islamic calendar to JD
  const n = hDay + Math.ceil(29.5*(hMonth-1)) + (hYear-1)*354 + Math.floor((3 + 11*hYear)/30);
  return Math.floor(n + ISLAMIC_EPOCH - 1);
}

function jdToIslamic(jd){
  const days = Math.floor(jd - ISLAMIC_EPOCH) + 1;
  const hYear = Math.floor((30*days + 10646) / 10631);
  const startOfYear = islamicToJD(hYear, 1, 1);
  let hMonth = Math.ceil((jd - startOfYear + 1) / 29.5);
  if (hMonth < 1) hMonth = 1; if (hMonth > 12) hMonth = 12;
  const startOfMonth = islamicToJD(hYear, hMonth, 1);
  const hDay = jd - startOfMonth + 1;
  return { hYear, hMonth, hDay };
}

// Convenience converters with optional refinement offset (days)
function gToH(y,m,d){
  const jd = gregorianToJD(y,m,d) + state.refineOffsetDays;
  return jdToIslamic(jd);
}
function hToG(hYear,hMonth,hDay){
  const jd = islamicToJD(hYear,hMonth,hDay) - state.refineOffsetDays;
  return jdToGregorian(jd);
}

// ---- Initialize ----
function init(){
  // Restore setting
  state.refineEnabled = localStorage.getItem('refineEnabled') === '1';
  dom.useApiToggle.checked = state.refineEnabled;
  dom.apiStatus.textContent = state.refineEnabled ? 'refine: pending…' : 'offline mode';

  // Clock
  updateClock(); setInterval(()=>{ updateClock(); }, 1000);

  // Today base
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth()+1, d = now.getDate();
  const {hYear, hMonth} = gToH(y,m,d);
  state.hYear = hYear; state.hMonth = hMonth;

  // Render initial
  renderGregorian();
  renderHijri();
  renderTodayBlock();

  // Events
  document.getElementById('gPrev').addEventListener('click', ()=>{ state.gOffset--; renderGregorian(); });
  document.getElementById('gNext').addEventListener('click', ()=>{ state.gOffset++; renderGregorian(); });
  document.getElementById('hPrev').addEventListener('click', ()=>{ shiftHijri(-1); });
  document.getElementById('hNext').addEventListener('click', ()=>{ shiftHijri(1); });

  dom.useApiToggle.addEventListener('change', async (e)=>{
    state.refineEnabled = !!e.target.checked;
    localStorage.setItem('refineEnabled', state.refineEnabled ? '1':'0');
    if (state.refineEnabled) await refineWithApiOnce(); else { state.refineOffsetDays = 0; dom.apiStatus.textContent = 'offline mode'; rerenderAll(); }
  });

  // Optional refine at start
  if (state.refineEnabled) refineWithApiOnce();
}

function updateClock(){ dom.clock.textContent = FMT_TIME.format(new Date()); }

function renderGregorian(){
  const base = new Date(); base.setMonth(base.getMonth() + state.gOffset);
  const year = base.getFullYear(); const month = base.getMonth() + 1;
  dom.gTitle.textContent = `Gregorian — ${FMT_GREG_TITLE.format(base)}`;

  const firstDow = new Date(year, month-1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  buildGrid(dom.gGrid, firstDow, daysInMonth, (day)=>{
    const h = gToH(year, month, day);
    return { gLabel: String(day), hLabel: `${h.hDay} ${HIJRI_MONTHS[h.hMonth-1]}` , meta: { y:year, m:month, d:day } };
  }, 'greg');
}

function renderHijri(){
  // display month after offset
  let y = state.hYear, m = state.hMonth + state.hOffsetMonths;
  while (m > 12){ m -= 12; y++; }
  while (m < 1){ m += 12; y--; }
  dom.hTitle.textContent = `Hijri — ${HIJRI_MONTHS[m-1]} ${y} AH`;

  const firstG = hToG(y, m, 1); // convert first day of hijri month to gregorian to get weekday
  const firstDow = new Date(firstG.year, firstG.month-1, firstG.day).getDay();
  const daysIn = islamicMonthLength(y, m);
  buildGrid(dom.hGrid, firstDow, daysIn, (day)=>{
    const g = hToG(y, m, day);
    return { gLabel: `${g.day}/${g.month}`, hLabel: String(day), meta: { hy:y, hm:m, hd:day } };
  }, 'hijri');
}

function buildGrid(container, firstDow, daysInMonth, makeCell, mode){
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (let i=0;i<firstDow;i++){
    const e = document.createElement('div'); e.className='cell empty'; frag.appendChild(e);
  }
  const now = new Date(); const nowY= now.getFullYear(), nowM = now.getMonth()+1, nowD = now.getDate();
  const todayH = gToH(nowY, nowM, nowD);

  for (let day=1; day<=daysInMonth; day++){
    const data = makeCell(day);
    const cell = document.createElement('div'); cell.className = 'cell';
    const gSpan = document.createElement('span'); gSpan.className='g'; gSpan.textContent = data.gLabel;
    const hSpan = document.createElement('span'); hSpan.className='h'; hSpan.textContent = data.hLabel;
    cell.appendChild(gSpan); cell.appendChild(hSpan);

    // Mark today
    if (mode==='greg'){
      if (data.meta.y===nowY && data.meta.m===nowM && data.meta.d===nowD){ cell.classList.add('today'); }
    }else{
      if (data.meta.hy===todayH.hYear && data.meta.hm===todayH.hMonth && data.meta.hd===todayH.hDay){ cell.classList.add('today'); }
    }

    // Click handler
    cell.addEventListener('click', ()=>{
      container.querySelectorAll('.selected').forEach(n=>n.classList.remove('selected'));
      cell.classList.add('selected');
      if (mode==='greg'){
        const gDate = new Date(data.meta.y, data.meta.m-1, data.meta.d);
        const h = gToH(data.meta.y, data.meta.m, data.meta.d);
        showSelection({
          g: `${FMT_GREG_DATE.format(gDate)}`,
          h: `${h.hDay} ${HIJRI_MONTHS[h.hMonth-1]} ${h.hYear} AH`
        });
      }else{
        const g = hToG(data.meta.hy, data.meta.hm, data.meta.hd);
        const gDate = new Date(g.year, g.month-1, g.day);
        showSelection({
          g: `${FMT_GREG_DATE.format(gDate)}`,
          h: `${data.meta.hd} ${HIJRI_MONTHS[data.meta.hm-1]} ${data.meta.hy} AH`
        });
      }
    });

    frag.appendChild(cell);
  }
  container.appendChild(frag);
}

function showSelection(obj){
  dom.selection.innerHTML = `<div><strong>Gregorian:</strong> ${obj.g}</div>`+
                            `<div><strong>Hijri:</strong> ${obj.h}</div>`;
}

function renderTodayBlock(){
  const now = new Date(); const y=now.getFullYear(), m=now.getMonth()+1, d=now.getDate();
  const h = gToH(y,m,d);
  dom.todayBlock.innerHTML = `<div><strong>Gregorian today:</strong> ${FMT_GREG_DATE.format(now)}</div>`+
    `<div><strong>Hijri today:</strong> ${h.hDay} ${HIJRI_MONTHS[h.hMonth-1]} ${h.hYear} AH</div>`;
}

function shiftHijri(delta){ state.hOffsetMonths += delta; renderHijri(); }

function rerenderAll(){ renderGregorian(); renderHijri(); renderTodayBlock(); }

// ---- Optional one-shot API refinement ----
async function refineWithApiOnce(){
  try{
    dom.apiStatus.textContent = 'refine: contacting…';
    const now = new Date(); const y=now.getFullYear(), m=now.getMonth()+1, d=now.getDate();
    const tab = gToH(y,m,d); // current tabular

    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), 5000);
    const url = `https://api.aladhan.com/v1/gToH/${d}-${m}-${y}?method=4`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) throw new Error('HTTP '+res.status);
    const json = await res.json();
    if (json && json.code===200 && json.data && json.data.hijri){
      const h = json.data.hijri; // strings
      // Compute offset in days by matching Hijri (day only) via JD around today
      // We will search offset in [-2..+2] days that matches (year,month,day)
      const target = {y:parseInt(h.year,10), m:parseInt(h.month.number,10), d:parseInt(h.day,10)};
      const jdToday = gregorianToJD(y,m,d);
      let best = 0, found=false;
      for (let off=-2; off<=2; off++){
        const probe = jdToIslamic(jdToday + off);
        if (probe.hYear===target.y && probe.hMonth===target.m && probe.hDay===target.d){ best = off; found=true; break; }
      }
      state.refineOffsetDays = found ? best : 0;
      dom.apiStatus.textContent = found ? `refined (offset ${best}d)` : 'refine: no change';
      rerenderAll();
      return;
    }
    throw new Error('Bad payload');
  }catch(e){
    dom.apiStatus.textContent = 'refine failed (offline)';
  }
}

// ---- Start ----
window.addEventListener('DOMContentLoaded', init);
