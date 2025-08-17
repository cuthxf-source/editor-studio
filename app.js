/* editor-studio / app.js  v1.4.8 */
const APP_VERSION = 'v1.4.8';

/* Supabase */
const supa = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

/* 主题 */
const rootEl = document.documentElement;
const themeBtn = document.getElementById('btn-theme');
function applyTheme(t){ rootEl.setAttribute('data-theme',t); themeBtn.textContent=(t==='dark'?'浅色':'深色'); localStorage.setItem('theme',t); }
(function(){ const saved=localStorage.getItem('theme'); const sys=matchMedia('(prefers-color-scheme: dark)').matches; applyTheme(saved || (sys?'dark':'light')); })();
themeBtn?.addEventListener('click',()=> applyTheme(rootEl.getAttribute('data-theme')==='dark'?'light':'dark'));

/* 视图与登录 */
const views={auth:$('#view-auth'),home:$('#view-home'),projects:$('#view-projects'),schedule:$('#view-schedule'),gallery:$('#view-gallery'),finance:$('#view-finance')};
const nav={home:$('#btn-home'),projects:$('#btn-projects'),schedule:$('#btn-schedule'),gallery:$('#btn-gallery'),finance:$('#btn-finance'),logout:$('#btn-logout')};
function $(id){ return document.getElementById(id); }
function showView(name){ Object.values(views).forEach(v=>v.classList.add('hidden')); (views[name]||views.home).classList.remove('hidden'); document.querySelectorAll('.nav-btn').forEach(b=>b.removeAttribute('aria-current')); ({home:nav.home,projects:nav.projects,schedule:nav.schedule,gallery:nav.gallery,finance:nav.finance}[name])?.setAttribute('aria-current','page'); }
const authForm=$('auth-form'), authTip=$('auth-tip'); nav.logout.addEventListener('click',async()=>{await supa.auth.signOut(); showView('auth');});
authForm?.addEventListener('submit',async e=>{e.preventDefault(); const email=$('email').value.trim(), password=$('password').value.trim(); let {error}=await supa.auth.signInWithPassword({email,password}); if(error){ const {error:signUpErr}=await supa.auth.signUp({email,password}); if(signUpErr){authTip.textContent=signUpErr.message; return;} } const {data:{session}}=await supa.auth.getSession(); if(session){ await bootAfterAuth(); showView('home'); }});

/* 数据 */
let projects=[];
async function fetchProjects(){
  const {data,error}=await supa.from('projects').select(`id,title,brand,type,spec,clips,notes,pay_status,quote_amount,deposit_amount,paid_amount,producer_name,producer_contact,a_copy,b_copy,final_date,final_link,poster_url,updated_at`).order('updated_at',{ascending:false}).limit(1000);
  if(error){console.error(error); return;}
  projects=data||[];
}

