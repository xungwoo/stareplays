#!/usr/bin/env node
import { DEFAULT_API_BASE_URL } from "../lib/client.mjs";
import { installMcpConfig } from "../lib/install.mjs";

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const client = readArg("--client", "both");
const apiBaseUrl = readArg("--api-base-url", process.env.STAREPLAYS_API_BASE_URL || DEFAULT_API_BASE_URL);

const result = await installMcpConfig({ client, apiBaseUrl });

console.log("Stareplays MCP config installed.");
if (result.claudeConfigPath) console.log(`Claude Desktop: ${result.claudeConfigPath}`);
if (result.codexConfigPath) console.log(`Codex: ${result.codexConfigPath}`);
console.log("Restart the target client so it reloads MCP configuration.");
