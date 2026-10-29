"use strict";
/* ================= CONFIGURAÇÃO ================= */
const SUPABASE_URL = "https://aqmnkfbltjyjiuxikjlp.supabase.co";
const SUPABASE_ANON = ["eyJhbGciOiJI","UzI1NiIsInR5","cCI6IkpXVCJ9",".eyJpc3MiOiJ","zdXBhYmFzZSI","sInJlZiI6ImF","xbW5rZmJsdGp","5aml1eGlramx","wIiwicm9sZSI","6ImFub24iLCJ","pYXQiOjE3OTE","1NzYwNzksImV","4cCI6MjEwNzE","1MjA3OX0.zUH","gCxidd3yF7_1","rb7vGB7BSLB8","w6_N2l_gy8Ga","i2Ac"].join(""); // chave pública (anon) — protegida pelas regras da base de dados
const LOGO = window.SCRG_LOGO || "";
const APPLE_ICON = window.SCRG_APPLE || "";
try { document.getElementById("ic-fav").href = LOGO; document.getElementById("ic-apple").href = APPLE_ICON; } catch {}
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

/* ================= UTILITÁRIOS ================= */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cents = (x) => Math.round(Number(x || 0) * 100);
const eurFmt = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const eur = (c) => eurFmt.format((c || 0) / 100);
const numFmt = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const parseD = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmtD = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const weekStart = (s) => { const d = parseD(s); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return fmtD(d); };
const addDays = (s, n) => { const d = parseD(s); d.setUTCDate(d.getUTCDate() + n); return fmtD(d); };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_L = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dShort = (s) => { if (!s) return "sem data"; const d = parseD(s); return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`; };
const dLong = (s) => { if (!s) return "sem data"; const d = parseD(s); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };
const dtLong = (iso) => { if (!iso) return "—"; const d = new Date(iso); return d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const weekLabel = (ws) => `${dShort(ws)}–${dShort(addDays(ws, 6))}`;
const monthKey = (s) => s.slice(0, 7);
const monthLabel = (k) => { const [y, m] = k.split("-").map(Number); return `${MESES_L[m - 1]} ${y}`; };
const initials = (n) => n.replace(/["“”]/g, "").replace(/^(T|TA)\s*[–-]\s*/, "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
function toast(msg, action) {
  const t = $("#toast"); t.innerHTML = ""; t.append(document.createTextNode(msg));
  if (action) { const b = document.createElement("button"); b.className = "toast-btn"; b.textContent = action.label; b.onclick = () => { t.hidden = true; action.fn(); }; t.append(b); }
  t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, action ? 7000 : 3200);
}
function friendlyError(e) {
  const m = (e && (e.message || e.error_description || e.error)) || String(e);
  if (/PAGAMENTO_SUPERIOR_A_DIVIDA/.test(m)) return m.replace("PAGAMENTO_SUPERIOR_A_DIVIDA: ", "");
  if (/row-level security|permission denied/i.test(m)) return "Não tens permissão para esta operação.";
  if (/Invalid login credentials/i.test(m)) return "Email ou palavra-passe incorretos.";
  if (/duplicate key.*client_ref/i.test(m)) return "Este registo já tinha sido guardado (evitado duplicado).";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sem ligação à internet. Tenta novamente.";
  return m;
}

/* ================= ESTADO ================= */
const S = {
  session: null, me: null, isCap: false,
  members: [], types: [], fines: [], payments: [], notes: [],
  view: "inicio", memberId: null,
  rankPeriod: "semana", statPeriod: "epoca", statMember: "", statCat: "",
  finesFilter: { member: "", cat: "", period: "epoca", showVoid: false },
  live: false, charts: [],
};
window.addEventListener("online", () => { if (S.me) { S.offline = false; scheduleReload(); } });
window.addEventListener("offline", () => { if (S.me) { S.offline = true; render(); } });
const memberById = (id) => (S.allMembers || S.members).find(m => m.id === id);
const typeById = (id) => S.types.find(t => t.id === id);
const nameByUser = (uid, none = "Sistema") => { if (!uid) return none; const m = (S.allMembers || S.members).find(x => x.user_id === uid); return m ? m.name : "Utilizadora removida"; };
const validFines = () => S.fines.filter(f => f.status === "valida");
const validPays = () => S.payments.filter(p => p.status === "confirmado");

/* ================= DADOS ================= */
const MEMBER_COLS = "id,name,full_name,kind,is_captain,user_id,active,sort_order,created_at,updated_at,access_blocked,blocked_at,removed_at,removed_by,removal_reason,refund_amount,removal_snapshot";
const CACHE_KEY = "scrg-cache-v1";
function saveCache() { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: new Date().toISOString(), uid: S.session?.user?.id, members: S.members, allMembers: S.allMembers, types: S.types, fines: S.fines, payments: S.payments, notes: S.notes })); } catch {} }
function readCache(uid) { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return c && c.uid === uid ? c : null; } catch { return null; } }
function clearCache() { try { localStorage.removeItem(CACHE_KEY); } catch {} }
function online() { return navigator.onLine !== false && !S.offline; }
function guardOnline() { if (!navigator.onLine) { toast("Sem ligação à internet. Tenta quando tiveres rede."); return false; } return true; }
async function fetchAll(table, cols, order) {
  const out = []; let from = 0; const step = 1000;
  for (;;) {
    let q = sb.from(table).select(cols).range(from, from + step - 1);
    if (order) q = q.order(order.col, { ascending: order.asc });
    const { data, error } = await q; if (error) throw error;
    out.push(...data); if (data.length < step) break; from += step;
  }
  return out;
}
async function loadAll() {
  const [members, types, fines, payments, notes] = await Promise.all([
    fetchAll("scrg_members", MEMBER_COLS, { col: "sort_order", asc: true }),
    fetchAll("scrg_fine_types", "*", { col: "sort_order", asc: true }),
    fetchAll("scrg_fines", "*", { col: "created_at", asc: false }),
    fetchAll("scrg_payments", "*", { col: "created_at", asc: false }),
    fetchAll("scrg_notes", "*", null),
  ]);
  // atletas removidas da equipa: saem de todas as contas e listas; ficam só no histórico (capitãs)
  const removedIds = new Set(members.filter(m => m.removed_at).map(m => m.id));
  Object.assign(S, {
    allMembers: members, members: members.filter(m => !m.removed_at), removed: members.filter(m => m.removed_at),
    archive: { fines: fines.filter(f => removedIds.has(f.member_id)), payments: payments.filter(p => removedIds.has(p.member_id)) },
    types, fines: fines.filter(f => !removedIds.has(f.member_id)), payments: payments.filter(p => !removedIds.has(p.member_id)),
    notes, offline: false, cachedAt: null });
  saveCache();
}
let reloadT = null;
function scheduleReload() { clearTimeout(reloadT); reloadT = setTimeout(async () => { try { await loadAll(); render(); } catch (e) { console.error(e); if (!navigator.onLine) { S.offline = true; render(); } } }, 400); }
function subscribeRealtime() {
  const ch = sb.channel("scrg-live");
  ["scrg_fines", "scrg_payments", "scrg_fine_types", "scrg_members"].forEach(t =>
    ch.on("postgres_changes", { event: "*", schema: "public", table: t }, scheduleReload));
  ch.subscribe((status) => { S.live = status === "SUBSCRIBED"; const el = $("#live"); if (el) el.classList.toggle("off", !S.live); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleReload(); });
}

/* ================= CÁLCULOS ================= */
function balances() {
  const map = new Map(S.members.map(m => [m.id, { m, fines: 0, count: 0, paid: 0 }]));
  for (const f of validFines()) { const b = map.get(f.member_id); if (b) { b.fines += cents(f.total); b.count += Number(f.quantity); } }
  for (const p of validPays()) { const b = map.get(p.member_id); if (b) b.paid += cents(p.amount); }
  return [...map.values()].map(b => ({ ...b, debt: b.fines - b.paid }))
    .filter(b => b.m.active || b.fines || b.paid);
}
function teamTotals() {
  const fines = validFines().reduce((s, f) => s + cents(f.total), 0);
  const paid = validPays().reduce((s, p) => s + cents(p.amount), 0);
  const count = validFines().reduce((s, f) => s + Number(f.quantity), 0);
  const ws = weekStart(todayStr()), we = addDays(ws, 6);
  const inW = (d) => d && d >= ws && d <= we;
  const wFines = validFines().filter(f => inW(f.occurrence_date)).reduce((s, f) => s + cents(f.total), 0);
  const wPaid = validPays().filter(p => inW(p.payment_date)).reduce((s, p) => s + cents(p.amount), 0);
  const bs = balances();
  const debtPos = bs.reduce((s, b) => s + Math.max(b.debt, 0), 0);
  const credit = bs.reduce((s, b) => s + Math.max(-b.debt, 0), 0);
  // "debt" = saldo líquido (multas − recebido), regra original; "debtPos" = dinheiro efetivamente por receber
  return { fines, paid, debt: fines - paid, count, wFines, wPaid, debtPos, credit };
}
// período: {from,to,label,includeUndated}
function periodRange(key) {
  const t = todayStr();
  if (key === "semana") { const ws = weekStart(t); return { from: ws, to: addDays(ws, 6), label: `Semana ${weekLabel(ws)}`, includeUndated: false }; }
  if (key === "mes") { const k = monthKey(t); return monthRange(k); }
  if (key && key.startsWith("m:")) return monthRange(key.slice(2));
  if (key && key.startsWith("w:")) { const ws = key.slice(2); return { from: ws, to: addDays(ws, 6), label: `Semana ${weekLabel(ws)}`, includeUndated: false }; }
  return { from: null, to: null, label: "Época completa", includeUndated: true };
}
function monthRange(k) { const [y, m] = k.split("-").map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return { from: `${k}-01`, to: `${k}-${pad(last)}`, label: monthLabel(k), includeUndated: false }; }
const inRange = (d, r) => { if (!r.from) return true; if (!d) return false; return d >= r.from && d <= r.to; };
const fineInRange = (f, r) => (r.from ? inRange(f.occurrence_date, r) : true);

function weeklySeries(memberId, cat) {
  const fines = validFines().filter(f => (!memberId || f.member_id === memberId) && (!cat || typeById(f.fine_type_id)?.category === cat));
  const pays = validPays().filter(p => !memberId || p.member_id === memberId);
  const dated = [...fines.map(f => f.occurrence_date), ...pays.map(p => p.payment_date)].filter(Boolean);
  const undatedFines = fines.filter(f => !f.occurrence_date).reduce((s, f) => s + cents(f.total), 0);
  if (!dated.length) dated.push(todayStr());
  let start = weekStart(dated.reduce((a, b) => a < b ? a : b));
  const end = weekStart([...dated, todayStr()].reduce((a, b) => a > b ? a : b));
  const weeks = []; for (let w = start; w <= end; w = addDays(w, 7)) weeks.push(w);
  const fBy = new Map(weeks.map(w => [w, 0])), pBy = new Map(weeks.map(w => [w, 0]));
  fines.forEach(f => { if (f.occurrence_date) { const w = weekStart(f.occurrence_date); fBy.set(w, (fBy.get(w) || 0) + cents(f.total)); } });
  pays.forEach(p => { const w = weekStart(p.payment_date); pBy.set(w, (pBy.get(w) || 0) + cents(p.amount)); });
  let cum = undatedFines; const debt = [];
  weeks.forEach(w => { cum += (fBy.get(w) || 0) - (pBy.get(w) || 0); debt.push(cum); });
  return { weeks, fines: weeks.map(w => fBy.get(w) || 0), pays: weeks.map(w => pBy.get(w) || 0), debt, undatedFines };
}

function weekSummary(ws) {
  const we = addDays(ws, 6);
  const f = validFines().filter(x => x.occurrence_date && x.occurrence_date >= ws && x.occurrence_date <= we);
  const p = validPays().filter(x => x.payment_date >= ws && x.payment_date <= we);
  const per = {}; f.forEach(x => per[x.member_id] = (per[x.member_id] || 0) + cents(x.total));
  const topE = Object.entries(per).sort((a, b) => b[1] - a[1])[0];
  const ser = weeklySeries(); const past = ser.weeks.map((w, i) => [w, ser.fines[i]]).filter(([w]) => w < ws);
  const avg = past.length ? Math.round(past.reduce((s, x) => s + x[1], 0) / past.length) : 0;
  return { fines: f.reduce((s, x) => s + cents(x.total), 0), count: f.reduce((s, x) => s + Number(x.quantity), 0), paid: p.reduce((s, x) => s + cents(x.amount), 0),
    top: topE ? { name: memberById(topE[0])?.name, v: topE[1] } : null, avg };
}
function activityItems() {
  const items = [];
  S.fines.forEach(f => { items.push({ at: f.created_at, kind: "f", obj: f, text: `${memberById(f.member_id)?.name} · ${typeById(f.fine_type_id)?.name}`, amt: cents(f.total) });
    if (f.status === "anulada" && f.updated_at) items.push({ at: f.updated_at, kind: "fv", obj: f, text: `Multa anulada · ${memberById(f.member_id)?.name} · ${f.void_reason || ""}`, amt: -cents(f.total) }); });
  S.payments.forEach(p => { items.push({ at: p.created_at, kind: "p", obj: p, text: `Pagamento · ${memberById(p.member_id)?.name}${p.method ? " · " + p.method : ""}`, amt: cents(p.amount) });
    if (p.status === "anulado" && p.updated_at) items.push({ at: p.updated_at, kind: "pv", obj: p, text: `Pagamento anulado · ${memberById(p.member_id)?.name} · ${p.void_reason || ""}`, amt: -cents(p.amount) }); });
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
function openActivity() {
  const items = activityItems().slice(0, 200);
  openSheet("Atividade da equipa", `<p class="hint" style="margin-top:0">Tudo o que foi registado, do mais recente para o mais antigo. Data de registo à esquerda; datas da ocorrência e do pagamento no detalhe.</p>
    <div class="list">${items.map(it => `<div class="li tap" ${it.kind[0] === "f" ? `data-afine="${it.obj.id}"` : `data-apay="${it.obj.id}"`}>
      <div class="main"><div class="t">${esc(it.text)}</div><div class="d">${dtLong(it.at)} · por ${esc(nameByUser(it.kind === "f" || it.kind === "p" ? it.obj.created_by : it.obj.updated_by, it.obj.source === "excel_import" ? "Importação do Excel" : "Sistema"))}</div></div>
      <div class="amt" style="color:${it.kind === "p" ? "var(--good)" : it.kind.endsWith("v") ? "var(--ink-2)" : "var(--ink)"}">${it.kind === "p" ? "+" : ""}${eur(Math.abs(it.amt))}</div></div>`).join("") || '<div class="empty">Sem atividade.</div>'}</div>`, (root) => {
    root.querySelectorAll("[data-afine]").forEach(el => el.onclick = () => openFineDetail(el.dataset.afine));
    root.querySelectorAll("[data-apay]").forEach(el => el.onclick = () => openPayDetail(el.dataset.apay));
  });
}

/* ================= GRÁFICOS ================= */
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function destroyCharts() { S.charts.forEach(c => c.destroy()); S.charts = []; }
function baseOpts(extra = {}) {
  const ink2 = cssVar("--ink-2"), grid = cssVar("--chart-grid");
  return Object.assign({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    plugins: { legend: { labels: { color: ink2, boxWidth: 12, font: { family: "Archivo" } } },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${eur(c.raw)}` } } },
    scales: {
      x: { ticks: { color: ink2, maxRotation: 0, autoSkip: true, font: { size: 11 } }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: ink2, callback: (v) => eur(v).replace(",00", "") }, grid: { color: grid } } }
  }, extra);
}
function chart(id, cfg) { const el = document.getElementById(id); if (!el) return; if (typeof Chart === "undefined") { el.parentElement.innerHTML = '<div class="empty">Gráfico indisponível (sem ligação).</div>'; return; } S.charts.push(new Chart(el, cfg)); }
function weeklyChart(id, ser, opts = {}) {
  const ds = [];
  if (opts.fines !== false) ds.push({ type: "bar", label: "Multas", data: ser.fines, backgroundColor: cssVar("--red"), borderRadius: 5, maxBarThickness: 26, order: 2 });
  if (opts.pays !== false) ds.push({ type: "bar", label: "Pagamentos", data: ser.pays, backgroundColor: cssVar("--chart-pay"), borderRadius: 5, maxBarThickness: 26, order: 2 });
  chart(id, { type: "bar", data: { labels: ser.weeks.map(w => dShort(w)), datasets: ds }, options: baseOpts() });
}
let mqTheme = matchMedia("(prefers-color-scheme: dark)");
mqTheme.addEventListener?.("change", () => render());