/* Notes */
function parseNotes(notes){
  const base={tags:new Set(),versions:{A:'v1',B:'v1',F:'v1'},changes:[],free:'',priority:'P3'};
  if(!notes) return base;
  try{ const obj=JSON.parse(notes); if(obj){ return {tags:new Set(Array.isArray(obj.tags)?obj.tags:[]),versions:obj.versions||{A:'v1',B:'v1',F:'v1'},changes:Array.isArray(obj.changes)?obj.changes:[],free:obj.free||'',priority:obj.priority||'P3'}; } }catch(e){}
  const tags=new Set((notes.match(/#[A-Z_]+/g)||[]));
  return {tags,versions:{A:'v1',B:'v1',F:'v1'},changes:[],free:notes,priority:'P3'};
}
function stringifyNotes(o){ return JSON.stringify({tags:Array.from(o.tags||[]),versions:o.versions||{A:'v1',B:'v1',F:'v1'},changes:o.changes||[],free:o.free||'',priority:o.priority||'P3'}); }
function hasTag(n,t){ return parseNotes(n).tags.has(t); }
function bumpVersion(v){ const n=parseInt(String(v||'v1').replace(/[^\d]/g,''),10)||1; return 'v'+Math.min(n+1,8); }

/* 工具 */
const money=n=>`¥${(Number(n||0)).toLocaleString()}`;
const fmt=d=> d? new Date(d): null;
const PRI_OPTS=[{k:'P1',txt:'紧急且重要',cls:'pri-p1'},{k:'P2',txt:'重要不紧急',cls:'pri-p2'},{k:'P3',txt:'次要一般',cls:'pri-p3'},{k:'P4',txt:'观察排期',cls:'pri-p4'}];
const TYPE_OPTS=['LookBook','形象片','TVC','纪录片','微电影'], RES_OPTS=['1080p','2k','4k'], RATIO_OPTS=['16:9','9:16','1:1','4:3','3:4'];
function getPriority(p){ return parseNotes(p.notes).priority||'P3'; }
function priObj(code){ return PRI_OPTS.find(x=>x.k===code)||PRI_OPTS[2]; }
function optionList(opts,selected){ return opts.map(o=>`<option ${o===(selected||'')?'selected':''}>${o}</option>`).join(''); }
function checkboxList(opts,selected){ const s=new Set(selected||[]); return opts.map(o=>`<label class="pill"><input type="checkbox" value="${o}" ${s.has(o)?'checked':''}><span>${o}</span></label>`).join(''); }
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
  const d=parseNotes(p.notes); const A=!hasTag(p.notes,'#A_DONE'); const B=!hasTag(p.notes,'#B_DONE'); const F=!hasTag(p.notes,'#F_DONE');
  if(A) return {name:'Acopy',percent:30,version:d.versions.A||'v1',badge:'a'};
  if(B) return {name:'Bcopy',percent:60,version:d.versions.B||'v1',badge:'b'};
  if(F) return {name:'Final',percent:80,version:d.versions.F||'v1',badge:'f'};
  return {name:'完结',percent:85,version:'',badge:'done'};
}
function nearestMilestone(p){
  const today=new Date(); today.setHours(0,0,0,0);
  const A=fmt(p.a_copy), B=fmt(p.b_copy), F=fmt(p.final_date);
  const doneA=hasTag(p.notes,'#A_DONE'), doneB=hasTag(p.notes,'#B_DONE'), doneF=hasTag(p.notes,'#F_DONE');
  const items=[]; if(A && !doneA) items.push({k:'Acopy',date:A}); if(B && !doneB) items.push({k:'Bcopy',date:B}); if(F && !doneF) items.push({k:'Final',date:F});
  if(items.length===0){ const past=[{k:'Acopy',date:A,done:doneA},{k:'Bcopy',date:B,done:doneB},{k:'Final',date:F,done:doneF}].filter(x=>x.date).sort((a,b)=>b.date-a.date)[0]; if(!past) return {text:'—',overdue:false,date:null,k:null}; const overdue=past.date<today&&!past.done; return {text:`${past.k} - ${past.date.getMonth()+1}/${past.date.getDate()}`,overdue,date:past.date,k:past.k}; }
  items.sort((a,b)=>a.date-b.date); const n=items[0]; return {text:`${n.k} - ${n.date.getMonth()+1}/${n.date.getDate()}`,overdue:n.date<today,date:n.date,k:n.k};
}
function stageBadgeHTML(name,version){ const map={Acopy:'a',Bcopy:'b',Final:'f',完结:'done'}; const cls=map[name]||'a'; const text=name==='完结'?'完结':`${name}${version?` · ${version}`:''}`; return `<span class="badge badge-${cls}">${text}</span>`; }

/* 首页 */
function renderRecent(){
  const box=$('recent-list'); box.innerHTML='';
  const weighted=projects.map(p=>{const n=nearestMilestone(p); let w=1e15; if(n.date){ const now=new Date(); const diff=n.date-now; w=(diff>=0?diff:Math.abs(diff)+1e12);} return {p,w};}).sort((a,b)=>a.w-b.w).slice(0,4);
  weighted.forEach(({p})=>{
    const near=nearestMilestone(p), st=stageInfo(p); const li=document.createElement('div'); li.className='list-item';
    li.innerHTML=`<div class="pmeta"><div class="title-wrap"><div><strong>${p.title||'未命名'}</strong> ${p.brand?`· ${p.brand}`:''}</div><div class="subtitle">合作制片：${[p.producer_name,p.producer_contact].filter(Boolean).join(' · ')||'—'}</div></div><div class="prog-wrap"><div class="prog" title="${st.name}${st.version?(' '+st.version):''} ${st.percent}%"><div class="prog-bar" style="width:${st.percent}%"></div><span class="prog-text">${st.percent}%</span></div>${stageBadgeHTML(st.name,st.version)}</div></div><div class="count muted small">条数：${totalClipsOf(p)||1}</div><div class="due ${near.overdue?'pill pill-red':'pill'}">${near.text}</div>`;
    li.addEventListener('click',()=>openQuickModal(p.id)); box.appendChild(li);
  });
  $('go-list')?.addEventListener('click',e=>{e.stopPropagation(); showView('projects');},{once:true});
}
function renderKpis(){
  const total=projects.reduce((s,p)=>s+Number(p.quote_amount||0),0);
  const paid =projects.reduce((s,p)=>s+Number(p.paid_amount||0),0);
  const unpaid=projects.reduce((s,p)=>s+unpaidAmt(p),0);
  const clipDone=projects.reduce((s,p)=> s+(hasTag(p.notes,'#F_DONE')? totalClipsOf(p):0),0);
  const clipAll =projects.reduce((s,p)=> s+totalClipsOf(p),0);
  $('kpi-total').textContent=money(total); $('kpi-paid').textContent=money(paid); $('kpi-unpaid').textContent=money(unpaid);
  $('kpi-done').textContent=String(clipDone); $('kpi-todo').textContent=String(Math.max(clipAll-clipDone,0));
  $('f-total').textContent=money(total); $('f-paid').textContent=money(paid); $('f-unpaid').textContent=money(unpaid);
  const t=new Date(); const s=`截至 ${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; $('home-asof').textContent=s; $('f-asof').textContent=s;
}

/* 报价分析器：默认多组合 + 每组难度项 */
(function initQuote(){
  const typeBase={'LookBook':{price:100,baseSec:15,secRate:0.01},'形象片':{price:3500,baseSec:45,secRate:0.03},'TVC':{price:7000,baseSec:60,secRate:0.03},'纪录片':{price:12000,baseSec:180,secRate:0.005},'微电影':{price:12000,baseSec:180,secRate:0.005}};
  const elMultiToggle=$('qa-multi-toggle'), elAdvToggle=$('qa-advanced-toggle');
  const elSingle=$('qa-single'), elMulti=$('qa-multi'), list=$('qa-mc-list'), addBtn=$('qa-mc-add');
  function unitPriceBy(type, secs, opts={}){
    const def=typeBase[type]||{price:0,baseSec:0,secRate:0};
    const base=Number(opts.base||def.price);
    const over=Math.max(0,Number(secs||0)-def.baseSec);
    let price=base*(over>0?Math.pow(1+def.secRate,over):1);
    if(opts.compOn){ price*=1+Number(opts.comp||0)/100; }
    price*=1+Number(opts.creative||0)/100;
    price*=1+(Number(opts.urgent||0)/10)*0.03;
    const extraRev=Math.max(0,Number(opts.rev||4)-4); price*=1+extraRev*0.2;
    return Math.round(price);
  }
  function mcRowHTML(idx,c){
    return `
    <div class="card" data-idx="${idx}" style="margin:10px 0">
      <div class="h-row">
        <label>类型
          <select class="mc-type">${TYPE_OPTS.map(o=>`<option ${o===c.type?'selected':''}>${o}</option>`).join('')}</select>
        </label>
        <label>条数
          <input class="mc-count" type="number" min="1" value="${c.count||1}">
        </label>
        <label>时长（秒/每条）
          <input class="mc-secs" type="number" min="0" step="1" value="${c.secs||0}">
        </label>
        <label>基础价（可填）
          <input class="mc-base" type="number" min="0" step="1" value="${c.base||''}" placeholder="默认">
        </label>
      </div>
      <div class="h-row mc-adv" ${elAdvToggle.checked?'':'style="display:none"'}>
        <label class="pill"><input type="checkbox" class="mc-comp-ck" ${c.compOn?'checked':''}><span>启用合成</span></label>
        <label>合成复杂度（%）
          <input class="mc-comp" type="range" min="0" max="100" step="10" value="${c.comp||0}">
        </label>
        <label>创意密度（%）
          <input class="mc-creative" type="range" min="0" max="100" step="1" value="${c.creative||30}">
        </label>
        <label>紧急系数（%）
          <input class="mc-urgent" type="range" min="0" max="100" step="10" value="${c.urgent||0}">
        </label>
        <label>修改次数
          <input class="mc-rev" type="number" min="0" step="1" value="${c.rev||4}">
        </label>
      </div>
    </div>`;
  }
  function ensureOneRow(){ if(!list.querySelector('[data-idx]')) list.insertAdjacentHTML('beforeend', mcRowHTML(0,{type:'LookBook',count:1,secs:0,creative:30,urgent:0,rev:4,compOn:false,comp:0})); }
  function getRows(){ return [...list.querySelectorAll('[data-idx]')]; }
  function rowOpts(row){
    return {
      base: row.querySelector('.mc-base').value,
      compOn: row.querySelector('.mc-comp-ck').checked,
      comp: row.querySelector('.mc-comp').value,
      creative: row.querySelector('.mc-creative').value,
      urgent: row.querySelector('.mc-urgent').value,
      rev: row.querySelector('.mc-rev').value,
    };
  }
  function calcMulti(){
    const rows=getRows();
    const totalNet=rows.reduce((sum,row)=>{
      const type=row.querySelector('.mc-type').value;
      const cnt =Number(row.querySelector('.mc-count').value||1);
      const secs=Number(row.querySelector('.mc-secs').value||0);
      return sum + cnt * unitPriceBy(type, secs, rowOpts(row));
    },0);
    $('qa-net').textContent=money(totalNet);
    $('qa-gross').textContent=money(Math.round(totalNet*1.06));
  }
  function bindChange(){ $('quote-form').addEventListener('input',()=>{ elMultiToggle.checked ? calcMulti() : calcSingle(); }); }
  function calcSingle(){ /* 保留旧逻辑（当你手动关掉多组合时仍可用） */
    const defSel=$('qa-type'), base=$('qa-base'), secs=$('qa-secs'), c=$('qa-comp'), cr=$('qa-creative'), ur=$('qa-urgent'), rv=$('qa-rev');
    let compOn=document.querySelector('.qa-task[value="comp"]')?.checked; const def={base:base.value, compOn, comp:c.value, creative:cr.value, urgent:ur.value, rev:rv.value};
    const net=unitPriceBy(defSel.value, Number(secs.value||0), def); $('qa-net').textContent=money(net); $('qa-gross').textContent=money(Math.round(net*1.06));
  }
  addBtn.addEventListener('click',()=>{ const idx=list.querySelectorAll('[data-idx]').length; list.insertAdjacentHTML('beforeend', mcRowHTML(idx,{type:'LookBook',count:1,secs:0,creative:30,urgent:0,rev:4,compOn:false,comp:0})); calcMulti(); });
  elAdvToggle.addEventListener('change',()=>{ document.querySelectorAll('.mc-adv').forEach(el=> el.style.display=elAdvToggle.checked?'flex':'none'); });
  elMultiToggle.addEventListener('change',()=>{ elSingle.classList.toggle('hidden', elMultiToggle.checked); elMulti.style.display=elMultiToggle.checked?'block':'none'; elMultiToggle.checked ? calcMulti() : calcSingle(); });
  ensureOneRow(); bindChange(); calcMulti(); /* 默认多组合 */
})();

/* 通用编辑模态（与上一版一致，保留“修改内容可插图”与上传到 attachments 的逻辑） */
const editorModal=$('editor-modal'), editorTitle=$('editor-title'), editorForm=$('editor-form');
const editorClose=$('editor-close'), editorCancel=$('editor-cancel');
function closeEditor(){ editorModal.classList.remove('show'); editorForm.innerHTML=''; }
editorClose?.addEventListener('click',closeEditor); editorCancel?.addEventListener('click',closeEditor);
editorModal?.addEventListener('mousedown',e=>{ if(e.target===editorModal) closeEditor(); });

function openEditorModal(kind,id){
  const p=projects.find(x=>String(x.id)===String(id)); if(!p) return;
  editorModal.classList.add('show'); editorForm.setAttribute('data-kind',kind); editorForm.setAttribute('data-id',id);
  if(kind==='producer'){ editorTitle.textContent='编辑 合作制片'; editorForm.innerHTML=`<div class="h-row"><label>合作制片（姓名）<input name="producer_name" value="${p.producer_name||''}"></label><label>合作制片（联系方式）<input name="producer_contact" value="${p.producer_contact||''}"></label></div>`; }
  if(kind==='spec'){
    editorTitle.textContent='编辑 影片类型 & 条数 & 规格（可多组合）';
    const parsed=parseSpec(p.spec), combos=parsed.json?parsed.combos:[{type:p.type||'',clips:p.clips||1,res:(parsed.combos?.[0]||{}).res||'',ratios:(parsed.combos?.[0]||{}).ratios||[]}];
    const rows=combos.map((c,idx)=> comboRowHTML(idx,c)).join('');
    editorForm.innerHTML=`<div id="combo-list">${rows}</div><div style="margin-top:10px"><button type="button" id="add-combo" class="cell-edit">新增组合</button></div><div class="muted small" style="margin-top:6px">4K比例示例：16:9=3840×2160、9:16=2160×3840、1:1=2160×2160、4:3=2880×2160、3:4=2160×2880</div>`;
    editorForm.addEventListener('click',e=>{ const add=e.target.closest('#add-combo'); const del=e.target.closest('.combo-del'); if(add){const list=editorForm.querySelector('#combo-list'); const idx=list.querySelectorAll('.combo-row').length; list.insertAdjacentHTML('beforeend',comboRowHTML(idx,{type:'LookBook',clips:1,res:'1080p',ratios:['16:9']}));} if(del){ del.closest('.combo-row')?.remove(); }},{once:false});
  }
  if(kind==='progress'){
    editorTitle.textContent='编辑 进度（完成标记 / 小版本号）';
    const d=parseNotes(p.notes);
    editorForm.innerHTML=`<div class="h-row"><label>Acopy 日期<input type="date" name="a_copy" value="${p.a_copy||''}"></label><label>Bcopy 日期<input type="date" name="b_copy" value="${p.b_copy||''}"></label><label>Final 日期<input type="date" name="final_date" value="${p.final_date||''}"></label></div><div class="h-row pill-group"><label class="pill"><input type="checkbox" name="A_DONE" ${hasTag(p.notes,'#A_DONE')?'checked':''}><span>Acopy 完成</span></label><label class="pill"><input type="checkbox" name="B_DONE" ${hasTag(p.notes,'#B_DONE')?'checked':''}><span>Bcopy 完成</span></label><label class="pill"><input type="checkbox" name="F_DONE" ${hasTag(p.notes,'#F_DONE')?'checked':''}><span>Final 完成</span></label></div><div class="h-row"><label>Acopy 小版本<select name="ver_A">${optionList(['v1','v2','v3','v4','v5','v6','v7','v8'],d.versions.A||'v1')}</select></label><label>Bcopy 小版本<select name="ver_B">${optionList(['v1','v2','v3','v4','v5','v6','v7','v8'],d.versions.B||'v1')}</select></label><label>Final 小版本<select name="ver_F">${optionList(['v1','v2','v3','v4','v5','v6','v7','v8'],d.versions.F||'v1')}</select></label></div>`;
  }
  if(kind==='money'){ editorTitle.textContent='编辑 金额'; editorForm.innerHTML=`<div class="h-row"><label>总金额<input name="quote_amount" type="number" min="0" step="0.01" value="${p.quote_amount||0}"></label><label>已收款<input name="paid_amount" type="number" min="0" step="0.01" value="${p.paid_amount||0}"></label></div>`; }
  if(kind==='changes'){
    editorTitle.textContent='修改内容';
    const d=parseNotes(p.notes), st=stageInfo(p), history=[...(d.changes||[])].sort((a,b)=>b.ts-a.ts);
    const hist= history.length? history.map(x=>{const dt=new Date(x.ts||Date.now()); const time=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`; const appVer=x.appVer?`APP ${x.appVer}`:'APP —'; const imgs=Array.isArray(x.imgs)? x.imgs.map(u=>`<img class="tiny-thumb img-thumb" src="${u}" data-full="${u}" title="点击查看">`).join(''):''; return `<div class="list-item"><div class="small muted">[${appVer}] [${x.phase} · ${x.version}] · ${time}</div><div>${(x.text||'').replace(/</g,'&lt;')}</div>${imgs?`<div class="thumb-list" style="margin-top:6px">${imgs}</div>`:''}</div>`; }).join('') : `<div class="muted small">暂无历史记录</div>`;
    editorForm.innerHTML=`<div class="card" style="margin-bottom:10px"><div class="section-head"><h3>本次修改（可插入图片）</h3></div><div class="h-row"><label>关联阶段<select name="chg_phase">${['Acopy','Bcopy','Final'].map(s=>`<option ${s===(st.name==='完结'?'Final':st.name)?'selected':''}>${s}</option>`).join('')}</select></label><label>小版本号<select name="chg_version">${optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], st.name==='Acopy'?d.versions.A:st.name==='Bcopy'?d.versions.B:d.versions.F)}</select></label><label>系统版本（只读）<input type="text" value="${APP_VERSION}" disabled></label></div><label style="margin-top:8px">修改内容（文字）<textarea name="chg_text" rows="4" id="chg_text" placeholder="填写本次修改点（可在下方粘贴或选择图片）"></textarea></label><div class="h-row"><label>添加图片（可多选）<input type="file" id="chg_imgs" accept="image/*" multiple></label><div class="muted small">或直接在上方文本框内 ⌘V / Ctrl+V 粘贴图片</div></div><div id="chg_preview" class="thumb-list" style="margin-top:6px"></div><label class="pill" style="margin-top:8px"><input type="checkbox" name="auto_bump" checked><span>保存后将所选阶段的小版本 +1</span></label></div><div class="card" style="margin-top:10px"><div class="section-head"><h3>历史修改记录</h3></div><div class="list">${hist}</div></div>`;
    const textArea=editorForm.querySelector('#chg_text'), fileInput=editorForm.querySelector('#chg_imgs'), prevList=editorForm.querySelector('#chg_preview'); let pendingFiles=[];
    textArea?.addEventListener('paste',e=>{ const items=e.clipboardData?.items||[]; for(const it of items){ if(it.type?.startsWith('image/')){ const f=it.getAsFile(); if(f){ pendingFiles.push(new File([f],`paste-${Date.now()}.png`,{type:f.type||'image/png'})); renderPrev(); } e.preventDefault(); } }});
    fileInput?.addEventListener('change',()=>{ pendingFiles=pendingFiles.concat([...fileInput.files]); fileInput.value=''; renderPrev(); });
    function renderPrev(){ prevList.innerHTML=''; pendingFiles.forEach(f=>{ const img=document.createElement('img'); img.className='tiny-thumb'; const r=new FileReader(); r.onload=()=>img.src=r.result; r.readAsDataURL(f); prevList.appendChild(img); }); }
    editorForm._pendingFiles=pendingFiles;
  }
}
function comboRowHTML(idx,c){
  return `<div class="combo-row" data-idx="${idx}"><label>类型<select class="combo-type">${optionList(TYPE_OPTS,c.type||'')}</select></label><label>影片条数<input class="combo-clips" type="number" min="1" value="${c.clips||1}"></label><label>分辨率<select class="combo-res">${optionList(RES_OPTS,c.res||'')}</select></label><div class="pill-group ratios-inline">${checkboxList(RATIO_OPTS,c.ratios||[])}</div><div style="margin-left:auto"><button type="button" class="cell-edit combo-del">删除该组合</button></div></div>`;
}
editorForm?.addEventListener('submit',async e=>{
  e.preventDefault(); const id=editorForm.getAttribute('data-id'), kind=editorForm.getAttribute('data-kind'); const fd=new FormData(editorForm); let patch={};
  if(kind==='producer'){ patch.producer_name=(fd.get('producer_name')||'').toString().trim(); patch.producer_contact=(fd.get('producer_contact')||'').toString().trim(); }
  if(kind==='spec'){ const rows=[...editorForm.querySelectorAll('.combo-row')]; const combos=rows.map(row=>{const type=row.querySelector('.combo-type').value; const clips=Number(row.querySelector('.combo-clips').value||1); const res=row.querySelector('.combo-res').value; const ratios=[...row.querySelectorAll('.pill-group input[type="checkbox"]:checked')].map(i=>i.value); return {type,clips,res,ratios};}).filter(x=>x.type); if(combos.length){ patch.spec=JSON.stringify({combos}); patch.type=combos[0].type; patch.clips=combos[0].clips; }else{ patch.spec=''; patch.type=''; patch.clips=1; } }
  if(kind==='progress'){ const a_copy=fd.get('a_copy')||null, b_copy=fd.get('b_copy')||null, final_date=fd.get('final_date')||null; const row=projects.find(x=>String(x.id)===String(id)); let d=parseNotes(row?.notes||''); d={...d,versions:{A:fd.get('ver_A')||d.versions.A||'v1',B:fd.get('ver_B')||d.versions.B||'v1',F:fd.get('ver_F')||d.versions.F||'v1'}}; const tags=new Set(d.tags||[]); if(fd.get('A_DONE')) tags.add('#A_DONE'); else tags.delete('#A_DONE'); if(fd.get('B_DONE')) tags.add('#B_DONE'); else tags.delete('#B_DONE'); if(fd.get('F_DONE')) tags.add('#F_DONE'); else tags.delete('#F_DONE'); d.tags=Array.from(tags); patch={a_copy:a_copy||null,b_copy:b_copy||null,final_date:final_date||null,notes:stringifyNotes(d)}; }
  if(kind==='money'){ patch.quote_amount=Number(fd.get('quote_amount')||0); patch.paid_amount=Number(fd.get('paid_amount')||0); }
  if(kind==='changes'){
    const row=projects.find(x=>String(x.id)===String(id)); let d=parseNotes(row?.notes||'');
    const phase=(fd.get('chg_phase')||'Final').toString(), version=(fd.get('chg_version')||'v1').toString(), text=(fd.get('chg_text')||'').toString().trim(); const auto=!!fd.get('auto_bump');
    let imgs=[]; const files=editorForm._pendingFiles||[]; const ts=Date.now();
    for(let i=0;i<files.length;i++){ const f=files[i]; const ext=(f.name.split('.').pop()||'png').toLowerCase(); const path=`projects/${id}/changes/${ts}-${i}.${ext}`; const {error}=await supa.storage.from('attachments').upload(path,f,{upsert:true,contentType:f.type||'image/png'}); if(!error){ const {data}=supa.storage.from('attachments').getPublicUrl(path); imgs.push(data.publicUrl);} }
    if(text||imgs.length){ d.changes=Array.isArray(d.changes)?d.changes:[]; d.changes.push({phase,version,text,imgs,ts,appVer:APP_VERSION}); }
    if(auto){ d.versions=d.versions||{A:'v1',B:'v1',F:'v1'}; if(phase==='Acopy') d.versions.A=bumpVersion(d.versions.A); if(phase==='Bcopy') d.versions.B=bumpVersion(d.versions.B); if(phase==='Final') d.versions.F=bumpVersion(d.versions.F); }
    patch.notes=stringifyNotes(d);
  }
  await supa.from('projects').update(patch).eq('id',id); closeEditor(); await fetchProjects(); renderAll();
});

