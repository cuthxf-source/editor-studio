/* app.js  v1.4.4-r2
 * 基于 v1.4.3-stable，落实你备忘录 v1.4.4 的 7 条修改
 * 修复：上版“修改内容”弹窗字符串少引号导致脚本中断 → 造成“按钮不可点/数据不显示”
 * 兼容：不使用可选链/空值合并等新语法；提供本地缓存回退
 */

var APP_VERSION = 'v1.4.4-r2';

/* 轻量提示（不遮挡点击） */
(function () {
  if (!document.getElementById('app-toast')) {
    var t = document.createElement('div');
    t.id = 'app-toast';
    t.style.cssText =
      'position:fixed;right:12px;bottom:12px;z-index:9999;max-width:60vw;' +
      'background:rgba(0,0,0,.7);color:#fff;padding:8px 12px;border-radius:12px;font:13px/1.6 -apple-system,Segoe UI,Arial;display:none';
    document.body.appendChild(t);
  }
  window.__toast = function (msg) {
    try {
      var el = document.getElementById('app-toast');
      if (!el) return;
      el.textContent = msg;
      el.style.display = 'block';
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(function () { el.style.display = 'none'; }, 3000);
    } catch (e) {}
  };
  window.addEventListener('error', function (e) {
    __toast('脚本错误：' + (e.message || 'Unknown'));
    console.error('[APP ERROR]', e.error || e.message);
  });
})();

/* Supabase */
var supa = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

/* 视图 */
var views = {
  auth: document.getElementById('view-auth'),
  home: document.getElementById('view-home'),
  projects: document.getElementById('view-projects'),
  schedule: document.getElementById('view-schedule'),
  gallery: document.getElementById('view-gallery'),
  finance: document.getElementById('view-finance')
};
var nav = {
  home: document.getElementById('btn-home'),
  projects: document.getElementById('btn-projects'),
  schedule: document.getElementById('btn-schedule'),
  gallery: document.getElementById('btn-gallery'),
  finance: document.getElementById('btn-finance'),
  logout: document.getElementById('btn-logout')
};
function showView(name) {
  for (var k in views) { if (views[k]) views[k].classList.add('hidden'); }
  var v = views[name] || views.home; if (v) v.classList.remove('hidden');
  var navBtns = document.querySelectorAll('.nav-btn');
  for (var i = 0; i < navBtns.length; i++) navBtns[i].removeAttribute('aria-current');
  var m = {home:nav.home, projects:nav.projects, schedule:nav.schedule, gallery:nav.gallery, finance:nav.finance}[name];
  if (m) m.setAttribute('aria-current', 'page');
}

/* 登录/注册 */
var authForm = document.getElementById('auth-form');
var authTip  = document.getElementById('auth-tip');
if (nav.logout) {
  nav.logout.addEventListener('click', function () {
    supa.auth.signOut().then(function(){ showView('auth'); });
  });
}
if (authForm) {
  authForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value.trim();
    supa.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
      if (r.error) {
        return supa.auth.signUp({ email: email, password: password }).then(function (r2) {
          if (r2.error) { authTip.textContent = r2.error.message; return; }
          return supa.auth.getSession().then(function (s) { if (s.data && s.data.session) { bootAfterAuth().then(function(){ showView('home'); }); } });
        });
      } else {
        return supa.auth.getSession().then(function (s) { if (s.data && s.data.session) { bootAfterAuth().then(function(){ showView('home'); }); } });
      }
    });
  });
}

/* 数据 */
var projects = [];
var LS_KEY = 'cache_projects_v144';

