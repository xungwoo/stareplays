const rankingsTableBodyEl = document.getElementById("rankingsTableBody");
const refreshRankingsEl = document.getElementById("refreshRankings");
const rankingsCurrentUserEl = document.getElementById("rankingsCurrentUser");
const rankingsSortByEl = document.getElementById("rankingsSortBy");
const rankingsSortDirEl = document.getElementById("rankingsSortDir");

const state = {
  rankings: [],
  sortBy: "default",
  sortDesc: true,
};

function getCurrentUser() {
  return String(localStorage.getItem("stareplays_current_user") || "").trim();
}

function renderCurrentUser() {
  if (!rankingsCurrentUserEl) return;
  const current = getCurrentUser();
  rankingsCurrentUserEl.innerHTML = current
    ? `CURRENT_USER: <span class="session-user-chip">${escapeHtml(current)}</span>`
    : "CURRENT_USER: NONE";
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
  if (!res.ok) {
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  return data;
}

function renderRankingsTable(rankings) {
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

function applyRankingSort(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  const desc = state.sortDesc ? -1 : 1;
  const sortBy = state.sortBy;

  list.sort((a, b) => {
    if (sortBy === "avg_apm") {
      const diff = (Number(a.avg_apm || 0) - Number(b.avg_apm || 0)) * desc;
      if (diff !== 0) return diff;
    } else if (sortBy === "avg_eapm") {
      const diff = (Number(a.avg_eapm || 0) - Number(b.avg_eapm || 0)) * desc;
      if (diff !== 0) return diff;
    } else {
      const winRateDiff = (Number(a.win_rate || 0) - Number(b.win_rate || 0)) * desc;
      if (winRateDiff !== 0) return winRateDiff;
      const winsDiff = (Number(a.wins || 0) - Number(b.wins || 0)) * desc;
      if (winsDiff !== 0) return winsDiff;
      const gamesDiff = (Number(a.games || 0) - Number(b.games || 0)) * desc;
      if (gamesDiff !== 0) return gamesDiff;
    }
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  return list.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

function renderSortedRankings() {
  renderRankingsTable(applyRankingSort(state.rankings || []));
}

async function loadRankings() {
  try {
    const data = await api("/api/v1/rankings/3v3?limit=100");
    state.rankings = Array.isArray(data.rankings) ? data.rankings : [];
    renderSortedRankings();
  } catch (err) {
    rankingsTableBodyEl.innerHTML = `<tr><td colspan="7" class="p-3 text-center text-[11px] text-[#8a2f2f]">ERROR_LOAD_RANKINGS: ${escapeHtml(err.message)}</td></tr>`;
  }
}

refreshRankingsEl.addEventListener("click", loadRankings);
rankingsSortByEl.addEventListener("change", () => {
  state.sortBy = rankingsSortByEl.value || "default";
  renderSortedRankings();
});
rankingsSortDirEl.addEventListener("click", () => {
  state.sortDesc = !state.sortDesc;
  rankingsSortDirEl.textContent = state.sortDesc ? "DESC" : "ASC";
  renderSortedRankings();
});
renderCurrentUser();
loadRankings();
