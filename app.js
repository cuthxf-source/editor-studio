/* editor-studio / app.js  v1.6 */

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
    .select(`id,title,brand,type,spec,clips,notes,meta_json,pay_status,quote_amount,deposit_amount,paid_amount,producer_name,producer_contact,final_link,updated_at`)
    .order('updated_at',{ ascending:false })
    .limit(1000);
  if(error){ console.error(error); return; }
  projects = data || [];
}

// ============== 工具 ==============
const money = n => `¥${(Number(n||0)).toLocaleString()}`;
const fmt = (d)=> d? new Date(d): null;
const pad2 = (n)=> String(n).padStart(2,'0');

function parseSpecLegacy(specStr){
  const raw = (specStr||'').split('·').map(s=>s.trim());
  let res = raw[0] || '';
  let ratio = raw[1] || '';
  if(!ratio && res.includes(':')){ ratio=res; res=''; }
  return { res, ratio };
}
function parsePackages(p){
  const s = p.spec || '';
  try{
    const arr = JSON.parse(s);
    if(Array.isArray(arr)) return arr.map(x=>({
      type: x.type||'',
      clips: Number(x.clips||0),
      res: x.res||'',
      ratios: Array.isArray(x.ratios)? x.ratios.filter(Boolean) : []
    }));
  }catch(e){}
  const {res, ratio} = parseSpecLegacy(s);
  return [{ type: p.type||'', clips: Number(p.clips||1), res: res||'', ratios: ratio? [ratio] : [] }];
}
function mergeTypeSpec(p){
  const packs = parsePackages(p);
  return packs.map(pk=>{
    const left = `${pk.type||'未设'}×${pk.clips||1}`;
    const right = [pk.res, (pk.ratios||[]).join(',')].filter(Boolean).join(' · ');
    return [left, right].filter(Boolean).join(' · ');
  }).join(' ｜ ');
}
function totalClips(p){
  return parsePackages(p).reduce((s,x)=> s + Number(x.clips||0), 0) || Number(p.clips||0) || 1;
}

/** 进度与修改（使用 meta_json） */
function defaultMeta(){ return { prog:{ A:{date:null,ver:'v1',done:false}, B:{date:null,ver:'v1',done:false}, F:{date:null,ver:'v1',done:false} }, rev:[] }; }
function readMeta(row){
  return (row.meta_json && typeof row.meta_json === 'object')
    ? JSON.parse(JSON.stringify(row.meta_json))
    : defaultMeta();
}
function saveMetaPatch(row, patch){
  const meta = readMeta(row);
  // 深合并（仅 A/B/F 或 rev）
  if(patch.prog){
    ['A','B','F'].forEach(k=>{
      meta.prog[k] = { ...(meta.prog[k]||{}), ...(patch.prog[k]||{}) };
    });
  }
  if(Array.isArray(patch.rev)){
    meta.rev = patch.rev;
  }
  return meta;
}

/** 未收款：总金额 - 已收款（注意：已收款=paid_amount，不含定金） */
function unpaidAmtByRule(p){
  const total = Number(p.quote_amount||0);
  const paid  = Number(p.paid_amount||0);
  return Math.max(total - paid, 0);
}

/** 最近未完成的里程碑（按 A→B→F 的日期排序，返回一个） */
function upcomingMilestone(p){
  const meta = readMeta(p);
  const today = new Date(); today.setHours(0,0,0,0);

  // 完结（Final done 或支付已收尾款）
  if((meta.prog?.F?.done) || p.pay_status==='已收尾款'){
    return { label:'完结', ver:null, date:null, overdue:false, complete:true, text:'完结' };
  }

  const items = [];
  const push = (obj,label)=>{ if(obj?.date && !obj?.done) items.push({label, ver:obj.ver||'v1', date:fmt(obj.date)}); };
  push(meta.prog?.A,'Acopy');
  push(meta.prog?.B,'Bcopy');
  push(meta.prog?.F,'Final');

  if(items.length===0) return { label:'—', ver:null, date:null, overdue:false, complete:false, text:'—' };

  items.sort((a,b)=> a.date - b.date);
  const n = items[0];
  const overdue = n.date < today;
  const mmdd = `${pad2(n.date.getMonth()+1)}-${pad2(n.date.getDate())}`;
  return { ...n, overdue, complete:false, text:`${n.label}-${n.ver}-${mmdd}` };
}

