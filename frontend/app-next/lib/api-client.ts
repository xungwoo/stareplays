import {
  GameDetailResponse,
  GamesResponse,
  PlayerStatsResponse,
  RaceMatchupResponse,
  RankingsResponse,
  UploadPreviewResponse,
  UploadResponse,
  UserSuggestResponse
} from "@/types/api";

const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
const API_BASE_URL = RAW_BASE_URL.endsWith("/") ? RAW_BASE_URL.slice(0, -1) : RAW_BASE_URL;

function toUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(toUrl(path), {
    ...init,
    cache: "no-store"
  });

  const text = await res.text();
  let payload: unknown = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error?: string }).error || `${res.status} ${res.statusText}`)
        : `${res.status} ${res.statusText}`;
    throw new ApiError(message, res.status);
  }

  return payload as T;
}

export const apiClient = {
  getGames: (limit: number, offset: number, userName?: string) => {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (userName) {
      q.set("user_name", userName);
    }
    return request<GamesResponse>(`/api/v1/games?${q.toString()}`);
  },
  getGame: (id: number) => request<{ game: unknown }>(`/api/v1/games/${id}`),
  getGameDetail: (id: number) => request<GameDetailResponse>(`/api/v1/games/${id}/detail`),
  getRankings3v3: (limit = 100) => request<RankingsResponse>(`/api/v1/rankings/3v3?limit=${limit}`),
  getRaceMatchups: (teamSize = 3, limit = 300) =>
    request<RaceMatchupResponse>(`/api/v1/analyzer/race-matchups?team_size=${teamSize}&limit=${limit}`),
  getPlayerStats: (playerName: string) =>
    request<PlayerStatsResponse>(`/api/v1/players/${encodeURIComponent(playerName)}/stats`),
  suggestUsers: (q: string, limit = 5) =>
    request<UserSuggestResponse>(`/api/v1/users/suggest?q=${encodeURIComponent(q)}&limit=${limit}`),
  previewUpload: (formData: FormData) =>
    request<UploadPreviewResponse>(`/api/v1/games/upload/preview`, {
      method: "POST",
      body: formData
    }),
  uploadReplays: (formData: FormData) =>
    request<UploadResponse>(`/api/v1/games/upload`, {
      method: "POST",
      body: formData
    })
};
