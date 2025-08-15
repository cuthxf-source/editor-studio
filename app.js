/*
  app.js  v0.3.2
  - 基于 v0.3 合并你的新增/修改点
  - 登录守卫 + 退出强跳转
  - 项目列表可编辑（去掉品牌；第二列合作制片；“影片类型&条数&规格”合并；总金额/已收可编辑）
  - 支付状态胶囊（蓝/绿/金 + 逾期红）
  - 进度：A/B/Final 日期（小日历控件），完成状态临时记入 notes 标记（#A_DONE/#B_DONE/#F_DONE）
  - 档期：独立页，顶部切月；自动标注逾期红
  - 报价分析器（非侵入式、与 v0.3 兼容）
*/

///////////////////////////////////////
// 0. Supabase init
///////////////////////////////////////
const supa = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
  { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } }
);

// 视图 & 导航
const views = {
  home:     document.getElementById('view-home'),
  projects: document.getElementById('view-projects'),
  schedule: document.getElementById('view-schedule'),
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
function show(name){
  Object.values(views).forEach(v=>v.classList.remove('active'));
  views[name].classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.removeAttribute('aria-current'));
  ({home:nav.home,projects:nav.projects,schedule:nav.schedule,gallery:nav.gallery,finance:nav.finance}[name])?.setAttribute('aria-current','page');
}
nav.home.addEventListener('click', ()=> show('home'));
nav.projects.addEventListener('click', ()=> show('projects'));
nav.schedule.addEventListener('click', ()=> show('schedule'));
nav.gallery.addEventListener('click', ()=> show('gallery'));
nav.finance.addEventListener('click', ()=> show('finance'));
document.getElementById('go-list')?.addEventListener('click', ()=> show('projects'));

///////////////////////////////////////
// 1. 登录守卫 + 退出强跳转
///////////////////////////////////////
async function hardGuard(){
  const { data: { session } } = await supa.auth.getSession();
  if(!session){
    document.body.innerHTML = '<div style="padding:40px;text-align:center;font-size:18px">请先登录</div>';
    return false;
  }
  return true;
}
nav.logout?.addEventListener('click', async ()=>{
  await supa.auth.signOut();
  localStorage.clear(); sessionStorage.clear();
  window.location.replace(window.location.pathname + '?logged_out=' + Date.now());
});

///////////////////////////////////////
// 2. 通用工具
///////////////////////////////////////
const fmtMoney = n => `¥${(Number(n||0)).toLocaleString()}`;
const toDateStr = d => d ? new Date(d).toISOString().slice(0,10) : '';

function parseDoneFlags(notes=''){
  return {
    a: /#A_DONE/.test(notes),
    b: /#B_DONE/.test(notes),
    f: /#F_DONE/.test(notes),
  };
}
function toggleDoneInNotes(notes='', key, val){
  const tag = key==='a' ? '#A_DONE' : key==='b' ? '#B_DONE' : '#F_DONE';
  let s = notes || '';
  s = s.replace(new RegExp(tag,'g'),'');
  if(val) s = (s + ' ' + tag).trim();
  return s.trim();
}

///////////////////////////////////////
// 3. 读数据 & 渲染
///////////////////////////////////////
let projects = [];

async function fetchProjects(){
  const { data, error } = await supa
    .from('projects')
    .select('id,title,type,spec,clips,producer_name,producer_contact,a_copy,b_copy,final_date,final_link,notes,quote_amount,deposit_amount,paid_amount,updated_at')
    .order('updated_at', { ascending:false })
    .limit(500);
  if(error){ console.error(error); return; }
  projects = data || [];
}

// 支付状态（蓝/绿/金 + 逾期红）
function paymentStatusCapsule(p){
  const total = Number(p.quote_amount||0);
  const deposit = Number(p.deposit_amount||0);
  const paid = Number(p.paid_amount||0);
  const unpaid = Math.max(total - deposit - paid, 0);

  // 状态：已收尾款 > 已收定金 > 未收款
  let text = '未收款', cls='blue';
  if(total>0 && (paid>= (total - deposit))) { text = '已收尾款'; cls='gold'; }
  else if(deposit>0) { text = '已收定金'; cls='green'; }

  // 若 Final 已过期 且未结清，则红色
  const today = new Date(); today.setHours(0,0,0,0);
  const f = p.final_date ? new Date(p.final_date) : null;
  const isOver = f && f < today && (paid < (total - deposit));
  if(isOver) cls = 'red';

  return `<span class="status ${cls}">${text}</span>`;
}