/* 工具 */
function money(n){ return '¥' + (Number(n||0)).toLocaleString(); }
function fmt(d){ return d ? new Date(d) : null; }
function todayStr(){
  var d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function parseNotes(notes){
  var base = { tags:new Set(), versions:{A:'v1',B:'v1',F:'v1'}, changes:[], free:'' };
  if(!notes) return base;
  try{
    var obj = JSON.parse(notes);
    if(obj && (obj.tags || obj.versions || obj.changes || Object.prototype.hasOwnProperty.call(obj,'free'))){
      return {
        tags: new Set(Array.isArray(obj.tags)?obj.tags:[]),
        versions: obj.versions || {A:'v1',B:'v1',F:'v1'},
        changes: Array.isArray(obj.changes)?obj.changes:[],
        free: obj.free || ''
      };
    }
  }catch(e){}
  var tags = new Set((notes.match(/#[A-Z_]+/g)||[]));
  return { tags: tags, versions:{A:'v1',B:'v1',F:'v1'}, changes:[], free:notes };
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
function bumpVersion(ver){ var n=parseInt(String(ver||'v1').replace(/[^\d]/g,''),10)||1; return 'v'+Math.min(n+1,8); }

/* 规格解析/合并（支持多组合） */
function parseSpec(specStr){
  var s = specStr || '';
  var json = null;
  try{ if((s.trim().charAt(0)==='{' || s.trim().charAt(0)==='[')) json = JSON.parse(s); }catch(e){ json = null; }
  if(json){
    var combos = Array.isArray(json) ? json : (json.combos||[]);
    return { json:true, combos:combos };
  }
  var raw = s.split('·').map(function(x){ return x.trim(); });
  var res = raw[0] || '';
  var ratio = raw[1] || '';
  if(!ratio && res.indexOf(':')>-1){ ratio=res; res=''; }
  return { json:false, combos:[{ type:'', clips:1, res:res, ratios: ratio? [ratio]: [] }] };
}
function mergeTypeSpec(p, opts){
  opts = opts || {};
  var parsed = parseSpec(p.spec);
  if(parsed.json){
    var joiner = opts.multiline ? '<br>' : '，';
    return parsed.combos.map(function(c){
      var r = (c.ratios && c.ratios.length) ? (' · ' + c.ratios.join('/')) : '';
      var rr = c.res ? (' · ' + c.res) : '';
      return (c.type||'未填') + '×' + (c.clips||1) + rr + r;
    }).join(joiner);
  }else{
    var c = parsed.combos[0]||{};
    var clips = p.clips ? (' · ' + p.clips + '条') : '';
    var type  = p.type || '';
    var r = (c.ratios && c.ratios.length) ? (' · ' + c.ratios.join('/')) : (c.ratio?(' · '+c.ratio):'');
    var rr = c.res ? (' · ' + c.res) : '';
    var joined = [type, rr.replace(' · ','').trim()].filter(Boolean).join(' · ');
    return (joined? joined : '—') + clips + (r||'');
  }
}
function totalClipsOf(p){
  var parsed = parseSpec(p.spec);
  if(parsed.json) return parsed.combos.reduce(function(s,c){ return s + Number(c.clips||0); },0) || Number(p.clips||0) || 0;
  return Number(p.clips||0) || 0;
}
function unpaidAmt(p){ return Math.max(Number(p.quote_amount||0)-Number(p.paid_amount||0),0); }

/* 阶段与最近节点（最近项目排序使用） */
function stageInfo(p){
  var d = parseNotes(p.notes);
  var A = !hasTag(p.notes,'#A_DONE');
  var B = !hasTag(p.notes,'#B_DONE');
  var F = !hasTag(p.notes,'#F_DONE');
  if(A) return { name:'Acopy', percent:30, version:d.versions.A||'v1', badge:'a' };
  if(B) return { name:'Bcopy', percent:60, version:d.versions.B||'v1', badge:'b' };
  if(F) return { name:'Final', percent:80, version:d.versions.F||'v1', badge:'f' };
  return { name:'完结', percent:85, version:'', badge:'done' };
}
function nearestMilestone(p){
  var today = new Date(); today.setHours(0,0,0,0);
  var A = fmt(p.a_copy), B = fmt(p.b_copy), F = fmt(p.final_date);
  var doneA = hasTag(p.notes,'#A_DONE'), doneB = hasTag(p.notes,'#B_DONE'), doneF = hasTag(p.notes,'#F_DONE');
  var items = [];
  if(A && !doneA) items.push({k:'Acopy', date:A});
  if(B && !doneB) items.push({k:'Bcopy', date:B});
  if(F && !doneF) items.push({k:'Final',  date:F});
  if(items.length===0){
    var past = [{k:'Acopy',date:A,done:doneA},{k:'Bcopy',date:B,done:doneB},{k:'Final',date:F,done:doneF}]
      .filter(function(x){return x.date;}).sort(function(a,b){return b.date-a.date;})[0];
    if(!past) return {text:'—', overdue:false, date:null, k:null};
    var overdue = past.date < today && !past.done;
    return { text: past.k + ' - ' + (past.date.getMonth()+1) + '/' + past.date.getDate(), overdue:overdue, date:past.date, k:past.k };
  }
  items.sort(function(a,b){ return a.date - b.date; });
  var n = items[0];
  var overdue2 = n.date < today;
  return { text: n.k + ' - ' + (n.date.getMonth()+1) + '/' + n.date.getDate(), overdue:overdue2, date:n.date, k:n.k };
}

/* 拉取数据（带本地缓存回退） */
function saveCache(list){ try { localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data: list })); } catch(e){} }
function loadCache(){ try { var raw=localStorage.getItem(LS_KEY); if(!raw) return null; var obj=JSON.parse(raw); return obj && obj.data ? obj.data : null; } catch(e){ return null; } }
function fetchProjects(){
  return supa.from('projects').select('*').order('updated_at', { ascending:false }).limit(1000)
    .then(function(res){
      if(res.error){ return supa.from('projects').select('*').order('id',{ascending:false}).limit(1000); }
      return res;
    })
    .then(function (res2){
      if(res2.error){
        __toast('读取云端失败，使用本地缓存');
        projects = loadCache() || [];
        return;
      }
      projects = res2.data || [];
      saveCache(projects);
    })
    .catch(function (err){
      console.error('fetchProjects error', err);
      __toast('读取失败：' + (err.message||''));
      projects = loadCache() || [];
    });
}

/* 首页渲染（最近项目：按未来最近节点排序；进度“能量条”更厚且内文） */
function renderRecent(){
  var box = document.getElementById('recent-list'); if(!box) return; box.innerHTML='';
  var weighted = projects.map(function(p){
    var n = nearestMilestone(p);
    var w = 1e15;
    if(n.date){
      var now = new Date();
      var diff = n.date - now;
      w = diff>=0? diff : Math.abs(diff) + 1e12;
    }
    return {p:p, w:w};
  }).sort(function(a,b){return a.w-b.w;}).slice(0,4);

  for(var i=0;i<weighted.length;i++){
    var p = weighted[i].p;
    var near = nearestMilestone(p);
    var st = stageInfo(p);
    var li = document.createElement('div'); li.className='list-item';
    li.innerHTML =
      '<div class="pmeta">' +
        '<div class="title-wrap">' +
          '<div><strong>'+(p.title||'未命名')+'</strong> ' + (p.brand?('· '+p.brand):'') + '</div>' +
          '<div class="subtitle">合作制片：'+([p.producer_name,p.producer_contact].filter(Boolean).join(' · ')||'—')+'</div>' +
        '</div>' +
        '<div class="prog-wrap">' +
          '<div class="prog prog-fat" title="'+st.name+(st.version?(' '+st.version):'')+' '+st.percent+'%">' +
            '<div class="prog-bar" style="width:'+st.percent+'%"><span class="prog-text">'+st.name+(st.version?(' '+st.version):'')+' · '+st.percent+'%</span></div>' +
          '</div>' +
          (st.version ? ('<span class="badge badge-'+st.badge+'">'+st.version+'</span>') : '<span class="badge badge-done">完结</span>') +
        '</div>' +
      '</div>' +
      '<div class="count muted small">条数：'+(totalClipsOf(p)||1)+'</div>' +
      '<div class="due '+(near.overdue?'pill pill-red':'pill')+'">'+near.text+'</div>';
    (function(id){ li.addEventListener('click', function(){ openQuickModal(id); }); })(p.id);
    box.appendChild(li);
  }

  var go = document.getElementById('go-list');
  if (go && !go.__binded) {
    go.addEventListener('click', function(e){ e.stopPropagation(); showView('projects'); });
    go.__binded = true;
  }
}

/* KPI & 财务（v1.4.4：增加“截至”日期文案） */
function renderKpis(){
  var total = projects.reduce(function(s,p){ return s + Number(p.quote_amount||0); },0);
  var paid  = projects.reduce(function(s,p){ return s + Number(p.paid_amount||0); },0);
  var unpaid= projects.reduce(function(s,p){ return s + unpaidAmt(p); },0);

  var clipDone = projects.reduce(function(s,p){ return s + (hasTag(p.notes,'#F_DONE') ? totalClipsOf(p) : 0); },0);
  var clipAll  = projects.reduce(function(s,p){ return s + totalClipsOf(p); },0);
  var clipTodo = Math.max(clipAll - clipDone, 0);

  var el;
  (el=document.getElementById('kpi-total')) && (el.textContent = money(total));
  (el=document.getElementById('kpi-paid'))  && (el.textContent = money(paid));
  (el=document.getElementById('kpi-unpaid'))&& (el.textContent = money(unpaid));
  (el=document.getElementById('kpi-done'))  && (el.textContent = String(clipDone));
  (el=document.getElementById('kpi-todo'))  && (el.textContent = String(clipTodo));

  var asof = todayStr();
  (el=document.getElementById('asof-home-clips-1')) && (el.textContent = asof);
  (el=document.getElementById('asof-home-clips-2')) && (el.textContent = asof);

  (el=document.getElementById('f-total')) && (el.textContent = money(total));
  (el=document.getElementById('f-paid'))  && (el.textContent = money(paid));
  (el=document.getElementById('f-unpaid'))&& (el.textContent = money(unpaid));
  (el=document.getElementById('asof-finance')) && (el.textContent = asof);
}

/* 报价分析器（含合成复杂度：每 10% 上调 10%） */
(function initQuote(){
  var typeBase = {
    'LookBook': {price:100,  baseSec:15,  secRate:0.01},
    '形象片':    {price:3500, baseSec:45,  secRate:0.03},
    'TVC':      {price:7000, baseSec:60,  secRate:0.03},
    '纪录片':    {price:12000,baseSec:180, secRate:0.005},
    '微电影':    {price:12000,baseSec:180, secRate:0.005},
  };
  var elType = document.getElementById('qa-type'); if(!elType) return;
  var elBase = document.getElementById('qa-base');
  var elSecs = document.getElementById('qa-secs');
  var elCreative = document.getElementById('qa-creative');
  var elUrgent   = document.getElementById('qa-urgent');
  var elRev      = document.getElementById('qa-rev');
  var elCompCk   = document.querySelector('.qa-task[value="comp"]');
  var elCompRow  = document.getElementById('qa-comp-row');
  var elComp     = document.getElementById('qa-comp');
  var elCompVal  = document.getElementById('qa-comp-val');

  var elMultiToggle = document.getElementById('qa-multi-toggle');
  var elMulti = document.getElementById('qa-multi');
  var list = document.getElementById('qa-mc-list');
  var addBtn = document.getElementById('qa-mc-add');

  function refreshLabels(){
    var el;
    (el=document.getElementById('qa-creative-val')) && (el.textContent = (elCreative.value||0) + '%');
    (el=document.getElementById('qa-urgent-val'))   && (el.textContent = (elUrgent.value||0) + '%');
    (el=elCompVal) && (el.textContent = (elComp.value||0) + '%');
  }
  ['input','change'].forEach(function(ev){
    elCreative.addEventListener(ev, refreshLabels);
    elUrgent.addEventListener(ev, refreshLabels);
    elComp.addEventListener(ev, refreshLabels);
  });
  refreshLabels();

  function toggleCompRow(){ if(elCompRow) elCompRow.classList.toggle('hidden', !elCompCk.checked); }
  elCompCk.addEventListener('change', function(){ toggleCompRow(); calc(); });
  toggleCompRow();

  function unitPriceBy(type, secs, baseOverride){
    var def = typeBase[type] || {price:0, baseSec:0, secRate:0};
    var basePrice = Number(baseOverride || def.price);
    var over = Math.max(0, Number(secs||0) - def.baseSec);
    var secFactor = over>0 ? Math.pow(1+def.secRate, over) : 1;
    var price = basePrice * secFactor;
    if(elCompCk.checked){ var c = Number(elComp.value||0); price *= (1 + c/100); }
    price *= (1 + Number(elCreative.value||0)/100);
    price *= (1 + (Number(elUrgent.value||0)/10) * 0.03);
    var rev = Number(elRev.value||0);
    var extraRev = Math.max(0, rev - 4);
    price *= (1 + extraRev*0.20);
    return Math.round(price);
  }
  function calcSingle(){
    var net = unitPriceBy(elType.value, Number(elSecs.value||0), elBase.value||undefined);
    var gross = Math.round(net * 1.06);
    document.getElementById('qa-net').textContent   = money(net);
    document.getElementById('qa-gross').textContent = money(gross);
  }
  function mcRowHTML(idx, c){
    return '<div class="h-row" data-idx="'+idx+'" style="margin-top:10px">' +
      '<label>类型<select class="mc-type">'+['LookBook','形象片','TVC','纪录片','微电影'].map(function(o){return '<option '+(o===c.type?'selected':'')+'>'+o+'</option>';}).join('')+'</select></label>' +
      '<label>条数<input class="mc-count" type="number" min="1" value="'+(c.count||1)+'"></label>' +
      '<label>时长（秒/每条）<input class="mc-secs" type="number" min="0" step="1" value="'+(c.secs||0)+'"></label>' +
    '</div>';
  }
  function ensureOneRow(){
    if(!list.querySelector('[data-idx]')) list.insertAdjacentHTML('beforeend', mcRowHTML(0,{type:'LookBook',count:1,secs:0}));
  }
  if(addBtn){
    addBtn.addEventListener('click', function(){
      var idx = list.querySelectorAll('[data-idx]').length;
      list.insertAdjacentHTML('beforeend', mcRowHTML(idx,{type:'LookBook',count:1,secs:0}));
      calc();
    });
  }
  function calcMulti(){
    var rows = [].slice.call(list.querySelectorAll('[data-idx]'));
    var totalNet = rows.reduce(function(sum,row){
      var type = row.querySelector('.mc-type').value;
      var count= Number(row.querySelector('.mc-count').value||1);
      var secs = Number(row.querySelector('.mc-secs').value||0);
      return sum + count * unitPriceBy(type, secs);
    },0);
    var gross = Math.round(totalNet * 1.06);
    document.getElementById('qa-net').textContent   = money(totalNet);
    document.getElementById('qa-gross').textContent = money(gross);
  }
  function calc(){ if(elMultiToggle.checked) calcMulti(); else calcSingle(); }

  elMultiToggle.addEventListener('change', function(){
    document.getElementById('qa-single').classList.toggle('hidden', elMultiToggle.checked);
    elMulti.classList.toggle('hidden', !elMultiToggle.checked);
    if(elMultiToggle.checked){ ensureOneRow(); calcMulti(); } else { calcSingle(); }
  });

  document.getElementById('quote-form').addEventListener('input', calc);
  calc();
})();

/* 通用编辑模态（含：规格编辑布局细化；修改内容编辑器） */
var editorModal  = document.getElementById('editor-modal');
var editorTitle  = document.getElementById('editor-title');
var editorForm   = document.getElementById('editor-form');
var editorClose  = document.getElementById('editor-close');
var editorCancel = document.getElementById('editor-cancel');
function closeEditor(){ if(editorModal) editorModal.classList.remove('show'); if(editorForm) editorForm.innerHTML=''; }
if(editorClose) editorClose.addEventListener('click', closeEditor);
if(editorCancel) editorCancel.addEventListener('click', closeEditor);
if(editorModal){ editorModal.addEventListener('mousedown', function(e){ if(e.target===editorModal) closeEditor(); }); }
function optionList(opts, selected){ return opts.map(function(o){ return '<option '+(o===(selected||'')?'selected':'')+'>'+o+'</option>'; }).join(''); }
function checkboxList(opts, selectedArr){
  var sel = new Set(selectedArr||[]);
  return opts.map(function(o){
    return '<label class="pill"><input type="checkbox" value="'+o+'" '+(sel.has(o)?'checked':'')+'><span>'+o+'</span></label>';
  }).join('');
}
var TYPE_OPTS = ['LookBook','形象片','TVC','纪录片','微电影'];
var RES_OPTS  = ['1080p','2k','4k'];
var RATIO_OPTS= ['16:9','9:16','1:1','4:3','3:4'];

function comboRowHTML(idx,c){
  return (
    '<div class="combo-row" data-idx="'+idx+'">' +
      '<label>类型<select class="combo-type">'+optionList(TYPE_OPTS, c.type||'')+'</select></label>' +
      '<label>影片条数<input class="combo-clips" type="number" min="1" value="'+(c.clips||1)+'"></label>' +
      '<label>分辨率<select class="combo-res">'+optionList(RES_OPTS, c.res||'')+'</select></label>' +
      '<div class="combo-ratios"><div class="label">画幅比例</div><div class="pill-group">'+checkboxList(RATIO_OPTS, c.ratios||[])+'</div></div>' +
      '<div style="margin-left:auto"><button type="button" class="cell-edit combo-del">删除该组合</button></div>' +
    '</div>'
  );
}
function openEditorModal(kind, id){
  var p = projects.find(function(x){ return String(x.id)===String(id); });
  if(!p || !editorModal || !editorForm) return;
  editorModal.classList.add('show');
  editorForm.setAttribute('data-kind', kind);
  editorForm.setAttribute('data-id', id);

  if(kind==='producer'){
    editorTitle.textContent = '编辑 合作制片';
    editorForm.innerHTML =
      '<div class="h-row">' +
        '<label>合作制片（姓名）<input name="producer_name" value="'+(p.producer_name||'')+'"></label>' +
        '<label>合作制片（联系方式）<input name="producer_contact" value="'+(p.producer_contact||'')+'"></label>' +
      '</div>';
  }
  if(kind==='spec'){
    editorTitle.textContent = '编辑 影片类型 & 条数 & 规格（可多组合）';
    var parsed = parseSpec(p.spec);
    var combos = parsed.json ? parsed.combos : [{ type:p.type||'', clips:p.clips||1, res:(parsed.combos[0]||{}).res||'', ratios:(parsed.combos[0]||{}).ratios||[] }];
    var rows = combos.map(function(c,idx){ return comboRowHTML(idx,c); }).join('');
    editorForm.innerHTML =
      '<div id="combo-list">'+rows+'</div>' +
      '<div style="margin-top:10px"><button type="button" id="add-combo" class="cell-edit">新增组合</button></div>' +
      '<div class="combo-help">· 4K（UHD）对应常见比例：16:9 → 3840×2160；9:16 → 2160×3840；1:1 → 2160×2160；4:3 → 2880×2160；3:4 → 2160×2880</div>';
    editorForm.addEventListener('click', function(e){
      var add = e.target && e.target.closest && e.target.closest('#add-combo');
      var del = e.target && e.target.closest && e.target.closest('.combo-del');
      if(add){
        var list = editorForm.querySelector('#combo-list');
        var idx = list.querySelectorAll('.combo-row').length;
        list.insertAdjacentHTML('beforeend', comboRowHTML(idx,{type:'LookBook',clips:1,res:'1080p',ratios:['16:9']}));
      }
      if(del){ var row = del.closest('.combo-row'); if(row) row.remove(); }
    }, { once:false });
  }
  if(kind==='progress'){
    editorTitle.textContent = '编辑 进度（横行 / 完成标记 / 小版本号）';
    var d = parseNotes(p.notes);
    editorForm.innerHTML =
      '<div class="h-row">' +
        '<label>Acopy 日期<input type="date" name="a_copy" value="'+(p.a_copy||'')+'"></label>' +
        '<label>Bcopy 日期<input type="date" name="b_copy" value="'+(p.b_copy||'')+'"></label>' +
        '<label>Final 日期<input type="date" name="final_date" value="'+(p.final_date||'')+'"></label>' +
      '</div>' +
      '<div class="h-row pill-group">' +
        '<label class="pill"><input type="checkbox" name="A_DONE" '+(hasTag(p.notes,'#A_DONE')?'checked':'')+'><span>Acopy 完成</span></label>' +
        '<label class="pill"><input type="checkbox" name="B_DONE" '+(hasTag(p.notes,'#B_DONE')?'checked':'')+'><span>Bcopy 完成</span></label>' +
        '<label class="pill"><input type="checkbox" name="F_DONE" '+(hasTag(p.notes,'#F_DONE')?'checked':'')+'><span>Final 完成</span></label>' +
      </div>' +
      '<div class="h-row">' +
        '<label>Acopy 小版本<select name="ver_A">'+optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], d.versions.A||'v1')+'</select></label>' +
        '<label>Bcopy 小版本<select name="ver_B">'+optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], d.versions.B||'v1')+'</select></label>' +
        '<label>Final 小版本<select name="ver_F">'+optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], d.versions.F||'v1')+'</select></label>' +
      </div>';
  }
  if(kind==='money'){
    editorTitle.textContent = '编辑 金额';
    editorForm.innerHTML =
      '<div class="h-row">' +
        '<label>总金额<input name="quote_amount" type="number" min="0" step="0.01" value="'+(p.quote_amount||0)+'"></label>' +
        '<label>已收款<input name="paid_amount" type="number" min="0" step="0.01" value="'+(p.paid_amount||0)+'"></label>' +
      '</div>';
  }
  if(kind==='changes'){
    editorTitle.textContent = '修改内容';
    var d2 = parseNotes(p.notes);
    var st = stageInfo(p);
    var history = (d2.changes||[]).slice().sort(function(a,b){ return (b.ts||0) - (a.ts||0); });
    var histHTML = history.length ? history.map(function(x){
      var dt = new Date(x.ts||Date.now());
      var time = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0')+' '+String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');
      var appVer = x.appVer ? ('APP '+x.appVer) : 'APP —';
      return '<div class="list-item"><div class="small muted">['+appVer+'] ['+x.phase+' · '+x.version+'] · '+time+'</div><div>'+String(x.text||'').replace(/</g,'&lt;')+'</div></div>';
    }).join('') : '<div class="muted small">暂无历史记录</div>';
    /* ⚠️ 这里是之前出错的位置：务必保证每一段字符串都用引号包住 */
    editorForm.innerHTML =
      '<div class="h-row">' +
        '<label>关联阶段<select name="chg_phase">'+optionList(['Acopy','Bcopy','Final'], st.name==='完结'?'Final':st.name)+'</select></label>' +
        '<label>小版本号<select name="chg_version">'+optionList(['v1','v2','v3','v4','v5','v6','v7','v8'], st.name==='Acopy'?parseNotes(p.notes).versions.A:st.name==='Bcopy'?parseNotes(p.notes).versions.B:parseNotes(p.notes).versions.F)+'</select></label>' +
        '<label>系统版本（只读）<input type="text" value="'+APP_VERSION+'" disabled></label>' +
      '</div>' +
      '<label class="pill"><input type="checkbox" name="auto_bump" checked><span>保存后将所选阶段的小版本 +1</span></label>' +
      '<label style="margin-top:8px">修改内容（本次）<textarea name="chg_text" rows="4" placeholder="填写本次修改点..."></textarea></label>' +
      '<div class="card" style="margin-top:10px"><div class="section-head"><h3>历史修改记录</h3></div><div class="list">'+histHTML+'</div></div>';
  }
}
if (editorForm){
  editorForm.addEventListener('submit', function(e){
    e.preventDefault();
    var id   = editorForm.getAttribute('data-id');
    var kind = editorForm.getAttribute('data-kind');
    var fd   = new FormData(editorForm);
    var patch = {};

    if(kind==='producer'){
      patch.producer_name    = String(fd.get('producer_name')||'').trim();
      patch.producer_contact = String(fd.get('producer_contact')||'').trim();
    }
    if(kind==='spec'){
      var rows = [].slice.call(editorForm.querySelectorAll('.combo-row'));
      var combos = rows.map(function(row){
        var type  = row.querySelector('.combo-type').value;
        var clips = Number(row.querySelector('.combo-clips').value||1);
        var res   = row.querySelector('.combo-res').value;
        var ratios= [].slice.call(row.querySelectorAll('.pill-group input[type="checkbox"]:checked')).map(function(i){return i.value;});
        return { type:type, clips:clips, res:res, ratios:ratios };
      }).filter(function(x){return x.type;});
      if(combos.length){
        patch.spec = JSON.stringify({ combos: combos });
        patch.type  = combos[0].type;
        patch.clips = combos[0].clips;
      }else{
        patch.spec = ''; patch.type=''; patch.clips=1;
      }
    }
    if(kind==='progress'){
      var a_copy    = fd.get('a_copy')||null;
      var b_copy    = fd.get('b_copy')||null;
      var final_date= fd.get('final_date')||null;
      var row = projects.find(function(x){return String(x.id)===String(id);});
      var d = parseNotes(row && row.notes || '');
      d = { tags:d.tags, versions:{
        A: fd.get('ver_A') || (d.versions && d.versions.A) || 'v1',
        B: fd.get('ver_B') || (d.versions && d.versions.B) || 'v1',
        F: fd.get('ver_F') || (d.versions && d.versions.F) || 'v1'
      }, changes:d.changes, free:d.free };
      var tags = new Set(d.tags||[]);
      if(fd.get('A_DONE')) tags.add('#A_DONE'); else tags.delete('#A_DONE');
      if(fd.get('B_DONE')) tags.add('#B_DONE'); else tags.delete('#B_DONE');
      if(fd.get('F_DONE')) tags.add('#F_DONE'); else tags.delete('#F_DONE');
      d.tags = Array.from(tags);
      patch = { a_copy:a_copy||null, b_copy:b_copy||null, final_date:final_date||null, notes: stringifyNotes(d) };
    }
    if(kind==='money'){
      patch.quote_amount = Number(fd.get('quote_amount')||0);
      patch.paid_amount  = Number(fd.get('paid_amount')||0);
    }
    if(kind==='changes'){
      var row2 = projects.find(function(x){return String(x.id)===String(id);});
      var d2 = parseNotes(row2 && row2.notes || '');
      var phase   = String(fd.get('chg_phase')||'Final');
      var version = String(fd.get('chg_version')||'v1');
      var text    = String(fd.get('chg_text')||'').trim();
      var autoBump= !!fd.get('auto_bump');
      if(text){
        var chg = { phase:phase, version:version, text:text, ts: Date.now(), appVer: APP_VERSION };
        d2.changes = Array.isArray(d2.changes)? d2.changes : [];
        d2.changes.push(chg);
      }
      d2.versions = d2.versions || {A:'v1',B:'v1',F:'v1'};
      if(autoBump){
        if(phase==='Acopy') d2.versions.A = bumpVersion(d2.versions.A);
        if(phase==='Bcopy') d2.versions.B = bumpVersion(d2.versions.B);
        if(phase==='Final') d2.versions.F = bumpVersion(d2.versions.F);
      }
      patch.notes = stringifyNotes(d2);
    }

    supa.from('projects').update(patch).eq('id', id).then(function(){
      closeEditor();
      fetchProjects().then(function(){ renderAll(); });
    });
  });
}

