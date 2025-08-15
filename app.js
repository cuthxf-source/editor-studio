/* editor-studio / app.js  v0.3 */

// ============== Supabase 初始化 ==============
const supa = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

// ============== 视图管理 ==============
const views = {
  auth:      document.getElementById('view-auth'),
  home:      document.getElementById('view-home'),
  projects:  document.getElementById('view-projects'),
  schedule:  document.getElementById('view-schedule'),
  gallery:   document.getElementById('view-gallery'),
  finance:   document.getElementById('view-finance'),
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
  ({home:nav.home, projects:nav.projects, schedule:nav.schedule, gallery:nav.gallery, finance:nav.finance}[name])?.setAttribute('aria-current','page');
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
    .order('updated_at',{ ascending:false })
    .limit(1000);
  if(error){ console.error(error); return; }
  projects = data || [];
}

// ============== 工具 ==============
const money = n => `¥${(Number(n||0)).toLocaleString()}`;
const fmt = (d)=> d? new Date(d): null;

function mergeTypeSpec(p){ return [p.type||'', p.spec||''].filter(Boolean).join(' · ') || '—'; }
function unpaidAmt(p){
  return Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0);
}
function payBadge(p){
  const st = p.pay_status || (unpaidAmt(p)<=0 ? '已收尾款' : (Number(p.deposit_amount||0)>0?'已收定金':'未收款'));
  if(st==='未收款') return `<span class="pill pill-blue">未收款</span>`;
  if(st==='已收定金') return `<span class="pill pill-green">已收定金</span>`;
  if(st==='已收尾款') return `<span class="pill pill-gold">已收尾款</span>`;
  return `<span class="pill">${st}</span>`;
}
function hasTag(notes, tag){ return (notes||'').includes(tag); }
function toggleTag(notes, tag, on){
  notes = notes||'';
  const has = notes.includes(tag);
  if(on && !has) return (notes + ' ' + tag).trim();
  if(!on && has) return notes.replace(tag,'').replace(/\s+/g,' ').trim();
  return notes;
}

// 最近待交付（按 A→B→Final 顺序）
function nearestMilestone(p){
  const today = new Date(); today.setHours(0,0,0,0);
  const A = fmt(p.a_copy), B = fmt(p.b_copy), F = fmt(p.final_date);
  const doneA = hasTag(p.notes,'#A_DONE'), doneB = hasTag(p.notes,'#B_DONE'), doneF = hasTag(p.notes,'#F_DONE');

  const items = [];
  if(A && !doneA) items.push({k:'A copy', date:A});
  if(B && !doneB) items.push({k:'B copy', date:B});
  if(F && !doneF) items.push({k:'Final',  date:F});
  if(items.length===0) return {text:'—', overdue:false};

  items.sort((a,b)=> a.date - b.date);
  const n = items[0];
  const overdue = n.date < today;
  return { text: `${n.k} - ${n.date.getMonth()+1}/${n.date.getDate()}`, overdue };
}

function chipsAB(p){
  const arr=[];
  if(p.a_copy) arr.push('<span class="chip chip-a">A copy</span>');
  if(p.b_copy) arr.push('<span class="chip chip-b">B copy</span>');
  if(p.final_date) arr.push('<span class="chip chip-final">Final</span>');
  return arr.join('');
}

// ============== 首页 ==============
function renderRecent(){
  const box = document.getElementById('recent-list'); box.innerHTML='';
  projects.slice(0,4).forEach(p=>{
    const near = nearestMilestone(p);
    const li = document.createElement('div'); li.className='list-item';
    li.innerHTML = `
      <div>
        <div><strong>${p.title||'未命名'}</strong> · ${p.brand||''}</div>
        <div class="muted small">合作制片：${[p.producer_name,p.producer_contact].filter(Boolean).join(' · ')||'—'}</div>
      </div>
      <div class="muted small">条数：${p.clips||1}</div>
      <div>${payBadge(p)}</div>
      <div class="${near.overdue?'pill pill-red':'pill'}">${near.text}</div>
    `;
    box.appendChild(li);
  });
  box.onclick = ()=> showView('projects');
}
function renderKpis(){
  const paid    = projects.reduce((s,p)=>s+Number(p.paid_amount||0),0);
  const dep     = projects.reduce((s,p)=>s+Number(p.deposit_amount||0),0);
  const unpaid  = projects.reduce((s,p)=>s+unpaidAmt(p),0);
  document.getElementById('kpi-paid').textContent    = money(paid);
  document.getElementById('kpi-deposit').textContent = money(dep);
  document.getElementById('kpi-unpaid').textContent  = money(unpaid);
  document.getElementById('f-paid').textContent      = money(paid);
  document.getElementById('f-deposit').textContent   = money(dep);
  document.getElementById('f-unpaid').textContent    = money(unpaid);
}

