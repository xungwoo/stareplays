import assert from "node:assert/strict";
import test from "node:test";

import { handleMcpRequest } from "../lib/mcp-server.mjs";

test("lists stareplays tools and serves a prompt bundle through tool calls", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      schemaVersion: "stareplays.team-analysis.raw.v1",
      analysis: {
        summary: { gamesAnalyzed: 12, topPlayer: "성우" },
        players: [{ name: "성우", winRate: 66.7 }]
      },
      llm: {
        promptTitle: "3x3 팀 전적 분석",
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
  assert.match(prompt.result.content[0].text, /최적 조합을 추천해줘/);
});
