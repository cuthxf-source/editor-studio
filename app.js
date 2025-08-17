/* editor-studio / app.js  v1.4.6 */
const APP_VERSION = 'v1.4.6';

/* ============= Supabase ============= */
const supa = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

/* ============= 视图 ============= */
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
  theme:    document.getElementById('btn-theme'),
};
function showView(name){
  Object.values(views).forEach(v=>v.classList.add('hidden'));
  (views[name]||views.home).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b=>b.removeAttribute('aria-current'));
  ({home:nav.home, projects:nav.projects, schedule:nav.schedule, gallery:nav.gallery, finance:nav.finance}[name])?.setAttribute('aria-current','page');
}

/* ============= 主题切换（GitHub 风格） ============= */
(function themeInit(){
  const key='editor_theme';
  const saved = localStorage.getItem(key);
  if(saved==='dark' || saved==='light'){ document.documentElement.setAttribute('data-theme', saved); }
  nav.theme?.addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme')||'auto';
    const next = cur==='dark' ? 'light' : cur==='light' ? 'auto' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(key,next);
  });
})();

/* ============= 登录 ============= */
const authForm = document.getElementById('auth-form');
const authTip  = document.getElementById('auth-tip');
nav.logout?.addEventListener('click', async ()=>{ await supa.auth.signOut(); showView('auth'); });
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

/* ============= 数据&工具 ============= */
let projects = [];
async function fetchProjects(){
  const { data, error } = await supa
    .from('projects')
    .select(`id,title,brand,type,spec,clips,notes,pay_status,quote_amount,deposit_amount,paid_amount,producer_name,producer_contact,a_copy,b_copy,final_date,final_link,poster_url,updated_at`)
    .order('updated_at',{ ascending:false })
    .limit(1000);
  if(error){ console.error(error); return; }
  projects = data || [];
}

const money = n => `¥${(Number(n||0)).toLocaleString()}`;
const fmt = (d)=> d? new Date(d): null;

