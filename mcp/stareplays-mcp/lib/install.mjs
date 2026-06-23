import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_API_BASE_URL } from "./client.mjs";

const markerStart = "# >>> stareplays-mcp >>>";
const markerEnd = "# <<< stareplays-mcp <<<";

function jsonString(value) {
  return JSON.stringify(value);
}

function defaultServerPath() {
  return fileURLToPath(new URL("../bin/stareplays-mcp-server.mjs", import.meta.url));
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

async function writeClaudeConfig({ homeDir, serverPath, apiBaseUrl }) {
  const configPath = join(homeDir, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  const config = await readJsonIfExists(configPath, {});
  config.mcpServers = {
    ...(config.mcpServers ?? {}),
    stareplays: {
      command: "node",
      args: [serverPath],
      env: {
        STAREPLAYS_API_BASE_URL: apiBaseUrl
      }
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

async function writeCodexConfig({ homeDir, serverPath, apiBaseUrl }) {
  const configPath = join(homeDir, ".codex", "config.toml");
  const current = await readTextIfExists(configPath);
  const block = [
    "[mcp_servers.stareplays]",
    "command = \"node\"",
    `args = [${jsonString(serverPath)}]`,
    `[mcp_servers.stareplays.env]`,
    `STAREPLAYS_API_BASE_URL = ${jsonString(apiBaseUrl)}`
  ].join("\n");

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, replaceMarkedBlock(current, block));

  return configPath;
}

export async function installMcpConfig({
  client = "both",
  homeDir = process.env.HOME,
  serverPath = defaultServerPath(),
  apiBaseUrl = DEFAULT_API_BASE_URL
} = {}) {
  if (!homeDir) throw new Error("HOME directory is required");

  const result = {
    claudeConfigPath: null,
    codexConfigPath: null
  };

  if (client === "claude" || client === "both") {
    result.claudeConfigPath = await writeClaudeConfig({ homeDir, serverPath, apiBaseUrl });
  }

  if (client === "codex" || client === "both") {
    result.codexConfigPath = await writeCodexConfig({ homeDir, serverPath, apiBaseUrl });
  }

  return result;
}
