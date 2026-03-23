export interface ApiPlayerRecord {
  wins?: number;
  losses?: number;
  total?: number;
  win_rate?: number;
}

export interface ApiPlayerStatsResponse {
  player_name?: string;
  total_games?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  win_rate?: number;
  average_apm?: number;
  average_eapm?: number;
  favorite_race?: string;
  race_stats?: Record<string, ApiPlayerRecord>;
  matchup_stats?: Record<string, ApiPlayerRecord>;
  map_stats?: Record<string, ApiPlayerRecord>;
}

export interface ApiUsersSuggestResponse {
  users?: string[];
}

export interface ApiRankingSnapshotRow {
  rank?: number;
  name?: string;
  games?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  win_rate?: number;
  avg_apm?: number;
  avg_eapm?: number;
}

export interface ApiRankingsResponse {
  total?: number;
  rankings?: ApiRankingSnapshotRow[];
  items?: ApiRankingSnapshotRow[];
}

export interface ApiRaceMatchupRow {
  team_a?: string;
  team_b?: string;
  games?: number;
  team_a_wins?: number;
  team_b_wins?: number;
  team_a_win_rate?: number;
  team_b_win_rate?: number;
}

export interface ApiRaceMatchupsResponse {
  qualified_games?: number;
  rows?: ApiRaceMatchupRow[];
  items?: ApiRaceMatchupRow[];
}

export interface ApiGamePlayer {
  name?: string;
  race?: string;
  team?: number;
  start_location_x?: number;
  start_location_y?: number;
  apm?: number;
  eapm?: number;
  cmd_count?: number;
  effective_cmd_count?: number;
  redundancy?: number;
  is_winner?: boolean;
  result?: string;
}

export interface ApiGameSummary {
  id?: number;
  map_name?: string;
  game_length?: number;
  winner_team?: number;
  start_time?: string;
  edges?: {
    players?: ApiGamePlayer[];
  };
}

export interface ApiGamesListResponse {
  total?: number;
  games?: ApiGameSummary[];
  analysis_statuses?: Record<string, string>;
}

export interface ApiGetGameResponse {
  reliability?: string;
  reliability_m_of_n?: string;
  game?: {
    id?: number;
    edges?: {
      replay_files?: Array<{
        id?: number;
        filename?: string;
      }>;
    };
  };
}

export interface ApiApmTimelinePoint {
  frame?: number;
  apm?: number;
}

export interface ApiApmTimelineRow {
  player_name?: string;
  data_points?: ApiApmTimelinePoint[];
}

export interface ApiTechTreeEvent {
  player_name?: string;
  second?: number;
  kind?: string;
  name?: string;
}

export interface ApiTechTreeSummary {
  player_name?: string;
  tech_count?: number;
  upgrade_count?: number;
  prereq_build_count?: number;
}

export interface ApiTechTreeResponse {
  events?: ApiTechTreeEvent[];
  summary?: ApiTechTreeSummary[];
}

export interface ApiResourceSpendSummary {
  player_name?: string;
  total_spend?: number;
}

export interface ApiSeriesPoint {
  second?: number;
  total?: number;
  count?: number;
  kills?: number;
  deaths?: number;
  apm?: number;
}

export interface ApiPlayerSeriesRow {
  player_name?: string;
  team?: number;
  data_points?: ApiSeriesPoint[];
  kd?: ApiSeriesPoint[];
  worker?: ApiSeriesPoint[];
}

export interface ApiResourceSpendResponse {
  summaries?: ApiResourceSpendSummary[];
  timelines?: ApiPlayerSeriesRow[];
}

export interface ApiUnitProductionSummary {
  player_name?: string;
  total?: number;
  worker?: number;
  army?: number;
  tech_unit?: number;
}

export interface ApiUnitProductionResponse {
  summaries?: ApiUnitProductionSummary[];
  timelines?: ApiPlayerSeriesRow[];
}

export interface ApiGameDetailResponse {
  analysis_status?: {
    status?: string;
    user_message?: string;
  };
  detail?: {
    apm_timeline?: ApiApmTimelineRow[];
  };
  tech_tree?: ApiTechTreeResponse;
  resource_spend?: ApiResourceSpendResponse;
  unit_production?: ApiUnitProductionResponse;
}

export interface ApiAnalyzerPlayerFinal {
  kills?: number;
  deaths?: number;
  worker_peak?: number;
  supply_peak_used?: number;
  vision_score_final?: number;
  enemy_zone_coverage?: number;
}

export interface ApiAnalyzerSummaryPlayer {
  player_name?: string;
  player_id?: number;
  team?: number;
  final?: ApiAnalyzerPlayerFinal;
}

export interface ApiAnalyzerSummaryTeam {
  team?: number;
  kills?: number;
  deaths?: number;
}

export interface ApiAnalyzerMatchFlowEvent {
  second?: number;
  player_name?: string;
  team?: number;
  type?: string;
  title?: string;
  importance?: number;
}

export interface ApiAnalyzerPlayerSeries {
  player_name?: string;
  team?: number;
  kd?: ApiSeriesPoint[];
  worker?: ApiSeriesPoint[];
  vision?: ApiSeriesPoint[];
}

export interface ApiGameAnalyzerResponse {
  status?: string;
  result?: {
    summary?: {
      teams?: ApiAnalyzerSummaryTeam[];
      players?: ApiAnalyzerSummaryPlayer[];
    };
    analysis_phase?: {
      winner_team_candidate?: number;
    };
    match_flow?: {
      events?: ApiAnalyzerMatchFlowEvent[];
    };
    player_timeseries?: {
      players?: ApiAnalyzerPlayerSeries[];
    };
  };
}

export interface ApiAnalyzerReanalyzeRequest {
  game_id: number;
}

export interface ApiAnalyzerReanalyzeResponse {
  ok?: boolean;
  message?: string;
  status?: string;
  game_id?: number;
}

export interface ApiReplayPreviewItem {
  filename?: string;
  ok?: boolean;
  status?: number;
  error?: string;
  preview?: {
    map_name?: string;
    start_time?: string;
    player_count?: number;
    parsed_players?: string[];
  };
}

export interface ApiReplayPreviewResponse {
  message?: string;
  total_files?: number;
  success_count?: number;
  failed_count?: number;
  candidate_players?: string[];
  preview_candidates?: string[];
  results?: ApiReplayPreviewItem[];
}

export interface ApiReplayUploadResultItem {
  filename?: string;
  ok?: boolean;
  status?: number;
  error?: string;
  result?: {
    game?: {
      id?: number;
      map_name?: string;
      start_time?: string;
    };
    error?: string;
  };
}

export interface ApiReplayUploadResponse {
  message?: string;
  total_files?: number;
  success_count?: number;
  failed_count?: number;
  game?: {
    id?: number;
    map_name?: string;
    start_time?: string;
  };
  results?: ApiReplayUploadResultItem[];
}
