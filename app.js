// ====== Supabase 配置（已替你填好）======
const SUPABASE_URL = 'https://lywlcsrndkturdpgvvnc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d2xjc3JuZGt0dXJkcGd2dm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwOTg1NzUsImV4cCI6MjA3MDY3NDU3NX0.z49xmAaG1ciyMbGPPamoYfiAwFTP0PfX7__K3iRRkhs';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== DOM & 小工具 ======
const qs = (s, el=document)=> el.querySelector(s);
const qsa = (s, el=document)=> Array.from(el.querySelectorAll(s));
const toastEl = qs('#toast');
function toast(m){ toastEl.textContent=m; toastEl.classList.remove('hidden'); setTimeout(()=>toastEl.classList.add('hidden'),1800); }
const fmtMoney = (n, cur='CNY') => `${cur} ${(Number(n)||0).toLocaleString()}`;
const fmtDate = d => d ? new Date(d).toISOString().slice(0,10) : '';
const sum = arr => arr.reduce((a,b)=> a + (Number(b)||0), 0);

// 视图
const authView = qs('#authView');
const appView  = qs('#appView');
const userBox  = qs('#userBox');
const userEmailEl = qs('#userEmail');

// Tabs
const tabs = qsa('.tab');
const panels = {
  dashboard: qs('#tab-dashboard'),
  projects:  qs('#tab-projects'),
  calendar:  qs('#tab-calendar'),
  collection: qs('#tab-collection'),
};

// KPI
const kpiPaid = qs('#kpiPaid');
const kpiDue  = qs('#kpiDue');
const kpiCount= qs('#kpiCount');
const recentList = qs('#recentList');

// Projects
const btnNew = qs('#btnNew');
const tbodyProjects = qs('#tbodyProjects');
const dlgProject = qs('#dlgProject');
const frmProject = qs('#frmProject');
const dlgTitle = qs('#dlgTitle');

// Calendar & Collection
const calendarList = qs('#calendarList');
const collectionGrid = qs('#collectionGrid');

// Quote
qs('#quoteForm').addEventListener('submit', e=>{
  e.preventDefault();
  const base = Number(qs('#qBase').value)||0;
  const e1 = Number(qs('#qEdit').value)||0;
  const c1 = Number(qs('#qColor').value)||0;
  const m1 = Number(qs('#qMix').value)||0;
  const s1 = Number(qs('#qComp').value)||0;
  const revs = Number(qs('#qRevs').value)||0;
  const core = (e1 + c1 + m1 + s1) * (base/2);
  const total = Math.round(core * (1 + 0.1*revs));
  qs('#qTotal').textContent = `CNY ${total.toLocaleString()}`;
});

// ====== 登录/注册 ======
qs('#btnToSignup').addEventListener('click', ()=> qs('#signupPanel').classList.remove('hidden'));
qs('#btnCancelSignup').addEventListener('click', ()=> qs('#signupPanel').classList.add('hidden'));
qs('#btnSignup').addEventListener('click', doSignup);
qs('#btnLogin').addEventListener('click', doLogin);
qs('#btnSignOut').addEventListener('click', async ()=>{ await client.auth.signOut(); location.reload(); });

client.auth.onAuthStateChange(()=> afterAuth());
afterAuth();

async function doSignup(){
  const email = qs('#signupEmail').value.trim();
  const password = qs('#signupPassword').value;
  if(!email || !password) return toast('请填写邮箱与密码');
  const { error } = await client.auth.signUp({ email, password });
  if(error){
    if((error.message||'').toLowerCase().includes('already')) return toast('该邮箱已注册，请直接登录');
    return toast('注册失败：'+error.message);
  }
  // 关闭 Confirm email 时通常会直接有 session；保险起见再尝试一次密码登录
  await client.auth.signInWithPassword({ email, password });
  toast('注册并登录成功');
  await afterAuth();
}

async function doLogin(){
  const email = qs('#loginEmail').value.trim();
  const password = qs('#loginPassword').value;
  if(!email || !password) return toast('请填写邮箱与密码');
  const { error } = await client.auth.signInWithPassword({ email, password });
  if(error) return toast('登录失败：'+error.message);
  toast('登录成功');
  await afterAuth();
}

