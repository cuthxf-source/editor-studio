/* editor-studio / app.js  v1.5.2 */
const APP_VERSION = 'V1.5.2';

/* Supabase */
const supa = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

/* 主题 */
const rootEl = document.documentElement;
const themeBtn = document.getElementById('btn-theme');
function applyTheme(t){ rootEl.setAttribute('data-theme',t); if(themeBtn) themeBtn.textContent=(t==='dark'?'浅色':'深色'); localStorage.setItem('theme',t); }
(function(){ const saved=localStorage.getItem('theme'); const sys=matchMedia('(prefers-color-scheme: dark)').matches; applyTheme(saved || (sys?'dark':'light')); })();
themeBtn?.addEventListener('click',()=> applyTheme(rootEl.getAttribute('data-theme')==='dark'?'light':'dark'));

/* 视图与登录 */
const $ = (id)=> document.getElementById(id);
const views={auth:$('view-auth'),home:$('view-home'),projects:$('view-projects'),schedule:$('view-schedule'),gallery:$('view-gallery'),finance:$('view-finance')};
const nav={home:$('btn-home'),projects:$('btn-projects'),schedule:$('btn-schedule'),gallery:$('btn-gallery'),finance:$('btn-finance'),logout:$('btn-logout')};
function showView(name){ Object.values(views).forEach(v=>v.classList.add('hidden')); (views[name]||views.home).classList.remove('hidden'); document.querySelectorAll('.nav-btn').forEach(b=>b.removeAttribute('aria-current')); ({home:nav.home,projects:nav.projects,schedule:nav.schedule,gallery:nav.gallery,finance:nav.finance}[name])?.setAttribute('aria-current','page'); }
const authForm=$('auth-form'), authTip=$('auth-tip');
nav.logout.addEventListener('click', async ()=>{ await supa.auth.signOut(); showView('auth'); });
authForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email=$('email').value.trim(), password=$('password').value.trim();
  let { error } = await supa.auth.signInWithPassword({ email, password });
  if(error){ const { error: signUpErr } = await supa.auth.signUp({ email, password }); if(signUpErr){ authTip.textContent=signUpErr.message; return; } }
  const { data:{ session } } = await supa.auth.getSession();
  if(session){ await bootAfterAuth(); showView('home'); }
});

/* 数据 */
let projects=[];
async function fetchProjects(){
  const { data, error } = await supa
    .from('projects')
    .select(`id,title,brand,type,spec,clips,notes,pay_status,quote_amount,deposit_amount,paid_amount,producer_name,producer_contact,a_copy,b_copy,final_date,final_link,poster_url,updated_at`)
    .order('updated_at',{ ascending:false })
    .limit(1000);
  if(error){ console.error(error); return; }
  projects = data || [];
}

