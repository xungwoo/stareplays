#!/usr/bin/env node
import { DEFAULT_API_BASE_URL, DEFAULT_CACHE_TTL_SECONDS, DEFAULT_TIMEOUT_MS } from "../lib/client.mjs";
import { installMcpConfig } from "../lib/install.mjs";

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const client = readArg("--client", "both");
const apiBaseUrl = readArg("--api-base-url", process.env.STAREPLAYS_API_BASE_URL || DEFAULT_API_BASE_URL);
const cacheTtlSeconds = Number(readArg("--cache-ttl-seconds", process.env.STAREPLAYS_MCP_CACHE_TTL_SECONDS || DEFAULT_CACHE_TTL_SECONDS));
const timeoutMs = Number(readArg("--timeout-ms", process.env.STAREPLAYS_MCP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
const extraCaCerts = readArg("--extra-ca-certs", process.env.STAREPLAYS_MCP_EXTRA_CA_CERTS || process.env.NODE_EXTRA_CA_CERTS || undefined);

const result = await installMcpConfig({ client, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts });

console.log("Stareplays MCP config installed.");
if (result.claudeConfigPath) console.log(`Claude Desktop: ${result.claudeConfigPath}`);
if (result.codexConfigPath) console.log(`Codex: ${result.codexConfigPath}`);
if (result.claudeCodeConfigPath) console.log(`Claude Code: ${result.claudeCodeConfigPath}`);
if (result.extraCaCerts) console.log(`Extra CA certificates: ${result.extraCaCerts}`);
console.log("Restart the target client so it reloads MCP configuration.");
