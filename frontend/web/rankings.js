const rankingsTableBodyEl = document.getElementById("rankingsTableBody");
const refreshRankingsEl = document.getElementById("refreshRankings");
const rankingsCurrentUserEl = document.getElementById("rankingsCurrentUser");
const tabRankings3v3El = document.getElementById("tabRankings3v3");
const tabRaceCompEl = document.getElementById("tabRaceComp");
const rankingsPanelEl = document.getElementById("rankingsPanel");
const raceCompPanelEl = document.getElementById("raceCompPanel");
const rankSortWinRateEl = document.getElementById("rankSortWinRate");
const rankSortAvgApmEl = document.getElementById("rankSortAvgApm");
const rankSortAvgEapmEl = document.getElementById("rankSortAvgEapm");
const rankSortWinRateArrowEl = document.getElementById("rankSortWinRateArrow");
const rankSortAvgApmArrowEl = document.getElementById("rankSortAvgApmArrow");
const rankSortAvgEapmArrowEl = document.getElementById("rankSortAvgEapmArrow");
const raceCompTableBodyEl = document.getElementById("raceCompTableBody");
const raceCompMetaEl = document.getElementById("raceCompMeta");
const refreshRaceCompEl = document.getElementById("refreshRaceComp");
const raceSortGamesEl = document.getElementById("raceSortGames");
const raceSortWinRateEl = document.getElementById("raceSortWinRate");
const raceSortGamesArrowEl = document.getElementById("raceSortGamesArrow");
const raceSortWinRateArrowEl = document.getElementById("raceSortWinRateArrow");

const state = {
  rankings: [],
  sortBy: "win_rate",
  sortDesc: true,
  activeTab: "rankings3v3",
  raceRows: [],
  raceSortBy: "games",
  raceSortDesc: true,
};

function getCurrentUser() {
  return String(localStorage.getItem("stareplays_current_user") || "").trim();
}

