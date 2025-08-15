// ====== 你的 Supabase 项目配置（已替你填好）======
const SUPABASE_URL = 'https://lywlcsrndkturdpgvvnc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d2xjc3JuZGt0dXJkcGd2dm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwOTg1NzUsImV4cCI6MjA3MDY3NDU3NX0.z49xmAaG1ciyMbGPPamoYfiAwFTP0PfX7__K3iRRkhs';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== DOM ======
const authView = qs('#authView');
const appView  = qs('#appView');
const userBox  = qs('#userBox');
const userEmailEl = qs('#userEmail');
const toastEl  = qs('#toast');

const tabs = $qa('.tab');
const panels = {
  dashboard: qs('#tab-dashboard'),
  projects:  qs('#tab-projects'),
  calendar:  qs('#tab-calendar'),
  collection: qs('#tab-collection'),
};

// Auth DOM
const btnLogin = qs('#btnLogin');
const btnToSignup = qs('#btnToSignup');
const btnCancelSignup = qs('#btnCancelSignup');
const signupPanel = qs('#signupPanel');
const btnSignup = qs('#btnSignup');
const btnSignOut = qs('#btnSignOut');

// KPI DOM
const kpiPaid = qs('#kpiPaid');
const kpiDue = qs('#kpiDue');
const kpiCount = qs('#kpiCount');
const recentList = qs('#recentList');

// Projects DOM
const btnNew = qs('#btnNew');
const tbodyProjects = qs('#tbodyProjects');
const dlgProject = qs('#dlgProject');
const frmProject = qs('#frmProject');
const dlgTitle = qs('#dlgTitle');

// Calendar & Collection
const calendarList = qs('#calendarList');
const collectionGrid = qs('#collectionGrid');

// Quote
const quoteForm = qs('#quoteForm');

// ====== 工具函数 ======
function qs(s, el=document){ return el.querySelector(s); }
function $qa(s, el=document){ return Array.from(el.querySelectorAll(s)); }
function toast(msg, type='info'){
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(()=>toastEl.classList.add('hidden'), 2000);
}
function fmtMoney(n, cur='CNY'){
  if(n==null) return '–';
  const v = Number(n)||0;
  return `${cur} ${v.toLocaleString()}`;
}
function fmtDate(d){
  if(!d) return '';
  return new Date(d).toISOString().slice(0,10);
}
function nonneg(n){ n = Number(n)||0; return Math.max(n,0); }

// ====== 登录/注册 ======
btnToSignup.addEventListener('click', ()=> signupPanel.classList.remove('hidden'));
btnCancelSignup.addEventListener('click', ()=> signupPanel.classList.add('hidden'));

btnSignup.addEventListener('click', async ()=>{
  const email = qs('#signupEmail').value.trim();
  const password = qs('#signupPassword').value;
  if(!email || !password){ toast('请填写邮箱与密码'); return; }
  const { data, error } = await client.auth.signUp({ email, password });
  if(error){
    // 如果用户已存在，直接提示去登录
    if(error.message?.toLowerCase().includes('already')){
      toast('该邮箱已注册，请直接登录');
    }else{
      toast('注册失败：'+error.message);
    }
    return;
  }
  toast('注册成功，已自动登录');
  // signUp 在关闭 Confirm email 时，会直接创建 session
  await afterAuthChanged();
});

btnLogin.addEventListener('click', async ()=>{
  const email = qs('#loginEmail').value.trim();
  const password = qs('#loginPassword').value;
  if(!email || !password){ toast('请填写邮箱与密码'); return; }
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if(error){ toast('登录失败：'+error.message); return; }
  toast('登录成功');
  await afterAuthChanged();
});

btnSignOut.addEventListener('click', async ()=>{
  await client.auth.signOut();
  toast('已退出');
  authView.classList.remove('hidden');
  appView.classList.add('hidden');
  userBox.classList.add('hidden');
});

// 监听登录态
client.auth.onAuthStateChange((_event, session)=> afterAuthChanged());

