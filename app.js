/* app.js — v0.4 */

const supa = window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY,{auth:{persistSession:true}});
const views={login:el('view-login'),home:el('view-home'),projects:el('view-projects'),schedule:el('view-schedule'),gallery:el('view-gallery'),finance:el('view-finance')};
const navs={home:'btn-home',projects:'btn-projects',schedule:'btn-schedule',gallery:'btn-gallery',finance:'btn-finance',logout:'btn-logout'};
Object.keys(navs).forEach(k=>{const b=el(navs[k]);if(!b)return;(k==='logout'?b:b).onclick=()=>k==='logout'?signOut():show(k)});
function el(id){return document.getElementById(id)}
function show(k){Object.values(views).forEach(v=>v.classList.remove('active'));(views[k]||views.home).classList.add('active');document.querySelectorAll('.nav-btn').forEach(b=>b.removeAttribute('aria-current'));if(navs[k])el(navs[k]).setAttribute('aria-current','page');}

async function signOut(){await supa.auth.signOut();location.reload()}
async function requireSign(){const {data:{session}}=await supa.auth.getSession();if(!session){show('login');return false;}return true;}

el('login-submit').onclick=async()=>{
  const email=el('email').value.trim(),pass=el('password').value;
  if(!email||!pass)return;
  const {data:{session},error}=await supa.auth.signInWithPassword({email,password:pass});
  if(!session&&!error) await supa.auth.signUp({email,password:pass});
  setTimeout(()=>location.reload(),200);
};

let projects=[];
async function load(){const {data}=await supa.from('projects').select('*');projects=data||[];}
const money=n=>`¥${(Number(n||0)).toLocaleString()}`;

function renderHome(){
  const paid=projects.reduce((s,p)=>s+Number(p.paid_amount||0),0);
  const dep =projects.reduce((s,p)=>s+Number(p.deposit_amount||0),0);
  const un  =projects.reduce((s,p)=>s+Math.max(Number(p.quote_amount||0)-Number(p.deposit_amount||0)-Number(p.paid_amount||0),0),0);
  el('kpi-paid').textContent   =money(paid);
  el('kpi-deposit').textContent=money(dep);
  el('kpi-unpaid').textContent =money(un);
  const box=el('recent-list');box.innerHTML='';
  projects.slice(0,4).forEach(p=>{
    const div=document.createElement('div');div.className='item';
    // 最近节点
    const t=new Date();t.setHours(0,0,0,0);
    const pts=['a_copy','b_copy','final_date'].map(k=>p[k]&&new Date(p[k])).filter(Boolean).sort((a,b)=>a-b);
    let prog='—'; for(const d of pts){ if(d>=t){ prog=`${d.toISOString().slice(0,10)}`;break;}}
    const st = payCapsule(p);
    div.innerHTML=`<strong>${p.title||'-'}</strong> · ${p.producer_name||''}<br>${st} / 进度：${prog} / 条数：${p.clips||1}`;
    box.appendChild(div);
  });
}

const payCapsule=p=>{
  const total=Number(p.quote_amount||0),dep=Number(p.deposit_amount||0),paid=Number(p.paid_amount||0);
  let cls='blue',txt='未收款';
  if(dep>0)                 {cls='green';txt='已收定金';}
  if(paid>=total-dep)       {cls='gold'; txt='已收尾款';}
  const f=p.final_date?new Date(p.final_date):null;
  const t=new Date();t.setHours(0,0,0,0);
  if(f&&f<t&&paid<total-dep) {cls='red'; txt='逾期';}
  return `<span class="status ${cls}">${txt}</span>`;
};