/* 项目列表（规格多组合换行；支付状态内联；修改内容可编辑） */
function formatProgressCell(p){
  var vers = parseNotes(p.notes).versions;
  var near = nearestMilestone(p);
  var doneF = hasTag(p.notes,'#F_DONE');
  if(doneF && p.final_date){
    var d = new Date(p.final_date);
    var mm = String(d.getMonth()+1).padStart(2,'0');
    var dd = String(d.getDate()).padStart(2,'0');
    return '<span class="badge badge-done">完结</span> <span class="small">- '+mm+'.'+dd+'</span>';
  }
  if(!near || !near.k || !near.date) return '—';
  var mm2 = String(near.date.getMonth()+1).padStart(2,'0');
  var dd2 = String(near.date.getDate()).padStart(2,'0');
  var small = near.k==='Acopy'? (vers.A||'v1') : near.k==='Bcopy'? (vers.B||'v1') : (vers.F||'v1');
  var cls = near.k==='Acopy' ? 'badge-a' : near.k==='Bcopy' ? 'badge-b' : 'badge-f';
  return '<span class="badge '+cls+'">'+near.k+'</span> <span class="small">- '+mm2+'.'+dd2+' - '+small+'</span>';
}
function shrinkOverflowCells(tb){
  var cells = tb.querySelectorAll('td .text-cell');
  for (var i=0;i<cells.length;i++){
    var el = cells[i];
    var td = el.closest('td');
    if(!td) continue;
    if(td.scrollWidth > td.clientWidth || el.scrollWidth > td.clientWidth){
      td.classList.add('shrink');
    }else{
      td.classList.remove('shrink');
    }
  }
}
function renderProjects(list){
  list = list || projects;
  var tb = document.getElementById('projects-body'); if(!tb) return; tb.innerHTML='';
  for(var i=0;i<list.length;i++){
    var p = list[i];
    var tr = document.createElement('tr');
    var currentPay = p.pay_status || (unpaidAmt(p)<=0 ? '已收尾款' : (Number(p.paid_amount||0)>0?'已收定金':'未收款'));
    var moneyText = money(p.quote_amount) + ' / ' + money(p.paid_amount);
    var d = parseNotes(p.notes);
    var hist = (d.changes||[]).slice().sort(function(a,b){return (b.ts||0)-(a.ts||0);});
    var last = hist[0];
    var lastText = last ? ('['+last.phase+'·'+last.version+'] '+ (last.text||'')).slice(0,64) + ((last.text||'').length>60?'…':'') : '—';
    var specHTML = mergeTypeSpec(p, { multiline:true }) || '—';

    tr.innerHTML =
      '<td contenteditable="true" data-k="title" data-id="'+p.id+'">'+(p.title||'')+'</td>' +
      '<td><div class="cell-summary"><span>'+(p.producer_name||'未填')+'</span>'+(p.producer_contact?('<span class="muted small">· '+p.producer_contact+'</span>'):'')+'<button class="cell-edit edit-btn" data-kind="producer" data-id="'+p.id+'">编辑</button></div></td>' +
      '<td class="spec-col"><div class="cell-summary"><span class="text-cell">'+specHTML+'</span><button class="cell-edit edit-btn" data-kind="spec" data-id="'+p.id+'">编辑</button></div></td>' +
      '<td><div class="cell-summary"><span class="text-cell">'+formatProgressCell(p)+'</span><button class="cell-edit edit-btn" data-kind="progress" data-id="'+p.id+'">编辑</button></div></td>' +
      '<td><div class="cell-summary"><select class="pay-inline" data-id="'+p.id+'">'+['未收款','已收定金','已收尾款'].map(function(o){return '<option '+(o===currentPay?'selected':'')+'>'+o+'</option>';}).join('')+'</select></div></td>' +
      '<td><div class="cell-summary"><span class="muted text-cell">'+moneyText+'</span><button class="cell-edit edit-btn" data-kind="money" data-id="'+p.id+'">编辑</button></div></td>' +
      '<td><div class="cell-summary"><span class="small text-cell">'+lastText+'</span><button class="cell-edit edit-btn" data-kind="changes" data-id="'+p.id+'">编辑</button></div></td>';
    tb.appendChild(tr);
  }

  tb.addEventListener('blur', function(e){
    var td = e.target.closest && e.target.closest('td[contenteditable="true"]'); if(!td) return;
    var id = td.getAttribute('data-id'); var k = td.getAttribute('data-k'); var v = td.textContent.trim();
    if(!id || !k) return;
    var patch = {}; patch[k]=v;
    supa.from('projects').update(patch).eq('id', id);
  }, true);

  tb.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.edit-btn'); if(!btn) return;
    openEditorModal(btn.getAttribute('data-kind'), btn.getAttribute('data-id'));
  });

  tb.addEventListener('change', function(e){
    var sel = e.target.closest && e.target.closest('select.pay-inline'); if(!sel) return;
    var id = sel.getAttribute('data-id');
    supa.from('projects').update({ pay_status: sel.value }).eq('id', id).then(function(r){
      if(r && r.error){ console.warn('pay_status 更新失败（可能列不存在）'); }
    });
  });

  shrinkOverflowCells(tb);
}