function renderRecent(){
  const box = document.getElementById('recent-list');
  box.innerHTML = '';
  projects.slice(0,4).forEach(p=>{
    const dom = document.createElement('div');
    dom.className = 'list-item';
    const clips = Number(p.clips||1);

    // 进度：取最近未来节点
    const now = new Date(); now.setHours(0,0,0,0);
    const dates = [
      {k:'A', d:p.a_copy ? new Date(p.a_copy): null},
      {k:'B', d:p.b_copy ? new Date(p.b_copy): null},
      {k:'Final', d:p.final_date ? new Date(p.final_date): null},
    ].filter(x=>x.d);
    let nearest = dates
      .filter(x=>x.d>=now)
      .sort((a,b)=>a.d-b.d)[0];
    const prog = nearest ? `${nearest.k}-${toDateStr(nearest.d)}` : '—';

    dom.innerHTML = `
      <div>
        <div><strong>${p.title||'未命名'}</strong> · ${p.producer_name||''}</div>
        <div style="display:flex;gap:8px;align-items:center">
          ${paymentStatusCapsule(p)}
          <span style="color:#666">进度：${prog}</span>
          <span style="color:#666">影片条数：${clips}</span>
        </div>
      </div>
      <button class="btn-ghost" data-open="${p.id}">打开</button>
    `;
    box.appendChild(dom);
  });
  box.addEventListener('click', (e)=>{
    const id = e.target.getAttribute('data-open');
    if(id){ show('projects'); }
  });
}

function renderFinance(){
  const paid = projects.reduce((s,p)=>s+Number(p.paid_amount||0),0);
  const dep  = projects.reduce((s,p)=>s+Number(p.deposit_amount||0),0);
  const unpaid = projects.reduce((s,p)=>{
    const total = Number(p.quote_amount||0);
    const paid  = Number(p.paid_amount||0);
    const dep   = Number(p.deposit_amount||0);
    return s + Math.max(total - dep - paid, 0);
  },0);

  document.getElementById('f-paid').textContent    = fmtMoney(paid);
  document.getElementById('f-deposit').textContent = fmtMoney(dep);
  document.getElementById('f-unpaid').textContent  = fmtMoney(unpaid);

  const list = document.getElementById('finance-list');
  list.innerHTML = projects.map(p=>{
    const total = Number(p.quote_amount||0);
    const dep   = Number(p.deposit_amount||0);
    const paid  = Number(p.paid_amount||0);
    const un    = Math.max(total - dep - paid, 0);
    return `<div class="list-item">
      <div><strong>${p.title||'未命名'}</strong> · ${p.producer_name||''}</div>
      <div>报 ${fmtMoney(total)} / 定 ${fmtMoney(dep)} / 实 ${fmtMoney(paid)} / 未收 ${fmtMoney(un)}</div>
    </div>`;
  }).join('');
}

function renderGallery(){
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';
  const finals = projects.filter(p=>p.final_link);
  if(finals.length===0){
    const ph = document.createElement('div');
    ph.className='poster';
    ph.innerHTML = `<div class="caption" style="font-size:20px;color:#888">暂未上传成片，请在项目中填写 Final 链接</div>`;
    grid.appendChild(ph);
    return;
  }
  finals.forEach(p=>{
    const a = document.createElement('a');
    a.className='poster'; a.href=p.final_link; a.target='_blank';
    a.innerHTML = `<div class="caption">${p.title||'未命名'} · ${p.producer_name||''}</div>`;
    grid.appendChild(a);
  });
}

// 项目表单选项
const TYPE_OPTIONS = ['LookBook','形象片','TVC','纪录片','微电影'];
const SPEC_OPTIONS = ['横版','竖版','1:1','4K','2K','1080p'];

