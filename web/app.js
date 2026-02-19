const gamesTableBodyEl = document.getElementById("gamesTableBody");
const selectedGameEl = document.getElementById("selectedGame");
const uploadFormEl = document.getElementById("uploadForm");
const uploadResultEl = document.getElementById("uploadResult");
const previewSummaryEl = document.getElementById("previewSummary");
const parsedUploaderSelectEl = document.getElementById("parsedUploaderSelect");
const uploadWithSelectedBtnEl = document.getElementById("uploadWithSelectedBtn");
const currentUserDisplayEl = document.getElementById("currentUserDisplay");
const refreshGamesEl = document.getElementById("refreshGames");
const refreshRankingsEl = document.getElementById("refreshRankings");
const gamesPrevPageEl = document.getElementById("gamesPrevPage");
const gamesNextPageEl = document.getElementById("gamesNextPage");
const gamesPageInfoEl = document.getElementById("gamesPageInfo");
const rankingsTableBodyEl = document.getElementById("rankingsTableBody");
const playerQueryEl = document.getElementById("playerQuery");
const playerSuggestionsEl = document.getElementById("playerSuggestions");
const queryPlayerBtnEl = document.getElementById("queryPlayerBtn");
const playerStatsEl = document.getElementById("playerStats");
const systemLogsEl = document.getElementById("systemLogs");
const apmChartEl = document.getElementById("apmChart");
const apmLegendEl = document.getElementById("apmLegend");
const vizTabsEl = document.getElementById("vizTabs");
const chartHintEl = document.getElementById("chartHint");
const techEventInfoEl = document.getElementById("techEventInfo");

const state = {
  games: [],
  chartTimelines: [],
  highlightedPlayer: null,
  activeVizTab: "apm",
  gameDetail: null,
  techMarkers: [],
  pendingFiles: [],
  pendingCommonPlayers: [],
  currentUser: "",
  suggestionTimer: null,
  gamesPage: 1,
  gamesPageSize: 6,
  gamesTotal: 0,
  rankings: [],
};
const chartPalette = ["#2D3139", "#275DAD", "#7B2CBF", "#C44536", "#0A8F6A", "#AF6E0D", "#5A4FCF", "#39424E"];