function parseNotes(notes){
  const base = { tags:new Set(), versions:{A:'v1',B:'v1',F:'v1'}, changes:[], free:'' };
  if(!notes) return base;
  try{
    const obj = JSON.parse(notes);
    if(obj && (obj.tags || obj.versions || obj.changes || Object.prototype.hasOwnProperty.call(obj,'free'))){
      return {
        tags: new Set(Array.isArray(obj.tags)?obj.tags:[]),
        versions: obj.versions || {A:'v1',B:'v1',F:'v1'},
        changes: Array.isArray(obj.changes)?obj.changes:[],
        free: obj.free || ''
      };
    }
  }catch(e){}
  const tags = new Set((notes.match(/#[A-Z_]+/g)||[]));
  return { tags, versions:{A:'v1',B:'v1',F:'v1'}, changes:[], free:notes };
}
function stringifyNotes(obj){
  return JSON.stringify({
    tags: Array.from(obj.tags||[]),
    versions: obj.versions || {A:'v1',B:'v1',F:'v1'},
    changes: obj.changes || [],
    free: obj.free || ''
  });
}
function hasTag(notes, tag){ return parseNotes(notes).tags.has(tag); }

/* 优先级：#P1~#P4 */
function getPriority(p){
  const t = parseNotes(p.notes).tags;
  if(t.has('#P1')) return 'P1';
  if(t.has('#P2')) return 'P2';
  if(t.has('#P3')) return 'P3';
  if(t.has('#P4')) return 'P4';
  return 'P3';
}
function setPriorityTags(tags, pri){
  ['#P1','#P2','#P3','#P4'].forEach(x=>tags.delete(x));
  tags.add('#'+pri);
}
function priWeight(pri){ return ({P1:1,P2:2,P3:3,P4:4}[pri]||3); }

function parseSpec(specStr){
  const s = specStr || '';
  let json = null;
  try{
    if((s.trim().startsWith('{') || s.trim().startsWith('['))) json = JSON.parse(s);
  }catch(e){ json = null; }
  if(json){
    const combos = Array.isArray(json) ? json : (json.combos||[]);
    return { json: true, combos };
  }
  const raw = s.split('·').map(x=>x.trim());
  let res = raw[0] || '';
  let ratio = raw[1] || '';
  if(!ratio && res.includes(':')){ ratio=res; res=''; }
  return { json:false, combos:[{ type:'', clips:1, res, ratios: ratio? [ratio]: [] }] };
}
function mergeTypeSpec(p){
  const parsed = parseSpec(p.spec);
  if(parsed.json){
    return parsed.combos.map(c=>{
      const r = c.ratios?.length ? ` · ${c.ratios.join('/')}` : '';
      const rr = c.res ? ` · ${c.res}` : '';
      return `${c.type||'未填'}×${c.clips||1}${rr}${r}`;
    }).join('，');
  }else{
    const c = parsed.combos[0]||{};
    const clips = p.clips ? ` · ${p.clips}条` : '';
    const type  = p.type || '';
    const r = c.ratios?.length ? ` · ${c.ratios.join('/')}` : (c.ratio?` · ${c.ratio}`:'');
    const rr = c.res ? ` · ${c.res}` : '';
    const joined = [type, rr.replace(' · ','').trim()].filter(Boolean).join(' · ');
    return (joined? joined : '—') + clips + (r||'');
  }
}
function typeSpecLines(p){
  const parsed = parseSpec(p.spec);
  if(parsed.json){
    return parsed.combos.map(c=>{
      const r = c.ratios?.length ? ` · ${c.ratios.join('/')}` : '';
      const rr = c.res ? ` · ${c.res}` : '';
      return `${c.type||'未填'}×${c.clips||1}${rr}${r}`;
    });
  }else{
    const c = parsed.combos[0]||{};
    const clips = p.clips ? ` · ${p.clips}条` : '';
    const type  = p.type || '';
    const r = c.ratios?.length ? ` · ${c.ratios.join('/')}` : (c.ratio?` · ${c.ratio}`:'');
    const rr = c.res ? ` · ${c.res}` : '';
    const joined = [type, rr.replace(' · ','').trim()].filter(Boolean).join(' · ');
    return [(joined? joined : '—') + clips + (r||'')];
  }
}
function totalClipsOf(p){
  const parsed = parseSpec(p.spec);
  if(parsed.json) return parsed.combos.reduce((s,c)=>s+Number(c.clips||0),0) || Number(p.clips||0) || 0;
  return Number(p.clips||0) || 0;
}
function unpaidAmt(p){
  return Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0),0);
}
function stageInfo(p){
  const d = parseNotes(p.notes);
  const A = !hasTag(p.notes,'#A_DONE');
  const B = !hasTag(p.notes,'#B_DONE');
  const F = !hasTag(p.notes,'#F_DONE');
  if(A) return { name:'Acopy', percent:30, version:d.versions.A||'v1', badge:'a' };
  if(B) return { name:'Bcopy', percent:60, version:d.versions.B||'v1', badge:'b' };
  if(F) return { name:'Final', percent:85, version:d.versions.F||'v1', badge:'f' };
  return { name:'完结', percent:100, version:'', badge:'done' };
}
function nearestMilestone(p){
  const today = new Date(); today.setHours(0,0,0,0);
  const A = fmt(p.a_copy), B = fmt(p.b_copy), F = fmt(p.final_date);
  const doneA = hasTag(p.notes,'#A_DONE'), doneB = hasTag(p.notes,'#B_DONE'), doneF = hasTag(p.notes,'#F_DONE');
  const items = [];
  if(A && !doneA) items.push({k:'Acopy', date:A});
  if(B && !doneB) items.push({k:'Bcopy', date:B});
  if(F && !doneF) items.push({k:'Final',  date:F});
  if(items.length===0){
    const past = [{k:'Acopy',date:A,done:doneA},{k:'Bcopy',date:B,done:doneB},{k:'Final',date:F,done:doneF}]
      .filter(x=>x.date).sort((a,b)=>b.date-a.date)[0];
    if(!past) return {text:'—', overdue:false, date:null, k:null};
    const overdue = past.date < today && !past.done;
    return { text:`${past.k} - ${past.date.getMonth()+1}/${past.date.getDate()}`, overdue, date:past.date, k:past.k };
  }
  items.sort((a,b)=> a.date - b.date);
  const n = items[0];
  const overdue = n.date < today;
  return { text: `${n.k} - ${n.date.getMonth()+1}/${n.date.getDate()}`, overdue, date:n.date, k:n.k };
}

/* ============= 首页 ============= */
function renderRecent(){
  const box = document.getElementById('recent-list'); box.innerHTML='';
  // 取未完成项目，按优先级→最近节点权重排序
  const weighted = projects
    .filter(p=> (p.pay_status||'')!=='已收尾款')
    .map(p=>{
      const n = nearestMilestone(p);
      let w = 1e15;
      if(n.date){ const diff = n.date - new Date(); w = (diff>=0? diff : Math.abs(diff) + 1e12); }
      return {p, w, pri: priWeight(getPriority(p))};
    })
    .sort((a,b)=> a.pri - b.pri || a.w - b.w)
    .slice(0,4);

  weighted.forEach(({p})=>{
    const near = nearestMilestone(p);
    const st = stageInfo(p);
    const li = document.createElement('div'); li.className='list-item';
    li.innerHTML = `
      <div class="pmeta">
        <div class="title-wrap">
          <div><strong>${p.title||'未命名'}</strong> ${p.brand?`· ${p.brand}`:''}</div>
          <div class="subtitle">合作制片：${[p.producer_name,p.producer_contact].filter(Boolean).join(' · ')||'—'}</div>
        </div>
        <div class="prog-wrap">
          <div class="prog" title="${st.name}${st.version?(' '+st.version):''} ${st.percent}%">
            <div class="prog-bar" style="width:${st.percent}%"></div>
            <span class="prog-text">${st.percent}%</span>
          </div>
          <span class="ver-pill">${st.name}${st.version?` · ${st.version}`:''}</span>
        </div>
      </div>
      <div class="count muted small">条数：${totalClipsOf(p)||1}</div>
      <div class="due ${near.overdue?'pill pill-red':'pill'}">${near.text}</div>
    `;
    li.addEventListener('click', ()=> openQuickModal(p.id));
    box.appendChild(li);
  });

  document.getElementById('go-list')?.addEventListener('click', (e)=>{ e.stopPropagation(); showView('projects'); }, { once: true });
}

function renderKpis(){
  const total   = projects.reduce((s,p)=>s+Number(p.quote_amount||0),0);
  const paid    = projects.reduce((s,p)=>s+Number(p.paid_amount||0),0);
  const unpaid  = projects.reduce((s,p)=>s+unpaidAmt(p),0);

  const clipDone = projects.reduce((s,p)=> s + (hasTag(p.notes,'#F_DONE') ? totalClipsOf(p) : 0), 0);
  const clipAll  = projects.reduce((s,p)=> s + totalClipsOf(p), 0);
  const clipTodo = Math.max(clipAll - clipDone, 0);

  document.getElementById('kpi-total').textContent   = money(total);
  document.getElementById('kpi-paid').textContent    = money(paid);
  document.getElementById('kpi-unpaid').textContent  = money(unpaid);
  document.getElementById('kpi-done').textContent    = String(clipDone);
  document.getElementById('kpi-todo').textContent    = String(clipTodo);

  document.getElementById('f-total').textContent     = money(total);
  document.getElementById('f-paid').textContent      = money(paid);
  document.getElementById('f-unpaid').textContent    = money(unpaid);

  // 财务页截至
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const fAsof = document.getElementById('f-asof');
  if(fAsof) fAsof.textContent = `截至 ${todayStr}`;
}

/* ============= 报价分析器（默认多组合 + 合成复杂度） ============= */
(function initQuote(){
  const typeBase = {
    'LookBook': {price:100,  baseSec:15,  secRate:0.01},
    '形象片':    {price:3500, baseSec:45,  secRate:0.03},
    'TVC':      {price:7000, baseSec:60,  secRate:0.03},
    '纪录片':    {price:12000,baseSec:180, secRate:0.005},
    '微电影':    {price:12000,baseSec:180, secRate:0.005},
  };
  const elCreative = document.getElementById('qa-creative');
  const elUrgent   = document.getElementById('qa-urgent');
  const elRev      = document.getElementById('qa-rev');
  const elComp     = document.getElementById('qa-comp');
  const elCompVal  = document.getElementById('qa-comp-val');

  const list = document.getElementById('qa-mc-list');
  const addBtn = document.getElementById('qa-mc-add');

  const refreshLabels = ()=> {
    document.getElementById('qa-creative-val').textContent = elCreative.value+'%';
    document.getElementById('qa-urgent-val').textContent   = elUrgent.value+'%';
    elCompVal.textContent = elComp.value+'%';
  };
  ['input','change'].forEach(ev=>{
    elCreative.addEventListener(ev,refreshLabels);
    elUrgent.addEventListener(ev,refreshLabels);
    elComp.addEventListener(ev,refreshLabels);
  });
  refreshLabels();

  function unitPriceBy(type, secs){
    const def = typeBase[type] || {price:0, baseSec:0, secRate:0};
    const basePrice = def.price;
    const over = Math.max(0, Number(secs||0) - def.baseSec);
    const secFactor = over>0 ? Math.pow(1+def.secRate, over) : 1;
    let price = basePrice * secFactor;
    price *= (1 + Number(elComp.value||0)/100);
    price *= (1 + Number(elCreative.value||0)/100);
    price *= (1 + (Number(elUrgent.value||0)/10) * 0.03);
    const rev = Number(elRev.value||0);
    const extraRev = Math.max(0, rev - 4);
    price *= (1 + extraRev*0.20);
    return Math.round(price);
  }

  function mcRowHTML(idx, c){
    return `
      <div class="h-row" data-idx="${idx}" style="margin-top:6px">
        <label>类型
          <select class="mc-type">
            ${['LookBook','形象片','TVC','纪录片','微电影'].map(o=>`<option ${o===c.type?'selected':''}>${o}</option>`).join('')}
          </select>
        </label>
        <label>条数
          <input class="mc-count" type="number" min="1" value="${c.count||1}">
        </label>
        <label>时长（秒/每条）
          <input class="mc-secs" type="number" min="0" step="1" value="${c.secs||0}">
        </label>
      </div>
    `;
  }
  function ensureOneRow(){
    if(!list.querySelector('[data-idx]')) list.insertAdjacentHTML('beforeend', mcRowHTML(0,{type:'LookBook',count:1,secs:0}));
  }
  addBtn.addEventListener('click', ()=>{
    const idx = list.querySelectorAll('[data-idx]').length;
    list.insertAdjacentHTML('beforeend', mcRowHTML(idx,{type:'LookBook',count:1,secs:0}));
    calc();
  });

  function calc(){
    const rows = [...list.querySelectorAll('[data-idx]')];
    const totalNet = rows.reduce((sum,row)=>{
      const type = row.querySelector('.mc-type').value;
      const count= Number(row.querySelector('.mc-count').value||1);
      const secs = Number(row.querySelector('.mc-secs').value||0);
      return sum + count * unitPriceBy(type, secs);
    },0);
    const gross = Math.round(totalNet * 1.06);
    document.getElementById('qa-net').textContent   = money(totalNet);
    document.getElementById('qa-gross').textContent = money(gross);
  }

  document.getElementById('quote-form').addEventListener('input', calc);
  ensureOneRow(); calc();
})();

/* ============= 编辑模态 ============= */
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
function checkboxList(opts, selectedArr){
  const sel = new Set(selectedArr||[]);
  return opts.map(o=>{
    const ck = sel.has(o) ? 'checked' : '';
    return `<label class="pill"><input type="checkbox" value="${o}" ${ck}><span>${o}</span></label>`;
  }).join('');
}
const TYPE_OPTS = ['LookBook','形象片','TVC','纪录片','微电影'];
const RES_OPTS  = ['1080p','2k','4k'];
const RATIO_OPTS= ['16:9','9:16','1:1','4:3','3:4'];

function comboRowHTML(idx,c){
  return `
  <div class="combo-row" data-idx="${idx}">
    <label>类型
      <select class="combo-type">
        ${optionList(TYPE_OPTS, c.type||'')}
      </select>
    </label>
    <label>影片条数
      <input class="combo-clips" type="number" min="1" value="${c.clips||1}">
    </label>
    <label>分辨率
      <select class="combo-res">
        ${optionList(RES_OPTS, c.res||'')}
      </select>
    </label>
    <div class="pill-group ratios-inline">
      ${checkboxList(RATIO_OPTS, c.ratios||[])}
    </div>
    <div style="margin-left:auto">
      <button type="button" class="cell-edit combo-del">删除该组合</button>
    </div>
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
      <div class="h-row">
        <label>合作制片（姓名）<input name="producer_name" value="${p.producer_name||''}"></label>
        <label>合作制片（联系方式）<input name="producer_contact" value="${p.producer_contact||''}"></label>
      </div>
    `;
  }

  if(kind==='spec'){
    editorTitle.textContent = '编辑 影片类型 & 条数 & 规格（可多组合）';
    const parsed = parseSpec(p.spec);
    const combos = parsed.json ? parsed.combos : [
      { type: p.type||'', clips: p.clips||1, res: (parsed.combos[0]||{}).res||'', ratios: (parsed.combos[0]||{}).ratios||[] }
    ];
    const rows = combos.map((c,idx)=> comboRowHTML(idx,c)).join('');
    editorForm.innerHTML = `
      <div id="combo-list">${rows}</div>
      <div style="margin-top:10px">
        <button type="button" id="add-combo" class="cell-edit">新增组合</button>
      </div>
      <div class="combo-help">
        · 4K（UHD）常见比例：16:9 → 3840×2160；9:16 → 2160×3840；1:1 → 2160×2160；4:3 → 2880×2160；3:4 → 2160×2880
      </div>
    `;
    editorForm.addEventListener('click', e=>{
      const add = e.target.closest('#add-combo');
      const del = e.target.closest('.combo-del');
      if(add){
        const list = editorForm.querySelector('#combo-list');
        const idx = list.querySelectorAll('.combo-row').length;
        list.insertAdjacentHTML('beforeend', comboRowHTML(idx,{type:'LookBook',clips:1,res:'1080p',ratios:['16:9']}));
      }
      if(del){ del.closest('.combo-row')?.remove(); }
    }, { once: false });
  }

  if(kind==='progress'){
    editorTitle.textContent = '编辑 进度（横行 / 完成标记 / 小版本号）';
    const d = parseNotes(p.notes);
    editorForm.innerHTML = `
      <div class="h-row">
        <label>Acopy 日期<input type="date" name="a_copy" value="${p.a_copy||''}"></label>
        <label>Bcopy 日期<input type="date" name="b_copy" value="${p.b_copy||''}"></label>
        <label>Final 日期<input type="date" name="final_date" value="${p.final_date||''}"></label>
      </div>
      <div class="h-row pill-group">
        <label class="pill"><input type="checkbox" name="A_DONE" ${hasTag(p.notes,'#A_DONE')?'checked':''}><span>Acopy 完成</span></label>
        <label class="pill"><input type="checkbox" name="B_DONE" ${hasTag(p.notes,'#B_DONE')?'checked':''}><span>Bcopy 完成</span></label>
        <label class="pill"><input type="checkbox" name="F_DONE" ${hasTag(p.notes,'#F_DONE')?'checked':''}><span>Final 完成</span></label>
      </div>
      <div class="h-row">
        <label>Acopy 小版本
          <select name="ver_A">${optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], d.versions.A||'v1')}</select>
        </label>
        <label>Bcopy 小版本
          <select name="ver_B">${optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], d.versions.B||'v1')}</select>
        </label>
        <label>Final 小版本
          <select name="ver_F">${optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], d.versions.F||'v1')}</select>
        </label>
      </div>
    `;
  }

  if(kind==='money'){
    editorTitle.textContent = '编辑 金额';
    editorForm.innerHTML = `
      <div class="h-row">
        <label>总金额<input name="quote_amount" type="number" min="0" step="0.01" value="${p.quote_amount||0}"></label>
        <label>已收款<input name="paid_amount" type="number" min="0" step="0.01" value="${p.paid_amount||0}"></label>
      </div>
    `;
  }

  if(kind==='changes'){
    editorTitle.textContent = '修改内容（可直接粘贴图片）';
    const d = parseNotes(p.notes);
    const st = stageInfo(p);
    const history = [...(d.changes||[])].sort((a,b)=>b.ts-a.ts);
    const histHTML = history.length? history.map(x=>{
      const dt = new Date(x.ts||Date.now());
      const time = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
      const imgs = (x.images||[]).map(u=>`<span class="thumb" style="background-image:url('${u}')" data-url="${u}" title="点击查看"></span>`).join('');
      return `<div class="list-item" data-ts="${x.ts}">
        <div class="small muted">[APP ${x.appVer||'—'}] [${x.phase} · ${x.version}] · ${time} <button type="button" class="cell-edit edit-change" data-ts="${x.ts}">编辑</button></div>
        <div class="small">${(x.text||'').replace(/</g,'&lt;')}</div>
        <div class="thumb-list">${imgs}</div>
      </div>`;
    }).join('') : `<div class="muted small">暂无历史记录</div>`;
    editorForm.innerHTML = `
      <div class="card" style="margin-bottom:10px">
        <div class="section-head"><h3>本次修改（自动关联当前阶段与最新小版本）</h3></div>
        <div class="h-row">
          <label>关联阶段
            <select name="chg_phase">${optionList(['Acopy','Bcopy','Final'], st.name==='完结'?'Final':st.name)}</select>
          </label>
          <label>小版本号
            <select name="chg_version">${optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], st.name==='Acopy'?parseNotes(p.notes).versions.A:st.name==='Bcopy'?parseNotes(p.notes).versions.B:parseNotes(p.notes).versions.F)}</select>
          </label>
          <label>系统版本（只读）
            <input type="text" value="${APP_VERSION}" disabled>
          </label>
        </div>
        <label style="margin-top:8px">修改内容（可粘贴图片到此框）
          <textarea name="chg_text" rows="4" placeholder="填写本次修改点..."></textarea>
        </label>
        <div class="thumb-list" id="chg-thumbs"></div>
        <label class="pill" style="margin-top:8px"><input type="checkbox" name="auto_bump" checked><span>保存后将所选阶段的小版本 +1</span></label>
        <input type="hidden" name="edit_ts" value="">
      </div>
      <div class="card" style="margin-top:10px">
        <div class="section-head"><h3>历史修改记录（点击图片可查看大图）</h3></div>
        <div class="list">${histHTML}</div>
      </div>
    `;

    // 历史“编辑”点击 -> 回填
    editorForm.querySelectorAll('.edit-change').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const ts = btn.getAttribute('data-ts');
        const it = (d.changes||[]).find(x=> String(x.ts)===String(ts));
        if(it){
          editorForm.querySelector('[name="chg_phase"]').value = it.phase||'Final';
          editorForm.querySelector('[name="chg_version"]').value = it.version||'v1';
          editorForm.querySelector('[name="chg_text"]').value = it.text||'';
          editorForm.querySelector('[name="edit_ts"]').value = String(it.ts||'');
        }
      });
    });

    // 点击缩略图查看
    editorForm.querySelectorAll('.thumb').forEach(t=>{
      t.addEventListener('click', ()=> window.open(t.getAttribute('data-url'),'_blank'));
    });

    // 处理粘贴图片
    let pasteFiles = [];
    editorForm.addEventListener('paste', async (e)=>{
      const items = e.clipboardData?.items || [];
      for(const it of items){
        if(it.type && it.type.startsWith('image/')){
          const file = it.getAsFile();
          pasteFiles.push(file);
          // 预览
          const url = URL.createObjectURL(file);
          const t = document.createElement('span');
          t.className='thumb'; t.style.backgroundImage=`url('${url}')`;
          t.title = '待上传';
          document.getElementById('chg-thumbs').appendChild(t);
        }
      }
    });
    editorForm._pasteFiles = pasteFiles;
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
    const rows = [...editorForm.querySelectorAll('.combo-row')];
    const combos = rows.map(row=>{
      const type  = row.querySelector('.combo-type').value;
      const clips = Number(row.querySelector('.combo-clips').value||1);
      const res   = row.querySelector('.combo-res').value;
      const ratios= [...row.querySelectorAll('.pill-group input[type="checkbox"]:checked')].map(i=>i.value);
      return { type, clips, res, ratios };
    }).filter(x=>x.type);
    if(combos.length){
      patch.spec = JSON.stringify({ combos });
      patch.type  = combos[0].type;
      patch.clips = combos[0].clips;
    }else{
      patch.spec = '';
      patch.type = '';
      patch.clips= 1;
    }
  }
  if(kind==='progress'){
    const a_copy    = fd.get('a_copy')||null;
    const b_copy    = fd.get('b_copy')||null;
    const final_date= fd.get('final_date')||null;
    const row = projects.find(x=>String(x.id)===String(id));
    let d = parseNotes(row?.notes||'');
    d = { ...d, versions:{
      A: fd.get('ver_A')||d.versions.A||'v1',
      B: fd.get('ver_B')||d.versions.B||'v1',
      F: fd.get('ver_F')||d.versions.F||'v1'
    }};
    const tags = new Set(d.tags||[]);
    if(fd.get('A_DONE')) tags.add('#A_DONE'); else tags.delete('#A_DONE');
    if(fd.get('B_DONE')) tags.add('#B_DONE'); else tags.delete('#B_DONE');
    if(fd.get('F_DONE')) tags.add('#F_DONE'); else tags.delete('#F_DONE');
    d.tags = Array.from(tags);
    patch = { a_copy: a_copy||null, b_copy: b_copy||null, final_date: final_date||null, notes: stringifyNotes(d) };
  }
  if(kind==='money'){
    patch.quote_amount   = Number(fd.get('quote_amount')||0);
    patch.paid_amount    = Number(fd.get('paid_amount')||0);
  }
  if(kind==='changes'){
    const row = projects.find(x=>String(x.id)===String(id));
    let d = parseNotes(row?.notes||'');
    const phase   = (fd.get('chg_phase')||'Final').toString();
    const version = (fd.get('chg_version')||'v1').toString();
    const text    = (fd.get('chg_text')||'').toString().trim();
    const autoBump= !!fd.get('auto_bump');
    const editTs  = (fd.get('edit_ts')||'').toString();

    // 上传粘贴的图片
    let images = [];
    const pasteFiles = editorForm._pasteFiles || [];
    for(const file of pasteFiles){
      const url = await uploadToBucket(`projects/${id}/changes/${Date.now()}-${Math.random().toString(36).slice(2)}.${extOf(file.name,'png')}`, file);
      if(url) images.push(url);
    }
    editorForm._pasteFiles = []; // 清空

    if(text || images.length){
      const chg = { phase, version, text, images, ts: editTs? Number(editTs) : Date.now(), appVer: APP_VERSION };
      d.changes = Array.isArray(d.changes)? d.changes : [];
      // 若是编辑模式：替换相同 ts 的项
      if(editTs){
        const idx = d.changes.findIndex(x=> String(x.ts)===String(editTs));
        if(idx>=0) d.changes[idx] = chg; else d.changes.push(chg);
      }else{
        d.changes.push(chg);
      }
    }
    if(autoBump){
      d.versions = d.versions || {A:'v1',B:'v1',F:'v1'};
      if(phase==='Acopy') d.versions.A = bumpVer(d.versions.A);
      if(phase==='Bcopy') d.versions.B = bumpVer(d.versions.B);
      if(phase==='Final') d.versions.F = bumpVer(d.versions.F);
    }
    patch.notes = stringifyNotes(d);
  }

  await supa.from('projects').update(patch).eq('id', id);
  closeEditor();
  await fetchProjects(); renderAll();
});

