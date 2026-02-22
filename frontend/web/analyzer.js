const currentUserEl = document.getElementById("analyzerCurrentUser");
const refreshGamesEl = document.getElementById("analyzerRefreshGames");
const gamesBodyEl = document.getElementById("analyzerGamesBody");
const prevPageEl = document.getElementById("analyzerPrevPage");
const nextPageEl = document.getElementById("analyzerNextPage");
const pageInfoEl = document.getElementById("analyzerPageInfo");

const summaryEl = document.getElementById("analyzerSummary");
const playerTabsEl = document.getElementById("analyzerPlayerTabs");
const playerPanelEl = document.getElementById("analyzerPlayerPanel");

const vizTabsEl = document.getElementById("analyzerVizTabs");
const tabContentEl = document.getElementById("analyzerTabContent");
const eventInspectorEl = document.getElementById("analyzerEventInspector");

const state = {
  games: [],
  page: 1,
  pageSize: 10,
  total: 0,
  selectedGameId: 0,
  selectedGame: null,
  selectedDetail: null,
  selectedPlayer: "",
  activeTab: "apm",
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCurrentUser() {
  return String(localStorage.getItem("stareplays_current_user") || "").trim();
}

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function fmtGameTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function getGameLength(game) {
  const n = Number(game?.game_length || game?.gameLength || 0);
  return Number.isFinite(n) ? n : 0;
}

function raceLetter(race) {
  const r = String(race || "").toLowerCase();
  if (r.startsWith("terran")) return "T";
  if (r.startsWith("zerg")) return "Z";
  if (r.startsWith("protoss")) return "P";
  return "U";
}

function reliabilityText(game) {
  const upload = Number(game?.upload_count || 0);
  const players = Number(game?.player_count || 0);
  if (players <= 0) return "0%";
  return `${Math.round((upload / players) * 100)}%`;
}

function computeMatchup(players) {
  const byTeam = new Map();
  for (const p of players || []) {
    const t = Number(p.team || 0);
    if (!byTeam.has(t)) byTeam.set(t, []);
    byTeam.get(t).push(p);
  }
  const teams = Array.from(byTeam.keys()).sort((a, b) => a - b);
  return teams.map((t) => (byTeam.get(t) || []).map((p) => raceLetter(p.race)).join("")).join(" vs ");
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

function renderCurrentUser() {
  const user = getCurrentUser();
  currentUserEl.innerHTML = user
    ? `CURRENT_USER: <span class="session-user-chip">${escapeHtml(user)}</span>`
    : "CURRENT_USER: NOT_LOGGED_IN";
}

function renderPager() {
  const totalPages = Math.max(1, Math.ceil(Number(state.total || 0) / Number(state.pageSize || 10)));
  pageInfoEl.textContent = `Page ${state.page}/${totalPages}`;
  prevPageEl.disabled = state.page <= 1;
  nextPageEl.disabled = state.page >= totalPages;
}

function renderGames() {
  gamesBodyEl.innerHTML = "";
  if (!state.games.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="p-2 text-center text-[#4A4F59]">NO_GAMES</td>`;
    gamesBodyEl.appendChild(tr);
    return;
  }

  for (const g of state.games) {
    const tr = document.createElement("tr");
    tr.className = "border-b border-[#2D3139]/30 cursor-pointer";
    if (Number(g.id) === Number(state.selectedGameId)) tr.classList.add("bg-white/40");
    tr.innerHTML = `
      <td class="p-2 border-r border-[#2D3139]/30">#${Number(g.id)}</td>
      <td class="p-2 border-r border-[#2D3139]/30 uppercase truncate">${escapeHtml(g.map_name || "-")}</td>
      <td class="p-2 border-r border-[#2D3139]/30 text-right">${fmtGameTime(getGameLength(g))}</td>
      <td class="p-2 text-right text-[#4A4F59]">${escapeHtml(fmtDate(g.start_time))}</td>
    `;
    tr.addEventListener("click", () => selectGame(Number(g.id)));
    gamesBodyEl.appendChild(tr);
  }
}

function renderSummary() {
  const g = state.selectedGame;
  const players = (g && g.edges && Array.isArray(g.edges.players)) ? g.edges.players : [];
  if (!g) {
    summaryEl.innerHTML = `<div class="border border-[#2D3139] bg-white/60 p-2 col-span-4">SELECT_GAME_FIRST</div>`;
    return;
  }
  const winner = Number(g.winner_team || 0);
  const invalid = getGameLength(g) > 0 && getGameLength(g) <= 120;
  const winnerText = invalid ? "INVALID" : (winner > 0 ? `TEAM ${winner}` : "DRAW");
  const matchup = computeMatchup(players);
  summaryEl.innerHTML = `
    <div class="border border-[#2D3139] bg-white/60 p-2">MAP: ${escapeHtml(g.map_name || "-")}</div>
    <div class="border border-[#2D3139] bg-white/60 p-2">PLAY_TIME: ${fmtGameTime(getGameLength(g))}</div>
    <div class="border border-[#2D3139] bg-white/60 p-2">WINNER: ${winnerText}</div>
    <div class="border border-[#2D3139] bg-white/60 p-2">RELIABILITY: ${reliabilityText(g)}</div>
    <div class="border border-[#2D3139] bg-white/60 p-2">START: ${escapeHtml(fmtDate(g.start_time))}</div>
    <div class="border border-[#2D3139] bg-white/60 p-2">MATCHUP: ${escapeHtml(matchup || "-")}</div>
    <div class="border border-[#2D3139] bg-white/60 p-2">PLAYER_COUNT: ${Number(g.player_count || 0)}</div>
    <div class="border border-[#2D3139] bg-white/60 p-2">UPLOAD: ${Number(g.upload_count || 0)}</div>
  `;
}

function renderPlayerTabs() {
  const players = (state.selectedGame?.edges?.players || []);
  playerTabsEl.innerHTML = "";
  for (const p of players) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "border border-[#2D3139] px-2 py-1 bg-white/60 hover:bg-white/90";
    if (String(p.name) === String(state.selectedPlayer)) {
      btn.className = "border border-[#2D3139] px-2 py-1 bg-[#2D3139] text-[#E0E0E2]";
    }
    btn.textContent = p.name;
    btn.addEventListener("click", () => {
      state.selectedPlayer = p.name;
      renderPlayerTabs();
      renderPlayerPanel();
      renderTab();
      renderEventInspector();
    });
    playerTabsEl.appendChild(btn);
  }
}

function renderPlayerPanel() {
  const players = (state.selectedGame?.edges?.players || []);
  const p = players.find((x) => String(x.name) === String(state.selectedPlayer));
  if (!p) {
    playerPanelEl.innerHTML = "<div class='text-[#4A4F59]'>NO_PLAYER_SELECTED</div>";
    return;
  }
  const cmd = Number(p.cmd_count || 0);
  const eff = Number(p.effective_cmd_count || 0);
  const effPct = cmd > 0 ? ((eff / cmd) * 100).toFixed(1) : "0.0";
  playerPanelEl.innerHTML = `
    <div class="grid grid-cols-2 gap-2">
      <div class="border border-[#2D3139] bg-white/60 p-2">NAME: ${escapeHtml(p.name)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">RACE: ${escapeHtml(raceLetter(p.race))}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">TEAM: ${Number(p.team || 0)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">RESULT: ${escapeHtml(p.result || "unknown")}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">APM/EAPM: ${Number(p.apm || 0)} / ${Number(p.eapm || 0)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">EFFECTIVE: ${effPct}%</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">CMD: ${cmd}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">REDUNDANCY: ${Number(p.redundancy || 0)}%</div>
    </div>
  `;
}

function tableFromRows(headers, rows) {
  const head = headers.map((h) => `<th class="p-2 border-r border-[#2D3139]/30 last:border-r-0">${escapeHtml(h)}</th>`).join("");
  const body = rows.length ? rows.map((r) => `<tr class="border-b border-[#2D3139]/20">${r.map((c) => `<td class="p-2 border-r border-[#2D3139]/20 last:border-r-0">${escapeHtml(c)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" class="p-2 text-[#4A4F59]">NO_DATA</td></tr>`;
  return `<div class="overflow-x-auto"><table class="w-full border-collapse"><thead><tr class="bg-[#D1D1D4] text-[10px] uppercase">${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderTab() {
  const d = state.selectedDetail || {};
  const selected = String(state.selectedPlayer || "").trim();

  if (state.activeTab === "apm") {
    const rows = (d.detail?.apm_timeline || []).map((tl) => {
      const points = Array.isArray(tl.data_points) ? tl.data_points : [];
      const apms = points.map((p) => Number(p.apm || 0));
      const avg = apms.length ? (apms.reduce((a, b) => a + b, 0) / apms.length).toFixed(1) : "0.0";
      const max = apms.length ? Math.max(...apms).toFixed(1) : "0.0";
      return [tl.player_name || "-", String(points.length), String(avg), String(max)];
    });
    tabContentEl.innerHTML = tableFromRows(["PLAYER", "POINTS", "AVG_APM", "MAX_APM"], rows);
    return;
  }

  if (state.activeTab === "spend") {
    let rows = (d.resource_spend?.summaries || []).map((s) => [s.player_name || "-", String(Number(s.total_mineral || 0)), String(Number(s.total_gas || 0)), String(Number(s.total_spend || 0))]);
    if (selected) rows = rows.filter((r) => String(r[0]) === selected);
    tabContentEl.innerHTML = tableFromRows(["PLAYER", "MINERAL", "GAS", "TOTAL"], rows);
    return;
  }

  if (state.activeTab === "unit") {
    let rows = (d.unit_production?.summaries || []).map((s) => [s.player_name || "-", String(Number(s.total || 0)), String(Number(s.worker || 0)), String(Number(s.army || 0)), String(Number(s.tech_unit || 0))]);
    if (selected) rows = rows.filter((r) => String(r[0]) === selected);
    tabContentEl.innerHTML = tableFromRows(["PLAYER", "TOTAL", "WORKER", "ARMY", "TECH"], rows);
    return;
  }

  if (state.activeTab === "tech") {
    let rows = (d.tech_tree?.summary || []).map((s) => [s.player_name || "-", String(Number(s.tech_count || 0)), String(Number(s.upgrade_count || 0)), String(Number(s.prereq_build_count || 0)), String(Number(s.cancel_count || 0)), String(Number(s.ineff_count || 0))]);
    if (selected) rows = rows.filter((r) => String(r[0]) === selected);
    tabContentEl.innerHTML = tableFromRows(["PLAYER", "TECH", "UPG", "PREREQ", "CANCEL", "INEFF"], rows);
    return;
  }

  if (state.activeTab === "battle") {
    const rows = (state.selectedGame?.edges?.players || []).map((p) => [p.name || "-", String(Number(p.cmd_count || 0)), String(Number(p.effective_cmd_count || 0)), String(Number(p.redundancy || 0))]);
    tabContentEl.innerHTML = tableFromRows(["PLAYER", "CMD", "ECMD", "REDUNDANCY%"], rows);
    return;
  }

  const rows = (state.selectedGame?.edges?.players || []).map((p) => {
    const cmd = Number(p.cmd_count || 0);
    const eff = Number(p.effective_cmd_count || 0);
    const effPct = cmd > 0 ? ((eff / cmd) * 100).toFixed(1) : "0.0";
    return [p.name || "-", String(Number(p.apm || 0)), String(Number(p.eapm || 0)), `${effPct}%`];
  });
  tabContentEl.innerHTML = tableFromRows(["PLAYER", "APM", "EAPM", "EFFECTIVE"], rows);
}

function renderEventInspector() {
  const selected = String(state.selectedPlayer || "").trim().toLowerCase();
  const events = (state.selectedDetail?.tech_tree?.events || []).filter((e) => {
    if (!selected) return true;
    return String(e.player_name || "").trim().toLowerCase() === selected;
  }).slice(0, 25);

  if (!events.length) {
    eventInspectorEl.innerHTML = "<div class='text-[#4A4F59]'>NO_TECH_EVENTS</div>";
    return;
  }

  const rows = events.map((e) => [
    String(e.player_name || "-"),
    String(e.kind || "-"),
    String(e.name || "-"),
    `F:${Number(e.frame || 0)} (${Number(e.second || 0).toFixed(1)}s)`,
    String(e.quality || "-")
  ]);
  eventInspectorEl.innerHTML = tableFromRows(["PLAYER", "TYPE", "NAME", "TIME", "QUALITY"], rows);
}

async function selectGame(id) {
  state.selectedGameId = Number(id);
  renderGames();

  tabContentEl.innerHTML = "<div class='text-[#4A4F59]'>LOADING_GAME_DETAIL...</div>";
  try {
    const [gRes, dRes] = await Promise.all([
      api(`/api/v1/games/${id}`),
      api(`/api/v1/games/${id}/detail`),
    ]);
    state.selectedGame = gRes.game || null;
    state.selectedDetail = dRes || null;

    const players = state.selectedGame?.edges?.players || [];
    if (!players.some((p) => p.name === state.selectedPlayer)) {
      state.selectedPlayer = players[0]?.name || "";
    }

    const url = new URL(window.location.href);
    url.searchParams.set("game_id", String(id));
    window.history.replaceState({}, "", url.toString());

    renderSummary();
    renderPlayerTabs();
    renderPlayerPanel();
    renderTab();
    renderEventInspector();
  } catch (err) {
    summaryEl.innerHTML = `<div class='border border-[#8a2f2f] bg-[#f2d9d9] p-2 col-span-4'>ERROR_LOAD_GAME: ${escapeHtml(err.message)}</div>`;
    playerTabsEl.innerHTML = "";
    playerPanelEl.innerHTML = "";
    tabContentEl.innerHTML = "";
    eventInspectorEl.innerHTML = "";
  }
}

async function loadGames() {
  const user = getCurrentUser();
  const offset = (state.page - 1) * state.pageSize;
  const q = user ? `&user_name=${encodeURIComponent(user)}` : "";
  const data = await api(`/api/v1/games?limit=${state.pageSize}&offset=${offset}${q}`);
  state.games = Array.isArray(data.games) ? data.games : [];
  state.total = Number(data.total || 0);
  renderGames();
  renderPager();

  const url = new URL(window.location.href);
  const gid = Number(url.searchParams.get("game_id") || 0);
  if (gid > 0 && Number(state.selectedGameId || 0) !== gid) {
    selectGame(gid);
    return;
  }
  if (state.games.length && !state.selectedGameId) {
    selectGame(Number(state.games[0].id));
    return;
  }
  if (!state.games.length) {
    summaryEl.innerHTML = `<div class="border border-[#2D3139] bg-white/60 p-2 col-span-4">NO_GAMES_FOR_ANALYZER</div>`;
    playerTabsEl.innerHTML = "";
    playerPanelEl.innerHTML = "";
    tabContentEl.innerHTML = "";
    eventInspectorEl.innerHTML = "";
  }
}

function bindTabs() {
  vizTabsEl.querySelectorAll("[data-an-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.getAttribute("data-an-tab") || "apm";
      vizTabsEl.querySelectorAll("[data-an-tab]").forEach((b) => {
        if (b === btn) {
          b.classList.add("bg-[#2D3139]", "text-[#E0E0E2]");
          b.classList.remove("bg-white/60");
        } else {
          b.classList.remove("bg-[#2D3139]", "text-[#E0E0E2]");
          b.classList.add("bg-white/60");
        }
      });
      renderTab();
    });
  });
}

refreshGamesEl.addEventListener("click", () => loadGames());
prevPageEl.addEventListener("click", () => {
  if (state.page <= 1) return;
  state.page -= 1;
  loadGames();
});
nextPageEl.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(Number(state.total || 0) / Number(state.pageSize || 10)));
  if (state.page >= totalPages) return;
  state.page += 1;
  loadGames();
});

renderCurrentUser();
bindTabs();
loadGames();
