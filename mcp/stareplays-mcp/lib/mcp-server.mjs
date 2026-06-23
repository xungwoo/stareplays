import { fetchTeamAnalysisRaw } from "./client.mjs";
import { createPromptBundle } from "./prompt-bundle.mjs";

const protocolVersion = "2024-11-05";

function ok(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function error(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function textContent(text) {
  return [{ type: "text", text }];
}

export async function handleMcpRequest({ request, apiBaseUrl, fetchImpl = fetch }) {
  const id = request.id ?? null;
  const method = request.method;

  if (method === "initialize") {
    return ok(id, {
      protocolVersion,
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      serverInfo: {
        name: "stareplays-mcp",
        version: "0.1.0"
      }
    });
  }

  if (method === "tools/list") {
    return ok(id, {
      tools: [
        {
          name: "get_team_analysis_raw",
          description: "Fetch the Starplays 3x3 team-analysis raw JSON snapshot.",
          inputSchema: {
            type: "object",
            properties: {
              seasonLabel: { type: "string", description: "Optional season label, for example 시즌7." }
            }
          }
        },
        {
          name: "get_team_analysis_prompt_bundle",
          description: "Fetch a Korean LLM prompt bundle with raw JSON and analysis guidance.",
          inputSchema: {
            type: "object",
            properties: {
              seasonLabel: { type: "string", description: "Optional season label, for example 시즌7." }
            }
          }
        }
      ]
    });
  }

  if (method === "tools/call") {
    const name = request.params?.name;
    const args = request.params?.arguments ?? {};
    const raw = await fetchTeamAnalysisRaw({ apiBaseUrl, seasonLabel: args.seasonLabel, fetchImpl });

    if (name === "get_team_analysis_raw") {
      return ok(id, {
        content: textContent(JSON.stringify(raw, null, 2))
      });
    }

    if (name === "get_team_analysis_prompt_bundle") {
      return ok(id, {
        content: textContent(createPromptBundle(raw, { seasonLabel: args.seasonLabel }))
      });
    }

    return error(id, -32602, `Unknown tool: ${name}`);
  }

  if (method === "resources/list") {
    return ok(id, {
      resources: [
        {
          uri: "stareplays://team-analysis/raw",
          name: "Stareplays Team Analysis Raw Data",
          description: "Latest 3x3 team-analysis raw snapshot.",
          mimeType: "application/json"
        }
      ]
    });
  }

  if (method === "resources/read") {
    const uri = request.params?.uri;
    if (uri !== "stareplays://team-analysis/raw") {
      return error(id, -32602, `Unknown resource: ${uri}`);
    }
    const raw = await fetchTeamAnalysisRaw({ apiBaseUrl, fetchImpl });

    return ok(id, {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(raw, null, 2)
        }
      ]
    });
  }

  if (method === "prompts/list") {
    return ok(id, {
      prompts: [
        {
          name: "analyze_team_matchups",
          description: "Analyze 3x3 team matchups, player strengths, race fit, and recommended lineups.",
          arguments: [
            {
              name: "seasonLabel",
              description: "Optional season label, for example 시즌7.",
              required: false
            }
          ]
        }
      ]
    });
  }

  if (method === "prompts/get") {
    const name = request.params?.name;
    const args = request.params?.arguments ?? {};
    if (name !== "analyze_team_matchups") {
      return error(id, -32602, `Unknown prompt: ${name}`);
    }
    const raw = await fetchTeamAnalysisRaw({ apiBaseUrl, seasonLabel: args.seasonLabel, fetchImpl });

    return ok(id, {
      description: "3x3 팀 전적 분석 프롬프트",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: createPromptBundle(raw, { seasonLabel: args.seasonLabel })
          }
        }
      ]
    });
  }

  if (method?.startsWith("notifications/")) {
    return null;
  }

  return error(id, -32601, `Unknown method: ${method}`);
}
