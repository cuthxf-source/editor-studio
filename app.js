// ====== Supabase（使用你的项目） ======
const SUPABASE_URL = 'https://lywlcsrndkturdpgvvnc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d2xjc3JuZGt0dXJkcGd2dm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwOTg1NzUsImV4cCI6MjA3MDY3NDU3NX0.z49xmAaG1ciyMbGPPamoYfiAwFTP0PfX7__K3iRRkhs';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== 工具 ======
const qs = (s, el=document)=> el.querySelector(s);
const qsa = (s, el=document)=> Array.from(el.querySelectorAll(s));
const fmtMoney = (n, cur='CNY') => `${cur} ${(Number(n)||0).toLocaleString()}`;
const fmtDate = d => d ? new Date(d).toISOString().slice(0,10) : '';
const sum = arr => arr.reduce((a,b)=> a + (Number(b)||0), 0);
const toastEl = qs('#toast');
function toast(m){ toastEl.textContent=m; toastEl.classList.remove('hidden'); setTimeout(()=>toastEl.classList.add('hidden'),1800); }

// ====== 视图节点 ======
const authView = qs('#authView');
const appView  = qs('#appView');
const userBox  = qs('#userBox');
const userEmailEl = qs('#userEmail');

const tabs = qsa('.tab');
const panels = {
  dashboard: qs('#tab-dashboard'),
  projects:  qs('#tab-projects'),
  calendar:  qs('#tab-calendar'),
  collection: qs('#tab-collection'),
};

// KPI & 列表
const kpiPaid = qs('#kpiPaid');
const kpiDue  = qs('#kpiDue');
const kpiCount= qs('#kpiCount');
const recentList = qs('#recentList');

const btnNew = qs('#btnNew');
const searchInput = qs('#searchInput');
const tbodyProjects = qs('#tbodyProjects');

const dlgProject = qs('#dlgProject');
const frmProject = qs('#frmProject');
const dlgTitle = qs('#dlgTitle');

const inlineDialog = qs('#inlineEditor');
const inlineContent = qs('#inlineContent');
const inlineCancel = qs('#inlineCancel');
const inlineOk = qs('#inlineOk');

const calendarList = qs('#calendarList');
const collectionGrid = qs('#collectionGrid');

// ====== 登录/注册 ======
qs('#btnToSignup').addEventListener('click', ()=> qs('#signupPanel').classList.remove('hidden'));
qs('#btnCancelSignup').addEventListener('click', ()=> qs('#signupPanel').classList.add('hidden'));
qs('#btnSignup').addEventListener('click', doSignup);
qs('#btnLogin').addEventListener('click', doLogin);
qs('#btnSignOut').addEventListener('click', async ()=>{ await db.auth.signOut(); location.reload(); });

db.auth.onAuthStateChange(()=> afterAuth());
afterAuth();

async function doSignup(){
  const email = qs('#signupEmail').value.trim();
  const password = qs('#signupPassword').value;
  if(!email || !password) return toast('请填写邮箱与密码');
  const { error } = await db.auth.signUp({ email, password });
  if(error){
    if((error.message||'').toLowerCase().includes('already')) return toast('该邮箱已注册，请直接登录');
    return toast('注册失败：'+error.message);
  }
  await db.auth.signInWithPassword({ email, password });
  toast('注册并登录成功');
  await afterAuth();
}
async function doLogin(){
  const email = qs('#loginEmail').value.trim();
  const password = qs('#loginPassword').value;
  if(!email || !password) return toast('请填写邮箱与密码');
  const { error } = await db.auth.signInWithPassword({ email, password });
  if(error) return toast('登录失败：'+error.message);
  toast('登录成功'); await afterAuth();
}
async function afterAuth(){
  const { data:{ user } } = await db.auth.getUser();
  if(!user){
    authView.classList.remove('hidden'); appView.classList.add('hidden'); userBox.classList.add('hidden'); return;
  }
  userEmailEl.textContent = user.email||''; userBox.classList.remove('hidden');
  authView.classList.add('hidden'); appView.classList.remove('hidden');
  setActiveTab('dashboard'); await renderAll();
}

// ====== Tabs ======
tabs.forEach(btn=> btn.addEventListener('click', ()=> setActiveTab(btn.dataset.tab)));
function setActiveTab(name){
  tabs.forEach(b=> b.classList.toggle('active', b.dataset.tab===name));
  Object.entries(panels).forEach(([k,el])=> el.classList.toggle('hidden', k!==name));
  if(name==='dashboard') loadDashboard();
  if(name==='projects')  loadProjects();
  if(name==='calendar')  loadCalendar();
  if(name==='collection')loadCollection();
}
async function renderAll(){ await Promise.all([loadDashboard(), loadProjects(), loadCalendar(), loadCollection()]); }