/* Notes & 优先级 */
function parseNotes(notes){
  const base={tags:new Set(),versions:{A:'v1',B:'v1',F:'v1'},changes:[],free:'',priority:'P3'};
  if(!notes) return base;
  try{
    const obj=JSON.parse(notes);
    if(obj) return {tags:new Set(Array.isArray(obj.tags)?obj.tags:[]),versions:obj.versions||{A:'v1',B:'v1',F:'v1'},changes:Array.isArray(obj.changes)?obj.changes:[],free:obj.free||'',priority:obj.priority||'P3'};
  }catch(e){}
  const tags=new Set((notes.match(/#[A-Z_]+/g)||[]));
  return {tags,versions:{A:'v1',B:'v1',F:'v1'},changes:[],free:notes,priority:'P3'};
}
function stringifyNotes(o){ return JSON.stringify({tags:Array.from(o.tags||[]),versions:o.versions||{A:'v1',B:'v1',F:'v1'},changes:o.changes||[],free:o.free||'',priority:o.priority||'P3'}); }
function hasTag(n,t){ return parseNotes(n).tags.has(t); }
function getPriority(p){ return parseNotes(p.notes).priority||'P3'; }
function priRank(code){ return ({P1:0,P2:1,P3:2,P4:3})[code] ?? 2; }
function priObj(code){ const map={P1:{k:'P1',txt:'紧急且重要',cls:'pri-p1'},P2:{k:'P2',txt:'重要不紧急',cls:'pri-p2'},P3:{k:'P3',txt:'次要一般',cls:'pri-p3'},P4:{k:'P4',txt:'观察排期',cls:'pri-p4'}}; return map[code] || map.P3; }

/* 工具 */
const money = n => `¥${(Number(n||0)).toLocaleString()}`;
const moneyAbbr = n => {
  const v = Number(n||0);
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if(a >= 1e6) return sign + '¥' + (a/1e6).toFixed(a % 1e6 === 0 ? 0 : 1) + 'M';
  if(a >= 1e3) return sign + '¥' + (a/1e3).toFixed(a % 1e3 === 0 ? 0 : 1) + 'K';
  return sign + '¥' + Math.round(a);
};
const fmt = d => d? new Date(d): null;
function parseSpec(specStr){
  const s=specStr||''; let json=null;
  try{ if(s.trim().startsWith('{')||s.trim().startsWith('[')) json=JSON.parse(s);}catch(e){json=null;}
  if(json){ const combos=Array.isArray(json)?json:(json.combos||[]); return {json:true,combos}; }
  const raw=s.split('·').map(x=>x.trim()); let res=raw[0]||'', ratio=raw[1]||''; if(!ratio && res.includes(':')){ratio=res; res='';}
  return {json:false,combos:[{type:'',clips:1,res,ratios:ratio?[ratio]:[]}]};
}
function typeSpecLines(p){
  const parsed=parseSpec(p.spec);
  if(parsed.json){ return parsed.combos.map(c=>`${c.type||'未填'}×${c.clips||1}${c.res?` · ${c.res}`:''}${c.ratios?.length?` · ${c.ratios.join('/')}`:''}`); }
  const c=parsed.combos[0]||{}; const clips=p.clips?` · ${p.clips}条`:''; const type=p.type||''; const r=c.ratios?.length?` · ${c.ratios.join('/')}`:(c.ratio?` · ${c.ratio}`:''); const rr=c.res?` · ${c.res}`:''; const joined=[type,rr.replace(' · ','').trim()].filter(Boolean).join(' · '); return [(joined?joined:'—')+clips+(r||'')];
}
function totalClipsOf(p){ const parsed=parseSpec(p.spec); return parsed.json? parsed.combos.reduce((s,c)=>s+Number(c.clips||0),0) || Number(p.clips||0) || 0 : Number(p.clips||0)||0; }
function unpaidAmt(p){ return Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0),0); }
function stageInfo(p){
  const d=parseNotes(p.notes);
  const A=!hasTag(p.notes,'#A_DONE'), B=!hasTag(p.notes,'#B_DONE'), F=!hasTag(p.notes,'#F_DONE');
  if(A) return {name:'Acopy',percent:30,version:d.versions.A||'v1'};
  if(B) return {name:'Bcopy',percent:60,version:d.versions.B||'v1'};
  if(F) return {name:'Final',percent:80,version:d.versions.F||'v1'};
  return {name:'完结',percent:85,version:''};
}
function nearestMilestone(p){
  const today=new Date(); today.setHours(0,0,0,0);
  const A=fmt(p.a_copy), B=fmt(p.b_copy), F=fmt(p.final_date);
  const doneA=hasTag(p.notes,'#A_DONE'), doneB=hasTag(p.notes,'#B_DONE'), doneF=hasTag(p.notes,'#F_DONE');
  const items=[]; if(A && !doneA) items.push({k:'Acopy',date:A}); if(B && !doneB) items.push({k:'Bcopy',date:B}); if(F && !doneF) items.push({k:'Final',date:F});
  if(items.length===0){
    const past=[{k:'Acopy',date:A,done:doneA},{k:'Bcopy',date:B,done:doneB},{k:'Final',date:F,done:doneF}].filter(x=>x.date).sort((a,b)=>b.date-a.date)[0];
    if(!past) return {text:'—',overdue:false,date:null,k:null};
    const overdue=past.date<today&&!past.done;
    return {text:`${past.k} - ${past.date.getMonth()+1}/${past.date.getDate()}`, overdue, date:past.date, k:past.k};
  }
  items.sort((a,b)=> a.date-b.date);
  const n=items[0];
  return { text:`${n.k} - ${n.date.getMonth()+1}/${n.date.getDate()}`, overdue:n.date<today, date:n.date, k:n.k };
}

/* 首页：最近项目（能量条直显） */
function renderRecent(){
  const box=$('recent-list'); box.innerHTML='';
  const weighted = projects.map(p=>{
    const n=nearestMilestone(p);
    let w=1e15; if(n.date){ const now=new Date(); const diff=n.date-now; w=(diff>=0?diff:Math.abs(diff)+1e12); }
    return {p, w, pri: priRank(getPriority(p))};
  }).sort((a,b)=> a.pri-b.pri || a.w-b.w).slice(0,4);

  weighted.forEach(({p})=>{
    const near=nearestMilestone(p), st=stageInfo(p), verTxt=st.version || '—';
    const li=document.createElement('div'); li.className='list-item';
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
        </div>
      </div>
      <div class="count muted small">条数：${totalClipsOf(p)||1}</div>
      <div class="due ${near.overdue?'pill pill-red':'pill'}">${near.text}</div>
      <div class="ver-pill">${verTxt}</div>
    `;
    li.addEventListener('click', ()=> openQuickModal(p.id));
    box.appendChild(li);
  });

  $('go-list')?.addEventListener('click', (e)=>{ e.stopPropagation(); showView('projects'); }, { once:true });
}

/* KPI（首页不显示 as-of；财务页也不再显示截至时间） */
function renderKpis(){
  const total=projects.reduce((s,p)=>s+Number(p.quote_amount||0),0);
  const paid =projects.reduce((s,p)=>s+Number(p.paid_amount||0),0);
  const unpaid=projects.reduce((s,p)=>s+unpaidAmt(p),0);
  const clipDone=projects.reduce((s,p)=> s+(hasTag(p.notes,'#F_DONE')? totalClipsOf(p):0),0);
  const clipAll =projects.reduce((s,p)=> s+totalClipsOf(p),0);
  $('kpi-total').textContent=money(total);
  $('kpi-paid').textContent=money(paid);
  $('kpi-unpaid').textContent=money(unpaid);
  $('kpi-done').textContent=String(clipDone);
  $('kpi-todo').textContent=String(Math.max(clipAll-clipDone,0));
  $('f-total').textContent=money(total);
  $('f-paid').textContent=money(paid);
  $('f-unpaid').textContent=money(unpaid);
  // 删除 f-asof，不再渲染
  const hAsOf=$('home-asof'); if(hAsOf){ hAsOf.textContent=''; hAsOf.style.display='none'; }
}

/* 报价分析器（横向） */
(function initQuote(){
  const typeBase={'LookBook':{price:100,baseSec:15,secRate:0.01},'形象片':{price:3500,baseSec:45,secRate:0.03},'TVC':{price:7000,baseSec:60,secRate:0.03},'纪录片':{price:12000,baseSec:180,secRate:0.005},'微电影':{price:12000,baseSec:180,secRate:0.005}};
  const elType=$('qa-type'), elBase=$('qa-base'), elSecs=$('qa-secs');
  const elCreative=$('qa-creative'), elUrgent=$('qa-urgent'), elRev=$('qa-rev');
  const elMultiToggle=$('qa-multi-toggle'), elMulti=$('qa-multi'), list=$('qa-mc-list'), addBtn=$('qa-mc-add');

  const refreshLabels=()=>{ $('qa-creative-val').textContent=elCreative.value+'%'; $('qa-urgent-val').textContent=elUrgent.value+'%'; };
  ['input','change'].forEach(ev=>{ elCreative.addEventListener(ev,refreshLabels); elUrgent.addEventListener(ev,refreshLabels); });
  refreshLabels();

  function unitPriceBy(type, secs, baseOverride){
    const def=typeBase[type] || {price:0, baseSec:0, secRate:0};
    const base=Number(baseOverride || def.price);
    const over=Math.max(0, Number(secs||0) - def.baseSec);
    const secFactor = over>0 ? Math.pow(1+def.secRate, over) : 1;
    let price = base * secFactor;
    price *= (1 + Number(elCreative.value||0)/100);
    price *= (1 + (Number(elUrgent.value||0)/10)*0.03);
    const extraRev = Math.max(0, Number(elRev.value||0) - 4);
    price *= (1 + extraRev*0.20);
    return Math.round(price);
  }

  function calcSingle(){
    const net = unitPriceBy(elType.value, Number(elSecs.value||0), elBase.value||undefined);
    const gross = Math.round(net * 1.06);
    $('qa-net').textContent   = money(net);
    $('qa-gross').textContent = money(gross);
  }

  function mcRowHTML(idx, c){
    return `
      <div class="h-row" data-idx="${idx}" style="margin:10px 0 0">
        <label>类型
          <select class="mc-type">
            ${['LookBook','形象片','TVC','纪录片','微电影'].map(o=>`<option ${o===(c.type||'LookBook')?'selected':''}>${o}</option>`).join('')}
          </select>
        </label>
        <label>条数 <input class="mc-count" type="number" min="1" value="${c.count||1}"></label>
        <label>时长（秒/每条）<input class="mc-secs" type="number" min="0" step="1" value="${c.secs||0}"></label>
      </div>`;
  }
  function ensureOneRow(){ if(!list.querySelector('[data-idx]')) list.insertAdjacentHTML('beforeend', mcRowHTML(0,{type:'LookBook',count:1,secs:0})); }
  function calcMulti(){
    const rows=[...list.querySelectorAll('[data-idx]')];
    const totalNet = rows.reduce((sum,row)=>{
      const type=row.querySelector('.mc-type').value;
      const count=Number(row.querySelector('.mc-count').value||1);
      const secs =Number(row.querySelector('.mc-secs').value||0);
      return sum + count * unitPriceBy(type, secs);
    },0);
    $('qa-net').textContent   = money(totalNet);
    $('qa-gross').textContent = money(Math.round(totalNet*1.06));
  }
  function calc(){ if(elMultiToggle.checked){ calcMulti(); }else{ calcSingle(); } }

  addBtn?.addEventListener('click',()=>{ const idx=list.querySelectorAll('[data-idx]').length; list.insertAdjacentHTML('beforeend', mcRowHTML(idx,{type:'LookBook',count:1,secs:0})); calc(); });
  elMultiToggle?.addEventListener('change', ()=>{ elMulti.classList.toggle('hidden', !elMultiToggle.checked); if(elMultiToggle.checked){ ensureOneRow(); calcMulti(); } else { calcSingle(); } });
  $('quote-form').addEventListener('input', calc);

  calc(); // 默认单组合
})();

/* 编辑模态与项目表渲染（保持原逻辑） */
const editorModal=$('editor-modal'), editorTitle=$('editor-title'), editorForm=$('editor-form');
const editorClose=$('editor-close'), editorCancel=$('editor-cancel');
function closeEditor(){ editorModal.classList.remove('show'); editorForm.innerHTML=''; }
editorClose?.addEventListener('click',closeEditor); editorCancel?.addEventListener('click',closeEditor);
editorModal?.addEventListener('mousedown',e=>{ if(e.target===editorModal) closeEditor(); });

const TYPE_OPTS=['LookBook','形象片','TVC','纪录片','微电影'];
const RES_OPTS=['1080p','2k','4k'];
const RATIO_OPTS=['16:9','9:16','1:1','4:3','3:4'];
function optionList(opts,selected){ return opts.map(o=>`<option ${o===(selected||'')?'selected':''}>${o}</option>`).join(''); }
function checkboxList(opts,selected){ const s=new Set(selected||[]); return opts.map(o=>`<label class="pill"><input type="checkbox" value="${o}" ${s.has(o)?'checked':''}><span>${o}</span></label>`).join(''); }

function comboRowHTML(idx,c){
  return `<div class="combo-row" data-idx="${idx}">
    <label>类型<select class="combo-type">${optionList(TYPE_OPTS,c.type||'')}</select></label>
    <label>影片条数<input class="combo-clips" type="number" min="1" value="${c.clips||1}"></label>
    <label>分辨率<select class="combo-res">${optionList(RES_OPTS,c.res||'')}</select></label>
    <div class="pill-group ratios-inline">${checkboxList(RATIO_OPTS,c.ratios||[])}</div>
    <div style="margin-left:auto"><button type="button" class="cell-edit combo-del">删除该组合</button></div>
  </div>`;
}

function openEditorModal(kind,id){
  const p=projects.find(x=>String(x.id)===String(id)); if(!p) return;
  editorModal.classList.add('show');
  editorForm.setAttribute('data-kind',kind);
  editorForm.setAttribute('data-id',id);

  if(kind==='producer'){
    editorTitle.textContent='编辑 合作制片';
    editorForm.innerHTML=`<div class="h-row"><label>合作制片（姓名）<input name="producer_name" value="${p.producer_name||''}"></label><label>合作制片（联系方式）<input name="producer_contact" value="${p.producer_contact||''}"></label></div>`;
  }

  if(kind==='spec'){
    editorTitle.textContent='编辑 影片类型 & 条数 & 规格（可多组合）';
    const parsed=parseSpec(p.spec);
    const combos=parsed.json?parsed.combos:[{type:p.type||'',clips:p.clips||1,res:(parsed.combos?.[0]||{}).res||'',ratios:(parsed.combos?.[0]||{}).ratios||[]}];
    const rows=combos.map((c,idx)=> comboRowHTML(idx,c)).join('');
    editorForm.innerHTML=`<div id="combo-list">${rows}</div><div style="margin-top:10px"><button type="button" id="add-combo" class="cell-edit">新增组合</button></div>`;
    editorForm.addEventListener('click',e=>{
      const add=e.target.closest('#add-combo'); const del=e.target.closest('.combo-del');
      if(add){ const list=editorForm.querySelector('#combo-list'); const idx=list.querySelectorAll('.combo-row').length; list.insertAdjacentHTML('beforeend', comboRowHTML(idx,{type:'LookBook',clips:1,res:'1080p',ratios:['16:9']})); }
      if(del){ del.closest('.combo-row')?.remove(); }
    }, { once:false });
  }

  if(kind==='progress'){
    editorTitle.textContent='编辑 进度（完成标记 / 小版本号）';
    const d=parseNotes(p.notes);
    editorForm.innerHTML=`<div class="h-row">
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
      <label>Acopy 小版本<select name="ver_A">${optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], d.versions.A||'v1')}</select></label>
      <label>Bcopy 小版本<select name="ver_B">${optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], d.versions.B||'v1')}</select></label>
      <label>Final 小版本<select name="ver_F">${optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], d.versions.F||'v1')}</select></label>
    </div>`;
  }

  if(kind==='money'){
    editorTitle.textContent='编辑 金额';
    editorForm.innerHTML=`<div class="h-row"><label>总金额<input name="quote_amount" type="number" min="0" step="0.01" value="${p.quote_amount||0}"></label><label>已收款<input name="paid_amount" type="number" min="0" step="0.01" value="${p.paid_amount||0}"></label></div>`;
  }

  if(kind==='changes'){
    editorTitle.textContent='修改内容';
    const d=parseNotes(p.notes);
    const st=stageInfo(p);
    const history=[...(d.changes||[])].sort((a,b)=>b.ts-a.ts);
    const histHTML = history.length? history.map(x=>{
      const dt=new Date(x.ts||Date.now());
      const time=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
      const imgs=Array.isArray(x.imgs)? x.imgs.map(u=>`<img class="tiny-thumb img-thumb" src="${u}" data-full="${u}" title="点击查看">`).join(''):'';
      return `<div class="list-item edit-change" data-ts="${x.ts}">
        <div class="small muted">[${x.phase} · ${x.version}] · ${time}</div>
        <div>${(x.text||'').replace(/</g,'&lt;')}</div>
        ${imgs?`<div class="thumb-list" style="margin-top:6px">${imgs}</div>`:''}
      </div>`;
    }).join('') : `<div class="muted small">暂无历史记录</div>`;

    editorForm.innerHTML = `
      <input type="hidden" name="edit_ts" value="">
      <div class="card" style="margin-bottom:10px">
        <div class="section-head"><h3>本次修改（粘贴图片）</h3></div>
        <div class="h-row">
          <label>关联阶段
            <select name="chg_phase">${['Acopy','Bcopy','Final'].map(s=>`<option ${s===(st.name==='完结'?'Final':st.name)?'selected':''}>${s}</option>`).join('')}</select>
          </label>
          <label>小版本号
            <select name="chg_version">${optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], st.name==='Acopy'?d.versions.A:st.name==='Bcopy'?d.versions.B:d.versions.F)}</select>
          </label>
          <label>系统版本（只读）<input type="text" value="${APP_VERSION}" disabled></label>
        </div>
        <label style="margin-top:8px">修改内容（文本）
          <textarea name="chg_text" rows="4" id="chg_text" placeholder="填写本次修改点。下方粘贴图片（⌘V / Ctrl+V）"></textarea>
        </label>
        <label style="margin-top:8px">粘贴图片框
          <textarea id="chg_paste" rows="3" placeholder="这里粘贴图片即可，支持多张"></textarea>
        </label>
        <div id="chg_preview" class="thumb-list" style="margin-top:6px"></div>
      </div>
      <div class="card" style="margin-top:10px">
        <div class="section-head"><h3>历史修改记录（点击一条进入编辑）</h3></div>
        <div class="list">${histHTML}</div>
      </div>
    `;

    // 粘贴图片 → 临时文件集合
    const pasteBox=editorForm.querySelector('#chg_paste'), prev=editorForm.querySelector('#chg_preview');
    let pendingFiles=[];
    pasteBox?.addEventListener('paste',e=>{
      const items=e.clipboardData?.items||[];
      for(const it of items){
        if(it.type?.startsWith('image/')){
          const f=it.getAsFile();
          if(f){ pendingFiles.push(new File([f],`paste-${Date.now()}-${Math.random().toString(16).slice(2)}.png`,{type:f.type||'image/png'})); renderPrev(); }
          e.preventDefault();
        }
      }
    });
    function renderPrev(){ prev.innerHTML=''; pendingFiles.forEach(f=>{ const img=document.createElement('img'); img.className='tiny-thumb'; const rd=new FileReader(); rd.onload=()=>img.src=rd.result; rd.readAsDataURL(f); prev.appendChild(img); }); }
    editorForm._pendingFiles = pendingFiles;

    // 点击历史 → 回填编辑
    editorForm.addEventListener('click',e=>{
      const item = e.target.closest('.edit-change');
      if(!item) return;
      const ts = item.getAttribute('data-ts');
      const row = projects.find(x=>String(x.id)===String(id));
      if(!row) return;
      const d2=parseNotes(row.notes);
      const rec=(d2.changes||[]).find(x=> String(x.ts)===String(ts));
      if(!rec) return;
      editorForm.querySelector('select[name="chg_phase"]').value = rec.phase;
      editorForm.querySelector('select[name="chg_version"]').value = rec.version;
      editorForm.querySelector('#chg_text').value = rec.text||'';
      editorForm.querySelector('input[name="edit_ts"]').value = String(rec.ts);
    });
  }
}

editorForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id   = editorForm.getAttribute('data-id');
  const kind = editorForm.getAttribute('data-kind');
  const fd   = new FormData(editorForm);
  let patch = {};

  if(kind==='producer'){ patch.producer_name=(fd.get('producer_name')||'').toString().trim(); patch.producer_contact=(fd.get('producer_contact')||'').toString().trim(); }

  if(kind==='spec'){
    const rows=[...editorForm.querySelectorAll('.combo-row')];
    const combos=rows.map(row=>{
      const type=row.querySelector('.combo-type').value;
      const clips=Number(row.querySelector('.combo-clips').value||1);
      const res=row.querySelector('.combo-res').value;
      const ratios=[...row.querySelectorAll('.pill-group input[type="checkbox"]:checked')].map(i=>i.value);
      return { type, clips, res, ratios };
    }).filter(x=>x.type);
    if(combos.length){ patch.spec=JSON.stringify({combos}); patch.type=combos[0].type; patch.clips=combos[0].clips; }
    else{ patch.spec=''; patch.type=''; patch.clips=1; }
  }

  if(kind==='progress'){
    const a_copy=fd.get('a_copy')||null, b_copy=fd.get('b_copy')||null, final_date=fd.get('final_date')||null;
    const row=projects.find(x=>String(x.id)===String(id));
    let d=parseNotes(row?.notes||'');
    d={...d, versions:{ A:fd.get('ver_A')||d.versions.A||'v1', B:fd.get('ver_B')||d.versions.B||'v1', F:fd.get('ver_F')||d.versions.F||'v1' }};
    const tags=new Set(d.tags||[]);
    if(fd.get('A_DONE')) tags.add('#A_DONE'); else tags.delete('#A_DONE');
    if(fd.get('B_DONE')) tags.add('#B_DONE'); else tags.delete('#B_DONE');
    if(fd.get('F_DONE')) tags.add('#F_DONE'); else tags.delete('#F_DONE');
    d.tags=Array.from(tags);
    patch={ a_copy:a_copy||null, b_copy:b_copy||null, final_date:final_date||null, notes:stringifyNotes(d) };
  }

  if(kind==='money'){ patch.quote_amount=Number(fd.get('quote_amount')||0); patch.paid_amount=Number(fd.get('paid_amount')||0); }

  if(kind==='changes'){
    const row=projects.find(x=>String(x.id)===String(id));
    let d=parseNotes(row?.notes||'');
    const phase=(fd.get('chg_phase')||'Final').toString();
    const version=(fd.get('chg_version')||'v1').toString();
    const text=(fd.get('chg_text')||'').toString().trim();
    const editTs=(fd.get('edit_ts')||'').toString().trim();
    const files=editorForm._pendingFiles||[];
    let urls=[];

    for(let i=0;i<files.length;i++){
      const f=files[i];
      const ext=(f.name.split('.').pop()||'png').toLowerCase();
      const path=`projects/${id}/changes/${Date.now()}-${i}.${ext}`;
      const { error } = await supa.storage.from('attachments').upload(path,f,{upsert:true,contentType:f.type||'image/png'});
      if(!error){ const { data } = supa.storage.from('attachments').getPublicUrl(path); urls.push(data.publicUrl); }
    }

    d.changes = Array.isArray(d.changes)? d.changes : [];

    if(editTs){
      const idx=d.changes.findIndex(x=> String(x.ts)===String(editTs));
      if(idx>=0){
        d.changes[idx].phase   = phase;
        d.changes[idx].version = version;
        d.changes[idx].text    = text;
        d.changes[idx].imgs    = Array.isArray(d.changes[idx].imgs)? d.changes[idx].imgs : [];
        d.changes[idx].imgs.push(...urls);
        d.changes[idx].appVer  = APP_VERSION;
      }
    }else{
      if(text || urls.length){
        d.changes.push({ phase, version, text, imgs:urls, ts: Date.now(), appVer: APP_VERSION });
      }
    }

    patch.notes = stringifyNotes(d);
  }

  await supa.from('projects').update(patch).eq('id', id);
  closeEditor();
  await fetchProjects(); renderAll();
});

/* 项目表 */
function formatProgressCell(p){
  const vers=parseNotes(p.notes).versions;
  const near=nearestMilestone(p);
  const doneF=hasTag(p.notes,'#F_DONE');
  if(doneF && p.final_date){
    const d=new Date(p.final_date);
    return `<span class="pill">完结</span> <span class="small">- ${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}</span>`;
  }
  if(!near||!near.k||!near.date) return '—';
  const mm=String(near.date.getMonth()+1).padStart(2,'0');
  const dd=String(near.date.getDate()).padStart(2,'0');
  const small=near.k==='Acopy'? (vers.A||'v1') : near.k==='Bcopy'? (vers.B||'v1') : (vers.F||'v1');
  return `<span class="pill">${near.k}</span> <span class="small">- ${mm}.${dd} - ${small}</span>`;
}
function renderRow(p){
  const tr=document.createElement('tr');
  const pay = p.pay_status || (unpaidAmt(p)<=0 ? '已收尾款' : (Number(p.paid_amount||0)>0?'已收定金':'未收款'));
  const moneyText=`${moneyAbbr(p.quote_amount)} / ${moneyAbbr(p.paid_amount)}`;
  const d=parseNotes(p.notes);
  const last=[...(d.changes||[])].sort((a,b)=>b.ts-a.ts)[0];
  const lastText=last ? `[${last.phase}·${last.version}] ${last.text.slice(0,42)}${last.text.length>42?'…':''}` : '—';
  const thumbs=last?.imgs?.length ? last.imgs.slice(0,4).map(u=>`<img class="tiny-thumb img-thumb" src="${u}" data-full="${u}" title="点击查看">`).join('') : '';
  const pri=priObj(d.priority||'P3');

  const payClass = pay==='未收款' ? 'pill-blue' : (pay==='已收定金' ? 'pill-green' : 'pill-gold');

  const upOk= !!p.poster_url || !!p.final_link;
  const upTxt = upOk ? '已上传' : '未上传';
  const upCls = upOk ? 'pill-green' : 'pill-blue';

  tr.innerHTML = `
    <td contenteditable="true" data-k="title" data-id="${p.id}">${p.title||''}</td>
    <td><div class="cell-summary"><span>${p.producer_name||'未填'}</span>${p.producer_contact?`<span class="muted small">· ${p.producer_contact}</span>`:''}<button class="cell-edit edit-btn" data-kind="producer" data-id="${p.id}">编辑</button></div></td>
    <td><div class="cell-summary"><span class="text-cell">${(typeSpecLines(p).join('<br>'))||'—'}</span><button class="cell-edit edit-btn" data-kind="spec" data-id="${p.id}">编辑</button></div></td>
    <td><div class="cell-summary"><span class="text-cell">${formatProgressCell(p)}</span><button class="cell-edit edit-btn" data-kind="progress" data-id="${p.id}">编辑</button></div></td>
    <td class="col-priority"><div class="cell-summary"><button class="pill ${pri.cls} pri-toggle" data-id="${p.id}" title="点击切换优先级">${pri.k}·${pri.txt}</button></div></td>
    <td class="col-pay"><div class="cell-summary"><button class="pill ${payClass} pay-pill" data-id="${p.id}" data-st="${pay}">${pay}</button></div></td>
    <td><div class="cell-summary"><span class="muted text-cell">${moneyText}</span><button class="cell-edit edit-btn" data-kind="money" data-id="${p.id}">编辑</button></div></td>
    <td class="col-changes"><div class="cell-summary"><span class="small text-cell">${lastText}</span>${thumbs?`<div class="thumb-list">${thumbs}</div>`:''}<button class="cell-edit edit-btn" data-kind="changes" data-id="${p.id}">编辑</button></div></td>
    <td class="col-upload"><div class="cell-summary"><button class="pill ${upCls} upload-pill" data-id="${p.id}">${upTxt}</button></div></td>
  `;
  return tr;
}
function bindTable(tb){
  if(tb._bound) return;
  tb.addEventListener('blur', async e=>{
    const td=e.target.closest('td[contenteditable="true"]'); if(!td) return;
    const id=td.getAttribute('data-id'); const k=td.getAttribute('data-k'); const v=td.textContent.trim();
    if(!id||!k) return;
    const patch={}; patch[k]=v;
    await supa.from('projects').update(patch).eq('id', id);
  }, true);

  tb.addEventListener('click', async e=>{
    const btn=e.target.closest('.edit-btn');
    const pri=e.target.closest('.pri-toggle');
    const img=e.target.closest('.img-thumb');
    const up=e.target.closest('.upload-pill');
    const payBtn=e.target.closest('.pay-pill');
    if(btn){ openEditorModal(btn.getAttribute('data-kind'), btn.getAttribute('data-id')); }
    if(pri){ const id=pri.getAttribute('data-id'); const row=projects.find(x=>String(x.id)===String(id)); if(!row) return; const d=parseNotes(row.notes); d.priority=d.priority==='P1'?'P2':d.priority==='P2'?'P3':d.priority==='P3'?'P4':'P1'; await supa.from('projects').update({notes:stringifyNotes(d)}).eq('id',id); await fetchProjects(); renderProjects(); }
    if(img){ openImgbox(img.getAttribute('data-full')); }
    if(up){ openUploadModal(up.getAttribute('data-id')); }
    if(payBtn){
      const id=payBtn.getAttribute('data-id');
      const cur=payBtn.getAttribute('data-st');
      const next = cur==='未收款' ? '已收定金' : (cur==='已收定金' ? '已收尾款' : '未收款');
      await supa.from('projects').update({ pay_status: next }).eq('id', id);
      payBtn.setAttribute('data-st', next);
      payBtn.textContent = next;
      payBtn.classList.remove('pill-blue','pill-green','pill-gold');
      payBtn.classList.add(next==='未收款'?'pill-blue':(next==='已收定金'?'pill-green':'pill-gold'));
      const row=projects.find(x=> String(x.id)===String(id)); if(row){ row.pay_status=next; }
      renderProjects();
    }
  });

  tb._bound = true;
}
function shrinkOverflowCells(tb){
  tb.querySelectorAll('td .text-cell').forEach(el=>{
    const td=el.closest('td'); if(!td) return;
    if(td.scrollWidth > td.clientWidth || el.scrollWidth > td.clientWidth){ td.classList.add('shrink'); }
    else{ td.classList.remove('shrink'); }
  });
}
function renderProjects(){
  const body=$('projects-body'), cbody=$('completed-body');
  body.innerHTML=''; cbody.innerHTML='';
  const completed=projects.filter(p=> (p.pay_status||'')==='已收尾款');
  const incompleted=projects.filter(p=> (p.pay_status||'')!=='已收尾款');

  incompleted.sort((a,b)=> priRank(getPriority(a))-priRank(getPriority(b)) || new Date(b.updated_at)-new Date(a.updated_at));
  completed.sort((a,b)=> priRank(getPriority(a))-priRank(getPriority(b)) || new Date(b.updated_at)-new Date(a.updated_at));

  incompleted.forEach(p=> body.appendChild(renderRow(p)));
  completed.forEach(p=> cbody.appendChild(renderRow(p)));
  bindTable(body); bindTable(cbody);
  shrinkOverflowCells(body); shrinkOverflowCells(cbody);
}

/* 快速查看 */
function openQuickModal(id){
  const qModal=$('quick-modal'), qTitle=$('quick-title'), qBody=$('quick-body'), qFinalBtn=$('quick-final-done');
  const p=projects.find(x=>String(x.id)===String(id)); if(!p) return;
  const st=stageInfo(p);
  qTitle.textContent=`${p.title||'未命名'}${p.brand?` · ${p.brand}`:''}`;
  qBody.innerHTML=`<div class="grid-1"><div>合作制片：${[p.producer_name,p.producer_contact].filter(Boolean).join(' · ')||'—'}</div><div class="small muted">规格：${(parseSpec(p.spec).json? typeSpecLines(p).join('，') : typeSpecLines(p)[0])||'—'}</div><div class="small muted">节点：${[p.a_copy?`Acopy ${p.a_copy}`:'', p.b_copy?`Bcopy ${p.b_copy}`:'', p.final_date?`Final ${p.final_date}`:''].filter(Boolean).join(' ｜ ')||'—'}</div><div style="margin-top:8px" class="pmeta"><div class="prog" style="flex:1"><div class="prog-bar" style="width:${st.percent}%"></div><span class="prog-text">${st.percent}%</span></div></div></div>`;
  $('quick-close')?.addEventListener('click',()=>{ qModal.classList.remove('show'); qBody.innerHTML=''; }, { once:true });
  qFinalBtn.onclick=async ()=>{ const row=projects.find(x=>String(x.id)===String(id)); const d=parseNotes(row?.notes||''); d.tags.add('#F_DONE'); await supa.from('projects').update({ notes: stringifyNotes(d) }).eq('id', id); await fetchProjects(); renderAll(); qModal.classList.remove('show'); qBody.innerHTML=''; };
  qModal.classList.add('show');
}

/* 作品合集：改回“靠近首帧”的自动抽帧 */
const thumbCache=new Map();
function captureVideoAutoFrame(url){
  return new Promise((resolve)=>{
    try{
      const v=document.createElement('video');
      v.crossOrigin='anonymous'; v.muted=true; v.playsInline=true; v.preload='metadata';
      v.src=url;
      v.addEventListener('loadedmetadata',()=>{
        const t = isFinite(v.duration) && v.duration>0 ? Math.min(0.1, v.duration*0.05) : 0.1;
        v.currentTime = t; // 靠近首帧
      }, { once:true });
      v.addEventListener('seeked',()=>{
        try{
          const canvas=document.createElement('canvas');
          canvas.width=v.videoWidth||1280; canvas.height=v.videoHeight||720;
          const ctx=canvas.getContext('2d'); ctx.drawImage(v,0,0,canvas.width,canvas.height);
          const data=canvas.toDataURL('image/jpeg',0.85);
          resolve(data);
        }catch(e){ resolve(null); }
      }, { once:true });
      v.addEventListener('error',()=> resolve(null), { once:true });
      v.addEventListener('timeupdate',()=>{ resolve(null); }, { once:true });
    }catch(e){ resolve(null); }
  });
}
async function getCoverFor(p){
  if(p.poster_url) return p.poster_url;
  if(thumbCache.has(p.final_link)) return thumbCache.get(p.final_link);
  let cover=null;
  if(p.final_link){
    if(/\.(png|jpe?g|webp)$/i.test(p.final_link)) cover=p.final_link;
    else if(/\.(mp4|mov|m4v|webm|ogg)$/i.test(p.final_link)) cover=await captureVideoAutoFrame(p.final_link);
  }
  if(!cover){
    cover='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#f2f2f7"/><stop offset="1" stop-color="#e9ecef"/></linearGradient></defs><rect fill="url(#g)" width="1600" height="900"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="64" fill="#999">No Cover</text></svg>`);
  }
  thumbCache.set(p.final_link, cover); return cover;
}
async function renderGallery(){
  const grid=$('gallery-grid'); grid.innerHTML='';
  const finals=projects.filter(p=>p.final_link);
  if(finals.length===0){
    const ph=document.createElement('div'); ph.className='mag-card'; ph.innerHTML=`<div class="mag-cap">暂未上传成片，请在项目中上传海报或视频</div>`; grid.appendChild(ph); return;
  }
  for(let i=0;i<finals.length;i++){
    const p=finals[i];
    const a=document.createElement('a'); a.className='mag-card'; a.href=p.final_link; a.target='_blank';
    if(Math.random()<0.3) a.classList.add('mag-span2');
    const cover=await getCoverFor(p);
    a.innerHTML = `<img class="mag-cover" src="${cover}" alt=""><div class="mag-cap">${p.title||'未命名'}${p.brand?` · ${p.brand}`:''}</div>`;
    grid.appendChild(a);
  }
}

