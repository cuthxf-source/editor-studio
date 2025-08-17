/* editor-studio / app.js  v1.5.1 */
const APP_VERSION = 'V1.5.1';

/* Supabase */
const supa = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

/* 主题 */
const rootEl = document.documentElement;
const themeBtn = document.getElementById('btn-theme');
function applyTheme(t){ rootEl.setAttribute('data-theme',t); if(themeBtn) themeBtn.textContent=(t==='dark'?'浅色':'深色'); localStorage.setItem('theme',t); }
(function(){ const saved=localStorage.getItem('theme'); const sys=matchMedia('(prefers-color-scheme: dark)').matches; applyTheme(saved || (sys?'dark':'light')); })();
themeBtn?.addEventListener('click',()=> applyTheme(rootEl.getAttribute('data-theme')==='dark'?'light':'dark'));

/* 视图与登录 */
const $ = (id)=> document.getElementById(id);
const views={auth:$('view-auth'),home:$('view-home'),projects:$('view-projects'),schedule:$('view-schedule'),gallery:$('view-gallery'),finance:$('view-finance')};
const nav={home:$('btn-home'),projects:$('btn-projects'),schedule:$('btn-schedule'),gallery:$('btn-gallery'),finance:$('btn-finance'),logout:$('btn-logout')};
function showView(name){ Object.values(views).forEach(v=>v.classList.add('hidden')); (views[name]||views.home).classList.remove('hidden'); document.querySelectorAll('.nav-btn').forEach(b=>b.removeAttribute('aria-current')); ({home:nav.home,projects:nav.projects,schedule:nav.schedule,gallery:nav.gallery,finance:nav.finance}[name])?.setAttribute('aria-current','page'); }
const authForm=$('auth-form'), authTip=$('auth-tip');
nav.logout.addEventListener('click', async ()=>{ await supa.auth.signOut(); showView('auth'); });
authForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email=$('email').value.trim(), password=$('password').value.trim();
  let { error } = await supa.auth.signInWithPassword({ email, password });
  if(error){ const { error: signUpErr } = await supa.auth.signUp({ email, password }); if(signUpErr){ authTip.textContent=signUpErr.message; return; } }
  const { data:{ session } } = await supa.auth.getSession();
  if(session){ await bootAfterAuth(); showView('home'); }
});

/* 数据 */
let projects=[];
async function fetchProjects(){
  const { data, error } = await supa
    .from('projects')
    .select(`id,title,brand,type,spec,clips,notes,pay_status,quote_amount,deposit_amount,paid_amount,producer_name,producer_contact,a_copy,b_copy,final_date,final_link,poster_url,updated_at`)
    .order('updated_at',{ ascending:false })
    .limit(1000);
  if(error){ console.error(error); return; }
  projects = data || [];
}