// ====== Dashboard ======
let allProjectsCache = [];
async function loadDashboard(){
  const { data, error } = await db.from('projects').select('*').order('updated_at',{ascending:false}).limit(100);
  if(error){ console.error(error); return; }
  allProjectsCache = data || [];

  const paidSum = sum(allProjectsCache.map(p=> (p.paid_amount||0)+(p.deposit_amount||0)));
  const dueSum  = sum(allProjectsCache.map(p=> Math.max((p.quote_amount||0)-(p.deposit_amount||0)-(p.paid_amount||0),0)));
  const total   = allProjectsCache.length;
  const done    = allProjectsCache.filter(p=> p.final_date || p.status==='done').length;

  kpiPaid.textContent  = fmtMoney(paidSum);
  kpiDue.textContent   = fmtMoney(dueSum);
  kpiCount.textContent = `${done} / ${total}`;

  // 最近列表（可点击跳转）
  recentList.innerHTML = '';
  allProjectsCache.slice(0,8).forEach(p=>{
    const row = document.createElement('div');
    row.className='item';
    row.innerHTML = `
      <a href="javascript:void(0)" data-goto="${p.id}">
        <div class="badge-dot">
          <span class="dot" style="background:${p.final_date?'var(--ok)':'var(--warn)'}"></span>
          <strong>${p.title||'-'}</strong> · ${p.brand||''} · ${p.type||''}
        </div>
      </a>
      <div>${p.final_date ? 'Final: '+fmtDate(p.final_date) : '未完成'}</div>`;
    recentList.appendChild(row);
  });

  // 点击跳项目页并高亮
  recentList.querySelectorAll('[data-goto]').forEach(a=>{
    a.addEventListener('click', ()=>{
      const id = a.getAttribute('data-goto');
      setActiveTab('projects');
      // 等项目表加载完再滚动定位
      highlightTargetId = id;
      loadProjects();
    });
  });
}

// ====== 项目 CRUD & 内联编辑 ======
let currentRows = [];
let highlightTargetId = null;

btnNew.addEventListener('click', ()=>{
  frmProject.reset();
  qs('#specSummary').textContent = '输出规格：点击选择';
  qs('#scheduleSummary').textContent = '档期：点击选择 A/B/Final';
  dlgTitle.textContent = '新建项目';
  dlgProject.showModal();
});

frmProject.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(frmProject);
  const p = Object.fromEntries(fd.entries());
  p.quote_amount   = Number(p.quote_amount||0);
  p.deposit_amount = Number(p.deposit_amount||0);
  p.paid_amount    = Number(p.paid_amount||0);
  p.pay_status   ||= 'unpaid';
  p.status       ||= 'open';
  p.updated_at = new Date().toISOString();

  const { error } = await db.from('projects').insert(p);
  if(error){ toast('新建失败：'+error.message); return; }
  dlgProject.close(); toast('已保存');
  await loadProjects(); await loadDashboard(); await loadCalendar(); await loadCollection();
});

// 合并控件摘要文字
function updateSpecSummary(){
  const spec = qs('[name="spec"]').value || '';
  const ratio= qs('[name="ratio"]').value || '';
  const dur  = qs('[name="duration"]').value || '';
  const parts = [spec, ratio].filter(Boolean).join(' · ');
  qs('#specSummary').textContent = '输出规格：' + (parts || '点击选择') + (dur?` · ${dur}`:'');
}
function updateScheduleSummary(){
  const a = fmtDate(qs('[name="a_copy"]').value);
  const b = fmtDate(qs('[name="b_copy"]').value);
  const f = fmtDate(qs('[name="final_date"]').value);
  qs('#scheduleSummary').textContent = '档期：' + [a||'-', b||'-', f||'-'].join(' / ');
}
qsa('[name="spec"],[name="ratio"]').forEach(el=> el.addEventListener('change', updateSpecSummary));
qs('[name="duration"]').addEventListener('input', updateSpecSummary);
qsa('[name="a_copy"],[name="b_copy"],[name="final_date"]').forEach(el=> el.addEventListener('change', updateScheduleSummary));

// 搜索
searchInput.addEventListener('input', ()=> renderTable(currentRows, searchInput.value.trim().toLowerCase()));