/* 最近项目快速查看 */
var quickModal = document.getElementById('quick-modal');
var quickTitle = document.getElementById('quick-title');
var quickBody  = document.getElementById('quick-body');
var quickClose = document.getElementById('quick-close');
var quickFinalBtn = document.getElementById('quick-final-done');
function closeQuick(){ if(quickModal) quickModal.classList.remove('show'); if(quickBody) quickBody.innerHTML=''; }
if(quickClose) quickClose.addEventListener('click', closeQuick);
if(quickModal){ quickModal.addEventListener('mousedown', function(e){ if(e.target===quickModal) closeQuick(); }); }
function openQuickModal(id){
  var p = projects.find(function(x){return String(x.id)===String(id);}); if(!p || !quickModal || !quickBody) return;
  var st = stageInfo(p);
  var near = nearestMilestone(p);
  quickTitle.textContent = (p.title||'未命名') + (p.brand?(' · '+p.brand):'');
  quickBody.innerHTML =
    '<div class="grid-1">' +
      '<div>合作制片：'+([p.producer_name,p.producer_contact].filter(Boolean).join(' · ')||'—')+'</div>' +
      '<div class="small muted">规格：'+(mergeTypeSpec(p)||'—')+'</div>' +
      '<div class="small muted">节点：'+([p.a_copy?('Acopy '+p.a_copy):'', p.b_copy?('Bcopy '+p.b_copy):'', p.final_date?('Final '+p.final_date):''].filter(Boolean).join(' ｜ ')||'—')+'</div>' +
      '<div style="margin-top:8px" class="pmeta">' +
        '<div class="prog prog-fat" style="flex:1"><div class="prog-bar" style="width:'+st.percent+'%"><span class="prog-text">'+st.name+(st.version?(' '+st.version):'')+' · '+st.percent+'%</span></div></div>' +
        (st.version ? ('<span class="badge badge-'+st.badge+'">'+st.version+'</span>') : '<span class="badge badge-done">完结</span>') +
      '</div>' +
    '</div>';
  quickFinalBtn.onclick = function(){
    var row = projects.find(function(x){return String(x.id)===String(id);});
    var d = parseNotes(row && row.notes || '');
    if(d.tags && d.tags.add){ d.tags.add('#F_DONE'); }
    else { var s=new Set(d.tags||[]); s.add('#F_DONE'); d.tags = Array.from(s); }
    supa.from('projects').update({ notes: stringifyNotes(d) }).eq('id', id).then(function(){
      fetchProjects().then(function(){ renderAll(); closeQuick(); });
    });
  };
  quickModal.classList.add('show');
}

