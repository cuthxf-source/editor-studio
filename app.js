<script type="module">
// =========================
// 1) 替换为你的 Supabase 凭据（已为你填好）
// =========================
const SUPABASE_URL = "https://lywlcsrndkturdpgvvnc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d2xjc3JuZGt0dXJkcGd2dm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwOTg1NzUsImV4cCI6MjA3MDY3NDU3NX0.z49xmAaG1ciyMbGPPamoYfiAwFTP0PfX7__K3iRRkhs";

// =========================
// 2) 导入并初始化 supabase-js
//    你的 index.html 里需要引入：
//    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// =========================
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================
// 3) 轻量的 UI（纯脚本生成，避免你改 HTML）
// =========================
const mount = document.getElementById("app") || document.body;

const css = `
  .wrap{max-width:1080px;margin:32px auto;padding:16px}
  .card{background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 2px 10px rgba(0,0,0,.04)}
  h1{font-size:28px;margin:0 0 8px}
  .muted{color:#666;font-size:13px}
  .row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
  input,select,textarea{padding:10px;border:1px solid #ddd;border-radius:10px;outline:none;font-size:14px}
  input:focus,select:focus,textarea:focus{border-color:#222}
  button{padding:10px 14px;border:1px solid #222;background:#222;color:#fff;border-radius:10px;font-size:14px;cursor:pointer}
  button.ghost{background:#fff;color:#222}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{border-bottom:1px solid #eee;padding:10px;text-align:left;font-size:14px;vertical-align:top}
  .right{display:flex;gap:8px;align-items:center}
  .badge{padding:3px 8px;border-radius:999px;background:#f6f7f8;border:1px solid #eee;font-size:12px}
`;
const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);

mount.innerHTML = `
  <div class="wrap">
    <div class="card">
      <h1>剪辑 ERP 管理</h1>
      <div class="muted">登录后可管理项目：新建 / 编辑 / 删除 / 搜索。</div>
      <div class="row" id="authRow">
        <input id="email" type="email" placeholder="邮箱">
        <input id="password" type="password" placeholder="密码（至少6位）">
        <button id="btnSignUp">注册</button>
        <button id="btnSignIn">登录</button>
        <button id="btnSignOut" class="ghost" style="display:none">退出</button>
      </div>
      <div class="muted" id="me"></div>
    </div>

    <div class="card" id="projectFormCard" style="display:none">
      <div class="row">
        <input id="title" placeholder="项目标题 *" style="flex:1">
        <input id="brand" placeholder="品牌">
        <select id="type">
          <option value="">影片类型</option>
          <option>LOOKBOOK</option>
          <option>形象片</option>
          <option>TVC</option>
          <option>宣传片</option>
          <option>纪录片</option>
          <option>花絮</option>
        </select>
        <input id="spec" placeholder="输出规格，如 1080p/4K">
        <select id="ratio">
          <option value="">输出比例</option>
          <option>16:9</option>
          <option>9:16</option>
          <option>1:1</option>
          <option>3:4</option>
          <option>4:3</option>
        </select>
        <input id="duration" placeholder="时长（如 30s / 2min）">
      </div>
      <div class="row">
        <input id="a_copy" type="date" placeholder="A copy 日期">
        <input id="b_copy" type="date" placeholder="B copy 日期">
        <input id="final_date" type="date" placeholder="Final 日期">
        <select id="pay_status">
          <option value="unpaid">未收款</option>
          <option value="deposit">已收定金</option>
          <option value="paid">已收款</option>
        </select>
        <select id="status">
          <option value="open">未完成</option>
          <option value="closed">已完成</option>
        </select>
      </div>
      <div class="row">
        <input id="final_link" placeholder="成片链接">
        <textarea id="notes" placeholder="备注 / 修改意见" style="flex:1;min-height:48px"></textarea>
      </div>
      <div class="right">
        <button id="btnSave">保存/更新</button>
        <button id="btnReset" class="ghost">重置表单</button>
        <span class="badge" id="editingFlag" style="display:none">正在编辑</span>
      </div>
    </div>

    <div class="card" id="projectListCard" style="display:none">
      <div class="row">
        <input id="q" style="flex:1" placeholder="搜索：标题 / 品牌 / 备注">
        <button id="btnRefresh" class="ghost">刷新列表</button>
      </div>
      <table id="tbl">
        <thead>
          <tr>
            <th style="width:22%">标题 / 品牌</th>
            <th>类型 / 规格 / 比例 / 时长</th>
            <th>A/B/Final</th>
            <th>收款 / 状态</th>
            <th>成片链接</th>
            <th style="width:140px">操作</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div class="muted" id="emptyHint" style="display:none">暂无数据，点击上方保存添加一个项目。</div>
    </div>
  </div>
`;

// ============ 工具函数 ============
const $ = (id) => document.getElementById(id);
const toast = (msg) => alert(msg);

// ============ 认证 ============

async function signUp() {
  const email = $("email").value.trim();
  const password = $("password").value.trim();
  if (!email || password.length < 6) return toast("请输入邮箱，密码至少 6 位");
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return toast("注册失败：" + error.message);
  toast("注册成功，已登录。");
  await syncUI();
}

async function signIn() {
  const email = $("email").value.trim();
  const password = $("password").value.trim();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return toast("登录失败：" + error.message);
  await syncUI();
}

async function signOut() {
  await supabase.auth.signOut();
  await syncUI();
}