/* 日历：仅边框 + 多色（按项目 id 哈希） */
const gridEl  = $('cal-grid');
const labelEl = $('cal-label');
let calBase=new Date(); calBase.setDate(1);
$('cal-prev').addEventListener('click', ()=>{ calBase.setMonth(calBase.getMonth()-1); renderCalendar(); });
$('cal-next').addEventListener('click', ()=>{ calBase.setMonth(calBase.getMonth()+1); renderCalendar(); });
function colorIndexForId(id){
  let s=0; const str=String(id||'0');
  for(let i=0;i<str.length;i++){ s=(s*31 + str.charCodeAt(i)) >>> 0; }
  return s % 8; // 对应 .c0 ~ .c7
}
function renderCalendar(){
  gridEl.innerHTML=''; const y=calBase.getFullYear(), m=calBase.getMonth();
  labelEl.textContent=`${y}年 ${m+1}月`;
  const first=new Date(y,m,1), start=(first.getDay()+6)%7, days=new Date(y,m+1,0).getDate();
  const dayCells=Array.from({length:days+1},()=>null);
  for(let i=0;i<42;i++){
    const cell=document.createElement('div'); cell.className='cal-cell';
    const day=i-start+1;
    if(day>0 && day<=days){ const head=document.createElement('div'); head.className='cal-day'; head.textContent=String(day); cell.appendChild(head); dayCells[day]=cell; }
    gridEl.appendChild(cell);
  }
  projects.forEach(p=>{
    const vers=parseNotes(p.notes).versions||{A:'v1',B:'v1',F:'v1'};
    const A=fmt(p.a_copy), B=fmt(p.b_copy), F=fmt(p.final_date);
    const spans=[];
    if(A && B) spans.push({k:'a',label:'Acopy',ver:vers.A,s:new Date(A),e:new Date(B.getTime()-86400000)});
    if(B && F) spans.push({k:'b',label:'Bcopy',ver:vers.B,s:new Date(B),e:new Date(F.getTime()-86400000)});
    if(F) spans.push({k:'f',label:'Final',ver:vers.F,s:new Date(F),e:new Date(F)});
    spans.forEach(sp=>{
      const monStart=new Date(y,m,1), monEnd=new Date(y,m,days);
      let s=sp.s, e=sp.e; if(e<monStart || s>monEnd) return; if(s<monStart) s=monStart; if(e>monEnd) e=monEnd;
      const sDay=s.getDate(), eDay=e.getDate();
      for(let d=sDay; d<=eDay; d++){
        const line=document.createElement('div'); line.className='bar-line';
        const ci=colorIndexForId(p.id); const piece=document.createElement('div'); piece.className=`span-piece c${ci} ${d===sDay?'span-start':''} ${d===eDay?'span-end':''}`;
        if(d===sDay){
          const label=document.createElement('span'); label.className='span-text';
          label.textContent=`${p.title||'未命名'} · ${sp.label}${sp.ver?(' '+sp.ver):''}`;
          piece.appendChild(label);
        }
        line.appendChild(piece);
        dayCells[d]?.appendChild(line);
      }
    });
  });
}