function addLog(message) {
  const item = document.createElement("p");
  const time = new Date().toISOString().replace("T", " ").slice(0, 19);
  item.textContent = `> ${time}: ${message}`;
  systemLogsEl.prepend(item);
  while (systemLogsEl.children.length > 14) {
    systemLogsEl.removeChild(systemLogsEl.lastChild);
  }
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

function fmtDate(s) {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

function raceMeta(raceName) {
  const race = String(raceName || "").toLowerCase();
  if (race.startsWith("terran")) return { letter: "T", cls: "race-t" };
  if (race.startsWith("zerg")) return { letter: "Z", cls: "race-z" };
  if (race.startsWith("protoss")) return { letter: "P", cls: "race-p" };
  return { letter: "U", cls: "" };
}

function fmtGameTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function computeTeamRaceStr(players, winnerTeam) {
  const byTeam = new Map();
  for (const p of players) {
    const t = Number(p.team || 0);
    if (!byTeam.has(t)) byTeam.set(t, []);
    byTeam.get(t).push(p);
  }
  const winner = Number(winnerTeam || 0);
  const teams = Array.from(byTeam.keys()).sort((a, b) => {
    if (winner > 0) {
      if (a === winner) return -1;
      if (b === winner) return 1;
    }
    return a - b;
  });
  return teams.map((t) => byTeam.get(t).map((p) => raceMeta(p.race).letter).join(""));
}

function reliabilitySummary(game, summaries) {
  if (summaries && summaries[String(game.id)]) return summaries[String(game.id)].m_of_n;
  return `${game.upload_count}/${game.player_count}`;
}

function getCurrentUser() {
  return (state.currentUser || "").trim();
}

function setCurrentUser(name) {
  const normalized = String(name || "").trim();
  state.currentUser = normalized;
  if (normalized) {
    localStorage.setItem("stareplays_current_user", normalized);
    playerQueryEl.value = normalized;
  } else {
    localStorage.removeItem("stareplays_current_user");
  }
  renderCurrentUser();
  renderRankingsTable(state.rankings || []);
}

function renderCurrentUser() {
  const current = getCurrentUser();
  currentUserDisplayEl.innerHTML = current
    ? `CURRENT_USER: <span class="session-user-chip">${escapeHtml(current)}</span>`
    : "CURRENT_USER: NONE";
}

function normalizeGridIndex(value, min, max) {
  if (max <= min) return 1;
  const ratio = (Number(value || 0) - min) / (max - min);
  return Math.max(0, Math.min(2, Math.round(ratio * 2)));
}

function playerResultClass(player, winnerTeam) {
  const winner = Number(winnerTeam || 0);
  if (winner <= 0) return "sg-card-unknown";
  return Number(player.team || 0) === winner ? "sg-card-winner" : "sg-card-loser";
}

function playerResultLabel(player, winnerTeam) {
  const winner = Number(winnerTeam || 0);
  if (winner <= 0) return "UNKNOWN";
  return Number(player.team || 0) === winner ? "WINNER" : "LOSER";
}

function effectivePercent(cmdCount, effectiveCmdCount) {
  const cmd = Number(cmdCount || 0);
  const eff = Number(effectiveCmdCount || 0);
  if (cmd <= 0) return 0;
  return Math.round((eff / cmd) * 1000) / 10;
}

function productionCountByPlayerName(playerName) {
  const detail = state.gameDetail;
  const buildOrders = getBuildOrders();
  const target = String(playerName || "").trim().toLowerCase();
  if (!target) return 0;
  const bo = buildOrders.find((b) => String(b.player_name || "").trim().toLowerCase() === target);
  return bo && Array.isArray(bo.events) ? bo.events.length : 0;
}

function renderSelectedGameBoard(gameData) {
  if (!gameData) {
    selectedGameEl.innerHTML = '<div class="text-[#4A4F59]">NO_GAME_SELECTED</div>';
    return;
  }

  const players = (gameData.edges && Array.isArray(gameData.edges.players)) ? gameData.edges.players : [];
  if (!players.length) {
    selectedGameEl.innerHTML = '<div class="text-[#4A4F59]">NO_PLAYER_DATA</div>';
    return;
  }

  const xs = players.map((p) => Number(p.start_location_x || 0));
  const ys = players.map((p) => Number(p.start_location_y || 0));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const cells = Array.from({ length: 9 }, () => null);
  players
    .slice()
    .sort((a, b) => Number(a.start_location_y || 0) - Number(b.start_location_y || 0) || Number(a.start_location_x || 0) - Number(b.start_location_x || 0))
    .forEach((p) => {
      const col = normalizeGridIndex(p.start_location_x, minX, maxX);
      const row = normalizeGridIndex(p.start_location_y, minY, maxY);
      let idx = row * 3 + col;
      if (cells[idx]) {
        for (let step = 1; step < 9; step++) {
          const candidate = (idx + step) % 9;
          if (!cells[candidate]) {
            idx = candidate;
            break;
          }
        }
      }
      cells[idx] = p;
    });

  const header = `
    <div class="mb-2 flex items-center justify-between">
      <div class="text-[10px] font-bold uppercase">#${gameData.id} ${escapeHtml(gameData.map_name || "-")}</div>
      <div class="text-[10px] text-[#4A4F59]">${escapeHtml(fmtDate(gameData.start_time))}</div>
    </div>
  `;

  const gameTimeStr = gameData.game_length ? fmtGameTime(gameData.game_length) : "--:--";
  const matchupStr = computeMatchup(players);

  const board = cells.map((p, idx) => {
    if (!p) {
      if (idx === 4) {
        const byTeam = new Map();
        for (const tp of players) {
          const t = Number(tp.team || 0);
          if (!byTeam.has(t)) byTeam.set(t, []);
          byTeam.get(t).push(tp);
        }
        const winner = Number(gameData.winner_team || 0);
        const sortedTeams = Array.from(byTeam.keys()).sort((a, b) => {
          if (winner > 0) {
            if (a === winner) return -1;
            if (b === winner) return 1;
          }
          return a - b;
        });
        const teamBadges = sortedTeams.map((t) =>
          `<span class="sg-center-team">${byTeam.get(t).map((tp) => { const rm = raceMeta(tp.race); return `<span class="race-badge ${rm.cls}">${rm.letter}</span>`; }).join("")}</span>`
        );
        const racesHtml = teamBadges.length >= 2
          ? `${teamBadges[0]}<span class="sg-center-vs">vs</span>${teamBadges[1]}`
          : teamBadges.join("");
        return `<div class="sg-cell sg-center-cell"><div class="sg-center-matchup">${escapeHtml(matchupStr)}</div><div class="sg-center-races">${racesHtml}</div><div class="sg-center-time-wrap"><div class="sg-center-time-label">PLAY TIME</div><div class="sg-center-time">${escapeHtml(gameTimeStr)}</div></div></div>`;
      }
      return `<div class="sg-cell sg-empty"></div>`;
    }
    const rm = raceMeta(p.race);
    const resultClass = playerResultClass(p, gameData.winner_team);
    const resultLabel = playerResultLabel(p, gameData.winner_team);
    const effPct = effectivePercent(p.cmd_count, p.effective_cmd_count);
    const prodCount = productionCountByPlayerName(p.name);
    return `
      <div class="sg-cell ${resultClass}">
        <div class="sg-top">
          <span class="race-badge ${rm.cls}">${rm.letter}</span>
          <span class="sg-name">${escapeHtml(p.name || "-")}</span>
          <span class="sg-result">${resultLabel}</span>
        </div>
        <div class="sg-stats">
          <span>APM ${Number(p.apm || 0)}</span><span>EAPM ${Number(p.eapm || 0)}</span>
          <span>CMD ${Number(p.cmd_count || 0)}</span><span>ECMD ${Number(p.effective_cmd_count || 0)}</span>
          <span class="sg-stats-full">EFFECTIVE ${effPct}%</span>
          <span class="sg-stats-full">REDUNDANCY ${Number(p.redundancy || 0)}%</span>
          <span class="sg-stats-full">PRODUCTION ${prodCount}</span>
        </div>
      </div>
    `;
  }).join("");

  selectedGameEl.innerHTML = `
    ${header}
    <div class="sg-map-wrap">
      <div class="sg-grid">${board}</div>
    </div>
  `;
}

function setTechEventInfo(text) {
  if (!techEventInfoEl) return;
  techEventInfoEl.textContent = text;
}

function frameToTimeText(frame) {
  const sec = Math.max(0, Math.floor(Number(frame || 0) / 23.81));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function computeMatchup(players) {
  if (!Array.isArray(players) || players.length === 0) return "-";
  const teamCounts = new Map();
  for (const p of players) {
    const t = Number(p.team || 0);
    if (!teamCounts.has(t)) teamCounts.set(t, 0);
    teamCounts.set(t, teamCounts.get(t) + 1);
  }
  return Array.from(teamCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, cnt]) => cnt)
    .join("v");
}

function playerLine(p, perspectiveName) {
  const raceFull = String(p.race || "").toLowerCase();
  let raceLetter = "U";
  let raceClass = "";
  if (raceFull.startsWith("terran")) {
    raceLetter = "T";
    raceClass = "race-t";
  } else if (raceFull.startsWith("zerg")) {
    raceLetter = "Z";
    raceClass = "race-z";
  } else if (raceFull.startsWith("protoss")) {
    raceLetter = "P";
    raceClass = "race-p";
  }
  const apm = Number(p.apm || 0);
  const eapm = Number(p.eapm || 0);
  const rawName = String(p.name || "-");
  const isUploader = perspectiveName && rawName.trim().toLowerCase() === perspectiveName.trim().toLowerCase();
  const nameHtml = isUploader
    ? `<span class="uploader-name">${rawName}</span><span class="you-chip">YOU</span>`
    : `<span>${rawName}</span>`;
  return `
    <div class="player-line">
      <span class="player-main"><span class="race-badge ${raceClass}">${raceLetter}</span>${nameHtml}<span class="player-apm">A:${apm} E:${eapm}</span></span>
    </div>
  `;
}

function perspectiveTeam(players, perspectiveName) {
  if (!perspectiveName) return null;
  const target = perspectiveName.trim().toLowerCase();
  const me = players.find((p) => String(p.name || "").trim().toLowerCase() === target);
  return me ? Number(me.team || 0) : null;
}

function teamPanelHtml(teamNumber, members, winnerTeam, perspectiveName) {
  if (!members.length) {
    return `<div class="text-[10px] text-[#4A4F59]">NO_DATA</div>`;
  }

  const winner = Number(winnerTeam || 0);
  let badgeClass = "result-chip unknown-chip";
  let badgeText = "UNKNOWN";
  if (winner > 0) {
    if (Number(teamNumber) === winner) {
      badgeClass = "result-chip winner-chip";
      badgeText = "WINNER";
    } else {
      badgeClass = "result-chip loser-chip";
      badgeText = "LOSER";
    }
  }
  const badgeLine = `<div class="mb-1"><span class="${badgeClass}">${badgeText}</span></div>`;
  const lines = members
    .map((p) => playerLine(p, perspectiveName))
    .join("");

  return `
    <div class="team-cell mb-1">
      ${badgeLine}
      ${lines}
    </div>
  `;
}

function splitOurEnemy(players, perspectiveName) {
  if (!Array.isArray(players) || players.length === 0) {
    return { ourTeam: null, enemyTeams: [], ourMembers: [], enemyMembers: [] };
  }

  const byTeam = new Map();
  for (const p of players) {
    const t = Number(p.team || 0);
    if (!byTeam.has(t)) byTeam.set(t, []);
    byTeam.get(t).push(p);
  }

  const teams = Array.from(byTeam.keys()).sort((a, b) => a - b);
  let ourTeam = perspectiveTeam(players, perspectiveName);
  if (ourTeam == null || !byTeam.has(ourTeam)) {
    ourTeam = teams[0] ?? null;
  }
  const enemyTeams = teams.filter((t) => t !== ourTeam);
  return {
    ourTeam,
    enemyTeams,
    ourMembers: byTeam.get(ourTeam) || [],
    enemyMembers: enemyTeams.flatMap((t) => byTeam.get(t) || []),
  };
}

function renderGamesTable(games, summaries) {
  gamesTableBodyEl.innerHTML = "";
  if (!games.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="p-3 text-center text-[11px] text-[#4A4F59]">NO_GAMES_FOUND</td>`;
    gamesTableBodyEl.appendChild(tr);
    return;
  }

  for (const g of games) {
    const players = (g.edges && Array.isArray(g.edges.players)) ? g.edges.players : [];
    const matchup = computeMatchup(players);
    const perspectiveName = getCurrentUser();
    const groups = splitOurEnemy(players, perspectiveName);
    const ourHtml = teamPanelHtml(groups.ourTeam, groups.ourMembers, g.winner_team, perspectiveName);
    const enemyLabelTeam = groups.enemyTeams.length ? groups.enemyTeams[0] : null;
    const enemyHtml = teamPanelHtml(enemyLabelTeam, groups.enemyMembers, g.winner_team, perspectiveName);

    const tr = document.createElement("tr");
    tr.className = "border-b border-[#2D3139]/30 cursor-pointer";
    tr.innerHTML = `
      <td class="p-3 border-r border-[#2D3139]/30">#${g.id}</td>
      <td class="p-3 border-r border-[#2D3139]/30 uppercase">${g.map_name || "-"}</td>
      <td class="p-3 border-r border-[#2D3139]/30 text-center">${matchup}</td>
      <td class="p-3 border-r border-[#2D3139]/30">${ourHtml}</td>
      <td class="p-3 border-r border-[#2D3139]/30">${enemyHtml}</td>
      <td class="p-3 text-right text-[#4A4F59]">${fmtDate(g.start_time)}</td>
    `;
    tr.addEventListener("click", () => loadGameDetail(g.id));
    gamesTableBodyEl.appendChild(tr);
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

  const current = getCurrentUser().trim().toLowerCase();
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

async function loadRankings() {
  if (!rankingsTableBodyEl) return;
  try {
    const data = await api("/api/v1/rankings/3v3?limit=100");
    state.rankings = Array.isArray(data.rankings) ? data.rankings : [];
    renderRankingsTable(state.rankings);
    addLog(`LOADED_3V3_RANKINGS: ${state.rankings.length}`);
  } catch (err) {
    state.rankings = [];
    rankingsTableBodyEl.innerHTML = `<tr><td colspan="7" class="p-3 text-center text-[11px] text-[#8a2f2f]">ERROR_LOAD_RANKINGS: ${escapeHtml(err.message)}</td></tr>`;
    addLog(`ERROR_LOAD_RANKINGS: ${err.message}`);
  }
}

function renderGamesTableMessage(message) {
  gamesTableBodyEl.innerHTML = "";
  const tr = document.createElement("tr");
  tr.innerHTML = `<td colspan="6" class="p-3 text-center text-[11px] text-[#4A4F59]">${escapeHtml(message)}</td>`;
  gamesTableBodyEl.appendChild(tr);
}

function renderGamesPager() {
  const total = Number(state.gamesTotal || 0);
  const pageSize = Number(state.gamesPageSize || 6);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Number(state.gamesPage || 1)), totalPages);
  state.gamesPage = current;
  if (gamesPageInfoEl) {
    gamesPageInfoEl.textContent = `Page ${current}/${totalPages}`;
  }
  if (gamesPrevPageEl) {
    gamesPrevPageEl.disabled = current <= 1 || total === 0;
  }
  if (gamesNextPageEl) {
    gamesNextPageEl.disabled = current >= totalPages || total === 0;
  }
}

async function loadGames(resetPage = false) {
  if (resetPage) {
    state.gamesPage = 1;
  }
  const currentUser = getCurrentUser();
  if (!currentUser) {
    state.games = [];
    state.gamesTotal = 0;
    renderGamesTableMessage("LOGIN_REQUIRED: SIMPLE_LOGIN 후 Recent_Games 조회 가능");
    renderGamesPager();
    return;
  }

  try {
    const limit = state.gamesPageSize;
    const offset = (state.gamesPage - 1) * state.gamesPageSize;
    const data = await api(`/api/v1/games?limit=${limit}&offset=${offset}&user_name=${encodeURIComponent(currentUser)}`);
    state.games = data.games || [];
    state.gamesTotal = Number(data.total || 0);
    renderGamesTable(state.games, data.reliability_summaries || {});
    renderGamesPager();
    addLog(`LOADED_GAMES: ${state.games.length} (USER=${currentUser}, PAGE=${state.gamesPage})`);
  } catch (err) {
    addLog(`ERROR_LOAD_GAMES: ${err.message}`);
    state.games = [];
    state.gamesTotal = 0;
    renderGamesTableMessage(`ERROR_LOAD_GAMES: ${err.message}`);
    renderGamesPager();
  }
}

async function loadGameDetail(id) {
  selectedGameEl.innerHTML = '<div class="text-[#4A4F59]">FETCHING_GAME...</div>';
  state.highlightedPlayer = null;
  state.gameDetail = null;
  renderActiveVisualization();
  try {
    const [gameRes, detailRes] = await Promise.all([
      api(`/api/v1/games/${id}`),
      api(`/api/v1/games/${id}/detail`),
    ]);
    const apmTimeline = (detailRes.detail && Array.isArray(detailRes.detail.apm_timeline))
      ? detailRes.detail.apm_timeline
      : [];
    state.gameDetail = detailRes.detail || null;
    renderSelectedGameBoard(gameRes.game || null);
    state.chartTimelines = apmTimeline;
    renderActiveVisualization();
    addLog(`SELECT_GAME: #${id}`);
  } catch (err) {
    selectedGameEl.innerHTML = `<div class="text-[#8a2f2f] font-bold">ERROR: ${escapeHtml(err.message)}</div>`;
    state.chartTimelines = [];
    state.highlightedPlayer = null;
    state.gameDetail = null;
    renderActiveVisualization();
    addLog(`ERROR_LOAD_DETAIL: #${id}`);
  }
}

function setParsedCandidates(candidates) {
  parsedUploaderSelectEl.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "SELECT_PLAYER_FROM_PARSED_REPLAY";
  parsedUploaderSelectEl.appendChild(placeholder);

  for (const name of candidates) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    parsedUploaderSelectEl.appendChild(opt);
  }
}

