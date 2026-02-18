const analyzerTableBodyEl = document.getElementById("analyzerTableBody");
const analyzerMetaEl = document.getElementById("analyzerMeta");
const teamSizeFilterEl = document.getElementById("teamSizeFilter");
const refreshAnalyzerEl = document.getElementById("refreshAnalyzer");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  if (!res.ok) {
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  return data;
}

function renderAnalyzerRows(rows) {
  analyzerTableBodyEl.innerHTML = "";
  if (!Array.isArray(rows) || rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="p-3 text-center text-[11px] text-[#4A4F59]">NO_MATCHUP_DATA</td>`;
    analyzerTableBodyEl.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const teamA = renderRaceCompositionBadges(String(row.team_a || ""));
    const teamB = renderRaceCompositionBadges(String(row.team_b || ""));
    const tr = document.createElement("tr");
    tr.className = "border-b border-[#2D3139]/30";
    tr.innerHTML = `
      <td class="p-3 border-r border-[#2D3139]/30">
        <div class="inline-flex items-center gap-2">
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
    analyzerTableBodyEl.appendChild(tr);
  }
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
  return letters
    .map((ch) => `<span class="race-badge ${raceBadgeClass(ch)}">${escapeHtml(ch)}</span>`)
    .join("");
}

async function loadAnalyzer() {
  const teamSize = Number(teamSizeFilterEl.value || "0");
  analyzerMetaEl.textContent = "LOADING...";
  try {
    const data = await api(`/api/v1/analyzer/race-matchups?team_size=${teamSize}&limit=300`);
    const rows = Array.isArray(data.rows) ? data.rows : [];
    renderAnalyzerRows(rows);
    analyzerMetaEl.textContent = `TEAM_SIZE: ${teamSize === 0 ? "ALL" : `${teamSize}v${teamSize}`} | QUALIFIED_GAMES: ${Number(data.qualified_games || 0)} | ROWS: ${rows.length}`;
  } catch (err) {
    analyzerTableBodyEl.innerHTML = `<tr><td colspan="6" class="p-3 text-center text-[11px] text-[#8a2f2f]">ERROR_LOAD_ANALYZER: ${escapeHtml(err.message)}</td></tr>`;
    analyzerMetaEl.textContent = "ERROR";
  }
}

refreshAnalyzerEl.addEventListener("click", loadAnalyzer);
teamSizeFilterEl.addEventListener("change", loadAnalyzer);
loadAnalyzer();