function bumpVer(ver){
  const n = parseInt(String(ver||'v1').replace(/[^\d]/g,''), 10) || 1;
  const next = Math.min(n + 1, 8);
  return 'v' + next;
}

/* ============= 项目列表 ============= */
function payPillHTML(st){
  const map = {
    '未收款':  'pill pill-blue',
    '已收定金':'pill pill-green',
    '已收尾款':'pill pill-gold'
  };
  const cls = map[st] || 'pill';
  return `<span class="${cls} pay-pill" data-val="${st}">${st}</span>`;
}
function priPillHTML(pri){
  const cls = pri==='P1'?'pill-red': pri==='P2'?'pill-yellow': pri==='P3'?'pill-blue':'pill';
  return `<div class="pill-menu">
    <span class="pill ${cls} pri-pill" data-val="${pri}" title="点击更改优先级">${pri}</span>
    <div class="menu">
      ${['P1','P2','P3','P4'].map(p=>`<div class="item" data-pri="${p}">${p}</div>`).join('')}
    </div>
  </div>`;
}
function formatProgressCell(p){
  const vers = parseNotes(p.notes).versions;
  const near = nearestMilestone(p);
  const doneF = hasTag(p.notes,'#F_DONE');
  if(doneF && p.final_date){
    const d = new Date(p.final_date);
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `<span class="badge badge-done">完结</span> <span class="small">- ${mm}.${dd}</span>`;
  }
  if(!near || !near.k || !near.date) return '—';
  const mm = String(near.date.getMonth()+1).padStart(2,'0');
  const dd = String(near.date.getDate()).padStart(2,'0');
  const small = near.k==='Acopy'? (vers.A||'v1') : near.k==='Bcopy'? (vers.B||'v1') : (vers.F||'v1');
  const cls = near.k==='Acopy' ? 'badge-a' : near.k==='Bcopy' ? 'badge-b' : 'badge-f';
  return `<span class="badge ${cls}">${near.k}</span> <span class="small">- ${mm}.${dd} - ${small}</span>`;
}