// 监听登录状态变化
supabase.auth.onAuthStateChange(async () => {
  await syncUI();
});

// 同步 UI
async function syncUI() {
  const { data: { user } } = await supabase.auth.getUser();
  $("btnSignOut").style.display = user ? "" : "none";
  $("projectFormCard").style.display = user ? "" : "none";
  $("projectListCard").style.display = user ? "" : "none";
  $("me").textContent = user ? `当前登录：${user.email}` : "未登录";
  if (user) {
    resetForm();
    await loadList();
  } else {
    $("tbl").querySelector("tbody").innerHTML = "";
  }
}

// ============ 表单 & 列表 ============

let editingId = null; // 当前编辑记录 id

function getFormData() {
  return {
    title: $("title").value.trim(),
    brand: $("brand").value.trim(),
    type: $("type").value || null,
    spec: $("spec").value.trim(),
    ratio: $("ratio").value || null,
    duration: $("duration").value.trim(),
    a_copy: $("a_copy").value || null,
    b_copy: $("b_copy").value || null,
    final_date: $("final_date").value || null,
    pay_status: $("pay_status").value,
    status: $("status").value,
    final_link: $("final_link").value.trim(),
    notes: $("notes").value.trim()
  };
}

function setFormData(row) {
  $("title").value = row.title || "";
  $("brand").value = row.brand || "";
  $("type").value = row.type || "";
  $("spec").value = row.spec || "";
  $("ratio").value = row.ratio || "";
  $("duration").value = row.duration || "";
  $("a_copy").value = row.a_copy || "";
  $("b_copy").value = row.b_copy || "";
  $("final_date").value = row.final_date || "";
  $("pay_status").value = row.pay_status || "unpaid";
  $("status").value = row.status || "open";
  $("final_link").value = row.final_link || "";
  $("notes").value = row.notes || "";
}

function resetForm() {
  editingId = null;
  setFormData({
    pay_status: "unpaid",
    status: "open"
  });
  $("editingFlag").style.display = "none";
}

async function saveOrUpdate() {
  const payload = getFormData();
  if (!payload.title) return toast("项目标题为必填");

  if (editingId) {
    const { error } = await supabase.from("projects")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", editingId);
    if (error) return toast("更新失败：" + error.message);
    toast("已更新");
  } else {
    const { error } = await supabase.from("projects")
      .insert([{ ...payload }]);
    if (error) return toast("保存失败：" + error.message);
    toast("已保存");
  }
  resetForm();
  await loadList();
}

async function loadList() {
  const q = $("q").value.trim();

  let query = supabase.from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (q) {
    // 简单过滤（后端可替换为 full-text）
    query = query.or(
      `title.ilike.%${q}%,brand.ilike.%${q}%,notes.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) return toast("加载失败：" + error.message);

  const tbody = $("tbl").querySelector("tbody");
  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    $("emptyHint").style.display = "";
    return;
  }
  $("emptyHint").style.display = "none";

  for (const row of data) {
    const tr = document.createElement("tr");

    const cell1 = `
      <div><b>${esc(row.title)}</b></div>
      <div class="muted">${esc(row.brand || "")}</div>
    `;

    const cell2 = `
      <div class="muted">${esc(row.type || "-")} / ${esc(row.spec || "-")} / ${esc(row.ratio || "-")} / ${esc(row.duration || "-")}</div>
    `;

    const cell3 = `
      <div class="muted">A: ${esc(row.a_copy || "-")} / B: ${esc(row.b_copy || "-")} / Final: ${esc(row.final_date || "-")}</div>
    `;

    const cell4 = `
      <span class="badge">${row.pay_status === "paid" ? "已收款" : row.pay_status === "deposit" ? "已收定金" : "未收款"}</span>
      <span class="badge">${row.status === "closed" ? "已完成" : "未完成"}</span>
    `;

    const cell5 = row.final_link
      ? `<a target="_blank" href="${escAttr(row.final_link)}">打开</a>`
      : `<span class="muted">-</span>`;

    const ops = `
      <button data-edit="${row.id}" class="ghost">编辑</button>
      <button data-del="${row.id}">删除</button>
    `;

    tr.innerHTML = `
      <td>${cell1}</td>
      <td>${cell2}</td>
      <td>${cell3}</td>
      <td>${cell4}</td>
      <td>${cell5}</td>
      <td>${ops}</td>
    `;
    tbody.appendChild(tr);
  }

  // 绑定操作按钮
  tbody.querySelectorAll("button[data-edit]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) return toast("读取失败：" + error.message);
      editingId = id;
      setFormData(data);
      $("editingFlag").style.display = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  tbody.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!confirm("确认删除该项目？")) return;
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) return toast("删除失败：" + error.message);
      await loadList();
    });
  });
}

// 简单转义
function esc(s){ return (s || "").toString().replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }
function escAttr(s){ return esc(s).replace(/"/g, "&quot;"); }

// ============ 绑定事件 ============
$("btnSignUp").addEventListener("click", signUp);
$("btnSignIn").addEventListener("click", signIn);
$("btnSignOut").addEventListener("click", signOut);

$("btnSave").addEventListener("click", saveOrUpdate);
$("btnReset").addEventListener("click", resetForm);
$("btnRefresh").addEventListener("click", loadList);
$("q").addEventListener("input", () => {
  // 防抖
  clearTimeout(window.__qtid);
  window.__qtid = setTimeout(loadList, 300);
});

// 首次同步
syncUI();

</script>
