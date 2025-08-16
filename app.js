/* editor-studio / app.js  v1.1 (based on your v0.3) */

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

// ============== 登录/注册（未登录只显示登录页） ==============
const authForm = document.getElementById('auth-form');
const authTip  = document.getElementById('auth-tip');
nav.logout.addEventListener('click', async ()=>{
  await supa.auth.signOut();
  // 清理视图到登录页（不展示任何数据）
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
  if(session){ await bootAfterAuth(); showView('home'); }
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

function parseSpec(specStr){
  // 从 "1080p · 16:9" 拆成 {res,ratio}
  const raw = (specStr||'').split('·').map(s=>s.trim());
  let res = raw[0] || '';
  let ratio = raw[1] || '';
  // 容错：如果只有一个且包含冒号则当作比例
  if(!ratio && res.includes(':')){ ratio=res; res=''; }
  return { res, ratio };
}
function mergeTypeSpec(p){
  // 展示用：类型 + spec（分辨率+比例）
  const t = p.type||'';
  const s = p.spec||'';
  return [t, s].filter(Boolean).join(' · ') || '—';
}
function unpaidAmt(p){
  return Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0);
}
function payBadgePill(st){
  if(st==='已收尾款') return `<span class="pill pill-gold pay-pill">已收尾款</span>`;
  if(st==='已收定金') return `<span class="pill pill-green pay-pill">已收定金</span>`;
  return `<span class="pill pill-blue pay-pill">未收款</span>`; // 默认未收款=蓝
}
function hasTag(notes, tag){ return (notes||'').includes(tag); }
function toggleTag(notes, tag, on){
  notes = notes||'';
  const has = notes.includes(tag);
  if(on && !has) return (notes + ' ' + tag).trim();
  if(!on && has) return notes.replace(tag,'').replace(/\s+/g,' ').trim();
  return notes;
}

// 最近待交付（按 Acopy→Bcopy→Final 顺序）
function nearestMilestone(p){
  const today = new Date(); today.setHours(0,0,0,0);
  const A = fmt(p.a_copy), B = fmt(p.b_copy), F = fmt(p.final_date);
  const doneA = hasTag(p.notes,'#A_DONE'), doneB = hasTag(p.notes,'#B_DONE'), doneF = hasTag(p.notes,'#F_DONE');

  const items = [];
  if(A && !doneA) items.push({k:'Acopy', date:A});
  if(B && !doneB) items.push({k:'Bcopy', date:B});
  if(F && !doneF) items.push({k:'Final',  date:F});
  if(items.length===0) return {text:'—', overdue:false};

  items.sort((a,b)=> a.date - b.date);
  const n = items[0];
  const overdue = n.date < today;
  return { text: `${n.k} - ${n.date.getMonth()+1}/${n.date.getDate()}`, overdue };
}

// ============== 首页（保持 v0.3） ==============
function renderRecent(){
  const box = document.getElementById('recent-list'); box.innerHTML='';
  projects.slice(0,4).forEach(p=>{
    const near = nearestMilestone(p);
    const li = document.createElement('div'); li.className='list-item';
    li.innerHTML = `
      <div>
        <div><strong>${p.title||'未命名'}</strong> ${p.brand?`· ${p.brand}`:''}</div>
        <div class="muted small">合作制片：${[p.producer_name,p.producer_contact].filter(Boolean).join(' · ')||'—'}</div>
      </div>
      <div class="muted small">条数：${p.clips||1}</div>
      <div>${payBadgePill(p.pay_status || (unpaidAmt(p)<=0 ? '已收尾款' : (Number(p.deposit_amount||0)>0?'已收定金':'未收款')))}</div>
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

// 报价分析器（保持 v0.3）
(function initQuote(){
  const typeBase = {
    'LookBook': {price:100,  baseSec:15,  secRate:0.01},
    '形象片':    {price:3500, baseSec:45,  secRate:0.03},
    'TVC':      {price:7000, baseSec:60,  secRate:0.03},
    '纪录片':    {price:12000,baseSec:180, secRate:0.005},
    '微电影':    {price:12000,baseSec:180, secRate:0.005},
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
    document.getElementById('qa-comp-val')  && (document.getElementById('qa-comp-val').textContent     = (elComp?.value||0)+'%');
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

    // 创意密度：每+1% => +1%
    let price = basePrice * secFactor;
    price *= (1 + Number(elCreative.value||0)/100);
    // 紧急系数：每+10% => +3%
    price *= (1 + (Number(elUrgent.value||0)/10) * 0.03);
    // 修改次数：超出4次每+1 => +20%
    const rev = Number(elRev.value||0);
    const extraRev = Math.max(0, rev - 4);
    price *= (1 + extraRev*0.20);
    // 合成难度：每+10% => +5%
    if(document.querySelector('.qa-task[value="comp"]')?.checked){
      price *= (1 + (Number(elComp?.value||0)/10)*0.05);
    }

    const net = Math.round(price);
    const gross = Math.round(net * 1.06);
    document.getElementById('qa-net').textContent   = money(net);
    document.getElementById('qa-gross').textContent = money(gross);
  };
  ['change','input'].forEach(ev=>{
    document.getElementById('quote-form').addEventListener(ev, calc);
  });
  calc();
})();

// ============== 项目列表（重排列与交互增强） ==============
function renderProjects(list=projects){
  const tb = document.getElementById('projects-body'); tb.innerHTML='';

  list.forEach(p=>{
    // 解析 spec 为分辨率+比例（不改库结构，仍写回 spec）
    const {res, ratio} = parseSpec(p.spec);

    const near = nearestMilestone(p);
    const tr = document.createElement('tr');

    // —— 付款状态文本（用于彩色胶囊）
    const currentPay = p.pay_status || (unpaidAmt(p)<=0 ? '已收尾款' : (Number(p.deposit_amount||0)>0?'已收定金':'未收款'));

    tr.innerHTML = `
      <td contenteditable="true" data-k="title" data-id="${p.id}">${p.title||''}</td>

      <td>
        <div class="cell-pop">
          <div class="row" style="gap:6px">
            <input data-k="producer_name" data-id="${p.id}" value="${p.producer_name||''}" placeholder="姓名" style="width:120px">
            <input data-k="producer_contact" data-id="${p.id}" value="${p.producer_contact||''}" placeholder="联系方式" style="width:160px">
          </div>
        </div>
      </td>

      <td>
        <div class="row" style="gap:8px;align-items:center">
          <select data-k="type" data-id="${p.id}" style="width:130px">
            ${['LookBook','形象片','TVC','纪录片','微电影'].map(o=>`<option ${o===(p.type||'')?'selected':''}>${o}</option>`).join('')}
          </select>
          <input data-k="clips" data-id="${p.id}" type="number" min="1" value="${p.clips||1}" style="width:70px" title="影片条数">
          <select data-k="res" data-id="${p.id}" style="width:100px">
            ${['1080p','4k'].map(o=>`<option ${o===(res||'')?'selected':''}>${o}</option>`).join('')}
          </select>
          <select data-k="ratio" data-id="${p.id}" style="width:110px">
            ${['16:9','9:16','1:1','4:3','3:4'].map(o=>`<option ${o===(ratio||'')?'selected':''}>${o}</option>`).join('')}
          </select>
        </div>
      </td>

      <td>
        <div class="cell-pop">
          <div class="chips" style="margin-bottom:6px">
            ${p.a_copy?`<span class="chip chip-a">Acopy</span>`:''}
            ${p.b_copy?`<span class="chip chip-b">Bcopy</span>`:''}
            ${p.final_date?`<span class="chip chip-final">Final</span>`:''}
          </div>
          <div class="${near.overdue?'pill pill-red':'pill'}" style="margin-bottom:6px">${near.text}</div>

          <button class="btn-xs" data-pop="progress" data-id="${p.id}">设置日期/完成</button>
          <div class="pop hidden">
            <div class="row"><label>Acopy</label><input type="date" data-k="a_copy" data-id="${p.id}" value="${p.a_copy||''}"></div>
            <div class="row"><label>Bcopy</label><input type="date" data-k="b_copy" data-id="${p.id}" value="${p.b_copy||''}"></div>
            <div class="row"><label>Final</label><input type="date" data-k="final_date" data-id="${p.id}" value="${p.final_date||''}"></div>
            <div class="row" style="gap:12px">
              <label><input type="checkbox" class="done" data-id="${p.id}" data-tag="#A_DONE" ${hasTag(p.notes,'#A_DONE')?'checked':''}> Acopy 完成</label>
              <label><input type="checkbox" class="done" data-id="${p.id}" data-tag="#B_DONE" ${hasTag(p.notes,'#B_DONE')?'checked':''}> Bcopy 完成</label>
              <label><input type="checkbox" class="done" data-id="${p.id}" data-tag="#F_DONE" ${hasTag(p.notes,'#F_DONE')?'checked':''}> Final 完成</label>
            </div>
            <div class="actions">
              <button class="btn-xs pop-save" data-id="${p.id}">保存</button>
              <button class="btn-xs pop-close">关闭</button>
            </div>
          </div>
        </div>
      </td>

      <td>
        <div class="cell-pop">
          <span class="pay-pill">${payBadgePill(currentPay)}</span>
          <div class="pay-menu hidden">
            <button data-pay="未收款">未收款</button>
            <button data-pay="已收定金">已收定金</button>
            <button data-pay="已收尾款">已收尾款</button>
          </div>
        </div>
      </td>

      <td>
        <div class="cell-pop">
          <span class="muted">${money(p.quote_amount)} / ${money(p.paid_amount)}</span>
          <div class="pop hidden">
            <div class="row"><label>总金额</label><input type="number" min="0" step="0.01" data-k="quote_amount" data-id="${p.id}" value="${p.quote_amount||0}"></div>
            <div class="row"><label>已收金额</label><input type="number" min="0" step="0.01" data-k="paid_amount" data-id="${p.id}" value="${p.paid_amount||0}"></div>
            <div class="actions">
              <button class="btn-xs money-save" data-id="${p.id}">保存</button>
              <button class="btn-xs pop-close">关闭</button>
            </div>
          </div>
        </div>
      </td>

      <td contenteditable="true" data-k="notes" data-id="${p.id}">${p.notes||''}</td>
    `;
    tb.appendChild(tr);
  });

  // —— 可编辑文本（标题/备注）
  tb.addEventListener('blur', async (e)=>{
    const td = e.target.closest('td[contenteditable="true"]'); if(!td) return;
    const id = td.getAttribute('data-id'); const k = td.getAttribute('data-k'); const v = td.textContent.trim();
    if(!id || !k) return;
    const patch = {}; patch[k]=v;
    await supa.from('projects').update(patch).eq('id', id);
  }, true);

  // —— 合作制片 姓名/联系方式 输入
  tb.querySelectorAll('input[data-k="producer_name"],input[data-k="producer_contact"]').forEach(inp=>{
    inp.addEventListener('change', async ()=>{
      const id = inp.getAttribute('data-id');
      const row = {};
      tb.querySelectorAll(`input[data-id="${id}"][data-k="producer_name"],input[data-id="${id}"][data-k="producer_contact"]`).forEach(i=>{
        row[i.getAttribute('data-k')] = i.value.trim();
      });
      await supa.from('projects').update(row).eq('id', id);
    });
  });

  // —— 类型/条数/规格（分辨率+比例）
  tb.querySelectorAll('select[data-k],input[data-k="clips"]').forEach(el=>{
    el.addEventListener('change', async ()=>{
      const id = el.getAttribute('data-id');
      const row = {};
      const typeEl  = tb.querySelector(`select[data-id="${id}"][data-k="type"]`);
      const clipsEl = tb.querySelector(`input[data-id="${id}"][data-k="clips"]`);
      const resEl   = tb.querySelector(`select[data-id="${id}"][data-k="res"]`);
      const ratioEl = tb.querySelector(`select[data-id="${id}"][data-k="ratio"]`);
      if(typeEl)  row.type  = typeEl.value;
      if(clipsEl) row.clips = Number(clipsEl.value||1);
      if(resEl || ratioEl){
        const res   = resEl?.value || '';
        const ratio = ratioEl?.value || '';
        row.spec = [res, ratio].filter(Boolean).join(' · ');
      }
      await supa.from('projects').update(row).eq('id', id);
      await fetchProjects(); renderProjects(); renderKpis();
    });
  });

  // —— 进度弹层：打开/关闭
  tb.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-pop="progress"]');
    const close = e.target.closest('.pop-close');
    if(btn){
      const wrap = btn.parentElement;
      const pop = wrap.querySelector('.pop');
      document.querySelectorAll('#projects-body .cell-pop .pop').forEach(p=>p!==pop && p.classList.add('hidden'));
      pop.classList.toggle('hidden');
    }
    if(close){
      close.closest('.pop')?.classList.add('hidden');
    }
  });

  // —— 进度弹层：保存 日期/完成 标签
  tb.addEventListener('click', async (e)=>{
    const saveBtn = e.target.closest('.pop-save'); if(!saveBtn) return;
    const id = saveBtn.getAttribute('data-id');
    const get = k => tb.querySelector(`input[data-id="${id}"][data-k="${k}"]`)?.value || null;
    const patch = {
      a_copy:     get('a_copy') || null,
      b_copy:     get('b_copy') || null,
      final_date: get('final_date') || null,
    };
    // 完成标签
    const row = projects.find(x=>String(x.id)===String(id));
    let notes = row?.notes || '';
    tb.querySelectorAll(`input.done[data-id="${id}"]`).forEach(box=>{
      notes = toggleTag(notes, box.getAttribute('data-tag'), box.checked);
    });
    patch.notes = notes;

    await supa.from('projects').update(patch).eq('id', id);
    await fetchProjects(); renderProjects(); renderKpis();
  });

  // —— 支付状态 彩色胶囊 下拉
  tb.addEventListener('click', (e)=>{
    const pill = e.target.closest('.pay-pill'); if(!pill) return;
    const wrap = pill.parentElement;
    const menu = wrap.querySelector('.pay-menu');
    document.querySelectorAll('#projects-body .pay-menu').forEach(m=>m!==menu && m.classList.add('hidden'));
    menu.classList.toggle('hidden');
  });
  tb.addEventListener('click', async (e)=>{
    const opt = e.target.closest('.pay-menu button'); if(!opt) return;
    const wrap = opt.closest('.cell-pop'); const id = wrap.querySelector('.pay-pill')?.closest('td')?.parentElement?.querySelector('[data-id]')?.getAttribute('data-id');
    const rowEl = wrap.closest('tr');
    // 更安全地取 id：
    const anyDataId = rowEl?.querySelector('[data-id]')?.getAttribute('data-id');
    const pid = anyDataId || id;
    const val = opt.getAttribute('data-pay');
    await supa.from('projects').update({ pay_status: val }).eq('id', pid);
    await fetchProjects(); renderProjects(); renderKpis();
  });

  // —— 总金额/已收金额 弹层
  tb.addEventListener('click', (e)=>{
    const cell = e.target.closest('td'); if(!cell) return;
    const pop = cell.querySelector('.cell-pop .pop'); if(!pop) return;
    const isMoney = !!cell.querySelector('.money-save');
    if(isMoney){
      document.querySelectorAll('#projects-body .cell-pop .pop').forEach(p=>p!==pop && p.classList.add('hidden'));
      pop.classList.toggle('hidden');
    }
  });
  tb.addEventListener('click', async (e)=>{
    const saveBtn = e.target.closest('.money-save'); if(!saveBtn) return;
    const id = saveBtn.getAttribute('data-id');
    const total = Number(document.querySelector(`input[data-id="${id}"][data-k="quote_amount"]`)?.value||0);
    const paid  = Number(document.querySelector(`input[data-id="${id}"][data-k="paid_amount"]`)?.value||0);
    await supa.from('projects').update({ quote_amount: total, paid_amount: paid }).eq('id', id);
    await fetchProjects(); renderProjects(); renderKpis();
  });

  // 点击其它区域关闭所有 pop
  document.addEventListener('mousedown', (e)=>{
    const inPop = e.target.closest('.cell-pop');
    if(!inPop){
      document.querySelectorAll('#projects-body .cell-pop .pop,.pay-menu').forEach(p=>p.classList.add('hidden'));
    }
  }, {capture:true});
}

// ============== 作品合集（保持 v0.3） ==============
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
    a.innerHTML = `<div class="caption">${p.title||'未命名'}${p.brand?` · ${p.brand}`:''}</div>`;
    grid.appendChild(a);
  });
}

// ============== 档期（独立页，保持 v0.3） ==============
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
      (evs[day] ||= []).push({ typ, txt:`${p.title||'未命名'} · ${typ==='a'?'Acopy':typ==='b'?'Bcopy':'Final'}`, overdue });
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

// ============== 财务：排行榜/账龄/趋势（保持 v0.3并修复乘号） ==============
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

  // 收入趋势（近 90 天），修正计算公式中的“×”为“*”
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
  const w=container.clientWidth||800, h=container.clientHeight||180, pad=10;
  const max=Math.max(...arr,1), step=(w-2*pad)/Math.max(arr.length-1,1);
  let d=''; arr.forEach((v,i)=>{ const x=pad+i*step, y=h-pad-(v/max)*(h-2*pad); d+=(i?'L':'M')+x+','+y+' '; });
  container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="#0a84ff" stroke-width="2"/></svg>`;
}

// ============== 导航 ==============
document.getElementById('go-list')?.addEventListener('click', ()=> showView('projects'));
nav.home.addEventListener('click',    ()=> showView('home'));
nav.projects.addEventListener('click', ()=> showView('projects'));
nav.gallery.addEventListener('click',  ()=> showView('gallery'));
nav.finance.addEventListener('click',  ()=> showView('finance'));
nav.schedule.addEventListener('click', ()=> { showView('schedule'); renderCalendar(); });

// ============== 新建项目（保持 v0.3） ==============
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
  if(row.spec){ // 仅保存用户在创建时选的分辨率，比例可在列表再选
    row.spec = row.spec;
  }
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

// ============== 启动（未登录只显示登录页） ==============
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