/* ================= ÍCONES ================= */
const IC = {
  inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  atletas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.4.2 4.2 1.8 5 4.4"/></svg>',
  multas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="3" width="12" height="17" rx="2" transform="rotate(8 12 12)"/><path d="M10 9h5M9.5 13h5"/></svg>',
  pagamentos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M2.5 10h19M6.5 15h4"/></svg>',
  estatisticas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  rankings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
};
const NAV = [["inicio", "Início"], ["atletas", "Atletas"], ["multas", "Multas"], ["pagamentos", "Pagamentos", "Pagam."], ["estatisticas", "Estatísticas", "Estat."], ["rankings", "Rankings", "Ranking"], ["admin", "Administração", "Admin"]];

/* ================= RENDER PRINCIPAL ================= */
function go(view, memberId = null) { S.view = view; S.memberId = memberId; location.hash = memberId ? `atleta-${memberId}` : view; window.scrollTo(0, 0); render(); }
window.addEventListener("hashchange", () => {
  const h = location.hash.slice(1);
  if (h.startsWith("atleta-")) { S.view = "perfil"; S.memberId = h.slice(7); }
  else if (NAV.some(n => n[0] === h)) { S.view = h; S.memberId = null; }
  if (S.me) render();
});
function shell(content) {
  const nav = NAV.filter(n => n[0] !== "admin" || S.isCap).map(([k, l, sh]) =>
    `<button data-go="${k}" aria-label="${l}" aria-current="${(S.view === k || (S.view === "perfil" && k === "atletas")) ? "page" : "false"}">${IC[k]}<span class="lg">${l}</span><span class="sh">${sh || l}</span></button>`).join("");
  return `
  <header class="top"><div class="top-in">
    <img src="${LOGO}" alt="Emblema SCRG">
    <div class="brand"><h1>MULTAS SCRG 26/27</h1>
      <small><span class="live ${S.live ? "" : "off"}" id="live"><i></i></span> ${esc(S.me.name)}${S.isCap ? " · Capitã" : ""}</small></div>
    <button class="icon-btn" id="logout">Sair</button>
  </div></header>
  <main id="main">${(S.offline || !navigator.onLine) ? `<div class="offline">Sem ligação. A mostrar os dados de ${S.cachedAt ? dtLong(S.cachedAt) : "da última visita"}. Não é possível registar nada até voltar a rede.</div>` : ""}${content}</main>
  <nav class="tabs" aria-label="Menu"><div class="in">${nav}</div></nav>`;
}
function render() {
  destroyCharts();
  if (!S.me) return;
  if (S.view === "admin" && !S.isCap) S.view = "inicio";
  const views = { inicio: vInicio, atletas: vAtletas, perfil: vPerfil, multas: vMultas, pagamentos: vPagamentos, estatisticas: vStats, rankings: vRankings, admin: vAdmin };
  const v = (views[S.view] || vInicio)();
  $("#app").innerHTML = shell(v.html);
  $("#logout").onclick = async () => { clearCache(); await sb.auth.signOut(); location.hash = ""; location.reload(); };
  document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
  document.querySelectorAll("[data-member]").forEach(el => el.onclick = () => go("perfil", el.dataset.member));
  document.querySelectorAll("[data-fine]").forEach(el => el.onclick = () => openFineDetail(el.dataset.fine));
  document.querySelectorAll("[data-pay]").forEach(el => el.onclick = () => openPayDetail(el.dataset.pay));
  v.after && v.after();
  if (S.offline || !navigator.onLine) document.querySelectorAll("#q-fine,#q-pay,#new-fine,#new-pay,#p-fine,#p-pay").forEach(b => { b.disabled = true; b.title = "Sem ligação"; });
}

/* ---------- blocos reutilizáveis ---------- */
function fineRow(f, showMember = true) {
  const t = typeById(f.fine_type_id), m = memberById(f.member_id);
  const q = Number(f.quantity) !== 1 ? `${numFmt.format(f.quantity)} × ` : "";
  const tag = f.status === "anulada" ? '<span class="pill void">anulada</span>' : (f.source === "excel_import" ? '<span class="pill imp">Excel</span>' : "");
  return `<div class="li tap" data-fine="${f.id}">
    ${showMember ? `<div class="av ${m?.is_captain ? "cap" : ""}">${esc(initials(m?.name || "?"))}</div>` : ""}
    <div class="main"><div class="t">${showMember ? esc(m?.name) + " · " : ""}${esc(t?.name)}</div>
      <div class="d">${q}${eur(cents(f.unit_price))} · ${f.occurrence_date ? dShort(f.occurrence_date) : "sem data de ocorrência"} ${tag}</div></div>
    <div class="amt" style="${f.status === "anulada" ? "text-decoration:line-through;opacity:.5" : ""}">${eur(cents(f.total))}</div></div>`;
}
function payRow(p, showMember = true) {
  const m = memberById(p.member_id);
  const tag = p.status === "anulado" ? '<span class="pill void">anulado</span>' : (p.credit_confirmed ? '<span class="pill credit">com crédito</span>' : "");
  return `<div class="li tap" data-pay="${p.id}">
    ${showMember ? `<div class="av">${esc(initials(m?.name || "?"))}</div>` : ""}
    <div class="main"><div class="t">${showMember ? esc(m?.name) : "Pagamento"}</div>
      <div class="d">${dShort(p.payment_date)}${p.method ? " · " + esc(p.method) : ""} ${tag}</div></div>
    <div class="amt" style="color:var(--good);${p.status === "anulado" ? "text-decoration:line-through;opacity:.5" : ""}">+${eur(cents(p.amount))}</div></div>`;
}
function debtPill(d) { return d > 0 ? `<span class="pill debt">deve ${eur(d)}</span>` : d < 0 ? `<span class="pill credit">crédito ${eur(-d)}</span>` : `<span class="pill ok">em dia</span>`; }

/* ================= INÍCIO ================= */
function vInicio() {
  const T = teamTotals();
  const ser = weeklySeries();
  const lastF = S.fines.filter(f => f.status === "valida").slice(0, 5);
  const lastP = S.payments.filter(p => p.status === "confirmado").slice(0, 5);
  const top = balances().sort((a, b) => b.fines - a.fines || a.m.name.localeCompare(b.m.name)).slice(0, 5);
  const max = Math.max(1, ...top.map(b => b.fines));
  const ws = weekStart(todayStr());
  const mine = balances().find(b => b.m.id === S.me.id);
  const wk = weekSummary(ws);
  return { html: `
    ${mine ? `<div class="me-card" data-member="${mine.m.id}" role="button" aria-label="Ver a minha conta">
      <div><div class="lbl">A minha conta · ${esc(mine.m.name)}</div><div class="big" style="color:${mine.debt > 0 ? "var(--red)" : mine.debt < 0 ? "var(--warn)" : "var(--good)"}">${mine.debt > 0 ? "Deves " + eur(mine.debt) : mine.debt < 0 ? "Crédito " + eur(-mine.debt) : "Em dia"}</div>
        <div class="small muted">Multas ${eur(mine.fines)} · Pagaste ${eur(mine.paid)}</div></div>
      <span aria-hidden="true" style="font-size:1.8rem;color:var(--ink-2)">›</span></div>` : ""}
    <div class="page-h"><div><h2>Balneário</h2><p>Contas da equipa em tempo real · semana ${weekLabel(ws)}</p></div>
      ${S.isCap ? `<div class="row"><button class="btn primary" id="q-fine">+ Multa</button><button class="btn dark" id="q-pay">+ Pagamento</button></div>` : ""}</div>
    <div class="grid g2 g3">
      <div class="kpi red"><div class="l">Total de multas</div><div class="v">${eur(T.fines)}</div></div>
      <div class="kpi"><div class="l">Total recebido</div><div class="v" style="color:var(--good)">${eur(T.paid)}</div></div>
      <div class="kpi black"><div class="l">Total em dívida</div><div class="v">${eur(T.debtPos)}</div>${T.credit ? `<div class="s">por receber · créditos a favor: ${eur(T.credit)} · saldo líquido ${eur(T.debt)}</div>` : `<div class="s">por receber</div>`}</div>
      <div class="kpi"><div class="l">N.º de multas</div><div class="v">${numFmt.format(T.count)}</div><div class="s">ocorrências</div></div>
      <div class="kpi"><div class="l">Multas desta semana</div><div class="v">${eur(T.wFines)}</div><div class="s">por data da ocorrência</div></div>
      <div class="kpi"><div class="l">Recebido esta semana</div><div class="v">${eur(T.wPaid)}</div><div class="s">por data do pagamento</div></div>
    </div>
    <div class="card" style="margin-top:12px"><h3>Resumo da semana <small>${weekLabel(ws)}</small></h3>
      <p style="margin:0">${wk.fines ? `${eur(wk.fines)} em multas (${numFmt.format(wk.count)} ocorrência${wk.count === 1 ? "" : "s"})` : "Sem multas esta semana"} · ${eur(wk.paid)} recebidos.${wk.top ? ` Maior contribuição: <b>${esc(wk.top.name)}</b> (${eur(wk.top.v)}).` : ""}${wk.avg ? ` Média semanal da época: ${eur(wk.avg)}.` : ""}</p></div>
    <div class="grid md2" style="margin-top:12px">
      <div class="card"><h3>Evolução semanal <small>seg–dom</small></h3>
        <div class="chart-box"><canvas id="ch-home"></canvas></div>
        ${ser.undatedFines ? `<p class="hint">Não inclui ${eur(ser.undatedFines)} importados do Excel sem data de ocorrência.</p>` : ""}</div>
      <div class="card"><h3>Classificação <small>valor em multas</small></h3>
        <div class="list">${top.map((b, i) => `<div class="li tap" data-member="${b.m.id}"><div class="rank">${i + 1}</div>
          <div class="main"><div class="t">${esc(b.m.name)}</div><div class="bar"><i style="width:${(b.fines / max * 100).toFixed(1)}%"></i></div></div>
          <div class="amt">${eur(b.fines)}</div></div>`).join("")}</div>
        <button class="btn block ghost sm" data-go="rankings" style="margin-top:8px">Ver rankings completos</button></div>
      <div class="card"><h3>Últimas multas</h3><div class="list">${lastF.map(f => fineRow(f)).join("") || '<div class="empty">Ainda sem multas.</div>'}</div></div>
      <div class="card"><h3>Últimos pagamentos</h3><div class="list">${lastP.map(p => payRow(p)).join("") || '<div class="empty">Ainda não há pagamentos registados.</div>'}</div></div>
    </div>
    <button class="btn block" id="activity" style="margin-top:12px">Ver toda a atividade da equipa</button>`,
    after() {
      weeklyChart("ch-home", ser);
      $("#q-fine") && ($("#q-fine").onclick = () => openFineForm());
      $("#q-pay") && ($("#q-pay").onclick = () => openPayForm());
      $("#activity").onclick = openActivity;
    } };
}

