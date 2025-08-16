/* editor-studio / app.js  v1.2 */

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
  const raw = (specStr||'').split('·').map(s=>s.trim());
  let res = raw[0] || '';
  let ratio = raw[1] || '';
  if(!ratio && res.includes(':')){ ratio=res; res=''; }
  return { res, ratio };
}
function mergeTypeSpec(p){
  const t = p.type||'';
  const s = p.spec||'';
  const clips = p.clips ? ` · ${p.clips}条` : '';
  return [t, s].filter(Boolean).join(' · ') + clips || '—';
}
function unpaidAmt(p){
  return Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0);
}
function payBadgePill(st){
  if(st==='已收尾款') return `<span class="pill pill-gold">已收尾款</span>`;
  if(st==='已收定金') return `<span class="pill pill-green">已收定金</span>`;
  return `<span class="pill pill-blue">未收款</span>`;
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

// ============== 首页（保持） ==============
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

// 报价分析器（保持）
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

    let price = basePrice * secFactor;
    price *= (1 + Number(elCreative.value||0)/100);
    price *= (1 + (Number(elUrgent.value||0)/10) * 0.03);
    const rev = Number(elRev.value||0);
    const extraRev = Math.max(0, rev - 4);
    price *= (1 + extraRev*0.20);
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

// ============== 通用编辑模态（新增） ==============
const editorModal  = document.getElementById('editor-modal');
const editorTitle  = document.getElementById('editor-title');
const editorForm   = document.getElementById('editor-form');
const editorClose  = document.getElementById('editor-close');
const editorCancel = document.getElementById('editor-cancel');

function closeEditor(){ editorModal.classList.remove('show'); editorForm.innerHTML=''; }
editorClose?.addEventListener('click', closeEditor);
editorCancel?.addEventListener('click', closeEditor);
editorModal?.addEventListener('mousedown', (e)=>{ if(e.target===editorModal) closeEditor(); });

function optionList(opts, selected){
  return opts.map(o=>`<option ${o===(selected||'')?'selected':''}>${o}</option>`).join('');
}
function openEditorModal(kind, id){
  const p = projects.find(x=>String(x.id)===String(id));
  if(!p) return;
  editorModal.classList.add('show');
  editorForm.setAttribute('data-kind', kind);
  editorForm.setAttribute('data-id', id);

  if(kind==='producer'){
    editorTitle.textContent = '编辑 合作制片';
    editorForm.innerHTML = `
      <div class="grid-2">
        <label>合作制片（姓名）<input name="producer_name" value="${p.producer_name||''}"></label>
        <label>合作制片（联系方式）<input name="producer_contact" value="${p.producer_contact||''}"></label>
      </div>
    `;
  }
  if(kind==='spec'){
    const {res, ratio} = parseSpec(p.spec);
    editorTitle.textContent = '编辑 影片类型 & 条数 & 规格';
    editorForm.innerHTML = `
      <div class="grid-3">
        <label>类型<select name="type">${optionList(['LookBook','形象片','TVC','纪录片','微电影'], p.type||'')}</select></label>
        <label>影片条数<input name="clips" type="number" min="1" value="${p.clips||1}"></label>
        <label>分辨率<select name="res">${optionList(['1080p','4k'], res||'')}</select></label>
      </div>
      <div class="grid-2">
        <label>画幅比例<select name="ratio">${optionList(['16:9','9:16','1:1','4:3','3:4'], ratio||'')}</select></label>
      </div>
    `;
  }
  if(kind==='progress'){
    editorTitle.textContent = '编辑 进度（日期 / 完成标记）';
    editorForm.innerHTML = `
      <div class="grid-3">
        <label>Acopy 日期<input type="date" name="a_copy" value="${p.a_copy||''}"></label>
        <label>Bcopy 日期<input type="date" name="b_copy" value="${p.b_copy||''}"></label>
        <label>Final 日期<input type="date" name="final_date" value="${p.final_date||''}"></label>
      </div>
      <div class="grid-3">
        <label><input type="checkbox" name="A_DONE" ${hasTag(p.notes,'#A_DONE')?'checked':''}> Acopy 完成</label>
        <label><input type="checkbox" name="B_DONE" ${hasTag(p.notes,'#B_DONE')?'checked':''}> Bcopy 完成</label>
        <label><input type="checkbox" name="F_DONE" ${hasTag(p.notes,'#F_DONE')?'checked':''}> Final 完成</label>
      </div>
    `;
  }
  if(kind==='pay'){
    editorTitle.textContent = '编辑 支付状态';
    const current = p.pay_status || (unpaidAmt(p)<=0 ? '已收尾款' : (Number(p.deposit_amount||0)>0?'已收定金':'未收款'));
    editorForm.innerHTML = `
      <div class="grid-1">
        <label>支付状态
          <select name="pay_status">
            ${optionList(['未收款','已收定金','已收尾款'], current)}
          </select>
        </label>
      </div>
      <div class="muted small">* 如需修改金额，请仍在“总金额”一栏点开编辑。</div>
    `;
  }
}

editorForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id   = editorForm.getAttribute('data-id');
  const kind = editorForm.getAttribute('data-kind');
  const fd   = new FormData(editorForm);
  let patch = {};

  if(kind==='producer'){
    patch.producer_name    = (fd.get('producer_name')||'').toString().trim();
    patch.producer_contact = (fd.get('producer_contact')||'').toString().trim();
  }
  if(kind==='spec'){
    const type  = (fd.get('type')||'').toString();
    const clips = Number(fd.get('clips')||1);
    const res   = (fd.get('res')||'').toString();
    const ratio = (fd.get('ratio')||'').toString();
    patch.type  = type;
    patch.clips = clips;
    patch.spec  = [res, ratio].filter(Boolean).join(' · ');
  }
  if(kind==='progress'){
    const a_copy    = fd.get('a_copy')||null;
    const b_copy    = fd.get('b_copy')||null;
    const final_date= fd.get('final_date')||null;
    const row = projects.find(x=>String(x.id)===String(id));
    let notes = row?.notes || '';
    notes = toggleTag(notes, '#A_DONE', !!fd.get('A_DONE'));
    notes = toggleTag(notes, '#B_DONE', !!fd.get('B_DONE'));
    notes = toggleTag(notes, '#F_DONE', !!fd.get('F_DONE'));
    patch = { a_copy: a_copy||null, b_copy: b_copy||null, final_date: final_date||null, notes };
  }
  if(kind==='pay'){
    patch.pay_status = (fd.get('pay_status')||'未收款').toString();
  }

  await supa.from('projects').update(patch).eq('id', id);
  closeEditor();
  await fetchProjects(); renderAll();
});

