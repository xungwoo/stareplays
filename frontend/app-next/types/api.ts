export type Player = {
  id: number;
  name: string;
  race: string;
  team: number;
  apm: number;
  eapm: number;
  cmd_count: number;
  effective_cmd_count: number;
  redundancy: number;
  result?: string;
  is_winner?: boolean;
  start_location_x?: number;
  start_location_y?: number;
};

export type ReplayFile = {
  id: number;
  file_hash: string;
};

export type Game = {
  id: number;
  host: string;
  start_time: string;
  map_name: string;
  game_length: number;
  game_type?: string;
  game_speed?: string;
  title?: string;
  player_count: number;
  upload_count: number;
  winner_team: number;
  edges?: {
    players?: Player[];
    replay_files?: ReplayFile[];
  };
};

export type GamesResponse = {
  games: Game[];
  total: number;
  limit: number;
  offset: number;
  reliability_summaries?: Record<string, { m_of_n: string; reliability: string }>;
};

export type APMPoint = {
  frame: number;
  apm: number;
};

export type APMTimeline = {
  player_name: string;
  data_points: APMPoint[];
};

export type GameDetail = {
  id: number;
  apm_timeline?: APMTimeline[];
};

export type AnalysisStatus = {
  status: string;
  user_message: string;
  typed_event_coverage?: number;
  estimated_size_tier?: string;
  estimated_size_bytes?: number;
};

export type ResourceSpendSummary = {
  player_name: string;
  total_mineral: number;
  total_gas: number;
  total_spend: number;
};

export type ResourceSpendTimeline = {
  player_name: string;
  data_points: Array<{
    frame: number;
    second: number;
    mineral: number;
    gas: number;
    total: number;
  }>;
};

export type ResourceSpend = {
  source: string;
  summaries: ResourceSpendSummary[];
  timelines: ResourceSpendTimeline[];
};

export type UnitProductionSummary = {
  player_name: string;
  total: number;
  worker: number;
  army: number;
  tech_unit: number;
};

export type UnitProductionTimeline = {
  player_name: string;
  data_points: Array<{
    frame: number;
    second: number;
    count: number;
  }>;
};

export type UnitProduction = {
  source: string;
  version?: string;
  summaries: UnitProductionSummary[];
  timelines: UnitProductionTimeline[];
};

export type TechTreeSummary = {
  player_name: string;
  tech_count: number;
  upgrade_count: number;
  prereq_build_count: number;
  cancel_count: number;
  ineff_count: number;
};

export type TechTreeEvent = {
  player_name: string;
  kind: string;
  name: string;
  frame: number;
  second: number;
  quality: string;
};

export type TechTree = {
  source: string;
  summary: TechTreeSummary[];
  events: TechTreeEvent[];
};

export type GameDetailResponse = {
  game: Game;
  detail: GameDetail;
  analysis_status: AnalysisStatus;
  tech_tree: TechTree;
  unit_production: UnitProduction;
  resource_spend: ResourceSpend;
};

export type RankingItem = {
  id: number;
  name: string;
  rank: number;
  games: number;
  wins: number;
  losses?: number;
  draws?: number;
  win_rate: number;
  avg_apm: number;
  avg_eapm: number;
};

export type RankingsResponse = {
  rankings: RankingItem[];
  total: number;
};

export type RaceMatchupRow = {
  id: number;
  team_size: number;
  team_a: string;
  team_b: string;
  matchup_key: string;
  games: number;
  team_a_wins: number;
  team_a_win_rate: number;
  team_b_wins?: number;
  team_b_win_rate?: number;
};

export type RaceMatchupResponse = {
  rows: RaceMatchupRow[];
  qualified_games: number;
  total: number;
};

export type PlayerStatsResponse = {
  player_name: string;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  average_apm: number;
  average_eapm: number;
  favorite_race: string;
  race_stats: Record<string, { wins: number; losses: number; total: number; win_rate: number }>;
  matchup_stats: Record<string, { wins: number; losses: number; total: number; win_rate: number }>;
  map_stats: Record<string, { wins: number; losses: number; total: number; win_rate: number }>;
};

export type UserSuggestResponse = {
  users: string[];
};

export type UploadPreviewResult = {
  filename: string;
  ok: boolean;
  preview?: {
    map_name: string;
    start_time: string;
    player_count: number;
    parsed_players: string[];
  };
  error?: string;
};

export type UploadPreviewResponse = {
  total_files: number;
  success_count: number;
  failed_count: number;
  candidate_players: string[];
  results: UploadPreviewResult[];
};

export type UploadResponse = {
  message: string;
  game?: Game;
  results?: Array<{
    filename: string;
    ok: boolean;
    result?: {
      game?: Game;
    };
    error?: string;
  }>;
};