/* 财务 */
function renderFinance(){
  // 排行：最多先显示 5 个，其余折叠；金额 K/M
  const byPartner=new Map();
  projects.forEach(p=>{ const k=p.producer_name||'未填'; byPartner.set(k,(byPartner.get(k)||0)+Number(p.paid_amount||0)); });
  const rp=$('rank-partner'); rp.innerHTML='';
  const partnerRank=[...byPartner.entries()].sort((a,b)=>b[1]-a[1]);
  partnerRank.forEach(([k,v])=>{ const li=document.createElement('div'); li.className='list-item'; li.innerHTML=`<div>${k}</div><strong>${moneyAbbr(v)}</strong>`; rp.appendChild(li); });
  rp.classList.add('collapsed');

  const rq=$('rank-project'); rq.innerHTML='';
  const projRank=[...projects].sort((a,b)=>Number(b.quote_amount||0)-Number(a.quote_amount||0));
  projRank.forEach(p=>{ const li=document.createElement('div'); li.className='list-item'; li.innerHTML=`<div>${p.title||'未命名'}</div><strong>${moneyAbbr(p.quote_amount)}</strong>`; rq.appendChild(li); });
  rq.classList.add('collapsed');

  const aging=$('aging'); aging.innerHTML='';
  const today=Date.now();
  const agingRows = projects
    .filter(p=> p.final_date && unpaidAmt(p)>0)
    .map(p=>({p,days:Math.max(0,Math.floor((today - new Date(p.final_date).getTime())/86400000))}))
    .sort((a,b)=> b.days-a.days || unpaidAmt(b.p)-unpaidAmt(a.p));
  agingRows.forEach(({p,days})=>{
    const li=document.createElement('div'); li.className='list-item';
    li.innerHTML=`<div>${p.title||'未命名'} · ${p.producer_name||'未填'}</div><strong>${moneyAbbr(unpaidAmt(p))} / ${days}天</strong>`;
    aging.appendChild(li);
  });
  aging.classList.add('collapsed');

  // 趋势图：全年（月对比）- 交稿 vs 收款（以可得字段近似：final_date vs updated_at）
  const months=Array.from({length:12},(_,i)=>i); // 0..11
  const year=(new Date()).getFullYear();
  const deliver=new Array(12).fill(0); // 交稿：按 final_date 汇总 quote_amount
  const receive=new Array(12).fill(0); // 收款：按 updated_at 汇总 paid_amount（近似）
  projects.forEach(p=>{
    if(p.final_date){
      const d=new Date(p.final_date);
      if(d.getFullYear()===year){ deliver[d.getMonth()] += Number(p.quote_amount||0); }
    }
    if(p.paid_amount){
      const u=new Date(p.updated_at||Date.now());
      if(u.getFullYear()===year){ receive[u.getMonth()] += Number(p.paid_amount||0); }
    }
  });

  // 旺季/淡季（基于交稿曲线）
  let maxM=0,minM=0;
  for(let i=1;i<12;i++){ if(deliver[i]>deliver[maxM]) maxM=i; if(deliver[i]<deliver[minM]) minM=i; }
  const tags=$('trend-tags');
  tags.textContent = `旺季：${maxM+1}月 ｜ 淡季：${minM+1}月`;

  drawDualTrend($('trend'), months, deliver, receive);
}