// ============== 项目列表（改为弹窗编辑） ==============
function renderProjects(list=projects){
  const tb = document.getElementById('projects-body'); tb.innerHTML='';

  list.forEach(p=>{
    const near = nearestMilestone(p);
    const tr = document.createElement('tr');

    const {res, ratio} = parseSpec(p.spec);
    const currentPay = p.pay_status || (unpaidAmt(p)<=0 ? '已收尾款' : (Number(p.deposit_amount||0)>0?'已收定金':'未收款'));

    tr.innerHTML = `
      <!-- 项目（仍支持直接改标题） -->
      <td contenteditable="true" data-k="title" data-id="${p.id}">${p.title||''}</td>

      <!-- 合作制片：摘要 + 弹窗编辑 -->
      <td>
        <div class="cell-summary">
          <span>${p.producer_name||'未填'}</span>
          ${p.producer_contact?`<span class="muted small">· ${p.producer_contact}</span>`:''}
          <button class="cell-edit edit-btn" data-kind="producer" data-id="${p.id}">编辑</button>
        </div>
      </td>

      <!-- 影片类型&条数&规格：摘要 + 弹窗编辑 -->
      <td>
        <div class="cell-summary">
          <span>${mergeTypeSpec(p)||'—'}</span>
          <button class="cell-edit edit-btn" data-kind="spec" data-id="${p.id}">编辑</button>
        </div>
      </td>

      <!-- 进度：摘要 + 弹窗编辑 -->
      <td>
        <div class="cell-summary">
          <div class="chips">
            ${p.a_copy?`<span class="chip chip-a">Acopy</span>`:''}
            ${p.b_copy?`<span class="chip chip-b">Bcopy</span>`:''}
            ${p.final_date?`<span class="chip chip-final">Final</span>`:''}
          </div>
          <div class="${near.overdue?'pill pill-red':'pill'}">${near.text}</div>
          <button class="cell-edit edit-btn" data-kind="progress" data-id="${p.id}">编辑</button>
        </div>
      </td>

      <!-- 支付状态：摘要 + 弹窗编辑 -->
      <td>
        <div class="cell-summary">
          ${payBadgePill(currentPay)}
          <button class="cell-edit edit-btn" data-kind="pay" data-id="${p.id}">编辑</button>
        </div>
      </td>

      <!-- 总金额：仍采用原来的点开小面板（你喜欢的话也可改成弹窗） -->
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

      <!-- 备注（可直接编辑） -->
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

  // —— 打开弹窗编辑（统一入口）
  tb.addEventListener('click', (e)=>{
    const btn = e.target.closest('.edit-btn'); if(!btn) return;
    openEditorModal(btn.getAttribute('data-kind'), btn.getAttribute('data-id'));
  });

  // —— 总金额小面板（保留）
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

  // 点击其它区域关闭所有 money 面板
  document.addEventListener('mousedown', (e)=>{
    const inPop = e.target.closest('.cell-pop');
    if(!inPop){
      document.querySelectorAll('#projects-body .cell-pop .pop').forEach(p=>p.classList.add('hidden'));
    }
  }, {capture:true});
}

// ============== 作品合集（保持） ==============
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

// ============== 档期（保持） ==============
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

// ============== 财务（保持并修正趋势乘号） ==============
function renderFinance(){
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

  const rq=document.getElementById('rank-project'); rq.innerHTML='';
  [...projects].sort((a,b)=>Number(b.quote_amount||0)-Number(a.quote_amount||0)).forEach(p=>{
    const li=document.createElement('div'); li.className='list-item';
    li.innerHTML = `<div>${p.title||'未命名'}</div><strong>${money(p.quote_amount)}</strong>`; rq.appendChild(li);
  });

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

// ============== 新建项目（保持） ==============
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
  if(row.spec){
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