function renderProjects(){
  const tbU = document.getElementById('projects-body');
  const tbC = document.getElementById('completed-body');
  tbU.innerHTML=''; tbC.innerHTML='';

  // 分组 & 排序（按优先级 -> 更新时间）
  const arrU = projects.filter(p=> (p.pay_status||'')!=='已收尾款')
    .map(p=>({p, pri:priWeight(getPriority(p))})).sort((a,b)=> a.pri - b.pri || new Date(b.p.updated_at)-new Date(a.p.updated_at))
    .map(x=>x.p);
  const arrC = projects.filter(p=> (p.pay_status||'')==='已收尾款')
    .map(p=>({p, pri:priWeight(getPriority(p))})).sort((a,b)=> a.pri - b.pri || new Date(b.p.updated_at)-new Date(a.p.updated_at))
    .map(x=>x.p);

  function rowHTML(p){
    const moneyText = `${money(p.quote_amount)} / ${money(p.paid_amount)}`;
    const d = parseNotes(p.notes);
    const last = [...(d.changes||[])].sort((a,b)=>b.ts-a.ts)[0];
    const imgs = (last?.images||[]);
    const thumbs = imgs.slice(0,4).map(u=>`<span class="thumb" style="background-image:url('${u}')" data-url="${u}" title="查看"></span>`).join('');
    const lastText = last ? `[${last.phase}·${last.version}] ${last.text.slice(0,60)}${last.text.length>60?'…':''}` : '—';
    const uploaded = p.final_link || p.poster_url;
    const uploadPill = uploaded ? '<span class="pill pill-green">已上传</span>' : '<span class="pill">未上传</span>';
    const pri = getPriority(p);

    return `
      <tr data-id="${p.id}">
        <td contenteditable="true" data-k="title">${p.title||''}</td>
        <td>
          <div class="cell-summary">
            <span>${p.producer_name||'未填'}</span>
            ${p.producer_contact?`<span class="muted small">· ${p.producer_contact}</span>`:''}
            <button class="cell-edit edit-btn" data-kind="producer">编辑</button>
          </div>
        </td>
        <td class="col-type">
          <div class="cell-summary">
            <span class="text-cell">${(typeSpecLines(p).join('<br>'))||'—'}</span>
            <button class="cell-edit edit-btn" data-kind="spec">编辑</button>
          </div>
        </td>
        <td class="col-prog">
          <div class="cell-summary">
            <span class="text-cell">${formatProgressCell(p)}</span>
            <button class="cell-edit edit-btn" data-kind="progress">编辑</button>
          </div>
        </td>
        <td class="col-pri">
          ${priPillHTML(pri)}
        </td>
        <td class="col-pay">
          ${payPillHTML(p.pay_status || (unpaidAmt(p)<=0 ? '已收尾款' : (Number(p.paid_amount||0)>0?'已收定金':'未收款'))}
        </td>
        <td class="col-money">
          <div class="cell-summary">
            <span class="muted text-cell">${moneyText}</span>
            <button class="cell-edit edit-btn" data-kind="money">编辑</button>
          </div>
        </td>
        <td class="col-changes">
          <div class="cell-summary">
            <span class="small text-cell">${lastText}</span>
            <div class="thumb-list">${thumbs}</div>
            <button class="cell-edit edit-btn" data-kind="changes">编辑</button>
          </div>
        </td>
        <td class="col-upload">
          <button class="cell-edit upload-btn">${uploadPill}</button>
        </td>
      </tr>
    `;
  }

  arrU.forEach(p=> tbU.insertAdjacentHTML('beforeend', rowHTML(p)));
  arrC.forEach(p=> tbC.insertAdjacentHTML('beforeend', rowHTML(p)));

  // 行内事件绑定（一次性）
  function bindTable(tb){
    if(tb._bound) return;
    tb.addEventListener('blur', async (e)=>{
      const td = e.target.closest('td[contenteditable="true"]'); if(!td) return;
      const tr = td.closest('tr'); const id = tr.getAttribute('data-id'); const k = td.getAttribute('data-k'); const v = td.textContent.trim();
      if(!id || !k) return; const patch = {}; patch[k]=v; await supa.from('projects').update(patch).eq('id', id);
    }, true);

    // 弹窗编辑
    tb.addEventListener('click', (e)=>{
      const btn = e.target.closest('.edit-btn'); if(!btn) return;
      const tr = btn.closest('tr'); const id = tr.getAttribute('data-id');
      openEditorModal(btn.getAttribute('data-kind'), id);
    });

    // 支付状态切换
    tb.addEventListener('click', async (e)=>{
      const pill = e.target.closest('.pay-pill'); if(!pill) return;
      const tr = pill.closest('tr'); const id = tr.getAttribute('data-id');
      const cur = pill.getAttribute('data-val');
      const opts = ['未收款','已收定金','已收尾款'];
      const next = opts[(opts.indexOf(cur)+1)%opts.length];
      await supa.from('projects').update({ pay_status: next }).eq('id', id);
      await fetchProjects(); renderProjects(); renderFinance(); renderRecent();
    });

    // 优先级菜单
    tb.addEventListener('click', async (e)=>{
      const pillWrap = e.target.closest('.pill-menu'); if(!pillWrap) return;
      const tr = pillWrap.closest('tr'); const id = tr.getAttribute('data-id');
      const menu = pillWrap.querySelector('.menu');
      pillWrap.classList.toggle('show');
      const choice = e.target.closest('.item');
      if(choice){
        const p = projects.find(x=> String(x.id)===String(id));
        let d = parseNotes(p?.notes||'');
        const tags = new Set(d.tags||[]);
        setPriorityTags(tags, choice.getAttribute('data-pri'));
        d.tags = Array.from(tags);
        await supa.from('projects').update({ notes: stringifyNotes(d) }).eq('id', id);
        pillWrap.classList.remove('show');
        await fetchProjects(); renderProjects(); renderRecent();
      }
    });
    document.addEventListener('click', (e)=>{
      if(!e.target.closest('.pill-menu')) document.querySelectorAll('.pill-menu.show').forEach(x=>x.classList.remove('show'));
    });

    // 上传弹窗
    tb.addEventListener('click', (e)=>{
      const btn = e.target.closest('.upload-btn'); if(!btn) return;
      const tr = btn.closest('tr'); const id = tr.getAttribute('data-id');
      openUploadModal(id);
    });

    // 缩略图查看
    tb.addEventListener('click', (e)=>{
      const t = e.target.closest('.thumb'); if(!t) return;
      const url = t.getAttribute('data-url'); if(url) window.open(url,'_blank');
    });

    tb._bound = true;
  }
  bindTable(tbU); bindTable(tbC);

  shrinkOverflowCells(tbU); shrinkOverflowCells(tbC);
}
function shrinkOverflowCells(tb){
  const cells = tb.querySelectorAll('td .text-cell');
  cells.forEach(el=>{
    const td = el.closest('td'); if(!td) return;
    if(td.scrollWidth > td.clientWidth || el.scrollWidth > td.clientWidth) td.classList.add('shrink'); else td.classList.remove('shrink');
  });
}