/* 合集/日历/财务榜单 */
function renderGallery(){
  var grid = document.getElementById('gallery-grid'); if(!grid) return; grid.innerHTML='';
  var finals = projects.filter(function(p){ return p.final_link; });
  if(finals.length===0){
    var ph = document.createElement('div'); ph.className='poster';
    ph.innerHTML = '<div class="caption">暂未上传成片，请在项目中填写 Final 链接</div>'; grid.appendChild(ph); return;
  }
  for(var i=0;i<finals.length;i++){
    var p = finals[i];
    var a = document.createElement('a');
    a.className='poster'; a.href=p.final_link; a.target='_blank';
    a.innerHTML = '<div class="caption">'+(p.title||'未命名')+(p.brand?(' · '+p.brand):'')+'</div>';
    grid.appendChild(a);
  }
}

var gridEl  = document.getElementById('cal-grid');
var labelEl = document.getElementById('cal-label');
var calBase = new Date(); calBase.setDate(1);
var btnPrev = document.getElementById('cal-prev'); if(btnPrev){ btnPrev.addEventListener('click', function(){ calBase.setMonth(calBase.getMonth()-1); renderCalendar(); }); }
var btnNext = document.getElementById('cal-next'); if(btnNext){ btnNext.addEventListener('click', function(){ calBase.setMonth(calBase.getMonth()+1); renderCalendar(); }); }
function renderCalendar(){
  if(!gridEl || !labelEl) return;
  gridEl.innerHTML=''; var y=calBase.getFullYear(), m=calBase.getMonth();
  labelEl.textContent = y+'年 '+(m+1)+'月';
  var first=new Date(y,m,1), start=(first.getDay()+6)%7, days=new Date(y,m+1,0).getDate();
  var today=new Date(); today.setHours(0,0,0,0);
  var evs={};
  for(var i=0;i<projects.length;i++){
    var p = projects[i];
    [['a_copy','a'],['b_copy','b'],['final_date','final']].forEach(function(pair){
      var key=pair[0], typ=pair[1];
      var d = fmt(p[key]); if(!d) return;
      if(d.getFullYear()!==y || d.getMonth()!==m) return;
      var day=d.getDate();
      var done = (typ==='a' && hasTag(p.notes,'#A_DONE')) || (typ==='b' && hasTag(p.notes,'#B_DONE')) || (typ==='final' && hasTag(p.notes,'#F_DONE'));
      var overdue = d<today && !done;
      if(!evs[day]) evs[day]=[];
      evs[day].push({ typ:typ, txt:(p.title||'未命名')+' · '+(typ==='a'?'Acopy':typ==='b'?'Bcopy':'Final'), overdue:overdue });
    });
  }
  for(var i2=0;i2<42;i2++){
    var cell=document.createElement('div'); cell.className='cal-cell';
    var day=i2-start+1;
    if(day>0 && day<=days){
      var head=document.createElement('div'); head.className='cal-day'; head.textContent=String(day); cell.appendChild(head);
      (evs[day]||[]).forEach(function(e){
        var tag=document.createElement('span');
        tag.className='ev ' + (e.typ==='a'?'ev-a':e.typ==='b'?'ev-b':'ev-final') + (e.overdue?' ev-overdue':'');
        tag.textContent=e.txt; cell.appendChild(tag);
      });
    }
    gridEl.appendChild(cell);
  }
}

