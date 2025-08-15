/* editor-studio / app.js  v0.9 (2025-08-13) */

// ============== Auth 初始化（保持会话 & 自动刷新） ==============
const supa = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

// ============== 视图切换 ==============
const views = {
  auth:     document.getElementById('view-auth'),
  home:     document.getElementById('view-home'),
  projects: document.getElementById('view-projects'),
  gallery:  document.getElementById('view-gallery'),
  finance:  document.getElementById('view-finance'),
};
const nav = {
  home:     document.getElementById('btn-home'),
  projects: document.getElementById('btn-projects'),
  schedule: document.getElementById('btn-schedule'),
  gallery:  document.getElementById('btn-gallery'),
  finance:  document.getElementById('btn-finance'),
  logout:   document.getElementById('btn-logout'),
};
function showView(name){
  Object.values(views).forEach(v=>v.classList.add('hidden'));
  (views[name]||views.home).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b=>b.removeAttribute('aria-current'));
  ({home:nav.home, projects:nav.projects, gallery:nav.gallery, finance:nav.finance}[name])?.setAttribute('aria-current','page');
}

// ============== 登录/注册 ==============
const authForm = document.getElementById('auth-form');
const authTip  = document.getElementById('auth-tip');
nav.logout.addEventListener('click', async ()=>{
  await supa.auth.signOut();
  showView('auth');
});
authForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  // 尝试登录，不存在则注册
  let { error } = await supa.auth.signInWithPassword({ email, password });
  if(error){
    const { error: signUpErr } = await supa.auth.signUp({ email, password });
    if(signUpErr){ authTip.textContent = signUpErr.message; return; }
  }
  const { data: { session } } = await supa.auth.getSession();
  if(session){ showView('home'); bootAfterAuth(); }
});

// ============== 数据 ==============
let projects = [];
async function fetchProjects(){
  const { data, error } = await supa
    .from('projects')
    .select(`id,title,brand,type,spec,clips,notes,pay_status,quote_amount,deposit_amount,paid_amount,producer_name,producer_contact,a_copy,b_copy,final_date,final_link,updated_at`)
    .order('updated_at', { ascending:false })
    .limit(500);
  if(error){ console.error(error); return; }
  projects = data || [];
}

// ============== 工具函数 ==============
const money = n => `¥${(Number(n||0)).toLocaleString()}`;
function payStatus(p){
  const un = Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0);
  if(un<=0) return '已结清';
  if(Number(p.deposit_amount||0)>0) return '已收定金';
  return '未收款';
}
function mergeTypeSpec(p){
  return [p.type||'', p.spec||''].filter(Boolean).join(' · ') || '—';
}

// ============== 首页 ==============
function renderRecent(){
  const box = document.getElementById('recent-list'); box.innerHTML='';
  projects.slice(0,6).forEach(p=>{
    const el = document.createElement('div'); el.className='list-item';
    el.innerHTML = `
      <div><strong>${p.title||'未命名'}</strong> · ${p.brand||''}</div>
      <div class="pay-status">${payStatus(p)}</div>
      <button class="btn-ghost" data-open="${p.id}">打开</button>`;
    box.appendChild(el);
  });
  box.onclick = e=>{
    const id = e.target.getAttribute('data-open');
    if(id){ showView('projects'); }
  };
}
function renderKpis(){
  const paid    = projects.reduce((s,p)=>s+Number(p.paid_amount||0),0);
  const dep     = projects.reduce((s,p)=>s+Number(p.deposit_amount||0),0);
  const unpaid  = projects.reduce((s,p)=>s+Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0),0);
  document.getElementById('kpi-paid').textContent    = money(paid);
  document.getElementById('kpi-deposit').textContent = money(dep);
  document.getElementById('kpi-unpaid').textContent  = money(unpaid);
  // 财务页同步
  document.getElementById('f-paid').textContent      = money(paid);
  document.getElementById('f-deposit').textContent   = money(dep);
  document.getElementById('f-unpaid').textContent    = money(unpaid);
}
function renderDoneSummary(){
  // 按类型汇总 clips
  const map = new Map();
  projects.forEach(p=>{
    const t = p.type || '未分类';
    const clips = Number(p.clips||0);
    if(!map.has(t)) map.set(t,0);
    map.set(t, map.get(t)+clips);
  });
  const box = document.getElementById('done-summary'); box.innerHTML='';
  [...map.entries()].sort((a,b)=>b[1]-a[1]).forEach(([t,c])=>{
    const li = document.createElement('div'); li.className='list-item';
    li.innerHTML = `<div>${t}</div><strong>${c}</strong>`;
    box.appendChild(li);
  });
}