/* ============= 快速查看 ============= */
const quickModal = document.getElementById('quick-modal');
const quickTitle = document.getElementById('quick-title');
const quickBody  = document.getElementById('quick-body');
const quickClose = document.getElementById('quick-close');
const quickFinalBtn = document.getElementById('quick-final-done');
function closeQuick(){ quickModal.classList.remove('show'); quickBody.innerHTML=''; }
quickClose?.addEventListener('click', closeQuick);
quickModal?.addEventListener('mousedown', (e)=>{ if(e.target===quickModal) closeQuick(); });

function openQuickModal(id){
  const p = projects.find(x=>String(x.id)===String(id)); if(!p) return;
  const st = stageInfo(p);
  const near = nearestMilestone(p);
  quickTitle.textContent = `${p.title||'未命名'}${p.brand?` · ${p.brand}`:''}`;
  quickBody.innerHTML = `
    <div class="grid-1">
      <div>合作制片：${[p.producer_name,p.producer_contact].filter(Boolean).join(' · ')||'—'}</div>
      <div class="small muted">规格：${mergeTypeSpec(p)||'—'}</div>
      <div class="small muted">节点：${[p.a_copy?`Acopy ${p.a_copy}`:'', p.b_copy?`Bcopy ${p.b_copy}`:'', p.final_date?`Final ${p.final_date}`:''].filter(Boolean).join(' ｜ ')||'—'}</div>
      <div style="margin-top:8px" class="pmeta">
        <div class="prog" style="flex:1"><div class="prog-bar" style="width:${st.percent}%"></div><span class="prog-text">${st.percent}%</span></div>
        <span class="ver-pill">${st.name}${st.version?` · ${st.version}`:''}</span>
      </div>
    </div>
  `;
  quickFinalBtn.onclick = async ()=>{
    const row = projects.find(x=>String(x.id)===String(id));
    let d = parseNotes(row?.notes||''); d.tags.add('#F_DONE');
    await supa.from('projects').update({ notes: stringifyNotes(d) }).eq('id', id);
    await fetchProjects(); renderAll(); closeQuick();
  };
  quickModal.classList.add('show');
}