// 报价分析器
(function initQuote(){
  const typeBase = {
    'LookBook': {price:100, baseSec:15,  secRate:0.01},
    '形象片':    {price:3500, baseSec:45, secRate:0.03},
    'TVC':      {price:7000, baseSec:60, secRate:0.03},
    '纪录片':    {price:12000, baseSec:180, secRate:0.005},
    '微电影':    {price:12000, baseSec:180, secRate:0.005},
  };
  const elType = document.getElementById('qa-type');
  const elBase = document.getElementById('qa-base');
  const elSecs = document.getElementById('qa-secs');
  const elCreative = document.getElementById('qa-creative');
  const elUrgent   = document.getElementById('qa-urgent');
  const elRev      = document.getElementById('qa-rev');
  const elCompWrap = document.getElementById('qa-comp-wrap');
  const elComp     = document.getElementById('qa-comp');
  const show = ()=> {
    document.getElementById('qa-creative-val').textContent = elCreative.value+'%';
    document.getElementById('qa-urgent-val').textContent   = elUrgent.value+'%';
    document.getElementById('qa-comp-val').textContent     = (elComp?.value||0)+'%';
  };
  ['input','change'].forEach(ev=>{
    elCreative.addEventListener(ev,show);
    elUrgent.addEventListener(ev,show);
    elComp?.addEventListener(ev,show);
  });
  document.querySelector('.qa-task[value="comp"]')?.addEventListener('change', (e)=>{
    elCompWrap.classList.toggle('hidden', !e.target.checked);
  });

  const calc = ()=>{
    const t = elType.value;
    const baseDef = typeBase[t] || {price:0, baseSec:0, secRate:0};
    const basePrice = Number(elBase.value||baseDef.price);
    const secs = Number(elSecs.value||0);
    const over = Math.max(0, secs - baseDef.baseSec);
    const secFactor = over>0 ? Math.pow(1+baseDef.secRate, over) : 1;

    const tasks = [...document.querySelectorAll('.qa-task:checked')].map(i=>i.value);
    // 工作内容基础：剪辑/调色/混音默认勾选，合成额外按难度加价；基础价主要随类型变化
    let price = basePrice * secFactor;

    // 创意密度：每+1% => +1%
    price *= (1 + Number(elCreative.value||0)/100);

    // 紧急系数：每+10% => +3%
    price *= (1 + (Number(elUrgent.value||0)/10) * 0.03);

    // 修改次数：超出4次的每+1 => +20%
    const rev = Number(elRev.value||0);
    const extraRev = Math.max(0, rev - 4);
    price *= (1 + extraRev*0.20);

    // 合成难度：勾选合成时， 每+10% => +5%
    if(tasks.includes('comp')){
      price *= (1 + (Number(elComp?.value||0)/10)*0.05);
    }

    const net = Math.round(price);
    const gross = Math.round(net * 1.06);
    document.getElementById('qa-net').textContent   = money(net);
    document.getElementById('qa-gross').textContent = money(gross);
  };

  // 事件绑定
  ['change','input'].forEach(ev=>{
    document.getElementById('quote-form').addEventListener(ev, calc);
  });
  calc(); // 初次计算
})();