/* ================= ATLETAS ================= */
function vAtletas() {
  const bs = balances();
  const T = teamTotals();
  const rows = bs.map(b => `<tr data-member="${b.m.id}">
    <td><div class="row" style="gap:8px;flex-wrap:nowrap"><b>${esc(b.m.name)}</b>${b.m.is_captain ? '<span class="pill cap">C</span>' : ""}${b.m.kind === "equipa_tecnica" ? '<span class="pill staff">Téc.</span>' : ""}</div></td>
    <td class="r">${eur(b.fines)}</td><td class="r" style="color:var(--good)">${eur(b.paid)}</td>
    <td class="r" style="font-weight:700;color:${b.debt > 0 ? "var(--red)" : b.debt < 0 ? "var(--warn)" : "var(--good)"}">${eur(b.debt)}</td></tr>`).join("");
  return { html: `
    <div class="page-h"><div><h2>Atletas</h2><p>Toca numa atleta para ver o perfil</p></div></div>
    <div class="card"><div class="tbl-wrap"><table>
      <thead><tr><th>Atleta</th><th class="r">Multas (€)</th><th class="r">Pago (€)</th><th class="r">Em dívida (€)</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Equipa</td><td class="r">${eur(T.fines)}</td><td class="r">${eur(T.paid)}</td><td class="r">${eur(T.debt)}</td></tr></tfoot>
    </table></div></div>` };
}

/* ================= PERFIL ================= */
function vPerfil() {
  const m = memberById(S.memberId);
  if (!m) return { html: `<div class="empty">Atleta não encontrada.</div>` };
  const b = balances().find(x => x.m.id === m.id) || { fines: 0, paid: 0, debt: 0, count: 0 };
  const fines = S.fines.filter(f => f.member_id === m.id);
  const pays = S.payments.filter(p => p.member_id === m.id);
  const ser = weeklySeries(m.id);
  const byCat = {};
  validFines().filter(f => f.member_id === m.id).forEach(f => { const t = typeById(f.fine_type_id); const k = t?.name || "?"; byCat[k] = (byCat[k] || 0) + cents(f.total); });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const maxC = Math.max(1, ...cats.map(c => c[1]));
  return { html: `
    <button class="btn ghost sm" data-go="atletas">← Atletas</button>
    <div class="page-h" style="margin-top:10px"><div><h2>${esc(m.name)}</h2>
      <p>${m.full_name ? esc(m.full_name) + " · " : ""}${m.kind === "equipa_tecnica" ? "Equipa técnica" : "Atleta"}${m.is_captain ? " · Capitã" : ""}</p></div>
      ${debtPill(b.debt)}</div>
    <div class="grid g2 g3">
      <div class="kpi red"><div class="l">Multas</div><div class="v">${eur(b.fines)}</div><div class="s">${numFmt.format(b.count)} ocorrências</div></div>
      <div class="kpi"><div class="l">Pago</div><div class="v" style="color:var(--good)">${eur(b.paid)}</div></div>
      <div class="kpi black"><div class="l">${b.debt < 0 ? "Crédito" : "Em dívida"}</div><div class="v">${eur(Math.abs(b.debt))}</div></div>
    </div>
    ${S.isCap ? `<div class="row" style="margin-top:12px"><button class="btn primary sp" id="p-fine">+ Multar</button><button class="btn dark sp" id="p-pay">+ Pagamento</button></div>` : ""}
    <div class="grid md2" style="margin-top:12px">
      <div class="card"><h3>Evolução semanal</h3><div class="chart-box"><canvas id="ch-p"></canvas></div>
        ${ser.undatedFines ? `<p class="hint">Mais ${eur(ser.undatedFines)} importados do Excel sem data.</p>` : ""}</div>
      <div class="card"><h3>Por tipo de multa</h3>${cats.length ? `<div class="list">${cats.map(([k, v]) => `<div class="li"><div class="main"><div class="t">${esc(k)}</div><div class="bar"><i style="width:${(v / maxC * 100).toFixed(1)}%"></i></div></div><div class="amt">${eur(v)}</div></div>`).join("")}</div>` : '<div class="empty">Sem multas. Exemplar!</div>'}</div>
      <div class="card"><h3>Multas <small>${fines.length} registos</small></h3><div class="list">${fines.map(f => fineRow(f, false)).join("") || '<div class="empty">Sem multas.</div>'}</div></div>
      <div class="card"><h3>Pagamentos <small>${pays.length} registos</small></h3><div class="list">${pays.map(p => payRow(p, false)).join("") || '<div class="empty">Sem pagamentos registados.</div>'}</div></div>
    </div>`,
    after() {
      weeklyChart("ch-p", ser);
      $("#p-fine") && ($("#p-fine").onclick = () => openFineForm([m.id]));
      $("#p-pay") && ($("#p-pay").onclick = () => openPayForm(m.id));
    } };
}

/* ================= MULTAS ================= */
function periodOptions(sel, withPresets = true) {
  const dates = [...S.fines.map(f => f.occurrence_date), ...S.payments.map(p => p.payment_date)].filter(Boolean);
  const months = [...new Set(dates.map(monthKey))].sort().reverse();
  const weeks = [...new Set(dates.map(weekStart))].sort().reverse();
  const o = (v, l) => `<option value="${v}" ${sel === v ? "selected" : ""}>${esc(l)}</option>`;
  return o("epoca", "Época completa") + (withPresets ? o("semana", "Semana atual") + o("mes", "Mês atual") : "") +
    (months.length ? `<optgroup label="Meses">${months.map(k => o("m:" + k, monthLabel(k))).join("")}</optgroup>` : "") +
    (weeks.length ? `<optgroup label="Semanas">${weeks.map(w => o("w:" + w, weekLabel(w))).join("")}</optgroup>` : "");
}
const memberOptions = (sel, all = "Todas") => `<option value="">${all}</option>` + S.members.filter(m => m.active).map(m => `<option value="${m.id}" ${sel === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("");
const catList = () => [...new Set(S.types.map(t => t.category))];
const catOptions = (sel) => `<option value="">Todas</option>` + catList().map(c => `<option ${sel === c ? "selected" : ""}>${esc(c)}</option>`).join("");

function vMultas() {
  const F = S.finesFilter, r = periodRange(F.period);
  const list = S.fines.filter(f => (F.showVoid || f.status === "valida") && (!F.member || f.member_id === F.member) &&
    (!F.cat || typeById(f.fine_type_id)?.category === F.cat) && fineInRange(f, r))
    .sort((a, b) => (b.occurrence_date || "").localeCompare(a.occurrence_date || "") || b.created_at.localeCompare(a.created_at));
  const tot = list.filter(f => f.status === "valida").reduce((s, f) => s + cents(f.total), 0);
  return { html: `
    <div class="page-h"><div><h2>Multas</h2><p>${list.length} registos · ${eur(tot)}</p></div>
      ${S.isCap ? `<button class="btn primary" id="new-fine">+ Nova multa</button>` : ""}</div>
    <div class="card"><div class="grid g2 g3">
      <label class="f">Atleta<select id="ff-m">${memberOptions(F.member)}</select></label>
      <label class="f">Categoria<select id="ff-c">${catOptions(F.cat)}</select></label>
      <label class="f">Período<select id="ff-p">${periodOptions(F.period)}</select></label>
    </div>
    <label class="row small" style="margin-top:10px"><input type="checkbox" id="ff-v" ${F.showVoid ? "checked" : ""}> Mostrar multas anuladas</label></div>
    <div class="card" style="margin-top:12px"><div class="list">${list.map(f => fineRow(f)).join("") || '<div class="empty">Nenhuma multa com estes filtros.</div>'}</div>
      ${r.from ? `<p class="hint">Filtrado pela data da ocorrência. As multas importadas do Excel sem data só aparecem na época completa.</p>` : ""}</div>`,
    after() {
      $("#ff-m").onchange = (e) => { F.member = e.target.value; render(); };
      $("#ff-c").onchange = (e) => { F.cat = e.target.value; render(); };
      $("#ff-p").onchange = (e) => { F.period = e.target.value; render(); };
      $("#ff-v").onchange = (e) => { F.showVoid = e.target.checked; render(); };
      $("#new-fine") && ($("#new-fine").onclick = () => openFineForm());
    } };
}

/* ================= PAGAMENTOS ================= */
function vPagamentos() {
  const list = [...S.payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date) || b.created_at.localeCompare(a.created_at));
  const T = teamTotals();
  const debtors = balances().filter(b => b.debt > 0).sort((a, b) => b.debt - a.debt);
  return { html: `
    <div class="page-h"><div><h2>Pagamentos</h2><p>Caixa: ${eur(T.paid)} recebidos · ${eur(T.debt)} por receber</p></div>
      ${S.isCap ? `<button class="btn dark" id="new-pay">+ Registar pagamento</button>` : ""}</div>
    <div class="grid md2">
      <div class="card"><h3>Histórico <small>${list.length} registos</small></h3><div class="list">${list.map(p => payRow(p)).join("") || '<div class="empty">Ainda não há pagamentos registados.</div>'}</div></div>
      <div class="card"><h3>Por receber</h3><div class="list">${debtors.map(b => `<div class="li tap" data-member="${b.m.id}"><div class="main"><div class="t">${esc(b.m.name)}</div><div class="d">pago ${eur(b.paid)} de ${eur(b.fines)}</div></div><div class="amt" style="color:var(--red)">${eur(b.debt)}</div></div>`).join("") || '<div class="empty">Ninguém deve nada.</div>'}</div></div>
    </div>`,
    after() { $("#new-pay") && ($("#new-pay").onclick = () => openPayForm()); } };
}

/* ================= ESTATÍSTICAS ================= */
function vStats() {
  const r = periodRange(S.statPeriod);
  const mId = S.statMember || null, cat = S.statCat || null;
  const ser = weeklySeries(mId, cat);
  // limitar semanas ao período
  const idx = ser.weeks.map((w, i) => i).filter(i => !r.from || (addDays(ser.weeks[i], 6) >= r.from && ser.weeks[i] <= r.to));
  const pick = (arr) => idx.map(i => arr[i]);
  const s2 = { weeks: pick(ser.weeks), fines: pick(ser.fines), pays: pick(ser.pays), debt: pick(ser.debt) };
  const fines = validFines().filter(f => (!mId || f.member_id === mId) && (!cat || typeById(f.fine_type_id)?.category === cat) && fineInRange(f, r));
  const pays = validPays().filter(p => (!mId || p.member_id === mId) && inRange(p.payment_date, r));
  const fT = fines.reduce((s, f) => s + cents(f.total), 0), pT = pays.reduce((s, p) => s + cents(p.amount), 0);
  const per = {}; fines.forEach(f => per[f.member_id] = (per[f.member_id] || 0) + cents(f.total));
  const comp = S.members.filter(m => m.active || per[m.id]).map(m => [m.name, per[m.id] || 0]).sort((a, b) => b[1] - a[1]);
  const byCat = {}; fines.forEach(f => { const c = typeById(f.fine_type_id)?.category || "?"; byCat[c] = (byCat[c] || 0) + cents(f.total); });
  const undated = fines.filter(f => !f.occurrence_date).reduce((s, f) => s + cents(f.total), 0);
  const curW = weekStart(todayStr()); const ci = ser.weeks.indexOf(curW);
  const thisW = ci >= 0 ? ser.fines[ci] : 0; const prevW = ser.weeks.map((w, i) => [w, ser.fines[i]]).filter(([w]) => w < curW);
  const avgW = prevW.length ? Math.round(prevW.reduce((a, x) => a + x[1], 0) / prevW.length) : null;
  const byType = {}; fines.forEach(f => { const k = f.fine_type_id; byType[k] = byType[k] || { n: 0, v: 0 }; byType[k].n += Number(f.quantity); byType[k].v += cents(f.total); });
  const topTypes = Object.entries(byType).sort((a, b) => b[1].n - a[1].n || b[1].v - a[1].v).slice(0, 6);
  const cats = catList(); const catWeeks = s2.weeks;
  const catData = cats.map(c => catWeeks.map(w => fines.filter(f => f.occurrence_date && weekStart(f.occurrence_date) === w && typeById(f.fine_type_id)?.category === c).reduce((a, f) => a + cents(f.total), 0)));
  return { html: `
    <div class="page-h"><div><h2>Estatísticas</h2><p>${esc(r.label)}${mId ? " · " + esc(memberById(mId)?.name) : ""}${cat ? " · " + esc(cat) : ""}</p></div></div>
    <div class="card"><div class="grid g2 g3">
      <label class="f">Período<select id="sf-p">${periodOptions(S.statPeriod)}</select></label>
      <label class="f">Atleta<select id="sf-m">${memberOptions(S.statMember)}</select></label>
      <label class="f">Categoria de multa<select id="sf-c">${catOptions(S.statCat)}</select></label>
    </div><p class="hint" style="margin-top:8px">Multas contam pela data da ocorrência, pagamentos pela data do pagamento. A data de registo aparece no detalhe de cada movimento.</p></div>
    <div class="grid g2" style="margin-top:12px">
      <div class="kpi red"><div class="l">Multas no período</div><div class="v">${eur(fT)}</div>${undated ? `<div class="s">${eur(undated)} sem data (Excel)</div>` : ""}</div>
      <div class="kpi"><div class="l">Pagamentos no período</div><div class="v" style="color:var(--good)">${eur(pT)}</div></div>
      <div class="kpi black"><div class="l">Esta semana</div><div class="v">${eur(thisW)}</div><div class="s">${avgW === null ? "ainda sem semanas anteriores para comparar" : `média semanal: ${eur(avgW)} · ${thisW > avgW ? "acima" : thisW < avgW ? "abaixo" : "igual"} da média`}</div></div>
      <div class="kpi"><div class="l">Tipo mais frequente</div><div class="v" style="font-size:1.3rem">${topTypes.length ? esc(typeById(topTypes[0][0])?.name) : "—"}</div>${topTypes.length ? `<div class="s">${numFmt.format(topTypes[0][1].n)} ocorrências no período</div>` : ""}</div>
    </div>
    <div class="grid md2" style="margin-top:12px">
      <div class="card"><h3>Multas por semana</h3><div class="chart-box"><canvas id="ch-f"></canvas></div></div>
      <div class="card"><h3>Pagamentos por semana</h3><div class="chart-box"><canvas id="ch-pay"></canvas></div></div>
      <div class="card"><h3>Dívida acumulada</h3><div class="chart-box"><canvas id="ch-d"></canvas></div>
        <p class="hint">Começa nos ${eur(ser.undatedFines)} importados do Excel (sem data) e soma multas menos pagamentos semana a semana.</p></div>
      <div class="card"><h3>Comparação entre atletas</h3><div class="chart-box tall"><canvas id="ch-c"></canvas></div></div>
      <div class="card"><h3>Categorias ao longo da época <small>por semana</small></h3><div class="chart-box"><canvas id="ch-cat"></canvas></div>
        <p class="hint">Mostra que tipo de multas está a subir ou a descer. Só inclui multas com data.</p></div>
      <div class="card"><h3>Multas mais frequentes <small>ocorrências</small></h3><div class="list">${topTypes.map(([id, x]) => `<div class="li"><div class="main"><div class="t">${esc(typeById(id)?.name)}</div><div class="bar"><i style="width:${(x.n / Math.max(1, topTypes[0][1].n) * 100).toFixed(1)}%"></i></div></div><div class="amt">${numFmt.format(x.n)}×</div></div>`).join("") || '<div class="empty">Sem multas no período.</div>'}</div></div>
      <div class="card"><h3>Por categoria</h3><div class="list">${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="li"><div class="main"><div class="t">${esc(c)}</div><div class="bar"><i style="width:${(v / Math.max(1, fT) * 100).toFixed(1)}%"></i></div></div><div class="amt">${eur(v)}</div></div>`).join("") || '<div class="empty">Sem multas no período.</div>'}</div></div>
    </div>`,
    after() {
      $("#sf-p").onchange = (e) => { S.statPeriod = e.target.value; render(); };
      $("#sf-m").onchange = (e) => { S.statMember = e.target.value; render(); };
      $("#sf-c").onchange = (e) => { S.statCat = e.target.value; render(); };
      weeklyChart("ch-f", s2, { pays: false });
      weeklyChart("ch-pay", s2, { fines: false });
      chart("ch-d", { type: "line", data: { labels: s2.weeks.map(dShort), datasets: [{ label: "Dívida acumulada", data: s2.debt, borderColor: cssVar("--red"), backgroundColor: cssVar("--red-soft"), fill: true, tension: .25, pointRadius: 3 }] }, options: baseOpts() });
      const palette = [cssVar("--red"), cssVar("--chart-pay"), cssVar("--warn"), cssVar("--ink-2"), cssVar("--good")];
      chart("ch-cat", { type: "bar", data: { labels: catWeeks.map(dShort), datasets: cats.map((c, i) => ({ label: c, data: catData[i], backgroundColor: palette[i % palette.length], borderRadius: 3, maxBarThickness: 26 })) },
        options: baseOpts({ scales: { x: { stacked: true, ticks: { color: cssVar("--ink-2") }, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { color: cssVar("--ink-2"), callback: (v) => eur(v).replace(",00", "") }, grid: { color: cssVar("--chart-grid") } } } }) });
      chart("ch-c", { type: "bar", data: { labels: comp.map(c => c[0]), datasets: [{ label: "Multas", data: comp.map(c => c[1]), backgroundColor: cssVar("--red"), borderRadius: 4 }] },
        options: baseOpts({ indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => eur(c.raw) } } },
          scales: { x: { beginAtZero: true, ticks: { color: cssVar("--ink-2"), callback: (v) => eur(v).replace(",00", "") }, grid: { color: cssVar("--chart-grid") } }, y: { ticks: { color: cssVar("--ink-2"), autoSkip: false, font: { size: 11 } }, grid: { display: false } } } }) });
    } };
}

