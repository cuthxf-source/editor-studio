import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ← 替换成你的 Supabase 项目（我已按你给的值填好）
const SUPABASE_URL = "https://lywlcsrndkturdpgvvnc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d2xjc3JuZGt0dXJkcGd2dm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwOTg1NzUsImV4cCI6MjA3MDY3NDU3NX0.z49xmAaG1ciyMbGPPamoYfiAwFTP0PfX7__K3iRRkhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let editingId = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Tabs
$$(".nav-btn").forEach(btn=>{
  btn.onclick=()=>{
    $$(".tab").forEach(t=>t.classList.remove("active"));
    $("#tab-"+btn.dataset.tab).classList.add("active");
  };
});

// Login dialogs
const dlgLogin = $("#loginDialog");
const dlgSignup = $("#signupDialog");
$("#btnLogin").onclick = ()=> dlgLogin.showModal();
$("#openSignup").onclick = ()=> { dlgLogin.close(); dlgSignup.showModal(); };

async function refreshSession() {
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;
  if (user) {
    $("#authUser").textContent = user.email;
    $("#btnLogin").hidden = true;
    $("#btnLogout").hidden = false;
    await loadAll();
  } else {
    $("#authUser").textContent = "";
    $("#btnLogin").hidden = false;
    $("#btnLogout").hidden = true;
  }
}
$("#btnLogout").onclick = async () => { await supabase.auth.signOut(); location.reload(); };
$("#doLogin").onclick = async () => {
  const email = $("#loginEmail").value.trim();
  const password = $("#loginPwd").value.trim();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);
  dlgLogin.close(); refreshSession();
};
$("#doSignup").onclick = async () => {
  const email = $("#signupEmail").value.trim();
  const password = $("#signupPwd").value.trim();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return alert(error.message);
  alert("注册成功，请查收邮箱并完成验证，然后再次登录。");
  dlgSignup.close();
};

// Quote
$("#btnQuote").onclick = () => {
  const hEdit = +$("#qEdit").value||0;
  const hGrade = +$("#qGrade").value||0;
  const hMix = +$("#qMix").value||0;
  const hComp = +$("#qComp").value||0;
  const rounds = +$("#qRounds").value||0;
  const level = +$("#qLevel").value;

  const rateEdit=300, rateGrade=400, rateMix=350, rateComp=450, revFee=200;
  const price = (hEdit*rateEdit + hGrade*rateGrade + hMix*rateMix + hComp*rateComp + rounds*revFee) * level;
  $("#quotePrice").textContent = Math.round(price);
};

// Project dialog
const dlgEdit = $("#editDialog");
$("#btnAdd").onclick = ()=>{ editingId=null; fillForm(); dlgEdit.showModal(); };
$("#saveProject").onclick = saveProject;
$("#deleteProject").onclick = delProject;

// Search / view
$("#search").oninput = renderProjects;
$("#viewMode").onchange = renderProjects;

// Load all
async function loadAll(){
  await Promise.all([loadKPIs(), loadRecent(), loadProjects(), loadCalendar(), loadGallery()]);
}

async function loadKPIs(){
  const { data, error } = await supabase.from("projects").select("status");
  if (error) return console.error(error);
  const total = data.length;
  const done = data.filter(x=>x.status==="done").length;
  const open = total - done;
  $("#kpiTotal").textContent = total;
  $("#kpiOpen").textContent = open;
  $("#kpiDone").textContent = done;
  $("#kpiOpen").onclick = ()=>{
    document.querySelector('[data-tab="projects"]').click();
    $("#search").value = "@open";
    renderProjects();
  };
}

async function loadRecent(){
  const { data } = await supabase.from("projects")
    .select("title,status,final_date").order("updated_at",{ascending:false}).limit(6);
  $("#recentList").innerHTML = (data||[]).map(r=>`<li>${r.title} · ${r.status==='done'?'已完成':'进行中'}</li>`).join("") || "<li>暂无</li>";
}

