#!/usr/bin/env node
import { chmod, copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_API_BASE_URL } from "../lib/client.mjs";
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
    "  --client claude|codex|both       MCP client config to update. Default: both",
    "  --api-base-url <url>             Stareplays app base URL. Default: production",
    "  --install-dir <path>             Install directory. Default: ~/.stareplays/mcp/stareplays-mcp",
    "",
    "Examples:",
    "  npx -y stareplays-mcp install --client both",
    "  npx -y stareplays-mcp install --client codex --api-base-url http://127.0.0.1:3100"
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

  await copyRuntime(installDir);

  const serverPath = join(installDir, "bin", "stareplays-mcp-server.mjs");
  const result = await installMcpConfig({ client, serverPath, apiBaseUrl });

  console.log(`Stareplays MCP runtime installed into ${installDir}`);
  if (result.claudeConfigPath) console.log(`Claude Desktop: ${result.claudeConfigPath}`);
  if (result.codexConfigPath) console.log(`Codex: ${result.codexConfigPath}`);
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