/* 项目列表：分为未完成/已完成两窗口 */
function formatProgressCell(p){
  const vers=parseNotes(p.notes).versions, near=nearestMilestone(p), doneF=hasTag(p.notes,'#F_DONE');
  if(doneF && p.final_date){ const d=new Date(p.final_date); const mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `<span class="badge badge-done">完结</span> <span class="small">- ${mm}.${dd}</span>`; }
  if(!near||!near.k||!near.date) return '—';
  const mm=String(near.date.getMonth()+1).padStart(2,'0'), dd=String(near.date.getDate()).padStart(2,'0'); const small=near.k==='Acopy'? (vers.A||'v1'): near.k==='Bcopy'? (vers.B||'v1'): (vers.F||'v1'); const cls=near.k==='Acopy'?'badge-a':near.k==='Bcopy'?'badge-b':'badge-f';
  return `<span class="badge ${cls}">${near.k}</span> <span class="small">- ${mm}.${dd} - ${small}</span>`;
}
function renderRow(p){
  const tr=document.createElement('tr');
  const currentPay=p.pay_status || (unpaidAmt(p)<=0 ? '已收尾款' : (Number(p.paid_amount||0)>0?'已收定金':'未收款'));
  const moneyText=`${money(p.quote_amount)} / ${money(p.paid_amount)}`;
  const d=parseNotes(p.notes), last=[...(d.changes||[])].sort((a,b)=>b.ts-a.ts)[0];
  const lastText=last ? `[${last.phase}·${last.version}] ${last.text.slice(0,42)}${last.text.length>42?'…':''}` : '—';
  const thumbs=last?.imgs?.length ? last.imgs.slice(0,4).map(u=>`<img class="tiny-thumb img-thumb" src="${u}" data-full="${u}" title="点击查看">`).join('') : '';
  const posterOk=!!p.poster_url, videoOk=!!p.final_link, upLabel=(posterOk||videoOk)?'已上传':'未上传', upCls=(posterOk||videoOk)?'pill-green':'pill-blue';
  const pri=priObj(getPriority(p));
  tr.innerHTML=`
    <td contenteditable="true" data-k="title" data-id="${p.id}">${p.title||''}</td>
    <td><div class="cell-summary"><span>${p.producer_name||'未填'}</span>${p.producer_contact?`<span class="muted small">· ${p.producer_contact}</span>`:''}<button class="cell-edit edit-btn" data-kind="producer" data-id="${p.id}">编辑</button></div></td>
    <td><div class="cell-summary"><span class="text-cell">${(typeSpecLines(p).join('<br>'))||'—'}</span><button class="cell-edit edit-btn" data-kind="spec" data-id="${p.id}">编辑</button></div></td>
    <td><div class="cell-summary"><span class="text-cell">${formatProgressCell(p)}</span><button class="cell-edit edit-btn" data-kind="progress" data-id="${p.id}">编辑</button></div></td>
    <td class="col-priority"><div class="cell-summary"><button class="pill ${pri.cls} pri-toggle" data-id="${p.id}" title="点击切换优先级">${pri.k}·${pri.txt}</button></div></td>
    <td><div class="cell-summary"><select class="pay-inline" data-id="${p.id}">${['未收款','已收定金','已收尾款'].map(o=>`<option ${o===currentPay?'selected':''}>${o}</option>`).join('')}</select></div></td>
    <td><div class="cell-summary"><span class="muted text-cell">${moneyText}</span><button class="cell-edit edit-btn" data-kind="money" data-id="${p.id}">编辑</button></div></td>
    <td class="col-changes"><div class="cell-summary"><span class="small text-cell">${lastText}</span>${thumbs?`<div class="thumb-list">${thumbs}</div>`:''}<button class="cell-edit edit-btn" data-kind="changes" data-id="${p.id}">编辑</button></div></td>
    <td class="col-upload"><div class="cell-summary"><button class="pill ${upCls} upload-pill" data-id="${p.id}">${upLabel}</button></div></td>`;
  return tr;
}
function bindTable(tb){
  if(tb._bound) return;
  tb.addEventListener('blur',async e=>{ const td=e.target.closest('td[contenteditable="true"]'); if(!td) return; const id=td.getAttribute('data-id'); const k=td.getAttribute('data-k'); const v=td.textContent.trim(); if(!id||!k) return; const patch={}; patch[k]=v; await supa.from('projects').update(patch).eq('id',id); }, true);
  tb.addEventListener('click',async e=>{
    const btn=e.target.closest('.edit-btn'); const up=e.target.closest('.upload-pill'); const pri=e.target.closest('.pri-toggle'); const img=e.target.closest('.img-thumb');
    if(btn){ openEditorModal(btn.getAttribute('data-kind'), btn.getAttribute('data-id')); }
    if(up){ openUploadModal(up.getAttribute('data-id')); }
    if(pri){ const id=pri.getAttribute('data-id'); const row=projects.find(x=>String(x.id)===String(id)); if(!row) return; const d=parseNotes(row.notes); d.priority=d.priority==='P1'?'P2':d.priority==='P2'?'P3':d.priority==='P3'?'P4':'P1'; await supa.from('projects').update({notes:stringifyNotes(d)}).eq('id',id); await fetchProjects(); renderProjects(); }
    if(img){ openImgbox(img.getAttribute('data-full')); }
  });
  tb.addEventListener('change',async e=>{ const sel=e.target.closest('select.pay-inline'); if(!sel) return; const id=sel.getAttribute('data-id'); await supa.from('projects').update({pay_status: sel.value}).eq('id',id); const row=projects.find(x=>String(x.id)===String(id)); if(row){row.pay_status=sel.value;} renderProjects(); });
  tb._bound=true;
}
function shrinkOverflowCells(tb){ tb.querySelectorAll('td .text-cell').forEach(el=>{ const td=el.closest('td'); if(!td) return; if(td.scrollWidth>td.clientWidth || el.scrollWidth>td.clientWidth){ td.classList.add('shrink'); }else{ td.classList.remove('shrink'); } }); }
function renderProjects(){
  const body=$('projects-body'), cbody=$('completed-body'); body.innerHTML=''; cbody.innerHTML='';
  const completed=projects.filter(p=> (p.pay_status||'')==='已收尾款');
  const incompleted=projects.filter(p=> (p.pay_status||'')!=='已收尾款');
  incompleted.forEach(p=> body.appendChild(renderRow(p)));
  completed.forEach(p=> cbody.appendChild(renderRow(p)));
  bindTable(body); bindTable(cbody);
  shrinkOverflowCells(body); shrinkOverflowCells(cbody);
}