let cacheProjects = [];
async function loadProjects(){
  const { data, error } = await supabase.from("projects").select("*").order("updated_at",{ascending:false});
  if (error) return console.error(error);
  cacheProjects = data||[];
  renderProjects();
}
function renderProjects(){
  const q = $("#search").value.trim().toLowerCase();
  const mode = $("#viewMode").value;
  let list = [...cacheProjects];
  if (q){
    if (q==="@open") list = list.filter(x=>x.status!=="done");
    else list = list.filter(x =>
      (x.title||"").toLowerCase().includes(q) ||
      (x.brand||"").toLowerCase().includes(q) ||
      (x.type||"").toLowerCase().includes(q)
    );
  }
  const head = `
    <div class="row head">
      <div>项目</div><div>品牌</div><div>状态</div><div>收款</div>
      <div>时间（A/B/Final）</div><div>操作</div>
    </div>`;
  const rows = list.map(p=>{
    const time = [p.a_copy||"-", p.b_copy||"-", p.final_date||"-"].join(" / ");
    return `
      <div class="row">
        <div>${p.title||"-"}<div class="muted">${p.type||""} · ${p.spec||""} · ${p.ratio||""}</div></div>
        <div>${p.brand||"-"}</div>
        <div>${p.status==='done'?'已完成':'未完成'}</div>
        <div>${p.pay_status==='paid'?'已收款':(p.pay_status==='deposit'?'已收定金':'未收款')}</div>
        <div>${time}</div>
        <div><button class="btn" data-edit="${p.id}">编辑</button></div>
      </div>`;
  }).join("");
  const container = $("#projectsContainer");
  container.className = mode==="card" ? "masonry" : "table";
  container.innerHTML = mode==="card"
    ? list.map(p=>`
        <div class="item card">
          <div class="card-title">${p.title||"-"}</div>
          <div class="muted">${p.brand||"-"} · ${p.type||""}</div>
          <div class="muted">A/B/Final: ${(p.a_copy||"-")} / ${(p.b_copy||"-")} / ${(p.final_date||"-")}</div>
          <div class="row"><button class="btn" data-edit="${p.id}">编辑</button></div>
        </div>`).join("") || `<div class="card">暂无项目</div>`
    : head + rows || head + `<div class="row"><div>暂无项目</div></div>`;

  $$('[data-edit]').forEach(b=> b.onclick = () => openEdit(b.dataset.edit));
}

async function openEdit(id){
  editingId = id;
  const p = cacheProjects.find(x=>x.id===id);
  fillForm(p);
  $("#deleteProject").hidden = !id;
  dlgEdit.showModal();
}
function fillForm(p={}){
  $("#editTitle").textContent = p.id ? "编辑项目" : "新建项目";
  $("#pTitle").value = p.title||"";
  $("#pBrand").value = p.brand||"";
  $("#pType").value = p.type||"LOOKBOOK";
  $("#pSpec").value = p.spec||"1080p";
  $("#pRatio").value = p.ratio||"16:9";
  $("#pDuration").value = p.duration||"";
  $("#pACopy").value = p.a_copy||"";
  $("#pBCopy").value = p.b_copy||"";
  $("#pFinal").value = p.final_date||"";
  $("#pStatus").value = p.status||"open";
  $("#pPay").value = p.pay_status||"unpaid";
  $("#pFinalLink").value = p.final_link||"";
  $("#pNotes").value = p.notes||"";
}

async function saveProject(){
  const payload = {
    title: $("#pTitle").value.trim(),
    brand: $("#pBrand").value.trim(),
    type: $("#pType").value,
    spec: $("#pSpec").value,
    ratio: $("#pRatio").value,
    duration: $("#pDuration").value.trim(),
    a_copy: $("#pACopy").value || null,
    b_copy: $("#pBCopy").value || null,
    final_date: $("#pFinal").value || null,
    status: $("#pStatus").value,
    pay_status: $("#pPay").value,
    final_link: $("#pFinalLink").value.trim() || null,
    notes: $("#pNotes").value.trim() || null
  };
  if (!payload.title) return alert("项目名称必填");
  let res;
  if (editingId) {
    res = await supabase.from("projects").update(payload).eq("id", editingId).select().single();
  } else {
    res = await supabase.from("projects").insert(payload).select().single();
  }
  if (res.error) return alert(res.error.message);
  dlgEdit.close(); await loadProjects(); await loadKPIs(); await loadGallery();
}

async function delProject(){
  if (!editingId) return;
  if (!confirm("确认删除该项目？")) return;
  const { error } = await supabase.from("projects").delete().eq("id", editingId);
  if (error) return alert(error.message);
  dlgEdit.close(); await loadProjects(); await loadKPIs(); await loadGallery();
}

async function loadCalendar(){
  const { data } = await supabase.from("projects").select("title,a_copy,b_copy,final_date").order("final_date",{ascending:true});
  $("#calendar").innerHTML = (data||[]).map(p=>{
    const span = [p.a_copy,p.b_copy,p.final_date].filter(Boolean).join(" → ");
    return `<div>• ${p.title} ：${span||"未排期"}</div>`;
  }).join("") || "暂无排期";
}
async function loadGallery(){
  const { data } = await supabase.from("projects").select("title,final_link").neq("final_link",null);
  $("#gallery").innerHTML = (data||[]).map(g=>`
    <div class="item">
      <div class="card-title">${g.title}</div>
      <a href="${g.final_link}" target="_blank">${g.final_link}</a>
    </div>`).join("") || `<div class="card">暂无成片</div>`;
}

supabase.auth.onAuthStateChange(() => refreshSession());
refreshSession();