// ============== 项目列表（可编辑） ==============
function renderProjects(list=projects){
  const tb = document.getElementById('projects-body'); tb.innerHTML='';
  list.forEach(p=>{
    const near = nearestMilestone(p);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td contenteditable="true" data-k="title" data-id="${p.id}">${p.title||''}</td>
      <td contenteditable="true" data-k="brand" data-id="${p.id}">${p.brand||''}</td>
      <td contenteditable="true" data-k="type_spec" data-id="${p.id}">${mergeTypeSpec(p)}</td>
      <td contenteditable="true" data-k="clips" data-id="${p.id}">${p.clips||1}</td>
      <td>
        <div class="chips">
          ${p.a_copy?`<span class="chip chip-a">A copy</span>`:''}
          ${p.b_copy?`<span class="chip chip-b">B copy</span>`:''}
          ${p.final_date?`<span class="chip chip-final">Final</span>`:''}
        </div>
        <div class="${near.overdue?'pill pill-red':'pill'}" style="margin-top:6px">${near.text}</div>
        <div class="muted small" style="margin-top:6px">
          完成：
          <label><input type="checkbox" class="done" data-id="${p.id}" data-tag="#A_DONE" ${hasTag(p.notes,'#A_DONE')?'checked':''}> A</label>
          <label><input type="checkbox" class="done" data-id="${p.id}" data-tag="#B_DONE" ${hasTag(p.notes,'#B_DONE')?'checked':''}> B</label>
          <label><input type="checkbox" class="done" data-id="${p.id}" data-tag="#F_DONE" ${hasTag(p.notes,'#F_DONE')?'checked':''}> Final</label>
        </div>
      </td>
      <td>
        <select class="pay" data-id="${p.id}">
          <option ${ (p.pay_status||'')==='未收款'?'selected':'' }>未收款</option>
          <option ${ (p.pay_status||'')==='已收定金'?'selected':'' }>已收定金</option>
          <option ${ (p.pay_status||'')==='已收尾款'?'selected':'' }>已收尾款</option>
        </select>
      </td>
      <td contenteditable="true" data-k="qdp" data-id="${p.id}">
        报 ${money(p.quote_amount)} / 定 ${money(p.deposit_amount)} / 实 ${money(p.paid_amount)}
      </td>
      <td contenteditable="true" data-k="producer" data-id="${p.id}">${[p.producer_name,p.producer_contact].filter(Boolean).join(' · ')}</td>
      <td contenteditable="true" data-k="notes" data-id="${p.id}">${p.notes||''}</td>
    `;
    tb.appendChild(tr);
  });

  // 失焦保存（简化：根据 data-k 拆分更新）
  tb.addEventListener('blur', async (e)=>{
    const td = e.target.closest('td[contenteditable="true"]'); if(!td) return;
    const id = td.getAttribute('data-id'); const k = td.getAttribute('data-k'); const v = td.textContent.trim();

    let patch = {};
    if(k==='title' || k==='brand' || k==='notes'){
      patch[k] = v;
    }else if(k==='clips'){
      patch.clips = Number(v||1);
    }else if(k==='type_spec'){
      // 用户写 "TVC · 4k"
      const [t,s] = v.split('·').map(x=>x.trim());
      patch.type = t||null; patch.spec = s||null;
    }else if(k==='qdp'){
      // 用户可能不改这里；如需精确编辑可在后续加专门输入
      // 这里不解析，避免误更新；留空
      return;
    }
    if(Object.keys(patch).length===0) return;

    await supa.from('projects').update(patch).eq('id', id);
  }, true);

  // 支付状态下拉保存 + Final 30天未更新变红提醒（靠渲染时体现）
  tb.addEventListener('change', async (e)=>{
    const s = e.target.closest('select.pay'); if(!s) return;
    const id = s.getAttribute('data-id'); const val = s.value;
    await supa.from('projects').update({ pay_status: val }).eq('id', id);
  });

  // 完成勾选 → notes 写入 / 删除 标签
  tb.addEventListener('change', async (e)=>{
    const box = e.target.closest('input.done'); if(!box) return;
    const id  = box.getAttribute('data-id');
    const tag = box.getAttribute('data-tag');
    const row = projects.find(x=>String(x.id)===String(id));
    const nextNotes = toggleTag(row?.notes||'', tag, box.checked);
    await supa.from('projects').update({ notes: nextNotes }).eq('id', id);
    await fetchProjects(); renderProjects(); // 更新最近进度显示
  });
}

// ============== 作品合集 ==============
function renderGallery(){
  const grid = document.getElementById('gallery-grid'); grid.innerHTML='';
  const finals = projects.filter(p=>p.final_link);
  if(finals.length===0){
    const ph = document.createElement('div');
    ph.className='poster';
    ph.innerHTML = `<div class="caption">暂未上传成片，请在项目中填写 Final 链接</div>`;
    grid.appendChild(ph);
    return;
  }
  finals.forEach(p=>{
    const a = document.createElement('a');
    a.className='poster'; a.href=p.final_link; a.target='_blank';
    a.innerHTML = `<div class="caption">${p.title||'未命名'} · ${p.brand||''}</div>`;
    grid.appendChild(a);
  });
}

// ============== 档期（独立页） ==============
const gridEl  = document.getElementById('cal-grid');
const labelEl = document.getElementById('cal-label');
let calBase = new Date(); calBase.setDate(1);
document.getElementById('cal-prev').addEventListener('click', ()=>{ calBase.setMonth(calBase.getMonth()-1); renderCalendar(); });
document.getElementById('cal-next').addEventListener('click', ()=>{ calBase.setMonth(calBase.getMonth()+1); renderCalendar(); });

function renderCalendar(){
  gridEl.innerHTML=''; const y=calBase.getFullYear(), m=calBase.getMonth();
  labelEl.textContent = `${y}年 ${m+1}月`;
  const first=new Date(y,m,1), start=(first.getDay()+6)%7, days=new Date(y,m+1,0).getDate();
  const today=new Date(); today.setHours(0,0,0,0);

  const evs={};
  projects.forEach(p=>{
    [['a_copy','a'],['b_copy','b'],['final_date','final']].forEach(([key,typ])=>{
      const d = fmt(p[key]); if(!d) return;
      if(d.getFullYear()!==y || d.getMonth()!==m) return;
      const day=d.getDate();
      const done = (typ==='a' && hasTag(p.notes,'#A_DONE')) ||
                   (typ==='b' && hasTag(p.notes,'#B_DONE')) ||
                   (typ==='final' && hasTag(p.notes,'#F_DONE'));
      const overdue = d<today && !done;
      (evs[day] ||= []).push({ typ, txt:`${p.title||'未命名'} · ${typ==='a'?'A copy':typ==='b'?'B copy':'Final'}`, overdue });
    });
  });

  for(let i=0;i<42;i++){
    const cell=document.createElement('div'); cell.className='cal-cell';
    const day=i-start+1;
    if(day>0 && day<=days){
      const head=document.createElement('div'); head.className='cal-day'; head.textContent=String(day); cell.appendChild(head);
      (evs[day]||[]).forEach(e=>{
        const tag=document.createElement('span');
        tag.className='ev ' + (e.typ==='a'?'ev-a':e.typ==='b'?'ev-b':'ev-final') + (e.overdue?' ev-overdue':'');
        tag.textContent=e.txt; cell.appendChild(tag);
      });
    }
    gridEl.appendChild(cell);
  }
}

// ============== 财务：排行榜/账龄/趋势 ==============
function renderFinance(){
  // KPI 在 renderKpis 已填

  // 合作金额最高伙伴（定金+实收）
  const byPartner = new Map();
  projects.forEach(p=>{
    const k=p.producer_name||'未填';
    const sum = Number(p.deposit_amount||0)+Number(p.paid_amount||0);
    byPartner.set(k, (byPartner.get(k)||0)+sum);
  });
  const rp=document.getElementById('rank-partner'); rp.innerHTML='';
  [...byPartner.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
    const li=document.createElement('div'); li.className='list-item';
    li.innerHTML = `<div>${k}</div><strong>${money(v)}</strong>`; rp.appendChild(li);
  });

  // 单值最高项目（按报价）
  const rq=document.getElementById('rank-project'); rq.innerHTML='';
  [...projects].sort((a,b)=>Number(b.quote_amount||0)-Number(a.quote_amount||0)).forEach(p=>{
    const li=document.createElement('div'); li.className='list-item';
    li.innerHTML = `<div>${p.title||'未命名'}</div><strong>${money(p.quote_amount)}</strong>`; rq.appendChild(li);
  });

  // 已完结未结款：有 final_date 且未收完
  const aging=document.getElementById('aging'); aging.innerHTML='';
  const today=Date.now();
  projects.filter(p=> p.final_date && unpaidAmt(p)>0)
    .sort((a,b)=> new Date(a.final_date)-new Date(b.final_date))
    .forEach(p=>{
      const days = Math.floor((today - new Date(p.final_date).getTime())/86400000);
      const li=document.createElement('div'); li.className='list-item';
      li.innerHTML = `<div>${p.title||'未命名'} / ${p.producer_name||'未填'}</div>
                      <div>${money(unpaidAmt(p))} / ${days>0?days:0}天</div>`;
      aging.appendChild(li);
    });

  // 收入趋势（近 90 天，按 updated_at 粗粒度累计 paid_amount）
  const start = new Date(Date.now()-89*86400000); start.setHours(0,0,0,0);
  const days = Array.from({length:90},(_,i)=> new Date(start.getTime()+i*86400000));
  const map = new Map(days.map(d=>[d.toDateString(),0]));
  projects.forEach(p=>{
    const d = new Date(p.updated_at); d.setHours(0,0,0,0);
    if(d>=start){
      const k = d.toDateString();
      map.set(k, (map.get(k)||0) + Number(p.paid_amount||0));
    }
  });
  const series = days.map(d=> map.get(d.toDateString())||0);
  drawTrend(document.getElementById('trend'), series);
}
function drawTrend(container, arr){
  container.innerHTML='';
  const w=container.clientWidth||800, h=container.clientHeight||180, p=10;
  const max=Math.max(...arr,1), step=(w-2*p)/(arr.length-1);
  let d=''; arr.forEach((v,i)=>{ const x=p+i*step, y=h-p-(v/max)*(h-2*p); d+=(i?'L':'M')+x+','+y+' '; });
  container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="#0a84ff" stroke-width="2"/></svg>`;
}

// ============== 导航 ==============
document.getElementById('go-list')?.addEventListener('click', ()=> showView('projects'));
nav.home.addEventListener('click',    ()=> showView('home'));
nav.projects.addEventListener('click', ()=> showView('projects'));
nav.gallery.addEventListener('click',  ()=> showView('gallery'));
nav.finance.addEventListener('click',  ()=> showView('finance'));
nav.schedule.addEventListener('click', ()=> { showView('schedule'); renderCalendar(); });

// ============== 新建项目 ==============
const mNew = document.getElementById('new-modal');
document.getElementById('btn-new')?.addEventListener('click', ()=> mNew.classList.add('show'));
document.getElementById('new-cancel')?.addEventListener('click', ()=> mNew.classList.remove('show'));
document.getElementById('new-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target); const row = Object.fromEntries(fd.entries());
  row.clips = Number(row.clips||1);
  row.quote_amount   = Number(row.quote_amount||0);
  row.deposit_amount = Number(row.deposit_amount||0);
  row.paid_amount    = Number(row.paid_amount||0);
  const { error } = await supa.from('projects').insert(row);
  if(error){ alert(error.message); return; }
  mNew.classList.remove('show');
  await fetchProjects(); renderAll();
});

// ============== 渲染整页 ==============
function renderAll(){
  renderKpis();
  renderRecent();
  renderProjects();
  renderGallery();
  renderFinance();
}

// ============== 启动 ==============
async function boot(){
  const { data:{ session } } = await supa.auth.getSession();
  if(!session){ showView('auth'); return; }
  await bootAfterAuth();
}
async function bootAfterAuth(){
  await fetchProjects();
  renderAll();
  showView('home');
}
boot();