function computeCommonParticipantsFromPreview(previewResult) {
  if (!previewResult || !Array.isArray(previewResult.results)) return [];
  const successItems = previewResult.results.filter((r) => r && r.ok && r.preview && Array.isArray(r.preview.parsed_players));
  if (!successItems.length) return [];

  const first = successItems[0].preview.parsed_players || [];
  const commonMap = new Map();
  for (const name of first) {
    const raw = String(name || "").trim();
    if (!raw) continue;
    commonMap.set(raw.toLowerCase(), raw);
  }

  for (let i = 1; i < successItems.length; i++) {
    const set = new Set((successItems[i].preview.parsed_players || []).map((n) => String(n || "").trim().toLowerCase()).filter(Boolean));
    for (const key of Array.from(commonMap.keys())) {
      if (!set.has(key)) commonMap.delete(key);
    }
  }

  return Array.from(commonMap.values()).sort((a, b) => a.localeCompare(b));
}

function renderPreviewSummary(previewResult) {
  if (!previewResult || !Array.isArray(previewResult.results)) {
    previewSummaryEl.innerHTML = `
      <div class="term-head">$ PREVIEW STATUS</div>
      <div class="term-meta">> 아직 파싱된 replay가 없습니다.</div>
    `;
    previewSummaryEl.scrollTop = previewSummaryEl.scrollHeight;
    return;
  }

  const total = Number(previewResult.total_files || 0);
  const success = Number(previewResult.success_count || 0);
  const fail = Number(previewResult.failed_count || 0);

  const commonPlayers = state.pendingCommonPlayers || [];
  const blocks = previewResult.results.map((r, idx) => {
    const fileLabel = String(r.filename || `file_${idx + 1}`);
    if (!r.ok) {
      return `
        <div class="term-block term-block-fail">
          <div class="term-item">
            <span class="term-arrow">&gt;</span>
            <span class="status-chip status-fail">FAIL</span>
            <span class="term-file">${escapeHtml(fileLabel)}</span>
          </div>
          <div class="term-kv"><span class="term-key">reason:</span> <span class="term-value">${escapeHtml(String(r.error || "parse failed"))}</span></div>
        </div>
      `;
    }
    const p = r.preview || {};
    const names = Array.isArray(p.parsed_players) ? p.parsed_players.join(", ") : "none";
    return `
      <div class="term-block term-block-ok">
        <div class="term-item">
          <span class="term-arrow">&gt;</span>
          <span class="status-chip status-ok">OK</span>
          <span class="term-file">${escapeHtml(fileLabel)}</span>
        </div>
        <div class="term-kv"><span class="term-key">map:</span> <span class="term-value">${escapeHtml(String(p.map_name || "-"))}</span></div>
        <div class="term-kv"><span class="term-key">start:</span> <span class="term-value">${escapeHtml(fmtDate(p.start_time))}</span></div>
        <div class="term-players"><span class="term-key">players(${Number(p.player_count || 0)}):</span> <span class="term-value">${escapeHtml(names)}</span></div>
      </div>
    `;
  }).join("");

  previewSummaryEl.innerHTML = `
    <div class="term-head">Analysis Completed</div>
    <div class="term-meta">&gt; files: <span class="term-value">${total}</span>, success: <span class="term-value term-success">${success}</span>, fail: <span class="term-value term-fail">${fail}</span></div>
    <div class="term-meta">&gt; common players across files: <span class="term-value">${commonPlayers.length ? escapeHtml(commonPlayers.join(", ")) : "none"}</span></div>
    <div class="term-list">${blocks}</div>
  `;
  previewSummaryEl.scrollTop = previewSummaryEl.scrollHeight;
}