function renderProjects(){
  const tb = document.getElementById('projects-body');
  tb.innerHTML = '';
  projects.forEach(p=>{
    const done = parseDoneFlags(p.notes||'');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input data-k="title" value="${p.title||''}" placeholder="项目名" />
      </td>
      <td>
        <div style="display:flex;gap:6px">
          <input style="width:60%" data-k="producer_name" value="${p.producer_name||''}" placeholder="制片名" />
          <input style="width:40%" data-k="producer_contact" value="${p.producer_contact||''}" placeholder="联系方式" />
        </div>
      </td>
      <td>
        <div style="display:flex;gap:6px">
          <select data-k="type">${TYPE_OPTIONS.map(t=>`<option ${p.type===t?'selected':''}>${t}</option>`).join('')}</select>
          <input type="number" min="1" step="1" data-k="clips" value="${p.clips||1}" style="width:72px" />
          <select data-k="spec">${SPEC_OPTIONS.map(s=>`<option ${p.spec===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
      </td>
      <td>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;gap:6px;align-items:center">
            <label style="min-width:46px">A</label>
            <input type="date" data-k="a_copy" value="${toDateStr(p.a_copy)}">
            <label class="check" style="margin-left:6px"><input type="checkbox" data-done="a" ${done.a?'checked':''}>完成</label>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <label style="min-width:46px">B</label>
            <input type="date" data-k="b_copy" value="${toDateStr(p.b_copy)}">
            <label class="check" style="margin-left:6px"><input type="checkbox" data-done="b" ${done.b?'checked':''}>完成</label>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <label style="min-width:46px">Final</label>
            <input type="date" data-k="final_date" value="${toDateStr(p.final_date)}">
            <label class="check" style="margin-left:6px"><input type="checkbox" data-done="f" ${done.f?'checked':''}>完成</label>
          </div>
        </div>
      </td>
      <td>
        ${paymentStatusCapsule(p)}
      </td>
      <td>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="number" step="1" data-k="quote_amount" value="${p.quote_amount||0}" placeholder="总金额" style="width:120px" />
          <span> / </span>
          <input type="number" step="1" data-k="paid_amount"  value="${p.paid_amount||0}" placeholder="已收金额" style="width:120px" />
        </div>
      </td>
      <td>
        <input data-k="notes" value="${p.notes||''}" placeholder="备注" />
      </td>
    `;
    // 绑定保存（失焦即存）
    tr.querySelectorAll('input,select').forEach(el=>{
      el.addEventListener('change', async ()=>{
        const k = el.dataset.k;
        let val = el.type==='checkbox' ? el.checked : el.value;
        // 完成开关写入 notes
        if(el.dataset.done){
          const flagKey = el.dataset.done; // a/b/f
          const newNotes = toggleDoneInNotes(tr.querySelector('input[data-k="notes"]').value || p.notes || '', flagKey, el.checked);
          tr.querySelector('input[data-k="notes"]').value = newNotes;
          await updateProject(p.id, { notes: newNotes });
          await refresh();
          return;
        }

        // 普通字段
        const payload = {};
        payload[k] = (k==='clips' || k==='quote_amount' || k==='paid_amount') ? Number(val||0) : val;
        await updateProject(p.id, payload);
        await refreshDebounced();
      }, {passive:true});
    });

    tb.appendChild(tr);
  });
}

// 更新接口
async function updateProject(id, payload){
  const { error } = await supa.from('projects').update(payload).eq('id', id);
  if(error) console.error(error);
}

// 防抖刷新
let _timer;
async function refreshDebounced(){
  clearTimeout(_timer);
  _timer = setTimeout(refresh, 300);
}

async function refresh(){
  await fetchProjects();
  renderRecent();
  renderProjects();
  renderFinance();
  renderGallery();
  renderCalendar();
}

///////////////////////////////////////
// 4. 日历（独立页）
///////////////////////////////////////
const gridEl  = document.getElementById('cal-grid');
const labelEl = document.getElementById('cal-label');
let calBase = new Date(); calBase.setDate(1);

document.getElementById('cal-prev').addEventListener('click', ()=>{ calBase.setMonth(calBase.getMonth()-1); renderCalendar(); });
document.getElementById('cal-next').addEventListener('click', ()=>{ calBase.setMonth(calBase.getMonth()+1); renderCalendar(); });

function renderCalendar(){
  if(!gridEl) return;
  gridEl.innerHTML='';

  const y=calBase.getFullYear(), m=calBase.getMonth();
  labelEl.textContent = `${y} 年 ${m+1} 月`;

  const first = new Date(y,m,1);
  const start = (first.getDay()+6)%7;
  const days  = new Date(y,m+1,0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  // 收集事件
  const evs = {};
  projects.forEach(p=>{
    const arr = [
      {tag:'A', k:'a_copy',    cls:'ev-ab'},
      {tag:'B', k:'b_copy',    cls:'ev-ab'},
      {tag:'F', k:'final_date',cls:'ev-final'},
    ];
    arr.forEach(({k,cls})=>{
      const v = p[k];
      if(!v) return;
      const d = new Date(v);
      if(d.getFullYear()===y && d.getMonth()===m){
        const dd = d.getDate();
        (evs[dd] ||= []).push({ p, k, cls, d });
      }
    });
  });

  // 42 宫格
  for(let i=0;i<42;i++){
    const cell = document.createElement('div'); cell.className='cal-cell';
    const day = i - start + 1;
    if(day>0 && day<=days){
      const dEl = document.createElement('div'); dEl.className='cal-day'; dEl.textContent=String(day);
      cell.appendChild(dEl);

      (evs[day]||[]).forEach(e=>{
        const tag = document.createElement('span');
        const f = e.k==='final_date';
        const paidEnough = Number(e.p.paid_amount||0) >= (Number(e.p.quote_amount||0) - Number(e.p.deposit_amount||0));
        const overdue = f && (e.d < today) && !paidEnough;
        tag.className = 'ev ' + (overdue ? 'ev-over' : e.cls);
        tag.textContent = (f ? 'Final' : (e.k==='a_copy'?'A copy':'B copy')) + ' · ' + (e.p.title || '未命名');
        cell.appendChild(tag);
      });
    }
    gridEl.appendChild(cell);
  }
}

///////////////////////////////////////
// 5. 报价分析器（与你之前一致）
///////////////////////////////////////
(function initQuoteTool(){
  const BASE_PRICE  = {"LookBook":100,"形象片":3500,"TVC":7000,"纪录片":12000,"微电影":12000};
  const BASE_LENGTH = {"LookBook":15,"形象片":45,"TVC":60,"纪录片":180,"微电影":180};

  const $type = document.getElementById('quote-type');
  const $base = document.getElementById('quote-base');
  const $len  = document.getElementById('quote-length');
  const $rev  = document.getElementById('revision-count');
  const $idea = document.getElementById('idea-range');
  const $rush = document.getElementById('rush-range');
  const $compR= document.getElementById('comp-range');
  const $edit = document.getElementById('work-edit');
  const $color= document.getElementById('work-color');
  const $audio= document.getElementById('work-audio');
  const $comp = document.getElementById('work-comp');
  const $net  = document.getElementById('price-net');
  const $tax  = document.getElementById('price-tax');

  function syncBasePrice(){
    if(!$type || !$base || !$len) return;
    const t = $type.value;
    $base.value = BASE_PRICE[t] ?? 0;
    if(!$len.value) $len.value = BASE_LENGTH[t] ?? 0;
  }
  function calcPrice(){
    if(!$base) return;
    let price = parseFloat($base.value||0);

    const t = $type?.value || 'LookBook';
    const baseLen = BASE_LENGTH[t] || 1;
    const nowLen = parseFloat($($len)?.value || baseLen);
    function $(el){return el} // 仅为可读性

    const extraRatio = Math.max((nowLen - baseLen)/baseLen, 0);
    let lengthUp = 0;
    if(t==='LookBook') lengthUp = extraRatio*1.0;
    else if(t==='形象片' || t==='TVC') lengthUp = extraRatio*3.0;
    else lengthUp = extraRatio*0.5;
    price *= (1 + lengthUp);

    price += price * (parseInt($idea?.value||0)/100);
    price += price * ((parseInt($rush?.value||0)/10) * 0.03);
    const rev = parseInt($rev?.value||4);
    if(rev>4) price += price * ((rev-4)*0.2);
    price += price * ((parseInt($compR?.value||0)/10) * 0.05);

    const net = Math.round(price);
    const tax = Math.round(price*1.06);
    if($net) $net.textContent = `¥${net.toLocaleString()}`;
    if($tax) $tax.textContent = `¥${tax.toLocaleString()}`;
  }
  const ctrls = [$type,$base,$len,$idea,$rush,$rev,$compR,$edit,$color,$audio,$comp].filter(Boolean);
  ctrls.forEach(el=>{
    el.addEventListener('change', ()=>{ if(el===$type) syncBasePrice(); calcPrice(); });
    el.addEventListener('input', calcPrice);
  });
  syncBasePrice(); calcPrice();
})();

///////////////////////////////////////
// 6. 启动
///////////////////////////////////////
(async function boot(){
  const ok = await hardGuard();
  if(!ok) return;

  await fetchProjects();
  renderRecent();
  renderProjects();
  renderFinance();
  renderGallery();
  renderCalendar();

  show('home');
})();
