const currentUserEl = document.getElementById("analyzerCurrentUser");
const refreshGamesEl = document.getElementById("analyzerRefreshGames");
const refreshStatusEl = document.getElementById("analyzerRefreshStatus");
const gamesBodyEl = document.getElementById("analyzerGamesBody");
const prevPageEl = document.getElementById("analyzerPrevPage");
const nextPageEl = document.getElementById("analyzerNextPage");
const pageInfoEl = document.getElementById("analyzerPageInfo");

const summaryEl = document.getElementById("analyzerSummary");
const analyzerJobStatusEl = document.getElementById("analyzerJobStatus");
const playerTabsEl = document.getElementById("analyzerPlayerTabs");
const vizTabsEl = document.getElementById("analyzerVizTabs");
const tabContentEl = document.getElementById("analyzerTabContent");
const playerPanelEl = document.getElementById("analyzerPlayerPanel");
const eventInspectorEl = document.getElementById("analyzerEventInspector");

const state = {
  games: [],
  page: 1,
  pageSize: 10,
  total: 0,
  analysisStatuses: {},
  selectedGameId: 0,
  selectedGame: null,
  selectedDetail: null,
  selectedAnalysis: null,
  pageModel: null,
  selectedPlayer: "",
  activeTab: "match-flow",
  timelinePage: 1,
  timelinePageSize: 20,
  apmHiddenPlayers: {},
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
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

function raceBadge(race) {
  const letter = raceLetter(race);
  const klass = letter === "T" ? "race-t" : letter === "Z" ? "race-z" : letter === "P" ? "race-p" : "";
  return `<span class="race-badge ${klass}">${escapeHtml(letter)}</span>`;
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

function reliabilityText(game) {
  const upload = Number(game?.upload_count || 0);
  const players = Number(game?.player_count || 0);
  if (players <= 0) return "0%";
  return `${Math.round((upload / players) * 100)}%`;
}

function normalizeAnalysisJobStatus(v) {
  const s = String(v || "").toLowerCase().trim();
  if (s === "queued" || s === "running" || s === "succeeded" || s === "failed") return s;
  return "not_requested";
}

function analysisBadge(status) {
  const s = normalizeAnalysisJobStatus(status);
  if (s === "queued") return `<span class="inline-block border border-[#2D3139] bg-white/70 px-2 py-0.5 text-[10px]">QUEUED</span>`;
  if (s === "running") return `<span class="inline-block border border-[#2D3139] bg-[#275DAD]/20 px-2 py-0.5 text-[10px]">RUNNING</span>`;
  if (s === "succeeded") return `<span class="inline-block border border-[#2D3139] bg-[#0A8F6A]/20 px-2 py-0.5 text-[10px]">DONE</span>`;
  if (s === "failed") return `<span class="inline-block border border-[#2D3139] bg-[#C44536]/20 px-2 py-0.5 text-[10px]">FAILED</span>`;
  return `<span class="inline-block border border-[#2D3139] bg-white/30 px-2 py-0.5 text-[10px] text-[#4A4F59]">N/A</span>`;
}

function fmtPct(v) {
  return `${(Number(v || 0) * 100).toFixed(1)}%`;
}

function fmtInt(v) {
  return Number(v || 0).toLocaleString("en-US");
}

function fmtRatioPct(part, total) {
  const n = Number(part || 0);
  const d = Number(total || 0);
  if (!d) return "0.0%";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function timelineActionLabel(kind) {
  const k = String(kind || "").trim().toLowerCase();
  if (k === "prereq_building") return "BUILDING";
  if (k === "upgrade") return "UPGRADE";
  if (k === "tech") return "TECH";
  if (k === "tech_unit_first_seen") return "TECH UNIT";
  if (k === "worker_drop") return "WORKER";
  if (k === "supply_swing") return "SUPPLY";
  if (k === "battle_cluster") return "BATTLE";
  return k ? k.toUpperCase() : "EVENT";
}

function timelineActionBadgeClass(kind) {
  const k = String(kind || "").trim().toLowerCase();
  if (k === "tech") return "bg-[#cfd8ea] text-[#274d88] border-[#274d88]";
  if (k === "upgrade") return "bg-[#e9e1c8] text-[#8b6e13] border-[#8b6e13]";
  if (k === "tech_unit_first_seen") return "bg-[#d8d0ea] text-[#5c3f88] border-[#5c3f88]";
  if (k === "worker_drop") return "bg-[#f1d6cf] text-[#9a4d2d] border-[#9a4d2d]";
  if (k === "supply_swing") return "bg-[#d8e6cf] text-[#3f6f2a] border-[#3f6f2a]";
  if (k === "battle_cluster") return "bg-[#ead0d0] text-[#8c3333] border-[#8c3333]";
  return "bg-[#ececed] text-[#4A4F59] border-[#4A4F59]";
}

function paginate(items, page, pageSize) {
  const rows = safeArray(items);
  const size = Math.max(1, Number(pageSize || 1));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(Math.max(1, Number(page || 1)), totalPages);
  const start = (currentPage - 1) * size;
  const end = Math.min(total, start + size);
  return {
    items: rows.slice(start, end),
    total,
    totalPages,
    currentPage,
    start,
    end,
  };
}

function timelinePagerInline(meta) {
  if (Number(meta?.total || 0) <= 0) return "";
  return `
    <div class="flex items-center gap-2 text-[10px] font-bold uppercase">
      <button
        type="button"
        data-timeline-page="prev"
        class="border border-[#2D3139] px-2 py-1 hover:bg-white/50 disabled:opacity-40"
        ${Number(meta.currentPage || 1) <= 1 ? "disabled" : ""}
      >
        Prev
      </button>
      <span class="text-[#4A4F59] min-w-24 text-center">${Number(meta.start || 0) + 1}-${Number(meta.end || 0)} / ${Number(meta.total || 0)}</span>
      <button
        type="button"
        data-timeline-page="next"
        class="border border-[#2D3139] px-2 py-1 hover:bg-white/50 disabled:opacity-40"
        ${Number(meta.currentPage || 1) >= Number(meta.totalPages || 1) ? "disabled" : ""}
      >
        Next
      </button>
    </div>
  `;
}

function winnerLabel(game) {
  const winnerTeam = Number(game?.winner_team || 0);
  if (winnerTeam <= 0) return "DRAW";
  return "WINNER";
}

function sideLabelForResult(result, isWinner) {
  const r = String(result || "").trim().toLowerCase();
  if (r === "win" || isWinner) return "WINNER";
  if (r === "loss" || r === "lose") return "LOSER";
  return "UNKNOWN";
}

function sideLabelForTeam(game, team) {
  const winnerTeam = Number(game?.winner_team || 0);
  if (winnerTeam <= 0 || !team) return `SIDE ${Number(team || 0)}`;
  return winnerTeam === Number(team) ? "WINNER" : "LOSER";
}

function sideChipClass(label) {
  if (label === "WINNER") return "winner-chip";
  if (label === "LOSER") return "loser-chip";
  return "unknown-chip";
}

function isSelectedPlayerName(name) {
  return String(state.selectedPlayer || "").trim().toLowerCase() === String(name || "").trim().toLowerCase();
}

function playerPickerCell(name, race, side) {
  const selected = isSelectedPlayerName(name);
  return `
    <button
      type="button"
      data-player-name="${escapeHtml(name || "")}"
      class="inline-flex max-w-full items-center gap-1.5 border px-2 py-1 text-left ${selected ? "bg-[#2D3139] text-[#E0E0E2] border-[#2D3139]" : "bg-white/70 text-[#2D3139] border-[#2D3139] hover:bg-white"}"
    >
      ${raceBadge(race || "")}
      <span class="truncate">${escapeHtml(name || "-")}</span>
      ${side ? `<span class="ml-1 inline-flex border px-1.5 py-0.5 text-[9px] font-bold ${selected ? "border-[#E0E0E2] text-[#E0E0E2]" : sideChipClass(side)}">${escapeHtml(side)}</span>` : ""}
    </button>
  `;
}

function categoryTotal(byCategory, name) {
  const row = safeArray(byCategory).find((item) => String(item?.category || "") === name);
  return Number(row?.total || 0);
}

function compareBarRow(label, teamA, teamB, pickValue, formatter = fmtInt) {
  const aValue = Number(pickValue(teamA) || 0);
  const bValue = Number(pickValue(teamB) || 0);
  const maxValue = Math.max(aValue, bValue, 1);
  const aWidth = (aValue / maxValue) * 100;
  const bWidth = (bValue / maxValue) * 100;
  const aLabel = sideLabelForTeam(state.selectedGame, teamA?.team);
  const bLabel = sideLabelForTeam(state.selectedGame, teamB?.team);
  return `
    <div class="ga-compare-row">
      <div class="ga-compare-label">${escapeHtml(label)}</div>
      <div class="ga-compare-bars">
        <div class="ga-compare-track">
          <div class="ga-compare-fill ga-compare-fill-a" style="width:${aWidth}%"></div>
          <div class="ga-compare-value"><span>${escapeHtml(aLabel)}</span><span>${escapeHtml(formatter(aValue))}</span></div>
        </div>
        <div class="ga-compare-track">
          <div class="ga-compare-fill ga-compare-fill-b" style="width:${bWidth}%"></div>
          <div class="ga-compare-value"><span>${escapeHtml(bLabel)}</span><span>${escapeHtml(formatter(bValue))}</span></div>
        </div>
      </div>
    </div>
  `;
}

function sparkline(points, valueKey, color, fillColor) {
  const rows = safeArray(points);
  if (!rows.length) {
    return `<div class="text-[11px] text-[#4A4F59]">NO_TIMELINE_DATA</div>`;
  }
  const width = 320;
  const height = 92;
  const padX = 6;
  const padY = 8;
  const maxValue = Math.max(1, ...rows.map((point) => Number(point?.[valueKey] || 0)));
  const maxSecond = Math.max(1, ...rows.map((point) => Number(point?.second || 0)));
  const line = rows.map((point, index) => {
    const x = padX + ((width - padX * 2) * Number(point?.second || index)) / maxSecond;
    const y = height - padY - ((height - padY * 2) * Number(point?.[valueKey] || 0)) / maxValue;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const area = `${line} L ${width - padX} ${height - padY} L ${padX} ${height - padY} Z`;
  return `
    <svg viewBox="0 0 ${width} ${height}" class="ga-spark-svg" preserveAspectRatio="none" aria-hidden="true">
      <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" class="ga-spark-axis"></line>
      <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" class="ga-spark-axis"></line>
      <path d="${area}" class="ga-spark-fill" fill="${fillColor}"></path>
      <path d="${line}" class="ga-spark-line" stroke="${color}"></path>
    </svg>
  `;
}

function multiSparkline(series, valueKey, selectedName) {
  const selectedKey = String(selectedName || "").trim().toLowerCase();
  const allRows = safeArray(series).filter((row) => safeArray(row?.points).length);
  const baseRows = allRows.filter((row) => selectedKey || !state.apmHiddenPlayers[String(row.name || "").trim().toLowerCase()]);
  const rows = selectedKey
    ? baseRows.filter((row) => String(row.name || "").trim().toLowerCase() === selectedKey)
    : baseRows;
  const visibleRows = rows.length ? rows : (selectedKey ? [] : allRows);
  if (!visibleRows.length) return `<div class="text-[#4A4F59] text-[10px]">NO_TIMELINE_DATA</div>`;

  const width = 720;
  const height = 240;
  const padX = 18;
  const padY = 16;
  const allPoints = visibleRows.flatMap((row) => safeArray(row.points).map((point) => ({
    x: Number(point?.frame || point?.second || 0),
    y: Number(point?.[valueKey] || 0),
  })));
  const xMax = Math.max(...allPoints.map((point) => point.x), 1);
  const yMax = Math.max(...allPoints.map((point) => point.y), 1);
  const xScale = (x) => padX + (x / xMax) * (width - padX * 2);
  const yScale = (y) => height - padY - (y / yMax) * (height - padY * 2);
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const grid = gridSteps.map((ratio) => {
    const y = height - padY - ratio * (height - padY * 2);
    const label = Math.round(yMax * ratio);
    return `
      <line x1="${padX}" y1="${y.toFixed(2)}" x2="${width - padX}" y2="${y.toFixed(2)}" class="ga-spark-grid"></line>
      <text x="${padX - 4}" y="${(y + 4).toFixed(2)}" class="ga-spark-y-label" text-anchor="end">${label}</text>
    `;
  }).join("");
  const paths = visibleRows.map((row, index) => {
    const points = safeArray(row.points);
    const d = points.map((point, pointIndex) => {
      const x = xScale(Number(point?.frame || point?.second || 0));
      const y = yScale(Number(point?.[valueKey] || 0));
      return `${pointIndex === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ");
    const color = row.color;
    const opacity = selectedKey ? 1 : 0.65;
    const strokeWidth = selectedKey ? 2.8 : 1.6;
    return `<path d="${d}" class="ga-spark-line" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}"></path>`;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="ga-spark-svg" preserveAspectRatio="none" aria-hidden="true">
      ${grid}
      <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" class="ga-spark-axis"></line>
      <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" class="ga-spark-axis"></line>
      ${paths}
    </svg>
  `;
}

function apmLegend(series, selectedName) {
  const selectedKey = String(selectedName || "").trim().toLowerCase();
  return `
    <div class="ga-apm-legend">
      ${safeArray(series).map((row) => {
        const key = String(row.name || "").trim().toLowerCase();
        const hidden = !selectedKey && !!state.apmHiddenPlayers[key];
        const selected = selectedKey && selectedKey === key;
        return `
          <button
            type="button"
            data-apm-toggle-player="${escapeHtml(row.name || "")}"
            class="ga-apm-legend-item ${hidden ? "ga-apm-legend-item-off" : ""} ${selected ? "ga-apm-legend-item-selected" : ""}"
          >
            <span class="ga-apm-legend-swatch" style="background:${row.color}"></span>
            ${raceBadge(row.race || "")}
            <span class="truncate">${escapeHtml(row.name || "-")}</span>
            <span class="inline-flex border px-1 py-0.5 text-[9px] font-bold ${sideChipClass(row.side)}">${escapeHtml(row.side)}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function buildOrderEvents(buildOrder) {
  const events = safeArray(buildOrder?.events);
  return events
    .filter((event) => {
      const type = String(event?.event_type || "").toLowerCase();
      return type === "build" || type === "train" || type === "tech" || type === "upgrade";
    })
    .filter((event) => Boolean(event?.unit || event?.tech || event?.upgrade))
    .slice(0, 18)
    .map((event) => ({
      second: Number(event?.frame || 0) / 23.8,
      kind: String(event?.event_type || ""),
      name: String(event?.unit || event?.tech || event?.upgrade || "-"),
    }));
}

function tableFromRows(headers, rows) {
  const head = headers.map((h) => `<th class="p-2 border-r border-[#2D3139]/30 last:border-r-0">${escapeHtml(h)}</th>`).join("");
  const body = rows.length
    ? rows.map((r) => `<tr class="border-b border-[#2D3139]/20">${r.map((c) => `<td class="p-2 border-r border-[#2D3139]/20 last:border-r-0">${c}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${headers.length}" class="p-2 text-[#4A4F59]">NO_DATA</td></tr>`;
  return `<div class="overflow-x-auto"><table class="w-full border-collapse"><thead><tr class="bg-[#D1D1D4] text-[10px] uppercase">${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function crownBadge() {
  return `<span class="ga-sg-impact-badge ga-sg-impact-crown" title="Best impact player">♛</span>`;
}

function skullBadge() {
  return `<span class="ga-sg-impact-badge ga-sg-impact-skull" title="Worst impact player">☠</span>`;
}

function matchupCompact(game) {
  const players = safeArray(game?.edges?.players);
  const byTeam = new Map();
  for (const p of players) {
    const team = Number(p.team || 0);
    if (!byTeam.has(team)) byTeam.set(team, []);
    byTeam.get(team).push(p);
  }
  const winnerTeam = Number(game?.winner_team || 0);
  const loserTeam = Array.from(byTeam.keys()).find((team) => team !== winnerTeam) || 0;
  const teamRaces = (team) => safeArray(byTeam.get(team)).map((p) => raceBadge(p.race)).join("");
  const winnerCount = winnerTeam ? safeArray(byTeam.get(winnerTeam)).length : 0;
  const loserCount = loserTeam ? safeArray(byTeam.get(loserTeam)).length : 0;
  const versus = winnerCount && loserCount ? `${loserCount}v${winnerCount}` : `${players.length}P`;
  return {
    versus,
    winnerRaces: teamRaces(winnerTeam),
    loserRaces: teamRaces(loserTeam),
  };
}

function buildStartGridPlayers(game) {
  const rawPlayers = safeArray(game?.edges?.players);
  const playerCards = safeArray(state.pageModel?.playerCards);
  const byName = new Map(playerCards.map((row) => [String(row.name || "").trim().toLowerCase(), row]));
  const prodRows = safeArray(state.pageModel?.raw?.detail?.unit_production?.summaries);
  const prodByName = new Map(prodRows.map((row) => [String(row.player_name || "").trim().toLowerCase(), row]));
  const ranked = rawPlayers.map((player) => {
    const key = String(player.name || "").trim().toLowerCase();
    return {
      ...player,
      card: byName.get(key) || null,
      production: prodByName.get(key) || null,
      sideLabel: sideLabelForResult(player.result, player.is_winner),
    };
  });

  const sortedByX = ranked.slice().sort((a, b) => {
    const ax = Number(a.start_location_x || 0);
    const bx = Number(b.start_location_x || 0);
    if (ax !== bx) return ax - bx;
    return Number(a.start_location_y || 0) - Number(b.start_location_y || 0);
  });
  const half = Math.ceil(sortedByX.length / 2);
  const left = sortedByX.slice(0, half).sort((a, b) => Number(a.start_location_y || 0) - Number(b.start_location_y || 0));
  const right = sortedByX.slice(half).sort((a, b) => Number(a.start_location_y || 0) - Number(b.start_location_y || 0));
  return { left, right };
}

function renderStartGridCard(player, hero) {
  if (!player) return `<div class="ga-sg-empty"><div class="ga-sg-empty-label"></div></div>`;
  const side = player.sideLabel;
  const sideClass = side === "WINNER" ? "ga-sg-card-winner" : side === "LOSER" ? "ga-sg-card-loser" : "ga-sg-card-unknown";
  const isKey = String(hero?.keyPlayerName || "").trim().toLowerCase() === String(player.name || "").trim().toLowerCase();
  const isWorst = String(hero?.worstPlayerName || "").trim().toLowerCase() === String(player.name || "").trim().toLowerCase();
  const isSelected = String(state.selectedPlayer || "").trim().toLowerCase() === String(player.name || "").trim().toLowerCase();
  const badge = isKey ? crownBadge() : isWorst ? skullBadge() : "";
  return `
    <button
      type="button"
      data-summary-player-name="${escapeHtml(player.name || "")}"
      class="ga-sg-card-surface ${sideClass} ${isSelected ? "ga-sg-card-selected" : ""}"
    >
      <div class="ga-sg-top">
        ${raceBadge(player.race)}
        <div class="ga-sg-name">${escapeHtml(player.name || "-")}</div>
        ${badge}
        <div class="ga-sg-result">${escapeHtml(side)}</div>
      </div>
    </button>
  `;
}

function renderMatchupBoard(game, hero) {
  const { left, right } = buildStartGridPlayers(game);
  const compact = matchupCompact(game);
  const rowCount = Math.max(left.length, right.length, 1);

  return `
    <div class="ga-sg-map-wrap col-span-2 md:col-span-4">
      <div class="ga-sg-grid" style="grid-template-rows: repeat(${rowCount}, 54px);">
        ${left.map((player, index) => `<div class="ga-sg-cell ga-sg-cell-left ga-sg-cell-row-${index + 1}">${renderStartGridCard(player, hero)}</div>`).join("")}
        <div class="ga-sg-cell ga-sg-center-cell" style="grid-column: 2; grid-row: 1 / span ${rowCount};">
          <div class="ga-sg-center-matchup">${escapeHtml(compact.versus)}</div>
          <div class="ga-sg-center-races">
            <div class="ga-sg-center-team">${compact.loserRaces || ""}</div>
            <div class="ga-sg-center-vs">vs</div>
            <div class="ga-sg-center-team">${compact.winnerRaces || ""}</div>
          </div>
          <div class="ga-sg-center-time-wrap">
            <div class="ga-sg-center-time-label">PLAY TIME</div>
            <div class="ga-sg-center-time">${escapeHtml(fmtGameTime(getGameLength(game)))}</div>
          </div>
        </div>
        ${right.map((player, index) => `<div class="ga-sg-cell ga-sg-cell-right ga-sg-cell-row-${index + 1}">${renderStartGridCard(player, hero)}</div>`).join("")}
      </div>
    </div>
  `;
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
    tr.innerHTML = `<td colspan="5" class="p-2 text-center text-[#4A4F59]">NO_GAMES</td>`;
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
      <td class="p-2 border-r border-[#2D3139]/30 text-center">${analysisBadge(state.analysisStatuses?.[g.id])}</td>
      <td class="p-2 border-r border-[#2D3139]/30 text-right">${fmtGameTime(getGameLength(g))}</td>
      <td class="p-2 text-right text-[#4A4F59]">${escapeHtml(fmtDate(g.start_time))}</td>
    `;
    tr.addEventListener("click", () => selectGame(Number(g.id)));
    gamesBodyEl.appendChild(tr);
  }
}

function renderAnalyzerJobStatus() {
  if (!analyzerJobStatusEl) return;
  const status = normalizeAnalysisJobStatus(state.selectedAnalysis?.status);
  const headline = state.pageModel?.hero?.headline || "";
  if (!state.selectedGame) {
    analyzerJobStatusEl.innerHTML = "SELECT_GAME_FIRST";
    return;
  }
  if (status === "not_requested") {
    analyzerJobStatusEl.innerHTML = "REPLAY_ANALYZER_STATUS: NOT_REQUESTED | 이 경기는 아직 replay analyzer 결과가 없습니다.";
    return;
  }
  if (status === "queued" || status === "running") {
    analyzerJobStatusEl.innerHTML = `REPLAY_ANALYZER_STATUS: ${status.toUpperCase()} | 분석 진행 중입니다. [Refresh Status] 버튼으로 갱신하세요.`;
    return;
  }
  if (status === "failed") {
    const err = escapeHtml(String(state.selectedAnalysis?.last_error || "unknown error"));
    analyzerJobStatusEl.innerHTML = `REPLAY_ANALYZER_STATUS: FAILED | ${err}`;
    return;
  }
  analyzerJobStatusEl.innerHTML = headline
    ? `REPLAY_ANALYZER_STATUS: DONE | ${escapeHtml(headline)}`
    : "REPLAY_ANALYZER_STATUS: DONE";
}

function getSelectedPlayerModel() {
  return state.pageModel?.selectedPlayer || null;
}

function getTeamRows() {
  return safeArray(state.pageModel?.hero?.teamRows);
}

function selectedTechEvents() {
  const detail = state.pageModel?.raw?.detail || null;
  const selected = getSelectedPlayerModel();
  if (!detail || !selected) return [];
  return safeArray(detail?.tech_tree?.events)
    .filter((ev) => String(ev?.player_name || "").trim().toLowerCase() === String(selected.name || "").trim().toLowerCase())
    .slice(0, 16);
}

function renderSummaryStrip() {
  const g = state.selectedGame;
  if (!g || !state.pageModel) {
    summaryEl.innerHTML = `<div class="border border-[#2D3139] bg-white/60 p-2 col-span-4">SELECT_GAME_FIRST</div>`;
    return;
  }
  const hero = state.pageModel.hero || {};
  summaryEl.innerHTML = `
    <div class="border border-[#2D3139] bg-white/60 p-2">MAP: ${escapeHtml(g.map_name || "-")}</div>
    <div class="border border-[#2D3139] bg-white/60 p-2">PLAY_TIME: ${fmtGameTime(getGameLength(g))}</div>
    <div class="border border-[#2D3139] bg-white/60 p-2">START: ${escapeHtml(fmtDate(g.start_time))}</div>
    <div class="border border-[#2D3139] bg-white/60 p-2 col-span-1 md:col-span-3">
      MATCH_STORY: ${escapeHtml(hero.headline || "-")}
    </div>
    ${renderMatchupBoard(g, hero)}
  `;
}

function renderPlayerTabs() {
  playerTabsEl.innerHTML = "";
  playerTabsEl.classList.add("hidden");
}

function renderMatchFlowTab() {
  const hero = state.pageModel?.hero || {};
  const allMarkers = safeArray(state.pageModel?.timeline?.techMarkers);
  const markerPage = paginate(allMarkers, state.timelinePage, state.timelinePageSize);
  const markers = markerPage.items;
  const teams = getTeamRows();
  const selectedPlayerName = String(state.selectedPlayer || "").trim().toLowerCase();
  const comparison = teams.length >= 2
    ? `
      <div class="space-y-2">
        ${compareBarRow("Kills", teams[0], teams[1], (team) => team.kills)}
        ${compareBarRow("Worker Peak", teams[0], teams[1], (team) => team.workerPeak)}
        ${compareBarRow("Total Spend", teams[0], teams[1], (team) => team.totalSpend)}
        ${compareBarRow("Tech + Upg", teams[0], teams[1], (team) => Number(team.techCount || 0) + Number(team.upgradeCount || 0))}
      </div>
    `
    : `<div class="text-[#4A4F59]">NO_TEAM_COMPARISON</div>`;

  return `
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div class="space-y-3">
        <div class="border border-[#2D3139] bg-white/60 p-3">
          <div class="text-[11px] uppercase text-[#4A4F59] mb-2">Match Story</div>
          <div class="text-[16px] font-bold leading-tight">${escapeHtml(hero.headline || "NO_MATCH_STORY")}</div>
        </div>
        <div class="border border-[#2D3139] bg-white/60 p-3">
          <div class="flex items-center justify-between gap-3 mb-2">
            <div class="text-[11px] uppercase text-[#4A4F59]">Key Timeline</div>
            ${timelinePagerInline(markerPage)}
          </div>
          <div class="border border-[#2D3139]/30 bg-white/70 divide-y divide-[#2D3139]/20">
            ${markers.length ? markers.map((marker) => `
              <button
                type="button"
                data-player-name="${escapeHtml(marker.playerName)}"
                class="an-overview-marker w-full text-left px-3 py-2 hover:bg-[#F7F7F8] ${String(marker.playerName || "").trim().toLowerCase() === selectedPlayerName ? "bg-[#2D3139]/6" : ""}"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span class="shrink-0 inline-flex items-center justify-center min-w-[56px] border border-[#2D3139] bg-white px-2 py-1 text-[10px] font-bold tracking-[0.08em]">
                    ${fmtGameTime(marker.second || 0)}
                  </span>
                  <span class="min-w-0 flex-1 text-[11px] font-bold truncate">
                    ${escapeHtml(marker.label || "-")}
                  </span>
                  <span class="min-w-0 hidden md:inline-flex items-center text-[10px] text-[#4A4F59] truncate">
                    ${escapeHtml(marker.playerName || "-")}
                  </span>
                  <span class="shrink-0 hidden sm:inline-flex border px-2 py-0.5 text-[9px] font-bold tracking-[0.08em] ${timelineActionBadgeClass(marker.kind)}">
                    ${timelineActionLabel(marker.kind)}
                  </span>
                  <span class="shrink-0 text-[9px] font-bold uppercase text-[#4A4F59]">
                    ${escapeHtml(sideLabelForTeam(state.selectedGame, marker.team))}
                  </span>
                </div>
                ${marker.subtitle ? `
                  <div class="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#4A4F59]">
                    <span class="truncate">${escapeHtml(marker.subtitle)}</span>
                  </div>
                ` : ""}
              </button>
            `).join("") : `<div class="p-3 text-[#4A4F59]">NO_TIMELINE_MARKERS</div>`}
          </div>
        </div>
      </div>
      <div class="border border-[#2D3139] bg-white/60 p-3">
        <div class="text-[11px] uppercase text-[#4A4F59] mb-2">Team Comparison</div>
        ${comparison}
      </div>
    </div>
  `;
}

function renderApmTab() {
  const detail = state.pageModel?.raw?.detail || null;
  const timelines = safeArray(detail?.detail?.apm_timeline);
  const selected = getSelectedPlayerModel();
  const playerCards = safeArray(state.pageModel?.playerCards);
  const playerByName = new Map(playerCards.map((row) => [String(row.name || "").trim().toLowerCase(), row]));
  const apmStats = (points) => {
    const rows = safeArray(points).map((point) => Number(point?.apm || 0)).filter((value) => Number.isFinite(value));
    if (!rows.length) return { avg: 0, max: 0 };
    const total = rows.reduce((acc, value) => acc + value, 0);
    return {
      avg: total / rows.length,
      max: Math.max(...rows),
    };
  };
  const apmSeries = timelines.map((row) => {
    const name = String(row.player_name || "-");
    const card = playerByName.get(name.trim().toLowerCase()) || null;
    const side = sideLabelForResult(card?.result, card?.isWinner);
    const palette = ["#1F77B4", "#D62728", "#2CA02C", "#9467BD", "#FF7F0E", "#17BECF", "#8C564B", "#E377C2"];
    return {
      name,
      race: card?.race || "",
      side,
      color: palette[timelines.findIndex((item) => String(item.player_name || "-") === name) % palette.length],
      points: safeArray(row.data_points),
    };
  });

  return `
    <div class="space-y-3">
      <div class="grid grid-cols-1 xl:grid-cols-[1.4fr,0.8fr] gap-3">
        <div class="border border-[#2D3139] bg-white/60 p-3">
          <div class="text-[11px] uppercase text-[#4A4F59] mb-2">APM Table</div>
          ${tableFromRows(
            ["PLAYER", "AVG_APM", "MAX_APM", "INPUT EFFICIENCY"],
            timelines.map((row) => {
              const card = playerByName.get(String(row.player_name || "").trim().toLowerCase()) || null;
              const stats = apmStats(row.data_points);
              const side = sideLabelForResult(card?.result, card?.isWinner);
              return [
                playerPickerCell(String(row.player_name || "-"), card?.race || "", side),
                escapeHtml(Number(stats.avg || 0).toFixed(1)),
                escapeHtml(Number(stats.max || 0).toFixed(1)),
                escapeHtml(fmtRatioPct(card?.effectiveCmdCount || 0, card?.cmdCount || 0)),
              ];
            }),
          )}
        </div>
        <div class="ga-spark-wrap">
          <div class="ga-spark-header">
            <div class="ga-spark-title">${selected?.name ? "Selected Player APM" : "All Players APM"}</div>
            <div class="ga-spark-value">${selected?.name ? escapeHtml(selected.name) : "ALL PLAYERS"}</div>
          </div>
          ${apmLegend(apmSeries, selected?.name || "")}
          ${multiSparkline(apmSeries, "apm", selected?.name || "")}
        </div>
      </div>
    </div>
  `;
}

function renderEconomyTab() {
  const selected = getSelectedPlayerModel();
  const detail = state.pageModel?.raw?.detail || null;
  const spendRows = safeArray(detail?.resource_spend?.summaries);
  const spendPoints = safeArray(selected?.spendTimeline?.data_points);
  const playerCards = safeArray(state.pageModel?.playerCards);
  const playerByName = new Map(playerCards.map((row) => [String(row.name || "").trim().toLowerCase(), row]));

  return `
    <div class="space-y-3">
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div class="border border-[#2D3139] bg-white/60 p-3">
          <div class="text-[11px] uppercase text-[#4A4F59] mb-2">All Players Spend Summary</div>
          ${tableFromRows(
            ["PLAYER", "MINERAL", "GAS", "TOTAL", "BUILD", "PROD", "TECH", "UPG"],
            spendRows.map((row) => {
              const card = playerByName.get(String(row.player_name || "").trim().toLowerCase()) || null;
              const side = sideLabelForResult(card?.result, card?.isWinner);
              return [
              playerPickerCell(String(row.player_name || "-"), card?.race || "", side),
              fmtInt(row.total_mineral || 0),
              fmtInt(row.total_gas || 0),
              fmtInt(row.total_spend || 0),
              fmtInt(categoryTotal(row.by_category, "build")),
              fmtInt(categoryTotal(row.by_category, "production")),
              fmtInt(categoryTotal(row.by_category, "tech")),
              fmtInt(categoryTotal(row.by_category, "upgrade")),
            ];
            }),
          )}
        </div>
        <div class="ga-spark-wrap">
          <div class="ga-spark-header">
            <div class="ga-spark-title">Selected Player Spend Curve</div>
            <div class="ga-spark-value">${escapeHtml(selected?.name || "SELECT PLAYER")}</div>
          </div>
          ${selected ? sparkline(spendPoints, "total", "#0A8F6A", "#0A8F6A") : `<div class="text-[10px] text-[#4A4F59]">Select a player from any table, timeline, or 3x3 board.</div>`}
        </div>
      </div>
    </div>
  `;
}

function renderProductionTab() {
  const selected = getSelectedPlayerModel();
  const detail = state.pageModel?.raw?.detail || null;
  const rows = safeArray(detail?.unit_production?.summaries);
  const prod = selected?.productionSummary || {};
  const points = safeArray(selected?.productionTimeline?.data_points);
  const topUnits = safeArray(prod.by_unit).slice(0, 8);
  const playerCards = safeArray(state.pageModel?.playerCards);
  const playerByName = new Map(playerCards.map((row) => [String(row.name || "").trim().toLowerCase(), row]));

  return `
    <div class="space-y-3">
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div class="ga-spark-wrap">
          <div class="ga-spark-header">
            <div class="ga-spark-title">Selected Player Production Curve</div>
            <div class="ga-spark-value">${escapeHtml(selected?.name || "SELECT PLAYER")}</div>
          </div>
          ${selected ? sparkline(points, "count", "#C44536", "#C44536") : `<div class="text-[10px] text-[#4A4F59]">Select a player from any table, timeline, or 3x3 board.</div>`}
        </div>
        <div class="border border-[#2D3139] bg-white/60 p-3 text-[11px]">
          <div class="uppercase text-[#4A4F59] mb-2">Production Profile</div>
          ${selected ? `
            <div>Total: <span class="font-bold">${fmtInt(prod.total || 0)}</span></div>
            <div>Worker: <span class="font-bold">${fmtInt(prod.worker || 0)}</span></div>
            <div>Army: <span class="font-bold">${fmtInt(prod.army || 0)}</span></div>
            <div>Tech Unit: <span class="font-bold">${fmtInt(prod.tech_unit || 0)}</span></div>
            <div class="mt-2 text-[#4A4F59]">Top Units</div>
            <div class="mt-1 flex flex-wrap gap-1">
              ${topUnits.length ? topUnits.map((unit) => `<span class="border border-[#2D3139] bg-white px-2 py-1">${escapeHtml(unit.unit)} x${fmtInt(unit.count)}</span>`).join("") : `<span class="text-[#4A4F59]">NO_UNIT_BREAKDOWN</span>`}
            </div>
          ` : `<div class="text-[10px] text-[#4A4F59]">No player selected. Choose a player to inspect production profile.</div>`}
        </div>
      </div>
      <div class="border border-[#2D3139] bg-white/60 p-3">
        <div class="text-[11px] uppercase text-[#4A4F59] mb-2">All Players Production Summary</div>
        ${tableFromRows(
          ["PLAYER", "TOTAL", "WORKER", "ARMY", "TECH_UNIT"],
          rows.map((row) => {
            const card = playerByName.get(String(row.player_name || "").trim().toLowerCase()) || null;
            const side = sideLabelForResult(card?.result, card?.isWinner);
            return [
            playerPickerCell(String(row.player_name || "-"), card?.race || "", side),
            fmtInt(row.total || 0),
            fmtInt(row.worker || 0),
            fmtInt(row.army || 0),
            fmtInt(row.tech_unit || 0),
          ];
          }),
        )}
      </div>
    </div>
  `;
}

function renderTechTab() {
  const selected = getSelectedPlayerModel();
  const techRows = selectedTechEvents();
  const buildRows = buildOrderEvents(selected?.buildOrder);
  const detail = state.pageModel?.raw?.detail || null;
  const allSummaries = safeArray(detail?.tech_tree?.summary);
  const playerCards = safeArray(state.pageModel?.playerCards);
  const playerByName = new Map(playerCards.map((row) => [String(row.name || "").trim().toLowerCase(), row]));

  return `
    <div class="space-y-3">
      <div class="border border-[#2D3139] bg-white/60 p-3">
        <div class="text-[11px] uppercase text-[#4A4F59] mb-2">Build Order Timeline</div>
        ${buildRows.length ? `
          <div class="ga-build-strip">
            ${buildRows.map((event) => `
              <div class="ga-build-chip">
                <div class="ga-build-time">${fmtGameTime(event.second)}</div>
                <div class="ga-build-name">${escapeHtml(event.name)}</div>
                <div class="ga-build-kind">${escapeHtml(event.kind)}</div>
              </div>
            `).join("")}
          </div>
        ` : `<div class="text-[#4A4F59]">NO_BUILD_ORDER_EVENTS</div>`}
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div class="border border-[#2D3139] bg-white/60 p-3">
          <div class="text-[11px] uppercase text-[#4A4F59] mb-2">Selected Player Tech Events</div>
          ${selected ? tableFromRows(
            ["TYPE", "NAME", "TIME", "QUALITY"],
            techRows.map((row) => [
              escapeHtml(String(row.kind || "-")),
              escapeHtml(String(row.name || "-")),
              escapeHtml(`${Number(row.second || 0).toFixed(1)}s`),
              escapeHtml(String(row.quality || "-")),
            ]),
          ) : `<div class="text-[10px] text-[#4A4F59]">Select a player from any table, timeline, or 3x3 board.</div>`}
        </div>
        <div class="border border-[#2D3139] bg-white/60 p-3">
          <div class="text-[11px] uppercase text-[#4A4F59] mb-2">All Players Tech Summary</div>
          ${tableFromRows(
            ["PLAYER", "TECH", "UPGRADE", "PREREQ", "CANCEL", "INEFF"],
            allSummaries.map((row) => {
              const card = playerByName.get(String(row.player_name || "").trim().toLowerCase()) || null;
              const side = sideLabelForResult(card?.result, card?.isWinner);
              return [
              playerPickerCell(String(row.player_name || "-"), card?.race || "", side),
              fmtInt(row.tech_count || 0),
              fmtInt(row.upgrade_count || 0),
              fmtInt(row.prereq_build_count || 0),
              fmtInt(row.cancel_count || 0),
              fmtInt(row.ineff_count || 0),
            ];
            }),
          )}
        </div>
      </div>
    </div>
  `;
}

function renderCombatTab() {
  const selected = getSelectedPlayerModel();
  const cards = safeArray(state.pageModel?.playerCards);
  const metrics = selected?.metrics || {};

  return `
    <div class="space-y-3">
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div class="border border-[#2D3139] bg-white/60 p-3 text-[11px]">
          <div class="uppercase text-[#4A4F59] mb-2">Selected Player Combat Snapshot</div>
          ${selected ? `
            <div>K / D / KDR: <span class="font-bold">${fmtInt(metrics.kills || 0)} / ${fmtInt(metrics.deaths || 0)} / ${Number(metrics.kdr || 0)}</span></div>
            <div>Vision Score: <span class="font-bold">${Number(metrics.visionScore || 0).toFixed(1)}</span></div>
            <div>Enemy Zone Coverage: <span class="font-bold">${fmtPct(metrics.enemyZoneCoverage || 0)}</span></div>
            <div>Self Deaths: <span class="font-bold">${fmtInt(metrics.selfDeaths || 0)}</span></div>
            <div>Friendly Fire Kills: <span class="font-bold">${fmtInt(metrics.friendlyFireKills || 0)}</span></div>
            <div>Unattributed Deaths: <span class="font-bold">${fmtInt(metrics.unattributedDeaths || 0)}</span></div>
          ` : `<div class="text-[10px] text-[#4A4F59]">Select a player from any table, timeline, or 3x3 board.</div>`}
        </div>
        <div class="border border-[#2D3139] bg-white/60 p-3 text-[11px]">
          <div class="uppercase text-[#4A4F59] mb-2">Interpretation</div>
          <div class="leading-relaxed">${selected ? (safeArray(selected?.insights).length ? escapeHtml(selected.insights.join(" ")) : "NO_PLAYER_INTERPRETATION") : "Select a player to read an individual interpretation."}</div>
        </div>
      </div>
      <div class="border border-[#2D3139] bg-white/60 p-3">
        <div class="text-[11px] uppercase text-[#4A4F59] mb-2">All Players Combat Table</div>
        ${tableFromRows(
          ["PLAYER", "SIDE", "K", "D", "KDR", "VISION", "WORKER", "SUPPLY", "ENEMY_ZONE"],
          cards.map((row) => [
            playerPickerCell(row.name, row.race, sideLabelForResult(row.result, row.isWinner)),
            escapeHtml(sideLabelForResult(row.result, row.isWinner)),
            fmtInt(row.kills || 0),
            fmtInt(row.deaths || 0),
            escapeHtml(String(row.kdr || 0)),
            escapeHtml(Number(row.visionScore || 0).toFixed(1)),
            fmtInt(row.workerPeak || 0),
            fmtInt(row.supplyPeak || 0),
            escapeHtml(fmtPct(row.enemyZoneCoverage || 0)),
          ]),
        )}
      </div>
    </div>
  `;
}

function renderWorkspace() {
  if (!tabContentEl) return;
  if (!state.selectedGame || !state.pageModel) {
    tabContentEl.innerHTML = `<div class="text-[#4A4F59]">SELECT_GAME_FIRST</div>`;
    return;
  }

  if (state.activeTab === "economy") {
    tabContentEl.innerHTML = renderEconomyTab();
  } else if (state.activeTab === "apm") {
    tabContentEl.innerHTML = renderApmTab();
  } else if (state.activeTab === "production") {
    tabContentEl.innerHTML = renderProductionTab();
  } else if (state.activeTab === "tech") {
    tabContentEl.innerHTML = renderTechTab();
  } else if (state.activeTab === "combat") {
    tabContentEl.innerHTML = renderCombatTab();
  } else {
    tabContentEl.innerHTML = renderMatchFlowTab();
  }

  tabContentEl.querySelectorAll("[data-player-name]").forEach((btn) => {
    btn.addEventListener("click", () => setSelectedPlayer(btn.getAttribute("data-player-name") || ""));
  });
  tabContentEl.querySelectorAll("[data-apm-toggle-player]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = String(btn.getAttribute("data-apm-toggle-player") || "").trim().toLowerCase();
      if (!name || state.selectedPlayer) {
        setSelectedPlayer(btn.getAttribute("data-apm-toggle-player") || "");
        return;
      }
      state.apmHiddenPlayers[name] = !state.apmHiddenPlayers[name];
      renderWorkspace();
    });
  });
  tabContentEl.querySelectorAll("[data-timeline-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-timeline-page");
      if (dir === "prev" && state.timelinePage > 1) {
        state.timelinePage -= 1;
        renderWorkspace();
      }
      if (dir === "next") {
        const total = safeArray(state.pageModel?.timeline?.techMarkers).length;
        const totalPages = Math.max(1, Math.ceil(total / state.timelinePageSize));
        if (state.timelinePage < totalPages) {
          state.timelinePage += 1;
          renderWorkspace();
        }
      }
    });
  });
}

function renderPlayerPanel() {
  const selected = getSelectedPlayerModel();
  if (!selected) {
    const hero = state.pageModel?.hero || {};
    playerPanelEl.innerHTML = `
      <div class="border border-[#2D3139] bg-white/60 p-3 text-[11px]">
        <div class="uppercase text-[#4A4F59] mb-2">All Players</div>
        <div class="leading-relaxed text-[#4A4F59]">No player selected. Click any player id in the 3x3 board, timeline, or tables to focus that player. Click the same player again to clear selection.</div>
        <div class="mt-3">Key Player: <span class="font-bold">${escapeHtml(hero.keyPlayerName || "-")}</span></div>
        <div>Worst Impact: <span class="font-bold">${escapeHtml(hero.worstPlayerName || "-")}</span></div>
      </div>
    `;
    return;
  }
  const metrics = selected.metrics || {};
  const spend = selected.spendSummary || {};
  const prod = selected.productionSummary || {};
  const tech = selected.techSummary || {};
  const apmPoints = safeArray(selected.apmTimeline?.data_points);
  const apmAvg = apmPoints.length ? (apmPoints.reduce((acc, p) => acc + Number(p.apm || 0), 0) / apmPoints.length).toFixed(1) : "0.0";

  playerPanelEl.innerHTML = `
    <div class="grid grid-cols-2 gap-2">
      <div class="border border-[#2D3139] bg-white/60 p-2">NAME: ${raceBadge(selected.race)}${escapeHtml(selected.name)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">RACE: ${escapeHtml(raceLetter(selected.race))}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">SIDE: ${escapeHtml(sideLabelForResult(selected.result, selected.result === "win"))}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">RESULT: ${escapeHtml(selected.result || "unknown")}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">APM/EAPM: ${fmtInt(metrics.apm || 0)} / ${fmtInt(metrics.eapm || 0)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">Input Efficiency: ${escapeHtml(fmtRatioPct(metrics.effectiveCmdCount || 0, metrics.cmdCount || 0))}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">Total Inputs: ${fmtInt(metrics.cmdCount || 0)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">Useful Inputs: ${fmtInt(metrics.effectiveCmdCount || 0)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">REDUNDANCY: ${fmtInt(metrics.redundancy || 0)}%</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">K / D / KDR: ${fmtInt(metrics.kills || 0)} / ${fmtInt(metrics.deaths || 0)} / ${Number(metrics.kdr || 0)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">APM AVG: ${escapeHtml(apmAvg)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">WORKER / SUPPLY: ${fmtInt(metrics.workerPeak || 0)} / ${fmtInt(metrics.supplyPeak || 0)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">VISION: ${Number(metrics.visionScore || 0).toFixed(1)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">SPEND: ${fmtInt(spend.total_spend || 0)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">PRODUCTION: ${fmtInt(prod.total || 0)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">TECH / UPGRADE: ${fmtInt(tech.tech_count || 0)} / ${fmtInt(tech.upgrade_count || 0)}</div>
      <div class="border border-[#2D3139] bg-white/60 p-2">ENEMY ZONE: ${escapeHtml(fmtPct(metrics.enemyZoneCoverage || 0))}</div>
    </div>
    <div class="mt-3 border border-[#2D3139] bg-white/60 p-3">
      <div class="text-[10px] uppercase text-[#4A4F59] mb-2">Player Read</div>
      <div class="text-[11px] leading-relaxed">${safeArray(selected.insights).length ? escapeHtml(selected.insights.join(" ")) : "NO_PLAYER_INTERPRETATION"}</div>
    </div>
  `;
}

function renderEventInspector() {
  if (!eventInspectorEl) return;
  const selected = getSelectedPlayerModel();
  const detail = state.pageModel?.raw?.detail || null;
  if (!detail) {
    eventInspectorEl.innerHTML = "<div class='text-[#4A4F59]'>NO_EVENT_DATA</div>";
    return;
  }
  const allRows = safeArray(detail?.tech_tree?.events);
  const filtered = selected
    ? allRows.filter((row) => String(row?.player_name || "").trim().toLowerCase() === String(selected.name || "").trim().toLowerCase())
    : allRows;

  eventInspectorEl.innerHTML = tableFromRows(
    ["PLAYER", "TYPE", "NAME", "TIME", "QUALITY"],
    filtered.slice(0, 24).map((row) => [
      playerPickerCell(String(row.player_name || "-"), "", ""),
      escapeHtml(String(row.kind || "-")),
      escapeHtml(String(row.name || "-")),
      escapeHtml(`F:${Number(row.frame || 0)} (${Number(row.second || 0).toFixed(1)}s)`),
      escapeHtml(String(row.quality || "-")),
    ]),
  );
}

function renderPage() {
  renderSummaryStrip();
  renderAnalyzerJobStatus();
  renderPlayerTabs();
  summaryEl.querySelectorAll("[data-summary-player-name]").forEach((btn) => {
    btn.addEventListener("click", () => setSelectedPlayer(btn.getAttribute("data-summary-player-name") || ""));
  });
  renderWorkspace();
  renderPlayerPanel();
  renderEventInspector();
}

function setSelectedPlayer(name) {
  const next = String(name || "").trim();
  const current = String(state.selectedPlayer || "").trim();
  state.selectedPlayer = current && current.toLowerCase() === next.toLowerCase() ? "" : next;
  if (!state.selectedPlayer) {
    state.apmHiddenPlayers = {};
  }
  if (window.GameAnalyzerPageModel) {
    state.pageModel = window.GameAnalyzerPageModel.buildGameAnalyzerPageModel({
      game: state.selectedGame,
      detail: state.selectedDetail,
      analyzer: state.selectedAnalysis,
      selectedPlayerName: state.selectedPlayer,
    });
  }
  renderPage();
}

function setActiveTab(tab) {
  state.activeTab = tab;
  if (tab === "match-flow") {
    state.timelinePage = 1;
  }
  vizTabsEl.querySelectorAll("[data-an-tab]").forEach((btn) => {
    const active = btn.getAttribute("data-an-tab") === tab;
    btn.classList.toggle("bg-[#2D3139]", active);
    btn.classList.toggle("text-[#E0E0E2]", active);
    btn.classList.toggle("bg-white/60", !active);
  });
  renderWorkspace();
}

async function selectGame(id) {
  state.selectedGameId = Number(id);
  state.timelinePage = 1;
  state.apmHiddenPlayers = {};
  renderGames();
  summaryEl.innerHTML = "<div class='border border-[#2D3139] bg-white/60 p-2 col-span-4'>LOADING_GAME...</div>";
  renderAnalyzerJobStatus();

  try {
    const [gRes, dRes, aRes] = await Promise.all([
      api(`/api/v1/games/${id}`),
      api(`/api/v1/games/${id}/detail`),
      api(`/api/v1/games/${id}/analyzer`),
    ]);
    state.selectedGame = gRes.game || null;
    state.selectedDetail = dRes || null;
    state.selectedAnalysis = aRes || null;
    const players = safeArray(state.selectedGame?.edges?.players);
    if (!players.some((p) => p.name === state.selectedPlayer)) {
      state.selectedPlayer = "";
    }

    if (window.GameAnalyzerPageModel) {
      state.pageModel = window.GameAnalyzerPageModel.buildGameAnalyzerPageModel({
        game: state.selectedGame,
        detail: state.selectedDetail,
        analyzer: state.selectedAnalysis,
        selectedPlayerName: state.selectedPlayer,
      });
    } else {
      state.pageModel = null;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("game_id", String(id));
    window.history.replaceState({}, "", url.toString());

    renderPage();
  } catch (err) {
    summaryEl.innerHTML = `<div class='border border-[#8a2f2f] bg-[#f2d9d9] p-2 col-span-4'>ERROR_LOAD_GAME: ${escapeHtml(err.message)}</div>`;
    analyzerJobStatusEl.innerHTML = `<span class="text-[#8a2f2f]">ERROR_LOAD_ANALYZER_STATUS: ${escapeHtml(err.message)}</span>`;
    playerTabsEl.innerHTML = "";
    tabContentEl.innerHTML = "";
    playerPanelEl.innerHTML = "";
    eventInspectorEl.innerHTML = "";
    state.pageModel = null;
  }
}

async function loadGames() {
  const user = getCurrentUser();
  const offset = (state.page - 1) * state.pageSize;
  const q = user ? `&user_name=${encodeURIComponent(user)}` : "";
  const data = await api(`/api/v1/games?limit=${state.pageSize}&offset=${offset}${q}`);
  state.games = Array.isArray(data.games) ? data.games : [];
  state.analysisStatuses = data.analysis_statuses || {};
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
    analyzerJobStatusEl.innerHTML = "NO_GAMES_FOR_ANALYZER";
    playerTabsEl.innerHTML = "";
    tabContentEl.innerHTML = "";
    playerPanelEl.innerHTML = "";
    eventInspectorEl.innerHTML = "";
  }
}

refreshGamesEl.addEventListener("click", () => loadGames());
if (refreshStatusEl) {
  refreshStatusEl.addEventListener("click", async () => {
    const id = Number(state.selectedGameId || 0);
    if (!id) return;
    analyzerJobStatusEl.innerHTML = "REFRESHING_ANALYZER_STATUS...";
    try {
      state.selectedAnalysis = await api(`/api/v1/games/${id}/analyzer`);
      if (window.GameAnalyzerPageModel) {
        state.pageModel = window.GameAnalyzerPageModel.buildGameAnalyzerPageModel({
          game: state.selectedGame,
          detail: state.selectedDetail,
          analyzer: state.selectedAnalysis,
          selectedPlayerName: state.selectedPlayer,
        });
      }
      renderPage();
      await loadGames();
    } catch (err) {
      analyzerJobStatusEl.innerHTML = `<span class="text-[#8a2f2f]">ERROR_REFRESH_ANALYZER_STATUS: ${escapeHtml(err.message)}</span>`;
    }
  });
}

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

vizTabsEl.querySelectorAll("[data-an-tab]").forEach((btn) => {
  btn.addEventListener("click", () => setActiveTab(btn.getAttribute("data-an-tab") || "match-flow"));
});

renderCurrentUser();
setActiveTab(state.activeTab);
loadGames();