async function afterAuth(){
  const { data:{ user } } = await client.auth.getUser();
  if(!user){
    authView.classList.remove('hidden');
    appView.classList.add('hidden');
    userBox.classList.add('hidden');
    return;
  }
  userEmailEl.textContent = user.email||'';
  userBox.classList.remove('hidden');
  authView.classList.add('hidden');
  appView.classList.remove('hidden');
  setActiveTab('dashboard');
  await renderAll();
}

// ====== Tabs ======
tabs.forEach(btn=>{
  btn.addEventListener('click', ()=> setActiveTab(btn.dataset.tab));
});
function setActiveTab(name){
  tabs.forEach(b=> b.classList.toggle('active', b.dataset.tab===name));
  Object.entries(panels).forEach(([k,el])=> el.classList.toggle('hidden', k!==name));
  if(name==='dashboard') loadDashboard();
  if(name==='projects')  loadProjects();
  if(name==='calendar')  loadCalendar();
  if(name==='collection')loadCollection();
}

async function renderAll(){
  await Promise.all([loadDashboard(), loadProjects(), loadCalendar(), loadCollection()]);
}

// ====== Dashboard ======
async function loadDashboard(){
  const { data, error } = await client.from('projects').select('*').order('updated_at',{ascending:false}).limit(100);
  if(error){ console.error(error); return; }

  const paidSum = sum((data||[]).map(p=> (p.paid_amount||0) + (p.deposit_amount||0)));
  const dueSum  = sum((data||[]).map(p=> Math.max((p.quote_amount||0) - (p.deposit_amount||0) - (p.paid_amount||0), 0)));
  const total   = (data||[]).length;
  const done    = (data||[]).filter(p=> p.final_date || p.status==='done').length;

  kpiPaid.textContent  = fmtMoney(paidSum);
  kpiDue.textContent   = fmtMoney(dueSum);
  kpiCount.textContent = `${done} / ${total}`;

  recentList.innerHTML = '';
  (data||[]).slice(0,8).forEach(p=>{
    const row = document.createElement('div');
    row.className='item';
    row.innerHTML = `
      <div class="badge-dot"><span class="dot" style="background:${p.final_date?'var(--ok)':'var(--warn)'}"></span>
      <strong>${p.title||'-'}</strong> · ${p.brand||''} · ${p.type||''}</div>
      <div>${p.final_date ? 'Final: '+fmtDate(p.final_date) : '未完成'}</div>`;
    recentList.appendChild(row);
  });
}

// ====== 新建/编辑 项目 ======
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

  const { error } = await client.from('projects').insert(p);
  if(error){ toast('新建失败：'+error.message); return; }
  dlgProject.close(); toast('已保存');
  await loadProjects(); await loadDashboard(); await loadCalendar(); await loadCollection();
});

// 更新“合并控件”的摘要文字
qsa('[name="spec"],[name="ratio"]').forEach(el=> el.addEventListener('change', ()=>{
  const spec = qs('[name="spec"]').value || '';
  const ratio= qs('[name="ratio"]').value || '';
  const dur  = qs('[name="duration"]').value || '';
  const parts = [spec, ratio].filter(Boolean).join(' · ');
  qs('#specSummary').textContent = '输出规格：' + (parts || '点击选择') + (dur?` · ${dur}`:'');
}));
qs('[name="duration"]').addEventListener('input', ()=>{
  const spec = qs('[name="spec"]').value || '';
  const ratio= qs('[name="ratio"]').value || '';
  const dur  = qs('[name="duration"]').value || '';
  const parts = [spec, ratio].filter(Boolean).join(' · ');
  qs('#specSummary').textContent = '输出规格：' + (parts || '点击选择') + (dur?` · ${dur}`:'');
});
qsa('[name="a_copy"],[name="b_copy"],[name="final_date"]').forEach(el=> el.addEventListener('change', ()=>{
  const a = fmtDate(qs('[name="a_copy"]').value);
  const b = fmtDate(qs('[name="b_copy"]').value);
  const f = fmtDate(qs('[name="final_date"]').value);
  qs('#scheduleSummary').textContent = '档期：' + [a||'-', b||'-', f||'-'].join(' / ');
}));