/* 财务榜单 + 收入趋势 + 截至日期 */
function renderFinance(){
  var rp=document.getElementById('rank-partner');
  var rq=document.getElementById('rank-project');
  var aging=document.getElementById('aging');
  if(!rp || !rq || !aging) return;

  var byPartner = new Map();
  for(var i=0;i<projects.length;i++){
    var p = projects[i];
    var k=p.producer_name||'未填';
    var sum = Number(p.paid_amount||0);
    byPartner.set(k, (byPartner.get(k)||0)+sum);
  }
  rp.innerHTML='';
  Array.from(byPartner.entries()).sort(function(a,b){return b[1]-a[1];}).forEach(function(pair){
    var k=pair[0], v=pair[1];
    var li=document.createElement('div'); li.className='list-item';
    li.innerHTML = '<div>'+k+'</div><strong>'+money(v)+'</strong>'; rp.appendChild(li);
  });

  rq.innerHTML='';
  projects.slice().sort(function(a,b){return Number(b.quote_amount||0)-Number(a.quote_amount||0);}).forEach(function(p){
    var li=document.createElement('div'); li.className='list-item';
    li.innerHTML = '<div>'+ (p.title||'未命名') +'</div><strong>'+money(p.quote_amount)+'</strong>'; rq.appendChild(li);
  });

  aging.innerHTML='';
  var today=Date.now();
  projects.filter(function(p){ return p.final_date && unpaidAmt(p)>0; })
    .sort(function(a,b){ return new Date(a.final_date)-new Date(b.final_date); })
    .forEach(function(p){
      var days = Math.floor((today - new Date(p.final_date).getTime())/86400000);
      var li=document.createElement('div'); li.className='list-item';
      li.innerHTML = '<div>'+(p.title||'未命名')+' / '+(p.producer_name||'未填')+'</div><div>'+money(unpaidAmt(p))+' / '+(days>0?days:0)+'天</div>';
      aging.appendChild(li);
    });

  var start = new Date(Date.now()-89*86400000); start.setHours(0,0,0,0);
  var daysArr = Array.from({length:90},function(_,i){ return new Date(start.getTime()+i*86400000); });
  var map = new Map(daysArr.map(function(d){ return [d.toDateString(),0]; }));
  for(var j=0;j<projects.length;j++){
    var d = new Date(projects[j].updated_at || projects[j].created_at || Date.now()); d.setHours(0,0,0,0);
    if(d>=start){
      var k = d.toDateString();
      map.set(k, (map.get(k)||0) + Number(projects[j].paid_amount||0));
    }
  }
  var series = daysArr.map(function(d){ return map.get(d.toDateString())||0; });
  drawTrend(document.getElementById('trend'), series);

  var asof=document.getElementById('asof-finance');
  if(asof){ asof.textContent = todayStr(); }
}
function drawTrend(container, arr){
  if(!container) return;
  container.innerHTML='';
  var w=container.clientWidth||800, h=container.clientHeight||180, pad=10;
  var max=Math.max.apply(null, arr.concat([1])), step=(w-2*pad)/Math.max(arr.length-1,1);
  var d=''; for(var i=0;i<arr.length;i++){ var x=pad+i*step, y=h-pad-(arr[i]/max)*(h-2*pad); d+=(i?'L':'M')+x+','+y+' '; }
  container.innerHTML = '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><path d="'+d+'" fill="none" stroke="#0a84ff" stroke-width="2"/></svg>';
}