async function afterAuthChanged(){
  const { data: { user } } = await client.auth.getUser();
  if(!user){
    authView.classList.remove('hidden');
    appView.classList.add('hidden');
    userBox.classList.add('hidden');
    return;
  }
  // 登录态
  userEmailEl.textContent = user.email || '';
  userBox.classList.remove('hidden');
  authView.classList.add('hidden');
  appView.classList.remove('hidden');

  // 默认展示首页
  setActiveTab('dashboard');
  await renderAll();
}

// ====== Tabs ======
tabs.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    setActiveTab(btn.dataset.tab);
  });
});
function setActiveTab(name){
  tabs.forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  Object.entries(panels).forEach(([k,el])=>{
    el.classList.toggle('hidden', k!==name);
  });
  // 切换时刷新数据（轻量）
  if(name==='dashboard') loadDashboard();
  if(name==='projects')  loadProjects();
  if(name==='calendar')  loadCalendar();
  if(name==='collection') loadCollection();
}

async function renderAll(){
  await Promise.all([loadDashboard(), loadProjects(), loadCalendar(), loadCollection()]);
}

// ====== Dashboard ======
async function loadDashboard(){
  const { data, error } = await client.from('projects')
    .select('*')
    .order('updated_at', { ascending:false })
    .limit(50);
  if(error){ toast('读取项目失败：'+error.message); return; }

  // KPI
  let paidSum = 0, depositSum = 0, quoteSum = 0;
  let total = data.length, done = 0;
  for(const p of data){
    paidSum += Number(p.paid_amount||0);
    depositSum += Number(p.deposit_amount||0);
    quoteSum += Number(p.quote_amount||0);
    if(p.final_date) done++;
  }
  const outstanding = Math.max(quoteSum - paidSum - depositSum, 0);

  kpiPaid.textContent = fmtMoney(paidSum + depositSum);
  kpiDue.textContent  = fmtMoney(outstanding);
  kpiCount.textContent = `${done} / ${total}`;

  // 最近列表
  recentList.innerHTML = '';
  data.slice(0,8).forEach(p=>{
    const row = document.createElement('div');
    row.className='item';
    row.innerHTML = `
      <div class="badge-dot"><span class="dot" style="background:${p.final_date?'var(--ok)':'var(--warn)'}"></span>
      <strong>${p.title||'-'}</strong> · ${p.brand||''} · ${p.type||''}</div>
      <div>${p.final_date ? 'Final: '+fmtDate(p.final_date) : '未完成'}</div>`;
    recentList.appendChild(row);
  });
}

// 报价工具
quoteForm.addEventListener('submit', e=>{
  e.preventDefault();
  const base = Number(qs('#qBase').value)||0;
  const e1 = Number(qs('#qEdit').value)||0;
  const c1 = Number(qs('#qColor').value)||0;
  const m1 = Number(qs('#qMix').value)||0;
  const s1 = Number(qs('#qComp').value)||0;
  const revs = Number(qs('#qRevs').value)||0;

  // 粗略计算：各模块系数*(base/2) + 修订 10%/轮
  const core = (e1 + c1 + m1 + s1) * (base/2);
  const total = Math.round(core * (1 + 0.1*revs));
  qs('#qTotal').textContent = `CNY ${total.toLocaleString()}`;
});

// ====== 项目 CRUD ======
btnNew.addEventListener('click', ()=>{
  frmProject.reset();
  dlgTitle.textContent = '新建项目';
  dlgProject.showModal();
});

frmProject.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(frmProject);
  const payload = Object.fromEntries(fd.entries());
  // 转数字
  ['quote_amount','deposit_amount','paid_amount'].forEach(k=>payload[k] = Number(payload[k]||0));
  // pay_status 默认
  payload.pay_status ||= 'unpaid';
  // status 列（开合）沿用默认 open
  // 统一更新时间
  payload.updated_at = new Date().toISOString();

  const { error } = await client.from('projects').insert(payload);
  if(error){ toast('新建失败：'+error.message); return; }
  dlgProject.close();
  toast('已保存');
  await loadProjects();
  await loadDashboard();
  await loadCalendar();
  await loadCollection();
});

