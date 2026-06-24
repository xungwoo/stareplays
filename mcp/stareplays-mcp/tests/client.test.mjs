import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadTeamAnalysisRaw } from "../lib/client.mjs";

function okResponse(payload) {
  return {
    ok: true,
    json: async () => payload
  };
}

test("uses fresh cache without fetching remote data", async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), "stareplays-mcp-cache-"));
  const payload = { schemaVersion: "stareplays.team-analysis.raw.v1", source: { totalGames: 6 } };
  let fetchCalls = 0;

  try {
    await loadTeamAnalysisRaw({
      apiBaseUrl: "https://stareplays.example",
      seasonLabel: "시즌8",
      cacheDirectory,
      now: 1000,
      fetchImpl: async () => {
        fetchCalls += 1;
        return okResponse(payload);
      }
    });

    const cached = await loadTeamAnalysisRaw({
      apiBaseUrl: "https://stareplays.example",
      seasonLabel: "시즌8",
      cacheDirectory,
      cacheTtlSeconds: 300,
      now: 2000,
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("cache should prevent this fetch");
      }
    });

    assert.equal(fetchCalls, 1);
    assert.equal(cached.cache.status, "hit");
    assert.deepEqual(cached.payload, payload);
  } finally {
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});

test("returns stale cache when refresh fails", async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), "stareplays-mcp-cache-"));
  const payload = { schemaVersion: "stareplays.team-analysis.raw.v1", source: { totalGames: 123 } };

  try {
    await loadTeamAnalysisRaw({
      apiBaseUrl: "https://stareplays.example",
      seasonLabel: "시즌8",
      cacheDirectory,
      now: 1000,
      fetchImpl: async () => okResponse(payload)
    });

    const result = await loadTeamAnalysisRaw({
      apiBaseUrl: "https://stareplays.example",
      seasonLabel: "시즌8",
      cacheDirectory,
      cacheTtlSeconds: 1,
      now: 10000,
      fetchImpl: async () => {
        throw new Error("network down");
      }
    });

    assert.equal(result.cache.status, "stale");
    assert.equal(result.cache.errorCode, "STAREPLAYS_API_FETCH_FAILED");
    assert.deepEqual(result.payload, payload);
  } finally {
    await rm(cacheDirectory, { recursive: true, force: true });
  }
});
