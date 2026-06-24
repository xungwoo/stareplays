import { loadTeamAnalysisRaw } from "./client.mjs";
import { createPromptBundle } from "./prompt-bundle.mjs";

const protocolVersion = "2024-11-05";

function ok(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function error(id, code, message, data) {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } };
}

function textContent(text) {
  return [{ type: "text", text }];
}

async function loadRawOrError({ id, apiBaseUrl, seasonLabel, fetchImpl, forceRefresh = false }) {
  try {
    return await loadTeamAnalysisRaw({
      apiBaseUrl,
      seasonLabel,
      fetchImpl,
      forceRefresh
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return error(id, -32000, message, {
      code: err?.code ?? "STAREPLAYS_API_ERROR",
      status: err?.status ?? null
    });
  }
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
    if (name !== "get_team_analysis_raw" && name !== "get_team_analysis_prompt_bundle") {
      return error(id, -32602, `Unknown tool: ${name}`);
    }

    const result = await loadRawOrError({ id, apiBaseUrl, seasonLabel: args.seasonLabel, fetchImpl, forceRefresh: args.forceRefresh === true });
    if (result.error) return result;
    const raw = result.payload;

    if (name === "get_team_analysis_raw") {
      return ok(id, {
        content: textContent(JSON.stringify(raw, null, 2)),
        _meta: {
          cache: result.cache
        }
      });
    }

    if (name === "get_team_analysis_prompt_bundle") {
      return ok(id, {
        content: textContent(createPromptBundle(raw, { seasonLabel: args.seasonLabel })),
        _meta: {
          cache: result.cache
        }
      });
    }
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
    const result = await loadRawOrError({ id, apiBaseUrl, fetchImpl });
    if (result.error) return result;
    const raw = result.payload;

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
    const result = await loadRawOrError({ id, apiBaseUrl, seasonLabel: args.seasonLabel, fetchImpl });
    if (result.error) return result;
    const raw = result.payload;

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