async function loadProjects(){
  const { data, error } = await client.from('projects').select('*').order('updated_at',{ascending:false});
  if(error){ toast('读取失败：'+error.message); return; }
  tbodyProjects.innerHTML = '';
  data.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      ${td('title', p.title)}
      ${td('brand', p.brand)}
      ${td('type', p.type)}
      ${td('spec', p.spec)}
      ${td('ratio', p.ratio)}
      ${td('duration', p.duration)}
      ${td('a_copy_date', fmtDate(p.a_copy_date), 'date')}
      ${td('b_copy_date', fmtDate(p.b_copy_date), 'date')}
      ${td('final_date', fmtDate(p.final_date), 'date')}
      ${td('quote_amount', p.quote_amount, 'number')}
      ${td('deposit_amount', p.deposit_amount, 'number')}
      ${td('paid_amount', p.paid_amount, 'number')}
      ${td('currency', p.currency)}
      ${td('payment_due_date', fmtDate(p.payment_due_date), 'date')}
      ${td('pay_status', p.pay_status)}
      ${td('final_link', p.final_link)}
      <td>
        <button class="btn ghost btn-save">保存</button>
        <button class="btn danger btn-del">删除</button>
      </td>`;
    // 可编辑
    $qa('[data-edit]', tr).forEach(cell=>{
      cell.addEventListener('dblclick', ()=>{
        cell.contentEditable = true;
        cell.classList.add('cell-edit');
        cell.focus();
      });
      cell.addEventListener('blur', ()=>{ cell.contentEditable=false; cell.classList.remove('cell-edit'); });
    });

    // 保存
    qs('.btn-save', tr).addEventListener('click', async ()=>{
      const payload = collectRow(tr);
      payload.updated_at = new Date().toISOString();
      const { error } = await client.from('projects').update(payload).eq('id', p.id);
      if(error){ toast('保存失败：'+error.message); return; }
      toast('已保存');
      await loadDashboard();
      await loadCalendar();
      await loadCollection();
    });
    // 删除
    qs('.btn-del', tr).addEventListener('click', async ()=>{
      if(!confirm('确定删除该项目？')) return;
      const { error } = await client.from('projects').delete().eq('id', p.id);
      if(error){ toast('删除失败：'+error.message); return; }
      tr.remove();
      toast('已删除');
      await loadDashboard();
      await loadCalendar();
      await loadCollection();
    });

    tbodyProjects.appendChild(tr);
  });
}
function td(field, val, type='text'){
  const display = (val==null||val==='') ? '' : (type==='number' ? Number(val) : val);
  return `<td data-field="${field}" data-edit>${display}</td>`;
}
function collectRow(tr){
  const cells = $qa('[data-field]', tr);
  const obj = {};
  cells.forEach(td=>{
    const key = td.dataset.field;
    let v = td.textContent.trim();
    if(['quote_amount','deposit_amount','paid_amount'].includes(key)) v = Number(v||0);
    if(['a_copy_date','b_copy_date','final_date','payment_due_date'].includes(key)) v = v || null;
    obj[key]=v;
  });
  return obj;
}

// ====== 档期 ======
async function loadCalendar(){
  const { data, error } = await client.from('projects').select('title,a_copy_date,b_copy_date,final_date,payment_due_date');
  if(error){ toast('读取档期失败：'+error.message); return; }
  const events = [];
  data.forEach(p=>{
    if(p.a_copy_date) events.push({date:p.a_copy_date, label:`A copy · ${p.title}`});
    if(p.b_copy_date) events.push({date:p.b_copy_date, label:`B copy · ${p.title}`});
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
  if(error){ toast('读取合集失败：'+error.message); return; }
  collectionGrid.innerHTML = '';
  data.forEach(p=>{
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
  const { data: { user } } = await client.auth.getUser();
  if(user){
    userEmailEl.textContent = user.email || '';
    userBox.classList.remove('hidden');
    authView.classList.add('hidden');
    appView.classList.remove('hidden');
    setActiveTab('dashboard');
    await renderAll();
  }else{
    authView.classList.remove('hidden');
  }
})();