// 成本计算器
document.getElementById('calc-form')?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const base = { edit:2000, color:1500, mix:1200, comp:1800 }; // 可按需改
  const selected = [...document.querySelectorAll('input[name="task"]:checked')].map(i=>i.value);
  const level = parseFloat(document.getElementById('calc-level').value||1);
  const rev   = parseInt(document.getElementById('calc-rev').value||0,10);
  const q     = parseFloat(document.getElementById('quote').value||0);
  const d     = parseFloat(document.getElementById('deposit').value||0);
  const p     = parseFloat(document.getElementById('paid').value||0);

  let work = selected.reduce((s,k)=>s+(base[k]||0),0) * level + Math.max(0,rev-1)*300;
  const unpaid = Math.max(q - d - p, 0);
  document.getElementById('calc-result').textContent =
    `工作预估：${money(work)} ｜ 未收款：${money(unpaid)}`;
});

// ============== 项目列表 ==============
function renderProjects(list=projects){
  const tb = document.getElementById('projects-body'); tb.innerHTML='';
  const wrap = document.getElementById('projects-wrap');

  list.forEach(p=>{
    const chips=[]; if(p.a_copy||p.b_copy) chips.push('<span class="chip chip-a">A/B</span>');
    if(p.final_date) chips.push('<span class="chip chip-final">Final</span>');
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><strong>${p.title||'未命名'}</strong></td>
      <td>${p.brand||''}</td>
      <td>${mergeTypeSpec(p)}</td>
      <td>${p.clips||1}</td>
      <td><div class="chips">${chips.join('')}</div></td>
      <td>${payStatus(p)}</td>
      <td>报 ${money(p.quote_amount)} / 定 ${money(p.deposit_amount)} / 实 ${money(p.paid_amount)}</td>
      <td>${[p.producer_name,p.producer_contact].filter(Boolean).join(' · ')}</td>
      <td>${p.notes||''}</td>`;
    tb.appendChild(tr);
  });

  // 小屏卡片
  const exist=document.getElementById('m-rows'); if(exist) exist.remove();
  const mob=document.createElement('div'); mob.id='m-rows';
  list.forEach(p=>{
    const un = Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0);
    const chips=[]; if(p.a_copy||p.b_copy) chips.push('<span class="chip chip-a">A/B</span>');
    if(p.final_date) chips.push('<span class="chip chip-final">Final</span>');
    const el=document.createElement('div'); el.className='card-row';
    el.innerHTML=`
      <div class="row-top"><div><strong>${p.title||'未命名'}</strong> · ${p.brand||''}</div><div class="chips">${chips.join('')}</div></div>
      <div class="row-meta">
        <div>类型&规格：${mergeTypeSpec(p)} · 影片条数 ${p.clips||1}</div>
        <div>合作制片：${[p.producer_name,p.producer_contact].filter(Boolean).join(' · ')}</div>
        <div>财务：报 ${money(p.quote_amount)} / 定 ${money(p.deposit_amount)} / 实 ${money(p.paid_amount)} / 未收 ${money(un)}</div>
      </div>`;
    mob.appendChild(el);
  });
  wrap.appendChild(mob);
}

// 过滤交互（修复下拉“瞬间消失”）
document.addEventListener('mousedown', (e)=>{
  const box = e.target.closest('[data-select]');
  if(e.target.matches('[data-select-toggle]')){
    e.preventDefault();
    document.querySelectorAll('.select').forEach(s=>s!==box&&s.classList.remove('open'));
    box.classList.toggle('open');
    return;
  }
  if(!(box && e.target.closest('.select-menu'))){
    document.querySelectorAll('.select.open').forEach(s=>s.classList.remove('open'));
  }
});
document.querySelectorAll('.select-menu button[data-type]')?.forEach(b=>{
  b.addEventListener('mousedown', ()=>{
    const val=b.getAttribute('data-type'); if(!val) return renderProjects(projects);
    const [t,s]=val.split('@'); renderProjects(projects.filter(p=>p.type===t&&p.spec===s));
  });
});
document.querySelectorAll('.select-menu button[data-pay]')?.forEach(b=>{
  b.addEventListener('mousedown', ()=>{
    const val=b.getAttribute('data-pay'); if(!val) return renderProjects(projects);
    const list=projects.filter(p=>{
      const st=payStatus(p);
      if(val==='paid') return st==='已结清';
      if(val==='deposit') return st==='已收定金';
      if(val==='unpaid') return st==='未收款';
      return true;
    });
    renderProjects(list);
  });
});

// 新建项目
const mNew = document.getElementById('new-modal');
document.getElementById('btn-new')?.addEventListener('click', ()=> mNew.classList.add('show'));
document.getElementById('new-cancel')?.addEventListener('click', ()=> mNew.classList.remove('show'));
document.getElementById('new-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd=new FormData(e.target); const row=Object.fromEntries(fd.entries());
  row.clips = Number(row.clips||1);
  row.quote_amount = Number(row.quote_amount||0);
  row.deposit_amount = Number(row.deposit_amount||0);
  row.paid_amount = Number(row.paid_amount||0);
  const { error } = await supa.from('projects').insert(row);
  if(error){ alert(error.message); return; }
  mNew.classList.remove('show');
  await fetchProjects(); renderAll();
});

// ============== 档期（日历） ==============
const modal = document.getElementById('schedule-modal');
const gridEl  = document.getElementById('cal-grid');
const labelEl = document.getElementById('cal-label');
let calBase = new Date(); calBase.setDate(1);
nav.schedule.addEventListener('click', ()=>{ modal.classList.add('show'); renderCalendar(); });
document.getElementById('cal-close').addEventListener('click', ()=> modal.classList.remove('show'));
document.getElementById('cal-prev').addEventListener('click', ()=>{ calBase.setMonth(calBase.getMonth()-1); renderCalendar(); });
document.getElementById('cal-next').addEventListener('click', ()=>{ calBase.setMonth(calBase.getMonth()+1); renderCalendar(); });

function renderCalendar(){
  gridEl.innerHTML=''; const y=calBase.getFullYear(), m=calBase.getMonth();
  labelEl.textContent = `${y}年 ${m+1}月`;
  const first=new Date(y,m,1), start=(first.getDay()+6)%7, days=new Date(y,m+1,0).getDate();
  const evs={};
  projects.forEach(p=>{
    [['a_copy','ab'],['b_copy','ab'],['final_date','final']].forEach(([k,tag])=>{
      const v=p[k]; if(!v) return; const d=new Date(v);
      if(d.getFullYear()!==y||d.getMonth()!==m) return;
      const day=d.getDate(); (evs[day] ||= []).push({tag,text:tag==='final'?`${p.title||'未命名'} · Final`:`${p.title||'未命名'} · A/B`});
    });
  });
  for(let i=0;i<42;i++){
    const cell=document.createElement('div'); cell.className='cal-cell';
    const day=i-start+1;
    if(day>0 && day<=days){
      const dEl=document.createElement('div'); dEl.className='cal-day'; dEl.textContent=String(day); cell.appendChild(dEl);
      (evs[day]||[]).forEach(e=>{
        const tag=document.createElement('span'); tag.className='ev ' + (e.tag==='final'?'ev-final':'ev-ab'); tag.textContent=e.text;
        cell.appendChild(tag);
      });
    }
    gridEl.appendChild(cell);
  }
}

// ============== 财务：排行榜/账龄/趋势 ==============
function renderFinance(){
  // 排行：合作伙伴
  const byPartner = new Map();
  projects.forEach(p=>{
    const k = p.producer_name || '未填';
    const amt = Number(p.paid_amount||0) + Number(p.deposit_amount||0);
    if(!byPartner.has(k)) byPartner.set(k,0);
    byPartner.set(k, byPartner.get(k)+amt);
  });
  const rp=document.getElementById('rank-partner'); rp.innerHTML='';
  [...byPartner.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([k,v])=>{
    const li=document.createElement('div'); li.className='list-item';
    li.innerHTML=`<div>${k}</div><strong>${money(v)}</strong>`; rp.appendChild(li);
  });

  // 单值最高项目
  const top = [...projects].sort((a,b)=>Number(b.quote_amount||0)-Number(a.quote_amount||0)).slice(0,5);
  const rq=document.getElementById('rank-project'); rq.innerHTML='';
  top.forEach(p=>{
    const li=document.createElement('div'); li.className='list-item';
    li.innerHTML=`<div>${p.title||'未命名'}</div><strong>${money(p.quote_amount)}</strong>`; rq.appendChild(li);
  });

  // 账龄（已完结未结款：有 final_date 且未收完）
  const aging=document.getElementById('aging'); aging.innerHTML='';
  const today=Date.now();
  projects.filter(p=>{
    const un = Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0);
    return p.final_date && un>0;
  }).sort((a,b)=>new Date(a.final_date)-new Date(b.final_date))
  .forEach(p=>{
    const un = Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0);
    const days = Math.floor((today - new Date(p.final_date).getTime())/86400000);
    const ok = days<=30;
    const li=document.createElement('div'); li.className='list-item';
    li.innerHTML=`<div>${p.title||'未命名'} · ${p.brand||''}</div>
      <div><span class="badge ${ok?'badge-ok':'badge-bad'}">${ok?'≤30天':'＞30天'}</span> · 未收 ${money(un)}</div>`;
    aging.appendChild(li);
  });

  // 收入趋势（最近 90 天，按 updated_at 汇总 paid_amount 的变动近似）
  const start = new Date(Date.now()-89*86400000); start.setHours(0,0,0,0);
  const days = Array.from({length:90},(_,i)=> new Date(start.getTime()+i*86400000));
  const map = new Map(days.map(d=>[d.toDateString(),0]));
  projects.forEach(p=>{
    const d = new Date(p.updated_at); d.setHours(0,0,0,0);
    if(d>=start){
      const k=d.toDateString();
      const inc = Number(p.paid_amount||0); // 简化：以当前实收做近似贡献
      map.set(k, (map.get(k)||0) + inc);
    }
  });
  const arr = days.map(d=> map.get(d.toDateString()) || 0);
  drawTrend(document.getElementById('trend'), arr);
}
function drawTrend(container, arr){
  container.innerHTML='';
  const w=container.clientWidth||800, h=container.clientHeight||160, p=8;
  const max=Math.max(...arr,1); const step=(w-2*p)/(arr.length-1);
  let d=''; arr.forEach((v,i)=>{
    const x=p+i*step, y=h-p-(v/max)*(h-2*p);
    d += (i? 'L':'M')+x+','+y+' ';
  });
  container.innerHTML =
    `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <path d="${d}" fill="none" stroke="#0a84ff" stroke-width="2"/>
    </svg>`;
}

// ============== 统一渲染调用 ==============
function renderAll(){
  renderRecent(); renderKpis(); renderDoneSummary();
  renderProjects(); renderGallery(); renderFinance();
}

// ============== 启动流程 ==============
async function boot(){
  const { data:{ session } } = await supa.auth.getSession();
  if(!session){ showView('auth'); return; }
  await bootAfterAuth();
}
async function bootAfterAuth(){
  await fetchProjects(); renderAll(); showView('home');
}

// 导航
document.getElementById('go-list')?.addEventListener('click', ()=> showView('projects'));
nav.home.addEventListener('click',   ()=> showView('home'));
nav.projects.addEventListener('click',()=> showView('projects'));
nav.gallery.addEventListener('click', ()=> showView('gallery'));
nav.finance.addEventListener('click', ()=> showView('finance'));

// GO!
boot();