function appendUploadSummary(result, uploader, fileCount) {
  const lines = [];
  const ts = new Date().toLocaleString();
  lines.push(`<div class="term-head">Upload Completed</div>`);
  lines.push(`<div class="term-meta">&gt; time: <span class="term-value">${escapeHtml(ts)}</span>, uploader: <span class="term-value">${escapeHtml(uploader)}</span>, files: <span class="term-value">${fileCount}</span></div>`);

  const blocks = [];
  if (result && result.game && result.game.id) {
    blocks.push(`
      <div class="term-block term-block-ok">
        <div class="term-item"><span class="term-arrow">&gt;</span><span class="status-chip status-ok">OK</span><span class="term-file">game #${Number(result.game.id)}</span></div>
        <div class="term-kv"><span class="term-key">map:</span> <span class="term-value">${escapeHtml(String(result.game.map_name || "-"))}</span></div>
        <div class="term-kv"><span class="term-key">start:</span> <span class="term-value">${escapeHtml(fmtDate(result.game.start_time))}</span></div>
      </div>
    `);
  } else if (Array.isArray(result?.results)) {
    for (const item of result.results) {
      const ok = Boolean(item && item.ok);
      const filename = escapeHtml(String(item?.filename || "-"));
      if (ok) {
        const gid = item?.result?.game?.id;
        blocks.push(`
          <div class="term-block term-block-ok">
            <div class="term-item"><span class="term-arrow">&gt;</span><span class="status-chip status-ok">OK</span><span class="term-file">${filename}</span></div>
            <div class="term-kv"><span class="term-key">game:</span> <span class="term-value">${gid ? `#${Number(gid)}` : "-"}</span></div>
          </div>
        `);
      } else {
        const reason = escapeHtml(String(item?.error || item?.result?.error || "upload failed"));
        blocks.push(`
          <div class="term-block term-block-fail">
            <div class="term-item"><span class="term-arrow">&gt;</span><span class="status-chip status-fail">FAIL</span><span class="term-file">${filename}</span></div>
            <div class="term-kv"><span class="term-key">reason:</span> <span class="term-value">${reason}</span></div>
          </div>
        `);
      }
    }
  }

  const sectionHtml = `
    <div class="term-sep"></div>
    ${lines.join("")}
    <div class="term-list">${blocks.join("")}</div>
  `;
  previewSummaryEl.insertAdjacentHTML("beforeend", sectionHtml);
  previewSummaryEl.scrollTop = previewSummaryEl.scrollHeight;
}

async function previewReplay(event) {
  event.preventDefault();
  const fileInput = document.getElementById("replayFile");
  const files = fileInput.files ? Array.from(fileInput.files) : [];
  if (!files.length) return;

  uploadResultEl.textContent = `ANALYZING ${files.length} FILE(S)...`;
  try {
    const fd = new FormData();
    for (const file of files) {
      fd.append("replay_files", file);
    }
    const result = await api("/api/v1/games/upload/preview", { method: "POST", body: fd });
    state.pendingFiles = files;
    state.pendingCommonPlayers = computeCommonParticipantsFromPreview(result);
    setParsedCandidates(state.pendingCommonPlayers);
    const loggedIn = getCurrentUser();
    if (loggedIn) {
      const matched = state.pendingCommonPlayers.find((p) => p.trim().toLowerCase() === loggedIn.trim().toLowerCase());
      if (matched) {
        parsedUploaderSelectEl.value = matched;
      } else {
        parsedUploaderSelectEl.value = "";
      }
    } else if (state.pendingCommonPlayers.length === 1) {
      parsedUploaderSelectEl.value = state.pendingCommonPlayers[0];
      setCurrentUser(state.pendingCommonPlayers[0]);
    } else {
      parsedUploaderSelectEl.value = "";
    }
    renderPreviewSummary(result);
    uploadResultEl.textContent = `ANALYZE_OK: ${result.success_count || 0}/${result.total_files || files.length} files`;
    if (loggedIn && !state.pendingCommonPlayers.some((p) => p.trim().toLowerCase() === loggedIn.trim().toLowerCase())) {
      addLog(`ANALYZE_WARN: current login user '${loggedIn}' is not common participant`);
    } else {
      addLog(`ANALYZE_OK: ${files.length} file(s)`);
    }
  } catch (err) {
    uploadResultEl.textContent = `ANALYZE_FAIL: ${err.message}`;
    addLog(`ANALYZE_FAIL: ${err.message}`);
  }
}

async function uploadWithSelectedUser() {
  const uploader = getCurrentUser();
  if (!uploader) {
    uploadResultEl.textContent = "UPLOAD_FAIL: select user first (simple login)";
    return;
  }
  if (!Array.isArray(state.pendingFiles) || state.pendingFiles.length === 0) {
    uploadResultEl.textContent = "UPLOAD_FAIL: analyze replay first";
    return;
  }
  if (!Array.isArray(state.pendingCommonPlayers) || state.pendingCommonPlayers.length === 0) {
    uploadResultEl.textContent = "UPLOAD_FAIL: no common participant across analyzed files";
    return;
  }
  if (!state.pendingCommonPlayers.some((p) => p.trim().toLowerCase() === uploader.trim().toLowerCase())) {
    uploadResultEl.textContent = `UPLOAD_FAIL: '${uploader}' is not a common participant in current analyzed files`;
    return;
  }

  uploadResultEl.textContent = `UPLOADING ${state.pendingFiles.length} FILE(S) AS ${uploader}...`;
  try {
    const fd = new FormData();
    for (const file of state.pendingFiles) {
      fd.append("replay_files", file);
    }
    fd.append("uploader_name", uploader);

    const result = await api("/api/v1/games/upload", { method: "POST", body: fd });
    uploadResultEl.textContent = "UPLOAD_DONE: check terminal log";
    appendUploadSummary(result, uploader, state.pendingFiles.length);
    addLog(`UPLOAD_OK: ${state.pendingFiles.length} file(s) by ${uploader}`);
    await loadGames();

    if (result.game && result.game.id) {
      await loadGameDetail(result.game.id);
    } else if (Array.isArray(result.results)) {
      let lastSuccess = null;
      for (let i = result.results.length - 1; i >= 0; i--) {
        const candidate = result.results[i];
        if (candidate && candidate.ok && candidate.result && candidate.result.game && candidate.result.game.id) {
          lastSuccess = candidate;
          break;
        }
      }
      if (lastSuccess) {
        await loadGameDetail(lastSuccess.result.game.id);
      }
    }
  } catch (err) {
    uploadResultEl.textContent = `UPLOAD_FAIL: ${err.message}`;
    appendUploadSummary({ results: [{ ok: false, filename: "(batch)", error: err.message }] }, uploader, state.pendingFiles.length);
    addLog(`UPLOAD_FAIL: ${err.message}`);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtNum(value, digits = 1) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(digits);
}

function statEntries(statsObj) {
  if (!statsObj || typeof statsObj !== "object") return [];
  return Object.entries(statsObj)
    .map(([label, rec]) => {
      const wins = Number(rec?.wins || 0);
      const losses = Number(rec?.losses || 0);
      const total = Number(rec?.total || 0);
      const winRate = Number(rec?.win_rate || 0);
      return { label, wins, losses, total, winRate };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.label.localeCompare(b.label);
    });
}

function renderStatSection(title, statsObj, emptyText) {
  const rows = statEntries(statsObj);
  const body = rows.length
    ? rows
      .map((row) => `
        <tr class="border-b border-[#2D3139]/20 last:border-b-0">
          <td class="py-1 pr-2 text-[10px]">${escapeHtml(row.label)}</td>
          <td class="py-1 pr-2 text-right text-[10px]">${row.wins}-${row.losses}</td>
          <td class="py-1 pr-2 text-right text-[10px]">${row.total}</td>
          <td class="py-1 text-right text-[10px]">${fmtNum(row.winRate)}%</td>
        </tr>
      `)
      .join("")
    : `<tr><td colspan="4" class="py-2 text-[10px] text-[#4A4F59]">${escapeHtml(emptyText)}</td></tr>`;

  return `
    <section class="border border-[#2D3139]/40 bg-white/60 p-2">
      <h4 class="text-[10px] font-bold uppercase tracking-widest mb-1">${escapeHtml(title)}</h4>
      <table class="w-full border-collapse">
        <thead>
          <tr class="border-b border-[#2D3139]/30 text-[9px] uppercase text-[#4A4F59]">
            <th class="py-1 pr-2 text-left">Category</th>
            <th class="py-1 pr-2 text-right">W-L</th>
            <th class="py-1 pr-2 text-right">Games</th>
            <th class="py-1 text-right">Win%</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `;
}

function renderPlayerStats(stats) {
  const playerName = escapeHtml(stats.player_name || "-");
  const favoriteRace = escapeHtml(stats.favorite_race || "-");
  const totalGames = Number(stats.total_games || 0);
  const wins = Number(stats.wins || 0);
  const losses = Number(stats.losses || 0);
  const draws = Number(stats.draws || 0);

  playerStatsEl.innerHTML = `
    <div class="space-y-3">
      <section class="border border-[#2D3139] bg-white/70 p-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-[9px] font-bold uppercase tracking-widest text-[#4A4F59]">Player</div>
            <div class="text-xs font-bold uppercase">${playerName}</div>
          </div>
          <div class="text-right">
            <div class="text-[9px] font-bold uppercase tracking-widest text-[#4A4F59]">Favorite Race</div>
            <div class="text-xs font-bold uppercase">${favoriteRace}</div>
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          <div class="border border-[#2D3139]/40 bg-white p-2">
            <div class="text-[9px] uppercase text-[#4A4F59]">Win Rate</div>
            <div class="text-[11px] font-bold">${fmtNum(stats.win_rate)}%</div>
          </div>
          <div class="border border-[#2D3139]/40 bg-white p-2">
            <div class="text-[9px] uppercase text-[#4A4F59]">Games</div>
            <div class="text-[11px] font-bold">${totalGames}</div>
          </div>
          <div class="border border-[#2D3139]/40 bg-white p-2">
            <div class="text-[9px] uppercase text-[#4A4F59]">Record</div>
            <div class="text-[11px] font-bold">${wins}-${losses}-${draws}</div>
          </div>
          <div class="border border-[#2D3139]/40 bg-white p-2">
            <div class="text-[9px] uppercase text-[#4A4F59]">Avg APM/EAPM</div>
            <div class="text-[11px] font-bold">${fmtNum(stats.average_apm)} / ${fmtNum(stats.average_eapm)}</div>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-3 gap-2">
        ${renderStatSection("Race_Stats", stats.race_stats, "NO_RACE_STATS")}
        ${renderStatSection("Matchup_Stats", stats.matchup_stats, "NO_MATCHUP_STATS")}
        ${renderStatSection("Map_Stats", stats.map_stats, "NO_MAP_STATS")}
      </section>
    </div>
  `;
}

async function queryPlayer() {
  const name = playerQueryEl.value.trim();
  if (!name) return;
  const prevUser = getCurrentUser();
  setCurrentUser(name);
  await loadGames(true);
  if (prevUser.toLowerCase() !== name.toLowerCase()) {
    addLog(`LOGIN_AS: ${name}`);
  }
  playerStatsEl.innerHTML = '<div class="text-[10px] text-[#4A4F59]">QUERYING_PLAYER...</div>';
  try {
    const result = await api(`/api/v1/players/${encodeURIComponent(name)}/stats`);
    renderPlayerStats(result);
    addLog(`PLAYER_QUERY: ${name}`);
  } catch (err) {
    playerStatsEl.innerHTML = `
      <div class="border border-[#8a2f2f] bg-[#f2d9d9] text-[#8a2f2f] p-2 text-[10px] font-bold">
        QUERY_FAIL: ${escapeHtml(err.message)}
      </div>
    `;
    addLog(`QUERY_FAIL: ${name}`);
  }
}

async function loadPlayerSuggestions(query) {
  const q = String(query || "").trim();
  if (!q) {
    playerSuggestionsEl.innerHTML = "";
    return;
  }
  try {
    const result = await api(`/api/v1/users/suggest?q=${encodeURIComponent(q)}&limit=5`);
    const users = Array.isArray(result.users) ? result.users : [];
    playerSuggestionsEl.innerHTML = users
      .slice(0, 5)
      .map((name) => `<option value="${escapeHtml(name)}"></option>`)
      .join("");
  } catch (err) {
    addLog(`SUGGEST_FAIL: ${err.message}`);
  }
}

function schedulePlayerSuggestion() {
  if (state.suggestionTimer) {
    clearTimeout(state.suggestionTimer);
  }
  state.suggestionTimer = setTimeout(() => {
    loadPlayerSuggestions(playerQueryEl.value);
  }, 280);
}

uploadFormEl.addEventListener("submit", previewReplay);
parsedUploaderSelectEl.addEventListener("change", () => {
  const selected = parsedUploaderSelectEl.value.trim();
  if (!selected) return;
  setCurrentUser(selected);
  addLog(`LOGIN_AS: ${selected}`);
  loadGames(true);
});
uploadWithSelectedBtnEl.addEventListener("click", uploadWithSelectedUser);
refreshGamesEl.addEventListener("click", () => loadGames(false));
if (refreshRankingsEl) {
  refreshRankingsEl.addEventListener("click", loadRankings);
}
if (gamesPrevPageEl) {
  gamesPrevPageEl.addEventListener("click", () => {
    if (state.gamesPage <= 1) return;
    state.gamesPage -= 1;
    loadGames();
  });
}
if (gamesNextPageEl) {
  gamesNextPageEl.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(Number(state.gamesTotal || 0) / Number(state.gamesPageSize || 6)));
    if (state.gamesPage >= totalPages) return;
    state.gamesPage += 1;
    loadGames();
  });
}
queryPlayerBtnEl.addEventListener("click", queryPlayer);
playerQueryEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") queryPlayer();
});
playerQueryEl.addEventListener("input", schedulePlayerSuggestion);
if (vizTabsEl) {
  vizTabsEl.querySelectorAll("[data-viz-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeVizTab = btn.getAttribute("data-viz-tab") || "apm";
      renderActiveVisualization();
    });
  });
}
if (apmChartEl) {
  apmChartEl.addEventListener("click", (e) => {
    if (state.activeVizTab !== "tech" || !Array.isArray(state.techMarkers) || state.techMarkers.length === 0) {
      return;
    }
    const rect = apmChartEl.getBoundingClientRect();
    const scaleX = apmChartEl.width / rect.width;
    const scaleY = apmChartEl.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let picked = null;
    let minDist = Infinity;
    for (const m of state.techMarkers) {
      const dx = x - m.x;
      const dy = y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= m.r && dist < minDist) {
        picked = m;
        minDist = dist;
      }
    }
    if (!picked) return;

    const morphText = picked.isMorph ? "MORPH" : "TECH";
    setTechEventInfo(`TECH_EVENT: ${picked.player} | ${picked.unit} | ${morphText} | F:${picked.frame} (${frameToTimeText(picked.frame)})`);
  });
}
window.addEventListener("resize", () => {
  renderActiveVisualization();
});

const WINDOW_FRAMES = 238;

const UNIT_COSTS = {
  SCV: [50, 0], Probe: [50, 0], Drone: [50, 0], Marine: [50, 0], Medic: [50, 25], Firebat: [50, 25],
  Vulture: [75, 0], "Siege Tank": [150, 100], Goliath: [100, 50], Wraith: [150, 100], Dropship: [100, 100],
  ScienceVessel: [100, 225], Battlecruiser: [400, 300], Valkyrie: [250, 125], Ghost: [25, 75],
  Zealot: [100, 0], Dragoon: [125, 50], HighTemplar: [50, 150], DarkTemplar: [125, 100], Archon: [0, 0],
  Shuttle: [200, 200], Reaver: [200, 100], Observer: [25, 75], Corsair: [150, 100], Carrier: [350, 250],
  Zergling: [50, 0], Hydralisk: [75, 25], Lurker: [50, 100], Mutalisk: [100, 100], Guardian: [50, 100],
  Devourer: [150, 50], Ultralisk: [200, 200], Defiler: [50, 150], Queen: [100, 100], Overlord: [100, 0],
  Hatchery: [300, 0], Lair: [150, 100], Hive: [200, 150], SpawningPool: [200, 0],
  CommandCenter: [400, 0], Nexus: [400, 0], Barracks: [150, 0], Gateway: [150, 0], Factory: [200, 100],
  Starport: [150, 100], RoboticsFacility: [200, 200], Stargate: [150, 150],
};

function setupChartCanvas() {
  if (!apmChartEl) return null;
  const rect = apmChartEl.getBoundingClientRect();
  const width = Math.max(560, Math.floor(rect.width || 560));
  const height = 220;
  apmChartEl.width = width;
  apmChartEl.height = height;
  const ctx = apmChartEl.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f8f8f8";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#2D3139";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  return { ctx, width, height };
}

function showChartEmpty(ctx, text) {
  apmLegendEl.innerHTML = "";
  ctx.fillStyle = "#4A4F59";
  ctx.font = "bold 12px 'Roboto Mono'";
  ctx.fillText(text, 12, 22);
}

function renderMultiLineChart(series, title, ySuffix) {
  const setup = setupChartCanvas();
  if (!setup) return;
  const { ctx, width, height } = setup;
  apmLegendEl.innerHTML = "";

  if (!Array.isArray(series) || series.length === 0) {
    showChartEmpty(ctx, `NO_${title.toUpperCase().replace(/\s+/g, "_")}`);
    return;
  }

  let maxFrame = 1;
  let maxValue = 1;
  for (const tl of series) {
    const points = Array.isArray(tl.data_points) ? tl.data_points : [];
    for (const p of points) {
      maxFrame = Math.max(maxFrame, Number(p.frame || 0));
      maxValue = Math.max(maxValue, Number(p.value || 0));
    }
  }

  const padLeft = 44;
  const padRight = 12;
  const padTop = 10;
  const padBottom = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  ctx.strokeStyle = "rgba(45,49,57,0.25)";
  for (let i = 0; i <= 4; i++) {
    const y = padTop + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(width - padRight, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#4A4F59";
  ctx.font = "10px 'Roboto Mono'";
  for (let i = 0; i <= 4; i++) {
    const v = Math.round(maxValue - (maxValue * i) / 4);
    const y = padTop + (plotH * i) / 4 + 3;
    ctx.fillText(`${v}${ySuffix || ""}`, 6, y);
  }
  ctx.fillText("frame", width - 42, height - 7);

  series.forEach((tl, idx) => {
    const color = chartPalette[idx % chartPalette.length];
    const points = Array.isArray(tl.data_points) ? tl.data_points : [];
    if (!points.length) return;
    const playerName = tl.player_name || `P${idx + 1}`;
    const isActive = !state.highlightedPlayer || state.highlightedPlayer === playerName;
    const strokeColor = isActive ? color : "rgba(45,49,57,0.22)";

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isActive ? 1.6 : 0.8;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = padLeft + (plotW * Number(p.frame || 0)) / maxFrame;
      const y = padTop + plotH - (plotH * Number(p.value || 0)) / maxValue;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const legend = document.createElement("span");
    legend.className = "inline-flex items-center gap-1 border border-[#2D3139] bg-white px-1.5 py-0.5 cursor-pointer";
    legend.style.opacity = isActive ? "1" : "0.45";
    legend.innerHTML = `<span style="display:inline-block;width:8px;height:8px;background:${color}"></span><span>${playerName}</span>`;
    legend.addEventListener("click", () => {
      state.highlightedPlayer = state.highlightedPlayer === playerName ? null : playerName;
      renderActiveVisualization();
    });
    apmLegendEl.appendChild(legend);
  });
}

function getBuildOrders() {
  if (!state.gameDetail) return [];
  if (Array.isArray(state.gameDetail.compressed_build_orders) && state.gameDetail.compressed_build_orders.length > 0) {
    return state.gameDetail.compressed_build_orders;
  }
  if (Array.isArray(state.gameDetail.build_orders)) {
    return state.gameDetail.build_orders;
  }
  return [];
}

function mapBuildOrdersToSeries(valueFn) {
  const buildOrders = getBuildOrders();
  const series = [];
  for (const bo of buildOrders) {
    const buckets = new Map();
    const events = Array.isArray(bo.events) ? bo.events : [];
    for (const ev of events) {
      const frame = Number(ev.frame || 0);
      const w = Math.floor(frame / WINDOW_FRAMES);
      buckets.set(w, (buckets.get(w) || 0) + valueFn(ev));
    }
    const maxW = Math.max(0, ...Array.from(buckets.keys()));
    const data_points = [];
    for (let w = 0; w <= maxW; w++) {
      data_points.push({ frame: w * WINDOW_FRAMES, value: Number((buckets.get(w) || 0).toFixed(1)) });
    }
    series.push({ player_name: bo.player_name, data_points });
  }
  return series;
}

function renderAPMTab() {
  const apm = Array.isArray(state.chartTimelines) ? state.chartTimelines : [];
  const series = apm.map((tl) => ({
    player_name: tl.player_name,
    data_points: (Array.isArray(tl.data_points) ? tl.data_points : []).map((p) => ({
      frame: Number(p.frame || 0),
      value: Number(p.apm || 0),
    })),
  }));
  renderMultiLineChart(series, "APM", "");
  chartHintEl.textContent = "범례를 클릭하면 플레이어 라인이 강조됩니다.";
}

function renderSpendTab() {
  const series = mapBuildOrdersToSeries((ev) => {
    const unit = String(ev.unit || "");
    const [m, g] = UNIT_COSTS[unit] || [0, 0];
    return m + g;
  });
  renderMultiLineChart(series, "RESOURCE_SPEND", "");
  chartHintEl.textContent = "build/train/morph 이벤트 기반 자원 소모량(추정치)입니다.";
}

function renderProductionTab() {
  const series = mapBuildOrdersToSeries(() => 1);
  renderMultiLineChart(series, "PRODUCTION", "");
  chartHintEl.textContent = "시간 구간별 생산 이벤트 개수입니다.";
}

function isTechLikeUnit(unitName) {
  const u = String(unitName || "").toLowerCase();
  const keys = ["academy", "armory", "engineering", "science", "observatory", "citadel", "templar", "archives", "spire", "queen", "defiler", "lair", "hive"];
  return keys.some((k) => u.includes(k));
}

function renderTechTab() {
  const setup = setupChartCanvas();
  if (!setup) return;
  const { ctx, width, height } = setup;
  apmLegendEl.innerHTML = "";
  state.techMarkers = [];
  setTechEventInfo("TECH_EVENT: CLICK_MARKER_TO_VIEW");

  const buildOrders = getBuildOrders();
  if (!buildOrders.length) {
    showChartEmpty(ctx, "NO_TECH_TIMING");
    chartHintEl.textContent = "데이터가 없습니다.";
    return;
  }

  let maxFrame = 1;
  buildOrders.forEach((bo) => {
    (bo.events || []).forEach((ev) => { maxFrame = Math.max(maxFrame, Number(ev.frame || 0)); });
  });

  const padLeft = 110;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 18;
  const plotW = width - padLeft - padRight;
  const rowH = (height - padTop - padBottom) / Math.max(1, buildOrders.length);

  buildOrders.forEach((bo, i) => {
    const y = padTop + rowH * i + rowH / 2;
    ctx.fillStyle = "#4A4F59";
    ctx.font = "10px 'Roboto Mono'";
    ctx.fillText(String(bo.player_name || "-").slice(0, 16), 8, y + 3);
    ctx.strokeStyle = "rgba(45,49,57,0.14)";
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(width - padRight, y);
    ctx.stroke();

    const active = !state.highlightedPlayer || state.highlightedPlayer === bo.player_name;
    ctx.fillStyle = active ? chartPalette[i % chartPalette.length] : "rgba(45,49,57,0.2)";
    (bo.events || []).forEach((ev) => {
      if (!ev.is_morph && !isTechLikeUnit(ev.unit)) return;
      const x = padLeft + (plotW * Number(ev.frame || 0)) / maxFrame;
      ctx.beginPath();
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
      state.techMarkers.push({
        x,
        y,
        r: 6,
        player: bo.player_name || "-",
        unit: ev.unit || "-",
        frame: Number(ev.frame || 0),
        isMorph: Boolean(ev.is_morph),
      });
    });

    const legend = document.createElement("span");
    legend.className = "inline-flex items-center gap-1 border border-[#2D3139] bg-white px-1.5 py-0.5 cursor-pointer";
    legend.style.opacity = active ? "1" : "0.45";
    legend.innerHTML = `<span style="display:inline-block;width:8px;height:8px;background:${chartPalette[i % chartPalette.length]}"></span><span>${bo.player_name}</span>`;
    legend.addEventListener("click", () => {
      state.highlightedPlayer = state.highlightedPlayer === bo.player_name ? null : bo.player_name;
      renderActiveVisualization();
    });
    apmLegendEl.appendChild(legend);
  });

  chartHintEl.textContent = "Morph + 주요 테크 구조물 타이밍입니다.";
}

function renderBattleTab() {
  const setup = setupChartCanvas();
  if (!setup) return;
  const { ctx, width, height } = setup;
  apmLegendEl.innerHTML = "";

  const apm = Array.isArray(state.chartTimelines) ? state.chartTimelines : [];
  if (!apm.length) {
    showChartEmpty(ctx, "NO_BATTLE_INTENSITY");
    chartHintEl.textContent = "데이터가 없습니다.";
    return;
  }

  const sums = new Map();
  let maxFrame = 1;
  for (const tl of apm) {
    for (const p of (tl.data_points || [])) {
      const f = Number(p.frame || 0);
      const a = Number(p.apm || 0);
      sums.set(f, (sums.get(f) || 0) + a);
      maxFrame = Math.max(maxFrame, f);
    }
  }
  const frames = Array.from(sums.keys()).sort((a, b) => a - b);
  const vals = frames.map((f) => sums.get(f) || 0);
  const smoothed = vals.map((_, i) => (vals[Math.max(0, i - 1)] + vals[i] + vals[Math.min(vals.length - 1, i + 1)]) / 3);
  const maxV = Math.max(1, ...smoothed);

  const padLeft = 44;
  const padRight = 12;
  const padTop = 10;
  const padBottom = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  ctx.strokeStyle = "#C44536";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  smoothed.forEach((v, i) => {
    const x = padLeft + (plotW * frames[i]) / maxFrame;
    const y = padTop + plotH - (plotH * v) / maxV;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  chartHintEl.textContent = "전 플레이어 APM 합계 기반 교전 강도 추정치입니다.";
}

function renderActionMixTab() {
  const setup = setupChartCanvas();
  if (!setup) return;
  const { ctx, width, height } = setup;
  apmLegendEl.innerHTML = "";

  const buildOrders = getBuildOrders();
  const apm = Array.isArray(state.chartTimelines) ? state.chartTimelines : [];
  if (!buildOrders.length || !apm.length) {
    showChartEmpty(ctx, "NO_ACTION_MIX");
    chartHintEl.textContent = "데이터가 없습니다.";
    return;
  }

  const apmAvgByPlayer = new Map();
  for (const tl of apm) {
    const pts = tl.data_points || [];
    const avg = pts.length ? pts.reduce((s, p) => s + Number(p.apm || 0), 0) / pts.length : 0;
    apmAvgByPlayer.set(tl.player_name, avg);
  }

  const rows = buildOrders.map((bo) => {
    const production = (bo.events || []).length;
    const apmAvg = apmAvgByPlayer.get(bo.player_name) || 0;
    const macro = Math.max(5, apmAvg * 0.45);
    const combat = Math.max(5, apmAvg * 0.35);
    const control = Math.max(5, apmAvg * 0.2);
    const total = production + macro + combat + control;
    return {
      name: bo.player_name,
      production: (production / total) * 100,
      macro: (macro / total) * 100,
      combat: (combat / total) * 100,
      control: (control / total) * 100,
    };
  });

  const padLeft = 110;
  const padRight = 20;
  const padTop = 12;
  const padBottom = 12;
  const barW = width - padLeft - padRight;
  const rowH = (height - padTop - padBottom) / Math.max(1, rows.length);
  const mixColors = { production: "#275DAD", macro: "#0A8F6A", combat: "#C44536", control: "#AF6E0D" };

  rows.forEach((r, i) => {
    const y = padTop + i * rowH + 5;
    const barY = y + 6;
    ctx.fillStyle = "#4A4F59";
    ctx.font = "10px 'Roboto Mono'";
    ctx.fillText(String(r.name || "-").slice(0, 16), 8, barY + 7);

    const active = !state.highlightedPlayer || state.highlightedPlayer === r.name;
    let x = padLeft;
    for (const key of ["production", "macro", "combat", "control"]) {
      const segW = (barW * r[key]) / 100;
      ctx.fillStyle = active ? mixColors[key] : "rgba(45,49,57,0.2)";
      ctx.fillRect(x, barY, segW, Math.max(8, rowH - 10));
      x += segW;
    }

    const legend = document.createElement("span");
    legend.className = "inline-flex items-center gap-1 border border-[#2D3139] bg-white px-1.5 py-0.5 cursor-pointer";
    legend.style.opacity = active ? "1" : "0.45";
    legend.innerHTML = `<span style="display:inline-block;width:8px;height:8px;background:${chartPalette[i % chartPalette.length]}"></span><span>${r.name}</span>`;
    legend.addEventListener("click", () => {
      state.highlightedPlayer = state.highlightedPlayer === r.name ? null : r.name;
      renderActiveVisualization();
    });
    apmLegendEl.appendChild(legend);
  });

  const meta = document.createElement("span");
  meta.className = "inline-flex items-center gap-2 border border-[#2D3139] bg-white px-1.5 py-0.5";
  meta.innerHTML = `<span style="color:#275DAD">PROD</span><span style="color:#0A8F6A">MACRO</span><span style="color:#C44536">COMBAT</span><span style="color:#AF6E0D">CTRL</span>`;
  apmLegendEl.appendChild(meta);
  chartHintEl.textContent = "APM + 생산 이벤트 기반 액션 비중 추정치입니다.";
}

function syncVizTabUi() {
  if (!vizTabsEl) return;
  vizTabsEl.querySelectorAll("[data-viz-tab]").forEach((btn) => {
    const active = btn.getAttribute("data-viz-tab") === state.activeVizTab;
    btn.classList.toggle("bg-[#2D3139]", active);
    btn.classList.toggle("text-[#E0E0E2]", active);
    btn.classList.toggle("bg-white/60", !active);
  });
}

function renderActiveVisualization() {
  syncVizTabUi();
  if (state.activeVizTab !== "tech") {
    state.techMarkers = [];
    setTechEventInfo("TECH_EVENT: NONE_SELECTED");
  }
  switch (state.activeVizTab) {
    case "spend":
      renderSpendTab();
      break;
    case "production":
      renderProductionTab();
      break;
    case "tech":
      renderTechTab();
      break;
    case "battle":
      renderBattleTab();
      break;
    case "actions":
      renderActionMixTab();
      break;
    case "apm":
    default:
      renderAPMTab();
      break;
  }
}

setCurrentUser(localStorage.getItem("stareplays_current_user") || "");
renderCurrentUser();
if (getCurrentUser()) {
  playerQueryEl.value = getCurrentUser();
}
loadGames();
loadRankings();
renderActiveVisualization();