/* ================= RANKINGS ================= */
function vRankings() {
  const key = S.rankPeriod; const r = periodRange(key);
  const fines = validFines().filter(f => fineInRange(f, r));
  const agg = new Map(S.members.filter(m => m.active).map(m => [m.id, { m, v: 0, n: 0 }]));
  fines.forEach(f => { const a = agg.get(f.member_id); if (a) { a.v += cents(f.total); a.n += Number(f.quantity); } });
  const arr = [...agg.values()];
  const byV = [...arr].filter(a => a.v > 0).sort((a, b) => b.v - a.v || b.n - a.n);
  const byN = [...arr].filter(a => a.n > 0).sort((a, b) => b.n - a.n || b.v - a.v);
  const byDebt = balances().filter(b => b.debt > 0).sort((a, b) => b.debt - a.debt);
  // ranking semanal: líder de cada semana
  const weekly = new Map();
  validFines().filter(f => f.occurrence_date && fineInRange(f, r)).forEach(f => { const w = weekStart(f.occurrence_date); if (!weekly.has(w)) weekly.set(w, new Map()); const mm = weekly.get(w); mm.set(f.member_id, (mm.get(f.member_id) || 0) + cents(f.total)); });
  const weekLeaders = [...weekly.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([w, mm]) => { const [id, v] = [...mm.entries()].sort((a, b) => b[1] - a[1])[0]; return { w, m: memberById(id), v, tot: [...mm.values()].reduce((s, x) => s + x, 0) }; });
  const podium = (list, fmt) => {
    if (!list.length) return '<div class="empty">Ninguém no pódio neste período. Bom comportamento!</div>';
    const [a, b, c] = list;
    const p = (x, cls, n) => x ? `<div class="pod ${cls}"><div class="p">${n}</div><div class="n">${esc(x.m.name)}</div><div class="v">${fmt(x)}</div></div>` : "<div></div>";
    return `<div class="podium">${p(b, "p2", 2)}${p(a, "p1", 1)}${p(c, "p3", 3)}</div>` +
      (list.length > 3 ? `<div class="list">${list.slice(3).map((x, i) => `<div class="li tap" data-member="${x.m.id}"><div class="rank">${i + 4}</div><div class="main"><div class="t">${esc(x.m.name)}</div></div><div class="amt">${fmt(x)}</div></div>`).join("")}</div>` : "");
  };
  const seg = [["semana", "Semana atual"], ["mes", "Mês"], ["epoca", "Época"]].map(([k, l]) => `<button data-rp="${k}" aria-pressed="${key === k}">${l}</button>`).join("");
  return { html: `
    <div class="page-h"><div><h2>Rankings</h2><p>${esc(r.label)}</p></div></div>
    <div class="seg" role="group" aria-label="Período">${seg}</div>
    ${key !== "epoca" ? `<p class="hint" style="margin:8px 2px 0">Contam as multas com data de ocorrência neste período. As importadas do Excel sem data só entram na época.</p>` : ""}
    <div class="grid md2" style="margin-top:12px">
      <div class="card"><h3>Rainhas da multa <small>maior valor</small></h3>${podium(byV, x => eur(x.v))}</div>
      <div class="card"><h3>Reincidentes <small>mais multas</small></h3>${podium(byN, x => `${numFmt.format(x.n)} multa${x.n === 1 ? "" : "s"}`)}</div>
      <div class="card"><h3>Maior saldo por pagar <small>dívida atual</small></h3>${podium(byDebt.map(b => ({ m: b.m, d: b.debt })), x => eur(x.d))}
        <p class="hint">A dívida é sempre o saldo atual, independentemente do período.</p></div>
      <div class="card"><h3>Ranking semanal <small>líder de cada semana</small></h3>
        <div class="list">${weekLeaders.map(w => `<div class="li"><div class="main"><div class="t">${esc(w.m?.name)}</div><div class="d">Semana ${weekLabel(w.w)} · equipa ${eur(w.tot)}</div></div><div class="amt">${eur(w.v)}</div></div>`).join("") || '<div class="empty">Ainda não há multas com data neste período.</div>'}</div></div>
    </div>`,
    after() { document.querySelectorAll("[data-rp]").forEach(b => b.onclick = () => { S.rankPeriod = b.dataset.rp; render(); }); } };
}

