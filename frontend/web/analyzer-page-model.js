(function () {
  function toNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function asArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function lower(v) {
    return String(v || "").trim().toLowerCase();
  }

  function normalizeStatus(v) {
    const s = lower(v);
    if (s === "queued" || s === "running" || s === "succeeded" || s === "failed") return s;
    return "not_requested";
  }

  function sumBy(items, fn) {
    return asArray(items).reduce((acc, item) => acc + toNumber(fn(item), 0), 0);
  }

  function buildPlayerIndexes(gamePlayers) {
    const byPlayerId = new Map();
    const byName = new Map();
    for (const p of asArray(gamePlayers)) {
      const playerId = toNumber(p && p.player_id, -1);
      if (playerId >= 0) byPlayerId.set(playerId, p);
      const key = lower(p && p.name);
      if (key) byName.set(key, p);
    }
    return { byPlayerId, byName };
  }

  function findByPlayerName(rows, playerName) {
    const key = lower(playerName);
    return asArray(rows).find((row) => lower(row && (row.player_name || row.playerName || row.name)) === key) || null;
  }

  function findApmTimeline(detail, playerName) {
    return asArray(detail && detail.detail && detail.detail.apm_timeline).find((row) => lower(row && row.player_name) === lower(playerName)) || null;
  }

  function findSpendTimeline(detail, playerName) {
    return asArray(detail && detail.resource_spend && detail.resource_spend.timelines).find((row) => lower(row && row.player_name) === lower(playerName)) || null;
  }

  function findProductionTimeline(detail, playerName) {
    return asArray(detail && detail.unit_production && detail.unit_production.timelines).find((row) => lower(row && row.player_name) === lower(playerName)) || null;
  }

  function findAnalyzerTimeseries(analyzer, playerId, playerName) {
    const rows = asArray(analyzer && analyzer.result && analyzer.result.player_timeseries && analyzer.result.player_timeseries.players);
    return rows.find((row) => toNumber(row && row.player_id, -1) === toNumber(playerId, -2))
      || rows.find((row) => lower(row && row.player_name) === lower(playerName))
      || null;
  }

  function findBuildOrder(detail, playerName) {
    const raw = asArray(detail && detail.detail && detail.detail.compressed_build_orders);
    const fallback = asArray(detail && detail.detail && detail.detail.build_orders);
    const rows = raw.length ? raw : fallback;
    return rows.find((row) => lower(row && row.player_name) === lower(playerName)) || null;
  }

  function buildMappedPlayers(game, detail, analyzer) {
    const gamePlayers = asArray(game && game.edges && game.edges.players);
    const analysisPlayers = asArray(analyzer && analyzer.result && analyzer.result.summary && analyzer.result.summary.players);
    const spendSummaries = asArray(detail && detail.resource_spend && detail.resource_spend.summaries);
    const prodSummaries = asArray(detail && detail.unit_production && detail.unit_production.summaries);
    const techSummaries = asArray(detail && detail.tech_tree && detail.tech_tree.summary);
    const indexes = buildPlayerIndexes(gamePlayers);
    const mapped = [];

    for (const ap of analysisPlayers) {
      const playerId = toNumber(ap && ap.player_id, -1);
      const gp = indexes.byPlayerId.get(playerId) || null;
      const name = (gp && gp.name) || `Player ${playerId + 1}`;
      mapped.push({
        key: String(playerId >= 0 ? playerId : lower(name)),
        playerId,
        name,
        race: (gp && gp.race) || "",
        team: toNumber(gp && gp.team, 0),
        result: (gp && gp.result) || "",
        isWinner: !!(gp && gp.is_winner),
        apm: toNumber(gp && gp.apm, 0),
        eapm: toNumber(gp && gp.eapm, 0),
        cmdCount: toNumber(gp && gp.cmd_count, 0),
        effectiveCmdCount: toNumber(gp && gp.effective_cmd_count, 0),
        redundancy: toNumber(gp && gp.redundancy, 0),
        analysisFinal: ap && ap.final ? ap.final : {},
        spendSummary: findByPlayerName(spendSummaries, name),
        spendTimeline: findSpendTimeline(detail, name),
        productionSummary: findByPlayerName(prodSummaries, name),
        productionTimeline: findProductionTimeline(detail, name),
        techSummary: findByPlayerName(techSummaries, name),
        apmTimeline: findApmTimeline(detail, name),
        buildOrder: findBuildOrder(detail, name),
        analyzerTimeseries: findAnalyzerTimeseries(analyzer, playerId, name),
      });
    }

    for (const gp of gamePlayers) {
      const playerId = toNumber(gp && gp.player_id, -1);
      const exists = mapped.some((row) => row.playerId === playerId || lower(row.name) === lower(gp && gp.name));
      if (exists) continue;
      const name = String(gp && gp.name || `Player ${playerId + 1}`);
      mapped.push({
        key: String(playerId >= 0 ? playerId : lower(name)),
        playerId,
        name,
        race: gp && gp.race || "",
        team: toNumber(gp && gp.team, 0),
        result: gp && gp.result || "",
        isWinner: !!(gp && gp.is_winner),
        apm: toNumber(gp && gp.apm, 0),
        eapm: toNumber(gp && gp.eapm, 0),
        cmdCount: toNumber(gp && gp.cmd_count, 0),
        effectiveCmdCount: toNumber(gp && gp.effective_cmd_count, 0),
        redundancy: toNumber(gp && gp.redundancy, 0),
        analysisFinal: {},
        spendSummary: findByPlayerName(spendSummaries, name),
        spendTimeline: findSpendTimeline(detail, name),
        productionSummary: findByPlayerName(prodSummaries, name),
        productionTimeline: findProductionTimeline(detail, name),
        techSummary: findByPlayerName(techSummaries, name),
        apmTimeline: findApmTimeline(detail, name),
        buildOrder: findBuildOrder(detail, name),
        analyzerTimeseries: findAnalyzerTimeseries(analyzer, playerId, name),
      });
    }

    return mapped;
  }

  function buildTeamMap(mappedPlayers, summaryTeams) {
    const map = new Map();
    for (const p of mappedPlayers) {
      const team = toNumber(p.team, 0);
      if (!map.has(team)) {
        map.set(team, {
          team,
          players: [],
          kills: 0,
          deaths: 0,
          workerPeak: 0,
          supplyPeak: 0,
          visionScore: 0,
          totalSpend: 0,
          totalMineral: 0,
          totalGas: 0,
          techCount: 0,
          upgradeCount: 0,
          armyProduced: 0,
          workerProduced: 0,
          techUnitProduced: 0,
        });
      }
      const teamRow = map.get(team);
      const final = p.analysisFinal || {};
      const spend = p.spendSummary || {};
      const tech = p.techSummary || {};
      const prod = p.productionSummary || {};
      teamRow.players.push(p);
      teamRow.kills += toNumber(final.kills, 0);
      teamRow.deaths += toNumber(final.deaths, 0);
      teamRow.workerPeak += toNumber(final.worker_peak, 0);
      teamRow.supplyPeak += toNumber(final.supply_peak_used, 0);
      teamRow.visionScore += toNumber(final.vision_score_final, 0);
      teamRow.totalSpend += toNumber(spend.total_spend, 0);
      teamRow.totalMineral += toNumber(spend.total_mineral, 0);
      teamRow.totalGas += toNumber(spend.total_gas, 0);
      teamRow.techCount += toNumber(tech.tech_count, 0);
      teamRow.upgradeCount += toNumber(tech.upgrade_count, 0);
      teamRow.armyProduced += toNumber(prod.army, 0);
      teamRow.workerProduced += toNumber(prod.worker, 0);
      teamRow.techUnitProduced += toNumber(prod.tech_unit, 0);
    }

    for (const teamSummary of asArray(summaryTeams)) {
      const team = toNumber(teamSummary && teamSummary.team, 0);
      if (!map.has(team)) {
        map.set(team, {
          team,
          players: [],
          kills: toNumber(teamSummary && teamSummary.kills, 0),
          deaths: toNumber(teamSummary && teamSummary.deaths, 0),
          workerPeak: 0,
          supplyPeak: 0,
          visionScore: 0,
          totalSpend: 0,
          totalMineral: 0,
          totalGas: 0,
          techCount: 0,
          upgradeCount: 0,
          armyProduced: 0,
          workerProduced: 0,
          techUnitProduced: 0,
        });
      } else {
        const row = map.get(team);
        row.kills = toNumber(teamSummary && teamSummary.kills, row.kills);
        row.deaths = toNumber(teamSummary && teamSummary.deaths, row.deaths);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.team - b.team);
  }

  function findKeyPlayer(mappedPlayers) {
    const sorted = mappedPlayers.slice().sort((a, b) => {
      const scoreA = impactScore(a);
      const scoreB = impactScore(b);
      return scoreB - scoreA;
    });
    return sorted[0] || null;
  }

  function impactScore(player) {
    const final = player && player.analysisFinal || {};
    const spend = player && player.spendSummary || {};
    const prod = player && player.productionSummary || {};
    return (
      toNumber(final.kills, 0) * 3 +
      toNumber(final.worker_peak, 0) * 1.2 +
      toNumber(final.supply_peak_used, 0) * 0.6 +
      toNumber(final.vision_score_final, 0) * 2 +
      toNumber(final.enemy_zone_coverage, 0) * 30 +
      toNumber(spend.total_spend, 0) / 1000 +
      toNumber(prod.total, 0) / 8 -
      toNumber(final.deaths, 0) * 1.5 -
      toNumber(final.self_deaths, 0) * 3 -
      toNumber(final.unattributed_deaths, 0) * 2
    );
  }

  function downsideScore(player) {
    const final = player && player.analysisFinal || {};
    return (
      toNumber(final.deaths, 0) * 3 +
      toNumber(final.self_deaths, 0) * 4 +
      toNumber(final.unattributed_deaths, 0) * 3 -
      toNumber(final.kills, 0) * 2 -
      toNumber(final.worker_peak, 0) * 0.8 -
      toNumber(final.vision_score_final, 0) * 1.5 -
      toNumber(final.enemy_zone_coverage, 0) * 15
    );
  }

  function findWorstPlayer(mappedPlayers) {
    const losers = mappedPlayers.filter((row) => !row.isWinner);
    const pool = losers.length ? losers : mappedPlayers;
    const sorted = pool.slice().sort((a, b) => downsideScore(b) - downsideScore(a));
    return sorted[0] || null;
  }

  function buildHeadline(teamRows, keyPlayer) {
    if (teamRows.length < 2) return "경기 전체 흐름을 요약할 팀 비교 데이터가 아직 부족합니다.";
    const [a, b] = teamRows;
    const killDiff = Math.abs(toNumber(a.kills, 0) - toNumber(b.kills, 0));
    const spendDiff = Math.abs(toNumber(a.totalSpend, 0) - toNumber(b.totalSpend, 0));
    const workerDiff = Math.abs(toNumber(a.workerPeak, 0) - toNumber(b.workerPeak, 0));
    const aheadByKills = a.kills === b.kills ? null : (a.kills > b.kills ? a : b);
    const aheadByWorkers = a.workerPeak === b.workerPeak ? null : (a.workerPeak > b.workerPeak ? a : b);
    const parts = [];
    const sideLabel = (row) => row && row.players.some((p) => p.isWinner) ? "Winner" : "Loser";

    if (aheadByKills && killDiff >= 3) {
      parts.push(`${sideLabel(aheadByKills)} side가 교전 교환비에서 앞섰다.`);
    }
    if (aheadByWorkers && workerDiff >= 3) {
      parts.push(`${sideLabel(aheadByWorkers)} side가 더 큰 경제 규모를 유지했다.`);
    }
    if (spendDiff >= 800) {
      const aheadBySpend = a.totalSpend > b.totalSpend ? a : b;
      parts.push(`${sideLabel(aheadBySpend)} side가 더 많은 자원을 전장과 테크에 투입했다.`);
    }
    if (keyPlayer && toNumber(keyPlayer.analysisFinal && keyPlayer.analysisFinal.vision_score_final, 0) > 0) {
      parts.push(`${keyPlayer.name}가 시야 장악과 운영 지표에서 가장 눈에 띄었다.`);
    }
    return parts.length ? parts.join(" ") : "양 팀의 운영 흐름이 크게 벌어지지 않은 경기로 보인다.";
  }

  function buildVerdict(analyzer, teamRows) {
    const status = normalizeStatus(analyzer && analyzer.status);
    if (status === "not_requested") {
      return {
        status,
        title: "분석이 아직 준비되지 않았습니다.",
        subtitle: "신규 업로드 replay가 아니거나 아직 분석 큐에 등록되지 않았습니다.",
      };
    }
    if (status === "queued" || status === "running") {
      return {
        status,
        title: "경기 해설을 생성하는 중입니다.",
        subtitle: "분석 결과가 준비되면 승패 해석과 플레이어별 요약이 표시됩니다.",
      };
    }
    if (status === "failed") {
      return {
        status,
        title: "분석 결과를 불러오지 못했습니다.",
        subtitle: String(analyzer && analyzer.last_error || "unknown error"),
      };
    }

    const phase = analyzer && analyzer.result && analyzer.result.analysis_phase || {};
    const candidate = toNumber(phase.winner_team_candidate, 0);
    const source = String(phase.winner_team_source || "unknown");
    const reasons = asArray(phase.reasons).slice(0, 3);
    const team = teamRows.find((row) => row.team === candidate) || null;
    const title = team
      ? `분석기는 Winner side 우세 흐름으로 해석합니다.`
      : "분석 결과에서 우세 팀 후보를 계산했습니다.";
    const subtitle = phase.applied
      ? `판정 규칙이 적용되었고, 근거 출처는 ${source}입니다.`
      : `판정 규칙은 보수적으로 미적용 상태이며, 후보 출처는 ${source}입니다.`;
    return { status, title, subtitle, reasons };
  }

  function buildPlayerInsights(player) {
    const final = player.analysisFinal || {};
    const tech = player.techSummary || {};
    const prod = player.productionSummary || {};
    const insights = [];
    if (toNumber(final.worker_peak, 0) >= 10) insights.push("경제 규모를 안정적으로 키운 편입니다.");
    if (toNumber(final.vision_score_final, 0) >= 12) insights.push("시야 장악과 정찰 기여가 눈에 띕니다.");
    if (toNumber(tech.tech_count, 0) + toNumber(tech.upgrade_count, 0) >= 3) insights.push("테크 전환과 업그레이드 운영 비중이 높습니다.");
    if (toNumber(prod.tech_unit, 0) > 0) insights.push("고급 유닛 전환이 있었던 플레이어입니다.");
    if (toNumber(final.kills, 0) >= 5 && toNumber(final.deaths, 0) <= 2) insights.push("교전 효율이 좋은 편입니다.");
    if (toNumber(final.enemy_zone_coverage, 0) >= 0.3) insights.push("적진 압박이나 전진 움직임이 적극적이었습니다.");
    return insights.slice(0, 3);
  }

  function buildPlayerCard(player) {
    const final = player.analysisFinal || {};
    return {
      key: player.key,
      name: player.name,
      team: player.team,
      race: player.race,
      result: player.result,
      isWinner: !!player.isWinner,
      kills: toNumber(final.kills, 0),
      deaths: toNumber(final.deaths, 0),
      kdr: toNumber(final.kdr, 0),
      workerPeak: toNumber(final.worker_peak, 0),
      supplyPeak: toNumber(final.supply_peak_used, 0),
      towerPeak: toNumber(final.tower_peak, 0),
      visionScore: toNumber(final.vision_score_final, 0),
      enemyZoneCoverage: toNumber(final.enemy_zone_coverage, 0),
      cmdCount: toNumber(player.cmdCount, 0),
      effectiveCmdCount: toNumber(player.effectiveCmdCount, 0),
      insights: buildPlayerInsights(player),
      impactScore: impactScore(player),
      downsideScore: downsideScore(player),
    };
  }

  function buildSelectedPlayerModel(mappedPlayers, selectedPlayerName) {
    const target = lower(selectedPlayerName);
    if (!target) return null;
    const picked = mappedPlayers.find((row) => lower(row.name) === target) || null;
    if (!picked) return null;

    const final = picked.analysisFinal || {};
    return {
      name: picked.name,
      team: picked.team,
      race: picked.race,
      result: picked.result,
      metrics: {
        apm: toNumber(picked.apm, 0),
        eapm: toNumber(picked.eapm, 0),
        cmdCount: toNumber(picked.cmdCount, 0),
        effectiveCmdCount: toNumber(picked.effectiveCmdCount, 0),
        redundancy: toNumber(picked.redundancy, 0),
        kills: toNumber(final.kills, 0),
        deaths: toNumber(final.deaths, 0),
        kdr: toNumber(final.kdr, 0),
        workerPeak: toNumber(final.worker_peak, 0),
        supplyPeak: toNumber(final.supply_peak_used, 0),
        towerPeak: toNumber(final.tower_peak, 0),
        visionScore: toNumber(final.vision_score_final, 0),
        enemyZoneCoverage: toNumber(final.enemy_zone_coverage, 0),
        selfDeaths: toNumber(final.self_deaths, 0),
        friendlyFireKills: toNumber(final.friendly_fire_kills, 0),
        unattributedDeaths: toNumber(final.unattributed_deaths, 0),
      },
      spendSummary: picked.spendSummary,
      spendTimeline: picked.spendTimeline,
      productionSummary: picked.productionSummary,
      productionTimeline: picked.productionTimeline,
      techSummary: picked.techSummary,
      apmTimeline: picked.apmTimeline,
      buildOrder: picked.buildOrder,
      analyzerTimeseries: picked.analyzerTimeseries,
      insights: buildPlayerInsights(picked),
    };
  }

  function mapAnalyzerMatchFlow(analyzer, mappedPlayers) {
    const events = asArray(analyzer && analyzer.result && analyzer.result.match_flow && analyzer.result.match_flow.events);
    return events.map((event) => {
      const player = mappedPlayers.find((row) => toNumber(row.playerId, -1) === toNumber(event && event.player_id, -2))
        || mappedPlayers.find((row) => lower(row.name) === lower(event && event.player_name))
        || null;
      return {
        second: toNumber(event && event.second, 0),
        frame: toNumber(event && event.frame, 0),
        playerName: player ? player.name : String(event && event.player_name || "-"),
        team: player ? player.team : toNumber(event && event.team, 0),
        kind: String(event && (event.type || event.kind) || "event"),
        label: String(event && event.title || "Event"),
        subtitle: String(event && event.subtitle || ""),
        importance: toNumber(event && event.importance, 0),
      };
    });
  }

  function buildTechTimeline(detail, mappedPlayers) {
    const events = asArray(detail && detail.tech_tree && detail.tech_tree.events);
    const importantBuildings = new Set([
      "academy",
      "engineering bay",
      "armory",
      "science facility",
      "cybernetics core",
      "citadel of adun",
      "templar archives",
      "robotics facility",
      "observatory",
      "fleet beacon",
      "arbiter tribunal",
      "hydralisk den",
      "spire",
      "greater spire",
      "queens nest",
      "ultralisk cavern",
      "defiler mound",
    ]);
    const markers = [];
    const seen = new Set();

    for (const ev of events) {
      const kind = lower(ev && ev.kind);
      const name = String(ev && ev.name || "").trim();
      const key = `${lower(ev && ev.player_name)}|${kind}|${lower(name)}`;
      if (!name) continue;
      if (kind === "prereq_building" && !importantBuildings.has(lower(name))) continue;
      if (kind !== "tech" && kind !== "upgrade" && kind !== "prereq_building") continue;
      if (seen.has(key)) continue;
      seen.add(key);

      const player = mappedPlayers.find((row) => lower(row.name) === lower(ev && ev.player_name)) || null;
      markers.push({
        second: toNumber(ev && ev.second, 0),
        frame: toNumber(ev && ev.frame, 0),
        playerName: player ? player.name : String(ev && ev.player_name || "-"),
        team: player ? player.team : 0,
        kind,
        label: name,
      });
    }

    return markers.sort((a, b) => a.second - b.second).slice(0, 24);
  }

  function buildGameAnalyzerPageModel(input) {
    const game = input && input.game || null;
    const detail = input && input.detail || null;
    const analyzer = input && input.analyzer || null;
    const selectedPlayerName = input && input.selectedPlayerName || "";

    const mappedPlayers = buildMappedPlayers(game, detail, analyzer);
    const summaryTeams = asArray(analyzer && analyzer.result && analyzer.result.summary && analyzer.result.summary.teams);
    const teamRows = buildTeamMap(mappedPlayers, summaryTeams);
    const keyPlayer = findKeyPlayer(mappedPlayers);
    const worstPlayer = findWorstPlayer(mappedPlayers);
    const verdict = buildVerdict(analyzer, teamRows);
    const hero = {
      headline: buildHeadline(teamRows, keyPlayer),
      keyPlayerName: keyPlayer ? keyPlayer.name : "",
      worstPlayerName: worstPlayer ? worstPlayer.name : "",
      teamRows,
    };

    return {
      status: normalizeStatus(analyzer && analyzer.status),
      hero,
      verdict,
      playerCards: mappedPlayers.map(buildPlayerCard),
      selectedPlayer: buildSelectedPlayerModel(mappedPlayers, selectedPlayerName),
      timeline: {
        techMarkers: buildTechTimeline(detail, mappedPlayers)
          .concat(mapAnalyzerMatchFlow(analyzer, mappedPlayers))
          .sort((a, b) => {
            if (toNumber(a.second, 0) === toNumber(b.second, 0)) {
              return toNumber(b.importance, 0) - toNumber(a.importance, 0);
            }
            return toNumber(a.second, 0) - toNumber(b.second, 0);
          })
          .slice(0, 60),
      },
      raw: {
        game,
        detail,
        analyzer,
      },
    };
  }

  window.GameAnalyzerPageModel = {
    buildGameAnalyzerPageModel,
  };
})();