/* 快速查看 */
const qModal=$('quick-modal'), qTitle=$('quick-title'), qBody=$('quick-body'), qClose=$('quick-close'), qFinalBtn=$('quick-final-done');
function closeQuick(){ qModal.classList.remove('show'); qBody.innerHTML=''; }
qClose?.addEventListener('click',closeQuick);
qModal?.addEventListener('mousedown',e=>{ if(e.target===qModal) closeQuick(); });
function openQuickModal(id){
  const p=projects.find(x=>String(x.id)===String(id)); if(!p) return;
  const st=stageInfo(p), near=nearestMilestone(p);
  qTitle.textContent=`${p.title||'未命名'}${p.brand?` · ${p.brand}`:''}`;
  qBody.innerHTML=`<div class="grid-1"><div>合作制片：${[p.producer_name,p.producer_contact].filter(Boolean).join(' · ')||'—'}</div><div class="small muted">规格：${(parseSpec(p.spec).json? typeSpecLines(p).join('，') : typeSpecLines(p)[0])||'—'}</div><div class="small muted">节点：${[p.a_copy?`Acopy ${p.a_copy}`:'', p.b_copy?`Bcopy ${p.b_copy}`:'', p.final_date?`Final ${p.final_date}`:''].filter(Boolean).join(' ｜ ')||'—'}</div><div style="margin-top:8px" class="pmeta"><div class="prog" style="flex:1"><div class="prog-bar" style="width:${st.percent}%"></div><span class="prog-text">${st.percent}%</span></div>${stageBadgeHTML(st.name,st.version)}</div></div>`;
  qFinalBtn.onclick=async()=>{ const row=projects.find(x=>String(x.id)===String(id)); const d=parseNotes(row?.notes||''); d.tags.add('#F_DONE'); await supa.from('projects').update({notes:stringifyNotes(d)}).eq('id',id); await fetchProjects(); renderAll(); closeQuick(); };
  qModal.classList.add('show');
}

