/* ========================================================
   剪辑师项目管理系统 · Life_HAN  — v0.3.1 (2025-08-16)
   - 基于 v0.3
   - 修复“未登录状态仍显示主界面”问题
   ======================================================== */

const supa = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

const views = {
  login   : document.getElementById('view-login'),
  home    : document.getElementById('view-home'),
  projects: document.getElementById('view-projects'),
  gallery : document.getElementById('view-gallery'),
  finance : document.getElementById('view-finance'),
};
const nav = {
  home    : document.getElementById('btn-home'),
  projects: document.getElementById('btn-projects'),
  schedule: document.getElementById('btn-schedule'),
  gallery : document.getElementById('btn-gallery'),
  finance : document.getElementById('btn-finance'),
  logout  : document.getElementById('btn-logout'),
};
function showView(name){
  Object.values(views).forEach(v=>v.classList.remove('active'));
  const target = views[name];
  if(target) target.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.removeAttribute('aria-current'));
  ({home:nav.home, projects:nav.projects, gallery:nav.gallery, finance:nav.finance}[name])
    ?.setAttribute('aria-current','page');
}

async function requireSignIn(){
  const { data: { session } } = await supa.auth.getSession();
  if(!session){
    Object.values(views).forEach(v=>v.classList.remove('active'));
    views.login.classList.add('active');
    return false;
  }
  return true;
}

nav.logout.addEventListener('click', async ()=>{
  await supa.auth.signOut();
  window.location.reload();
});

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
    e.preventDefault();
  }else{
    document.querySelectorAll('.select.open').forEach(s=>s.classList.remove('open'));
  }
});

let projects = [];
async function fetchProjects(){
  const { data, error } = await supa
    .from('projects')
    .select('id,title,type,spec,clips,producer_name,producer_contact,quote_amount,deposit_amount,paid_amount,notes,a_copy,b_copy,final_date,final_link,updated_at')
    .order('updated_at',{ ascending:false })
    .limit(300);
  if(error){ console.error(error); return; }
  projects = data || [];
}

const fmtMoney = n => `¥${(Number(n||0)).toLocaleString()}`;
function mergeTypeSpec(p){
  const t = p.type || '', s = p.spec || '';
  return (t && s) ? `${t} · ${s}` : (t || s || '—');
}
function payStatus(p){
  const un = Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0);
  if(un<=0) return '已结清';
  if(Number(p.deposit_amount||0)>0) return '已收定金';
  return '未收款';
}

function renderRecent(){
  const box = document.getElementById('recent-list');
  box.innerHTML = '';
  projects.slice(0,4).forEach(p=>{
    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML = `
      <div>
        <div><strong>${p.title||'未命名'}</strong> · ${p.producer_name||'—'}</div>
        <div class="pay-status">${payStatus(p)}</div>
      </div>
      <button class="btn-ghost" data-open="${p.id}">打开</button>
    `;
    box.appendChild(el);
  });
  box.addEventListener('click', (e)=>{
    const id = e.target.getAttribute('data-open');
    if(id){ showView('projects'); }
  });
}

function renderKpis(){
  const paid    = projects.reduce((s,p)=>s+Number(p.paid_amount||0),0);
  const deposit = projects.reduce((s,p)=>s+Number(p.deposit_amount||0),0);
  const unpaid  = projects.reduce((s,p)=>s + Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0)-Number(p.deposit_amount||0),0), 0);

  document.getElementById('kpi-paid').textContent    = fmtMoney(paid);
  document.getElementById('kpi-deposit').textContent = fmtMoney(deposit);
  document.getElementById('kpi-unpaid').textContent  = fmtMoney(unpaid);
}

function renderProjects(list=projects){
  const tb = document.getElementById('projects-body');
  tb.innerHTML = '';
  list.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.title||'未命名'}</strong></td>
      <td>${p.producer_name||''}</td>
      <td>${mergeTypeSpec(p)} · ${p.clips||1}条</td>
      <td class="pay-status">${payStatus(p)}</td>
      <td>报 ${fmtMoney(p.quote_amount)} / 定 ${fmtMoney(p.deposit_amount)} / 实 ${fmtMoney(p.paid_amount)}</td>
    `;
    tb.appendChild(tr);
  });
}

function renderGallery(){
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';
  const finals = projects.filter(p=>p.final_link);
  if(finals.length===0){
    grid.innerHTML = `<div class="poster"><div style="font-size:28px;color:#999;">暂未上传成片</div></div>`;
    return;
  }
  finals.forEach(p=>{
    const a = document.createElement('a');
    a.className='poster'; a.href=p.final_link; a.target='_blank';
    a.innerHTML = `<div class="caption">${p.title||''}</div>`;
    grid.appendChild(a);
  });
}

(async function boot(){
  const ok = await requireSignIn();
  if(!ok) return;
  await fetchProjects();
  renderKpis();
  renderRecent();
  renderProjects();
  renderGallery();
  showView('home');
})();