/* Notes & 优先级 */
function parseNotes(notes){
  const base={tags:new Set(),versions:{A:'v1',B:'v1',F:'v1'},changes:[],free:'',priority:'P3'};
  if(!notes) return base;
  try{
    const obj=JSON.parse(notes);
    if(obj) return {tags:new Set(Array.isArray(obj.tags)?obj.tags:[]),versions:obj.versions||{A:'v1',B:'v1',F:'v1'},changes:Array.isArray(obj.changes)?obj.changes:[],free:obj.free||'',priority:obj.priority||'P3'};
  }catch(e){}
  const tags=new Set((notes.match(/#[A-Z_]+/g)||[]));
  return {tags,versions:{A:'v1',B:'v1',F:'v1'},changes:[],free:notes,priority:'P3'};
}
function stringifyNotes(o){ return JSON.stringify({tags:Array.from(o.tags||[]),versions:o.versions||{A:'v1',B:'v1',F:'v1'},changes:o.changes||[],free:o.free||'',priority:o.priority||'P3'}); }
function hasTag(n,t){ return parseNotes(n).tags.has(t); }
function getPriority(p){ return parseNotes(p.notes).priority||'P3'; }
function priRank(code){ return ({P1:0,P2:1,P3:2,P4:3})[code] ?? 2; }
function priObj(code){ const map={P1:{k:'P1',txt:'紧急且重要',cls:'pri-p1'},P2:{k:'P2',txt:'重要不紧急',cls:'pri-p2'},P3:{k:'P3',txt:'次要一般',cls:'pri-p3'},P4:{k:'P4',txt:'观察排期',cls:'pri-p4'}}; return map[code] || map.P3; }

/* 工具 */
const money = n => `¥${(Number(n||0)).toLocaleString()}`;
const moneyAbbr = n => {
  const v = Number(n||0);
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if(a >= 1e6) return sign + '¥' + (a/1e6).toFixed(a % 1e6 === 0 ? 0 : 1) + 'M';
  if(a >= 1e3) return sign + '¥' + (a/1e3).toFixed(a % 1e3 === 0 ? 0 : 1) + 'K';
  return sign + '¥' + Math.round(a);
};
const fmt = d => d? new Date(d): null;
function parseSpec(specStr){
  const s=specStr||''; let json=null;
  try{ if(s.trim().startsWith('{')||s.trim().startsWith('[')) json=JSON.parse(s);}catch(e){json=null;}
  if(json){ const combos=Array.isArray(json)?json:(json.combos||[]); return {json:true,combos}; }
  const raw=s.split('·').map(x=>x.trim()); let res=raw[0]||'', ratio=raw[1]||''; if(!ratio && res.includes(':')){ratio=res; res='';}
  return {json:false,combos:[{type:'',clips:1,res,ratios:ratio?[ratio]:[]}]};
}
function typeSpecLines(p){
  const parsed=parseSpec(p.spec);
  if(parsed.json){ return parsed.combos.map(c=>`${c.type||'未填'}×${c.clips||1}${c.res?` · ${c.res}`:''}${c.ratios?.length?` · ${c.ratios.join('/')}`:''}`); }
  const c=parsed.combos[0]||{}; const clips=p.clips?` · ${p.clips}条`:''; const type=p.type||''; const r=c.ratios?.length?` · ${c.ratios.join('/')}`:(c.ratio?` · ${c.ratio}`:''); const rr=c.res?` · ${c.res}`:''; const joined=[type,rr.replace(' · ','').trim()].filter(Boolean).join(' · '); return [(joined?joined:'—')+clips+(r||'')];
}
function totalClipsOf(p){ const parsed=parseSpec(p.spec); return parsed.json? parsed.combos.reduce((s,c)=>s+Number(c.clips||0),0) || Number(p.clips||0) || 0 : Number(p.clips||0)||0; }
function unpaidAmt(p){ return Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0),0); }
function stageInfo(p){
  const d=parseNotes(p.notes);
  const A=!hasTag(p.notes,'#A_DONE'), B=!hasTag(p.notes,'#B_DONE'), F=!hasTag(p.notes,'#F_DONE');
  if(A) return {name:'Acopy',percent:30,version:d.versions.A||'v1'};
  if(B) return {name:'Bcopy',percent:60,version:d.versions.B||'v1'};
  if(F) return {name:'Final',percent:80,version:d.versions.F||'v1'};
  return {name:'完结',percent:85,version:''};
}
function nearestMilestone(p){
  const today=new Date(); today.setHours(0,0,0,0);
  const A=fmt(p.a_copy), B=fmt(p.b_copy), F=fmt(p.final_date);
  const doneA=hasTag(p.notes,'#A_DONE'), doneB=hasTag(p.notes,'#B_DONE'), doneF=hasTag(p.notes,'#F_DONE');
  const items=[]; if(A && !doneA) items.push({k:'Acopy',date:A}); if(B && !doneB) items.push({k:'Bcopy',date:B}); if(F && !doneF) items.push({k:'Final',date:F});
  if(items.length===0){
    const past=[{k:'Acopy',date:A,done:doneA},{k:'Bcopy',date:B,done:doneB},{k:'Final',date:F,done:doneF}].filter(x=>x.date).sort((a,b)=>b.date-a.date)[0];
    if(!past) return {text:'—',overdue:false,date:null,k:null};
    const overdue=past.date<today&&!past.done;
    return {text:`${past.k} - ${past.date.getMonth()+1}/${past.date.getDate()}`, overdue, date:past.date, k:past.k};
  }
  items.sort((a,b)=> a.date-b.date);
  const n=items[0];
  return { text:`${n.k} - ${n.date.getMonth()+1}/${n.date.getDate()}`, overdue:n.date<today, date:n.date, k:n.k };
}

/* 首页：最近项目（能量条直接显示） */
function renderRecent(){
  const box=$('recent-list'); box.innerHTML='';
  const weighted = projects.map(p=>{
    const n=nearestMilestone(p);
    let w=1e15; if(n.date){ const now=new Date(); const diff=n.date-now; w=(diff>=0?diff:Math.abs(diff)+1e12); }
    return {p, w, pri: priRank(getPriority(p))};
  }).sort((a,b)=> a.pri-b.pri || a.w-b.w).slice(0,4);

  weighted.forEach(({p})=>{
    const near=nearestMilestone(p), st=stageInfo(p), verTxt=st.version || '—';
    const li=document.createElement('div'); li.className='list-item';
    li.innerHTML = `
      <div class="pmeta">
        <div class="title-wrap">
          <div><strong>${p.title||'未命名'}</strong> ${p.brand?`· ${p.brand}`:''}</div>
          <div class="subtitle">合作制片：${[p.producer_name,p.producer_contact].filter(Boolean).join(' · ')||'—'}</div>
        </div>
        <div class="prog-wrap">
          <div class="prog" title="${st.name}${st.version?(' '+st.version):''} ${st.percent}%">
            <div class="prog-bar" style="width:${st.percent}%"></div>
            <span class="prog-text">${st.percent}%</span>
          </div>
        </div>
      </div>
      <div class="count muted small">条数：${totalClipsOf(p)||1}</div>
      <div class="due ${near.overdue?'pill pill-red':'pill'}">${near.text}</div>
      <div class="ver-pill">${verTxt}</div>
    `;
    li.addEventListener('click', ()=> openQuickModal(p.id));
    box.appendChild(li);
  });

  $('go-list')?.addEventListener('click', (e)=>{ e.stopPropagation(); showView('projects'); }, { once:true });
}

/* KPI（首页不显示 as-of；财务页显示） */
function renderKpis(){
  const total=projects.reduce((s,p)=>s+Number(p.quote_amount||0),0);
  const paid =projects.reduce((s,p)=>s+Number(p.paid_amount||0),0);
  const unpaid=projects.reduce((s,p)=>s+unpaidAmt(p),0);
  const clipDone=projects.reduce((s,p)=> s+(hasTag(p.notes,'#F_DONE')? totalClipsOf(p):0),0);
  const clipAll =projects.reduce((s,p)=> s+totalClipsOf(p),0);
  $('kpi-total').textContent=money(total);
  $('kpi-paid').textContent=money(paid);
  $('kpi-unpaid').textContent=money(unpaid);
  $('kpi-done').textContent=String(clipDone);
  $('kpi-todo').textContent=String(Math.max(clipAll-clipDone,0));
  $('f-total').textContent=money(total);
  $('f-paid').textContent=money(paid);
  $('f-unpaid').textContent=money(unpaid);

  const t=new Date(); const s=`截至 ${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  const fAsOf=$('f-asof'); if(fAsOf) fAsOf.textContent=s;
  const hAsOf=$('home-asof'); if(hAsOf){ hAsOf.textContent=''; hAsOf.style.display='none'; }
}

/* 报价分析器（横向）留存 —— 计算逻辑保持 */
(function initQuote(){
  const typeBase={'LookBook':{price:100,baseSec:15,secRate:0.01},'形象片':{price:3500,baseSec:45,secRate:0.03},'TVC':{price:7000,baseSec:60,secRate:0.03},'纪录片':{price:12000,baseSec:180,secRate:0.005},'微电影':{price:12000,baseSec:180,secRate:0.005}};
  const elType=$('qa-type'), elBase=$('qa-base'), elSecs=$('qa-secs');
  const elCreative=$('qa-creative'), elUrgent=$('qa-urgent'), elRev=$('qa-rev');
  const elMultiToggle=$('qa-multi-toggle'), elMulti=$('qa-multi'), list=$('qa-mc-list'), addBtn=$('qa-mc-add');

  const refreshLabels=()=>{ $('qa-creative-val').textContent=elCreative.value+'%'; $('qa-urgent-val').textContent=elUrgent.value+'%'; };
  ['input','change'].forEach(ev=>{ elCreative.addEventListener(ev,refreshLabels); elUrgent.addEventListener(ev,refreshLabels); });
  refreshLabels();

  function unitPriceBy(type, secs, baseOverride){
    const def=typeBase[type] || {price:0, baseSec:0, secRate:0};
    const base=Number(baseOverride || def.price);
    const over=Math.max(0, Number(secs||0) - def.baseSec);
    const secFactor = over>0 ? Math.pow(1+def.secRate, over) : 1;
    let price = base * secFactor;
    price *= (1 + Number(elCreative.value||0)/100);
    price *= (1 + (Number(elUrgent.value||0)/10)*0.03);
    const extraRev = Math.max(0, Number(elRev.value||0) - 4);
    price *= (1 + extraRev*0.20);
    return Math.round(price);
  }

  function calcSingle(){
    const net = unitPriceBy(elType.value, Number(elSecs.value||0), elBase.value||undefined);
    const gross = Math.round(net * 1.06);
    $('qa-net').textContent   = money(net);
    $('qa-gross').textContent = money(gross);
  }

  function mcRowHTML(idx, c){
    return `
      <div class="h-row" data-idx="${idx}" style="margin:10px 0 0">
        <label>类型
          <select class="mc-type">
            ${['LookBook','形象片','TVC','纪录片','微电影'].map(o=>`<option ${o===(c.type||'LookBook')?'selected':''}>${o}</option>`).join('')}
          </select>
        </label>
        <label>条数 <input class="mc-count" type="number" min="1" value="${c.count||1}"></label>
        <label>时长（秒/每条）<input class="mc-secs" type="number" min="0" step="1" value="${c.secs||0}"></label>
      </div>`;
  }
  function ensureOneRow(){ if(!list.querySelector('[data-idx]')) list.insertAdjacentHTML('beforeend', mcRowHTML(0,{type:'LookBook',count:1,secs:0})); }
  function calcMulti(){
    const rows=[...list.querySelectorAll('[data-idx]')];
    const totalNet = rows.reduce((sum,row)=>{
      const type=row.querySelector('.mc-type').value;
      const count=Number(row.querySelector('.mc-count').value||1);
      const secs =Number(row.querySelector('.mc-secs').value||0);
      return sum + count * unitPriceBy(type, secs);
    },0);
    $('qa-net').textContent   = money(totalNet);
    $('qa-gross').textContent = money(Math.round(totalNet*1.06));
  }
  function calc(){ if(elMultiToggle.checked){ calcMulti(); }else{ calcSingle(); } }

  addBtn?.addEventListener('click',()=>{ const idx=list.querySelectorAll('[data-idx]').length; list.insertAdjacentHTML('beforeend', mcRowHTML(idx,{type:'LookBook',count:1,secs:0})); calc(); });
  elMultiToggle?.addEventListener('change', ()=>{ elMulti.classList.toggle('hidden', !elMultiToggle.checked); if(elMultiToggle.checked){ ensureOneRow(); calcMulti(); } else { calcSingle(); } });
  $('quote-form').addEventListener('input', calc);

  calc(); // 默认单组合
})();

/* 编辑模态与项目表渲染……（保持原逻辑） */

/* 项目表 */
function formatProgressCell(p){
  const vers=parseNotes(p.notes).versions;
  const near=nearestMilestone(p);
  const doneF=hasTag(p.notes,'#F_DONE');
  if(doneF && p.final_date){
    const d=new Date(p.final_date);
    return `<span class="pill">完结</span> <span class="small">- ${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}</span>`;
  }
  if(!near||!near.k||!near.date) return '—';
  const mm=String(near.date.getMonth()+1).padStart(2,'0');
  const dd=String(near.date.getDate()).padStart(2,'0');
  const small=near.k==='Acopy'? (vers.A||'v1') : near.k==='Bcopy'? (vers.B||'v1') : (vers.F||'v1');
  return `<span class="pill">${near.k}</span> <span class="small">- ${mm}.${dd} - ${small}</span>`;
}
function renderRow(p){
  const tr=document.createElement('tr');
  const pay = p.pay_status || (unpaidAmt(p)<=0 ? '已收尾款' : (Number(p.paid_amount||0)>0?'已收定金':'未收款'));
  const moneyText=`${moneyAbbr(p.quote_amount)} / ${moneyAbbr(p.paid_amount)}`;
  const d=parseNotes(p.notes);
  const last=[...(d.changes||[])].sort((a,b)=>b.ts-a.ts)[0];
  const lastText=last ? `[${last.phase}·${last.version}] ${last.text.slice(0,42)}${last.text.length>42?'…':''}` : '—';
  const thumbs=last?.imgs?.length ? last.imgs.slice(0,4).map(u=>`<img class="tiny-thumb img-thumb" src="${u}" data-full="${u}" title="点击查看">`).join('') : '';
  const pri=priObj(d.priority||'P3');

  const payClass = pay==='未收款' ? 'pill-blue' : (pay==='已收定金' ? 'pill-green' : 'pill-gold');

  const upOk= !!p.poster_url || !!p.final_link;
  const upTxt = upOk ? '已上传' : '未上传';
  const upCls = upOk ? 'pill-green' : 'pill-blue';

  tr.innerHTML = `
    <td contenteditable="true" data-k="title" data-id="${p.id}">${p.title||''}</td>
    <td><div class="cell-summary"><span>${p.producer_name||'未填'}</span>${p.producer_contact?`<span class="muted small">· ${p.producer_contact}</span>`:''}<button class="cell-edit edit-btn" data-kind="producer" data-id="${p.id}">编辑</button></div></td>
    <td><div class="cell-summary"><span class="text-cell">${(typeSpecLines(p).join('<br>'))||'—'}</span><button class="cell-edit edit-btn" data-kind="spec" data-id="${p.id}">编辑</button></div></td>
    <td><div class="cell-summary"><span class="text-cell">${formatProgressCell(p)}</span><button class="cell-edit edit-btn" data-kind="progress" data-id="${p.id}">编辑</button></div></td>
    <td class="col-priority"><div class="cell-summary"><button class="pill ${pri.cls} pri-toggle" data-id="${p.id}" title="点击切换优先级">${pri.k}·${pri.txt}</button></div></td>
    <td class="col-pay"><div class="cell-summary"><button class="pill ${payClass} pay-pill" data-id="${p.id}" data-st="${pay}">${pay}</button></div></td>
    <td><div class="cell-summary"><span class="muted text-cell">${moneyText}</span><button class="cell-edit edit-btn" data-kind="money" data-id="${p.id}">编辑</button></div></td>
    <td class="col-changes"><div class="cell-summary"><span class="small text-cell">${lastText}</span>${thumbs?`<div class="thumb-list">${thumbs}</div>`:''}<button class="cell-edit edit-btn" data-kind="changes" data-id="${p.id}">编辑</button></div></td>
    <td class="col-upload"><div class="cell-summary"><button class="pill ${upCls} upload-pill" data-id="${p.id}">${upTxt}</button></div></td>
  `;
  return tr;
}

/* 作品合集：抽“靠近首帧”的一帧作为海报 */
const thumbCache=new Map();
function captureVideoMiddleFrame(url){
  return new Promise((resolve)=>{
    try{
      const v=document.createElement('video');
      v.crossOrigin='anonymous'; v.muted=true; v.playsInline=true; v.preload='metadata';
      v.src=url;
      v.addEventListener('loadedmetadata',()=>{
        const t = isFinite(v.duration) && v.duration>0 ? Math.min(0.1, v.duration*0.05) : 0.1;
        v.currentTime = t; // 近首帧自动取一帧
      }, { once:true });
      v.addEventListener('seeked',()=>{
        try{
          const canvas=document.createElement('canvas');
          canvas.width=v.videoWidth||1280; canvas.height=v.videoHeight||720;
          const ctx=canvas.getContext('2d'); ctx.drawImage(v,0,0,canvas.width,canvas.height);
          const data=canvas.toDataURL('image/jpeg',0.85);
          resolve(data);
        }catch(e){ resolve(null); }
      }, { once:true });
      v.addEventListener('error',()=> resolve(null), { once:true });
      v.addEventListener('timeupdate',()=>{ resolve(null); }, { once:true });
    }catch(e){ resolve(null); }
  });
}
async function getCoverFor(p){
  if(p.poster_url) return p.poster_url;
  if(thumbCache.has(p.final_link)) return thumbCache.get(p.final_link);
  let cover=null;
  if(p.final_link){
    if(/\.(png|jpe?g|webp)$/i.test(p.final_link)) cover=p.final_link;
    else if(/\.(mp4|mov|m4v|webm|ogg)$/i.test(p.final_link)) cover=await captureVideoMiddleFrame(p.final_link);
  }
  if(!cover){
    cover='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#f2f2f7"/><stop offset="1" stop-color="#e9ecef"/></linearGradient></defs><rect fill="url(#g)" width="1600" height="900"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="64" fill="#999">No Cover</text></svg>`);
  }
  thumbCache.set(p.final_link, cover); return cover;
}
async function renderGallery(){
  const grid=$('gallery-grid'); grid.innerHTML='';
  const finals=projects.filter(p=>p.final_link);
  if(finals.length===0){
    const ph=document.createElement('div'); ph.className='mag-card'; ph.innerHTML=`<div class="mag-cap">暂未上传成片，请在项目中上传海报或视频</div>`; grid.appendChild(ph); return;
  }
  for(let i=0;i<finals.length;i++){
    const p=finals[i];
    const a=document.createElement('a'); a.className='mag-card'; a.href=p.final_link; a.target='_blank';
    if(Math.random()<0.3) a.classList.add('mag-span2');
    const cover=await getCoverFor(p);
    a.innerHTML = `<img class="mag-cover" src="${cover}" alt=""><div class="mag-cap">${p.title||'未命名'}${p.brand?` · ${p.brand}`:''}</div>`;
    grid.appendChild(a);
  }
}

