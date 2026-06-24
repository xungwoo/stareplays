import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_API_BASE_URL = "https://stareplays.up.railway.app";
export const DEFAULT_CACHE_TTL_SECONDS = 300;
export const DEFAULT_TIMEOUT_MS = 10000;

export class StareplaysApiError extends Error {
  constructor(message, { code = "STAREPLAYS_API_ERROR", status = null, cause = null } = {}) {
    super(message, { cause });
    this.name = "StareplaysApiError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeBaseUrl(value = DEFAULT_API_BASE_URL) {
  return value.replace(/\/+$/, "");
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function cacheDir(value = process.env.STAREPLAYS_MCP_CACHE_DIR) {
  return value?.trim() || join(homedir(), ".stareplays", "mcp", "cache");
}

function cachePath({ apiBaseUrl, seasonLabel, cacheDirectory }) {
  const key = JSON.stringify({
    apiBaseUrl: normalizeBaseUrl(apiBaseUrl),
    seasonLabel: seasonLabel || null
  });
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 24);
  return join(cacheDirectory, `team-analysis-${digest}.json`);
}

async function readCache(path, now = Date.now()) {
  try {
    const record = JSON.parse(await readFile(path, "utf8"));
    const generatedAt = Number(record.generatedAtMs ?? 0);
    const ageSeconds = Math.max(0, Math.round((now - generatedAt) / 1000));

    return {
      payload: record.payload,
      generatedAt,
      ageSeconds
    };
  } catch {
    return null;
  }
}

async function writeCache(path, payload, now = Date.now()) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ generatedAtMs: now, payload })}\n`);
}

function classifyFetchError(err) {
  const cause = err?.cause;
  const detail = [err?.message, cause?.message, cause?.code].filter(Boolean).join(": ");
  if (err?.name === "AbortError") {
    return new StareplaysApiError("Stareplays API request timed out", {
      code: "STAREPLAYS_API_TIMEOUT",
      cause: err
    });
  }

  if (cause?.code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" || detail.includes("UNABLE_TO_GET_ISSUER_CERT_LOCALLY") || detail.includes("local issuer certificate")) {
    return new StareplaysApiError("Stareplays API TLS certificate validation failed", {
      code: "STAREPLAYS_API_TLS_CERT",
      cause: err
    });
  }

  return new StareplaysApiError(`Stareplays API request failed: ${detail || String(err)}`, {
    code: "STAREPLAYS_API_FETCH_FAILED",
    cause: err
  });
}

async function fetchJson({ url, fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url.toString(), {
      headers: {
        accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new StareplaysApiError(`Stareplays API returned HTTP ${response.status}`, {
        code: "STAREPLAYS_API_HTTP",
        status: response.status
      });
    }

    return response.json();
  } catch (err) {
    if (err instanceof StareplaysApiError) throw err;
    throw classifyFetchError(err);
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadTeamAnalysisRaw({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  seasonLabel,
  fetchImpl = fetch,
  timeoutMs = positiveInt(process.env.STAREPLAYS_MCP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  cacheTtlSeconds = positiveInt(process.env.STAREPLAYS_MCP_CACHE_TTL_SECONDS, DEFAULT_CACHE_TTL_SECONDS),
  cacheDirectory = cacheDir(),
  forceRefresh = false,
  now = Date.now()
} = {}) {
  const url = new URL("/api/team-analysis/raw", normalizeBaseUrl(apiBaseUrl));
  if (seasonLabel) url.searchParams.set("season_label", seasonLabel);

  const path = cachePath({ apiBaseUrl, seasonLabel, cacheDirectory });
  const cached = await readCache(path, now);
  if (!forceRefresh && cached?.payload && cached.ageSeconds <= cacheTtlSeconds) {
    return {
      payload: cached.payload,
      cache: { status: "hit", path, ageSeconds: cached.ageSeconds }
    };
  }

  try {
    const payload = await fetchJson({ url, fetchImpl, timeoutMs });
    await writeCache(path, payload, now);
    return {
      payload,
      cache: { status: "refresh", path, ageSeconds: 0 }
    };
  } catch (err) {
    if (cached?.payload) {
      return {
        payload: cached.payload,
        cache: {
          status: "stale",
          path,
          ageSeconds: cached.ageSeconds,
          error: err instanceof Error ? err.message : String(err),
          errorCode: err?.code ?? "STAREPLAYS_API_ERROR"
        }
      };
    }
    throw err;
  }
}

export async function fetchTeamAnalysisRaw(options = {}) {
  const result = await loadTeamAnalysisRaw(options);
  return result.payload;
}
