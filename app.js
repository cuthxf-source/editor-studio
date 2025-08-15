/***********************
 * Cache & Auth Hardening
 * - 自动清缓存（按版本）
 * - 稳定的 Supabase 会话持久化
 * - 失效自动刷新/登出处理
 ***********************/

// 1) 每次上线改版本号（任意字符串都行）
const APP_VERSION = '1.0.1';

// 2) 版本不一致 → 自动清缓存并强制刷新
(function ensureFreshAssets() {
  try {
    const stored = localStorage.getItem('app_version');
    if (stored !== APP_VERSION) {
      // 清 local/session
      localStorage.clear();
      sessionStorage.clear();

      // 清 Supabase 的 IndexedDB（不同浏览器实现名可能不同，两个都试）
      if (window.indexedDB) {
        try { indexedDB.deleteDatabase('supabase-auth-db'); } catch (e) {}
        try { indexedDB.deleteDatabase('SupabaseAuth'); } catch (e) {}
      }

      // 记录当前版本并强制刷新一次
      localStorage.setItem('app_version', APP_VERSION);
      // 避免缓存的 JS/CSS，被动 bust 一下
      location.replace(location.pathname + '?v=' + encodeURIComponent(APP_VERSION));
      // 注意：这里 return 后，后续初始化不会执行，刷新后会执行最新代码
      return;
    }
  } catch (e) {
    // 私有模式等异常时，尽量不中断
    console.warn('version-check failed:', e);
  }
})();

// 3) Supabase 初始化（使用你的项目 URL & 匿名 KEY）
const SUPABASE_URL = 'https://lywlcsrndkturdpgvvnc.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d2xjc3JuZGt0dXJkcGd2dm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwOTg1NzUsImV4cCI6MjA3MDY3NDU3NX0.z49xmAaG1ciyMbGPPamoYfiAwFTP0PfX7__K3iRRkhs';

// 如果你项目里已全局引入 @supabase/supabase-js 的 UMD 版本：window.supabase
//（GitHub Pages 静态页一般是 <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>）
const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,         // 持久化会话
    autoRefreshToken: true,       // 自动刷新 token
    detectSessionInUrl: true      // 兼容 OAuth（虽然我们当前不用）
  },
  global: { headers: { 'x-app-version': APP_VERSION } }
});

// 4) 统一的会话状态监听，自动恢复/失效处理
if (supabase?.auth) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    // 可选：调试
    console.log('[auth]', event, session);

    switch (event) {
      case 'SIGNED_IN':
      case 'TOKEN_REFRESHED':
      case 'USER_UPDATED':
        // 会话有效，继续渲染应用（如果你用路由，这里可恢复到应用页）
        break;

      case 'SIGNED_OUT':
      case 'USER_DELETED':
      case 'PASSWORD_RECOVERY':
      case 'MFA_CHALLENGE_VERIFIED':
        // 清理残留并回到登录页（按你的页面结构调整）
        try {
          localStorage.removeItem('sb-' + SUPABASE_URL + '-auth-token');
        } catch (e) {}
        // 可视情况刷新或跳转：
        // location.replace('/');  // 如果首页是登录页
        break;

      case 'INITIAL_SESSION':
      default:
        // 初次加载：如果 session 为空，可决定是否跳转到登录页
        // if (!session) location.replace('/');
        break;
    }
  });
}

// 5) 你的其余应用代码从这里继续（渲染 UI、绑定事件等）
// …………………………………………
/* ============== Supabase 初始化（保持会话 & 自动刷新） ============== */
const supa = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

/* ============== 视图切换 ============== */
const views = {
  home: document.getElementById('view-home'),
  projects: document.getElementById('view-projects'),
  gallery: document.getElementById('view-gallery'),
  finance: document.getElementById('view-finance'),
};
const nav = {
  home: document.getElementById('btn-home'),
  projects: document.getElementById('btn-projects'),
  schedule: document.getElementById('btn-schedule'),
  gallery: document.getElementById('btn-gallery'),
  finance: document.getElementById('btn-finance'),
  logout: document.getElementById('btn-logout'),
};
function showView(name){
  Object.values(views).forEach(v=>v.classList.remove('active'));
  views[name].classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.removeAttribute('aria-current'));
  ({home:nav.home, projects:nav.projects, gallery:nav.gallery, finance:nav.finance}[name])?.setAttribute('aria-current','page');
}

/* ============== 登录校验 ============== */
async function requireSignIn(){
  const { data: { session } } = await supa.auth.getSession();
  if(!session){ /* 未登录就停留在首页，或引导到你登录页逻辑 */ }
}
nav.logout.addEventListener('click', async ()=>{
  await supa.auth.signOut();
  window.location.reload();
});