/* 导航绑定 */
var goListBtn = document.getElementById('go-list');
if(goListBtn){ goListBtn.addEventListener('click', function(){ showView('projects'); }); }
if(nav.home)     nav.home.addEventListener('click', function(){ showView('home'); });
if(nav.projects) nav.projects.addEventListener('click', function(){ showView('projects'); });
if(nav.gallery)  nav.gallery.addEventListener('click', function(){ showView('gallery'); });
if(nav.finance)  nav.finance.addEventListener('click', function(){ showView('finance'); renderFinance(); });
if(nav.schedule) nav.schedule.addEventListener('click', function(){ showView('schedule'); renderCalendar(); });

/* 新建项目 */
var mNew = document.getElementById('new-modal');
var btnNew= document.getElementById('btn-new');
var btnNewCancel = document.getElementById('new-cancel');
if(btnNew){ btnNew.addEventListener('click', function(){ if(mNew) mNew.classList.add('show'); }); }
if(btnNewCancel){ btnNewCancel.addEventListener('click', function(){ if(mNew) mNew.classList.remove('show'); }); }
var newForm = document.getElementById('new-form');
if(newForm){
  newForm.addEventListener('submit', function(e){
    e.preventDefault();
    var fd = new FormData(e.target); var row = {};
    fd.forEach(function(v,k){ row[k]=v; });
    row.clips = Number(row.clips||1);
    row.quote_amount   = Number(row.quote_amount||0);
    row.paid_amount    = Number(row.paid_amount||0);
    row.deposit_amount = 0; /* v1.4.x：取消“定金” */
    row.notes = stringifyNotes({ tags:[], versions:{A:'v1',B:'v1',F:'v1'}, changes:[], free:'' });
    supa.from('projects').insert(row).then(function(r){
      if(r.error){ alert(r.error.message); return; }
      if(mNew) mNew.classList.remove('show');
      fetchProjects().then(function(){ renderAll(); });
    });
  });
}

/* 渲染整页 */
function renderAll(){
  renderKpis();
  renderRecent();
  renderProjects();
  renderGallery();
  renderFinance();
  renderCalendar(); /* 切页时也会再触发 */
}

/* 启动 */
function boot(){
  supa.auth.getSession().then(function(s){
    if(!(s.data && s.data.session)){ showView('auth'); return; }
    return bootAfterAuth();
  }).catch(function(err){
    console.error('Boot error:', err);
    __toast('启动失败：'+(err.message||''));
  });
}
function bootAfterAuth(){
  return fetchProjects().then(function(){ renderAll(); showView('home'); });
}
if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
