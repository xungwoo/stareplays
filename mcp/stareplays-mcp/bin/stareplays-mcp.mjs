#!/usr/bin/env node
import { chmod, copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_API_BASE_URL, DEFAULT_CACHE_TTL_SECONDS, DEFAULT_TIMEOUT_MS } from "../lib/client.mjs";
import { installMcpConfig } from "../lib/install.mjs";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const files = [
  "bin/stareplays-mcp-server.mjs",
  "lib/client.mjs",
  "lib/mcp-server.mjs",
  "lib/prompt-bundle.mjs",
  "lib/stdio.mjs"
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
    "Usage: stareplays-mcp <command> [options]",
    "",
    "Commands:",
    "  install                         Install runtime files and update MCP client config",
    "  server                          Run the MCP server over stdio",
    "",
    "Install options:",
    "  --client claude-desktop|claude-code|codex|both|all",
    "                                   MCP client config to update. Default: both",
    "                                   both = Claude Desktop + Codex",
    "  --api-base-url <url>             Stareplays app base URL. Default: production",
    "  --install-dir <path>             Install directory. Default: ~/.stareplays/mcp/stareplays-mcp",
    "  --cache-ttl-seconds <seconds>    Local cache TTL. Default: 300",
    "  --timeout-ms <ms>                API request timeout. Default: 10000",
    "  --extra-ca-certs <path>          Extra CA bundle for Node TLS. Default: auto-detect",
    "",
    "Examples:",
    "  npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client codex",
    "  npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client claude-code",
    "  npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client all",
    "  npx -y --package github:xungwoo/stareplays#main stareplays-mcp install --client codex --install-dir ~/.local/share/stareplays-mcp"
  ].join("\n");
}

function defaultInstallDir() {
  return join(process.env.HOME ?? process.cwd(), ".stareplays", "mcp", "stareplays-mcp");
}

async function copyRuntime(installDir) {
  for (const relativePath of files) {
    const sourcePath = join(packageRoot, relativePath);
    const targetPath = join(installDir, relativePath);

    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);

    if (relativePath.startsWith("bin/")) {
      await chmod(targetPath, 0o755);
    }
  }
}

async function install() {
  const client = readArg("--client", "both");
  const apiBaseUrl = readArg("--api-base-url", process.env.STAREPLAYS_API_BASE_URL || DEFAULT_API_BASE_URL);
  const installDir = readArg("--install-dir", defaultInstallDir());
  const cacheTtlSeconds = Number(readArg("--cache-ttl-seconds", process.env.STAREPLAYS_MCP_CACHE_TTL_SECONDS || DEFAULT_CACHE_TTL_SECONDS));
  const timeoutMs = Number(readArg("--timeout-ms", process.env.STAREPLAYS_MCP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const extraCaCerts = readArg("--extra-ca-certs", process.env.STAREPLAYS_MCP_EXTRA_CA_CERTS || process.env.NODE_EXTRA_CA_CERTS || undefined);

  await copyRuntime(installDir);

  const serverPath = join(installDir, "bin", "stareplays-mcp-server.mjs");
  const result = await installMcpConfig({ client, serverPath, apiBaseUrl, cacheTtlSeconds, timeoutMs, extraCaCerts });

  console.log(`Stareplays MCP runtime installed into ${installDir}`);
  if (result.claudeConfigPath) console.log(`Claude Desktop: ${result.claudeConfigPath}`);
  if (result.codexConfigPath) console.log(`Codex: ${result.codexConfigPath}`);
  if (result.claudeCodeConfigPath) console.log(`Claude Code: ${result.claudeCodeConfigPath}`);
  if (result.extraCaCerts) console.log(`Extra CA certificates: ${result.extraCaCerts}`);
  console.log("Restart the target client so it reloads MCP configuration.");
}

async function runServer() {
  await import("./stareplays-mcp-server.mjs");
}

async function main() {
  if (hasArg("--help") || hasArg("-h")) {
    console.log(usage());
    return;
  }

  const command = process.argv[2] ?? "install";
  if (command === "install") {
    await install();
    return;
  }

  if (command === "server") {
    await runServer();
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