/* ================= ADMINISTRAÇÃO ================= */
let adminTab = "contas"; let adminCache = { status: [], audit: [], invites: [], recon: null };
function vAdmin() {
  const tabs = [["contas", "Contas"], ["tipos", "Tipos de multa"], ["historico", "Histórico"], ["exportar", "Exportar"]]
    .map(([k, l]) => `<button data-at="${k}" aria-pressed="${adminTab === k}">${l}</button>`).join("");
  let body = "";
  if (adminTab === "contas") {
    const st = new Map(adminCache.status.map(s => [s.member_id, s]));
    body = `<div class="card"><h3>Atletas e contas <small>convites individuais</small></h3>
      <p class="hint">O convite gera um link pessoal e de uso único. Envia-o só à própria atleta (por exemplo por mensagem privada). Novas contas entram sempre como atleta. As permissões de capitã não se atribuem pela app.</p>
      <div class="list">${S.members.map(m => { const s = st.get(m.id);
        const state = m.access_blocked ? '<span class="pill debt">acesso bloqueado</span>' : !m.user_id ? '<span class="pill staff">sem conta</span>' : s?.last_sign_in_at ? '<span class="pill ok">ativa</span>' : '<span class="pill credit">convite pendente</span>';
        return `<div class="li"><div class="av ${m.is_captain ? "cap" : ""}">${esc(initials(m.name))}</div>
          <div class="main"><div class="t">${esc(m.name)} ${m.is_captain ? '<span class="pill cap">Capitã</span>' : ""} ${!m.active ? '<span class="pill void">inativa</span>' : ""}</div>
          <div class="d">${s?.email ? esc(s.email) : "sem email"} · ${state}${s?.last_sign_in_at ? " · última entrada " + dtLong(s.last_sign_in_at) : ""}</div></div>
          <button class="btn sm" data-edit-member="${m.id}">Gerir</button></div>`; }).join("")}</div>
      <button class="btn block" id="add-member" style="margin-top:10px">+ Adicionar atleta</button></div>
      ${S.removed?.length ? `<div class="card" style="margin-top:12px"><h3>Atletas removidas <small>histórico · só capitãs</small></h3>
        <p class="hint">Não contam para nenhum total, gráfico ou ranking e as atletas não as veem. Os registos ficam guardados aqui.</p>
        <div class="list">${S.removed.map(r => `<div class="li tap" data-removed="${r.id}"><div class="main"><div class="t">${esc(r.name)}</div>
          <div class="d">Removida a ${dtLong(r.removed_at)} por ${esc(nameByUser(r.removed_by))}${r.removal_reason ? " · " + esc(r.removal_reason) : ""}</div></div>
          <div class="amt" style="color:var(--warn)">${eur(cents(r.refund_amount))}<div class="d" style="font-family:var(--f-body);font-size:.7rem;font-weight:600">a devolver</div></div></div>`).join("")}</div></div>` : ""}
      <div class="card" style="margin-top:12px"><h3>Conferência de totais</h3><div id="recon" class="small muted">A conferir com a base de dados…</div></div>
      ${S.notes.map(n => `<div class="card" style="margin-top:12px"><h3>${esc(n.title)}</h3><p class="small muted" style="margin:0">${esc(n.body)}</p></div>`).join("")}`;
  } else if (adminTab === "tipos") {
    body = `<div class="card"><h3>Tipos de multa e preços</h3>
      <p class="hint">Alterar um preço só afeta multas novas. As multas já registadas mantêm o preço da altura.</p>
      ${catList().map(c => `<h4 style="margin:14px 0 4px;font-family:var(--f-display);text-transform:uppercase">${esc(c)}</h4><div class="list">${S.types.filter(t => t.category === c).map(t => `<div class="li tap" data-edit-type="${t.id}"><div class="main"><div class="t">${esc(t.name)}</div>${!t.active ? '<div class="d"><span class="pill void">desativado</span></div>' : ""}</div><div class="amt">${eur(cents(t.unit_price))}</div></div>`).join("")}</div>`).join("")}
      <button class="btn block" id="add-type" style="margin-top:12px">+ Novo tipo de multa</button></div>`;
  } else if (adminTab === "historico") {
    body = `<div class="card"><h3>Histórico de alterações <small>últimas 300</small></h3><div class="list">${adminCache.audit.map(auditRow).join("") || '<div class="empty">A carregar…</div>'}</div></div>`;
  } else {
    body = `<div class="card"><h3>Exportar relatórios</h3>
      <button class="btn primary block" id="exp-xlsx">Livro Excel completo (.xlsx)</button>
      <p class="hint">Saldos, multas, pagamentos e resumo semanal em folhas separadas. Ou, em CSV (separador ; e vírgula decimal):</p>
      <div class="stack"><button class="btn block" data-exp="saldos">Saldos por atleta</button>
      <button class="btn block" data-exp="multas">Todas as multas</button>
      <button class="btn block" data-exp="pagamentos">Todos os pagamentos</button>
      <button class="btn block" data-exp="semanal">Resumo semanal</button></div></div>`;
  }
  return { html: `<div class="page-h"><div><h2>Administração</h2><p>Só visível para as capitãs</p></div></div>
    <div class="seg" role="group">${tabs}</div><div style="margin-top:12px">${body}</div>`,
    after() {
      document.querySelectorAll("[data-at]").forEach(b => b.onclick = () => { adminTab = b.dataset.at; render(); loadAdminData(); });
      document.querySelectorAll("[data-edit-member]").forEach(b => b.onclick = () => openMemberForm(b.dataset.editMember));
      document.querySelectorAll("[data-removed]").forEach(b => b.onclick = () => openRemovedDetail(b.dataset.removed));
      document.querySelectorAll("[data-edit-type]").forEach(b => b.onclick = () => openTypeForm(b.dataset.editType));
      document.querySelectorAll("[data-exp]").forEach(b => b.onclick = () => exportCsv(b.dataset.exp));
      $("#exp-xlsx") && ($("#exp-xlsx").onclick = exportXlsx);
      $("#add-member") && ($("#add-member").onclick = () => openMemberForm(null));
      $("#add-type") && ($("#add-type").onclick = () => openTypeForm(null));
      if (!vAdmin._loaded) { vAdmin._loaded = true; loadAdminData(); }
      const rc = $("#recon");
      if (rc && adminCache.recon) {
        const local = new Map(balances().map(b => [b.m.id, b]));
        const diffs = adminCache.recon.filter(r => { const b = local.get(r.member_id); return !b || cents(r.fines_total) !== b.fines || cents(r.paid_total) !== b.paid; });
        const dbF = adminCache.recon.reduce((s, r) => s + cents(r.fines_total), 0), dbP = adminCache.recon.reduce((s, r) => s + cents(r.paid_total), 0);
        rc.innerHTML = diffs.length ? `<div class="err">Diferenças em ${diffs.length} atleta(s). Recarrega a página; se persistir, avisa quem gere a app.</div>`
          : `<div class="okmsg">Totais conferidos: a app e a base de dados coincidem (multas ${eur(dbF)}, recebido ${eur(dbP)}).</div>`;
      }
    } };
}
async function loadAdminData() {
  try {
    const [st, au] = await Promise.all([sb.rpc("scrg_accounts"), sb.from("scrg_audit").select("*").order("changed_at", { ascending: false }).limit(300)]);
    if (!st.error) adminCache.status = st.data || [];
    const bv = await sb.from("scrg_balances").select("member_id,fines_total,paid_total,balance");
    if (!bv.error) adminCache.recon = bv.data || [];
    if (!au.error) adminCache.audit = au.data || [];
    if (S.view === "admin") { const y = window.scrollY; render(); window.scrollTo(0, y); }
  } catch (e) { console.error(e); }
}
function auditRow(a) {
  const T = { scrg_fines: "Multa", scrg_payments: "Pagamento", scrg_fine_types: "Tipo de multa", scrg_members: "Atleta", scrg_invites: "Convite" }[a.table_name] || a.table_name;
  const d = a.new_data || a.old_data || {};
  let what = "";
  if (a.table_name === "scrg_fines") what = `${memberById(d.member_id)?.name || ""} · ${typeById(d.fine_type_id)?.name || ""} · ${eur(cents(d.total))}`;
  else if (a.table_name === "scrg_payments") what = `${memberById(d.member_id)?.name || ""} · ${eur(cents(d.amount))}`;
  else if (a.table_name === "scrg_fine_types") what = `${d.name} · ${eur(cents(d.unit_price))}`;
  else if (a.table_name === "scrg_members") what = d.name || "";
  else if (a.table_name === "scrg_invites") what = `${memberById(d.member_id)?.name || ""} · ${d.email || ""}`;
  let act = { INSERT: "criado", UPDATE: "alterado", DELETE: "eliminado", BLOQUEIO: "acesso bloqueado", DESBLOQUEIO: "acesso desbloqueado", REMOCAO: "removida da equipa", REPOSICAO: "reposta na equipa" }[a.action];
  if (a.action === "REMOCAO") act += ` (devolver ${eur(cents(d.refund))}${d.reason ? " · " + d.reason : ""})`;
  if (a.action === "BLOQUEIO" && d.reason) act += ` (${d.reason})`;
  if (a.action === "UPDATE" && a.old_data && a.new_data) {
    if (a.old_data.status !== a.new_data.status && /anulad/.test(a.new_data.status)) act = `anulado (${a.new_data.void_reason || ""})`;
    else { const ch = Object.keys(a.new_data).filter(k => !["updated_at", "updated_by"].includes(k) && JSON.stringify(a.old_data[k]) !== JSON.stringify(a.new_data[k])); if (ch.length) act = "alterado: " + ch.map(k => `${k} ${a.old_data[k] ?? "—"} → ${a.new_data[k] ?? "—"}`).join(", "); }
  }
  return `<div class="li"><div class="main"><div class="t">${T} ${esc(act)}</div><div class="d">${esc(what)}<br>${dtLong(a.changed_at)} · por ${esc(nameByUser(a.changed_by))}</div></div></div>`;
}

/* ================= EXPORTAÇÃO ================= */
function reportRows(kind) {
  const n = (c) => Math.round(c || 0) / 100;
  const rows = [];
  if (kind === "saldos") { rows.push(["Atleta", "Multas (€)", "Pago (€)", "Em dívida (€)"]); balances().forEach(b => rows.push([b.m.name, n(b.fines), n(b.paid), n(b.debt)])); const T = teamTotals(); rows.push(["TOTAL EQUIPA", n(T.fines), n(T.paid), n(T.debt)]); }
  if (kind === "multas") { rows.push(["Atleta", "Categoria", "Tipo", "Quantidade", "Preço unitário (€)", "Total (€)", "Data da ocorrência", "Data do registo", "Registado por", "Estado", "Motivo anulação", "Origem", "Observações"]);
    S.fines.forEach(f => { const t = typeById(f.fine_type_id); rows.push([memberById(f.member_id)?.name, t?.category, t?.name, Number(f.quantity), n(cents(f.unit_price)), n(cents(f.total)), f.occurrence_date || "sem data", dtLong(f.created_at), nameByUser(f.created_by, "Importação do Excel"), f.status, f.void_reason || "", f.source === "excel_import" ? "Excel" : "App", f.notes || ""]); }); }
  if (kind === "pagamentos") { rows.push(["Atleta", "Valor (€)", "Data do pagamento", "Método", "Data do registo", "Registado por", "Estado", "Motivo anulação", "Crédito confirmado", "Observação"]);
    S.payments.forEach(p => rows.push([memberById(p.member_id)?.name, n(cents(p.amount)), p.payment_date, p.method || "", dtLong(p.created_at), nameByUser(p.created_by), p.status, p.void_reason || "", p.credit_confirmed ? "sim" : "não", p.notes || ""])); }
  if (kind === "semanal") { const s = weeklySeries(); rows.push(["Semana (seg)", "Semana (dom)", "Multas (€)", "Pagamentos (€)", "Dívida acumulada (€)"]); rows.push(["Saldo inicial importado (sem data)", "", n(s.undatedFines), "", ""]); s.weeks.forEach((w, i) => rows.push([w, addDays(w, 6), n(s.fines[i]), n(s.pays[i]), n(s.debt[i])])); }
  return rows;
}
function loadScript(src) { return new Promise((res, rej) => { const el = document.createElement("script"); el.src = src; el.onload = res; el.onerror = rej; document.head.appendChild(el); }); }
async function exportXlsx() {
  try {
    if (typeof XLSX === "undefined") { toast("A preparar o Excel…"); await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"); }
    const wb = XLSX.utils.book_new();
    [["saldos", "Saldos"], ["multas", "Multas"], ["pagamentos", "Pagamentos"], ["semanal", "Semanal"]].forEach(([k, name]) => {
      const rows = reportRows(k); const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = rows[0].map(() => ({ wch: 18 })); XLSX.utils.book_append_sheet(wb, ws, name);
    });
    XLSX.writeFile(wb, `multas-scrg-2627-${todayStr()}.xlsx`);
    toast("Excel exportado.");
  } catch (e) { toast("Não foi possível criar o Excel. Usa a exportação em CSV."); }
}
function exportCsv(kind) {
  const rows = reportRows(kind).map(r => r.map(v => typeof v === "number" ? v.toFixed(2).replace(".", ",") : v));
  const csv = "\ufeff" + rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `multas-scrg-${kind}-${todayStr()}.csv`; document.body.appendChild(a); a.click(); a.remove();
  toast("Relatório exportado.");
}

/* ================= FOLHAS (MODAIS) ================= */
function openSheet(title, html, onMount) {
  const root = $("#sheet-root");
  root.innerHTML = `<div class="sheet-bg" id="sbg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="grab"></div><div class="sheet-h"><h3>${esc(title)}</h3><button class="btn sm ghost" id="sclose">Fechar</button></div>${html}</div></div>`;
  $("#sclose").onclick = closeSheet;
  $("#sbg").onclick = (e) => { if (e.target.id === "sbg") closeSheet(); };
  document.body.style.overflow = "hidden";
  onMount && onMount(root);
}
function closeSheet() { $("#sheet-root").innerHTML = ""; document.body.style.overflow = ""; }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

/* ---------- nova multa ---------- */
function openFineForm(preselect = []) {
  if (!S.isCap) return;
  const sel = new Set(preselect); const ref = uuid(); let busy = false;
  const typesOpts = catList().map(c => `<optgroup label="${esc(c)}">${S.types.filter(t => t.category === c && t.active).map(t => `<option value="${t.id}">${esc(t.name)} — ${eur(cents(t.unit_price))}</option>`).join("")}</optgroup>`).join("");
  const active = S.members.filter(m => m.active);
  openSheet("Nova multa", `
    <form id="fine-f" class="stack" novalidate>
      <div class="f"><span style="font-weight:600;font-size:.86rem">Atletas <span class="hint">(podes escolher várias)</span></span>
        <div class="row" style="gap:6px"><button type="button" class="btn sm" id="sel-ath">Todas as jogadoras</button><button type="button" class="btn sm" id="sel-staff">Equipa técnica</button><button type="button" class="btn sm ghost" id="sel-none">Limpar</button></div>
        <div class="chips" id="chips">${active.map(m => `<button type="button" class="chip" data-chip="${m.id}" aria-pressed="${sel.has(m.id)}">${esc(m.name)}</button>`).join("")}</div></div>
      <div class="f"><span style="font-weight:600;font-size:.86rem">Tipo de multa</span>
        <div class="type-chips" id="tchips">${frequentTypes().map(t => `<button type="button" class="chip" data-tchip="${t.id}">${esc(t.name)} · ${eur(cents(t.unit_price))}</button>`).join("")}</div>
        <select id="ft" required aria-label="Tipo de multa"><option value="">Outro tipo…</option>${typesOpts}</select></div>
      <div class="grid g2">
        <label class="f">Quantidade<div class="stepper"><button type="button" id="qm" aria-label="Menos">−</button><input id="fq" type="number" inputmode="decimal" min="0.5" step="0.5" value="1"><button type="button" id="qp" aria-label="Mais">+</button></div></label>
        <label class="f">Data da ocorrência<input id="fd" type="date" value="${todayStr()}" max="${todayStr()}" required></label>
      </div>
      <label class="f">Observações <span class="hint">opcional</span><textarea id="fn" maxlength="500"></textarea></label>
      <div class="totalbar"><span id="fsum">Escolhe atletas e tipo</span><b id="ftot">0,00 €</b></div>
      <div id="ferr" class="err" hidden></div>
      <button class="btn primary block" id="fsave" type="submit">Registar multa</button>
    </form>`, () => {
    const upd = () => {
      document.querySelectorAll("[data-chip]").forEach(c => c.setAttribute("aria-pressed", sel.has(c.dataset.chip)));
      const t = typeById($("#ft").value); const q = Number($("#fq").value) || 0;
      const unit = t ? cents(t.unit_price) : 0; const each = Math.round(unit * q);
      $("#fsum").textContent = t ? `${sel.size} × ${numFmt.format(q)} × ${eur(unit)}` : "Escolhe atletas e tipo";
      $("#ftot").textContent = eur(each * sel.size);
    };
    document.querySelectorAll("[data-chip]").forEach(c => c.onclick = () => { sel.has(c.dataset.chip) ? sel.delete(c.dataset.chip) : sel.add(c.dataset.chip); upd(); });
    $("#sel-ath").onclick = () => { active.filter(m => m.kind === "atleta").forEach(m => sel.add(m.id)); upd(); };
    $("#sel-staff").onclick = () => { active.filter(m => m.kind === "equipa_tecnica").forEach(m => sel.add(m.id)); upd(); };
    $("#sel-none").onclick = () => { sel.clear(); upd(); };
    $("#qm").onclick = () => { $("#fq").value = Math.max(0.5, (Number($("#fq").value) || 1) - 1); upd(); };
    $("#qp").onclick = () => { $("#fq").value = (Number($("#fq").value) || 0) + 1; upd(); };
    const syncT = () => document.querySelectorAll("[data-tchip]").forEach(c => c.setAttribute("aria-pressed", c.dataset.tchip === $("#ft").value));
    document.querySelectorAll("[data-tchip]").forEach(c => c.onclick = () => { $("#ft").value = c.dataset.tchip; syncT(); upd(); });
    $("#ft").onchange = () => { syncT(); upd(); }; $("#fq").oninput = upd; upd();
    $("#fine-f").onsubmit = async (e) => {
      e.preventDefault(); if (busy || !guardOnline()) return;
      const err = $("#ferr"); err.hidden = true;
      const t = $("#ft").value, q = Number($("#fq").value), d = $("#fd").value;
      const msg = !sel.size ? "Escolhe pelo menos uma atleta." : !t ? "Escolhe o tipo de multa." : !(q > 0) ? "A quantidade tem de ser maior que zero." : !d ? "Indica a data da ocorrência." : d > todayStr() ? "A data da ocorrência não pode ser no futuro." : "";
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      busy = true; $("#fsave").disabled = true; $("#fsave").textContent = "A guardar…";
      const batch = sel.size > 1 ? ref : null;
      const rows = [...sel].map((mid, i) => ({ member_id: mid, fine_type_id: t, quantity: q, occurrence_date: d, notes: $("#fn").value.trim() || null, batch_id: batch,
        client_ref: i === 0 ? ref : uuid5ish(ref, mid) }));
      const { error } = await sb.from("scrg_fines").insert(rows);
      if (error && !/client_ref/.test(error.message)) { busy = false; $("#fsave").disabled = false; $("#fsave").textContent = "Registar multa"; err.textContent = friendlyError(error); err.hidden = false; return; }
      closeSheet(); await loadAll(); render();
      const refs = rows.map(r => r.client_ref);
      toast(sel.size > 1 ? `${sel.size} multas registadas.` : "Multa registada.", { label: "Desfazer", fn: async () => {
        const ids = S.fines.filter(f => refs.includes(f.client_ref) && f.status === "valida").map(f => f.id);
        const { error } = await sb.from("scrg_fines").update({ status: "anulada", void_reason: "Desfeito logo após o registo" }).in("id", ids);
        if (error) { toast(friendlyError(error)); return; }
        await loadAll(); render(); toast("Registo desfeito (fica no histórico como anulado).");
      } });
    };
  });
}
// tipos mais usados (para escolher com um toque); sem histórico, mostra os de jogo
function frequentTypes() {
  const cnt = {}; S.fines.filter(f => f.source === "app").forEach(f => cnt[f.fine_type_id] = (cnt[f.fine_type_id] || 0) + 1);
  const used = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([id]) => typeById(id)).filter(t => t && t.active);
  const game = ["Derrota (Jogadoras)", "Empate", "Consumo Mínimo (1€/jogo)", "Atraso no Treino (<15 min)"].map(n => S.types.find(t => t.name === n && t.active)).filter(Boolean);
  const out = []; [...used, ...game].forEach(t => { if (!out.includes(t)) out.push(t); });
  return out.slice(0, 6);
}
// referência determinística por atleta dentro do mesmo formulário (evita duplicados se o botão for carregado duas vezes)
function uuid5ish(base, mid) { const h = (base + mid).split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); const hx = (h.toString(16) + "00000000").slice(0, 8); return hx + base.slice(8); }