function payBadgePill(st){
  if(st==='已收尾款') return `<span class="pill pill-purple">完结</span>`;
  if(st==='已收定金') return `<span class="pill pill-green">已收定金</span>`;
  return `<span class="pill pill-blue">未收款</span>`;
}

// ============== 首页 ==============
function renderRecent(){
  const box = document.getElementById('recent-list'); box.innerHTML='';

  // 过滤完结
  const active = projects.filter(p=>{
    const meta = readMeta(p);
    return !(meta.prog?.F?.done || p.pay_status==='已收尾款');
  });

  const sorted = [...active].sort((a,b)=>{
    const ka = upcomingMilestone(a);
    const kb = upcomingMilestone(b);
    // 未有日期放后
    if(!ka.date && kb.date) return 1;
    if(ka.date && !kb.date) return -1;
    if(!ka.date && !kb.date) return 0;
    return ka.date - kb.date;
  });

  sorted.slice(0,4).forEach(p=>{
    const near = upcomingMilestone(p);
    const currentPay = p.pay_status || (unpaidAmtByRule(p)<=0 ? '已收尾款' : (Number(p.deposit_amount||0)>0?'已收定金':'未收款'));
    const li = document.createElement('div'); li.className='list-item';
    li.innerHTML = `
      <div class="title-block">
        <div><strong>${p.title||'未命名'}</strong>${p.brand?` · ${p.brand}`:''}</div>
        <div class="muted small">合作制片：${[p.producer_name,p.producer_contact].filter(Boolean).join(' · ')||'—'}</div>
      </div>
      <div class="muted small">条数：${totalClips(p)||1}</div>
      <div>${payBadgePill(currentPay)}</div>
      <div class="${near.complete?'pill pill-purple':(near.overdue?'pill pill-red':'pill')}">${near.text}</div>
    `;
    box.appendChild(li);
  });
  box.onclick = ()=> showView('projects');
}

