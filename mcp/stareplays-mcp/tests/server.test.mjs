import assert from "node:assert/strict";
import test from "node:test";

import { handleMcpRequest } from "../lib/mcp-server.mjs";

test("lists stareplays tools and serves a prompt bundle through tool calls", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      schemaVersion: "stareplays.team-analysis.raw.v2",
      compatibility: { recommendedMcpVersion: "0.2.0" },
      analysis: {
        summary: { gamesAnalyzed: 12, topPlayer: "성우" },
        players: [{ name: "성우", winRate: 66.7, randomSelectedGames: 4 }]
      },
      llm: {
        promptTitle: "3x3 팀 전적 분석",
        analysisGuidance: ["player.isRandomSelected=true면 해당 선수가 랜덤을 선택한 것으로 해석하세요."],
        relatedLinks: [{ label: "시즌7 시즌 전적", url: "https://stareplays.up.railway.app/seasons/%EC%8B%9C%EC%A6%8C7", description: "시즌 상세" }],
        suggestedQuestions: ["최적 조합을 추천해줘"]
      }
    })
  });

  const tools = await handleMcpRequest({
    request: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    apiBaseUrl: "https://stareplays.example",
    fetchImpl
  });
  assert.equal(tools.result.tools.some((tool) => tool.name === "get_team_analysis_raw"), true);
  assert.equal(tools.result.tools.some((tool) => tool.name === "get_team_analysis_prompt_bundle"), true);

  const prompt = await handleMcpRequest({
    request: {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_team_analysis_prompt_bundle", arguments: { seasonLabel: "시즌7" } }
    },
    apiBaseUrl: "https://stareplays.example",
    fetchImpl
  });

  assert.match(prompt.result.content[0].text, /시즌7/);
  assert.doesNotMatch(prompt.result.content[0].text, /randomSelectedGames/);
  assert.match(prompt.result.content[0].text, /player\.isRandomSelected=true/);
  assert.match(prompt.result.content[0].text, /https:\/\/stareplays\.up\.railway\.app\/seasons/);
  assert.match(prompt.result.content[0].text, /최적 조합을 추천해줘/);
});

test("reports MCP update status from raw compatibility metadata", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      schemaVersion: "stareplays.team-analysis.raw.v2",
      compatibility: { recommendedMcpVersion: "0.3.0" }
    })
  });

  const response = await handleMcpRequest({
    request: {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_mcp_update_status", arguments: {} }
    },
    apiBaseUrl: "https://stareplays.example",
    fetchImpl
  });

  const status = JSON.parse(response.result.content[0].text);
  assert.equal(status.currentVersion, "0.2.0");
  assert.equal(status.recommendedVersion, "0.3.0");
  assert.equal(status.updateAvailable, true);
  assert.match(status.updateCommand, /stareplays-mcp install/);
});

test("returns request-scoped API errors from tool calls", async () => {
  const fetchImpl = async () => {
    const cause = new Error("unable to get local issuer certificate");
    cause.code = "UNABLE_TO_GET_ISSUER_CERT_LOCALLY";
    throw new TypeError("fetch failed", { cause });
  };

  const response = await handleMcpRequest({
    request: {
      jsonrpc: "2.0",
      id: 77,
      method: "tools/call",
      params: { name: "get_team_analysis_raw", arguments: { seasonLabel: "시즌8" } }
    },
    apiBaseUrl: "https://stareplays.example",
    fetchImpl
  });

  assert.equal(response.id, 77);
  assert.equal(response.error.code, -32000);
  assert.equal(response.error.data.code, "STAREPLAYS_API_TLS_CERT");
  assert.match(response.error.message, /TLS certificate/);
});

test("rejects unknown tools before fetching remote data", async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    throw new Error("should not fetch");
  };

  const response = await handleMcpRequest({
    request: {
      jsonrpc: "2.0",
      id: 88,
      method: "tools/call",
      params: { name: "missing_tool", arguments: { seasonLabel: "시즌8" } }
    },
    apiBaseUrl: "https://stareplays.example",
    fetchImpl
  });

  assert.equal(response.id, 88);
  assert.equal(response.error.code, -32602);
  assert.equal(fetchCalls, 0);
});