/* 双折线渲染（带坐标轴与月刻度） */
function drawDualTrend(container, months, deliver, receive){
  container.innerHTML='';
  const w=container.clientWidth||900, h=container.clientHeight||260, padL=42, padR=10, padT=10, padB=26;
  const maxVal=Math.max(1, ...deliver, ...receive);
  const xStep=(w-padL-padR)/Math.max(months.length-1,1);
  const yOf=v => (h-padB) - (v/maxVal)*(h-padT-padB);

  const toPath = arr => arr.map((v,i)=>`${i?'L':'M'}${(padL+i*xStep).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');

  // 网格 & 轴
  const ticks=5;
  let grid='';
  for(let i=0;i<=ticks;i++){
    const y=padT + (h-padT-padB)*i/ticks;
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(w-padR).toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" opacity="0.08"/>`;
    const val=(maxVal*(1-i/ticks));
    const label = val>=1e6? (val/1e6).toFixed(1)+'M' : val>=1e3? (val/1e3).toFixed(1)+'K' : Math.round(val).toString();
    grid += `<text x="${(padL-6).toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="end">${label}</text>`;
  }

  // 月份刻度
  let xlabels='';
  months.forEach((m,i)=>{
    const x=padL+i*xStep;
    xlabels += `<text x="${x.toFixed(1)}" y="${(h-6).toFixed(1)}" text-anchor="middle">${m+1}</text>`;
  });

  const pathDeliver = toPath(deliver);
  const pathReceive = toPath(receive);

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <g class="grid">${grid}</g>
      <path d="${pathDeliver}" fill="none" stroke="#d29922" stroke-width="2"/>
      <path d="${pathReceive}" fill="none" stroke="#2f81f7" stroke-width="2"/>
      <g class="xlabels">${xlabels}</g>
    </svg>`;
}

/* 上传（保持） */
const uploadModal=$('upload-modal'), uploadForm=$('upload-form'), uploadClose=$('upload-close'), uploadCancel=$('upload-cancel'), upPoster=$('up-poster'), upVideo=$('up-video'), pasteBox=$('paste-box'), upProg=$('up-progress'), upBar=upProg?.querySelector('.prog-bar'), upText=upProg?.querySelector('.prog-text'), upTip=$('up-tip');
let pastedPosterFile=null;
function openUploadModal(id){ uploadForm.setAttribute('data-id',id); upPoster.value=''; upVideo.value=''; pastedPosterFile=null; setProgress(0); upTip.textContent=''; uploadModal.classList.add('show'); }
function closeUploadModal(){ uploadModal.classList.remove('show'); }
uploadClose?.addEventListener('click',closeUploadModal); uploadCancel?.addEventListener('click',closeUploadModal);
uploadModal?.addEventListener('mousedown',e=>{ if(e.target===uploadModal) closeUploadModal(); });
pasteBox?.addEventListener('paste',e=>{ const items=e.clipboardData?.items||[]; for(const it of items){ if(it.type?.startsWith('image/')){ const f=it.getAsFile(); if(f){ pastedPosterFile=new File([f],'pasted.png',{type:f.type||'image/png'}); upTip.textContent='已接收粘贴图片（将作为海报上传）'; } e.preventDefault(); break; } }});
function setProgress(p){ const pct=Math.max(0,Math.min(100,Math.round(p))); if(upBar) upBar.style.width=pct+'%'; if(upText) upText.textContent=pct+'%'; }
function fakeProgressStart(){ let p=5; setProgress(p); const t=setInterval(()=>{ p=Math.min(95,p+Math.random()*7); setProgress(p); },300); return ()=>{ clearInterval(t); setProgress(100); }; }
async function uploadToBucket(path,file){ const {error}=await supa.storage.from('attachments').upload(path,file,{upsert:true,contentType:file.type||undefined}); if(error) throw error; const {data}=supa.storage.from('attachments').getPublicUrl(path); return data.publicUrl; }
function extOf(name,f='dat'){ const i=name.lastIndexOf('.'); return i>=0? name.slice(i+1).toLowerCase(): f; }
uploadForm?.addEventListener('submit',async e=>{
  e.preventDefault(); const id=uploadForm.getAttribute('data-id'); const poster=upPoster.files?.[0]||pastedPosterFile||null; const video=upVideo.files?.[0]||null;
  if(!poster && !video){ upTip.textContent='请选择文件或粘贴图片'; return; }
  const stop=fakeProgressStart();
  try{
    let posterUrl=null, videoUrl=null;
    if(poster){ posterUrl=await uploadToBucket(`projects/${id}/poster-${Date.now()}.${extOf(poster.name,'png')}`,poster); }
    if(video){  videoUrl =await uploadToBucket(`projects/${id}/final-${Date.now()}.${extOf(video.name,'mp4')}`,video); }
    const patch={}; if(posterUrl) patch.poster_url=posterUrl; if(videoUrl) patch.final_link=videoUrl;
    if(Object.keys(patch).length) await supa.from('projects').update(patch).eq('id',id);
    stop(); upTip.textContent='上传完成'; await fetchProjects(); renderAll(); setTimeout(closeUploadModal,300);
  }catch(err){ console.error(err); stop(); upTip.textContent='上传失败：'+(err?.message||''); }
});

/* 折叠/展开按钮（Finance 三个榜单） */
document.addEventListener('click', e=>{
  const btn=e.target.closest('.btn-collapse');
  if(!btn) return;
  const id=btn.getAttribute('data-target');
  const box=$(id);
  if(!box) return;
  const expanded = box.classList.toggle('expanded');
  if(expanded){ box.classList.remove('collapsed'); btn.textContent='收起'; }
  else { box.classList.add('collapsed'); btn.textContent='展开'; }
});

/* 导航 & 启动 */
$('go-list')?.addEventListener('click',()=> showView('projects'));
nav.home.addEventListener('click',()=> showView('home'));
nav.projects.addEventListener('click',()=> showView('projects'));
nav.gallery.addEventListener('click',()=> showView('gallery'));
nav.finance.addEventListener('click',()=> showView('finance'));
nav.schedule.addEventListener('click',()=>{ showView('schedule'); renderCalendar(); });

const mNew=$('new-modal'); $('btn-new')?.addEventListener('click',()=> mNew.classList.add('show')); $('new-cancel')?.addEventListener('click',()=> mNew.classList.remove('show'));
$('new-form')?.addEventListener('submit',async e=>{
  e.preventDefault(); const fd=new FormData(e.target); const row=Object.fromEntries(fd.entries());
  row.clips=Number(row.clips||1); row.quote_amount=Number(row.quote_amount||0); row.paid_amount=Number(row.paid_amount||0); row.deposit_amount=0;
  row.notes=stringifyNotes({tags:[],versions:{A:'v1',B:'v1',F:'v1'},changes:[],free:'',priority:'P3'});
  const { error } = await supa.from('projects').insert(row);
  if(error){ alert(error.message); return; }
  mNew.classList.remove('show'); await fetchProjects(); renderAll();
});

const imgbox=$('imgbox'), imgboxImg=$('imgbox-img'); $('imgbox-close')?.addEventListener('click',()=> imgbox.classList.remove('show')); imgbox?.addEventListener('mousedown',e=>{ if(e.target===imgbox) imgbox.classList.remove('show'); });
function openImgbox(url){ imgboxImg.src=url; imgbox.classList.add('show'); }

function renderAll(){ renderKpis(); renderRecent(); renderProjects(); renderGallery(); renderFinance(); }

async function boot(){ const { data:{ session } } = await supa.auth.getSession(); if(!session){ showView('auth'); return; } await bootAfterAuth(); }
async function bootAfterAuth(){ await fetchProjects(); renderAll(); showView('home'); }
boot();