/* ============= 作品合集 ============= */
function renderGallery(){
  const grid = document.getElementById('gallery-grid'); grid.innerHTML='';
  const finals = projects.filter(p=>p.poster_url || p.final_link);
  if(finals.length===0){
    const ph = document.createElement('div');
    ph.className='poster';
    ph.innerHTML = `<div class="caption">暂未上传封面/成片，在项目“上传”列添加</div>`;
    grid.appendChild(ph); return;
  }
  finals.forEach(p=>{
    const a = document.createElement('a');
    a.className='poster';
    a.href=p.final_link||'#'; a.target=p.final_link?'_blank':'_self';
    a.style.backgroundImage = p.poster_url? `url('${p.poster_url}')` : '';
    a.innerHTML = `<div class="caption">${p.title||'未命名'}${p.brand?` · ${p.brand}`:''}</div>`;
    grid.appendChild(a);
  });
}

/* ============= 档期（连通格子 + 版本名） ============= */
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
  const cells=[];
  for(let i=0;i<42;i++){
    const day=i-start+1;
    const cell=document.createElement('div'); cell.className='cal-cell';
    if(day>0 && day<=days){
      const head=document.createElement('div'); head.className='cal-day'; head.textContent=String(day); cell.appendChild(head);
      const evBox=document.createElement('div'); cell.appendChild(evBox);
      cells[day]=evBox;
    }
    gridEl.appendChild(cell);
  }
  projects.forEach(p=>{
    const vers = parseNotes(p.notes).versions;
    [['a_copy','a','Acopy',vers.A],['b_copy','b','Bcopy',vers.B],['final_date','final','Final',vers.F]].forEach(([key,typ,label,ver])=>{
      const d = fmt(p[key]); if(!d) return;
      if(d.getFullYear()!==y || d.getMonth()!==m) return;
      const done = (typ==='a' && hasTag(p.notes,'#A_DONE')) ||
                   (typ==='b' && hasTag(p.notes,'#B_DONE')) ||
                   (typ==='final' && hasTag(p.notes,'#F_DONE'));
      const overdue = d<today && !done;
      const tag=document.createElement('span');
      tag.className='ev ' + (typ==='a'?'ev-a':typ==='b'?'ev-b':'ev-final') + (overdue?' ev-overdue':'');
      tag.textContent=`${p.title||'未命名'} · ${label} ${ver||''}`;
      cells[d.getDate()]?.appendChild(tag);
    });
  });
}