function renderKpis(){
  const total   = projects.reduce((s,p)=>s+Number(p.quote_amount||0),0);
  const paid    = projects.reduce((s,p)=>s+Number(p.paid_amount||0),0);
  const unpaid  = Math.max(total - paid, 0); // 修正：未收款=总金额-已收款

  // 首页
  document.getElementById('kpi-total').textContent   = money(total);
  document.getElementById('kpi-paid').textContent    = money(paid);
  document.getElementById('kpi-unpaid').textContent  = money(unpaid);

  // 财务页
  document.getElementById('f-total').textContent     = money(total);
  document.getElementById('f-paid').textContent      = money(paid);
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
    const baseDef = typeBase[elType.value] || {price:0, baseSec:0, secRate:0};
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

// ============== 通用编辑模态（producer/spec/progress/pay/money/revision） ==============
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

const TYPE_OPTS = ['LookBook','形象片','TVC','纪录片','微电影'];
const RES_OPTS  = ['1080p','4k'];
const RATIO_OPTS= ['16:9','9:16','1:1','4:3','3:4'];
const VERS      = ['v1','v2','v3','v4','v5','v6','v7','v8'];

function packRowHtml(i, pack){
  const ratios = RATIO_OPTS.map(r=>{
    const on = (pack.ratios||[]).includes(r);
    return `<label class="small"><input type="checkbox" name="ratio-${i}" value="${r}" ${on?'checked':''}> ${r}</label>`;
  }).join(' ');
  return `
  <div class="pack row" data-i="${i}" style="display:grid;grid-template-columns:1fr 140px 140px 1fr auto;gap:10px;align-items:end;margin-bottom:8px">
    <label>类型<select name="type-${i}">${optionList(TYPE_OPTS, pack.type||'')}</select></label>
    <label>影片条数<input name="clips-${i}" type="number" min="1" value="${pack.clips||1}"></label>
    <label>分辨率<select name="res-${i}">${optionList(RES_OPTS, pack.res||'')}</select></label>
    <div><div class="muted small" style="margin-bottom:6px">画幅比例（多选）</div><div class="ratio-group" style="display:flex;gap:8px;flex-wrap:wrap">${ratios}</div></div>
    <button class="ghost del-pack" type="button">删除</button>
  </div>`;
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
    editorTitle.textContent = '编辑 影片类型 & 条数 & 规格（多组合）';
    const packs = parsePackages(p);
    const packHtml = packs.map((pk,i)=> packRowHtml(i, pk)).join('');
    editorForm.innerHTML = `
      <div id="packs">${packHtml}</div>
      <div class="actions" style="display:flex;gap:8px;margin-top:8px">
        <button class="btn-ghost" type="button" id="add-pack">+ 添加一组</button>
      </div>
    `;
    editorForm.querySelector('#add-pack')?.addEventListener('click', ()=>{
      const i = editorForm.querySelectorAll('.pack').length;
      document.getElementById('packs').insertAdjacentHTML('beforeend', packRowHtml(i, {type:'',clips:1,res:'1080p',ratios:[]}));
    });
    editorForm.addEventListener('click',(e)=>{
      const btn = e.target.closest('.del-pack'); if(!btn) return;
      btn.closest('.pack')?.remove();
    });
  }

  if(kind==='progress'){
    editorTitle.textContent = '编辑 进度（日期 / 小版本 / 完成）';
    const meta = readMeta(p);
    const block = (label,key,obj)=>`
      <div class="grid-3" style="align-items:end">
        <label>${label} 日期<input type="date" name="${key}_date" value="${obj?.date||''}"></label>
        <label>小版本<select name="${key}_ver">${optionList(VERS, obj?.ver||'v1')}</select></label>
        <div style="display:flex;align-items:end;gap:10px">
          <button type="button" class="toggle-pill ${obj?.done?'on':''}" data-done="${key}">完成</button>
        </div>
      </div>`;
    editorForm.innerHTML = block('Acopy','A',meta.prog?.A||{}) + block('Bcopy','B',meta.prog?.B||{}) + block('Final','F',meta.prog?.F||{});

    // 切换完成状态
    editorForm.addEventListener('click',(e)=>{
      const btn = e.target.closest('.toggle-pill'); if(!btn) return;
      btn.classList.toggle('on');
    });
  }

  if(kind==='pay'){
    editorTitle.textContent = '编辑 支付状态';
    const current = p.pay_status || (unpaidAmtByRule(p)<=0 ? '已收尾款' : (Number(p.deposit_amount||0)>0?'已收定金':'未收款'));
    editorForm.innerHTML = `
      <div class="grid-1">
        <label>支付状态
          <select name="pay_status">
            ${optionList(['未收款','已收定金','已收尾款'], current)}
          </select>
        </label>
      </div>
    `;
  }

  if(kind==='money'){
    editorTitle.textContent = '编辑 总金额 / 已收款';
    editorForm.innerHTML = `
      <div class="grid-2">
        <label>总金额（报价总额）<input name="quote_amount" type="number" min="0" step="0.01" value="${p.quote_amount||0}"></label>
        <label>已收金额<input name="paid_amount" type="number" min="0" step="0.01" value="${p.paid_amount||0}"></label>
      </div>
    `;
  }

  if(kind==='revision'){
    editorTitle.textContent = '记录 修改内容（按版本）';
    const meta = readMeta(p);
    const last = Array.isArray(meta.rev) && meta.rev.length>0 ? meta.rev[meta.rev.length-1] : null;
    editorForm.innerHTML = `
      <div class="grid-3">
        <label>关联阶段<select name="rev_major">${optionList(['A','B','F'], last?.major||'A')}</select></label>
        <label>小版本<select name="rev_ver">${optionList(VERS, last?.ver||'v1')}</select></label>
        <label>时间（可选，默认当前）<input type="datetime-local" name="rev_ts"></label>
      </div>
      <label>修改说明<textarea name="rev_text" rows="4" placeholder="填写这次修改的要点...">${last?.text||''}</textarea></label>
      <div class="muted small">保存后，仅在表格中显示“最新一条”修改说明；历史会保存在内部。</div>
    `;
  }
}

editorForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id   = editorForm.getAttribute('data-id');
  const kind = editorForm.getAttribute('data-kind');
  const fd   = new FormData(editorForm);
  const row  = projects.find(x=>String(x.id)===String(id));
  let patch = {};

  if(kind==='producer'){
    patch.producer_name    = (fd.get('producer_name')||'').toString().trim();
    patch.producer_contact = (fd.get('producer_contact')||'').toString().trim();
  }

  if(kind==='spec'){
    const rows = [...editorForm.querySelectorAll('.pack')];
    const packs = rows.map(row=>{
      const i = row.getAttribute('data-i');
      const ratios = [...row.querySelectorAll(`input[name="ratio-${i}"]:checked`)].map(x=>x.value);
      return {
        type:   row.querySelector(`[name="type-${i}"]`)?.value || '',
        clips:  Number(row.querySelector(`[name="clips-${i}"]`)?.value || 1),
        res:    row.querySelector(`[name="res-${i}"]`)?.value || '',
        ratios
      };
    }).filter(pk=> pk.type || pk.res || pk.clips);
    patch.spec  = JSON.stringify(packs);
    patch.type  = packs[0]?.type || '';
    patch.clips = packs.reduce((s,x)=> s + Number(x.clips||0), 0);
  }

  if(kind==='progress'){
    const meta = readMeta(row);
    const get = (k)=> (fd.get(`${k}_date`)||'') || null;
    const getv= (k)=> (fd.get(`${k}_ver`)||'v1');
    const doneFromBtn = (k)=> !!editorForm.querySelector(`.toggle-pill[data-done="${k}"]`)?.classList.contains('on');

    meta.prog.A = { date:get('A'), ver:getv('A'), done:doneFromBtn('A') };
    meta.prog.B = { date:get('B'), ver:getv('B'), done:doneFromBtn('B') };
    meta.prog.F = { date:get('F'), ver:getv('F'), done:doneFromBtn('F') };

    patch.meta_json = meta;
  }

  if(kind==='pay'){
    patch.pay_status = (fd.get('pay_status')||'未收款').toString();
  }

  if(kind==='money'){
    patch.quote_amount = Number(fd.get('quote_amount')||0);
    patch.paid_amount  = Number(fd.get('paid_amount')||0);
  }

  if(kind==='revision'){
    const meta = readMeta(row);
    const nowISO = new Date().toISOString();
    (meta.rev ||= []).push({
      major: (fd.get('rev_major')||'A').toString(),
      ver:   (fd.get('rev_ver')||'v1').toString(),
      text:  (fd.get('rev_text')||'').toString().trim(),
      ts:    fd.get('rev_ts') ? new Date(fd.get('rev_ts')).toISOString() : nowISO
    });
    patch.meta_json = meta;
  }

  await supa.from('projects').update(patch).eq('id', id);
  closeEditor();
  await fetchProjects(); renderAll();
});