function renderProjects(){
  const tb=el('projects-body');tb.innerHTML='';
  projects.forEach(p=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input data-k="title" value="${p.title||''}"/></td>
      <td><input data-k="producer_name" value="${p.producer_name||''}"/></td>
      <td>
        <select data-k="type">${['LookBook','形象片','TVC','纪录片','微电影'].map(o=>`<option ${o===p.type?'selected':''}>${o}</option>`).join('')}</select>
        <input data-k="clips" type="number" min="1" value="${p.clips||1}" style="width:60px"/>
        <select data-k="spec">${['1080p','4K','竖版','横版','1:1'].map(o=>`<option ${o===p.spec?'selected':''}>${o}</option>`).join('')}</select>
      </td>
      <td>
        <input data-k="a_copy"   type="date" value="${p.a_copy||''}"/>
        <input data-k="b_copy"   type="date" value="${p.b_copy||''}"/>
        <input data-k="final_date" type="date" value="${p.final_date||''}"/>
      </td>
      <td>${payCapsule(p)}</td>
      <td>
        <input data-k="quote_amount" type="number" value="${p.quote_amount||''}" placeholder="总金额" style="width:90px"/>
        <input data-k="paid_amount"  type="number" value="${p.paid_amount||''}"  placeholder="已收"     style="width:70px"/>
      </td>
      <td><input data-k="notes" value="${p.notes||''}"/></td>`;
    tr.querySelectorAll('input,select').forEach(i=>{
      i.onchange=async()=>{
        const k=i.dataset.k;
        const val=(i.type==='number')?Number(i.value):i.value;
        await supa.from('projects').update({[k]:val}).eq('id',p.id);
        await load(); renderProjects(); renderHome(); renderCalendar(); renderFinance();
      }
    });
    tb.appendChild(tr);
  });
}

function renderCalendar(){
  const top=el('cal-label'),g=el('cal-grid');
  const base=new Date(calendarBase);base.setDate(1);
  const y=base.getFullYear(),m=base.getMonth();
  top.textContent=`${y} 年 ${m+1} 月`;
  const first=new Date(y,m,1),start=(first.getDay()+6)%7;
  const days=new Date(y,m+1,0).getDate();
  const t=new Date();t.setHours(0,0,0,0);
  const evs={};
  projects.forEach(p=>{
    ['a_copy','b_copy','final_date'].forEach(k=>{
      if(!p[k])return;
      const d=new Date(p[k]);
      if(d.getFullYear()===y && d.getMonth()===m){
        const dd=d.getDate();
        (evs[dd]=evs[dd]||[]).push({title:p.title||'',k,done:(k==='final_date'&&new Date(p[k])<t)});
      }
    });
  });
  g.innerHTML='';
  for(let i=0;i<42;i++){
    const d=i-start+1;
    let cell='';
    if(d>0 && d<=days){
      const marks=(evs[d]||[]).map(e=>{
        let cls=e.k==='final_date'?'ev-final':'ev-ab';
        if(e.done) cls='ev-over';
        const tag=e.k==='a_copy'?'A':'B';
        return `<div class="mark ${cls}">${tag} · ${e.title}</div>`;
      }).join('');
      cell=`<div><div>${d}</div>${marks}</div>`;
    }else cell='<div></div>';
    g.insertAdjacentHTML('beforeend',cell);
  }
}
let calendarBase=new Date();
el('cal-prev').onclick=()=>{calendarBase.setMonth(calendarBase.getMonth()-1);renderCalendar();}
el('cal-next').onclick=()=>{calendarBase.setMonth(calendarBase.getMonth()+1);renderCalendar();}

function renderFinance(){
  const paid=projects.reduce((s,p)=>s+Number(p.paid_amount||0),0);
  const dep =projects.reduce((s,p)=>s+Number(p.deposit_amount||0),0);
  const un  =projects.reduce((s,p)=>s+Math.max(Number(p.quote_amount||0)-Number(p.deposit_amount||0)-Number(p.paid_amount||0),0),0);
  el('f-paid').textContent   =money(paid);
  el('f-deposit').textContent=money(dep);
  el('f-unpaid').textContent =money(un);

  // 合作金额
  const part={}
  projects.forEach(p=>{
    const name=p.producer_name||'未知';
    part[name]=(part[name]||0)+Number(p.paid_amount||0);
  });
  const topP=Object.entries(part).sort((a,b)=>b[1]-a[1]).slice(0,5);
  el('rank-partner').innerHTML=topP.map(([n,v])=>`<div class="item">${n}  — ${money(v)}</div>`).join('');

  // 单值最高
  const topProj=[...projects].sort((a,b)=>Number(b.quote_amount||0)-Number(a.quote_amount||0)).slice(0,5);
  el('rank-project').innerHTML=topProj.map(p=>`<div class="item">${p.title} — ${money(p.quote_amount)}</div>`).join('');

  // 未结款列表（已 Final 且未结清）
  const aging=projects.filter(p=>{
    if(!p.final_date) return false;
    const t=new Date(p.final_date),now=new Date();now.setHours(0,0,0,0);
    return t<now && Number(p.paid_amount||0)<(Number(p.quote_amount||0)-Number(p.deposit_amount||0));
  }).map(p=>{
    const days=Math.floor((new Date()-new Date(p.final_date))/(24*3600*1000));
    return `<div class="item">${p.title||''} · ${p.producer_name||''} — ${money(p.quote_amount-p.paid_amount-p.deposit_amount)} (逾期${days}天)</div>`;
  }).join('');
  el('aging-list').innerHTML=aging||'<div class="item">无</div>';

  // 趋势图（最近 12 个月收入）
  const now=new Date(), data=[];
  for(let i=11;i>=0;i--){
    const d=new Date(now.getFullYear(), now.getMonth()-i,1);
    const key=d.toISOString().slice(0,7);
    const sum=projects.filter(p=>{
      const up=new Date(p.updated_at||p.final_date||null);
      return up && up.toISOString().slice(0,7)===key;
    }).reduce((s,p)=>s+Number(p.paid_amount||0),0);
    data.push({label:key,value:sum});
  }
  drawTrend(data);
}

// 简单折线
function drawTrend(arr){
  const cvs=el('trend'), ctx=cvs.getContext('2d');
  cvs.width=600; cvs.height=180;
  ctx.clearRect(0,0,cvs.width,cvs.height);
  const max=Math.max(...arr.map(o=>o.value));
  arr.forEach((p,i)=>{
    const x=(i/(arr.length-1))*cvs.width;
    const y=cvs.height - (p.value/max)*cvs.height;
    ctx.fillStyle='#333';
    ctx.beginPath();
    ctx.arc(x,y,3,0,6.28);
    ctx.fill();
    if(i>0){
      const px=((i-1)/(arr.length-1))*cvs.width;
      const py=cvs.height - (arr[i-1].value/max)*cvs.height;
      ctx.beginPath();
      ctx.moveTo(px,py);
      ctx.lineTo(x,y);
      ctx.stroke();
    }
  });
}

(function start(){
  requireSign().then(async ok=>{
    if(!ok) return;
    await load();
    renderHome();renderProjects();renderCalendar();renderFinance();
    show('home');
  });
})();

/* --- 报价分析器 --- */
(function initQuote(){
  const type=el('q-type'), base=el('q-base'),len=el('q-length'),
        creative=el('q-creative'),rush=el('q-rush'),rev=el('q-rev'),comp=el('q-comp'),compRate=el('q-compRate'),
        net=el('q-net'),gross=el('q-gross');
  const BASE={LookBook:[100,15],形象片:[3500,45],TVC:[7000,60],纪录片:[12000,180],微电影:[12000,180]};
  function update(){
    const [b,limit]=BASE[type.value];
    let price=parseFloat(base.value||b);
    const now=parseFloat(len.value||limit);
    // 时长
    let r=Math.max((now-limit)/limit,0);
    if(type.value==='LookBook') price*=1+r;
    else if(type.value==='形象片' || type.value==='TVC') price*=1+(r*3);
    else price*=1+(r*0.5);
    // 创意
    price+=price*(parseInt(creative.value)/100);
    // 紧急
    price+=price*((parseInt(rush.value)/10)*0.03);
    // 修改
    const rv=parseInt(rev.value||4); if(rv>4) price+=price*((rv-4)*0.2);
    // 合成
    if(comp.checked) price+=price*((parseInt(compRate.value)/10)*0.05);
    net.textContent =`¥${Math.round(price).toLocaleString()}`;
    gross.textContent=`¥${Math.round(price*1.06).toLocaleString()}`;
  }
  [type,base,len,creative,rush,rev,comp,compRate].forEach(i=>i.oninput=update);
  update();
})();