/* ---------- detalhe / editar multa ---------- */
function openFineDetail(id) {
  const f = S.fines.find(x => x.id === id); if (!f) return;
  const t = typeById(f.fine_type_id), m = memberById(f.member_id);
  const can = S.isCap && f.status === "valida";
  openSheet("Multa", `
    <div class="card stack">
      <div class="row"><b class="sp">${esc(m?.name)}</b><span class="amt" style="font-family:var(--f-display);font-size:1.8rem;font-weight:800">${eur(cents(f.total))}</span></div>
      <div>${esc(t?.category)} · ${esc(t?.name)}</div>
      <div class="small muted">${numFmt.format(f.quantity)} × ${eur(cents(f.unit_price))}</div>
      <div class="small"><b>Data da ocorrência:</b> ${f.occurrence_date ? dLong(f.occurrence_date) : "sem data (importado do Excel)"}<br>
        <b>Registo:</b> ${dtLong(f.created_at)} por ${esc(nameByUser(f.created_by, "Importação do Excel"))}${f.updated_at ? `<br><b>Última alteração:</b> ${dtLong(f.updated_at)} por ${esc(nameByUser(f.updated_by))}` : ""}
        ${f.batch_id ? "<br>Registada em grupo com outras atletas" : ""}</div>
      ${f.notes ? `<div class="small"><b>Observações:</b> ${esc(f.notes)}</div>` : ""}
      ${f.status === "anulada" ? `<div class="warnbox">Anulada: ${esc(f.void_reason)}</div>` : ""}
    </div>
    ${can ? `<form id="fe" class="stack" style="margin-top:14px" novalidate>
      <h4 style="margin:0;font-family:var(--f-display);text-transform:uppercase;font-size:1.1rem">Corrigir</h4>
      <label class="f">Tipo de multa<select id="et">${S.types.map(x => `<option value="${x.id}" ${x.id === f.fine_type_id ? "selected" : ""}>${esc(x.name)} — ${eur(cents(x.unit_price))}</option>`).join("")}</select>
        <span class="hint">Se mudares o tipo, o preço passa a ser o atual desse tipo.</span></label>
      <div class="grid g2"><label class="f">Quantidade<input id="eq" type="number" min="0.5" step="0.5" value="${f.quantity}"></label>
      <label class="f">Data da ocorrência<input id="ed" type="date" value="${f.occurrence_date || ""}" max="${todayStr()}"></label></div>
      <label class="f">Observações<textarea id="en">${esc(f.notes || "")}</textarea></label>
      <div id="eerr" class="err" hidden></div>
      <button class="btn primary block" type="submit">Guardar correção</button>
    </form>
    <div class="stack" style="margin-top:14px">${(() => { const b = balances().find(x => x.m.id === f.member_id); const after = b ? b.debt - cents(f.total) : 0; return after < 0 ? `<div class="warnbox">Atenção: ${esc(m?.name)} já pagou esta multa. Ao anulá-la, fica com ${eur(-after)} de crédito a favor.</div>` : ""; })()}
      <label class="f">Anular multa — motivo<input id="vr" placeholder="Ex.: registada por engano"></label>
      <button class="btn block" id="void" style="color:var(--red)">Anular multa</button></div>` : ""}`, () => {
    if (!can) return;
    $("#fe").onsubmit = async (e) => {
      e.preventDefault(); if (!guardOnline()) return;
      const q = Number($("#eq").value), d = $("#ed").value || null;
      if (!(q > 0)) { $("#eerr").textContent = "Quantidade inválida."; $("#eerr").hidden = false; return; }
      if (!d && f.source !== "excel_import") { $("#eerr").textContent = "Indica a data da ocorrência."; $("#eerr").hidden = false; return; }
      const { error } = await sb.from("scrg_fines").update({ fine_type_id: $("#et").value, quantity: q, occurrence_date: d, notes: $("#en").value.trim() || null }).eq("id", f.id);
      if (error) { $("#eerr").textContent = friendlyError(error); $("#eerr").hidden = false; return; }
      closeSheet(); toast("Multa corrigida. A alteração ficou no histórico."); await loadAll(); render();
    };
    $("#void").onclick = async () => {
      if (!guardOnline()) return;
      const r = $("#vr").value.trim(); if (!r) { $("#vr").focus(); toast("Indica o motivo da anulação."); return; }
      const { error } = await sb.from("scrg_fines").update({ status: "anulada", void_reason: r }).eq("id", f.id);
      if (error) { toast(friendlyError(error)); return; }
      closeSheet(); toast("Multa anulada."); await loadAll(); render();
    };
  });
}

/* ---------- novo pagamento ---------- */
function openPayForm(preMember = "", prefill = null) {
  if (!S.isCap) return;
  const ref = uuid(); let busy = false; let needConfirm = false;
  const bs = new Map(balances().map(b => [b.m.id, b]));
  openSheet("Registar pagamento", `
    <form id="pay-f" class="stack" novalidate>
      <label class="f">Atleta<select id="pm" required><option value="">Escolher…</option>${S.members.filter(m => m.active || (bs.get(m.id)?.debt > 0)).map(m => { const b = bs.get(m.id); return `<option value="${m.id}" ${preMember === m.id ? "selected" : ""}>${esc(m.name)} — ${b && b.debt > 0 ? "deve " + eur(b.debt) : b && b.debt < 0 ? "crédito " + eur(-b.debt) : "em dia"}</option>`; }).join("")}</select></label>
      <div class="grid g2">
        <label class="f">Valor recebido (€)<input id="pa" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0,00"></label>
        <label class="f">Data do pagamento<input id="pd" type="date" value="${todayStr()}" max="${todayStr()}"></label>
      </div>
      <div class="row" id="quick" style="gap:6px"></div>
      <label class="f">Método <span class="hint">opcional</span><select id="pmeth"><option value="">—</option><option>Numerário</option><option>MB Way</option><option>Transferência</option><option>Outro</option></select></label>
      <label class="f">Observação <span class="hint">opcional</span><textarea id="pn" maxlength="500"></textarea></label>
      <div id="pinfo"></div>
      <div id="perr" class="err" hidden></div>
      <button class="btn dark block" id="psave" type="submit">Registar pagamento</button>
    </form>`, () => {
    const upd = () => {
      const b = bs.get($("#pm").value); const a = cents($("#pa").value);
      $("#quick").innerHTML = b && b.debt > 0 ? `<button type="button" class="btn sm" id="pall">Saldar tudo (${eur(b.debt)})</button>` : "";
      $("#pall") && ($("#pall").onclick = () => { $("#pa").value = (b.debt / 100).toFixed(2); upd(); });
      needConfirm = !!(b && a > Math.max(b.debt, 0));
      $("#pinfo").innerHTML = !b ? "" : needConfirm ? `<div class="warnbox"><b>O valor é superior à dívida (${eur(Math.max(b.debt, 0))}).</b><br>O excedente de ${eur(a - Math.max(b.debt, 0))} fica como crédito a favor de ${esc(b.m.name)} e é descontado nas próximas multas.
        <label class="row" style="margin-top:8px;font-weight:700"><input type="checkbox" id="pconf"> Confirmo e quero registar o crédito</label></div>`
        : a ? `<div class="okmsg">Depois deste pagamento: ${b.debt - a === 0 ? "fica em dia" : "fica a dever " + eur(b.debt - a)}.</div>` : "";
    };
    if (prefill) { $("#pa").value = prefill.amount; $("#pd").value = prefill.date; $("#pmeth").value = prefill.method || ""; $("#pn").value = prefill.notes || ""; }
    $("#pm").onchange = upd; $("#pa").oninput = upd; upd();
    $("#pay-f").onsubmit = async (e) => {
      e.preventDefault(); if (busy || !guardOnline()) return;
      const err = $("#perr"); err.hidden = true;
      const m = $("#pm").value, a = cents($("#pa").value), d = $("#pd").value;
      const msg = !m ? "Escolhe a atleta." : !(a > 0) ? "Indica um valor maior que zero." : !d ? "Indica a data do pagamento." : d > todayStr() ? "A data do pagamento não pode ser no futuro." : (needConfirm && !$("#pconf")?.checked) ? "Confirma o registo do crédito ou corrige o valor." : "";
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      busy = true; $("#psave").disabled = true; $("#psave").textContent = "A guardar…";
      const { error } = await sb.from("scrg_payments").insert({ member_id: m, amount: (a / 100).toFixed(2), payment_date: d, method: $("#pmeth").value || null, notes: $("#pn").value.trim() || null, credit_confirmed: needConfirm, client_ref: ref });
      if (error && !/client_ref/.test(error.message)) { busy = false; $("#psave").disabled = false; $("#psave").textContent = "Registar pagamento"; err.textContent = friendlyError(error); err.hidden = false; return; }
      closeSheet(); await loadAll(); render();
      toast("Pagamento registado.", { label: "Desfazer", fn: async () => {
        const p = S.payments.find(x => x.client_ref === ref && x.status === "confirmado"); if (!p) return;
        const { error } = await sb.from("scrg_payments").update({ status: "anulado", void_reason: "Desfeito logo após o registo" }).eq("id", p.id);
        if (error) { toast(friendlyError(error)); return; }
        await loadAll(); render(); toast("Pagamento desfeito (fica no histórico como anulado).");
      } });
    };
  });
}