/* 作品合集 */
function renderGallery(){
  const grid=$('gallery-grid'); grid.innerHTML='';
  const finals=projects.filter(p=>p.final_link);
  if(finals.length===0){ const ph=document.createElement('div'); ph.className='poster'; ph.innerHTML=`<div class="caption">暂未上传成片，请在项目中上传海报与成片</div>`; grid.appendChild(ph); return; }
  finals.forEach(p=>{ const a=document.createElement('a'); a.className='poster'; a.href=p.final_link; a.target='_blank'; if(p.poster_url){ a.style.backgroundImage=`url('${p.poster_url}')`; } a.innerHTML=`<div class="caption">${p.title||'未命名'}${p.brand?` · ${p.brand}`:''}</div>`; grid.appendChild(a); });
}

/* 日历：联通格子式 + 贯通阶段条 */
const gridEl=$('cal-grid'), labelEl=$('cal-label'); let calBase=new Date(); calBase.setDate(1);
$('cal-prev').addEventListener('click',()=>{ calBase.setMonth(calBase.getMonth()-1); renderCalendar(); });
$('cal-next').addEventListener('click',()=>{ calBase.setMonth(calBase.getMonth()+1); renderCalendar(); });
function renderCalendar(){
  gridEl.innerHTML=''; const y=calBase.getFullYear(), m=calBase.getMonth();
  labelEl.textContent=`${y}年 ${m+1}月`;
  const first=new Date(y,m,1), start=(first.getDay()+6)%7, days=new Date(y,m+1,0).getDate();
  // 生成 day cells
  const dayCells=Array.from({length:days+1},()=>null);
  for(let i=0;i<42;i++){ const cell=document.createElement('div'); cell.className='cal-cell'; const day=i-start+1; if(day>0 && day<=days){ const head=document.createElement('div'); head.className='cal-day'; head.textContent=String(day); cell.appendChild(head); dayCells[day]=cell; } gridEl.appendChild(cell); }
  // 计算贯通条：A: a_copy -> b_copy-1, B: b_copy -> final_date-1, F: final_date当天
  function clampToMonth(d){ return new Date(y,m,Math.min(Math.max(1,d.getDate()),days)); }
  projects.forEach(p=>{
    const A=fmt(p.a_copy), B=fmt(p.b_copy), F=fmt(p.final_date);
    const spans=[];
    if(A && B) spans.push({k:'a',s:new Date(A),e:new Date(B.getTime()-86400000)});
    if(B && F) spans.push({k:'b',s:new Date(B),e:new Date(F.getTime()-86400000)});
    if(F) spans.push({k:'f',s:new Date(F),e:new Date(F)});
    spans.forEach(sp=>{
      // 与当月交集
      let s=sp.s, e=sp.e;
      const monStart=new Date(y,m,1), monEnd=new Date(y,m,days);
      if(e<monStart || s>monEnd) return;
      if(s<monStart) s=monStart; if(e>monEnd) e=monEnd;
      // 每天画一段，首尾圆角
      for(let d=s.getDate(); d<=e.getDate(); d++){
        const piece=document.createElement('div');
        piece.className=`span-piece span-${sp.k} ${d===s.getDate()?'span-start':''} ${d===e.getDate()?'span-end':''}`;
        const lane = (p.id % 3); // 简单固定轨道，避免堆叠
        const line=document.createElement('div'); line.className='bar-line'; line.style.marginTop= (6 + lane*10) + 'px';
        line.appendChild(piece);
        dayCells[d]?.appendChild(line);
      }
    });
  });
}