// ============== 项目列表（统一弹窗编辑） ==============
function renderProjects(list=projects){
  const tb = document.getElementById('projects-body'); tb.innerHTML='';

  list.forEach(p=>{
    const near = upcomingMilestone(p);
    const currentPay = p.pay_status || (unpaidAmtByRule(p)<=0 ? '已收尾款' : (Number(p.deposit_amount||0)>0?'已收定金':'未收款'));
    const meta = readMeta(p);
    const lastRev = Array.isArray(meta.rev) && meta.rev.length>0 ? meta.rev[meta.rev.length-1] : null;
    const lastRevText = lastRev ? `[${lastRev.major} ${lastRev.ver}] ${lastRev.text||''}` : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <!-- 项目（仍支持直接改标题） -->
      <td contenteditable="true" data-k="title" data-id="${p.id}">${p.title||''}</td>

      <!-- 合作制片 -->
      <td>
        <div class="cell-summary">
          <span>${p.producer_name||'未填'}</span>
          ${p.producer_contact?`<span class="muted small">· ${p.producer_contact}</span>`:''}
          <button class="cell-edit edit-btn" data-kind="producer" data-id="${p.id}">编辑</button>
        </div>
      </td>

      <!-- 多组合规格 -->
      <td>
        <div class="cell-summary">
          <span>${mergeTypeSpec(p)||'—'}</span>
          <button class="cell-edit edit-btn" data-kind="spec" data-id="${p.id}">编辑</button>
        </div>
      </td>

      <!-- 进度（仅显示“最近需要执行”的一个版本） -->
      <td>
        <div class="cell-summary">
          <div class="${near.complete?'pill pill-purple':(near.overdue?'pill pill-red':'pill')}">${near.text}</div>
          <button class="cell-edit edit-btn" data-kind="progress" data-id="${p.id}">编辑</button>
        </div>
      </td>

      <!-- 支付状态 -->
      <td>
        <div class="cell-summary">
          ${payBadgePill(currentPay)}
          <button class="cell-edit edit-btn" data-kind="pay" data-id="${p.id}">编辑</button>
        </div>
      </td>

      <!-- 金额 -->
      <td>
        <div class="cell-summary">
          <span class="muted">${money(p.quote_amount)} / ${money(p.paid_amount)}</span>
          <button class="cell-edit edit-btn" data-kind="money" data-id="${p.id}">编辑</button>
        </div>
      </td>

      <!-- 修改内容（仅显示最新一条） -->
      <td>
        <div class="cell-summary">
          <span class="muted">${lastRevText}</span>
          <button class="cell-edit edit-btn" data-kind="revision" data-id="${p.id}">编辑</button>
        </div>
      </td>
    `;
    tb.appendChild(tr);
  });

  // —— 标题内联编辑
  tb.addEventListener('blur', async (e)=>{
    const td = e.target.closest('td[contenteditable="true"]'); if(!td) return;
    const id = td.getAttribute('data-id'); const k = td.getAttribute('data-k'); const v = td.textContent.trim();
    if(!id || !k) return;
    const patch = {}; patch[k]=v;
    await supa.from('projects').update(patch).eq('id', id);
  }, true);

  // —— 打开弹窗编辑
  tb.addEventListener('click', (e)=>{
    const btn = e.target.closest('.edit-btn'); if(!btn) return;
    openEditorModal(btn.getAttribute('data-kind'), btn.getAttribute('data-id'));
  });
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
    const meta = readMeta(p);
    [['A','a',meta.prog?.A],['B','b',meta.prog?.B],['F','final',meta.prog?.F]].forEach(([key,typ,obj])=>{
      const d = fmt(obj?.date); if(!d) return;
      if(d.getFullYear()!==y || d.getMonth()!==m) return;
      const day=d.getDate();
      const overdue = d<today && !obj?.done;
      (evs[day] ||= []).push({ typ, txt:`${p.title||'未命名'} · ${(key==='A'?'Acopy':key==='B'?'Bcopy':'Final')} ${obj?.ver||'v1'}`, overdue });
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

// ============== 财务（保持 & 未收款计算修正） ==============
function renderFinance(){
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

  const rq=document.getElementById('rank-project'); rq.innerHTML='';
  [...projects].sort((a,b)=>Number(b.quote_amount||0)-Number(a.quote_amount||0)).forEach(p=>{
    const li=document.createElement('div'); li.className='list-item';
    li.innerHTML = `<div>${p.title||'未命名'}</div><strong>${money(p.quote_amount)}</strong>`; rq.appendChild(li);
  });

  const aging=document.getElementById('aging'); aging.innerHTML='';
  const today=Date.now();
  projects.filter(p=> readMeta(p)?.prog?.F?.date && unpaidAmtByRule(p)>0)
    .sort((a,b)=> new Date(readMeta(a).prog.F.date||0)-new Date(readMeta(b).prog.F.date||0))
    .forEach(p=>{
      const Fd = readMeta(p).prog.F.date;
      const days = Math.floor((today - new Date(Fd).getTime())/86400000);
      const li=document.createElement('div'); li.className='list-item';
      li.innerHTML = `<div>${p.title||'未命名'} / ${p.producer_name||'未填'}</div>
                      <div>${money(unpaidAmtByRule(p))} / ${days>0?days:0}天</div>`;
      aging.appendChild(li);
    });

  // 趋势（保持）
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
  if(row.spec){ row.spec = row.spec; }
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