async function loadProjects(){
  const { data, error } = await db.from('projects').select('*').order('updated_at',{ascending:false});
  if(error){ toast('读取失败：'+error.message); return; }
  currentRows = data || [];
  renderTable(currentRows, searchInput.value.trim().toLowerCase());

  // 若来自“最近项目”点击，定位并高亮
  if(highlightTargetId){
    const tr = tbodyProjects.querySelector(`tr[data-id="${highlightTargetId}"]`);
    if(tr){
      tr.classList.add('row-highlight');
      tr.scrollIntoView({behavior:'smooth', block:'center'});
      setTimeout(()=> tr.classList.remove('row-highlight'), 2200);
    }
    highlightTargetId = null;
  }
}

function renderTable(rows, keyword=''){
  tbodyProjects.innerHTML = '';
  const list = keyword ? rows.filter(p=>{
    const hay = `${p.title||''} ${p.brand||''} ${p.type||''}`.toLowerCase();
    return hay.includes(keyword);
  }) : rows;

  list.forEach(p=>{
    const specView  = [p.spec||'', p.ratio||''].filter(Boolean).join(' · ');
    const schedule  = [fmtDate(p.a_copy), fmtDate(p.b_copy), fmtDate(p.final_date)].map(x=>x||'-').join(' / ');
    const q = Number(p.quote_amount||0), d=Number(p.deposit_amount||0), pa=Number(p.paid_amount||0);
    const u = Math.max(q - d - pa, 0);

    const tr = document.createElement('tr');
    tr.dataset.id = p.id;
    tr.innerHTML = `
      ${td('title', p.title)}
      ${td('brand', p.brand)}
      ${td('type', p.type)}
      ${td('spec_ratio', specView)}
      ${td('duration', p.duration)}
      ${td('schedule', schedule)}
      ${td('amounts', `¥${q} / ¥${d} / ¥${pa} / <strong>¥${u}</strong>`)}
      ${td('currency', p.currency||'CNY')}
      ${td('payment_due_date', fmtDate(p.payment_due_date))}
      ${td('pay_status', p.pay_status||'unpaid')}
      ${td('final_link', p.final_link||'')}
      <td>
        <button class="btn ghost btn-save">保存</button>
        <button class="btn danger btn-del">删除</button>
      </td>`;

    // 行内编辑：事件代理
    tr.addEventListener('click', e=>{
      const cell = e.target.closest('td[data-field]');
      if(!cell) return;
      openCellEditor(cell, p);
    });

    // 保存
    tr.querySelector('.btn-save').addEventListener('click', async ()=>{
      const payload = collectRow(tr, p);
      payload.updated_at = new Date().toISOString();
      const { error } = await db.from('projects').update(payload).eq('id', p.id);
      if(error){ toast('保存失败：'+error.message); return; }
      toast('已保存');
      await loadDashboard(); await loadCalendar(); await loadCollection();
    });

    // 删除
    tr.querySelector('.btn-del').addEventListener('click', async ()=>{
      if(!confirm('确定删除该项目？')) return;
      const { error } = await db.from('projects').delete().eq('id', p.id);
      if(error){ toast('删除失败：'+error.message); return; }
      tr.remove(); toast('已删除');
      await loadDashboard(); await loadCalendar(); await loadCollection();
    });

    tbodyProjects.appendChild(tr);
  });
}

function td(field, val){ return `<td data-field="${field}" data-edit>${val==null?'':val}</td>`; }

