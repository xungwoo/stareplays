import { DEFAULT_API_BASE_URL } from "./client.mjs";
import { handleMcpRequest } from "./mcp-server.mjs";

export function startStdioServer({
  input = process.stdin,
  output = process.stdout,
  apiBaseUrl = process.env.STAREPLAYS_API_BASE_URL || DEFAULT_API_BASE_URL
} = {}) {
  input.setEncoding("utf8");

  let buffer = "";
  input.on("data", async (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const request = JSON.parse(trimmed);
        const response = await handleMcpRequest({ request, apiBaseUrl });
        if (response) output.write(`${JSON.stringify(response)}\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        output.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message } })}\n`);
      }
    }
  });
}