function renderCurrentUser() {
  const current = getCurrentUser();
  if (!rankingsCurrentUserEl) return;
  rankingsCurrentUserEl.innerHTML = current
    ? `CURRENT_USER: <span class="session-user-chip">${escapeHtml(current)}</span>`
    : "CURRENT_USER: NOT_LOGGED_IN";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

function activateTab(tab) {
  state.activeTab = tab === "race_comp" ? "race_comp" : "rankings3v3";
  if (rankingsPanelEl) rankingsPanelEl.classList.toggle("hidden", state.activeTab !== "rankings3v3");
  if (raceCompPanelEl) raceCompPanelEl.classList.toggle("hidden", state.activeTab !== "race_comp");

  if (tabRankings3v3El) {
    tabRankings3v3El.classList.toggle("bg-[#2D3139]", state.activeTab === "rankings3v3");
    tabRankings3v3El.classList.toggle("text-[#E0E0E2]", state.activeTab === "rankings3v3");
    tabRankings3v3El.classList.toggle("bg-white/60", state.activeTab !== "rankings3v3");
  }
  if (tabRaceCompEl) {
    tabRaceCompEl.classList.toggle("bg-[#2D3139]", state.activeTab === "race_comp");
    tabRaceCompEl.classList.toggle("text-[#E0E0E2]", state.activeTab === "race_comp");
    tabRaceCompEl.classList.toggle("bg-white/60", state.activeTab !== "race_comp");
  }
}

function renderRankingsTable(rankings) {
  if (!rankingsTableBodyEl) return;
  rankingsTableBodyEl.innerHTML = "";
  if (!Array.isArray(rankings) || rankings.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="p-3 text-center text-[11px] text-[#4A4F59]">NO_3V3_RANKINGS</td>`;
    rankingsTableBodyEl.appendChild(tr);
    return;
  }

  const current = getCurrentUser().toLowerCase();
  for (const row of rankings) {
    const name = String(row.name || "-");
    const isCurrent = current && name.trim().toLowerCase() === current;
    const tr = document.createElement("tr");
    tr.className = `border-b border-[#2D3139]/30 ${isCurrent ? "bg-white/40" : ""}`;
    tr.innerHTML = `
      <td class="p-3 border-r border-[#2D3139]/30">#${Number(row.rank || 0)}</td>
      <td class="p-3 border-r border-[#2D3139]/30">${escapeHtml(name)}${isCurrent ? ' <span class="you-chip">YOU</span>' : ""}</td>
      <td class="p-3 border-r border-[#2D3139]/30 text-right">${Number(row.win_rate || 0).toFixed(1)}%</td>
      <td class="p-3 border-r border-[#2D3139]/30 text-right">${Number(row.wins || 0)}-${Number(row.losses || 0)}-${Number(row.draws || 0)}</td>
      <td class="p-3 border-r border-[#2D3139]/30 text-right">${Number(row.games || 0)}</td>
      <td class="p-3 border-r border-[#2D3139]/30 text-right">${Number(row.avg_apm || 0).toFixed(1)}</td>
      <td class="p-3 text-right">${Number(row.avg_eapm || 0).toFixed(1)}</td>
    `;
    rankingsTableBodyEl.appendChild(tr);
  }
}

function updateRankingSortArrows() {
  if (!rankSortWinRateArrowEl || !rankSortAvgApmArrowEl || !rankSortAvgEapmArrowEl) return;
  rankSortWinRateArrowEl.textContent = state.sortBy === "win_rate" ? (state.sortDesc ? "▼" : "▲") : "↕";
  rankSortAvgApmArrowEl.textContent = state.sortBy === "avg_apm" ? (state.sortDesc ? "▼" : "▲") : "↕";
  rankSortAvgEapmArrowEl.textContent = state.sortBy === "avg_eapm" ? (state.sortDesc ? "▼" : "▲") : "↕";
}

function applyRankingSort(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  const dir = state.sortDesc ? -1 : 1;
  list.sort((a, b) => {
    if (state.sortBy === "avg_apm") {
      const diff = (Number(a.avg_apm || 0) - Number(b.avg_apm || 0)) * dir;
      if (diff !== 0) return diff;
    } else if (state.sortBy === "avg_eapm") {
      const diff = (Number(a.avg_eapm || 0) - Number(b.avg_eapm || 0)) * dir;
      if (diff !== 0) return diff;
    } else {
      const diff = (Number(a.win_rate || 0) - Number(b.win_rate || 0)) * dir;
      if (diff !== 0) return diff;
      const winsDiff = (Number(a.wins || 0) - Number(b.wins || 0)) * dir;
      if (winsDiff !== 0) return winsDiff;
      const gamesDiff = (Number(a.games || 0) - Number(b.games || 0)) * dir;
      if (gamesDiff !== 0) return gamesDiff;
    }
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
  return list.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

function raceBadgeClass(letter) {
  if (letter === "T") return "race-t";
  if (letter === "Z") return "race-z";
  if (letter === "P") return "race-p";
  return "";
}

function renderRaceCompositionBadges(comp) {
  const letters = String(comp || "").trim().toUpperCase().split("").filter(Boolean);
  if (!letters.length) return '<span class="text-[#4A4F59]">-</span>';
  return letters.map((ch) => `<span class="race-badge ${raceBadgeClass(ch)}">${escapeHtml(ch)}</span>`).join("");
}

function applyRaceSort(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  const dir = state.raceSortDesc ? -1 : 1;
  list.sort((a, b) => {
    if (state.raceSortBy === "team_a_win_rate") {
      const diff = (Number(a.team_a_win_rate || 0) - Number(b.team_a_win_rate || 0)) * dir;
      if (diff !== 0) return diff;
      const gamesDiff = (Number(a.games || 0) - Number(b.games || 0)) * dir;
      if (gamesDiff !== 0) return gamesDiff;
    } else {
      const diff = (Number(a.games || 0) - Number(b.games || 0)) * dir;
      if (diff !== 0) return diff;
      const wrDiff = (Number(a.team_a_win_rate || 0) - Number(b.team_a_win_rate || 0)) * dir;
      if (wrDiff !== 0) return wrDiff;
    }
    return String(a.matchup || a.matchup_key || "").localeCompare(String(b.matchup || b.matchup_key || ""));
  });
  return list;
}

function updateRaceSortArrows() {
  if (raceSortGamesArrowEl) raceSortGamesArrowEl.textContent = state.raceSortBy === "games" ? (state.raceSortDesc ? "▼" : "▲") : "↕";
  if (raceSortWinRateArrowEl) raceSortWinRateArrowEl.textContent = state.raceSortBy === "team_a_win_rate" ? (state.raceSortDesc ? "▼" : "▲") : "↕";
}

function renderRaceCompTable(rows) {
  if (!raceCompTableBodyEl) return;
  raceCompTableBodyEl.innerHTML = "";
  if (!Array.isArray(rows) || rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="p-3 text-center text-[11px] text-[#4A4F59]">NO_MATCHUP_DATA</td>`;
    raceCompTableBodyEl.appendChild(tr);
    return;
  }
  for (const row of rows) {
    const teamA = renderRaceCompositionBadges(String(row.team_a || ""));
    const teamB = renderRaceCompositionBadges(String(row.team_b || ""));
    const matchupText = String(row.matchup || row.matchup_key || "-");
    const tr = document.createElement("tr");
    tr.className = "border-b border-[#2D3139]/30";
    tr.innerHTML = `
      <td class="p-3 border-r border-[#2D3139]/30">
        <div class="inline-flex items-center gap-2">
          <span class="hidden">${escapeHtml(matchupText)}</span>
          <span>${teamA}</span>
          <span class="text-[#4A4F59]">vs</span>
          <span>${teamB}</span>
        </div>
      </td>
      <td class="p-3 border-r border-[#2D3139]/30 text-right">${Number(row.games || 0)}</td>
      <td class="p-3 border-r border-[#2D3139]/30 text-right">${Number(row.team_a_win_rate || 0).toFixed(1)}%</td>
      <td class="p-3 border-r border-[#2D3139]/30 text-right">${Number(row.team_b_win_rate || 0).toFixed(1)}%</td>
      <td class="p-3 border-r border-[#2D3139]/30 text-right">${Number(row.team_a_wins || 0)}</td>
      <td class="p-3 text-right">${Number(row.team_b_wins || 0)}</td>
    `;
    raceCompTableBodyEl.appendChild(tr);
  }
}

function renderSortedRaceComp() {
  updateRaceSortArrows();
  renderRaceCompTable(applyRaceSort(state.raceRows || []));
}

function renderSortedRankings() {
  updateRankingSortArrows();
  renderRankingsTable(applyRankingSort(state.rankings || []));
}

async function loadRankings() {
  try {
    const data = await api("/api/v1/rankings/3v3?limit=100");
    state.rankings = Array.isArray(data.rankings) ? data.rankings : [];
    renderSortedRankings();
  } catch (err) {
    if (rankingsTableBodyEl) {
      rankingsTableBodyEl.innerHTML = `<tr><td colspan="7" class="p-3 text-center text-[11px] text-[#8a2f2f]">ERROR_LOAD_RANKINGS: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

async function loadRaceComp() {
  if (raceCompMetaEl) raceCompMetaEl.textContent = "LOADING...";
  try {
    const data = await api("/api/v1/analyzer/race-matchups?team_size=3&limit=300");
    state.raceRows = Array.isArray(data.rows) ? data.rows : [];
    renderSortedRaceComp();
    if (raceCompMetaEl) {
      raceCompMetaEl.textContent = `TEAM_SIZE: 3v3 | QUALIFIED_GAMES: ${Number(data.qualified_games || 0)} | ROWS: ${state.raceRows.length}`;
    }
  } catch (err) {
    state.raceRows = [];
    renderSortedRaceComp();
    if (raceCompMetaEl) raceCompMetaEl.textContent = `ERROR_LOAD_ANALYZER: ${escapeHtml(err.message)}`;
  }
}

if (refreshRankingsEl) refreshRankingsEl.addEventListener("click", loadRankings);
if (refreshRaceCompEl) refreshRaceCompEl.addEventListener("click", loadRaceComp);
if (tabRankings3v3El) tabRankings3v3El.addEventListener("click", () => activateTab("rankings3v3"));
if (tabRaceCompEl) tabRaceCompEl.addEventListener("click", () => activateTab("race_comp"));
if (raceSortGamesEl) {
  raceSortGamesEl.addEventListener("click", () => {
    if (state.raceSortBy === "games") state.raceSortDesc = !state.raceSortDesc;
    else {
      state.raceSortBy = "games";
      state.raceSortDesc = true;
    }
    renderSortedRaceComp();
  });
}
if (raceSortWinRateEl) {
  raceSortWinRateEl.addEventListener("click", () => {
    if (state.raceSortBy === "team_a_win_rate") state.raceSortDesc = !state.raceSortDesc;
    else {
      state.raceSortBy = "team_a_win_rate";
      state.raceSortDesc = true;
    }
    renderSortedRaceComp();
  });
}
if (rankSortWinRateEl) {
  rankSortWinRateEl.addEventListener("click", () => {
    if (state.sortBy === "win_rate") state.sortDesc = !state.sortDesc;
    else {
      state.sortBy = "win_rate";
      state.sortDesc = true;
    }
    renderSortedRankings();
  });
}
if (rankSortAvgApmEl) {
  rankSortAvgApmEl.addEventListener("click", () => {
    if (state.sortBy === "avg_apm") state.sortDesc = !state.sortDesc;
    else {
      state.sortBy = "avg_apm";
      state.sortDesc = true;
    }
    renderSortedRankings();
  });
}
if (rankSortAvgEapmEl) {
  rankSortAvgEapmEl.addEventListener("click", () => {
    if (state.sortBy === "avg_eapm") state.sortDesc = !state.sortDesc;
    else {
      state.sortBy = "avg_eapm";
      state.sortDesc = true;
    }
    renderSortedRankings();
  });
}

updateRankingSortArrows();
updateRaceSortArrows();
renderCurrentUser();
activateTab("rankings3v3");
loadRankings();
loadRaceComp();