// —— 打开单元格编辑器（根据字段类型选择控件） ——
function openCellEditor(cell, row){
  const field = cell.dataset.field;
  const text = (cell.textContent||'').trim();

  // 基本文本/数字/日期直接替换为 input
  const simpleInput = (type='text', value='')=>{
    cell.innerHTML = '';
    const input = document.createElement('input');
    input.type = type; input.value = value;
    input.addEventListener('blur', ()=> { cell.textContent = input.value; });
    input.addEventListener('keydown', ev=>{ if(ev.key==='Enter'){ input.blur(); }});
    cell.appendChild(input); input.focus(); input.select();
  };

  if(field==='type'){
    const sel = document.createElement('select');
    ['LOOKBOOK','形象片','TVC','宣传片','纪录片','花絮'].forEach(v=>{
      const o=document.createElement('option'); o.value=o.textContent=v;
      if(v===text) o.selected=true; sel.appendChild(o);
    });
    cell.innerHTML=''; cell.appendChild(sel); sel.focus();
    sel.addEventListener('change', ()=> cell.textContent = sel.value);
    sel.addEventListener('blur', ()=> cell.textContent = sel.value);
    return;
  }

  if(field==='currency'){
    const input = document.createElement('input');
    input.value = text || 'CNY'; cell.innerHTML=''; cell.appendChild(input); input.focus();
    input.addEventListener('blur', ()=> cell.textContent = input.value.trim()||'CNY');
    return;
  }

  if(field==='pay_status'){
    const sel = document.createElement('select');
    [['unpaid','未收'],['deposit','已收定金'],['paid','已收全款']].forEach(([k,cap])=>{
      const o=document.createElement('option'); o.value=k; o.textContent=cap;
      if((row.pay_status||'unpaid')===k) o.selected=true; sel.appendChild(o);
    });
    cell.innerHTML=''; cell.appendChild(sel); sel.focus();
    sel.addEventListener('change', ()=> cell.textContent = sel.options[sel.selectedIndex].textContent);
    sel.addEventListener('blur', ()=> cell.textContent = sel.options[sel.selectedIndex].textContent);
    return;
  }

  if(field==='payment_due_date'){
    simpleInput('date', row.payment_due_date ? fmtDate(row.payment_due_date) : '');
    return;
  }

  if(field==='amounts'){
    // 金额编辑：弹出小面板
    inlineContent.innerHTML = `
      <div class="grid three" style="padding:16px;">
        <label>报价<input id="a_quote" type="number" value="${Number(row.quote_amount||0)}"></label>
        <label>定金<input id="a_dep" type="number" value="${Number(row.deposit_amount||0)}"></label>
        <label>已收<input id="a_paid" type="number" value="${Number(row.paid_amount||0)}"></label>
      </div>`;
    inlineDialog.showModal();
    inlineCancel.onclick = ()=> inlineDialog.close();
    inlineOk.onclick = ()=>{
      const q = Number(qs('#a_quote').value||0);
      const d = Number(qs('#a_dep').value||0);
      const p = Number(qs('#a_paid').value||0);
      const u = Math.max(q-d-p,0);
      cell.innerHTML = `¥${q} / ¥${d} / ¥${p} / <strong>¥${u}</strong>`;
      inlineDialog.close();
    };
    return;
  }

  if(field==='spec_ratio'){
    // 输出规格（合并）编辑
    inlineContent.innerHTML = `
      <div class="grid three" style="padding:16px;">
        <label>规格
          <select id="e_spec">
            <option ${row.spec==='1080p'?'selected':''}>1080p</option>
            <option ${row.spec==='4K'?'selected':''}>4K</option>
          </select>
        </label>
        <label>比例
          <select id="e_ratio">
            ${['16:9','9:16','1:1','3:4','4:3'].map(r=>`<option ${row.ratio===r?'selected':''}>${r}</option>`).join('')}
          </select>
        </label>
        <label>时长<input id="e_dur" value="${row.duration||''}" placeholder="30s / 2min"></label>
      </div>`;
    inlineDialog.showModal();
    inlineCancel.onclick = ()=> inlineDialog.close();
    inlineOk.onclick = ()=>{
      const spec = qs('#e_spec').value; const ratio = qs('#e_ratio').value; const dur=qs('#e_dur').value.trim();
      cell.textContent = [spec, ratio].filter(Boolean).join(' · '); // 列表展示，不把时长塞进这个单元格
      // 同时把“时长”单元格也更新显示
      const durCell = cell.parentElement.querySelector('[data-field="duration"]');
      if(durCell) durCell.textContent = dur;
      inlineDialog.close();
    };
    return;
  }

  if(field==='schedule'){
    // 档期（合并）编辑
    const a0 = row.a_copy?fmtDate(row.a_copy):'', b0=row.b_copy?fmtDate(row.b_copy):'', f0=row.final_date?fmtDate(row.final_date):'';
    inlineContent.innerHTML = `
      <div class="grid three" style="padding:16px;">
        <label>A copy<input id="e_a" type="date" value="${a0}"></label>
        <label>B copy<input id="e_b" type="date" value="${b0}"></label>
        <label>Final<input id="e_f" type="date" value="${f0}"></label>
      </div>`;
    inlineDialog.showModal();
    inlineCancel.onclick = ()=> inlineDialog.close();
    inlineOk.onclick = ()=>{
      const a=qs('#e_a').value, b=qs('#e_b').value, f=qs('#e_f').value;
      cell.textContent = [a||'-', b||'-', f||'-'].join(' / ');
      inlineDialog.close();
    };
    return;
  }

  if(field==='final_link' || field==='title' || field==='brand' || field==='duration'){
    simpleInput('text', text); return;
  }

  // 其它默认文本
  simpleInput('text', text);
}