/* ---------- detalhe / anular pagamento ---------- */
function openPayDetail(id) {
  const p = S.payments.find(x => x.id === id); if (!p) return;
  const m = memberById(p.member_id); const can = S.isCap && p.status === "confirmado";
  openSheet("Pagamento", `
    <div class="card stack">
      <div class="row"><b class="sp">${esc(m?.name)}</b><span style="font-family:var(--f-display);font-size:1.8rem;font-weight:800;color:var(--good)">${eur(cents(p.amount))}</span></div>
      <div class="small"><b>Data do pagamento:</b> ${dLong(p.payment_date)}${p.method ? ` · ${esc(p.method)}` : ""}<br>
        <b>Registo:</b> ${dtLong(p.created_at)} por ${esc(nameByUser(p.created_by))}${p.updated_at ? `<br><b>Última alteração:</b> ${dtLong(p.updated_at)} por ${esc(nameByUser(p.updated_by))}` : ""}</div>
      ${p.credit_confirmed ? `<div class="small"><span class="pill credit">Crédito confirmado</span> o valor excedia a dívida na altura do registo.</div>` : ""}
      ${p.notes ? `<div class="small"><b>Observação:</b> ${esc(p.notes)}</div>` : ""}
      ${p.status === "anulado" ? `<div class="warnbox">Anulado: ${esc(p.void_reason)}</div>` : ""}
    </div>
    ${can ? `<div class="stack" style="margin-top:14px"><p class="hint" style="margin:0">Os pagamentos não se apagam nem se alteram. "Corrigir" anula este pagamento e abre um novo já preenchido para acertares o valor. Fica tudo no histórico.</p>
      <label class="f">Motivo<input id="pvr" placeholder="Ex.: valor errado, era 5 €"></label>
      <div class="grid g2"><button class="btn primary" id="pfix">Corrigir</button><button class="btn" id="pvoid" style="color:var(--red)">Só anular</button></div></div>` : ""}`, () => {
    if (!can) return;
    const voidIt = async () => {
      if (!guardOnline()) return false;
      const r = $("#pvr").value.trim(); if (!r) { $("#pvr").focus(); toast("Indica o motivo."); return false; }
      const { error } = await sb.from("scrg_payments").update({ status: "anulado", void_reason: r }).eq("id", p.id);
      if (error) { toast(friendlyError(error)); return false; }
      return true;
    };
    $("#pvoid").onclick = async () => { if (!(await voidIt())) return; closeSheet(); toast("Pagamento anulado e registado no histórico."); await loadAll(); render(); };
    $("#pfix").onclick = async () => {
      if (!(await voidIt())) return; await loadAll(); render();
      openPayForm(p.member_id, { amount: Number(p.amount).toFixed(2), date: p.payment_date, method: p.method, notes: p.notes });
      toast("Pagamento anterior anulado. Regista agora o valor correto.");
    };
  });
}

/* ---------- gerir atleta / convites ---------- */
function blockUi(m) {
  if (m.is_captain || m.user_id === S.me.user_id) return "";
  return `<button class="btn block" id="block1" style="color:var(--red)">Bloquear acesso</button>
    <div id="bconf" class="warnbox stack" hidden><b>Bloquear o acesso de ${esc(m.name)}?</b>
      <span>Deixa de conseguir entrar na app e de ver os dados, a partir de agora. As multas, pagamentos e dívida dela continuam registados. Podes desbloquear mais tarde.</span>
      <label class="f">Motivo <span class="hint">opcional</span><input id="breason" placeholder="Ex.: saiu da equipa"></label>
      <button class="btn primary block" id="block2">Sim, bloquear acesso</button></div>`;
}
function removeUi(m) {
  if (m.is_captain || m.user_id === S.me.user_id) return "";
  const b = balances().find(x => x.m.id === m.id) || { fines: 0, paid: 0, debt: 0 };
  return `<div class="card stack" style="margin-top:14px;border-color:var(--red)"><h3 style="margin:0">Saiu da equipa?</h3>
    <p class="small" style="margin:0">Remove ${esc(m.name)} de todas as contas, listas, gráficos e rankings, como se nunca tivesse estado na equipa. O dinheiro que pagou fica marcado para devolver. As restantes atletas não são afetadas.</p>
    <button class="btn block" id="rm1" style="color:var(--red)">Remover da equipa e devolver o dinheiro</button>
    <div id="rmconf" class="warnbox stack" hidden>
      <b>Confirmar a remoção de ${esc(m.name)}</b>
      <span>Multas registadas: ${eur(b.fines)} · Pagou: ${eur(b.paid)}</span>
      <span><b>A devolver: ${eur(b.paid)}</b>${b.debt > 0 ? ` · Dívida perdoada: ${eur(b.debt)}` : ""}</span>
      <span>O total da equipa passa de ${eur(teamTotals().fines)} para ${eur(teamTotals().fines - b.fines)} em multas e de ${eur(teamTotals().paid)} para ${eur(teamTotals().paid - b.paid)} recebidos. Perde também o acesso à app.</span>
      <label class="f">Motivo <span class="hint">opcional</span><input id="rmreason" placeholder="Ex.: saiu da equipa em outubro"></label>
      <label class="row" style="font-weight:700"><input type="checkbox" id="rmok"> Confirmo e vou devolver ${eur(b.paid)}</label>
      <button class="btn primary block" id="rm2">Remover ${esc(m.name)}</button></div></div>`;
}
function openRemovedDetail(id) {
  const r = memberById(id); if (!r) return;
  const snap = r.removal_snapshot || {};
  const fines = S.archive.fines.filter(f => f.member_id === id), pays = S.archive.payments.filter(p => p.member_id === id);
  openSheet(r.name + " (removida)", `
    <div class="card stack">
      <div class="small"><b>Removida:</b> ${dtLong(r.removed_at)} por ${esc(nameByUser(r.removed_by))}${r.removal_reason ? `<br><b>Motivo:</b> ${esc(r.removal_reason)}` : ""}</div>
      <div class="grid g2"><div><div class="hint">Multas na altura</div><b>${eur(cents(snap.fines_total))}</b></div><div><div class="hint">Tinha pago</div><b>${eur(cents(snap.paid_total))}</b></div>
        <div><div class="hint">A devolver</div><b style="color:var(--warn)">${eur(cents(r.refund_amount))}</b></div><div><div class="hint">Dívida perdoada</div><b>${eur(cents(snap.debt_forgiven))}</b></div></div>
    </div>
    <div class="card" style="margin-top:12px"><h3>Multas <small>${fines.length}</small></h3><div class="list">${fines.map(f => fineRowStatic(f)).join("") || '<div class="empty">Sem multas.</div>'}</div></div>
    <div class="card" style="margin-top:12px"><h3>Pagamentos <small>${pays.length}</small></h3><div class="list">${pays.map(p => `<div class="li"><div class="main"><div class="t">${dLong(p.payment_date)}${p.method ? " · " + esc(p.method) : ""}</div><div class="d">${p.status}</div></div><div class="amt">${eur(cents(p.amount))}</div></div>`).join("") || '<div class="empty">Sem pagamentos.</div>'}</div></div>
    <div class="stack" style="margin-top:14px"><p class="hint" style="margin:0">Removida por engano? Repor volta a pôr todas as multas e pagamentos dela nas contas da equipa.</p>
      <button class="btn block" id="restore">Repor ${esc(r.name)} na equipa</button><div id="rres"></div></div>`, () => {
    $("#restore").onclick = async () => {
      if (!guardOnline()) return;
      const btn = $("#restore"); btn.disabled = true;
      const { data, error } = await sb.functions.invoke("scrg-invite", { body: { action: "restore", member_id: r.id } });
      let msg = data?.error; if (error) { try { msg = (await error.context.json()).error; } catch { msg = friendlyError(error); } }
      btn.disabled = false;
      if (msg) { $("#rres").innerHTML = `<div class="err">${esc(msg)}</div>`; return; }
      closeSheet(); toast(`${r.name} voltou à equipa.`); await loadAll(); render(); loadAdminData();
    };
  });
}
function fineRowStatic(f) {
  const t = typeById(f.fine_type_id);
  return `<div class="li"><div class="main"><div class="t">${esc(t?.name)}</div><div class="d">${numFmt.format(f.quantity)} × ${eur(cents(f.unit_price))} · ${f.occurrence_date ? dShort(f.occurrence_date) : "sem data"}${f.status === "anulada" ? " · anulada" : ""}</div></div><div class="amt">${eur(cents(f.total))}</div></div>`;
}
function openMemberForm(id) {
  const m = id ? memberById(id) : null;
  const acc = m ? adminCache.status.find(x => x.member_id === m.id) : null;
  openSheet(m ? m.name : "Adicionar atleta", `
    <form id="mf" class="stack" novalidate>
      <label class="f">Nome a mostrar<input id="mn" value="${esc(m?.name || "")}" maxlength="40" required></label>
      <label class="f">Nome completo <span class="hint">opcional</span><input id="mfull" value="${esc(m?.full_name || "")}" maxlength="80"></label>
      <label class="f">Função<select id="mk"><option value="atleta" ${m?.kind !== "equipa_tecnica" ? "selected" : ""}>Atleta</option><option value="equipa_tecnica" ${m?.kind === "equipa_tecnica" ? "selected" : ""}>Equipa técnica</option></select></label>
      ${m && !m.is_captain ? `<label class="row"><input type="checkbox" id="ma" ${m.active ? "checked" : ""}> Na equipa (aparece nas listas)</label><span class="hint">Se saiu da equipa e queres que deixe de contar para tudo, usa "Remover da equipa" mais abaixo.</span>` : ""}
      <div id="merr" class="err" hidden></div>
      <button class="btn primary block" type="submit">${m ? "Guardar" : "Adicionar"}</button>
    </form>
    ${m ? `<div class="card stack" style="margin-top:14px"><h3 style="margin:0">Acesso à app</h3>
      ${m.access_blocked ? `<div class="err">Acesso bloqueado${m.blocked_at ? " desde " + dtLong(m.blocked_at) : ""}${acc?.blocked_by ? " por " + esc(nameByUser(acc.blocked_by)) : ""}${acc?.block_reason ? ". Motivo: " + esc(acc.block_reason) : ""}.</div>
        <button class="btn block" id="unblock">Desbloquear acesso</button>`
      : m.user_id ? `<p class="small" style="margin:0">Conta associada a <b>${esc(acc?.email || "")}</b>.</p>
        <button class="btn block" id="relink">Gerar novo link de acesso</button>
        <p class="hint" style="margin:0">Útil se a atleta esqueceu a palavra-passe. O link é pessoal, entra diretamente na conta e pede uma nova palavra-passe.</p>
        ${blockUi(m)}`
      : `<label class="f">Email da atleta<input id="ie" type="email" inputmode="email" autocomplete="off" placeholder="nome@exemplo.pt"></label>
        <button class="btn primary block" id="invite">Criar convite individual</button>
        <p class="hint" style="margin:0">Cria a conta só para este email, com acesso de consulta. Recebes um link para enviar em privado.</p>
        ${blockUi(m)}`}
      <div id="ires"></div></div>${removeUi(m)}` : ""}`, () => {
    $("#mf").onsubmit = async (e) => {
      e.preventDefault();
      const row = { name: $("#mn").value.trim(), full_name: $("#mfull").value.trim() || null, kind: $("#mk").value };
      if (!row.name) { $("#merr").textContent = "Indica o nome."; $("#merr").hidden = false; return; }
      if (m && $("#ma")) row.active = $("#ma").checked; else if (!m) row.sort_order = (Math.max(0, ...S.members.map(x => x.sort_order)) + 10);
      const q = m ? sb.from("scrg_members").update(row).eq("id", m.id) : sb.from("scrg_members").insert(row);
      const { error } = await q;
      if (error) { $("#merr").textContent = /unique|duplicate/i.test(error.message) ? "Já existe alguém com esse nome." : friendlyError(error); $("#merr").hidden = false; return; }
      closeSheet(); toast(m ? "Dados guardados." : "Atleta adicionada."); await loadAll(); render();
    };
    const showLink = (data) => {
      const link = `${location.origin}${location.pathname}?acesso=${encodeURIComponent(data.token_hash)}&t=${data.type === "invite" ? "i" : "m"}`;
      $("#ires").innerHTML = `<div class="okmsg">Link criado para ${esc(data.member)}. Envia-o só a ela. Funciona uma única vez.</div>
        <div class="linkbox" id="lnk">${esc(link)}</div><button class="btn block" id="cp">Copiar link</button>`;
      $("#cp").onclick = async () => { try { await navigator.clipboard.writeText(link); toast("Link copiado."); } catch { const r = document.createRange(); r.selectNodeContents($("#lnk")); getSelection().removeAllRanges(); getSelection().addRange(r); toast("Seleciona e copia o link."); } };
    };
    const call = async (body, btn) => {
      btn.disabled = true; const old = btn.textContent; btn.textContent = "A criar…";
      const { data, error } = await sb.functions.invoke("scrg-invite", { body });
      btn.disabled = false; btn.textContent = old;
      let msg = data?.error; if (error) { try { msg = (await error.context.json()).error; } catch { msg = friendlyError(error); } }
      if (msg) { $("#ires").innerHTML = `<div class="err">${esc(msg)}</div>`; return; }
      showLink(data); loadAll().then(() => loadAdminData());
    };
    $("#invite") && ($("#invite").onclick = () => { const em = $("#ie").value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { $("#ires").innerHTML = '<div class="err">Indica um email válido.</div>'; return; } call({ action: "invite", member_id: m.id, email: em }, $("#invite")); });
    $("#relink") && ($("#relink").onclick = () => call({ action: "relink", member_id: m.id }, $("#relink")));
    const doBlock = async (action, btn) => {
      btn.disabled = true;
      const { data, error } = await sb.functions.invoke("scrg-invite", { body: { action, member_id: m.id, reason: $("#breason")?.value.trim() || null } });
      let msg = data?.error; if (error) { try { msg = (await error.context.json()).error; } catch { msg = friendlyError(error); } }
      btn.disabled = false;
      if (msg) { $("#ires").innerHTML = `<div class="err">${esc(msg)}</div>`; return; }
      closeSheet(); toast(action === "block" ? `Acesso de ${m.name} bloqueado.` : `Acesso de ${m.name} reposto.`); await loadAll(); render(); loadAdminData();
    };
    $("#block1") && ($("#block1").onclick = () => { $("#bconf").hidden = false; $("#block1").hidden = true; });
    $("#block2") && ($("#block2").onclick = () => doBlock("block", $("#block2")));
    $("#unblock") && ($("#unblock").onclick = () => doBlock("unblock", $("#unblock")));
    $("#rm1") && ($("#rm1").onclick = () => { $("#rmconf").hidden = false; $("#rm1").hidden = true; });
    $("#rm2") && ($("#rm2").onclick = async () => {
      if (!guardOnline()) return;
      if (!$("#rmok").checked) { toast("Marca a confirmação primeiro."); return; }
      const btn = $("#rm2"); btn.disabled = true; btn.textContent = "A remover…";
      const { data, error } = await sb.functions.invoke("scrg-invite", { body: { action: "remove", member_id: m.id, reason: $("#rmreason").value.trim() || null } });
      let msg = data?.error; if (error) { try { msg = (await error.context.json()).error; } catch { msg = friendlyError(error); } }
      if (msg) { btn.disabled = false; btn.textContent = `Remover ${m.name}`; $("#ires").innerHTML = `<div class="err">${esc(msg)}</div>`; return; }
      closeSheet(); toast(`${m.name} removida. Devolver ${eur(cents(data.refund))}.`); await loadAll(); render(); loadAdminData();
    });
  });
}