/* 财务（保持上版） */
function renderFinance(){
  const map=new Map();
  projects.forEach(p=>{ const k=p.producer_name||'未填'; map.set(k,(map.get(k)||0)+Number(p.paid_amount||0)); });
  const rp=$('rank-partner'); rp.innerHTML=''; [...map.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{ const li=document.createElement('div'); li.className='list-item'; li.innerHTML=`<div>${k}</div><strong>${money(v)}</strong>`; rp.appendChild(li); });
  const rq=$('rank-project'); rq.innerHTML=''; [...projects].sort((a,b)=>Number(b.quote_amount||0)-Number(a.quote_amount||0)).forEach(p=>{ const li=document.createElement('div'); li.className='list-item'; li.innerHTML=`<div>${p.title||'未命名'}</div><strong>${money(p.quote_amount)}</strong>`; rq.appendChild(li); });
  const aging=$('aging'); aging.innerHTML=''; const today=Date.now();
  projects.filter(p=> p.final_date && unpaidAmt(p)>0).sort((a,b)=> new Date(a.final_date)-new Date(b.final_date)).forEach(p=>{
    const days=Math.floor((today-new Date(p.final_date).getTime())/86400000);
    const li=document.createElement('div'); li.className='list-item'; li.innerHTML=`<div>${p.title||'未命名'} / ${p.producer_name||'未填'}</div><div>${money(unpaidAmt(p))} / ${days>0?days:0}天</div>`; aging.appendChild(li);
  });
  const start=new Date(Date.now()-89*86400000); start.setHours(0,0,0,0);
  const arr=Array.from({length:90},(_,i)=> new Date(start.getTime()+i*86400000));
  const m2=new Map(arr.map(d=>[d.toDateString(),0]));
  projects.forEach(p=>{ const d=new Date(p.updated_at); d.setHours(0,0,0,0); if(d>=start){ const k=d.toDateString(); m2.set(k,(m2.get(k)||0)+Number(p.paid_amount||0)); }});
  drawTrend($('trend'), arr.map(d=> m2.get(d.toDateString())||0));
}
function drawTrend(container,arr){ container.innerHTML=''; const w=container.clientWidth||800,h=container.clientHeight||180,pad=10; const max=Math.max(...arr,1), step=(w-2*pad)/Math.max(arr.length-1,1); let d=''; arr.forEach((v,i)=>{ const x=pad+i*step, y=h-pad-(v/max)*(h-2*pad); d+=(i?'L':'M')+x+','+y+' '; }); container.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="#2f81f7" stroke-width="2"/></svg>`; }

/* 上传海报/成片（保持上版） */
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

/* 导航 */
$('go-list')?.addEventListener('click',()=> showView('projects'));
nav.home.addEventListener('click',()=> showView('home'));
nav.projects.addEventListener('click',()=> showView('projects'));
nav.gallery.addEventListener('click',()=> showView('gallery'));
nav.finance.addEventListener('click',()=> showView('finance'));
nav.schedule.addEventListener('click',()=>{ showView('schedule'); renderCalendar(); });

/* 新建项目 */
const mNew=$('new-modal'); $('btn-new')?.addEventListener('click',()=> mNew.classList.add('show')); $('new-cancel')?.addEventListener('click',()=> mNew.classList.remove('show'));
$('new-form')?.addEventListener('submit',async e=>{
  e.preventDefault(); const fd=new FormData(e.target); const row=Object.fromEntries(fd.entries());
  row.clips=Number(row.clips||1); row.quote_amount=Number(row.quote_amount||0); row.paid_amount=Number(row.paid_amount||0); row.deposit_amount=0;
  row.notes=stringifyNotes({tags:[],versions:{A:'v1',B:'v1',F:'v1'},changes:[],free:'',priority:'P3'});
  const {error}=await supa.from('projects').insert(row); if(error){alert(error.message); return;}
  mNew.classList.remove('show'); await fetchProjects(); renderAll();
});

/* 图片 Lightbox */
const imgbox=$('imgbox'), imgboxImg=$('imgbox-img'); $('imgbox-close')?.addEventListener('click',()=> imgbox.classList.remove('show')); imgbox?.addEventListener('mousedown',e=>{ if(e.target===imgbox) imgbox.classList.remove('show'); });
function openImgbox(url){ imgboxImg.src=url; imgbox.classList.add('show'); }

/* 整页渲染 */
function renderAll(){ renderKpis(); renderRecent(); renderProjects(); renderGallery(); renderFinance(); }

/* 启动 */
async function boot(){ const {data:{session}}=await supa.auth.getSession(); if(!session){ showView('auth'); return; } await bootAfterAuth(); }
async function bootAfterAuth(){ await fetchProjects(); renderAll(); showView('home'); }
boot();