// 采集一行数据，合并列拆回字段
function collectRow(tr, origin){
  const get = key => (qs(`[data-field="${key}"]`, tr)?.textContent||'').trim();

  // 输出规格
  let spec = origin.spec, ratio = origin.ratio;
  const specRatio = get('spec_ratio');
  if(specRatio){
    const parts = specRatio.split('·').map(s=>s.trim());
    spec  = (parts[0]||'') || spec;
    ratio = (parts[1]||'') || ratio;
  }

  // 档期
  let a_copy = origin.a_copy, b_copy = origin.b_copy, final_date = origin.final_date;
  const sched = get('schedule');
  if(sched && sched.includes('/')){
    const [a,b,f] = sched.split('/').map(s=>s.trim());
    a_copy = a && a!=='-' ? a : a_copy;
    b_copy = b && b!=='-' ? b : b_copy;
    final_date = f && f!=='-' ? f : final_date;
  }

  // 金额：取前三段数值
  let quote_amount = origin.quote_amount, deposit_amount = origin.deposit_amount, paid_amount = origin.paid_amount;
  const amounts = get('amounts');
  if(amounts){
    const nums = amounts.replace(/[^\d./-]/g,'').split('/').map(s=>Number(s.trim())||0);
    if(nums.length>=3){ quote_amount=nums[0]; deposit_amount=nums[1]; paid_amount=nums[2]; }
  }

  // 支付状态：显示中文，需要映射回值
  const payStatusText = get('pay_status');
  const mapBack = { '未收':'unpaid', '已收定金':'deposit', '已收全款':'paid' };
  const pay_status = mapBack[payStatusText] || origin.pay_status || 'unpaid';

  return {
    title: get('title') || origin.title,
    brand: get('brand') || origin.brand,
    type:  get('type')  || origin.type,
    spec, ratio,
    duration: get('duration') || origin.duration,
    a_copy, b_copy, final_date,
    quote_amount, deposit_amount, paid_amount,
    currency: get('currency') || origin.currency,
    payment_due_date: get('payment_due_date') || origin.payment_due_date,
    pay_status,
    final_link: get('final_link') || origin.final_link,
  };
}

// ====== 档期 ======
async function loadCalendar(){
  const { data, error } = await db.from('projects').select('title,a_copy,b_copy,final_date,payment_due_date');
  if(error){ console.error(error); return; }
  const events = [];
  (data||[]).forEach(p=>{
    if(p.a_copy) events.push({date:p.a_copy, label:`A copy · ${p.title}`});
    if(p.b_copy) events.push({date:p.b_copy, label:`B copy · ${p.title}`});
    if(p.final_date)  events.push({date:p.final_date,  label:`Final · ${p.title}`});
    if(p.payment_due_date) events.push({date:p.payment_due_date, label:`应收款 · ${p.title}`});
  });
  events.sort((a,b)=> new Date(a.date)-new Date(b.date));
  calendarList.innerHTML = '';
  events.forEach(e=>{
    const row = document.createElement('div');
    row.className='item';
    row.innerHTML = `<div>${fmtDate(e.date)}</div><div>${e.label}</div>`;
    calendarList.appendChild(row);
  });
}

// ====== 作品合集（Final）======
async function loadCollection(){
  const { data, error } = await db.from('projects').select('id,title,brand,final_link,final_date').not('final_link','is',null);
  if(error){ console.error(error); return; }
  collectionGrid.innerHTML = '';
  (data||[]).forEach(p=>{
    const card = document.createElement('div');
    card.className='card video';
    card.innerHTML = `
      <div class="meta">
        <strong>${p.title||'-'}</strong> · ${p.brand||''}
        <div class="muted">${p.final_link||''}</div>
        <div class="muted">${p.final_date?('Final: '+fmtDate(p.final_date)):'未完结'}</div>
        ${p.final_link?`<div style="margin-top:6px;"><a target="_blank" href="${p.final_link}" class="btn ghost">打开链接</a></div>`:''}
      </div>`;
    collectionGrid.appendChild(card);
  });
}

// ====== 启动 ======
(async function boot(){
  const { data:{ user } } = await db.auth.getUser();
  if(user){
    userEmailEl.textContent = user.email||'';
    userBox.classList.remove('hidden');
    authView.classList.add('hidden');
    appView.classList.remove('hidden');
    setActiveTab('dashboard');
    await renderAll();
  }else{
    authView.classList.remove('hidden');
  }
})();