/* ============== 自定义下拉 - 修复“瞬间消失” ============== */
document.addEventListener('mousedown', (e)=>{
  const sel = e.target.closest('[data-select]');
  if(e.target.matches('[data-select-toggle]')){
    e.preventDefault();
    const box = e.target.closest('[data-select]');
    document.querySelectorAll('.select.open').forEach(s=>s!==box&&s.classList.remove('open'));
    box.classList.toggle('open');
    return;
  }
  if(sel && e.target.closest('.select-menu')){
    e.preventDefault(); // 阻止失焦导致的瞬间收起
  }else{
    document.querySelectorAll('.select.open').forEach(s=>s.classList.remove('open'));
  }
});

/* ============== 数据读取 ============== */
let projects = [];
async function fetchProjects(){
  // 注意字段名：使用 a_copy / b_copy / final_date（与你库中一致）
  const { data, error } = await supa
    .from('projects')
    .select('id,title,brand,type,spec,clips,notes,pay_status,quote_amount,deposit_amount,paid_amount,producer_name,producer_contact,a_copy,b_copy,final_date,final_link,updated_at')
    .order('updated_at',{ ascending:false })
    .limit(300);
  if(error){ console.error(error); return; }
  projects = data || [];
}

/* ============== 工具 ============== */
function fmtMoney(n){ return `¥${(Number(n||0)).toLocaleString()}`; }
function mergeTypeSpec(p){
  const t = p.type || '';
  const s = p.spec || '';
  return (t && s) ? `${t} · ${s}` : (t||s||'—');
}
function payStatus(p){
  const un = Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0);
  if(un<=0) return '已结清';
  if(Number(p.deposit_amount||0)>0) return '已收定金';
  return '未收款';
}

/* ============== 首页渲染 ============== */
function renderRecent(){
  const box = document.getElementById('recent-list');
  box.innerHTML = '';
  projects.slice(0,6).forEach(p=>{
    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML = `
      <div>
        <div><strong>${p.title||'未命名'}</strong> · ${p.brand||''}</div>
        <div class="pay-status">${payStatus(p)}</div>
      </div>
      <button class="btn-ghost" data-open="${p.id}">打开</button>
    `;
    box.appendChild(el);
  });
  box.addEventListener('click', (e)=>{
    const id = e.target.getAttribute('data-open');
    if(id){ showView('projects'); /* 可拓展：滚动定位到该行 */ }
  });
}
function renderKpis(){
  const paid = projects.reduce((s,p)=>s+Number(p.paid_amount||0),0);
  const dep  = projects.reduce((s,p)=>s+Number(p.deposit_amount||0),0);
  const unpaid = projects.reduce((s,p)=>s + Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0), 0);
  document.getElementById('kpi-paid').textContent    = fmtMoney(paid);
  document.getElementById('kpi-deposit').textContent = fmtMoney(dep);
  document.getElementById('kpi-unpaid').textContent  = fmtMoney(unpaid);
  // 财务页同步
  document.getElementById('f-paid').textContent    = fmtMoney(paid);
  document.getElementById('f-deposit').textContent = fmtMoney(dep);
  document.getElementById('f-unpaid').textContent  = fmtMoney(unpaid);
  document.getElementById('finance-list').innerHTML = projects.map(p=>{
    const un = Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0);
    return `<div class="list-item">
      <div><strong>${p.title||'未命名'}</strong> · ${p.brand||''}</div>
      <div class="pay-status">报 ${fmtMoney(p.quote_amount)} / 定 ${fmtMoney(p.deposit_amount)} / 实 ${fmtMoney(p.paid_amount)} / 未收 ${fmtMoney(un)}</div>
    </div>`;
  }).join('');
}

