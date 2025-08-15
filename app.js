/* editor-studio / styles.css  v0.3.1 */

:root{
  --bg:#fbfbfd; --panel:#fff; --text:#111; --muted:#666;
  --line:#e5e5ea; --brand:#0a84ff;
  --gold:#b9812b; --yellow:#d6a300; --red:#e23d2f; --green:#1b9e67; --blue:#2b78ff;
  --r:18px; --pill:999px;
  --fs:15px; --fs-sm:13px;
  --lh:1.65;
}
html,body{margin:0;padding:0;font:var(--fs)/var(--lh) -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial;background:var(--bg);color:var(--text);letter-spacing:.2px}
.hidden{display:none!important}
.container{max-width:1400px;margin:auto;padding:0 24px}
.auth-view{padding:60px 0}
.auth-card{max-width:380px;margin:auto}
.auth-form input,.auth-form button{width:100%;padding:12px;margin:6px 0;border-radius:var(--pill);border:1px solid var(--line)}
.nav-wrap{display:flex;align-items:center;height:64px}
.brand{font-weight:600}
.brand-gold{color:var(--gold);font-weight:700}
.nav-center{margin:0 auto;display:flex;gap:10px}
.nav-btn{padding:8px 14px;border-radius:var(--pill);border:1px solid var(--line);background:#fff}
.nav-btn[aria-current]{color:var(--brand);border-color:var(--brand)}
.main-wrap{padding:20px 0}

/* KPI */
.kpi-card{border:1px solid var(--line);border-radius:var(--r);padding:16px;background:#fff}
.kpi-label{font-size:var(--fs-sm);color:var(--muted)}
.kpi-num{font-size:26px;font-weight:700}
.kpi-gold .kpi-num{color:var(--gold)}
.kpi-yellow .kpi-num{color:var(--yellow)}
.kpi-red .kpi-num{color:var(--red)}

.list .list-item{display:flex;justify-content:space-between;padding:10px 6px;border-bottom:1px dashed var(--line)}
.table-wide{max-width:1400px;margin:0 auto}
.table{width:100%;border-collapse:separate;border-spacing:0 10px}
.table th,.table td{padding:12px;background:#fff}
.table th{font-weight:600;color:var(--muted)}
.table tbody tr td:first-child{border-top-left-radius:var(--r);border-bottom-left-radius:var(--r)}
.table tbody tr td:last-child{border-top-right-radius:var(--r);border-bottom-right-radius:var(--r)}

.pill{display:inline-block;padding:6px 12px;border-radius:var(--pill);font-size:var(--fs-sm);border:1px solid var(--line)}
.pill-blue{color:#1666c7;background:#e7f0ff}
.pill-green{color:#0c7a5a;background:#e8fbf0}
.pill-gold{color:#846500;background:#fff6da}
.pill-red{color:#b00020;background:#ffe8ec}

/* inline fields in project list */
.cell-inline{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cell-inline input[type=text],
.cell-inline input[type=number],
.cell-inline input[type=date]{
  height:30px;padding:0 10px;border:1px solid var(--line);border-radius:var(--pill);background:#fff
}
.pill-select button{padding:6px 10px;border-radius:var(--pill);border:1px solid var(--line);background:#fff;cursor:pointer}
.pill-select button[aria-pressed=true]{background:#111;color:#fff;border-color:#111}
.done-switch{display:flex;gap:4px;align-items:center}
.overdue{outline:2px solid #ffb3c0;border-radius:var(--pill)}

/* modal */
.modal{position:fixed;inset:0;background:rgba(0,0,0,.25);display:none;align-items:center;justify-content:center;z-index:50}
.modal.show{display:flex}
.modal-card{background:#fff;border-radius:var(--r);padding:18px;min-width:360px;max-width:500px}
.modal-card .row{display:flex;gap:10px;margin:8px 0}
.modal-card input{flex:1;height:32px;border-radius:var(--pill);border:1px solid var(--line);padding:0 10px}
.modal-actions{text-align:right;margin-top:12px}
.btn{padding:8px 14px;border-radius:var(--pill);border:1px solid var(--line);background:#fff;cursor:pointer}
.btn.primary{background:#111;color:#fff;border-color:#111}

/* calendar */
.cal-grid-head,.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.cal-cell{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:6px;min-height:80px}
.cal-day{font-weight:600;font-size:var(--fs-sm)}
.ev{display:block;margin-top:4px;padding:4px 8px;border-radius:var(--pill);font-size:var(--fs-sm);border:1px solid var(--line)}
.ev.ev-a{background:#e7f0ff;color:#1666c7}
.ev.ev-b{background:#efe7ff;color:#7a5aff}
.ev.ev-final{background:#fff4e5;color:#b36b00}
.ev.ev-overdue{background:#ffe8ec;color:#b00020}

/* posters */
.poster-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.poster{display:block;aspect-ratio:16/9;background:#f6f6f6;border:1px solid var(--line);border-radius:var(--r)}
.poster .caption{position:absolute;left:8px;bottom:8px;background:#fff;padding:4px 8px;border-radius:var(--pill);font-size:var(--fs-sm)}
