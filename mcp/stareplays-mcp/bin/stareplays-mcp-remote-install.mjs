#!/usr/bin/env node
import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_API_BASE_URL = "https://stareplays-next-production.up.railway.app";
const DEFAULT_CACHE_TTL_SECONDS = 300;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_REF = "main";
const markerStart = "# >>> stareplays-mcp >>>";
const markerEnd = "# <<< stareplays-mcp <<<";
const files = [
  "bin/stareplays-mcp-server.mjs",
  "lib/client.mjs",
  "lib/mcp-server.mjs",
  "lib/prompt-bundle.mjs",
  "lib/stdio.mjs"
];
const defaultExtraCaCertPaths = [
  "/opt/homebrew/etc/ca-certificates/cert.pem",
  "/usr/local/etc/ca-certificates/cert.pem",
  "/etc/ssl/cert.pem",
  "/etc/ssl/certs/ca-certificates.crt"
];

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function usage() {
  return [
    "Usage: node stareplays-mcp-remote-install.mjs [options]",
    "",
    "Options:",
    "  --client claude|codex|both       MCP client config to update. Default: both",
    "  --api-base-url <url>             Stareplays app base URL. Default: production",
    "  --install-dir <path>             Install directory. Default: ~/.stareplays/mcp/stareplays-mcp",
    "  --cache-ttl-seconds <seconds>    Local cache TTL. Default: 300",
    "  --timeout-ms <ms>                API request timeout. Default: 10000",
    "  --extra-ca-certs <path>          Extra CA bundle for Node TLS. Default: auto-detect",
    "  --ref <git-ref>                  Git ref for raw GitHub downloads. Default: main",
    "  --source-base-url <url>          Override raw file base URL",
    "  --help                           Show this help"
  ].join("\n");
}

function jsonString(value) {
  return JSON.stringify(value);
}

function defaultSourceBaseUrl(ref) {
  return `https://raw.githubusercontent.com/xungwoo/stareplays/${encodeURIComponent(ref)}/mcp/stareplays-mcp`;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function detectExtraCaCerts() {
  for (const path of defaultExtraCaCertPaths) {
    if (await fileExists(path)) return path;
  }
  return null;
}

async function readJsonIfExists(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function readTextIfExists(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function downloadFile({ sourceBaseUrl, relativePath, installDir }) {
  const url = `${normalizeBaseUrl(sourceBaseUrl)}/${relativePath}`;
  const response = await fetch(url, { headers: { accept: "text/plain" } });

  if (!response.ok) {
    throw new Error(`Failed to download ${relativePath}: HTTP ${response.status}`);
  }

  const targetPath = join(installDir, relativePath);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, await response.text());

  if (relativePath.startsWith("bin/")) {
    await chmod(targetPath, 0o755);
  }

  return targetPath;
}

function mcpEnv({ apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts }) {
  const env = {
    STAREPLAYS_API_BASE_URL: apiBaseUrl,
    STAREPLAYS_MCP_CACHE_TTL_SECONDS: String(cacheTtlSeconds),
    STAREPLAYS_MCP_TIMEOUT_MS: String(timeoutMs)
  };

  if (extraCaCerts) env.NODE_EXTRA_CA_CERTS = extraCaCerts;
  return env;
}

async function writeClaudeConfig({ homeDir, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts }) {
  const configPath = join(homeDir, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  const config = await readJsonIfExists(configPath, {});
  config.mcpServers = {
    ...(config.mcpServers ?? {}),
    stareplays: {
      command: "node",
      args: [serverPath],
      env: mcpEnv({ apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts })
    }
  };

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  return configPath;
}

function replaceMarkedBlock(text, block) {
  const pattern = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}\\n?`, "m");
  const nextBlock = `${markerStart}\n${block}\n${markerEnd}\n`;

  return pattern.test(text) ? text.replace(pattern, nextBlock) : `${text.trimEnd()}\n\n${nextBlock}`;
}

async function writeCodexConfig({ homeDir, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts }) {
  const configPath = join(homeDir, ".codex", "config.toml");
  const current = await readTextIfExists(configPath);
  const block = [
    "[mcp_servers.stareplays]",
    "command = \"node\"",
    `args = [${jsonString(serverPath)}]`,
    "[mcp_servers.stareplays.env]",
    `STAREPLAYS_API_BASE_URL = ${jsonString(apiBaseUrl)}`,
    `STAREPLAYS_MCP_CACHE_TTL_SECONDS = ${jsonString(String(cacheTtlSeconds))}`,
    `STAREPLAYS_MCP_TIMEOUT_MS = ${jsonString(String(timeoutMs))}`,
    ...(extraCaCerts ? [`NODE_EXTRA_CA_CERTS = ${jsonString(extraCaCerts)}`] : [])
  ].join("\n");

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, replaceMarkedBlock(current, block));

  return configPath;
}

async function installMcpConfig({ client, homeDir, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts }) {
  if (!["claude", "codex", "both"].includes(client)) {
    throw new Error(`Unsupported --client value: ${client}`);
  }

  const result = {
    claudeConfigPath: null,
    codexConfigPath: null
  };

  if (client === "claude" || client === "both") {
    result.claudeConfigPath = await writeClaudeConfig({ homeDir, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts });
  }

  if (client === "codex" || client === "both") {
    result.codexConfigPath = await writeCodexConfig({ homeDir, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts });
  }

  return result;
}

async function main() {
  if (hasArg("--help") || hasArg("-h")) {
    console.log(usage());
    return;
  }

  if (typeof fetch !== "function") {
    throw new Error("Node.js 18 or newer is required because this installer uses global fetch.");
  }

  const homeDir = process.env.HOME || homedir();
  const client = readArg("--client", "both");
  const apiBaseUrl = readArg("--api-base-url", process.env.STAREPLAYS_API_BASE_URL || DEFAULT_API_BASE_URL);
  const cacheTtlSeconds = Number(readArg("--cache-ttl-seconds", process.env.STAREPLAYS_MCP_CACHE_TTL_SECONDS || DEFAULT_CACHE_TTL_SECONDS));
  const timeoutMs = Number(readArg("--timeout-ms", process.env.STAREPLAYS_MCP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const ref = readArg("--ref", DEFAULT_REF);
  const installDir = readArg("--install-dir", join(homeDir, ".stareplays", "mcp", "stareplays-mcp"));
  const sourceBaseUrl = readArg("--source-base-url", defaultSourceBaseUrl(ref));
  const explicitExtraCaCerts = readArg("--extra-ca-certs", process.env.STAREPLAYS_MCP_EXTRA_CA_CERTS || process.env.NODE_EXTRA_CA_CERTS || undefined);
  const extraCaCerts = explicitExtraCaCerts === undefined ? await detectExtraCaCerts() : explicitExtraCaCerts;

  console.log(`Installing Stareplays MCP runtime into ${installDir}`);
  for (const relativePath of files) {
    await downloadFile({ sourceBaseUrl, relativePath, installDir });
  }

  const serverPath = join(installDir, "bin", "stareplays-mcp-server.mjs");
  const result = await installMcpConfig({ client, homeDir, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts });

  console.log("Stareplays MCP config installed.");
  if (result.claudeConfigPath) console.log(`Claude Desktop: ${result.claudeConfigPath}`);
  if (result.codexConfigPath) console.log(`Codex: ${result.codexConfigPath}`);
  if (extraCaCerts) console.log(`Extra CA certificates: ${extraCaCerts}`);
  console.log("Restart the target client so it reloads MCP configuration.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