/* 日历：项目配色（8色循环） + 边框条形 */
const gridEl  = $('cal-grid');
const labelEl = $('cal-label');
let calBase=new Date(); calBase.setDate(1);
$('cal-prev').addEventListener('click', ()=>{ calBase.setMonth(calBase.getMonth()-1); renderCalendar(); });
$('cal-next').addEventListener('click', ()=>{ calBase.setMonth(calBase.getMonth()+1); renderCalendar(); });
function colorIndexForId(id){
  let s=0; const str=String(id||'0');
  for(let i=0;i<str.length;i++){ s=(s*31 + str.charCodeAt(i)) >>> 0; }
  return s % 8; // 对应 .c0 ~ .c7
}
function renderCalendar(){
  gridEl.innerHTML=''; const y=calBase.getFullYear(), m=calBase.getMonth();
  labelEl.textContent=`${y}年 ${m+1}月`;
  const first=new Date(y,m,1), start=(first.getDay()+6)%7, days=new Date(y,m+1,0).getDate();
  const dayCells=Array.from({length:days+1},()=>null);
  for(let i=0;i<42;i++){
    const cell=document.createElement('div'); cell.className='cal-cell';
    const day=i-start+1;
    if(day>0 && day<=days){ const head=document.createElement('div'); head.className='cal-day'; head.textContent=String(day); cell.appendChild(head); dayCells[day]=cell; }
    gridEl.appendChild(cell);
  }
  projects.forEach(p=>{
    const vers=parseNotes(p.notes).versions||{A:'v1',B:'v1',F:'v1'};
    const A=fmt(p.a_copy), B=fmt(p.b_copy), F=fmt(p.final_date);
    const spans=[];
    if(A && B) spans.push({k:'a',label:'Acopy',ver:vers.A,s:new Date(A),e:new Date(B.getTime()-86400000)});
    if(B && F) spans.push({k:'b',label:'Bcopy',ver:vers.B,s:new Date(B),e:new Date(F.getTime()-86400000)});
    if(F) spans.push({k:'f',label:'Final',ver:vers.F,s:new Date(F),e:new Date(F)});
    spans.forEach(sp=>{
      const monStart=new Date(y,m,1), monEnd=new Date(y,m,days);
      let s=sp.s, e=sp.e; if(e<monStart || s>monEnd) return; if(s<monStart) s=monStart; if(e>monEnd) e=monEnd;
      const sDay=s.getDate(), eDay=e.getDate();
      for(let d=sDay; d<=eDay; d++){
        const line=document.createElement('div'); line.className='bar-line';
        const ci=colorIndexForId(p.id); const piece=document.createElement('div'); piece.className=`span-piece c${ci} ${d===sDay?'span-start':''} ${d===eDay?'span-end':''}`;
        if(d===sDay){
          const label=document.createElement('span'); label.className='span-text';
          label.textContent=`${p.title||'未命名'} · ${sp.label}${sp.ver?(' '+sp.ver):''}`;
          piece.appendChild(label);
        }
        line.appendChild(piece);
        dayCells[d]?.appendChild(line);
      }
    });
  });
}

/* 财务/上传/启动等逻辑保持原样…… */
function renderFinance(){ /* 原实现 */ }
function drawTrend(container, arr){ /* 原实现 */ }
function openUploadModal(id){ /* 原实现 */ }
function renderAll(){ renderKpis(); renderRecent(); renderProjects(); renderGallery(); renderFinance(); }
async function boot(){ const { data:{ session } } = await supa.auth.getSession(); if(!session){ showView('auth'); return; } await bootAfterAuth(); }
async function bootAfterAuth(){ await fetchProjects(); renderAll(); showView('home'); }
boot();