/* ---------- tipos de multa ---------- */
function openTypeForm(id) {
  const t = id ? typeById(id) : null;
  openSheet(t ? "Editar tipo de multa" : "Novo tipo de multa", `
    <form id="tf" class="stack" novalidate>
      <label class="f">Categoria<input id="tc" list="cats" value="${esc(t?.category || "")}" required><datalist id="cats">${catList().map(c => `<option value="${esc(c)}">`).join("")}</datalist></label>
      <label class="f">Nome<input id="tn" value="${esc(t?.name || "")}" required></label>
      <label class="f">Preço unitário (€)<input id="tp" type="number" min="0" step="0.01" inputmode="decimal" value="${t ? Number(t.unit_price).toFixed(2) : ""}" required></label>
      ${t ? `<label class="row"><input type="checkbox" id="tact" ${t.active ? "checked" : ""}> Disponível para novas multas</label>` : ""}
      <div id="terr" class="err" hidden></div>
      <button class="btn primary block" type="submit">Guardar</button>
    </form>`, () => {
    $("#tf").onsubmit = async (e) => {
      e.preventDefault();
      const row = { category: $("#tc").value.trim(), name: $("#tn").value.trim(), unit_price: (cents($("#tp").value) / 100).toFixed(2) };
      if (!row.category || !row.name || $("#tp").value === "" || cents($("#tp").value) < 0) { $("#terr").textContent = "Preenche categoria, nome e preço."; $("#terr").hidden = false; return; }
      if (t) row.active = $("#tact").checked; else row.sort_order = Math.max(0, ...S.types.map(x => x.sort_order)) + 10;
      const { error } = t ? await sb.from("scrg_fine_types").update(row).eq("id", t.id) : await sb.from("scrg_fine_types").insert(row);
      if (error) { $("#terr").textContent = /unique|duplicate/i.test(error.message) ? "Já existe um tipo com esse nome." : friendlyError(error); $("#terr").hidden = false; return; }
      closeSheet(); toast("Tipo de multa guardado."); await loadAll(); render();
    };
  });
}

/* ================= AUTENTICAÇÃO ================= */
function authShell(inner) {
  return `<div class="auth"><div class="auth-hero"><img src="${LOGO}" alt="Emblema SCRG"><h1>MULTAS SCRG 26/27</h1><p>Futsal feminino · caixa da equipa</p></div>
    <div class="auth-body"><div class="card stack">${inner}</div></div></div>`;
}
function screenLogin(msg = "") {
  $("#app").innerHTML = authShell(`
    <h3 style="font-size:1.5rem;text-transform:uppercase">Entrar</h3>
    <form id="lf" class="stack" novalidate>
      <label class="f">Email<input id="le" type="email" autocomplete="username" inputmode="email" required></label>
      <label class="f">Palavra-passe<input id="lp" type="password" autocomplete="current-password" required></label>
      <div id="lerr" class="err" ${msg ? "" : "hidden"}>${esc(msg)}</div>
      <button class="btn primary block" type="submit" id="lb">Entrar</button>
    </form>
    <p class="hint" style="margin:0">Acesso apenas por convite das capitãs. Esqueceste a palavra-passe? Pede a uma capitã um novo link de acesso.</p>
    <button class="btn ghost sm" id="boot">Sou capitã e tenho um código de ativação</button>`);
  $("#lf").onsubmit = async (e) => {
    e.preventDefault(); $("#lb").disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: $("#le").value.trim(), password: $("#lp").value });
    $("#lb").disabled = false;
    if (error) { $("#lerr").textContent = friendlyError(error); $("#lerr").hidden = false; return; }
    boot();
  };
  $("#boot").onclick = screenBootstrap;
}
function screenBootstrap() {
  $("#app").innerHTML = authShell(`
    <h3 style="font-size:1.5rem;text-transform:uppercase">Ativar conta de capitã</h3>
    <form id="bf" class="stack" novalidate>
      <label class="f">O teu email<input id="be" type="email" inputmode="email" required></label>
      <label class="f">Código de ativação<input id="bc" autocomplete="one-time-code" style="text-transform:uppercase" required></label>
      <div id="berr" class="err" hidden></div>
      <button class="btn primary block" id="bb" type="submit">Ativar</button>
    </form><button class="btn ghost sm" id="back">← Voltar</button>`);
  $("#back").onclick = () => screenLogin();
  $("#bf").onsubmit = async (e) => {
    e.preventDefault(); $("#bb").disabled = true;
    const { data, error } = await sb.functions.invoke("scrg-invite", { body: { action: "bootstrap", email: $("#be").value.trim(), code: $("#bc").value.trim() } });
    let msg = data?.error; if (error) { try { msg = (await error.context.json()).error; } catch { msg = friendlyError(error); } }
    if (msg) { $("#bb").disabled = false; $("#berr").textContent = msg; $("#berr").hidden = false; return; }
    const v = await sb.auth.verifyOtp({ token_hash: data.token_hash, type: data.type === "invite" ? "invite" : "email" });
    if (v.error) { $("#bb").disabled = false; $("#berr").textContent = friendlyError(v.error); $("#berr").hidden = false; return; }
    screenSetPassword(true);
  };
}
function screenSetPassword(first) {
  $("#app").innerHTML = authShell(`
    <h3 style="font-size:1.5rem;text-transform:uppercase">${first ? "Bem-vinda!" : "Nova palavra-passe"}</h3>
    <p class="small muted" style="margin:0">Define a tua palavra-passe para entrares nas próximas vezes.</p>
    <form id="pf" class="stack" novalidate>
      <label class="f">Palavra-passe <span class="hint">mínimo 8 caracteres</span><input id="p1" type="password" autocomplete="new-password" minlength="8" required></label>
      <label class="f">Repetir palavra-passe<input id="p2" type="password" autocomplete="new-password" required></label>
      <div id="perr2" class="err" hidden></div>
      <button class="btn primary block" type="submit" id="pb">Guardar e entrar</button>
    </form>`);
  $("#pf").onsubmit = async (e) => {
    e.preventDefault();
    const a = $("#p1").value, b = $("#p2").value; const err = $("#perr2");
    if (a.length < 8) { err.textContent = "A palavra-passe tem de ter pelo menos 8 caracteres."; err.hidden = false; return; }
    if (a !== b) { err.textContent = "As palavras-passe não coincidem."; err.hidden = false; return; }
    $("#pb").disabled = true;
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) { $("#pb").disabled = false; err.textContent = friendlyError(error); err.hidden = false; return; }
    boot();
  };
}
async function handleAccessLink() {
  const p = new URLSearchParams(location.search); const tok = p.get("acesso"); if (!tok) return false;
  const { data: { session: cur } } = await sb.auth.getSession();
  if (cur && !handleAccessLink._ok) {
    $("#app").innerHTML = authShell(`<h3 style="font-size:1.4rem;text-transform:uppercase">Link de acesso</h3>
      <p class="small" style="margin:0">Já tens uma sessão aberta neste telemóvel. Este link é pessoal: só continua se ele foi enviado para ti. Ao continuar, a sessão atual termina.</p>
      <button class="btn primary block" id="lk-go">Continuar com este link</button><button class="btn block" id="lk-no">Cancelar e manter a minha sessão</button>`);
    $("#lk-no").onclick = () => { history.replaceState(null, "", location.pathname + location.hash); boot(); };
    $("#lk-go").onclick = () => { handleAccessLink._ok = true; handleAccessLink(); };
    return true;
  }
  history.replaceState(null, "", location.pathname + location.hash);
  clearCache();
  await sb.auth.signOut({ scope: "local" });
  const { error } = await sb.auth.verifyOtp({ token_hash: tok, type: p.get("t") === "i" ? "invite" : "email" });
  if (error) { screenLogin("Este link já foi usado ou expirou. Pede um novo link a uma capitã."); return true; }
  screenSetPassword(p.get("t") === "i"); return true;
}
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return screenLogin();
  S.session = session;
  const cache = readCache(session.user.id);
  const { data: me, error } = await sb.from("scrg_members").select(MEMBER_COLS).eq("user_id", session.user.id).eq("active", true).maybeSingle();
  const netFail = error && (/Failed to fetch|NetworkError|network/i.test(error.message || "") || !navigator.onLine);
  if (netFail && cache) {
    Object.assign(S, { members: cache.members, allMembers: cache.allMembers || cache.members, removed: [], archive: { fines: [], payments: [] }, types: cache.types, fines: cache.fines, payments: cache.payments, notes: cache.notes || [], offline: true, cachedAt: cache.at });
    const m = S.members.find(x => x.user_id === session.user.id); if (!m) return screenLogin("Sem ligação à internet.");
    S.me = m; S.isCap = !!m.is_captain;
  } else {
    if (netFail) return screenLogin("Sem ligação à internet. Tenta novamente quando tiveres rede.");
    if (error || !me) { clearCache(); await sb.auth.signOut(); return screenLogin("Esta conta não tem acesso à equipa. Fala com uma capitã."); }
    S.me = me; S.isCap = !!me.is_captain;
    $("#app").innerHTML = authShell('<div class="empty">A carregar as contas da equipa…</div>');
    try { await loadAll(); } catch (e) {
      if (cache) Object.assign(S, { members: cache.members, allMembers: cache.allMembers || cache.members, removed: [], archive: { fines: [], payments: [] }, types: cache.types, fines: cache.fines, payments: cache.payments, notes: cache.notes || [], offline: true, cachedAt: cache.at });
      else return screenLogin(friendlyError(e));
    }
  }
  const h = location.hash.slice(1);
  if (h.startsWith("atleta-")) { S.view = "perfil"; S.memberId = h.slice(7); } else if (NAV.some(n => n[0] === h)) S.view = h;
  subscribeRealtime();
  render();
}
sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && S.me) { S.me = null; screenLogin(); } });
(async () => { if (await handleAccessLink()) return; boot(); })();