// ====== 列表 CRUD ======
async function loadProjects(){
  const { data, error } = await client.from('projects').select('*').order('updated_at',{ascending:false});
  if(error){ toast('读取失败：'+error.message); return; }
  tbodyProjects.innerHTML = '';
  (data||[]).forEach(p=>{
    const specView  = [p.spec||'', p.ratio||''].filter(Boolean).join(' · ');
    const schedule  = [fmtDate(p.a_copy), fmtDate(p.b_copy), fmtDate(p.final_date)].map(x=>x||'-').join(' / ');
    const q = Number(p.quote_amount||0), d=Number(p.deposit_amount||0), pa=Number(p.paid_amount||0);
    const u = Math.max(q - d - pa, 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      ${td('title', p.title)}
      ${td('brand', p.brand)}
      ${td('type', p.type)}
      ${td('spec_ratio', specView)}         <!-- 展示合并，但编辑时可直接改单元格文字或用弹窗新建 -->
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

    // 双击可编辑（针对基础字段）
    qsa('[data-edit]', tr).forEach(cell=>{
      cell.addEventListener('dblclick', ()=>{
        cell.contentEditable = true;
        cell.classList.add('cell-edit');
        cell.focus();
      });
      cell.addEventListener('blur', ()=>{ cell.contentEditable=false; cell.classList.remove('cell-edit'); });
    });

    // 保存：把合并展示的列拆回字段
    qs('.btn-save', tr).addEventListener('click', async ()=>{
      const payload = collectRow(tr, p);
      payload.updated_at = new Date().toISOString();
      const { error } = await client.from('projects').update(payload).eq('id', p.id);
      if(error){ toast('保存失败：'+error.message); return; }
      toast('已保存');
      await loadDashboard(); await loadCalendar(); await loadCollection();
    });

    // 删除
    qs('.btn-del', tr).addEventListener('click', async ()=>{
      if(!confirm('确定删除该项目？')) return;
      const { error } = await client.from('projects').delete().eq('id', p.id);
      if(error){ toast('删除失败：'+error.message); return; }
      tr.remove(); toast('已删除');
      await loadDashboard(); await loadCalendar(); await loadCollection();
    });

    tbodyProjects.appendChild(tr);
  });
}

function td(field, val){
  return `<td data-field="${field}" data-edit>${val==null?'':val}</td>`;
}

// 把表格行的文本收集为更新 payload（把合并列拆回 spec/ratio、a/b/final）
function collectRow(tr, origin){
  const get = key => (qs(`[data-field="${key}"]`, tr)?.textContent||'').trim();

  // 拆输出规格列：如 "4K · 16:9"
  let spec = origin.spec, ratio = origin.ratio;
  const specRatio = get('spec_ratio');
  if(specRatio){
    const parts = specRatio.split('·').map(s=>s.trim());
    spec  = (parts[0]||'').replace(/\s+$/,'') || spec;
    ratio = (parts[1]||'').replace(/^\s+/,'') || ratio;
  }

  // 拆档期列：如 "2025-08-01 / 2025-08-05 / 2025-08-10"
  let a_copy = origin.a_copy, b_copy = origin.b_copy, final_date = origin.final_date;
  const sched = get('schedule');
  if(sched && sched.includes('/')){
    const [a,b,f] = sched.split('/').map(s=>s.trim());
    a_copy = a && a!=='-' ? a : a_copy;
    b_copy = b && b!=='-' ? b : b_copy;
    final_date = f && f!=='-' ? f : final_date;
  }

  // 金额列：允许直接改数字（格式：¥q / ¥d / ¥p / ¥u），只回写前三个
  let quote_amount = origin.quote_amount, deposit_amount = origin.deposit_amount, paid_amount = origin.paid_amount;
  const amounts = get('amounts');
  if(amounts){
    const nums = amounts.replace(/[^\d./-]/g,'').split('/').map(s=>Number(s.trim())||0);
    if(nums.length>=3){ quote_amount=nums[0]; deposit_amount=nums[1]; paid_amount=nums[2]; }
  }

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
    pay_status: get('pay_status') || origin.pay_status,
    final_link: get('final_link') || origin.final_link,
  };
}

// ====== 档期 ======
async function loadCalendar(){
  const { data, error } = await client.from('projects').select('title,a_copy,b_copy,final_date,payment_due_date');
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
  const { data, error } = await client.from('projects').select('title,brand,final_link,final_date').not('final_link','is',null);
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
  const { data:{ user } } = await client.auth.getUser();
  if(user){
    qs('#userEmail').textContent = user.email||'';
    userBox.classList.remove('hidden');
    authView.classList.add('hidden');
    appView.classList.remove('hidden');
    setActiveTab('dashboard');
    await renderAll();
  }else{
    authView.classList.remove('hidden');
  }
})();