/* ============== 项目列表（桌面表格 + 小屏卡片） ============== */
function renderProjects(list = projects){
  const tb = document.getElementById('projects-body');
  const wrap = document.getElementById('projects-wrap');
  tb.innerHTML = '';

  list.forEach(p=>{
    const chips = [];
    if(p.a_copy || p.b_copy){ chips.push(`<span class="chip chip-a">A/B</span>`); }
    if(p.final_date){ chips.push(`<span class="chip chip-final">Final</span>`); }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.title||'未命名'}</strong></td>
      <td>${p.brand||''}</td>
      <td>${mergeTypeSpec(p)}</td>
      <td>${p.clips||1}</td>
      <td><div class="chips">${chips.join('')}</div></td>
      <td class="pay-status">${payStatus(p)}</td>
      <td>报 ${fmtMoney(p.quote_amount)} / 定 ${fmtMoney(p.deposit_amount)} / 实 ${fmtMoney(p.paid_amount)}</td>
      <td class="producer">${p.producer_name||''}${p.producer_contact?` · ${p.producer_contact}`:''}</td>
      <td>${p.notes||''}</td>
    `;
    tb.appendChild(tr);
  });

  // 小屏卡片（避免左右拖动）
  if(wrap.querySelector('#m-rows')) wrap.querySelector('#m-rows').remove();
  const mob = document.createElement('div'); mob.id='m-rows';
  list.forEach(p=>{
    const un = Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0);
    const chips = [];
    if(p.a_copy || p.b_copy){ chips.push(`<span class="chip chip-a">A/B</span>`); }
    if(p.final_date){ chips.push(`<span class="chip chip-final">Final</span>`); }
    const el = document.createElement('div');
    el.className='card-row';
    el.innerHTML = `
      <div class="row-top">
        <div><strong>${p.title||'未命名'}</strong> · ${p.brand||''}</div>
        <div class="chips">${chips.join('')}</div>
      </div>
      <div class="row-meta">
        <div>类型&规格：${mergeTypeSpec(p)} · 影片条数 ${p.clips||1}</div>
        <div>合作制片：${p.producer_name||''}${p.producer_contact?` · ${p.producer_contact}`:''}</div>
        <div>财务：报 ${fmtMoney(p.quote_amount)} / 定 ${fmtMoney(p.deposit_amount)} / 实 ${fmtMoney(p.paid_amount)} / 未收 ${fmtMoney(un)}</div>
      </div>
    `;
    mob.appendChild(el);
  });
  wrap.appendChild(mob);
}

/* 过滤：类型&规格 + 支付状态 */
document.querySelectorAll('.select-menu button[data-type]').forEach(b=>{
  b.addEventListener('mousedown', ()=>{
    const val = b.getAttribute('data-type');
    if(!val) return renderProjects(projects);
    const [t,s] = val.split('@');
    renderProjects(projects.filter(p=>p.type===t && p.spec===s));
  });
});
document.querySelectorAll('.select-menu button[data-pay]').forEach(b=>{
  b.addEventListener('mousedown', ()=>{
    const val = b.getAttribute('data-pay');
    if(!val) return renderProjects(projects);
    const filtered = projects.filter(p=>{
      const st = payStatus(p);
      if(val==='paid') return st==='已结清';
      if(val==='deposit') return st==='已收定金';
      if(val==='unpaid') return st==='未收款';
      return true;
    });
    renderProjects(filtered);
  });
});

/* ============== 作品合集（海报式；空态大字） ============== */
function renderGallery(){
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';
  const finals = projects.filter(p=>p.final_link);
  if(finals.length===0){
    const ph = document.createElement('div');
    ph.className='poster';
    ph.innerHTML = `<div style="font-size:28px;color:#999;">暂未上传成片，请在项目中填写 Final 链接</div>`;
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

/* ============== 档期（日历模态；沿用“档期”按钮） ============== */
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
  const first = new Date(y,m,1); const start = (first.getDay()+6)%7;
  const days = new Date(y,m+1,0).getDate();

  // 收集当月事件：A/B/Final
  const evs = {};
  projects.forEach(p=>{
    [['a_copy','ab'],['b_copy','ab'],['final_date','final']].forEach(([field,tag])=>{
      const v = p[field]; if(!v) return;
      const d = new Date(v); if(d.getFullYear()!==y || d.getMonth()!==m) return;
      const k = d.getDate();
      (evs[k] ||= []).push({ tag, text: tag==='final' ? `${p.title||'未命名'} · Final` : `${p.title||'未命名'} · A/B` });
    });
  });

  const total = 42;
  for(let i=0;i<total;i++){
    const cell = document.createElement('div'); cell.className='cal-cell';
    const day = i - start + 1;
    if(day>0 && day<=days){
      const dEl = document.createElement('div'); dEl.className='cal-day'; dEl.textContent=String(day); cell.appendChild(dEl);
      (evs[day]||[]).forEach(e=>{
        const tag = document.createElement('span');
        tag.className = 'ev ' + (e.tag==='final' ? 'ev-final' : 'ev-ab');
        tag.textContent = e.text;
        cell.appendChild(tag);
      });
    }
    gridEl.appendChild(cell);
  }
}

/* ============== 计算器（前端计算） ============== */
document.getElementById('calc-form').addEventListener('submit',(e)=>{
  e.preventDefault();
  const q = parseFloat(document.getElementById('quote').value||0);
  const d = parseFloat(document.getElementById('deposit').value||0);
  const p = parseFloat(document.getElementById('paid').value||0);
  const unpaid = Math.max(q - d - p, 0);
  document.getElementById('calc-result').textContent = `未收款：${fmtMoney(unpaid)}`;
});

/* ============== 导航 ============== */
document.getElementById('go-list').addEventListener('click', ()=> showView('projects'));
nav.home.addEventListener('click', ()=> showView('home'));
nav.projects.addEventListener('click', ()=> showView('projects'));
nav.gallery.addEventListener('click', ()=> showView('gallery'));
nav.finance.addEventListener('click', ()=> showView('finance'));

/* ============== 启动 ============== */
(async function boot(){
  await requireSignIn();
  await fetchProjects();
  renderRecent();
  renderKpis();
  renderProjects();
  renderGallery();
  showView('home');
})();