/* ============= 财务 ============= */
function renderFinance(){
  const byPartner = new Map();
  projects.forEach(p=>{
    const k=p.producer_name||'未填';
    const sum = Number(p.paid_amount||0);
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
  // 按 金额×逾期天数 加权排序
  const arr = projects
    .filter(p=> p.final_date && unpaidAmt(p)>0)
    .map(p=>{
      const days = Math.max(0, Math.floor((today - new Date(p.final_date).getTime())/86400000));
      return { p, days, weight: unpaidAmt(p) * days };
    })
    .sort((a,b)=> b.weight - a.weight);

  arr.forEach(({p,days})=>{
    const li=document.createElement('div'); li.className='list-item';
    li.innerHTML = `<div>${p.title||'未命名'} / ${p.producer_name||'未填'}</div>
                    <div>${money(unpaidAmt(p))} / ${days}天</div>`;
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

/* ============= 导航 ============= */
document.getElementById('go-list')?.addEventListener('click', ()=> showView('projects'));
nav.home.addEventListener('click',    ()=> showView('home'));
nav.projects.addEventListener('click', ()=> showView('projects'));
nav.gallery.addEventListener('click',  ()=> showView('gallery'));
nav.finance.addEventListener('click',  ()=> showView('finance'));
nav.schedule.addEventListener('click', ()=> { showView('schedule'); renderCalendar(); });

/* ============= 新建项目 ============= */
const mNew = document.getElementById('new-modal');
document.getElementById('btn-new')?.addEventListener('click', ()=> mNew.classList.add('show'));
document.getElementById('new-cancel')?.addEventListener('click', ()=> mNew.classList.remove('show'));
document.getElementById('new-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target); const row = Object.fromEntries(fd.entries());
  row.clips = Number(row.clips||1);
  row.quote_amount   = Number(row.quote_amount||0);
  row.paid_amount    = Number(row.paid_amount||0);
  row.deposit_amount = 0;
  row.notes = stringifyNotes({ tags:['#P3'], versions:{A:'v1',B:'v1',F:'v1'}, changes:[], free:'' });
  const { error } = await supa.from('projects').insert(row);
  if(error){ alert(error.message); return; }
  mNew.classList.remove('show');
  await fetchProjects(); renderAll();
});

/* ============= 上传弹窗 ============= */
const upModal  = document.getElementById('upload-modal');
const upForm   = document.getElementById('upload-form');
const upPoster = document.getElementById('up-poster');
const upVideo  = document.getElementById('up-video');
const upTip    = document.getElementById('up-tip');
document.getElementById('upload-close')?.addEventListener('click', ()=> upModal.classList.remove('show'));
document.getElementById('upload-cancel')?.addEventListener('click', ()=> upModal.classList.remove('show'));
function openUploadModal(id){ upForm.setAttribute('data-id',id); upPoster.value=''; upVideo.value=''; upTip.textContent=''; upModal.classList.add('show'); }

upForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id = upForm.getAttribute('data-id');
  const poster = upPoster.files?.[0] || null;
  const video = upVideo.files?.[0] || null;
  if(!poster && !video){ upTip.textContent='请选择文件'; return; }
  upTip.textContent='上传中...';

  try{
    let posterUrl=null, videoUrl=null;
    if(poster){ posterUrl = await uploadToBucket(`projects/${id}/poster-${Date.now()}.${extOf(poster.name,'png')}`, poster); }
    if(video){ videoUrl = await uploadToBucket(`projects/${id}/final-${Date.now()}.${extOf(video.name,'mp4')}`, video); }
    const patch={}; if(posterUrl) patch.poster_url = posterUrl; if(videoUrl) patch.final_link = videoUrl;
    if(Object.keys(patch).length) await supa.from('projects').update(patch).eq('id', id);
    upTip.textContent='上传完成';
    upModal.classList.remove('show');
    await fetchProjects(); renderAll();
  }catch(err){ console.error(err); upTip.textContent='上传失败：'+(err?.message||''); }
});

/* ============= Storage 工具 ============= */
function extOf(name, fallback){ const m = /\.[a-z0-9]+$/i.exec(name||''); return m? m[0].slice(1) : fallback; }
async function uploadToBucket(path, file){
  const { data, error } = await supa.storage.from('media').upload(path, file, { upsert:true });
  if(error){ throw error; }
  const { data:pub } = supa.storage.from('media').getPublicUrl(path);
  return pub?.publicUrl || null;
}

/* ============= 渲染整页 ============= */
function renderAll(){
  renderKpis();
  renderRecent();
  renderProjects();
  renderGallery();
  renderFinance();
}

/* ============= 启动 ============= */
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
